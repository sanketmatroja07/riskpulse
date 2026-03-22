'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { entityTypeIcon } from '@/lib/utils';

export default function SearchModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.search(query);
        setResults(data.results || []);
        setSelectedIdx(0);
      } catch { setResults([]); }
      setLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const navigate = (result: any) => {
    const paths: Record<string, string> = {
      entity: `/entities?id=${result.id}`,
      case: `/cases/${result.id}`,
      alert: `/alerts?id=${result.id}`,
    };
    router.push(paths[result.type] || '/dashboard');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === 'Enter' && results[selectedIdx]) { navigate(results[selectedIdx]); }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 border-b border-border">
          <svg className="w-5 h-5 text-text-muted shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search entities, cases, alerts..."
            className="flex-1 py-3.5 bg-transparent text-text-primary placeholder-text-muted outline-none text-sm"
          />
          <kbd className="text-[10px] text-text-muted bg-bg-card px-1.5 py-0.5 rounded">ESC</kbd>
        </div>
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => navigate(r)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition ${
                  i === selectedIdx ? 'bg-primary/10 text-primary' : 'text-text-primary hover:bg-white/5'
                }`}
              >
                <span className="text-lg">{r.type === 'entity' ? entityTypeIcon(r.subtitle?.split('|')[0]?.trim() || '') : r.type === 'case' ? '📋' : '🔔'}</span>
                <div className="flex-1 min-w-0">
                  <p className="truncate font-medium">{r.title}</p>
                  <p className="text-xs text-text-muted truncate">{r.subtitle}</p>
                </div>
                <span className="text-xs text-text-muted capitalize px-2 py-0.5 bg-bg-card rounded">{r.type}</span>
              </button>
            ))}
          </div>
        )}
        {query.length >= 2 && results.length === 0 && !loading && (
          <div className="py-8 text-center text-text-muted text-sm">No results found</div>
        )}
        {loading && (
          <div className="py-8 text-center text-text-muted text-sm">Searching...</div>
        )}
        {query.length < 2 && (
          <div className="py-6 px-4 text-text-muted text-sm">
            <p className="mb-3">Quick navigation:</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><kbd className="bg-bg-card px-1.5 py-0.5 rounded mr-2">g d</kbd>Dashboard</div>
              <div><kbd className="bg-bg-card px-1.5 py-0.5 rounded mr-2">g a</kbd>Alerts</div>
              <div><kbd className="bg-bg-card px-1.5 py-0.5 rounded mr-2">g c</kbd>Cases</div>
              <div><kbd className="bg-bg-card px-1.5 py-0.5 rounded mr-2">g e</kbd>Entities</div>
              <div><kbd className="bg-bg-card px-1.5 py-0.5 rounded mr-2">g r</kbd>Rules</div>
              <div><kbd className="bg-bg-card px-1.5 py-0.5 rounded mr-2">g p</kbd>Deployments</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
