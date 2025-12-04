/**
 * Metrics Collection Utility
 * Tracks performance metrics and request statistics
 */

interface RequestMetrics {
  count: number;
  totalResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  errors: number;
  lastRequestTime?: Date;
  averageResponseTime?: number;
}

interface EndpointMetrics {
  [path: string]: RequestMetrics;
}

interface SystemMetrics {
  requests: {
    total: number;
    successful: number;
    errors: number;
    byMethod: {
      [method: string]: number;
    };
    byEndpoint: EndpointMetrics;
  };
  responseTime: {
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  };
  uptime: {
    startTime: Date;
    seconds: number;
    formatted: string;
  };
}

class MetricsCollector {
  private startTime: Date;
  private requestCount: number = 0;
  private successfulRequests: number = 0;
  private errorCount: number = 0;
  private requestsByMethod: { [method: string]: number } = {};
  private endpointMetrics: EndpointMetrics = {};
  private responseTimes: number[] = [];

  constructor() {
    this.startTime = new Date();
  }

  /**
   * Record a request
   */
  recordRequest(method: string, path: string, responseTime: number, isError: boolean = false): void {
    this.requestCount++;
    
    if (isError) {
      this.errorCount++;
    } else {
      this.successfulRequests++;
    }

    // Track by method
    this.requestsByMethod[method] = (this.requestsByMethod[method] || 0) + 1;

    // Track by endpoint
    const normalizedPath = this.normalizePath(path);
    if (!this.endpointMetrics[normalizedPath]) {
      this.endpointMetrics[normalizedPath] = {
        count: 0,
        totalResponseTime: 0,
        minResponseTime: Infinity,
        maxResponseTime: 0,
        errors: 0,
      };
    }

    const endpoint = this.endpointMetrics[normalizedPath];
    endpoint.count++;
    endpoint.totalResponseTime += responseTime;
    endpoint.minResponseTime = Math.min(endpoint.minResponseTime, responseTime);
    endpoint.maxResponseTime = Math.max(endpoint.maxResponseTime, responseTime);
    endpoint.lastRequestTime = new Date();
    
    if (isError) {
      endpoint.errors++;
    }

    // Store response time for percentile calculation
    this.responseTimes.push(responseTime);
    
    // Keep only last 1000 response times to prevent memory issues
    if (this.responseTimes.length > 1000) {
      this.responseTimes.shift();
    }
  }

  /**
   * Normalize path for metrics (remove IDs, etc.)
   */
  private normalizePath(path: string): string {
    // Replace UUIDs and numeric IDs with :id
    return path
      .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
      .replace(/\/\d+/g, '/:id');
  }

  /**
   * Calculate percentile
   */
  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get all metrics
   */
  getMetrics(): SystemMetrics {
    const uptime = (Date.now() - this.startTime.getTime()) / 1000;
    
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : 0;

    const minResponseTime = this.responseTimes.length > 0
      ? Math.min(...this.responseTimes)
      : 0;

    const maxResponseTime = this.responseTimes.length > 0
      ? Math.max(...this.responseTimes)
      : 0;

    return {
      requests: {
        total: this.requestCount,
        successful: this.successfulRequests,
        errors: this.errorCount,
        byMethod: { ...this.requestsByMethod },
        byEndpoint: this.getEndpointMetrics(),
      },
      responseTime: {
        average: Math.round(avgResponseTime * 100) / 100,
        min: minResponseTime,
        max: maxResponseTime,
        p95: this.calculatePercentile(this.responseTimes, 95),
        p99: this.calculatePercentile(this.responseTimes, 99),
      },
      uptime: {
        startTime: this.startTime,
        seconds: Math.floor(uptime),
        formatted: this.formatUptime(uptime),
      },
    };
  }

  /**
   * Get endpoint metrics with calculated averages
   */
  private getEndpointMetrics(): EndpointMetrics {
    const metrics: EndpointMetrics = {};
    
    for (const [path, data] of Object.entries(this.endpointMetrics)) {
      metrics[path] = {
        ...data,
        minResponseTime: data.minResponseTime === Infinity ? 0 : data.minResponseTime,
        averageResponseTime: data.count > 0
          ? Math.round((data.totalResponseTime / data.count) * 100) / 100
          : 0,
      };
    }
    
    return metrics;
  }

  /**
   * Format uptime
   */
  private formatUptime(seconds: number): string {
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
   * Reset metrics (useful for testing or periodic resets)
   */
  reset(): void {
    this.startTime = new Date();
    this.requestCount = 0;
    this.successfulRequests = 0;
    this.errorCount = 0;
    this.requestsByMethod = {};
    this.endpointMetrics = {};
    this.responseTimes = [];
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

