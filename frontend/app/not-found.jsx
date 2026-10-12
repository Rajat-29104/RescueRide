import Link from 'next/link'
import { ArrowLeft, CarFront } from 'lucide-react'

export default function NotFound() {
  return (
    <main className="auth-main" style={{ minHeight: '100vh' }}>
      <section className="auth-card surface" style={{ textAlign: 'center' }}>
        <span className="brand-mark" style={{ margin: '0 auto 18px' }}><CarFront size={20} /></span>
        <div className="eyebrow">404 · Route not found</div>
        <h2 style={{ marginTop: 7 }}>This route isn’t on the map.</h2>
        <p>Check the address or return to a RescueRide workspace.</p>
        <Link href="/" className="btn btn-primary" style={{ width: '100%' }}><ArrowLeft size={15} /> Return home</Link>
      </section>
    </main>
  )
}
