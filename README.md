# DigitalizePOS License Server

License management, activation, and validation server for DigitalizePOS application.

## Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18+
- **Language**: TypeScript 5.3+
- **Database**: PostgreSQL 14+
- **ORM**: Prisma 5.7+
- **Authentication**: JWT

## Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- npm or yarn

## Installation

1. **Clone the repository** (if applicable)
   ```bash
   git clone <repository-url>
   cd DigitalizePOS-LicenseServer
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp env.example .env
   ```
   Edit `.env` and configure:
   - `DATABASE_URL`: PostgreSQL connection string
   - `JWT_SECRET`: Secret key for JWT tokens
   - Other configuration as needed

4. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run db:generate

   # Run database migrations
   npm run db:migrate
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio
- `npm run db:seed` - Seed database with test data
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix ESLint errors
- `npm run format` - Format code with Prettier
- `npm run type-check` - Type check without building

## Project Structure

```
DigitalizePOS-LicenseServer/
├── src/
│   ├── config/          # Configuration files
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Custom middleware
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   ├── utils/           # Utility functions
│   └── server.ts        # Server entry point
├── prisma/
│   └── schema.prisma    # Database schema
├── logs/                # Application logs
└── dist/                # Compiled output
```

## API Endpoints

### Health Check
- `GET /health` - Check server and database health

More endpoints will be added in subsequent sprints.

## Database Schema

The database includes the following models:
- **License**: License keys and customer information
- **Activation**: Device activations bound to licenses
- **Subscription**: Subscription periods and expiration dates
- **Payment**: Payment records and transactions

See `prisma/schema.prisma` for full schema definition.

## Development

### Environment Variables

See `.env.example` for all available environment variables.

### Database Migrations

When modifying the Prisma schema:
1. Update `prisma/schema.prisma`
2. Run `npm run db:migrate` to create a migration
3. Run `npm run db:generate` to update Prisma client

### Code Style

- ESLint is configured for TypeScript
- Prettier is configured for code formatting
- Run `npm run lint:fix` and `npm run format` before committing

## Testing

Health check endpoint can be tested:
```bash
curl http://localhost:3000/health
```

## License

ISC

## Related Documentation

- See `SETUP.md` for Sprint 0 setup instructions
- See `DATABASE_SETUP.md` for comprehensive PostgreSQL database setup guide
- See `LICENSING_SERVER_SPRINT_PLAN.md` for sprint-by-sprint development plan
- See `LICENSING_SYSTEM_PLAN.md` for system architecture details
- See `PROJECT_STRUCTURE.md` for overall project structure

