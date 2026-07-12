import clsx from 'clsx';

const VEHICLE_STATUS = {
  'Available': 'bg-green-100 text-green-700',
  'On Trip':   'bg-blue-100 text-blue-700',
  'In Shop':   'bg-amber-100 text-amber-700',
  'Retired':   'bg-gray-100 text-gray-500',
};

const DRIVER_STATUS = {
  'Available': 'bg-green-100 text-green-700',
  'On Trip':   'bg-blue-100 text-blue-700',
  'Off Duty':  'bg-gray-100 text-gray-500',
  'Suspended': 'bg-red-100 text-red-700',
};

const TRIP_STATUS = {
  'Draft':      'bg-gray-100 text-gray-600',
  'Dispatched': 'bg-blue-100 text-blue-700',
  'Completed':  'bg-green-100 text-green-700',
  'Cancelled':  'bg-red-100 text-red-600',
};

const MAINT_STATUS = {
  'Active':    'bg-amber-100 text-amber-700',
  'Completed': 'bg-green-100 text-green-700',
};

const MAP = { vehicle: VEHICLE_STATUS, driver: DRIVER_STATUS, trip: TRIP_STATUS, maintenance: MAINT_STATUS };

export default function StatusBadge({ status, type = 'vehicle' }) {
  const color = MAP[type]?.[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={clsx('badge', color)}>
      {status}
    </span>
  );
}
