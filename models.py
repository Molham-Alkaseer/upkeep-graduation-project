from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from decimal import Decimal

db = SQLAlchemy()

class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    user_id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    hashed_pw = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    full_name_ar = db.Column(db.String(100))
    full_name_en = db.Column(db.String(100))
    phone = db.Column(db.String(20), nullable=False)
    profile_image = db.Column(db.String(255))
    city = db.Column(db.String(100))
    district = db.Column(db.String(100))
    bio = db.Column(db.String(500))
    role = db.Column(db.Enum('customer', 'technician', 'admin'), nullable=False)
    specialization_id = db.Column(db.Integer, db.ForeignKey('specializations.spec_id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    specialization = db.relationship('Specialization', backref='technicians')
    requests_as_customer = db.relationship('ServiceRequest', backref='customer', foreign_keys='ServiceRequest.customer_id')
    requests_as_technician = db.relationship('ServiceRequest', backref='technician', foreign_keys='ServiceRequest.technician_id')
    submitted_offers = db.relationship('Offer', backref='technician', foreign_keys='Offer.technician_id')
    received_ratings = db.relationship('Rating', backref='technician', foreign_keys='Rating.technician_id')
    
    def get_id(self):
        return str(self.user_id)

class Specialization(db.Model):
    __tablename__ = 'specializations'
    
    spec_id = db.Column(db.Integer, primary_key=True)
    name_ar = db.Column(db.String(50), nullable=False)
    name_en = db.Column(db.String(50), nullable=False)
    
    def __str__(self):
        return f"{self.name_ar} / {self.name_en}"

class ServiceRequest(db.Model):
    __tablename__ = 'service_requests'
    
    request_id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    technician_id = db.Column(db.Integer, db.ForeignKey('users.user_id'))
    service_type = db.Column(db.Integer, db.ForeignKey('specializations.spec_id'), nullable=False)
    description = db.Column(db.Text, nullable=False)
    # Location & scheduling details
    city = db.Column(db.String(100))
    district = db.Column(db.String(100))
    address = db.Column(db.String(255))
    latitude = db.Column(db.Float)
    longitude = db.Column(db.Float)
    location_accuracy_m = db.Column(db.Float)
    location_captured_at = db.Column(db.DateTime)
    preferred_date = db.Column(db.Date)
    preferred_time = db.Column(db.Enum('morning', 'afternoon', 'evening'))
    notes = db.Column(db.Text)
    # Optional customer media (stored under static/, same pattern as profile_image)
    attachment_path = db.Column(db.String(255))
    attachment_kind = db.Column(db.String(10))  # 'image' | 'video'
    status = db.Column(db.Enum('pending', 'assigned', 'in_progress', 'completed', 'cancelled'), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    payment_status = db.Column(db.Enum('pending', 'processing', 'completed', 'refunded'), default='pending')
    
    # Relationships
    service = db.relationship('Specialization', backref='requests')
    payments = db.relationship('Payment', backref='request', lazy='dynamic')
    timeline_entries = db.relationship(
        'RequestTimeline',
        backref='request',
        lazy='dynamic',
        order_by='RequestTimeline.created_at.asc()'
    )
    offers = db.relationship(
        'Offer',
        backref='request',
        lazy='dynamic',
        order_by='Offer.created_at.desc()'
    )
    invoice = db.relationship('Invoice', backref='request', uselist=False)
    rating = db.relationship('Rating', backref='request', uselist=False)

class Payment(db.Model):
    __tablename__ = 'payments'
    
    payment_id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('service_requests.request_id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    method = db.Column(db.Enum('credit_card', 'debit_card', 'bank_transfer'), nullable=False)
    transaction_id = db.Column(db.String(100), nullable=False)
    status = db.Column(db.Enum('pending', 'processing', 'completed', 'failed', 'refunded'), default='pending')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    log_id = db.Column(db.Integer, primary_key=True)
    admin_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    action = db.Column(db.String(255), nullable=False)
    target_type = db.Column(db.String(50))
    target_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    admin = db.relationship('User', backref='audit_logs')

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} by {self.admin_id} on {self.target_type}:{self.target_id}>" 


class RequestTimeline(db.Model):
    __tablename__ = 'request_timeline'

    timeline_id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('service_requests.request_id'), nullable=False)
    status = db.Column(db.String(50), nullable=False)
    note = db.Column(db.String(255))
    actor_id = db.Column(db.Integer, db.ForeignKey('users.user_id'))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    actor = db.relationship('User', backref='timeline_actions')


class Offer(db.Model):
    __tablename__ = 'offers'

    offer_id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('service_requests.request_id'), nullable=False)
    technician_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    tax_rate = db.Column(db.Numeric(5, 2), nullable=False, default=Decimal('5.00'))
    tax_amount = db.Column(db.Numeric(10, 2), nullable=False, default=Decimal('0.00'))
    total_amount = db.Column(db.Numeric(10, 2), nullable=False, default=Decimal('0.00'))
    note = db.Column(db.String(500))
    status = db.Column(db.Enum('pending', 'accepted', 'rejected', 'withdrawn'), default='pending', nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        db.UniqueConstraint('request_id', 'technician_id', name='uq_offer_request_technician'),
        db.Index('ix_offer_request_id', 'request_id'),
        db.Index('ix_offer_technician_id', 'technician_id'),
        db.Index('ix_offer_status', 'status'),
    )


class Invoice(db.Model):
    __tablename__ = 'invoices'

    invoice_id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('service_requests.request_id'), nullable=False, unique=True)
    offer_id = db.Column(db.Integer, db.ForeignKey('offers.offer_id'))
    subtotal = db.Column(db.Numeric(10, 2), nullable=False)
    tax_rate = db.Column(db.Numeric(5, 2), nullable=False, default=Decimal('5.00'))
    tax_amount = db.Column(db.Numeric(10, 2), nullable=False)
    total = db.Column(db.Numeric(10, 2), nullable=False)
    invoice_number = db.Column(db.String(50), nullable=False, unique=True)
    issued_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    payment_status = db.Column(
        db.Enum('pending', 'paid', 'failed', 'refunded'),
        default='pending',
        nullable=False
    )

    offer = db.relationship('Offer', backref='invoice', uselist=False)

    __table_args__ = (
        db.Index('ix_invoice_request_id', 'request_id'),
        db.Index('ix_invoice_offer_id', 'offer_id'),
        db.Index('ix_invoice_number', 'invoice_number'),
        db.Index('ix_invoice_payment_status', 'payment_status'),
    )


