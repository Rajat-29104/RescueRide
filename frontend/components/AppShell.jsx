'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  UserRound,
  Users,
  Wrench,
} from 'lucide-react'

const roleDetails = {
  driver: {
    title: 'Driver workspace',
    items: [
      ['Overview', '/dashboard/driver', Home],
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
      ['Overview', '/dashboard/mechanic', Home],
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
      ['Overview', '/dashboard/admin', Gauge],
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
  const details = roleDetails[role]
  const activeItem = (href) => href === pathname || (href !== `/dashboard/${role}` && pathname.startsWith(`${href}/`))

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
          <div className="preview-card">
            <strong>Standalone preview</strong>
            <p>Live account data and actions require the backend connection.</p>
          </div>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-topbar">
          <div className="topbar-label">RescueRide <span aria-hidden="true">/</span> {details.title}</div>
          <div className="topbar-actions">
            <span className="status-chip"><span className="status-dot" /> Preview mode</span>
            <Link className="icon-button" href="/" aria-label="Return to the public homepage" title="Return to homepage">
              <UserRound size={17} />
            </Link>
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
