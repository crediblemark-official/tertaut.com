import { AiGatewayService } from "../../services/aiGateway";

/**
 * Cek Status Kuota Penggunaan Token Harian
 * GET /api/v1/ai/quota-status dan GET /api/v1/ai-proxy/quota-status
 */
export async function handleGetQuotaStatus({ headers, query, set }: any) {
  const authHeader = headers["authorization"] || headers["Authorization"];
  const licenseKey = (query as any)?.licenseKey;

  const validation = await AiGatewayService.validateLicense(authHeader, licenseKey);
  if (!validation.valid || !validation.license) {
    set.status = validation.statusCode || 403;
    return {
      success: false,
      error: validation.error || "INVALID_LICENSE",
      message: validation.message || "Akses AI ditolak.",
    };
  }

  const modelAlias = (query as any)?.modelAlias || "default";
  const quota = await AiGatewayService.getQuotaStatus(validation.license, modelAlias);

  return {
    success: true,
    data: quota,
  };
}
