import { useState, useEffect, useMemo } from 'react';
import api from '../lib/api';
import { formatCurrency } from '../lib/currency';
import {
  Truck, Users, Navigation, Wrench, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, IndianRupee,
  Activity, Search
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import {
  PieChart, Pie, Cell, Legend, Tooltip,
  ResponsiveContainer
} from 'recharts';

// ─── KPI Card ───────────────────────────────────────────────────────────────
const KpiCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="card p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-bold text-gray-900 truncate">{value ?? '—'}</p>
      <p className="text-sm font-medium text-gray-600 leading-tight">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Pie chart custom label ──────────────────────────────────────────────────
const PIE_COLORS_VEHICLE = ['#22c55e', '#3b82f6', '#f59e0b', '#6b7280'];
const PIE_COLORS_TRIP    = ['#6b7280', '#3b82f6', '#22c55e', '#ef4444'];

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.6;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
      fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ─── Format duration ─────────────────────────────────────────────────────────
const formatDuration = (ms) => {
  if (ms == null || ms < 0) return '—';
  const totalMinutes = Math.floor(ms / 60000);
  if (totalMinutes < 1) return '< 1 min';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

// ─── Get trip time ───────────────────────────────────────────────────────────
const getTripTime = (trip, now) => {
  if (trip.status === 'Completed' && trip.dispatched_at && trip.completed_at) {
    const duration = new Date(trip.completed_at) - new Date(trip.dispatched_at);
    return { label: formatDuration(duration), tag: 'completed' };
  }
  if (trip.status === 'Dispatched' && trip.dispatched_at) {
    const elapsed = now - new Date(trip.dispatched_at);
    return { label: formatDuration(elapsed), tag: 'live' };
  }
  return { label: '—', tag: 'none' };
};

// ─── Filter options ──────────────────────────────────────────────────────────
const VEHICLE_STATUSES = ['Available', 'On Trip', 'In Shop', 'Retired'];

// ─── Main Component ──────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredTrips = useMemo(() => {
    if (!data?.recentTrips) return [];
    return data.recentTrips.filter(t => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        t.trip_number?.toLowerCase().includes(q) ||
        t.vehicle_name?.toLowerCase().includes(q) ||
        t.driver_name?.toLowerCase().includes(q) ||
        t.source?.toLowerCase().includes(q) ||
        t.destination?.toLowerCase().includes(q);
      const matchStatus = !filterStatus || t.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [data, search, filterStatus]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
    </div>
  );

  const k = data?.kpis || {};

  const vehiclePieData = [
    { name: 'Available', value: parseInt(k.available_vehicles) || 0 },
    { name: 'On Trip', value: parseInt(k.on_trip_vehicles) || 0 },
    { name: 'In Shop', value: parseInt(k.in_maintenance_vehicles) || 0 },
    { name: 'Retired', value: parseInt(k.retired_vehicles) || 0 },
  ].filter(d => d.value > 0);

  const tripPieData = [
    { name: 'Draft', value: parseInt(k.pending_trips) || 0 },
    { name: 'Dispatched', value: parseInt(k.active_trips) || 0 },
    { name: 'Completed', value: parseInt(k.completed_trips) || 0 },
    { name: 'Cancelled', value: parseInt(k.cancelled_trips) || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fleet operations overview</p>
      </div>

      {/* Search + Filter */}
      <div className="card p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="input pl-9 w-full"
            placeholder="Search trips by number, vehicle, driver, route…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="">Filter by Trip Status</option>
          {VEHICLE_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Alerts */}
      {(parseInt(k.expired_licenses) > 0 || parseInt(k.expiring_soon) > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {parseInt(k.expired_licenses) > 0 && (
            <div className="card p-4 flex items-center gap-3 border-l-4 border-red-500">
              <AlertTriangle size={20} className="text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-700">Expired Licenses</p>
                <p className="text-xs text-gray-500">{k.expired_licenses} driver(s) with expired licenses</p>
              </div>
            </div>
          )}
          {parseInt(k.expiring_soon) > 0 && (
            <div className="card p-4 flex items-center gap-3 border-l-4 border-amber-500">
              <AlertTriangle size={20} className="text-amber-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-700">Licenses Expiring Soon</p>
                <p className="text-xs text-gray-500">{k.expiring_soon} driver(s) expiring within 30 days</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Vehicles" value={k.total_vehicles} icon={Truck} color="bg-primary-600" />
        <KpiCard label="Available" value={k.available_vehicles} icon={CheckCircle2} color="bg-green-500" />
        <KpiCard label="On Trip" value={k.on_trip_vehicles} icon={Navigation} color="bg-blue-500" />
        <KpiCard label="In Maintenance" value={k.in_maintenance_vehicles} icon={Wrench} color="bg-amber-500" />
        <KpiCard label="Active Trips" value={k.active_trips} icon={Activity} color="bg-blue-600" />
        <KpiCard label="Pending Trips" value={k.pending_trips} icon={Clock} color="bg-gray-500" />
        <KpiCard label="Drivers On Duty" value={k.drivers_on_duty} icon={Users} color="bg-indigo-500" />
        <KpiCard
          label="Fleet Utilization"
          value={k.fleet_utilization_pct ? `${k.fleet_utilization_pct}%` : '0%'}
          icon={TrendingUp}
          color="bg-purple-500"
          sub="On Trip / Active"
        />
      </div>

      {/* Cost KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Fuel Cost" value={formatCurrency(k.total_fuel_cost || 0)} icon={IndianRupee} color="bg-orange-500" />
        <KpiCard label="Maintenance" value={formatCurrency(k.total_maintenance_cost || 0)} icon={Wrench} color="bg-red-500" />
        <KpiCard label="Total Operating" value={formatCurrency(k.total_operational_cost || 0)} icon={TrendingUp} color="bg-purple-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Vehicle Status</h3>
          {vehiclePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={vehiclePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={85}
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {vehiclePieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS_VEHICLE[i % PIE_COLORS_VEHICLE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Truck size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No vehicle data</p>
            </div>
          )}
        </div>

        <div className="card p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Trip Status</h3>
          {tripPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={tripPieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius={85}
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {tripPieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS_TRIP[i % PIE_COLORS_TRIP.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend iconType="circle" iconSize={10} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Navigation size={32} className="mb-2 opacity-30" />
              <p className="text-sm">No trip data</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Trips */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">Recent Trips</h3>
            {filteredTrips.length > 0 && (
              <span className="text-xs text-gray-400">{filteredTrips.length} result{filteredTrips.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          {filteredTrips.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-head">Trip</th>
                    <th className="table-head">Vehicle</th>
                    <th className="table-head">Driver</th>
                    <th className="table-head">Status</th>
                    <th className="table-head">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredTrips.map(t => (
                    <tr key={t.trip_number} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <p className="font-mono text-xs font-semibold text-gray-800">{t.trip_number}</p>
                        <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[100px]">{t.source} → {t.destination}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-xs font-medium text-gray-800 truncate max-w-[90px]">{t.vehicle_name}</p>
                        {t.registration_number && (
                          <p className="text-xs text-gray-400 font-mono">{t.registration_number}</p>
                        )}
                      </td>
                      <td className="table-cell">
                        <p className="text-xs text-gray-700 truncate max-w-[90px]">{t.driver_name}</p>
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={t.status} />
                      </td>
                      <td className="table-cell">
                        {(() => {
                          const { label, tag } = getTripTime(t, now);
                          if (tag === 'live') return (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
                              <Clock size={11} className="animate-pulse" />
                              {label}
                            </span>
                          );
                          if (tag === 'completed') return (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
                              <CheckCircle2 size={11} />
                              {label}
                            </span>
                          );
                          return <span className="text-xs text-gray-400">—</span>;
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Navigation size={28} className="mb-2 opacity-30" />
              <p className="text-sm">
                {search || filterStatus ? 'No trips match your filters' : 'No recent trips'}
              </p>
            </div>
          )}
        </div>

        {/* Vehicles In Shop */}
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Vehicles In Shop</h3>
          </div>
          {data?.vehiclesInShop?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-head">Vehicle</th>
                    <th className="table-head">Work Type</th>
                    <th className="table-head">Scheduled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.vehiclesInShop.map((v, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell">
                        <p className="font-medium text-xs text-gray-800">{v.name}</p>
                        <p className="text-xs text-gray-400 font-mono">{v.registration_number}</p>
                      </td>
                      <td className="table-cell">
                        <span className="badge badge-warning">{v.maintenance_type}</span>
                      </td>
                      <td className="table-cell text-xs">
                        {v.scheduled_date ? new Date(v.scheduled_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <Wrench size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No vehicles in maintenance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
