import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { formatCurrency } from '../lib/currency';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell
} from 'recharts';
import { Download, RefreshCw, TrendingUp, Fuel, Wrench, IndianRupee } from 'lucide-react';

const TABS = ['Fleet Utilization', 'Fuel Efficiency', 'Operational Costs', 'Driver Performance'];

// ── Theme colours (consistent with status badges) ────────────────────────────
const CHART_COLORS = {
  primary:     '#2563eb',
  green:       '#16a34a',
  amber:       '#d97706',
  red:         '#dc2626',
  purple:      '#7c3aed',
  fuel:        '#f97316',
  maintenance: '#ef4444',
  other:       '#8b5cf6',
  revenue:     '#059669',
  indigo:      '#4f46e5',
};

const AXIS_STYLE  = { fontSize: 11, fontFamily: 'monospace', fill: '#6b7280' };
const GRID_STYLE  = { stroke: '#e5e7eb', strokeDasharray: '3 3' };
const TOOLTIP_STYLE = {
  contentStyle: { fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', fontFamily: 'monospace' },
  cursor: { fill: 'rgba(37,99,235,0.06)' },
};

const fmtN  = (n, d = 1) => parseFloat(n || 0).toFixed(d);

// Custom tooltip for currency values
const CurrencyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-lg text-xs font-mono">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  );
};

const KpiMini = ({ label, value, icon: Icon, color }) => (
  <div className="card p-4 flex items-center gap-3">
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
      <Icon size={16} className="text-white" />
    </div>
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-base font-bold text-gray-900 font-mono">{value}</p>
    </div>
  </div>
);

