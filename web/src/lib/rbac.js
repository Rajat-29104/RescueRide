import { getAuthenticatedUser } from '@/lib/localAuth'
import { NextResponse } from 'next/server'

export async function protectApiRoute(allowedRoles = '') {
  try {
    const authenticated = await getAuthenticatedUser()
    if (!authenticated) {
      return { error: 'Unauthorized', status: 401 }
    }

    const { user, profile } = authenticated
    if (profile.is_suspended) {
      return {
        error: `Your account has been suspended: ${profile.suspension_reason || 'Policy violations'}. Contact dispatch support for assistance.`,
        status: 403,
      }
    }

    if (allowedRoles) {
      const roles = allowedRoles.split(',').map((role) => role.trim())
      if (!roles.includes(profile.role)) {
        return { error: 'Forbidden: insufficient permissions', status: 403 }
      }
    }

    return { user, profile }
  } catch (error) {
    console.error('[LOCAL AUTH] API authorization failed:', error)
    return { error: 'Internal server error', status: 500 }
  }
}

export async function requireDriver() {
  return protectApiRoute('driver')
}

export async function requireMechanic() {
  return protectApiRoute('mechanic')
}

export async function requireAdmin() {
  return protectApiRoute('admin')
}

export async function requireRoles(roles) {
  return protectApiRoute(roles)
}

export function createErrorResponse(message, status = 400) {
  return NextResponse.json({ error: message }, { status })
}

export function verifyResourceOwnership(userId, resourceOwnerId) {
  if (userId !== resourceOwnerId) {
    throw new Error('Forbidden: resource not owned by user')
  }
}

export function getRoleBasedFilter(role, userId) {
  const filters = {
    driver: { column: 'driver_id', value: userId },
    mechanic: { column: 'mechanic_id', value: userId },
    admin: null,
  }
  return filters[role]
}
