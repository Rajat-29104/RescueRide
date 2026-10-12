import Link from 'next/link'
import {
  ArrowDownRight,
  ArrowRight,
  CarFront,
  Check,
  Clock3,
  MapPin,
  Navigation,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

const features = [
  {
    title: 'A clear request, from the start',
    description: 'Share what happened, your vehicle details, and where you need help through a guided assistance flow.',
    icon: Clock3,
  },
  {
    title: 'Coordination with a mechanic',
    description: 'Request status, job progress, and direct communication keep the driver and service provider in sync.',
    icon: Wrench,
  },
  {
    title: 'Safety is part of the journey',
    description: 'Emergency contacts, SOS, and incident reporting are designed around the roadside context.',
    icon: ShieldCheck,
  },
]

const steps = [
  ['01', 'Tell us what happened', 'Describe the issue and add your vehicle and location details.'],
  ['02', 'Coordinate assistance', 'Follow request updates and communicate with the assigned mechanic.'],
  ['03', 'Close out the service', 'Review the completed job and keep a record of the assistance.'],
]

function Brand() {
  return (
    <Link className="brand-lockup" href="/" aria-label="RescueRide home">
      <span className="brand-mark"><CarFront size={20} strokeWidth={2.2} /></span>
      <span>RescueRide</span>
    </Link>
  )
}

function MapComposition() {
  return (
    <div className="dispatch-visual" role="img" aria-label="Illustrative map showing a roadside assistance route">
      <div className="map-terrain" aria-hidden="true">
        <div className="map-grid" />
        <div className="map-buildings">
          <span className="map-building map-building-a" />
          <span className="map-building map-building-b" />
          <span className="map-building map-building-c" />
          <span className="map-building map-building-d" />
          <span className="map-building map-building-e" />
          <span className="map-building map-building-f" />
          <span className="map-building map-building-g" />
          <span className="map-building map-building-h" />
          <span className="map-building map-building-i" />
          <span className="map-building map-building-j" />
          <span className="map-building map-building-k" />
          <span className="map-building map-building-l" />
          <span className="map-building map-building-m" />
          <span className="map-building map-building-n" />
        </div>
        <svg className="map-contours" viewBox="0 0 600 500" fill="none">
          <path d="M-30 101C76 88 68 180 165 168S273 51 348 79s128 61 285 1" stroke="#09152D" strokeWidth="36" strokeLinecap="round" opacity=".54" />
          <path d="M-30 101C76 88 68 180 165 168S273 51 348 79s128 61 285 1" stroke="#91A9C9" strokeWidth="28" strokeLinecap="round" opacity=".52" />
          <path d="M-20 327c92-37 117-1 174-52 66-59 113 5 171-30s88-100 157-81 92 35 144 3" stroke="#09152D" strokeWidth="46" strokeLinecap="round" opacity=".58" />
          <path d="M-20 327c92-37 117-1 174-52 66-59 113 5 171-30s88-100 157-81 92 35 144 3" stroke="#7188AE" strokeWidth="34" strokeLinecap="round" opacity=".48" />
          <path d="M97-24c6 81 64 83 49 159s-50 100-1 167 73 75 70 219M360-30c-24 78 10 105 75 150s63 68 48 125-57 111-9 203" stroke="#8FB3FF" strokeWidth="2" strokeDasharray="5 9" opacity=".45" />
          <path d="M-13 222h158m59-165v94m114 158h142m34-281v97M76 392h118m279-18h91" stroke="#9AB2D4" strokeWidth="8" strokeLinecap="round" opacity=".18" />
          <path d="M-13 222h158m59-165v94m114 158h142m34-281v97M76 392h118m279-18h91" stroke="#D3DDF0" strokeWidth="1.5" strokeDasharray="3 8" opacity=".35" />
          <path d="M286 237c42-66 86-97 147-99" stroke="#09152D" strokeWidth="13" strokeLinecap="round" opacity=".55" />
          <path d="M286 237c42-66 86-97 147-99" stroke="#58DED2" strokeWidth="4" strokeLinecap="round" opacity=".42" />
          <path className="map-route-line" d="M286 237c42-66 86-97 147-99" stroke="#58DED2" strokeWidth="3" strokeDasharray="7 8" strokeLinecap="round" />
          <path d="M270 247l17-15 4 23" stroke="#58DED2" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle className="map-pulse-ring map-pulse-ring-a" cx="287" cy="238" r="30" stroke="#14C8C7" opacity=".4" />
          <circle className="map-pulse-ring map-pulse-ring-b" cx="287" cy="238" r="47" stroke="#14C8C7" opacity=".26" />
        </svg>
      </div>
      <span className="map-label map-label-a">North approach</span>
      <span className="map-label map-label-b">Service corridor</span>
      <span className="map-label map-label-c">Roadside route</span>
      <div className="map-marker map-marker-driver"><CarFront size={19} /></div>
      <div className="map-marker map-marker-mechanic"><Wrench size={15} /></div>
      <div className="map-overlay-top">
        <span className="map-caption">Dispatch interface · illustrative</span>
        <span className="map-glass-tag glass"><span className="status-dot" /> Location-led</span>
      </div>
      <div className="map-overlay-bottom">
        <div className="map-card glass">
          <small>Rescue coordination</small>
          <strong>One clear view of the next step.</strong>
          <small>Request status · Location · Communication</small>
        </div>
        <div className="map-glass-tag glass"><Navigation size={14} /> Route view</div>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <main className="site-page">
      <div className="site-nav-wrap">
        <nav className="site-nav container-shell glass" aria-label="Main navigation">
          <Brand />
          <div className="site-nav-links">
            <Link href="#capabilities">What we do</Link>
            <Link href="#how-it-works">How it works</Link>
            <Link href="#for-providers">For mechanics</Link>
          </div>
          <div className="site-nav-actions">
            <Link className="btn btn-secondary" href="/auth/login">Sign in</Link>
            <Link className="btn btn-primary" href="/auth/register">Get started <ArrowRight size={15} /></Link>
          </div>
        </nav>
      </div>

      <section className="hero">
        <div className="hero-inner container-shell">
          <div className="hero-copy">
            <div className="hero-kicker"><span className="hero-kicker-dot" /> Roadside support, thoughtfully connected</div>
            <h1>When the road stops, <span>you’re not on your own.</span></h1>
            <p className="hero-description">
              RescueRide brings drivers and mechanics into one coordinated roadside assistance experience—from the first request to service completion.
            </p>
            <div className="hero-actions">
              <Link className="btn btn-primary" href="/auth/register?role=driver">Request assistance <ArrowRight size={16} /></Link>
              <Link className="btn btn-secondary" href="/auth/register?role=mechanic">I’m a mechanic <Wrench size={15} /></Link>
            </div>
            <div className="hero-note"><Check size={15} /> A connected workflow for requests, updates, and safety.</div>
          </div>
          <MapComposition />
        </div>
      </section>

      <section id="capabilities" className="section">
        <div className="container-shell">
          <div className="section-heading">
            <div className="eyebrow">Built for roadside moments</div>
            <h2>Less uncertainty. A clearer way forward.</h2>
            <p>From a breakdown report to the last service update, the product is shaped around the details that matter on the roadside.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ title, description, icon: Icon }) => (
              <article className="surface feature-card" key={title}>
                <div className="feature-icon"><Icon size={20} strokeWidth={1.9} /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="section steps-section">
        <div className="container-shell">
          <div className="section-heading">
            <div className="eyebrow">A simple sequence</div>
            <h2>Help, with fewer unknowns.</h2>
            <p>A structured flow makes the handoff between driver and mechanic easier to follow.</p>
          </div>
          <div className="step-grid">
            {steps.map(([number, title, description]) => (
              <article className="step" key={number}>
                <div className="step-number">{number}</div>
                <div><h3>{title}</h3><p>{description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="for-providers" className="section">
        <div className="container-shell">
          <div className="cta-panel">
            <div>
              <h2>For the people who get drivers moving again.</h2>
              <p>Mechanics can manage assistance requests and coordinate each job in one workspace.</p>
            </div>
            <Link className="btn" href="/auth/register?role=mechanic">Explore the mechanic workspace <ArrowDownRight size={16} /></Link>
          </div>
        </div>
      </section>

      <section id="about" className="section about-section">
        <div className="container-shell">
          <div className="section-heading about-section-heading">
            <div className="eyebrow">Our mission</div>
            <h2>About Us</h2>
            <p>Learn how RescueRide is bringing drivers and roadside mechanics into a clearer, more connected service experience.</p>
          </div>
          <div className="about-panel">
            <div className="about-copy">
              <h2>Roadside help should feel more connected.</h2>
              <p>
                RescueRide is built to make the moments after a breakdown easier to navigate. We bring drivers and mechanics into one clear flow for requesting help, coordinating service, and keeping everyone informed.
              </p>
            </div>
            <div className="about-values" aria-label="What guides RescueRide">
              <div className="about-value">
                <span className="about-value-icon"><MapPin size={18} /></span>
                <div><strong>Clear context</strong><span>Location and request details stay together.</span></div>
              </div>
              <div className="about-value">
                <span className="about-value-icon"><Wrench size={18} /></span>
                <div><strong>Connected people</strong><span>Drivers and mechanics can follow the same service journey.</span></div>
              </div>
              <div className="about-value">
                <span className="about-value-icon"><ShieldCheck size={18} /></span>
                <div><strong>Safety in mind</strong><span>Designed with roadside communication and safety in view.</span></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container-shell footer-inner">
          <Brand />
          <div>Roadside assistance coordination, designed around people.</div>
          <div className="footer-links">
            <Link href="/auth/login">Sign in</Link>
            <Link href="/auth/register">Create account</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
