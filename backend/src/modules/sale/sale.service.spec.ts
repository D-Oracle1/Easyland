import { Test, TestingModule } from '@nestjs/testing';
import { SaleService } from './sale.service';
import { PrismaService } from '../../database/prisma.service';
import { CommissionService } from '../commission/commission.service';
import { TaxService } from '../tax/tax.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { NotificationService } from '../notification/notification.service';
import { ClientService } from '../client/client.service';
import { SettingsService } from '../settings/settings.service';
import { LedgerService } from '../accounting/ledger.service';

describe('SaleService', () => {
  let service: SaleService;
  let prisma: any;
  let commissionService: any;

  const mockPrisma: any = {
    sale: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    property: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    realtorProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    $transaction: jest.fn((fn: any) => fn(mockPrisma)),
  };

  const mockCommissionService = {
    create: jest.fn(),
    getCommissionRate: jest.fn(),
  };

  const mockTaxService = {
    create: jest.fn(),
  };

  const mockLoyaltyService = {
    awardPoints: jest.fn(),
  };

  const mockNotificationService = {
    create: jest.fn(),
    notifySale: jest.fn(),
  };

  const mockClientService = {
    createClient: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaleService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CommissionService, useValue: mockCommissionService },
        { provide: TaxService, useValue: mockTaxService },
        { provide: LoyaltyService, useValue: mockLoyaltyService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: ClientService, useValue: mockClientService },
        { provide: SettingsService, useValue: { getFlatCommissionRate: jest.fn().mockResolvedValue(0.12), getMainTaxRate: jest.fn().mockResolvedValue(0) } },
        { provide: LedgerService, useValue: {} },
      ],
    }).compile();

    service = module.get<SaleService>(SaleService);
    prisma = mockPrisma;
    commissionService = mockCommissionService;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated sales', async () => {
      const mockSales = [
        { id: 's1', salePrice: 500000 },
        { id: 's2', salePrice: 750000 },
      ];

      prisma.sale.findMany.mockResolvedValue(mockSales);
      prisma.sale.count.mockResolvedValue(2);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
    });

    it('should filter by status', async () => {
      prisma.sale.findMany.mockResolvedValue([]);
      prisma.sale.count.mockResolvedValue(0);

      await service.findAll({ status: 'COMPLETED' as any });

      expect(prisma.sale.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('should return a sale with relations', async () => {
      const mockSale = {
        id: 'sale-1',
        salePrice: 500000,
        realtor: { user: { firstName: 'John' } },
        property: { title: 'Test Property' },
      };

      prisma.sale.findUnique.mockResolvedValue(mockSale);

      const result = await service.findById('sale-1');

      expect(result.id).toBe('sale-1');
      expect(result.salePrice).toBe(500000);
    });

    it('should throw NotFoundException for non-existent sale', async () => {
      prisma.sale.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow();
    });
  });
});
