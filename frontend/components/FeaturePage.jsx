import { notFound } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  Bell,
  CarFront,
  CheckCircle2,
  ClipboardList,
  FileWarning,
  History,
  MapPinned,
  MessageCircle,
  Settings2,
  ShieldCheck,
  Wrench,
} from 'lucide-react'
import { ActionLink, DataConnectionNotice, EmptyState, PageHeading } from './DashboardPrimitives'
import RequestForm from './RequestForm'
import RequestHistory from './RequestHistory'

const featurePages = {
  driver: {
    'requests/new': {
      title: 'Request assistance',
      eyebrow: 'Roadside assistance',
      description: 'Prepare a request with the issue, vehicle, and incident location.',
      icon: Wrench,
      emptyTitle: 'Request submission needs a live connection',
      emptyText: 'This preview cannot save a rescue request or search for providers. Connect the request API and authenticated driver session to continue.',
      links: [['My requests', '/dashboard/driver/requests', ClipboardList], ['Manage vehicles', '/dashboard/driver/vehicles', CarFront]],
    },
    requests: {
      title: 'My requests',
      eyebrow: 'Roadside assistance',
      description: 'Follow active assistance and review previous service requests.',
      icon: ClipboardList,
      emptyTitle: 'No request records available',
      emptyText: 'Request history appears here when the driver session and request service are connected.',
      links: [['Request assistance', '/dashboard/driver/requests/new', Wrench]],
    },
    'vehicles': {
      title: 'Vehicles',
      eyebrow: 'Vehicle management',
      description: 'Keep vehicle details available for future assistance requests.',
      icon: CarFront,
      emptyTitle: 'Vehicle data is not connected',
      emptyText: 'This preview has no authenticated vehicle-profile API, so it cannot list or edit stored vehicles.',
      links: [['Request history', '/dashboard/driver/requests', ClipboardList]],
    },
    'vehicles/new': {
      title: 'Add a vehicle',
      eyebrow: 'Vehicle management',
      description: 'Vehicle information helps provide useful context when requesting assistance.',
      icon: CarFront,
      emptyTitle: 'Vehicle changes cannot be saved here',
      emptyText: 'The standalone frontend is not connected to the driver profile or vehicle storage API.',
      links: [['Back to vehicles', '/dashboard/driver/vehicles', CarFront]],
    },
    'vehicles/edit': {
      title: 'Edit vehicle',
      eyebrow: 'Vehicle management',
      description: 'Update vehicle details associated with your driver profile.',
      icon: CarFront,
      emptyTitle: 'Vehicle changes cannot be saved here',
      emptyText: 'The standalone frontend is not connected to the driver profile or vehicle storage API.',
      links: [['Back to vehicles', '/dashboard/driver/vehicles', CarFront]],
    },
    'vehicles/service-history': {
      title: 'Service history',
      eyebrow: 'Vehicle management',
      description: 'Review service entries associated with your vehicles.',
      icon: History,
      emptyTitle: 'No service records available',
      emptyText: 'Service history depends on real account and vehicle records. No sample entries are displayed.',
      links: [['Vehicles', '/dashboard/driver/vehicles', CarFront]],
    },
    explore: {
      title: 'Find assistance',
      eyebrow: 'Roadside assistance',
      description: 'Discovery uses location and verified service-provider availability.',
      icon: MapPinned,
      emptyTitle: 'Provider discovery is unavailable',
      emptyText: 'This preview does not query provider profiles or device location, and shows no fabricated mechanics.',
      links: [['Request assistance', '/dashboard/driver/requests/new', Wrench]],
    },
    safety: {
      title: 'Safety and contacts',
      eyebrow: 'Safety',
      description: 'Review emergency contacts and available safety workflows.',
      icon: ShieldCheck,
      emptyTitle: 'Safety profile needs a live account',
      emptyText: 'Emergency contacts are private account data and are not available in this disconnected preview.',
      links: [['Emergency contacts', '/dashboard/driver/safety/contacts', ShieldCheck], ['Raise an SOS', '/dashboard/driver/safety/sos', AlertTriangle]],
    },
    'safety/contacts': {
      title: 'Emergency contacts',
      eyebrow: 'Safety',
      description: 'Manage who can be contacted during a roadside emergency.',
      icon: ShieldCheck,
      emptyTitle: 'Contacts cannot be loaded',
      emptyText: 'Sign in with a connected driver account to view or update emergency contacts.',
      links: [['Safety overview', '/dashboard/driver/safety', ShieldCheck]],
    },
    'safety/sos': {
      title: 'Emergency SOS',
      eyebrow: 'Safety',
      description: 'A real SOS requires an authenticated session and an operational safety service.',
      icon: AlertTriangle,
      emptyTitle: 'SOS dispatch is unavailable in this preview',
      emptyText: 'No alert has been sent. If you are in immediate danger, contact your local emergency services directly.',
      links: [['Safety overview', '/dashboard/driver/safety', ShieldCheck]],
    },
    'reports/new': {
      title: 'Report an issue',
      eyebrow: 'Safety',
      description: 'Share an incident or concern for review by the appropriate team.',
      icon: FileWarning,
      emptyTitle: 'Report submission is unavailable',
      emptyText: 'No report has been submitted. The incident reporting API must be connected before this action is available.',
      links: [['Safety overview', '/dashboard/driver/safety', ShieldCheck]],
    },
    notifications: {
      title: 'Notifications',
      eyebrow: 'Your account',
      description: 'Request updates and account notifications appear here.',
      icon: Bell,
      emptyTitle: 'Notifications are not connected',
      emptyText: 'No notification service is active in this standalone frontend.',
      links: [['Request history', '/dashboard/driver/requests', ClipboardList]],
    },
    settings: {
      title: 'Profile and settings',
      eyebrow: 'Your account',
      description: 'Manage your personal details and preferences.',
      icon: Settings2,
      emptyTitle: 'Profile settings need an authenticated account',
      emptyText: 'The profile API is not connected here, so no changes can be loaded or saved.',
      links: [['Emergency contacts', '/dashboard/driver/safety/contacts', ShieldCheck]],
    },
    help: {
      title: 'Help and support',
      eyebrow: 'Your account',
      description: 'Find assistance with your profile and roadside workflows.',
      icon: MessageCircle,
      emptyTitle: 'Support service is not connected',
      emptyText: 'No support request has been sent from this preview.',
      links: [['Safety and contacts', '/dashboard/driver/safety', ShieldCheck]],
    },
  },
  mechanic: {
    requests: {
      title: 'Incoming requests',
      eyebrow: 'Job management',
      description: 'Review assistance requests that are available to your mechanic account.',
      icon: ClipboardList,
      emptyTitle: 'Requests cannot be loaded',
      emptyText: 'Connect the authenticated mechanic session and request API before accepting or declining any work.',
      links: [['Active jobs', '/dashboard/mechanic/jobs', Wrench], ['Service area', '/dashboard/mechanic/locations', MapPinned]],
    },
    jobs: {
      title: 'Active jobs',
      eyebrow: 'Job management',
      description: 'Track accepted work and update job progress.',
      icon: Wrench,
      emptyTitle: 'No live job data',
      emptyText: 'Job status and transitions are not available until the mechanic API is connected.',
      links: [['Incoming requests', '/dashboard/mechanic/requests', ClipboardList], ['Job history', '/dashboard/mechanic/history', History]],
    },
    history: {
      title: 'Job history',
      eyebrow: 'Job management',
      description: 'Review completed and cancelled assistance jobs.',
      icon: History,
      emptyTitle: 'Job history is unavailable',
      emptyText: 'Historical jobs require a real mechanic session and database connection.',
      links: [['Active jobs', '/dashboard/mechanic/jobs', Wrench]],
    },
    locations: {
      title: 'Service area',
      eyebrow: 'Mechanic profile',
      description: 'Location and service-area information supports dispatch matching.',
      icon: MapPinned,
      emptyTitle: 'Location data is not connected',
      emptyText: 'This preview does not access or transmit device location.',
      links: [['Profile settings', '/dashboard/mechanic/settings', Settings2]],
    },
    notifications: {
      title: 'Notifications',
      eyebrow: 'Your account',
      description: 'Job and account updates for your mechanic profile.',
      icon: Bell,
      emptyTitle: 'Notifications are not connected',
      emptyText: 'No notification service is active in this standalone frontend.',
      links: [['Incoming requests', '/dashboard/mechanic/requests', ClipboardList]],
    },
    settings: {
      title: 'Mechanic profile',
      eyebrow: 'Your account',
      description: 'Manage your service profile, availability, and capabilities.',
      icon: Wrench,
      emptyTitle: 'Profile settings need an authenticated mechanic account',
      emptyText: 'No profile data is loaded or saved from this preview.',
      links: [['Service area', '/dashboard/mechanic/locations', MapPinned]],
    },
    account: {
      title: 'Mechanic profile',
      eyebrow: 'Your account',
      description: 'Manage your service profile, availability, and capabilities.',
      icon: Wrench,
      emptyTitle: 'Profile settings need an authenticated mechanic account',
      emptyText: 'No profile data is loaded or saved from this preview.',
      links: [['Service area', '/dashboard/mechanic/locations', MapPinned]],
    },
    support: {
      title: 'Help and support',
      eyebrow: 'Mechanic workspace',
      description: 'Find support for your account and job workflow.',
      icon: MessageCircle,
      emptyTitle: 'Support service is not connected',
      emptyText: 'No support request has been sent from this preview.',
      links: [['Profile settings', '/dashboard/mechanic/settings', Settings2]],
    },
  },
  admin: {
    users: {
      title: 'People and access',
      eyebrow: 'Governance',
      description: 'Review platform users and account access.',
      icon: ShieldCheck,
      emptyTitle: 'User records are not connected',
      emptyText: 'This admin screen requires a verified admin session and the existing users API.',
      links: [['Mechanic verification', '/dashboard/admin/mechanics', Wrench], ['Requests', '/dashboard/admin/requests', ClipboardList]],
    },
    mechanics: {
      title: 'Mechanic verification',
      eyebrow: 'Governance',
      description: 'Review mechanic verification and documentation.',
      icon: Wrench,
      emptyTitle: 'Verification queue is unavailable',
      emptyText: 'No profiles or documents are shown without the authenticated admin API.',
      links: [['People and access', '/dashboard/admin/users', ShieldCheck]],
    },
    requests: {
      title: 'Request management',
      eyebrow: 'Operations',
      description: 'Review assistance requests and their lifecycle states.',
      icon: ClipboardList,
      emptyTitle: 'Request records are not connected',
      emptyText: 'Operational records require an authenticated admin session and the existing requests API.',
      links: [['Live operations', '/dashboard/admin/operations', MapPinned], ['Incidents and reports', '/dashboard/admin/incidents', FileWarning]],
    },
    incidents: {
      title: 'Incidents and reports',
      eyebrow: 'Safety governance',
      description: 'Review reported incidents and supported moderation actions.',
      icon: FileWarning,
      emptyTitle: 'Incident queue is not connected',
      emptyText: 'No reports are loaded, and no review action can be performed from this frontend preview.',
      links: [['Request management', '/dashboard/admin/requests', ClipboardList]],
    },
    operations: {
      title: 'Live operations',
      eyebrow: 'Operations',
      description: 'Monitor active work only when connected to live request and location data.',
      icon: MapPinned,
      emptyTitle: 'Live operations data is unavailable',
      emptyText: 'This preview does not display live locations, ETAs, or incident counts.',
      links: [['Request management', '/dashboard/admin/requests', ClipboardList]],
    },
    analytics: {
      title: 'Analytics',
      eyebrow: 'Governance',
      description: 'View platform indicators derived from real operational records.',
      icon: Activity,
      emptyTitle: 'Analytics are not connected',
      emptyText: 'No metrics or charts are fabricated for this disconnected frontend.',
      links: [['Operations overview', '/dashboard/admin', Activity]],
    },
    help: {
      title: 'System help',
      eyebrow: 'Administration',
      description: 'Review help and operational support information.',
      icon: MessageCircle,
      emptyTitle: 'Support service is not connected',
      emptyText: 'No support request has been sent from this preview.',
      links: [['Operations overview', '/dashboard/admin', Activity]],
    },
    reports: {
      title: 'Reports and complaints',
      eyebrow: 'Governance',
      description: 'Review submitted reports and related account concerns.',
      icon: FileWarning,
      emptyTitle: 'Reports are not connected',
      emptyText: 'This workspace needs an authenticated admin session and reports API to show real records.',
      links: [['Incidents and reports', '/dashboard/admin/incidents', FileWarning]],
    },
    settings: {
      title: 'Administration settings',
      eyebrow: 'Governance',
      description: 'Review administrative configuration and system preferences.',
      icon: Settings2,
      emptyTitle: 'Settings are unavailable in preview',
      emptyText: 'No configuration is loaded or changed by this frontend.',
      links: [['Operations overview', '/dashboard/admin', Activity]],
    },
  },
}

