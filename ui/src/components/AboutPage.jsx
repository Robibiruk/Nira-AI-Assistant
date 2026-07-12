import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'motion/react'
import {
  Zap, ShieldCheck, Puzzle, BookOpen, ListChecks, Code, AlertCircle, Lightbulb,
  MessageSquare, Brain, LayoutGrid, Globe, Microscope, Settings, MessageCircle, Briefcase, Mail,
  AtSign, Video, MessagesSquare, Newspaper, FileText, ChevronRight, Star, Check, Circle, Heart,
} from 'lucide-react'
import Favicon from './Favicon'
import './about.css'

// ---- Animated count-up (gradient numbers) ----
function useCountUp(target, run) {
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!run) return
    let raf
    const start = performance.now()
    const dur = 1400
    const tick = (now) => {
      const p = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - p, 3)
      setVal(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run])
  return val
}

function Stat({ num, label, run }) {
  const display = useCountUp(num, run)
  return (
    <motion.div className="na-card na-stat" whileHover={{ y: -4 }}>
      <span className="na-stat__num">
        {num === 99.9 ? '99.9%' : display.toLocaleString()}
      </span>
      <span className="na-stat__label">{label}</span>
    </motion.div>
  )
}

// Reveal-on-scroll wrapper
function Reveal({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

const STATS = [
  { num: 523, label: 'Conversations' },
  { num: 1942, label: 'Commands Executed' },
  { num: 314, label: 'Research Sessions' },
  { num: 428, label: 'Files Processed' },
  { num: 126, label: 'Memory Entries' },
  { num: 99.9, label: 'Uptime' },
]

const FEATURES = [
  { icon: MessageSquare, title: 'Chat', desc: 'Natural, multi-turn conversations with powerful AI models.' },
  { icon: Brain, title: 'Memory', desc: 'Long-term recall of your context, facts and preferences.' },
  { icon: LayoutGrid, title: 'Projects', desc: 'Organize chats, memories and research into workspaces.' },
  { icon: Globe, title: 'Browser', desc: 'Browse, summarize and act on web content in-app.' },
  { icon: Microscope, title: 'Research', desc: 'Deep research with citations and structured notes.' },
  { icon: Settings, title: 'Settings', desc: 'Fine-tune models, providers, tools and behavior.' },
]

const SOCIALS = [
  { fa: 'fa-brands fa-github', label: 'GitHub', href: 'https://github.com/Robibiruk' },
  { fa: 'fa-brands fa-linkedin-in', label: 'LinkedIn', href: 'https://www.linkedin.com/in/robel-biruk-5923101b5/' },
  { fa: 'fa-solid fa-envelope', label: 'Email', href: 'mailto:natim7520@gmail.com' },
  { fa: 'fa-brands fa-instagram', label: 'Instagram', href: 'https://www.instagram.com/ynw_rob.i/' },
  { fa: 'fa-brands fa-tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@ynwrobiii' },
  { fa: 'fa-brands fa-pinterest', label: 'Pinterest', href: 'https://www.pinterest.com/ynwrobii/' },
  { fa: 'fa-solid fa-globe', label: 'Portfolio', href: 'https://robel-portfolio-website.netlify.app/' },
]

const QUICK_LINKS = [
  { icon: BookOpen, title: 'Documentation', desc: 'Guides and references', href: 'https://github.com/Robibiruk/Nira-AI-Assistant#readme' },
  { icon: ListChecks, title: 'Changelog', desc: 'What changed recently', href: 'https://github.com/Robibiruk/Nira-AI-Assistant/releases' },
  { icon: Code, title: 'GitHub Repository', desc: 'Source code', href: 'https://github.com/Robibiruk/Nira-AI-Assistant' },
  { icon: AlertCircle, title: 'Report an Issue', desc: 'Found a bug?', href: 'https://github.com/Robibiruk/Nira-AI-Assistant/issues/new' },
  { icon: Lightbulb, title: 'Request a Feature', desc: 'Suggest an idea', href: 'mailto:natim7520@gmail.com' },
]

const ROAD_DONE = ['Smart Chat', 'Browser', 'File Tools', 'Research', 'Voice Assistant']
const ROAD_TODO = ['Plugin Marketplace', 'Mobile App', 'Multi-Agent System', 'Smart Home Integration']

const VERSIONS = [
  ['Nira Version', '0.9 Beta'],
  ['Build', '2026.07.01'],
  ['Python', '3.12'],
  ['React', '18.3'],
  ['API Status', 'Operational'],
  ['Environment', 'Desktop'],
]

const CHECKLIST = ['Multi-model AI', 'Tool-based Intelligence', 'Long-term Memory', 'Privacy First', 'Open Source']

export default function AboutPage() {
  const statsRef = useRef(null)
  const statsInView = useInView(statsRef, { once: true, margin: '-80px' })

  return (
    <motion.div
      className="nira-about"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      <div className="na-grid">
        {/* Header */}
        <Reveal className="na-col-12">
          <header className="na-header">
            <div>
              <h1 className="na-h1">About Nira</h1>
              <p className="na-header__sub">Learn more about your intelligent desktop assistant.</p>
            </div>
            <span className="na-version-badge"><Star size={14} /> Nira 0.9 Beta</span>
          </header>
        </Reveal>

        {/* Hero (8) + Quick Links (4) */}
        <Reveal className="na-col-8">
          <section className="na-panel na-hero">
            <div className="na-hero__inner">
              <Favicon className="na-favicon--hero" />
              <div className="na-hero__copy">
                <h2 className="na-gradient">Nira AI</h2>
                <p>
                  Your intelligent desktop assistant built to help you think, research, create and automate.
                </p>
                <p>
                  Nira combines powerful AI models with specialized tools, memory and voice into one seamless desktop experience.
                </p>
                <div className="na-pills">
                  <span className="na-pill"><Zap size={16} /> Fast</span>
                  <span className="na-pill"><ShieldCheck size={16} /> Private</span>
                  <span className="na-pill"><Puzzle size={16} /> Extensible</span>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal className="na-col-4" delay={0.08}>
          <section className="na-panel na-quicklinks">
            <h2 className="na-h3">Quick Links</h2>
            {QUICK_LINKS.map((l) => (
              <a key={l.title} className="na-ql-item" href={l.href} target="_blank" rel="noreferrer">
                <span className="na-ql-icon"><l.icon size={18} /></span>
                <span className="na-ql-text">
                  <span className="na-ql-title">{l.title}</span>
                  <span className="na-ql-desc">{l.desc}</span>
                </span>
                <ChevronRight className="na-ql-chev" size={16} />
              </a>
            ))}
            <a className="na-btn na-btn--purple" href="https://github.com/Robibiruk/Nira-AI-Assistant" target="_blank" rel="noreferrer">
              <Star size={16} /> Star on GitHub
            </a>
          </section>
        </Reveal>

        {/* Version + Stats — fixed 537x385 boxes (Option 2) + rotating astronaut (PC/large only) */}
        <div className="na-col-12">
          <div className="na-fixed-row">
            <Reveal className="na-fixed-box na-fixed-box--sm">
              <section className="na-panel">
                <h2 className="na-h2">Version Information</h2>
                <div className="na-version-grid">
                  <div className="na-vtable">
                    {VERSIONS.map(([k, v]) => (
                      <div className="na-vrow" key={k}><span>{k}</span><b>{v}</b></div>
                    ))}
                  </div>
                  <Favicon className="na-favicon--globe" />
                </div>
              </section>
            </Reveal>

            <Reveal className="na-fixed-box na-fixed-box--sm" delay={0.08}>
              <section className="na-panel">
                <h2 className="na-h2">Statistics</h2>
                <div className="na-stats" ref={statsRef}>
                  {STATS.map((s) => (
                    <Stat key={s.label} num={s.num} label={s.label} run={statsInView} />
                  ))}
                </div>
              </section>
            </Reveal>
          </div>
        </div>

        {/* What is Nira (full) + Core Features (full) — stacked vertically */}
        <Reveal className="na-col-12">
          <section className="na-panel">
            <h2 className="na-h2">What is Nira?</h2>
            <p className="na-text">
              Nira is a calm, intelligent desktop companion that blends conversation, specialized tools,
              long-term memory and natural voice into a single operating-system-like experience.
            </p>
            <ul className="na-checklist">
              {CHECKLIST.map((c) => (
                <li key={c}><Check className="na-check" size={18} /> {c}</li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal className="na-col-12" delay={0.08}>
          <section className="na-panel">
            <h2 className="na-h2">Core Features</h2>
            <div className="na-features">
              {FEATURES.map((f) => (
                <motion.div key={f.title} className="na-card na-feature" whileHover={{ y: -4 }}>
                  <span className="na-feature__icon"><f.icon size={22} /></span>
                  <span className="na-feature__title">{f.title}</span>
                  <span className="na-feature__desc">{f.desc}</span>
                </motion.div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Community (full) */}
        <Reveal className="na-col-12">
          <section className="na-panel na-community">
            <h2 className="na-h2">Join the Community</h2>
            <div className="na-socials">
              {SOCIALS.map((s) => (
                <motion.a
                  key={s.label}
                  className="na-social"
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={s.label}
                  whileHover={{ rotate: 5, scale: 1.08 }}
                >
                  <i className={s.fa} />
                </motion.a>
              ))}
            </div>
          </section>
        </Reveal>

        {/* Creator (8) + Roadmap (4) */}
        <Reveal className="na-col-8">
          <section className="na-panel na-creator">
            <img className="na-creator__avatar" src="/Me.jpg" alt="Robel Biruk" />
            <div className="na-creator__body">
              <div className="na-creator__head">
                <p className="na-creator__name">Robel Biruk</p>
                <p className="na-creator__sub">Developer &amp; Creator of Nira AI</p>
              </div>
              <p className="na-creator__bio">
                Pharmacy student and software developer passionate about AI, automation and human-centered interfaces.
              </p>
              <p className="na-creator__install">
                <i className="fa-solid fa-mobile-screen" /> Installable as a PWA — use your browser&apos;s “Install app” / “Add to Home Screen” option.
              </p>
              <div className="na-creator__links">
                <a className="na-btn" href="https://github.com/Robibiruk" target="_blank" rel="noreferrer"><i className="fa-brands fa-github" /> GitHub</a>
                <a className="na-btn" href="https://www.linkedin.com/in/robel-biruk-5923101b5/" target="_blank" rel="noreferrer"><i className="fa-brands fa-linkedin-in" /> LinkedIn</a>
                <a className="na-btn" href="https://robel-portfolio-website.netlify.app/" target="_blank" rel="noreferrer"><i className="fa-solid fa-globe" /> Portfolio</a>
              </div>
            </div>
          </section>
        </Reveal>

        <Reveal className="na-col-4" delay={0.08}>
          <section className="na-panel">
            <h2 className="na-h2">Roadmap</h2>
            <div className="na-timeline">
              <div className="na-road-group">Completed</div>
              {ROAD_DONE.map((r) => (
                <div className="na-road-item" key={r}><Check className="na-road-done" size={18} /> {r}</div>
              ))}
              <div className="na-road-group">Upcoming</div>
              {ROAD_TODO.map((r) => (
                <div className="na-road-item" key={r}><Circle className="na-road-todo" size={18} /> {r}</div>
              ))}
            </div>
          </section>
        </Reveal>

        {/* License + Contributing compact cards */}
        <Reveal className="na-col-12">
          <section className="na-panel na-license">
            <h2 className="na-h2">Open Source</h2>
            <div className="na-license__cards">
              <div className="na-license__card na-license__card--license">
                <div className="na-license__icon">🛡</div>
                <div className="na-license__body">
                  <p className="na-license__title">License</p>
                  <p className="na-license__desc">
                    Nira AI is open source and freely available under the MIT License.
                  </p>
                  <p className="na-license__meta">Copyright © 2026 Robel Biruk</p>
                  <a className="na-btn na-btn--green" href="https://github.com/Robibiruk/Nira-AI-Assistant/blob/main/LICENSE.md" target="_blank" rel="noreferrer"><FileText size={16} /> View Full License</a>
                </div>
              </div>
              <div className="na-license__card na-license__card--contrib">
                <div className="na-license__icon">🤝</div>
                <div className="na-license__body">
                  <p className="na-license__title">Contributing</p>
                  <p className="na-license__desc">
                    Help improve Nira AI by reporting bugs, suggesting ideas, improving docs, or contributing code.
                  </p>
                  <a className="na-btn" href="https://github.com/Robibiruk/Nira-AI-Assistant/blob/main/CONTRIBUTING.md" target="_blank" rel="noreferrer"><FileText size={16} /> Contribution Guide</a>
                </div>
              </div>
            </div>
          </section>
        </Reveal>

        {/* Footer (full) */}
        <Reveal className="na-col-12">
          <footer className="na-footer">
            <div className="na-footer__marquee">
              <p className="na-footer__quote audiowide-regular">
                " Nira is more than just an assistant—it&apos;s a partner in your journey to get things done.&nbsp;&nbsp;&nbsp;
              </p>
              <p className="na-footer__quote audiowide-regular" aria-hidden="true">
                " Nira is more than just an assistant—it&apos;s a partner in your journey to get things done.&nbsp;&nbsp;&nbsp;
              </p>
            </div>
            <div className="na-footer__bottom">
              <span>Made with <Heart size={14} className="na-heart" /> by Robel Biruk</span>
              <span className="center">Thank you for being part of the journey.</span>
              <span>&copy;2026 Nira AI</span>
              <Favicon className="na-favicon--orb" />
            </div>
          </footer>
        </Reveal>
      </div>
    </motion.div>
  )
}
