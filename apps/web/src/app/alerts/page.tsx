'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { formatRelativeTime, severityColor, statusColor, cn } from '@/lib/utils';

export default function AlertsPage() {
  const router = useRouter();
  const { addToast } = useAppStore();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', alert_type: '', severity: '' });
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params: any = { page: String(page), page_size: '25' };
      if (filters.status) params.status = filters.status;
      if (filters.alert_type) params.alert_type = filters.alert_type;
      if (filters.severity) params.severity = filters.severity;
      const data = await api.getAlerts(params);
      setAlerts(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { loadAlerts(); }, [page, filters]);

  const handleBulkAction = async (action: string) => {
    if (selected.size === 0) return;
    try {
      await api.bulkAlertAction({ alert_ids: Array.from(selected), action });
      addToast({ type: 'success', title: `${selected.size} alerts ${action}d` });
      setSelected(new Set());
      loadAlerts();
    } catch (e: any) {
      addToast({ type: 'error', title: e.message });
    }
  };

  const handleCreateCase = async (alertId: string) => {
    try {
      const c = await api.createCaseFromAlert(alertId);
      addToast({ type: 'success', title: 'Case created', message: c.case_number });
      router.push(`/cases/${c.id}`);
    } catch (e: any) {
      addToast({ type: 'error', title: e.message });
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === alerts.length) setSelected(new Set());
    else setSelected(new Set(alerts.map(a => a.id)));
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-h1">Alert Inbox</h1>
            <p className="text-text-secondary text-sm mt-1">{total} total alerts</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <select
            value={filters.status}
            onChange={e => { setFilters(f => ({ ...f, status: e.target.value })); setPage(1); }}
            className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary"
          >
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="dismissed">Dismissed</option>
          </select>
          <select
            value={filters.alert_type}
            onChange={e => { setFilters(f => ({ ...f, alert_type: e.target.value })); setPage(1); }}
            className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary"
          >
            <option value="">All Types</option>
            <option value="account_takeover">Account Takeover</option>
            <option value="payment_fraud">Payment Fraud</option>
            <option value="promo_abuse">Promo Abuse</option>
            <option value="bot_attack">Bot Attack</option>
            <option value="chargeback_risk">Chargeback Risk</option>
          </select>
          <select
            value={filters.severity}
            onChange={e => { setFilters(f => ({ ...f, severity: e.target.value })); setPage(1); }}
            className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          {selected.size > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <span className="text-xs text-text-muted">{selected.size} selected</span>
              <button onClick={() => handleBulkAction('acknowledge')} className="px-3 py-1.5 bg-purple-500/10 text-purple-400 rounded-lg text-xs hover:bg-purple-500/20 transition">Acknowledge</button>
              <button onClick={() => handleBulkAction('dismiss')} className="px-3 py-1.5 bg-gray-500/10 text-gray-400 rounded-lg text-xs hover:bg-gray-500/20 transition">Dismiss</button>
              <button onClick={() => handleBulkAction('escalate')} className="px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-xs hover:bg-red-500/20 transition">Escalate</button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="bg-bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="py-20 text-center text-text-muted">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p>No alerts match your filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="table-sticky">
                <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="pl-4 pr-2 py-3 w-8">
                    <input type="checkbox" checked={selected.size === alerts.length} onChange={toggleAll} className="rounded" />
                  </th>
                  <th className="px-3 py-3">Alert</th>
                  <th className="px-3 py-3">Type</th>
                  <th className="px-3 py-3">Severity</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3">Score</th>
                  <th className="px-3 py-3">Created</th>
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map(alert => (
                  <tr key={alert.id} className="border-b border-border hover:bg-white/[0.02] transition">
                    <td className="pl-4 pr-2 py-3">
                      <input type="checkbox" checked={selected.has(alert.id)} onChange={() => toggleSelect(alert.id)} className="rounded" />
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-medium text-text-primary truncate max-w-xs">{alert.title}</p>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs capitalize text-text-secondary">{alert.alert_type?.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", severityColor(alert.severity))}>
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("px-2 py-0.5 rounded-full text-xs border", statusColor(alert.status))}>
                        {alert.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn("text-sm font-mono", alert.model_score > 0.8 ? 'text-danger' : alert.model_score > 0.6 ? 'text-warning' : 'text-text-secondary')}>
                        {alert.model_score?.toFixed(3) || '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-text-muted text-xs">
                      {formatRelativeTime(alert.created_at)}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        {!alert.case_id && alert.status !== 'resolved' && alert.status !== 'dismissed' && (
                          <button
                            onClick={() => handleCreateCase(alert.id)}
                            className="px-2 py-1 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition"
                          >
                            Create Case
                          </button>
                        )}
                        {alert.case_id && (
                          <button
                            onClick={() => router.push(`/cases/${alert.case_id}`)}
                            className="px-2 py-1 bg-accent/10 text-accent rounded text-xs hover:bg-accent/20 transition"
                          >
                            View Case
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {total > 25 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-text-muted">Page {page} of {Math.ceil(total / 25)}</p>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs disabled:opacity-30">Previous</button>
              <button onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total} className="px-3 py-1.5 bg-bg-card border border-border rounded-lg text-xs disabled:opacity-30">Next</button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
