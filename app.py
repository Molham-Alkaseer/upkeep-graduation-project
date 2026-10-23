import typing
import sqlalchemy.sql.elements
from typing import Any, Dict, Optional
from decimal import Decimal

if typing.TYPE_CHECKING:
    sqlalchemy.sql.elements.SQLCoreOperations.__static_attributes__ = []
    sqlalchemy.sql.elements.SQLCoreOperations.__firstlineno__ = 0

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, send_from_directory, abort
from flask_cors import CORS
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime
import os
from dotenv import load_dotenv
from models import (
    db,
    User,
    Specialization,
    ServiceRequest,
    Payment,
    TechnicianOffer,
    Invoice,
    TechnicianRating,
    RequestTimeline,
    TechnicianPortfolioItem,
)
import json
import uuid
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from admin_routes import admin_bp
from api_v1 import api_v1_bp
from portfolio_constants import portfolio_limits_dict
from portfolio_service import (
    create_portfolio_item,
    delete_portfolio_item,
    move_portfolio_item,
)
from service_request_actions import (
    build_track_status_payload,
    coerce_int as _coerce_int,
    customer_choose_offer,
    customer_create_request,
    customer_pay_request,
    customer_submit_rating,
    technician_accept_request,
    technician_complete_request,
    technician_submit_offer,
    timeline_table_exists,
)
from web_i18n import init_web_i18n

# Load environment variables
load_dotenv()

import importlib.util
import sys

if importlib.util.find_spec("cryptography") is None:
    raise RuntimeError(
        "Install `cryptography` in the Python environment that runs this app (MySQL 8 auth). "
        f"Example: .\\venv\\Scripts\\pip install cryptography — current interpreter: {sys.executable}"
    )

# Allow overriding the DB name & credentials from .env
DB_USER = os.getenv('DB_USER', 'root')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_NAME = os.getenv('DB_NAME', 'upkeep_db')

# Configuration constants
def _read_jwt_expiration_days() -> int:
    raw = os.getenv('JWT_EXPIRATION_DAYS', '7')
    try:
        days = int(raw)
    except ValueError:
        days = 7
    return max(1, min(days, 365))


CONFIG = {
    'SQLALCHEMY_DATABASE_URI': f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}",
    'SQLALCHEMY_TRACK_MODIFICATIONS': False,
    'SECRET_KEY': os.getenv('SECRET_KEY', 'change-me-please'),
    'JWT_EXPIRATION_DAYS': _read_jwt_expiration_days(),
    'FLASK_DEBUG': os.getenv('FLASK_DEBUG', 'True').lower() in {'true', '1', 'yes'}
}

PROFILE_UPLOAD_DIR = os.path.join('static', 'uploads', 'profiles')
ALLOWED_PROFILE_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024

app = Flask(__name__)
app.config.from_mapping(CONFIG)

# CORS for /api/* — used by Expo web and browser devtools; harmless for native Expo (fetch has no Origin).
# Disable with FLASK_ENABLE_CORS=false if you lock down the server.
if os.getenv("FLASK_ENABLE_CORS", "true").lower() not in {"0", "false", "no"}:
    CORS(
        app,
        resources={
            r"/api/*": {
                "origins": "*",
                "allow_headers": ["Content-Type", "Authorization", "Accept"],
                "methods": ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
            }
        },
    )

# Initialize extensions
db.init_app(app)
migrate = Migrate(app, db)

login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'

_I18N_CONSTANTS: Optional[Dict[str, Any]] = None


def _load_i18n_constants() -> Dict[str, Any]:
    path = os.path.join(app.root_path, 'locales', 'i18n.constants.json')
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def get_i18n_constants() -> Dict[str, Any]:
    global _I18N_CONSTANTS
    if _I18N_CONSTANTS is None:
        _I18N_CONSTANTS = _load_i18n_constants()
    return _I18N_CONSTANTS


# Public health check (registered on the app so it is always present alongside api_v1_bp).
@app.route('/api/v1/health', methods=['GET', 'HEAD'], strict_slashes=False)
def api_v1_health():
    return jsonify(status='ok')

app.register_blueprint(admin_bp)
app.register_blueprint(api_v1_bp)


@app.route('/locales/<lang>/common.json')
def serve_locale_common(lang: str):
    if lang not in ('en', 'ar'):
        abort(404)
    return send_from_directory(
        os.path.join(app.root_path, 'locales', lang),
        'common.json',
        mimetype='application/json',
    )


@app.route('/locales/i18n.constants.json')
def serve_i18n_constants_json():
    return jsonify(get_i18n_constants())


@app.route('/favicon.ico')
def favicon():
    """Browsers request /favicon.ico by default; serve SVG icon to avoid 404 noise in console."""
    return send_from_directory(
        os.path.join(app.root_path, 'static'),
        'favicon.svg',
        mimetype='image/svg+xml',
    )


