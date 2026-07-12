import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Search, RefreshCw, Trash2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const EMPTY = {
  vehicle_id: '', trip_id: '', liters: '', cost_per_liter: '',
  total_cost: '', odometer_reading: '', fuel_date: new Date().toISOString().split('T')[0],
  station_name: '', notes: '',
};

export default function FuelPage() {
  const { hasRole }      = useAuth();
  const canDelete        = hasRole('Fleet Manager', 'Financial Analyst');
  const [logs, setLogs]  = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState({ vehicle_id: '' });
  const [modal, setModal]       = useState({ type: null, data: null });
  const [form, setForm]         = useState(EMPTY);
  const [saving, setSaving]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    api.get('/fuel', { params })
      .then(r => setLogs(r.data.fuelLogs))
      .catch(() => toast.error('Failed to load fuel logs'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/vehicles').then(r => setVehicles(r.data.vehicles)).catch(() => {});
  }, []);

  // Auto-compute total cost from liters × cost_per_liter
  const handleLitersOrCost = (field, value) => {
    setForm(p => {
      const updated = { ...p, [field]: value };
      const liters = parseFloat(field === 'liters' ? value : p.liters) || 0;
      const cpl    = parseFloat(field === 'cost_per_liter' ? value : p.cost_per_liter) || 0;
      if (liters > 0 && cpl > 0) updated.total_cost = (liters * cpl).toFixed(2);
      return updated;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/fuel', form);
      toast.success('Fuel log added');
      setModal({ type: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/fuel/${modal.data.id}`);
      toast.success('Fuel log deleted');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  const totalLiters = logs.reduce((a, l) => a + parseFloat(l.liters || 0), 0);
  const totalCost   = logs.reduce((a, l) => a + parseFloat(l.total_cost || 0), 0);

  return (
    <div>
      <PageHeader
        title="Fuel Logs"
        subtitle="Record and track fuel consumption"
        action={
          <button className="btn-primary" onClick={() => { setForm(EMPTY); setModal({ type: 'create' }); }}>
            <Plus size={16} /> Add Fuel Log
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Records</p>
          <p className="text-2xl font-bold">{logs.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Liters</p>
          <p className="text-2xl font-bold">{totalLiters.toFixed(1)} L</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500">Total Fuel Cost</p>
          <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <select className="input w-56" value={filter.vehicle_id}
          onChange={e => setFilter(p => ({ ...p, vehicle_id: e.target.value }))}>
          <option value="">All Vehicles</option>
          {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
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
                  {['Date','Vehicle','Trip','Liters','Cost/Liter','Total Cost','Odometer','Station','Actions'].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-gray-400 py-12 text-sm">No fuel logs found</td></tr>
                )}
                {logs.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell text-xs">{new Date(l.fuel_date).toLocaleDateString()}</td>
                    <td className="table-cell">
                      <p className="text-sm font-medium">{l.vehicle_name}</p>
                      <p className="text-xs text-gray-400">{l.registration_number}</p>
                    </td>
                    <td className="table-cell text-xs font-mono">{l.trip_number || '—'}</td>
                    <td className="table-cell">{parseFloat(l.liters).toFixed(1)} L</td>
                    <td className="table-cell">{l.cost_per_liter ? `$${parseFloat(l.cost_per_liter).toFixed(2)}` : '—'}</td>
                    <td className="table-cell font-semibold text-green-700">${parseFloat(l.total_cost).toFixed(2)}</td>
                    <td className="table-cell text-xs">{l.odometer_reading ? `${parseFloat(l.odometer_reading).toLocaleString()} km` : '—'}</td>
                    <td className="table-cell text-xs">{l.station_name || '—'}</td>
                    <td className="table-cell">
                      {canDelete && (
                        <button className="btn btn-sm text-gray-400 hover:text-red-600"
                          onClick={() => setModal({ type: 'delete', data: l })}>
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
        title="Add Fuel Log" size="lg">
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Vehicle *</label>
            <select className="input" value={form.vehicle_id} onChange={f('vehicle_id')} required>
              <option value="">— Select Vehicle —</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Date *</label>
            <input className="input" type="date" value={form.fuel_date} onChange={f('fuel_date')} required />
          </div>
          <div>
            <label className="label">Liters *</label>
            <input className="input" type="number" min="0.01" step="0.01" value={form.liters}
              onChange={e => handleLitersOrCost('liters', e.target.value)} required />
          </div>
          <div>
            <label className="label">Cost per Liter ($)</label>
            <input className="input" type="number" min="0" step="0.001" value={form.cost_per_liter}
              onChange={e => handleLitersOrCost('cost_per_liter', e.target.value)} />
          </div>
          <div>
            <label className="label">Total Cost ($) *</label>
            <input className="input" type="number" min="0" step="0.01" value={form.total_cost}
              onChange={f('total_cost')} required />
          </div>
          <div>
            <label className="label">Odometer Reading (km)</label>
            <input className="input" type="number" min="0" step="0.1" value={form.odometer_reading} onChange={f('odometer_reading')} />
          </div>
          <div>
            <label className="label">Station Name</label>
            <input className="input" value={form.station_name} onChange={f('station_name')} />
          </div>
          <div className="col-span-2">
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Add Fuel Log'}</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={modal.type === 'delete'}
        onClose={() => setModal({ type: null })}
        onConfirm={handleDelete}
        title="Delete Fuel Log"
        message="Are you sure you want to delete this fuel log? This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  );
}
