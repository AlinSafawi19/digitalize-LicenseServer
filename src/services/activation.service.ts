import prisma from '../config/database';
import { logger, logLicenseOperation } from '../utils/logger';

export interface ActivationWithLicense {
  id: number;
  licenseId: number;
  hardwareId: string;
  machineName: string | null;
  activatedAt: Date;
  lastValidation: Date | null;
  isActive: boolean;
  license: {
    id: number;
    licenseKey: string;
    customerName: string | null;
    locationName: string | null;
  };
}

/**
 * Activation Service
 * Handles activation-related operations for admin
 */
export class ActivationService {
  /**
   * Get all activations for a specific license
   * @param licenseId License ID
   * @param filters Optional filters (isActive)
   * @returns Promise<ActivationWithLicense[]> List of activations
   */
  static async getActivationsByLicenseId(
    licenseId: number,
    filters?: { isActive?: boolean }
  ): Promise<ActivationWithLicense[]> {
    const where: Record<string, unknown> = { licenseId };

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    const activations = await prisma.activation.findMany({
      where,
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            locationName: true,
          },
        },
      },
      orderBy: {
        activatedAt: 'desc',
      },
    });

    return activations as ActivationWithLicense[];
  }

  /**
   * Get activation by ID with license details
   * @param id Activation ID
   * @returns Promise<ActivationWithLicense | null> Activation details
   */
  static async getActivationById(id: number): Promise<ActivationWithLicense | null> {
    const activation = await prisma.activation.findUnique({
      where: { id },
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            locationName: true,
          },
        },
      },
    });

    return activation as ActivationWithLicense | null;
  }

  /**
   * Deactivate an activation (set isActive to false)
   * This removes the hardware binding but keeps the record for history
   * @param id Activation ID
   * @returns Promise<ActivationWithLicense> Deactivated activation
   */
  static async deactivateActivation(id: number): Promise<ActivationWithLicense> {
    // Check if activation exists
    const existing = await prisma.activation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Activation with ID ${id} not found`);
    }

    // Update activation to inactive
    const activation = await prisma.activation.update({
      where: { id },
      data: {
        isActive: false,
      },
      include: {
        license: {
          select: {
            id: true,
            licenseKey: true,
            customerName: true,
            locationName: true,
          },
        },
      },
    });

    logger.info('Activation deactivated', {
      activationId: id,
      licenseId: activation.licenseId,
      hardwareId: activation.hardwareId,
    });

    // Log license operation
    logLicenseOperation('activation', {
      operation: 'deactivation',
      activationId: id,
      licenseId: activation.licenseId,
      licenseKey: activation.license.licenseKey,
      hardwareId: activation.hardwareId,
      machineName: activation.machineName,
    });

    return activation as ActivationWithLicense;
  }

  /**
   * Delete activation permanently (hard delete)
   * Use with caution - this removes the activation record completely
   * @param id Activation ID
   * @returns Promise<void>
   */
  static async deleteActivation(id: number): Promise<void> {
    // Check if activation exists
    const existing = await prisma.activation.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Activation with ID ${id} not found`);
    }

    await prisma.activation.delete({
      where: { id },
    });

    logger.info('Activation deleted permanently', {
      activationId: id,
      licenseId: existing.licenseId,
      hardwareId: existing.hardwareId,
    });
  }

  /**
   * Deactivate all active activations for a license
   * Used for reactivation scenarios where customer needs to re-enter license key
   * @param licenseId License ID
   * @returns Promise<number> Number of activations deactivated
   */
  static async deactivateAllActivationsForLicense(licenseId: number): Promise<number> {
    // Get all active activations for this license
    const activeActivations = await prisma.activation.findMany({
      where: {
        licenseId,
        isActive: true,
      },
    });

    if (activeActivations.length === 0) {
      logger.info('No active activations to deactivate', { licenseId });
      return 0;
    }

    // Deactivate all active activations
    const result = await prisma.activation.updateMany({
      where: {
        licenseId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    logger.info('All activations deactivated for license', {
      licenseId,
      count: result.count,
      activationIds: activeActivations.map(a => a.id),
    });

    // Log license operation for each deactivated activation
    for (const activation of activeActivations) {
      logLicenseOperation('activation', {
        operation: 'deactivation',
        activationId: activation.id,
        licenseId,
        hardwareId: activation.hardwareId,
        machineName: activation.machineName,
        reason: 'reactivation_reset',
      });
    }

    return result.count;
  }

  /**
   * Get all activations with optional filtering and pagination
   * @param params Filter and pagination parameters
   * @returns Promise<Paginated activations>
   */
  static async getActivationsPaginated(params: {
    page?: number;
    pageSize?: number;
    licenseId?: number;
    isActive?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<{
    data: ActivationWithLicense[];
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
      licenseId?: number;
      isActive?: boolean;
      search?: string;
    };
  }> {
    const page = Math.max(1, params.page || 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize || 20));
    const skip = (page - 1) * pageSize;
    const sortBy = params.sortBy || 'activatedAt';
    const sortOrder = params.sortOrder || 'desc';

    // Build where clause
    const where: Record<string, unknown> = {};

    if (params.licenseId) {
      where.licenseId = params.licenseId;
    }

    if (params.isActive !== undefined) {
      where.isActive = params.isActive;
    }

    // Search by hardware ID or machine name
    if (params.search) {
      where.OR = [
        { hardwareId: { contains: params.search, mode: 'insensitive' } },
        { machineName: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    // Build orderBy
    const orderBy: Record<string, 'asc' | 'desc'> = {};
    const validSortFields = ['id', 'hardwareId', 'machineName', 'activatedAt', 'lastValidation', 'isActive'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'activatedAt';
    orderBy[sortField] = sortOrder;

    // Execute queries in parallel
    const [activations, totalItems] = await Promise.all([
      prisma.activation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          license: {
            select: {
              id: true,
              licenseKey: true,
              customerName: true,
              locationName: true,
            },
          },
        },
      }),
      prisma.activation.count({ where }),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalItems / pageSize);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1;

    return {
      data: activations as ActivationWithLicense[],
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
        licenseId: params.licenseId,
        isActive: params.isActive,
        search: params.search,
      },
    };
  }
}

