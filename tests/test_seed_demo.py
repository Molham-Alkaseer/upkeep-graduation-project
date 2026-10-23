"""Exercise replacement and workflow integrity in an isolated SQLite database."""
from collections import Counter
from datetime import datetime
from decimal import Decimal
import unittest
from unittest.mock import patch

from flask import Flask
from sqlalchemy import event
from werkzeug.security import check_password_hash

from models import (
    db, User, ServiceRequest, Specialization, TechnicianOffer, Invoice,
    Payment, TechnicianRating, RequestTimeline, AuditLog,
)
from seed_demo import populate_demo
from seed_demo_data import DEMO_EMAILS, DEMO_PASSWORD
from service_request_actions import (
    customer_choose_offer, technician_accept_request, customer_pay_request,
    technician_complete_request, customer_submit_rating,
)


class DemoSeedTests(unittest.TestCase):
    def setUp(self):
        self.app = Flask(__name__)
        self.app.config.update(SQLALCHEMY_DATABASE_URI="sqlite://",
                               SQLALCHEMY_TRACK_MODIFICATIONS=False)
        db.init_app(self.app)
        self.ctx = self.app.app_context()
        self.ctx.push()

        @event.listens_for(db.engine, "connect")
        def sqlite_options(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")
            connection.create_function("year", 1, lambda value: int(value[:4]) if value else None)

        db.create_all()
        self.now = datetime(2026, 10, 23, 12)
        populate_demo(now=self.now)
        db.session.commit()

    def tearDown(self):
        db.session.remove()
        db.drop_all()
        db.engine.dispose()
        self.ctx.pop()

    def test_accounts_coverage_and_financial_consistency(self):
        self.assertEqual({u.email for u in User.query.all()}, set(DEMO_EMAILS))
        self.assertEqual(Counter(u.role for u in User.query.all()),
                         {"admin": 1, "customer": 6, "technician": 8})
        for user in User.query.all():
            self.assertTrue(check_password_hash(user.hashed_pw, DEMO_PASSWORD))
            self.assertEqual(user.city, "دمشق")
            self.assertTrue(user.full_name_ar and user.full_name_en)
        self.assertEqual(Specialization.query.count(), 4)
        self.assertEqual(Counter(r.status for r in ServiceRequest.query.all()),
                         {"pending": 8, "assigned": 4, "in_progress": 4, "completed": 16, "cancelled": 2})
        self.assertEqual(Invoice.query.count(), 24)
        self.assertEqual(TechnicianRating.query.count(), 14)
        for req in ServiceRequest.query.all():
            with self.subTest(request=req.request_id):
                self.assertEqual(req.customer.role, "customer")
                self.assertEqual(req.city, "دمشق")
                self.assertTrue(33.48 < req.latitude < 33.54)
                self.assertTrue(36.24 < req.longitude < 36.32)
                self.assertLessEqual(req.location_captured_at, req.created_at)
                timeline = req.timeline_entries.all()
                self.assertEqual(timeline[0].status, "pending")
                self.assertEqual(timeline[-1].status, req.status)
                self.assertTrue(all(req.created_at <= t.created_at <= self.now for t in timeline))
                self.assertTrue(all(len(t.note) <= 255 for t in timeline))
                for offer in req.offers.all():
                    self.assertEqual(offer.technician.specialization_id, req.service_type)
                    expected_tax = (offer.amount * offer.tax_rate / 100).quantize(Decimal("0.01"))
                    self.assertEqual(offer.tax_amount, expected_tax)
                    self.assertEqual(offer.total_amount, offer.amount + offer.tax_amount)
                if req.status in {"pending", "cancelled"}:
                    self.assertIsNone(req.technician_id)
                    self.assertIsNone(req.invoice)
                    self.assertEqual(req.payments.count(), 0)
                    self.assertIsNone(req.rating)
                else:
                    self.assertEqual(req.technician.specialization_id, req.service_type)
                    accepted = req.offers.filter_by(status="accepted").one()
                    self.assertEqual(accepted.technician_id, req.technician_id)
                    self.assertEqual(req.invoice.offer_id, accepted.offer_id)
                    self.assertEqual(req.invoice.total, accepted.total_amount)
                    payment = req.payments.one()
                    self.assertEqual(payment.amount, req.invoice.total)
                    paid = req.payment_status == "completed"
                    self.assertEqual(payment.status, "completed" if paid else "pending")
                    self.assertEqual(req.invoice.payment_status, "paid" if paid else "pending")
                if req.status == "completed":
                    self.assertEqual(req.payment_status, "completed")
                    self.assertLessEqual(req.created_at, req.completed_at)
                else:
                    self.assertIsNone(req.completed_at)
                if req.rating:
                    self.assertEqual(req.rating.customer_id, req.customer_id)
                    self.assertEqual(req.rating.technician_id, req.technician_id)
                    self.assertGreater(req.rating.created_at, req.completed_at)

    def test_rerun_is_noop_and_reset_demo_preserves_unrelated_records(self):
        self.assertFalse(populate_demo(now=self.now))
        self.assertEqual(ServiceRequest.query.count(), 34)
        outsider = User(email="outside@example.test", hashed_pw="not-a-login",
                        full_name="Unrelated account", phone="000", role="customer")
        db.session.add(outsider)
        db.session.flush()
        req = ServiceRequest(customer_id=outsider.user_id,
                             service_type=Specialization.query.first().spec_id,
                             description="Unrelated request", status="pending")
        db.session.add(req)
        db.session.commit()
        outsider_id, request_id = outsider.user_id, req.request_id
        db.session.remove()
        self.assertTrue(populate_demo(reset_demo=True, now=self.now))
        db.session.commit()
        self.assertEqual(User.query.count(), 16)
        self.assertEqual(ServiceRequest.query.count(), 35)
        self.assertEqual(db.session.get(ServiceRequest, request_id).customer_id, outsider_id)
        self.assertEqual(AuditLog.query.count(), 1)

    def test_failed_replacement_rolls_back_old_data(self):
        ids = {r.request_id for r in ServiceRequest.query.all()}
        with patch("seed_demo._job", side_effect=RuntimeError("injected failure")):
            with self.assertRaisesRegex(RuntimeError, "injected failure"):
                populate_demo(reset_all=True, now=self.now)
        db.session.rollback()
        self.assertEqual({r.request_id for r in ServiceRequest.query.all()}, ids)
        self.assertEqual(User.query.count(), 15)
        self.assertEqual(Invoice.query.count(), 24)

    def test_full_replacement_removes_unrelated_accounts(self):
        db.session.add(User(email="old@example.test", hashed_pw="unused",
                            full_name="Old account", phone="000", role="customer"))
        db.session.commit()
        db.session.remove()
        self.assertTrue(populate_demo(reset_all=True, now=self.now))
        db.session.commit()
        self.assertIsNone(User.query.filter_by(email="old@example.test").first())
        self.assertEqual(User.query.count(), 15)
        self.assertEqual(ServiceRequest.query.count(), 34)
        self.assertEqual(Payment.query.count(), 24)
        self.assertEqual(TechnicianOffer.query.count(), 58)

    def test_seeded_pending_job_can_complete_real_workflow(self):
        customer = User.query.filter_by(email="customer.demo@upkeep.local").one()
        req = ServiceRequest.query.filter_by(customer_id=customer.user_id, status="pending").first()
        offer = req.offers.first()
        tech = offer.technician
        steps = (
            lambda: customer_choose_offer(customer, offer.offer_id),
            lambda: technician_accept_request(tech, req.request_id, {}),
            lambda: customer_pay_request(customer, req.request_id),
            lambda: technician_complete_request(tech, req.request_id),
            lambda: customer_submit_rating(customer, req.request_id, {"stars": 5, "comment": "Test review"}),
        )
        # The in-memory SQLite inspector shares the transaction connection; its
        # close rolls back writes. The table was explicitly created in setUp.
        with patch("service_request_actions.timeline_table_exists", return_value=True):
            for step in steps:
                result, code = step()
                self.assertEqual(code, 200, result)
        self.assertEqual(req.status, "completed")
        self.assertEqual(req.invoice.payment_status, "paid")
        self.assertEqual(req.rating.stars, 5)


if __name__ == "__main__":
    unittest.main()
