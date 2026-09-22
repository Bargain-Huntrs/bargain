from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List, Optional


class Settings(BaseSettings):
    # Database (Render provides DATABASE_URL automatically)
    DATABASE_URL: str = "sqlite:///./bargain.db"

    # SQL query logging — set to True only for local debugging. In production
    # this floods logs at ~500/sec and causes Render to drop log messages.
    SQL_ECHO: bool = False

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def convert_to_psycopg2(cls, v: str) -> str:
        """Convert Render's default postgresql:// URL to psycopg2 driver format.

        The codebase uses synchronous SQLAlchemy (create_engine/Session), so we
        normalize to the psycopg2 driver rather than asyncpg.
        """
        if v.startswith("postgresql+asyncpg://"):
            return v.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)
        if v.startswith("postgresql://") and not v.startswith("postgresql+psycopg2://"):
            return v.replace("postgresql://", "postgresql+psycopg2://", 1)
        return v
    
    # API
    API_V1_PREFIX: str = "/api/v1"
    SECRET_KEY: str = ""  # Must be set via env var — no insecure default
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # CORS — explicit origins only, never wildcard with credentials
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3030",
        "https://www.bargainhuntrs.com",
        "https://bargainhuntrs.com",
        "https://bargain-web.bargain4huntrs.workers.dev",
        "https://bargain-mhi3.onrender.com",
        "https://bargain-web.onrender.com",
    ]
    
    # Stripe
    STRIPE_API_KEY: str = ""
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PRICE_FREE: str = ""
    STRIPE_PRICE_HUNTER: str = ""
    FRONTEND_URL: str = "https://bargainhuntrs.com"

    # WebAuthn (passkeys)
    WEB_AUTHN_RP_ID: str = "localhost"
    WEB_AUTHN_RP_NAME: str = "BargainHuntrs"
    WEB_AUTHN_ORIGIN: str = "http://localhost:3030"
    
    # Resend (Email)
    RESEND_API_KEY: str = ""
    ALERT_FROM_EMAIL: str = "alerts@bargainhuntrs.com"

    # Scheduled Scanning
    AUTO_SCAN: bool = True
    SCAN_INTERVAL_MINUTES: int = 60

    # Deal posting (X / social media)
    MAX_DEALS_PER_CYCLE: int = 5          # Max deals posted per scrape cycle
    POST_INTERVAL_MINUTES: int = 90       # How often the deal scrape + posting loop runs
    MIN_DEAL_SCORE_TO_POST: float = 15.0  # Minimum deal score required to post

    # Coupon Scraping
    COUPON_AUTO_SCRAPE: bool = True
    COUPON_SCRAPE_INTERVAL_HOURS: int = 6

    # ─── Notification Channels ────────────────────────────────────────────

    # Discord
    DISCORD_WEBHOOK_URL: str = ""

    # Telegram
    TELEGRAM_BOT_TOKEN: str = ""
    TELEGRAM_CHANNEL_ID: str = ""  # e.g. @bargainhuntrs_deals or -1001234567890

    # X.com (Twitter)
    TWITTER_API_KEY: str = ""
    TWITTER_API_SECRET: str = ""
    TWITTER_ACCESS_TOKEN: str = ""
    TWITTER_ACCESS_TOKEN_SECRET: str = ""

    # Facebook
    FACEBOOK_PAGE_ACCESS_TOKEN: str = ""
    FACEBOOK_PAGE_ID: str = ""

    # Instagram (via Meta Graph API — requires linked IG Business account)
    INSTAGRAM_BUSINESS_ACCOUNT_ID: str = ""  # IG business account ID from Graph API

    # Firebase Cloud Messaging (push notifications)
    FIREBASE_PROJECT_ID: str = ""
    FIREBASE_CLIENT_EMAIL: str = ""
    FIREBASE_PRIVATE_KEY: str = ""

    # Notification settings
    NOTIFY_MIN_PROFIT: float = 5.0  # Only notify on deals with >= $5 net profit
    NOTIFY_GLITCH_IMMEDIATE: bool = True  # Send glitch alerts immediately to all channels

    # Price Monitoring
    USER_AGENT: str = "Mozilla/5.0 (compatible; BargainHuntrs/1.0; +https://bargainhuntrs.com)"

    # Scraper settings
    SCRAPER_RATE_LIMIT_SECONDS: float = 2.0  # Delay between requests to same domain
    SCRAPER_MAX_RETRIES: int = 3
    SCRAPER_PROXY_URL: str = ""  # Optional proxy for scraping (http://user:pass@host:port)

    # Keepa API (Amazon price history)
    KEEPA_API_KEY: str = ""

    # eBay API (Browse API for sold listings)
    EBAY_CLIENT_ID: str = ""
    EBAY_CLIENT_SECRET: str = ""

    # Affiliate IDs
    AMAZON_ASSOCIATES_TAG: str = ""  # e.g. "bargainhuntrs-20"
    EBAY_PARTNER_NETWORK_ID: str = ""  # eBay Partner Network campaign ID
    WALMART_AFFILIATE_ID: str = ""  # Walmart affiliate ID
    TARGET_AFFILIATE_ID: str = ""  # Target affiliate ID
    BESTBUY_AFFILIATE_ID: str = ""  # Best Buy affiliate ID
    RAKUTEN_AFFILIATE_ID: str = ""  # Rakuten/Legacy affiliate ID

    # Impact (affiliate network for real promo codes)
    IMPACT_ACCOUNT_SID: str = ""  # Impact Account SID (username for API auth)
    IMPACT_AUTH_TOKEN: str = ""  # Impact Auth Token (password for API auth)
    IMPACT_PROGRAM_IDS: str = ""  # Comma-separated Impact program IDs to fetch coupons from

    # X (Twitter) API credentials for auto-posting deals
    X_CONSUMER_KEY: str = ""
    X_CONSUMER_SECRET: str = ""
    X_ACCESS_TOKEN: str = ""
    X_ACCESS_TOKEN_SECRET: str = ""

    # X (Twitter) API v2 — engagement automation (likes, replies, follows)
    X_BEARER_TOKEN: str = ""        # App-only bearer token for search endpoints
    # X_ACCESS_TOKEN reused above for posting replies / likes / follows (user context)
    X_USER_ID: str = ""             # Our @bargain4huntrs X user ID
    ENGAGEMENT_ENABLED: bool = False  # Off by default; enable when tokens are set
    ENGAGEMENT_MAX_LIKES: int = 15
    ENGAGEMENT_MAX_REPLIES: int = 5
    ENGAGEMENT_MAX_FOLLOWS: int = 5

    # Make.com webhook URL for X auto-posting via Buffer
    # Create a scenario: Webhook → Buffer → X
    # Set this to the webhook URL from Make.com
    MAKE_WEBHOOK_URL: str = ""

    # Buffer API for direct X posting (preferred over Make.com)
    BUFFER_API_KEY: str = ""
    BUFFER_CHANNEL_ID: str = ""        # X/Twitter
    BUFFER_IG_CHANNEL_ID: str = ""     # Instagram
    BUFFER_FB_CHANNEL_ID: str = ""     # Facebook
    BUFFER_ORG_ID: str = ""
    BUFFER_MAX_QUEUE: int = 10         # Buffer free plan limit for scheduled posts

    # Buffer daily publishing schedule (comma-separated HH:MM values)
    BUFFER_POST_TIMES: str = "09:00,13:00,17:00"
    BUFFER_POST_TIMEZONE: str = "America/New_York"
    BUFFER_POSTS_PER_WINDOW: int = 1

    # ─── Direct Social Posting (bypass Buffer) ───────────────────────
    # X/Twitter direct API v2 (free tier: 1,500 posts/month)
    # Get credentials: https://developer.x.com/en/portal/dashboard
    X_API_KEY: str = ""
    X_API_SECRET: str = ""
    X_ACCESS_TOKEN: str = ""
    X_ACCESS_TOKEN_SECRET: str = ""
    X_BEARER_TOKEN: str = ""
    # OAuth 2.0 (preferred — no need for Consumer Key/Secret)
    X_OAUTH2_ACCESS_TOKEN: str = ""
    X_OAUTH2_REFRESH_TOKEN: str = ""
    X_CLIENT_ID: str = ""
    X_DIRECT_ENABLED: str = ""  # Set to "true" to enable direct X posting (requires X API credits)

    # Reddit API (free, instant approval)
    # Get credentials: https://www.reddit.com/prefs/apps (create "script" app)
    REDDIT_CLIENT_ID: str = ""
    REDDIT_CLIENT_SECRET: str = ""
    REDDIT_USERNAME: str = ""
    REDDIT_PASSWORD: str = ""
    REDDIT_USER_AGENT: str = "bargainhuntrs/1.0"
    REDDIT_SUBREDDITS: str = "deals,buildapcsales,DealsReddit"

    # Discord webhooks (comma-separated for multiple channels)
    # Setup: Discord server → Channel Settings → Integrations → Webhooks
    DISCORD_WEBHOOK_URL: str = ""
    # Optional: Cloudflare Worker proxy URL to bypass Discord's IP ban on Render
    # Deploy the worker from cloudflare-worker/discord-proxy.js
    DISCORD_PROXY_URL: str = ""

    # Pinterest API v5 (free, instant approval)
    # Get credentials: https://developers.pinterest.com/
    PINTEREST_ACCESS_TOKEN: str = ""
    PINTEREST_BOARD_ID: str = ""
    PINTEREST_REFRESH_TOKEN: str = ""
    PINTEREST_APP_ID: str = ""
    PINTEREST_APP_SECRET: str = ""

    # Fallback image used when a deal has no/invalid image URL
    FALLBACK_IMAGE_URL: str = "https://www.bargainhuntrs.com/logos/profile-icon-dark.png"

    # Impact.com Affiliate API
    IMPACT_ACCOUNT_SID: str = ""
    IMPACT_AUTH_TOKEN: str = ""

    # Affiliate Network Credentials
    # Rakuten Advertising (https://pubhelp.rakutenadvertising.com)
    RAKUTEN_WEBSERVICES_TOKEN: str = ""
    RAKUTEN_SECURITY_TOKEN: str = ""

    # Awin (https://ui.awin.com/publisher-signup/en)
    AWIN_API_TOKEN: str = ""
    AWIN_PUBLISHER_ID: str = ""

    # CJ Affiliate (https://signup.cj.com)
    CJ_ACCESS_TOKEN: str = ""
    CJ_WEBSITE_ID: str = ""

    # Skimlinks (https://signup.skimlinks.com/en)
    SKIMLINKS_PRODUCT_KEY: str = ""
    SKIMLINKS_CLIENT_ID: str = ""
    SKIMLINKS_CLIENT_SECRET: str = ""

    # Niche categories for deal scanning
    NICHES: List[str] = [
        "electronics",
        "tools_home_improvement",
        "outdoor_garden",
        "toys_games",
        "kitchen_dining",
        "sports_fitness",
        "beauty_personal_care",
        "baby_nursery",
        "pet_supplies",
        "video_games",
    ]

    # Render sets PORT automatically; Railway vars kept for backward compat
    PORT: int = 4030
    RAILWAY_ENVIRONMENT: Optional[str] = None  # legacy, no longer used on Render
    RAILWAY_PROJECT_NAME: Optional[str] = None  # legacy, no longer used on Render
    RAILWAY_SERVICE_NAME: Optional[str] = None  # legacy, no longer used on Render
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True, extra="ignore")


settings = Settings()
