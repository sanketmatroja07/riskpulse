import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'RiskPulse - Fraud Detection & Investigation Platform',
  description: 'Real-time fraud detection, investigation automation, and risk mitigation platform. Detect threats, investigate cases, and deploy mitigations in minutes.',
  keywords: ['fraud detection', 'risk management', 'investigation automation', 'AML', 'KYC', 'anti-fraud', 'payment fraud', 'account takeover'],
  authors: [{ name: 'RiskPulse' }],
  openGraph: {
    title: 'RiskPulse - Fraud Detection & Investigation Platform',
    description: 'Real-time fraud detection, investigation automation, and risk mitigation. Detect, investigate, mitigate.',
    type: 'website',
    url: 'https://riskpulse.io',
    siteName: 'RiskPulse',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'RiskPulse - Fraud Detection Platform',
    description: 'Real-time fraud detection, investigation automation, and risk mitigation.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <meta name="theme-color" content="#6366f1" />
      </head>
      <body className="bg-bg text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
