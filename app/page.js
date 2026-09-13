

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>VerticalForge | Revenue-Grade Industry Architectures</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-obsidian: #090D14;
            --bg-card: #1E293B;
            --bg-card-hover: #161F30;
            --text-main: #F8FAFC;
            --text-muted: #94A3B8;
            --accent-amber: #F59E0B;
            --accent-cyan: #0EA5E9;
            --accent-emerald: #10B981;
            --border-glass: rgba(255, 255, 255, 0.08);
            --border-glow: rgba(14, 165, 233, 0.3);
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Plus Jakarta Sans', sans-serif;
            background-color: var(--bg-obsidian);
            color: var(--text-main);
            min-height: 100vh;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-start;
            padding: 40px 20px;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(14, 165, 233, 0.12) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(245, 158, 11, 0.08) 0%, transparent 40%);
        }

        .agency-wrapper {
            width: 100%;
            max-width: 1200px;
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        /* Header Navigation */
        header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px 24px;
            background: rgba(15, 23, 42, 0.8);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
        }

        .logo-area {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .logo-mark {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, var(--accent-cyan), var(--accent-amber));
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 800;
            color: #090D14;
            font-family: 'Space Grotesk', sans-serif;
        }

        .logo-text {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: -0.5px;
        }

        .agency-thesis {
            font-size: 12px;
            color: var(--text-muted);
            border-left: 1px solid var(--border-glass);
            padding-left: 16px;
            display: none;
        }

        @media(min-width: 768px) {
            .agency-thesis { display: block; }
        }

        /* Hero Section */
        .hero-section {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-glass);
            border-radius: 24px;
            padding: 48px 32px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .hero-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(14, 165, 233, 0.1);
            border: 1px solid var(--border-glow);
            padding: 6px 14px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 700;
            color: var(--accent-cyan);
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 20px;
        }

        .hero-title {
            font-family: 'Space Grotesk', sans-serif;
            font-size: clamp(32px, 5vw, 56px);
            font-weight: 700;
            line-height: 1.1;
            letter-spacing: -1.5px;
            margin-bottom: 20px;
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
        }

        .hero-title span {
            background: linear-gradient(135deg, #FFFFFF 30%, var(--accent-cyan) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .hero-subtitle {
            font-size: 16px;
            color: var(--text-muted);
            max-width: 700px;
            margin: 0 auto 32px auto;
            line-height: 1.6;
        }

        /* Vertical Switcher Tabs */
        .switcher-container {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            margin-bottom: 32px;
        }

        .vertical-tab {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            padding: 16px;
            border-radius: 12px;
            cursor: pointer;
            text-align: left;
            transition: all 0.25s ease;
        }

        .vertical-tab:hover {
            border-color: rgba(255, 255, 255, 0.2);
        }

        .vertical-tab.active {
            background: rgba(14, 165, 233, 0.1);
            border-color: var(--accent-cyan);
        }

        .tab-title {
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 4px;
            color: var(--text-main);
        }

        .tab-desc {
            font-size: 11px;
            color: var(--text-muted);
            line-height: 1.4;
        }

        /* Live Preview Card */
        .preview-card {
            background: var(--bg-card);
            border: 1px solid var(--border-glass);
            border-radius: 20px;
            padding: 32px;
            display: grid;
            grid-template-columns: 1fr;
            gap: 24px;
            text-align: left;
        }

        @media(min-width: 900px) {
            .preview-card { grid-template-columns: 1.2fr 1fr; align-items: center; }
        }

        .preview-content h3 {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 24px;
            margin-bottom: 12px;
        }

        .preview-metrics {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            margin-top: 20px;
        }

        .metric-box {
            background: rgba(9, 13, 20, 0.6);
            border: 1px solid var(--border-glass);
            padding: 16px;
            border-radius: 12px;
        }

        .metric-value {
            font-family: 'Space Grotesk', sans-serif;
            font-size: 24px;
            font-weight: 700;
            color: var(--accent-emerald);
            margin-bottom: 4px;
        }

        .metric-label {
            font-size: 11px;
            color: var(--text-muted);
        }

        /* Interactive ROI Calculator Section */
        .calculator-section {
            background: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-glass);
            border-radius: 24px;
            padding: 40px 32px;
        }

        .calc-grid {
            display: grid;
            grid-template-columns: 1fr;
            gap: 32px;
            margin-top: 24px;
        }

        @media(min-width: 768px) {
            .calc-grid { grid-template-columns: 1fr 1fr; }
        }

        .slider-group {
            margin-bottom: 24px;
        }

        .slider-group label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 8px;
            color: var(--text-main);
        }

        input[type="range"] {
            width: 100%;
            accent-color: var(--accent-cyan);
            cursor: pointer;
        }

        .calc-output-box {
            background: rgba(14, 165, 233, 0.05);
            border: 1px solid var(--border-glow);
            border-radius: 16px;
            padding: 24px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            text-align: center;
        }

        .cta-btn {
            background: var(--accent-cyan);
            color: #090D14;
            border: none;
            padding: 16px 32px;
            border-radius: 12px;
            font-weight: 700;
            font-size: 15px;
            cursor: pointer;
            transition: transform 0.2s ease, opacity 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 16px;
        }

        .cta-btn:hover {
            opacity: 0.9;
            transform: translateY(-2px);
        }

        /* Footer */
        footer {
            text-align: center;
            padding: 24px;
            font-size: 12px;
            color: var(--text-muted);
            border-top: 1px solid var(--border-glass);
        }
    </style>
