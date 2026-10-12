import Link from 'next/link'
import { Activity, ClipboardList, History, MapPinned, Wrench } from 'lucide-react'
import { ActionLink, DataConnectionNotice, EmptyState, PageHeading } from '../../../components/DashboardPrimitives'

export default function MechanicDashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Mechanic workspace"
        title="Service operations"
        description="Review incoming requests, manage active jobs, and keep your service profile current."
        actions={<Link className="btn btn-secondary" href="/dashboard/mechanic/settings"><Wrench size={16} /> Profile settings</Link>}
      />
      <div className="content-grid" style={{ marginBottom: 18 }}><DataConnectionNotice /></div>

      <div className="content-grid content-grid-main">
        <section className="surface panel">
          <div className="panel-heading">
            <div><h2>Incoming requests</h2><p>New assistance requests assigned to your service area</p></div>
            <span className="status-chip">Requires connection</span>
          </div>
          <EmptyState icon={ClipboardList} title="Requests are not available in preview">
            Connect an authenticated account and live request API to review or accept jobs here.
          </EmptyState>
        </section>

        <section className="surface panel">
          <div className="panel-heading"><div><h2>Operations</h2><p>Tools for your working day</p></div></div>
          <div className="action-list">
            <ActionLink href="/dashboard/mechanic/requests" icon={ClipboardList}>Incoming requests</ActionLink>
            <ActionLink href="/dashboard/mechanic/jobs" icon={Activity}>Active jobs</ActionLink>
            <ActionLink href="/dashboard/mechanic/history" icon={History}>Job history</ActionLink>
            <ActionLink href="/dashboard/mechanic/locations" icon={MapPinned}>Service area</ActionLink>
          </div>
        </section>
      </div>
    </>
  )
}
