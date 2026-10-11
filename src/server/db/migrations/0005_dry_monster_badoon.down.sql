ALTER TABLE "transactions" DROP COLUMN IF EXISTS "mock_order";
ALTER TABLE "transactions" ALTER COLUMN "payment_provider" SET DEFAULT 'xendit';
