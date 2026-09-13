

'use client';

import React, { useState } from 'react';

// Custom inline SVG icons
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
  ),
  CheckCircle: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  Lock: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  TrendingUp: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  ),
  Eye: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
};

export default function FunnelApp() {
  const [mode, setMode] = useState('landing');
  const [step, setStep] = useState(1);
  const [selectedTemplateType, setSelectedTemplateType] = useState('Service Business');
  const [selectedTier, setSelectedTier] = useState('Growth Engine');
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

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => setStep((s) => Math.min(s + 1, 6));
  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const templatePreviews = {
    'Service Business': {
      title: 'Vance Advisory & Partners',
      tagline: 'High-Impact Strategic Consulting',
      heroImage: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80',
      accentColor: '#2563eb',
      buttonText: 'Book Strategy Call',
      badge: 'B2B & CONSULTING',
      stats: ['99.4% Client Retention', '$48M Client Value']
    },
    'E-Commerce Store': {
      title: 'Aura Modern Living',
      tagline: 'Minimalist Goods & Home Decor',
      heroImage: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80',
      accentColor: '#ec4899',
      buttonText: 'Shop New Arrivals',
      badge: 'DIRECT SALES & RETAIL',
      stats: ['Free 2-Day Shipping', '4.9★ Customer Rating']
    },
    'Portfolio & Agency': {
      title: 'Kinesis Creative Lab',
      tagline: 'Brand Systems & Visual Direction',
      heroImage: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
      accentColor: '#818cf8',
      buttonText: 'View Selected Works',
      badge: 'CREATIVE & DIGITAL',
      stats: ['14 Design Awards', 'Over 80 Case Studies']
    },
    'Clinic & Wellness': {
      title: 'Lumina Integrative Health',
      tagline: 'Modern Medicine & Holistic Care',
      heroImage: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=600&q=80',
      accentColor: '#10b981',
      buttonText: 'Schedule Appointment',
      badge: 'HEALTHCARE & WELLNESS',
      stats: ['Same-Day Intake', 'Board-Certified Specialists']
    }
  };

  const currentPreview = templatePreviews[selectedTemplateType];

  const pricingTiers = [
    {
      name: 'Starter Launch',
      price: '$449',
      period: 'one-time',
      tagline: 'Ideal for local businesses establishing their first online footprint.',
      badge: 'FOUNDATION',
      roiNote: 'Captures the 81% of shoppers researching online before visiting.',
      features: [
        'Guaranteed 7-day turnaround',
        'Mobile-first responsive design',
        'My Site Manager: Text & Color editing',
        'Lead capture & inquiry forms',
        'SSL certificate & secure hosting setup'
      ],
      highlight: false
    },
    {
      name: 'Growth Engine',
      price: '$749',
      period: 'one-time',
      tagline: 'Engineered for high-conversion sales and client bookings.',
      badge: 'MOST POPULAR',
      roiNote: 'Designed to unlock the 2.8x revenue growth rate seen with active web presence.',
      features: [
        'Everything in Starter Launch',
        'Full My Site Manager: Image & CDN media studio',
        'Online booking or multi-section service gallery',
        'Automated SMS & voice milestone notifications',
        'Local SEO and Google ranking setup'
      ],
      highlight: true
    },
    {
      name: 'Scale Pro',
      price: '$1,049',
      period: 'one-time',
      tagline: 'Full enterprise capabilities with continuous modulation flexibility.',
      badge: 'UNLIMITED UPDATES',
      roiNote: 'Built for businesses targeting up to 39%+ sales expansion.',
      features: [
        'Dynamic multi-page architecture',
        'UNLIMITED modulation & update requests',
        'VIP priority staging deploy',
        'AI progress tracking assistant',
        'High-speed conversion optimization'
      ],
      highlight: false
    }
  ];

  const services = [
    {
      title: 'Ready in Just 7 Days',
      desc: 'Your professional website is built, polished, and launched online within one week.',
      icon: <Icons.SpeedDelivery />,
      bg: '#0369a122',
      border: '#0284c7'
    },
    {
      title: 'Simple "My Site Manager"',
      desc: 'A private dashboard where you can easily change your own text, photos, and colors anytime.',
      icon: <Icons.SiteManager />,
      bg: '#4338ca22',
      border: '#6366f1'
    },
    {
      title: 'Easy Color & Photo Updates',
      desc: 'Match your business branding with simple color pickers and 1-click photo uploads.',
      icon: <Icons.ColorPalette />,
      bg: '#be185d22',
      border: '#ec4899'
    },
    {
      title: 'Friendly Progress Updates',
      desc: 'Receive simple text messages or short phone calls so you always know what we are working on.',
      icon: <Icons.OmnichannelBell />,
      bg: '#04785722',
      border: '#10b981'
    }
  ];

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

  // --- VIEW: PRICING & MARKET ROI ---
  if (mode === 'pricing') {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={styles.badge}>TRANSPARENT PRICING</span>
            <h2 style={{ ...styles.title, marginTop: '8px' }}>LaunchSeven Studio Plans</h2>
            <p style={styles.subtitle}>No hidden agency fees. Choose the right tier for your growth goals.</p>
          </div>

          <div style={styles.roiBanner}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Icons.TrendingUp />
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#34d399' }}>Industry Market Research</span>
            </div>
            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: '1.4' }}>
              Businesses with a professional website report earning an average of <strong>39% more revenue</strong> and are <strong>2.8x more likely to grow</strong> compared to offline competitors.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                style={{
                  ...styles.pricingCard,
                  borderColor: tier.highlight ? '#38bdf8' : '#334155',
                  backgroundColor: tier.highlight ? 'rgba(30, 58, 138, 0.25)' : '#0f172a'
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

  // --- VIEW: SPEED CHECK & VISUAL BASE TEMPLATE PREVIEW ---
  if (mode === 'speed_check') {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', marginBottom: '14px' }}>
            <span style={styles.badge}>INTERACTIVE TEMPLATE PREVIEW</span>
            <h2 style={{ ...styles.title, marginTop: '8px' }}>Explore Base Templates</h2>
            <p style={styles.subtitle}>Tap a category below to preview its live design, layout, and style.</p>
          </div>

          <div style={styles.templatePicker}>
            {['Service Business', 'E-Commerce Store', 'Portfolio & Agency', 'Clinic & Wellness'].map((type) => (
              <button
                key={type}
                style={selectedTemplateType === type ? styles.templateBtnActive : styles.templateBtn}
                onClick={() => setSelectedTemplateType(type)}
              >
                {type}
              </button>
            ))}
          </div>

          <div style={styles.previewBrowserWindow}>
            <div style={styles.browserHeader}>
              <div style={styles.browserDots}>
                <span style={{ ...styles.dot, backgroundColor: '#ef4444' }} />
                <span style={{ ...styles.dot, backgroundColor: '#eab308' }} />
                <span style={{ ...styles.dot, backgroundColor: '#22c55e' }} />
              </div>
              <div style={styles.browserUrlPill}>
                preview.{selectedTemplateType.toLowerCase().replace(/\s+/g, '')}.com
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <Icons.Eye />
              </div>
            </div>

            <div style={styles.mockupHeroContainer}>
              <img src={currentPreview.heroImage} alt={currentPreview.title} style={styles.mockupImage} />
              <div style={styles.mockupHeroOverlay} />
              <div style={styles.mockupHeroContent}>
                <span style={{ ...styles.mockupBadge, backgroundColor: `${currentPreview.accentColor}33`, borderColor: currentPreview.accentColor }}>
                  {currentPreview.badge}
                </span>
                <h3 style={styles.mockupHeading}>{currentPreview.title}</h3>
                <p style={styles.mockupSubtext}>{currentPreview.tagline}</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <button style={{ ...styles.mockupActionBtn, backgroundColor: currentPreview.accentColor }}>
                    {currentPreview.buttonText}
                  </button>
                  <button style={styles.mockupSecondaryBtn}>
                    Learn More
                  </button>
                </div>
              </div>
            </div>

            <div style={styles.mockupStatsBar}>
              {currentPreview.stats.map((stat, i) => (
                <span key={i} style={styles.mockupStatItem}>
                  ✓ {stat}
                </span>
              ))}
            </div>
          </div>

          <div style={styles.speedResultBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <Icons.CheckCircle />
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#34d399' }}>
                {selectedTemplateType} Foundation Ready in 24 Hours
              </span>
            </div>
            <p style={{ fontSize: '11px', color: '#94a3b8', margin: 0, lineHeight: '1.4' }}>
              We deploy this fully customized responsive layout and color profile to your private preview portal within 24 hours of project kickoff.
            </p>
          </div>

          <div style={styles.gatedNoticeBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <Icons.Lock />
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#fbbf24' }}>Sign Up to Save This Base Template</span>
            </div>
            <p style={{ fontSize: '11px', color: '#cbd5e1', margin: 0, lineHeight: '1.35' }}>
              Complete the quick 2-minute questionnaire to reserve this layout and start your guaranteed 7-day launch.
            </p>
          </div>

          <button
            style={styles.primaryBtn}
            onClick={() => {
              updateField('vertical', selectedTemplateType);
              setMode('questionnaire');
            }}
          >
            Save This Template & Sign Up →
          </button>

          <button style={styles.backBtn} onClick={() => setMode('landing')}>
            ← Back to Home
          </button>
        </div>
      </main>
    );
  }

  // --- VIEW: SERVICES OVERVIEW ---
  if (mode === 'browse') {
    return (
      <main style={styles.container}>
        <div style={styles.card}>
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <span style={styles.badge}>WHAT YOU GET</span>
            <h2 style={{ ...styles.title, marginTop: '8px' }}>LaunchSeven Studio Services</h2>
            <p style={styles.subtitle}>A complete, professional website delivered quickly without the headache.</p>
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

          <button style={styles.primaryBtn} onClick={() => setMode('pricing')}>
            View Pricing & Plans ($449 - $1,049)
          </button>
          <button style={styles.backBtn} onClick={() => setMode('landing')}>
            ← Back to Home
          </button>
        </div>
      </main>
    );
  }

  // --- VIEW: LANDING HOME PAGE (VIVID SHOWCASE BACKGROUND) ---
  if (mode === 'landing') {
    return (
      <main style={styles.container}>
        {/* Crisp, clearly visible background grid of live websites */}
        <div style={styles.bgGridContainer}>
          {/* Mockup 1: Modern SaaS / App Platform */}
          <div style={styles.bgBrowserCard}>
            <div style={styles.bgBrowserBar}>
              <span style={{ ...styles.bgDot, backgroundColor: '#f87171' }} />
              <span style={{ ...styles.bgDot, backgroundColor: '#fbbf24' }} />
              <span style={{ ...styles.bgDot, backgroundColor: '#34d399' }} />
              <span style={styles.bgBrowserDomain}>zenith-platform.io</span>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=700&q=85" 
              alt="Website Showcase 1" 
              style={styles.bgImage} 
            />
          </div>

          {/* Mockup 2: Design Studio & Agency Portfolio */}
          <div style={styles.bgBrowserCard}>
            <div style={styles.bgBrowserBar}>
              <span style={{ ...styles.bgDot, backgroundColor: '#f87171' }} />
              <span style={{ ...styles.bgDot, backgroundColor: '#fbbf24' }} />
              <span style={{ ...styles.bgDot, backgroundColor: '#34d399' }} />
              <span style={styles.bgBrowserDomain}>kinesis-creative.com</span>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=700&q=85" 
              alt="Website Showcase 2" 
              style={styles.bgImage} 
            />
          </div>

          {/* Mockup 3: E-Commerce Store */}
          <div style={styles.bgBrowserCard}>
            <div style={styles.bgBrowserBar}>
              <span style={{ ...styles.bgDot, backgroundColor: '#f87171' }} />
              <span style={{ ...styles.bgDot, backgroundColor: '#fbbf24' }} />
              <span style={{ ...styles.bgDot, backgroundColor: '#34d399' }} />
              <span style={styles.bgBrowserDomain}>aura-living.shop</span>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=700&q=85" 
              alt="Website Showcase 3" 
              style={styles.bgImage} 
            />
          </div>

          {/* Mockup 4: Professional Architecture / Corporate */}
          <div style={styles.bgBrowserCard}>
            <div style={styles.bgBrowserBar}>
              <span style={{ ...styles.bgDot, backgroundColor: '#f87171' }} />
              <span style={{ ...styles.bgDot, backgroundColor: '#fbbf24' }} />
              <span style={{ ...styles.bgDot, backgroundColor: '#34d399' }} />
              <span style={styles.bgBrowserDomain}>vance-corp.com</span>
            </div>
            <img 
              src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=700&q=85" 
              alt="Website Showcase 4" 
              style={styles.bgImage} 
            />
          </div>
        </div>

        {/* Balanced Translucent Vignette (Keeps websites clearly visible around the card) */}
        <div style={styles.bgOverlay} />

        {/* Floating Glassmorphic Control Card */}
        <div style={styles.cardRelative}>
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <span style={styles.brandBadge}>LAUNCHSEVEN STUDIO</span>
            <h1 style={{ ...styles.title, marginTop: '8px' }}>LaunchSeven Studio</h1>
            <p style={styles.subtitle}>Custom websites delivered in 7 days with full personal control.</p>
          </div>

          <div style={styles.statsPill}>
            <span>⚡ 7-Day Launch</span>
            <span>•</span>
            <span>📈 +39% Revenue Lift</span>
            <span>•</span>
            <span>🎨 My Site Manager</span>
          </div>

          <div style={styles.buttonGroup}>
            <button style={styles.primaryBtn} onClick={() => setMode('questionnaire')}>
              Build My Website Now
            </button>

            <button style={styles.highlightBtn} onClick={() => setMode('speed_check')}>
              ⏱ Preview Templates & Speed
            </button>

            <button style={styles.pricingBtn} onClick={() => setMode('pricing')}>
              🏷 View Pricing ($449 - $1,049)
            </button>

            <button style={styles.secondaryBtn} onClick={() => setMode('browse')}>
              See What is Included
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- VIEW: QUESTIONNAIRE ---
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
            <h3 style={styles.questionTitle}>1. What type of business is this for?</h3>
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
            <h3 style={styles.questionTitle}>2. What is the main goal of your site?</h3>
            {['Get New Customer Inquiries', 'Sell Products Directly', 'Showcase My Past Work', 'Build Trust & Credibility'].map((item) => (
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
            <h3 style={styles.questionTitle}>3. What style fits your business best?</h3>
            {['Clean & Simple', 'Bold & Modern', 'Dark & High-Tech', 'Warm & Friendly'].map((item) => (
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
            {['Online Booking / Calendar', 'Customer Contact Form', 'Photo & Work Gallery', 'Customer Login Area'].map((item) => (
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
            {['Yes, I have my logo and website name ready', 'I have a logo, but need a website name', 'I am starting from scratch and need both'].map((item) => (
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
              placeholder="Your Business Name"
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

const styles = {
  container: { position: 'relative', minHeight: '100vh', backgroundColor: '#060910', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', boxSizing: 'border-box', overflow: 'hidden' },
  
  // Vivid Background Showcase Grid
  bgGridContainer: { 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    display: 'grid', 
    gridTemplateColumns: 'repeat(2, 1fr)', 
    gap: '14px', 
    padding: '12px', 
    opacity: 0.72, // Raised from 0.22 to 0.72 for strong visibility
    pointerEvents: 'none', 
    zIndex: 1 
  },
  bgBrowserCard: { 
    width: '100%', 
    height: '100%', 
    borderRadius: '10px', 
    overflow: 'hidden', 
    border: '1px solid rgba(255, 255, 255, 0.25)', 
    backgroundColor: '#1e293b', 
    boxShadow: '0 8px 24px rgba(0,0,0,0.6)', 
    display: 'flex', 
    flexDirection: 'column' 
  },
  bgBrowserBar: { 
    height: '18px', 
    backgroundColor: '#0f172a', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '4px', 
    padding: '0 8px', 
    borderBottom: '1px solid rgba(255,255,255,0.1)' 
  },
  bgDot: { width: '5px', height: '5px', borderRadius: '50%' },
  bgBrowserDomain: { fontSize: '8px', color: '#94a3b8', marginLeft: '6px', fontFamily: 'monospace' },
  bgImage: { width: '100%', height: '100%', objectFit: 'cover', flex: 1 },

  // Subtle radial vignette so cards in the background pop behind the center card
  bgOverlay: { 
    position: 'fixed', 
    top: 0, 
    left: 0, 
    right: 0, 
    bottom: 0, 
    background: 'radial-gradient(circle at center, rgba(6, 9, 16, 0.55) 0%, rgba(6, 9, 16, 0.85) 100%)', 
    zIndex: 2, 
    pointerEvents: 'none' 
  },

  // Glassmorphic Card (Translucent so background is visible behind it)
  cardRelative: { 
    position: 'relative', 
    zIndex: 3, 
    backgroundColor: 'rgba(23, 32, 51, 0.88)', 
    backdropFilter: 'blur(16px)', 
    WebkitBackdropFilter: 'blur(16px)',
    width: '100%', 
    maxWidth: '440px', 
    borderRadius: '16px', 
    padding: '26px 22px', 
    color: '#f8fafc', 
    boxShadow: '0 20px 45px rgba(0,0,0,0.7)', 
    border: '1px solid rgba(255,255,255,0.15)', 
    boxSizing: 'border-box' 
  },
  card: { position: 'relative', zIndex: 3, backgroundColor: '#1e293b', width: '100%', maxWidth: '440px', borderRadius: '14px', padding: '24px', color: '#f8fafc', boxShadow: '0 10px 30px rgba(0,0,0,0.6)', boxSizing: 'border-box' },
  
  title: { fontSize: '24px', fontWeight: '800', marginBottom: '6px', textAlign: 'center', letterSpacing: '-0.5px' },
  subtitle: { fontSize: '13px', color: '#cbd5e1', marginBottom: '18px', textAlign: 'center', lineHeight: '1.4' },
  brandBadge: { fontSize: '11px', letterSpacing: '1.5px', fontWeight: '800', color: '#38bdf8', backgroundColor: '#0284c733', padding: '5px 12px', borderRadius: '999px', border: '1px solid #38bdf888', display: 'inline-block' },
  badge: { fontSize: '10px', letterSpacing: '1px', fontWeight: '700', color: '#38bdf8', backgroundColor: '#0284c722', padding: '4px 10px', borderRadius: '999px', border: '1px solid #0284c744', display: 'inline-block' },
  tierBadge: { fontSize: '9px', fontWeight: '700', color: '#94a3b8', backgroundColor: '#334155', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.5px' },
  popularBadge: { fontSize: '9px', fontWeight: '800', color: '#38bdf8', backgroundColor: '#0369a133', padding: '2px 6px', borderRadius: '4px', border: '1px solid #0284c7' },
  selectedTierBadge: { fontSize: '11px', fontWeight: '600', color: '#38bdf8', backgroundColor: '#0284c722', padding: '2px 8px', borderRadius: '4px' },
  
  statsPill: { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#e2e8f0', backgroundColor: '#0f172aee', padding: '8px 12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #334155' },
  
  buttonGroup: { display: 'flex', flexDirection: 'column', gap: '10px' },
  primaryBtn: { width: '100%', padding: '14px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontWeight: '700', fontSize: '15px', cursor: 'pointer' },
  pricingBtn: { width: '100%', padding: '13px', backgroundColor: '#0284c722', color: '#38bdf8', border: '1px solid #0284c7', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' },
  highlightBtn: { width: '100%', padding: '13px', backgroundColor: '#1e1b4b', color: '#c7d2fe', border: '1px solid #4f46e5', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },
  secondaryBtn: { width: '100%', padding: '13px', backgroundColor: 'transparent', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '8px', fontWeight: '600', fontSize: '14px', cursor: 'pointer' },

  // Pricing Styles
  roiBanner: { backgroundColor: '#064e3b22', border: '1px solid #059669', borderRadius: '8px', padding: '12px', marginBottom: '14px' },
  pricingCard: { padding: '14px', borderRadius: '10px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '8px' },
  roiTag: { fontSize: '11px', fontWeight: '600', color: '#34d399', backgroundColor: '#064e3b33', padding: '4px 8px', borderRadius: '4px' },
  tierList: { listStyle: 'none', padding: 0, margin: '6px 0', display: 'flex', flexDirection: 'column', gap: '6px' },
  tierItem: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#cbd5e1' },

  // Speed & Template Browser Preview UI
  templatePicker: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '14px' },
  templateBtn: { padding: '10px 8px', backgroundColor: '#0f172a', color: '#cbd5e1', border: '1px solid #334155', borderRadius: '6px', fontSize: '12px', fontWeight: '500', cursor: 'pointer', textAlign: 'center' },
  templateBtnActive: { padding: '10px 8px', backgroundColor: '#2563eb', color: '#ffffff', border: '1px solid #38bdf8', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', textAlign: 'center' },
  
  previewBrowserWindow: { backgroundColor: '#0f172a', borderRadius: '10px', border: '1px solid #334155', overflow: 'hidden', marginBottom: '14px' },
  browserHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', backgroundColor: '#1e293b', borderBottom: '1px solid #334155' },
  browserDots: { display: 'flex', gap: '6px' },
  dot: { width: '8px', height: '8px', borderRadius: '50%' },
  browserUrlPill: { backgroundColor: '#0f172a', color: '#94a3b8', fontSize: '10px', padding: '2px 10px', borderRadius: '4px', border: '1px solid #334155' },
  
  mockupHeroContainer: { position: 'relative', height: '170px', overflow: 'hidden' },
  mockupImage: { width: '100%', height: '100%', objectFit: 'cover' },
  mockupHeroOverlay: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(to top, rgba(15,23,42,0.95) 15%, rgba(15,23,42,0.4) 100%)' },
  mockupHeroContent: { position: 'absolute', bottom: 12, left: 12, right: 12 },
  mockupBadge: { fontSize: '9px', fontWeight: '800', color: '#f8fafc', padding: '2px 6px', borderRadius: '4px', border: '1px solid', letterSpacing: '0.5px' },
  mockupHeading: { fontSize: '15px', fontWeight: '800', margin: '4px 0 2px 0', color: '#ffffff' },
  mockupSubtext: { fontSize: '11px', color: '#cbd5e1', margin: 0 },
  mockupActionBtn: { padding: '6px 12px', color: '#ffffff', border: 'none', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' },
  mockupSecondaryBtn: { padding: '6px 10px', backgroundColor: 'rgba(255,255,255,0.1)', color: '#cbd5e1', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '4px', fontSize: '11px', fontWeight: '600' },
  mockupStatsBar: { display: 'flex', justifyContent: 'space-around', padding: '8px 10px', backgroundColor: '#0b1120', borderTop: '1px solid #1e293b' },
  mockupStatItem: { fontSize: '10px', color: '#38bdf8', fontWeight: '600' },

  speedResultBox: { backgroundColor: '#064e3b22', border: '1px solid #059669', borderRadius: '8px', padding: '10px', marginBottom: '10px' },
  gatedNoticeBox: { backgroundColor: '#78350f22', border: '1px solid #d97706', borderRadius: '8px', padding: '10px', marginBottom: '14px' },

  serviceGrid: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' },
  serviceCard: { display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px', backgroundColor: '#0f172a88', borderRadius: '10px', border: '1px solid #334155' },
  iconContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '40px', height: '40px', borderRadius: '8px' },
  serviceTitle: { fontSize: '14px', fontWeight: '600', margin: '0 0 2px 0', color: '#f8fafc' },
  serviceDesc: { fontSize: '12px', color: '#94a3b8', margin: 0, lineHeight: '1.35' },

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
