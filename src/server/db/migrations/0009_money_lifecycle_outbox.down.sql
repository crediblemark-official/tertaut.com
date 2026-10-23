ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "unique_webhook_event_endpoint";
ALTER TABLE "webhook_deliveries" DROP COLUMN "event_id", DROP COLUMN "claim_token", DROP COLUMN "locked_until";
ALTER TABLE "transactions" DROP COLUMN "refund_status", DROP COLUMN "refund_operation_id", DROP COLUMN "payout_operation_id";
DROP TABLE "payment_operations";
