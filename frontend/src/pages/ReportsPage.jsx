import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Legend
} from 'recharts';
import { Download, RefreshCw } from 'lucide-react';

const TABS = ['Fleet Utilization', 'Fuel Efficiency', 'Operational Costs', 'Driver Performance'];

const fmt = (n) => parseFloat(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n, d = 1) => parseFloat(n || 0).toFixed(d);

export default function ReportsPage() {
  const [tab, setTab]     = useState(0);
  const [data, setData]   = useState({});
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  const loadTab = (t = tab) => {
    setLoading(true);
    const endpoints = [
      '/reports/fleet-utilization',
      '/reports/fuel-efficiency',
      '/reports/operational-costs',
      '/reports/driver-performance',
    ];
    const params = dateRange.from && dateRange.to ? dateRange : {};
    api.get(endpoints[t], { params })
      .then(r => setData(d => ({ ...d, [t]: r.data })))
      .catch(() => toast.error('Failed to load report'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadTab(tab); }, [tab]);

  const exportCSV = async (type) => {
    try {
      const res = await api.get(`/reports/export/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a   = document.createElement('a');
      a.href    = url;
      a.download = `transitops_${type}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Export failed');
    }
  };

  const rows = data[tab]?.data || [];

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        subtitle="Operational insights and performance metrics"
        action={
          <div className="flex gap-2">
            <button className="btn-secondary btn-sm" onClick={() => exportCSV('vehicles')}>
              <Download size={14} /> Vehicles CSV
            </button>
            <button className="btn-secondary btn-sm" onClick={() => exportCSV('trips')}>
              <Download size={14} /> Trips CSV
            </button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === i
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Date filter for costs tab */}
      {tab === 2 && (
        <div className="card p-4 mb-5 flex flex-wrap gap-3 items-end">
          <div>
            <label className="label">From</label>
            <input className="input w-40" type="date" value={dateRange.from}
              onChange={e => setDateRange(p => ({ ...p, from: e.target.value }))} />
          </div>
          <div>
            <label className="label">To</label>
            <input className="input w-40" type="date" value={dateRange.to}
              onChange={e => setDateRange(p => ({ ...p, to: e.target.value }))} />
          </div>
          <button className="btn-primary btn-sm" onClick={() => loadTab(tab)}>
            <RefreshCw size={14} /> Apply
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {/* FLEET UTILIZATION */}
          {tab === 0 && (
            <div className="space-y-5">
              {rows.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4 text-gray-700">Distance by Vehicle (km)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={rows.slice(0, 10)} margin={{ top: 0, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="total_distance_km" fill="#3b82f6" name="Distance (km)" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Reg.','Vehicle','Type','Status','Trips','Distance (km)','Fuel (L)','Fuel Cost','Maint. Cost','Revenue','Fuel Eff.','ROI %'].map(h => (
                          <th key={h} className="table-head">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length === 0 && <tr><td colSpan={12} className="text-center text-gray-400 py-10 text-sm">No data</td></tr>}
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell font-mono text-xs">{r.registration_number}</td>
                          <td className="table-cell text-xs">{r.name}</td>
                          <td className="table-cell text-xs">{r.type}</td>
                          <td className="table-cell"><StatusBadge status={r.status} type="vehicle" /></td>
                          <td className="table-cell text-center">{r.completed_trips}</td>
                          <td className="table-cell">{fmtN(r.total_distance_km)}</td>
                          <td className="table-cell">{fmtN(r.total_fuel_liters)}</td>
                          <td className="table-cell">${fmt(r.total_fuel_cost)}</td>
                          <td className="table-cell">${fmt(r.total_maintenance_cost)}</td>
                          <td className="table-cell">${fmt(r.total_revenue)}</td>
                          <td className="table-cell">
                            {r.fuel_efficiency != null ? <span className="text-green-700 font-medium">{r.fuel_efficiency} km/L</span> : '—'}
                          </td>
                          <td className="table-cell">
                            {r.vehicle_roi != null ? (
                              <span className={r.vehicle_roi >= 0 ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                                {r.vehicle_roi}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* FUEL EFFICIENCY */}
          {tab === 1 && (
            <div className="space-y-5">
              {rows.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4 text-gray-700">Fuel Efficiency (km/L)</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={rows} margin={{ top: 0, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="fuel_efficiency_km_per_liter" fill="#22c55e" name="km/L" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Vehicle','Type','Trips','Distance (km)','Fuel (L)','Fuel Cost ($)','Efficiency (km/L)'].map(h => (
                          <th key={h} className="table-head">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length === 0 && <tr><td colSpan={7} className="text-center text-gray-400 py-10 text-sm">No data — complete trips first to see fuel efficiency</td></tr>}
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell">
                            <p className="font-medium text-sm">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.registration_number}</p>
                          </td>
                          <td className="table-cell">{r.type}</td>
                          <td className="table-cell">{r.trip_count}</td>
                          <td className="table-cell">{fmtN(r.total_distance)}</td>
                          <td className="table-cell">{fmtN(r.total_fuel)}</td>
                          <td className="table-cell">${fmt(r.total_fuel_cost)}</td>
                          <td className="table-cell">
                            {r.fuel_efficiency_km_per_liter != null
                              ? <span className="text-green-700 font-bold">{r.fuel_efficiency_km_per_liter} km/L</span>
                              : <span className="text-gray-400">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* OPERATIONAL COSTS */}
          {tab === 2 && (
            <div className="space-y-5">
              {data[tab]?.totals && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    ['Total Fuel Cost',  `$${fmt(data[tab].totals.total_fuel_cost)}`],
                    ['Total Maint. Cost',`$${fmt(data[tab].totals.total_maint_cost)}`],
                    ['Other Expenses',   `$${fmt(data[tab].totals.total_other)}`],
                    ['Total Revenue',    `$${fmt(data[tab].totals.total_revenue)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="card p-4">
                      <p className="text-xs text-gray-500">{k}</p>
                      <p className="text-xl font-bold">{v}</p>
                    </div>
                  ))}
                </div>
              )}
              {rows.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Cost Breakdown by Vehicle</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={rows.slice(0, 10)} margin={{ top: 0, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v) => `$${parseFloat(v).toFixed(2)}`} />
                      <Legend />
                      <Bar dataKey="fuel_cost" fill="#f97316" name="Fuel" stackId="a" />
                      <Bar dataKey="maintenance_cost" fill="#ef4444" name="Maintenance" stackId="a" />
                      <Bar dataKey="other_expenses" fill="#8b5cf6" name="Other" stackId="a" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Vehicle','Type','Fuel Cost','Maint. Cost','Other','Total Cost','Revenue','ROI %'].map(h => (
                          <th key={h} className="table-head">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length === 0 && <tr><td colSpan={8} className="text-center text-gray-400 py-10 text-sm">No data</td></tr>}
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell">
                            <p className="font-medium text-sm">{r.name}</p>
                            <p className="text-xs text-gray-400">{r.registration_number}</p>
                          </td>
                          <td className="table-cell">{r.type}</td>
                          <td className="table-cell text-orange-600">${fmt(r.fuel_cost)}</td>
                          <td className="table-cell text-red-600">${fmt(r.maintenance_cost)}</td>
                          <td className="table-cell text-purple-600">${fmt(r.other_expenses)}</td>
                          <td className="table-cell font-semibold">${fmt(r.total_cost)}</td>
                          <td className="table-cell text-green-700 font-semibold">${fmt(r.revenue)}</td>
                          <td className="table-cell">
                            {r.vehicle_roi != null ? (
                              <span className={r.vehicle_roi >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                                {r.vehicle_roi}%
                              </span>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* DRIVER PERFORMANCE */}
          {tab === 3 && (
            <div className="space-y-5">
              {rows.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold mb-4">Safety Scores</h3>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={rows.slice(0, 10)} margin={{ top: 0, right: 10, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="safety_score" fill="#6366f1" name="Safety Score" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Driver','License','Category','Status','Safety Score','Completed Trips','Cancelled','Distance (km)','Revenue','License Expiry'].map(h => (
                          <th key={h} className="table-head">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length === 0 && <tr><td colSpan={10} className="text-center text-gray-400 py-10 text-sm">No data</td></tr>}
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell font-medium">{r.name}</td>
                          <td className="table-cell font-mono text-xs">{r.license_number}</td>
                          <td className="table-cell">{r.license_category}</td>
                          <td className="table-cell"><StatusBadge status={r.status} type="driver" /></td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${parseFloat(r.safety_score) >= 80 ? 'bg-green-500' : parseFloat(r.safety_score) >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${r.safety_score}%` }}
                                />
                              </div>
                              <span className="text-xs font-semibold">{r.safety_score}</span>
                            </div>
                          </td>
                          <td className="table-cell text-center">{r.completed_trips}</td>
                          <td className="table-cell text-center text-red-500">{r.cancelled_trips}</td>
                          <td className="table-cell">{fmtN(r.total_distance)}</td>
                          <td className="table-cell text-green-700">${fmt(r.total_revenue)}</td>
                          <td className="table-cell text-xs">
                            <span className={r.license_expired ? 'text-red-600 font-semibold' : ''}>
                              {new Date(r.license_expiry_date).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
