'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, LoaderCircle, MapPin, RefreshCw, Search } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'

async function backend(path, options = {}) {
  const response = await fetch(`/api/backend/${path}`, {
    cache: 'no-store',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status}).`)
  return payload
}

function toggleCommunication(event) {
  const { value, checked } = event.target
  setForm((current) => ({
    ...current,
    communication_preferences: checked
      ? [...(current.communication_preferences || []), value]
      : (current.communication_preferences || []).filter((item) => item !== value),
  }))
}

function ErrorMessage({ children }) {
  return <div className="form-notice form-notice-error" role="alert">{children}</div>
}

function SuccessMessage({ children }) {
  return <div className="form-notice" role="status">{children}</div>
}

function valueAtPath(object, path) {
  return path.split('.').reduce((value, part) => value?.[part], object)
}

function RecordList({ rows, fields, actions }) {
  if (!rows?.length) return <div className="workspace-empty">No records to show.</div>
  return (
    <div className="workspace-record-list">
      {rows.map((row, index) => (
        <article className="workspace-record" key={row.id || row.user_id || index}>
          <div className="workspace-record-copy">
            {fields.map(([label, key]) => {
              const value = valueAtPath(row, key)
              if (value === null || value === undefined || value === '') return null
              return (
                <div className="workspace-record-field" key={key}>
                  <strong>{label}</strong>
                  <span>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                </div>
              )
            })}
          </div>
          {actions?.(row)}
        </article>
      ))}
    </div>
  )
}

function Field({ label, name, value, onChange, required = false, type = 'text', options, ...props }) {
  return (
    <div className="field">
      <label htmlFor={`workspace-${name}`}>{label}</label>
      {options ? (
        <select id={`workspace-${name}`} name={name} value={value} required={required} onChange={onChange} {...props}>
          {options.map(([optionValue, optionLabel]) => <option value={optionValue} key={optionValue}>{optionLabel}</option>)}
        </select>
      ) : type === 'textarea' ? (
        <textarea id={`workspace-${name}`} name={name} value={value} required={required} onChange={onChange} {...props} />
      ) : (
        <input id={`workspace-${name}`} name={name} type={type} value={value} required={required} onChange={onChange} {...props} />
      )}
    </div>
  )
}

function RequestRows({ rows, onStatus }) {
  const serviceName = (value) => String(value || 'Assistance').replaceAll('_', ' ')
  return (
    <div className="workspace-record-list">
      {rows?.length ? rows.map((row) => (
        <article className="workspace-record" key={row.id}>
          <div className="workspace-record-copy">
            <strong>{serviceName(row.service_type)} · {String(row.status || 'unknown').replaceAll('_', ' ')}</strong>
            <span>{row.problem_description || 'No problem description provided.'}</span>
            {row.incident_address && <span><MapPin size={13} /> {row.incident_address}</span>}
            <small>{row.created_at ? new Date(row.created_at).toLocaleString() : ''} · {row.id}</small>
          </div>
          {onStatus?.(row)}
        </article>
      )) : <div className="workspace-empty">No requests match this view.</div>}
    </div>
  )
}

export default function ConnectedWorkspace({ role, section = [] }) {
  const [state, setState] = useState({ loading: true, error: '', data: null })
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')
  const [form, setForm] = useState({})
  const [userId, setUserId] = useState('')
  const sectionKey = section.join('/')
  const [firstSection, secondSection, thirdSection] = sectionKey.split('/')
  const root = `/dashboard/${role}`
  const isActive = (value) => !['completed', 'cancelled'].includes(value)

  const load = useCallback(async () => {
    setState({ loading: true, error: '', data: null })
    try {
      const supabase = getSupabaseBrowserClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) throw new Error('Your session has expired. Sign in again to continue.')
      setUserId(user.id)

      let data
      if (role === 'driver' && ['vehicles', 'vehicles/new', 'vehicles/edit'].includes(sectionKey)) {
        const { data: profile, error } = await supabase.from('driver_profiles').select('*').eq('user_id', user.id).maybeSingle()
        if (error) throw error
        data = { profile: profile || { user_id: user.id, vehicle_make: '', vehicle_model: '', vehicle_year: '', vehicle_color: '', vehicle_plate: '', home_area: '' } }
        setForm(data.profile)
      } else if (role === 'driver' && ['safety', 'safety/contacts'].includes(sectionKey)) {
        data = await backend('safety/emergency-contacts')
      } else if (role === 'driver' && sectionKey === 'safety/sos') {
        const result = await backend('requests')
        data = { requests: (result.requests || []).filter((request) => isActive(request.status)) }
      } else if (role === 'driver' && sectionKey === 'notifications') {
        const { data: notifications, error } = await supabase.from('notifications').select('id,title,body,type,is_read,created_at').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(100)
        if (error) throw error
        data = { notifications: notifications || [] }
      } else if (role === 'driver' && sectionKey === 'settings') {
        const [preferences, profile, changeRequests] = await Promise.all([
          backend('profile/preferences'),
          supabase.from('profiles').select('full_name,phone,email').eq('id', user.id).maybeSingle(),
          backend('profile/change-requests'),
        ])
        if (profile.error) throw profile.error
        data = { preferences: preferences.preferences, profile: profile.data || {}, changeRequests: changeRequests.requests || [] }
        setForm({
          theme: preferences.preferences?.theme || 'system',
          preferred_language: preferences.preferences?.preferred_language || 'en',
          secondary_phone: preferences.preferences?.secondary_phone || '',
          home_location_label: preferences.preferences?.home_location_label || '',
          work_location_label: preferences.preferences?.work_location_label || '',
          bio: preferences.preferences?.bio || '',
          full_name: profile.data?.full_name || '',
          phone: profile.data?.phone || '',
          email_notifications: preferences.preferences?.notification_preferences?.email ?? true,
          sms_notifications: preferences.preferences?.notification_preferences?.sms ?? true,
          push_notifications: preferences.preferences?.notification_preferences?.push ?? true,
          communication_preferences: preferences.preferences?.communication_preferences || [],
        })
      } else if (role === 'driver' && sectionKey === 'reports/new') {
        const result = await backend('requests')
        data = { requests: result.requests || [] }
      } else if (role === 'driver' && firstSection === 'requests' && secondSection) {
        const requestId = secondSection
        if (thirdSection === 'chat') {
          data = await backend(`requests/${encodeURIComponent(requestId)}/messages`)
        } else {
          data = await backend(`requests/${encodeURIComponent(requestId)}`)
        }
      } else if (role === 'driver' && sectionKey === 'explore') {
        const result = await backend('mechanics/available')
        data = { providers: result.mechanics || [] }
      } else if (role === 'driver' && sectionKey === 'vehicles/service-history') {
        data = await backend('requests')
      } else if (role === 'mechanic' && ['requests', 'jobs', 'history'].includes(sectionKey)) {
        let request = supabase.from('rescue_requests').select('id,status,service_type,problem_description,incident_address,created_at,mechanic_id,driver_id,vehicle_make,vehicle_model,vehicle_plate')
        if (sectionKey === 'requests') {
          request = request.eq('status', 'pending').or(`mechanic_id.is.null,mechanic_id.eq.${user.id}`)
        } else if (sectionKey === 'jobs') {
          request = request.eq('mechanic_id', user.id).in('status', ['accepted', 'en_route', 'arrived', 'in_progress'])
        } else {
          request = request.eq('mechanic_id', user.id).in('status', ['completed', 'cancelled'])
        }
        const { data: requests, error } = await request.order('created_at', { ascending: false }).limit(100)
        if (error) throw error
        data = { requests: requests || [] }
      } else if (role === 'mechanic' && ['settings', 'account', 'locations'].includes(sectionKey)) {
        const { data: profile, error } = await supabase.from('mechanic_profiles').select('business_name,years_experience,specializations,location_label,verification_status,is_available').eq('user_id', user.id).maybeSingle()
        if (error) throw error
        data = { profile: profile || {} }
        setForm({
          business_name: profile?.business_name || '',
          years_experience: profile?.years_experience || 0,
          location_label: profile?.location_label || '',
          specializations: Array.isArray(profile?.specializations) ? profile.specializations.join(', ') : '',
          is_available: Boolean(profile?.is_available),
        })
      } else if (role === 'mechanic' && sectionKey === 'notifications') {
        const { data: notifications, error } = await supabase.from('notifications').select('id,title,body,type,is_read,created_at').eq('profile_id', user.id).order('created_at', { ascending: false }).limit(100)
        if (error) throw error
        data = { notifications: notifications || [] }
      } else if (role === 'mechanic' && firstSection === 'jobs' && secondSection) {
        data = thirdSection === 'chat'
          ? await backend(`requests/${encodeURIComponent(secondSection)}/messages`)
          : await backend(`requests/${encodeURIComponent(secondSection)}`)
      } else if (role === 'mechanic' && firstSection === 'requests' && secondSection) {
        data = await backend(`requests/${encodeURIComponent(secondSection)}`)
      } else if (role === 'mechanic' && sectionKey === 'overview') {
        const { data: requests, error } = await supabase.from('rescue_requests').select('id,status,service_type,problem_description,incident_address,created_at').eq('mechanic_id', user.id).in('status', ['accepted', 'en_route', 'arrived', 'in_progress']).order('created_at', { ascending: false }).limit(10)
        if (error) throw error
        data = { requests: requests || [] }
      } else if (role === 'admin' && sectionKey === 'overview') {
        data = await backend('admin/stats')
      } else if (role === 'admin') {
        const routes = {
          users: 'admin/users',
          mechanics: 'admin/mechanics?status=pending',
          requests: 'admin/requests?limit=100',
          incidents: 'admin/incidents',
          reports: 'reports',
          operations: 'admin/requests?limit=100',
          analytics: 'admin/stats',
        }
        const endpoint = routes[firstSection]
        if (!endpoint) throw new Error('This administration workspace is not available.')
        data = await backend(endpoint)
      } else if (role === 'driver' && sectionKey === 'overview') {
        data = await backend('requests')
      } else {
        data = {}
      }
      setState({ loading: false, error: '', data })
    } catch (error) {
      setState({ loading: false, error: error.message || 'Could not load this workspace.', data: null })
    }
  }, [role, sectionKey, firstSection, secondSection, thirdSection])

  useEffect(() => {
    load()
  }, [load])

  function updateForm(event) {
    const { name, value, type, checked } = event.target
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }))
  }

  async function runAction(action) {
    setBusy(true)
    setMessage('')
    try {
      await action()
      await load()
      setMessage('Your changes were saved.')
    } catch (error) {
      setState((current) => ({ ...current, error: error.message || 'The action could not be completed.' }))
    } finally {
      setBusy(false)
    }
  }

  async function saveVehicle(event) {
    event.preventDefault()
    await runAction(async () => {
      const supabase = getSupabaseBrowserClient()
      const payload = {
        ...form,
        vehicle_year: form.vehicle_year ? Number(form.vehicle_year) : null,
      }
      const { data, error } = await supabase.from('driver_profiles').update(payload).eq('user_id', userId).select('user_id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Your driver profile is missing. Contact RescueRide support to restore it.')
    })
  }

  async function saveMechanicProfile(event) {
    event.preventDefault()
    await runAction(async () => {
      const supabase = getSupabaseBrowserClient()
      const { data, error } = await supabase.from('mechanic_profiles').update({
        business_name: form.business_name,
        years_experience: Number(form.years_experience) || 0,
        location_label: form.location_label,
        specializations: String(form.specializations || '').split(',').map((item) => item.trim()).filter(Boolean),
        is_available: Boolean(form.is_available),
      }).eq('user_id', userId).select('user_id').maybeSingle()
      if (error) throw error
      if (!data) throw new Error('Your mechanic profile is missing. Contact RescueRide support to restore it.')
    })
  }

  async function savePreferences(event) {
    event.preventDefault()
    await runAction(async () => {
      const result = await backend('profile/preferences', { method: 'PUT', body: {
        theme: form.theme,
        preferred_language: form.preferred_language,
        secondary_phone: form.secondary_phone,
        home_location_label: form.home_location_label,
        work_location_label: form.work_location_label,
        bio: form.bio,
        notification_preferences: {
          email: Boolean(form.email_notifications),
          sms: Boolean(form.sms_notifications),
          push: Boolean(form.push_notifications),
        },
        communication_preferences: form.communication_preferences || [],
      } })
      const updates = []
      if (form.full_name !== state.data.profile.full_name) {
        updates.push(backend('profile/change-requests', { method: 'POST', body: {
          role: 'driver', target_table: 'profiles', field_key: 'full_name',
          old_value: state.data.profile.full_name || '', new_value: form.full_name, reason: 'Profile update',
        } }))
      }
      if (form.phone !== state.data.profile.phone) {
        updates.push(backend('profile/change-requests', { method: 'POST', body: {
          role: 'driver', target_table: 'profiles', field_key: 'phone',
          old_value: state.data.profile.phone || '', new_value: form.phone, reason: 'Profile update',
        } }))
      }
      await Promise.all(updates)
      if (!result.preferences) throw new Error('Preferences could not be saved.')
    })
  }

  async function updateRequestStatus(requestId, newStatus) {
    await runAction(() => backend('requests/status', {
      method: 'PATCH',
      body: { requestId, newStatus },
    }))
  }

  async function updateMechanicVerification(mechanicUserId, newStatus) {
    if (newStatus === 'rejected' && !window.confirm('Reject this mechanic application? The existing backend disables the rejected account and may permanently delete its sign-in credentials.')) return
    const reason = newStatus === 'rejected' ? window.prompt('Reason for rejecting this application:') : ''
    if (newStatus === 'rejected' && !reason?.trim()) return
    await runAction(() => backend('admin/mechanics', {
      method: 'PATCH',
      body: { mechanicUserId, newStatus, reason },
    }))
  }

  async function markNotificationRead(notificationId) {
    await runAction(async () => {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId).eq('profile_id', userId)
      if (error) throw error
    })
  }

  async function submitEmergencyContact(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const values = new FormData(formElement)
    await runAction(() => backend('safety/emergency-contacts', {
      method: 'POST',
      body: { name: values.get('name'), relationship: values.get('relationship'), phoneNumber: values.get('phoneNumber') },
    }))
    formElement.reset()
  }

  async function submitSos(event) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    await runAction(async () => {
      if (!navigator.geolocation) throw new Error('This browser does not support device location.')
      const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, () => reject(new Error('Location permission is required to raise an SOS.')), { enableHighAccuracy: true, timeout: 15000 }))
      await backend('safety/sos', {
        method: 'POST',
        body: {
          requestId: values.get('requestId'),
          status: 'RAISED',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          message: values.get('message'),
        },
      })
    })
  }

  async function submitReport(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const values = new FormData(formElement)
    await runAction(() => backend('reports', {
      method: 'POST',
      body: {
        requestId: values.get('requestId'),
        reporterId: userId,
        reasonHeader: values.get('reasonHeader'),
        comment: values.get('comment'),
      },
    }))
    formElement.reset()
  }

  async function sendMessage(event) {
    event.preventDefault()
    const formElement = event.currentTarget
    const values = new FormData(formElement)
    const requestId = secondSection
    await runAction(() => backend(`requests/${encodeURIComponent(requestId)}/messages`, {
      method: 'POST',
      body: { message: values.get('message') },
    }))
    formElement.reset()
  }

  async function searchProviders(event) {
    event.preventDefault()
    const term = query.trim().toLocaleLowerCase()
    const allProviders = state.data?.providers || []
    const providers = allProviders.filter((provider) => [
      provider.business_name,
      provider.location_label,
      ...(Array.isArray(provider.specializations) ? provider.specializations : []),
    ].some((value) => String(value || '').toLocaleLowerCase().includes(term)))
    setMessage(`${providers.length} verified, available provider${providers.length === 1 ? '' : 's'} match your search.`)
  }

  if (state.loading) return <div className="surface panel request-history-loading"><LoaderCircle size={19} className="spin" /> Loading live account data…</div>

  const data = state.data || {}
  const requests = data.requests || []
  const activeRequests = requests.filter((request) => isActive(request.status))
  const providerTerm = query.trim().toLocaleLowerCase()
  const visibleProviders = (data.providers || []).filter((provider) => !providerTerm || [
    provider.business_name,
    provider.location_label,
    ...(Array.isArray(provider.specializations) ? provider.specializations : []),
  ].some((value) => String(value || '').toLocaleLowerCase().includes(providerTerm)))

  return (
    <div className="workspace-content">
      <div className="workspace-toolbar">
        <span className="status-chip"><span className="status-dot" /> Live account</span>
        <button className="btn btn-secondary" type="button" onClick={load} disabled={busy}><RefreshCw size={15} /> Refresh</button>
      </div>
      {state.error && <ErrorMessage>{state.error}</ErrorMessage>}
      {message && <SuccessMessage><CheckCircle2 size={15} /> {message}</SuccessMessage>}

      {role === 'driver' && sectionKey === 'overview' && (
        <>
          <section className="surface panel">
            <div className="panel-heading"><div><h2>Current and recent requests</h2><p>Your request activity from the RescueRide service</p></div></div>
            <RequestRows rows={requests.slice(0, 6)} />
            <Link className="btn btn-primary" href={`${root}/requests/new`}>Request assistance</Link>
          </section>
          <div className="action-list">
            <Link className="action-link" href={`${root}/vehicles`}>Manage vehicles</Link>
            <Link className="action-link" href={`${root}/safety`}>Safety and emergency contacts</Link>
            <Link className="action-link" href={`${root}/settings`}>Profile and settings</Link>
          </div>
        </>
      )}

      {role === 'driver' && sectionKey.startsWith('vehicles') && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Vehicle details</h2><p>Saved to your driver profile and available for future assistance requests.</p></div></div>
          <form className="request-form" onSubmit={saveVehicle}>
            <div className="request-vehicle-grid">
              <Field label="Make" name="vehicle_make" value={form.vehicle_make || ''} onChange={updateForm} maxLength={80} />
              <Field label="Model" name="vehicle_model" value={form.vehicle_model || ''} onChange={updateForm} maxLength={80} />
              <Field label="Year" name="vehicle_year" value={form.vehicle_year || ''} onChange={updateForm} type="number" min="1970" max={new Date().getFullYear()} />
              <Field label="Color" name="vehicle_color" value={form.vehicle_color || ''} onChange={updateForm} maxLength={50} />
              <Field label="Number plate" name="vehicle_plate" value={form.vehicle_plate || ''} onChange={updateForm} maxLength={30} />
              <Field label="Home area" name="home_area" value={form.home_area || ''} onChange={updateForm} maxLength={150} />
            </div>
            <button className="btn btn-primary" disabled={busy}>Save vehicle details</button>
          </form>
        </section>
      )}

      {role === 'driver' && sectionKey === 'explore' && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Find verified providers</h2><p>Search provider business names and service areas.</p></div></div>
          <form className="workspace-search" onSubmit={searchProviders}>
            <Field label="Provider or area" name="search" value={query} onChange={(event) => setQuery(event.target.value)} required minLength={2} placeholder="Enter at least two characters" />
            <button className="btn btn-primary" disabled={busy}><Search size={15} /> Search</button>
          </form>
          <RecordList rows={visibleProviders} fields={[['Business', 'business_name'], ['Service area', 'location_label'], ['Specialties', 'specializations'], ['Rating', 'rating_avg']]} actions={(provider) => <Link className="btn btn-primary" href={`${root}/requests/new?mechanic=${encodeURIComponent(provider.user_id)}`}>Request this provider</Link>} />
        </section>
      )}

      {role === 'driver' && ['safety', 'safety/contacts'].includes(sectionKey) && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Emergency contacts</h2><p>These contacts are associated with your authenticated driver account.</p></div></div>
          <RecordList rows={data.contacts || []} fields={[['Name', 'name'], ['Relationship', 'relationship'], ['Phone', 'phone_number']]} />
          <form className="request-form" onSubmit={submitEmergencyContact}>
            <Field label="Contact name" name="name" required maxLength={120} />
            <Field label="Relationship" name="relationship" required maxLength={80} />
            <Field label="Phone number" name="phoneNumber" type="tel" required maxLength={30} />
            <button className="btn btn-primary" disabled={busy}>Add emergency contact</button>
          </form>
          <div className="action-list"><Link className="action-link" href={`${root}/safety/sos`}>Raise SOS for an active request</Link></div>
        </section>
      )}

      {role === 'driver' && sectionKey === 'safety/sos' && (
        <section className="surface panel">
          <div className="form-notice form-notice-error"><AlertTriangle size={16} /> If you are in immediate danger, contact local emergency services first. SOS requires an active roadside request and current device location.</div>
          {activeRequests.length ? (
            <form className="request-form" onSubmit={submitSos}>
              <Field label="Active request" name="requestId" required options={activeRequests.map((request) => [request.id, `${request.service_type} · ${request.status} · ${request.id.slice(0, 8)}`])} />
              <Field label="Message for responders" name="message" type="textarea" maxLength={500} placeholder="Tell responders what is happening." />
              <button className="btn btn-primary" disabled={busy}><AlertTriangle size={15} /> Send SOS with current location</button>
            </form>
          ) : <div className="workspace-empty">There is no active request linked to this account.</div>}
        </section>
      )}

      {role === 'driver' && sectionKey === 'notifications' && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Your notifications</h2><p>Account and request updates</p></div></div>
          <RecordList rows={data.notifications || []} fields={[['Title', 'title'], ['Message', 'body'], ['Type', 'type'], ['Read', 'is_read'], ['Received', 'created_at']]} actions={(row) => !row.is_read && <button className="btn btn-secondary" onClick={() => markNotificationRead(row.id)} disabled={busy}>Mark read</button>} />
        </section>
      )}

      {role === 'driver' && sectionKey === 'settings' && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Profile and preferences</h2><p>Preferences save immediately. Personal identity changes are submitted for review.</p></div></div>
          <form className="request-form" onSubmit={savePreferences}>
            <Field label="Full name" name="full_name" value={form.full_name || ''} onChange={updateForm} required maxLength={120} />
            <Field label="Phone" name="phone" value={form.phone || ''} onChange={updateForm} type="tel" maxLength={30} />
            <Field label="Language" name="preferred_language" value={form.preferred_language || 'en'} onChange={updateForm} />
            <Field label="Theme" name="theme" value={form.theme || 'system'} onChange={updateForm} options={['system', 'light', 'dark'].map((value) => [value, value])} />
            <Field label="Secondary phone" name="secondary_phone" value={form.secondary_phone || ''} onChange={updateForm} type="tel" />
            <Field label="Home area" name="home_location_label" value={form.home_location_label || ''} onChange={updateForm} />
            <Field label="Work area" name="work_location_label" value={form.work_location_label || ''} onChange={updateForm} />
            <Field label="About you" name="bio" value={form.bio || ''} onChange={updateForm} type="textarea" maxLength={1000} />
            <fieldset className="workspace-preference-group">
              <legend>Notification preferences</legend>
              {[
                ['email_notifications', 'Email'],
                ['sms_notifications', 'SMS'],
                ['push_notifications', 'Push notifications'],
              ].map(([name, label]) => <label className="workspace-checkbox" key={name}><input name={name} type="checkbox" checked={Boolean(form[name])} onChange={updateForm} /> {label}</label>)}
            </fieldset>
            <fieldset className="workspace-preference-group">
              <legend>Preferred contact methods</legend>
              {['call', 'sms', 'whatsapp'].map((method) => <label className="workspace-checkbox" key={method}><input type="checkbox" value={method} checked={(form.communication_preferences || []).includes(method)} onChange={toggleCommunication} /> {method}</label>)}
            </fieldset>
            <button className="btn btn-primary" disabled={busy}>Save settings</button>
          </form>
          <div className="panel-heading" style={{ marginTop: 24 }}><div><h2>Profile change requests</h2><p>Identity changes are reviewed by the RescueRide team.</p></div></div>
          <RecordList rows={data.changeRequests || []} fields={[['Field', 'field_key'], ['Requested value', 'new_value'], ['Status', 'status'], ['Submitted', 'created_at']]} />
        </section>
      )}

      {role === 'driver' && sectionKey === 'reports/new' && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Report an issue</h2><p>Reports must relate to a request in your account.</p></div></div>
          {requests.length ? <form className="request-form" onSubmit={submitReport}>
            <Field label="Request" name="requestId" required options={requests.map((request) => [request.id, `${request.service_type} · ${request.id.slice(0, 8)}`])} />
            <Field label="Reason" name="reasonHeader" required options={[['inappropriate_behavior', 'Inappropriate behavior'], ['pricing_issue', 'Pricing issue'], ['delay', 'Delay'], ['other', 'Other']]} />
            <Field label="Details" name="comment" type="textarea" required minLength={8} maxLength={2000} />
            <button className="btn btn-primary" disabled={busy}>Submit report</button>
          </form> : <div className="workspace-empty">Submit a roadside request before filing a request-related report.</div>}
        </section>
      )}

      {role === 'driver' && sectionKey === 'vehicles/service-history' && <RequestRows rows={requests} />}

      {role === 'mechanic' && ['requests', 'jobs', 'history'].includes(sectionKey) && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>{sectionKey === 'requests' ? 'Incoming requests' : sectionKey === 'jobs' ? 'Active jobs' : 'Job history'}</h2><p>Live request records visible to your mechanic account</p></div></div>
          <RequestRows rows={requests} onStatus={sectionKey === 'requests' ? (row) => <button className="btn btn-primary" disabled={busy} onClick={() => updateRequestStatus(row.id, 'accepted')}>Accept request</button> : sectionKey === 'jobs' ? (row) => <div className="workspace-actions">
            {row.status === 'accepted' && <button className="btn btn-secondary" disabled={busy} onClick={() => updateRequestStatus(row.id, 'en_route')}>En route</button>}
            {row.status === 'en_route' && <button className="btn btn-secondary" disabled={busy} onClick={() => updateRequestStatus(row.id, 'arrived')}>Arrived</button>}
            {row.status === 'arrived' && <button className="btn btn-secondary" disabled={busy} onClick={() => updateRequestStatus(row.id, 'in_progress')}>Start work</button>}
            {row.status === 'in_progress' && <button className="btn btn-primary" disabled={busy} onClick={() => updateRequestStatus(row.id, 'completed')}>Complete job</button>}
            <Link className="btn btn-secondary" href={`${root}/jobs/${encodeURIComponent(row.id)}/chat`}>Message driver</Link>
          </div> : undefined} />
        </section>
      )}

      {role === 'mechanic' && ['settings', 'account', 'locations'].includes(sectionKey) && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Mechanic profile</h2><p>Verified providers can manage availability and service profile information.</p></div></div>
          <p className="status-chip">Verification: {data.profile?.verification_status || 'pending'}</p>
          <form className="request-form" onSubmit={saveMechanicProfile}>
            <Field label="Business name" name="business_name" value={form.business_name || ''} onChange={updateForm} maxLength={150} />
            <Field label="Years of experience" name="years_experience" value={form.years_experience || 0} onChange={updateForm} type="number" min="0" max="80" />
            <Field label="Specializations (comma separated)" name="specializations" value={form.specializations || ''} onChange={updateForm} placeholder="Towing, battery, tyres" />
            <Field label="Service area" name="location_label" value={form.location_label || ''} onChange={updateForm} maxLength={150} />
            <label className="workspace-checkbox"><input name="is_available" type="checkbox" checked={Boolean(form.is_available)} onChange={updateForm} disabled={data.profile?.verification_status !== 'approved'} /> Available for requests</label>
            {data.profile?.verification_status !== 'approved' && <small>Availability is enabled after mechanic verification.</small>}
            <button className="btn btn-primary" disabled={busy}>Save mechanic profile</button>
          </form>
        </section>
      )}

      {role === 'mechanic' && sectionKey === 'notifications' && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Your notifications</h2><p>Job and account updates</p></div></div>
          <RecordList rows={data.notifications || []} fields={[['Title', 'title'], ['Message', 'body'], ['Type', 'type'], ['Read', 'is_read'], ['Received', 'created_at']]} actions={(row) => !row.is_read && <button className="btn btn-secondary" onClick={() => markNotificationRead(row.id)} disabled={busy}>Mark read</button>} />
        </section>
      )}

      {role === 'mechanic' && firstSection === 'jobs' && thirdSection === 'chat' && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Job messages</h2><p>Conversation for request {secondSection}</p></div></div>
          <RecordList rows={data.messages || []} fields={[['Message', 'message'], ['Sender', 'sender_id'], ['Sent', 'created_at']]} />
          <form className="request-form" onSubmit={sendMessage}><Field label="Message" name="message" type="textarea" required maxLength={1000} /><button className="btn btn-primary" disabled={busy}>Send message</button></form>
        </section>
      )}

      {role === 'admin' && sectionKey === 'overview' && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Live platform statistics</h2><p>Values are loaded from the authenticated admin service</p></div></div><RecordList rows={Object.entries(data.stats || {}).map(([label, value]) => ({ id: label, label, value }))} fields={[['Metric', 'label'], ['Count', 'value']]} />
          <div className="action-list">
            <Link className="action-link" href={`${root}/users`}>People and access</Link>
            <Link className="action-link" href={`${root}/mechanics`}>Mechanic verification</Link>
            <Link className="action-link" href={`${root}/requests`}>Request management</Link>
            <Link className="action-link" href={`${root}/incidents`}>Incidents and reports</Link>
          </div>
        </section>
      )}

      {role === 'admin' && firstSection === 'users' && (
        <section className="surface panel"><div className="panel-heading"><div><h2>People and access</h2><p>Account records from the protected admin API</p></div></div>
          <RecordList rows={data.users || []} fields={[['Name', 'full_name'], ['Email', 'email'], ['Phone', 'phone'], ['Role', 'role'], ['Created', 'created_at']]} />
        </section>
      )}

      {role === 'admin' && firstSection === 'mechanics' && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Mechanic verification</h2><p>Review applications; rejection requires a reason.</p></div></div>
          <RecordList rows={data.mechanics || []} fields={[['Business', 'business_name'], ['Name', 'user.full_name'], ['Phone', 'user.phone'], ['Experience', 'years_experience'], ['Status', 'verification_status']]} actions={(row) => <div className="workspace-actions">
            <button className="btn btn-primary" disabled={busy} onClick={() => updateMechanicVerification(row.user_id || row.id, 'approved')}>Approve</button>
            <button className="btn btn-secondary" disabled={busy} onClick={() => updateMechanicVerification(row.user_id || row.id, 'rejected')}>Reject</button>
          </div>} />
        </section>
      )}

      {role === 'admin' && ['requests', 'operations'].includes(firstSection) && (
        <section className="surface panel"><div className="panel-heading"><div><h2>{firstSection === 'operations' ? 'Live operations' : 'Request management'}</h2><p>Current request records from the admin API</p></div></div>
          <RequestRows rows={data.requests} />
        </section>
      )}

      {role === 'admin' && firstSection === 'incidents' && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Incident review</h2><p>Review and update incident statuses</p></div></div>
          <RecordList rows={data.incidents || []} fields={[['Status', 'status'], ['Category', 'category'], ['Description', 'description'], ['Created', 'created_at']]} actions={(row) => {
            const status = String(row.status || '').toUpperCase()
            return <div className="workspace-actions">
              {status === 'OPEN' && <button className="btn btn-secondary" disabled={busy} onClick={() => runAction(() => backend('admin/incidents', { method: 'PATCH', body: { incidentId: row.id, status: 'IN_REVIEW' } }))}>Start review</button>}
              {status === 'IN_REVIEW' && <button className="btn btn-primary" disabled={busy} onClick={() => runAction(() => backend('admin/incidents', { method: 'PATCH', body: { incidentId: row.id, status: 'RESOLVED' } }))}>Resolve</button>}
            </div>
          }} />
        </section>
      )}

      {role === 'admin' && firstSection === 'reports' && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Reports</h2><p>Reported concerns from the protected admin service</p></div></div>
          <RecordList rows={data.reports || []} fields={[['Reason', 'reason_header'], ['Comment', 'comment'], ['Created', 'created_at'], ['Request', 'request_id']]} />
        </section>
      )}

      {role === 'admin' && firstSection === 'analytics' && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Platform analytics</h2><p>Live aggregate values</p></div></div><RecordList rows={Object.entries(data.stats || {}).map(([label, value]) => ({ id: label, label, value }))} fields={[['Metric', 'label'], ['Count', 'value']]} /></section>
      )}

      {(role === 'driver' && firstSection === 'requests' && thirdSection === 'chat') && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Request messages</h2><p>Conversation for request {secondSection}</p></div></div>
          <RecordList rows={data.messages || []} fields={[['Message', 'message'], ['Sender', 'sender_id'], ['Sent', 'created_at']]} />
          <form className="request-form" onSubmit={sendMessage}><Field label="Message" name="message" type="textarea" required maxLength={1000} /><button className="btn btn-primary" disabled={busy}>Send message</button></form>
        </section>
      )}

      {(role === 'driver' && firstSection === 'requests' && secondSection && !thirdSection) && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Request details</h2><p>Server-verified details visible to your account</p></div></div>
          {data.request ? <RecordList rows={[data.request]} fields={[['ID', 'id'], ['Status', 'status'], ['Service', 'service_type'], ['Problem', 'problem_description'], ['Address', 'incident_address'], ['Created', 'created_at']]} /> : <div className="workspace-empty">Request details unavailable.</div>}
          <Link className="btn btn-secondary" href={`${root}/requests`}>Back to requests</Link>
        </section>
      )}

      {role === 'mechanic' && firstSection === 'jobs' && secondSection && (!thirdSection || thirdSection === 'complete') && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Job details</h2><p>Server verifies request participation and permissions.</p></div></div>
          {data.request && <RecordList rows={[data.request]} fields={[['ID', 'id'], ['Status', 'status'], ['Service', 'service_type'], ['Problem', 'problem_description'], ['Address', 'incident_address'], ['Vehicle', 'vehicle_make'], ['Created', 'created_at']]} />}
          {data.request?.status === 'in_progress' && <button className="btn btn-primary" onClick={() => updateRequestStatus(secondSection, 'completed')} disabled={busy}>Complete job</button>}
        </section>
      )}

      {role === 'mechanic' && firstSection === 'requests' && secondSection && (
        <section className="surface panel">
          <div className="panel-heading"><div><h2>Request details</h2><p>Review details before accepting the request.</p></div></div>
          {data.request && <RecordList rows={[data.request]} fields={[['ID', 'id'], ['Status', 'status'], ['Service', 'service_type'], ['Problem', 'problem_description'], ['Address', 'incident_address'], ['Vehicle', 'vehicle_make'], ['Created', 'created_at']]} />}
          {data.request?.status === 'pending' && <button className="btn btn-primary" onClick={() => updateRequestStatus(secondSection, 'accepted')} disabled={busy}>Accept request</button>}
        </section>
      )}

      {role === 'driver' && sectionKey === 'notifications' && data.notifications?.length === 0 && <div className="workspace-empty">You’re all caught up.</div>}
      {role === 'mechanic' && sectionKey === 'notifications' && data.notifications?.length === 0 && <div className="workspace-empty">You’re all caught up.</div>}
      {(role === 'driver' && ['help', 'safety'].includes(sectionKey) && !['safety', 'safety/contacts'].includes(sectionKey)) && (
        <section className="surface panel"><div className="panel-heading"><div><h2>Help and support</h2><p>Need help with your account or an active request?</p></div></div><p>For immediate danger, contact local emergency services. For account or request assistance, use the contact details provided by your RescueRide operator.</p><Link href={`${root}/requests`} className="btn btn-secondary">Review my requests</Link></section>
      )}
      {role === 'mechanic' && sectionKey === 'support' && <section className="surface panel"><h2>Mechanic support</h2><p>For account or dispatch assistance, contact the RescueRide operations team.</p></section>}
      {role === 'admin' && ['help', 'settings'].includes(sectionKey) && <section className="surface panel"><h2>Administration settings</h2><p>There are no self-service system settings available through the current backend API.</p></section>}
      {role === 'mechanic' && sectionKey === 'overview' && <section className="surface panel"><div className="panel-heading"><div><h2>Active jobs</h2><p>Current assignments from your mechanic account</p></div></div><RequestRows rows={requests} /><div className="action-list"><Link className="action-link" href={`${root}/requests`}>Incoming requests</Link><Link className="action-link" href={`${root}/jobs`}>Active jobs</Link><Link className="action-link" href={`${root}/settings`}>Mechanic profile</Link></div></section>}
    </div>
  )
}
