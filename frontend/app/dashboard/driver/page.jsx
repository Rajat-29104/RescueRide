import Link from 'next/link'
import { CarFront, FileClock, LifeBuoy, MapPinned, ShieldCheck, Wrench } from 'lucide-react'
import { ActionLink, DataConnectionNotice, EmptyState, PageHeading } from '../../../components/DashboardPrimitives'

export default function DriverDashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Driver workspace"
        title="Good to have you here."
        description="Start a roadside request, manage your vehicle details, or review your safety settings."
        actions={<Link className="btn btn-primary" href="/dashboard/driver/requests/new"><LifeBuoy size={16} /> Request assistance</Link>}
      />

      <div className="content-grid" style={{ marginBottom: 18 }}>
        <DataConnectionNotice />
      </div>

      <div className="content-grid content-grid-main">
        <section className="surface panel">
          <div className="panel-heading">
            <div><h2>Your assistance</h2><p>Current and recent roadside requests</p></div>
            <FileClock size={18} color="var(--muted)" />
          </div>
          <EmptyState icon={LifeBuoy} title="No request activity to show">
            When your account is connected, your active assistance and service history will appear here.
          </EmptyState>
        </section>

        <section className="surface panel">
          <div className="panel-heading">
            <div><h2>Shortcuts</h2><p>Keep essential details close</p></div>
          </div>
          <div className="action-list">
            <ActionLink href="/dashboard/driver/vehicles" icon={CarFront}>Manage vehicles</ActionLink>
            <ActionLink href="/dashboard/driver/safety" icon={ShieldCheck}>Safety and contacts</ActionLink>
            <ActionLink href="/dashboard/driver/requests" icon={MapPinned}>Request history</ActionLink>
            <ActionLink href="/dashboard/driver/requests/new" icon={Wrench}>Get roadside help</ActionLink>
          </div>
        </section>
      </div>
    </>
  )
}
