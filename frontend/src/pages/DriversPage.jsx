import { useState, useEffect, useCallback } from 'react'; 
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Search, Pencil, AlertTriangle, RefreshCw, Eye } from 'lucide-react';

const STATUSES   = ['Available', 'On Trip', 'Off Duty', 'Suspended'];
const CATEGORIES = ['Class A', 'Class B', 'Class C', 'Class D', 'CDL'];
const EMPTY = {
  name: '', license_number: '', license_category: 'Class A',
  license_expiry_date: '', contact_number: '', email: '',
  safety_score: 100, address: '',
};

export default function DriversPage() {
  const { hasRole }          = useAuth();
  const canEdit              = hasRole('Fleet Manager', 'Safety Officer');
  const [drivers, setDrivers]= useState([]);
  const [loading, setLoading]= useState(true);
  const [filter, setFilter]  = useState({ status: '', search: '' });
  const [modal, setModal]    = useState({ type: null, data: null });
  const [form, setForm]      = useState(EMPTY);
  const [saving, setSaving]  = useState(false);
  const [detail, setDetail]  = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    api.get('/drivers', { params })
      .then(r => setDrivers(r.data.drivers))
      .catch(() => toast.error('Failed to load drivers'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setModal({ type: 'form', data: null }); };
  const openEdit   = (d) => {
    setForm({
      name: d.name, license_number: d.license_number,
      license_category: d.license_category,
      license_expiry_date: d.license_expiry_date?.split('T')[0] || '',
      contact_number: d.contact_number || '', email: d.email || '',
      safety_score: d.safety_score, address: d.address || '',
    });
    setModal({ type: 'form', data: d });
  };
  const openDetail = (d) => {
    api.get(`/drivers/${d.id}`)
      .then(r => { setDetail(r.data); setModal({ type: 'detail', data: d }); })
      .catch(() => toast.error('Failed to load driver details'));
  };
  const openSuspend = (d) => setModal({ type: 'suspend', data: d });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal.data) {
        await api.put(`/drivers/${modal.data.id}`, form);
        toast.success('Driver updated');
      } else {
        await api.post('/drivers', form);
        toast.success('Driver created');
      }
      setModal({ type: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleSuspend = async () => {
    try {
      await api.delete(`/drivers/${modal.data.id}`);
      toast.success('Driver suspended');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Driver Management"
        subtitle="Manage driver profiles and compliance"
        action={canEdit && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add Driver
          </button>
        )}
      />

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search name, license…" value={filter.search}
            onChange={e => setFilter(p => ({ ...p, search: e.target.value }))} />
        </div>
        <select className="input w-36" value={filter.status}
          onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
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
                  {['Name','License #','Category','Expiry','Contact','Safety Score','Status','Actions'].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {drivers.length === 0 && (
                  <tr><td colSpan={8} className="text-center text-gray-400 py-12 text-sm">No drivers found</td></tr>
                )}
                {drivers.map(d => {
                  const expired     = d.license_expired;
                  const expiringSoon= d.license_expiring_soon;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="table-cell font-medium">{d.name}</td>
                      <td className="table-cell font-mono text-xs">{d.license_number}</td>
                      <td className="table-cell">{d.license_category}</td>
                      <td className="table-cell">
                        <span className={expired ? 'text-red-600 font-semibold' : expiringSoon ? 'text-amber-600 font-semibold' : ''}>
                          {d.license_expiry_date ? new Date(d.license_expiry_date).toLocaleDateString() : '—'}
                        </span>
                        {expired && <AlertTriangle size={12} className="inline ml-1 text-red-500" />}
                        {expiringSoon && !expired && <AlertTriangle size={12} className="inline ml-1 text-amber-500" />}
                      </td>
                      <td className="table-cell text-xs">{d.contact_number || '—'}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${parseFloat(d.safety_score) >= 80 ? 'bg-green-500' : parseFloat(d.safety_score) >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                              style={{ width: `${d.safety_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{d.safety_score}</span>
                        </div>
                      </td>
                      <td className="table-cell"><StatusBadge status={d.status} type="driver" /></td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button className="btn btn-sm text-gray-500 hover:text-primary-600" onClick={() => openDetail(d)} title="View"><Eye size={14} /></button>
                          {canEdit && (
                            <>
                              <button className="btn btn-sm text-gray-500 hover:text-blue-600" onClick={() => openEdit(d)} title="Edit"><Pencil size={14} /></button>
                              {d.status !== 'Suspended' && d.status !== 'On Trip' && (
                                <button className="btn btn-sm text-gray-500 hover:text-red-600" onClick={() => openSuspend(d)} title="Suspend">
                                  <AlertTriangle size={14} />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal open={modal.type === 'form'} onClose={() => setModal({ type: null })}
        title={modal.data ? 'Edit Driver' : 'Add Driver'} size="lg">
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Full Name *</label>
            <input className="input" value={form.name} onChange={f('name')} required />
          </div>
          <div>
            <label className="label">License Number *</label>
            <input className="input" value={form.license_number} onChange={f('license_number')}
              required disabled={!!modal.data} />
          </div>
          <div>
            <label className="label">License Category *</label>
            <select className="input" value={form.license_category} onChange={f('license_category')} required>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="label">License Expiry Date *</label>
            <input className="input" type="date" value={form.license_expiry_date}
              onChange={f('license_expiry_date')} required />
          </div>
          <div>
            <label className="label">Contact Number</label>
            <input className="input" value={form.contact_number} onChange={f('contact_number')} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={f('email')} />
          </div>
          <div>
            <label className="label">Safety Score (0–100)</label>
            <input className="input" type="number" min="0" max="100" step="0.1"
              value={form.safety_score} onChange={f('safety_score')} />
          </div>
          <div>
            <label className="label">Address</label>
            <input className="input" value={form.address} onChange={f('address')} />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modal.data ? 'Update Driver' : 'Create Driver'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={modal.type === 'detail'} onClose={() => setModal({ type: null })} title="Driver Details" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Name', detail.driver?.name],
                ['License #', detail.driver?.license_number],
                ['Category', detail.driver?.license_category],
                ['Expiry', detail.driver?.license_expiry_date ? new Date(detail.driver.license_expiry_date).toLocaleDateString() : '—'],
                ['Status', <StatusBadge status={detail.driver?.status} type="driver" />],
                ['Safety Score', detail.driver?.safety_score],
                ['Contact', detail.driver?.contact_number || '—'],
                ['Email', detail.driver?.email || '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{k}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </div>
            {detail.tripHistory?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Trip History</p>
                <div className="space-y-1">
                  {detail.tripHistory.map(t => (
                    <div key={t.id} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2 text-xs">
                      <span className="font-mono">{t.trip_number}</span>
                      <span>{t.source} → {t.destination}</span>
                      <StatusBadge status={t.status} type="trip" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={modal.type === 'suspend'}
        onClose={() => setModal({ type: null })}
        onConfirm={handleSuspend}
        title="Suspend Driver"
        message={`Suspend "${modal.data?.name}"? They will not be assignable to trips.`}
        confirmLabel="Suspend"
      />
    </div>
  );
}
