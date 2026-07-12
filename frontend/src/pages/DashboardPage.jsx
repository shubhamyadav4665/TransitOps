import { useState, useEffect } from 'react';
import api from '../lib/api';
import {
  Truck, Users, Navigation, Wrench, TrendingUp,
  AlertTriangle, CheckCircle2, Clock, DollarSign,
  Activity
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const KpiCard = ({ label, value, sub, icon: Icon, color }) => (
  <div className="card p-5 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={22} className="text-white" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      <p className="text-sm font-medium text-gray-600">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const PIE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#6b7280'];

export default function DashboardPage() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/reports/dashboard')
      .then(r => setData(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
    </div>
  );

  const k = data?.kpis || {};

  const vehiclePieData = [
    { name: 'Available',    value: parseInt(k.available_vehicles)    || 0 },
    { name: 'On Trip',      value: parseInt(k.on_trip_vehicles)      || 0 },
    { name: 'In Shop',      value: parseInt(k.in_maintenance_vehicles)|| 0 },
    { name: 'Retired',      value: parseInt(k.retired_vehicles)       || 0 },
  ].filter(d => d.value > 0);

  const tripPieData = [
    { name: 'Draft',      value: parseInt(k.pending_trips)    || 0 },
    { name: 'Dispatched', value: parseInt(k.active_trips)     || 0 },
    { name: 'Completed',  value: parseInt(k.completed_trips)  || 0 },
    { name: 'Cancelled',  value: parseInt(k.cancelled_trips)  || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Fleet operations overview</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Vehicles"      value={k.total_vehicles}          icon={Truck}        color="bg-primary-600" />
        <KpiCard label="Available Vehicles"  value={k.available_vehicles}      icon={CheckCircle2} color="bg-green-500" />
        <KpiCard label="Vehicles On Trip"    value={k.on_trip_vehicles}        icon={Navigation}   color="bg-blue-500" />
        <KpiCard label="In Maintenance"      value={k.in_maintenance_vehicles} icon={Wrench}       color="bg-amber-500" />
        <KpiCard label="Active Trips"        value={k.active_trips}            icon={Activity}     color="bg-blue-600" />
        <KpiCard label="Pending Trips"       value={k.pending_trips}           icon={Clock}        color="bg-gray-500" />
        <KpiCard label="Drivers On Duty"     value={k.drivers_on_duty}         icon={Users}        color="bg-indigo-500" />
        <KpiCard
          label="Fleet Utilization"
          value={k.fleet_utilization_pct ? `${k.fleet_utilization_pct}%` : '0%'}
          icon={TrendingUp}
          color="bg-purple-500"
          sub="On Trip / Active Fleet"
        />
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

      {/* Cost KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KpiCard label="Total Fuel Cost"    value={`$${parseFloat(k.total_fuel_cost||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`} icon={DollarSign} color="bg-orange-500" />
        <KpiCard label="Maintenance Cost"   value={`$${parseFloat(k.total_maintenance_cost||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`} icon={Wrench} color="bg-red-500" />
        <KpiCard label="Total Operational"  value={`$${parseFloat(k.total_operational_cost||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}`} icon={TrendingUp} color="bg-purple-600" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Vehicle status pie */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Vehicle Status</h3>
          {vehiclePieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={vehiclePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {vehiclePieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No data</p>}
        </div>

        {/* Trip status pie */}
        <div className="card p-5">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Trip Status</h3>
          {tripPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={tripPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {tripPieData.map((_, i) => <Cell key={i} fill={['#6b7280','#3b82f6','#22c55e','#ef4444'][i]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : <p className="text-sm text-gray-400 text-center py-8">No data</p>}
        </div>
      </div>

      {/* Recent trips + vehicles in shop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Recent Trips</h3>
          </div>
          {data?.recentTrips?.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-head">Trip</th>
                  <th className="table-head">Route</th>
                  <th className="table-head">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recentTrips.map(t => (
                  <tr key={t.trip_number} className="hover:bg-gray-50">
                    <td className="table-cell font-mono text-xs">{t.trip_number}</td>
                    <td className="table-cell text-xs">{t.source} → {t.destination}</td>
                    <td className="table-cell"><StatusBadge status={t.status} type="trip" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-gray-400 text-center py-8">No recent trips</p>}
        </div>

        <div className="card">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">Vehicles In Shop</h3>
          </div>
          {data?.vehiclesInShop?.length > 0 ? (
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-head">Vehicle</th>
                  <th className="table-head">Work</th>
                  <th className="table-head">Scheduled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.vehiclesInShop.map((v, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <p className="font-medium text-xs">{v.name}</p>
                      <p className="text-xs text-gray-400">{v.registration_number}</p>
                    </td>
                    <td className="table-cell text-xs">{v.maintenance_type}</td>
                    <td className="table-cell text-xs">{v.scheduled_date ? new Date(v.scheduled_date).toLocaleDateString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-sm text-gray-400 text-center py-8">No vehicles in maintenance</p>}
        </div>
      </div>
    </div>
  );
}
