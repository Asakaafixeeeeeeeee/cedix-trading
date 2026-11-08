// Spot trading engine: order placement against live market prices,
// limit-order matching, fills, fees and balance movements.

import { prisma } from './db';
import { assetMeta, getPrice } from './markets';
import { credit, debit, lockFunds, unlockFunds, spendLocked } from './wallet';

async function tradingFeePct(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: 'trading_fee_pct' } });
  return typeof row?.value === 'number' ? row.value : 0.1;
}

export type PlaceOrderInput = {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT';
  price?: number; // required for LIMIT
  quantity: number; // base asset quantity
};

export async function placeOrder(userId: string, input: PlaceOrderInput) {
  const meta = assetMeta(input.symbol);
  if (!meta) throw new Error('Unknown trading pair');
  if (!(input.quantity > 0)) throw new Error('Quantity must be positive');
  if (input.type === 'LIMIT' && !(input.price && input.price > 0)) {
    throw new Error('Limit price required');
  }

  const marketPrice = await getPrice(input.symbol);
  if (!marketPrice) throw new Error('Market price unavailable');

  const feePct = await tradingFeePct();

  if (input.type === 'MARKET') {
    return fillOrder(userId, input, marketPrice, feePct);
  }

  // LIMIT order: fill immediately if marketable, otherwise lock funds and stay open
  const limit = input.price!;
  const marketable =
    (input.side === 'BUY' && marketPrice <= limit) ||
    (input.side === 'SELL' && marketPrice >= limit);
  if (marketable) {
    return fillOrder(userId, input, Math.min(limit, marketPrice), feePct, limit);
  }

  return prisma.$transaction(async (db) => {
    if (input.side === 'BUY') {
      await lockFunds(db, userId, meta.quote, input.quantity * limit);
    } else {
      await lockFunds(db, userId, meta.base, input.quantity);
    }
    return db.order.create({
      data: {
        userId,
        symbol: input.symbol,
        side: input.side,
        type: 'LIMIT',
        price: limit,
        quantity: input.quantity,
        status: 'OPEN',
      },
    });
  });
}

async function fillOrder(
  userId: string,
  input: PlaceOrderInput,
  execPrice: number,
  feePct: number,
  limitPrice?: number,
) {
  const meta = assetMeta(input.symbol)!;
  const qty = input.quantity;
  const quoteAmount = qty * execPrice;
  const fee = quoteAmount * (feePct / 100);

  return prisma.$transaction(async (db) => {
    if (input.side === 'BUY') {
      await debit(db, userId, meta.quote, quoteAmount + fee);
      await credit(db, userId, meta.base, qty);
    } else {
      await debit(db, userId, meta.base, qty);
      await credit(db, userId, meta.quote, quoteAmount - fee);
    }

    const order = await db.order.create({
      data: {
        userId,
        symbol: input.symbol,
        side: input.side,
        type: input.type,
        price: limitPrice ?? (input.type === 'LIMIT' ? input.price : null),
        quantity: qty,
        filledQty: qty,
        avgFillPrice: execPrice,
        status: 'FILLED',
      },
    });

    await db.trade.create({
      data: {
        orderId: order.id,
        userId,
        symbol: input.symbol,
        side: input.side,
        price: execPrice,
        quantity: qty,
        fee,
        feeAsset: meta.quote,
      },
    });

    await db.transaction.create({
      data: {
        userId,
        type: input.side === 'BUY' ? 'TRADE_BUY' : 'TRADE_SELL',
        asset: meta.base,
        amount: qty,
        fee,
        note: `${input.side} ${qty} ${meta.base} @ ${execPrice.toFixed(meta.precision)} ${meta.quote}`,
        meta: { symbol: input.symbol, execPrice, quoteAmount },
      },
    });

    return order;
  });
}

export async function cancelOrder(userId: string, orderId: string) {
  return prisma.$transaction(async (db) => {
    const order = await db.order.findUnique({ where: { id: orderId } });
    if (!order || order.userId !== userId) throw new Error('Order not found');
    if (order.status !== 'OPEN') throw new Error('Order is not open');
    const meta = assetMeta(order.symbol)!;
    const remaining = Number(order.quantity) - Number(order.filledQty);
    if (order.side === 'BUY') {
      await unlockFunds(db, userId, meta.quote, remaining * Number(order.price));
    } else {
      await unlockFunds(db, userId, meta.base, remaining);
    }
    return db.order.update({ where: { id: orderId }, data: { status: 'CANCELLED' } });
  });
}

/** Match all open limit orders against current market prices. Called periodically. */
export async function matchOpenOrders() {
  const open = await prisma.order.findMany({ where: { status: 'OPEN' } });
  if (open.length === 0) return 0;
  const feePct = await tradingFeePct();
  let filled = 0;

  const prices = new Map<string, number | null>();
  for (const order of open) {
    if (!prices.has(order.symbol)) prices.set(order.symbol, await getPrice(order.symbol));
    const market = prices.get(order.symbol);
    if (!market) continue;
    const limit = Number(order.price);
    const crosses =
      (order.side === 'BUY' && market <= limit) ||
      (order.side === 'SELL' && market >= limit);
    if (!crosses) continue;

    const meta = assetMeta(order.symbol)!;
    const qty = Number(order.quantity) - Number(order.filledQty);
    const quoteAmount = qty * limit; // fills at the limit price (locked amount)
    const fee = quoteAmount * (feePct / 100);

    try {
      await prisma.$transaction(async (db) => {
        if (order.side === 'BUY') {
          await spendLocked(db, order.userId, meta.quote, quoteAmount);
          await credit(db, order.userId, meta.base, qty - (qty * feePct) / 100);
        } else {
          await spendLocked(db, order.userId, meta.base, qty);
          await credit(db, order.userId, meta.quote, quoteAmount - fee);
        }
        await db.order.update({
          where: { id: order.id },
          data: { status: 'FILLED', filledQty: order.quantity, avgFillPrice: limit },
        });
        await db.trade.create({
          data: {
            orderId: order.id,
            userId: order.userId,
            symbol: order.symbol,
            side: order.side,
            price: limit,
            quantity: qty,
            fee,
            feeAsset: meta.quote,
          },
        });
        await db.transaction.create({
          data: {
            userId: order.userId,
            type: order.side === 'BUY' ? 'TRADE_BUY' : 'TRADE_SELL',
            asset: meta.base,
            amount: qty,
            fee,
            note: `Limit ${order.side} filled: ${qty} ${meta.base} @ ${limit}`,
            meta: { symbol: order.symbol, execPrice: limit },
          },
        });
      });
      filled++;
    } catch (e) {
      console.error('order match failed', order.id, e);
    }
  }
  return filled;
}
