import Link from 'next/link'
import { LifeBuoy } from 'lucide-react'
import { PageHeading } from '../../../components/DashboardPrimitives'
import ConnectedWorkspace from '../../../components/ConnectedWorkspace'

export default function DriverDashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Driver workspace"
        title="Your roadside assistance"
        description="Create a roadside request, follow active assistance, or manage your account."
        actions={<Link className="btn btn-primary" href="/dashboard/driver/requests/new"><LifeBuoy size={16} /> Request assistance</Link>}
      />
      <ConnectedWorkspace role="driver" section={['overview']} />
    </>
  )
}
