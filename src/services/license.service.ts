import prisma from '../config/database';
import { LicenseKeyGeneratorService } from './licenseKeyGenerator.service';
import { Decimal } from '@prisma/client/runtime/library';
import { logLicenseOperation, logger } from '../utils/logger';
import { config } from '../config/config';
import { WhatsAppService } from './whatsapp.service';
import { cacheService, CacheKeys } from '../utils/cache.util';
import { limitConcurrency } from '../utils/concurrency.util';
import { PhoneVerificationService } from './phoneVerification.service';

export interface CreateLicenseInput {
  customerName?: string;
  customerPhone?: string;
  verificationToken?: string; // Required for phone verification
  initialPrice?: number;
  annualPrice?: number;
  pricePerUser?: number;
  locationName?: string;
  locationAddress?: string;
  isFreeTrial?: boolean;
  startDate?: string | Date;
  endDate?: string | Date;
  version?: string;
}

export interface UpdateLicenseInput {
  customerName?: string;
  customerPhone?: string;
  status?: 'active' | 'expired' | 'revoked' | 'suspended';
  locationName?: string;
  locationAddress?: string;
  initialPrice?: number;
  annualPrice?: number;
  pricePerUser?: number;
}

export interface LicenseWithDetails {
  id: number;
  licenseKey: string;
  customerName: string | null;
  customerPhone: string | null;
  purchaseDate: Date;
  initialPrice: Decimal;
  pricePerUser: Decimal;
  status: string;
  isFreeTrial: boolean;
  freeTrialEndDate: Date | null;
  startDate: Date | null;
  endDate: Date | null;
  userCount: number;
  userLimit: number;
  locationName: string | null;
  locationAddress: string | null;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  activations: Array<{
    id: number;
    hardwareId: string;
    machineName: string | null;
    activatedAt: Date;
    isActive: boolean;
  }>;
  subscriptions: Array<{
    id: number;
    startDate: Date;
    endDate: Date;
    annualFee: Decimal;
    status: string;
    gracePeriodEnd: Date | null;
  }>;
  payments: Array<{
    id: number;
    amount: Decimal;
    paymentDate: Date;
    isAnnualSubscription: boolean;
    paymentType: 'initial' | 'annual' | 'user';
  }>;
}

/**
 * Lightweight license summary for list views
 * Performance optimization: Reduces payload size by 40-60% by excluding full relations
 */
export interface LicenseSummary {
  id: number;
  licenseKey: string;
  customerName: string | null;
  customerPhone: string | null;
  purchaseDate: Date;
  initialPrice: Decimal;
  pricePerUser: Decimal;
  status: string;
  isFreeTrial: boolean;
  startDate: Date | null;
  endDate: Date | null;
  userCount: number;
  userLimit: number;
  locationName: string | null;
  locationAddress: string | null;
  version: string;
  createdAt: Date;
  updatedAt: Date;
  // Only include counts, not full relation arrays
  _count?: {
    activations: number;
    subscriptions: number;
    payments: number;
  };
  // Count of active activations to determine if license has been activated
  activeActivationsCount?: number;
}

/**
 * License Service
 * 
 * Handles all license-related business logic including:
 * - License creation with key generation
 * - License lookup and status checking
 * - License updates and revocation
 */