@app.route('/debug/whoami')
@login_required
def debug_whoami():
    """Quick JSON check while logged in (role, specialization, id). Open in browser as technician/customer."""
    return jsonify(
        {
            'user_id': current_user.user_id,
            'email': current_user.email,
            'role': current_user.role,
            'specialization_id': current_user.specialization_id,
        }
    )


# Make current UTC time available in every template as `now`
@app.context_processor
def inject_now():
    from datetime import datetime, timezone
    return {'now': datetime.now(timezone.utc)}


@app.context_processor
def inject_i18n_constants():
    return {'i18n_constants': get_i18n_constants()}


init_web_i18n(app, get_i18n_constants)

# Helper functions
def handle_database_error(e: SQLAlchemyError) -> None:
    """Handle database errors consistently"""
    db.session.rollback()
    app.logger.error(f"Database error: {str(e)}")
    flash('حدث خطأ في قاعدة البيانات', 'danger')

def validate_email(email: str) -> bool:
    """Basic email validation"""
    import re
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(pattern, email) is not None

def validate_phone(phone: str) -> bool:
    """Basic phone validation for Syrian numbers"""
    import re
    # Remove spaces and dashes
    phone = re.sub(r'[\s\-]', '', phone)
    # Syrian mobile numbers – allow formats: 09xxxxxxxx, 9xxxxxxxx, 9639xxxxxxxx, +9639xxxxxxxx
    pattern = r'^(?:09|9|9639|\+9639)\d{8}$'
    return re.match(pattern, phone) is not None

def validate_password(password: str) -> tuple[bool, str]:
    """Password validation with feedback"""
    if len(password) < 8:
        return False, "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
    if not any(c.isupper() for c in password):
        return False, "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل"
    if not any(c.islower() for c in password):
        return False, "كلمة المرور يجب أن تحتوي على حرف صغير واحد على الأقل"
    if not any(c.isdigit() for c in password):
        return False, "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل"
    return True, "كلمة المرور صحيحة"

def sanitize_input(text: str) -> str:
    """Sanitize user input"""
    if not text:
        return ""
    return text.strip()


def split_full_name(full_name: str) -> tuple[str, str]:
    parts = [segment.strip() for segment in (full_name or '').split('/', 1)]
    if len(parts) == 2:
        return parts[0], parts[1]
    return full_name.strip(), full_name.strip()


def get_user_name_parts(user: User) -> tuple[str, str]:
    if user.full_name_ar and user.full_name_en:
        return user.full_name_ar.strip(), user.full_name_en.strip()
    return split_full_name(user.full_name or '')


def allowed_profile_image(filename: str) -> bool:
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_PROFILE_IMAGE_EXTENSIONS


# User loader
@login_manager.user_loader
def load_user(user_id: str) -> Optional[User]:
    return User.query.get(int(user_id))

