from __future__ import annotations

"""Admin Blueprint with dashboard, management, and analytics routes.
This module is intentionally self-contained so that it can be imported from
``app.py`` with a single ``register_blueprint`` call.
"""

from functools import wraps
from typing import Any, Dict, List
from datetime import datetime
import subprocess
import os
import csv
import io
from werkzeug.utils import secure_filename

from flask import (
    Blueprint,
    abort,
    current_app,
    jsonify,
    render_template,
    request,
    make_response,
)
from flask_login import current_user, login_required
from sqlalchemy import func, text, case
from sqlalchemy.orm import aliased
from werkzeug.security import generate_password_hash
from sqlalchemy.exc import IntegrityError

from models import db, User, ServiceRequest, AuditLog, Specialization, Payment, Invoice, TechnicianRating

admin_bp = Blueprint(
    "admin", __name__, url_prefix="/admin", template_folder="templates/admin"
)


# ---------------------------------------------------------------------------
# Decorators & helpers
# ---------------------------------------------------------------------------

def admin_required(func):  # type: ignore[override]
    """Ensure the current user is an authenticated admin."""

    @wraps(func)
    @login_required
    def wrapper(*args, **kwargs):
        if current_user.role != "admin":
            abort(403)
        return func(*args, **kwargs)

    return wrapper


def _log_action(action: str, target_type: str | None = None, target_id: int | None = None) -> None:
    """Persist an admin action to the audit_logs table."""

    log = AuditLog(
        admin_id=current_user.user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        created_at=datetime.utcnow(),
    )
    db.session.add(log)
    db.session.commit()


# ---------------------------------------------------------------------------
# Dashboard & analytics
# ---------------------------------------------------------------------------


