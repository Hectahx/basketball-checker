# Basketball Booker

Web app for checking Sport Aston availability, booking slots manually, and running configurable auto-booking rules.

## Backend

```bash
source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
python run_web.py
```

The API runs on `http://localhost:8000`. Set `APP_PASSWORD` in `.env`; if omitted, the development default is `admin`.

On a new database, `APP_PASSWORD` creates the initial `admin` account (username: `admin`). Sign in there and use the **Users** tab to create regular user accounts. Rules, manual booking records, and history are private to the account that created them; admins can view all records. Each user chooses their desired days and time window in their own auto-booking rules.

Each new user can use the admin's shared Aston account or add a private Aston account from **Accounts**. Private Aston credentials and Discord webhooks are encrypted at rest; set a strong `APP_SECRET` and preferably a distinct `CREDENTIAL_ENCRYPTION_KEY`. A rule can request 1–4 consecutive hourly slots and set a preferred start time. Preferred starts are strict by default, so a user whose preferred slot is unavailable does not take another user's preferred slot. Every provider slot is locked per Aston account before booking, preventing shared-account races.

Admins can create a seven-day, one-time invite link in **Users** and choose whether it grants shared Aston access. Invitees may use the shared account, add their own account, or do both. The **My holds** view records successful Aston holds as awaiting payment; payment remains entirely in Sport Aston.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The UI runs on `http://localhost:5173` and talks to the backend at `http://localhost:8000`.

## Rules

Rules are aggressive by design: when a rule runs, every available slot matching the selected sport, halls, days, time window, lookahead, and optional max price is booked immediately. The app records checks and booking attempts in SQLite.

The scheduler runs once per minute and executes enabled rules whose `run_interval_minutes` has elapsed. Set `SCHEDULER_ENABLED=false` to disable background runs while testing.

For rules sharing an Aston account, the scheduler allocates availability in one account-wide pass rather than booking in rule order: exact preferred starts are considered first, then opted-in fallbacks, then rules without a preferred time. This prevents a fallback from taking another user's preferred session.

## Current CLI

The original CLI scripts are still present, so the existing cron jobs can keep running until the web app has been verified and you are ready to remove or replace them.

## Legacy Discord checker maintenance

The host crontab uses `venv/bin/python` (not `.venv`) for the original CLI: daily availability at 08:00, and the existing Saturday/Sunday midnight basketball booking job. Preserve these separately; running `main.py basketball no` only checks, while `basketball yes` can book.

After a host Python upgrade, an old virtual environment can point at the new interpreter while retaining packages under the previous Python version. On 14 November 2026 this caused `ModuleNotFoundError: requests`. Restore CLI dependencies for the current interpreter with:

```bash
./venv/bin/python -m ensurepip --upgrade
./venv/bin/python -m pip install requests==2.32.3 python-dotenv==1.0.1 pytz
./venv/bin/python -m pip check
```

Verify Aston retrieval and the Discord webhook HTTP result; the legacy notifier does not itself validate webhook success. Do not print webhook URLs or credentials. A manual availability check does not authorize an extra booking run.
