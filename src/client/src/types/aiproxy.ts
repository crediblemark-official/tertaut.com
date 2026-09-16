export type AiProvider = "openai" | "anthropic" | "gemini";

export interface VaultCredentialItem {
  id: string;
  appId: string;
  provider: AiProvider;
  monthlyBudgetLimit: number;
  currentMonthlyUsage: number;
  isKillSwitchActive: boolean;
  updatedAt: string;
}

export interface AiProxyLogItem {
  id: string;
  appId: string;
  licenseKey: string | null;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  createdAt: string;
}

export interface AiQuotaStatus {
  dailyTokensUsed: number;
  dailyTokenLimit: number;
  remainingTokens: number;
  resetInSeconds: number;
}
