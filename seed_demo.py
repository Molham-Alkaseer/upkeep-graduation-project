"""Reloadable Damascus demo data; run --help for replacement and backup options."""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import shutil
import subprocess
from datetime import datetime, timedelta
from decimal import Decimal

from flask import current_app
from sqlalchemy import inspect, text
from werkzeug.security import generate_password_hash

from models import (
    db, User, Specialization, ServiceRequest, TechnicianOffer, Invoice, Payment,
    TechnicianRating, RequestTimeline, AuditLog, TechnicianPortfolioItem,
)
from seed_demo_data import (
    SPECIALIZATIONS, LOCATIONS, CUSTOMERS, TECHNICIANS, JOBS, REVIEWS,
    DEMO_PASSWORD, DEMO_EMAILS,
)
from service_request_actions import DEFAULT_TAX_RATE, compute_invoice_totals
from timeline_messages import encode_timeline, money_str

SEED_MARKER = "Loaded Damascus mock dataset v2"


def backup_database() -> Path:
    """Make a real, restorable MySQL dump before any destructive statement."""
    url = db.engine.url
    if url.get_backend_name() != "mysql":
        raise RuntimeError("This backup command requires MySQL.")
    executable = shutil.which("mysqldump")
    if not executable:
        raise RuntimeError("mysqldump must be on PATH. No records were changed.")
    stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    path = Path(current_app.root_path) / f"backup_before_mock_{stamp}.sql"
    environment = dict(os.environ, MYSQL_PWD=url.password or "")
    command = [
        executable, f"--host={url.host or 'localhost'}", f"--port={url.port or 3306}",
        f"--user={url.username}", "--single-transaction", "--no-tablespaces",
        "--set-gtid-purged=OFF", "--default-character-set=utf8mb4", "--hex-blob",
        f"--result-file={path}", url.database,
    ]
    result = subprocess.run(command, env=environment, capture_output=True, timeout=120)
    if result.returncode or not path.exists() or path.stat().st_size < 100:
        raise RuntimeError("MySQL backup failed. No records were changed; check mysqldump access.")
    return path


def _clear_records(*, all_records: bool) -> None:
    if all_records:
        # Keep schema, migration revision and uploaded files. DELETE is transactional
        # and preserves increasing IDs so old login sessions cannot become new users.
        for table in reversed(db.metadata.sorted_tables):
            db.session.execute(table.delete())
        return
    user_ids = [u.user_id for u in User.query.filter(User.email.in_(DEMO_EMAILS))]
    request_ids = [r.request_id for r in ServiceRequest.query.filter(
        ServiceRequest.customer_id.in_(user_ids)
    )]
    for model in (TechnicianRating, Payment, Invoice, TechnicianOffer, RequestTimeline):
        model.query.filter(model.request_id.in_(request_ids)).delete(synchronize_session=False)
    ServiceRequest.query.filter(ServiceRequest.request_id.in_(request_ids)).delete(synchronize_session=False)
    TechnicianPortfolioItem.query.filter(
        TechnicianPortfolioItem.technician_id.in_(user_ids)
    ).delete(synchronize_session=False)
    AuditLog.query.filter_by(action=SEED_MARKER).delete(synchronize_session=False)


def _user(local: str, ar: str, en: str, role: str, location: int, number: int,
          now: datetime, specialization_id: int | None = None, bio: str = "") -> User:
    email = f"{local}@upkeep.local"
    user = User.query.filter_by(email=email).first()
    if user is None:
        user = User(email=email)
        db.session.add(user)
    user.full_name = f"{ar} / {en}"
    user.full_name_ar, user.full_name_en = ar, en
    user.role, user.specialization_id = role, specialization_id
    user.phone = f"099000{number:04d}"
    user.city, user.district = "دمشق", LOCATIONS[location][0]
    user.bio, user.profile_image = bio or None, None
    user.hashed_pw = generate_password_hash(DEMO_PASSWORD)
    user.created_at = now - timedelta(days=120 + number % 45)
    db.session.flush()
    return user


def _event(req: ServiceRequest, status: str, kind: str, actor: User,
           at: datetime, **payload) -> None:
    db.session.add(RequestTimeline(
        request_id=req.request_id, status=status, actor_id=actor.user_id,
        note=encode_timeline(kind, **payload), created_at=at,
    ))


