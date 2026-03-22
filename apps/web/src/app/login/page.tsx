'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, addToast } = useAppStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api.login(email, password);
      setUser(data.user);
      addToast({ type: 'success', title: `Welcome back, ${data.user.name}` });
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (preset: string) => {
    const presets: Record<string, string> = {
      admin: 'admin@riskpulse.io',
      analyst: 'sarah.chen@riskpulse.io',
      engineer: 'alex.kumar@riskpulse.io',
      viewer: 'viewer@riskpulse.io',
    };
    setEmail(presets[preset] || '');
    setPassword('riskpulse123');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-text-primary">RiskPulse</h1>
              <p className="text-xs text-text-secondary">Investigation Automation Platform</p>
            </div>
          </div>
        </div>

        {/* Login Form */}
        <div className="bg-bg-surface border border-border rounded-2xl p-8">
          <h2 className="text-lg font-semibold mb-6">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-bg-card border border-border rounded-lg text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-bg-card border border-border rounded-lg text-text-primary placeholder-text-muted focus:border-primary focus:ring-1 focus:ring-primary outline-none transition"
                placeholder="Enter password"
                required
              />
            </div>

            {error && (
              <div className="p-3 bg-danger/10 border border-danger/20 rounded-lg text-danger text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          {/* Signup link */}
          <p className="text-center text-sm text-text-secondary mt-6">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Start free trial
            </Link>
          </p>

          {/* Quick Login */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-text-muted mb-3">Quick login (demo accounts):</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'admin', label: 'Admin', color: 'text-red-400' },
                { key: 'analyst', label: 'Analyst', color: 'text-blue-400' },
                { key: 'engineer', label: 'Engineer', color: 'text-green-400' },
                { key: 'viewer', label: 'Viewer', color: 'text-gray-400' },
              ].map(p => (
                <button
                  key={p.key}
                  onClick={() => quickLogin(p.key)}
                  className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm hover:border-border-hover transition flex items-center gap-2"
                >
                  <span className={`w-2 h-2 rounded-full ${p.color} bg-current`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-text-muted mt-6">
          RiskPulse v2.0 - Investigation Automation Platform
        </p>
      </div>
    </div>
  );
}
