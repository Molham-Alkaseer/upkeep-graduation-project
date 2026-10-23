"""add optional photo/video attachment to service_requests

Revision ID: b2c9e1a4f0d1
Revises: 150a3d524857
Create Date: 2026-05-04

"""
from alembic import op
import sqlalchemy as sa

revision = "b2c9e1a4f0d1"
down_revision = "150a3d524857"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "service_requests",
        sa.Column("attachment_path", sa.String(length=255), nullable=True),
    )
    op.add_column(
        "service_requests",
        sa.Column("attachment_kind", sa.String(length=10), nullable=True),
    )


def downgrade():
    op.drop_column("service_requests", "attachment_kind")
    op.drop_column("service_requests", "attachment_path")
