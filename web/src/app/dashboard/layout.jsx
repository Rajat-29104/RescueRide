import DashboardShell from '@/components/layout/DashboardShell'
import { getAuthenticatedUser } from '@/lib/localAuth'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

const roleRoutes = {
  driver: '/dashboard/driver',
  mechanic: '/dashboard/mechanic',
  admin: '/dashboard/admin',
}

const isPathForRole = (pathname, role) => {
  const base = roleRoutes[role]
  return pathname === base || pathname.startsWith(`${base}/`)
}

export default async function DashboardLayout({ children }) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') || '/dashboard'

  const authenticated = await getAuthenticatedUser()
  if (!authenticated) {
    redirect('/auth/login')
  }

  const role = authenticated.profile.role

  if (!role || !roleRoutes[role]) {
    redirect('/auth/login')
  }

  const homePath = roleRoutes[role]

  if (!isPathForRole(pathname, role)) {
    redirect(homePath)
  }

  return (
    <DashboardShell initialRole={role}>
      {children}
    </DashboardShell>
  )
}
