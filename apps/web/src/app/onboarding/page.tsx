'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAppStore } from '@/lib/store';

type Step = 'welcome' | 'api-key' | 'first-event' | 'done';

export default function OnboardingPage() {
  const router = useRouter();
  const { addToast } = useAppStore();
  const [step, setStep] = useState<Step>('welcome');
  const [apiKey, setApiKey] = useState<string>('');
  const [apiKeyPrefix, setApiKeyPrefix] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eventSent, setEventSent] = useState(false);
  const [org, setOrg] = useState<any>(null);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('rp_org') : null;
    if (stored) setOrg(JSON.parse(stored));
  }, []);

  const createApiKey = async () => {
    setLoading(true);
    try {
      const data = await api.createApiKey('Production');
      setApiKey(data.key);
      setApiKeyPrefix(data.key_prefix);
      setStep('api-key');
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendTestEvent = async () => {
    setLoading(true);
    try {
      await api.ingestEvent({
        event_type: 'transaction',
        source: 'onboarding_test',
        entity_type: 'user',
        entity_external_id: 'test-user-001',
        data: {
          amount: 299.99,
          currency: 'USD',
          country: 'US',
          merchant: 'Onboarding Test Store',
        },
      });
      setEventSent(true);
      addToast({ type: 'success', title: 'Test event processed!' });
      setStep('done');
    } catch (err: any) {
      addToast({ type: 'error', title: err.message });
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 'welcome', label: 'Welcome', num: 1 },
    { id: 'api-key', label: 'API Key', num: 2 },
    { id: 'first-event', label: 'First Event', num: 3 },
    { id: 'done', label: 'Ready', num: 4 },
  ];

  const currentIdx = steps.findIndex(s => s.id === step);

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">
            Set up your RiskPulse workspace
          </h1>
          <p className="text-text-secondary">
            {org?.name ? `Welcome to ${org.name}! ` : ''}Let&apos;s get your fraud detection running in minutes.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i <= currentIdx
                  ? 'bg-primary text-white'
                  : 'bg-bg-card border border-border text-text-muted'
              }`}>
                {i < currentIdx ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : s.num}
              </div>
              <span className={`text-sm hidden sm:inline ${i <= currentIdx ? 'text-text-primary' : 'text-text-muted'}`}>
                {s.label}
              </span>
              {i < steps.length - 1 && <div className="w-8 h-px bg-border mx-1" />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="bg-bg-surface border border-border rounded-2xl p-8">

          {/* Step 1: Welcome */}
          {step === 'welcome' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-3">Your workspace is ready</h2>
              <p className="text-text-secondary mb-8 max-w-md mx-auto">
                RiskPulse detects fraud by analyzing events from your systems. Let&apos;s create an API key
                so you can start sending events.
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8 max-w-lg mx-auto">
                <div className="p-4 bg-bg-card rounded-xl border border-border">
                  <div className="text-2xl mb-2">1</div>
                  <div className="text-sm font-medium">Create API key</div>
                </div>
                <div className="p-4 bg-bg-card rounded-xl border border-border">
                  <div className="text-2xl mb-2">2</div>
                  <div className="text-sm font-medium">Send first event</div>
                </div>
                <div className="p-4 bg-bg-card rounded-xl border border-border">
                  <div className="text-2xl mb-2">3</div>
                  <div className="text-sm font-medium">See it detected</div>
                </div>
              </div>
              <button
                onClick={createApiKey}
                disabled={loading}
                className="px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Generate API Key'}
              </button>
            </div>
          )}

          {/* Step 2: API Key */}
          {step === 'api-key' && (
            <div>
              <h2 className="text-xl font-semibold mb-2">Your API Key</h2>
              <p className="text-text-secondary mb-6">
                Save this key somewhere safe. You won&apos;t be able to see it again.
              </p>

              <div className="bg-bg-card border border-border rounded-xl p-4 mb-4">
                <div className="flex items-center justify-between">
                  <code className="text-sm text-primary font-mono break-all">{apiKey}</code>
                  <button
                    onClick={copyKey}
                    className="ml-4 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-sm hover:bg-primary/20 transition flex-shrink-0"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                <p className="text-sm text-yellow-400">
                  This is the only time you&apos;ll see the full key. Copy it now and store it securely.
                </p>
              </div>

              <h3 className="text-sm font-medium text-text-secondary mb-3">Integration code (5 lines):</h3>
              <div className="bg-[#1e1e2e] rounded-xl p-4 mb-6 overflow-x-auto">
                <pre className="text-sm text-green-400 font-mono whitespace-pre">{`import requests

requests.post("${typeof window !== 'undefined' ? window.location.origin : 'https://api.riskpulse.io'}/api/events/ingest/webhook",
    headers={"X-RiskPulse-Key": "${apiKeyPrefix}"},
    json=[{"event_type": "transaction", "entity_type": "user",
           "entity_external_id": "user-123",
           "data": {"amount": 499.99, "currency": "USD"}}]
)`}</pre>
              </div>

              <button
                onClick={() => setStep('first-event')}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition"
              >
                I&apos;ve saved my key. Continue
              </button>
            </div>
          )}

          {/* Step 3: First Event */}
          {step === 'first-event' && (
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Send your first event</h2>
              <p className="text-text-secondary mb-8">
                Click below to simulate a test transaction. This demonstrates how RiskPulse
                processes events through the detection pipeline.
              </p>

              <div className="bg-bg-card border border-border rounded-xl p-6 mb-6 text-left">
                <h3 className="text-sm font-medium text-text-secondary mb-3">Test event details:</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Event type:</span>
                    <span className="text-text-primary font-mono">transaction</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Amount:</span>
                    <span className="text-text-primary">$299.99</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Country:</span>
                    <span className="text-text-primary">US</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Entity:</span>
                    <span className="text-text-primary font-mono">test-user-001</span>
                  </div>
                </div>
              </div>

              <button
                onClick={sendTestEvent}
                disabled={loading}
                className="px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Send test event'}
              </button>

              <button
                onClick={() => setStep('done')}
                className="block mx-auto mt-4 text-sm text-text-muted hover:text-text-secondary transition"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-semibold mb-3">You&apos;re all set!</h2>
              <p className="text-text-secondary mb-8 max-w-md mx-auto">
                {eventSent
                  ? 'Your test event was processed. Head to the dashboard to see the results.'
                  : 'Your workspace is ready. Start sending events to detect fraud in real-time.'
                }
              </p>

              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mb-8">
                <div className="p-4 bg-bg-card rounded-xl border border-border text-left">
                  <div className="text-sm font-medium mb-1">Next steps</div>
                  <ul className="text-xs text-text-muted space-y-1">
                    <li>- Connect your payment system</li>
                    <li>- Configure detection rules</li>
                    <li>- Invite your team</li>
                  </ul>
                </div>
                <div className="p-4 bg-bg-card rounded-xl border border-border text-left">
                  <div className="text-sm font-medium mb-1">Resources</div>
                  <ul className="text-xs text-text-muted space-y-1">
                    <li>- API documentation (/docs)</li>
                    <li>- Integration guides</li>
                    <li>- Support: help@riskpulse.io</li>
                  </ul>
                </div>
              </div>

              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-3 bg-primary hover:bg-primary-hover text-white rounded-lg font-medium transition"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
