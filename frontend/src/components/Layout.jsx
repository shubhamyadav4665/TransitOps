import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  LayoutDashboard, Truck, Users, Navigation, Wrench, 
  Fuel, BarChart3, Settings, LogOut
} from 'lucide-react';

// Navigation items with role-based visibility
const NAV = [
  { to: '/',             label: 'Dashboard',      icon: LayoutDashboard, roles: ['Dispatcher'] },
  { to: '/vehicles',     label: 'Fleet',           icon: Truck,           roles: ['Fleet Manager'] },
  { to: '/drivers',      label: 'Drivers',         icon: Users,           roles: ['Safety Officer'] },
  { to: '/trips',        label: 'Trips',           icon: Navigation,      roles: ['Dispatcher'] },
  { to: '/maintenance',  label: 'Maintenance',     icon: Wrench,          roles: ['Fleet Manager'] },
  { to: '/fuel-expenses',label: 'Fuel & Expenses', icon: Fuel,            roles: ['Financial Analyst'] },
  { to: '/analytics',    label: 'Analytics',       icon: BarChart3,       roles: ['Financial Analyst'] },
  { to: '/settings',     label: 'Settings',        icon: Settings,        roles: ['Fleet Manager', 'Dispatcher', 'Safety Officer', 'Financial Analyst'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-200">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center text-white">
            <Truck size={18} />
          </div>
          <span className="text-lg font-bold text-gray-900">TransitOps</span>
        </div>

        {/* Nav links — filtered by role */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.filter(item => !item.roles || item.roles.includes(user?.role)).map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
              <p className="text-xs text-gray-500 truncate">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="btn-ghost w-full justify-start"
          >
            <LogOut size={18} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="pl-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
