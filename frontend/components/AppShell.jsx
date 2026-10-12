'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Activity,
  Bell,
  CarFront,
  ClipboardList,
  Compass,
  FileWarning,
  Gauge,
  History,
  Home,
  LifeBuoy,
  MapPinned,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
  LogOut,
} from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const roleDetails = {
  driver: {
    title: 'Driver workspace',
    items: [
      ['Dashboard', '/dashboard/driver', Home],
      ['Request assistance', '/dashboard/driver/requests/new', LifeBuoy],
      ['Explore providers', '/dashboard/driver/explore', Compass],
      ['My requests', '/dashboard/driver/requests', ClipboardList],
      ['Vehicles & service', '/dashboard/driver/vehicles', CarFront],
      ['Safety & contacts', '/dashboard/driver/safety', ShieldCheck],
      ['Notifications', '/dashboard/driver/notifications', Bell],
      ['Profile & settings', '/dashboard/driver/settings', Settings2],
    ],
  },
  mechanic: {
    title: 'Mechanic workspace',
    items: [
      ['Dashboard', '/dashboard/mechanic', Home],
      ['Incoming requests', '/dashboard/mechanic/requests', ClipboardList],
      ['Active jobs', '/dashboard/mechanic/jobs', Wrench],
      ['Job history', '/dashboard/mechanic/history', History],
      ['Service area', '/dashboard/mechanic/locations', MapPinned],
      ['Notifications', '/dashboard/mechanic/notifications', Bell],
      ['Profile & settings', '/dashboard/mechanic/settings', Settings2],
    ],
  },
  admin: {
    title: 'Administration',
    items: [
      ['Dashboard', '/dashboard/admin', Gauge],
      ['People & access', '/dashboard/admin/users', Users],
      ['Mechanic verification', '/dashboard/admin/mechanics', ShieldCheck],
      ['Requests', '/dashboard/admin/requests', ClipboardList],
      ['Incidents & reports', '/dashboard/admin/incidents', FileWarning],
      ['Live operations', '/dashboard/admin/operations', Activity],
      ['Analytics', '/dashboard/admin/analytics', Compass],
    ],
  },
}

export default function AppShell({ role, children }) {
  const pathname = usePathname()
  const router = useRouter()
  const [account, setAccount] = useState(null)
  const [authState, setAuthState] = useState(() => {
    const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    return configured
      ? { loading: true, error: '' }
      : { loading: false, error: 'Authentication is not configured. Set the public Supabase URL and publishable key for the frontend.' }
  })
  const [signingOut, setSigningOut] = useState(false)
  const details = roleDetails[role]
  const activeItem = (href) => href === pathname || (href !== `/dashboard/${role}` && pathname.startsWith(`${href}/`))

  useEffect(() => {
    let active = true
    let authSubscription
    let supabase

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return undefined

    try {
      supabase = getSupabaseBrowserClient()
    } catch {
      return undefined
    }

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.replace('/auth/login')
      }
    })
    authSubscription = data.subscription

    async function verifyAccount() {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError) throw userError
        if (!user) {
          router.replace('/auth/login')
          return
        }

        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', user.id)
          .maybeSingle()
        if (profileError) throw profileError

        const accountRole = profile?.role || user.user_metadata?.role
        if (!['driver', 'mechanic', 'admin'].includes(accountRole)) {
          throw new Error('Your account role could not be verified. Contact RescueRide support.')
        }
        if (accountRole !== role) {
          router.replace(`/dashboard/${accountRole}`)
          return
        }
        if (!active) return

        setAccount({ user, name: profile?.full_name || user.user_metadata?.full_name || user.email })
        setAuthState({ loading: false, error: '' })
      } catch (error) {
        if (active) setAuthState({ loading: false, error: error.message || 'Could not verify your account.' })
      }
    }

    verifyAccount()

    return () => {
      active = false
      authSubscription?.unsubscribe()
    }
  }, [role, router])

  async function signOut() {
    setSigningOut(true)
    try {
      const { error } = await getSupabaseBrowserClient().auth.signOut()
      if (error) throw error
      router.replace('/auth/login')
      router.refresh()
    } catch (error) {
      setAuthState({ loading: false, error: error.message || 'Could not sign out.' })
      setSigningOut(false)
    }
  }

  if (authState.loading) {
    return <main className="auth-page"><div className="surface panel" role="status">Checking your RescueRide account…</div></main>
  }

  if (authState.error) {
    return (
      <main className="auth-page">
        <section className="surface panel">
          <div className="form-notice form-notice-error" role="alert">{authState.error}</div>
          <Link className="btn btn-primary" href="/auth/login" style={{ marginTop: 16 }}>Sign in again</Link>
        </section>
      </main>
    )
  }

  return (
    <div className="app-layout">
      <aside className="app-sidebar" aria-label={`${details.title} navigation`}>
        <Link className="brand-lockup" href="/">
          <span className="brand-mark"><CarFront size={20} strokeWidth={2.2} /></span>
          <span>RescueRide</span>
        </Link>
        <div className="sidebar-section-label">{details.title}</div>
        <nav className="sidebar-nav">
          {details.items.map(([label, href, Icon]) => (
            <Link key={href} href={href} className="sidebar-link" aria-current={activeItem(href) ? 'page' : undefined}>
              <Icon size={17} strokeWidth={1.9} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="account-card">
            <strong>{account?.name}</strong>
            <p>{account?.user.email}</p>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-label">RescueRide <span aria-hidden="true">/</span> {details.title}</div>
          <div className="topbar-actions">
            <span className="status-chip"><span className="status-dot" /> Signed in</span>
            <button className="icon-button" type="button" onClick={signOut} disabled={signingOut} aria-label="Sign out" title="Sign out">
              <LogOut size={17} />
            </button>
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {details.items.slice(0, 5).map(([label, href, Icon]) => (
          <Link key={href} href={href} aria-current={activeItem(href) ? 'page' : undefined}>
            <Icon size={18} strokeWidth={1.9} />
            <span>{label.split(' ')[0]}</span>
          </Link>
        ))}
      </nav>
    </div>
  )
}
