require('dotenv').config();
const { Pool } = require('pg');

// Connect to postgres (default db) first to create transitops db
const adminPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'transitops',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const createDatabase = async () => {
  const client = await adminPool.connect();
  try {
    const res = await client.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [process.env.DB_NAME || 'transitops']
    );
    if (res.rowCount === 0) {
      await client.query(`CREATE DATABASE ${process.env.DB_NAME || 'transitops'}`);
      console.log(`✅ Database '${process.env.DB_NAME || 'transitops'}' created.`);
    } else {
      console.log(`ℹ️  Database '${process.env.DB_NAME || 'transitops'}' already exists.`);
    }
  } finally {
    client.release();
    await adminPool.end();
  }
};

const schema = `
-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
  id SERIAL PRIMARY KEY,
  registration_number VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(150) NOT NULL,
  model VARCHAR(100),
  type VARCHAR(50) NOT NULL CHECK (type IN ('Truck', 'Van', 'Bus', 'Pickup', 'Tanker', 'Trailer', 'Other')),
  max_load_capacity NUMERIC(10,2) NOT NULL,
  odometer NUMERIC(10,2) DEFAULT 0,
  acquisition_cost NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'On Trip', 'In Shop', 'Retired')),
  region VARCHAR(100),
  year INTEGER,
  fuel_type VARCHAR(30) DEFAULT 'Diesel',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  license_number VARCHAR(100) UNIQUE NOT NULL,
  license_category VARCHAR(50) NOT NULL,
  license_expiry_date DATE NOT NULL,
  contact_number VARCHAR(20),
  email VARCHAR(200),
  safety_score NUMERIC(4,1) DEFAULT 100.0 CHECK (safety_score >= 0 AND safety_score <= 100),
  status VARCHAR(20) NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'On Trip', 'Off Duty', 'Suspended')),
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trips
CREATE TABLE IF NOT EXISTS trips (
  id SERIAL PRIMARY KEY,
  trip_number VARCHAR(50) UNIQUE NOT NULL,
  source VARCHAR(200) NOT NULL,
  destination VARCHAR(200) NOT NULL,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE RESTRICT,
  cargo_weight NUMERIC(10,2) NOT NULL,
  planned_distance NUMERIC(10,2),
  actual_distance NUMERIC(10,2),
  status VARCHAR(20) NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Dispatched', 'Completed', 'Cancelled')),
  start_odometer NUMERIC(10,2),
  end_odometer NUMERIC(10,2),
  fuel_consumed NUMERIC(10,2),
  revenue NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  dispatched_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance Logs
CREATE TABLE IF NOT EXISTS maintenance_logs (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  maintenance_type VARCHAR(100) NOT NULL,
  description TEXT,
  cost NUMERIC(12,2) DEFAULT 0,
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed')),
  scheduled_date DATE,
  completed_date DATE,
  technician VARCHAR(150),
  service_center VARCHAR(200),
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Fuel Logs
CREATE TABLE IF NOT EXISTS fuel_logs (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE RESTRICT,
  trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
  liters NUMERIC(10,2) NOT NULL,
  cost_per_liter NUMERIC(8,2),
  total_cost NUMERIC(12,2) NOT NULL,
  odometer_reading NUMERIC(10,2),
  fuel_date DATE NOT NULL DEFAULT CURRENT_DATE,
  station_name VARCHAR(200),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expenses
CREATE TABLE IF NOT EXISTS expenses (
  id SERIAL PRIMARY KEY,
  vehicle_id INTEGER REFERENCES vehicles(id) ON DELETE SET NULL,
  trip_id INTEGER REFERENCES trips(id) ON DELETE SET NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('Toll', 'Maintenance', 'Fuel', 'Insurance', 'Registration', 'Other')),
  description TEXT,
  amount NUMERIC(12,2) NOT NULL,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);
CREATE INDEX IF NOT EXISTS idx_vehicles_region ON vehicles(region);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON maintenance_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_logs(status);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle_id ON fuel_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_expenses_vehicle_id ON expenses(vehicle_id);
`;

const migrate = async () => {
  await createDatabase();
  const client = await pool.connect();
  try {
    console.log('🚀 Running migrations...');
    await client.query(schema);
    console.log('✅ All tables created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
