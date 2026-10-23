-- Retired provider secrets are intentionally not reconstructed.
-- Restore credentials from a secure backup if rolling back the application.
ALTER TABLE "transactions" ALTER COLUMN "payment_provider" SET DEFAULT 'dana';
