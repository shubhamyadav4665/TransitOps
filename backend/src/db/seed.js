require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

const seed = async () => {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding database...');

    // Roles
    await client.query(`
      INSERT INTO roles (name, description) VALUES
        ('Fleet Manager', 'Oversees fleet assets, maintenance, vehicle lifecycle, and operational efficiency'),
        ('Dispatcher', 'Creates trips, assigns vehicles and drivers, and monitors active deliveries'),
        ('Safety Officer', 'Ensures driver compliance, tracks license validity, and monitors safety scores'),
        ('Financial Analyst', 'Reviews operational expenses, fuel consumption, maintenance costs, and profitability')
      ON CONFLICT (name) DO NOTHING
    `);
    console.log('✅ Roles seeded.');

    const rolesRes = await client.query('SELECT id, name FROM roles');
    const roleMap = {};
    rolesRes.rows.forEach(r => { roleMap[r.name] = r.id; });

    // Users
    const passwordHash = await bcrypt.hash('password123', 10);
    await client.query(`
      INSERT INTO users (name, email, password_hash, role_id) VALUES
        ('Fleet Manager', 'fleet@transitops.com', $1, $2),
        ('John Dispatcher', 'dispatcher@transitops.com', $1, $3),
        ('Sara Safety', 'safety@transitops.com', $1, $4),
        ('Mike Finance', 'finance@transitops.com', $1, $5),
        ('Admin User', 'admin@transitops.com', $1, $2)
      ON CONFLICT (email) DO NOTHING
    `, [passwordHash, roleMap['Fleet Manager'], roleMap['Dispatcher'], roleMap['Safety Officer'], roleMap['Financial Analyst']]);
    console.log('✅ Users seeded. (password: password123 for all)');

    // Vehicles
    await client.query(`
      INSERT INTO vehicles (registration_number, name, model, type, max_load_capacity, odometer, acquisition_cost, status, region, year, fuel_type) VALUES
        ('TRK-001', 'Heavy Hauler Alpha', 'Volvo FH', 'Truck', 10000, 45230, 85000, 'Available', 'North', 2021, 'Diesel'),
        ('VAN-002', 'City Van Beta', 'Mercedes Sprinter', 'Van', 1500, 22100, 32000, 'Available', 'South', 2022, 'Diesel'),
        ('TRK-003', 'Cargo King', 'MAN TGX', 'Truck', 15000, 78500, 110000, 'On Trip', 'East', 2020, 'Diesel'),
        ('VAN-004', 'Quick Delivery', 'Ford Transit', 'Van', 800, 11200, 28000, 'In Shop', 'West', 2023, 'Petrol'),
        ('TRL-005', 'Mega Trailer', 'Scania R500', 'Trailer', 25000, 125000, 150000, 'Available', 'North', 2019, 'Diesel'),
        ('BUS-006', 'Staff Shuttle', 'Toyota Coaster', 'Bus', 500, 34000, 45000, 'Available', 'South', 2022, 'Diesel'),
        ('PKP-007', 'Rapid Pickup', 'Toyota Hilux', 'Pickup', 1000, 18700, 22000, 'Retired', 'East', 2018, 'Diesel'),
        ('TRK-008', 'Desert Runner', 'Isuzu NQR', 'Truck', 5000, 56800, 65000, 'Available', 'West', 2021, 'Diesel')
      ON CONFLICT (registration_number) DO NOTHING
    `);
    console.log('✅ Vehicles seeded.');

    // Drivers
    await client.query(`
      INSERT INTO drivers (name, license_number, license_category, license_expiry_date, contact_number, email, safety_score, status) VALUES
        ('Alex Johnson', 'DL-10001', 'Class A', '2026-08-15', '+1-555-0101', 'alex.j@example.com', 95.0, 'Available'),
        ('Maria Garcia', 'DL-10002', 'Class B', '2025-11-30', '+1-555-0102', 'maria.g@example.com', 88.5, 'On Trip'),
        ('David Chen', 'DL-10003', 'Class A', '2024-03-01', '+1-555-0103', 'david.c@example.com', 72.0, 'Available'),
        ('Sarah Williams', 'DL-10004', 'Class C', '2026-05-20', '+1-555-0104', 'sarah.w@example.com', 91.5, 'Off Duty'),
        ('James Brown', 'DL-10005', 'Class A', '2025-09-10', '+1-555-0105', 'james.b@example.com', 65.0, 'Suspended'),
        ('Linda Lee', 'DL-10006', 'Class B', '2027-01-25', '+1-555-0106', 'linda.l@example.com', 98.0, 'Available'),
        ('Robert Taylor', 'DL-10007', 'Class A', '2026-12-31', '+1-555-0107', 'robert.t@example.com', 84.0, 'Available')
      ON CONFLICT (license_number) DO NOTHING
    `);
    console.log('✅ Drivers seeded.');

    // Sample completed trip
    const vehicleRes = await client.query(`SELECT id FROM vehicles WHERE registration_number = 'TRK-001'`);
    const driverRes = await client.query(`SELECT id FROM drivers WHERE license_number = 'DL-10001'`);
    const userRes = await client.query(`SELECT id FROM users WHERE email = 'dispatcher@transitops.com'`);

    if (vehicleRes.rows.length && driverRes.rows.length && userRes.rows.length) {
      const vId = vehicleRes.rows[0].id;
      const dId = driverRes.rows[0].id;
      const uId = userRes.rows[0].id;

      await client.query(`
        INSERT INTO trips (trip_number, source, destination, vehicle_id, driver_id, cargo_weight, planned_distance, actual_distance, status, start_odometer, end_odometer, fuel_consumed, revenue, created_by, dispatched_at, completed_at)
        VALUES ('TRIP-0001', 'Warehouse A', 'Distribution Center B', $1, $2, 3500, 250, 258, 'Completed', 44972, 45230, 95.5, 1200, $3, NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day')
        ON CONFLICT (trip_number) DO NOTHING
      `, [vId, dId, uId]);

      // Fuel log for the trip
      const tripRes = await client.query(`SELECT id FROM trips WHERE trip_number = 'TRIP-0001'`);
      if (tripRes.rows.length) {
        await client.query(`
          INSERT INTO fuel_logs (vehicle_id, trip_id, liters, cost_per_liter, total_cost, odometer_reading, fuel_date, created_by)
          VALUES ($1, $2, 95.5, 1.42, 135.61, 45230, CURRENT_DATE - 1, $3)
        `, [vId, tripRes.rows[0].id, uId]);

        await client.query(`
          INSERT INTO expenses (vehicle_id, trip_id, category, description, amount, expense_date, created_by)
          VALUES ($1, $2, 'Toll', 'Highway toll charges', 25.00, CURRENT_DATE - 1, $3)
        `, [vId, tripRes.rows[0].id, uId]);
      }
    }

    // Sample maintenance
    const van004Res = await client.query(`SELECT id FROM vehicles WHERE registration_number = 'VAN-004'`);
    const uRes = await client.query(`SELECT id FROM users WHERE email = 'fleet@transitops.com'`);
    if (van004Res.rows.length && uRes.rows.length) {
      await client.query(`
        INSERT INTO maintenance_logs (vehicle_id, maintenance_type, description, cost, status, scheduled_date, technician, service_center, created_by)
        VALUES ($1, 'Engine Repair', 'Engine overhaul and oil change', 850.00, 'Active', CURRENT_DATE, 'Mike T.', 'AutoFix Service Center', $2)
      `, [van004Res.rows[0].id, uRes.rows[0].id]);
    }

    console.log('✅ Sample trips, fuel logs, expenses and maintenance seeded.');
    console.log('');
    console.log('🎉 Database seeded successfully!');
    console.log('');
    console.log('📋 Demo Accounts:');
    console.log('   fleet@transitops.com     / password123  (Fleet Manager)');
    console.log('   dispatcher@transitops.com / password123  (Dispatcher)');
    console.log('   safety@transitops.com    / password123  (Safety Officer)');
    console.log('   finance@transitops.com   / password123  (Financial Analyst)');
  } catch (err) {
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
