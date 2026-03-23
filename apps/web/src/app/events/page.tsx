'use client';

import { useEffect, useState } from 'react';
import AppShell from '@/components/layout/AppShell';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';
import { cn, formatDateTime, riskColor, statusColor } from '@/lib/utils';

const PRESETS = {
  normal: {
    event_type: 'transaction',
    source: 'manual_check',
    entity_type: 'user',
    entity_external_id: 'customer-1001',
    data: {
      amount: 49.99,
      currency: 'USD',
      country: 'US',
      is_international: false,
      new_device: false,
      device_mismatch: false,
      velocity_flag: false,
      merchant: 'Local Store',
    },
  },
  risky: {
    event_type: 'transaction',
    source: 'manual_check',
    entity_type: 'user',
    entity_external_id: 'customer-2001',
    data: {
      amount: 6200,
      currency: 'USD',
      country: 'NG',
      is_international: true,
      new_device: true,
      device_mismatch: true,
      velocity_flag: true,
      merchant: 'Unknown Merchant',
    },
  },
  ato: {
    event_type: 'password_reset',
    source: 'manual_check',
    entity_type: 'user',
    entity_external_id: 'customer-3001',
    data: {
      country: 'RO',
      is_international: true,
      new_device: true,
      device_mismatch: true,
      velocity_flag: true,
      ip: '203.0.113.66',
    },
  },
};

function prettyJson(value: any) {
  return JSON.stringify(value, null, 2);
}

