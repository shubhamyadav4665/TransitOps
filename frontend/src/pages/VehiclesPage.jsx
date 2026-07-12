import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency } from '../lib/currency';
import { Plus, Search, Pencil, Trash2, Eye, RefreshCw } from 'lucide-react';

const TYPES    = ['Truck', 'Van', 'Bus', 'Pickup', 'Tanker', 'Trailer', 'Other'];
const STATUSES = ['Available', 'On Trip', 'In Shop', 'Retired'];
const FUELS    = ['Diesel', 'Petrol', 'Electric', 'Hybrid', 'CNG'];
const EMPTY = {
  registration_number: '', name: '', model: '', type: 'Truck',
  max_load_capacity: '', odometer: '', acquisition_cost: '',
  region: '', year: '', fuel_type: 'Diesel',
};

export default function VehiclesPage() {
  const { hasRole }            = useAuth();
  const canEdit                = hasRole('Fleet Manager');
  const [vehicles, setVehicles]= useState([]);
  const [loading, setLoading]  = useState(true);
  const [filter, setFilter]    = useState({ status: '', type: '', region: '', search: '', registration_number: '' });
  const [modal, setModal]      = useState({ type: null, data: null });
  const [form, setForm]        = useState(EMPTY);
  const [saving, setSaving]    = useState(false);
  const [detail, setDetail]    = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    // Send status/type/region/search to backend; reg filter applied client-side below
    const { registration_number, ...apiParams } = filter;
    const params = Object.fromEntries(Object.entries(apiParams).filter(([, v]) => v));
    api.get('/vehicles', { params })
      .then(r => {
        let rows = r.data.vehicles;
        // Client-side reg number filter (case-insensitive partial match)
        if (registration_number && registration_number.trim()) {
          const q = registration_number.trim().toLowerCase();
          rows = rows.filter(v => v.registration_number?.toLowerCase().includes(q));
        }
        setVehicles(rows);
      })
      .catch(() => toast.error('Failed to load vehicles'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(EMPTY); setModal({ type: 'form', data: null }); };
  const openEdit   = (v) => {
    setForm({
      registration_number: v.registration_number, name: v.name, model: v.model || '',
      type: v.type, max_load_capacity: v.max_load_capacity, odometer: v.odometer,
      acquisition_cost: v.acquisition_cost, region: v.region || '',
      year: v.year || '', fuel_type: v.fuel_type || 'Diesel',
    });
    setModal({ type: 'form', data: v });
  };
  const openDetail = (v) => {
    api.get(`/vehicles/${v.id}`)
      .then(r => { setDetail(r.data); setModal({ type: 'detail', data: v }); })
      .catch(() => toast.error('Failed to load vehicle details'));
  };
  const openRetire = (v) => setModal({ type: 'retire', data: v });

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (modal.data) {
        await api.put(`/vehicles/${modal.data.id}`, form);
        toast.success('Vehicle updated');
      } else {
        await api.post('/vehicles', form);
        toast.success('Vehicle created');
      }
      setModal({ type: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  const handleRetire = async () => {
    try {
      await api.delete(`/vehicles/${modal.data.id}`);
      toast.success('Vehicle retired');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  };

  const f = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <div>
      <PageHeader
        title="Vehicle Registry"
        subtitle="Manage your fleet assets"
        action={canEdit && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> Add Vehicle
          </button>
        )}
      />

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search by name or model…" value={filter.search}
            onChange={e => setFilter(p => ({ ...p, search: e.target.value }))} />
        </div>
        <div className="relative min-w-[160px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Filter by Reg. No. (e.g. TRK-001)" value={filter.registration_number}
            onChange={e => setFilter(p => ({ ...p, registration_number: e.target.value }))} />
        </div>
        <select className="input w-36" value={filter.status}
          onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}>
          <option value="">All Status</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className="input w-32" value={filter.type}
          onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}>
          <option value="">All Types</option>
          {TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <input className="input w-32" placeholder="Region" value={filter.region}
          onChange={e => setFilter(p => ({ ...p, region: e.target.value }))} />
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
                  {['Reg. Number','Name / Model','Type','Max Load','Odometer','Acquisition','Region','Status','Actions'].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicles.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-gray-400 py-12 text-sm">No vehicles found</td></tr>
                )}
                {vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-mono text-xs font-semibold">{v.registration_number}</td>
                    <td className="table-cell">
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-gray-400">{v.model}</p>
                    </td>
                    <td className="table-cell">{v.type}</td>
                    <td className="table-cell">{parseFloat(v.max_load_capacity).toLocaleString()} kg</td>
                    <td className="table-cell">{parseFloat(v.odometer).toLocaleString()} km</td>
                    <td className="table-cell font-mono text-xs">{formatCurrency(v.acquisition_cost)}</td>
                    <td className="table-cell text-xs">{v.region || '—'}</td>
                    <td className="table-cell"><StatusBadge status={v.status} type="vehicle" /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button className="btn btn-sm text-gray-500 hover:text-primary-600" onClick={() => openDetail(v)} title="View">
                          <Eye size={14} />
                        </button>
                        {canEdit && (
                          <>
                            <button className="btn btn-sm text-gray-500 hover:text-blue-600" onClick={() => openEdit(v)} title="Edit">
                              <Pencil size={14} />
                            </button>
                            {v.status !== 'Retired' && (
                              <button className="btn btn-sm text-gray-500 hover:text-red-600" onClick={() => openRetire(v)} title="Retire">
                                <Trash2 size={14} />
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form Modal */}
      <Modal open={modal.type === 'form'} onClose={() => setModal({ type: null })}
        title={modal.data ? 'Edit Vehicle' : 'Add Vehicle'} size="lg">
        <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Registration Number *</label>
            <input className="input" value={form.registration_number} onChange={f('registration_number')}
              required disabled={!!modal.data} placeholder="e.g. TRK-001" />
          </div>
          <div>
            <label className="label">Vehicle Name *</label>
            <input className="input" value={form.name} onChange={f('name')} required placeholder="e.g. Heavy Hauler Alpha" />
          </div>
          <div>
            <label className="label">Model</label>
            <input className="input" value={form.model} onChange={f('model')} placeholder="e.g. Volvo FH" />
          </div>
          <div>
            <label className="label">Type *</label>
            <select className="input" value={form.type} onChange={f('type')} required>
              {TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Max Load Capacity (kg) *</label>
            <input className="input" type="number" min="1" step="0.01" value={form.max_load_capacity}
              onChange={f('max_load_capacity')} required />
          </div>
          <div>
            <label className="label">Current Odometer (km)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.odometer} onChange={f('odometer')} />
          </div>
          <div>
            <label className="label">Acquisition Cost ($)</label>
            <input className="input" type="number" min="0" step="0.01" value={form.acquisition_cost} onChange={f('acquisition_cost')} />
          </div>
          <div>
            <label className="label">Fuel Type</label>
            <select className="input" value={form.fuel_type} onChange={f('fuel_type')}>
              {FUELS.map(f => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Region</label>
            <input className="input" value={form.region} onChange={f('region')} placeholder="e.g. North" />
          </div>
          <div>
            <label className="label">Year</label>
            <input className="input" type="number" min="1990" max="2030" value={form.year} onChange={f('year')} />
          </div>
          <div className="col-span-2 flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modal.data ? 'Update Vehicle' : 'Create Vehicle'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={modal.type === 'detail'} onClose={() => setModal({ type: null })}
        title="Vehicle Details" size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Registration', detail.vehicle?.registration_number],
                ['Name', detail.vehicle?.name],
                ['Model', detail.vehicle?.model],
                ['Type', detail.vehicle?.type],
                ['Status', <StatusBadge status={detail.vehicle?.status} type="vehicle" />],
                ['Max Load', `${parseFloat(detail.vehicle?.max_load_capacity||0).toLocaleString()} kg`],
                ['Odometer', `${parseFloat(detail.vehicle?.odometer||0).toLocaleString()} km`],
                ['Acquisition Cost', formatCurrency(detail.vehicle?.acquisition_cost||0)],
                ['Total Fuel Cost', formatCurrency(detail.vehicle?.total_fuel_cost||0)],
                ['Total Maintenance', formatCurrency(detail.vehicle?.total_maintenance_cost||0)],
                ['Region', detail.vehicle?.region || '—'],
                ['Year', detail.vehicle?.year || '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{k}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </div>
            {detail.recentTrips?.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Recent Trips</p>
                <div className="space-y-1">
                  {detail.recentTrips.map(t => (
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

      {/* Retire Confirm */}
      <ConfirmDialog
        open={modal.type === 'retire'}
        onClose={() => setModal({ type: null })}
        onConfirm={handleRetire}
        title="Retire Vehicle"
        message={`Are you sure you want to retire "${modal.data?.name}"? This will remove it from dispatch.`}
        confirmLabel="Retire Vehicle"
      />
    </div>
  );
}
