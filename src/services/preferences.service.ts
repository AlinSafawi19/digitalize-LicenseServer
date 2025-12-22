import prisma from '../config/database';
import { logger } from '../utils/logger';

export interface PreferencesData {
  general: {
    phoneNumberVerification: boolean;
  };
  customer: Record<string, unknown>;
  licenseTypeVersion: Record<string, unknown>;
}

export interface UpdatePreferencesInput {
  general?: Partial<PreferencesData['general']>;
  customer?: Partial<PreferencesData['customer']>;
  licenseTypeVersion?: Partial<PreferencesData['licenseTypeVersion']>;
}

/**
 * Preferences Service
 * Handles application preferences management
 */
export class PreferencesService {
  private static readonly DEFAULT_PREFERENCES: PreferencesData = {
    general: {
      phoneNumberVerification: true,
    },
    customer: {},
    licenseTypeVersion: {},
  };

  /**
   * Get current preferences
   * Returns default preferences if none exist in database
   */
  static async getPreferences(): Promise<PreferencesData> {
    try {
      // Get the first (and only) preferences record
      // We use a singleton pattern - only one preferences record exists
      const preferences = await prisma.preferences.findFirst({
        orderBy: { id: 'asc' },
      });

      if (preferences) {
        return {
          general: preferences.general as PreferencesData['general'],
          customer: preferences.customer as PreferencesData['customer'],
          licenseTypeVersion: preferences.licenseTypeVersion as PreferencesData['licenseTypeVersion'],
        };
      }

      // If no preferences exist, return defaults
      return this.DEFAULT_PREFERENCES;
    } catch (error: unknown) {
      logger.error('Error getting preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Return defaults on error
      return this.DEFAULT_PREFERENCES;
    }
  }

  /**
   * Update preferences
   * Creates preferences if they don't exist, updates if they do
   */
  static async updatePreferences(input: UpdatePreferencesInput): Promise<PreferencesData> {
    try {
      // Get current preferences
      const current = await this.getPreferences();

      // Merge updates with current preferences
      const updated: PreferencesData = {
        general: {
          ...current.general,
          ...input.general,
        },
        customer: {
          ...current.customer,
          ...input.customer,
        },
        licenseTypeVersion: {
          ...current.licenseTypeVersion,
          ...input.licenseTypeVersion,
        },
      };

      // Check if preferences exist
      const existing = await prisma.preferences.findFirst({
        orderBy: { id: 'asc' },
      });

      if (existing) {
        // Update existing preferences
        const result = await prisma.preferences.update({
          where: { id: existing.id },
          data: {
            general: updated.general,
            customer: updated.customer,
            licenseTypeVersion: updated.licenseTypeVersion,
          },
        });

        return {
          general: result.general as PreferencesData['general'],
          customer: result.customer as PreferencesData['customer'],
          licenseTypeVersion: result.licenseTypeVersion as PreferencesData['licenseTypeVersion'],
        };
      } else {
        // Create new preferences
        const result = await prisma.preferences.create({
          data: {
            general: updated.general,
            customer: updated.customer,
            licenseTypeVersion: updated.licenseTypeVersion,
          },
        });

        return {
          general: result.general as PreferencesData['general'],
          customer: result.customer as PreferencesData['customer'],
          licenseTypeVersion: result.licenseTypeVersion as PreferencesData['licenseTypeVersion'],
        };
      }
    } catch (error: unknown) {
      logger.error('Error updating preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error('Failed to update preferences');
    }
  }
}

