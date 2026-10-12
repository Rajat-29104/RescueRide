import Link from 'next/link'
import { ArrowRight, CarFront, MapPin, ShieldCheck } from 'lucide-react'

const steps = [
  { number: '01', title: 'Your profile', text: 'Set up the contact details used to coordinate assistance.', icon: ShieldCheck },
  { number: '02', title: 'Your vehicle', text: 'Keep vehicle information available for a roadside request.', icon: CarFront },
  { number: '03', title: 'Your safety', text: 'Review emergency contacts and roadside safety options.', icon: MapPin },
]

export default function OnboardingPage() {
  return (
    <main className="auth-page">
      <aside className="auth-aside">
        <div className="auth-ambient" aria-hidden="true">
          <span className="auth-orb auth-orb-one" />
          <span className="auth-orb auth-orb-two" />
          <span className="auth-orbit auth-orbit-one" />
          <span className="auth-orbit auth-orbit-two" />
          <span className="auth-route" />
          <span className="auth-map-node auth-map-node-one" />
          <span className="auth-map-node auth-map-node-two" />
        </div>
        <Link className="brand-lockup" href="/">
          <span className="brand-mark"><CarFront size={20} /></span> RescueRide
        </Link>
        <div className="auth-aside-copy">
          <div className="eyebrow" style={{ color: '#9fdedb' }}>A better-prepared journey</div>
          <h1>Set up the details that make roadside support smoother.</h1>
          <p>Your vehicle and safety information help make each assistance request more useful.</p>
        </div>
        <div className="auth-assurance"><ShieldCheck size={16} /> Your information should only be shared with the connected service.</div>
      </aside>
      <section className="auth-main">
        <div className="auth-card surface">
          <div className="eyebrow">Getting started</div>
          <h2 style={{ marginTop: 6 }}>A few useful details</h2>
          <p>Sign in to save your profile and vehicle details. You can update emergency contacts from your driver workspace.</p>
          <div className="content-grid" style={{ gap: 10 }}>
            {steps.map(({ number, title, text, icon: Icon }) => (
              <article key={number} className="action-link" style={{ justifyContent: 'start', padding: 14 }}>
                <span className="action-link-icon"><Icon size={17} /></span>
                <span><strong style={{ display: 'block', fontSize: 12 }}>{number} · {title}</strong><small style={{ color: 'var(--muted)', fontWeight: 400 }}>{text}</small></span>
              </article>
            ))}
          </div>
          <div className="form-notice" style={{ marginTop: 18 }}>Your saved details are private to your RescueRide account.</div>
          <Link href="/auth/login" className="btn btn-primary" style={{ width: '100%', marginTop: 17 }}>Continue to sign in <ArrowRight size={15} /></Link>
        </div>
      </section>
    </main>
  )
}
