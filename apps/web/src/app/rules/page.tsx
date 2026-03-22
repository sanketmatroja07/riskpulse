'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { formatRelativeTime, cn } from '@/lib/utils';

function RuleTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    threshold: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    velocity: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    blacklist: 'bg-red-500/10 text-red-400 border-red-500/20',
    pattern: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    composite: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs border", colors[type] || 'bg-gray-500/10 text-gray-400 border-gray-500/20')}>
      {type}
    </span>
  );
}

function BacktestPanel({ rule, onClose }: { rule: any; onClose: () => void }) {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runBacktest = async () => {
    setLoading(true);
    setResult(null);
    try {
      const r = await api.backtestRule(rule.id, days);
      setResult(r);
    } catch (e: any) {
      console.error(e);
    }
    setLoading(false);
  };

  const maxDaily = result?.daily_hits ? Math.max(...result.daily_hits.map((d: any) => d.count), 1) : 1;

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            Backtest: {rule.name}
          </h3>
          <p className="text-xs text-text-muted mt-1">Run this rule against historical events to estimate performance</p>
        </div>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2 bg-bg border border-border rounded-lg px-3 py-2">
          <label className="text-xs text-text-muted">Period:</label>
          <select
            value={days}
            onChange={e => setDays(Number(e.target.value))}
            className="bg-transparent text-sm text-text-primary outline-none"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
        </div>
        <button
          onClick={runBacktest}
          disabled={loading}
          className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          )}
          Run Backtest
        </button>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-bg border border-border rounded-xl p-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Events Checked</p>
              <p className="text-xl font-bold text-text-primary mt-1">{result.events_checked.toLocaleString()}</p>
            </div>
            <div className="bg-bg border border-border rounded-xl p-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Matches</p>
              <p className="text-xl font-bold text-primary mt-1">{result.events_matched}</p>
            </div>
            <div className="bg-bg border border-border rounded-xl p-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Hit Rate</p>
              <p className="text-xl font-bold text-warning mt-1">{(result.hit_rate * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-bg border border-border rounded-xl p-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">Est. Precision</p>
              <p className={cn("text-xl font-bold mt-1", result.estimated_precision > 0.7 ? 'text-accent' : result.estimated_precision > 0.4 ? 'text-warning' : 'text-danger')}>
                {(result.estimated_precision * 100).toFixed(0)}%
              </p>
            </div>
            <div className="bg-bg border border-border rounded-xl p-3">
              <p className="text-[10px] text-text-muted uppercase tracking-wider">True / False Pos</p>
              <p className="text-xl font-bold mt-1">
                <span className="text-accent">{result.true_positives}</span>
                <span className="text-text-muted mx-1">/</span>
                <span className="text-danger">{result.false_positives}</span>
              </p>
            </div>
          </div>

          {/* Daily Chart */}
          {result.daily_hits?.length > 0 && (
            <div className="bg-bg border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3">Daily Matches</h4>
              <div className="flex items-end gap-1 h-24">
                {result.daily_hits.map((d: any, i: number) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count} matches`}>
                    <span className="text-[9px] text-text-muted">{d.count}</span>
                    <div
                      className="w-full bg-primary/40 rounded-t hover:bg-primary/60 transition"
                      style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? '4px' : '1px' }}
                    />
                    <span className="text-[8px] text-text-muted">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample Matches */}
          {result.sample_matches?.length > 0 && (
            <div className="bg-bg border border-border rounded-xl p-4">
              <h4 className="text-xs font-semibold text-text-muted mb-3">Sample Matches ({Math.min(result.sample_matches.length, 10)} of {result.events_matched})</h4>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-text-muted border-b border-border">
                      <th className="text-left py-2 pr-3">Event Type</th>
                      <th className="text-left py-2 pr-3">Risk Score</th>
                      <th className="text-left py-2 pr-3">Data</th>
                      <th className="text-left py-2">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.sample_matches.slice(0, 10).map((m: any, i: number) => (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 pr-3 capitalize">{m.event_type}</td>
                        <td className="py-2 pr-3">
                          <span className={cn("font-mono", m.risk_score > 0.7 ? 'text-danger' : m.risk_score > 0.4 ? 'text-warning' : 'text-accent')}>
                            {m.risk_score?.toFixed(2)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 font-mono text-text-muted max-w-xs truncate">
                          {Object.entries(m.data_preview || {}).map(([k, v]) => `${k}=${v}`).join(', ')}
                        </td>
                        <td className="py-2 text-text-muted">{m.occurred_at ? formatRelativeTime(m.occurred_at) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recommendation */}
          <div className={cn("rounded-xl p-4 border", result.estimated_precision > 0.6 ? 'bg-accent/5 border-accent/20' : 'bg-warning/5 border-warning/20')}>
            <div className="flex items-start gap-3">
              {result.estimated_precision > 0.6 ? (
                <svg className="w-5 h-5 text-accent mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              ) : (
                <svg className="w-5 h-5 text-warning mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              )}
              <div>
                <p className="text-sm font-medium">
                  {result.estimated_precision > 0.6
                    ? 'This rule looks production-ready'
                    : 'This rule may need tuning'}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {result.estimated_precision > 0.6
                    ? `Estimated precision of ${(result.estimated_precision * 100).toFixed(0)}% with ${result.events_matched} matches over ${days} days. Consider deploying.`
                    : `Estimated precision of ${(result.estimated_precision * 100).toFixed(0)}% suggests too many false positives. Consider tightening the rule conditions.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function RulesPage() {
  const { addToast, user } = useAppStore();
  const [rules, setRules] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [backtestRule, setBacktestRule] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newRule, setNewRule] = useState({ name: '', description: '', rule_type: 'threshold', severity: 'medium', alert_type: 'payment_fraud', condition_json: '{"field": "amount", "operator": ">", "threshold": 5000}' });

  useEffect(() => {
    loadRules();
  }, [typeFilter]);

  const loadRules = async () => {
    setLoading(true);
    try {
      const params: any = { page_size: '50' };
      if (typeFilter) params.rule_type = typeFilter;
      const data = await api.getRules(params);
      setRules(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  const handleToggle = async (id: string) => {
    try {
      const updated = await api.toggleRule(id);
      setRules(prev => prev.map(r => r.id === id ? updated : r));
      addToast({ type: 'success', title: `Rule ${updated.enabled ? 'enabled' : 'disabled'}` });
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
  };

  const handleDeploy = async (id: string) => {
    try {
      await api.deployRule(id);
      addToast({ type: 'success', title: 'Rule deployed' });
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
  };

  const handleCreate = async () => {
    try {
      const parsed = JSON.parse(newRule.condition_json);
      await api.createRule({ ...newRule, condition_json: parsed });
      addToast({ type: 'success', title: 'Rule created' });
      setShowCreate(false);
      loadRules();
    } catch (e: any) { addToast({ type: 'error', title: e.message || 'Invalid JSON' }); }
  };

  const canEdit = user?.role === 'admin' || user?.role === 'engineer';

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-h1">Detection Rules</h1>
            <p className="text-text-secondary text-sm mt-1">{total} rules configured</p>
          </div>
          {canEdit && (
            <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Rule
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary">
            <option value="">All Types</option>
            <option value="threshold">Threshold</option>
            <option value="velocity">Velocity</option>
            <option value="blacklist">Blacklist</option>
            <option value="pattern">Pattern</option>
            <option value="composite">Composite</option>
          </select>
        </div>

        {/* Create Rule Form */}
        {showCreate && (
          <div className="bg-bg-card border border-primary/20 rounded-xl p-6 mb-4">
            <h3 className="text-sm font-semibold mb-4">Create New Rule</h3>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <input value={newRule.name} onChange={e => setNewRule(r => ({ ...r, name: e.target.value }))} placeholder="Rule name" className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary" />
              <select value={newRule.rule_type} onChange={e => setNewRule(r => ({ ...r, rule_type: e.target.value }))} className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-primary">
                <option value="threshold">Threshold</option>
                <option value="velocity">Velocity</option>
                <option value="blacklist">Blacklist</option>
                <option value="pattern">Pattern</option>
                <option value="composite">Composite</option>
              </select>
              <select value={newRule.severity} onChange={e => setNewRule(r => ({ ...r, severity: e.target.value }))} className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-primary">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <select value={newRule.alert_type} onChange={e => setNewRule(r => ({ ...r, alert_type: e.target.value }))} className="px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-primary">
                <option value="payment_fraud">Payment Fraud</option>
                <option value="account_takeover">Account Takeover</option>
                <option value="promo_abuse">Promo Abuse</option>
                <option value="bot_attack">Bot Attack</option>
                <option value="chargeback_risk">Chargeback Risk</option>
              </select>
            </div>
            <input value={newRule.description} onChange={e => setNewRule(r => ({ ...r, description: e.target.value }))} placeholder="Description" className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary mb-3" />
            <textarea value={newRule.condition_json} onChange={e => setNewRule(r => ({ ...r, condition_json: e.target.value }))} placeholder='{"field": "amount", "operator": ">", "threshold": 5000}' className="w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary font-mono h-20 resize-none mb-3" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition">Cancel</button>
              <button onClick={handleCreate} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition">Create Rule</button>
            </div>
          </div>
        )}

        {/* Rules List */}
        {loading ? (
          <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
        ) : rules.length === 0 ? (
          <div className="py-20 text-center text-text-muted bg-bg-card border border-border rounded-xl">No rules found</div>
        ) : (
          <div className="space-y-2">
            {rules.map(rule => (
              <div key={rule.id}>
                <div className={cn("bg-bg-card border rounded-xl p-5 transition", rule.enabled ? 'border-border hover:border-border-hover' : 'border-border/50 opacity-60')}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1.5">
                        <h3 className="text-sm font-semibold">{rule.name}</h3>
                        <RuleTypeBadge type={rule.rule_type} />
                        <span className={cn("px-2 py-0.5 rounded-full text-xs border",
                          rule.severity === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20' :
                          rule.severity === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' :
                          rule.severity === 'medium' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20' :
                          'text-green-400 bg-green-500/10 border-green-500/20'
                        )}>{rule.severity}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", rule.enabled ? 'bg-accent/10 text-accent' : 'bg-gray-500/10 text-gray-400')}>
                          {rule.enabled ? 'Active' : 'Disabled'}
                        </span>
                        <span className="text-[10px] text-text-muted font-mono">v{rule.version}</span>
                      </div>
                      {rule.description && <p className="text-xs text-text-muted mb-2">{rule.description}</p>}
                      <pre className="text-xs font-mono text-text-secondary bg-bg px-3 py-1.5 rounded inline-block max-w-lg truncate">
                        {JSON.stringify(rule.condition_json)}
                      </pre>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button
                        onClick={() => setBacktestRule(backtestRule?.id === rule.id ? null : rule)}
                        className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-1.5",
                          backtestRule?.id === rule.id
                            ? "bg-primary text-white"
                            : "bg-primary/10 text-primary hover:bg-primary/20"
                        )}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        Backtest
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => handleToggle(rule.id)} className={cn("px-3 py-1.5 rounded-lg text-xs transition", rule.enabled ? 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20' : 'bg-accent/10 text-accent hover:bg-accent/20')}>
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button onClick={() => handleDeploy(rule.id)} className="px-3 py-1.5 bg-accent/10 text-accent rounded-lg text-xs hover:bg-accent/20 transition">
                            Deploy
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Backtest Panel */}
                {backtestRule?.id === rule.id && (
                  <BacktestPanel rule={rule} onClose={() => setBacktestRule(null)} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
