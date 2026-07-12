import { useForm, ValidationError } from '@formspree/react'
import { useState } from 'react'
import { Send, Check, Loader2, MessageCircle } from 'lucide-react'

// Formspree endpoint — client-side POST, no backend needed (works on Vercel).
const FORMSPREE_ID = 'xjgnbzew'

const TOPICS = ['Feedback', 'Bug report', 'Feature request', 'Question', 'Other']

export default function FeedbackForm() {
  const [state, handleSubmit] = useForm(FORMSPREE_ID)
  const [topic, setTopic] = useState('Feedback')

  if (state.succeeded) {
    return (
      <section className="na-panel na-feedback na-feedback--done">
        <span className="na-feedback__icon na-feedback__icon--done"><Check size={28} /></span>
        <h2 className="na-h2">Thank you!</h2>
        <p className="na-text">
          Your message has been sent. Robel will get back to you soon — your feedback helps make Nira better.
        </p>
      </section>
    )
  }

  return (
    <section className="na-panel na-feedback">
      <div className="na-feedback__head">
        <span className="na-feedback__icon"><MessageCircle size={24} /></span>
        <div>
          <h2 className="na-h2">Feedback &amp; Contact</h2>
          <p className="na-feedback__sub">
            Found a bug, have an idea, or just want to say hi? Send a note — it goes straight to the creator.
          </p>
        </div>
      </div>

      <form className="na-feedback__form" onSubmit={handleSubmit}>
        <div className="na-feedback__row">
          <label className="na-field">
            <span className="na-field__label">Name</span>
            <input
              type="text"
              name="name"
              placeholder="Your name"
              autoComplete="name"
              required
            />
            <ValidationError field="name" prefix="Name" errors={state.errors} className="na-field__err" />
          </label>

          <label className="na-field">
            <span className="na-field__label">Email</span>
            <input
              type="email"
              name="email"
              placeholder="you@email.com"
              autoComplete="email"
              required
            />
            <ValidationError field="email" prefix="Email" errors={state.errors} className="na-field__err" />
          </label>
        </div>

        <label className="na-field">
          <span className="na-field__label">Topic</span>
          <select name="topic" value={topic} onChange={(e) => setTopic(e.target.value)}>
            {TOPICS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </label>

        <label className="na-field">
          <span className="na-field__label">Message</span>
          <textarea
            name="message"
            rows={5}
            placeholder="Tell us what's on your mind…"
            required
          />
          <ValidationError field="message" prefix="Message" errors={state.errors} className="na-field__err" />
        </label>

        <button type="submit" className="na-btn na-btn--send" disabled={state.submitting}>
          {state.submitting
            ? <><Loader2 size={16} className="na-spin" /> Sending…</>
            : <><Send size={16} /> Send Message</>}
        </button>
      </form>
    </section>
  )
}
