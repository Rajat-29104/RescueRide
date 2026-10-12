'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ClipboardList, LoaderCircle, MapPin, Wrench } from 'lucide-react'
import { EmptyState } from './DashboardPrimitives'

const serviceLabels = {
  repair: 'General repair',
  towing: 'Towing',
  tyre_change: 'Tyre change',
  battery_jump: 'Battery jump',
  fuel_delivery: 'Fuel delivery',
  other: 'Other assistance',
}

function RequestCard({ request }) {
  return (
    <Link className="request-history-card surface" href={`/dashboard/driver/requests/${encodeURIComponent(request.id)}`}>
      <span className="request-history-icon"><Wrench size={17} /></span>
      <span className="request-history-copy">
        <strong>{serviceLabels[request.service_type] || request.service_type}</strong>
        <span>{request.problem_description}</span>
        {request.incident_address && <small><MapPin size={12} /> {request.incident_address}</small>}
      </span>
      <span className={`request-status request-status-${request.status}`}>{request.status.replaceAll('_', ' ')}</span>
    </Link>
  )
}

export default function RequestHistory({ requestId }) {
  const [state, setState] = useState({ loading: true, error: '', requests: [] })

  useEffect(() => {
    let active = true
    const query = requestId ? `?id=${encodeURIComponent(requestId)}` : ''

    async function loadRequests() {
      try {
        const response = await fetch(`/api/backend/requests${query}`, { cache: 'no-store' })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Could not load requests.')
        if (active) setState({ loading: false, error: '', requests: requestId ? [result.request] : result.requests || [] })
      } catch (error) {
        if (active) setState({ loading: false, error: error.message, requests: [] })
      }
    }

    loadRequests()
    return () => { active = false }
  }, [requestId])

  if (state.loading) {
    return <div className="surface panel request-history-loading"><LoaderCircle size={19} className="spin" /> Loading your requests…</div>
  }

  if (state.error) {
    return (
      <div className="surface panel">
        <div className="preview-notice preview-notice-error" role="alert">{state.error}</div>
        {state.error.toLowerCase().includes('unauthorized') && <Link className="btn btn-primary" href="/auth/login" style={{ marginTop: 16 }}>Sign in to view requests</Link>}
      </div>
    )
  }

  if (state.requests.length === 0) {
    return (
      <section className="surface panel">
        <EmptyState icon={ClipboardList} title="No assistance requests yet">
          When you submit a request, its live status and details will appear here.
        </EmptyState>
        {!requestId && <Link className="btn btn-primary" href="/dashboard/driver/requests/new">Request assistance</Link>}
      </section>
    )
  }

  if (requestId) {
    const [request] = state.requests
    return (
      <section className="surface panel request-detail">
        <div className="request-detail-status"><span className={`request-status request-status-${request.status}`}>{request.status.replaceAll('_', ' ')}</span></div>
        <dl className="request-result-details">
          <div><dt>Request ID</dt><dd>{request.id}</dd></div>
          <div><dt>Service</dt><dd>{serviceLabels[request.service_type] || request.service_type}</dd></div>
          <div><dt>Problem</dt><dd>{request.problem_description}</dd></div>
          <div><dt>Location</dt><dd>{request.incident_address || 'Not provided'}</dd></div>
          <div><dt>Vehicle</dt><dd>{[request.vehicle_year, request.vehicle_make, request.vehicle_model].filter(Boolean).join(' ') || 'Not provided'}</dd></div>
          <div><dt>Number plate</dt><dd>{request.vehicle_plate || 'Not provided'}</dd></div>
          <div><dt>Created</dt><dd>{new Date(request.created_at).toLocaleString()}</dd></div>
        </dl>
        <Link className="btn btn-secondary" href="/dashboard/driver/requests">Back to my requests</Link>
      </section>
    )
  }

  return <div className="request-history-list">{state.requests.map((request) => <RequestCard key={request.id} request={request} />)}</div>
}
