"""Seller showcase — is_demo flag + seeded demo submissions.

Adds is_demo to seller_submissions so the seller portal can render a
demo-gated showcase before any real seller content exists, then seeds a
BargainHuntrs Showcase seller + a handful of approved demo submissions.
Idempotent: the demo block only runs when no is_demo rows exist.

Revision ID: 038
Revises: 037
Create Date: 2026-11-22
"""
import sqlalchemy as sa
from alembic import op

revision = "038"
down_revision = "037"
branch_labels = None
depends_on = None

DEMO_SELLER_EMAIL = "showcase@bargainhuntrs.com"


def upgrade():
    op.add_column(
        "seller_submissions",
        sa.Column("is_demo", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_seller_submissions_is_demo", "seller_submissions", ["is_demo"])

    # Demo seller — unusable password hash (never matches a real login).
    op.execute(
        f"""
        INSERT INTO users (id, email, hashed_password, role, is_active,
                           email_verified, is_verified_seller, seller_store_name,
                           seller_website, created_at, updated_at)
        SELECT gen_random_uuid(), '{DEMO_SELLER_EMAIL}',
               '$2b$12$showcasedemohash00000000000000000000000000000000000000',
               'customer', true, true, true,
               'BargainHuntrs Showcase', 'https://bargainhuntrs.com',
               now(), now()
        WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = '{DEMO_SELLER_EMAIL}')
        """
    )

    # Demo submissions — approved + is_demo so GET /seller/showcase returns
    # them. Only seeds when the flag has no demo rows yet (re-run safe).
    op.execute(
        f"""
        INSERT INTO seller_submissions
            (id, seller_id, submission_type, title, url, retailer, category,
             description, coupon_code, discount_type, discount_value,
             original_price, sale_price, status, is_demo, created_at)
        SELECT gen_random_uuid(), u.id, v.*, 'approved', true, now() FROM (
            VALUES
                ('coupon_code', 'Extra 20% off Kitchen & Dining (demo)',
                 'https://bargainhuntrs.com/deals', 'Target', 'kitchen',
                 'Demo showcase listing — illustrates how verified-seller coupons appear in the feed.',
                 'DEMO20', 'percentage', 20.0, NULL, NULL),
                ('coupon_code', 'Free shipping sitewide over $35 (demo)',
                 'https://bargainhuntrs.com/deals', 'Walmart', 'general',
                 'Demo showcase listing — sample free-shipping seller submission.',
                 'DEMOSHIP', 'free_shipping', 0.0, NULL, NULL),
                ('price_drop', 'Robot vacuum 40% price drop (demo)',
                 'https://bargainhuntrs.com/deals', 'Amazon', 'electronics',
                 'Demo showcase listing — sample seller-reported price drop with markdown math.',
                 NULL, NULL, NULL, 299.99, 179.99),
                ('price_drop', 'Winter jacket clearance markdown (demo)',
                 'https://bargainhuntrs.com/deals', 'Target', 'apparel',
                 'Demo showcase listing — clearance price-drop card.',
                 NULL, NULL, NULL, 89.99, 44.99),
                ('coupon_code', '15% off first-order welcome code (demo)',
                 'https://bargainhuntrs.com/deals', 'Best Buy', 'electronics',
                 'Demo showcase listing — welcome-code style submission.',
                 'WELCOME15', 'percentage', 15.0, NULL, NULL)
        ) AS v(submission_type, title, url, retailer, category, description,
               coupon_code, discount_type, discount_value,
               original_price, sale_price),
        (SELECT id FROM users WHERE email = '{DEMO_SELLER_EMAIL}' LIMIT 1) AS u
        WHERE NOT EXISTS (SELECT 1 FROM seller_submissions WHERE is_demo = true)
        """
    )


def downgrade():
    op.execute("DELETE FROM seller_submissions WHERE is_demo = true")
    op.execute(f"DELETE FROM users WHERE email = '{DEMO_SELLER_EMAIL}'")
    op.drop_index("ix_seller_submissions_is_demo", table_name="seller_submissions")
    op.drop_column("seller_submissions", "is_demo")