def _job(*, customer: User, technicians: list[User], spec: Specialization,
         trade: int, variant: int, status: str, serial: int, now: datetime,
         age_days: int = 0, paid: bool = False, rated: bool = True,
         offer_count: int = 2) -> None:
    description, price = JOBS[trade][variant % len(JOBS[trade])]
    place = next(loc for loc in LOCATIONS if loc[0] == customer.district)
    created = now - timedelta(days=age_days, hours=8)
    historical = status in {"completed", "cancelled"}
    work_time = created + timedelta(hours=3)
    preferred = work_time.date() if historical or status == "in_progress" else (now + timedelta(days=1 + serial % 3)).date()
    req = ServiceRequest(
        customer_id=customer.user_id, service_type=spec.spec_id,
        description=description, city="دمشق", district=place[0],
        address=f"دمشق، {place[0]}، شارع الخدمات، بناء {10 + serial} (عنوان تجريبي)",
        latitude=place[1], longitude=place[2], location_accuracy_m=15.0,
        location_captured_at=created - timedelta(minutes=2),
        preferred_date=preferred, preferred_time=("morning", "afternoon", "evening")[serial % 3],
        notes="يرجى الاتصال قبل الوصول بنصف ساعة. العنوان والبيانات لأغراض العرض فقط. / Please call 30 minutes before arrival. Fictional demo address.",
        status=status, created_at=created,
        payment_status="completed" if paid else "pending",
        completed_at=created + timedelta(hours=5) if status == "completed" else None,
    )
    db.session.add(req)
    db.session.flush()
    _event(req, "pending", "created_by_customer", customer, created)
    accepted = None
    for index, technician in enumerate(technicians[:offer_count]):
        subtotal = Decimal(price + index * 15000).quantize(Decimal("0.01"))
        tax, total = compute_invoice_totals(subtotal, DEFAULT_TAX_RATE)
        chosen = index == 0 and status not in {"pending", "cancelled"}
        offer_status = "accepted" if chosen else (
            "pending" if status == "pending" else "withdrawn" if status == "cancelled" else "rejected"
        )
        offer = TechnicianOffer(
            request_id=req.request_id, technician_id=technician.user_id,
            amount=subtotal, tax_rate=DEFAULT_TAX_RATE, tax_amount=tax, total_amount=total,
            note=("يشمل الفحص وأجرة العمل؛ تُتفق تكلفة القطع الإضافية قبل التركيب. / Inspection and labour included; extra parts agreed before fitting."
                  if index == 0 else "يشمل أجرة العمل والمواد الاستهلاكية البسيطة. / Labour and minor consumables included."),
            status=offer_status, created_at=created + timedelta(minutes=30 + index * 20),
        )
        db.session.add(offer)
        _event(req, "pending", "offer_sent", technician, offer.created_at, a=technician.user_id)
        if chosen:
            accepted = offer
    db.session.flush()
    if accepted is not None:
        tech = technicians[0]
        req.technician_id = tech.user_id
        selected_at = created + timedelta(hours=2)
        db.session.add(Invoice(
            request_id=req.request_id, offer_id=accepted.offer_id,
            subtotal=accepted.amount, tax_rate=accepted.tax_rate,
            tax_amount=accepted.tax_amount, total=accepted.total_amount,
            invoice_number=f"INV-DEMO-{now.year}-{req.request_id:06d}",
            issued_at=selected_at, payment_status="paid" if paid else "pending",
        ))
        db.session.add(Payment(
            request_id=req.request_id, amount=accepted.total_amount,
            method="credit_card", transaction_id=f"DEMO-PAY-{req.request_id:06d}",
            status="completed" if paid else "pending", created_at=selected_at,
        ))
        _event(req, "assigned", "offer_chosen", customer, selected_at, m=money_str(accepted.amount))
        if status in {"in_progress", "completed"}:
            _event(req, "in_progress", "work_started", tech, work_time, m=money_str(accepted.total_amount))
        if paid:
            _event(req, "in_progress", "payment_done", customer, created + timedelta(hours=4), m=money_str(accepted.total_amount))
        if status == "completed":
            _event(req, "completed", "work_completed", tech, req.completed_at)
            if rated:
                stars, comment = REVIEWS[serial % len(REVIEWS)]
                at = created + timedelta(hours=6)
                db.session.add(TechnicianRating(
                    request_id=req.request_id, customer_id=customer.user_id,
                    technician_id=tech.user_id, stars=stars, comment=comment, created_at=at,
                ))
                _event(req, "completed", "rating_added", customer, at, s=stars)
    elif status == "cancelled":
        db.session.add(RequestTimeline(
            request_id=req.request_id, status="cancelled", actor_id=customer.user_id,
            note="ألغي الطلب بعد تغيير موعد الانتقال. / Cancelled after the moving date changed.",
            created_at=created + timedelta(hours=2),
        ))


