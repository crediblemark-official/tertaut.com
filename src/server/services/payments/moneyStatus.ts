import type { GatewayMoneyStatus } from "./gateways/types";
export function normalizeMoneyStatus(status: unknown): GatewayMoneyStatus["status"] {
  const value = String(status || "").toUpperCase();
  if (["COMPLETED", "SUCCEEDED", "SUCCESS", "00"].includes(value)) return "COMPLETED";
  if (["FAILED", "CANCELLED", "REJECTED", "REVERSED", "04", "05", "06", "07"].includes(value))
    return "FAILED";
  if (["PROCESSING", "PENDING", "ACCEPTED", "REQUESTED", "01", "02", "03"].includes(value))
    return "PROCESSING";
  return "UNKNOWN";
}