# Routes (unchanged main functions but with improved error handling)
@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'POST':
        try:
            # Sanitize and validate inputs
            full_name_ar = sanitize_input(request.form.get('fullNameAr', ''))
            full_name_en = sanitize_input(request.form.get('fullNameEn', ''))
            email = sanitize_input(request.form.get('email', ''))
            password = request.form.get('password', '')
            phone = sanitize_input(request.form.get('phone', ''))
            user_type = request.form.get('userType')
            specialization_id = request.form.get('specialization') if user_type == 'technician' else None
            
            # Validation
            if not full_name_ar or not full_name_en:
                flash('يرجى إدخال الاسم الكامل باللغتين', 'danger')
                return redirect(url_for('signup'))
            
            if not validate_email(email):
                flash('يرجى إدخال بريد إلكتروني صحيح', 'danger')
                return redirect(url_for('signup'))
            
            if not validate_phone(phone):
                flash('يرجى إدخال رقم هاتف صحيح', 'danger')
                return redirect(url_for('signup'))
            
            is_valid_pw, pw_message = validate_password(password)
            if not is_valid_pw:
                flash(pw_message, 'danger')
                return redirect(url_for('signup'))
            
            if user_type not in ['customer', 'technician']:
                flash('يرجى اختيار نوع المستخدم', 'danger')
                return redirect(url_for('signup'))
            
            if user_type == 'technician' and not specialization_id:
                flash('يرجى اختيار التخصص', 'danger')
                return redirect(url_for('signup'))
            
            if User.query.filter_by(email=email).first():
                flash('البريد الإلكتروني مستخدم بالفعل', 'danger')
                return redirect(url_for('signup'))
            
            # Check if specialization exists for technicians
            if user_type == 'technician':
                spec = Specialization.query.get(specialization_id)
                if not spec:
                    flash('التخصص المختار غير موجود', 'danger')
                    return redirect(url_for('signup'))
            
            user = User(
                email=email,
                hashed_pw=generate_password_hash(password),
                full_name=f"{full_name_ar} / {full_name_en}",
                full_name_ar=full_name_ar,
                full_name_en=full_name_en,
                phone=phone,
                role=user_type,
                specialization_id=specialization_id
            )
            
            db.session.add(user)
            db.session.commit()
            
            login_user(user)
            flash('تم إنشاء الحساب بنجاح!', 'success')
            return redirect(url_for('profile'))
            
        except SQLAlchemyError as e:
            handle_database_error(e)
            return redirect(url_for('signup'))
        except Exception as e:
            app.logger.error(f"Unexpected error in signup: {str(e)}")
            flash('حدث خطأ غير متوقع', 'danger')
            return redirect(url_for('signup'))
    
    specializations = Specialization.query.all()
    return render_template('signup.html', specializations=specializations)

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        email = sanitize_input(request.form.get('email', ''))
        password = request.form.get('password', '')
        
        # Validation
        if not email:
            flash('يرجى إدخال البريد الإلكتروني', 'danger')
            return render_template('login.html')
        
        if not password:
            flash('يرجى إدخال كلمة المرور', 'danger')
            return render_template('login.html')
        
        if not validate_email(email):
            flash('يرجى إدخال بريد إلكتروني صحيح', 'danger')
            return render_template('login.html')
        
        user = User.query.filter_by(email=email).first()

        try:
            valid_login = user and check_password_hash(user.hashed_pw, password)  # type: ignore[arg-type]
        except ValueError:
            # Legacy bcrypt or malformed hash stored – treat as invalid creds
            valid_login = False

        if valid_login:
            login_user(user)  # type: ignore[arg-type]
            flash(f'مرحباً بك {user.full_name}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('البريد الإلكتروني أو كلمة المرور غير صحيحة', 'danger')
            
    return render_template('login.html')

@app.route('/logout')
@login_required
def logout():
    """Log the current user out and redirect to the login page."""
    logout_user()
    flash('تم تسجيل الخروج بنجاح', 'success')
    return redirect(url_for('login'))

@app.route('/')
@app.route('/dashboard')
@login_required
def dashboard():
    """Customer dashboard (default).
    Technicians will be redirected to the technician dashboard."""
    # Redirect technicians and admins to their dedicated dashboards
    if current_user.role == 'technician':
        return redirect(url_for('tech_dashboard'))
    if current_user.role == 'admin':
        return redirect(url_for('admin.dashboard'))

    # Customer dashboard
    requests = ServiceRequest.query.filter_by(customer_id=current_user.user_id).order_by(ServiceRequest.created_at.desc()).all()
    pending_offer_counts = {}
    for item in requests:
        pending_offer_counts[item.request_id] = item.offers.filter_by(status='pending').count()
    return render_template('customer_dashboard.html', requests=requests, pending_offer_counts=pending_offer_counts)

@app.route('/tech')
@app.route('/tech/<status>')
@login_required
def tech_dashboard(status: Optional[str] = None):
    if current_user.role != 'technician':
        flash('ليس لديك صلاحية الوصول', 'danger')
        return redirect(url_for('dashboard'))

    query = ServiceRequest.query
    # Technician sees:
    # 1) pending requests that match their specialization (offer stage),
    # 2) requests assigned to them (execution stage).
    query = query.filter(
        ((ServiceRequest.status == 'pending') & (ServiceRequest.service_type == current_user.specialization_id)) |
        (ServiceRequest.technician_id == current_user.user_id)
    )

    if status:
        query = query.filter_by(status=status)

    requests = query.order_by(ServiceRequest.created_at.desc()).all()

    from api_service_requests import filter_technician_requests_by_geo
    from geo_utils import parse_list_geo_query

    request_distances: dict[int, float] = {}
    geo_active = False
    tech_lat: float | None = None
    tech_lng: float | None = None
    radius_km = 50.0
    geo_query_args = dict(request.args)
    tech_point, radius_km, _sort_by_distance, geo_err = parse_list_geo_query(geo_query_args)
    if geo_err:
        flash(geo_err, 'danger')
    elif tech_point is not None:
        tech_lat, tech_lng = tech_point
        requests, request_distances = filter_technician_requests_by_geo(
            requests,
            current_user,
            tech_lat,
            tech_lng,
            radius_km,
            sort_by_distance=True,
        )
        geo_active = True

    my_offer_ids = {
        offer.request_id
        for offer in TechnicianOffer.query.filter_by(technician_id=current_user.user_id).all()
    }

    paid_invoices_count = db.session.query(func.count(Invoice.invoice_id)).join(
        ServiceRequest, Invoice.request_id == ServiceRequest.request_id
    ).filter(
        ServiceRequest.technician_id == current_user.user_id,
        Invoice.payment_status == 'paid'
    ).scalar() or 0
    total_revenue = db.session.query(func.coalesce(func.sum(Invoice.total), 0)).join(
        ServiceRequest, Invoice.request_id == ServiceRequest.request_id
    ).filter(
        ServiceRequest.technician_id == current_user.user_id,
        Invoice.payment_status == 'paid'
    ).scalar() or 0
    avg_job_value = db.session.query(func.coalesce(func.avg(Invoice.total), 0)).join(
        ServiceRequest, Invoice.request_id == ServiceRequest.request_id
    ).filter(
        ServiceRequest.technician_id == current_user.user_id,
        Invoice.payment_status == 'paid'
    ).scalar() or 0
    monthly_revenue = db.session.query(func.coalesce(func.sum(Invoice.total), 0)).join(
        ServiceRequest, Invoice.request_id == ServiceRequest.request_id
    ).filter(
        ServiceRequest.technician_id == current_user.user_id,
        Invoice.payment_status == 'paid',
        func.year(Invoice.issued_at) == datetime.utcnow().year,
        func.month(Invoice.issued_at) == datetime.utcnow().month
    ).scalar() or 0
    avg_rating = db.session.query(func.avg(TechnicianRating.stars)).filter_by(
        technician_id=current_user.user_id
    ).scalar()
    ratings_count = TechnicianRating.query.filter_by(technician_id=current_user.user_id).count()
    monthly_rows = db.session.query(
        func.date_format(Invoice.issued_at, '%Y-%m').label('month_key'),
        func.coalesce(func.sum(Invoice.total), 0).label('monthly_total')
    ).join(
        ServiceRequest, Invoice.request_id == ServiceRequest.request_id
    ).filter(
        ServiceRequest.technician_id == current_user.user_id,
        Invoice.payment_status == 'paid'
    ).group_by(
        func.date_format(Invoice.issued_at, '%Y-%m')
    ).order_by(
        func.date_format(Invoice.issued_at, '%Y-%m').desc()
    ).limit(6).all()
    monthly_rows = list(reversed(monthly_rows))
    monthly_labels = [row.month_key for row in monthly_rows]
    monthly_values = [float(row.monthly_total or 0) for row in monthly_rows]

    return render_template(
        'tech_dashboard.html',
        requests=requests,
        my_offer_ids=my_offer_ids,
        paid_invoices_count=int(paid_invoices_count),
        avg_job_value=Decimal(str(avg_job_value)),
        monthly_revenue=Decimal(str(monthly_revenue)),
        total_revenue=Decimal(str(total_revenue)),
        avg_rating=round(float(avg_rating), 2) if avg_rating is not None else None,
        ratings_count=int(ratings_count),
        monthly_labels=monthly_labels,
        monthly_values=monthly_values,
        geo_active=geo_active,
        request_distances=request_distances,
        tech_lat=tech_lat,
        tech_lng=tech_lng,
        radius_km=radius_km,
        status_filter=status,
    )

@app.route('/profile')
@login_required
def profile():
    specializations = Specialization.query.all()
    avg_rating = None
    ratings_count = 0
    total_revenue = Decimal('0.00')
    completed_jobs_count = 0
    name_ar, name_en = get_user_name_parts(current_user)
    if current_user.role == 'technician':
        rating_value = db.session.query(func.avg(TechnicianRating.stars)).filter_by(
            technician_id=current_user.user_id
        ).scalar()
        ratings_count = TechnicianRating.query.filter_by(technician_id=current_user.user_id).count()
        avg_rating = round(float(rating_value), 2) if rating_value is not None else None
        revenue_value = db.session.query(func.coalesce(func.sum(Invoice.total), 0)).join(
            ServiceRequest, Invoice.request_id == ServiceRequest.request_id
        ).filter(
            ServiceRequest.technician_id == current_user.user_id,
            Invoice.payment_status == 'paid'
        ).scalar() or 0
        total_revenue = Decimal(str(revenue_value))
        completed_jobs_count = ServiceRequest.query.filter_by(
            technician_id=current_user.user_id,
            status='completed'
        ).count()
    portfolio_rows = []
    if current_user.role == 'technician':
        portfolio_rows = (
            TechnicianPortfolioItem.query.filter_by(technician_id=current_user.user_id)
            .order_by(
                TechnicianPortfolioItem.sort_order.asc(),
                TechnicianPortfolioItem.portfolio_item_id.asc(),
            )
            .all()
        )
    return render_template(
        'profile.html',
        user=current_user,
        specializations=specializations,
        name_ar=name_ar,
        name_en=name_en,
        avg_rating=avg_rating,
        ratings_count=ratings_count,
        total_revenue=total_revenue,
        completed_jobs_count=completed_jobs_count,
        portfolio_rows=portfolio_rows,
        portfolio_limits=portfolio_limits_dict(),
    )


@app.route('/profile/portfolio/add', methods=['POST'])
@login_required
def profile_portfolio_add():
    if current_user.role != 'technician':
        flash('غير مصرح', 'danger')
        return redirect(url_for('profile'))
    up = request.files.get('image') or request.files.get('file')
    body, _code = create_portfolio_item(
        current_user,
        up,
        request.form.get('caption'),
        request.form.get('category'),
        request.form.get('work_date'),
    )
    if body.get('success'):
        flash('تمت إضافة صورة للمعرض', 'success')
    else:
        flash(body.get('message') or 'تعذرت الإضافة', 'danger')
    return redirect(url_for('profile'))


@app.route('/profile/portfolio/<int:item_id>/delete', methods=['POST'])
@login_required
def profile_portfolio_delete(item_id: int):
    if current_user.role != 'technician':
        flash('غير مصرح', 'danger')
        return redirect(url_for('profile'))
    body, _code = delete_portfolio_item(current_user, item_id)
    if body.get('success'):
        flash('تم حذف عنصر المعرض', 'success')
    else:
        flash(body.get('message') or 'تعذر الحذف', 'danger')
    return redirect(url_for('profile'))


@app.route('/profile/portfolio/<int:item_id>/move/<direction>', methods=['POST'])
@login_required
def profile_portfolio_move(item_id: int, direction: str):
    if current_user.role != 'technician':
        flash('غير مصرح', 'danger')
        return redirect(url_for('profile'))
    body, _code = move_portfolio_item(current_user, item_id, direction)
    if not body.get('success'):
        flash(body.get('message') or 'تعذر تغيير الترتيب', 'danger')
    return redirect(url_for('profile'))

@app.route('/update_profile', methods=['POST'])
@login_required
def update_profile():
    try:
        # Sanitize inputs
        full_name_ar = sanitize_input(request.form.get('full_name_ar', ''))
        full_name_en = sanitize_input(request.form.get('full_name_en', ''))
        phone = sanitize_input(request.form.get('phone', ''))
        city = sanitize_input(request.form.get('city', ''))
        district = sanitize_input(request.form.get('district', ''))
        bio = sanitize_input(request.form.get('bio', ''))
        specialization = request.form.get('specialization')
        current_pw = request.form.get('current_password')
        new_pw = request.form.get('new_password')
        confirm_pw = request.form.get('confirm_password')
        profile_image = request.files.get('profile_image')
        
        # Validation
        if not full_name_ar or not full_name_en:
            flash('يرجى إدخال الاسم الكامل باللغتين', 'danger')
            return redirect(url_for('profile'))
        
        if not validate_phone(phone):
            flash('يرجى إدخال رقم هاتف صحيح', 'danger')
            return redirect(url_for('profile'))
        
        # Technician specialization validation
        if current_user.role == 'technician':
            if not specialization:
                flash('يرجى اختيار التخصص', 'danger')
                return redirect(url_for('profile'))
            
            spec = Specialization.query.get(specialization)
            if not spec:
                flash('التخصص المختار غير موجود', 'danger')
                return redirect(url_for('profile'))
        
        # Update basic info
        # Keep backward-compatible combined full_name while storing split fields cleanly.
        current_user.full_name = f"{full_name_ar} / {full_name_en}"
        current_user.full_name_ar = full_name_ar
        current_user.full_name_en = full_name_en
        current_user.phone = phone
        current_user.city = city or None
        current_user.district = district or None
        current_user.bio = bio or None

        # Technician specialization
        if current_user.role == 'technician':
            current_user.specialization_id = specialization

        # Handle password change with user-friendly validation flow
        if new_pw or confirm_pw or current_pw:
            if not new_pw:
                flash('يرجى إدخال كلمة المرور الجديدة', 'danger')
                return redirect(url_for('profile'))
            if not confirm_pw:
                flash('يرجى تأكيد كلمة المرور الجديدة', 'danger')
                return redirect(url_for('profile'))
            if not current_pw:
                flash('يرجى إدخال كلمة المرور الحالية', 'danger')
                return redirect(url_for('profile'))
            
            if not check_password_hash(current_user.hashed_pw, current_pw):
                flash('كلمة المرور الحالية غير صحيحة', 'danger')
                return redirect(url_for('profile'))
            
            is_valid_pw, pw_message = validate_password(new_pw)
            if not is_valid_pw:
                flash(pw_message, 'danger')
                return redirect(url_for('profile'))
            
            if new_pw != confirm_pw:
                flash('كلمة المرور الجديدة غير متطابقة', 'danger')
                return redirect(url_for('profile'))
            if current_pw == new_pw:
                flash('كلمة المرور الجديدة يجب أن تكون مختلفة عن الحالية', 'danger')
                return redirect(url_for('profile'))
            current_user.hashed_pw = generate_password_hash(new_pw)

        # Optional local profile image upload
        if profile_image and profile_image.filename:
            if not allowed_profile_image(profile_image.filename):
                flash('صيغة الصورة غير مدعومة. الصيغ المسموحة: PNG, JPG, JPEG, WEBP', 'danger')
                return redirect(url_for('profile'))
            profile_image.stream.seek(0, os.SEEK_END)
            file_size = profile_image.stream.tell()
            profile_image.stream.seek(0)
            if file_size > MAX_PROFILE_IMAGE_BYTES:
                flash('حجم الصورة كبير جداً (الحد الأقصى 2MB)', 'danger')
                return redirect(url_for('profile'))

            os.makedirs(PROFILE_UPLOAD_DIR, exist_ok=True)
            extension = profile_image.filename.rsplit('.', 1)[1].lower()
            stored_name = secure_filename(f"user_{current_user.user_id}_{uuid.uuid4().hex[:10]}.{extension}")
            storage_path = os.path.join(PROFILE_UPLOAD_DIR, stored_name)
            profile_image.save(storage_path)
            current_user.profile_image = f"uploads/profiles/{stored_name}"

        db.session.commit()
        flash('تم تحديث الملف الشخصي', 'success')
    except SQLAlchemyError as e:
        handle_database_error(e)
        return redirect(url_for('profile'))
    except Exception as e:
        app.logger.error(f"Unexpected error in update_profile: {str(e)}")
        flash('حدث خطأ غير متوقع', 'danger')
        return redirect(url_for('profile'))

    return redirect(url_for('profile'))

@app.route('/create_request', methods=['GET', 'POST'])
@login_required
def create_request():
    if current_user.role != 'customer':
        flash('فقط العملاء يمكنهم إنشاء طلبات', 'danger')
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        payload = {
            'service_type': request.form.get('service_type'),
            'description': request.form.get('description', ''),
            'city': request.form.get('city', ''),
            'district': request.form.get('district', ''),
            'address': request.form.get('address', ''),
            'preferred_date': request.form.get('preferred_date'),
            'preferred_time': request.form.get('preferred_time'),
            'notes': request.form.get('notes', ''),
            'latitude': request.form.get('latitude'),
            'longitude': request.form.get('longitude'),
        }
        att = request.files.get('attachment')
        attachment_file = att if att and att.filename else None
        result, code = customer_create_request(
            current_user, payload, attachment_file=attachment_file
        )
        if result.get('success'):
            flash(result.get('message', 'تم إرسال الطلب بنجاح'), 'success')
            return redirect(url_for('dashboard'))
        flash(result.get('message', 'حدث خطأ'), 'danger')
        return redirect(url_for('create_request'))

    specializations = Specialization.query.all()
    now = datetime.utcnow()
    return render_template('create_request.html', specializations=specializations, now=now)

@app.route('/track/<int:id>')
@login_required
def track(id: int):
    service_req = ServiceRequest.query.get_or_404(id)

    # Authorization
    if current_user.role == 'customer' and service_req.customer_id != current_user.user_id:
        flash('لا يمكنك الوصول لهذا الطلب', 'danger')
        return redirect(url_for('dashboard'))
    can_submit_offer = False
    if current_user.role == 'technician':
        # Assigned request -> assigned technician only
        if service_req.technician_id not in (None, current_user.user_id):
            flash('لا يمكنك الوصول لهذا الطلب', 'danger')
            return redirect(url_for('tech_dashboard'))
        # Unassigned pending request -> only eligible technicians can access offer stage
        if service_req.technician_id is None and service_req.status == 'pending':
            req_spec = _coerce_int(service_req.service_type)
            tech_spec = _coerce_int(current_user.specialization_id)
            if req_spec is None or tech_spec is None or req_spec != tech_spec:
                flash('هذا الطلب غير متاح لتخصصك', 'danger')
                return redirect(url_for('tech_dashboard'))
            can_submit_offer = True

    payment_record = Payment.query.filter_by(request_id=id).order_by(Payment.created_at.desc()).first()
    payment_amount = payment_record.amount if payment_record else None
    timeline_entries = (
        RequestTimeline.query.options(joinedload(RequestTimeline.actor))
        .filter_by(request_id=service_req.request_id)
        .order_by(RequestTimeline.created_at.asc())
        .all()
        if timeline_table_exists()
        else []
    )
    offers = service_req.offers.order_by(TechnicianOffer.total_amount.asc()).all()
    my_offer = None
    if current_user.role == 'technician':
        my_offer = TechnicianOffer.query.filter_by(
            request_id=service_req.request_id,
            technician_id=current_user.user_id
        ).first()
    invoice = Invoice.query.filter_by(request_id=id).first()
    existing_rating = TechnicianRating.query.filter_by(request_id=id).first()
    poll_baseline = build_track_status_payload(service_req)
    poll_interval_ms = (
        5000
        if (
            current_user.role == 'customer'
            and service_req.status == 'pending'
            and invoice is None
        )
        else 30000
    )

    from api_service_requests import (
        _detail_distance_km_for_viewer,
        api_can_view_request_coordinates,
        api_should_redact_location,
    )

    location_redacted = api_should_redact_location(current_user, service_req)
    can_show_exact_map = (
        api_can_view_request_coordinates(current_user, service_req)
        and service_req.latitude is not None
        and service_req.longitude is not None
    )
    map_lat = float(service_req.latitude) if can_show_exact_map else None
    map_lng = float(service_req.longitude) if can_show_exact_map else None
    distance_km = _detail_distance_km_for_viewer(
        current_user, service_req, dict(request.args)
    )
    can_open_area_maps = bool(
        location_redacted and (service_req.city or service_req.district)
    )

    return render_template(
        'track_request.html',
        request=service_req,
        payment_amount=payment_amount,
        timeline_entries=timeline_entries,
        offers=offers,
        my_offer=my_offer,
        can_submit_offer=can_submit_offer,
        invoice=invoice,
        existing_rating=existing_rating,
        poll_baseline=poll_baseline,
        poll_interval_ms=poll_interval_ms,
        location_redacted=location_redacted,
        can_show_exact_map=can_show_exact_map,
        map_lat=map_lat,
        map_lng=map_lng,
        distance_km=distance_km,
        can_open_area_maps=can_open_area_maps,
        tech_lat=request.args.get('lat'),
        tech_lng=request.args.get('lng'),
    )


@app.route('/track/<int:request_id>/profile/<int:user_id>')
@login_required
def request_public_profile(request_id: int, user_id: int):
    """
    Read-only participant profile in job context (same rules as
    GET /api/v1/requests/<request_id>/public-profile/<user_id>).
    """
    from api_service_requests import build_public_profile_payload

    sr = ServiceRequest.query.get_or_404(request_id)
    target = User.query.get_or_404(user_id)
    profile = build_public_profile_payload(current_user, sr, target)
    if profile is None:
        flash('لا تملك صلاحية عرض هذا الملف', 'danger')
        return redirect(url_for('track', id=request_id))
    return render_template(
        'public_profile_request.html',
        service_req=sr,
        profile=profile,
        profile_user=target,
    )


@app.route('/invoice/<int:request_id>')
@login_required
def view_invoice(request_id: int):
    service_req = ServiceRequest.query.get_or_404(request_id)
    invoice = Invoice.query.filter_by(request_id=request_id).first_or_404()

    if current_user.role == 'customer' and service_req.customer_id != current_user.user_id:
        flash('لا يمكنك الوصول لهذه الفاتورة', 'danger')
        return redirect(url_for('dashboard'))
    if current_user.role == 'technician' and service_req.technician_id != current_user.user_id:
        flash('لا يمكنك الوصول لهذه الفاتورة', 'danger')
        return redirect(url_for('tech_dashboard'))
    if current_user.role not in ('customer', 'technician', 'admin'):
        flash('ليس لديك صلاحية الوصول', 'danger')
        return redirect(url_for('dashboard'))

    return render_template('invoice.html', invoice=invoice, service_req=service_req)


@app.route('/track/<int:id>/status')
@login_required
def track_status(id: int):
    service_req = ServiceRequest.query.get_or_404(id)
    if current_user.role == 'admin':
        return jsonify(build_track_status_payload(service_req))
    if current_user.role == 'customer' and service_req.customer_id != current_user.user_id:
        return jsonify({'success': False, 'message': 'لا تملك صلاحية الوصول لحالة هذا الطلب'}), 403
    if current_user.role == 'technician':
        if service_req.technician_id not in (None, current_user.user_id):
            return jsonify({'success': False, 'message': 'لا تملك صلاحية الوصول لحالة هذا الطلب'}), 403
        if service_req.technician_id is None and service_req.status == 'pending':
            req_spec = _coerce_int(service_req.service_type)
            tech_spec = _coerce_int(current_user.specialization_id)
            if req_spec is None or tech_spec is None or req_spec != tech_spec:
                return jsonify({'success': False, 'message': 'هذا الطلب غير متاح لتخصصك'}), 403
    return jsonify(build_track_status_payload(service_req))

@app.route('/pay/<int:request_id>', methods=['POST'])
@login_required
def pay(request_id: int):
    body, code = customer_pay_request(current_user, request_id)
    return jsonify(body), code

@app.route('/tech/offer/<int:request_id>', methods=['POST'])
@login_required
def submit_offer(request_id: int):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = request.form.to_dict() if request.form else {}
    body, code = technician_submit_offer(current_user, request_id, data)
    return jsonify(body), code


@app.route('/customer/choose-offer/<int:offer_id>', methods=['POST'])
@login_required
def choose_offer(offer_id: int):
    body, code = customer_choose_offer(current_user, offer_id)
    return jsonify(body), code


@app.route('/tech/accept/<int:request_id>', methods=['POST'])
@login_required
def tech_accept(request_id: int):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = request.form.to_dict() if request.form else {}
    body, code = technician_accept_request(current_user, request_id, data)
    return jsonify(body), code


@app.route('/tech/complete/<int:request_id>', methods=['POST'])
@login_required
def tech_complete(request_id: int):
    body, code = technician_complete_request(current_user, request_id)
    return jsonify(body), code


@app.route('/rate/<int:request_id>', methods=['POST'])
@login_required
def rate_technician(request_id: int):
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        data = request.form.to_dict() if request.form else {}
    body, code = customer_submit_rating(current_user, request_id, data)
    return jsonify(body), code

@app.route('/register')
def register():
    """Alias for signup route"""
    return redirect(url_for('signup'))

@app.route('/forgot_password', methods=['GET', 'POST'])
def forgot_password():
    """Password reset functionality"""
    if request.method == 'POST':
        email = sanitize_input(request.form.get('email', ''))
        
        if not email:
            flash('يرجى إدخال البريد الإلكتروني', 'danger')
            return render_template('forgot_password.html')
        
        if not validate_email(email):
            flash('يرجى إدخال بريد إلكتروني صحيح', 'danger')
            return render_template('forgot_password.html')
        
        user = User.query.filter_by(email=email).first()
        if user:
            # In a real application, you would send an email here
            # For demo purposes, we'll just show a success message
            flash('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني', 'success')
        else:
            # Don't reveal if email exists or not for security
            flash('إذا كان البريد الإلكتروني مسجل لدينا، سيتم إرسال رابط إعادة التعيين', 'info')
        
        return redirect(url_for('login'))
    
    return render_template('forgot_password.html')

def _request_path_best_effort() -> str:
    """Path for routing checks (404 handler may still have a usable PATH_INFO)."""
    p = (getattr(request, "path", None) or "").split("?", 1)[0]
    if p:
        return p
    raw = request.environ.get("PATH_INFO", "")
    if isinstance(raw, bytes):
        raw = raw.decode("latin-1", errors="replace")
    return (raw or "").split("?", 1)[0]


def _is_json_request() -> bool:
    """Determine if the current request expects a JSON response (AJAX or API)."""
    if _request_path_best_effort().startswith("/api/"):
        return True
    return request.headers.get("X-Requested-With") == "XMLHttpRequest" or \
        request.accept_mimetypes.best == "application/json"

# ---------------------------
# Error Handlers
# ---------------------------

@app.errorhandler(404)
def not_found_error(error):
    """Handle 404 errors"""
    if _is_json_request():
        return jsonify({'success': False, 'message': 'الصفحة غير موجودة'}), 404
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    db.session.rollback()
    app.logger.error(f"Internal server error: {str(error)}")
    if _is_json_request():
        return jsonify({'success': False, 'message': 'حدث خطأ في الخادم'}), 500
    return render_template('errors/500.html'), 500

@app.errorhandler(403)
def forbidden_error(error):
    """Handle 403 errors"""
    if _is_json_request():
        return jsonify({'success': False, 'message': 'غير مصرح'}), 403
    return render_template('errors/403.html'), 403

# ----------------------------------------------------
# Development helper – quick DB overview (counts only)
# ----------------------------------------------------

@app.route('/debug/overview')
@login_required
def debug_overview():
    """Return JSON with basic record counts (admin-only)."""
    if current_user.role != 'admin':
        return jsonify({'error': 'forbidden'}), 403

    data = {
        'users': User.query.count(),
        'specializations': Specialization.query.count(),
        'service_requests': ServiceRequest.query.count(),
        'payments': Payment.query.count(),
        'offers': TechnicianOffer.query.count(),
        'invoices': Invoice.query.count(),
        'ratings': TechnicianRating.query.count(),
    }
    return jsonify(data)

if __name__ == '__main__':
    _health_rules = sorted(
        f"{','.join(sorted(r.methods - {'HEAD', 'OPTIONS'}))} {r.rule}"
        for r in app.url_map.iter_rules()
        if r.rule.rstrip('/') == '/api/v1/health'
    )
    print('UpKeep: app.py =', os.path.abspath(__file__))
    print('UpKeep: /api/v1/health in url_map =', _health_rules or 'MISSING')
    _host = os.getenv("FLASK_HOST", "0.0.0.0")
    _port = int(os.getenv("FLASK_PORT", "5000"))
    if _host == '0.0.0.0':
        print(
            'UpKeep: bound on 0.0.0.0 — use your PC LAN IP in mobile/.env '
            f'(EXPO_PUBLIC_API_URL=http://<LAN-IP>:{_port}) for a physical device; '
            f'Android emulator often uses http://10.0.2.2:{_port}'
        )
    app.run(host=_host, port=_port, debug=CONFIG["FLASK_DEBUG"])
