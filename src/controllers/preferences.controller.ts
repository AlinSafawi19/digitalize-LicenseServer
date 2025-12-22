import { Request, Response } from 'express';
import { PreferencesService } from '../services/preferences.service';
import { ResponseUtil } from '../utils/response.util';
import { logger } from '../utils/logger';

/**
 * Preferences Controller
 * Handles HTTP requests for preferences operations
 */
export class PreferencesController {
  /**
   * Get preferences
   * GET /api/preferences
   */
  static async getPreferences(req: Request, res: Response): Promise<void> {
    try {
      const preferences = await PreferencesService.getPreferences();
      logger.info('Preferences retrieved successfully');
      ResponseUtil.success(res, preferences, 'Preferences retrieved successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get preferences';
      logger.error('Error getting preferences', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }

  /**
   * Update preferences
   * PATCH /api/preferences
   */
  static async updatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const { general, customer, licenseTypeVersion } = req.body;

      // Validate that at least one section is provided
      if (!general && !customer && !licenseTypeVersion) {
        ResponseUtil.error(res, 'At least one preference section must be provided', 400);
        return;
      }

      const preferences = await PreferencesService.updatePreferences({
        general,
        customer,
        licenseTypeVersion,
      });

      logger.info('Preferences updated successfully');
      ResponseUtil.success(res, preferences, 'Preferences updated successfully', 200);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update preferences';
      logger.error('Error updating preferences', { error: errorMessage });
      ResponseUtil.error(res, errorMessage, 500);
    }
  }
}

