# MedicStar App

A Shopify application that provides integration between Shopify stores and Microsoft Dynamics 365 Business Central (BC). The app handles product price & quantity update in Shopify from external file and order management to streamline business operations by ensuring data consistency between Shopify store and BC ERP system.

## Features

### 1. Product Synchronization

- **Price Updates**: Automatically sync product prices from external CSV files to your Shopify store. **he time for the sync is configured using a **`<span class="selected">CRON_SCHEDULE</span>` environment variable. For example:

  ```
  # Daily at midnight UTC (default)
  CRON_SCHEDULE=0 0 * * *

  # Daily at 2:00 AM UTC
  #CRON_SCHEDULE=0 2 * * *

  # Daily at 1:30 AM UTC
  #CRON_SCHEDULE=30 1 * * *

  # Daily at 6:00 PM UTC
  #CRON_SCHEDULE=0 18 * * *
  ```
- **Inventory Management**: Update stock levels based on external data sources
- **Settings**: Interface for force sync in case of out of line sync, start/stop automatic sync, stop all pending tasks
- **Real-time Status**: Monitor sync progress and view detailed logs

### 2. Order Management

- **Order Transfer**: Automatically transfer Shopify orders to Business Central. Order name ()
- **Contact Management**: Create and manage contact records in BC in case the contact does not exist
- **Customer Groups:** By default, the app sends a selected customer group or "ONLINESHOP" to Business Central. For orders shipped to Germany, the customer group is determined by a selection made on the cart page. For orders shipped to Austria or the Netherlands, the app overrides this default and assigns a specific customer group based on whether taxes are included.

## Architecture

This application is built using:

- **Frontend**: Remix with React and Shopify Polaris
- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Integration**: SOAP API for Business Central communication

## Prerequisites

Before you begin, ensure you have:

1. **Node.js**: Version 22.12+
2. **PostgreSQL**: Database server for data persistence
3. **Shopify Partner Account**: For app development and testing
4. **Development Store**: Shopify development store for testing
5. **Business Central**: Access to Microsoft Dynamics 365 Business Central instance
6. **Docker** (optional): For containerized deployment

## Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd MedicStarApp/medicstar-app
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment Setup

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/medicstar_db"

# Shopify App Configuration
SHOPIFY_API_KEY="your_shopify_api_key"
SHOPIFY_API_SECRET="your_shopify_api_secret"
SCOPES="write_products,read_orders,write_orders,write_inventory,read_locations"

# Business Central Integration
NAV_ENDPOINT_ORDER="https://your-bc-instance.com:7047/BC140/ODataV4/Company('YourCompany')/CreateSalesOrder"
NAV_ENDPOINT_CONTACT="https://your-bc-instance.com:7047/BC140/ODataV4/Company('YourCompany')/CreateContact"
NAV_USER="your_bc_username"
NAV_PASS="your_bc_password"

# App Configuration
NODE_ENV="development"
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate:deploy
```

## Development

### Local Development

```bash
# Start the development server
npm run dev

# The app will be available at the URL shown in the terminal
# Press 'P' to open the app in your browser
```

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run setup` - Setup database and generate Prisma client
- `npm run lint` - Run ESLint
- `npm run prisma:migrate:dev` - Create and apply database migrations

## App Navigation

The app provides the following main sections:

- **Home**: Overview of app functionality and quick access to features
- **Sync Prices & Stock**: Configure and manage product synchronization
- **Sync Status**: Monitor ongoing sync operations and view logs

## Configuration

### Product Synchronization

1. Navigate to **Sync Prices & Stock** in the app
2. Configure sync settings:
   - CSV file source
   - Sync frequency
   - Product mapping rules
3. Start manual sync or schedule automatic updates

### Order Management

Order processing is automatically handled via webhooks:

- Orders are created in Business Central when received from Shopify
- Customer records are automatically created if they don't exist
- Payment methods are mapped to appropriate BC transaction codes

## Docker Deployment

### Using Docker Compose

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Using Makefile (Coming Soon)

```bash
# Build the application
make build

# Start development environment
make dev

# Deploy to production
make deploy
```

## Database Schema

The application uses the following main entities:

- **Session**: Shopify app session management
- **Shop**: Store information and configuration
- **Job**: Background job processing
- **Process**: Individual process steps within jobs
- **Setting**: Application configuration settings

## API Integration

### Shopify Integration

- **GraphQL Admin API**: Product and order management
- **Webhooks**: Real-time order processing
- **App Bridge**: Embedded app functionality

### Business Central Integration

- **SOAP API**: Order and contact creation
- **OData**: Data querying and updates
- **Authentication**: Basic authentication with username/password

## Troubleshooting

### Common Issues

1. **Database Connection Error**

   ```bash
   # Ensure PostgreSQL is running and DATABASE_URL is correct
   npm run setup
   ```
2. **Shopify Authentication Issues**

   - Verify API credentials in `.env`
   - Check app installation in Shopify Partner Dashboard
   - Ensure correct redirect URLs
3. **Business Central Integration Errors**

   - Verify BC endpoint URLs
   - Check authentication credentials
   - Ensure proper network connectivity
4. **Sync Job Failures**

   - Check CSV file format and location
   - Verify product SKU mappings
   - Review job logs in the Sync Status section

### Debug Mode

Enable debug logging by setting:

```env
NODE_ENV="development"
DEBUG="medicstar:*"
LOG_LEVEL="debug"
```

### Logging

The application uses Winston with `winston-daily-rotate-file` for comprehensive logging:

- **Console Logging**: Real-time logs during development with colorized output
- **File Logging**: Persistent logs with automatic daily rotation stored in `/logs` directory
  - `orders-YYYY-MM-DD.log`: All order processing activities (rotates daily, 10MB max, 30 days retention)
  - `medicstar-YYYY-MM-DD.log`: General application logs (rotates daily, 20MB max, 14 days retention)

**Log Features**:
- **Automatic Rotation**: Daily rotation based on date
- **Compression**: Old log files are automatically compressed (.gz)
- **Size Limits**: Automatic rotation when files reach size limits
- **Retention**: Configurable retention periods

**Log Levels**: `error`, `warn`, `info`, `debug`, `verbose`

**Order Processing Logs Include**:
- Order webhook received with sanitized customer data
- Contact lookup and creation in Business Central
- Product processing with SKU validation
- Business Central integration status
- Success/failure status with processing times

**Log Configuration**:
```env
NODE_ENV=development  # Enables verbose logging in development
```

**Log File Structure**:
```
/logs/
├── orders-2025-01-20.log          # Current day's order logs
├── medicstar-2025-01-20.log       # Current day's app logs
└── *.gz                           # Compressed old log files
```

## Monitoring

- **Job Status**: Monitor background jobs in the Sync Status section
- **Error Logs**: View detailed error information for failed operations
- **Performance**: Track sync times and success rates

## Security

- All API communications use HTTPS
- Database connections are encrypted
- Shopify webhooks are validated using HMAC
- Business Central credentials are stored securely

## Version History

- **v1.0.0**: Initial release with product sync and order management

---

**Note**: This application is designed for specific business requirements and may need customization for different use cases.
