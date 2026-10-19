import { slugify, uniqueSlug, UUID_RE } from './property-slug';

describe('slugify', () => {
  it.each([
    ['HARMONY GARDENS', 'harmony-gardens'],
    ["ZINA's TERRACE", 'zinas-terrace'],
    ['VINTAGE PREMIUM ESTATE ', 'vintage-premium-estate'],
    ['SAVANNAH ESTATE. PHASE II', 'savannah-estate-phase-ii'],
    ['CITY DELUXE ESTATE, ALONG OBIRI IKWERRE - AIRPORT ROAD', 'city-deluxe-estate-along-obiri-ikwerre-airport-road'],
    ['Lands & Homes', 'lands-and-homes'],
    ['***', 'property'],
  ])('%s → %s', (title, slug) => expect(slugify(title)).toBe(slug));

  it('caps length without a trailing dash', () => {
    const s = slugify('a'.repeat(79) + ' bcd');
    expect(s.length).toBeLessThanOrEqual(80);
    expect(s.endsWith('-')).toBe(false);
  });
});

describe('uniqueSlug', () => {
  const prismaWith = (slugs: string[]) => ({
    property: { findMany: async () => slugs.map((slug, i) => ({ id: String(i), slug })) },
  });

  it('uses the plain slug when free', async () => {
    expect(await uniqueSlug(prismaWith([]), 'Harmony Gardens')).toBe('harmony-gardens');
  });

  it('adds the next free number on collision', async () => {
    expect(await uniqueSlug(prismaWith(['harmony-gardens', 'harmony-gardens-2']), 'Harmony Gardens')).toBe('harmony-gardens-3');
  });

  it('does not treat a longer slug with the same prefix as a collision', async () => {
    expect(await uniqueSlug(prismaWith(['harmony-gardens-estate']), 'Harmony Gardens')).toBe('harmony-gardens');
  });
});

it('recognises ids vs slugs', () => {
  expect(UUID_RE.test('d7874aa5-8b29-4d60-8e50-6252195411b9')).toBe(true);
  expect(UUID_RE.test('harmony-gardens')).toBe(false);
});
