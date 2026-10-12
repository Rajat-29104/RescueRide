'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { LoaderCircle, MapPin, ShieldCheck, Wrench } from 'lucide-react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const serviceTypes = [
  ['repair', 'General repair'],
  ['towing', 'Towing'],
  ['tyre_change', 'Tyre change'],
  ['battery_jump', 'Battery jump'],
  ['fuel_delivery', 'Fuel delivery'],
  ['other', 'Other assistance'],
]

export default function RequestForm({ initialMechanicId = '' }) {
  const [vehicle, setVehicle] = useState({})
  const [vehicleProfileError, setVehicleProfileError] = useState('')
  const [mechanics, setMechanics] = useState([])
  const [mechanicsState, setMechanicsState] = useState({ loading: true, error: '', requiresSignIn: false })
  const [dispatchMode, setDispatchMode] = useState(initialMechanicId ? 'mechanic' : 'automatic')
  const [mechanicId, setMechanicId] = useState(initialMechanicId)
  const [location, setLocation] = useState(null)
  const [locating, setLocating] = useState(false)
  const [formError, setFormError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [createdRequest, setCreatedRequest] = useState(null)

  useEffect(() => {
    let active = true

    async function loadVehicle() {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError) throw authError
        if (!user) return
        const { data, error } = await supabase
          .from('driver_profiles')
          .select('vehicle_make, vehicle_model, vehicle_year, vehicle_color, vehicle_plate')
          .eq('user_id', user.id)
          .maybeSingle()
        if (error) throw error
        if (active) setVehicle(data || {})
      } catch (error) {
        if (active) setVehicleProfileError(error.message || 'Saved vehicle details could not be loaded.')
      }
    }

    async function loadMechanics() {
      try {
        const { data: { session }, error: sessionError } = await getSupabaseBrowserClient().auth.getSession()
        if (sessionError) throw sessionError
        if (!session) {
          if (active) {
            setMechanicsState({ loading: false, error: 'Authentication required.', requiresSignIn: true })
          }
          return
        }

        const response = await fetch('/api/backend/mechanics/available', { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) {
          setMechanicsState({
            loading: false,
            error: result.error || 'Could not load available mechanics.',
            requiresSignIn: response.status === 401,
          })
          return
        }
        if (active) {
          setMechanics(result.mechanics || [])
          setMechanicsState({ loading: false, error: '', requiresSignIn: false })
        }
      } catch (error) {
        if (active) setMechanicsState({ loading: false, error: error.message, requiresSignIn: false })
      }
    }

    loadMechanics()
    loadVehicle()
    return () => { active = false }
  }, [])

  function updateVehicle(event) {
    const { name, value } = event.target
    const profileField = {
      vehicleMake: 'vehicle_make',
      vehicleModel: 'vehicle_model',
      vehicleYear: 'vehicle_year',
      vehicleColor: 'vehicle_color',
      vehiclePlate: 'vehicle_plate',
    }[name]
    setVehicle((current) => ({ ...current, [profileField]: value }))
  }

  function locateDriver() {
    setFormError('')
    if (!navigator.geolocation) {
      setFormError('This browser does not support location sharing. Allow location access or use a device with GPS.')
      return
    }

    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: Math.round(coords.accuracy),
        })
        setLocating(false)
      },
      (error) => {
        setFormError(error.code === error.PERMISSION_DENIED
          ? 'Location access was denied. Enable it in your browser settings to request roadside assistance.'
          : 'Could not determine your location. Try again or check your device location settings.')
        setLocating(false)
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  async function submitRequest(event) {
    event.preventDefault()
    setFormError('')
    setCreatedRequest(null)

    if (!location) {
      setFormError('Share your current location before submitting the request.')
      return
    }
    if (dispatchMode === 'mechanic' && !mechanicId) {
      setFormError('Choose an available mechanic or switch to automatic matching.')
      return
    }

    const form = new FormData(event.currentTarget)
    const payload = {
      serviceType: form.get('serviceType'),
      problemDescription: String(form.get('problemDescription') || '').trim(),
      incidentAddress: String(form.get('incidentAddress') || '').trim(),
      incidentLat: location.latitude,
      incidentLng: location.longitude,
      vehicleMake: String(form.get('vehicleMake') || '').trim(),
      vehicleModel: String(form.get('vehicleModel') || '').trim(),
      vehicleYear: String(form.get('vehicleYear') || ''),
      vehicleColor: String(form.get('vehicleColor') || '').trim(),
      vehiclePlate: String(form.get('vehiclePlate') || '').trim(),
      target_mechanic_id: dispatchMode === 'mechanic' ? mechanicId : null,
    }

    setSubmitting(true)
    try {
      const response = await fetch('/api/backend/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'The request could not be created.')
      setCreatedRequest(result.request)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (createdRequest) {
    return (
      <section className="surface panel request-result" aria-live="polite">
        <div className="request-result-icon"><ShieldCheck size={23} /></div>
        <h2>Request submitted</h2>
        <p>Your request was saved by RescueRide. Check its status in your request list; provider acceptance is not guaranteed.</p>
        <dl className="request-result-details">
          <div><dt>Request ID</dt><dd>{createdRequest.id}</dd></div>
          <div><dt>Service</dt><dd>{serviceTypes.find(([value]) => value === createdRequest.service_type)?.[1] || createdRequest.service_type}</dd></div>
          <div><dt>Status</dt><dd>{createdRequest.status}</dd></div>
        </dl>
        <Link className="btn btn-primary" href="/dashboard/driver/requests">View my requests</Link>
      </section>
    )
  }

  return (
    <form className="surface panel request-form" onSubmit={submitRequest}>
      <div className="request-form-section">
        <div className="request-section-title"><span>01</span><div><h2>What help do you need?</h2><p>Tell the mechanic what happened.</p></div></div>
        <div className="field">
          <label htmlFor="serviceType">Service type</label>
          <select id="serviceType" name="serviceType" required defaultValue="">
            <option value="" disabled>Select the roadside service</option>
            {serviceTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="problemDescription">Describe the problem</label>
          <textarea id="problemDescription" name="problemDescription" required minLength={8} maxLength={2000} placeholder="For example: the engine won't start and the dashboard battery light is on." />
        </div>
      </div>

      <div className="request-form-section">
        <div className="request-section-title"><span>02</span><div><h2>Where are you?</h2><p>We need your current coordinates to dispatch assistance.</p></div></div>
        <button className="btn btn-secondary" type="button" onClick={locateDriver} disabled={locating}>
          {locating ? <LoaderCircle size={16} className="spin" /> : <MapPin size={16} />}
          {locating ? 'Finding location…' : location ? 'Update current location' : 'Use my current location'}
        </button>
        {location && <p className="location-confirmation"><MapPin size={14} /> Location captured (±{location.accuracy} m)</p>}
        <div className="field">
          <label htmlFor="incidentAddress">Address or nearby landmark</label>
          <input id="incidentAddress" name="incidentAddress" required maxLength={250} placeholder="Street, area, or nearby landmark" />
        </div>
      </div>

      <div className="request-form-section">
        <div className="request-section-title"><span>03</span><div><h2>Vehicle details</h2><p>Optional, but helps the mechanic identify your vehicle.</p></div></div>
        {vehicleProfileError && <div className="form-notice form-notice-error" role="alert">{vehicleProfileError} You can still enter the vehicle details below.</div>}
        <div className="request-vehicle-grid">
          <div className="field"><label htmlFor="vehicleMake">Make</label><input id="vehicleMake" name="vehicleMake" maxLength={80} value={vehicle.vehicle_make || ''} onChange={updateVehicle} placeholder="e.g. Toyota" /></div>
          <div className="field"><label htmlFor="vehicleModel">Model</label><input id="vehicleModel" name="vehicleModel" maxLength={80} value={vehicle.vehicle_model || ''} onChange={updateVehicle} placeholder="e.g. Corolla" /></div>
          <div className="field"><label htmlFor="vehicleYear">Year</label><input id="vehicleYear" name="vehicleYear" type="number" min="1970" max={new Date().getFullYear()} value={vehicle.vehicle_year || ''} onChange={updateVehicle} placeholder="e.g. 2020" /></div>
          <div className="field"><label htmlFor="vehicleColor">Color</label><input id="vehicleColor" name="vehicleColor" maxLength={50} value={vehicle.vehicle_color || ''} onChange={updateVehicle} placeholder="e.g. Silver" /></div>
          <div className="field"><label htmlFor="vehiclePlate">Number plate</label><input id="vehiclePlate" name="vehiclePlate" maxLength={30} value={vehicle.vehicle_plate || ''} onChange={updateVehicle} placeholder="Vehicle registration" /></div>
        </div>
      </div>

      <div className="request-form-section">
        <div className="request-section-title"><span>04</span><div><h2>Choose dispatch</h2><p>Automatic matching finds nearby verified providers, or choose one directly.</p></div></div>
        {mechanicsState.requiresSignIn && (
          <div className="form-notice" role="status">
            Sign in with a driver account to load verified mechanics and submit a real request. <Link href="/auth/login">Sign in</Link>
          </div>
        )}
        <div className="request-dispatch-options">
          <label className={`request-dispatch-option${dispatchMode === 'automatic' ? ' selected' : ''}`}>
            <input type="radio" name="dispatchMode" value="automatic" checked={dispatchMode === 'automatic'} onChange={() => setDispatchMode('automatic')} />
            <span><strong>Find available help</strong><small>Send this request for automatic provider matching.</small></span>
          </label>
          <label className={`request-dispatch-option${dispatchMode === 'mechanic' ? ' selected' : ''}`}>
            <input type="radio" name="dispatchMode" value="mechanic" checked={dispatchMode === 'mechanic'} onChange={() => setDispatchMode('mechanic')} />
            <span><strong>Choose a mechanic</strong><small>Dispatch directly to one verified, available mechanic.</small></span>
          </label>
        </div>
        {dispatchMode === 'mechanic' && (
          <div className="field">
            <label htmlFor="mechanicId">Available mechanic</label>
            <select id="mechanicId" value={mechanicId} onChange={(event) => setMechanicId(event.target.value)} required>
              <option value="" disabled>{mechanicsState.loading ? 'Loading verified mechanics…' : 'Select an available mechanic'}</option>
              {mechanics.map((mechanic) => (
                <option value={mechanic.user_id} key={mechanic.user_id}>
                  {mechanic.business_name || 'Verified mechanic'}{mechanic.specializations?.length ? ` · ${mechanic.specializations.join(', ')}` : ''}
                </option>
              ))}
            </select>
            {mechanicId && (() => {
              const selectedMechanic = mechanics.find((mechanic) => mechanic.user_id === mechanicId)
              if (!selectedMechanic) return null
              return (
                <small>
                  {selectedMechanic.location_label || 'Service location not listed'}
                  {selectedMechanic.rating_count > 0 && ` · ${Number(selectedMechanic.rating_avg).toFixed(1)} from ${selectedMechanic.rating_count} reviews`}
                </small>
              )
            })()}
            {mechanicsState.loading && <small>Loading the current verified and available provider list…</small>}
            {!mechanicsState.loading && !mechanicsState.error && mechanics.length === 0 && <small>No verified, available mechanics are currently listed.</small>}
            {mechanicsState.error && (
              <small className="form-error-text">
                {mechanicsState.error}
                {mechanicsState.requiresSignIn && <> <Link href="/auth/login">Sign in as a driver</Link> and reload this page.</>}
              </small>
            )}
          </div>
        )}
      </div>

      {formError && <div className="form-notice form-notice-error" role="alert">{formError}</div>}
      <div className="request-form-footer">
        <p><ShieldCheck size={15} /> Your request is sent to RescueRide only after you submit it.</p>
        <button className="btn btn-primary" type="submit" disabled={submitting || mechanicsState.loading && dispatchMode === 'mechanic'}>
          {submitting ? <><LoaderCircle size={16} className="spin" /> Submitting…</> : <><Wrench size={16} /> Submit assistance request</>}
        </button>
      </div>
    </form>
  )
}
