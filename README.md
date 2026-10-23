# UpKeep

UpKeep is a web and mobile platform that connects customers with technicians for home and facility maintenance. It helps customers request services and track progress, enables technicians to manage offers and jobs, and provides administrators with tools to oversee the platform.

## Graduation project

This is my graduation project at **Arab Private University for Science and Technology**, submitted in fulfillment of the requirements for a degree in **Information Technology Engineering** on **22 June 2026 (22/06/2026)**.

## Features

- Customer, technician, and administrator accounts.
- Maintenance service requests with location, scheduling, and attachments.
- Technician offers and service progress tracking.
- Invoices and customer ratings.
- Technician profiles and portfolios.
- Arabic and English interfaces.
- Web application and companion mobile application.

## Technology

- **Backend:** Python, Flask, SQLAlchemy, and MySQL.
- **Web interface:** HTML templates, CSS, and JavaScript.
- **Mobile application:** React Native, Expo, and TypeScript.

See [the mobile README](mobile/README.md) for mobile setup instructions. Environment configuration examples are provided in `.env.example` files; create your own local `.env` files before running the applications.

## Repository description

UpKeep: a web and mobile maintenance services platform connecting customers with technicians. My graduation project at Arab Private University for Science and Technology for a degree in Information Technology Engineering, submitted on 22 June 2026.

## Damascus mock data

`seed_demo.py` loads a fictional Damascus dataset shared by the web and mobile apps:

- 1 administrator, 6 customers and 8 technicians with Arabic/English names.
- 4 trades: electrical, plumbing, carpentry and air conditioning.
- 34 requests: 8 pending, 4 assigned, 4 in progress, 16 completed and 2 cancelled.
- 58 offers, 24 invoices/payments and 14 reviews, with chronological activity timelines.
- Fictional addresses in six Damascus neighbourhoods, approximate map pins and illustrative SYP prices. Tax uses the app's configured `DEFAULT_TAX_RATE`; this dataset does not represent market prices or tax advice.

Use the project's Python environment after configuring MySQL and applying the migrations:

```powershell
# Replace ALL local application records. A real SQL backup is mandatory and automatic.
.\venv\Scripts\python.exe seed_demo.py --reset-all

# Load into a fresh database, or do nothing if this dataset is already installed.
.\venv\Scripts\python.exe seed_demo.py

# Refresh demo accounts and replace their customers' requests/technician portfolios.
# Other customers' requests and non-demo accounts are retained.
.\venv\Scripts\python.exe seed_demo.py --reset-demo
```

Replacement requires `mysqldump` on PATH and a local MySQL database using InnoDB. Backups are saved as `backup_before_mock_<timestamp>.sql` in the project directory and ignored by Git. Failed backups abort replacement; failed inserts roll back the replacement transaction. Existing schema, migration history and uploaded files are kept. Old uploads are not reused in the fictional dataset. Request and account IDs continue increasing.

Restore a backup with MySQL Workbench's **Server → Data Import → Import from Self-Contained File**, selecting the backup and the original database. The backup includes table definitions and data. The app's administrative backup/restore pages are legacy placeholders and should not be used for this recovery.

All demo accounts use password **`Demo1234`**. Sign out of existing web/mobile sessions and sign in with a new account:

| Role | Email | Name |
| --- | --- | --- |
| Administrator | `admin.demo@upkeep.local` | Salim Murad |
| Main customer | `customer.demo@upkeep.local` | Rami Al Khatib |
| Customer | `customer.sara@upkeep.local` | Sara Mansour |
| Customer | `customer.omar@upkeep.local` | Omar Al Hassan |
| Customer | `customer.nour@upkeep.local` | Nour Haddad |
| Customer | `customer.yara@upkeep.local` | Yara Darwish |
| Customer | `customer.karim@upkeep.local` | Karim Nasser |
| Electrician | `tech.ahmad@upkeep.local` | Ahmad Hammoud |
| Electrician | `tech.lina@upkeep.local` | Lina Abbas |
| Plumber | `tech.samer@upkeep.local` | Samer Youssef |
| Plumber | `tech.hala@upkeep.local` | Hala Mustafa |
| Carpenter | `tech.fadi@upkeep.local` | Fadi Suleiman |
| Carpenter | `tech.roula@upkeep.local` | Roula Saleh |
| AC technician | `tech.mazen@upkeep.local` | Mazen Ibrahim |
| AC technician | `tech.dima@upkeep.local` | Dima Murad |

The main customer can compare competing offers, start an assigned electrical job with Ahmad, pay for work in progress, and rate a completed job. Some pending requests have no offers yet, and two paid jobs await technician completion. For nearby-job testing, place the device near **33.5008, 36.2526** (Mezzeh, Damascus). Dates are relative to the time of seeding; rerun `--reset-demo` to refresh them. Edit `seed_demo_data.py` to customize names, job descriptions and prices.
