# MedicStar App

A Shopify application that provides integration between Shopify stores and Microsoft Dynamics 365 Business Central (BC). The app handles product price & quantity update in Shopify from external file and order management to streamline business operations by ensuring data consistency between Shopify store and BC ERP system.

## Features

### 1. Product Synchronization

- **Price Updates**: Automatically sync product prices from external CSV files to the Shopify store. The time for the sync is configured using a `CRON_SCHEDULE` environment variable. For example:

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

- **Order Transfer**: Automatically transfer Shopify orders to Business Central. Order name (example: OS 0001) is set as Externe Belegnr.
- **Contact Management**: Create contact records in BC in case the contact with given email and provided phone number does not exist.
- **Customer Groups:** By default, the app sends a selected customer group or "ONLINESHOP" to Business Central. For orders shipped to Germany, the customer group is determined by a selection made on the cart page. For orders shipped to Austria or the Netherlands, the app overrides this default and assigns a specific customer group based on whether taxes are included.
- **Shipping data**: Each order has extra line item with delivery carier with ID V001
- **Promo code**: If Promo code was used the extra line with ID G1000 and descount amount is added to line items

## Architecture

This application is built using:

- **Frontend**: Remix with React and Shopify Polaris
- **Backend**: Node.js with TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Integration**: SOAP API for Business Central communication

## Prerequisites

Before you begin, ensure you have:

1. **Node.js**: Version 22.12+ (for local development)
2. **Docker & Docker Compose**: For containerized deployment (recommended)
3. **PostgreSQL**: Database server (included in Docker setup)
4. **Shopify Partner Account**: For app development and testing
5. **Development Store**: Shopify development store for testing
6. **Business Central**: Access to Microsoft Dynamics 365 Business Central instance

### Docker Requirements

- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+ (or `docker compose` command)
- **Make**: For using the provided Makefile commands (optional but recommended)

## Installation

### Local Development Setup

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd MedicStarApp/medicstar-app
```

#### 2. Install Dependencies

```bash
npm install
```

#### 3. Environment Setup

Create a `.env` file in the root directory based on `.env.example` file

#### 4. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate:deploy
```

#### 5. For local development with Shopify integration, follow these steps:

1. **Start ngrok tunnel:**

   ```bash
   ngrok http 3000
   ```
2. **Start Shopify app development:**

   ```bash
   shopify app dev --tunnel-url https://c697d30de724.ngrok-free.app:3000
   ```
3. **Update shopify.app.toml:**
   Update the `application_url` in `shopify.app.toml` with your ngrok URL:

   ```toml
   application_url = "https://c697d30de724.ngrok-free.app"
   ```
4. **Deploy the app:**

   ```bash
   shopify app deploy
   ```
5. **Install the app on Shopify store.**

### Production Development Setup


## Database Schema

The application uses the following main entities:

- **Session**: Shopify app session management
- **Shop**: Store information and configuration
- **Job**: Background job processing (main task)
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

### Logging

The application uses Winston with `winston-daily-rotate-file` for comprehensive logging:

- **Console Logging**: Real-time logs during development with colorized output
- **File Logging**: Persistent logs with automatic daily rotation stored in `/logs` directory
  - `orders-YYYY-MM-DD.log`: All order processing activities (rotates daily, 10MB max, 14 days retention)
  - `medicstar-YYYY-MM-DD.log`: General application logs (rotates daily, 20MB max, 14 days retention)
