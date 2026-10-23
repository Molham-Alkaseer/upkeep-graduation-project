"""add offers invoices ratings and profile fields

Revision ID: 150a3d524857
Revises: 
Create Date: 2026-04-15 14:59:03.516323

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '150a3d524857'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'offers',
        sa.Column('offer_id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('technician_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('note', sa.String(length=500), nullable=True),
        sa.Column('status', sa.Enum('pending', 'accepted', 'rejected', 'withdrawn'), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['request_id'], ['service_requests.request_id']),
        sa.ForeignKeyConstraint(['technician_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('offer_id'),
        sa.UniqueConstraint('request_id', 'technician_id', name='uq_offer_request_technician')
    )
    op.create_index('ix_offer_request_id', 'offers', ['request_id'], unique=False)
    op.create_index('ix_offer_technician_id', 'offers', ['technician_id'], unique=False)
    op.create_index('ix_offer_status', 'offers', ['status'], unique=False)

    op.create_table(
        'invoices',
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('offer_id', sa.Integer(), nullable=True),
        sa.Column('subtotal', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=False),
        sa.Column('tax_amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('total', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('invoice_number', sa.String(length=50), nullable=False),
        sa.Column('issued_at', sa.DateTime(), nullable=False),
        sa.Column('payment_status', sa.Enum('pending', 'paid', 'failed', 'refunded'), nullable=False),
        sa.ForeignKeyConstraint(['offer_id'], ['offers.offer_id']),
        sa.ForeignKeyConstraint(['request_id'], ['service_requests.request_id']),
        sa.PrimaryKeyConstraint('invoice_id'),
        sa.UniqueConstraint('invoice_number'),
        sa.UniqueConstraint('request_id')
    )
    op.create_index('ix_invoice_request_id', 'invoices', ['request_id'], unique=False)
    op.create_index('ix_invoice_offer_id', 'invoices', ['offer_id'], unique=False)
    op.create_index('ix_invoice_number', 'invoices', ['invoice_number'], unique=False)
    op.create_index('ix_invoice_payment_status', 'invoices', ['payment_status'], unique=False)

    op.create_table(
        'ratings',
        sa.Column('rating_id', sa.Integer(), nullable=False),
        sa.Column('request_id', sa.Integer(), nullable=False),
        sa.Column('technician_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('stars', sa.Integer(), nullable=False),
        sa.Column('comment', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['users.user_id']),
        sa.ForeignKeyConstraint(['request_id'], ['service_requests.request_id']),
        sa.ForeignKeyConstraint(['technician_id'], ['users.user_id']),
        sa.PrimaryKeyConstraint('rating_id'),
        sa.UniqueConstraint('request_id', name='uq_rating_request_id')
    )
    op.create_index('ix_rating_technician_id', 'ratings', ['technician_id'], unique=False)
    op.create_index('ix_rating_customer_id', 'ratings', ['customer_id'], unique=False)
    op.create_index('ix_rating_request_id', 'ratings', ['request_id'], unique=False)


def downgrade():
    op.drop_index('ix_rating_request_id', table_name='ratings')
    op.drop_index('ix_rating_customer_id', table_name='ratings')
    op.drop_index('ix_rating_technician_id', table_name='ratings')
    op.drop_table('ratings')

    op.drop_index('ix_invoice_payment_status', table_name='invoices')
    op.drop_index('ix_invoice_number', table_name='invoices')
    op.drop_index('ix_invoice_offer_id', table_name='invoices')
    op.drop_index('ix_invoice_request_id', table_name='invoices')
    op.drop_table('invoices')

    op.drop_index('ix_offer_status', table_name='offers')
    op.drop_index('ix_offer_technician_id', table_name='offers')
    op.drop_index('ix_offer_request_id', table_name='offers')
    op.drop_table('offers')
