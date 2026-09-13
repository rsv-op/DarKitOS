'use client';

import React, { useState } from 'react';

// Custom inline SVG icons (Zero extra npm packages needed)
const Icons = {
  SpeedDelivery: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  SiteManager: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  ColorPalette: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="#ec4899" />
      <circle cx="17.5" cy="10.5" r=".5" fill="#ec4899" />
      <circle cx="8.5" cy="7.5" r=".5" fill="#ec4899" />
      <circle cx="6.5" cy="12.5" r=".5" fill="#ec4899" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z" />
    </svg>
  ),
  OmnichannelBell: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
};

export default function FunnelApp() {
  const [mode, setMode] = useState('landing');
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    vertical: '',
    objective: '',
    archetype: '',
    feature: '',
    readiness: '',
    fullName: '',
    businessName: '',
    email: '',
    phone: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, 6));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const services = [
    {
      title: '7-Day Guaranteed Turnaround',
      desc: 'Rapid production from cleared payment directly to live deployment.',
      icon: <Icons.SpeedDelivery />,
      bg: '#0369a122',
      border: '#0284c7'
    },
    {
      title: 'Integrated "My Site Manager"',
      desc: 'Sandboxed client portal to preview and update text, assets, and design.',
      icon: <Icons.SiteManager />,
      bg: '#4338ca22',
      border: '#6366f1'
    },
    {
      title: 'Live Theme & Asset Studio',
      desc: 'Dynamic color palettes, custom typography, and direct cloud media uploads.',
      icon: <Icons.ColorPalette />,
      bg: '#be185d22',
      border: '#ec4899'
    },
    {
      title: 'Omnichannel Milestone Updates',
      desc: 'Real-time project updates and build telemetry delivered by voice, SMS, or chat.',
      icon: <Icons.OmnichannelBell />,
      bg: '#04785722',
      border: '#10b981'
    }
  ];

  if (submitted) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>Intake Staged: Payment Required</h2>
          <p style={styles.text}>
            Thank you, <strong>{formData.fullName}</strong>. Specifications for <strong>{formData.businessName}</strong> are logged.
          </p>
          <div style={styles.alertBox}>
            <p style={styles.alertTitle}>Pre-Development Policy Notice</p>
            <p style={styles.alertText}>
              Engineering resources and your <strong>7-Day Delivery Timeline</strong> activate immediately upon payment settlement. 
              Invoice confirmation and your secure portal access link have been staged for <strong>{formData.email}</strong>.
            </p>
          </div>
          <button style={styles.primaryBtn} onClick={() => alert('Redirecting to checkout...')}>
            Proceed to Secure Checkout
          </button>
        </div>
      </main>
    );
  }

  if (mode === 'landing') {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Custom Website Platform</h1>
          <p style={styles.subtitle}>Select your starting pathway below to begin.</p>
          <div style={styles.buttonGroup}>
            <button style={styles.primaryBtn} onClick={() => setMode('questionnaire')}>
              Build a Website Now
            </button>
            <button style={styles.secondaryBtn} onClick={() => setMode('browse')}>
              Browse Services
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (mode === 'browse') {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={styles.badge}>CAPABILITIES & ARCHITECTURE</span>
            <h2 style={{ ...styles.title, marginTop: '8px' }}>Available Services</h2>
            <p style={styles.subtitle}>Enterprise development precision with direct portal autonomy.</p>
          </div>

          <div style={styles.serviceGrid}>
            {services.map((svc, index) => (
              <div key={index} style={{ ...styles.serviceCard, borderColor: svc.border }}>
                <div style={{ ...styles.iconContainer, backgroundColor: svc.bg }}>
                  {svc.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={styles.serviceTitle}>{svc.title}</h4>
                  <p style={styles.serviceDesc}>{svc.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button style={styles.primaryBtn} onClick={() => setMode('questionnaire')}>
            Start Intake Questionnaire
          </button>
          <button style={styles.backBtn} onClick={() => setMode('landing')}>
            ← Back to Home
          </button>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.container}>
      <div style={styles.card}>
        <div style={styles.progressBarContainer}>
          <div style={{ ...styles.progressBar, width: `${(step / 6) * 100}%` }} />
        </div>
        <p style={styles.stepLabel}>Step {step} of 6</p>

        {step === 1 && (
          <div>
            <h3 style={styles.questionTitle}>1. What is your industry vertical?</h3>
            {['Professional Services', 'E-Commerce / Retail', 'Healthcare / Medical', 'Technology / SaaS'].map((item) => (
              <button
                key={item}
                style={formData.vertical === item ? styles.selectedOption : styles.optionBtn}
                onClick={() => { updateField('vertical', item); handleNext(); }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={styles.questionTitle}>2. What is your primary objective?</h3>
            {['Lead Generation', 'Direct Sales', 'Portfolio Showcase', 'Brand Awareness'].map((item) => (
              <button
                key={item}
                style={formData.objective === item ? styles.selectedOption : styles.optionBtn}
                onClick={() => { updateField('objective', item); handleNext(); }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {step === 3 && (
          <div>
            <h3 style={styles.questionTitle}>3. Select your aesthetic archetype</h3>
            {['Minimal Clean', 'Bold Editorial', 'Technical Dark', 'Warm Corporate'].map((item) => (
              <button
                key={item}
                style={formData.archetype === item ? styles.selectedOption : styles.optionBtn}
                onClick={() => { updateField('archetype', item); handleNext(); }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {step === 4 && (
          <div>
            <h3 style={styles.questionTitle}>4. Required functional feature</h3>
            {['Appointment Scheduling', 'Contact / Inquiry Forms', 'Interactive Gallery', 'Customer Portal'].map((item) => (
              <button
                key={item}
                style={formData.feature === item ? styles.selectedOption : styles.optionBtn}
                onClick={() => { updateField('feature', item); handleNext(); }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {step === 5 && (
          <div>
            <h3 style={styles.questionTitle}>5. Brand asset readiness</h3>
            {['I have a domain and vector logo ready', 'I have logo files but no domain', 'I need full branding from scratch'].map((item) => (
              <button
                key={item}
                style={formData.readiness === item ? styles.selectedOption : styles.optionBtn}
                onClick={() => { updateField('readiness', item); handleNext(); }}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {step === 6 && (
          <form onSubmit={handleSubmit}>
            <h3 style={styles.questionTitle}>6. Contact Credentials</h3>
            <input
              style={styles.input}
              placeholder="Full Name"
              required
              value={formData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
            />
            <input
              style={styles.input}
              placeholder="Business Name"
              required
              value={formData.businessName}
              onChange={(e) => updateField('businessName', e.target.value)}
            />
            <input
              style={styles.input}
              type="email"
              placeholder="Email Address"
              required
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
            <input
              style={styles.input}
              type="tel"
              placeholder="Phone Number (e.g. +14155550144)"
              required
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
            <button type="submit" style={styles.primaryBtn}>
              Submit & Request Invoice
            </button>
          </form>
        )}

        {step > 1 && (
          <button style={styles.backBtn} onClick={handleBack}>
            ← Back
          </button>
        )}
      </div>
    </main>
  );
}

const styles = {
  container: { minHeight: '100vh', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box' },
  card: { backgroundColor: '#1e293b', width: '100%', maxWidth: '440px', borderRadius: '14px', padding: '24px', color: '#f8fafc', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)', boxSizing: 'border-box' },
  title: { fontSize: '22px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' },
  subtitle: { fontSize: '13px', color: '#94a3b8', marginBottom: '18px', textAlign: 'center', lineHeight: '1.4' },
  badge: { fontSize: '10px', letterSpacing: '1px', fontWeight: '700', color: '#38bdf8', backgroundColor: '#0284c722', padding: '4px 10px', borderRadius: '999px', border: '1px solid #0284c744' },
  serviceGrid: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' },
  serviceCard: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', backgroundColor: '#0f172a88', borderRadius: '10px', border: '1px solid #334155' },
  iconContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '40px', borderRadius: '8px' },
  serviceTitle: { fontSize: '14px', fontWeight: '600', margin: '0 0 2px 0', color: '#f8fafc' },
  serviceDesc: { fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.35' },
  questionTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '16px' },
  buttonGroup: { display: 'flex', flexDirection: 'column', gap: '12px' },
  primaryBtn: { width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', marginTop: '10px' },
  secondaryBtn: { width: '100%', padding: '14px', backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', fontWeight: '600', fontSize: '15px', cursor: 'pointer' },
  optionBtn: { width: '100%', padding: '12px', backgroundColor: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', textAlign: 'left', marginBottom: '8px', fontSize: '14px', cursor: 'pointer' },
  selectedOption: { width: '100%', padding: '12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', textAlign: 'left', marginBottom: '8px', fontSize: '14px', cursor: 'pointer' },
  input: { width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', marginBottom: '12px', boxSizing: 'border-box' },
  backBtn: { background: 'none', border: 'none', color: '#94a3b8', marginTop: '14px', cursor: 'pointer', fontSize: '13px', width: '100%', textAlign: 'center' },
  progressBarContainer: { height: '4px', backgroundColor: '#334155', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#2563eb', transition: 'width 0.3s' },
  stepLabel: { fontSize: '12px', color: '#94a3b8', marginBottom: '16px' },
  alertBox: { backgroundColor: '#1e1b4b', border: '1px solid #4338ca', padding: '14px', borderRadius: '8px', marginTop: '16px', marginBottom: '16px' },
  alertTitle: { fontSize: '13px', fontWeight: 'bold', color: '#a5b4fc', margin: '0 0 4px 0' },
  alertText: { fontSize: '12px', color: '#c7d2fe', margin: 0, lineHeight: '1.4' },
  text: { fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5' }
};
