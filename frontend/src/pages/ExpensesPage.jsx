import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const CATEGORIES = ['Toll', 'Maintenance', 'Fuel', 'Insurance', 'Registration', 'Other'];

const EMPTY = {
  vehicle_id: '', trip_id: '', category: 'Toll',
  description: '', amount: '',
  expense_date: new Date().toISOString().split('T')[0],
};

const CAT_COLOR = {
  'Toll':         'bg-blue-100 text-blue-700',
  'Maintenance':  'bg-amber-100 text-amber-700',
  'Fuel':         'bg-orange-100 text-orange-700',
  'Insurance':    'bg-purple-100 text-purple-700',
  'Registration': 'bg-green-100 text-green-700',
  'Other':        'bg-gray-100 text-gray-600',
};

export default function ExpensesPage() {
  const { hasRole }        = useAuth();
  const canDelete          = hasRole('Fleet Manager', 'Financial Analyst');
  const [expenses, setExpenses] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState({ vehicle_id: '', category: '' });
  const [modal, setModal]       = useState({ type: null, data: null });
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    api.get('/expenses', { params })
      .then(r => setExpenses(r.data.expenses))
      .catch(() => toast.error('Failed to load expenses'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/vehicles').then(r => setVehicles(r.data.vehicles)).catch(() => {}); }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/expenses', form);
      toast.success('Expense added');
      setModal({ type: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/expenses/${modal.data.id}`);
      toast.success('Expense deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const totalByCategory = CATEGORIES.map(cat => ({
    cat, total: expenses.filter(e => e.category === cat).reduce((a, e) => a + parseFloat(e.amount || 0), 0)
  })).filter(x => x.total > 0);
  const grandTotal = expenses.reduce((a, e) => a + parseFloat(e.amount || 0), 0);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle="Track operational expenses by vehicle and trip"
        action={
          <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal({ type: 'create' }); }}>
            <Plus size={16} /> Add Expense
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <div className="card p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-gray-500">Grand Total</p>
          <p className="text-2xl font-bold text-red-600">${grandTotal.toFixed(2)}</p>
        </div>
        {totalByCategory.slice(0, 3).map(({ cat, total }) => (
          <div key={cat} className="card p-4">
            <p className="text-xs text-gray-500">{cat}</p>
            <p className="text-xl font-bold">${total.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <select className="input w-56" value={filter.vehicle_id}
          onChange={e => setFilter(p => ({ ...p, vehicle_id: e.target.value }))}>
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
        </select>
        <select className="input w-40" value={filter.category}
          onChange={e => setFilter(p => ({ ...p, category: e.target.value }))}>
          <option value="">All Categories</option>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>
        <button className="btn-secondary" onClick={load}><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
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
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="table-cell text-xs">{new Date(e.expense_date).toLocaleDateString()}</td>
                    <td className="table-cell">
                      <span className={`badge ${CAT_COLOR[e.category]}`}>{e.category}</span>
                    </td>
                    <td className="table-cell text-xs">{e.vehicle_name || '—'}</td>
                    <td className="table-cell text-xs font-mono">{e.trip_number || '—'}</td>
                    <td className="table-cell text-xs max-w-[180px] truncate">{e.description || '—'}</td>
                    <td className="table-cell font-semibold text-red-600">${parseFloat(e.amount).toFixed(2)}</td>
                    <td className="table-cell">
                      {canDelete && (
                        <button className="btn btn-sm text-gray-400 hover:text-red-600"
                          onClick={() => setModal({ type: 'delete', data: e })}>
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

      {/* Create Modal */}
      <Modal open={modal.type === 'create'} onClose={() => setModal({ type: null })}
        title="Add Expense" size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Category *</label>
              <select className="input" value={form.category} onChange={f('category')} required>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Amount ($) *</label>
              <input className="input" type="number" min="0" step="0.01"
                value={form.amount} onChange={f('amount')} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle</label>
              <select className="input" value={form.vehicle_id} onChange={f('vehicle_id')}>
                <option value="">— None —</option>
                {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Date *</label>
              <input className="input" type="date" value={form.expense_date} onChange={f('expense_date')} required />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={f('description')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Expense'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={modal.type === 'delete'}
        onClose={() => setModal({ type: null })}
        onConfirm={handleDelete}
        title="Delete Expense"
        message="Are you sure you want to delete this expense record?"
        confirmLabel="Delete"
      />
    </div>
  );
}
