import { BadRequestException } from '@nestjs/common';
import { normalizeListingDetails, toPublicListingDetails } from './listing-details';

describe('normalizeListingDetails', () => {
  it('saves incomplete, unapproved sections', () => {
    const out = normalizeListingDetails({ units: { totalUnits: '16' }, internalNotes: ' confirm date ' });
    expect(out).toEqual({ units: { approved: false, totalUnits: 16 }, internalNotes: 'confirm date' });
  });

  it('drops empty strings and keeps prices as numbers', () => {
    const out = normalizeListingDetails({
      overview: { approved: true, location: '  ', propertyType: '3-bedroom bungalow' },
      pricing: { approved: true, items: [{ label: 'Land', price: '25,000,000', deposit: 17000000 }, { label: 'empty' }] },
    });
    expect(out.overview).toEqual({ approved: true, propertyType: '3-bedroom bungalow' });
    expect(out.pricing.items).toEqual([{ label: 'Land', price: 25000000, deposit: 17000000 }]);
  });

  it.each([
    [{ pricing: { items: [{ price: -5 }] } }],
    [{ pricing: { items: [{ price: 'abc' }] } }],
    [{ delivery: { expected: 'early 2027' } }],
    [{ delivery: { expected: '2027-02-30' } }],
    [{ promotion: { startDate: '2026-11-10', endDate: '2026-11-01' } }],
    [{ construction: { updates: [{ note: 'Roofing' }] } }],
    [{ images: { items: [{ url: 'https://x/y.jpg', category: 'FINISHED' }] } }],
    [{ documents: { files: [{ url: 'javascript:alert(1)' }] } }],
  ])('rejects invalid input %j', (input) => {
    expect(() => normalizeListingDetails(input)).toThrow(BadRequestException);
  });

  it('accepts quarter, month and day delivery formats', () => {
    for (const expected of ['Q1 2027', '2027-03', '2027-03-31']) {
      expect(normalizeListingDetails({ delivery: { expected } }).delivery.expected).toBe(expected);
    }
  });
});

describe('toPublicListingDetails', () => {
  const today = new Date('2026-10-18T12:00:00Z');

  it('returns only approved, non-empty sections without flags or internal notes', () => {
    const pub = toPublicListingDetails(
      {
        units: { approved: true, totalUnits: 16 },
        pricing: { approved: false, items: [{ price: 1 }] },
        delivery: { approved: true, confirmed: false },
        internalNotes: 'secret',
      },
      today,
    );
    expect(pub).toEqual({ units: { totalUnits: 16 } });
  });

  it('hides expired promotions', () => {
    const details = { promotion: { approved: true, title: 'Offer', endDate: '2026-10-17' } };
    expect(toPublicListingDetails(details, today)).toBeNull();
    expect(toPublicListingDetails({ promotion: { ...details.promotion, endDate: '2026-10-18' } }, today)).not.toBeNull();
  });

  it('returns null for missing details', () => {
    expect(toPublicListingDetails(null)).toBeNull();
    expect(toPublicListingDetails({ internalNotes: 'x' })).toBeNull();
  });
});