</head>
<body>

    <div class="agency-wrapper">
        <!-- Header -->
        <header>
            <div class="logo-area">
                <div class="logo-mark">VF</div>
                <div class="logo-text">VerticalForge</div>
            </div>
            <div class="agency-thesis">
                "Revenue-grade websites engineered strictly around vertical-specific buyer psychology."
            </div>
            <button class="cta-btn" style="padding: 10px 20px; font-size: 13px; margin: 0;" onclick="alert('Strategy booking modal triggered.')">
                Book Strategy Call
            </button>
        </header>

        <!-- Hero Section -->
        <section class="hero-section">
            <div class="hero-badge">
                <span>⚡</span> Conversion Architecture Engine
            </div>
            <h1 class="hero-title">
                Generic templates fail. <br><span>We engineer vertical conversion dominance.</span>
            </h1>
            <p class="hero-subtitle">
                Select your business model below to instantly experience how tailored architectural heuristics achieve up to 3x higher conversion rates than commodity templates.
            </p>

            <!-- Dynamic Vertical Switcher -->
            <div class="switcher-container" id="switcherTabs">
                <!-- Injected via Vanilla JS -->
            </div>

            <!-- Live Preview Display -->
            <div class="preview-card" id="previewCard">
                <!-- Injected via Vanilla JS -->
            </div>
        </section>

        <!-- Interactive ROI Estimator -->
        <section class="calculator-section">
            <h2 style="font-family: 'Space Grotesk', sans-serif; font-size: 28px; margin-bottom: 8px;">Interactive Revenue Impact Estimator</h2>
            <p style="color: var(--text-muted); font-size: 14px;">Simulate your projected incremental pipeline velocity based on your current traffic scale.</p>
            
            <div class="calc-grid">
                <div>
                    <div class="slider-group">
                        <label>Current Monthly Unique Visitors: <span id="visitorVal" style="color: var(--accent-cyan); font-weight: 700;">25,000</span></label>
                        <input type="range" id="visitorSlider" min="5000" max="150000" step="5000" value="25000" oninput="updateCalculator()">
                    </div>
                    <div class="slider-group">
                        <label>Average Deal / Order Value ($): <span id="aovVal" style="color: var(--accent-amber); font-weight: 700;">$1,500</span></label>
                        <input type="range" id="aovSlider" min="100" max="10000" step="100" value="1500" oninput="updateCalculator()">
                    </div>
                </div>

                <div class="calc-output-box">
                    <span style="font-size: 12px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;">Projected Incremental Annual Revenue</span>
                    <div id="projectedRevenue" style="font-family: 'Space Grotesk', sans-serif; font-size: 38px; font-weight: 700; color: var(--accent-emerald); margin: 8px 0;">
                        +$342,000
                    </div>
                    <p style="font-size: 11px; color: var(--text-muted);">Based on an average +3.1x conversion lift benchmark across engineered vertical frameworks.</p>
                    <button class="cta-btn" onclick="alert('Blueprint audit request initialized.')">
                        Claim Your Industry Blueprint →
                    </button>
                </div>
            </div>
        </section>

        <!-- Footer -->
        <footer>
            &copy; 2026 VerticalForge Architecture Labs. All rights reserved. Pure Vanilla JS / CSS3 Execution.
        </li>
    </div>

    <script>
        // Vertical Data Store
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

        let currentVertical = 'b2b';

        function renderApp() {
            // Render Tabs
            const tabsContainer = document.getElementById('switcherTabs');
            tabsContainer.innerHTML = Object.keys(verticalsData).map(key => `
                <div class="vertical-tab ${currentVertical === key ? 'active' : ''}" onclick="switchVertical('${key}')">
                    <div class="tab-title">${verticalsData[key].title}</div>
                    <div class="tab-desc">${verticalsData[key].desc}</div>
                </div>
            `).join('');

            // Render Preview Card
            const data = verticalsData[currentVertical];
            const previewContainer = document.getElementById('previewCard');
            previewContainer.innerHTML = `
                <div class="preview-content">
                    <span style="font-size: 10px; font-weight: 700; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 1px;">Active Architecture Blueprint</span>
                    <h3>${data.headline}</h3>
                    <p style="color: var(--text-muted); font-size: 13px; line-height: 1.5;">${data.summary}</p>
                </div>
                <div class="preview-metrics">
                    <div class="metric-box">
                        <div class="metric-value">${data.metrics.m1}</div>
                        <div class="metric-label">${data.metrics.l1}</div>
                    </div>
                    <div class="metric-box">
                        <div class="metric-value">${data.metrics.m2}</div>
                        <div class="metric-label">${data.metrics.l2}</div>
                    </div>
                </div>
            `;
        }

        function switchVertical(key) {
            currentVertical = key;
            renderApp();
        }

        function updateCalculator() {
            const visitors = document.getElementById('visitorSlider').value;
            const aov = document.getElementById('aovSlider').value;

            document.getElementById('visitorVal').innerText = Number(visitors).toLocaleString();
            document.getElementById('aovVal').innerText = '$' + Number(aov).toLocaleString();

            // Calculation logic: visitors * 1.5% baseline conversion * 3.1x lift * aov * 12 months
            const incrementalRevenue = Math.round(visitors * 0.015 * 3.1 * aov * 12);
            document.getElementById('projectedRevenue').innerText = '+' + incrementalRevenue.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
        }

        // Initialize on load
        renderApp();
        updateCalculator();
    </script>
</body>
</html>