export default function FeaturePage({ role, section }) {
  const sectionKey = section.join('/')

  if (role === 'driver' && sectionKey === 'requests/new') {
    return (
      <>
        <PageHeading eyebrow="Roadside assistance" title="Request assistance" description="Share the issue, your vehicle details, and your location so the right help can be dispatched." />
        <RequestForm />
      </>
    )
  }

  if (role === 'driver' && sectionKey === 'requests') {
    return (
      <>
        <PageHeading eyebrow="Roadside assistance" title="My requests" description="Review live request status and the details you submitted." />
        <RequestHistory />
      </>
    )
  }

  if (role === 'driver' && section[0] === 'requests' && section.length === 2) {
    return (
      <>
        <PageHeading eyebrow="Roadside assistance" title="Request details" description="Review the status and information for this assistance request." />
        <RequestHistory requestId={section[1]} />
      </>
    )
  }

  const page =
    featurePages[role]?.[sectionKey] ||
    ((role === 'driver' && section[0] === 'requests' && section.length >= 2) && {
      title: section[2] === 'chat' ? 'Request communication' : section[2] === 'tracking' ? 'Assistance tracking' : 'Request details',
      eyebrow: 'Roadside assistance',
      description: 'Review the request status and details shared with the assigned mechanic.',
      icon: section[2] === 'chat' ? MessageCircle : ClipboardList,
      emptyTitle: 'Request details are not available',
      emptyText: 'This preview has no authenticated request record or job-specific communication.',
      links: [
        ['My requests', '/dashboard/driver/requests', ClipboardList],
        ['Request communication', `/dashboard/driver/requests/${encodeURIComponent(section[1])}/chat`, MessageCircle],
      ],
    }) ||
    ((role === 'driver' && section[0] === 'vehicles' && section.length >= 2) && {
      title: 'Vehicle details',
      eyebrow: 'Vehicle management',
      description: 'Review vehicle details and related service records.',
      icon: CarFront,
      emptyTitle: 'Vehicle details are not available',
      emptyText: 'This preview cannot identify or load a stored vehicle record.',
      links: [['Vehicles', '/dashboard/driver/vehicles', CarFront]],
    }) ||
    ((role === 'mechanic' && section[0] === 'jobs' && section.length >= 2) && {
      title: section[2] === 'chat' ? 'Job communication' : 'Active job',
      eyebrow: 'Job management',
      description: 'Review the active job and coordinate with the driver.',
      icon: section[2] === 'chat' ? MessageCircle : Wrench,
      emptyTitle: 'Job details are not available',
      emptyText: 'This preview has no authenticated job record, location updates, or chat connection.',
      links: [
        ['Active jobs', '/dashboard/mechanic/jobs', Wrench],
        ['Job communication', `/dashboard/mechanic/jobs/${encodeURIComponent(section[1])}/chat`, MessageCircle],
        ['Completion details', `/dashboard/mechanic/jobs/${encodeURIComponent(section[1])}/complete`, CheckCircle2],
      ],
    }) ||
    ((role === 'mechanic' && section[0] === 'requests' && section.length >= 2) && {
      title: 'Request details',
      eyebrow: 'Job management',
      description: 'Review request information before deciding whether to take the work.',
      icon: ClipboardList,
      emptyTitle: 'Request details are not available',
      emptyText: 'This preview has no authenticated request record. No accept or decline action has been performed.',
      links: [
        ['Incoming requests', '/dashboard/mechanic/requests', ClipboardList],
        ['Active jobs', '/dashboard/mechanic/jobs', Wrench],
      ],
    }) ||
    ((role === 'admin' && section[0] === 'incidents' && section.length >= 2) && {
      title: 'Incident review',
      eyebrow: 'Safety governance',
      description: 'Review incident information and permitted resolution actions.',
      icon: FileWarning,
      emptyTitle: 'Incident details are not available',
      emptyText: 'Connect the authenticated admin API to load incident data or record a review decision.',
      links: [['Incidents and reports', '/dashboard/admin/incidents', FileWarning]],
    }) ||
    ((role === 'admin' && ['users', 'mechanics', 'requests'].includes(section[0]) && section.length >= 2) && {
      title: section[0] === 'users' ? 'Account review' : section[0] === 'mechanics' ? 'Mechanic review' : 'Request details',
      eyebrow: 'Administration',
      description: 'Review a specific operational record and its permitted actions.',
      icon: section[0] === 'users' ? ShieldCheck : section[0] === 'mechanics' ? Wrench : ClipboardList,
      emptyTitle: 'Record details are not available',
      emptyText: 'Connect the verified admin account and relevant API before reviewing records or taking action.',
      links: [[section[0] === 'users' ? 'People and access' : section[0] === 'mechanics' ? 'Mechanic verification' : 'Request management', `/dashboard/admin/${section[0]}`, section[0] === 'users' ? ShieldCheck : section[0] === 'mechanics' ? Wrench : ClipboardList]],
    })
  if (!page) notFound()

  const Icon = page.icon
  return (
    <>
      <PageHeading eyebrow={page.eyebrow} title={page.title} description={page.description} />
      <div className="content-grid" style={{ marginBottom: 18 }}>
        <DataConnectionNotice />
      </div>
      <div className="content-grid content-grid-main">
        <section className="surface panel">
          <div className="panel-heading"><div><h2>{page.title}</h2><p>Account-scoped information and actions</p></div></div>
          <EmptyState icon={Icon} title={page.emptyTitle}>{page.emptyText}</EmptyState>
        </section>
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Related areas</h2><p>Continue to another workspace</p></div></div>
          <div className="action-list">
            {page.links.map(([label, href, LinkIcon]) => <ActionLink key={href} href={href} icon={LinkIcon}>{label}</ActionLink>)}
          </div>
        </section>
      </div>
    </>
  )
}
