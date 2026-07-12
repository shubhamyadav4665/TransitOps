const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// GET /api/reports/dashboard  — KPIs for the main dashboard
router.get('/dashboard', async (req, res, next) => {
  try {
    const vehicles = await pool.query(`
      SELECT
        COUNT(*)                                          AS total_vehicles,
        COUNT(*) FILTER (WHERE status = 'Available')     AS available_vehicles,
        COUNT(*) FILTER (WHERE status = 'On Trip')       AS on_trip_vehicles,
        COUNT(*) FILTER (WHERE status = 'In Shop')       AS in_maintenance_vehicles,
        COUNT(*) FILTER (WHERE status = 'Retired')       AS retired_vehicles,
        ROUND(
          COUNT(*) FILTER (WHERE status = 'On Trip')::numeric /
          NULLIF(COUNT(*) FILTER (WHERE status != 'Retired'), 0) * 100, 1
        )                                                AS fleet_utilization_pct
      FROM vehicles
    `);

    const drivers = await pool.query(`
      SELECT
        COUNT(*)                                           AS total_drivers,
        COUNT(*) FILTER (WHERE status = 'On Trip')        AS drivers_on_duty,
        COUNT(*) FILTER (WHERE status = 'Available')      AS available_drivers,
        COUNT(*) FILTER (WHERE status = 'Suspended')      AS suspended_drivers,
        COUNT(*) FILTER (WHERE license_expiry_date < CURRENT_DATE) AS expired_licenses,
        COUNT(*) FILTER (
          WHERE license_expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30
        )                                                  AS expiring_soon
      FROM drivers
    `);

    const trips = await pool.query(`
      SELECT
        COUNT(*)                                            AS total_trips,
        COUNT(*) FILTER (WHERE status = 'Draft')           AS pending_trips,
        COUNT(*) FILTER (WHERE status = 'Dispatched')      AS active_trips,
        COUNT(*) FILTER (WHERE status = 'Completed')       AS completed_trips,
        COUNT(*) FILTER (WHERE status = 'Cancelled')       AS cancelled_trips,
        COALESCE(SUM(revenue) FILTER (WHERE status = 'Completed'), 0) AS total_revenue
      FROM trips
    `);

    const costs = await pool.query(`
      SELECT
        COALESCE(SUM(total_cost), 0) AS total_fuel_cost
      FROM fuel_logs
    `);

    const maintCosts = await pool.query(`
      SELECT COALESCE(SUM(cost), 0) AS total_maintenance_cost FROM maintenance_logs
    `);

    // Recent activity (last 5 trips)
    const recentTrips = await pool.query(`
      SELECT t.trip_number, t.source, t.destination, t.status,
             v.name AS vehicle_name, d.name AS driver_name, t.created_at
      FROM trips t
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN drivers d ON t.driver_id = d.id
      ORDER BY t.created_at DESC LIMIT 5
    `);

    // Vehicles needing attention (In Shop)
    const vehiclesInShop = await pool.query(`
      SELECT v.name, v.registration_number,
             ml.maintenance_type, ml.scheduled_date
      FROM maintenance_logs ml
      JOIN vehicles v ON ml.vehicle_id = v.id
      WHERE ml.status = 'Active'
      ORDER BY ml.scheduled_date ASC LIMIT 5
    `);

    res.json({
      success: true,
      kpis: {
        ...vehicles.rows[0],
        ...drivers.rows[0],
        ...trips.rows[0],
        total_fuel_cost: costs.rows[0].total_fuel_cost,
        total_maintenance_cost: maintCosts.rows[0].total_maintenance_cost,
        total_operational_cost:
          parseFloat(costs.rows[0].total_fuel_cost) +
          parseFloat(maintCosts.rows[0].total_maintenance_cost)
      },
      recentTrips: recentTrips.rows,
      vehiclesInShop: vehiclesInShop.rows
    });
  } catch (err) { next(err); }
});

