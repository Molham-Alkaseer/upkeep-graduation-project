"""add geo fields to service_requests

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-05-19

"""
from alembic import op
import sqlalchemy as sa

revision = "d4e5f6a7b8c9"
down_revision = "c3d4e5f6a7b8"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("service_requests", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("service_requests", sa.Column("longitude", sa.Float(), nullable=True))
    op.add_column("service_requests", sa.Column("location_accuracy_m", sa.Float(), nullable=True))
    op.add_column("service_requests", sa.Column("location_captured_at", sa.DateTime(), nullable=True))


def downgrade():
    op.drop_column("service_requests", "location_captured_at")
    op.drop_column("service_requests", "location_accuracy_m")
    op.drop_column("service_requests", "longitude")
    op.drop_column("service_requests", "latitude")
