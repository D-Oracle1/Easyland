import { LoyaltyTier } from '@prisma/client';

/**
 * Realtor tiers are earned from total sales value (₦) — the sum of salePrice
 * over COMPLETED and IN_PROGRESS sales (see SaleService.updateRealtorStats).
 * Tier is recalculated whenever that total changes, so it can also go down
 * if a sale is cancelled.
 */
export const TIER_ORDER: LoyaltyTier[] = [
  LoyaltyTier.BRONZE,
  LoyaltyTier.SILVER,
  LoyaltyTier.GOLD,
  LoyaltyTier.PLATINUM,
];

export const TIER_VALUE_THRESHOLDS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]: 0,
  [LoyaltyTier.SILVER]: 50_000_000,
  [LoyaltyTier.GOLD]: 150_000_000,
  [LoyaltyTier.PLATINUM]: 500_000_000,
};

/** Commission is a flat rate for every tier. */
export const FLAT_COMMISSION_RATE = 0.12;

export function tierForSalesValue(totalSalesValue: number): LoyaltyTier {
  for (let i = TIER_ORDER.length - 1; i >= 0; i--) {
    if (totalSalesValue >= TIER_VALUE_THRESHOLDS[TIER_ORDER[i]]) return TIER_ORDER[i];
  }
  return LoyaltyTier.BRONZE;
}

export function nextTier(tier: LoyaltyTier): LoyaltyTier | null {
  const i = TIER_ORDER.indexOf(tier);
  return i >= 0 && i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : null;
}

export function tierRank(tier: LoyaltyTier): number {
  return TIER_ORDER.indexOf(tier);
}
