import { Router } from 'express';
import licenseRoutes from './license.routes';
import adminRoutes from './admin.routes';
import adminLicenseRoutes from './adminLicense.routes';
import adminActivationRoutes from './adminActivation.routes';
import adminSubscriptionRoutes from './adminSubscription.routes';
import adminPaymentRoutes from './adminPayment.routes';
import adminStatsRoutes from './adminStats.routes';
import { generalApiLimiter } from '../../config/rateLimit.config';

const router = Router();

// Apply general API rate limiting to all routes
router.use(generalApiLimiter);

// License routes
router.use('/license', licenseRoutes);

// Admin routes
router.use('/admin', adminRoutes);

// Admin license management routes
router.use('/admin/licenses', adminLicenseRoutes);

// Admin activation management routes
router.use('/admin/activations', adminActivationRoutes);

// Admin subscription management routes
router.use('/admin/subscriptions', adminSubscriptionRoutes);

// Admin payment management routes
router.use('/admin/payments', adminPaymentRoutes);

// Admin stats and reports routes
router.use('/admin', adminStatsRoutes);

export default router;

