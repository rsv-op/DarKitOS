
'use client';

import { useState } from 'react';
import styles from './page.module.css';

const verticalsData = {
  b2b: {
    title: "High-Ticket B2B & Enterprise",
    desc: "Multi-stakeholder risk reduction and pipeline velocity.",
    headline: "Enterprise Procurement Trust & Pipeline Acceleration",
    summary: "Engineered specifically to satisfy risk committees, procurement officers, and technical evaluators with zero friction.",
    metrics: { m1: "+312%", l1: "Pipeline Velocity", m2: "4.2x", l2: "Procurement Conversion" }
  },
  healthcare: {
    title: "High-Trust Clinics & Healthcare",
    desc: "Immediate proximity trust and friction-free booking.",
    headline: "Frictionless Patient Intake & Credential Transparency",
    summary: "Designed for immediate trust building, instant provider credential verification, and 2-click appointment scheduling.",
    metrics: { m1: "2-Click", l1: "Appointment Switcher", m2: "99.8%", l2: "Patient Trust Score" }
  },
  luxury: {
    title: "Luxury & High-AOV eCommerce",
    desc: "Sensory merchandising and editorial brand equity.",
    headline: "Sensory Digital Merchandising & Split-Second Speed",
    summary: "Eliminates script bloat while maximizing aesthetic prestige through high-end typography and interactive detail drawers.",
    metrics: { m1: "0.4s", l1: "First Contentful Paint", m2: "+210%", l2: "AOV Lift" }
  },
  consultancy: {
    title: "Advisory, Legal & Consultancies",
    desc: "Authority positioning and client qualification.",
    headline: "Proprietary Methodology Showcase & Fit Qualification",
    summary: "Filters out low-intent leads using interactive diagnostic quizzes while establishing undisputed domain authority.",
    metrics: { m1: "88%", l1: "Lead Qualification Rate", m2: "5x", l2: "Consultation Bookings" }
  }
};

export default function VerticalForgeApp() {
  const [currentVertical, setCurrentVertical] = useState('b2b');
  const [visitors, setVisitors] = useState(25000);
  const [aov, setAov] = useState(1500);

  const activeData = verticalsData[currentVertical];

  // Incremental Revenue calculation formula
  const incrementalRevenue = Math.round(visitors * 0.015 * 3.1 * aov * 12);

  return (
    <main className={styles.container}>
      <div className={styles.agencyWrapper}>
        {/* Header */}
        <header>
          <div className={styles.logoArea}>
            <div className={styles.logoMark}>VF</div>
            <div className={styles.logoText}>VerticalForge</div>
          </div>
          <div className={styles.agencyThesis}>
            "Revenue-grade websites engineered strictly around vertical-specific buyer psychology."
          </div>
          <button 
            className={styles.ctaBtn} 
            style={{ padding: '10px 20px', fontSize: '13px', margin: 0 }} 
            onClick={() => alert('Strategy booking modal triggered.')}
          >
            Book Strategy Call
          </button>
        </header>

        {/* Hero Section */}
        <section className={styles.heroSection}>
          <div className={styles.heroBadge}>
            <span>⚡</span> Conversion Architecture Engine
          </div>
          <h1 className={styles.heroTitle}>
            Generic templates fail. <br />
            <span className={styles.heroTitleSpan}>We engineer vertical conversion dominance.</span>
          </h1>
          <p className={styles.heroSubtitle}>
            Select your business model below to instantly experience how tailored architectural heuristics achieve up to 3x higher conversion rates than commodity templates.
          </p>

          {/* Dynamic Vertical Switcher */}
          <div className={styles.switcherContainer}>
            {Object.keys(verticalsData).map((key) => {
              const item = verticalsData[key];
              const isActive = currentVertical === key;
              return (
                <div
                  key={key}
                  className={`${styles.verticalTab} ${isActive ? styles.verticalTabActive : ''}`}
                  onClick={() => setCurrentVertical(key)}
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
                Active Architecture Blueprint
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

        {/* Interactive ROI Estimator */}
        <section className={styles.calculatorSection}>
          <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '28px', marginBottom: '8px' }}>
            Interactive Revenue Impact Estimator
          </h2>
          <p style={{ color: '#94a3b8', fontSize: '14px' }}>
            Simulate your projected incremental pipeline velocity based on your current traffic scale.
          </p>

          <div className={styles.calcGrid}>
            <div>
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
              <p style={{ fontSize: '11px', color: '#94a3b8' }}>
                Based on an average +3.1x conversion lift benchmark across engineered vertical frameworks.
              </p>
              <button className={styles.ctaBtn} onClick={() => alert('Blueprint audit request initialized.')}>
                Claim Your Industry Blueprint →
              </button>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer>
          &copy; 2026 VerticalForge Architecture Labs. All rights reserved. React Server/Client Execution via Vercel.
        </footer>
      </div>
    </main>
  );
}
