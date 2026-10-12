import { PageHeading } from '../../../components/DashboardPrimitives'
import ConnectedWorkspace from '../../../components/ConnectedWorkspace'

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Administration"
        title="Operations dashboard"
        description="Review live request activity, verification, incidents, and access using the protected admin service."
      />
      <ConnectedWorkspace role="admin" section={['overview']} />
    </>
  )
}
