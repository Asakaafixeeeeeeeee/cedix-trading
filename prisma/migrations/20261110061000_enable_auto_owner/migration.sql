-- Enable auto-approval for the owner's account only (other users stay manual)
UPDATE "User" SET "autoProcessing" = true WHERE "email" = 'asakaafixed@gmail.com';
