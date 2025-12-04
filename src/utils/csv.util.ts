/**
 * CSV Utility
 * Helper functions for generating CSV exports
 */

/**
 * Convert array of objects to CSV string
 * @param data Array of objects
 * @param headers Optional custom headers (defaults to object keys)
 * @returns CSV string
 */
export function arrayToCSV<T extends Record<string, unknown>>(
  data: T[],
  headers?: string[]
): string {
  if (data.length === 0) {
    return '';
  }

  // Use provided headers or extract from first object
  const csvHeaders = headers || Object.keys(data[0]);

  // Escape CSV values
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }
    const stringValue = String(value);
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  // Build CSV rows
  const rows: string[] = [];

  // Header row
  rows.push(csvHeaders.map(escapeCSV).join(','));

  // Data rows
  data.forEach((item) => {
    const row = csvHeaders.map((header) => {
      const value = item[header];
      return escapeCSV(value);
    });
    rows.push(row.join(','));
  });

  return rows.join('\n');
}

/**
 * Convert license data to CSV format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function licensesToCSV(licenses: Array<any>): string {
  const headers = [
    'ID',
    'License Key',
    'Customer Name',
    'Customer Email',
    'Status',
    'License Type',
    'Purchase Date',
    'Initial Price',
    'Location Name',
    'Location Address',
    'Created At',
    'Updated At',
  ];

  const csvData = licenses.map((license) => {
    const formatDate = (value: unknown): string => {
      if (!value) return '';
      if (value instanceof Date) return value.toISOString();
      if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value);
        return isNaN(date.getTime()) ? '' : date.toISOString();
      }
      return '';
    };

    return {
      ID: license.id,
      'License Key': license.licenseKey,
      'Customer Name': license.customerName || '',
      'Customer Email': license.customerEmail || '',
      Status: license.status,
      'Purchase Date': formatDate(license.purchaseDate),
      'Initial Price': license.initialPrice ? String(license.initialPrice) : '',
      'Location Name': license.locationName || '',
      'Location Address': license.locationAddress || '',
      'Created At': formatDate(license.createdAt),
      'Updated At': formatDate(license.updatedAt),
    };
  });

  return arrayToCSV(csvData, headers);
}

