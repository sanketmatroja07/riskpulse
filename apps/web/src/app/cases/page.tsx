'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { formatRelativeTime, severityColor, statusColor, cn } from '@/lib/utils';

export default function CasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const params: any = { page: String(page), page_size: '25' };
        if (statusFilter) params.status = statusFilter;
        if (priorityFilter) params.priority = priorityFilter;
        const data = await api.getCases(params);
        setCases(data.items || []);
        setTotal(data.total || 0);
      } catch {}
      setLoading(false);
    };
    load();
  }, [page, statusFilter, priorityFilter]);

  const isSLABreached = (c: any) => {
    if (!c.sla_deadline) return false;
    return new Date(c.sla_deadline) < new Date() && !['resolved', 'closed'].includes(c.status);
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-h1">Cases</h1>
            <p className="text-text-secondary text-sm mt-1">{total} total cases</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary">
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="investigating">Investigating</option>
            <option value="pending_review">Pending Review</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <select value={priorityFilter} onChange={e => { setPriorityFilter(e.target.value); setPage(1); }} className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary">
            <option value="">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        {/* Case List */}
        <div className="space-y-2">
          {loading ? (
            [1,2,3,4].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)
          ) : cases.length === 0 ? (
            <div className="py-20 text-center text-text-muted bg-bg-card border border-border rounded-xl">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No cases match your filters</p>
            </div>
          ) : (
            cases.map(c => (
              <div
                key={c.id}
                onClick={() => router.push(`/cases/${c.id}`)}
                className={cn(
                  "bg-bg-card border rounded-xl p-4 cursor-pointer hover:border-border-hover transition group",
                  isSLABreached(c) ? "border-danger/30" : "border-border"
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-text-muted">{c.case_number}</span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", severityColor(c.priority))}>
                        {c.priority}
                      </span>
                      <span className={cn("px-2 py-0.5 rounded-full text-xs border", statusColor(c.status))}>
                        {c.status?.replace(/_/g, ' ')}
                      </span>
                      {c.decision && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-text-secondary border border-border capitalize">
                          {c.decision}
                        </span>
                      )}
                      {isSLABreached(c) && (
                        <span className="px-2 py-0.5 rounded-full text-xs bg-danger/10 text-danger border border-danger/20">
                          SLA BREACHED
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-medium text-text-primary group-hover:text-primary transition">{c.title}</h3>
                    {c.description && <p className="text-xs text-text-muted mt-1 line-clamp-1">{c.description}</p>}
                  </div>
                  <div className="text-right ml-4 shrink-0">
                    <p className="text-xs text-text-muted">{formatRelativeTime(c.created_at)}</p>
                    <div className="flex items-center gap-1 mt-1 justify-end">
                      <span className="text-xs text-text-muted">{c.alert_ids?.length || 0} alerts</span>
                      <span className="text-xs text-text-muted">|</span>
                      <span className="text-xs text-text-muted">{c.entity_ids?.length || 0} entities</span>
                    </div>
                    {c.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1.5 justify-end">
                        {c.tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="px-1.5 py-0.5 rounded text-[10px] bg-bg text-text-muted">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

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