export default function AnalyticsPage() {
  const [tab, setTab]         = useState(0);
  const [data, setData]       = useState({});
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
    const params = (t === 2 && dateRange.from && dateRange.to) ? dateRange : {};
    api.get(endpoints[t], { params })
      .then(r => setData(d => ({ ...d, [t]: r.data })))
      .catch(() => toast.error('Failed to load analytics'))
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
      toast.success(`${type} CSV downloaded`);
    } catch { toast.error('Export failed'); }
  };

  const rows = data[tab]?.data || [];

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Fleet performance, costs and operational insights"
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

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-0 mb-6 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
              tab === i
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Date filter (Operational Costs only) ─────────────────────────── */}
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
        <div className="flex items-center justify-center h-48">
          <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-primary-600" />
        </div>
      ) : (
        <>
          {/* ══ TAB 0 — FLEET UTILIZATION ══════════════════════════════════ */}
          {tab === 0 && (
            <div className="space-y-5">
              {rows.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Distance Covered by Vehicle (km)
                  </h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={rows.slice(0, 10)}
                      margin={{ top: 8, right: 16, left: 8, bottom: 64 }}
                    >
                      <CartesianGrid {...GRID_STYLE} />
                      <XAxis
                        dataKey="name"
                        angle={-35}
                        textAnchor="end"
                        tick={AXIS_STYLE}
                        interval={0}
                      />
                      <YAxis
                        tick={AXIS_STYLE}
                        tickFormatter={v => `${v} km`}
                        label={{ value: 'km', angle: -90, position: 'insideLeft', style: AXIS_STYLE, offset: 8 }}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={v => [`${fmtN(v, 1)} km`, 'Distance']}
                      />
                      <Bar dataKey="total_distance_km" name="Distance (km)" radius={[4, 4, 0, 0]}>
                        {rows.slice(0, 10).map((_, i) => (
                          <Cell key={i} fill={i % 2 === 0 ? CHART_COLORS.primary : CHART_COLORS.indigo} />
                        ))}
                      </Bar>
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
                      {rows.length === 0 && (
                        <tr><td colSpan={12} className="text-center text-gray-400 py-10 text-sm">No data yet</td></tr>
                      )}
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell font-mono text-xs">{r.registration_number}</td>
                          <td className="table-cell text-xs font-medium">{r.name}</td>
                          <td className="table-cell text-xs">{r.type}</td>
                          <td className="table-cell"><StatusBadge status={r.status} type="vehicle" /></td>
                          <td className="table-cell text-center font-mono text-xs">{r.completed_trips}</td>
                          <td className="table-cell font-mono text-xs">{fmtN(r.total_distance_km)}</td>
                          <td className="table-cell font-mono text-xs">{fmtN(r.total_fuel_liters)}</td>
                          <td className="table-cell font-mono text-xs">{formatCurrency(r.total_fuel_cost)}</td>
                          <td className="table-cell font-mono text-xs">{formatCurrency(r.total_maintenance_cost)}</td>
                          <td className="table-cell font-mono text-xs">{formatCurrency(r.total_revenue)}</td>
                          <td className="table-cell font-mono text-xs">
                            {r.fuel_efficiency != null
                              ? <span className="text-green-700 font-semibold">{r.fuel_efficiency} km/L</span>
                              : '—'}
                          </td>
                          <td className="table-cell font-mono text-xs">
                            {r.vehicle_roi != null
                              ? <span className={r.vehicle_roi >= 0 ? 'text-green-700 font-semibold' : 'text-red-600 font-semibold'}>
                                  {r.vehicle_roi}%
                                </span>
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB 1 — FUEL EFFICIENCY ════════════════════════════════════ */}
          {tab === 1 && (
            <div className="space-y-5">
              {rows.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Fuel Efficiency by Vehicle (km / L)
                  </h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={rows}
                      margin={{ top: 8, right: 16, left: 8, bottom: 64 }}
                    >
                      <CartesianGrid {...GRID_STYLE} />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" tick={AXIS_STYLE} interval={0} />
                      <YAxis
                        tick={AXIS_STYLE}
                        tickFormatter={v => `${v}`}
                        label={{ value: 'km/L', angle: -90, position: 'insideLeft', style: AXIS_STYLE, offset: 8 }}
                      />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={v => [`${fmtN(v, 2)} km/L`, 'Efficiency']}
                      />
                      <Bar dataKey="fuel_efficiency_km_per_liter" name="km/L" radius={[4, 4, 0, 0]}>
                        {rows.map((r, i) => (
                          <Cell
                            key={i}
                            fill={
                              (r.fuel_efficiency_km_per_liter || 0) >= 10
                                ? CHART_COLORS.green
                                : (r.fuel_efficiency_km_per_liter || 0) >= 6
                                ? CHART_COLORS.amber
                                : CHART_COLORS.red
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-400 mt-2 text-center font-mono">
                    Green ≥ 10 km/L &nbsp;·&nbsp; Amber 6–10 km/L &nbsp;·&nbsp; Red &lt; 6 km/L
                  </p>
                </div>
              )}

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Vehicle','Type','Trips','Distance (km)','Fuel (L)','Fuel Cost','Efficiency (km/L)'].map(h => (
                          <th key={h} className="table-head">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length === 0 && (
                        <tr><td colSpan={7} className="text-center text-gray-400 py-10 text-sm">Complete trips first to see fuel efficiency</td></tr>
                      )}
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell">
                            <p className="font-medium text-sm">{r.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.registration_number}</p>
                          </td>
                          <td className="table-cell text-xs">{r.type}</td>
                          <td className="table-cell font-mono text-xs">{r.trip_count}</td>
                          <td className="table-cell font-mono text-xs">{fmtN(r.total_distance)}</td>
                          <td className="table-cell font-mono text-xs">{fmtN(r.total_fuel)}</td>
                          <td className="table-cell font-mono text-xs">{formatCurrency(r.total_fuel_cost)}</td>
                          <td className="table-cell font-mono">
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

          {/* ══ TAB 2 — OPERATIONAL COSTS ══════════════════════════════════ */}
          {tab === 2 && (
            <div className="space-y-5">
              {/* Summary KPIs */}
              {data[2]?.totals && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <KpiMini label="Total Fuel Cost"  value={formatCurrency(data[2].totals.total_fuel_cost)}  icon={Fuel}        color="bg-orange-500" />
                  <KpiMini label="Maintenance Cost" value={formatCurrency(data[2].totals.total_maint_cost)} icon={Wrench}      color="bg-red-500" />
                  <KpiMini label="Other Expenses"   value={formatCurrency(data[2].totals.total_other)}      icon={IndianRupee} color="bg-purple-500" />
                  <KpiMini label="Total Revenue"    value={formatCurrency(data[2].totals.total_revenue)}    icon={TrendingUp}  color="bg-green-600" />
                </div>
              )}

              {rows.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Cost Breakdown by Vehicle (₹)
                  </h3>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={rows.slice(0, 10)}
                      margin={{ top: 8, right: 16, left: 16, bottom: 64 }}
                    >
                      <CartesianGrid {...GRID_STYLE} />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" tick={AXIS_STYLE} interval={0} />
                      <YAxis tick={AXIS_STYLE} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                      <Tooltip content={<CurrencyTooltip />} cursor={TOOLTIP_STYLE.cursor} />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      <Bar dataKey="fuel_cost"        fill={CHART_COLORS.fuel}        name="Fuel"        stackId="cost" />
                      <Bar dataKey="maintenance_cost" fill={CHART_COLORS.maintenance} name="Maintenance" stackId="cost" />
                      <Bar dataKey="other_expenses"   fill={CHART_COLORS.other}       name="Other"       stackId="cost" radius={[4, 4, 0, 0]} />
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
                      {rows.length === 0 && (
                        <tr><td colSpan={8} className="text-center text-gray-400 py-10 text-sm">No cost data yet</td></tr>
                      )}
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell">
                            <p className="font-medium text-sm">{r.name}</p>
                            <p className="text-xs text-gray-400 font-mono">{r.registration_number}</p>
                          </td>
                          <td className="table-cell text-xs">{r.type}</td>
                          <td className="table-cell font-mono text-xs text-orange-600">{formatCurrency(r.fuel_cost)}</td>
                          <td className="table-cell font-mono text-xs text-red-600">{formatCurrency(r.maintenance_cost)}</td>
                          <td className="table-cell font-mono text-xs text-purple-600">{formatCurrency(r.other_expenses)}</td>
                          <td className="table-cell font-mono text-xs font-semibold">{formatCurrency(r.total_cost)}</td>
                          <td className="table-cell font-mono text-xs text-green-700 font-semibold">{formatCurrency(r.revenue)}</td>
                          <td className="table-cell font-mono text-xs">
                            {r.vehicle_roi != null
                              ? <span className={r.vehicle_roi >= 0 ? 'text-green-700 font-bold' : 'text-red-600 font-bold'}>
                                  {r.vehicle_roi}%
                                </span>
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ══ TAB 3 — DRIVER PERFORMANCE ═════════════════════════════════ */}
          {tab === 3 && (
            <div className="space-y-5">
              {rows.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Driver Safety Scores (out of 100)
                  </h3>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart
                      data={rows.slice(0, 10)}
                      margin={{ top: 8, right: 16, left: 8, bottom: 64 }}
                    >
                      <CartesianGrid {...GRID_STYLE} />
                      <XAxis dataKey="name" angle={-35} textAnchor="end" tick={AXIS_STYLE} interval={0} />
                      <YAxis domain={[0, 100]} tick={AXIS_STYLE} tickFormatter={v => `${v}`}
                        label={{ value: 'Score', angle: -90, position: 'insideLeft', style: AXIS_STYLE, offset: 8 }} />
                      <Tooltip
                        {...TOOLTIP_STYLE}
                        formatter={v => [`${parseFloat(v).toFixed(1)}`, 'Safety Score']}
                      />
                      <Bar dataKey="safety_score" name="Safety Score" radius={[4, 4, 0, 0]}>
                        {rows.slice(0, 10).map((r, i) => (
                          <Cell
                            key={i}
                            fill={
                              parseFloat(r.safety_score) >= 80
                                ? CHART_COLORS.green
                                : parseFloat(r.safety_score) >= 60
                                ? CHART_COLORS.amber
                                : CHART_COLORS.red
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-400 mt-2 text-center font-mono">
                    Green ≥ 80 &nbsp;·&nbsp; Amber 60–79 &nbsp;·&nbsp; Red &lt; 60
                  </p>
                </div>
              )}

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        {['Driver','License','Category','Status','Safety Score','Completed','Cancelled','Distance (km)','Revenue','License Expiry'].map(h => (
                          <th key={h} className="table-head">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length === 0 && (
                        <tr><td colSpan={10} className="text-center text-gray-400 py-10 text-sm">No driver data yet</td></tr>
                      )}
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="table-cell font-medium text-sm">{r.name}</td>
                          <td className="table-cell font-mono text-xs">{r.license_number}</td>
                          <td className="table-cell text-xs">{r.license_category}</td>
                          <td className="table-cell"><StatusBadge status={r.status} type="driver" /></td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              <div className="w-14 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${parseFloat(r.safety_score) >= 80 ? 'bg-green-500' : parseFloat(r.safety_score) >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                                  style={{ width: `${r.safety_score}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono font-semibold">{r.safety_score}</span>
                            </div>
                          </td>
                          <td className="table-cell font-mono text-xs text-center">{r.completed_trips}</td>
                          <td className="table-cell font-mono text-xs text-center text-red-500">{r.cancelled_trips}</td>
                          <td className="table-cell font-mono text-xs">{fmtN(r.total_distance)}</td>
                          <td className="table-cell font-mono text-xs text-green-700">{formatCurrency(r.total_revenue)}</td>
                          <td className="table-cell text-xs">
                            <span className={r.license_expired ? 'text-red-600 font-semibold' : 'text-gray-600'}>
                              {new Date(r.license_expiry_date).toLocaleDateString('en-IN')}
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
