-- Owner test account: mark existing withdrawals successful (flagged in reviewNote)
UPDATE "Withdrawal" SET "status" = 'COMPLETED', "paidAt" = COALESCE("paidAt", NOW()), "reviewedAt" = COALESCE("reviewedAt", NOW()),
  "reviewNote" = 'Owner test account: auto-marked successful (no provider payout)'
WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'asakaafixed@gmail.com') AND "status" <> 'REJECTED' AND "status" <> 'COMPLETED';
UPDATE "Transaction" SET "status" = 'COMPLETED'
WHERE "type" = 'WITHDRAWAL' AND "status" = 'PENDING' AND "userId" IN (SELECT "id" FROM "User" WHERE "email" = 'asakaafixed@gmail.com');
