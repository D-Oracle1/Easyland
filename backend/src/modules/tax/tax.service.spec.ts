import { TaxService } from './tax.service';

describe('TaxService.updateAllTaxRecords', () => {
  const sales = [
    // already correct at 5% — nothing should be written
    { id: 's1', realtorId: 'r1', commissionAmount: 1000, commissionRate: 0.12, saleDate: new Date('2026-02-01') },
    // stale tax (old rate) — tax + sale figures updated
    { id: 's2', realtorId: 'r1', commissionAmount: 2000, commissionRate: 0.12, saleDate: new Date('2026-05-01') },
    // no tax / commission yet — both created
    { id: 's3', realtorId: 'r2', commissionAmount: 4000, commissionRate: 0.12, saleDate: new Date('2026-08-01') },
  ];

  function makePrisma() {
    const op = (name: string) => jest.fn((args: any) => ({ op: name, args }));
    const prisma: any = {
      sale: {
        findMany: jest.fn(async (q: any) =>
          q.where?.id
            ? [
                { id: 's1', taxRate: 0.05, taxAmount: 50, netAmount: 950 },
                { id: 's2', taxRate: 0.075, taxAmount: 150, netAmount: 1850 },
                { id: 's3', taxRate: 0.05, taxAmount: 200, netAmount: 3800 },
              ]
            : sales,
        ),
        update: op('sale.update'),
      },
      tax: {
        findMany: jest.fn(async () => [
          { saleId: 's1', amount: 50, rate: 0.05 },
          { saleId: 's2', amount: 150, rate: 0.075 },
        ]),
        create: op('tax.create'),
        update: op('tax.update'),
      },
      commission: {
        findMany: jest.fn(async () => [
          { saleId: 's1', amount: 1000 },
          { saleId: 's2', amount: 2000 },
        ]),
        create: op('commission.create'),
        update: op('commission.update'),
      },
      $transaction: jest.fn(async (ops: any[]) => ops),
    };
    return prisma;
  }

  it('reads in bulk and writes only the records that changed', async () => {
    const prisma = makePrisma();
    const service = new TaxService(prisma, { getMainTaxRate: async () => 0.05 } as any);

    const result = await service.updateAllTaxRecords();

    expect(result).toEqual({ updated: 1, created: 1 });
    const written = prisma.$transaction.mock.calls.flatMap((c: any[]) => c[0]).map((o: any) => `${o.op}:${o.args.where?.id ?? o.args.where?.saleId ?? o.args.data.saleId}`);
    expect(written.sort()).toEqual(['commission.create:s3', 'sale.update:s2', 'tax.create:s3', 'tax.update:s2']);
    // s3 tax lands in Q3 2026 at the current rate
    const taxCreate = prisma.tax.create.mock.calls[0][0].data;
    expect(taxCreate).toMatchObject({ amount: 200, rate: 0.05, year: 2026, quarter: 3 });
  });

  it('makes no writes when everything is already in sync', async () => {
    const prisma = makePrisma();
    prisma.sale.findMany = jest.fn(async (q: any) => (q.where?.id ? [{ id: 's1', taxRate: 0.05, taxAmount: 50, netAmount: 950 }] : [sales[0]]));
    const service = new TaxService(prisma, { getMainTaxRate: async () => 0.05 } as any);

    expect(await service.updateAllTaxRecords()).toEqual({ updated: 0, created: 0 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
