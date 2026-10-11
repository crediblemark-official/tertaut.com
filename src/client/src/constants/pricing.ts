import type { BillingPeriodType } from "../types/app";

export interface BillingPeriodOption {
  id: BillingPeriodType;
  label: string;
}

export const BILLING_PERIOD_OPTIONS: BillingPeriodOption[] = [
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Daily" },
  { id: "monthly", label: "Monthly" },
  { id: "every_3_months", label: "3 Months" },
  { id: "every_6_months", label: "6 Months" },
  { id: "yearly", label: "Yearly" },
  { id: "custom", label: "Custom" },
];
