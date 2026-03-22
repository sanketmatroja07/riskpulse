'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import Link from 'next/link';

function StatCard({ label, value, change, color = 'text-primary' }: any) {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <p className="text-xs text-text-muted uppercase tracking-wider">{label}</p>
      <p className={cn("text-2xl font-bold mt-1", color)}>{value}</p>
      {change && <p className="text-xs text-text-muted mt-1">{change}</p>}
    </div>
  );
}

function MiniChart({ data }: { data: { date: string; count: number }[] }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full bg-primary/30 rounded-t"
            style={{ height: `${(d.count / max) * 100}%`, minHeight: '2px' }}
          />
          <span className="text-[9px] text-text-muted">{d.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getDashboardStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-h1">Dashboard</h1>
            <p className="text-text-secondary text-sm mt-1">Risk Operations Overview</p>
          </div>
          <Link href="/alerts" className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition">
            View Alert Queue
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}
          </div>
        ) : stats ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Open Alerts" value={stats.open_alerts} color="text-warning" />
              <StatCard label="Open Cases" value={stats.open_cases} color="text-primary" />
              <StatCard label="Critical Alerts" value={stats.critical_alerts} color="text-danger" />
              <StatCard label="SLA Breaches" value={stats.sla_breaches} color={stats.sla_breaches > 0 ? 'text-danger' : 'text-accent'} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Total Alerts" value={stats.total_alerts} />
              <StatCard label="Total Cases" value={stats.total_cases} />
              <StatCard label="Resolved Today" value={stats.resolved_today} color="text-accent" />
              <StatCard label="Detection Rate" value={`${(stats.detection_rate * 100).toFixed(0)}%`} color="text-accent" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Alert Trend */}
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Alert Trend (7 days)</h3>
                <MiniChart data={stats.alert_trend || []} />
              </div>

              {/* Alerts by Type */}
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Alerts by Type</h3>
                <div className="space-y-2">
                  {Object.entries(stats.alerts_by_type || {}).map(([type, count]: any) => (
                    <div key={type} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary capitalize">{type.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(stats.alerts_by_type || {}).length === 0 && (
                    <p className="text-text-muted text-sm">No alert data</p>
                  )}
                </div>
              </div>

              {/* Cases by Status */}
              <div className="bg-bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold mb-4">Cases by Status</h3>
                <div className="space-y-2">
                  {Object.entries(stats.cases_by_status || {}).map(([status, count]: any) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary capitalize">{status.replace(/_/g, ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                  {Object.keys(stats.cases_by_status || {}).length === 0 && (
                    <p className="text-text-muted text-sm">No case data</p>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="mt-6 bg-bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-4">Recent Activity</h3>
              {(stats.recent_activity || []).length === 0 ? (
                <p className="text-text-muted text-sm py-4 text-center">No recent activity</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {stats.recent_activity.map((a: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-text-secondary">{a.user_email}</span>
                      <span className="text-text-primary font-medium">{a.action?.replace(/_/g, ' ')}</span>
                      <span className="text-text-muted">{a.resource_type}</span>
                      <span className="ml-auto text-xs text-text-muted">{a.created_at ? formatRelativeTime(a.created_at) : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-20 text-text-muted">
            <p className="text-lg">Unable to load dashboard data</p>
            <p className="text-sm mt-2">Make sure the API is running on port 8000</p>
            <p className="text-xs mt-4 max-w-md mx-auto">
              From the riskpulse folder: use <code className="bg-bg-card px-1.5 py-0.5 rounded">./run.sh</code> (no Docker)
              or <code className="bg-bg-card px-1.5 py-0.5 rounded">docker compose up</code>
            </p>
          </div>
        )}
      </div>
    </AppShell>
  );
}
