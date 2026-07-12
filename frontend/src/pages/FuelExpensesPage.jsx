import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency } from '../lib/currency';
import { Plus, RefreshCw, Trash2, Fuel, ReceiptText } from 'lucide-react';

const CATEGORIES = ['Toll', 'Maintenance', 'Fuel', 'Insurance', 'Registration', 'Other'];
const CAT_COLOR = {
  Toll: 'bg-blue-100 text-blue-700', Maintenance: 'bg-amber-100 text-amber-700',
  Fuel: 'bg-orange-100 text-orange-700', Insurance: 'bg-purple-100 text-purple-700',
  Registration: 'bg-green-100 text-green-700', Other: 'bg-gray-100 text-gray-600',
};

const EMPTY_FUEL = {
  vehicle_id: '', trip_id: '', liters: '', cost_per_liter: '',
  total_cost: '', odometer_reading: '',
  fuel_date: new Date().toISOString().split('T')[0],
  station_name: '', notes: '',
};
const EMPTY_EXP = {
  vehicle_id: '', trip_id: '', category: 'Toll', description: '', amount: '',
  expense_date: new Date().toISOString().split('T')[0],
};

export default function FuelExpensesPage() {
  const { hasRole }   = useAuth();
  const canDelete     = hasRole('Fleet Manager', 'Financial Analyst');

  const [tab, setTab] = useState(0); // 0=Fuel, 1=Expenses

  // Fuel state
  const [fuelLogs, setFuelLogs]   = useState([]);
  const [fuelLoading, setFuelLoading] = useState(true);
  const [fuelFilter, setFuelFilter]   = useState({ vehicle_id: '' });
  const [fuelModal, setFuelModal]     = useState({ type: null, data: null });
  const [fuelForm, setFuelForm]       = useState(EMPTY_FUEL);
  const [fuelSaving, setFuelSaving]   = useState(false);

  // Expense state
  const [expenses, setExpenses]       = useState([]);
  const [expLoading, setExpLoading]   = useState(true);
  const [expFilter, setExpFilter]     = useState({ vehicle_id: '', category: '' });
  const [expModal, setExpModal]       = useState({ type: null, data: null });
  const [expForm, setExpForm]         = useState(EMPTY_EXP);
  const [expSaving, setExpSaving]     = useState(false);

  // Shared vehicles list
  const [vehicles, setVehicles] = useState([]);

  useEffect(() => {
    api.get('/vehicles').then(r => setVehicles(r.data.vehicles)).catch(() => {});
  }, []);

  // ── Fuel loaders ──────────────────────────────────────────────────────────
  const loadFuel = useCallback(() => {
    setFuelLoading(true);
    const params = Object.fromEntries(Object.entries(fuelFilter).filter(([, v]) => v));
    api.get('/fuel', { params })
      .then(r => setFuelLogs(r.data.fuelLogs))
      .catch(() => toast.error('Failed to load fuel logs'))
      .finally(() => setFuelLoading(false));
  }, [fuelFilter]);

  useEffect(() => { if (tab === 0) loadFuel(); }, [tab, loadFuel]);

  // ── Expense loaders ───────────────────────────────────────────────────────
  const loadExp = useCallback(() => {
    setExpLoading(true);
    const params = Object.fromEntries(Object.entries(expFilter).filter(([, v]) => v));
    api.get('/expenses', { params })
      .then(r => setExpenses(r.data.expenses))
      .catch(() => toast.error('Failed to load expenses'))
      .finally(() => setExpLoading(false));
  }, [expFilter]);

  useEffect(() => { if (tab === 1) loadExp(); }, [tab, loadExp]);

  // ── Fuel handlers ─────────────────────────────────────────────────────────
  const handleFuelLitersOrCost = (field, value) => {
    setFuelForm(p => {
      const updated = { ...p, [field]: value };
      const liters = parseFloat(field === 'liters' ? value : p.liters) || 0;
      const cpl    = parseFloat(field === 'cost_per_liter' ? value : p.cost_per_liter) || 0;
      if (liters > 0 && cpl > 0) updated.total_cost = (liters * cpl).toFixed(2);
      return updated;
    });
  };

  const handleFuelSave = async (e) => {
    e.preventDefault();
    setFuelSaving(true);
    try {
      await api.post('/fuel', fuelForm);
      toast.success('Fuel log added');
      setFuelModal({ type: null });
      loadFuel();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setFuelSaving(false); }
  };

  const handleFuelDelete = async () => {
    try {
      await api.delete(`/fuel/${fuelModal.data.id}`);
      toast.success('Fuel log deleted');
      loadFuel();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  // ── Expense handlers ──────────────────────────────────────────────────────
  const handleExpSave = async (e) => {
    e.preventDefault();
    setExpSaving(true);
    try {
      await api.post('/expenses', expForm);
      toast.success('Expense added');
      setExpModal({ type: null });
      loadExp();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setExpSaving(false); }
  };

  const handleExpDelete = async () => {
    try {
      await api.delete(`/expenses/${expModal.data.id}`);
      toast.success('Expense deleted');
      loadExp();
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  };

  const ff = (field) => (e) => setFuelForm(p => ({ ...p, [field]: e.target.value }));
  const fe = (field) => (e) => setExpForm(p => ({ ...p, [field]: e.target.value }));

  // ── Summary totals ────────────────────────────────────────────────────────
  const totalFuel    = fuelLogs.reduce((a, l) => a + parseFloat(l.total_cost || 0), 0);
  const totalLiters  = fuelLogs.reduce((a, l) => a + parseFloat(l.liters || 0), 0);
  const totalExp     = expenses.reduce((a, e) => a + parseFloat(e.amount || 0), 0);
  const grandTotal   = totalFuel + totalExp;

  return (
    <div>
      <PageHeader
        title="Fuel & Expenses"
        subtitle="Track fuel consumption and operational expenses"
        action={
          tab === 0
            ? <button className="btn-primary" onClick={() => { setFuelForm(EMPTY_FUEL); setFuelModal({ type: 'create' }); }}>
                <Plus size={16} /> Log Fuel
              </button>
            : <button className="btn-primary" onClick={() => { setExpForm(EMPTY_EXP); setExpModal({ type: 'create' }); }}>
                <Plus size={16} /> Add Expense
              </button>
        }
      />

      {/* ── Summary strip ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Fuel Cost</p>
          <p className="text-xl font-bold text-orange-600 font-mono">{formatCurrency(totalFuel)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Liters</p>
          <p className="text-xl font-bold font-mono">{totalLiters.toFixed(1)} L</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Other Expenses</p>
          <p className="text-xl font-bold text-purple-600 font-mono">{formatCurrency(totalExp)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Grand Total (Fuel + Exp)</p>
          <p className="text-xl font-bold text-red-600 font-mono">{formatCurrency(grandTotal)}</p>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-0 mb-5 border-b border-gray-200">
        {[{ label: 'Fuel Logs', icon: Fuel }, { label: 'Other Expenses', icon: ReceiptText }].map(({ label, icon: Icon }, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === i ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── FUEL TAB ───────────────────────────────────────────────────── */}
      {tab === 0 && (
        <>
          <div className="card p-4 mb-4 flex flex-wrap gap-3">
            <select className="input w-56" value={fuelFilter.vehicle_id}
              onChange={e => setFuelFilter(p => ({ ...p, vehicle_id: e.target.value }))}>
              <option value="">All Vehicles</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
            </select>
            <button className="btn-secondary" onClick={loadFuel}><RefreshCw size={15} /></button>
          </div>

          <div className="card overflow-hidden">
            {fuelLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Date','Vehicle','Trip','Liters','Cost/Liter','Total Cost','Odometer','Station','Actions'].map(h => (
                        <th key={h} className="table-head">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fuelLogs.length === 0 && (
                      <tr><td colSpan={9} className="text-center text-gray-400 py-12 text-sm">No fuel logs found</td></tr>
                    )}
                    {fuelLogs.map(l => (
                      <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                        <td className="table-cell text-xs">{new Date(l.fuel_date).toLocaleDateString('en-IN')}</td>
                        <td className="table-cell">
                          <p className="text-sm font-medium">{l.vehicle_name}</p>
                          <p className="text-xs text-gray-400 font-mono">{l.registration_number}</p>
                        </td>
                        <td className="table-cell text-xs font-mono">{l.trip_number || '—'}</td>
                        <td className="table-cell font-mono text-xs">{parseFloat(l.liters).toFixed(1)} L</td>
                        <td className="table-cell font-mono text-xs">{l.cost_per_liter ? formatCurrency(l.cost_per_liter) : '—'}</td>
                        <td className="table-cell font-mono text-xs font-semibold text-orange-600">{formatCurrency(l.total_cost)}</td>
                        <td className="table-cell text-xs font-mono">{l.odometer_reading ? `${parseFloat(l.odometer_reading).toLocaleString()} km` : '—'}</td>
                        <td className="table-cell text-xs">{l.station_name || '—'}</td>
                        <td className="table-cell">
                          {canDelete && (
                            <button className="btn btn-sm text-gray-400 hover:text-red-600"
                              onClick={() => setFuelModal({ type: 'delete', data: l })}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── EXPENSES TAB ───────────────────────────────────────────────── */}
      {tab === 1 && (
        <>
          <div className="card p-4 mb-4 flex flex-wrap gap-3">
            <select className="input w-56" value={expFilter.vehicle_id}
              onChange={e => setExpFilter(p => ({ ...p, vehicle_id: e.target.value }))}>
              <option value="">All Vehicles</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
            </select>
            <select className="input w-40" value={expFilter.category}
              onChange={e => setExpFilter(p => ({ ...p, category: e.target.value }))}>
              <option value="">All Categories</option>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button className="btn-secondary" onClick={loadExp}><RefreshCw size={15} /></button>
          </div>

          <div className="card overflow-hidden">
            {expLoading ? (
              <div className="flex items-center justify-center h-40">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Date','Category','Vehicle','Trip','Description','Amount','Actions'].map(h => (
                        <th key={h} className="table-head">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {expenses.length === 0 && (
                      <tr><td colSpan={7} className="text-center text-gray-400 py-12 text-sm">No expenses found</td></tr>
                    )}
                    {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                        <td className="table-cell text-xs">{new Date(e.expense_date).toLocaleDateString('en-IN')}</td>
                        <td className="table-cell">
                          <span className={`badge ${CAT_COLOR[e.category]}`}>{e.category}</span>
                        </td>
                        <td className="table-cell text-xs">{e.vehicle_name || '—'}</td>
                        <td className="table-cell text-xs font-mono">{e.trip_number || '—'}</td>
                        <td className="table-cell text-xs max-w-[180px] truncate">{e.description || '—'}</td>
                        <td className="table-cell font-mono text-xs font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                        <td className="table-cell">
                          {canDelete && (
                            <button className="btn btn-sm text-gray-400 hover:text-red-600"
                              onClick={() => setExpModal({ type: 'delete', data: e })}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── FUEL CREATE MODAL ──────────────────────────────────────────── */}
      <Modal open={fuelModal.type === 'create'} onClose={() => setFuelModal({ type: null })}
        title="Log Fuel Entry" size="lg">
        <form onSubmit={handleFuelSave} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Vehicle *</label>
            <select className="input" value={fuelForm.vehicle_id} onChange={ff('vehicle_id')} required>
              <option value="">— Select Vehicle —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" value={fuelForm.fuel_date} onChange={ff('fuel_date')} required />
          </div>
          <div>
            <label className="label">Liters *</label>
            <input className="input" type="number" min="0.01" step="0.01" value={fuelForm.liters}
              onChange={e => handleFuelLitersOrCost('liters', e.target.value)} required />
          </div>
          <div>
            <label className="label">Cost per Liter (₹)</label>
            <input className="input" type="number" min="0" step="0.01" value={fuelForm.cost_per_liter}
              onChange={e => handleFuelLitersOrCost('cost_per_liter', e.target.value)} />
          </div>
          <div>
            <label className="label">Total Cost (₹) *</label>
            <input className="input" type="number" min="0" step="0.01" value={fuelForm.total_cost}
              onChange={ff('total_cost')} required />
          </div>
          <div>
            <label className="label">Odometer (km)</label>
            <input className="input" type="number" min="0" step="0.1" value={fuelForm.odometer_reading} onChange={ff('odometer_reading')} />
          </div>
          <div>
            <label className="label">Station Name</label>
            <input className="input" value={fuelForm.station_name} onChange={ff('station_name')} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={fuelForm.notes} onChange={ff('notes')} />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setFuelModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={fuelSaving}>{fuelSaving ? 'Saving…' : 'Log Fuel'}</button>
          </div>
        </form>
      </Modal>

      {/* ── EXPENSE CREATE MODAL ───────────────────────────────────────── */}
      <Modal open={expModal.type === 'create'} onClose={() => setExpModal({ type: null })}
        title="Add Expense" size="md">
        <form onSubmit={handleExpSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select className="input" value={expForm.category} onChange={fe('category')} required>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount (₹) *</label>
              <input className="input" type="number" min="0" step="0.01" value={expForm.amount} onChange={fe('amount')} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle</label>
              <select className="input" value={expForm.vehicle_id} onChange={fe('vehicle_id')}>
                <option value="">— None —</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" value={expForm.expense_date} onChange={fe('expense_date')} required />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={expForm.description} onChange={fe('description')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setExpModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={expSaving}>{expSaving ? 'Saving…' : 'Add Expense'}</button>
          </div>
        </form>
      </Modal>

      {/* ── DELETE CONFIRMS ────────────────────────────────────────────── */}
      <ConfirmDialog open={fuelModal.type === 'delete'} onClose={() => setFuelModal({ type: null })}
        onConfirm={handleFuelDelete} title="Delete Fuel Log"
        message="Delete this fuel log? This cannot be undone." confirmLabel="Delete" />
      <ConfirmDialog open={expModal.type === 'delete'} onClose={() => setExpModal({ type: null })}
        onConfirm={handleExpDelete} title="Delete Expense"
        message="Delete this expense? This cannot be undone." confirmLabel="Delete" />
    </div>
  );
}
