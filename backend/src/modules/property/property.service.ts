import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CacheService } from '../../common/services/cache.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { PropertyStatus, PropertyType, DocumentType, Prisma } from '@prisma/client';
import { normalizeListingDetails, toPublicListingDetails } from './listing-details';
import { UUID_RE, uniqueSlug } from './property-slug';

/**
 * Public (unauthenticated) view of a listing. The number of plots in a land
 * estate is internal: hide it, and for land sold per plot also hide the
 * estate totals that reveal it (total price ÷ price per plot, area ÷ plot size).
 */
export function toPublicProperty<T extends Record<string, any>>(property: T) {
  const { listingDetails, ...rest } = property;
  const out: Record<string, any> = { ...rest, listingDetails: toPublicListingDetails(listingDetails) };
  if (out.type === PropertyType.LAND) {
    delete out.numberOfPlots;
    if (Number(out.pricePerSqm) > 0) {
      for (const k of ['price', 'originalPrice', 'listingPrice', 'area', 'lotSize', 'priceHistory', 'appreciationPercentage']) {
        delete out[k];
      }
    }
  }
  return out;
}

@Injectable()
export class PropertyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  async create(createPropertyDto: CreatePropertyDto, userId: string) {
    const property = await this.prisma.property.create({
      data: {
        ...createPropertyDto,
        slug: await uniqueSlug(this.prisma, createPropertyDto.title),
        originalPrice: createPropertyDto.price,
        realtorId: createPropertyDto.realtorId,
      },
    });
    await this.cacheService.invalidate('properties');
    return property;
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    search?: string;
    type?: PropertyType;
    status?: PropertyStatus;
    city?: string;
    minPrice?: number;
    maxPrice?: number;
    minBedrooms?: number;
    maxBedrooms?: number;
    isListed?: boolean;
    realtorId?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }) {
    const {
      search,
      type,
      status,
      city,
      minPrice,
      maxPrice,
      minBedrooms,
      maxBedrooms,
      isListed,
      realtorId,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (type) where.type = type;
    if (status) where.status = status;
    if (city) where.city = { contains: city, mode: 'insensitive' };
    if (minPrice !== undefined && !isNaN(Number(minPrice))) where.price = { ...where.price, gte: Number(minPrice) };
    if (maxPrice !== undefined && !isNaN(Number(maxPrice))) where.price = { ...where.price, lte: Number(maxPrice) };
    if (minBedrooms !== undefined && !isNaN(Number(minBedrooms))) where.bedrooms = { ...where.bedrooms, gte: Number(minBedrooms) };
    if (maxBedrooms !== undefined && !isNaN(Number(maxBedrooms))) where.bedrooms = { ...where.bedrooms, lte: Number(maxBedrooms) };
    if (isListed !== undefined) where.isListed = isListed;
    if (realtorId) where.realtorId = realtorId;

    const orderBy: any = {};
    orderBy[sortBy] = sortOrder;

    // Check cache
    const cacheKey = `properties:list:${JSON.stringify({ where, skip, limit, orderBy })}`;
    const cached = await this.cacheService.get<any>(cacheKey);
    if (cached) return cached;

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          owner: {
            include: {
              user: {
                select: { firstName: true, lastName: true },
              },
            },
          },
          realtor: {
            include: {
              user: {
                select: { firstName: true, lastName: true, avatar: true },
              },
            },
          },
          _count: {
            select: { offers: true, documents: true },
          },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    const result = {
      data: properties,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    await this.cacheService.set(cacheKey, result, 300);
    return result;
  }

  async findById(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        owner: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        realtor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                avatar: true,
              },
            },
          },
        },
        documents: true,
        priceHistory: {
          orderBy: { createdAt: 'desc' },
        },
        offers: {
          orderBy: { createdAt: 'desc' },
          include: {
            buyer: {
              include: {
                user: {
                  select: { firstName: true, lastName: true },
                },
              },
            },
          },
        },
        sales: {
          orderBy: { saleDate: 'desc' },
          take: 1,
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return property;
  }

  async update(id: string, updatePropertyDto: UpdatePropertyDto, userId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    // Track price changes
    if (updatePropertyDto.price && updatePropertyDto.price !== Number(property.price)) {
      await this.prisma.priceHistory.create({
        data: {
          propertyId: id,
          oldPrice: property.price,
          newPrice: updatePropertyDto.price,
          changedBy: userId,
          reason: updatePropertyDto.priceChangeReason,
        },
      });

      // Update appreciation percentage
      updatePropertyDto.appreciationPercentage =
        ((updatePropertyDto.price - Number(property.originalPrice)) /
          Number(property.originalPrice)) *
        100;
    }

    const { priceChangeReason, ...updateData } = updatePropertyDto;

    // The public URL follows the name: regenerate the slug when the title changes
    const slug = (updateData.title && updateData.title !== property.title) || !property.slug
      ? await uniqueSlug(this.prisma, updateData.title || property.title, id)
      : undefined;

    const updated = await this.prisma.property.update({
      where: { id },
      data: { ...updateData, ...(slug ? { slug } : {}) },
    });
    await this.cacheService.invalidate('properties');
    return updated;
  }

  async delete(id: string) {
    const property = await this.prisma.property.findUnique({ where: { id } });
    if (!property) throw new NotFoundException('Property not found');

    await this.prisma.$transaction(async (tx) => {
      // Get all sale IDs linked to this property
      const sales = await tx.sale.findMany({ where: { propertyId: id }, select: { id: true } });
      const saleIds = sales.map((s: any) => s.id);

      if (saleIds.length > 0) {
        // Delete all sale-dependent records first
        await tx.payment.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.commission.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.tax.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.transaction.deleteMany({ where: { referenceId: { in: saleIds }, referenceType: 'SALE' } });
        await tx.loyaltyPoints.deleteMany({ where: { saleId: { in: saleIds } } });
        await tx.sale.deleteMany({ where: { propertyId: id } });
      }

      // Delete other property-linked records
      await tx.offer.deleteMany({ where: { propertyId: id } });
      await tx.document.deleteMany({ where: { propertyId: id } });
      await tx.priceHistory.deleteMany({ where: { propertyId: id } });

      await tx.property.delete({ where: { id } });
    });

    await this.cacheService.invalidate('properties');
    return { message: 'Property deleted successfully' };
  }

  async getListedProperties(query: {
    page?: number;
    limit?: number;
    search?: string;
    type?: PropertyType;
    city?: string;
    minPrice?: number;
    maxPrice?: number;
  }) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      isListed: true,
      status: { notIn: [PropertyStatus.SOLD, PropertyStatus.OFF_MARKET] },
    };

    if (query.search) {
      where.AND = [
        {
          OR: [
            { title: { contains: query.search, mode: 'insensitive' } },
            { address: { contains: query.search, mode: 'insensitive' } },
            { city: { contains: query.search, mode: 'insensitive' } },
          ],
        },
      ];
    }
    // `type` may be a single type or a comma-separated list (e.g. the homepage's
    // "Apartments & Homes" = RESIDENTIAL,APARTMENT,CONDO,TOWNHOUSE,VILLA)
    if (query.type) {
      const types = String(query.type)
        .split(',')
        .map((t) => t.trim().toUpperCase())
        .filter((t) => (Object.values(PropertyType) as string[]).includes(t)) as PropertyType[];
      if (types.length === 1) where.type = types[0];
      else if (types.length > 1) where.type = { in: types };
    }
    if (query.city) where.city = { contains: query.city, mode: 'insensitive' };
    // Land is sold per plot: filter it by price per plot, never by the estate total
    // (which, with the per-plot price, would reveal the number of plots).
    const range: Record<string, number> = {};
    if (query.minPrice !== undefined && !isNaN(Number(query.minPrice))) range.gte = Number(query.minPrice);
    if (query.maxPrice !== undefined && !isNaN(Number(query.maxPrice))) range.lte = Number(query.maxPrice);
    if (Object.keys(range).length) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { type: { not: PropertyType.LAND }, price: range },
            { type: PropertyType.LAND, pricePerSqm: range },
            { type: PropertyType.LAND, pricePerSqm: null, price: range },
          ],
        },
      ];
    }

    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          realtor: {
            include: {
              user: { select: { firstName: true, lastName: true, avatar: true } },
            },
          },
        },
      }),
      this.prisma.property.count({ where }),
    ]);

    return {
      // Details are only needed on the single-listing page
      data: properties.map((p) => {
        const { listingDetails, ...pub } = toPublicProperty(p);
        return pub;
      }),
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /** Public lookup by slug (/properties/harmony-gardens) or, for older links, by id. */
  async findListedById(idOrSlug: string) {
    const property = await this.prisma.property.findFirst({
      where: { ...(UUID_RE.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug.toLowerCase() }), isListed: true },
      include: {
        realtor: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                avatar: true,
                phone: true,
              },
            },
          },
        },
        priceHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!property) {
      throw new NotFoundException('Property not found or not listed');
    }

    return toPublicProperty(property);
  }

  async updateListingDetails(id: string, input: unknown) {
    const property = await this.prisma.property.findUnique({ where: { id }, select: { id: true } });
    if (!property) throw new NotFoundException('Property not found');

    const listingDetails = normalizeListingDetails(input);
    const updated = await this.prisma.property.update({
      where: { id },
      data: {
        listingDetails: Object.keys(listingDetails).length
          ? (listingDetails as Prisma.InputJsonValue)
          : Prisma.DbNull,
      },
      select: { id: true, listingDetails: true, updatedAt: true },
    });
    await this.cacheService.invalidate('properties');
    return updated;
  }

  async submitOffer(
    propertyId: string,
    buyerId: string,
    data: {
      amount: number;
      message?: string;
      expiresInDays?: number;
    },
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    if (!property.isListed) {
      throw new BadRequestException('Property is not listed for sale');
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (data.expiresInDays || 7));

    return this.prisma.offer.create({
      data: {
        propertyId,
        buyerId,
        amount: data.amount,
        message: data.message,
        expiresAt,
      },
    });
  }

  async addDocument(
    propertyId: string,
    data: {
      type: DocumentType;
      name: string;
      url: string;
      size: number;
      mimeType: string;
      uploadedBy: string;
    },
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
    });

    if (!property) {
      throw new NotFoundException('Property not found');
    }

    return this.prisma.document.create({
      data: {
        propertyId,
        ...data,
      },
    });
  }

  async getStats() {
    const [
      total,
      listed,
      sold,
      byType,
      avgPrice,
      totalValue,
    ] = await Promise.all([
      this.prisma.property.count(),
      this.prisma.property.count({ where: { isListed: true } }),
      this.prisma.property.count({ where: { status: PropertyStatus.SOLD } }),
      this.prisma.property.groupBy({
        by: ['type'],
        _count: { id: true },
      }),
      this.prisma.property.aggregate({
        _avg: { price: true },
      }),
      this.prisma.property.aggregate({
        _sum: { price: true },
      }),
    ]);

    return {
      total,
      listed,
      sold,
      available: total - sold,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.id;
        return acc;
      }, {} as Record<string, number>),
      avgPrice: avgPrice._avg.price || 0,
      totalValue: totalValue._sum.price || 0,
    };
  }
}
