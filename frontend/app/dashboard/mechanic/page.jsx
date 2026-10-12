import Link from 'next/link'
import { Wrench } from 'lucide-react'
import { PageHeading } from '../../../components/DashboardPrimitives'
import ConnectedWorkspace from '../../../components/ConnectedWorkspace'

export default function MechanicDashboardPage() {
  return (
    <>
      <PageHeading
        eyebrow="Mechanic workspace"
        title="Service operations"
        description="Review incoming requests, manage active jobs, and keep your service profile current."
        actions={<Link className="btn btn-secondary" href="/dashboard/mechanic/settings"><Wrench size={16} /> Profile settings</Link>}
      />
      <ConnectedWorkspace role="mechanic" section={['overview']} />
    </>
  )
}
