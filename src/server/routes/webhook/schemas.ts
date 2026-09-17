export const webhookSchema = {
  detail: {
    tags: ["Webhook"],
    summary: "Xendit Invoice Webhook Handler",
    description: "Receives payment callbacks from Xendit and automatically provisions licenses (Idempotent)",
  },
};

export const danaWebhookSchema = {
  detail: {
    tags: ["Webhook"],
    summary: "DANA Finish Payment Webhook Handler",
    description: "Receives payment notifications from DANA Enterprise and automatically provisions licenses (Idempotent)",
  },
};

export const danaDisburseWebhookSchema = {
  detail: {
    tags: ["Webhook"],
    summary: "DANA Disburse to Bank Notify Handler",
    description: "Receives disbursement notifications from DANA Enterprise and updates payout ledger",
  },
};
