import { useState } from 'react'
import LightPillar from './LightPillar'
import BorderGlow from './BorderGlow'
import ProfileCard from './ProfileCard'
import LogoLoop from './LogoLoop'
import { SiFastapi, SiReact, SiTailwindcss, SiOpenrouter, SiSqlite, SiPython, SiDocker, SiX } from 'react-icons/si'
import { FaGithub, FaDiscord, FaLinkedin, FaEnvelope } from 'react-icons/fa'

// Social / external links (edit to match your real profiles).
const LINKS = {
  github: 'https://github.com/robelbiruk',
  docs: 'https://github.com/robelbiruk/nira#readme',
  changelog: 'https://github.com/robelbiruk/nira/releases',
  linkedin: 'https://www.linkedin.com/in/robelbiruk',
  portfolio: 'https://robelbiruk.github.io',
  email: 'mailto:robel.biruk@example.com',
  discord: 'https://discord.gg/nira',
  x: 'https://x.com/robelbiruk',
}

const FEATURES = [
  { icon: '🧠', title: 'Long-term Memory', desc: 'Stores preferences and conversation history.' },
  { icon: '🌐', title: 'Web & Research', desc: 'Search the web, Reddit, GitHub, arXiv, and more.' },
  { icon: '📂', title: 'File Assistant', desc: 'Read, write, organize, and summarize files.' },
  { icon: '🖥', title: 'Terminal', desc: 'Execute local commands safely.' },
  { icon: '🎤', title: 'Voice', desc: 'Speech-to-text and text-to-speech.' },
  { icon: '🧮', title: 'Calculator', desc: 'Reliable mathematical computations.' },
  { icon: '🤖', title: 'Multiple AI Providers', desc: 'OpenRouter, Gemini, NVIDIA NIM, Ollama, and more.' },
  { icon: '🔌', title: 'Plugin Ready', desc: 'Extend Nira with custom tools and integrations.' },
]

const STACK = [
  'Python', 'FastAPI', 'React', 'Tailwind CSS', 'SQLite', 'OpenRouter',
  'Playwright', 'Whisper', 'Kokoro TTS', 'Docker',
]

const ROADMAP_DONE = ['Chat', 'Memory', 'Browser', 'Terminal', 'File Tools']
const ROADMAP_PLANNED = [
  'Voice Assistant', 'Plugin Marketplace', 'Mobile App',
  'Smart Home Integration', 'Multi-Agent System',
]

const CREDITS = ['FastAPI', 'React', 'Tailwind CSS', 'OpenRouter', 'Playwright', 'Whisper', 'SQLite']

// Logo marquee data — real brand icons (react-icons) on a black backdrop.
const ICON_STYLE = { color: '#e7e7ef', fontSize: 26 }
const CREDIT_LOGOS = [
  { node: <SiReact style={ICON_STYLE} />, title: 'React', href: 'https://react.dev' },
  { node: <SiTailwindcss style={ICON_STYLE} />, title: 'Tailwind CSS', href: 'https://tailwindcss.com' },
  { node: <SiFastapi style={ICON_STYLE} />, title: 'FastAPI', href: 'https://fastapi.tiangolo.com' },
  { node: <SiOpenrouter style={ICON_STYLE} />, title: 'OpenRouter', href: 'https://openrouter.ai' },
  { node: <SiSqlite style={ICON_STYLE} />, title: 'SQLite', href: 'https://sqlite.org' },
  { node: <SiPython style={ICON_STYLE} />, title: 'Python', href: 'https://python.org' },
  { node: <SiDocker style={ICON_STYLE} />, title: 'Docker', href: 'https://docker.com' },
]
const COMMUNITY_LOGOS = [
  { node: <FaGithub style={ICON_STYLE} />, href: LINKS.github, title: 'GitHub' },
  { node: <FaDiscord style={ICON_STYLE} />, href: LINKS.discord, title: 'Discord' },
  { node: <FaLinkedin style={ICON_STYLE} />, href: LINKS.linkedin, title: 'LinkedIn' },
  { node: <SiX style={ICON_STYLE} />, href: LINKS.x, title: 'X' },
  { node: <FaEnvelope style={ICON_STYLE} />, href: LINKS.email, title: 'Email' },
]

const STATS = [
  { label: 'Conversations', value: '523' },
  { label: 'Commands Executed', value: '1,942' },
  { label: 'Research Sessions', value: '314' },
  { label: 'Files Processed', value: '428' },
  { label: 'Memory Entries', value: '126' },
  { label: 'Uptime', value: '99.9%' },
]

const ARCH = ['User', 'Nira Core', 'Planner', 'Memory', 'Tool Router', 'AI Provider']

