'use client';

import { useState, useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { formatRelativeTime, formatDateTime, cn } from '@/lib/utils';

export default function DeploymentsPage() {
  const { addToast, user } = useAppStore();
  const [deployments, setDeployments] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    loadDeployments();
  }, [page, typeFilter]);

  const loadDeployments = async () => {
    setLoading(true);
    try {
      const params: any = { page: String(page), page_size: '25' };
      if (typeFilter) params.deployment_type = typeFilter;
      const data = await api.getDeployments(params);
      setDeployments(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  const handleRollback = async (id: string) => {
    try {
      const dep = await api.rollbackDeployment(id);
      addToast({ type: 'success', title: 'Deployment rolled back' });
      loadDeployments();
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
  };

  const isEngineer = user?.role === 'admin' || user?.role === 'engineer';

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-h1">Deployment History</h1>
            <p className="text-text-secondary text-sm mt-1">{total} deployments</p>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 mb-4">
          <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary">
            <option value="">All Types</option>
            <option value="rule">Rules</option>
            <option value="feature">Features</option>
            <option value="model">Models</option>
            <option value="config">Config</option>
          </select>
        </div>

        {/* Deployments */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
          </div>
        ) : deployments.length === 0 ? (
          <div className="py-20 text-center text-text-muted bg-bg-card border border-border rounded-xl">No deployments found</div>
        ) : (
          <div className="space-y-2">
            {deployments.map(dep => (
              <div key={dep.id} className={cn("bg-bg-card border rounded-xl p-4 transition",
                dep.action === 'rollback' ? "border-warning/30" : "border-border"
              )}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border",
                        dep.deployment_type === 'rule' ? 'bg-primary/10 text-primary border-primary/20' :
                        dep.deployment_type === 'feature' ? 'bg-accent/10 text-accent border-accent/20' :
                        'bg-warning/10 text-warning border-warning/20'
                      )}>{dep.deployment_type}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded capitalize",
                        dep.action === 'enable' ? 'bg-accent/10 text-accent' :
                        dep.action === 'disable' ? 'bg-gray-500/10 text-gray-400' :
                        dep.action === 'rollback' ? 'bg-warning/10 text-warning' :
                        'bg-primary/10 text-primary'
                      )}>{dep.action}</span>
                    </div>
                    <h3 className="text-sm font-medium">{dep.artifact_name || `Artifact ${dep.artifact_id?.slice(0, 8)}`}</h3>
                    {dep.notes && <p className="text-xs text-text-muted mt-1">{dep.notes}</p>}
                    {dep.rollback_of && (
                      <p className="text-xs text-warning mt-1">Rollback of: {dep.rollback_of.slice(0, 8)}...</p>
                    )}
                  </div>
                  <div className="text-right ml-4">
                    <p className="text-xs text-text-muted">{formatDateTime(dep.created_at)}</p>
                    <p className="text-xs text-text-muted mt-0.5">{formatRelativeTime(dep.created_at)}</p>
                    {isEngineer && dep.action !== 'rollback' && (
                      <button
                        onClick={() => handleRollback(dep.id)}
                        className="mt-2 px-2 py-1 bg-warning/10 text-warning rounded text-xs hover:bg-warning/20 transition"
                      >
                        Rollback
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

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
