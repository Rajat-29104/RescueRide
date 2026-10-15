async function authRequest(path, options = {}) {
  const response = await fetch(`/api/auth/${path}`, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(result.error || 'Authentication request failed.')
  }
  return result
}

function notifyAuthChange(event) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('roadrescue:auth-change', { detail: event }))
  }
}

export async function signUp({
  email,
  password,
  fullName,
  phone,
  role,
  mechanicProfile,
  driverProfile,
}) {
  return authRequest('signup', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password,
      fullName,
      phone,
      role,
      mechanicProfile,
      driverProfile,
    }),
  })
}

export async function signIn({ email, password }) {
  const result = await authRequest('login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  notifyAuthChange('SIGNED_IN')
  return result
}

export async function resetPasswordForEmail(email) {
  return authRequest('forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export async function updatePassword(newPassword, token) {
  return authRequest('reset-password', {
    method: 'POST',
    body: JSON.stringify({ password: newPassword, token }),
  })
}

export async function signOut() {
  await authRequest('logout', { method: 'POST' })
  notifyAuthChange('SIGNED_OUT')
}

export async function getCurrentUser() {
  const result = await authRequest('session')
  if (!result.user) return null

  return {
    ...result.profile,
    id: result.user.id,
    email: result.user.email,
    user_metadata: result.user.user_metadata,
  }
}

export async function getSession() {
  const result = await authRequest('session')
  return result.session
}

export async function getUserRole() {
  const currentUser = await getCurrentUser()
  return currentUser?.role || null
}
