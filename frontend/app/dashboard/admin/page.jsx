import { Activity, AlertTriangle, ClipboardList, ShieldCheck, Users } from 'lucide-react'
import { ActionLink, DataConnectionNotice, EmptyState, PageHeading } from '../../../components/DashboardPrimitives'

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Administration"
        title="Operations overview"
        description="A workspace for reviewing platform activity and managing safety and access."
      />
      <div className="content-grid" style={{ marginBottom: 18 }}><DataConnectionNotice /></div>

      <div className="content-grid content-grid-main">
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Operational activity</h2><p>Request, verification, and incident queues</p></div></div>
          <EmptyState icon={Activity} title="No live operational data">
            Platform counts and review queues will appear after the admin API is connected. No sample totals are shown in this preview.
          </EmptyState>
        </section>
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Administration tools</h2><p>Open a review workspace</p></div></div>
          <div className="action-list">
            <ActionLink href="/dashboard/admin/users" icon={Users}>People and access</ActionLink>
            <ActionLink href="/dashboard/admin/mechanics" icon={ShieldCheck}>Mechanic verification</ActionLink>
            <ActionLink href="/dashboard/admin/requests" icon={ClipboardList}>Request management</ActionLink>
            <ActionLink href="/dashboard/admin/incidents" icon={AlertTriangle}>Incidents and reports</ActionLink>
          </div>
        </section>
      </div>
    </>
  )
}
