

'use client';

import React, { useState, useEffect } from 'react';

// Custom SVG Vector Icons
const Icons = {
  SpeedDelivery: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  TrendingUp: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Share: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  ),
  Eye: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  ),
  ShieldCheck: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  Laptop: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  Smartphone: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" /><line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  )
};

export default function LaunchSevenApp() {
  const [mode, setMode] = useState('landing');
  const [step, setStep] = useState(1);
  const [selectedTier, setSelectedTier] = useState('Growth Engine');
  const [previewDevice, setPreviewDevice] = useState('desktop');
  const [activePortfolioIndex, setActivePortfolioIndex] = useState(0);
  const [shareNotice, setShareNotice] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState('');

  const [formData, setFormData] = useState({
    tier: 'Growth Engine',
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

  useEffect(() => {
    const target = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setDeliveryDate(target.toLocaleDateString('en-US', { month: 'short', day: 'numeric', weekday: 'short' }));
  }, []);

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, 6));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'LaunchSeven Studio',
          text: 'Get a custom, professional website launched in 7 days with personal control!',
          url: window.location.href,
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShareNotice(true);
      setTimeout(() => setShareNotice(false), 3000);
    }
  };

  // Distinct Real-World Generic Portfolios (Avoids trademark loopholes)
  const portfolioProjects = [
    {
      businessType: 'B2B Enterprise & Logistics',
      brand: 'Apex Transit Dynamics',
      tagline: 'High-Velocity Global Supply Chain Infrastructure',
      badge: 'ENTERPRISE TECH',
      accentColor: '#38bdf8',
      heroImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=900&q=80',
      stats: ['Sub-Second Dispatch Routing', '42 Global Nodes', '99.99% Telemetry Uptime'],
      layoutStyle: 'High-density telemetry dashboard with active tracking modules.',
      actionCta: 'Access Partner Terminal'
    },
    {
      businessType: 'Artisan Retail & Roastery',
      brand: 'Solstice Botanical Goods',
      tagline: 'Hand-Harvested Small Batch Organics & Pantry',
      badge: 'E-COMMERCE STUDIO',
      accentColor: '#fb923c',
      heroImage: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?auto=format&fit=crop&w=900&q=80',
      stats: ['Direct Farm Sourcing', 'Zero Waste Packaging', '4.9★ Customer Loyalty'],
      layoutStyle: 'Warm terracotta visual storytelling with integrated 1-click cart.',
      actionCta: 'Explore Seasonal Reserve'
    },
    {
      businessType: 'Deep-Tech & Automation',
      brand: 'Kinesis Robotics Lab',
      tagline: 'Autonomous Fabrication & Industrial Neural Systems',
      badge: 'HARDWARE & AI',
      accentColor: '#a855f7',
      heroImage: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?auto=format&fit=crop&w=900&q=80',
      stats: ['12ms Actuator Response', 'ISO-Certified Architecture', '24/7 Remote Diagnostics'],
      layoutStyle: 'Obsidian dark-mode with high-contrast technical schematics.',
      actionCta: 'Inspect Engineering Specs'
    },
    {
      businessType: 'Healthcare & Specialized Clinic',
      brand: 'Aegis Medical Collective',
      tagline: 'Evidence-Based Preventative & Regenerative Medicine',
      badge: 'CLINICAL PRACTICE',
      accentColor: '#34d399',
      heroImage: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=900&q=80',
      stats: ['Same-Day Intake Guarantee', 'Board-Certified Specialists', 'HIPAA Verified Portal'],
      layoutStyle: 'Clinical slate design with instant calendar appointment scheduling.',
      actionCta: 'Book Medical Consultation'
    }
  ];

  const activeProject = portfolioProjects[activePortfolioIndex];

  // Simplified & Concise Pricing Tiers
  const pricingPlans = [
    {
      name: 'Starter Launch',
      price: '$449',
      tagline: 'Complete launch foundation for local services and personal brands.',
      badge: 'ENTRY',
      features: [
        'Guaranteed 7-day turnaround',
        'Mobile-first responsive build',
        'My Site Manager: Text & Color studio',
        'Lead capture & appointment form',
        '100% Code & Content Ownership'
      ],
      highlight: false
    },
    {
      name: 'Growth Engine',
      price: '$749',
      tagline: 'Optimized for customer acquisition, booking, and sales growth.',
      badge: 'MOST POPULAR',
      features: [
        'Everything in Starter Launch',
        'Full Media Studio: Cloud image uploads',
        'Multi-section catalog or booking engine',
        'SMS milestone updates to your phone',
        'Local Google search SEO configuration'
      ],
      highlight: true
    },
    {
      name: 'Scale Pro',
      price: '$1,049',
      tagline: 'Enterprise multi-page layout with unlimited customization.',
      badge: 'UNLIMITED UPDATES',
      features: [
        'Dynamic multi-page architecture',
        'UNLIMITED revision and modulation requests',
        'VIP priority staging deployment',
        'AI progress tracking assistant',
        'Custom domain setup & speed acceleration'
      ],
      highlight: false
    }
  ];

  // Dynamic Background Gradient Generator based on current page view
  const getDynamicBackground = () => {
    switch (mode) {
      case 'creator_brand':
        return 'radial-gradient(circle at 80% 20%, rgba(219, 39, 119, 0.35) 0%, rgba(88, 28, 135, 0.28) 40%, rgba(5, 8, 17, 0.95) 100%)';
      case 'portfolio':
        return 'radial-gradient(circle at 20% 20%, rgba(6, 182, 212, 0.32) 0%, rgba(16, 185, 129, 0.22) 45%, rgba(5, 8, 17, 0.95) 100%)';
      case 'pricing':
        return 'radial-gradient(circle at 50% 10%, rgba(37, 99, 235, 0.38) 0%, rgba(15, 23, 42, 0.9) 70%, rgba(5, 8, 17, 0.98) 100%)';
      default:
        return 'radial-gradient(circle at center, rgba(30, 58, 138, 0.28) 0%, rgba(15, 23, 42, 0.85) 50%, rgba(5, 8, 17, 0.97) 100%)';
    }
  };

  // --- VIEW: SUBMISSION STAGED ---
  if (submitted) {
    return (
      <main style={{ ...styles.container, background: getDynamicBackground() }}>
        <div style={styles.card}>
          <h2 style={styles.title}>You are almost there!</h2>
          <p style={styles.text}>
            Thank you, <strong>{formData.fullName}</strong>. Specifications for <strong>{formData.businessName}</strong> are logged.
          </p>
          <div style={styles.alertBox}>
            <p style={styles.alertTitle}>Next Step: Payment Settlement</p>
            <p style={styles.alertText}>
              Your <strong>7-day delivery clock</strong> activates immediately upon payment confirmation. 
              Invoice confirmation and portal tokens have been staged for <strong>{formData.email}</strong>.
            </p>
          </div>
          <button style={styles.primaryBtn} onClick={() => alert(`Redirecting to secure checkout for ${formData.tier}...`)}>
            Complete Payment & Start Build
          </button>
        </div>
      </main>
    );
  }

  // --- VIEW: OWN YOUR BRAND HUB (CREATORS & CATALOGS) ---
  if (mode === 'creator_brand') {
    return (
      <main style={{ ...styles.container, background: getDynamicBackground() }}>
        <div style={styles.vibrantOrbPink} />
        <div style={styles.vibrantOrbPurple} />

        <div style={{ ...styles.cardRelative, maxWidth: '520px' }}>
          <div style={{ textAlign: 'center', marginBottom: '18px' }}>
            <span style={styles.creatorPill}>✨ CREATORS, ARTISTS & PERSONAL BRANDS</span>
            <h2 style={{ ...styles.title, marginTop: '8px' }}>Own Your Brand Hub</h2>
            <p style={styles.brandSubheading}>
              Stop sending followers to generic link-in-bio trees. Own a high-converting portfolio and product catalog on your own custom domain.
            </p>
          </div>

          <div style={styles.creatorGrid}>
            <div style={styles.creatorCard}>
              <h4 style={{ ...styles.creatorCardTitle, color: '#f472b6' }}>📸 Visual Catalog & Portfolio</h4>
              <p style={styles.creatorCardText}>Present your work, photography, designs, or physical goods with responsive high-definition galleries.</p>
            </div>
            <div style={styles.creatorCard}>
              <h4 style={{ ...styles.creatorCardTitle, color: '#c084fc' }}>🔗 Centralized Social Hub</h4>
              <p style={styles.creatorCardText}>Bring your YouTube, Instagram, TikTok, podcasts, and newsletter together under one branded roof.</p>
            </div>
            <div style={styles.creatorCard}>
              <h4 style={{ ...styles.creatorCardTitle, color: '#38bdf8' }}>💼 Direct Brand Partnerships</h4>
              <p style={styles.creatorCardText}>Capture corporate sponsorships and direct inquiries with automated intake forms and zero platform cuts.</p>
            </div>
          </div>

          <button
            style={styles.primaryBtn}
            onClick={() => {
              updateField('vertical', 'Creator & Personal Brand');
              setMode('questionnaire');
            }}
          >
            Build My Creator Brand Site →
          </button>

          <button style={styles.backBtn} onClick={() => setMode('landing')}>
            ← Back to Home
          </button>
        </div>
      </main>
    );
  }

  // --- VIEW: UNIQUE REAL-WORLD PORTFOLIO PAGE ---
  if (mode === 'portfolio') {
    return (
      <main style={{ ...styles.container, background: getDynamicBackground() }}>
        <div style={styles.vibrantOrbCyan} />
        <div style={styles.vibrantOrbEmerald} />

        <div style={{ ...styles.cardRelative, maxWidth: '820px', width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={styles.portfolioBadge}>REAL-WORLD ARCHITECTURES</span>
            <h2 style={{ ...styles.title, marginTop: '6px' }}>Live Client Portfolios</h2>
            <p style={styles.brandSubheading}>Every business requires a custom layout. Inspect our production models below.</p>
          </div>

          {/* Business Type Tabs */}
          <div style={styles.portfolioTabs}>
            {portfolioProjects.map((proj, idx) => (
              <button
                key={proj.brand}
                style={activePortfolioIndex === idx ? styles.portfolioTabActive : styles.portfolioTab}
                onClick={() => setActivePortfolioIndex(idx)}
              >
                {proj.businessType}
              </button>
            ))}
          </div>

          {/* Live Interactive Canvas Box */}
          <div style={styles.portfolioPreviewBox}>
            <div style={styles.browserHeader}>
              <div style={styles.browserDots}>
                <span style={{ ...styles.dot, backgroundColor: '#ef4444' }} />
                <span style={{ ...styles.dot, backgroundColor: '#eab308' }} />
                <span style={{ ...styles.dot, backgroundColor: '#22c55e' }} />
              </div>
              <div style={styles.browserUrlPill}>
                {activeProject.brand.toLowerCase().replace(/\s+/g, '')}.com
              </div>
              <span style={{ fontSize: '10px', color: activeProject.accentColor, fontWeight: '700' }}>
                {activeProject.badge}
              </span>
            </div>

            <div style={styles.portfolioHero}>
              <img src={activeProject.heroImage} alt={activeProject.brand} style={styles.portfolioHeroImg} />
              <div style={styles.portfolioHeroOverlay} />
              <div style={styles.portfolioHeroDetails}>
                <span style={{ ...styles.mockupBadge, borderColor: activeProject.accentColor, color: activeProject.accentColor }}>
                  {activeProject.businessType}
                </span>
                <h3 style={styles.portfolioHeroTitle}>{activeProject.brand}</h3>
                <p style={styles.portfolioHeroSub}>{activeProject.tagline}</p>
                
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button style={{ ...styles.mockupActionBtn, backgroundColor: activeProject.accentColor }}>
                    {activeProject.actionCta}
                  </button>
                  <button style={styles.mockupSecondaryBtn}>
                    View Case Study
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.portfolioStatsRow}>
              {activeProject.stats.map((s, i) => (
                <span key={i} style={{ fontSize: '11px', color: '#cbd5e1', fontWeight: '500' }}>
                  ✓ {s}
                </span>
              ))}
            </div>

            <div style={styles.portfolioLayoutNote}>
              <span style={{ color: activeProject.accentColor, fontWeight: '700' }}>Layout Design: </span>
              {activeProject.layoutStyle}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              style={{ ...styles.primaryBtn, flex: 1 }}
              onClick={() => {
                updateField('vertical', activeProject.businessType);
                setMode('questionnaire');
              }}
            >
              Build a Website Like This →
            </button>
            <button style={{ ...styles.secondaryBtn, width: 'auto', padding: '0 20px' }} onClick={() => setMode('landing')}>
              Back
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- VIEW: CONCISE & SIMPLIFIED PRICING ---
  if (mode === 'pricing') {
    return (
      <main style={{ ...styles.container, background: getDynamicBackground() }}>
        <div style={{ ...styles.cardRelative, maxWidth: '540px' }}>
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <span style={styles.badge}>CONCISE PRICING</span>
            <h2 style={{ ...styles.title, marginTop: '6px' }}>Full Website Starting at $449</h2>
            <p style={styles.brandSubheading}>Transparent one-time investments with zero monthly platform lock-in.</p>
          </div>

          {/* Market ROI Callout */}
          <div style={styles.roiBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
              <Icons.TrendingUp />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#34d399' }}>Verified Industry Benchmark</span>
            </div>
            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0 }}>
              Businesses launching a dedicated site report earning an average of <strong>39% more revenue</strong> and grow <strong>2.8x faster</strong>.
            </p>
          </div>

          {/* Concise Plan Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px' }}>
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                style={{
                  ...styles.pricingCard,
                  borderColor: plan.highlight ? '#38bdf8' : '#1e293b',
                  backgroundColor: plan.highlight ? 'rgba(30, 58, 138, 0.35)' : 'rgba(15, 23, 42, 0.7)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={plan.highlight ? styles.popularBadge : styles.tierBadge}>{plan.badge}</span>
                    <h3 style={{ fontSize: '15px', fontWeight: '800', margin: '4px 0 0 0', color: '#f8fafc' }}>{plan.name}</h3>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '22px', fontWeight: '800', color: '#38bdf8' }}>{plan.price}</span>
                    <span style={{ fontSize: '9px', color: '#94a3b8', display: 'block' }}>one-time</span>
                  </div>
                </div>

                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '4px 0 6px 0' }}>{plan.tagline}</p>

                <div style={styles.conciseBulletList}>
                  {plan.features.map((feat, i) => (
                    <div key={i} style={styles.conciseBulletItem}>
                      <Icons.CheckCircle />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                <button
                  style={plan.highlight ? styles.primaryBtn : styles.secondaryBtn}
                  onClick={() => {
                    updateField('tier', plan.name);
                    setSelectedTier(plan.name);
                    setMode('questionnaire');
                  }}
                >
                  Choose {plan.name} →
                </button>
              </div>
            ))}
          </div>

          <button style={styles.backBtn} onClick={() => setMode('landing')}>
            ← Back to Home
          </button>
        </div>
      </main>
    );
  }

  // --- VIEW: QUESTIONNAIRE ---
  if (mode === 'questionnaire') {
    return (
      <main style={{ ...styles.container, background: getDynamicBackground() }}>
        <div style={styles.card}>
          <div style={styles.progressBarContainer}>
            <div style={{ ...styles.progressBar, width: `${(step / 6) * 100}%` }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <span style={styles.stepLabel}>Step {step} of 6</span>
            <span style={styles.selectedTierBadge}>{formData.tier}</span>
          </div>

          {step === 1 && (
            <div>
              <h3 style={styles.questionTitle}>1. What type of website is this for?</h3>
              {['B2B Enterprise & Logistics', 'Artisan Retail & Goods', 'Deep-Tech & Automation', 'Healthcare & Wellness', 'Creator / Portfolio Hub'].map((item) => (
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
              {['Capture Customer Inquiries & Leads', 'Sell Products / Merchandise', 'Showcase Visual Work & Portfolio', 'Build Brand Trust & Reputation'].map((item) => (
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
              <h3 style={styles.questionTitle}>3. What style fits best?</h3>
              {['Clean & Minimal', 'Bold & Editorial', 'Dark & High-Tech', 'Warm & Organic'].map((item) => (
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
              <h3 style={styles.questionTitle}>4. What key feature do you need most?</h3>
              {['Appointment Booking Calendar', 'Lead Inquiry & Contact Form', 'Interactive Catalog Gallery', 'Client Login & Member Portal'].map((item) => (
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
              <h3 style={styles.questionTitle}>5. Do you already have a logo and domain?</h3>
              {['Yes, logo and domain are ready', 'I have a logo, but need a custom domain', 'I am starting from scratch and need both'].map((item) => (
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
              <h3 style={styles.questionTitle}>6. Where should we send your project details?</h3>
              <input
                style={styles.input}
                placeholder="Your Full Name"
                required
                value={formData.fullName}
                onChange={(e) => updateField('fullName', e.target.value)}
              />
              <input
                style={styles.input}
                placeholder="Your Business or Brand Name"
                required
                value={formData.businessName}
                onChange={(e) => updateField('businessName', e.target.value)}
              />
              <input
                style={styles.input}
                type="email"
                placeholder="Your Email Address"
                required
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
              <input
                style={styles.input}
                type="tel"
                placeholder="Mobile Phone (for SMS updates)"
                required
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
              <button type="submit" style={styles.primaryBtn}>
                Submit & Request Invoice ({formData.tier})
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

  // --- VIEW: RESPONSIVE LANDING HOME PAGE ---
  return (
    <main style={{ ...styles.container, background: getDynamicBackground() }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatSlow { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-8px); } }
        @keyframes ambientGlow { 0%, 100% { transform: scale(1); opacity: 0.4; } 50% { transform: scale(1.15); opacity: 0.7; } }
        .glow-orb-main { animation: ambientGlow 9s ease-in-out infinite; }

        .platform-shell {
          display: flex;
          flex-direction: column;
          gap: 20px;
          width: 100%;
          max-width: 460px;
          z-index: 4;
        }

        @media (min-width: 1024px) {
          .platform-shell {
            display: grid;
            grid-template-columns: 460px 1fr;
            max-width: 1140px;
            align-items: start;
            gap: 32px;
          }
        }
      `}} />

      <div className="glow-orb-main" style={styles.glowOrb1} />

      <div className="platform-shell">
        {/* LEFT COLUMN: Funnel Controls */}
        <div style={styles.cardRelative}>
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <h1 style={styles.brandTitleText}>
              LaunchSeven <span style={{ color: '#38bdf8', fontWeight: '300' }}>Studio</span>
            </h1>
            <p style={styles.brandSubheading}>Custom websites delivered in 7 days with full personal control.</p>
          </div>

          <div style={styles.deliveryClockPill}>
            <span style={{ color: '#38bdf8', fontWeight: '700' }}>⚡ Ready by {deliveryDate || 'Next Week'}</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ color: '#94a3b8' }}>3 of 5 sprint spots left</span>
          </div>

          <div style={styles.buttonGroup}>
            <button style={styles.primaryBtn} onClick={() => setMode('questionnaire')}>
              Build My Website Now
            </button>

            <button style={styles.pricingBtn} onClick={() => setMode('pricing')}>
              🏷 Full Website Starting at $449
            </button>

            <button style={styles.portfolioBtn} onClick={() => setMode('portfolio')}>
              <Icons.Eye />
              <span>Real-World Portfolios & Layouts</span>
            </button>

            <button style={styles.creatorBtn} onClick={() => setMode('creator_brand')}>
              <Icons.Sparkles />
              <span>For Creators & Brand Catalogs</span>
            </button>
          </div>

          <div style={styles.roadmapBox}>
            <h4 style={styles.roadmapTitle}>HOW YOUR 7 DAYS WORK</h4>
            <div style={styles.roadmapGrid}>
              <div style={styles.roadmapStep}>
                <span style={styles.stepNum}>1</span>
                <div><strong>Intake (2 min)</strong><p>Pick layout & goals</p></div>
              </div>
              <div style={styles.roadmapStep}>
                <span style={styles.stepNum}>2</span>
                <div><strong>Checkout</strong><p>Unlocks 7-day clock</p></div>
              </div>
              <div style={styles.roadmapStep}>
                <span style={styles.stepNum}>3</span>
                <div><strong>Day 3 Preview</strong><p>Live staging review</p></div>
              </div>
              <div style={styles.roadmapStep}>
                <span style={styles.stepNum}>4</span>
                <div><strong>Day 7 Launch</strong><p>Live DNS & handoff</p></div>
              </div>
            </div>
          </div>

          <div style={styles.ownershipBadge}>
            <Icons.ShieldCheck />
            <span>100% Code & Content Ownership • Zero Lock-In</span>
          </div>

          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <button style={styles.shareBtn} onClick={handleShare}>
              <Icons.Share />
              <span>Share with friends & family</span>
            </button>
            {shareNotice && (
              <p style={{ fontSize: '11px', color: '#34d399', margin: '4px 0 0 0' }}>
                ✓ Website link copied to clipboard!
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive Preview */}
        <div style={styles.previewCanvasContainer}>
          <div style={styles.previewControlBar}>
            <div style={styles.categoryScroll}>
              {portfolioProjects.map((p, idx) => (
                <button
                  key={p.brand}
                  style={activePortfolioIndex === idx ? styles.catTabActive : styles.catTab}
                  onClick={() => setActivePortfolioIndex(idx)}
                >
                  {p.businessType}
                </button>
              ))}
            </div>

            <div style={styles.deviceToggleGroup}>
              <button
                style={previewDevice === 'desktop' ? styles.deviceBtnActive : styles.deviceBtn}
                onClick={() => setPreviewDevice('desktop')}
                title="Desktop View"
              >
                <Icons.Laptop />
              </button>
              <button
                style={previewDevice === 'mobile' ? styles.deviceBtnActive : styles.deviceBtn}
                onClick={() => setPreviewDevice('mobile')}
                title="Mobile View"
              >
                <Icons.Smartphone />
              </button>
            </div>
          </div>

          <div style={previewDevice === 'mobile' ? styles.mobileFrameWrapper : styles.desktopFrameWrapper}>
            <div style={styles.browserHeader}>
              <div style={styles.browserDots}>
                <span style={{ ...styles.dot, backgroundColor: '#ef4444' }} />
                <span style={{ ...styles.dot, backgroundColor: '#eab308' }} />
                <span style={{ ...styles.dot, backgroundColor: '#22c55e' }} />
              </div>
              <div style={styles.browserUrlPill}>
                preview.{activeProject.brand.toLowerCase().replace(/\s+/g, '')}.com
              </div>
              <span style={{ fontSize: '10px', color: activeProject.accentColor, fontWeight: '700' }}>
                LIVE PREVIEW
              </span>
            </div>

            <div style={styles.mockupHeroContainer}>
              <img src={activeProject.heroImage} alt={activeProject.brand} style={styles.mockupImage} />
              <div style={styles.mockupHeroOverlay} />
              <div style={styles.mockupHeroContent}>
                <span style={{ ...styles.mockupBadge, borderColor: activeProject.accentColor, color: activeProject.accentColor }}>
                  {activeProject.badge}
                </span>
                <h3 style={styles.mockupHeading}>{activeProject.brand}</h3>
                <p style={styles.mockupSubtext}>{activeProject.tagline}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button style={{ ...styles.mockupActionBtn, backgroundColor: activeProject.accentColor }}>
                    {activeProject.actionCta}
                  </button>
                  <button style={styles.mockupSecondaryBtn}>
                    Learn More
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.mockupStatsBar}>
              {activeProject.stats.map((stat, i) => (
                <span key={i} style={styles.mockupStatItem}>
                  ✓ {stat}
                </span>
              ))}
            </div>
          </div>

          <div style={styles.foundationSpeedBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Icons.SpeedDelivery />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#38bdf8' }}>
                Base {activeProject.businessType} Ready in 24 Hours
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>
              Your custom staging layout is ready within 24 hours of payment. You have full freedom to modify copy, colors, and media inside My Site Manager.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

const styles = {
  container: { position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', overflowX: 'hidden', transition: 'background 0.5s ease' },

  // Ambient Vibrant Orbs
  glowOrb1: { position: 'fixed', top: '-10%', left: '-10%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.35) 0%, rgba(37,99,235,0) 70%)', pointerEvents: 'none', zIndex: 1 },
  vibrantOrbPink: { position: 'fixed', top: '10%', right: '-10%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(219,39,119,0.35) 0%, rgba(219,39,119,0) 70%)', pointerEvents: 'none', zIndex: 1 },
  vibrantOrbPurple: { position: 'fixed', bottom: '-10%', left: '10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(147,51,234,0.3) 0%, rgba(147,51,234,0) 70%)', pointerEvents: 'none', zIndex: 1 },
  vibrantOrbCyan: { position: 'fixed', top: '-10%', right: '10%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.3) 0%, rgba(6,182,212,0) 70%)', pointerEvents: 'none', zIndex: 1 },
  vibrantOrbEmerald: { position: 'fixed', bottom: '-10%', left: '-5%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.25) 0%, rgba(16,185,129,0) 70%)', pointerEvents: 'none', zIndex: 1 },

  // Glassmorphic Shells
  cardRelative: { position: 'relative', zIndex: 4, backgroundColor: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', width: '100%', borderRadius: '18px', padding: '24px 20px', color: '#f8fafc', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.1)', boxSizing: 'border-box' },
  card: { position: 'relative', zIndex: 4, backgroundColor: '#1e293b', width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '24px', color: '#f8fafc', boxShadow: '0 15px 35px rgba(0,0,0,0.6)', boxSizing: 'border-box' },

  brandTitleText: { fontSize: '28px', fontWeight: '800', letterSpacing: '-0.8px', margin: '0 0 4px 0', background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  brandSubheading: { fontSize: '13px', color: '#94a3b8', margin: '0 0 14px 0', lineHeight: '1.45' },
  deliveryClockPill: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '11px', backgroundColor: '#0f172acc', padding: '8px 12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #1e293b' },

  buttonGroup: { display: 'flex', flexDirection: 'column', gap: '9px' },
  primaryBtn: { width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
  pricingBtn: { width: '100%', padding: '12px', backgroundColor: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '10px', fontWeight: '700', fontSize: '13px', cursor: 'pointer' },
  portfolioBtn: { width: '100%', padding: '12px', backgroundColor: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8', border: '1px solid #0891b2', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  creatorBtn: { width: '100%', padding: '12px', backgroundColor: 'rgba(236, 72, 153, 0.12)', color: '#f472b6', border: '1px solid #db2777', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  secondaryBtn: { width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },

  // Roadmap & Badges
  roadmapBox: { backgroundColor: '#0b1120', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px', marginTop: '16px' },
  roadmapTitle: { fontSize: '10px', letterSpacing: '1px', fontWeight: '800', color: '#64748b', margin: '0 0 10px 0' },
  roadmapGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' },
  roadmapStep: { display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '11px', color: '#cbd5e1' },
  stepNum: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '10px', fontWeight: '700', flexShrink: 0 },
  ownershipBadge: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8', marginTop: '12px' },
  shareBtn: { background: 'none', border: 'none', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', padding: '4px' },

  // Preview Canvas
  previewCanvasContainer: { backgroundColor: 'rgba(15, 23, 42, 0.88)', backdropFilter: 'blur(22px)', borderRadius: '18px', padding: '18px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.85)' },
  previewControlBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' },
  categoryScroll: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  catTab: { padding: '6px 10px', backgroundColor: '#0b1120', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer' },
  catTabActive: { padding: '6px 10px', backgroundColor: '#2563eb', color: '#ffffff', border: '1px solid #38bdf8', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  deviceToggleGroup: { display: 'flex', backgroundColor: '#0b1120', borderRadius: '6px', border: '1px solid #1e293b', padding: '2px' },
  deviceBtn: { background: 'none', border: 'none', color: '#64748b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  deviceBtnActive: { backgroundColor: '#1e293b', border: 'none', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' },

  desktopFrameWrapper: { backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' },
  mobileFrameWrapper: { backgroundColor: '#0f172a', borderRadius: '22px', border: '4px solid #334155', maxWidth: '310px', margin: '0 auto', overflow: 'hidden' },
  browserHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' },
  browserDots: { display: 'flex', gap: '5px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%' },
  browserUrlPill: { backgroundColor: '#0f172a', color: '#94a3b8', fontSize: '10px', padding: '2px 10px', borderRadius: '4px', border: '1px solid #334155' },

  mockupHeroContainer: { position: 'relative', height: '230px', overflow: 'hidden' },
  mockupImage: { width: '100%', height: '100%', objectFit: 'cover' },
  mockupHeroOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to top, rgba(15,23,42,0.95) 20%, rgba(15,23,42,0.3) 100%)' },
  mockupHeroContent: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  mockupBadge: { fontSize: '9px', fontWeight: '800', padding: '2px 6px', borderRadius: '4px', border: '1px solid', letterSpacing: '0.5px' },
  mockupHeading: { fontSize: '17px', fontWeight: '800', margin: '4px 0 2px 0', color: '#ffffff' },
  mockupSubtext: { fontSize: '11px', color: '#cbd5e1', margin: 0 },
  mockupActionBtn: { padding: '6px 12px', color: '#ffffff', border: 'none', borderRadius: '5px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  mockupSecondaryBtn: { padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '5px', fontSize: '11px', fontWeight: '600' },
  mockupStatsBar: { display: 'flex', justifyContent: 'space-around', padding: '9px', backgroundColor: '#0b1120', borderTop: '1px solid #1e293b' },
  mockupStatItem: { fontSize: '10px', color: '#38bdf8', fontWeight: '600' },
  foundationSpeedBox: { backgroundColor: 'rgba(6, 78, 59, 0.25)', border: '1px solid #059669', borderRadius: '8px', padding: '12px', marginTop: '14px' },

  // Creator Page Styles
  creatorPill: { fontSize: '10px', letterSpacing: '1px', fontWeight: '800', color: '#f472b6', backgroundColor: 'rgba(190, 24, 93, 0.25)', padding: '4px 10px', borderRadius: '999px', border: '1px solid rgba(219, 39, 119, 0.5)', display: 'inline-block' },
  creatorGrid: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  creatorCard: { padding: '12px', backgroundColor: 'rgba(15, 23, 42, 0.75)', borderRadius: '10px', border: '1px solid #334155' },
  creatorCardTitle: { fontSize: '13px', fontWeight: '700', margin: '0 0 3px 0' },
  creatorCardText: { fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' },

  // Portfolio Page Styles
  portfolioBadge: { fontSize: '10px', letterSpacing: '1px', fontWeight: '800', color: '#38bdf8', backgroundColor: 'rgba(6, 182, 212, 0.2)', padding: '4px 10px', borderRadius: '999px', border: '1px solid #0891b2', display: 'inline-block' },
  portfolioTabs: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' },
  portfolioTab: { padding: '6px 10px', backgroundColor: '#0f172a', color: '#94a3b8', border: '1px solid #334155', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer' },
  portfolioTabActive: { padding: '6px 10px', backgroundColor: '#0284c7', color: '#ffffff', border: '1px solid #38bdf8', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  portfolioPreviewBox: { backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden' },
  portfolioHero: { position: 'relative', height: '260px', overflow: 'hidden' },
  portfolioHeroImg: { width: '100%', height: '100%', objectFit: 'cover' },
  portfolioHeroOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to top, rgba(15,23,42,0.95) 25%, rgba(15,23,42,0.3) 100%)' },
  portfolioHeroDetails: { position: 'absolute', bottom: 14, left: 14, right: 14 },
  portfolioHeroTitle: { fontSize: '19px', fontWeight: '800', margin: '4px 0 2px 0', color: '#ffffff' },
  portfolioHeroSub: { fontSize: '12px', color: '#cbd5e1', margin: 0 },
  portfolioStatsRow: { display: 'flex', justifyContent: 'space-around', padding: '10px', backgroundColor: '#0b1120', borderTop: '1px solid #1e293b', flexWrap: 'wrap', gap: '6px' },
  portfolioLayoutNote: { padding: '8px 12px', backgroundColor: '#060a14', fontSize: '11px', color: '#94a3b8', borderTop: '1px solid #1e293b' },

  // Concise Pricing Styles
  roiBanner: { backgroundColor: 'rgba(6, 78, 59, 0.25)', border: '1px solid #059669', borderRadius: '8px', padding: '10px', marginBottom: '12px' },
  pricingCard: { padding: '12px 14px', borderRadius: '10px', border: '1px solid #334155' },
  conciseBulletList: { display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '4px', margin: '8px 0 10px 0' },
  conciseBulletItem: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#cbd5e1' },
  tierBadge: { fontSize: '9px', fontWeight: '700', color: '#94a3b8', backgroundColor: '#334155', padding: '2px 6px', borderRadius: '4px' },
  popularBadge: { fontSize: '9px', fontWeight: '800', color: '#38bdf8', backgroundColor: 'rgba(3, 105, 161, 0.3)', padding: '2px 6px', borderRadius: '4px', border: '1px solid #0284c7' },

  // Form & General Styles
  title: { fontSize: '22px', fontWeight: '800', marginBottom: '6px', textAlign: 'center', letterSpacing: '-0.5px' },
  badge: { fontSize: '10px', letterSpacing: '1px', fontWeight: '700', color: '#38bdf8', backgroundColor: 'rgba(2, 132, 199, 0.2)', padding: '4px 10px', borderRadius: '999px', border: '1px solid rgba(2, 132, 199, 0.4)', display: 'inline-block' },
  selectedTierBadge: { fontSize: '11px', fontWeight: '600', color: '#38bdf8', backgroundColor: 'rgba(2, 132, 199, 0.2)', padding: '2px 8px', borderRadius: '4px' },
  questionTitle: { fontSize: '15px', fontWeight: '600', marginBottom: '14px' },
  optionBtn: { width: '100%', padding: '11px', backgroundColor: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', textAlign: 'left', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' },
  selectedOption: { width: '100%', padding: '11px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', textAlign: 'left', marginBottom: '8px', fontSize: '13px', cursor: 'pointer' },
  input: { width: '100%', padding: '11px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', marginBottom: '10px', boxSizing: 'border-box' },
  backBtn: { background: 'none', border: 'none', color: '#94a3b8', marginTop: '12px', cursor: 'pointer', fontSize: '13px', width: '100%', textAlign: 'center' },
  progressBarContainer: { height: '4px', backgroundColor: '#334155', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#2563eb', transition: 'width 0.3s' },
  stepLabel: { fontSize: '12px', color: '#94a3b8' },
  alertBox: { backgroundColor: '#1e1b4b', border: '1px solid #4338ca', padding: '14px', borderRadius: '8px', marginTop: '14px', marginBottom: '14px' },
  alertTitle: { fontSize: '13px', fontWeight: 'bold', color: '#a5b4fc', margin: '0 0 4px 0' },
  alertText: { fontSize: '12px', color: '#c7d2fe', margin: 0, lineHeight: '1.4' },
  text: { fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5' }
};