// GET /api/reports/fleet-utilization
router.get('/fleet-utilization', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id, v.registration_number, v.name, v.type, v.status,
        COUNT(t.id) FILTER (WHERE t.status = 'Completed')       AS completed_trips,
        COALESCE(SUM(t.actual_distance), 0)                     AS total_distance_km,
        COALESCE(SUM(t.fuel_consumed), 0)                       AS total_fuel_liters,
        COALESCE(SUM(fl.total_cost), 0)                         AS total_fuel_cost,
        COALESCE(SUM(ml.cost), 0)                               AS total_maintenance_cost,
        COALESCE(SUM(t.revenue), 0)                             AS total_revenue,
        v.acquisition_cost
      FROM vehicles v
      LEFT JOIN trips t       ON t.vehicle_id = v.id AND t.status = 'Completed'
      LEFT JOIN fuel_logs fl  ON fl.vehicle_id = v.id
      LEFT JOIN maintenance_logs ml ON ml.vehicle_id = v.id
      GROUP BY v.id
      ORDER BY total_distance_km DESC
    `);

    const rows = result.rows.map(r => ({
      ...r,
      fuel_efficiency:
        parseFloat(r.total_fuel_liters) > 0
          ? parseFloat((parseFloat(r.total_distance_km) / parseFloat(r.total_fuel_liters)).toFixed(2))
          : null,
      operational_cost:
        parseFloat(r.total_fuel_cost) + parseFloat(r.total_maintenance_cost),
      vehicle_roi:
        parseFloat(r.acquisition_cost) > 0
          ? parseFloat((
              (parseFloat(r.total_revenue) -
                (parseFloat(r.total_maintenance_cost) + parseFloat(r.total_fuel_cost))) /
              parseFloat(r.acquisition_cost) * 100
            ).toFixed(2))
          : null
    }));

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/reports/fuel-efficiency
router.get('/fuel-efficiency', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id, v.registration_number, v.name, v.type,
        COALESCE(SUM(t.actual_distance), 0)   AS total_distance,
        COALESCE(SUM(t.fuel_consumed), 0)     AS total_fuel,
        COALESCE(SUM(fl.total_cost), 0)       AS total_fuel_cost,
        COALESCE(SUM(fl.liters), 0)           AS logged_liters,
        COUNT(t.id)                           AS trip_count
      FROM vehicles v
      LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status = 'Completed'
      LEFT JOIN fuel_logs fl ON fl.vehicle_id = v.id
      GROUP BY v.id
      HAVING COALESCE(SUM(t.fuel_consumed), 0) > 0 OR COALESCE(SUM(fl.liters), 0) > 0
      ORDER BY v.name
    `);

    const rows = result.rows.map(r => {
      const fuel = parseFloat(r.total_fuel) || parseFloat(r.logged_liters);
      return {
        ...r,
        fuel_efficiency_km_per_liter:
          fuel > 0 ? parseFloat((parseFloat(r.total_distance) / fuel).toFixed(2)) : null
      };
    });

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
});

// GET /api/reports/operational-costs
router.get('/operational-costs', async (req, res, next) => {
  try {
    const { from, to } = req.query;

    const fuelFilter  = from && to ? `AND fuel_date BETWEEN '${from}' AND '${to}'` : '';
    const maintFilter = from && to ? `AND created_at::date BETWEEN '${from}' AND '${to}'` : '';
    const expFilter   = from && to ? `AND expense_date BETWEEN '${from}' AND '${to}'` : '';

    const result = await pool.query(`
      SELECT
        v.id, v.registration_number, v.name, v.type,
        v.acquisition_cost,
        COALESCE(fl_agg.fuel_cost, 0)   AS fuel_cost,
        COALESCE(ml_agg.maint_cost, 0)  AS maintenance_cost,
        COALESCE(ex_agg.other_cost, 0)  AS other_expenses,
        COALESCE(t_agg.revenue, 0)      AS revenue
      FROM vehicles v
      LEFT JOIN (
        SELECT vehicle_id, SUM(total_cost) AS fuel_cost
        FROM fuel_logs WHERE 1=1 ${fuelFilter}
        GROUP BY vehicle_id
      ) fl_agg ON fl_agg.vehicle_id = v.id
      LEFT JOIN (
        SELECT vehicle_id, SUM(cost) AS maint_cost
        FROM maintenance_logs WHERE 1=1 ${maintFilter}
        GROUP BY vehicle_id
      ) ml_agg ON ml_agg.vehicle_id = v.id
      LEFT JOIN (
        SELECT vehicle_id, SUM(amount) AS other_cost
        FROM expenses WHERE category NOT IN ('Fuel','Maintenance') ${expFilter}
        GROUP BY vehicle_id
      ) ex_agg ON ex_agg.vehicle_id = v.id
      LEFT JOIN (
        SELECT vehicle_id, SUM(revenue) AS revenue
        FROM trips WHERE status = 'Completed'
        GROUP BY vehicle_id
      ) t_agg ON t_agg.vehicle_id = v.id
      ORDER BY v.name
    `);

    const rows = result.rows.map(r => ({
      ...r,
      total_cost: parseFloat(r.fuel_cost) + parseFloat(r.maintenance_cost) + parseFloat(r.other_expenses),
      vehicle_roi:
        parseFloat(r.acquisition_cost) > 0
          ? parseFloat((
              (parseFloat(r.revenue) - (parseFloat(r.fuel_cost) + parseFloat(r.maintenance_cost))) /
              parseFloat(r.acquisition_cost) * 100
            ).toFixed(2))
          : null
    }));

    // Totals row
    const totals = rows.reduce(
      (acc, r) => ({
        total_fuel_cost: acc.total_fuel_cost + parseFloat(r.fuel_cost),
        total_maint_cost: acc.total_maint_cost + parseFloat(r.maintenance_cost),
        total_other: acc.total_other + parseFloat(r.other_expenses),
        total_revenue: acc.total_revenue + parseFloat(r.revenue),
        grand_total_cost: acc.grand_total_cost + r.total_cost
      }),
      { total_fuel_cost: 0, total_maint_cost: 0, total_other: 0, total_revenue: 0, grand_total_cost: 0 }
    );

    res.json({ success: true, data: rows, totals });
  } catch (err) { next(err); }
});

