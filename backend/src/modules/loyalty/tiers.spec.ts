import { tierForSalesValue, nextTier, tierRank } from './tiers';

describe('tiers', () => {
  it.each([
    [0, 'BRONZE'],
    [49_999_999, 'BRONZE'],
    [50_000_000, 'SILVER'],
    [74_250_000, 'SILVER'],
    [149_999_999, 'SILVER'],
    [150_000_000, 'GOLD'],
    [500_000_000, 'PLATINUM'],
  ])('₦%d → %s', (value, tier) => {
    expect(tierForSalesValue(value)).toBe(tier);
  });

  it('orders tiers and finds the next one', () => {
    expect(tierRank('SILVER' as any)).toBeGreaterThan(tierRank('BRONZE' as any));
    expect(nextTier('GOLD' as any)).toBe('PLATINUM');
    expect(nextTier('PLATINUM' as any)).toBeNull();
  });
});