function ExtLink({ href, children, primary }) {
  return (
    <a className={`btn-ghost ${primary ? 'btn-primary' : ''}`} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  )
}

export default function AboutPage({ onSend }) {
  const [storyOpen, setStoryOpen] = useState(false)

  const askNira = () => {
    if (onSend) onSend("Tell me about yourself, Nira — who are you and what inspired your name?")
  }

  return (
    <div className="about-page">
      <div className="about-hero-wrap">
        <LightPillar
          className="about-lightpillar"
          topColor="#5227FF"
          bottomColor="#FF9FFC"
          intensity={1}
          rotationSpeed={0.3}
          glowAmount={0.002}
          pillarWidth={3}
          pillarHeight={0.4}
          noiseIntensity={0.5}
          pillarRotation={25}
          interactive={false}
          mixBlendMode="screen"
          quality="high"
        />
        {/* HERO */}
        <section className="about-hero">
          <img className="about-mark" src="/favicon-32.png" alt="Nira" width={48} height={48} />
          <h1 className="about-title">Nira AI</h1>
          <p className="about-tagline">
            A local-first intelligent desktop assistant designed to help you think, build,
            research, and automate everyday tasks.
          </p>
          <span className="about-version">Version 0.9.0 Beta</span>
          <div className="about-cta">
            <ExtLink href={LINKS.github} primary>⭐ GitHub</ExtLink>
            <ExtLink href={LINKS.docs}>📖 Documentation</ExtLink>
            <ExtLink href={LINKS.changelog}>🚀 Changelog</ExtLink>
          </div>
        </section>

        {/* INTERACTIVE GREETING */}
        <section className="about-greeting-card">
          <div className="about-greeting-avatar"><img src="/favicon-32.png" alt="Nira" width={36} height={36} /></div>
          <div className="about-greeting-body">
            <p className="about-greeting-text">
              Hello, I'm <b>Nira</b>. I'm your AI assistant, built to help you research, create,
              and automate tasks. Here's a little about me…
            </p>
            <button className="btn-ghost btn-primary" onClick={askNira}>💬 Ask Nira about herself</button>
          </div>
        </section>
      </div>

      {/* divider below hero */}
      <div className="about-divider" />

      {/* WHAT IS NIRA */}
      <section className="about-section">
        <h2 className="about-h2">What is Nira?</h2>
        <blockquote className="about-quote">
          Nira is a Python-powered AI desktop assistant that combines modern language models
          with local tools, browser automation, research capabilities, memory, and voice
          interaction. Rather than relying solely on one AI model, Nira uses specialized tools
          to perform tasks accurately and efficiently.
        </blockquote>
      </section>

      {/* FEATURES */}
      <section className="about-section">
        <h2 className="about-h2">Features</h2>
        <div className="about-feature-grid">
          {FEATURES.map((f) => (
            <BorderGlow
              key={f.title}
              className="about-feature-card"
              edgeSensitivity={30}
              glowColor="40 80 80"
              backgroundColor="#120F17"
              borderRadius={18}
              glowRadius={30}
              glowIntensity={1}
              coneSpread={25}
              animated={false}
              colors={['#c084fc', '#f472b6', '#38bdf8']}
              fillOpacity={0.5}
            >
              <div className="about-feature-icon">{f.icon}</div>
              <div className="about-feature-title">{f.title}</div>
              <div className="about-feature-desc">{f.desc}</div>
            </BorderGlow>
          ))}
        </div>
      </section>

      {/* ARCHITECTURE + STACK */}
      <section className="about-section about-split">
        <div>
          <h2 className="about-h2">Architecture</h2>
          <div className="about-arch">
            {ARCH.map((node, i) => (
              <div key={node} className="about-arch-node">
                <span>{node}</span>
                {i < ARCH.length - 1 && <span className="about-arch-arrow">↓</span>}
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="about-h2">Technology Stack</h2>
          <div className="about-badges">
            {STACK.map((s) => (
              <span className="about-badge" key={s}>{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CREATOR */}
      <section className="about-section">
        <h2 className="about-h2">Meet the Creator</h2>
        <div className="about-creator">
          <div className="about-creator-photo">
            <ProfileCard
              avatarUrl="/Me.jpg"
              name="Robel Biruk"
              title="Pharmacy Student · Software Developer"
              handle="robelbiruk"
              status="Building Nira"
              contactText="Email Me"
              behindGlowColor="rgba(125, 190, 255, 0.67)"
              innerGradient="linear-gradient(145deg,#60496e8c 0%,#71C4FF44 100%)"
              enableTilt
              showUserInfo
              onContactClick={() => window.open(LINKS.email, '_blank')}
            />
          </div>
          <div className="about-creator-body">
            <h3 className="about-creator-name">Robel Biruk</h3>
            <p className="about-creator-bio">
              Pharmacy student and software developer passionate about AI, automation, and
              human-centered interfaces.
            </p>
            <div className="about-cta">
              <ExtLink href={LINKS.github}>GitHub</ExtLink>
              <ExtLink href={LINKS.linkedin}>LinkedIn</ExtLink>
              <ExtLink href={LINKS.portfolio}>Portfolio</ExtLink>
              <ExtLink href={LINKS.email}>Email</ExtLink>
            </div>
          </div>
        </div>
      </section>

      {/* OPEN SOURCE */}
      <section className="about-section about-split">
        <div>
          <h2 className="about-h2">Open Source</h2>
          <p className="about-text">
            Nira is released under the <b>MIT License</b>. Contributions are welcome — bug
            reports, feature requests, and pull requests all help make Nira better.
          </p>
          <div className="about-cta">
            <ExtLink href={LINKS.github} primary>🔧 Contribute</ExtLink>
            <ExtLink href={`${LINKS.github}/issues`}>🐞 Report Bug</ExtLink>
            <ExtLink href={`${LINKS.github}/discussions`}>💬 Discussions</ExtLink>
          </div>
        </div>
        <div>
          <h2 className="about-h2">Roadmap</h2>
          <ul className="about-list">
            {ROADMAP_DONE.map((r) => (
              <li key={r} className="about-done">✓ {r}</li>
            ))}
            {ROADMAP_PLANNED.map((r) => (
              <li key={r} className="about-planned">○ {r}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* PRIVACY */}
      <section className="about-section">
        <h2 className="about-h2">Privacy</h2>
        <ul className="about-list about-list-cols">
          <li><b>Local data storage</b> — conversations and memory live on your machine (SQLite).</li>
          <li><b>What is sent to AI providers</b> — only your prompt and tool context, nothing else.</li>
          <li><b>API key handling</b> — keys stay in your local config; never committed or shared.</li>
          <li><b>Telemetry</b> — none. Nira does not phone home.</li>
        </ul>
      </section>

      {/* CREDITS */}
      <section className="about-section">
        <h2 className="about-h2">Credits</h2>
        <p className="about-text">Built on the shoulders of these open-source projects:</p>
        <div className="about-logoloop">
          <LogoLoop
            logos={CREDIT_LOGOS}
            speed={80}
            direction="left"
            logoHeight={26}
            gap={40}
            pauseOnHover
            fadeOut
            scaleOnHover
            ariaLabel="Open-source projects Nira is built on"
          />
        </div>
      </section>

      {/* COMMUNITY */}
      <section className="about-section">
        <h2 className="about-h2">Community</h2>
        <div className="about-logoloop">
          <LogoLoop
            logos={COMMUNITY_LOGOS}
            speed={90}
            direction="left"
            logoHeight={26}
            gap={48}
            pauseOnHover
            fadeOut
            scaleOnHover
            ariaLabel="Nira community links"
          />
        </div>
        <div className="about-cta" style={{ marginTop: 16 }}>
          <ExtLink href={LINKS.github} primary>⭐ Star on GitHub</ExtLink>
        </div>
      </section>

      {/* VERSION */}
      <section className="about-section about-split">
        <div>
          <h2 className="about-h2">Version Information</h2>
          <div className="about-kv">
            <div><span>Nira</span><b>0.9.0 Beta</b></div>
            <div><span>Build</span><b>2026.07.11</b></div>
            <div><span>Python</span><b>3.14</b></div>
            <div><span>React</span><b>19</b></div>
            <div><span>API Status</span><b className="about-ok">● Online</b></div>
          </div>
        </div>
        <div>
          <h2 className="about-h2">Fun Statistics</h2>
          <div className="about-stats">
            {STATS.map((s) => (
              <div className="about-stat" key={s.label}>
                <div className="about-stat-value">{s.value}</div>
                <div className="about-stat-label">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* EASTER EGG */}
      <section className="about-section about-easter">
        <h2 className="about-h2">A little something</h2>
        <button className="about-egg-q" onClick={() => setStoryOpen((v) => !v)}>
          💡 What inspired the name “Nira”?
        </button>
        {storyOpen && (
          <p className="about-quote">
            “Nira” means “of the water / lotus” in several languages — calm on the surface,
            deep underneath. That's the kind of assistant I wanted to build: quiet, present,
            and surprisingly capable when you need it. Tap the core anytime and just talk.
          </p>
        )}
      </section>
    </div>
  )
}
