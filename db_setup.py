"""Utility script to initialise the database schema and seed essential data.

Run once (or whenever you drop the DB) with:

    python db_setup.py

It will:
1. Create the database and all SQLAlchemy-managed tables.
2. Insert baseline specialisations (if they don't already exist).
3. Provision an initial admin account (email: admin@upkeep.com, password: admin123).
"""

import os, sys, argparse
from werkzeug.security import generate_password_hash
import pymysql
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Step-0: Make sure the target database exists (otherwise SQLAlchemy will fail)
# ---------------------------------------------------------------------------

# Load environment variables from .env if present (keeps credentials in one place)
load_dotenv()

# -------------------------------------------------
# Optional CLI overrides for DB credentials
# Example: python db_setup.py --user root --password secret
# -------------------------------------------------
parser = argparse.ArgumentParser(add_help=False)
parser.add_argument('--user')
parser.add_argument('--password')
parser.add_argument('--host')
parser.add_argument('--dbname')
cli_args, _ = parser.parse_known_args()

# Fallback precedence: CLI > ENV > default
DB_USER = cli_args.user or os.getenv("DB_USER", "root")
DB_PASSWORD = cli_args.password or os.getenv("DB_PASSWORD", "")
DB_HOST = cli_args.host or os.getenv("DB_HOST", "localhost")
DB_NAME = cli_args.dbname or os.getenv("DB_NAME", "upkeep_db")

print(f"Connecting to MySQL as '{DB_USER}' on '{DB_HOST}' (DB_PASSWORD length={len(DB_PASSWORD)})")

def _ensure_database_exists() -> None:
    """Create the DB if it doesn't already exist (requires root-level creds)."""

    connection = pymysql.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        charset="utf8mb4",
        autocommit=True,
    )

    with connection.cursor() as cur:
        cur.execute(f"CREATE DATABASE IF NOT EXISTS {DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;")

    connection.close()


# Ensure DB is present before SQLAlchemy tries to connect
_ensure_database_exists()

# Importing the Flask app *after* the DB exists ensures SQLAlchemy can connect.
from app import app, db  # noqa: E402  (avoid circular import during runtime only)
from models import Specialization, User  # noqa: E402


def setup_database() -> None:
    """Create all tables through SQLAlchemy and seed initial records."""

    with app.app_context():
        # 1) Drop *everything* and recreate – DIRTY RESET
        db.drop_all()
        db.create_all()

        # 2) Seed specialisations
        default_specs = [
            ("كهربائي", "Electrician"),
            ("سباك", "Plumber"),
            ("نجار", "Carpenter"),
            ("فني تكييف", "AC Technician"),
        ]

        for name_ar, name_en in default_specs:
            if not Specialization.query.filter_by(name_ar=name_ar).first():
                db.session.add(Specialization(name_ar=name_ar, name_en=name_en))

        # 3) Ensure admin account exists and has a modern password hash
        admin = User.query.filter_by(email="admin@upkeep.com").first()
        if admin is None:
            admin = User(
                email="admin@upkeep.com",
                full_name="مدير النظام / System Admin",
                phone="0500000000",
                role="admin",
            )
            db.session.add(admin)

        # If the stored hash doesn't contain a method (old bcrypt value like $2b$...), replace it
        if not admin.hashed_pw or admin.hashed_pw.startswith("$2b$") or ":" not in admin.hashed_pw:
            admin.hashed_pw = generate_password_hash("admin123")

        db.session.commit()

        print("✅ Database schema created & initial data seeded successfully.")


if __name__ == "__main__":
    setup_database()