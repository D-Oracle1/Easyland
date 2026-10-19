import { toPublicProperty } from './property.service';

describe('toPublicProperty', () => {
  const land = {
    id: 'l1', type: 'LAND', title: 'Estate', price: 1300000000, originalPrice: 1040000000, listingPrice: null,
    pricePerSqm: 25000000, numberOfPlots: 52, area: 24180, lotSize: null, appreciationPercentage: 25,
    priceHistory: [{ oldPrice: 1, newPrice: 2 }], listingDetails: null,
  };

  it('never exposes the number of plots or the totals that reveal it', () => {
    const pub = toPublicProperty(land);
    for (const k of ['numberOfPlots', 'price', 'originalPrice', 'listingPrice', 'area', 'lotSize', 'priceHistory', 'appreciationPercentage']) {
      expect(pub).not.toHaveProperty(k);
    }
    expect(pub.pricePerSqm).toBe(25000000);
  });

  it('keeps the only price for land without a per-plot price, but still hides plots', () => {
    const pub = toPublicProperty({ ...land, pricePerSqm: null });
    expect(pub).not.toHaveProperty('numberOfPlots');
    expect(pub.price).toBe(1300000000);
  });

  it('leaves apartments untouched apart from sanitising listing details', () => {
    const home = { id: 'h1', type: 'RESIDENTIAL', price: 75000000, area: 465, listingDetails: { internalNotes: 'x' } };
    expect(toPublicProperty(home)).toEqual({ id: 'h1', type: 'RESIDENTIAL', price: 75000000, area: 465, listingDetails: null });
  });
});