@admin_bp.route("/")
@admin_bp.route("/dashboard")
@admin_required
def dashboard():
    """Visual stats dashboard."""

    total_requests = ServiceRequest.query.count()
    status_counts = (
        db.session.query(ServiceRequest.status, func.count(ServiceRequest.request_id))
        .group_by(ServiceRequest.status)
        .all()
    )
    users_count = User.query.count()

    tech_performance = (
        db.session.query(User.full_name, func.count(ServiceRequest.request_id))
        .join(ServiceRequest, ServiceRequest.technician_id == User.user_id)
        .filter(ServiceRequest.status == "completed", User.role == "technician")
        .group_by(User.full_name)
        .all()
    )

    # Revenue analytics for all technicians (admin-only visibility)
    tech_invoice_rows = (
        db.session.query(
            User.user_id.label("technician_id"),
            User.full_name.label("technician_name"),
            func.count(func.distinct(Invoice.invoice_id)).label("paid_invoices_count"),
            func.coalesce(func.sum(Invoice.total), 0).label("total_revenue"),
            func.coalesce(func.avg(Invoice.total), 0).label("avg_job_value"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (func.year(Invoice.issued_at) == datetime.utcnow().year)
                            & (func.month(Invoice.issued_at) == datetime.utcnow().month),
                            Invoice.total,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("monthly_revenue"),
        )
        .outerjoin(ServiceRequest, ServiceRequest.technician_id == User.user_id)
        .outerjoin(
            Invoice,
            (Invoice.request_id == ServiceRequest.request_id) & (Invoice.payment_status == "paid"),
        )
        .filter(User.role == "technician")
        .group_by(User.user_id, User.full_name)
        .order_by(func.coalesce(func.sum(Invoice.total), 0).desc(), User.user_id.asc())
        .all()
    )
    technician_stats = [
        {
            "technician_id": int(row.technician_id),
            "technician_name": row.technician_name,
            "paid_invoices_count": int(row.paid_invoices_count or 0),
            "total_revenue": float(row.total_revenue or 0),
            "avg_job_value": float(row.avg_job_value or 0),
            "monthly_revenue": float(row.monthly_revenue or 0),
            "avg_rating": None,
            "ratings_count": 0,
        }
        for row in tech_invoice_rows
    ]

    rating_rows = (
        db.session.query(
            TechnicianRating.technician_id.label("technician_id"),
            func.avg(TechnicianRating.stars).label("avg_rating"),
            func.count(TechnicianRating.rating_id).label("ratings_count"),
        )
        .group_by(TechnicianRating.technician_id)
        .all()
    )
    rating_map = {
        int(row.technician_id): {
            "avg_rating": float(row.avg_rating) if row.avg_rating is not None else None,
            "ratings_count": int(row.ratings_count or 0),
        }
        for row in rating_rows
    }
    for row in technician_stats:
        rv = rating_map.get(row["technician_id"])
        if rv:
            row["avg_rating"] = rv["avg_rating"]
            row["ratings_count"] = rv["ratings_count"]

    ratings_overall_avg = db.session.query(func.avg(TechnicianRating.stars)).scalar()
    ratings_overall_count = TechnicianRating.query.count()

    # Convert tuples to dict for easier template handling
    status_dict: Dict[str, int] = {status: count for status, count in status_counts}
    tech_perf_labels = [name for name, _ in tech_performance]
    tech_perf_counts = [count for _, count in tech_performance]

    return render_template(
        "admin/dashboard.html",
        total_requests=total_requests,
        users_count=users_count,
        status_dict=status_dict,
        tech_perf_labels=tech_perf_labels,
        tech_perf_counts=tech_perf_counts,
        technician_stats=technician_stats,
        ratings_overall_avg=round(float(ratings_overall_avg), 2) if ratings_overall_avg is not None else None,
        ratings_overall_count=int(ratings_overall_count),
    )


@admin_bp.route("/analytics")
@admin_required
def analytics_api():
    """Return JSON analytics data for Chart.js via Fetch/AJAX."""

    status_counts = (
        db.session.query(ServiceRequest.status, func.count(ServiceRequest.request_id))
        .group_by(ServiceRequest.status)
        .all()
    )
    data = {status: count for status, count in status_counts}
    return jsonify(data)


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------


@admin_bp.route("/users")
@admin_required
def users_page():
    """Render the user management page (table driven by JS fetch)."""

    return render_template("admin/users.html")


@admin_bp.route("/api/users", methods=["GET", "POST"])
@admin_bp.route("/api/users/<int:user_id>", methods=["GET", "PUT", "DELETE"])
@admin_required
def users_api(user_id: int | None = None):
    """Return or manipulate users via JSON (very light validation)."""

    if request.method == "GET":
        if user_id is None:
            users = User.query.all()
            result: List[dict[str, Any]] = [
                {
                    "id": u.user_id,
                    "email": u.email,
                    "full_name": u.full_name,
                    "phone": u.phone,
                    "role": u.role,
                }
                for u in users
            ]
            return jsonify(result)
        else:
            u = User.query.get_or_404(user_id)
            return jsonify(
                {
                    "id": u.user_id,
                    "email": u.email,
                    "full_name": u.full_name,
                    "phone": u.phone,
                    "role": u.role,
                }
            )

    # ---------- CREATE ----------
    if request.method == "POST":
        data = request.get_json(force=True)
        required = {"email", "password", "full_name", "phone", "role"}
        if not required.issubset(data):
            return jsonify({"error": "Missing fields"}), 400
        if User.query.filter_by(email=data["email"]).first():
            return jsonify({"error": "Email already in use"}), 400

        new_user = User(
            email=data["email"],
            hashed_pw=generate_password_hash(data["password"]),
            full_name=data["full_name"],
            phone=data["phone"],
            role=data["role"],
        )
        db.session.add(new_user)
        db.session.commit()
        _log_action("create_user", "user", new_user.user_id)
        return jsonify({"message": "User created", "id": new_user.user_id}), 201

    # ---------- UPDATE ----------
    if request.method == "PUT":
        if user_id is None:
            return jsonify({"error": "Missing user id"}), 400
        data = request.get_json(force=True)
        user = User.query.get_or_404(user_id)
        # Update allowed fields
        for field in ["full_name", "phone", "role"]:
            if field in data:
                setattr(user, field, data[field])
        db.session.commit()
        _log_action("update_user", "user", user_id)
        return jsonify({"message": "User updated"})

    # ---------- DELETE ----------
    if request.method == "DELETE":
        if user_id is None:
            return jsonify({"error": "Missing user id"}), 400
        user = User.query.get_or_404(user_id)
        try:
            db.session.delete(user)
            db.session.commit()
        except IntegrityError:
            db.session.rollback()
            # Detach or delete related service requests then retry
            from models import ServiceRequest  # local import to avoid circular
            if user.role == "technician":
                ServiceRequest.query.filter_by(technician_id=user_id).update({"technician_id": None})
            if user.role == "customer":
                # Delete customer's requests and associated payments
                reqs = ServiceRequest.query.filter_by(customer_id=user_id).all()
                for r in reqs:
                    Payment.query.filter_by(request_id=r.request_id).delete(synchronize_session=False)
                    db.session.delete(r)
        db.session.delete(user)
        db.session.commit()
        _log_action("delete_user", "user", user_id)
        return jsonify({"message": "User deleted"})

    abort(405)


# ---------------------------------------------------------------------------
# Service request management
# ---------------------------------------------------------------------------


@admin_bp.route("/requests")
@admin_required
def requests_page():
    return render_template("admin/requests.html")


@admin_bp.route("/api/requests")
@admin_required
def requests_api():
    requests_q = ServiceRequest.query.order_by(ServiceRequest.created_at.desc()).all()
    result = [
        {
            "id": r.request_id,
            "customer": r.customer.full_name if r.customer else None,
            "technician": r.technician.full_name if r.technician else None,
            "service": r.service.name_ar if r.service else None,
            "status": r.status,
            "created_at": r.created_at.strftime("%Y-%m-%d"),
        }
        for r in requests_q
    ]
    return jsonify(result)


# ---------------------------------------------------------------------------
# Backup & settings
# ---------------------------------------------------------------------------


@admin_bp.route("/settings")
@admin_required
def settings_page():
    return render_template("admin/settings.html")


@admin_bp.route("/settings/backup", methods=["POST"])
@admin_required
def backup_database():
    """Trigger a mysqldump backup and stream file path (simplified stub)."""

    db_uri = current_app.config["SQLALCHEMY_DATABASE_URI"]
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(current_app.root_path, f"backup_{timestamp}.sql")

    try:
        # Real implementation would parse creds and run mysqldump.
        # Here we just create an empty placeholder file to illustrate.
        open(backup_path, "w").close()
        _log_action("backup_db")
        return jsonify({"message": "Backup created", "path": backup_path})
    except Exception as exc:  # pragma: no cover (operating-system-specific)
        current_app.logger.error(f"Backup failed: {exc}")
        return jsonify({"error": "Backup failed"}), 500


@admin_bp.route("/settings/restore", methods=["POST"])
@admin_required
def restore_database():
    """Restore DB from uploaded SQL file (stub)."""

    if "file" not in request.files:
        return jsonify({"error": "missing file"}), 400

    f = request.files["file"]
    if f.filename == "":
        return jsonify({"error": "empty filename"}), 400

    filename = secure_filename(f.filename)
    restore_path = os.path.join(current_app.root_path, filename)
    try:
        f.save(restore_path)

        # Execute SQL file content against current DB using SQLAlchemy
        with open(restore_path, 'r', encoding='utf-8') as sql_file:
            sql_statements = sql_file.read()

        # Split statements on semicolon followed by newline to avoid semi inside data
        statements = [s.strip() for s in sql_statements.split(';') if s.strip()]
        connection = db.engine.raw_connection()
        try:
            cursor = connection.cursor()
            cursor.execute('SET FOREIGN_KEY_CHECKS=0;')
            for stmt in statements:
                cursor.execute(stmt)
            cursor.execute('SET FOREIGN_KEY_CHECKS=1;')
            connection.commit()
        finally:
            cursor.close()
            connection.close()

        _log_action("restore_db")
        return jsonify({"message": "Database restored", "file": restore_path})
    except Exception as exc:  # pragma: no cover
        current_app.logger.error(f"Restore failed: {exc}")
        return jsonify({"error": "Restore failed"}), 500


# ---------------------------------------------------------------------------
# Specializations management
# ---------------------------------------------------------------------------


@admin_bp.route('/specializations')
@admin_required
def specs_page():
    return render_template('admin/specs.html')


@admin_bp.route('/api/specializations', methods=['GET', 'POST'])
@admin_bp.route('/api/specializations/<int:spec_id>', methods=['PUT', 'DELETE'])
@admin_required
def specs_api(spec_id: int | None = None):
    # ---------- READ ----------
    if request.method == 'GET':
        specs = Specialization.query.all()
        return jsonify([{ 'id': s.spec_id, 'name_ar': s.name_ar, 'name_en': s.name_en } for s in specs])

    # ---------- CREATE ----------
    if request.method == 'POST':
        data = request.get_json(force=True)
        s = Specialization(name_ar=data['name_ar'], name_en=data['name_en'])
        db.session.add(s); db.session.commit()
        _log_action('create_spec', 'specialization', s.spec_id)
        return jsonify({'id': s.spec_id}), 201

    # Ensure spec_id provided for modifications
    if spec_id is None:
        return jsonify({'error': 'missing id'}), 400

    spec = Specialization.query.get_or_404(spec_id)

    # ---------- UPDATE ----------
    if request.method == 'PUT':
        data = request.get_json(force=True)
        spec.name_ar = data.get('name_ar', spec.name_ar)
        spec.name_en = data.get('name_en', spec.name_en)
        db.session.commit(); _log_action('update_spec', 'specialization', spec_id)
        return jsonify({'message': 'updated'})

    # ---------- DELETE ----------
    if request.method == 'DELETE':
        from models import ServiceRequest
        linked = ServiceRequest.query.filter_by(service_type=spec_id).count()
        if linked:
            return jsonify({'error': 'لا يمكن حذف التخصص لوجود طلبات مرتبطة به'}), 400
        db.session.delete(spec)
        db.session.commit(); _log_action('delete_spec', 'specialization', spec_id)
        return jsonify({'message': 'deleted'})

    abort(405)


# ---------------------------------------------------------------------------
# Audit logs view (read-only)
# ---------------------------------------------------------------------------


@admin_bp.route('/logs')
@admin_required
def logs_page():
    return render_template('admin/logs.html')


@admin_bp.route('/api/logs')
@admin_required
def logs_api():
    logs = AuditLog.query.order_by(AuditLog.created_at.desc()).limit(500).all()
    return jsonify([
        {
            'id': l.log_id,
            'admin': l.admin.full_name if l.admin else None,
            'action': l.action,
            'target': f"{l.target_type}:{l.target_id}" if l.target_type else None,
            'created_at': l.created_at.strftime('%Y-%m-%d %H:%M')
        } for l in logs
    ]) 


def _build_invoice_filtered_query():
    technician_user = aliased(User)
    customer_user = aliased(User)
    query = (
        db.session.query(Invoice, ServiceRequest, technician_user, customer_user)
        .join(ServiceRequest, ServiceRequest.request_id == Invoice.request_id)
        .outerjoin(technician_user, technician_user.user_id == ServiceRequest.technician_id)
        .join(customer_user, customer_user.user_id == ServiceRequest.customer_id)
    )

    date_from = request.args.get("date_from", "").strip()
    date_to = request.args.get("date_to", "").strip()
    payment_status = request.args.get("status", "").strip()
    technician_id = request.args.get("technician_id", "").strip()
    customer_id = request.args.get("customer_id", "").strip()
    request_id = request.args.get("request_id", "").strip()

    if payment_status:
        query = query.filter(Invoice.payment_status == payment_status)
    if technician_id.isdigit():
        query = query.filter(ServiceRequest.technician_id == int(technician_id))
    if customer_id.isdigit():
        query = query.filter(ServiceRequest.customer_id == int(customer_id))
    if request_id.isdigit():
        query = query.filter(ServiceRequest.request_id == int(request_id))
    if date_from:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(Invoice.issued_at >= from_date)
        except ValueError:
            pass
    if date_to:
        try:
            # Inclusive date-end filter for whole day
            to_date = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(Invoice.issued_at < (to_date.replace(hour=23, minute=59, second=59)))
        except ValueError:
            pass

    query = query.order_by(Invoice.issued_at.desc(), Invoice.invoice_id.desc())
    return query


@admin_bp.route("/invoices")
@admin_required
def invoices_page():
    query = _build_invoice_filtered_query()
    rows = query.all()

    invoice_rows = []
    subtotal_sum = 0.0
    tax_sum = 0.0
    total_sum = 0.0
    for invoice, service_req, technician, customer in rows:
        subtotal_v = float(invoice.subtotal or 0)
        tax_v = float(invoice.tax_amount or 0)
        total_v = float(invoice.total or 0)
        subtotal_sum += subtotal_v
        tax_sum += tax_v
        total_sum += total_v
        invoice_rows.append(
            {
                "invoice_id": invoice.invoice_id,
                "invoice_number": invoice.invoice_number,
                "issued_at": invoice.issued_at,
                "request_id": service_req.request_id,
                "payment_status": invoice.payment_status,
                "subtotal": subtotal_v,
                "tax_rate": float(invoice.tax_rate or 0),
                "tax_amount": tax_v,
                "total": total_v,
                "technician_name": technician.full_name if technician else "غير معيّن",
                "customer_name": customer.full_name if customer else "-",
            }
        )

    technicians = User.query.filter_by(role="technician").order_by(User.full_name.asc()).all()
    customers = User.query.filter_by(role="customer").order_by(User.full_name.asc()).all()

    return render_template(
        "admin/invoices.html",
        invoice_rows=invoice_rows,
        technicians=technicians,
        customers=customers,
        filters={
            "date_from": request.args.get("date_from", ""),
            "date_to": request.args.get("date_to", ""),
            "status": request.args.get("status", ""),
            "technician_id": request.args.get("technician_id", ""),
            "customer_id": request.args.get("customer_id", ""),
            "request_id": request.args.get("request_id", ""),
        },
        totals={
            "subtotal": subtotal_sum,
            "tax_collected": tax_sum,
            "grand_total": total_sum,
        },
    )


@admin_bp.route("/api/invoices")
@admin_required
def invoices_api():
    query = _build_invoice_filtered_query()
    rows = query.all()
    payload = []
    subtotal_sum = 0.0
    tax_sum = 0.0
    total_sum = 0.0
    for invoice, service_req, technician, customer in rows:
        subtotal_v = float(invoice.subtotal or 0)
        tax_v = float(invoice.tax_amount or 0)
        total_v = float(invoice.total or 0)
        subtotal_sum += subtotal_v
        tax_sum += tax_v
        total_sum += total_v
        payload.append(
            {
                "invoice_id": invoice.invoice_id,
                "invoice_number": invoice.invoice_number,
                "issued_at": invoice.issued_at.strftime("%Y-%m-%d %H:%M"),
                "request_id": service_req.request_id,
                "payment_status": invoice.payment_status,
                "subtotal": subtotal_v,
                "tax_rate": float(invoice.tax_rate or 0),
                "tax_amount": tax_v,
                "total": total_v,
                "technician_id": technician.user_id if technician else None,
                "technician_name": technician.full_name if technician else None,
                "customer_id": customer.user_id if customer else None,
                "customer_name": customer.full_name if customer else None,
            }
        )
    return jsonify(
        {
            "rows": payload,
            "totals": {
                "subtotal": subtotal_sum,
                "tax_collected": tax_sum,
                "grand_total": total_sum,
            },
            "count": len(payload),
        }
    )


@admin_bp.route("/invoices/export")
@admin_required
def invoices_export_csv():
    query = _build_invoice_filtered_query()
    rows = query.all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "invoice_number",
            "issued_at",
            "request_id",
            "customer_name",
            "technician_name",
            "payment_status",
            "subtotal",
            "tax_rate",
            "tax_amount",
            "total",
        ]
    )
    for invoice, service_req, technician, customer in rows:
        writer.writerow(
            [
                invoice.invoice_number,
                invoice.issued_at.strftime("%Y-%m-%d %H:%M"),
                service_req.request_id,
                (customer.full_name if customer else "-"),
                (technician.full_name if technician else "غير معيّن"),
                invoice.payment_status,
                f"{float(invoice.subtotal or 0):.2f}",
                f"{float(invoice.tax_rate or 0):.2f}",
                f"{float(invoice.tax_amount or 0):.2f}",
                f"{float(invoice.total or 0):.2f}",
            ]
        )

    csv_data = output.getvalue()
    output.close()
    resp = make_response(csv_data)
    resp.headers["Content-Type"] = "text/csv; charset=utf-8"
    resp.headers["Content-Disposition"] = "attachment; filename=invoices_filtered.csv"
    return resp