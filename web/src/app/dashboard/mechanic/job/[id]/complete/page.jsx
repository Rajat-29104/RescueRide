'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import PageWrapper from '@/components/layout/PageWrapper'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Textarea from '@/components/ui/Textarea'
import Spinner from '@/components/ui/Spinner'
import Input from '@/components/ui/Input'
import { formatINR, isValidFinalCost } from '@/lib/requestCost'

const services = [
  'Tire Change',
  'Jumpstart',
  'Fuel Delivery',
  'Diagnostic Scan',
]

export default function JobCompletionPage() {
  const { id } = useParams()
  const router = useRouter()
  const [job, setJob] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [notes, setNotes] = useState('')
  const [performed, setPerformed] = useState(['Tire Change'])
  const [finalCost, setFinalCost] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')

  useEffect(() => {
    let mounted = true

    async function loadJob() {
      const response = await fetch(`/api/requests/${id}`)
      const payload = await response.json()

      if (mounted) {
        setJob(response.ok ? payload.request : null)
        setLoading(false)
      }
    }

    loadJob()
    return () => { mounted = false }
  }, [id])

  async function submitCompletion() {
    setSubmitting(true)
    try {
      const response = await fetch('/api/requests/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: id,
          newStatus: 'completed',
          completionNotes: notes,
          performedServices: performed,
          finalCost,
          paymentMethod,
        }),
      })

      const payload = await response.json()
      if (!response.ok) throw new Error(payload.error || 'Unable to complete job')

      router.push(`/dashboard/mechanic/job/${id}`)
    } catch (error) {
      alert(error.message)
    } finally {
      setSubmitting(false)
    }
  }

  function toggleService(service) {
    setPerformed((current) => current.includes(service) ? current.filter((item) => item !== service) : [...current, service])
  }

  return (
    <PageWrapper title="Job completion report" description="Record the final service details and close the rescue ticket.">
      {loading ? (
        <div className="flex h-[50vh] items-center justify-center"><Spinner /></div>
      ) : !job ? (
        <Card><div className="py-12 text-center text-sm text-muted">Job not found.</div></Card>
      ) : (
        <div className="mx-auto max-w-2xl space-y-5">
          <Card className="p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#7C7767]">Ticket #{job.id}</p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">{job.service_type?.replace('_', ' ')}</h2>
            <p className="mt-1 text-sm text-[#7C7767]">{job.incident_address || 'Location pending'}</p>
            {job.estimated_cost_min !== null && job.estimated_cost_max !== null && (
              <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900">
                Customer estimate: {formatINR(job.estimated_cost_min)}–{formatINR(job.estimated_cost_max)}
              </p>
            )}
          </Card>

          <Card className="p-4">
            <p className="text-xs uppercase tracking-[0.22em] text-[#7C7767]">Services performed</p>
            <div className="mt-3 space-y-3">
              {services.map((service) => (
                <button key={service} onClick={() => toggleService(service)} className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left ${performed.includes(service) ? 'border-primary bg-primary/10' : 'border-[#7C7767]/25 bg-[#F3F4F6]'}`}>
                  <span className="text-sm font-semibold text-[#111827]">{service}</span>
                  <span className={`h-4 w-4 rounded border ${performed.includes(service) ? 'border-primary bg-primary' : 'border-[#7C7767]/25 bg-[#F3F4F6]'}`} />
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <Textarea label="Service notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Describe work done, parts used, or follow-up recommendations..." />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Input
                label="Final service cost (INR)"
                type="number"
                min="0"
                max="1000000"
                step="0.01"
                required
                value={finalCost}
                onChange={(event) => setFinalCost(event.target.value)}
                placeholder="Enter agreed final amount"
              />
              <label className="space-y-1.5 text-sm font-medium text-foreground">
                Payment method
                <select
                  required
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-white px-3 text-sm"
                >
                  <option value="cash">Cash</option>
                  <option value="upi">UPI (record only; no payment gateway connected)</option>
                </select>
              </label>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              This records the agreed bill only. UPI payments are not processed by RoadRescue.
            </p>
            {!isValidFinalCost(finalCost) && (
              <p className="mt-3 text-xs font-medium text-amber-700" role="status">
                Enter the agreed final service cost to complete this job.
              </p>
            )}
            <Button
              fullWidth
              className="mt-5"
              loading={submitting}
              disabled={!isValidFinalCost(finalCost)}
              onClick={submitCompletion}
            >
              Complete service & save final cost
            </Button>
          </Card>
        </div>
      )}
    </PageWrapper>
  )
}