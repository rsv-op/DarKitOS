use client
import React, { useState } from 'react';

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

  if (submitted) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>Intake Staged: Payment Required</h2>
          <p style={styles.text}>
            Thank you, <strong>{formData.fullName}</strong>. Your project specifications for <strong>{formData.businessName}</strong> have been recorded.
          </p>
          <div style={styles.alertBox}>
            <p style={styles.alertTitle}>Pre-Development Policy Notice</p>
            <p style={styles.alertText}>
              Engineering resources and your <strong>7-Day Delivery Timeline</strong> begin immediately upon payment settlement. 
              An invoice notification with your secure transaction access link has been dispatched to <strong>{formData.email}</strong>.
            </p>
          </div>
          <button style={styles.primaryBtn} onClick={() => alert('Redirecting to Payment Gateway...')}>
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
          <h1 style={styles.title}>Launch Your Custom Platform</h1>
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
          <h2 style={styles.title}>Available Services</h2>
          <ul style={styles.list}>
            <li>Custom 7-Day Web Application Delivery</li>
            <li>Post-Launch "My Site Manager" Access</li>
            <li>Live Text, Asset, and Color Theme Controls</li>
            <li>Automated SMS and Voice Progress Tracking</li>
          </ul>
          <button style={styles.primaryBtn} onClick={() => setMode('questionnaire')}>
            Start Intake Questionnaire
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
            <h3 style={styles.questionTitle}>4. Required functional module</h3>
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
  container: { minHeight: '100vh', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', fontFamily: 'system-ui, sans-serif' },
  card: { backgroundColor: '#1e293b', width: '100%', maxWidth: '440px', borderRadius: '12px', padding: '24px', color: '#f8fafc', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' },
  title: { fontSize: '22px', fontWeight: 'bold', marginBottom: '8px', textAlign: 'center' },
  subtitle: { fontSize: '14px', color: '#94a3b8', marginBottom: '24px', textAlign: 'center' },
  questionTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '16px' },
  buttonGroup: { display: 'flex', flexDirection: 'column', gap: '12px' },
  primaryBtn: { width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '600', fontSize: '15px', cursor: 'pointer', marginTop: '12px' },
  secondaryBtn: { width: '100%', padding: '14px', backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', fontWeight: '600', fontSize: '15px', cursor: 'pointer' },
  optionBtn: { width: '100%', padding: '12px', backgroundColor: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', textAlign: 'left', marginBottom: '8px', fontSize: '14px', cursor: 'pointer' },
  selectedOption: { width: '100%', padding: '12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', textAlign: 'left', marginBottom: '8px', fontSize: '14px', cursor: 'pointer' },
  input: { width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', marginBottom: '12px', boxSizing: 'border-box' },
  backBtn: { background: 'none', border: 'none', color: '#94a3b8', marginTop: '16px', cursor: 'pointer', fontSize: '13px' },
  progressBarContainer: { height: '4px', backgroundColor: '#334155', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#2563eb', transition: 'width 0.3s' },
  stepLabel: { fontSize: '12px', color: '#94a3b8', marginBottom: '16px' },
  alertBox: { backgroundColor: '#1e1b4b', border: '1px solid #4338ca', padding: '14px', borderRadius: '8px', marginTop: '16px', marginBottom: '16px' },
  alertTitle: { fontSize: '13px', fontWeight: 'bold', color: '#a5b4fc', margin: '0 0 4px 0' },
  alertText: { fontSize: '12px', color: '#c7d2fe', margin: 0, lineHeight: '1.4' },
  list: { paddingLeft: '20px', color: '#cbd5e1', fontSize: '14px', lineHeight: '1.8', marginBottom: '20px' },
  text: { fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5' }
};