// GET /api/reports/driver-performance
router.get('/driver-performance', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        d.id, d.name, d.license_number, d.license_category, d.safety_score, d.status,
        d.license_expiry_date,
        COUNT(t.id) FILTER (WHERE t.status = 'Completed')  AS completed_trips,
        COUNT(t.id) FILTER (WHERE t.status = 'Cancelled')  AS cancelled_trips,
        COALESCE(SUM(t.actual_distance), 0)                AS total_distance,
        COALESCE(SUM(t.revenue), 0)                        AS total_revenue,
        CASE WHEN d.license_expiry_date < CURRENT_DATE THEN true ELSE false END AS license_expired
      FROM drivers d
      LEFT JOIN trips t ON t.driver_id = d.id
      GROUP BY d.id
      ORDER BY d.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) { next(err); }
});

// GET /api/reports/export/vehicles  — CSV export
router.get('/export/vehicles', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        v.registration_number, v.name, v.model, v.type, v.status,
        v.max_load_capacity, v.odometer, v.acquisition_cost, v.region, v.year, v.fuel_type,
        COALESCE(fl_agg.fuel_cost, 0)  AS total_fuel_cost,
        COALESCE(ml_agg.maint_cost, 0) AS total_maintenance_cost,
        COALESCE(t_agg.revenue, 0)     AS total_revenue,
        COALESCE(t_agg.trips, 0)       AS total_trips
      FROM vehicles v
      LEFT JOIN (SELECT vehicle_id, SUM(total_cost) AS fuel_cost FROM fuel_logs GROUP BY vehicle_id) fl_agg ON fl_agg.vehicle_id = v.id
      LEFT JOIN (SELECT vehicle_id, SUM(cost) AS maint_cost FROM maintenance_logs GROUP BY vehicle_id) ml_agg ON ml_agg.vehicle_id = v.id
      LEFT JOIN (SELECT vehicle_id, SUM(revenue) AS revenue, COUNT(*) AS trips FROM trips WHERE status='Completed' GROUP BY vehicle_id) t_agg ON t_agg.vehicle_id = v.id
      ORDER BY v.registration_number
    `);

    const headers = [
      'Registration', 'Name', 'Model', 'Type', 'Status',
      'Max Load (kg)', 'Odometer', 'Acquisition Cost',
      'Region', 'Year', 'Fuel Type',
      'Total Fuel Cost', 'Total Maintenance Cost', 'Total Revenue', 'Total Trips'
    ];

    const csv = [
      headers.join(','),
      ...result.rows.map(r =>
        [
          r.registration_number, `"${r.name}"`, `"${r.model || ''}"`, r.type, r.status,
          r.max_load_capacity, r.odometer, r.acquisition_cost,
          r.region || '', r.year || '', r.fuel_type,
          r.total_fuel_cost, r.total_maintenance_cost, r.total_revenue, r.total_trips
        ].join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transitops_vehicles.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

// GET /api/reports/export/trips  — CSV export
router.get('/export/trips', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT
        t.trip_number, t.source, t.destination, t.status,
        v.registration_number AS vehicle, v.name AS vehicle_name,
        d.name AS driver, t.cargo_weight,
        t.planned_distance, t.actual_distance,
        t.fuel_consumed, t.revenue,
        t.start_odometer, t.end_odometer,
        t.dispatched_at, t.completed_at
      FROM trips t
      JOIN vehicles v ON t.vehicle_id = v.id
      JOIN drivers d ON t.driver_id = d.id
      ORDER BY t.created_at DESC
    `);

    const headers = [
      'Trip #', 'Source', 'Destination', 'Status', 'Vehicle Reg', 'Vehicle Name',
      'Driver', 'Cargo (kg)', 'Planned Dist', 'Actual Dist',
      'Fuel Consumed', 'Revenue', 'Start Odometer', 'End Odometer',
      'Dispatched At', 'Completed At'
    ];

    const csv = [
      headers.join(','),
      ...result.rows.map(r =>
        [
          r.trip_number, `"${r.source}"`, `"${r.destination}"`, r.status,
          r.vehicle, `"${r.vehicle_name}"`, `"${r.driver}"`,
          r.cargo_weight, r.planned_distance || '', r.actual_distance || '',
          r.fuel_consumed || '', r.revenue,
          r.start_odometer || '', r.end_odometer || '',
          r.dispatched_at ? new Date(r.dispatched_at).toLocaleString() : '',
          r.completed_at ? new Date(r.completed_at).toLocaleString() : ''
        ].join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transitops_trips.csv"');
    res.send(csv);
  } catch (err) { next(err); }
});

module.exports = router;
