import swaggerJsdoc, { Options } from 'swagger-jsdoc';

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'DigitalizePOS License Server API',
    version: '1.0.0',
    description: 'API for managing licenses, activations, and subscriptions for DigitalizePOS system',
    contact: {
      name: 'DigitalizePOS Support',
    },
  },
  servers: [
    {
      url: `http://localhost:${process.env.PORT || 3000}`,
      description: 'Development server',
    },
    {
      url: 'https://api.digitalizepos.com',
      description: 'Production server',
    },
  ],
  tags: [
    {
      name: 'License',
      description: 'License management operations (public)',
    },
    {
      name: 'Admin',
      description: 'Admin authentication and profile management',
    },
    {
      name: 'Admin - Licenses',
      description: 'Admin license management operations',
    },
    {
      name: 'Admin - Activations',
      description: 'Admin activation management operations',
    },
    {
      name: 'Admin - Subscriptions',
      description: 'Admin subscription management operations',
    },
    {
      name: 'Admin - Payments',
      description: 'Admin payment management operations',
    },
    {
      name: 'Admin - Statistics',
      description: 'Admin dashboard statistics and reports',
    },
    {
      name: 'Health',
      description: 'Health check endpoints',
    },
    {
      name: 'Metrics',
      description: 'System metrics and monitoring (admin only)',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT token obtained from /api/admin/login endpoint',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message',
          },
          errors: {
            type: 'array',
            items: {
              type: 'object',
            },
          },
        },
      },
      Success: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: true,
          },
          message: {
            type: 'string',
            example: 'Operation successful',
          },
          data: {
            type: 'object',
          },
        },
      },
      License: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          licenseKey: {
            type: 'string',
            example: 'ABCD-1234-EFGH-5678-XXXX',
          },
          customerName: {
            type: 'string',
            nullable: true,
            example: 'John Doe',
          },
          customerEmail: {
            type: 'string',
            nullable: true,
            example: 'john.doe@example.com',
          },
          status: {
            type: 'string',
            enum: ['active', 'expired', 'revoked', 'suspended'],
            example: 'active',
          },
          locationName: {
            type: 'string',
            nullable: true,
            example: 'ABC Grocery Shop',
          },
          locationAddress: {
            type: 'string',
            nullable: true,
            example: '123 Main Street, City, Country',
          },
          purchaseDate: {
            type: 'string',
            format: 'date-time',
          },
          initialPrice: {
            type: 'number',
            example: 350.0,
          },
        },
      },
      LicenseStatus: {
        type: 'object',
        properties: {
          valid: {
            type: 'boolean',
            example: true,
          },
          status: {
            type: 'string',
            enum: ['active', 'expired', 'revoked', 'suspended', 'grace_period', 'not_found'],
            example: 'active',
          },
          message: {
            type: 'string',
            example: 'License is active and valid',
          },
          expiresAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          gracePeriodEnd: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      Admin: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          username: {
            type: 'string',
            example: 'admin',
          },
          email: {
            type: 'string',
            example: 'admin@digitalizepos.com',
          },
        },
      },
      Activation: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          licenseId: {
            type: 'integer',
            example: 1,
          },
          hardwareId: {
            type: 'string',
            example: 'abc123def456',
          },
          machineName: {
            type: 'string',
            nullable: true,
            example: 'DESKTOP-ABC123',
          },
          activatedAt: {
            type: 'string',
            format: 'date-time',
          },
          lastValidation: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
          isActive: {
            type: 'boolean',
            example: true,
          },
        },
      },
      Subscription: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          licenseId: {
            type: 'integer',
            example: 1,
          },
          startDate: {
            type: 'string',
            format: 'date-time',
          },
          endDate: {
            type: 'string',
            format: 'date-time',
          },
          annualFee: {
            type: 'number',
            example: 50.0,
          },
          status: {
            type: 'string',
            enum: ['active', 'expired', 'cancelled'],
            example: 'active',
          },
          gracePeriodEnd: {
            type: 'string',
            format: 'date-time',
            nullable: true,
          },
        },
      },
      Payment: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          licenseId: {
            type: 'integer',
            example: 1,
          },
          amount: {
            type: 'number',
            example: 350.0,
          },
          paymentDate: {
            type: 'string',
            format: 'date-time',
          },
          isAnnualSubscription: {
            type: 'boolean',
            example: false,
          },
        },
      },
      Pagination: {
        type: 'object',
        properties: {
          page: {
            type: 'integer',
            example: 1,
          },
          pageSize: {
            type: 'integer',
            example: 20,
          },
          totalItems: {
            type: 'integer',
            example: 100,
          },
          totalPages: {
            type: 'integer',
            example: 5,
          },
          hasNextPage: {
            type: 'boolean',
            example: true,
          },
          hasPreviousPage: {
            type: 'boolean',
            example: false,
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: {
            type: 'boolean',
            example: false,
          },
          message: {
            type: 'string',
            example: 'Error message',
          },
          code: {
            type: 'string',
            nullable: true,
            example: 'NOT_FOUND',
          },
          details: {
            type: 'object',
            nullable: true,
          },
        },
      },
    },
  },
};

const options: Options = {
  definition: swaggerDefinition,
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'],
};

const swaggerSpec = swaggerJsdoc(options);

export { swaggerSpec };