class Rating(db.Model):
    __tablename__ = 'ratings'

    rating_id = db.Column(db.Integer, primary_key=True)
    request_id = db.Column(db.Integer, db.ForeignKey('service_requests.request_id'), nullable=False, unique=True)
    technician_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    stars = db.Column(db.Integer, nullable=False)
    comment = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    customer = db.relationship('User', foreign_keys=[customer_id], backref='submitted_ratings')

    __table_args__ = (
        db.UniqueConstraint('request_id', name='uq_rating_request_id'),
        db.Index('ix_rating_technician_id', 'technician_id'),
        db.Index('ix_rating_customer_id', 'customer_id'),
        db.Index('ix_rating_request_id', 'request_id'),
    )


class TechnicianPortfolioItem(db.Model):
    """Public gallery items for technician profiles (images in Phase 1)."""

    __tablename__ = "technician_portfolio_items"

    portfolio_item_id = db.Column(db.Integer, primary_key=True)
    technician_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False, index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    caption = db.Column(db.String(500), nullable=False)
    category = db.Column(db.String(80), nullable=True)
    work_date = db.Column(db.Date, nullable=True)
    media_kind = db.Column(db.String(10), nullable=False, default="image")
    media_path = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    technician = db.relationship("User", backref=db.backref("portfolio_items", lazy="dynamic"))

    __table_args__ = (
        db.Index("ix_portfolio_tech_sort", "technician_id", "sort_order"),
    )


# Backward-compatible aliases for existing imports/routes.
TechnicianOffer = Offer
TechnicianRating = Rating