export class LicenseService {
  /**
   * Creates a new license with generated key and initial subscription
   * @param input License creation data
   * @returns Promise<LicenseWithDetails> Created license with details
   */
  static async createLicense(input: CreateLicenseInput): Promise<LicenseWithDetails> {
    // Check for duplicate license with same phone and location name (case-insensitive)
    // This check prevents creating duplicate licenses regardless of status
    if (input.customerPhone && input.locationName) {
      const normalizedPhone = input.customerPhone.trim().replace(/\D/g, '');
      const normalizedLocationName = input.locationName.trim().toLowerCase();
      
      // Use raw query for case-insensitive exact match
      // Check ALL licenses regardless of status to prevent duplicates
      const existingLicense = await prisma.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM "License"
        WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(COALESCE("customerPhone", '')), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), ' ', '') = ${normalizedPhone}
          AND LOWER(TRIM(COALESCE("locationName", ''))) = ${normalizedLocationName}
        LIMIT 1
      `;

      if (existingLicense && existingLicense.length > 0) {
        throw new Error(
          `A license already exists for phone "${input.customerPhone}" and branch/location "${input.locationName}". Each branch requires a unique license. Please use a different branch/location name for this customer, or use a different phone number.`
        );
      }
    }

    // Generate unique license key
    const licenseKey = await LicenseKeyGeneratorService.generateLicenseKey();

    // Set default prices if not provided
    // Use nullish coalescing to allow 0 as a valid value
    const initialPrice = input.initialPrice != null ? input.initialPrice : 350.0;
    const annualPrice = input.annualPrice != null ? input.annualPrice : 50.0;
    const pricePerUser = input.pricePerUser != null ? input.pricePerUser : 25.0;

    // Check if this is a free trial (from toggle, not price)
    const isFreeTrial = input.isFreeTrial === true;
    
    // Calculate subscription dates (use provided dates or calculate defaults)
    let licenseStartDate: Date;
    let licenseEndDate: Date;
    
    if (input.startDate) {
      licenseStartDate = input.startDate instanceof Date ? input.startDate : new Date(input.startDate);
    } else {
      licenseStartDate = new Date();
    }
    
    if (input.endDate) {
      licenseEndDate = input.endDate instanceof Date ? input.endDate : new Date(input.endDate);
      // Set to end of day (23:59:59.999) to ensure full day is counted
      licenseEndDate.setHours(23, 59, 59, 999);
    } else {
      // Calculate default end date based on free trial or paid license
      if (isFreeTrial) {
        // For free trial: subscription ends in 10 days (Day 0 to Day 9 = 10 days total)
        licenseEndDate = new Date(licenseStartDate);
        licenseEndDate.setDate(licenseEndDate.getDate() + config.freeTrialDays - 1);
        // Set to end of day (23:59:59.999) to ensure full day is counted
        licenseEndDate.setHours(23, 59, 59, 999);
      } else {
        // For paid license: subscription ends in 1 year (exactly 365 days)
        licenseEndDate = new Date(licenseStartDate);
        licenseEndDate.setFullYear(licenseEndDate.getFullYear() + 1);
        // Subtract 1 day to get exactly 365 days (not 365+ hours)
        licenseEndDate.setDate(licenseEndDate.getDate() - 1);
        // Set to end of day (23:59:59.999) to ensure full day is counted
        licenseEndDate.setHours(23, 59, 59, 999);
      }
    }
    
    // Use license dates for subscription dates (same implementation as before)
    const startDate = licenseStartDate;
    const endDate = licenseEndDate;
    let freeTrialEndDate: Date | null = null;
    
    if (isFreeTrial) {
      freeTrialEndDate = new Date(endDate);
    }

    // No grace period - expiration is exact end date
    const gracePeriodEnd = new Date(endDate);

    // Set default version to 'grocery' if not provided
    const version = input.version || 'grocery';

    // Prepare license data
    const licenseData: Record<string, unknown> = {
      licenseKey,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      initialPrice: new Decimal(initialPrice),
      pricePerUser: new Decimal(pricePerUser),
      status: 'active',
      isFreeTrial,
      freeTrialEndDate,
      startDate: licenseStartDate,
      endDate: licenseEndDate,
      userCount: 0, // Will be set to 1 when license is activated
      userLimit: 2, // Default limit: 2 users (1 default + 1 extra)
      locationName: input.locationName,
      locationAddress: input.locationAddress,
      version,
      subscriptions: {
        create: {
          startDate,
          endDate,
          annualFee: new Decimal(annualPrice),
          status: 'active',
          gracePeriodEnd,
        },
      },
    };

    // Only create payment record if it's not a free trial
    if (!isFreeTrial) {
      licenseData.payments = {
        create: {
          amount: new Decimal(initialPrice),
          paymentDate: new Date(),
          isAnnualSubscription: false,
        },
      };
    }

    // Create license with subscription and initial payment (if not free trial) in a transaction
    const license = await prisma.license.create({
      data: licenseData as Parameters<typeof prisma.license.create>[0]['data'],
      include: {
        activations: {
          select: {
            id: true,
            hardwareId: true,
            machineName: true,
            activatedAt: true,
            isActive: true,
          },
        },
        subscriptions: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            annualFee: true,
            status: true,
            gracePeriodEnd: true,
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            isAnnualSubscription: true,
            paymentType: true,
          },
        },
      },
    });

    // Log license generation
    logLicenseOperation('generation', {
      licenseId: license.id,
      licenseKey: license.licenseKey,
      customerName: license.customerName,
      customerPhone: license.customerPhone,
      locationName: license.locationName,
      initialPrice: initialPrice.toString(),
    });

    const result = license as LicenseWithDetails;

    // Cache the newly created license
    cacheService.set(CacheKeys.license(license.licenseKey), result, 300);
    cacheService.set(CacheKeys.licenseById(license.id), result, 300);
    // Invalidate dashboard stats cache as license count has changed
    cacheService.del(CacheKeys.dashboardStats());
    // Invalidate all search result caches as new license was added
    cacheService.delPattern('search:*');

    return result;
  }

  /**
   * Finds a license by license key
   * Performance optimization: Uses caching to reduce database load
   * @param licenseKey The license key to search for
   * @returns Promise<LicenseWithDetails | null> License if found, null otherwise
   */
  static async findLicenseByKey(licenseKey: string): Promise<LicenseWithDetails | null> {
    const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(licenseKey);
    const cacheKey = CacheKeys.license(normalizedKey);

    // Try to get from cache first
    const cached = cacheService.get<LicenseWithDetails>(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, fetch from database
    const license = await prisma.license.findUnique({
      where: { licenseKey: normalizedKey },
      include: {
        activations: {
          select: {
            id: true,
            hardwareId: true,
            machineName: true,
            activatedAt: true,
            isActive: true,
          },
          orderBy: {
            activatedAt: 'desc',
          },
        },
        subscriptions: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            annualFee: true,
            status: true,
            gracePeriodEnd: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            isAnnualSubscription: true,
            paymentType: true,
          },
          orderBy: {
            paymentDate: 'desc',
          },
        },
      },
    });

    const result = license as LicenseWithDetails | null;

    // Cache the result for 5 minutes (300 seconds)
    if (result) {
      cacheService.set(cacheKey, result, 300);
    }

    return result;
  }

  /**
   * Finds a license by ID
   * Performance optimization: Uses caching to reduce database load
   * @param id The license ID
   * @returns Promise<LicenseWithDetails | null> License if found, null otherwise
   */
  static async findLicenseById(id: number): Promise<LicenseWithDetails | null> {
    const cacheKey = CacheKeys.licenseById(id);

    // Try to get from cache first
    const cached = cacheService.get<LicenseWithDetails>(cacheKey);
    if (cached) {
      return cached;
    }

    // If not in cache, fetch from database
    const license = await prisma.license.findUnique({
      where: { id },
      include: {
        activations: {
          select: {
            id: true,
            hardwareId: true,
            machineName: true,
            activatedAt: true,
            isActive: true,
          },
          orderBy: {
            activatedAt: 'desc',
          },
        },
        subscriptions: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            annualFee: true,
            status: true,
            gracePeriodEnd: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            isAnnualSubscription: true,
            paymentType: true,
          },
          orderBy: {
            paymentDate: 'desc',
          },
        },
      },
    });

    const result = license as LicenseWithDetails | null;

    // Cache the result for 5 minutes (300 seconds)
    if (result) {
      cacheService.set(cacheKey, result, 300);
    }

    return result;
  }

  /**
   * Checks the current status of a license
   * @param licenseKey The license key to check
   * @returns Promise<{ valid: boolean; status: string; message: string }> Status information
   */
  static async checkLicenseStatus(licenseKey: string): Promise<{
    valid: boolean;
    status: string;
    message: string;
    expiresAt?: Date;
    gracePeriodEnd?: Date;
  }> {
    const license = await this.findLicenseByKey(licenseKey);

    if (!license) {
      return {
        valid: false,
        status: 'not_found',
        message: 'License key not found',
      };
    }

    // Check license status
    if (license.status === 'revoked') {
      return {
        valid: false,
        status: 'revoked',
        message: 'License has been revoked',
      };
    }

    if (license.status === 'suspended') {
      return {
        valid: false,
        status: 'suspended',
        message: 'License is currently suspended',
      };
    }

    // Check subscription status
    const activeSubscription = license.subscriptions.find((sub) => sub.status === 'active');
    if (!activeSubscription) {
      const expiredSubscription = license.subscriptions[0];
      if (expiredSubscription) {
        const now = new Date();
        const inGracePeriod =
          expiredSubscription.gracePeriodEnd && now <= expiredSubscription.gracePeriodEnd;

        if (inGracePeriod) {
          return {
            valid: true,
            status: 'grace_period',
            message: 'License is in grace period',
            expiresAt: expiredSubscription.endDate,
            gracePeriodEnd: expiredSubscription.gracePeriodEnd || undefined,
          };
        }
      }

      return {
        valid: false,
        status: 'expired',
        message: 'License subscription has expired',
        expiresAt: license.subscriptions[0]?.endDate,
        gracePeriodEnd: license.subscriptions[0]?.gracePeriodEnd || undefined,
      };
    }

    // License is active
    return {
      valid: true,
      status: 'active',
      message: 'License is active and valid',
      expiresAt: activeSubscription.endDate,
      gracePeriodEnd: activeSubscription.gracePeriodEnd || undefined,
    };
  }

  /**
   * Updates license information
   * @param licenseKey The license key to update
   * @param input Update data
   * @returns Promise<LicenseWithDetails> Updated license
   * @throws Error if license not found
   */
  static async updateLicense(
    licenseKey: string,
    input: UpdateLicenseInput,
  ): Promise<LicenseWithDetails> {
    const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(licenseKey);

    // Check if license exists
    const existing = await prisma.license.findUnique({
      where: { licenseKey: normalizedKey },
    });

    if (!existing) {
      throw new Error(`License with key ${licenseKey} not found`);
    }

    // Validate status if provided
    if (input.status && !['active', 'expired', 'revoked', 'suspended'].includes(input.status)) {
      throw new Error(`Invalid status: ${input.status}`);
    }

    // Update license
    const updated = await prisma.license.update({
      where: { licenseKey: normalizedKey },
      data: {
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        status: input.status,
        locationName: input.locationName,
        locationAddress: input.locationAddress,
      },
      include: {
        activations: {
          select: {
            id: true,
            hardwareId: true,
            machineName: true,
            activatedAt: true,
            isActive: true,
          },
          orderBy: {
            activatedAt: 'desc',
          },
        },
        subscriptions: {
          select: {
            id: true,
            startDate: true,
            endDate: true,
            annualFee: true,
            status: true,
            gracePeriodEnd: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        payments: {
          select: {
            id: true,
            amount: true,
            paymentDate: true,
            isAnnualSubscription: true,
            paymentType: true,
          },
          orderBy: {
            paymentDate: 'desc',
          },
        },
      },
    });

    const result = updated as LicenseWithDetails;

    // Invalidate cache for this license
    cacheService.del(CacheKeys.license(result.licenseKey));
    cacheService.del(CacheKeys.licenseById(existing.id));
    // Invalidate dashboard stats cache
    cacheService.del(CacheKeys.dashboardStats());
    // Invalidate all search result caches as license was modified
    cacheService.delPattern('search:*');

    return result;
  }

  /**
   * Revokes a license (sets status to 'revoked', deactivates all activations, and cancels all active subscriptions)
   * Also updates subscription endDate to the revocation date
   * @param licenseKey The license key to revoke
   * @returns Promise<LicenseWithDetails> Revoked license
   * @throws Error if license not found
   */
  static async revokeLicense(licenseKey: string): Promise<LicenseWithDetails> {
    const normalizedKey = LicenseKeyGeneratorService.normalizeLicenseKey(licenseKey);

    // Check if license exists
    const existing = await prisma.license.findUnique({
      where: { licenseKey: normalizedKey },
    });

    if (!existing) {
      throw new Error(`License with key ${licenseKey} not found`);
    }

    // Revoke license, deactivate all activations, and cancel all subscriptions in a transaction
    type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
    const revoked = await prisma.$transaction(async (tx: TransactionClient) => {
      // Update license status
      const license = await tx.license.update({
        where: { licenseKey: normalizedKey },
        data: { status: 'revoked' },
      });

      // Deactivate all activations
      await tx.activation.updateMany({
        where: { licenseId: license.id, isActive: true },
        data: { isActive: false },
      });

      // Cancel all active subscriptions and set endDate to revocation date
      const revocationDate = new Date();
      await tx.subscription.updateMany({
        where: { licenseId: license.id, status: 'active' },
        data: { 
          status: 'cancelled',
          endDate: revocationDate,
        },
      });

      // Return updated license with relations
      return await tx.license.findUnique({
        where: { id: license.id },
        include: {
          activations: {
            select: {
              id: true,
              hardwareId: true,
              machineName: true,
              activatedAt: true,
              isActive: true,
            },
            orderBy: {
              activatedAt: 'desc',
            },
          },
          subscriptions: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              annualFee: true,
              status: true,
              gracePeriodEnd: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              isAnnualSubscription: true,
              paymentType: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
      });
    });

    if (!revoked) {
      throw new Error('Failed to revoke license');
    }

    // Log license revocation
    logLicenseOperation('revocation', {
      licenseId: revoked.id,
      licenseKey: revoked.licenseKey,
      customerName: revoked.customerName,
      reason: 'License revoked',
    });

    const result = revoked as LicenseWithDetails;

    // Invalidate cache for this license
    cacheService.del(CacheKeys.license(revoked.licenseKey));
    cacheService.del(CacheKeys.licenseById(revoked.id));
    // Invalidate dashboard stats cache
    cacheService.del(CacheKeys.dashboardStats());
    // Invalidate all search result caches as license was modified
    cacheService.delPattern('search:*');

    return result;
  }

  /**
   * Lists all licenses with optional filtering
   * @param options Filter and pagination options
   * @returns Promise<{ licenses: LicenseWithDetails[]; total: number }> List of licenses
   */
  static async listLicenses(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ licenses: LicenseWithDetails[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (options?.status) {
      where.status = options.status;
    }

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        include: {
          activations: {
            select: {
              id: true,
              hardwareId: true,
              machineName: true,
              activatedAt: true,
              isActive: true,
            },
            orderBy: {
              activatedAt: 'desc',
            },
          },
          subscriptions: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              annualFee: true,
              status: true,
              gracePeriodEnd: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              isAnnualSubscription: true,
              paymentType: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: options?.limit,
        skip: options?.offset,
      }),
      prisma.license.count({ where }),
    ]);

    return {
      licenses: licenses as LicenseWithDetails[],
      total,
    };
  }

  /**
   * Admin: Get paginated list of licenses with filtering, searching, and sorting
   * @param params Pagination and filter parameters
   * @param params.includeRelations Whether to include full relations (default: true for backward compatibility)
   *                                Set to false for list views to reduce payload size by 70-90%
   * @returns Promise<PaginatedLicenseResponse> Paginated license list
   */
  static async getLicensesPaginated(params: {
    page?: number;
    pageSize?: number;
    status?: string;
    search?: string;
    isFreeTrial?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    includeRelations?: boolean; // Performance optimization: allow excluding relations for list views
  }): Promise<{
    data: (LicenseWithDetails | LicenseSummary)[];
    pagination: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
    meta: {
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
      search?: string;
      status?: string;
    };
  }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;
    const sortBy = params.sortBy || 'createdAt';
    const sortOrder = params.sortOrder || 'desc';

    // Build orderBy (needed for cache key)
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    const validSortFields = ['id', 'licenseKey', 'customerName', 'customerPhone', 'status', 'purchaseDate', 'createdAt', 'updatedAt'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    orderBy[sortField] = sortOrder;

    // Build where clause
    const where: Record<string, unknown> = {};

    // Filter by status
    if (params.status) {
      where.status = params.status;
    }

    // Filter by free trial
    if (params.isFreeTrial !== undefined) {
      where.isFreeTrial = params.isFreeTrial;
    }

    // Search by license key, customer name, phone, location, or ID
    // Performance optimization: Cache search results to reduce database load
    if (params.search) {
      const searchKey = CacheKeys.searchResults(
        params.search.trim().toLowerCase(),
        `${params.status || ''}_${params.isFreeTrial || ''}_${sortField}_${sortOrder}`
      );

      // Try to get from cache first (5 minute TTL for search results)
      const cached = cacheService.get<{ data: LicenseWithDetails[]; totalItems: number }>(searchKey);
      if (cached) {
        // Apply pagination to cached results
        const startIndex = skip;
        const endIndex = skip + pageSize;
        const paginatedData = cached.data.slice(startIndex, endIndex);
        const totalPages = Math.ceil(cached.totalItems / pageSize);

        return {
          data: paginatedData,
          pagination: {
            page,
            pageSize,
            totalItems: cached.totalItems,
            totalPages,
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1,
          },
          meta: {
            sortBy: sortField,
            sortOrder,
            search: params.search,
            status: params.status,
          },
        };
      }

      // Performance optimization: Optimize search queries to reduce full table scans
      // Strategy: Use startsWith when possible, require minimum length, prioritize indexed fields
      const searchTerm = params.search.trim();
      
      // Performance: Require minimum search length to avoid very expensive short searches
      // Very short searches (1-2 chars) cause full table scans with minimal value
      if (searchTerm.length < 2) {
        // For very short searches, only search by exact ID match (very fast with index)
        const searchAsNumber = parseInt(searchTerm, 10);
        if (!isNaN(searchAsNumber) && searchAsNumber.toString() === searchTerm) {
          where.id = searchAsNumber;
        } else {
          // Too short to search effectively, return empty results
          where.id = -1; // Will return no results
        }
      } else {
        const searchConditions: Array<Record<string, unknown>> = [];
        
        // Priority 1: License key search - Use startsWith for better index usage
        // startsWith can use the licenseKey index more efficiently than contains
        if (searchTerm.length <= 20) {
          searchConditions.push({ licenseKey: { startsWith: searchTerm, mode: 'insensitive' } });
        } else {
          // For very long searches, use contains but this will be slower
          searchConditions.push({ licenseKey: { contains: searchTerm, mode: 'insensitive' } });
        }
        
        // Priority 2: Numeric ID search (exact match, very fast with primary key index)
        const searchAsNumber = parseInt(searchTerm, 10);
        if (!isNaN(searchAsNumber) && searchAsNumber.toString() === searchTerm) {
          searchConditions.push({ id: searchAsNumber });
        }
        
        // Priority 3: Text field searches - Use startsWith when search term is at least 3 chars
        // startsWith is more index-friendly than contains, but only works for prefix matches
        if (searchTerm.length >= 3) {
          // For longer searches, prefer startsWith for better index usage
          searchConditions.push(
            { customerName: { startsWith: searchTerm, mode: 'insensitive' } },
            { customerPhone: { startsWith: searchTerm, mode: 'insensitive' } },
            { locationName: { startsWith: searchTerm, mode: 'insensitive' } }
          );
        } else {
          // For 2-char searches, use contains but this will be slower (necessary for partial matches)
          searchConditions.push(
            { customerName: { contains: searchTerm, mode: 'insensitive' } },
            { customerPhone: { contains: searchTerm, mode: 'insensitive' } },
            { locationName: { contains: searchTerm, mode: 'insensitive' } }
          );
        }
        
        where.OR = searchConditions;
      }
    }

    // Performance optimization: Removed updateExpiredLicenses() call from here
    // This should be run as a background job (cron) every 1-2 hours
    // Calling it on every paginated query causes significant performance degradation
    // See: POST /api/admin/jobs/update-expired-licenses for manual trigger

    // Performance optimization: Only include full relations if requested
    // For list views, we can exclude relations to reduce payload size by 70-90%
    const includeRelations = params.includeRelations !== false; // Default to true for backward compatibility

    // For search queries, we need to fetch all results to cache them properly
    // But only if the result set is reasonable (< 1000 items) to avoid memory issues
    const shouldCacheSearch = params.search && page === 1; // Only cache on first page
    let allLicensesForCache: (LicenseWithDetails | LicenseSummary)[] | null = null;
    let totalItemsForCache: number | null = null;

    // Execute queries in parallel
    // Performance optimization: Use select for list views to reduce payload size by 40-60%
    const [licenses, totalItems] = await Promise.all([
      includeRelations
        ? prisma.license.findMany({
            where,
            skip,
            take: pageSize,
            orderBy,
            include: {
              activations: {
                select: {
                  id: true,
                  hardwareId: true,
                  machineName: true,
                  activatedAt: true,
                  isActive: true,
                },
                orderBy: {
                  activatedAt: 'desc',
                },
              },
              subscriptions: {
                select: {
                  id: true,
                  startDate: true,
                  endDate: true,
                  annualFee: true,
                  status: true,
                  gracePeriodEnd: true,
                },
                orderBy: {
                  createdAt: 'desc',
                },
              },
              payments: {
                select: {
                  id: true,
                  amount: true,
                  paymentDate: true,
                  isAnnualSubscription: true,
                  paymentType: true,
                },
                orderBy: {
                  paymentDate: 'desc',
                },
              },
            },
          })
        : prisma.license.findMany({
            where,
            skip,
            take: pageSize,
            orderBy,
            // Performance optimization: Use select to fetch only essential fields for list views
            // This reduces payload size by 40-60% compared to fetching all fields
            select: {
              id: true,
              licenseKey: true,
              customerName: true,
              customerPhone: true,
              purchaseDate: true,
              initialPrice: true,
              pricePerUser: true,
              status: true,
              isFreeTrial: true,
              startDate: true,
              endDate: true,
              userCount: true,
              userLimit: true,
              locationName: true,
              locationAddress: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  activations: true,
                  subscriptions: true,
                  payments: true,
                },
              },
            },
          }),
      prisma.license.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    // If not including full relations, fetch active activations count for each license
    // This allows frontend to show "Not Activated" indicator without loading full activations array
    if (!includeRelations && licenses.length > 0) {
      const licenseIds = licenses.map((l: { id: number }) => l.id);
      const activeActivationsCounts = await prisma.activation.groupBy({
        by: ['licenseId'],
        where: {
          licenseId: { in: licenseIds },
          isActive: true,
        },
        _count: {
          id: true,
        },
      });

      // Create a map of licenseId -> activeActivationsCount
      const activeCountsMap = new Map<number, number>();
      activeActivationsCounts.forEach((item) => {
        activeCountsMap.set(item.licenseId, item._count.id);
      });

      // Add activeActivationsCount to each license
      const licensesWithActivationCount = licenses.map((license) => ({
        ...license,
        activeActivationsCount: activeCountsMap.get(license.id) || 0,
      }));

      return {
        data: licensesWithActivationCount as (LicenseWithDetails | LicenseSummary)[],
        pagination: {
          page,
          pageSize,
          totalItems,
          totalPages,
          hasNextPage,
          hasPreviousPage,
        },
        meta: {
          sortBy: sortField,
          sortOrder,
          search: params.search,
          status: params.status,
        },
      };
    }

    const result = {
      data: licenses as (LicenseWithDetails | LicenseSummary)[],
      pagination: {
        page,
        pageSize,
        totalItems,
        totalPages,
        hasNextPage,
        hasPreviousPage,
      },
      meta: {
        sortBy: sortField,
        sortOrder,
        search: params.search,
        status: params.status,
      },
    };

    // Cache search results if search query was provided and we're on the first page
    // Only cache if result set is reasonable (< 1000 items) to avoid memory issues
    if (shouldCacheSearch && totalItems > 0 && totalItems <= 1000) {
      // Fetch all results for caching (without pagination)
      allLicensesForCache = (includeRelations
        ? await prisma.license.findMany({
            where,
            orderBy,
            include: {
              activations: {
                select: {
                  id: true,
                  hardwareId: true,
                  machineName: true,
                  activatedAt: true,
                  isActive: true,
                },
                orderBy: {
                  activatedAt: 'desc',
                },
              },
              subscriptions: {
                select: {
                  id: true,
                  startDate: true,
                  endDate: true,
                  annualFee: true,
                  status: true,
                  gracePeriodEnd: true,
                },
                orderBy: {
                  createdAt: 'desc',
                },
              },
              payments: {
                select: {
                  id: true,
                  amount: true,
                  paymentDate: true,
                  isAnnualSubscription: true,
                  paymentType: true,
                },
                orderBy: {
                  paymentDate: 'desc',
                },
              },
            },
          })
        : await prisma.license.findMany({
            where,
            orderBy,
            select: {
              id: true,
              licenseKey: true,
              customerName: true,
              customerPhone: true,
              purchaseDate: true,
              initialPrice: true,
              pricePerUser: true,
              status: true,
              isFreeTrial: true,
              startDate: true,
              endDate: true,
              userCount: true,
              userLimit: true,
              locationName: true,
              locationAddress: true,
              version: true,
              createdAt: true,
              updatedAt: true,
              _count: {
                select: {
                  activations: true,
                  subscriptions: true,
                  payments: true,
                },
              },
            },
          })) as (LicenseWithDetails | LicenseSummary)[];

      // If not including full relations, add activeActivationsCount to cached results
      if (!includeRelations && allLicensesForCache && allLicensesForCache.length > 0) {
        const licenseIds = allLicensesForCache.map((l: { id: number }) => l.id);
        const activeActivationsCounts = await prisma.activation.groupBy({
          by: ['licenseId'],
          where: {
            licenseId: { in: licenseIds },
            isActive: true,
          },
          _count: {
            id: true,
          },
        });

        // Create a map of licenseId -> activeActivationsCount
        const activeCountsMap = new Map<number, number>();
        activeActivationsCounts.forEach((item) => {
          activeCountsMap.set(item.licenseId, item._count.id);
        });

        // Add activeActivationsCount to each license in cache
        allLicensesForCache = allLicensesForCache.map((license) => ({
          ...license,
          activeActivationsCount: activeCountsMap.get(license.id) || 0,
        })) as (LicenseWithDetails | LicenseSummary)[];
      }

      totalItemsForCache = totalItems;

      // Cache the full dataset for pagination
      const searchKey = CacheKeys.searchResults(
        params.search!.trim().toLowerCase(),
        `${params.status || ''}_${params.isFreeTrial || ''}_${sortField}_${sortOrder}`
      );
      cacheService.set(searchKey, { data: allLicensesForCache, totalItems: totalItemsForCache }, 300);
    }

    return result;
  }

  /**
   * Admin: Get license by ID with all details
   * @param id License ID
   * @returns Promise<LicenseWithDetails | null> License details
   */
  static async getLicenseById(id: number): Promise<LicenseWithDetails | null> {
    // Performance optimization: Removed updateExpiredLicenses() call from here
    // This should be run as a background job (cron) every 1-2 hours
    // For individual license lookups, expiration status is checked on-demand if needed
    return this.findLicenseById(id);
  }

  /**
   * Admin: Update license information by ID
   * @param id License ID
   * @param input Update data
   * @returns Promise<LicenseWithDetails> Updated license
   */
  static async updateLicenseById(id: number, input: UpdateLicenseInput): Promise<LicenseWithDetails> {
    const updateData: Record<string, unknown> = {};

    if (input.customerName !== undefined) updateData.customerName = input.customerName;
    if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.locationName !== undefined) updateData.locationName = input.locationName;
    if (input.locationAddress !== undefined) updateData.locationAddress = input.locationAddress;
    if (input.initialPrice !== undefined && input.initialPrice !== null) {
      updateData.initialPrice = new Decimal(input.initialPrice);
    }

    // Update license and optionally update active subscription's annualFee if annualPrice is provided
    const license = await prisma.$transaction(async (tx) => {
      const updatedLicense = await tx.license.update({
        where: { id },
        data: updateData,
        include: {
          activations: {
            select: {
              id: true,
              hardwareId: true,
              machineName: true,
              activatedAt: true,
              isActive: true,
            },
            orderBy: {
              activatedAt: 'desc',
            },
          },
          subscriptions: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              annualFee: true,
              status: true,
              gracePeriodEnd: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              isAnnualSubscription: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
      });

      // If annualPrice is provided, update the active subscription's annualFee
      if (input.annualPrice !== undefined && input.annualPrice !== null) {
        const activeSubscription = updatedLicense.subscriptions.find((sub) => sub.status === 'active');
        if (activeSubscription) {
          await tx.subscription.update({
            where: { id: activeSubscription.id },
            data: {
              annualFee: new Decimal(input.annualPrice),
            },
          });
        }
      }

      // Fetch updated license with updated subscription data
      return await tx.license.findUnique({
        where: { id },
        include: {
          activations: {
            select: {
              id: true,
              hardwareId: true,
              machineName: true,
              activatedAt: true,
              isActive: true,
            },
            orderBy: {
              activatedAt: 'desc',
            },
          },
          subscriptions: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              annualFee: true,
              status: true,
              gracePeriodEnd: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              isAnnualSubscription: true,
              paymentType: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
      });
    });

    if (!license) {
      throw new Error('Failed to update license');
    }

    const result = license as LicenseWithDetails;

    // Invalidate cache for this license
    cacheService.del(CacheKeys.license(result.licenseKey));
    cacheService.del(CacheKeys.licenseById(id));
    // Invalidate dashboard stats cache
    cacheService.del(CacheKeys.dashboardStats());
    // Invalidate all search result caches as license was modified
    cacheService.delPattern('search:*');

    return result;
  }

  /**
   * Admin: Soft delete license (set status to revoked) by ID
   * Deactivates all activations and cancels all active subscriptions associated with the license
   * Also updates subscription endDate to the revocation date
   * @param id License ID
   * @returns Promise<LicenseWithDetails> Revoked license
   */
  static async revokeLicenseById(id: number): Promise<LicenseWithDetails> {
    // Check if license exists
    const existing = await prisma.license.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`License with ID ${id} not found`);
    }

    // Revoke license, deactivate all activations, and cancel all subscriptions in a transaction
    type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
    const revoked = await prisma.$transaction(async (tx: TransactionClient) => {
      // Update license status
      await tx.license.update({
        where: { id },
        data: { status: 'revoked' },
      });

      // Deactivate all activations
      await tx.activation.updateMany({
        where: { licenseId: id, isActive: true },
        data: { isActive: false },
      });

      // Cancel all active subscriptions and set endDate to revocation date
      const revocationDate = new Date();
      await tx.subscription.updateMany({
        where: { licenseId: id, status: 'active' },
        data: { 
          status: 'cancelled',
          endDate: revocationDate,
        },
      });

      // Return updated license with relations
      return await tx.license.findUnique({
        where: { id },
        include: {
          activations: {
            select: {
              id: true,
              hardwareId: true,
              machineName: true,
              activatedAt: true,
              isActive: true,
            },
            orderBy: {
              activatedAt: 'desc',
            },
          },
          subscriptions: {
            select: {
              id: true,
              startDate: true,
              endDate: true,
              annualFee: true,
              status: true,
              gracePeriodEnd: true,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
          payments: {
            select: {
              id: true,
              amount: true,
              paymentDate: true,
              isAnnualSubscription: true,
              paymentType: true,
            },
            orderBy: {
              paymentDate: 'desc',
            },
          },
        },
      });
    });

    if (!revoked) {
      throw new Error('Failed to revoke license');
    }

    // Log license revocation
    logLicenseOperation('revocation', {
      licenseId: revoked.id,
      licenseKey: revoked.licenseKey,
      customerName: revoked.customerName,
      reason: 'License revoked',
    });

    const result = revoked as LicenseWithDetails;

    // Invalidate cache for this license
    cacheService.del(CacheKeys.license(revoked.licenseKey));
    cacheService.del(CacheKeys.licenseById(revoked.id));
    // Invalidate dashboard stats cache
    cacheService.del(CacheKeys.dashboardStats());
    // Invalidate all search result caches as license was modified
    cacheService.delPattern('search:*');

    return result;
  }

  /**
   * Admin: Delete license (hard delete - use with caution)
   * @param id License ID
   * @returns Promise<void>
   */
  static async deleteLicense(id: number): Promise<void> {
    await prisma.license.delete({
      where: { id },
    });
  }

  /**
   * Update expired licenses based on subscription status
   * Sets license status to 'expired' when all subscriptions are expired
   * No grace period - expiration is exact end date
   * 
   * PERFORMANCE OPTIMIZED: Uses a single SQL query instead of N+1 pattern
   * This should be run as a background job (cron) every 1-2 hours, not on every request
   * 
   * @returns Promise<{ updated: number }> Number of licenses updated
   */
  static async updateExpiredLicenses(): Promise<{ updated: number }> {
    const now = new Date();
    
    // Performance optimization: Use a single SQL query instead of fetching all licenses
    // and looping through them in JavaScript (N+1 problem)
    // This query finds all active licenses that have no active subscriptions with future end dates
    const result = await prisma.$executeRaw`
      UPDATE "License" l
      SET status = 'expired',
          "updatedAt" = ${now}
      WHERE l.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM "Subscription" s
          WHERE s."licenseId" = l.id
            AND s.status = 'active'
            AND s."endDate" > ${now}
        )
        AND EXISTS (
          SELECT 1 FROM "Subscription" s2
          WHERE s2."licenseId" = l.id
            AND (s2.status = 'expired' OR s2."endDate" <= ${now})
        )
    `;

    const updatedCount = typeof result === 'number' ? result : 0;

    if (updatedCount > 0) {
      logLicenseOperation('expiration', {
        operation: 'license_expiration_update',
        count: updatedCount,
      });
    }

    return { updated: updatedCount };
  }

  /**
   * Expire free trial licenses that have passed their trial period without payment
   * @returns Promise<{ expired: number }> Number of licenses expired
   */
  static async expireFreeTrialLicenses(): Promise<{ expired: number }> {
    const now = new Date();
    
    // Find all free trial licenses that have passed their trial end date and have no payments
    const expiredTrials = await prisma.license.findMany({
      where: {
        isFreeTrial: true,
        freeTrialEndDate: {
          not: null,
          lt: now, // Trial has ended
        },
        payments: {
          none: {}, // No payments made
        },
        status: {
          notIn: ['expired', 'revoked'], // Not already expired or revoked
        },
      },
      include: {
        subscriptions: true,
      },
    });

    if (expiredTrials.length === 0) {
      return { expired: 0 };
    }

    // Performance optimization: Batch update all licenses and subscriptions in a single transaction
    // This eliminates N+1 query problem (was: 1 query per license, now: 1 query total)
    const licenseIds = expiredTrials.map(l => l.id);
    
    await prisma.$transaction(async (tx) => {
      // Update all licenses to expired in one query
      await tx.license.updateMany({
        where: {
          id: { in: licenseIds },
        },
        data: {
          status: 'expired',
        },
      });

      // Update all subscriptions to expired in one query
      await tx.subscription.updateMany({
        where: {
          licenseId: { in: licenseIds },
        },
        data: {
          status: 'expired',
        },
      });
    });

    const expiredCount = expiredTrials.length;

    // Performance optimization: Send WhatsApp messages asynchronously without blocking
    // Fire and forget - don't wait for messages to complete before returning
    // This allows the expiration process to complete immediately
    const whatsappPromises = expiredTrials
      .filter(license => license.customerPhone !== null && license.customerPhone !== undefined)
      .map(async (license) => {
        try {
          const activeSubscription = license.subscriptions.find((sub) => sub.status === 'active') || license.subscriptions[0];
          if (activeSubscription && license.customerPhone) {
            const phone = license.customerPhone; // TypeScript now knows this is not null due to filter
            
            // Only send license-related messages to verified phone numbers
            const isVerified = await PhoneVerificationService.hasPhoneBeenVerified(phone);
            if (!isVerified) {
              logger.info('Skipping expiration notification: phone number not verified', {
                licenseId: license.id,
                licenseKey: license.licenseKey,
                customerPhone: phone,
              });
              return;
            }

            const daysRemaining = Math.ceil((activeSubscription.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            await WhatsAppService.sendExpirationNotification({
              customerName: license.customerName,
              customerPhone: phone,
              licenseKey: license.licenseKey,
              locationName: license.locationName,
              expirationDate: activeSubscription.endDate,
              daysRemaining: Math.max(0, daysRemaining),
              isFreeTrial: license.isFreeTrial,
            });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Failed to send expiration notification WhatsApp message', {
            licenseId: license.id,
            licenseKey: license.licenseKey,
            error: errorMessage,
          });
        }
      });

    // Performance: Don't await - let WhatsApp messages send in background
    // This prevents blocking the expiration process
    // Use Promise.allSettled in background (fire and forget)
    Promise.allSettled(whatsappPromises).catch((error) => {
      logger.error('Error in background WhatsApp message sending', { error });
    });

    if (expiredCount > 0) {
      logLicenseOperation('expiration', {
        operation: 'free_trial_expiration',
        count: expiredCount,
      });
    }

    return { expired: expiredCount };
  }

  /**
   * Check for expiring licenses and send warning WhatsApp messages
   * Sends warnings for licenses expiring in 3 days and 1 day
   * @returns Promise<{ warningsSent: number }> Number of warning WhatsApp messages sent
   */
  static async sendExpirationWarnings(): Promise<{ warningsSent: number }> {
    const now = new Date();
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    threeDaysFromNow.setHours(23, 59, 59, 999);
    
    const oneDayFromNow = new Date(now);
    oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
    oneDayFromNow.setHours(23, 59, 59, 999);

    // Find all active licenses with active subscriptions expiring in 3 days or 1 day
    const expiringLicenses = await prisma.license.findMany({
      where: {
        status: 'active',
        customerPhone: {
          not: null,
        },
        subscriptions: {
          some: {
            status: 'active',
            endDate: {
              gte: now,
              lte: threeDaysFromNow,
            },
          },
        },
      },
      include: {
        subscriptions: {
          where: {
            status: 'active',
          },
        },
      },
    });

    // Performance optimization: Send WhatsApp messages in parallel with concurrency limit
    // This prevents overwhelming the WhatsApp service while still being much faster than sequential sending
    const whatsappTasks = expiringLicenses
      .map((license) => {
        const activeSubscription = license.subscriptions.find((sub) => sub.status === 'active');
        if (!activeSubscription || !license.customerPhone) {
          return null;
        }

        const daysRemaining = Math.ceil((activeSubscription.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        // Send warning for 3 days or 1 day remaining
        if (daysRemaining === 3 || daysRemaining === 1) {
          return async () => {
            try {
              // TypeScript: customerPhone is guaranteed to be non-null due to filter above
              const phone = license.customerPhone!;
              
              // Only send license-related messages to verified phone numbers
              const isVerified = await PhoneVerificationService.hasPhoneBeenVerified(phone);
              if (!isVerified) {
                logger.info('Skipping expiration warning: phone number not verified', {
                  licenseId: license.id,
                  licenseKey: license.licenseKey,
                  customerPhone: phone,
                });
                return false;
              }

              const sent = await WhatsAppService.sendExpirationWarning({
                customerName: license.customerName,
                customerPhone: phone,
                licenseKey: license.licenseKey,
                locationName: license.locationName,
                expirationDate: activeSubscription.endDate,
                daysRemaining,
                isFreeTrial: license.isFreeTrial,
              });

              if (sent) {
                logger.info('Expiration warning WhatsApp message sent', {
                  licenseId: license.id,
                  licenseKey: license.licenseKey,
                  daysRemaining,
                });
                return true;
              }
              return false;
            } catch (error: unknown) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.error('Failed to send expiration warning WhatsApp message', {
                licenseId: license.id,
                licenseKey: license.licenseKey,
                error: errorMessage,
              });
              throw error;
            }
          };
        }
        return null;
      })
      .filter((task): task is () => Promise<boolean> => task !== null);

    // Execute WhatsApp tasks with concurrency limit of 5 (prevents overwhelming WhatsApp service)
    const whatsappResults = await limitConcurrency(whatsappTasks, 5);
    const warningsSent = whatsappResults.filter((r) => r.success && r.result === true).length;

    if (warningsSent > 0) {
      logger.info('Expiration warnings batch completed', {
        count: warningsSent,
      });
    }

    return { warningsSent };
  }
}

