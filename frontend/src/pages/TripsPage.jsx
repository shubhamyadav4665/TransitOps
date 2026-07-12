import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { Plus, Search, RefreshCw, Play, CheckCircle, XCircle, Eye } from 'lucide-react';

const STATUSES = ['Draft', 'Dispatched', 'Completed', 'Cancelled'];

const EMPTY_FORM = {
  source: '', destination: '', vehicle_id: '', driver_id: '',
  cargo_weight: '', planned_distance: '', revenue: '', notes: '',
};

const EMPTY_COMPLETE = { end_odometer: '', fuel_consumed: '', revenue: '' };

export default function TripsPage() {
  const { hasRole }        = useAuth();
  const canDispatch        = hasRole('Fleet Manager', 'Dispatcher');
  const [trips, setTrips]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState({ status: '', search: '' });
  const [modal, setModal]     = useState({ type: null, data: null });
  const [form, setForm]       = useState(EMPTY_FORM);
  const [completeForm, setCompleteForm] = useState(EMPTY_COMPLETE);
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers]   = useState([]);
  const [saving, setSaving]     = useState(false);
  const [detail, setDetail]     = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filter).filter(([, v]) => v));
    api.get('/trips', { params })
      .then(r => setTrips(r.data.trips))
      .catch(() => toast.error('Failed to load trips'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = async () => {
    setForm(EMPTY_FORM);
    const [vRes, dRes] = await Promise.all([
      api.get('/vehicles/available'),
      api.get('/drivers/available'),
    ]);
    setVehicles(vRes.data.vehicles);
    setDrivers(dRes.data.drivers);
    setModal({ type: 'create' });
  };

  const openComplete = (trip) => {
    setCompleteForm({ end_odometer: trip.start_odometer || '', fuel_consumed: '', revenue: trip.revenue || '' });
    setModal({ type: 'complete', data: trip });
  };

  const openDetail = (trip) => {
    api.get(`/trips/${trip.id}`)
      .then(r => { setDetail(r.data); setModal({ type: 'detail', data: trip }); })
      .catch(() => toast.error('Failed to load trip details'));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/trips', form);
      toast.success('Trip created');
      setModal({ type: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create trip');
    } finally { setSaving(false); }
  };

  const handleDispatch = async (trip) => {
    try {
      await api.patch(`/trips/${trip.id}/dispatch`);
      toast.success('Trip dispatched — vehicle & driver set to On Trip');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Dispatch failed');
    }
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/trips/${modal.data.id}/complete`, completeForm);
      toast.success('Trip completed — vehicle & driver restored to Available');
      setModal({ type: null });
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Complete failed');
    } finally { setSaving(false); }
  };

  const handleCancel = async () => {
    try {
      await api.patch(`/trips/${modal.data.id}/cancel`);
      toast.success('Trip cancelled');
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Cancel failed');
    }
  };

  const f  = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const fc = (field) => (e) => setCompleteForm(p => ({ ...p, [field]: e.target.value }));

  // Auto-compute max cargo when vehicle changes
  const selectedVehicle = vehicles.find(v => v.id === parseInt(form.vehicle_id));

  return (
    <div>
      <PageHeader
        title="Trip Management"
        subtitle="Create and manage dispatch operations"
        action={canDispatch && (
          <button className="btn-primary" onClick={openCreate}>
            <Plus size={16} /> New Trip
          </button>
        )}
      />

      {/* Filters */}
      <div className="card p-4 mb-5 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search trip, source, destination…" value={filter.search}
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
                  {['Trip #','Route','Vehicle','Driver','Cargo','Distance','Revenue','Status','Actions'].map(h => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {trips.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-gray-400 py-12 text-sm">No trips found</td></tr>
                )}
                {trips.map(t => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell font-mono text-xs font-semibold">{t.trip_number}</td>
                    <td className="table-cell text-xs">
                      <p className="font-medium">{t.source}</p>
                      <p className="text-gray-400">→ {t.destination}</p>
                    </td>
                    <td className="table-cell text-xs">
                      <p>{t.vehicle_name}</p>
                      <p className="text-gray-400">{t.registration_number}</p>
                    </td>
                    <td className="table-cell text-xs">{t.driver_name}</td>
                    <td className="table-cell text-xs">{parseFloat(t.cargo_weight).toLocaleString()} kg</td>
                    <td className="table-cell text-xs">
                      {t.actual_distance ? `${parseFloat(t.actual_distance).toLocaleString()} km` :
                        t.planned_distance ? `${parseFloat(t.planned_distance).toLocaleString()} km (plan)` : '—'}
                    </td>
                    <td className="table-cell text-xs">${parseFloat(t.revenue||0).toLocaleString()}</td>
                    <td className="table-cell"><StatusBadge status={t.status} type="trip" /></td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1">
                        <button className="btn btn-sm text-gray-500 hover:text-primary-600" onClick={() => openDetail(t)} title="View">
                          <Eye size={14} />
                        </button>
                        {canDispatch && (
                          <>
                            {t.status === 'Draft' && (
                              <button className="btn btn-sm text-gray-500 hover:text-green-600" onClick={() => handleDispatch(t)} title="Dispatch">
                                <Play size={14} />
                              </button>
                            )}
                            {t.status === 'Dispatched' && (
                              <button className="btn btn-sm text-gray-500 hover:text-blue-600" onClick={() => openComplete(t)} title="Complete">
                                <CheckCircle size={14} />
                              </button>
                            )}
                            {(t.status === 'Draft' || t.status === 'Dispatched') && (
                              <button className="btn btn-sm text-gray-500 hover:text-red-600"
                                onClick={() => setModal({ type: 'cancel', data: t })} title="Cancel">
                                <XCircle size={14} />
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

      {/* Create Trip Modal */}
      <Modal open={modal.type === 'create'} onClose={() => setModal({ type: null })}
        title="Create New Trip" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Source *</label>
              <input className="input" value={form.source} onChange={f('source')} required placeholder="Warehouse A" />
            </div>
            <div>
              <label className="label">Destination *</label>
              <input className="input" value={form.destination} onChange={f('destination')} required placeholder="Distribution Center B" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Vehicle *</label>
              <select className="input" value={form.vehicle_id} onChange={f('vehicle_id')} required>
                <option value="">— Select Vehicle —</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.registration_number} — {v.name} ({v.max_load_capacity} kg max)
                  </option>
                ))}
              </select>
              {selectedVehicle && (
                <p className="text-xs text-gray-500 mt-1">Max capacity: {parseFloat(selectedVehicle.max_load_capacity).toLocaleString()} kg</p>
              )}
            </div>
            <div>
              <label className="label">Driver *</label>
              <select className="input" value={form.driver_id} onChange={f('driver_id')} required>
                <option value="">— Select Driver —</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} — {d.license_category} (Score: {d.safety_score})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Cargo Weight (kg) *</label>
              <input className="input" type="number" min="0" step="0.1" value={form.cargo_weight}
                onChange={f('cargo_weight')} required
                max={selectedVehicle?.max_load_capacity || undefined} />
            </div>
            <div>
              <label className="label">Planned Distance (km)</label>
              <input className="input" type="number" min="0" step="0.1" value={form.planned_distance} onChange={f('planned_distance')} />
            </div>
            <div>
              <label className="label">Expected Revenue ($)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.revenue} onChange={f('revenue')} />
            </div>
          </div>

          <div>
            <label className="label">Notes</label>
            <textarea className="input" rows={2} value={form.notes} onChange={f('notes')} />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Complete Trip Modal */}
      <Modal open={modal.type === 'complete'} onClose={() => setModal({ type: null })}
        title={`Complete Trip ${modal.data?.trip_number}`} size="md">
        <form onSubmit={handleComplete} className="space-y-4">
          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            Start odometer: <strong>{modal.data?.start_odometer ? parseFloat(modal.data.start_odometer).toLocaleString() : '—'} km</strong>
          </div>
          <div>
            <label className="label">End Odometer (km) *</label>
            <input className="input" type="number" min={modal.data?.start_odometer || 0} step="0.1"
              value={completeForm.end_odometer} onChange={fc('end_odometer')} required />
          </div>
          <div>
            <label className="label">Fuel Consumed (liters)</label>
            <input className="input" type="number" min="0" step="0.1"
              value={completeForm.fuel_consumed} onChange={fc('fuel_consumed')} />
          </div>
          <div>
            <label className="label">Actual Revenue ($)</label>
            <input className="input" type="number" min="0" step="0.01"
              value={completeForm.revenue} onChange={fc('revenue')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button type="button" className="btn-secondary" onClick={() => setModal({ type: null })}>Cancel</button>
            <button type="submit" className="btn-success" disabled={saving}>
              {saving ? 'Completing…' : 'Complete Trip'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Trip Detail Modal */}
      <Modal open={modal.type === 'detail'} onClose={() => setModal({ type: null })}
        title={`Trip ${modal.data?.trip_number}`} size="lg">
        {detail && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ['Status',        <StatusBadge status={detail.trip?.status} type="trip" />],
                ['Vehicle',       `${detail.trip?.vehicle_name} (${detail.trip?.registration_number})`],
                ['Driver',        detail.trip?.driver_name],
                ['Route',         `${detail.trip?.source} → ${detail.trip?.destination}`],
                ['Cargo',         `${parseFloat(detail.trip?.cargo_weight||0).toLocaleString()} kg`],
                ['Planned Dist',  detail.trip?.planned_distance ? `${detail.trip.planned_distance} km` : '—'],
                ['Actual Dist',   detail.trip?.actual_distance  ? `${detail.trip.actual_distance} km`  : '—'],
                ['Fuel Consumed', detail.trip?.fuel_consumed    ? `${detail.trip.fuel_consumed} L`     : '—'],
                ['Revenue',       `$${parseFloat(detail.trip?.revenue||0).toFixed(2)}`],
                ['Start Odometer',detail.trip?.start_odometer ? `${detail.trip.start_odometer} km` : '—'],
                ['End Odometer',  detail.trip?.end_odometer   ? `${detail.trip.end_odometer} km`   : '—'],
                ['Dispatched At', detail.trip?.dispatched_at  ? new Date(detail.trip.dispatched_at).toLocaleString() : '—'],
              ].map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500 mb-0.5">{k}</p>
                  <p className="font-medium">{v}</p>
                </div>
              ))}
            </div>
            {detail.expenses?.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2">Expenses</p>
                {detail.expenses.map(e => (
                  <div key={e.id} className="flex justify-between text-xs bg-gray-50 rounded px-3 py-2 mb-1">
                    <span>{e.category} — {e.description}</span>
                    <span className="font-semibold">${parseFloat(e.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Cancel Confirm */}
      <ConfirmDialog
        open={modal.type === 'cancel'}
        onClose={() => setModal({ type: null })}
        onConfirm={handleCancel}
        title="Cancel Trip"
        message={`Cancel trip "${modal.data?.trip_number}"? If dispatched, vehicle and driver will be restored to Available.`}
        confirmLabel="Cancel Trip"
      />
    </div>
  );
}
