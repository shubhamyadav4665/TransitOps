import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard, Truck, Users, Navigation, Wrench,
  Fuel, ReceiptText, BarChart3, LogOut, Menu, X,
  ChevronRight, Bell
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { to: '/',           label: 'Dashboard',   icon: LayoutDashboard },
  { to: '/vehicles',   label: 'Vehicles',     icon: Truck },
  { to: '/drivers',    label: 'Drivers',      icon: Users },
  { to: '/trips',      label: 'Trips',        icon: Navigation },
  { to: '/maintenance',label: 'Maintenance',  icon: Wrench },
  { to: '/fuel',       label: 'Fuel Logs',    icon: Fuel },
  { to: '/expenses',   label: 'Expenses',     icon: ReceiptText },
  { to: '/reports',    label: 'Reports',      icon: BarChart3 },
];

const ROLE_COLOR = {
  'Fleet Manager':     'bg-blue-100 text-blue-700',
  'Dispatcher':        'bg-green-100 text-green-700',
  'Safety Officer':    'bg-amber-100 text-amber-700',
  'Financial Analyst': 'bg-purple-100 text-purple-700',
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={clsx(
        'fixed inset-y-0 left-0 z-30 w-64 flex flex-col bg-gray-900 text-white transition-transform duration-300',
        'lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-700">
          <div className="w-9 h-9 rounded-lg bg-primary-600 flex items-center justify-center">
            <Truck size={20} />
          </div>
          <div>
            <p className="font-bold text-white leading-tight">TransitOps</p>
            <p className="text-xs text-gray-400">Smart Transport</p>
          </div>
          <button className="ml-auto lg:hidden" onClick={() => setOpen(false)}>
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary-600 flex items-center justify-center font-bold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <span className={clsx('badge text-xs', ROLE_COLOR[user?.role] || 'bg-gray-700 text-gray-300')}>
                {user?.role}
              </span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-6 gap-4 flex-shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Breadcrumb placeholder */}
          <div className="flex-1" />

          <button className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <Bell size={20} />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.[0]?.toUpperCase()}
            </div>
            <span className="hidden sm:block text-sm font-medium text-gray-700">{user?.name}</span>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
