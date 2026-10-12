import { PageHeading } from './DashboardPrimitives'
import ConnectedWorkspace from './ConnectedWorkspace'
import RequestForm from './RequestForm'
import RequestHistory from './RequestHistory'

const pageContent = {
  driver: {
    requests: ['Roadside assistance', 'My requests', 'Review current and previous requests.'],
    explore: ['Roadside assistance', 'Explore providers', 'Search available providers using the connected RescueRide service.'],
    vehicles: ['Vehicle management', 'Vehicles and service', 'Save vehicle details to your authenticated driver profile.'],
    safety: ['Safety', 'Safety and emergency contacts', 'Manage emergency contacts and access request-linked safety tools.'],
    'safety/contacts': ['Safety', 'Emergency contacts', 'Manage who can be contacted during a roadside emergency.'],
    'safety/sos': ['Safety', 'Emergency SOS', 'Send an SOS with your current location for an active request.'],
    notifications: ['Your account', 'Notifications', 'Review and acknowledge account and request notifications.'],
    settings: ['Your account', 'Profile and settings', 'Manage your preferences and submit personal profile changes for review.'],
    'reports/new': ['Safety', 'Report an issue', 'Submit an issue report connected to one of your roadside requests.'],
    help: ['Your account', 'Help and support', 'Find support for your account and roadside workflows.'],
  },
  mechanic: {
    requests: ['Job management', 'Incoming requests', 'Review and accept eligible assistance requests.'],
    jobs: ['Job management', 'Active jobs', 'Update the status of work assigned to your mechanic account.'],
    history: ['Job management', 'Job history', 'Review completed and cancelled jobs.'],
    locations: ['Mechanic profile', 'Service area', 'Manage service area, availability, and profile details.'],
    settings: ['Your account', 'Mechanic profile', 'Manage your service profile and availability.'],
    account: ['Your account', 'Mechanic profile', 'Manage your service profile and availability.'],
    notifications: ['Your account', 'Notifications', 'Review and acknowledge job and account updates.'],
    support: ['Mechanic workspace', 'Help and support', 'Find support for your account and job workflow.'],
  },
  admin: {
    users: ['Governance', 'People and access', 'Review user account records.'],
    mechanics: ['Governance', 'Mechanic verification', 'Review pending mechanic applications.'],
    requests: ['Operations', 'Request management', 'Review roadside assistance request records.'],
    incidents: ['Safety governance', 'Incidents and reports', 'Review and update incident reports.'],
    reports: ['Safety governance', 'Reports and complaints', 'Review reports submitted by RescueRide participants.'],
    operations: ['Operations', 'Live operations', 'Review current request activity.'],
    analytics: ['Governance', 'Analytics', 'Review live aggregate platform statistics.'],
    help: ['Administration', 'System help', 'Review support information.'],
    settings: ['Administration', 'Settings', 'System-wide settings available to administrators.'],
  },
}

export default function FeaturePage({ role, section, mechanicId = '' }) {
  const sectionKey = section.join('/')
  const page = pageContent[role]?.[sectionKey] || pageContent[role]?.[section[0]]
  const [eyebrow, title, description] = page || ['Workspace', 'Request details', 'View account-scoped request information.']

  if (role === 'driver' && sectionKey === 'requests/new') {
    return (
      <>
        <PageHeading eyebrow="Roadside assistance" title="Request assistance" description="Share the issue, your vehicle details, and your location so the right help can be dispatched." />
        <RequestForm initialMechanicId={mechanicId} />
      </>
    )
  }

  if (role === 'driver' && sectionKey === 'requests') {
    return (
      <>
        <PageHeading eyebrow={eyebrow} title={title} description={description} />
        <RequestHistory />
      </>
    )
  }

  if (role === 'driver' && section[0] === 'requests' && section.length === 2) {
    return (
      <>
        <PageHeading eyebrow={eyebrow} title="Request details" description="Review the status and information for this assistance request." />
        <RequestHistory requestId={section[1]} />
      </>
    )
  }

  return (
    <>
      <PageHeading eyebrow={eyebrow} title={title} description={description} />
      <ConnectedWorkspace role={role} section={section} />
    </>
  )
}
