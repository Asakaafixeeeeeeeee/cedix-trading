// AI-driven content moderation for Orbit.
// Scores content 0–100 for fraud/scam likelihood, flags or removes it,
// and auto-blocks repeat offenders.

import { prisma } from './db';

export type ModResult = {
  score: number;
  reasons: string[];
  action: 'NONE' | 'FLAG' | 'REMOVE' | 'BLOCK_USER';
};

type Rule = { pattern: RegExp; weight: number; reason: string };

const RULES: Rule[] = [
  // Classic crypto fraud
  { pattern: /\b(double|triple|2x|10x)\s+(your|ur)\s+(money|crypto|btc|investment|deposit)\b/i, weight: 60, reason: 'Investment doubling scam pattern' },
  { pattern: /\b(guaranteed|assured|risk[- ]?free)\s+(profit|returns?|income|gains?)\b/i, weight: 50, reason: 'Guaranteed-profit claim' },
  { pattern: /\bsend\s+(me\s+)?\d*\s*(btc|eth|usdt|sol|crypto|cedis?|ghs)\b.*\b(receive|get|back|return)\b/i, weight: 70, reason: 'Send-to-receive scam' },
  { pattern: /\b(giveaway|air ?drop)\b.*\b(send|deposit|verify|claim|wallet)\b/i, weight: 55, reason: 'Fake giveaway/airdrop' },
  { pattern: /\b(seed\s*phrase|recovery\s*phrase|private\s*key|secret\s*key)\b/i, weight: 75, reason: 'Credential/seed phrase solicitation' },
  { pattern: /\b(account\s+manager|trade\s+on\s+your\s+behalf|manage\s+your\s+(account|funds))\b/i, weight: 55, reason: 'Account management scam' },
  { pattern: /\b(binary\s+options?|forex\s+manager|signal\s+group)\b.*\b(join|dm|whatsapp|telegram)\b/i, weight: 50, reason: 'Signal group solicitation' },
  // Off-platform solicitation
  { pattern: /\b(whats ?app|telegram|t\.me|wa\.me)\b.*(\+?\d[\d\s-]{7,})/i, weight: 45, reason: 'Off-platform contact solicitation' },
  { pattern: /\bdm\s+me\b.*\b(invest|profit|trade|earn)\b/i, weight: 40, reason: 'DM solicitation for investment' },
  // Payment solicitation
  { pattern: /\b(momo|mobile\s+money)\b.*\b(send|pay|transfer)\b.*\b0\d{9}\b/i, weight: 60, reason: 'Direct MoMo payment solicitation' },
  { pattern: /\b0\d{9}\b.*\b(send|pay|deposit)\b/i, weight: 35, reason: 'Phone number payment request' },
  // Phishing
  { pattern: /\b(verify|unlock|reactivate)\s+(your\s+)?(account|wallet)\b.*\b(link|click|visit)\b/i, weight: 55, reason: 'Phishing language' },
  { pattern: /https?:\/\/(?!(?:www\.)?(cedix|okx|binance|coinbase|tradingview|x|twitter|youtube)\.)[^\s]+\.(xyz|top|click|link|icu|live|site|online)\b/i, weight: 45, reason: 'Suspicious link domain' },
  // Spam signals
  { pattern: /(.)\1{9,}/, weight: 15, reason: 'Character spam' },
  { pattern: /\b(URGENT|ACT NOW|LIMITED TIME|HURRY)\b/, weight: 15, reason: 'Pressure language' },
];

export function scoreContent(content: string): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  for (const rule of RULES) {
    if (rule.pattern.test(content)) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }
  // All-caps shouting (long content only)
  const letters = content.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 40 && letters === letters.toUpperCase()) {
    score += 15;
    reasons.push('Excessive capitalization');
  }
  return { score: Math.min(100, score), reasons };
}

const REMOVE_THRESHOLD = 60;
const FLAG_THRESHOLD = 35;
const STRIKES_TO_BLOCK = 3;

/**
 * Moderate a piece of Orbit content. Persists a ModerationEvent, updates the
 * author's risk score and auto-blocks repeat offenders from Orbit.
 */
export async function moderate(
  targetType: 'POST' | 'COMMENT',
  targetId: string,
  authorId: string,
  content: string,
): Promise<ModResult> {
  const { score, reasons } = scoreContent(content);

  // Velocity check: more than 5 posts/comments in 10 minutes is suspicious
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recent =
    (await prisma.orbitPost.count({ where: { authorId, createdAt: { gte: tenMinAgo } } })) +
    (await prisma.orbitComment.count({ where: { authorId, createdAt: { gte: tenMinAgo } } }));
  let finalScore = score;
  if (recent > 5) {
    finalScore = Math.min(100, finalScore + 20);
    reasons.push('High posting velocity');
  }

  let action: ModResult['action'] = 'NONE';
  if (finalScore >= REMOVE_THRESHOLD) action = 'REMOVE';
  else if (finalScore >= FLAG_THRESHOLD) action = 'FLAG';

  if (action === 'REMOVE') {
    // strike → possible auto-block
    const user = await prisma.user.update({
      where: { id: authorId },
      data: { riskScore: { increment: 1 } },
    });
    if (user.riskScore >= STRIKES_TO_BLOCK && !user.orbitBanned) {
      await prisma.user.update({ where: { id: authorId }, data: { orbitBanned: true } });
      action = 'BLOCK_USER';
      reasons.push(`Auto-blocked after ${STRIKES_TO_BLOCK} fraud strikes`);
    }
  }

  if (action !== 'NONE') {
    await prisma.moderationEvent.create({
      data: {
        targetType,
        targetId,
        userId: authorId,
        score: finalScore,
        reasons,
        action,
        automated: true,
        resolved: action === 'FLAG' ? false : true,
      },
    });
  }

  return { score: finalScore, reasons, action };
}
