import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { Truck, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function SignUpPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match', { duration: 3000 });
      return;
    }

    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters', { duration: 3000 });
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/signup', {
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role
      });
      
      toast.success(res.data.message || 'Account created successfully!');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sign up failed', { duration: 3000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Side - Benefits */}
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
              Start managing your fleet today
            </h2>
            
            <p className="text-xl text-gray-600 leading-relaxed">
              Join hundreds of transport companies using TransitOps to streamline operations and boost efficiency.
            </p>

            <div className="space-y-4 pt-8">
              {[
                { title: 'Quick Setup', desc: 'Get started in minutes' },
                { title: 'Role-Based Access', desc: 'Perfect for teams of any size' },
                { title: 'Real-Time Insights', desc: 'Track everything that matters' },
                { title: 'Secure & Reliable', desc: 'Enterprise-grade security' }
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-odoo-teal/10 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 size={20} className="text-odoo-teal" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.title}</h3>
                    <p className="text-sm text-gray-600">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Sign Up Form */}
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
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Create account</h2>
                <p className="text-gray-600">Get started with TransitOps</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Name */}
                <div>
                  <label className="label">Full Name</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="John Doe"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    autoFocus
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="label">Email address</label>
                  <input
                    type="email"
                    className="input"
                    placeholder="you@company.com"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    required
                  />
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
                  <p className="text-xs text-gray-500 mt-2">
                    Your role determines what features you can access
                  </p>
                </div>

                {/* Password */}
                <div>
                  <label className="label">Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Must be at least 6 characters
                  </p>
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="label">Confirm Password</label>
                  <input
                    type="password"
                    className="input"
                    placeholder="••••••••"
                    value={form.confirmPassword}
                    onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))}
                    required
                    minLength={6}
                  />
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary w-full justify-center mt-6"
                >
                  {loading ? 'Creating account...' : 'Create account'}
                  <ArrowRight size={20} />
                </button>
              </form>

              {/* Sign In Link */}
              <div className="text-center pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="text-odoo-purple hover:text-odoo-purple-dark font-semibold"
                  >
                    Sign in
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* Terms */}
          <p className="mt-6 text-center text-xs text-gray-500 max-w-md mx-auto px-6">
            By creating an account, you agree to our{' '}
            <a href="#" className="text-odoo-purple hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-odoo-purple hover:underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
