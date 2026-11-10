INSERT INTO "Setting" ("key", "value", "updatedAt") VALUES ('momo_payout_sender', '"CedixGhana"'::jsonb, NOW())
ON CONFLICT ("key") DO UPDATE SET "value" = '"CedixGhana"'::jsonb, "updatedAt" = NOW();
