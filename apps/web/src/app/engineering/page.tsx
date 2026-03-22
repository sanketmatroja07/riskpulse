'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { formatRelativeTime, cn } from '@/lib/utils';

export default function EngineeringPage() {
  const { addToast } = useAppStore();
  const [features, setFeatures] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('features');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [f, r, m] = await Promise.all([
        api.getFeatures({ page_size: '100' }),
        api.getRules({ page_size: '100' }),
        api.getSystemMetrics(),
      ]);
      setFeatures(f.items || []);
      setRules(r.items || []);
      setMetrics(m);
    } catch {}
    setLoading(false);
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-h1">Risk Engineering</h1>
          <p className="text-text-secondary text-sm mt-1">Features, rules, and system health</p>
        </div>

        {/* System Health */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-muted">System Health</p>
              <p className={cn("text-lg font-bold mt-1", metrics.system_health === 'healthy' ? 'text-accent' : 'text-danger')}>{metrics.system_health}</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-muted">Events (24h)</p>
              <p className="text-lg font-bold mt-1 text-primary">{metrics.events_processed_24h}</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-muted">Alerts (24h)</p>
              <p className="text-lg font-bold mt-1 text-warning">{metrics.alerts_generated_24h}</p>
            </div>
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-text-muted">Avg Processing</p>
              <p className="text-lg font-bold mt-1 text-text-primary">{metrics.avg_processing_time_ms}ms</p>
            </div>
          </div>
        )}

        {/* Job Status */}
        {metrics && (
          <div className="bg-bg-card border border-border rounded-xl p-5 mb-6">
            <h3 className="text-sm font-semibold mb-3">Job Queue Status</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-text-muted">Pending</p>
                <p className="text-xl font-bold text-primary">{metrics.jobs_pending}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Running</p>
                <p className="text-xl font-bold text-warning">{metrics.jobs_running}</p>
              </div>
              <div>
                <p className="text-xs text-text-muted">Failed</p>
                <p className={cn("text-xl font-bold", metrics.jobs_failed > 0 ? 'text-danger' : 'text-accent')}>{metrics.jobs_failed}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-border flex gap-0 mb-6">
          {['features', 'rules_overview', 'trends'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn("px-4 py-2 text-sm font-medium border-b-2 transition capitalize",
                activeTab === tab ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
              )}
            >
              {tab === 'rules_overview' ? 'Rules Overview' : tab}
            </button>
          ))}
        </div>

        {/* Features Tab */}
        {activeTab === 'features' && (
          <div className="space-y-3">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)
            ) : features.length === 0 ? (
              <div className="py-12 text-center text-text-muted bg-bg-card border border-border rounded-xl">No features configured</div>
            ) : features.map(f => (
              <div key={f.id} className="bg-bg-card border border-border rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold font-mono">{f.name}</h3>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">{f.feature_type}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded", f.enabled ? "bg-accent/10 text-accent" : "bg-gray-500/10 text-gray-400")}>{f.enabled ? 'Active' : 'Inactive'}</span>
                  </div>
                  <span className="text-xs text-text-muted">v{f.version}</span>
                </div>
                {f.description && <p className="text-xs text-text-muted mb-2">{f.description}</p>}
                <pre className="text-xs font-mono bg-bg p-2 rounded overflow-x-auto text-text-secondary">{JSON.stringify(f.definition_json, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}

        {/* Rules Overview Tab */}
        {activeTab === 'rules_overview' && (
          <div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-text-muted">Total Rules</p>
                <p className="text-2xl font-bold text-primary mt-1">{rules.length}</p>
              </div>
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-text-muted">Active</p>
                <p className="text-2xl font-bold text-accent mt-1">{rules.filter(r => r.enabled).length}</p>
              </div>
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-text-muted">Disabled</p>
                <p className="text-2xl font-bold text-text-muted mt-1">{rules.filter(r => !r.enabled).length}</p>
              </div>
              <div className="bg-bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-text-muted">By Type</p>
                <div className="mt-1 space-y-0.5">
                  {Object.entries(rules.reduce((acc: any, r: any) => { acc[r.rule_type] = (acc[r.rule_type] || 0) + 1; return acc; }, {})).map(([t, c]: any) => (
                    <p key={t} className="text-xs"><span className="text-text-muted capitalize">{t}:</span> <span className="font-medium">{c}</span></p>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-2">
              {rules.map(r => (
                <div key={r.id} className="bg-bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
                  <div className={cn("w-2 h-2 rounded-full", r.enabled ? "bg-accent" : "bg-gray-500")} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.name}</p>
                    <p className="text-xs text-text-muted capitalize">{r.rule_type} | {r.alert_type?.replace(/_/g, ' ')} | v{r.version}</p>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", r.severity === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20' : r.severity === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20')}>{r.severity}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trends Tab */}
        {activeTab === 'trends' && (
          <div className="bg-bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold mb-4">Detection Trends</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs text-text-muted mb-3">Alert Types Distribution</h4>
                {['payment_fraud', 'account_takeover', 'promo_abuse', 'bot_attack', 'chargeback_risk'].map(type => {
                  const count = rules.filter(r => r.alert_type === type && r.enabled).length;
                  return (
                    <div key={type} className="flex items-center gap-2 py-1">
                      <span className="text-xs text-text-secondary capitalize w-32">{type.replace(/_/g, ' ')}</span>
                      <div className="flex-1 bg-bg rounded-full h-2">
                        <div className="bg-primary rounded-full h-2" style={{ width: `${(count / Math.max(rules.length, 1)) * 100}%` }} />
                      </div>
                      <span className="text-xs text-text-muted w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div>
                <h4 className="text-xs text-text-muted mb-3">Feature Coverage</h4>
                <div className="space-y-2">
                  {features.slice(0, 6).map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-xs">
                      <div className={cn("w-2 h-2 rounded-full", f.enabled ? "bg-accent" : "bg-gray-500")} />
                      <span className="text-text-secondary font-mono">{f.name}</span>
                      <span className="ml-auto text-text-muted">{f.feature_type}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
