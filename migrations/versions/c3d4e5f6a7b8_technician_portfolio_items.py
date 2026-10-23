"""technician portfolio gallery items

Revision ID: c3d4e5f6a7b8
Revises: b2c9e1a4f0d1
Create Date: 2026-05-06

"""
from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c9e1a4f0d1"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "technician_portfolio_items",
        sa.Column("portfolio_item_id", sa.Integer(), nullable=False),
        sa.Column("technician_id", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("caption", sa.String(length=500), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("work_date", sa.Date(), nullable=True),
        sa.Column("media_kind", sa.String(length=10), nullable=False, server_default="image"),
        sa.Column("media_path", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["technician_id"], ["users.user_id"]),
        sa.PrimaryKeyConstraint("portfolio_item_id"),
    )
    op.create_index(
        "ix_portfolio_tech_sort",
        "technician_portfolio_items",
        ["technician_id", "sort_order"],
        unique=False,
    )


def downgrade():
    op.drop_index("ix_portfolio_tech_sort", table_name="technician_portfolio_items")
    op.drop_table("technician_portfolio_items")
