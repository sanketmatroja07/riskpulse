export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Privacy Policy</h1>

        <div className="prose prose-invert prose-sm max-w-none space-y-6 text-text-secondary">
          <p className="text-lg">Last updated: February 2026</p>

          <h2 className="text-xl font-semibold text-text-primary mt-8">1. Information We Collect</h2>
          <p>When you sign up for RiskPulse, we collect your name, email address, company name, and payment information. We also collect event data that you send through our API for fraud detection purposes.</p>

          <h2 className="text-xl font-semibold text-text-primary mt-8">2. How We Use Your Information</h2>
          <p>We use your information to provide the RiskPulse fraud detection service, process payments, send service notifications, and improve our platform.</p>

          <h2 className="text-xl font-semibold text-text-primary mt-8">3. Data Retention</h2>
          <p>We retain your data for as long as your account is active. Event data is retained according to your plan terms. You may request deletion at any time.</p>

          <h2 className="text-xl font-semibold text-text-primary mt-8">4. Your Rights (GDPR)</h2>
          <p>If you are in the EU/EEA, you have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access your personal data</li>
            <li>Rectify inaccurate data</li>
            <li>Request deletion of your data</li>
            <li>Restrict processing</li>
            <li>Data portability</li>
            <li>Object to processing</li>
          </ul>
          <p>To exercise these rights, contact us at privacy@riskpulse.io or use the data deletion button in Settings.</p>

          <h2 className="text-xl font-semibold text-text-primary mt-8">5. Data Security</h2>
          <p>We use industry-standard encryption (TLS 1.3) for data in transit and AES-256 for data at rest. API keys are hashed with SHA-256. Passwords are hashed with bcrypt.</p>

          <h2 className="text-xl font-semibold text-text-primary mt-8">6. Sub-processors</h2>
          <p>We use the following sub-processors: Railway (hosting), Vercel (frontend), Stripe (payments), OpenAI (AI features, opt-in), Sentry (error tracking).</p>

          <h2 className="text-xl font-semibold text-text-primary mt-8">7. Contact</h2>
          <p>For privacy concerns, contact us at privacy@riskpulse.io.</p>
        </div>

        <div className="mt-12 text-center">
          <a href="/" className="text-primary hover:underline">Back to home</a>
        </div>
      </div>
    </div>
  );
}
