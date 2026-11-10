INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES ('momo_payout_sender', '"Dwumasi Agye"'::jsonb, NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = '"Dwumasi Agye"'::jsonb, "updatedAt" = NOW();
