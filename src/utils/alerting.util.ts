/**
 * Alerting System Utility
 * Provides structure for monitoring alerts and notifications
 * 
 * This is a basic structure that can be extended with:
 * - WhatsApp notifications
 * - Slack/Discord webhooks
 * - SMS alerts
 * - PagerDuty integration
 * - Custom notification channels
 */

import { logger } from './logger';
import { getSystemInfo, checkDatabaseHealth } from './system.util';
import { metricsCollector } from './metrics.util';

export interface Alert {
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface AlertRule {
  name: string;
  check: () => Promise<boolean>;
  level: Alert['level'];
  message: string;
  cooldown?: number; // Cooldown period in milliseconds
  lastTriggered?: Date;
}

class AlertingSystem {
  private alerts: Alert[] = [];
  private rules: AlertRule[] = [];
  private maxAlerts = 1000; // Keep last 1000 alerts

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    // High memory usage alert
    this.addRule({
      name: 'high_memory_usage',
      level: 'warning',
      message: 'System memory usage is above 90%',
      cooldown: 5 * 60 * 1000, // 5 minutes
      check: async () => {
        const systemInfo = getSystemInfo();
        return systemInfo.memory.usagePercent > 90;
      },
    });

    // Critical memory usage alert
    this.addRule({
      name: 'critical_memory_usage',
      level: 'critical',
      message: 'System memory usage is above 95%',
      cooldown: 2 * 60 * 1000, // 2 minutes
      check: async () => {
        const systemInfo = getSystemInfo();
        return systemInfo.memory.usagePercent > 95;
      },
    });

    // Database connection alert
    this.addRule({
      name: 'database_disconnected',
      level: 'critical',
      message: 'Database connection is down',
      cooldown: 1 * 60 * 1000, // 1 minute
      check: async () => {
        const dbHealth = await checkDatabaseHealth();
        return dbHealth.status !== 'connected';
      },
    });

    // High error rate alert
    this.addRule({
      name: 'high_error_rate',
      level: 'warning',
      message: 'Error rate is above 10%',
      cooldown: 5 * 60 * 1000, // 5 minutes
      check: async () => {
        const metrics = metricsCollector.getMetrics();
        if (metrics.requests.total === 0) return false;
        const errorRate = (metrics.requests.errors / metrics.requests.total) * 100;
        return errorRate > 10;
      },
    });

    // Slow response time alert
    this.addRule({
      name: 'slow_response_time',
      level: 'warning',
      message: 'Average response time is above 1000ms',
      cooldown: 5 * 60 * 1000, // 5 minutes
      check: async () => {
        const metrics = metricsCollector.getMetrics();
        return metrics.responseTime.average > 1000;
      },
    });
  }

  /**
   * Add a custom alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
  }

  /**
   * Check all alert rules
   */
  async checkAlerts(): Promise<Alert[]> {
    const triggeredAlerts: Alert[] = [];

    for (const rule of this.rules) {
      // Check cooldown period
      if (rule.cooldown && rule.lastTriggered) {
        const timeSinceLastTrigger = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTrigger < rule.cooldown) {
          continue; // Still in cooldown period
        }
      }

      try {
        const shouldAlert = await rule.check();
        
        if (shouldAlert) {
          const alert: Alert = {
            level: rule.level,
            title: rule.name,
            message: rule.message,
            timestamp: new Date(),
            metadata: {
              rule: rule.name,
            },
          };

          triggeredAlerts.push(alert);
          this.addAlert(alert);
          rule.lastTriggered = new Date();

          // Log the alert
          const logLevel = rule.level === 'critical' ? 'error' : rule.level;
          if (logLevel === 'error') {
            logger.error('Alert triggered', {
              rule: rule.name,
              level: rule.level,
              message: rule.message,
            });
          } else if (logLevel === 'warning') {
            logger.warn('Alert triggered', {
              rule: rule.name,
              level: rule.level,
              message: rule.message,
            });
          } else {
            logger.info('Alert triggered', {
              rule: rule.name,
              level: rule.level,
              message: rule.message,
            });
          }
        }
      } catch (error) {
        logger.error('Error checking alert rule', {
          rule: rule.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return triggeredAlerts;
  }

  /**
   * Add an alert
   */
  addAlert(alert: Alert): void {
    this.alerts.push(alert);
    
    // Keep only the last maxAlerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts.shift();
    }

    // Here you can extend to send notifications:
    // - WhatsApp notifications
    // - Slack/Discord webhooks
    // - SMS alerts
    // - PagerDuty integration
    // Example:
    // this.sendWhatsAppNotification(alert);
    // this.sendSlackNotification(alert);
  }

  /**
   * Get recent alerts
   */
  getAlerts(limit: number = 100, level?: Alert['level']): Alert[] {
    let filtered = this.alerts;

    if (level) {
      filtered = filtered.filter(alert => alert.level === level);
    }

    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.alerts = [];
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    total: number;
    byLevel: { [level: string]: number };
    recent: Alert[];
  } {
    const byLevel: { [level: string]: number } = {};
    
    for (const alert of this.alerts) {
      byLevel[alert.level] = (byLevel[alert.level] || 0) + 1;
    }

    return {
      total: this.alerts.length,
      byLevel,
      recent: this.getAlerts(10),
    };
  }
}

// Singleton instance
export const alertingSystem = new AlertingSystem();

/**
 * Start periodic alert checking (optional)
 * Call this in server.ts if you want automatic alert checking
 */
export function startAlertMonitoring(intervalMs: number = 60000): void {
  setInterval(async () => {
    await alertingSystem.checkAlerts();
  }, intervalMs);

  logger.info('Alert monitoring started', { intervalMs });
}

