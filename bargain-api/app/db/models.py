from sqlalchemy import Column, String, DateTime, Date, Numeric, Boolean, JSON, ForeignKey, Integer, LargeBinary, Float, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.orm import relationship
from app.db.session import Base
import uuid
from datetime import datetime


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    role = Column(String(50), default="customer")
    is_active = Column(Boolean, default=True)
    subscription_tier = Column(String(50), default="free")
    stripe_customer_id = Column(String(255))
    stripe_subscription_id = Column(String(255))
    refresh_token = Column(String(255))
    phone_number = Column(String(20))  # For SMS alerts (Hunter tier)

    # Notification preferences
    email_deal_alerts = Column(Boolean, default=True)
    sms_deal_alerts = Column(Boolean, default=False)  # Hunter only
    discord_alerts = Column(Boolean, default=False)
    telegram_alerts = Column(Boolean, default=False)
    push_notifications = Column(Boolean, default=False)
    fcm_token = Column(String(500))  # Firebase Cloud Messaging token for web push
    weekly_digest = Column(Boolean, default=True)
    glitch_alerts = Column(Boolean, default=True)

    # WebAuthn / passkey fields
    credential_id = Column(String(255))
    public_key = Column(LargeBinary)
    sign_count = Column(Integer, default=0)
    aaguid = Column(String(255))
    # Niche subscriptions — users pick which categories they want alerts for.
    # Empty/None means "all niches".
    subscribed_niches = Column(ARRAY(String), default=list)
    # Gamification: Aura points for submitting deals, getting upvotes, daily login
    aura_points = Column(Integer, default=0)
    aura_tier = Column(String(20), default="hunter")  # hunter, elite, goat
    last_login_at = Column(DateTime)  # For daily login streak tracking
    login_streak = Column(Integer, default=0)  # Consecutive days logged in
    # Seller portal
    is_verified_seller = Column(Boolean, default=False)
    seller_store_name = Column(String(255))
    seller_website = Column(String(1000))

    # Referral program
    referral_code = Column(String(20), unique=True, nullable=True, index=True)
    referred_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    referral_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="user", cascade="all, delete-orphan")
    watchlist_items = relationship("WatchlistItem", back_populates="user", cascade="all, delete-orphan")
    resale_listings = relationship("ResaleListing", back_populates="user", cascade="all, delete-orphan")
    submitted_deals = relationship(
        "UserSubmittedDeal",
        back_populates="user",
        cascade="all, delete-orphan",
        foreign_keys="UserSubmittedDeal.user_id",
    )
    referred_by_user = relationship("User", remote_side="User.id", foreign_keys=[referred_by])
    referral_claims = relationship("ReferralClaim", foreign_keys="ReferralClaim.referrer_id", back_populates="referrer", cascade="all, delete-orphan")

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.last_name]
        return " ".join(p for p in parts if p) or self.email


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    stripe_subscription_id = Column(String(255), unique=True)
    status = Column(String(50))
    tier = Column(String(50))
    current_period_end = Column(DateTime)
    cancel_at_period_end = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="subscriptions")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(String)
    source_url = Column(String(500))
    potential_profit = Column(Numeric(10, 2))
    status = Column(String(50), default="pending")
    sent_at = Column(DateTime)
    is_read = Column(Boolean, default=False)
    read_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="alerts")


class PriceSnapshot(Base):
    __tablename__ = "price_snapshots"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_id = Column(String(255), nullable=False, index=True)
    retailer = Column(String(100), nullable=False)
    price = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="USD")
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)


class WatchlistItem(Base):
    __tablename__ = "watchlist_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    item_name = Column(String(255), nullable=False)
    target_price = Column(Numeric(10, 2))
    current_price = Column(Numeric(10, 2))
    retailers = Column(JSON)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="watchlist_items")


class ResaleListing(Base):
    """A resale pricing assistant entry.

    Tracks an item a user bought (typically via an ArbitrageDeal) to flip on
    a resale platform (eBay, etc.), and periodically compares their asking
    price against competitor pricing to suggest an adjustment — the same
    idea as a marketplace "repricer," applied to arbitrage resale rather
    than an existing seller catalog.
    """
    __tablename__ = "resale_listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    source_deal_id = Column(UUID(as_uuid=True), ForeignKey("arbitrage_deals.id"), nullable=True)

    title = Column(String(500), nullable=False)
    search_query = Column(String(500))  # query used to find comps, defaults to title
    sell_platform = Column(String(50), default="ebay")

    buy_price = Column(Numeric(10, 2))  # what the user paid (for margin protection)
    our_price = Column(Numeric(10, 2), nullable=False)  # current asking price
    min_price = Column(Numeric(10, 2))  # floor — never suggest going below this

    competitor_price = Column(Numeric(10, 2))  # last-seen market/competitor price
    suggested_price = Column(Numeric(10, 2))  # our recommended new price
    suggestion_reason = Column(String(255))

    status = Column(String(20), default="active")  # active, sold, archived
    last_checked_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="resale_listings")


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    plan = Column(String(255))
    source = Column(String(255))
    message = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)


