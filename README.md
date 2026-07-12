# TransitOps — Smart Transport Operations Platform

## Quick Start

### 1. Configure Database Password

Edit `backend/.env` and set your PostgreSQL password:

```
DB_PASSWORD=your_actual_postgres_password
```

### 2. Run Database Migration & Seed

```bash
cd backend
node src/db/migrate.js   # Creates 'transitops' DB + all tables
node src/db/seed.js      # Seeds roles, users, vehicles, drivers, sample data
```

### 3. Start Backend

```bash
cd backend
npm run dev     # Runs on http://localhost:5000
```

### 4. Start Frontend

```bash
cd frontend
npm run dev     # Runs on http://localhost:5173
```

---

## Demo Accounts (password: `password123`)

| Role             | Email                        |
|------------------|------------------------------|
| Fleet Manager    | fleet@transitops.com         |
| Dispatcher       | dispatcher@transitops.com    |
| Safety Officer   | safety@transitops.com        |
| Financial Analyst| finance@transitops.com       |

---

## Features

- **Authentication** — JWT login with Role-Based Access Control (RBAC)
- **Dashboard** — KPIs: Active Vehicles, Fleet Utilization %, Active Trips, Drivers On Duty, Costs
- **Vehicle Registry** — Full CRUD, status tracking (Available / On Trip / In Shop / Retired)
- **Driver Management** — Profiles, license expiry alerts, safety scores, status tracking
- **Trip Management** — Lifecycle: Draft → Dispatched → Completed / Cancelled with all business rule validations
- **Maintenance** — Log maintenance, auto sets vehicle to "In Shop", close to restore to "Available"
- **Fuel Logs** — Record fuel consumption per vehicle/trip with auto cost calculation
- **Expenses** — Track tolls, insurance, registration, and other operational expenses
- **Reports & Analytics** — Fleet Utilization, Fuel Efficiency (km/L), Operational Costs, Vehicle ROI, Driver Performance — with bar charts and CSV export

## Business Rules Enforced

- Vehicle registration numbers are unique
- Retired/In Shop vehicles never appear in dispatch selection
- Drivers with expired licenses or Suspended status cannot be assigned
- A vehicle/driver already On Trip cannot be double-assigned
- Cargo weight validated against vehicle max load capacity
- Dispatching auto-sets vehicle + driver to On Trip
- Completing a trip auto-restores vehicle + driver to Available
- Cancelling a dispatched trip restores vehicle + driver to Available
- Creating maintenance auto-sets vehicle to In Shop
- Closing maintenance restores vehicle to Available (unless Retired)

## Tech Stack

| Layer    | Technology |
|----------|-----------|
| Backend  | Node.js, Express 5, PostgreSQL (pg), JWT, bcryptjs |
| Frontend | React 18, Vite 5, Tailwind CSS 3, Recharts, Axios |
| Database | PostgreSQL 18 |