export default function EventsPage() {
  const { addToast } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [result, setResult] = useState<any>(null);
  const [form, setForm] = useState({
    event_type: 'transaction',
    source: 'manual_check',
    entity_type: 'user',
    entity_external_id: 'customer-1001',
    data: prettyJson(PRESETS.normal.data),
  });

  const loadEvents = async () => {
    setLoading(true);
    try {
      const data = await api.getEvents({ page_size: '20' });
      setEvents(data.items || []);
      setTotal(data.total || 0);
    } catch (e: any) {
      addToast({ type: 'error', title: e.message || 'Failed to load events' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const applyPreset = (presetKey: keyof typeof PRESETS) => {
    const preset = PRESETS[presetKey];
    setForm({
      event_type: preset.event_type,
      source: preset.source,
      entity_type: preset.entity_type,
      entity_external_id: preset.entity_external_id,
      data: prettyJson(preset.data),
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload = {
        event_type: form.event_type,
        source: form.source,
        entity_type: form.entity_type || undefined,
        entity_external_id: form.entity_external_id || undefined,
        data: JSON.parse(form.data || '{}'),
      };
      const response = await api.ingestEvent(payload);
      setResult(response);
      addToast({
        type: response.alerts_created > 0 ? 'warning' : 'success',
        title: response.alerts_created > 0 ? 'Risk detected' : 'Event processed',
        message: `Score ${Number(response.risk_score || 0).toFixed(2)} | Alerts ${response.alerts_created}`,
      });
      await loadEvents();
    } catch (e: any) {
      addToast({ type: 'error', title: e.message || 'Failed to ingest event' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AppShell>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-h1">Events</h1>
            <p className="text-text-secondary text-sm mt-1">
              Ingest a real event after login and immediately inspect its risk score.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-6">
          <div className="space-y-6">
            <div className="bg-bg-card border border-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold">Manual Event Ingestion</h2>
                  <p className="text-xs text-text-muted mt-1">
                    Submit a custom event and see whether RiskPulse flags it.
                  </p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => applyPreset('normal')} className="px-3 py-1.5 text-xs rounded-lg bg-bg border border-border hover:border-primary/40 transition">Normal</button>
                  <button onClick={() => applyPreset('risky')} className="px-3 py-1.5 text-xs rounded-lg bg-warning/10 text-warning border border-warning/20 hover:bg-warning/20 transition">High Risk</button>
                  <button onClick={() => applyPreset('ato')} className="px-3 py-1.5 text-xs rounded-lg bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition">ATO</button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <label className="block">
                  <span className="text-xs text-text-muted">Event Type</span>
                  <input
                    value={form.event_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, event_type: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                    placeholder="transaction"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">Source</span>
                  <input
                    value={form.source}
                    onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                    placeholder="manual_check"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">Entity Type</span>
                  <input
                    value={form.entity_type}
                    onChange={(e) => setForm((prev) => ({ ...prev, entity_type: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                    placeholder="user"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-text-muted">Entity External ID</span>
                  <input
                    value={form.entity_external_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, entity_external_id: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 bg-bg border border-border rounded-lg text-sm"
                    placeholder="customer-1001"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-text-muted">Event Data JSON</span>
                <textarea
                  value={form.data}
                  onChange={(e) => setForm((prev) => ({ ...prev, data: e.target.value }))}
                  className="mt-1 w-full min-h-[240px] px-3 py-3 bg-bg border border-border rounded-xl text-sm font-mono"
                  spellCheck={false}
                />
              </label>

              <div className="flex items-center justify-between mt-4 gap-4 flex-wrap">
                <p className="text-xs text-text-muted">
                  Tip: higher values for `amount`, `is_international`, `new_device`, `device_mismatch`, and `velocity_flag` raise the score.
                </p>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Processing...' : 'Ingest Event'}
                </button>
              </div>
            </div>

            <div className="bg-bg-card border border-border rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Recent Events</h2>
                  <p className="text-xs text-text-muted mt-1">{total} total events in this workspace</p>
                </div>
                <button onClick={loadEvents} className="px-3 py-1.5 text-xs rounded-lg bg-bg border border-border hover:border-primary/40 transition">Refresh</button>
              </div>

              {loading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
                </div>
              ) : events.length === 0 ? (
                <div className="p-10 text-center text-text-muted">No events yet. Ingest one above to start checking risk.</div>
              ) : (
                <div className="divide-y divide-border">
                  {events.map((event) => (
                    <div key={event.id} className="px-6 py-4 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium capitalize">{event.event_type.replace(/_/g, ' ')}</p>
                          <span className="text-[11px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-bg border border-border">
                            {event.source}
                          </span>
                          <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", event.processed ? 'text-accent bg-accent/10 border-accent/20' : 'text-text-muted bg-bg border-border')}>
                            {event.processed ? 'Processed' : 'Pending'}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-1">Event ID: {event.id}</p>
                        <p className="text-xs text-text-muted mt-1">{formatDateTime(event.occurred_at)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[11px] uppercase tracking-wide text-text-muted">Risk Score</p>
                        <p className={cn("text-lg font-bold mt-1", riskColor(Number(event.risk_score || 0)))}>
                          {Number(event.risk_score || 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-bg-card border border-border rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-4">Latest Result</h2>
              {!result ? (
                <div className="text-sm text-text-muted">
                  Submit an event to see whether it creates alerts and what score the model assigns.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-bg border border-border rounded-xl p-4">
                      <p className="text-[11px] uppercase tracking-wide text-text-muted">Risk Score</p>
                      <p className={cn("text-2xl font-bold mt-2", riskColor(Number(result.risk_score || 0)))}>
                        {Number(result.risk_score || 0).toFixed(2)}
                      </p>
                    </div>
                    <div className="bg-bg border border-border rounded-xl p-4">
                      <p className="text-[11px] uppercase tracking-wide text-text-muted">Alerts Created</p>
                      <p className={cn("text-2xl font-bold mt-2", result.alerts_created > 0 ? 'text-danger' : 'text-accent')}>
                        {result.alerts_created}
                      </p>
                    </div>
                  </div>

                  <div className="bg-bg border border-border rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-wide text-text-muted">Event ID</p>
                    <p className="text-sm font-mono mt-2 break-all">{result.event_id}</p>
                  </div>

                  <div className="bg-bg border border-border rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-wide text-text-muted mb-3">Detection Outcome</p>
                    {result.alerts?.length ? (
                      <div className="space-y-2">
                        {result.alerts.map((alert: any) => (
                          <div key={alert.id} className="rounded-lg border border-border bg-bg-surface p-3">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">{alert.title}</p>
                              <span className={cn("px-2 py-0.5 rounded-full text-[11px] border", statusColor(alert.status))}>
                                {alert.status}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted mt-1 capitalize">
                              {alert.alert_type?.replace(/_/g, ' ')} | {alert.severity}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-text-muted">No alerts fired. The event was still scored and saved for review.</p>
                    )}
                  </div>

                  <div className="bg-bg border border-border rounded-xl p-4">
                    <p className="text-[11px] uppercase tracking-wide text-text-muted mb-3">Saved Event Payload</p>
                    <pre className="text-xs font-mono overflow-x-auto text-text-secondary">
                      {prettyJson(result.event?.data || {})}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-bg-card border border-border rounded-2xl p-6">
              <h2 className="text-lg font-semibold mb-3">Verification Flow</h2>
              <div className="space-y-3 text-sm text-text-secondary">
                <p>1. Ingest an event from this page.</p>
                <p>2. Watch the risk score and alert count update immediately.</p>
                <p>3. Open Alerts if `alerts_created` is greater than 0.</p>
                <p>4. Tune your rules on the Rules page if the event should have been caught differently.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
