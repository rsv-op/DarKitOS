

'use client';

import React, { useState } from 'react';
import styles from './page.module.css';

const verticalsData = {
  b2b: {
    title: "High-Ticket B2B & Enterprise",
    desc: "Multi-stakeholder risk reduction and pipeline velocity.",
    headline: "Enterprise Procurement Trust & Pipeline Acceleration",
    summary: "Engineered specifically to satisfy risk committees, procurement officers, and technical evaluators with zero friction.",
    metrics: { m1: "+312%", l1: "Pipeline Velocity", m2: "4.2x", l2: "Procurement Conversion" },
    matrix: [
      { title: "Risk Mitigation Rubric", desc: "Explicit compliance, enterprise security proofs, and SLA guarantees structured for risk committees.", tag: "ENTERPRISE TRUST" },
      { title: "Direct SDR Routing", desc: "Frictionless calendar scheduling embedded directly after high-intent case study validation.", tag: "PIPELINE VELOCITY" },
      { title: "Interactive ROI Calculators", desc: "Dynamic real-time calculators proving immediate financial payback periods to economic buyers.", tag: "FINANCIAL PROOF" }
    ],
    timeline: "7-Day Guaranteed Launch | Stack: Zero-Bloat Vanilla Architecture"
  },
  healthcare: {
    title: "High-Trust Clinics & Healthcare",
    desc: "Immediate proximity trust and friction-free booking.",
    headline: "Frictionless Patient Intake & Credential Transparency",
    summary: "Designed for immediate trust building, instant provider credential verification, and 2-click appointment scheduling.",
    metrics: { m1: "2-Click", l1: "Appointment Switcher", m2: "99.8%", l2: "Patient Trust Score" },
    matrix: [
      { title: "Proximity & Credentialing", desc: "Instant display of board certifications, clinic locations, and insurance carrier compatibility.", tag: "INSTANT TRUST" },
      { title: "2-Click Appointment Engine", desc: "Zero-lag scheduling widget optimized for mobile emergencies and urgent care bookings.", tag: "FRICTIONLESS" },
      { title: "Outcome Matrices", desc: "Transparent before-and-after verification data backed by clinical compliance disclosures.", tag: "CLINICAL PROOF" }
    ],
    timeline: "7-Day Guaranteed Launch | HIPAA-Ready Compliant Architecture"
  },
  luxury: {
    title: "Luxury & High-AOV eCommerce",
    desc: "Sensory merchandising and editorial brand equity.",
    headline: "Sensory Digital Merchandising & Split-Second Speed",
    summary: "Eliminates script bloat while maximizing aesthetic prestige through high-end typography and interactive detail drawers.",
    metrics: { m1: "0.4s", l1: "First Contentful Paint", m2: "+210%", l2: "AOV Lift" },
    matrix: [
      { title: "Sensory Media Drawers", desc: "High-resolution micro-interactions and tactile craft documentation that command premium pricing.", tag: "EDITORIAL EQUITY" },
      { title: "Instant Micro-Carts", desc: "Zero-latency checkout drawers that preserve high-fashion immersion without page reloads.", tag: "HIGH-AOV SPEED" },
      { title: "Scarcity & Provenance", desc: "Numbered edition counters and artisan origin disclosures driving immediate luxury desire.", tag: "EXCLUSIVITY" }
    ],
    timeline: "7-Day Guaranteed Launch | Edge-Optimized CDN Architecture"
  },
  consultancy: {
    title: "Advisory, Legal & Consultancies",
    desc: "Authority positioning and client qualification.",
    headline: "Proprietary Methodology Showcase & Fit Qualification",
    summary: "Filters out low-intent leads using interactive diagnostic quizzes while establishing undisputed domain authority.",
    metrics: { m1: "88%", l1: "Lead Qualification Rate", m2: "5x", l2: "Consultation Bookings" },
    matrix: [
      { title: "Fit Diagnostic Quizzes", desc: "Interactive multi-step qualification forms that pre-qualify prospects before calendar access.", tag: "AUTOMATED QUAL" },
      { title: "Methodology Roadmaps", desc: "Visual step-by-step framework breakdowns proving unique intellectual property advantage.", tag: "DOMAIN AUTHORITY" },
      { title: "Tier-Gated Booking", desc: "Dynamic scheduling routing high-budget retainers directly to senior partners.", tag: "EXECUTIVE ROUTING" }
    ],
    timeline: "7-Day Guaranteed Launch | Secure Client Portal Integration"
  }
};

