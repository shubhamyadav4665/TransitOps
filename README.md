# 🚚 TransitOps — Smart Transport Operations Platform

TransitOps is a full-stack fleet and transport operations management system that digitizes vehicle, driver, dispatch, maintenance, and expense tracking for a logistics fleet — replacing spreadsheets and logbooks with a centralized, rule-enforced platform and live operational visibility.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## ✨ Features

- **Role-based access control** — Fleet Manager, Dispatcher, Safety Officer, and Financial Analyst roles with distinct permissions
- **Dashboard** — live KPIs (active vehicles, fleet utilization, active/pending trips) with filters
- **Fleet Registry** — vehicle CRUD with capacity, odometer, and status tracking
- **Driver & Safety Profiles** — license validity checks, safety scores, suspension handling
- **Trip Dispatch** — full lifecycle (Draft → Dispatched → Completed/Cancelled) with live cargo capacity validation
- **Maintenance Tracking** — service logs with automatic vehicle status transitions (Available ↔ In Shop)
- **Fuel & Expense Management** — combined fuel logs and expense tracking with auto-computed operational costs
- **Analytics** — fuel efficiency, ROI, monthly revenue, and cost breakdown charts
- **Settings** — depot configuration and RBAC matrix reference
- JWT-based authentication with account lockout after repeated failed logins

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, Axios, Recharts, Tailwind CSS |
| Backend | Node.js, Express |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |

---

## 📁 Project Structure

```
TransitOps/
├── backend/          # Express API server
│   ├── src/
│   ├── .env.example
│   └── package.json
├── frontend/         # React (Vite) client
│   ├── src/
│   ├── .env
│   └── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- PostgreSQL (v14+)
- npm

### 1. Clone the repository

```bash
git clone https://github.com/shubhamyadav4665/TransitOps.git
cd TransitOps
```

### 2. Set up the backend

```bash
cd backend
npm install
cp .env.example .env
```

Update `backend/.env` with your PostgreSQL credentials and a JWT secret:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/transitops
JWT_SECRET=your_secret_key_here
PORT=5000
```

Create the database, then run migrations and seed demo data:

```bash
npm run migrate
npm run seed
```

Start the backend server:

```bash
npm run dev
```

### 3. Set up the frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173` (frontend) with the API running on `http://localhost:5000`.

---

## 👤 Demo Logins

| Role | Email | Password |
|---|---|---|
| Fleet Manager | fleetmanager@transitops.com | password123 |
| Dispatcher | dispatcher@transitops.com | password123 |
| Safety Officer | safety@transitops.com | password123 |
| Financial Analyst | finance@transitops.com | password123 |

---

## 🔐 Role Permissions

| Module | Fleet Manager | Dispatcher | Safety Officer | Financial Analyst |
|---|---|---|---|---|
| Fleet (Vehicles) | Full CRUD | View | View | View |
| Drivers | Full CRUD | — | Full CRUD | — |
| Trips | View | Full CRUD + Dispatch | View | — |
| Maintenance | Full CRUD | View | — | View |
| Fuel & Expenses | View | — | — | Full CRUD |
| Analytics | Full | — | — | Full |
| Settings | Full | View | View | View |

All modules are visible to every role for transparency; write actions remain restricted per the table above and are enforced on both frontend and backend.

---

## 📌 Key Business Rules

- Registration numbers and license numbers must be unique
- Vehicles that are `Retired` or `In Shop` cannot be assigned to a trip
- Drivers with expired licenses or `Suspended` status cannot be dispatched
- Cargo weight is validated against vehicle capacity before dispatch (client + server-side)
- Dispatching a trip atomically sets both vehicle and driver status to `On Trip`
- Completing or cancelling a trip restores vehicle and driver availability
- Creating an active maintenance record automatically sets the vehicle to `In Shop`
- Total Operational Cost per vehicle is auto-computed from fuel, maintenance, and other expenses — never entered manually

---

## 📄 License

This project is licensed under the MIT License.