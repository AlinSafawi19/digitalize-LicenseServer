import os from 'os';
import prisma from '../config/database';

/**
 * System utility functions for monitoring and health checks
 */

export interface SystemInfo {
  uptime: number;
  uptimeFormatted: string;
  memory: {
    total: number;
    free: number;
    used: number;
    usagePercent: number;
  };
  cpu: {
    loadAverage: number[];
    cores: number;
  };
  nodeVersion: string;
  platform: string;
  arch: string;
}

export interface DatabaseHealth {
  status: 'connected' | 'disconnected' | 'error';
  responseTime?: number;
  error?: string;
}

/**
 * Get system information
 */
export function getSystemInfo(): SystemInfo {
  const uptime = process.uptime();
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const usagePercent = (usedMemory / totalMemory) * 100;

  return {
    uptime,
    uptimeFormatted: formatUptime(uptime),
    memory: {
      total: totalMemory,
      free: freeMemory,
      used: usedMemory,
      usagePercent: Math.round(usagePercent * 100) / 100,
    },
    cpu: {
      loadAverage: os.loadavg(),
      cores: os.cpus().length,
    },
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
  };
}

/**
 * Format uptime in human-readable format
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;
    
    return {
      status: 'connected',
      responseTime,
    };
  } catch (error) {
    return {
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get memory usage in MB
 */
export function getMemoryUsageMB() {
  const usage = process.memoryUsage();
  return {
    rss: Math.round(usage.rss / 1024 / 1024),
    heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
    heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
    external: Math.round(usage.external / 1024 / 1024),
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024),
  };
}

