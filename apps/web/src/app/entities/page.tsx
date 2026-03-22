'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { entityTypeIcon, riskColor, formatRelativeTime, cn } from '@/lib/utils';

export default function EntitiesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const entityIdParam = searchParams.get('id');

  const [entities, setEntities] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [entityGraph, setEntityGraph] = useState<any>(null);
  const [entityEvents, setEntityEvents] = useState<any[]>([]);
  const [entityAlerts, setEntityAlerts] = useState<any[]>([]);
  const [entityTransactions, setEntityTransactions] = useState<any[]>([]);
  const [detailTab, setDetailTab] = useState('graph');
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    loadEntities();
  }, [page, typeFilter, searchQuery]);

  useEffect(() => {
    if (entityIdParam) {
      loadEntityDetails(entityIdParam);
    }
  }, [entityIdParam]);

  const loadEntities = async () => {
    setLoading(true);
    try {
      const params: any = { page: String(page), page_size: '25' };
      if (typeFilter) params.entity_type = typeFilter;
      if (searchQuery) params.q = searchQuery;
      const data = await api.getEntities(params);
      setEntities(data.items || []);
      setTotal(data.total || 0);
    } catch {}
    setLoading(false);
  };

  const loadEntityDetails = async (id: string) => {
    setDetailLoading(true);
    try {
      const [entity, graph, events, alerts, txns] = await Promise.all([
        api.getEntity(id),
        api.getEntityGraph(id),
        api.getEntityEvents(id),
        api.getEntityAlerts(id),
        api.getEntityTransactions(id),
      ]);
      setSelectedEntity(entity);
      setEntityGraph(graph);
      setEntityEvents(events);
      setEntityAlerts(alerts);
      setEntityTransactions(txns);
    } catch {}
    setDetailLoading(false);
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-h1">Entity Explorer</h1>
            <p className="text-text-secondary text-sm mt-1">{total} entities</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Entity List */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <input
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setPage(1); }}
                placeholder="Search entities..."
                className="flex-1 px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary"
              />
              <select
                value={typeFilter}
                onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary"
              >
                <option value="">All</option>
                <option value="user">Users</option>
                <option value="device">Devices</option>
                <option value="ip">IPs</option>
                <option value="card">Cards</option>
                <option value="merchant">Merchants</option>
              </select>
            </div>

            <div className="space-y-1 max-h-[calc(100vh-260px)] overflow-y-auto">
              {loading ? (
                [1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-lg" />)
              ) : entities.length === 0 ? (
                <div className="py-12 text-center text-text-muted text-sm">No entities found</div>
              ) : entities.map(e => (
                <button
                  key={e.id}
                  onClick={() => loadEntityDetails(e.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition flex items-center gap-3",
                    selectedEntity?.id === e.id ? "bg-primary/10 border border-primary/20" : "hover:bg-white/5 border border-transparent"
                  )}
                >
                  <span className="text-lg">{entityTypeIcon(e.entity_type)}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.display_name || e.external_id}</p>
                    <p className="text-xs text-text-muted capitalize">{e.entity_type} | {e.external_id}</p>
                  </div>
                  <span className={cn("text-xs font-mono", riskColor(e.risk_score))}>{(e.risk_score * 100).toFixed(0)}%</span>
                </button>
              ))}
            </div>

            {total > 25 && (
              <div className="flex gap-2 mt-3">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="flex-1 py-1.5 bg-bg-card border border-border rounded-lg text-xs disabled:opacity-30">Prev</button>
                <button onClick={() => setPage(p => p + 1)} disabled={page * 25 >= total} className="flex-1 py-1.5 bg-bg-card border border-border rounded-lg text-xs disabled:opacity-30">Next</button>
              </div>
            )}
          </div>

          {/* Entity Details */}
          <div className="lg:col-span-2">
            {detailLoading ? (
              <div className="skeleton h-96 rounded-xl" />
            ) : !selectedEntity ? (
              <div className="flex items-center justify-center h-96 bg-bg-card border border-border rounded-xl text-text-muted">
                Select an entity to view details
              </div>
            ) : (
              <div className="space-y-4">
                {/* Entity Header */}
                <div className="bg-bg-card border border-border rounded-xl p-5">
                  <div className="flex items-start gap-4">
                    <div className="text-3xl">{entityTypeIcon(selectedEntity.entity_type)}</div>
                    <div className="flex-1">
                      <h2 className="text-lg font-bold">{selectedEntity.display_name || selectedEntity.external_id}</h2>
                      <p className="text-sm text-text-muted capitalize">{selectedEntity.entity_type} | {selectedEntity.external_id}</p>
                      <div className="flex items-center gap-4 mt-3">
                        <div>
                          <p className="text-xs text-text-muted">Risk Score</p>
                          <p className={cn("text-xl font-bold", riskColor(selectedEntity.risk_score))}>{(selectedEntity.risk_score * 100).toFixed(0)}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">First Seen</p>
                          <p className="text-sm">{selectedEntity.first_seen_at ? formatRelativeTime(selectedEntity.first_seen_at) : 'N/A'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-muted">Last Seen</p>
                          <p className="text-sm">{selectedEntity.last_seen_at ? formatRelativeTime(selectedEntity.last_seen_at) : 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {selectedEntity.metadata && Object.keys(selectedEntity.metadata).length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <h4 className="text-xs font-semibold text-text-muted mb-2">Metadata</h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(selectedEntity.metadata).map(([k, v]: any) => (
                          <div key={k} className="text-xs">
                            <span className="text-text-muted">{k}: </span>
                            <span className="text-text-primary">{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Detail Tabs */}
                <div className="border-b border-border flex gap-0">
                  {['graph', 'events', 'transactions', 'alerts'].map(tab => (
                    <button
                      key={tab}
                      onClick={() => setDetailTab(tab)}
                      className={cn("px-4 py-2 text-sm font-medium border-b-2 transition capitalize",
                        detailTab === tab ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
                      )}
                    >
                      {tab} ({tab === 'graph' ? entityGraph?.nodes?.length || 0 :
                               tab === 'events' ? entityEvents.length :
                               tab === 'transactions' ? entityTransactions.length :
                               entityAlerts.length})
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {detailTab === 'graph' && entityGraph && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {entityGraph.nodes?.map((node: any) => (
                      <button
                        key={node.id}
                        onClick={() => loadEntityDetails(node.id)}
                        className="bg-bg-card border border-border rounded-lg p-3 text-left hover:border-border-hover transition"
                      >
                        <div className="flex items-center gap-2">
                          <span>{entityTypeIcon(node.entity_type)}</span>
                          <span className="text-xs capitalize text-text-muted">{node.entity_type}</span>
                        </div>
                        <p className="text-xs font-medium mt-1 truncate">{node.display_name || node.external_id}</p>
                        <p className={cn("text-[10px]", riskColor(node.risk_score))}>Risk: {(node.risk_score * 100).toFixed(0)}%</p>
                      </button>
                    ))}
                  </div>
                )}

                {detailTab === 'events' && (
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {entityEvents.map(ev => (
                      <div key={ev.id} className="bg-bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-3">
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">{ev.event_type}</span>
                        <span className="text-xs text-text-muted flex-1">{ev.source}</span>
                        <span className="text-xs text-text-muted">{ev.occurred_at ? formatRelativeTime(ev.occurred_at) : ''}</span>
                      </div>
                    ))}
                    {entityEvents.length === 0 && <p className="text-sm text-text-muted py-4 text-center">No events</p>}
                  </div>
                )}

                {detailTab === 'transactions' && (
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {entityTransactions.map(txn => (
                      <div key={txn.id} className="bg-bg-card border border-border rounded-lg px-3 py-2 flex items-center gap-3">
                        <span className="text-sm font-mono">${Number(txn.amount).toFixed(2)}</span>
                        <span className="text-xs text-text-muted">{txn.transaction_ref}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded", txn.status === 'completed' ? 'bg-accent/10 text-accent' : 'bg-danger/10 text-danger')}>{txn.status}</span>
                        <span className="text-xs text-text-muted ml-auto">{txn.occurred_at ? formatRelativeTime(txn.occurred_at) : ''}</span>
                      </div>
                    ))}
                    {entityTransactions.length === 0 && <p className="text-sm text-text-muted py-4 text-center">No transactions</p>}
                  </div>
                )}

                {detailTab === 'alerts' && (
                  <div className="space-y-1 max-h-80 overflow-y-auto">
                    {entityAlerts.map(a => (
                      <div key={a.id} className="bg-bg-card border border-border rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full border", cn(a.severity === 'critical' ? 'text-red-400 bg-red-500/10 border-red-500/20' : a.severity === 'high' ? 'text-orange-400 bg-orange-500/10 border-orange-500/20' : 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'))}>{a.severity}</span>
                          <span className="text-sm flex-1 truncate">{a.title}</span>
                          <span className="text-xs text-text-muted">{formatRelativeTime(a.created_at)}</span>
                        </div>
                      </div>
                    ))}
                    {entityAlerts.length === 0 && <p className="text-sm text-text-muted py-4 text-center">No alerts</p>}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
