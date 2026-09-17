export interface CouponItem {
  id: string;
  code: string;
  appId: string | null;
  discountPercent: number;
  maxRedemptions: number;
  redemptionCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