class ArbitrageDeal(Base):
    """Detected arbitrage opportunity between buy/sell platforms."""
    __tablename__ = "arbitrage_deals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asin = Column(String(100), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    image_url = Column(String(1000))
    buy_url = Column(String(1000))
    buy_platform = Column(String(50), default="amazon")
    retailer = Column(String(100), default="amazon", index=True)  # amazon, home_depot, ace_hardware, corsair, etc.
    deal_source = Column(String(20), default="online")  # online, in_store
    buy_price = Column(Numeric(10, 2), nullable=False)
    sell_platform = Column(String(50), default="ebay")
    sell_price = Column(Numeric(10, 2), nullable=False)
    historical_avg = Column(Numeric(10, 2))
    discrepancy = Column(Numeric(5, 4))  # Percentage as decimal (0.50 = 50%)
    deal_tier = Column(String(20), default="arbitrage")  # glitch, clearance, arbitrage, watch
    net_profit = Column(Numeric(10, 2))
    roi = Column(Numeric(5, 4))  # 0.25 = 25%
    total_costs = Column(Numeric(10, 2))
    platform_fee = Column(Numeric(10, 2))
    bsr = Column(Integer)
    category = Column(String(100))
    niche = Column(String(50), nullable=True, index=True)  # electronics, tools, etc.
    is_profitable = Column(Boolean, default=False)
    score = Column(Numeric(10, 4), default=0)  # Composite deal quality score
    status = Column(String(50), default="active")  # active, alerted, expired, rejected
    detected_at = Column(DateTime, default=datetime.utcnow, index=True)
    alerted_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class ScanRun(Base):
    """Track scan runs for monitoring and deduplication."""
    __tablename__ = "scan_runs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scan_type = Column(String(50), default="amazon_ebay")  # amazon_ebay, walmart_ebay, etc.
    products_scanned = Column(Integer, default=0)
    deals_found = Column(Integer, default=0)
    deals_alerted = Column(Integer, default=0)
    started_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    status = Column(String(50), default="running")  # running, completed, failed
    error = Column(String)


class CouponCode(Base):
    """Scraped coupon / promo code for a retailer."""
    __tablename__ = "coupon_codes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code = Column(String(100), nullable=False, index=True)
    retailer = Column(String(100), nullable=False, index=True)  # amazon, walmart, target, etc.
    title = Column(String(500), nullable=False)
    description = Column(String)
    discount_type = Column(String(20), default="percentage")  # percentage, fixed, free_shipping
    discount_value = Column(Numeric(10, 2), default=0)  # percentage (e.g. 20 = 20%) or dollar amount
    min_purchase = Column(Numeric(10, 2))  # minimum order amount required
    max_discount = Column(Numeric(10, 2))  # cap on discount for percentage codes
    category = Column(String(100))  # electronics, home, etc. (nullable = any)
    product_url = Column(String(1000))  # specific product URL if applicable
    source = Column(String(100), default="scraped")  # scraped, manual, api
    source_url = Column(String(1000))  # where we scraped it from
    expires_at = Column(DateTime, index=True)
    verified = Column(Boolean, default=False)
    verified_at = Column(DateTime)
    times_used = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    fail_count = Column(Integer, default=0)
    status = Column(String(20), default="active")  # active, expired, used_up, unverified, pending
    scraped_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # User-submitted coupon fields
    submitted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    submitted_at = Column(DateTime, nullable=True)


class NotificationLog(Base):
    """Track deal notifications sent to each channel."""
    __tablename__ = "notification_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("arbitrage_deals.id"), nullable=True)
    asin = Column(String(20), index=True)
    channel = Column(String(50), nullable=False)  # discord, telegram, twitter, facebook, sms, email, dashboard
    recipient = Column(String(255))  # phone number, chat id, handle, email
    message = Column(String)
    status = Column(String(20), default="pending")  # pending, sent, failed
    error = Column(String)
    sent_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)


class AffiliateClick(Base):
    """Tracks outbound clicks on affiliate links for conversion/revenue analytics."""
    __tablename__ = "affiliate_clicks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("arbitrage_deals.id"), nullable=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    retailer = Column(String(50))  # amazon, ebay, walmart, etc.
    original_url = Column(Text)
    affiliate_url = Column(Text)
    asin = Column(String(20), nullable=True, index=True)
    clicked_at = Column(DateTime, default=datetime.utcnow, index=True)
    converted = Column(Boolean, default=False)  # Updated later via affiliate API
    commission_earned = Column(Float, default=0.0)
    # Enriched click metadata (added in 024_add_affiliate_click_columns)
    user_agent = Column(Text, nullable=True)
    referrer = Column(Text, nullable=True)
    ip_hash = Column(String(64), nullable=True)  # SHA-256 of IP for privacy


