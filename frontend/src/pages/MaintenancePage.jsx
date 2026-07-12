import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { Plus, Search, RefreshCw, CheckCircle, Pencil } from 'lucide-react';

const TYPES = ['Oil Change','Tire Replacement','Brake Service','Engine Repair',
  'Transmission Service','Battery Replacement','AC Service','Full Inspection','Other'];

const EMPTY = {
  vehicle_id: '', maintenance_type: 'Oil Change', description: '',
  cost: '', scheduled_date: '', technician: '', service_center: '',
};

export default function MaintenancePage() {
  const { hasRole }      = useAuth();
  const canEdit          = hasRole('Fleet Manager');
  const [records, setRecords] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState({ status: '', search: '' });
  const [modal, setModal]       = useState({ type: null, data: null });
  const [form, setForm]         = useState(EMPTY);
  const [closeForm, setCloseForm] = useState({ completed_date: '', cost: '' });
  const [saving, setSaving]     = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    api.get('/maintenance', { params })
      .then(r => setRecords(r.data.maintenance))
      .catch(() => toast.error('Failed to load maintenance records'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    api.get('/vehicles', { params: { status: 'Available' } })
      .then(r => {
        setVehicles(r.data.vehicles);
        setForm(EMPTY);
        setModal({ type: 'create' });
      })
      .catch(() => toast.error('Failed to load vehicles'));
  };

  const openClose = (rec) => {
    setCloseForm({
      completed_date: new Date().toISOString().split('T')[0],
      cost: rec.cost || '',
    });
    setModal({ type: 'close', data: rec });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/maintenance', form);
      toast.success('Maintenance record created — vehicle set to In Shop');
      setModal({ type: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const handleClose = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/maintenance/${modal.data.id}/close`, closeForm);
      toast.success('Maintenance closed — vehicle restored to Available');
      setModal({ type: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setSaving(false); }
  };

  const f  = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const fc = (field) => (e) => setCloseForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle="Track vehicle maintenance and repairs"
        action={canEdit && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Log Maintenance
          </button>
        )}
      />

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search vehicle, type…" value={filter.search}
            onChange={e => setFilter(p => ({ ...p, search: e.target.value }))} />
        </div>
        <select className="input w-36" value={filter.status}
          onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          <option>Active</option>
          <option>Completed</option>
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
                  {['Vehicle','Type','Description','Cost','Scheduled','Technician','Service Center','Status','Actions'].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-gray-400 py-12 text-sm">No maintenance records found</td></tr>
                )}
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell">
                      <p className="font-medium text-sm">{r.vehicle_name}</p>
                      <p className="text-xs text-gray-400">{r.registration_number}</p>
                    </td>
                    <td className="table-cell">{r.maintenance_type}</td>
                    <td className="table-cell text-xs max-w-[150px] truncate">{r.description || '—'}</td>
                    <td className="table-cell">${parseFloat(r.cost||0).toFixed(2)}</td>
                    <td className="table-cell text-xs">{r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString() : '—'}</td>
                    <td className="table-cell text-xs">{r.technician || '—'}</td>
                    <td className="table-cell text-xs">{r.service_center || '—'}</td>
                    <td className="table-cell"><StatusBadge status={r.status} type="maintenance" /></td>
                    <td className="table-cell">
                      {canEdit && r.status === 'Active' && (
                        <button className="btn btn-sm btn-success" onClick={() => openClose(r)} title="Mark Complete">
                          <CheckCircle size={14} /> Close
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
        title="Log Maintenance Record" size="lg">
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Vehicle *</label>
            <select className="input" value={form.vehicle_id} onChange={f('vehicle_id')} required>
              <option value="">— Select Vehicle —</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.registration_number} — {v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Maintenance Type *</label>
            <select className="input" value={form.maintenance_type} onChange={f('maintenance_type')} required>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estimated Cost ($)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.cost} onChange={f('cost')} />
          </div>
          <div className="col-span-2">
            <label className="label">Description</label>
            <textarea className="input" rows={2} value={form.description} onChange={f('description')} />
          </div>
          <div>
            <label className="label">Scheduled Date</label>
            <input className="input" type="date" value={form.scheduled_date} onChange={f('scheduled_date')} />
          </div>
          <div>
            <label className="label">Technician</label>
            <input className="input" value={form.technician} onChange={f('technician')} />
          </div>
          <div className="col-span-2">
            <label className="label">Service Center</label>
            <input className="input" value={form.service_center} onChange={f('service_center')} />
          </div>
          <div className="col-span-2 bg-amber-50 rounded-lg p-3 text-sm text-amber-700">
            ⚠️ Creating this record will automatically set the vehicle status to <strong>In Shop</strong>.
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Close Modal */}
      <Modal open={modal.type === 'close'} onClose={() => setModal({ type: null })}
        title="Complete Maintenance" size="sm">
        <form onSubmit={handleClose} className="space-y-4">
          <p className="text-sm text-gray-600">
            Closing <strong>{modal.data?.maintenance_type}</strong> for <strong>{modal.data?.vehicle_name}</strong>.
            Vehicle will be restored to <strong>Available</strong>.
          </p>
          <div>
            <label className="label">Completion Date</label>
            <input className="input" type="date" value={closeForm.completed_date} onChange={fc('completed_date')} />
          </div>
          <div>
            <label className="label">Final Cost ($)</label>
            <input className="input" type="number" min="0" step="0.01" value={closeForm.cost} onChange={fc('cost')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-success" disabled={saving}>
              {saving ? 'Closing…' : 'Mark Complete'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