def populate_demo(*, reset_demo: bool = False, reset_all: bool = False,
                  now: datetime | None = None) -> bool:
    """Populate the current app's session. Caller owns backup, commit and rollback."""
    now = (now or datetime.utcnow()).replace(microsecond=0)
    if reset_demo and reset_all:
        raise ValueError("Choose either reset_demo or reset_all.")
    if not (reset_demo or reset_all):
        if AuditLog.query.filter_by(action=SEED_MARKER).first():
            return False
        if User.query.filter(User.email.in_(DEMO_EMAILS)).first():
            raise RuntimeError("Existing demo accounts found. Use --reset-demo to replace their requests.")
    else:
        _clear_records(all_records=reset_all)
    specs = []
    for ar, en in SPECIALIZATIONS:
        spec = Specialization.query.filter_by(name_ar=ar).first()
        if spec is None:
            spec = Specialization(name_ar=ar, name_en=en)
            db.session.add(spec)
        specs.append(spec)
    db.session.flush()
    admin = _user("admin.demo", "سليم مراد", "Salim Murad", "admin", 2, 1, now)
    customers = [_user(local, ar, en, "customer", loc, 101 + i, now)
                 for i, (local, ar, en, loc) in enumerate(CUSTOMERS)]
    techs = [_user(local, ar, en, "technician", loc, 201 + i, now,
                   specs[trade].spec_id, bio)
             for i, (local, ar, en, loc, trade, bio) in enumerate(TECHNICIANS)]
    serial = 0
    for trade, spec in enumerate(specs):
        pair = techs[trade * 2:trade * 2 + 2]
        for history in range(4):
            serial += 1
            selected = pair if history % 2 == 0 else pair[::-1]
            _job(customer=customers[history % len(customers)], technicians=selected,
                 spec=spec, trade=trade, variant=history, status="completed", serial=serial,
                 now=now, age_days=3 + history * 14 + trade, paid=True,
                 rated=not (trade == 0 and history in {0, 1}))
        for variant, status in enumerate(("pending", "pending", "assigned", "in_progress")):
            serial += 1
            customer = customers[0] if trade == 0 else customers[(trade + variant) % len(customers)]
            _job(customer=customer, technicians=pair, spec=spec, trade=trade,
                 variant=variant, status=status, serial=serial, now=now,
                 paid=status == "in_progress" and trade % 2 == 1,
                 offer_count=0 if status == "pending" and variant == 1 else 2)
    for trade in (1, 2):
        serial += 1
        _job(customer=customers[trade], technicians=techs[trade * 2:trade * 2 + 2],
             spec=specs[trade], trade=trade, variant=4, status="cancelled",
             serial=serial, now=now, age_days=8 + trade, offer_count=1)
    db.session.add(AuditLog(admin_id=admin.user_id, action=SEED_MARKER,
                            target_type="demo_dataset", created_at=now))
    db.session.flush()
    return True


def seed_demo(reset_demo: bool = False, *, reset_all: bool = False) -> None:
    from app import app
    with app.app_context():
        try:
            if reset_all or reset_demo:
                if db.engine.url.host not in {"localhost", "127.0.0.1", "::1"}:
                    raise RuntimeError("Replacement is restricted to a local development database.")
                known = set(db.metadata.tables) | {"alembic_version"}
                extra = set(inspect(db.engine).get_table_names()) - known
                if extra:
                    raise RuntimeError(f"Unrecognized tables; refusing partial replacement: {sorted(extra)}")
                engines = db.session.execute(text(
                    "SELECT ENGINE FROM information_schema.TABLES "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'"
                )).scalars().all()
                if any(engine != "InnoDB" for engine in engines):
                    raise RuntimeError("Replacement requires transactional InnoDB tables.")
                db.session.rollback()
                path = backup_database()
                print(f"Backup saved: {path}", flush=True)
            changed = populate_demo(reset_demo=reset_demo, reset_all=reset_all)
            db.session.commit()
        except Exception:
            db.session.rollback()
            raise
        print("Damascus mock data ready." if changed else "Dataset already loaded; no records changed.")
        print(f"Users: {User.query.count()} | Requests: {ServiceRequest.query.count()}")
        for email in (DEMO_EMAILS[0], DEMO_EMAILS[1], "tech.ahmad@upkeep.local"):
            print(f"Login: {email} / {DEMO_PASSWORD}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--reset-demo", action="store_true",
                       help="Back up MySQL, replace demo customers' requests and refresh demo accounts.")
    group.add_argument("--reset-all", action="store_true",
                       help="Back up local MySQL, replace ALL application records, preserve schema and uploads.")
    args = parser.parse_args()
    seed_demo(args.reset_demo, reset_all=args.reset_all)
