# BargainHuntrs Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Interface                           │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │   Next.js Web    │  │   Mobile App     │  │   Admin UI   │  │
│  │   (Render)       │  │   (Future)       │  │   (Future)   │  │
│  │   Port 3030      │  │                  │  │              │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            └────────────────────┼────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    FastAPI Backend (Render)                     │
│                    bargainhuntrs.com:4040                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │  │
│  │  │   Auth   │  │  Alerts  │  │ Pricing  │  │ Payments │  │  │
│  │  │ Service  │  │ Service  │  │ Monitor  │  │ Service  │  │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  │  │
│  └───────┼────────────┼────────────┼────────────┼──────────┘  │
│          │            │            │            │              │
└──────────┼────────────┼────────────┼────────────┼──────────────┘
           │            │            │            │
           ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      External Services                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │PostgreSQL│  │ Supabase │  │  Stripe  │  │ Resend   │        │
│  │(Render) │  │ Storage  │  │ Payments │  │  Email   │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │ Firebase │  │ Retailer │  │  Price   │                      │
│  │  SMS/Push│  │   APIs   │  │ Trackers │                      │
│  └──────────┘  └──────────┘  └──────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

## Component Details

### Frontend (bargain-web)
- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4
- **State Management**: React Context / Zustand (future)
- **Authentication**: NextAuth.js or Clerk
- **Port**: 3030
- **Deployment**: Render (free tier)
- **Package Manager**: pnpm 9.15.5 (PERMANENT)

### Backend (bargain-api)
- **Framework**: FastAPI
- **Database**: PostgreSQL (Render)
- **ORM**: SQLAlchemy 2.0 (async)
- **Authentication**: JWT tokens
- **Task Queue**: Celery + Redis (future)
- **Port**: 4040
- **Deployment**: Render
- **Domain**: bargainhuntrs.com

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    hashed_password VARCHAR(255),
    subscription_tier VARCHAR(50) DEFAULT 'free',
    stripe_customer_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Subscriptions Table
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    status VARCHAR(50),
    tier VARCHAR(50),
    current_period_end TIMESTAMP,
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Alerts Table
```sql
CREATE TABLE alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    source_url VARCHAR(500),
    potential_profit DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'pending',
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### Price Snapshots Table
```sql
CREATE TABLE price_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_id VARCHAR(255) NOT NULL,
    retailer VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    timestamp TIMESTAMP DEFAULT NOW()
);
```

#### Watchlist Items Table
```sql
CREATE TABLE watchlist_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    item_name VARCHAR(255) NOT NULL,
    target_price DECIMAL(10,2),
    current_price DECIMAL(10,2),
    retailers JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh JWT token

### Users
- `GET /api/v1/users/me` - Get current user
- `PUT /api/v1/users/me` - Update user profile

### Subscriptions
- `POST /api/v1/subscriptions/create-checkout-session` - Create Stripe checkout
- `POST /api/v1/subscriptions/webhook` - Stripe webhook handler
- `GET /api/v1/subscriptions/current` - Get current subscription

### Alerts
- `GET /api/v1/alerts` - List user alerts
- `POST /api/v1/alerts` - Create custom alert
- `PUT /api/v1/alerts/:id` - Update alert
- `DELETE /api/v1/alerts/:id` - Delete alert

### Price Monitoring
- `GET /api/v1/prices/:item_id` - Get price history
- `POST /api/v1/prices/track` - Track new item
- `GET /api/v1/prices/opportunities` - Get arbitrage opportunities

### Watchlist
- `GET /api/v1/watchlist` - Get user watchlist
- `POST /api/v1/watchlist` - Add item to watchlist
- `DELETE /api/v1/watchlist/:id` - Remove from watchlist

## Data Flow

### Price Monitoring Flow
```
1. Scheduler triggers price check
2. Scraper fetches prices from retailers
3. Prices compared to historical data
4. Anomalies detected (price drops, errors)
5. Alert created in database
6. Notification sent via Resend/Firebase
7. User receives alert
```

### Subscription Flow
```
1. User selects tier on frontend
2. Frontend calls Stripe checkout endpoint
3. Backend creates Stripe checkout session
4. User redirected to Stripe
5. User completes payment
6. Stripe webhook notifies backend
7. Backend updates user subscription
8. User granted tier-based access
```

## Security Considerations

- All API endpoints protected by JWT authentication
- Rate limiting on public endpoints
- Input validation with Pydantic
- SQL injection prevention via ORM
- CORS configured for allowed origins
- Environment variables for sensitive data
- Webhook signature verification (Stripe)

## Scalability Plan

### Phase 1 (Current)
- Single FastAPI instance
- Direct database connections
- Basic caching

### Phase 2 (Growth)
- Load balancer with multiple API instances
- Redis caching layer
- Celery for async tasks
- Database read replicas

### Phase 3 (Scale)
- Microservices architecture
- Message queue (RabbitMQ/Kafka)
- CDN for static assets
- Database sharding

## Monitoring & Observability

- Application logs: Structured JSON logging
- Error tracking: Sentry (future)
- Performance monitoring: New Relic (future)
- Uptime monitoring: UptimeRobot (future)
- Database monitoring: Render built-in metrics
