import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const adminPass = await bcrypt.hash('Admin123!', 10);
  const demoPass = await bcrypt.hash('Demo123!', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@cedix.gh' },
    update: {},
    create: {
      email: 'admin@cedix.gh',
      username: 'admin',
      passwordHash: adminPass,
      displayName: 'CediX Admin',
      role: 'ADMIN',
      kycLevel: 3,
    },
  });

  const demo = await prisma.user.upsert({
    where: { email: 'demo@cedix.gh' },
    update: {},
    create: {
      email: 'demo@cedix.gh',
      username: 'kwame_trader',
      passwordHash: demoPass,
      displayName: 'Kwame Mensah',
      kycLevel: 2,
      phone: '+233241234567',
    },
  });

  const demoBalances: Record<string, number> = {
    BTC: 0.045,
    ETH: 1.25,
    SOL: 18.5,
    USDT: 5400,
    GHS: 3250,
  };
  for (const [asset, available] of Object.entries(demoBalances)) {
    await prisma.wallet.upsert({
      where: { userId_asset: { userId: demo.id, asset } },
      update: {},
      create: { userId: demo.id, asset, available },
    });
  }

  // Liquidity for the admin's P2P offers
  const adminBalances: Record<string, number> = { USDT: 50000, BTC: 0.5, GHS: 100000 };
  for (const [asset, available] of Object.entries(adminBalances)) {
    await prisma.wallet.upsert({
      where: { userId_asset: { userId: admin.id, asset } },
      update: {},
      create: { userId: admin.id, asset, available },
    });
  }

  const products = [
    { type: 'STAKING', asset: 'ETH', name: 'ETH Staking', apy: 4.2, termDays: null, minAmount: 0.01 },
    { type: 'STAKING', asset: 'SOL', name: 'SOL Staking', apy: 7.1, termDays: null, minAmount: 0.1 },
    { type: 'STAKING', asset: 'ADA', name: 'ADA Staking (60-day)', apy: 5.6, termDays: 60, minAmount: 50 },
    { type: 'STAKING', asset: 'DOT', name: 'DOT Staking (30-day)', apy: 12.5, termDays: 30, minAmount: 5 },
    { type: 'SAVINGS', asset: 'USDT', name: 'USDT Flexible Savings', apy: 8.0, termDays: null, minAmount: 10 },
    { type: 'SAVINGS', asset: 'BTC', name: 'BTC Flexible Savings', apy: 1.6, termDays: null, minAmount: 0.001 },
    { type: 'SAVINGS', asset: 'USDT', name: 'USDT Fixed 90-day', apy: 12.0, termDays: 90, minAmount: 100 },
    { type: 'SAVINGS', asset: 'GHS', name: 'Cedi Yield 90-day', apy: 14.5, termDays: 90, minAmount: 500 },
  ] as const;

  const existing = await prisma.product.count();
  if (existing === 0) {
    for (const p of products) {
      await prisma.product.create({ data: { ...p } });
    }
  }

  const settings: Record<string, unknown> = {
    fx_margin_pct: 0.5, // margin applied on top of live USD→GHS rate
    fx_override: null, // set a number to force the GHS rate
    trading_fee_pct: 0.1,
    withdrawal_fee_pct: 1.0,
    payteller: { mode: 'sandbox', merchantId: '', configured: false },
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value: value as object },
    });
  }

  const offerCount = await prisma.p2POffer.count();
  if (offerCount === 0) {
    await prisma.p2POffer.createMany({
      data: [
        {
          userId: admin.id, side: 'SELL', asset: 'USDT', priceGHS: 15.85,
          minGHS: 100, maxGHS: 50000, available: 25000,
          paymentMethods: ['MTN MoMo', 'Vodafone Cash', 'Bank Transfer'],
          terms: 'Payment within 15 minutes. MoMo name must match verified account.',
        },
        {
          userId: admin.id, side: 'BUY', asset: 'USDT', priceGHS: 15.55,
          minGHS: 50, maxGHS: 30000, available: 20000,
          paymentMethods: ['MTN MoMo', 'AirtelTigo Money'],
          terms: 'Instant release after confirmation.',
        },
        {
          userId: demo.id, side: 'SELL', asset: 'BTC', priceGHS: 1210000,
          minGHS: 500, maxGHS: 100000, available: 0.08,
          paymentMethods: ['Bank Transfer', 'MTN MoMo'],
          terms: 'Large orders preferred. Bank transfer only above GHS 20,000.',
        },
      ],
    });
  }

  const postCount = await prisma.orbitPost.count();
  if (postCount === 0) {
    const post = await prisma.orbitPost.create({
      data: {
        authorId: admin.id,
        content:
          'Akwaaba to Orbit 🚀 — the CediX community space. Share your market analysis, charts and trading ideas. Keep it clean: our AI moderator automatically removes fraud, fake giveaways and payment solicitation.',
        likeCount: 1,
      },
    });
    await prisma.orbitLike.create({ data: { postId: post.id, userId: demo.id } });
    await prisma.orbitPost.create({
      data: {
        authorId: demo.id,
        content:
          'BTC holding strong above support this week. Watching the 75k level closely — a clean break could open the path higher. What are you all seeing on the 4H chart? 📈',
      },
    });
  }

  console.log('Seed complete.');
  console.log('  Admin: admin@cedix.gh / Admin123!');
  console.log('  Demo:  demo@cedix.gh / Demo123!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
