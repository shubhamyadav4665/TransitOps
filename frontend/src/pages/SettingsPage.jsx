import { useState, useEffect } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import { Save, Settings } from 'lucide-react';

// ─── RBAC permission matrix ──────────────────────────────────────────────────
const RBAC = [
  {
    module: 'Dashboard',
    view: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'],
    create: [], edit: [], delete: [],
  },
  {
    module: 'Fleet (Vehicles)',
    view: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'],
    create: ['Fleet Manager'], edit: ['Fleet Manager'], delete: ['Fleet Manager'],
  },
  {
    module: 'Drivers',
    view: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'],
    create: ['Fleet Manager', 'Safety Officer'],
    edit: ['Fleet Manager', 'Safety Officer'],
    delete: ['Fleet Manager', 'Safety Officer'],
  },
  {
    module: 'Trips',
    view: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'],
    create: ['Fleet Manager', 'Dispatcher'],
    edit: ['Fleet Manager', 'Dispatcher'],
    delete: [],
  },
  {
    module: 'Maintenance',
    view: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'],
    create: ['Fleet Manager'], edit: ['Fleet Manager'], delete: [],
  },
  {
    module: 'Fuel & Expenses',
    view: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'],
    create: ['Fleet Manager', 'Financial Analyst'],
    edit: ['Fleet Manager', 'Financial Analyst'],
    delete: ['Fleet Manager', 'Financial Analyst'],
  },
  {
    module: 'Analytics',
    view: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'],
    create: [], edit: [], delete: [],
  },
  {
    module: 'Settings',
    view: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'],
    create: [], edit: ['Fleet Manager'], delete: [],
  },
];

const ROLES = ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'];

const ROLE_COLOR = {
  'Fleet Manager':     'bg-blue-100 text-blue-700',
  'Dispatcher':        'bg-green-100 text-green-700',
  'Safety Officer':    'bg-amber-100 text-amber-700',
  'Financial Analyst': 'bg-purple-100 text-purple-700',
};

function hasAccess(list, role) {
  return list.includes(role);
}

export default function SettingsPage() {
  const { user, hasRole } = useAuth();
  const canEdit = hasRole('Fleet Manager');

  const [settings, setSettings] = useState({
    depot_name: '',
    currency: 'INR',
    currency_symbol: '₹',
    distance_unit: 'km',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Role filter for the RBAC matrix — defaults to the logged-in user's role
  const [selectedRole, setSelectedRole] = useState(user?.role || 'Fleet Manager');

  useEffect(() => {
    api.get('/settings')
      .then(r => setSettings(s => ({ ...s, ...r.data.settings })))
      .catch(() => toast.error('Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', settings);
      toast.success('Settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const f = (field) => (e) => setSettings(p => ({ ...p, [field]: e.target.value }));

  return (
    <div className="space-y-8 max-w-4xl">
      <PageHeader
        title="Settings"
        subtitle="Platform configuration and access control overview"
      />

      {/* ── Organisation Settings ─────────────────────────────────────────── */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Settings size={18} className="text-primary-600" />
          <h2 className="text-base font-semibold text-gray-900">Organisation Settings</h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-24">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary-600" />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Depot Name */}
              <div className="sm:col-span-2">
                <label className="label">Depot / Organisation Name</label>
                <input
                  className="input"
                  value={settings.depot_name}
                  onChange={f('depot_name')}
                  placeholder="e.g. TransitOps HQ"
                  disabled={!canEdit}
                />
              </div>

              {/* Currency */}
              <div>
                <label className="label">Currency</label>
                <select
                  className="input"
                  value={settings.currency}
                  onChange={(e) => {
                    const map = { INR: '₹', USD: '$', EUR: '€', GBP: '£' };
                    setSettings(p => ({
                      ...p,
                      currency: e.target.value,
                      currency_symbol: map[e.target.value] || p.currency_symbol,
                    }));
                  }}
                  disabled={!canEdit}
                >
                  <option value="INR">INR — Indian Rupee (₹)</option>
                  <option value="USD">USD — US Dollar ($)</option>
                  <option value="EUR">EUR — Euro (€)</option>
                  <option value="GBP">GBP — British Pound (£)</option>
                </select>
              </div>

              {/* Currency Symbol preview */}
              <div>
                <label className="label">Currency Symbol</label>
                <input
                  className="input"
                  value={settings.currency_symbol}
                  onChange={f('currency_symbol')}
                  placeholder="₹"
                  disabled={!canEdit}
                  maxLength={3}
                />
              </div>

              {/* Distance Unit */}
              <div>
                <label className="label">Distance Unit</label>
                <select
                  className="input"
                  value={settings.distance_unit}
                  onChange={f('distance_unit')}
                  disabled={!canEdit}
                >
                  <option value="km">Kilometers (km)</option>
                  <option value="mi">Miles (mi)</option>
                </select>
              </div>
            </div>

            {canEdit ? (
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button type="submit" className="btn-primary" disabled={saving}>
                  <Save size={15} />
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            ) : (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-500 border border-gray-200">
                You have read-only access to settings. Only a <strong>Fleet Manager</strong> can edit these values.
              </div>
            )}
          </form>
        )}
      </div>

      {/* ── RBAC Permission Matrix ────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Role Access Matrix</h2>
            <p className="text-xs text-gray-500 mt-0.5">Showing permissions for the selected role</p>
          </div>
          {/* Role selector — defaults to logged-in user's role */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">View role:</label>
            <select
              className="input text-sm py-1.5 w-44"
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
            >
              {ROLES.map(r => (
                <option key={r} value={r}>
                  {r} {r === user?.role ? '(You)' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Role badge */}
        <div className="px-6 pt-4 pb-2 flex items-center gap-2">
          <span className="text-xs text-gray-500">Selected role:</span>
          <span className={`badge ${ROLE_COLOR[selectedRole] || 'bg-gray-100 text-gray-600'}`}>
            {selectedRole}
          </span>
          {selectedRole === user?.role && (
            <span className="text-xs text-gray-400 italic">— your current role</span>
          )}
        </div>

        {/* Single-role permissions table */}
        <div className="px-6 pb-6">
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="table-head text-left">Module</th>
                  <th className="table-head text-center w-20">View</th>
                  <th className="table-head text-center w-20">Create</th>
                  <th className="table-head text-center w-20">Edit</th>
                  <th className="table-head text-center w-20">Delete</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {RBAC.map(row => {
                  const v = hasAccess(row.view,   selectedRole);
                  const c = hasAccess(row.create, selectedRole);
                  const e = hasAccess(row.edit,   selectedRole);
                  const d = hasAccess(row.delete, selectedRole);
                  return (
                    <tr key={row.module} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-medium text-gray-800 whitespace-nowrap">
                        {row.module}
                      </td>
                      {[v, c, e, d].map((allowed, i) => (
                        <td key={i} className="px-4 py-3 text-center">
                          {allowed
                            ? <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 font-bold text-sm">✓</span>
                            : <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 text-gray-400 text-sm">—</span>
                          }
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
          ✓ = allowed &nbsp;|&nbsp; — = not permitted &nbsp;|&nbsp; Use the dropdown above to check any role's permissions
        </div>
      </div>
    </div>
  );
}
