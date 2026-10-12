export const SOS_STATUS = Object.freeze({
  RAISED: 'RAISED',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  RESOLVED: 'RESOLVED',
})

export const INCIDENT_STATUS = Object.freeze({
  OPEN: 'OPEN',
  IN_REVIEW: 'IN_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
})

export function normalizePhoneNumber(value) {
  if (typeof value !== 'string') return ''
  return value.replace(/\D/g, '')
}

export function isValidPhoneNumber(value) {
  const digits = normalizePhoneNumber(value)
  return digits.length >= 7 && digits.length <= 15
}

export function validateEmergencyContact(payload = {}) {
  const errors = []
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const relationship = typeof payload.relationship === 'string' ? payload.relationship.trim() : ''
  const phoneNumber = normalizePhoneNumber(payload.phoneNumber || payload.phone || '')

  if (!name) {
    errors.push('Emergency contact name is required.')
  }
  if (!relationship) {
    errors.push('Emergency contact relationship is required.')
  }
  if (!isValidPhoneNumber(phoneNumber)) {
    errors.push('Emergency contact phone number must be a valid international-style number.')
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      name,
      relationship,
      phoneNumber,
    },
  }
}

export function validateSosCoordinates(latitude, longitude) {
  const lat = Number(latitude)
  const lng = Number(longitude)
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { valid: false, error: 'Latitude and longitude are required.' }
  }
  if (lat < -90 || lat > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90.' }
  }
  if (lng < -180 || lng > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180.' }
  }
  return { valid: true }
}

export function normalizeSosStatus(value) {
  if (typeof value !== 'string') return ''
  const normalized = value.trim().toUpperCase()
  const aliases = {
    TRIGGERED: SOS_STATUS.RAISED,
    RAISE: SOS_STATUS.RAISED,
    ACK: SOS_STATUS.ACKNOWLEDGED,
    ACKNOWLEDGE: SOS_STATUS.ACKNOWLEDGED,
    RESOLVE: SOS_STATUS.RESOLVED,
  }
  return aliases[normalized] || normalized
}

export function validateSosPayload(payload = {}) {
  const errors = []
  const latitude = Number(payload.latitude)
  const longitude = Number(payload.longitude)
  const { valid, error } = validateSosCoordinates(latitude, longitude)
  if (!valid) errors.push(error)

  const requestId = payload.requestId ?? payload.request_id
  if (requestId && typeof requestId !== 'string') {
    errors.push('requestId must be a UUID string when provided.')
  }

  const message = typeof payload.message === 'string'
    ? payload.message
    : typeof payload.details === 'string'
      ? payload.details
      : ''

  if (message.trim().length > 500) {
    errors.push('SOS details must be 500 characters or fewer.')
  }

  const status = normalizeSosStatus(payload.status)
  if (!Object.values(SOS_STATUS).includes(status)) {
    errors.push('status must be one of: RAISED, ACKNOWLEDGED, RESOLVED.')
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      requestId,
      status,
      latitude,
      longitude,
      message: message.trim(),
    },
  }
}

export function validateSosStatusTransition(currentStatus, nextStatus) {
  const allowedTransitions = {
    [SOS_STATUS.RAISED]: [SOS_STATUS.ACKNOWLEDGED],
    [SOS_STATUS.ACKNOWLEDGED]: [SOS_STATUS.RESOLVED],
    [SOS_STATUS.RESOLVED]: [],
  }

  const current = normalizeSosStatus(currentStatus || SOS_STATUS.RAISED)
  const next = normalizeSosStatus(nextStatus || SOS_STATUS.RAISED)

  if (!allowedTransitions[current]) {
    return { valid: false, reason: `Unsupported SOS status: ${current}` }
  }

  if (!allowedTransitions[current].includes(next)) {
    return {
      valid: false,
      reason: `Invalid SOS status transition from ${current} to ${next}.`,
    }
  }

  return { valid: true, nextRequestStatus: next === SOS_STATUS.RESOLVED ? 'completed' : null }
}

export function validateIncidentStatusTransition(currentStatus, nextStatus) {
  const current = currentStatus || INCIDENT_STATUS.OPEN
  const next = nextStatus || INCIDENT_STATUS.OPEN

  if (current === next) {
    return { valid: false, reason: `Incident status cannot remain at ${current}.` }
  }

  if (current === INCIDENT_STATUS.OPEN && next === INCIDENT_STATUS.IN_REVIEW) {
    return { valid: true }
  }

  if ((current === INCIDENT_STATUS.OPEN || current === INCIDENT_STATUS.IN_REVIEW) && next === INCIDENT_STATUS.REJECTED) {
    return { valid: true }
  }

  if (current === INCIDENT_STATUS.IN_REVIEW && next === INCIDENT_STATUS.RESOLVED) {
    return { valid: true }
  }

  return {
    valid: false,
    reason: `Invalid incident status transition from ${current} to ${next}.`,
  }
}

export function validateLocation(payload = {}) {
  const latitude = Number(payload.latitude)
  const longitude = Number(payload.longitude)

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90.' }
  }

  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180.' }
  }

  return { valid: true, latitude, longitude }
}

export function isPointInRequestScope(userId, request) {
  if (!request || !userId) return false
  return request.driver_id === userId || request.mechanic_id === userId
}

export function getAdministrativeAccessError(userRole, actorUserId, resourceUserId) {
  if (userRole === 'admin') return null
  if (actorUserId !== resourceUserId) {
    return 'Forbidden: insufficient permissions for this resource.'
  }
  return null
}
