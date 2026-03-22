'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

/* ─────────────────────── animated counter ─────────────────────── */
function AnimatedNumber({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let frame: number;
    const dur = 2000;
    const start = performance.now();
    const step = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setVal(Math.round(target * ease));
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return <>{val}{suffix}</>;
}

/* ─────────────────────── floating particles ───────────────────── */
function Particles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(20)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-primary/10"
          style={{
            width: `${4 + Math.random() * 8}px`,
            height: `${4 + Math.random() * 8}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `float ${6 + Math.random() * 8}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 5}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ─────────────────────── nav ──────────────────────────────────── */
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', h);
    return () => window.removeEventListener('scroll', h);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#070d1a]/90 backdrop-blur-xl border-b border-white/5 shadow-2xl' : ''}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-white">RiskPulse</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
          <a href="#features" className="hover:text-white transition">Features</a>
          <a href="#how-it-works" className="hover:text-white transition">How It Works</a>
          <a href="#compare" className="hover:text-white transition">Compare</a>
          <a href="#pricing" className="hover:text-white transition">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition px-4 py-2">Sign in</Link>
          <a href="#demo" className="text-sm bg-gradient-to-r from-blue-500 to-cyan-400 text-white px-5 py-2.5 rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all hover:-translate-y-0.5">
            Book a Demo
          </a>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────── hero ─────────────────────────────────── */
function Hero() {
  const words = ['investigates', 'detects', 'mitigates', 'resolves'];
  const [wordIndex, setWordIndex] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setWordIndex(i => (i + 1) % words.length), 2500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 overflow-hidden">
      {/* Background gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-[128px]" />
      <div className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px]" />
      <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-purple-600/10 rounded-full blur-[80px]" />
      <Particles />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-300 mb-8 backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Now in Private Beta
        </div>

        <h1 className="text-5xl sm:text-6xl md:text-7xl font-bold leading-tight tracking-tight">
          <span className="text-white">AI that </span>
          <span className="relative inline-block">
            <span
              key={wordIndex}
              className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent animate-fadeIn"
            >
              {words[wordIndex]}
            </span>
          </span>
          <br />
          <span className="text-white">like your best analyst</span>
        </h1>

        <p className="text-lg md:text-xl text-gray-400 mt-6 max-w-2xl mx-auto leading-relaxed">
          And turns what it finds into production rules, ML features, and faster decisions.
          From detection to mitigation in minutes, not days.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-10">
          <a href="#demo" className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-2xl font-semibold text-lg shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all hover:-translate-y-1">
            Book a Demo
            <svg className="inline-block w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
          </a>
          <Link href="/login" className="px-8 py-4 bg-white/5 border border-white/10 text-white rounded-2xl font-semibold text-lg hover:bg-white/10 transition-all backdrop-blur-sm">
            Try Live Demo
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-8 mt-20 max-w-lg mx-auto">
          {[
            { val: 10, suffix: 'x', label: 'More investigations closed' },
            { val: 95, suffix: '%', label: 'Reduction in manual review' },
            { val: 5, suffix: 'x', label: 'Faster fraud mitigations' },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                <AnimatedNumber target={s.val} suffix={s.suffix} />
              </p>
              <p className="text-xs text-gray-500 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── product screenshot ───────────────────────── */
function ProductPreview() {
  return (
    <section className="relative -mt-10 mb-20 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="relative rounded-2xl border border-white/10 bg-[#0d1424] p-1 shadow-2xl shadow-blue-500/5">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="text-xs text-gray-500 ml-3 font-mono">app.riskpulse.io/dashboard</span>
          </div>
          <div className="p-6 grid grid-cols-4 gap-4">
            {/* Mini dashboard mockup */}
            {[
              { label: 'Open Alerts', value: '24', color: 'from-orange-500 to-red-500' },
              { label: 'Active Cases', value: '8', color: 'from-blue-500 to-cyan-500' },
              { label: 'Critical', value: '3', color: 'from-red-500 to-pink-500' },
              { label: 'Resolved Today', value: '12', color: 'from-green-500 to-emerald-500' },
            ].map((c, i) => (
              <div key={i} className="bg-white/[0.03] rounded-xl p-4 border border-white/5">
                <p className="text-[11px] text-gray-500 uppercase tracking-wider">{c.label}</p>
                <p className={`text-2xl font-bold mt-1 bg-gradient-to-r ${c.color} bg-clip-text text-transparent`}>{c.value}</p>
              </div>
            ))}
          </div>
          <div className="px-6 pb-6 grid grid-cols-3 gap-4">
            <div className="col-span-2 bg-white/[0.03] rounded-xl p-4 border border-white/5 h-48">
              <p className="text-xs text-gray-500 mb-3">Alert Trend — Last 7 Days</p>
              <div className="flex items-end gap-2 h-32">
                {[40, 65, 45, 80, 55, 90, 70].map((h, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div
                      className="w-full rounded-t bg-gradient-to-t from-blue-500/40 to-cyan-400/40"
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[9px] text-gray-600">{['M','T','W','T','F','S','S'][i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.03] rounded-xl p-4 border border-white/5 h-48">
              <p className="text-xs text-gray-500 mb-3">Cases by Priority</p>
              <div className="space-y-3 mt-4">
                {[
                  { l: 'Critical', w: '30%', c: 'bg-red-500' },
                  { l: 'High', w: '45%', c: 'bg-orange-500' },
                  { l: 'Medium', w: '60%', c: 'bg-yellow-500' },
                  { l: 'Low', w: '20%', c: 'bg-green-500' },
                ].map((b, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                      <span>{b.l}</span>
                    </div>
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full ${b.c}/60 rounded-full`} style={{ width: b.w }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── built for your team ──────────────────────── */
function TeamSection() {
  const teams = [
    {
      title: 'For Risk Ops',
      subtitle: 'Scale manual fraud investigations',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
        </svg>
      ),
      features: [
        'Automate investigation research into users and businesses',
        'Reason and draw connections between disparate data sources',
        'Complete audit log and explainable AI decisions',
        'Entity graph visualization to uncover fraud rings',
      ],
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'For ML & Data Science',
      subtitle: 'Build better models and rules',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      ),
      features: [
        'Extract features from unstructured investigation data',
        'Auto-explore and backtest new rules with historical data',
        'Generate synthetic labels before ground-truth arrives',
        'Production-ready features for your next model iteration',
      ],
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: 'For Engineering',
      subtitle: 'Deploy fraud mitigations faster',
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      ),
      features: [
        'Deploy rules and features with one click, rollback instantly',
        'Version-controlled detection rules with audit trails',
        'Webhook and CSV ingestion for any data source',
        'REST API integration with your existing stack',
      ],
      gradient: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Built for your entire <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Risk Team</span>
          </h2>
          <p className="text-gray-400 mt-4 text-lg max-w-2xl mx-auto">
            Every role on your team — from ops analysts to ML engineers — gets purpose-built tools
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {teams.map((t, i) => (
            <div key={i} className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-all hover:-translate-y-1 hover:shadow-xl">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.gradient} flex items-center justify-center mb-6 text-white shadow-lg group-hover:scale-110 transition-transform`}>
                {t.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{t.title}</h3>
              <p className="text-gray-400 text-sm mb-6">{t.subtitle}</p>
              <ul className="space-y-3">
                {t.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-3 text-sm text-gray-300">
                    <svg className={`w-5 h-5 mt-0.5 shrink-0 bg-gradient-to-r ${t.gradient} text-transparent`} style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }} fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="text-gray-400 group-hover:text-gray-300 transition">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── how it works ─────────────────────────────── */
function HowItWorks() {
  const steps = [
    {
      num: '01',
      title: 'Detect',
      desc: 'Ingest events from any source — webhooks, APIs, CSV. Our rule engine and ML scoring evaluate every event in real-time.',
      icon: '🔍',
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      num: '02',
      title: 'Investigate',
      desc: 'AI collects evidence, maps entity graphs, generates investigation narratives with citations. Your analyst gets a complete picture.',
      icon: '🔬',
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      num: '03',
      title: 'Mitigate',
      desc: 'Turn findings into production rules, ML features, and monitoring patterns. Deploy with one click. Roll back instantly.',
      icon: '🛡️',
      gradient: 'from-green-500 to-emerald-500',
    },
  ];

  return (
    <section id="how-it-works" className="py-24 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-transparent" />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white">
            Detect. Investigate. <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">Mitigate.</span>
          </h2>
          <p className="text-gray-400 mt-4 text-lg">The complete fraud operations loop, automated end-to-end</p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden md:block absolute top-24 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-500/30 via-purple-500/30 to-green-500/30" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="relative text-center">
                <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${s.gradient} mx-auto mb-6 flex items-center justify-center text-3xl shadow-xl relative z-10`}>
                  {s.icon}
                </div>
                <div className="text-xs font-mono text-gray-500 mb-2">{s.num}</div>
                <h3 className="text-2xl font-bold text-white mb-3">{s.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── comparison table ─────────────────────────── */
function CompareSection() {
  const rows = [
    { feature: 'Investigate end-to-end and take action', rp: true, other: false, otherLabel: 'Summarize alerts only' },
    { feature: 'Evidence-based explainable decisions', rp: true, other: false, otherLabel: 'Blackbox decisions' },
    { feature: 'Auto-generate features from your data', rp: true, other: false, otherLabel: 'Manual feature engineering' },
    { feature: 'Production-ready, backtested rules', rp: true, other: false, otherLabel: 'Manual implementation' },
    { feature: 'Entity graph visualization', rp: true, other: false, otherLabel: 'Flat alert list' },
    { feature: 'One-click deploy with rollback', rp: true, other: false, otherLabel: 'Manual deployment' },
  ];

  return (
    <section id="compare" className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Why <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">RiskPulse</span>?
          </h2>
          <p className="text-gray-400 text-lg">Other AI tools stop at investigations. RiskPulse closes the loop.</p>
        </div>

        <div className="bg-white/[0.03] border border-white/5 rounded-2xl overflow-hidden">
          <div className="grid grid-cols-3 text-center border-b border-white/5">
            <div className="p-4" />
            <div className="p-4 text-sm font-semibold text-gray-400">Other AI Tools</div>
            <div className="p-4 bg-blue-500/5 border-l border-white/5">
              <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">RiskPulse</span>
            </div>
          </div>
          {rows.map((r, i) => (
            <div key={i} className={`grid grid-cols-3 text-sm ${i < rows.length - 1 ? 'border-b border-white/5' : ''}`}>
              <div className="p-4 text-gray-300 font-medium">{r.feature}</div>
              <div className="p-4 text-center text-gray-500">
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-red-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  {r.otherLabel}
                </span>
              </div>
              <div className="p-4 text-center bg-blue-500/5 border-l border-white/5">
                <svg className="w-5 h-5 text-green-400 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── integrations ─────────────────────────────── */
function Integrations() {
  const integrations = [
    'Stripe', 'Plaid', 'Sardine', 'Socure', 'Sift', 'Snowflake',
    'Databricks', 'Persona', 'Alloy', 'LexisNexis', 'Seon', 'Ekata',
  ];
  return (
    <section className="py-20 px-6 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/[0.02] to-transparent" />
      <div className="max-w-5xl mx-auto relative z-10 text-center">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest mb-8">Works with your existing stack</h3>
        <div className="flex flex-wrap items-center justify-center gap-4">
          {integrations.map((name, i) => (
            <div
              key={i}
              className="px-6 py-3 bg-white/[0.03] border border-white/5 rounded-xl text-sm text-gray-400 hover:border-white/10 hover:text-gray-300 transition"
            >
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── enterprise ready ─────────────────────────── */
function Enterprise() {
  const features = [
    {
      title: 'Built for Security',
      items: ['On-prem deployment option', 'Your data stays in your environment', 'Complete audit logs', 'RBAC with role-based permissions'],
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
    },
    {
      title: 'Production Ready',
      items: ['99.9% uptime SLA', 'Horizontal scaling', 'Real-time event processing', 'Comprehensive API documentation'],
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
        </svg>
      ),
    },
    {
      title: 'Extensible',
      items: ['Plugin architecture for custom rules', 'Webhook & API event ingestion', 'LLM provider agnostic (OpenAI, Anthropic)', 'CSV bulk import for historical data'],
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
        </svg>
      ),
    },
  ];

  return (
    <section className="py-24 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white">Enterprise Ready</h2>
          <p className="text-gray-400 mt-4 text-lg">Built for security-conscious teams at scale</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f, i) => (
            <div key={i} className="bg-white/[0.03] border border-white/5 rounded-2xl p-8 hover:border-white/10 transition">
              <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-6 text-blue-400">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-4">{f.title}</h3>
              <ul className="space-y-2.5">
                {f.items.map((item, j) => (
                  <li key={j} className="flex items-center gap-2.5 text-sm text-gray-400">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400/60 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── pricing ──────────────────────────────────── */
function Pricing() {
  const plans = [
    {
      name: 'Starter',
      price: '$499',
      period: '/mo',
      desc: 'For small teams getting started with fraud operations',
      features: ['Up to 10,000 events/mo', '3 team members', 'Rule-based detection', 'Email support', 'Basic dashboards'],
      cta: 'Start Free Trial',
      popular: false,
    },
    {
      name: 'Pro',
      price: '$1,499',
      period: '/mo',
      desc: 'For growing teams that need AI-powered investigations',
      features: ['Up to 500,000 events/mo', '15 team members', 'AI narrative generation', 'Rule backtesting', 'Entity graph', 'Priority support', 'Custom integrations'],
      cta: 'Start Free Trial',
      popular: true,
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      desc: 'For organizations that need full control and scale',
      features: ['Unlimited events', 'Unlimited team members', 'On-prem deployment', 'Custom LLM integration', 'SSO & SCIM', 'Dedicated support', 'SLA guarantee', 'Custom rule engine'],
      cta: 'Contact Sales',
      popular: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/[0.02] to-transparent" />
      <div className="max-w-5xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white">Simple, transparent pricing</h2>
          <p className="text-gray-400 mt-4 text-lg">Start free. Scale as you grow.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((p, i) => (
            <div key={i} className={`relative rounded-2xl p-8 transition-all hover:-translate-y-1 ${p.popular ? 'bg-gradient-to-b from-blue-500/10 to-cyan-500/5 border-2 border-blue-500/30 shadow-xl shadow-blue-500/10' : 'bg-white/[0.03] border border-white/5'}`}>
              {p.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full text-xs text-white font-semibold">
                  Most Popular
                </div>
              )}
              <h3 className="text-lg font-bold text-white">{p.name}</h3>
              <div className="mt-4 mb-2">
                <span className="text-4xl font-bold text-white">{p.price}</span>
                <span className="text-gray-500">{p.period}</span>
              </div>
              <p className="text-sm text-gray-400 mb-6">{p.desc}</p>
              <button className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${p.popular ? 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:shadow-lg hover:shadow-blue-500/25' : 'bg-white/5 text-white hover:bg-white/10'}`}>
                {p.cta}
              </button>
              <ul className="mt-6 space-y-2.5">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2.5 text-sm text-gray-400">
                    <svg className="w-4 h-4 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────── CTA / Book Demo ──────────────────────────── */
function CTASection() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);

  return (
    <section id="demo" className="py-24 px-6 relative">
      <div className="absolute inset-0 bg-gradient-to-t from-blue-500/[0.05] to-transparent" />
      <div className="max-w-3xl mx-auto relative z-10 text-center">
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Ready to transform your<br />fraud operations?
        </h2>
        <p className="text-gray-400 text-lg mb-10">Get a personalized demo and see RiskPulse in action with your data.</p>

        {submitted ? (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-8 max-w-md mx-auto">
            <svg className="w-12 h-12 text-green-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="text-xl font-bold text-white mb-2">We&apos;ll be in touch!</h3>
            <p className="text-gray-400 text-sm">Our team will reach out within 24 hours to schedule your demo.</p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-3 max-w-lg mx-auto">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@company.com"
              className="flex-1 w-full px-5 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition"
            />
            <button
              onClick={() => { if (email) setSubmitted(true); }}
              className="w-full sm:w-auto px-8 py-4 bg-gradient-to-r from-blue-500 to-cyan-400 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/25 transition-all whitespace-nowrap"
            >
              Book a Demo
            </button>
          </div>
        )}

        <p className="text-xs text-gray-600 mt-4">No credit card required. Free 14-day trial available.</p>
      </div>
    </section>
  );
}

/* ─────────────────── footer ───────────────────────────────────── */
function Footer() {
  return (
    <footer className="border-t border-white/5 py-12 px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="text-lg font-bold text-white">RiskPulse</span>
            </div>
            <p className="text-sm text-gray-500">AI-powered fraud investigation platform. Detect, investigate, mitigate.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Product</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#features" className="hover:text-gray-300 transition">Features</a></li>
              <li><a href="#pricing" className="hover:text-gray-300 transition">Pricing</a></li>
              <li><a href="#" className="hover:text-gray-300 transition">Changelog</a></li>
              <li><a href="#" className="hover:text-gray-300 transition">Documentation</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Solutions</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-gray-300 transition">Payment Fraud</a></li>
              <li><a href="#" className="hover:text-gray-300 transition">Account Takeover</a></li>
              <li><a href="#" className="hover:text-gray-300 transition">KYB Investigations</a></li>
              <li><a href="#" className="hover:text-gray-300 transition">Chargeback Prevention</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">Company</h4>
            <ul className="space-y-2 text-sm text-gray-500">
              <li><a href="#" className="hover:text-gray-300 transition">About</a></li>
              <li><a href="#" className="hover:text-gray-300 transition">Blog</a></li>
              <li><a href="#" className="hover:text-gray-300 transition">Careers</a></li>
              <li><a href="#" className="hover:text-gray-300 transition">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-gray-600">&copy; 2026 RiskPulse. All rights reserved.</p>
          <div className="flex items-center gap-6 text-xs text-gray-600">
            <a href="#" className="hover:text-gray-400 transition">Privacy Policy</a>
            <a href="#" className="hover:text-gray-400 transition">Terms of Service</a>
            <a href="#" className="hover:text-gray-400 transition">Security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════ MAIN PAGE ═══════════════════════════════════ */
export default function Home() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      setIsLoggedIn(true);
      router.replace('/dashboard');
    } else {
      setIsLoggedIn(false);
    }
  }, [router]);

  // Still checking auth
  if (isLoggedIn === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#070d1a]">
        <div className="animate-pulse text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show marketing page for unauthenticated users
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#070d1a] text-white overflow-x-hidden">
        <Nav />
        <Hero />
        <ProductPreview />
        <TeamSection />
        <HowItWorks />
        <CompareSection />
        <Integrations />
        <Enterprise />
        <Pricing />
        <CTASection />
        <Footer />
      </div>
    );
  }

  return null;
}