class UserSubmittedDeal(Base):
    """Deal submitted by a community member (user-submitted content)."""
    __tablename__ = "user_submitted_deals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    url = Column(String(1000), nullable=False)
    image_url = Column(String(1000))
    retailer = Column(String(100), nullable=False)
    original_price = Column(Numeric(10, 2))
    sale_price = Column(Numeric(10, 2))
    discount_percent = Column(Float)  # calculated or user-provided
    category = Column(String(100))
    description = Column(Text)
    # Moderation: pending → approved/rejected
    status = Column(String(20), default="pending", index=True)  # pending, approved, rejected
    rejection_reason = Column(String(500))
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime)
    # Voting
    upvotes = Column(Integer, default=0)
    downvotes = Column(Integer, default=0)
    score = Column(Integer, default=0)  # upvotes - downvotes
    # When approved, link to the ArbitrageDeal created from it
    promoted_deal_id = Column(UUID(as_uuid=True), ForeignKey("arbitrage_deals.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    user = relationship("User", back_populates="submitted_deals", foreign_keys=[user_id])


class DealVote(Base):
    """Vote on a user-submitted deal (upvote or downvote)."""
    __tablename__ = "deal_votes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("user_submitted_deals.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    vote = Column(Integer, nullable=False)  # 1 = upvote, -1 = downvote
    created_at = Column(DateTime, default=datetime.utcnow)

    # Ensure one vote per user per deal
    __table_args__ = (
        UniqueConstraint("deal_id", "user_id", name="uq_deal_vote_user"),
    )


class VoucherWinner(Base):
    """Monthly $100 voucher draw winner, weighted by Aura points."""
    __tablename__ = "voucher_winners"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    month = Column(String(7), nullable=False, index=True)  # YYYY-MM format
    prize_amount = Column(Numeric(10, 2), default=100)
    aura_points_at_draw = Column(Integer)  # User's Aura when they won
    drawn_at = Column(DateTime, default=datetime.utcnow)
    paid_at = Column(DateTime)
    status = Column(String(20), default="pending")  # pending, paid, cancelled


class SellerSubmission(Base):
    """Coupon code or price drop submitted by a verified seller."""
    __tablename__ = "seller_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    seller_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    submission_type = Column(String(20), nullable=False)  # coupon_code, price_drop
    # Common fields
    title = Column(String(500), nullable=False)
    url = Column(String(1000), nullable=False)
    retailer = Column(String(100), nullable=False)
    image_url = Column(String(1000))
    category = Column(String(100))
    description = Column(Text)
    # Coupon-specific
    coupon_code = Column(String(100))
    discount_type = Column(String(20))  # percentage, fixed, free_shipping
    discount_value = Column(Numeric(10, 2))
    expires_at = Column(DateTime)
    # Price drop-specific
    original_price = Column(Numeric(10, 2))
    sale_price = Column(Numeric(10, 2))
    # Moderation
    status = Column(String(20), default="pending", index=True)  # pending, approved, rejected
    reviewed_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    reviewed_at = Column(DateTime)
    # When approved, link to created deal/coupon
    promoted_deal_id = Column(UUID(as_uuid=True), ForeignKey("arbitrage_deals.id"), nullable=True)
    promoted_coupon_id = Column(UUID(as_uuid=True), ForeignKey("coupon_codes.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class ReferralClaim(Base):
    """Record of a user sign-up that came through another user's referral code."""
    __tablename__ = "referral_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    referee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True, index=True)
    referral_code = Column(String(20), nullable=False)
    points_awarded = Column(Integer, default=0)
    claimed_at = Column(DateTime, default=datetime.utcnow)

    referrer = relationship("User", foreign_keys=[referrer_id], back_populates="referral_claims")
    referee = relationship("User", foreign_keys=[referee_id])


class NewsletterSubscriber(Base):
    """Email newsletter subscriber for the daily/weekly deal digest."""
    __tablename__ = "newsletter_subscribers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=True)
    subscribed_at = Column(DateTime, default=datetime.utcnow)
    unsubscribed_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    source = Column(String(255), nullable=True)


class Property(Base):
    """Distressed / off-market investment property aggregated from public sources.

    Phase 1 real-estate expansion: populated by property_aggregator from
    HUD Home Store (bank REO) and later HomePath/HomeSteps/auction feeds.
    """
    __tablename__ = "properties"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False, index=True)  # hud_homestore, homepath, ...
    source_id = Column(String(100), nullable=False)  # e.g. HUD case number
    address = Column(String(300), nullable=False)
    city = Column(String(120), index=True)
    state = Column(String(2), index=True)
    zip = Column(String(10), index=True)
    county = Column(String(120))
    address_hash = Column(String(64), index=True)  # normalized address dedup key
    list_price = Column(Numeric(12, 2))
    bedrooms = Column(Numeric(4, 1))
    bathrooms = Column(Numeric(4, 1))
    sqft = Column(Integer)
    year_built = Column(Integer)
    property_type = Column(String(100))
    status = Column(String(50))  # New Listing, Extended, Under Contract, ...
    listing_period = Column(String(50))
    fha_financing = Column(String(50))
    eligible_bidders = Column(String(150))
    list_date = Column(Date)
    bid_open_date = Column(Date)
    period_deadline = Column(Date)
    latitude = Column(Float)
    longitude = Column(Float)
    image_url = Column(String(1000))
    detail_url = Column(String(1000), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_properties_source_source_id"),
    )


class Listing(Base):
    """Generalized auction/marketplace listing aggregated from public sources.

    Covers government surplus (GSA Auctions, GovDeals, ...) now and future
    verticals (vehicles, bullion, collectibles) via the ``category`` column.
    Listings are advertisements hosted on the source platform — we link out
    to detail_url, never broker the transaction.
    """
    __tablename__ = "listings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = Column(String(50), nullable=False, index=True)  # gsa_auctions, govdeals, ...
    source_id = Column(String(120), nullable=False)  # e.g. GSA lotId or saleNumber/lotNumber
    category = Column(String(50), nullable=False, index=True)  # surplus, vehicle, bullion, ...
    title = Column(String(500), nullable=False)
    description = Column(Text)
    source_category = Column(String(150))  # category label reported by the source
    current_bid = Column(Numeric(14, 2))
    min_bid = Column(Numeric(14, 2))
    num_bids = Column(Integer)
    sale_method = Column(String(50))  # internet, sealed, live, ...
    status = Column(String(50))  # Active, Preview, Closed, ...
    start_date = Column(DateTime)
    end_date = Column(DateTime, index=True)
    city = Column(String(120), index=True)
    state = Column(String(2), index=True)
    zip = Column(String(10))
    country = Column(String(2), default="US")
    image_url = Column(String(1000))
    detail_url = Column(String(1000), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    first_seen_at = Column(DateTime, default=datetime.utcnow)
    last_seen_at = Column(DateTime, default=datetime.utcnow, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("source", "source_id", name="uq_listings_source_source_id"),
    )


class DealClaim(Base):
    """A deal the user actually bought — the haul / P&L ledger.

    Status flow: bought -> listed -> sold. ``sold_price`` is the real number;
    ``est_*`` fields are the deal's projected values at claim time, used only
    for "potential profit" display — never presented as realized.
    """
    __tablename__ = "deal_claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    deal_id = Column(UUID(as_uuid=True), ForeignKey("arbitrage_deals.id"), index=True)  # null = manual entry
    title = Column(String(500), nullable=False)
    image_url = Column(String(1000))
    buy_url = Column(String(1000))
    buy_platform = Column(String(50))
    sell_platform = Column(String(50))
    quantity = Column(Integer, default=1, nullable=False)
    buy_price = Column(Numeric(10, 2), nullable=False)  # per unit paid
    est_sell_price = Column(Numeric(10, 2))
    est_net_profit = Column(Numeric(10, 2))
    status = Column(String(20), default="bought", nullable=False, index=True)  # bought|listed|sold
    listing_url = Column(String(1000))
    sold_price = Column(Numeric(10, 2))  # per unit actually sold for
    purchased_at = Column(DateTime, default=datetime.utcnow)
    listed_at = Column(DateTime)
    sold_at = Column(DateTime)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    deal = relationship("ArbitrageDeal")


class UserListItem(Base):
    """User-curated lists: shopping, wishlist, bolo (be-on-lookout).

    For ``bolo`` items the ingestion pipeline matches new deals against the
    title keywords and sets ``matched_deal_id`` + ``matched_at`` on a hit.
    """
    __tablename__ = "user_list_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    list_type = Column(String(20), nullable=False, index=True)  # shopping|wishlist|bolo
    title = Column(String(500), nullable=False)
    url = Column(String(1000))
    target_price = Column(Numeric(10, 2))
    notes = Column(Text)
    matched_deal_id = Column(UUID(as_uuid=True), ForeignKey("arbitrage_deals.id"))
    matched_at = Column(DateTime)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    matched_deal = relationship("ArbitrageDeal")