export default function LaunchSevenApp() {
  const [currentVertical, setCurrentVertical] = useState('b2b');
  const [visitors, setVisitors] = useState(25000);
  const [aov, setAov] = useState(1500);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    fullName: '',
    businessName: '',
    email: '',
    phone: '',
    scope: ''
  });

  const activeData = verticalsData[currentVertical];
  const incrementalRevenue = Math.round(visitors * 0.015 * 3.1 * aov * 12);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <main className={styles.container}>
      <div className={styles.agencyWrapper}>
        {/* Header */}
        <header>
          <div className={styles.logoArea}>
            <div className={styles.logoMark}>L7</div>
            <div className={styles.logoText}>Launch7 Studio</div>
          </div>
          <div className={styles.agencyThesis}>
            "End-to-end custom websites automated to launch exactly 7 days after payment."
          </div>
          <button 
            className={styles.ctaBtn} 
            style={{ padding: '10px 20px', fontSize: '13px', margin: 0, width: 'auto' }} 
            onClick={() => setIsModalOpen(true)}
          >
            Start 7-Day Build
          </button>
        </header>

        {/* Glanceable Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroBadge}>
            <span>⚡</span> Automated 7-Day Bespoke Architecture
          </div>
          <h1 className={styles.heroTitle}>
            Generic templates fail. <br />
            <span>We engineer vertical conversion dominance in 7 days.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Select your business model below to preview your custom vertical architecture. Complete checkout to activate your automated 7-day launch clock.
          </p>

          {/* Dynamic Vertical Switcher */}
          <div className={styles.switcherContainer}>
            {Object.keys(verticalsData).map((key) => {
              const item = verticalsData[key];
              const isActive = currentVertical === key;
              return (
                <div
                  key={key}
                  className={`${styles.verticalTab} ${isActive ? styles.verticalTab.active || styles.verticalTabActive : ''}`}
                  onClick={() => setCurrentVertical(key)}
                  style={isActive ? { borderColor: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)' } : {}}
                >
                  <div className={styles.tabTitle}>{item.title}</div>
                  <div className={styles.tabDesc}>{item.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Live Preview Display */}
          <div className={styles.previewCard}>
            <div className={styles.previewContent}>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#0ea5e9', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Active Architecture Preview
              </span>
              <h3>{activeData.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', lineHeight: '1.5' }}>{activeData.summary}</p>
            </div>
            <div className={styles.previewMetrics}>
              <div className={styles.metricBox}>
                <div className={styles.metricValue}>{activeData.metrics.m1}</div>
                <div className={styles.metricLabel}>{activeData.metrics.l1}</div>
              </div>
              <div className={styles.metricBox}>
                <div className={styles.metricValue}>{activeData.metrics.m2}</div>
                <div className={styles.metricLabel}>{activeData.metrics.l2}</div>
              </div>
            </div>
          </div>
        </section>

        {/* Business-Specific Benefits Matrix */}
        <section className={styles.matrixSection}>
          <div className={styles.sectionHeader}>
            <h2>Architectural Conversion Matrix</h2>
            <p>Mapping high-intent conversion drivers directly to your specific business model.</p>
          </div>
          <div className={styles.matrixGrid}>
            {activeData.matrix.map((item, idx) => (
              <div key={idx} className={styles.matrixCard}>
                <span className={styles.matrixTag}>{item.tag}</span>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive ROI & Automated Onboarding Estimator */}
        <section className={styles.calculatorSection}>
          <div className={styles.sectionHeader}>
            <h2>Interactive Revenue & 7-Day Sprint Estimator</h2>
            <p>Simulate your projected incremental pipeline velocity and initiate your build.</p>
          </div>
          <div className={styles.calcGrid}>
            <div>
              <div className={styles.sliderGroup}>
                <label>Select Industry Vertical:</label>
                <select 
                  value={currentVertical} 
                  onChange={(e) => setCurrentVertical(e.target.value)}
                >
                  <option value="b2b">High-Ticket B2B & Enterprise</option>
                  <option value="healthcare">High-Trust Clinics & Healthcare</option>
                  <option value="luxury">Luxury & High-AOV eCommerce</option>
                  <option value="consultancy">Advisory, Legal & Consultancies</option>
                </select>
              </div>
              <div className={styles.sliderGroup}>
                <label>
                  Current Monthly Unique Visitors:{' '}
                  <span style={{ color: '#0ea5e9', fontWeight: 700 }}>{visitors.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min="5000"
                  max="150000"
                  step="5000"
                  value={visitors}
                  onChange={(e) => setVisitors(Number(e.target.value))}
                />
              </div>
              <div className={styles.sliderGroup}>
                <label>
                  Average Deal / Order Value ($):{' '}
                  <span style={{ color: '#f59e0b', fontWeight: 700 }}>${aov.toLocaleString()}</span>
                </label>
                <input
                  type="range"
                  min="100"
                  max="10000"
                  step="100"
                  value={aov}
                  onChange={(e) => setAov(Number(e.target.value))}
                />
              </div>
            </div>

            <div className={styles.calcOutputBox}>
              <span style={{ fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Projected Incremental Annual Revenue
              </span>
              <div
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  fontSize: '38px',
                  fontWeight: 700,
                  color: '#10b981',
                  margin: '8px 0',
                }}
              >
                +${incrementalRevenue.toLocaleString()}
              </div>
              <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '16px' }}>
                {activeData.timeline}
              </p>
              <button className={styles.ctaBtn} onClick={() => setIsModalOpen(true)}>
                Start 7-Day Build Now →
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer>
          &copy; 2026 Launch7 Studio & VerticalForge Labs. Automated 7-day bespoke website delivery.
        </footer>
      </div>

      {/* Automated 7-Day Onboarding Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContainer}>
            <button className={styles.modalClose} onClick={() => setIsModalOpen(false)}>×</button>
            
            {!submitted ? (
              <>
                <div style={{ marginBottom: '24px' }}>
                  <span className={styles.matrixTag} style={{ marginBottom: '8px', display: 'inline-block' }}>AUTOMATED 7-DAY SPRINT</span>
                  <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '24px', marginBottom: '6px' }}>
                    Configure Your Bespoke Build
                  </h3>
                  <p style={{ fontSize: '13px', color: '#94a3b8' }}>
                    Submit your project parameters. Once payment clears, your 7-day automated delivery clock activates immediately.
                  </p>
                </div>
                <form onSubmit={handleFormSubmit}>
                  <div className={styles.sliderGroup}>
                    <label>Full Name</label>
                    <input 
                      type="text" 
                      required 
                      className={styles.formInput} 
                      placeholder="e.g. Richu Shaji"
                      value={formData.fullName}
                      onChange={(e) => setFormData({...formData, fullName: e.target.value})}
                    />
                  </div>
                  <div className={styles.sliderGroup}>
                    <label>Business / Brand Name</label>
                    <input 
                      type="text" 
                      required 
                      className={styles.formInput} 
                      placeholder="e.g. Apex Dynamics"
                      value={formData.businessName}
                      onChange={(e) => setFormData({...formData, businessName: e.target.value})}
                    />
                  </div>
                  <div className={styles.sliderGroup}>
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      required 
                      className={styles.formInput} 
                      placeholder="richu@company.com"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className={styles.sliderGroup}>
                    <label>Specific Customization Requirements</label>
                    <input 
                      type="text" 
                      required 
                      className={styles.formInput} 
                      placeholder="e.g. Need integrated booking and Stripe billing"
                      value={formData.scope}
                      onChange={(e) => setFormData({...formData, scope: e.target.value})}
                    />
                  </div>
                  <button type="submit" className={styles.ctaBtn}>
                    Proceed to Secure Checkout ($749) →
                  </button>
                </form>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>⚡</div>
                <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '22px', marginBottom: '8px' }}>
                  Specifications Logged, {formData.fullName}!
                </h3>
                <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.5', marginBottom: '20px' }}>
                  Your <strong>7-day automated build clock</strong> for <strong>{formData.businessName}</strong> is staged. Staging preview tokens have been dispatched to <strong>{formData.email}</strong>.
                </p>
                <button className={styles.ctaBtn} onClick={() => { setIsModalOpen(false); setSubmitted(false); }}>
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
