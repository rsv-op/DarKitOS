"use client";

import { useState } from "react";

const concepts = {
  aurora: {
    label: "01 / Aurora",
    name: "Signal in the noise.",
    description: "A calm command center for teams that move at the speed of change.",
    accent: "#b9ff6a",
    accentSoft: "rgba(185,255,106,.15)",
    glow: "rgba(118, 255, 0, .18)",
    stat: "99.98%",
    statLabel: "system uptime",
  },
  prism: {
    label: "02 / Prism",
    name: "Make momentum visible.",
    description: "Turn scattered work into a living system your whole company can see.",
    accent: "#bba7ff",
    accentSoft: "rgba(187,167,255,.15)",
    glow: "rgba(109, 55, 255, .22)",
    stat: "+42%",
    statLabel: "faster decisions",
  },
  ember: {
    label: "03 / Ember",
    name: "Built for the brave.",
    description: "The operating layer for ambitious teams building what comes next.",
    accent: "#ff9a62",
    accentSoft: "rgba(255,154,98,.15)",
    glow: "rgba(255, 80, 20, .18)",
    stat: "3.4×",
    statLabel: "more shipped",
  },
} as const;

type Concept = keyof typeof concepts;

export default function HomePage() {
  const [active, setActive] = useState<Concept>("aurora");
  const concept = concepts[active];

  return (
    <main className="saas-shell" style={{ "--accent": concept.accent, "--accent-soft": concept.accentSoft, "--glow": concept.glow } as React.CSSProperties}>
      <div className="noise" aria-hidden="true" />
      <nav className="nav wrap">
        <a className="brand" href="/" aria-label="Northstar home"><span className="brand-mark">N</span> NORTHSTAR</a>
        <div className="nav-links"><a href="#product">Product</a><a href="#method">Method</a><a href="#stories">Stories</a></div>
        <a className="nav-cta" href="/login">Enter workspace <span>↗</span></a>
      </nav>

      <section className="hero wrap" id="product">
        <div className="hero-copy">
          <p className="eyebrow"><span className="pulse" /> The operating system for remarkable teams</p>
          <h1>{concept.name}</h1>
          <p className="hero-description">{concept.description}</p>
          <div className="hero-actions"><a className="primary-button" href="/login">Start building <span>→</span></a><a className="text-button" href="#method">See how it works <span>↓</span></a></div>
          <div className="proof"><div className="avatars"><span>AK</span><span>JM</span><span>RS</span><span>+</span></div><p>Trusted by teams<br /><strong>who think forward.</strong></p></div>
        </div>
        <div className="hero-visual" aria-label="Product dashboard preview">
          <div className="orbit orbit-one" /><div className="orbit orbit-two" />
          <div className="dashboard-card">
            <div className="dash-top"><span className="mini-brand"><span className="mini-mark">N</span> northstar</span><span className="live"><span /> Live view</span></div>
            <div className="dash-content"><div><p className="dash-kicker">Monday, October 12</p><h2>Good morning, Alex.</h2><p className="dash-muted">Here&apos;s the signal for your team.</p></div><div className="score"><strong>{concept.stat}</strong><span>{concept.statLabel}</span></div></div>
            <div className="chart"><div className="chart-label"><span>Team velocity</span><span>Last 30 days <b>⌄</b></span></div><div className="bars">{[38,52,44,67,59,78,72,92,84,100,89,96].map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}</div></div>
            <div className="dash-bottom"><span><i className="green-dot" /> 14 initiatives on track</span><span>Updated just now ↗</span></div>
          </div>
        </div>
      </section>

      <section className="concept-picker wrap" id="method"><div className="picker-heading"><p className="eyebrow">Choose a direction</p><p className="picker-note">Three starting points. One sharp point of view.</p></div><div className="concepts">{(Object.keys(concepts) as Concept[]).map((key) => <button key={key} className={`concept ${active === key ? "selected" : ""}`} onClick={() => setActive(key)}><span className="concept-number">{concepts[key].label}</span><span className="concept-name">{key === "aurora" ? "Quiet confidence" : key === "prism" ? "Electric clarity" : "Warm conviction"}</span><span className="concept-arrow">{active === key ? "●" : "○"}</span></button>)}</div></section>

      <section className="marquee" id="stories"><div className="marquee-track"><span>FOCUS</span><b>✳</b><span>ALIGNMENT</span><b>✳</b><span>VELOCITY</span><b>✳</b><span>FOCUS</span><b>✳</b><span>ALIGNMENT</span><b>✳</b><span>VELOCITY</span></div></section>
      <footer className="footer wrap"><span>© 2026 NORTHSTAR SYSTEMS</span><span>One workspace. Infinite headroom.</span><a href="/login">Sign in ↗</a></footer>
    </main>
  );
}


const _unused = concepts;
void _unused;

// Keep the type import available without adding a second module dependency.
