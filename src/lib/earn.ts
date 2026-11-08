// Staking & savings: subscribe, lazy interest accrual, redeem.
import { prisma } from './db';
import { credit, debit } from './wallet';

/** Accrue interest on a position since last update (simple pro-rata APY). */
export async function accruePosition(positionId: string) {
  return prisma.$transaction(async (db) => {
    const pos = await db.position.findUnique({ where: { id: positionId }, include: { product: true } });
    if (!pos || pos.status !== 'ACTIVE') return pos;
    const now = Date.now();
    const last = pos.updatedAt.getTime();
    const elapsedYears = (now - last) / (365 * 24 * 3600 * 1000);
    if (elapsedYears <= 0) return pos;
    const interest = Number(pos.amount) * (Number(pos.product.apy) / 100) * elapsedYears;
    return db.position.update({
      where: { id: positionId },
      data: { accrued: { increment: interest } },
      include: { product: true },
    });
  });
}

export async function subscribe(userId: string, productId: string, amount: number) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product || !product.active) throw new Error('Product unavailable');
  if (amount < Number(product.minAmount)) {
    throw new Error(`Minimum amount is ${product.minAmount} ${product.asset}`);
  }
  return prisma.$transaction(async (db) => {
    await debit(db, userId, product.asset, amount);
    const endsAt = product.termDays
      ? new Date(Date.now() + product.termDays * 24 * 3600 * 1000)
      : null;
    const pos = await db.position.create({
      data: { userId, productId, amount, endsAt },
    });
    await db.transaction.create({
      data: {
        userId,
        type: product.type === 'STAKING' ? 'STAKE' : 'STAKE',
        asset: product.asset,
        amount,
        note: `Subscribed to ${product.name}`,
        meta: { productId, positionId: pos.id },
      },
    });
    return pos;
  });
}

export async function redeem(userId: string, positionId: string) {
  const accrued = await accruePosition(positionId);
  if (!accrued) throw new Error('Position not found');
  return prisma.$transaction(async (db) => {
    const pos = await db.position.findUnique({ where: { id: positionId }, include: { product: true } });
    if (!pos || pos.userId !== userId) throw new Error('Position not found');
    if (pos.status !== 'ACTIVE') throw new Error('Already redeemed');
    if (pos.endsAt && pos.endsAt.getTime() > Date.now()) {
      throw new Error(`Locked until ${pos.endsAt.toLocaleDateString()}`);
    }
    const principal = Number(pos.amount);
    const interest = Number(pos.accrued);
    await credit(db, userId, pos.product.asset, principal + interest);
    await db.position.update({ where: { id: positionId }, data: { status: 'REDEEMED' } });
    await db.transaction.create({
      data: {
        userId,
        type: 'UNSTAKE',
        asset: pos.product.asset,
        amount: principal,
        note: `Redeemed ${pos.product.name}`,
        meta: { positionId, interest },
      },
    });
    if (interest > 0) {
      await db.transaction.create({
        data: {
          userId,
          type: 'EARN_INTEREST',
          asset: pos.product.asset,
          amount: interest,
          note: `Interest from ${pos.product.name}`,
        },
      });
    }
    return { principal, interest };
  });
}
