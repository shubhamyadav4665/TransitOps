export default function StatusBadge({ status, context = 'trip' }) {
  // Map DB values to display labels and styles
  const getConfig = () => {
    if (context === 'maintenance') {
      const map = {
        'Scheduled':  { label: 'Scheduled',  classes: 'badge badge-info' },
        'Active':     { label: 'In Shop',    classes: 'badge badge-warning' },
        'Completed':  { label: 'Closed',     classes: 'badge badge-success' },
      };
      return map[status] || { label: status, classes: 'badge bg-gray-100 text-gray-700' };
    }

    if (context === 'driver') {
      const map = {
        'Available': { label: 'Available', classes: 'badge badge-success' },
        'On Trip':   { label: 'On Trip',   classes: 'badge badge-info' },
        'Off Duty':  { label: 'Off Duty',  classes: 'badge bg-gray-100 text-gray-700' },
        'Suspended': { label: 'Suspended', classes: 'badge badge-danger' },
      };
      return map[status] || { label: status, classes: 'badge bg-gray-100 text-gray-700' };
    }

    // Trip context
    const map = {
      'Planned':    { label: 'Planned',    classes: 'badge badge-info' },
      'Dispatched': { label: 'Dispatched', classes: 'badge badge-warning' },
      'In Transit': { label: 'In Transit', classes: 'badge badge-primary' },
      'Completed':  { label: 'Completed',  classes: 'badge badge-success' },
      'Cancelled':  { label: 'Cancelled',  classes: 'badge badge-danger' },
    };
    return map[status] || { label: status, classes: 'badge bg-gray-100 text-gray-700' };
  };

  const { label, classes } = getConfig();

  return <span className={classes}>{label}</span>;
}
