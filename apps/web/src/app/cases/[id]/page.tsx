'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { formatRelativeTime, formatDateTime, severityColor, statusColor, cn, riskColor, entityTypeIcon } from '@/lib/utils';

function TabButton({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium border-b-2 transition",
        active ? "border-primary text-primary" : "border-transparent text-text-secondary hover:text-text-primary"
      )}
    >
      {children}
    </button>
  );
}

export default function CaseWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { addToast, user } = useAppStore();
  const caseId = params.id as string;

  const [caseData, setCaseData] = useState<any>(null);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [narratives, setNarratives] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [graph, setGraph] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [mitigations, setMitigations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('evidence');
  const [commentText, setCommentText] = useState('');
  const [generating, setGenerating] = useState('');
  const [decisionModal, setDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState('');
  const [decisionRationale, setDecisionRationale] = useState('');

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    setLoading(true);
    try {
      const [c, ev, nar, tl, g, com, mit] = await Promise.all([
        api.getCase(caseId),
        api.getCaseEvidence(caseId),
        api.getCaseNarratives(caseId),
        api.getCaseTimeline(caseId),
        api.getCaseGraph(caseId),
        api.getCaseComments(caseId),
        api.getCaseMitigations(caseId),
      ]);
      setCaseData(c);
      setEvidence(ev);
      setNarratives(nar);
      setTimeline(tl);
      setGraph(g);
      setComments(com);
      setMitigations(mit);
    } catch (e: any) {
      addToast({ type: 'error', title: 'Failed to load case' });
    }
    setLoading(false);
  };

  const handleCollectEvidence = async () => {
    setGenerating('evidence');
    try {
      const ev = await api.collectEvidence(caseId);
      setEvidence(prev => [...ev, ...prev]);
      addToast({ type: 'success', title: `${ev.length} evidence items collected` });
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
    setGenerating('');
  };

  const handleGenerateNarrative = async () => {
    setGenerating('narrative');
    try {
      const nar = await api.generateNarrative(caseId);
      setNarratives(prev => [nar, ...prev]);
      addToast({ type: 'success', title: 'Narrative generated' });
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
    setGenerating('');
  };

  const handleSuggestMitigations = async () => {
    setGenerating('mitigations');
    try {
      const mit = await api.suggestMitigations(caseId);
      setMitigations(prev => [...mit, ...prev]);
      addToast({ type: 'success', title: `${mit.length} mitigations suggested` });
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
    setGenerating('');
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    try {
      const c = await api.addCaseComment(caseId, { content: commentText });
      setComments(prev => [...prev, c]);
      setCommentText('');
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
  };

  const handleDecision = async () => {
    if (!decisionType) return;
    try {
      await api.makeCaseDecision(caseId, { decision: decisionType, rationale: decisionRationale });
      addToast({ type: 'success', title: `Case ${decisionType}d` });
      setDecisionModal(false);
      loadCase();
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await api.updateCase(caseId, { status });
      setCaseData((prev: any) => ({ ...prev, status }));
      addToast({ type: 'success', title: `Status updated to ${status}` });
    } catch (e: any) { addToast({ type: 'error', title: e.message }); }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="skeleton h-12 rounded-xl w-96" />
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 skeleton h-96 rounded-xl" />
            <div className="skeleton h-96 rounded-xl" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (!caseData) {
    return (
      <AppShell>
        <div className="text-center py-20 text-text-muted">Case not found</div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => router.push('/cases')} className="text-text-muted hover:text-text-primary text-sm">Cases /</button>
              <span className="text-xs font-mono text-text-muted">{caseData.case_number}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", severityColor(caseData.priority))}>{caseData.priority}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs border", statusColor(caseData.status))}>{caseData.status?.replace(/_/g, ' ')}</span>
              {caseData.decision && <span className="px-2 py-0.5 rounded-full text-xs bg-white/5 text-text-secondary border border-border capitalize">{caseData.decision}</span>}
            </div>
            <h1 className="text-xl font-bold">{caseData.title}</h1>
            {caseData.description && <p className="text-sm text-text-muted mt-1">{caseData.description}</p>}
          </div>
          <div className="flex items-center gap-2">
            {!caseData.decision && (
              <button onClick={() => setDecisionModal(true)} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition">
                Make Decision
              </button>
            )}
            <select
              value={caseData.status}
              onChange={e => handleStatusChange(e.target.value)}
              className="px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary"
            >
              <option value="new">New</option>
              <option value="investigating">Investigating</option>
              <option value="pending_review">Pending Review</option>
              <option value="escalated">Escalated</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button onClick={handleCollectEvidence} disabled={generating === 'evidence'} className="px-4 py-2 bg-bg-card border border-border rounded-lg text-sm hover:border-border-hover transition disabled:opacity-50 flex items-center gap-2">
            {generating === 'evidence' ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : null}
            Pull Relevant Signals
          </button>
          <button onClick={handleGenerateNarrative} disabled={generating === 'narrative'} className="px-4 py-2 bg-bg-card border border-border rounded-lg text-sm hover:border-border-hover transition disabled:opacity-50 flex items-center gap-2">
            {generating === 'narrative' ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : null}
            Generate Narrative
          </button>
          <button onClick={handleSuggestMitigations} disabled={generating === 'mitigations'} className="px-4 py-2 bg-bg-card border border-border rounded-lg text-sm hover:border-border-hover transition disabled:opacity-50 flex items-center gap-2">
            {generating === 'mitigations' ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : null}
            Suggest Mitigations
          </button>
        </div>

        {/* Three-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - 2 cols */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="border-b border-border flex gap-0">
              {['evidence', 'narrative', 'timeline', 'graph', 'mitigations'].map(tab => (
                <TabButton key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>
                  {tab === 'evidence' ? `Evidence (${evidence.length})` :
                   tab === 'narrative' ? `Narrative (${narratives.length})` :
                   tab === 'timeline' ? `Timeline (${timeline.length})` :
                   tab === 'graph' ? 'Entity Graph' :
                   `Mitigations (${mitigations.length})`}
                </TabButton>
              ))}
            </div>

            {/* Evidence Tab */}
            {activeTab === 'evidence' && (
              <div className="space-y-3">
                {evidence.length === 0 ? (
                  <div className="py-12 text-center text-text-muted bg-bg-card border border-border rounded-xl">
                    <p>No evidence collected yet</p>
                    <button onClick={handleCollectEvidence} className="mt-3 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition">
                      Collect Evidence
                    </button>
                  </div>
                ) : evidence.map((ev, i) => (
                  <div key={ev.id} className="bg-bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">EVD-{String(i + 1).padStart(3, '0')}</span>
                        <span className="text-xs px-2 py-0.5 bg-bg rounded text-text-muted capitalize">{ev.evidence_type}</span>
                      </div>
                      <span className="text-xs text-text-muted">{ev.collected_at ? formatRelativeTime(ev.collected_at) : ''}</span>
                    </div>
                    <h4 className="text-sm font-medium mb-1">{ev.title}</h4>
                    {ev.content && <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono bg-bg p-3 rounded-lg mt-2 max-h-40 overflow-y-auto">{ev.content}</pre>}
                  </div>
                ))}
              </div>
            )}

            {/* Narrative Tab */}
            {activeTab === 'narrative' && (
              <div className="space-y-4">
                {narratives.length === 0 ? (
                  <div className="py-12 text-center text-text-muted bg-bg-card border border-border rounded-xl">
                    <p>No narratives generated yet</p>
                    <button onClick={handleGenerateNarrative} className="mt-3 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition">
                      Generate Narrative
                    </button>
                  </div>
                ) : narratives.map(nar => (
                  <div key={nar.id} className="bg-bg-card border border-border rounded-xl p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">Model: {nar.model_used}</span>
                        <span className="text-xs text-text-muted">| Prompt: {nar.prompt_version}</span>
                        {nar.generation_time_ms && <span className="text-xs text-text-muted">| {nar.generation_time_ms}ms</span>}
                      </div>
                      <span className="text-xs text-text-muted">{formatRelativeTime(nar.created_at)}</span>
                    </div>
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap text-sm text-text-primary font-sans leading-relaxed">{nar.content}</pre>
                    </div>
                    {nar.citations?.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <h5 className="text-xs font-semibold text-text-muted mb-2">Citations</h5>
                        <div className="flex flex-wrap gap-1">
                          {nar.citations.map((c: any) => (
                            <span key={c.id} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded" title={c.title}>
                              [{c.id}]
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Timeline Tab */}
            {activeTab === 'timeline' && (
              <div className="space-y-2">
                {timeline.length === 0 ? (
                  <div className="py-12 text-center text-text-muted bg-bg-card border border-border rounded-xl">No timeline events</div>
                ) : timeline.slice(0, 50).map((item, i) => (
                  <div key={i} className="flex gap-3 py-2">
                    <div className="flex flex-col items-center">
                      <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5",
                        item.type === 'event' ? 'bg-primary' :
                        item.type === 'evidence' ? 'bg-accent' :
                        item.type === 'comment' ? 'bg-warning' :
                        item.type === 'decision' ? 'bg-danger' : 'bg-text-muted'
                      )} />
                      {i < timeline.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                    </div>
                    <div className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="capitalize text-text-muted">{item.type}</span>
                        {item.event_type && <span className="text-text-secondary">{item.event_type}</span>}
                        <span className="ml-auto text-text-muted">{item.occurred_at || item.collected_at || item.created_at ? formatDateTime(item.occurred_at || item.collected_at || item.created_at) : ''}</span>
                      </div>
                      {item.title && <p className="text-sm mt-1">{item.title}</p>}
                      {item.content && <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{item.content}</p>}
                      {item.decision && <p className="text-sm mt-1 font-medium capitalize">{item.decision}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Graph Tab */}
            {activeTab === 'graph' && (
              <div className="bg-bg-card border border-border rounded-xl p-6 min-h-[400px]">
                {!graph || graph.nodes?.length === 0 ? (
                  <div className="flex items-center justify-center h-80 text-text-muted">No entity graph data</div>
                ) : (
                  <div>
                    <h4 className="text-sm font-semibold mb-4">Entity Graph ({graph.nodes.length} nodes, {graph.edges.length} edges)</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {graph.nodes.map((node: any) => (
                        <div key={node.id} className="bg-bg border border-border rounded-lg p-3 hover:border-border-hover transition cursor-pointer"
                             onClick={() => router.push(`/entities?id=${node.id}`)}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{entityTypeIcon(node.entity_type)}</span>
                            <span className="text-xs px-1.5 py-0.5 bg-bg-surface rounded text-text-muted capitalize">{node.entity_type}</span>
                          </div>
                          <p className="text-sm font-medium truncate">{node.display_name || node.external_id}</p>
                          <p className={cn("text-xs mt-1", riskColor(node.risk_score))}>Risk: {(node.risk_score * 100).toFixed(0)}%</p>
                        </div>
                      ))}
                    </div>
                    {graph.edges.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <h5 className="text-xs font-semibold text-text-muted mb-2">Connections</h5>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {graph.edges.map((e: any, i: number) => (
                            <div key={i} className="text-xs text-text-secondary flex items-center gap-1">
                              <span className="font-mono">{e.source.slice(0, 8)}</span>
                              <span className="text-primary">--[{e.edge_type}]--&gt;</span>
                              <span className="font-mono">{e.target.slice(0, 8)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mitigations Tab */}
            {activeTab === 'mitigations' && (
              <div className="space-y-3">
                {mitigations.length === 0 ? (
                  <div className="py-12 text-center text-text-muted bg-bg-card border border-border rounded-xl">
                    <p>No mitigations suggested yet</p>
                    <button onClick={handleSuggestMitigations} className="mt-3 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition">
                      Suggest Mitigations
                    </button>
                  </div>
                ) : mitigations.map(mit => (
                  <div key={mit.id} className="bg-bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border",
                          mit.mitigation_type === 'rule' ? 'bg-primary/10 text-primary border-primary/20' :
                          mit.mitigation_type === 'feature' ? 'bg-accent/10 text-accent border-accent/20' :
                          'bg-warning/10 text-warning border-warning/20'
                        )}>
                          {mit.mitigation_type}
                        </span>
                        <h4 className="text-sm font-medium mt-2">{mit.title}</h4>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded capitalize",
                        mit.status === 'suggested' ? 'bg-blue-500/10 text-blue-400' :
                        mit.status === 'deployed' ? 'bg-accent/10 text-accent' :
                        'bg-gray-500/10 text-gray-400'
                      )}>{mit.status}</span>
                    </div>
                    {mit.description && <p className="text-xs text-text-muted mt-1">{mit.description}</p>}
                    <pre className="text-xs font-mono bg-bg p-3 rounded-lg mt-2 overflow-x-auto">{JSON.stringify(mit.config_json, null, 2)}</pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            {/* Case Info */}
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Case Info</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-text-muted">Created</span><span>{formatRelativeTime(caseData.created_at)}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Alerts</span><span>{caseData.alert_ids?.length || 0}</span></div>
                <div className="flex justify-between"><span className="text-text-muted">Entities</span><span>{caseData.entity_ids?.length || 0}</span></div>
                {caseData.sla_deadline && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">SLA</span>
                    <span className={cn(new Date(caseData.sla_deadline) < new Date() ? 'text-danger' : 'text-accent')}>
                      {formatDateTime(caseData.sla_deadline)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Comments */}
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Comments ({comments.length})</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
                {comments.map(c => (
                  <div key={c.id} className="text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] text-primary font-medium">
                        U
                      </div>
                      <span className="text-xs text-text-muted">{formatRelativeTime(c.created_at)}</span>
                    </div>
                    <p className="text-text-secondary text-xs pl-7">{c.content}</p>
                  </div>
                ))}
                {comments.length === 0 && <p className="text-xs text-text-muted">No comments yet</p>}
              </div>
              <div className="flex gap-2">
                <input
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-1.5 bg-bg border border-border rounded-lg text-xs text-text-primary placeholder-text-muted outline-none focus:border-primary"
                />
                <button onClick={handleAddComment} className="px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs hover:bg-primary/20 transition">
                  Post
                </button>
              </div>
            </div>

            {/* Recommended Actions */}
            <div className="bg-bg-card border border-border rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-3">Recommended Actions</h3>
              <div className="space-y-2">
                {[
                  { label: 'Collect Evidence', done: evidence.length > 0 },
                  { label: 'Generate Narrative', done: narratives.length > 0 },
                  { label: 'Review Entity Graph', done: false },
                  { label: 'Suggest Mitigations', done: mitigations.length > 0 },
                  { label: 'Make Decision', done: !!caseData.decision },
                ].map((action, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className={cn("w-4 h-4 rounded-full border flex items-center justify-center",
                      action.done ? "bg-accent/20 border-accent/30 text-accent" : "border-border"
                    )}>
                      {action.done && <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                    </div>
                    <span className={cn(action.done ? "text-text-muted line-through" : "text-text-secondary")}>{action.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Decision Modal */}
        {decisionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setDecisionModal(false)}>
            <div className="bg-bg-surface border border-border rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">Case Decision</h3>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {['approve', 'deny', 'block', 'escalate', 'request_verification'].map(d => (
                  <button
                    key={d}
                    onClick={() => setDecisionType(d)}
                    className={cn("px-3 py-2 rounded-lg text-sm border transition capitalize",
                      decisionType === d ? "bg-primary/10 border-primary text-primary" : "bg-bg-card border-border text-text-secondary hover:border-border-hover"
                    )}
                  >
                    {d.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
              <textarea
                value={decisionRationale}
                onChange={e => setDecisionRationale(e.target.value)}
                placeholder="Rationale for this decision..."
                className="w-full px-3 py-2 bg-bg-card border border-border rounded-lg text-sm text-text-primary placeholder-text-muted outline-none focus:border-primary h-24 resize-none"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setDecisionModal(false)} className="px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition">Cancel</button>
                <button onClick={handleDecision} disabled={!decisionType} className="px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50">
                  Confirm Decision
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
