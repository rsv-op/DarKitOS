

'use client';

import React, { useState, useEffect } from 'react';

// Custom SVG Icons
const Icons = {
  SpeedDelivery: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  SiteManager: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  ColorPalette: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ec4899" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13.5" cy="6.5" r=".5" fill="#ec4899" />
      <circle cx="17.5" cy="10.5" r=".5" fill="#ec4899" />
      <circle cx="8.5" cy="7.5" r=".5" fill="#ec4899" />
      <circle cx="6.5" cy="12.5" r=".5" fill="#ec4899" />
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.563-2.512 5.563-5.563C22 6.5 17.5 2 12 2z" />
    </svg>
  ),
  OmnichannelBell: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  CheckCircle: () => (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Lock: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  TrendingUp: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Share: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  ),
  Sparkles: () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    </svg>
  ),
  Laptop: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  Smartphone: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  ShieldCheck: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  )
};

export default function LaunchSevenApp() {
  const [mode, setMode] = useState('landing');
  const [step, setStep] = useState(1);
  const [selectedTemplateType, setSelectedTemplateType] = useState('Service Business');
  const [selectedTier, setSelectedTier] = useState('Growth Engine');
  const [previewDevice, setPreviewDevice] = useState('desktop');
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

  // Compute exact 7-day launch date dynamically
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
          text: 'Get a custom, professional website launched in 7 days with full personal control!',
          url: window.location.href,
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(window.location.href);
      setShareNotice(true);
      setTimeout(() => setShareNotice(false), 3000);
    }
  };

  const templatePreviews = {
    'Service Business': {
      title: 'Vance Advisory & Partners',
      tagline: 'Strategic Advisory & Enterprise Consulting',
      heroImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80',
      accentColor: '#2563eb',
      buttonText: 'Book Strategy Call',
      badge: 'CONSULTING & B2B',
      stats: ['99.4% Client Retention', '$48M Portfolio Value']
    },
    'E-Commerce Store': {
      title: 'Aura Modern Living',
      tagline: 'Curated Minimalist Goods & Decor',
      heroImage: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=800&q=80',
      accentColor: '#ec4899',
      buttonText: 'Shop New Arrivals',
      badge: 'RETAIL & COMMERCE',
      stats: ['Free 2-Day Shipping', '4.9★ Customer Rating']
    },
    'Portfolio & Agency': {
      title: 'Kinesis Creative Lab',
      tagline: 'Brand Identity & Visual Direction',
      heroImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=800&q=80',
      accentColor: '#818cf8',
      buttonText: 'View Selected Works',
      badge: 'CREATIVE & DIGITAL',
      stats: ['14 Design Awards', 'Over 80 Case Studies']
    },
    'Clinic & Wellness': {
      title: 'Lumina Integrative Health',
      tagline: 'Modern Medicine & Holistic Care',
      heroImage: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80',
      accentColor: '#10b981',
      buttonText: 'Schedule Appointment',
      badge: 'HEALTHCARE & WELLNESS',
      stats: ['Same-Day Intake', 'Board-Certified Care']
    }
  };

  const currentPreview = templatePreviews[selectedTemplateType];

  const pricingTiers = [
    {
      name: 'Starter Launch',
      price: '$449',
      period: 'one-time investment',
      tagline: 'Ideal for local businesses and personal brands establishing their web presence.',
      badge: 'FOUNDATION',
      roiNote: 'Captures the 81% of shoppers researching online before visiting.',
      features: [
        'Guaranteed 7-day turnaround',
        'Mobile-first responsive engineering',
        'My Site Manager: Text & Color editing',
        'Lead capture & inquiry forms',
        'SSL certificate & high-speed cloud setup',
        '100% Code & Content Ownership'
      ],
      highlight: false
    },
    {
      name: 'Growth Engine',
      price: '$749',
      period: 'one-time investment',
      tagline: 'Engineered for rapid lead generation, bookings, and customer expansion.',
      badge: 'MOST POPULAR',
      roiNote: 'Unlocks the 2.8x revenue growth rate seen with active web presence.',
      features: [
        'Everything in Starter Launch',
        'Full My Site Manager: Image & CDN media studio',
        'Online booking or multi-section service gallery',
        'Automated SMS & voice milestone notifications',
        'Local SEO & Google search optimization',
        'Direct Social & Portfolio Hub Integration'
      ],
      highlight: true
    },
    {
      name: 'Scale Pro',
      price: '$1,049',
      period: 'one-time investment',
      tagline: 'Full enterprise capabilities with ongoing flexible modifications.',
      badge: 'UNLIMITED REVISIONS',
      roiNote: 'Engineered for businesses targeting up to 39%+ sales expansion.',
      features: [
        'Dynamic multi-page architecture',
        'UNLIMITED modulation & update requests',
        'VIP priority staging deployment',
        'AI progress tracking assistant',
        'High-speed conversion optimization',
        'Custom Domain & Brand Email Setup'
      ],
      highlight: false
    }
  ];

  // --- SUBMISSION CONFIRMATION VIEW ---
  if (submitted) {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <h2 style={styles.title}>You are almost there!</h2>
          <p style={styles.text}>
            Thank you, <strong>{formData.fullName}</strong>. We have logged your <strong>{formData.tier}</strong> package details with LaunchSeven Studio for <strong>{formData.businessName}</strong>.
          </p>
          <div style={styles.alertBox}>
            <p style={styles.alertTitle}>Next Step: Payment Confirmation</p>
            <p style={styles.alertText}>
              To protect your spot on our build calendar, our <strong>7-day delivery clock</strong> starts as soon as payment is confirmed. 
              We have sent a copy of your receipt and project link to <strong>{formData.email}</strong>.
            </p>
          </div>
          <button style={styles.primaryBtn} onClick={() => alert(`Redirecting to secure checkout for ${formData.tier}...`)}>
            Complete Payment & Start Build
          </button>
        </div>
      </main>
    );
  }

  // --- VIEW: CREATOR BRAND & SOCIAL CATALOG ---
  if (mode === 'creator_brand') {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={styles.creatorPill}>✨ CREATORS, ARTISTS & PERSONAL BRANDS</span>
            <h2 style={{ ...styles.title, marginTop: '8px' }}>Own Your Brand Hub</h2>
            <p style={styles.subtitle}>Stop sending followers to plain link trees. Launch a custom website catalog with your own custom domain.</p>
          </div>

          <div style={styles.creatorGrid}>
            <div style={styles.creatorCard}>
              <h4 style={styles.creatorCardTitle}>📸 Visual Catalog & Portfolio</h4>
              <p style={styles.creatorCardText}>Showcase your photography, designs, or products in full HD with interactive image popups.</p>
            </div>
            <div style={styles.creatorCard}>
              <h4 style={styles.creatorCardTitle}>🔗 Smart Social Hub</h4>
              <p style={styles.creatorCardText}>Combine your TikTok, Instagram, YouTube, and podcast links in one custom branded page you own.</p>
            </div>
            <div style={styles.creatorCard}>
              <h4 style={styles.creatorCardTitle}>💼 Media Kit & Inquiries</h4>
              <p style={styles.creatorCardText}>A direct form for brand sponsorships, event bookings, and client inquiries without middleman fees.</p>
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

  // --- VIEW: PRICING & MARKET ROI ---
  if (mode === 'pricing') {
    return (
      <main style={styles.container}>
        <div style={{ ...styles.card, maxWidth: '580px' }}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={styles.badge}>TRANSPARENT PRICING</span>
            <h2 style={{ ...styles.title, marginTop: '8px' }}>Full Website Starting at $449</h2>
            <p style={styles.subtitle}>No hidden agency retainers. Pick the right package for your exact goals.</p>
          </div>

          {/* Market ROI Banner */}
          <div style={styles.roiBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Icons.TrendingUp />
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#34d399' }}>Industry Market Research</span>
            </div>
            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
              Businesses with a dedicated website report earning an average of <strong>39% more revenue</strong> and are <strong>2.8x more likely to grow</strong> compared to offline competitors.
            </p>
          </div>

          {/* Pricing Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                style={{
                  ...styles.pricingCard,
                  borderColor: tier.highlight ? '#38bdf8' : '#334155',
                  backgroundColor: tier.highlight ? 'rgba(30, 58, 138, 0.28)' : '#0f172a'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={tier.highlight ? styles.popularBadge : styles.tierBadge}>{tier.badge}</span>
                    <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '6px 0 2px 0', color: '#f8fafc' }}>{tier.name}</h3>
                    <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0 }}>{tier.tagline}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '22px', fontWeight: '800', color: '#38bdf8' }}>{tier.price}</span>
                    <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block' }}>{tier.period}</span>
                  </div>
                </div>

                <div style={styles.roiTag}>
                  ⚡ {tier.roiNote}
                </div>

                <ul style={styles.tierList}>
                  {tier.features.map((feat, i) => (
                    <li key={i} style={styles.tierItem}>
                      <Icons.CheckCircle />
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>

                <button
                  style={tier.highlight ? styles.primaryBtn : styles.secondaryBtn}
                  onClick={() => {
                    updateField('tier', tier.name);
                    setSelectedTier(tier.name);
                    setMode('questionnaire');
                  }}
                >
                  Select {tier.name} →
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
      <main style={styles.container}>
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
              {['Professional Services & Business', 'E-Commerce / Online Store', 'Creator / Portfolio / Social Links', 'Clinic & Wellness'].map((item) => (
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
              <h3 style={styles.questionTitle}>2. What is your primary goal?</h3>
              {['Get New Customer Inquiries', 'Sell Products or Content', 'Showcase My Portfolio & Links', 'Build Trust & Brand Reputation'].map((item) => (
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
              {['Clean & Simple', 'Bold & Editorial', 'Dark & High-Tech', 'Warm & Creative'].map((item) => (
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
              {['Online Booking / Calendar', 'Customer Contact Form', 'Photo / Work Catalog & Links', 'Member Login / Portal'].map((item) => (
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
              {['Yes, I have my logo and domain name ready', 'I have a logo, but need a custom domain', 'I am starting from scratch and need both'].map((item) => (
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
                placeholder="Mobile Phone (for text updates)"
                required
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
              <button type="submit" style={styles.primaryBtn}>
                Submit & View Invoice ({formData.tier})
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

  // --- VIEW: RESPONSIVE LANDING HOME PAGE (MOBILE + DESKTOP ADAPTIVE) ---
  return (
    <main style={styles.container}>
      {/* Dynamic Keyframe & Responsive Media Query Rules */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatSlow {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes ambientGlow {
          0%, 100% { transform: scale(1); opacity: 0.35; }
          50% { transform: scale(1.15); opacity: 0.6; }
        }
        .glow-orb-1 { animation: ambientGlow 9s ease-in-out infinite; }
        .glow-orb-2 { animation: ambientGlow 12s ease-in-out infinite reverse; }
        .drift-window { animation: floatSlow 6s ease-in-out infinite; }

        /* Responsive Layout Grid: 1 column on Mobile, 2 columns on Desktop */
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

      {/* Ambient Organic Light Orbs */}
      <div className="glow-orb-1" style={styles.glowOrb1} />
      <div className="glow-orb-2" style={styles.glowOrb2} />

      {/* Dynamic Responsive Container */}
      <div className="platform-shell">

        {/* LEFT COLUMN: Controls & Funnel Engine */}
        <div style={styles.cardRelative}>
          {/* Brand Header */}
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <h1 style={styles.brandTitleText}>
              LaunchSeven <span style={{ color: '#38bdf8', fontWeight: '300' }}>Studio</span>
            </h1>
            <p style={styles.brandSubheading}>Custom websites launched in 7 days with full personal control.</p>
          </div>

          {/* Dynamic 7-Day Live Launch Date Pill */}
          <div style={styles.deliveryClockPill}>
            <span style={{ color: '#38bdf8', fontWeight: '700' }}>⚡ Ready by {deliveryDate || 'Next Week'}</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ color: '#94a3b8' }}>3 of 5 sprint spots left</span>
          </div>

          {/* Core Action Button Navigation */}
          <div style={styles.buttonGroup}>
            <button style={styles.primaryBtn} onClick={() => setMode('questionnaire')}>
              Build My Website Now
            </button>

            {/* Rewritten Pricing Element */}
            <button style={styles.pricingBtn} onClick={() => setMode('pricing')}>
              🏷 Full Website Starting at $449
            </button>

            {/* Creator / Portfolio Catalog Hub */}
            <button style={styles.creatorBtn} onClick={() => setMode('creator_brand')}>
              <Icons.Sparkles />
              <span>For Creators & Brand Catalogs</span>
            </button>
          </div>

          {/* 4-Step "What Happens Next" Roadmap */}
          <div style={styles.roadmapBox}>
            <h4 style={styles.roadmapTitle}>HOW YOUR 7 DAYS WORK</h4>
            <div style={styles.roadmapGrid}>
              <div style={styles.roadmapStep}>
                <span style={styles.stepNum}>1</span>
                <div>
                  <strong>Intake (2 min)</strong>
                  <p>Pick layout & goals</p>
                </div>
              </div>
              <div style={styles.roadmapStep}>
                <span style={styles.stepNum}>2</span>
                <div>
                  <strong>Checkout</strong>
                  <p>Unlocks 7-day clock</p>
                </div>
              </div>
              <div style={styles.roadmapStep}>
                <span style={styles.stepNum}>3</span>
                <div>
                  <strong>Day 3 Preview</strong>
                  <p>Live staging review</p>
                </div>
              </div>
              <div style={styles.roadmapStep}>
                <span style={styles.stepNum}>4</span>
                <div>
                  <strong>Day 7 Launch</strong>
                  <p>Live DNS & handoff</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ownership & Zero Lock-In Guarantee Badge */}
          <div style={styles.ownershipBadge}>
            <Icons.ShieldCheck />
            <span>100% Code & Content Ownership • No Lock-In</span>
          </div>

          {/* Share with Friends & Family */}
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

        {/* RIGHT COLUMN: Interactive Live Showcase & Viewport Tester */}
        <div style={styles.previewCanvasContainer}>
          {/* Top Bar with Template Category Tabs & Device Switcher */}
          <div style={styles.previewControlBar}>
            {/* Category Selector */}
            <div style={styles.categoryScroll}>
              {['Service Business', 'E-Commerce Store', 'Portfolio & Agency', 'Clinic & Wellness'].map((type) => (
                <button
                  key={type}
                  style={selectedTemplateType === type ? styles.catTabActive : styles.catTab}
                  onClick={() => setSelectedTemplateType(type)}
                >
                  {type}
                </button>
              ))}
            </div>

            {/* Desktop vs Mobile Switcher */}
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

          {/* Rendered Browser or Phone Mockup */}
          <div style={previewDevice === 'mobile' ? styles.mobileFrameWrapper : styles.desktopFrameWrapper}>
            {/* Browser Header Bar */}
            <div style={styles.browserHeader}>
              <div style={styles.browserDots}>
                <span style={{ ...styles.dot, backgroundColor: '#ef4444' }} />
                <span style={{ ...styles.dot, backgroundColor: '#eab308' }} />
                <span style={{ ...styles.dot, backgroundColor: '#22c55e' }} />
              </div>
              <div style={styles.browserUrlPill}>
                preview.{selectedTemplateType.toLowerCase().replace(/\s+/g, '')}.com
              </div>
              <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: '600' }}>LIVE PREVIEW</span>
            </div>

            {/* Mockup Canvas */}
            <div style={styles.mockupHeroContainer}>
              <img src={currentPreview.heroImage} alt={currentPreview.title} style={styles.mockupImage} />
              <div style={styles.mockupHeroOverlay} />
              <div style={styles.mockupHeroContent}>
                <span style={{ ...styles.mockupBadge, backgroundColor: `${currentPreview.accentColor}33`, borderColor: currentPreview.accentColor }}>
                  {currentPreview.badge}
                </span>
                <h3 style={styles.mockupHeading}>{currentPreview.title}</h3>
                <p style={styles.mockupSubtext}>{currentPreview.tagline}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                  <button style={{ ...styles.mockupActionBtn, backgroundColor: currentPreview.accentColor }}>
                    {currentPreview.buttonText}
                  </button>
                  <button style={styles.mockupSecondaryBtn}>
                    Learn More
                  </button>
                </div>
              </div>
            </div>

            {/* Mockup Features / Proof Points */}
            <div style={styles.mockupStatsBar}>
              {currentPreview.stats.map((stat, i) => (
                <span key={i} style={styles.mockupStatItem}>
                  ✓ {stat}
                </span>
              ))}
            </div>
          </div>

          {/* Base Foundation 24-Hour Note */}
          <div style={styles.foundationSpeedBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Icons.CheckCircle />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#34d399' }}>
                Base {selectedTemplateType} Foundation Ready in 24 Hours
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>
              We deploy this responsive layout and color system to your private portal within 24 hours of kickoff, letting you adjust copy and colors with My Site Manager.
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}

const styles = {
  container: { position: 'relative', minHeight: '100vh', backgroundColor: '#050811', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', overflowX: 'hidden' },

  // Ambient Glow Orbs
  glowOrb1: { position: 'fixed', top: '-10%', left: '-10%', width: '450px', height: '450px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(37,99,235,0.3) 0%, rgba(37,99,235,0) 70%)', pointerEvents: 'none', zIndex: 1 },
  glowOrb2: { position: 'fixed', bottom: '-15%', right: '-10%', width: '500px', height: '500px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(236,72,153,0.2) 0%, rgba(236,72,153,0) 70%)', pointerEvents: 'none', zIndex: 1 },

  // Left Card
  cardRelative: { 
    position: 'relative', 
    backgroundColor: 'rgba(21, 30, 48, 0.88)', 
    backdropFilter: 'blur(20px)', 
    WebkitBackdropFilter: 'blur(20px)',
    width: '100%', 
    borderRadius: '18px', 
    padding: '24px 20px', 
    color: '#f8fafc', 
    boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.1)', 
    boxSizing: 'border-box' 
  },
  card: { position: 'relative', zIndex: 4, backgroundColor: '#1e293b', width: '100%', maxWidth: '440px', borderRadius: '16px', padding: '24px', color: '#f8fafc', boxShadow: '0 15px 35px rgba(0,0,0,0.6)', boxSizing: 'border-box' },

  // Brand Typography
  brandTitleText: { 
    fontSize: '28px', 
    fontWeight: '800', 
    letterSpacing: '-0.8px', 
    margin: '0 0 4px 0', 
    background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #38bdf8 100%)', 
    WebkitBackgroundClip: 'text', 
    WebkitTextFillColor: 'transparent' 
  },
  brandSubheading: { fontSize: '13px', color: '#94a3b8', margin: '0 0 14px 0', lineHeight: '1.45' },

  // 7-Day Clock Pill
  deliveryClockPill: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '11px', backgroundColor: '#0f172acc', padding: '8px 12px', borderRadius: '8px', marginBottom: '16px', border: '1px solid #1e293b' },

  buttonGroup: { display: 'flex', flexDirection: 'column', gap: '10px' },
  primaryBtn: { width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '10px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' },
  pricingBtn: { width: '100%', padding: '13px', backgroundColor: 'rgba(2, 132, 199, 0.15)', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '10px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
  creatorBtn: { width: '100%', padding: '12px', backgroundColor: 'rgba(236, 72, 153, 0.12)', color: '#f472b6', border: '1px solid #db2777', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' },
  secondaryBtn: { width: '100%', padding: '12px', backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '10px', fontWeight: '600', fontSize: '13px', cursor: 'pointer' },

  // 4-Step Roadmap
  roadmapBox: { backgroundColor: '#0b1120', border: '1px solid #1e293b', borderRadius: '10px', padding: '12px', marginTop: '16px' },
  roadmapTitle: { fontSize: '10px', letterSpacing: '1px', fontWeight: '800', color: '#64748b', margin: '0 0 10px 0' },
  roadmapGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' },
  roadmapStep: { display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '11px', color: '#cbd5e1' },
  stepNum: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '18px', height: '18px', borderRadius: '50%', backgroundColor: '#1e293b', color: '#38bdf8', fontSize: '10px', fontWeight: '700', flexShrink: 0 },

  ownershipBadge: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11px', color: '#94a3b8', marginTop: '12px' },
  shareBtn: { background: 'none', border: 'none', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', padding: '4px' },

  // Right Side Preview Canvas (Desktop & Mobile)
  previewCanvasContainer: { backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)', borderRadius: '18px', padding: '18px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' },
  previewControlBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginBottom: '14px', flexWrap: 'wrap' },
  categoryScroll: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  catTab: { padding: '6px 10px', backgroundColor: '#0b1120', color: '#94a3b8', border: '1px solid #1e293b', borderRadius: '6px', fontSize: '11px', fontWeight: '500', cursor: 'pointer' },
  catTabActive: { padding: '6px 10px', backgroundColor: '#2563eb', color: '#ffffff', border: '1px solid #38bdf8', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  deviceToggleGroup: { display: 'flex', backgroundColor: '#0b1120', borderRadius: '6px', border: '1px solid #1e293b', padding: '2px' },
  deviceBtn: { background: 'none', border: 'none', color: '#64748b', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' },
  deviceBtnActive: { backgroundColor: '#1e293b', border: 'none', color: '#38bdf8', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' },

  // Frame Adapters
  desktopFrameWrapper: { backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', overflow: 'hidden', transition: 'all 0.3s ease' },
  mobileFrameWrapper: { backgroundColor: '#0f172a', borderRadius: '24px', border: '4px solid #334155', maxWidth: '320px', margin: '0 auto', overflow: 'hidden', transition: 'all 0.3s ease' },

  browserHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' },
  browserDots: { display: 'flex', gap: '6px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%' },
  browserUrlPill: { backgroundColor: '#0f172a', color: '#94a3b8', fontSize: '10px', padding: '2px 10px', borderRadius: '4px', border: '1px solid #334155' },

  mockupHeroContainer: { position: 'relative', height: '240px', overflow: 'hidden' },
  mockupImage: { width: '100%', height: '100%', objectFit: 'cover' },
  mockupHeroOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to top, rgba(15,23,42,0.95) 20%, rgba(15,23,42,0.4) 100%)' },
  mockupHeroContent: { position: 'absolute', bottom: 14, left: 14, right: 14 },
  mockupBadge: { fontSize: '9px', fontWeight: '800', color: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid', letterSpacing: '0.5px' },
  mockupHeading: { fontSize: '17px', fontWeight: '800', margin: '6px 0 2px 0', color: '#ffffff' },
  mockupSubtext: { fontSize: '11px', color: '#cbd5e1', margin: 0 },
  mockupActionBtn: { padding: '7px 14px', color: '#ffffff', border: 'none', borderRadius: '6px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  mockupSecondaryBtn: { padding: '7px 12px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', fontSize: '11px', fontWeight: '600' },
  mockupStatsBar: { display: 'flex', justifyContent: 'space-around', padding: '10px', backgroundColor: '#0b1120', borderTop: '1px solid #1e293b' },
  mockupStatItem: { fontSize: '11px', color: '#38bdf8', fontWeight: '600' },

  foundationSpeedBox: { backgroundColor: '#064e3b22', border: '1px solid #059669', borderRadius: '8px', padding: '12px', marginTop: '14px' },

  // Creator Page Styles
  creatorPill: { fontSize: '10px', letterSpacing: '1px', fontWeight: '800', color: '#f472b6', backgroundColor: '#be185d22', padding: '4px 10px', borderRadius: '999px', border: '1px solid #db277744', display: 'inline-block' },
  creatorGrid: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' },
  creatorCard: { padding: '10px 12px', backgroundColor: '#0f172a88', borderRadius: '8px', border: '1px solid #334155' },
  creatorCardTitle: { fontSize: '13px', fontWeight: '700', color: '#f8fafc', margin: '0 0 2px 0' },
  creatorCardText: { fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: '1.35' },

  // Pricing & ROI Styles
  roiBanner: { backgroundColor: '#064e3b22', border: '1px solid #059669', borderRadius: '8px', padding: '12px', marginBottom: '14px' },
  pricingCard: { padding: '14px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' },
  roiTag: { fontSize: '11px', fontWeight: '600', color: '#34d399', backgroundColor: '#064e3b33', padding: '4px 8px', borderRadius: '4px' },
  tierList: { listStyle: 'none', padding: 0, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: '6px' },
  tierItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' },
  tierBadge: { fontSize: '9px', fontWeight: '700', color: '#94a3b8', backgroundColor: '#334155', padding: '2px 6px', borderRadius: '4px' },
  popularBadge: { fontSize: '9px', fontWeight: '800', color: '#38bdf8', backgroundColor: '#0369a133', padding: '2px 6px', borderRadius: '4px', border: '1px solid #0284c7' },

  // General Components
  title: { fontSize: '22px', fontWeight: '800', marginBottom: '6px', textAlign: 'center', letterSpacing: '-0.5px' },
  subtitle: { fontSize: '13px', color: '#cbd5e1', marginBottom: '18px', textAlign: 'center', lineHeight: '1.4' },
  badge: { fontSize: '10px', letterSpacing: '1px', fontWeight: '700', color: '#38bdf8', backgroundColor: '#0284c722', padding: '4px 10px', borderRadius: '999px', border: '1px solid #0284c744', display: 'inline-block' },
  selectedTierBadge: { fontSize: '11px', fontWeight: '600', color: '#38bdf8', backgroundColor: '#0284c722', padding: '2px 8px', borderRadius: '4px' },
  questionTitle: { fontSize: '16px', fontWeight: '600', marginBottom: '16px' },
  optionBtn: { width: '100%', padding: '12px', backgroundColor: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', textAlign: 'left', marginBottom: '8px', fontSize: '14px', cursor: 'pointer' },
  selectedOption: { width: '100%', padding: '12px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '6px', textAlign: 'left', marginBottom: '8px', fontSize: '14px', cursor: 'pointer' },
  input: { width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '6px', color: '#f8fafc', marginBottom: '12px', boxSizing: 'border-box' },
  backBtn: { background: 'none', border: 'none', color: '#94a3b8', marginTop: '14px', cursor: 'pointer', fontSize: '13px', width: '100%', textAlign: 'center' },
  progressBarContainer: { height: '4px', backgroundColor: '#334155', borderRadius: '2px', marginBottom: '12px', overflow: 'hidden' },
  progressBar: { height: '100%', backgroundColor: '#2563eb', transition: 'width 0.3s' },
  stepLabel: { fontSize: '12px', color: '#94a3b8' },
  alertBox: { backgroundColor: '#1e1b4b', border: '1px solid #4338ca', padding: '14px', borderRadius: '8px', marginTop: '16px', marginBottom: '16px' },
  alertTitle: { fontSize: '13px', fontWeight: 'bold', color: '#a5b4fc', margin: '0 0 4px 0' },
  alertText: { fontSize: '12px', color: '#c7d2fe', margin: 0, lineHeight: '1.4' },
  text: { fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5' }
};
