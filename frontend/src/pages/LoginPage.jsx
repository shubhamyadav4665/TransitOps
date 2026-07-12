import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Truck, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', role: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  const fill = (email, role) => setForm({ email, password: 'password123', role });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Hero Section */}
        <div className="hidden lg:block">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-3 mb-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-odoo-purple to-odoo-teal flex items-center justify-center text-white shadow-lg">
                <Truck size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">TransitOps</h1>
                <p className="text-gray-600">Smart Transport Platform</p>
              </div>
            </div>
            
            <h2 className="text-5xl font-bold text-gray-900 leading-tight">
              Manage your fleet with confidence
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Streamline operations, track vehicles in real-time, and optimize routes with our comprehensive transport management solution.
            </p>

            <div className="space-y-4 pt-8">
              {[
                'Real-time vehicle tracking',
                'Automated maintenance scheduling',
                'Advanced analytics & reporting',
                'Role-based access control'
              ].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-odoo-teal/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-odoo-teal" />
                  </div>
                  <span className="text-gray-700 font-medium">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="w-full">
          <div className="card max-w-md mx-auto">
            <div className="card-body space-y-6">
              {/* Mobile Logo */}
              <div className="lg:hidden flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-odoo-purple to-odoo-teal flex items-center justify-center text-white">
                  <Truck size={24} />
                </div>
                <span className="text-2xl font-bold text-gray-900">TransitOps</span>
              </div>

              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Sign in</h2>
                <p className="text-gray-600">Enter your credentials to continue</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@transitops.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                {/* Password */}
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      className="input pr-12"
                      placeholder="••••••••"
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      required
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      onClick={() => setShowPwd(v => !v)}
                    >
                      {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                {/* Role */}
                <div>
                  <label className="label">Role</label>
                  <select
                    className="select"
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                    required
                  >
                    <option value="">Select your role</option>
                    <option value="Fleet Manager">Fleet Manager</option>
                    <option value="Dispatcher">Dispatcher</option>
                    <option value="Safety Officer">Safety Officer</option>
                    <option value="Financial Analyst">Financial Analyst</option>
                  </select>
                </div>

                {/* Remember & Forgot */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-gray-300 text-odoo-purple focus:ring-odoo-purple"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                    />
                    <span className="text-sm text-gray-700">Remember me</span>
                  </label>
                  <button
                    type="button"
                    className="text-sm text-odoo-purple hover:text-odoo-purple-dark font-medium"
                    onClick={() => toast('Password reset not yet implemented. Contact your administrator.', { 
                      icon: '🔐',
                      duration: 3000 
                    })}
                  >
                    Forgot password?
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center"
                >
                  {loading ? 'Signing in...' : 'Sign in'}
                  <ArrowRight size={20} />
                </button>
              </form>

              {/* Sign Up Link */}
              <div className="text-center pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/signup')}
                    className="text-odoo-purple hover:text-odoo-purple-dark font-semibold"
                  >
                    Sign up
                  </button>
                </p>
              </div>

              {/* Demo Accounts */}
              <details className="pt-4 border-t border-gray-100">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
                  Show demo accounts
                </summary>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    { label: 'Fleet Manager', email: 'fleet@transitops.com', role: 'Fleet Manager' },
                    { label: 'Dispatcher', email: 'dispatcher@transitops.com', role: 'Dispatcher' },
                    { label: 'Safety Officer', email: 'safety@transitops.com', role: 'Safety Officer' },
                    { label: 'Finance', email: 'finance@transitops.com', role: 'Financial Analyst' },
                  ].map(a => (
                    <button
                      key={a.email}
                      type="button"
                      onClick={() => fill(a.email, a.role)}
                      className="text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-odoo-purple hover:bg-odoo-purple/5 transition-all duration-200"
                    >
                      <p className="text-xs font-semibold text-gray-900">{a.label}</p>
                      <p className="text-xs text-gray-500 truncate mt-1">{a.email}</p>
                    </button>
                  ))}
                </div>
              </details>
            </div>
          </div>

          {/* Role Info */}
          
        </div>
      </div>
    </div>
  );
}
