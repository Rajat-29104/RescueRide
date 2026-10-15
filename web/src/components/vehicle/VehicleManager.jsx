'use client'

import { useEffect, useState } from 'react'
import { CarFront, Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import Input from '@/components/ui/Input'

const emptyVehicle = {
  vehicleType: 'car',
  make: '',
  model: '',
  year: '',
  fuelType: 'other',
  color: '',
  registrationNumber: '',
}

const vehicleTypes = [
  ['car', 'Car'],
  ['motorcycle', 'Motorcycle'],
  ['van', 'Van'],
  ['truck', 'Truck'],
  ['bus', 'Bus'],
  ['other', 'Other'],
]

const fuelTypes = [
  ['petrol', 'Petrol'],
  ['diesel', 'Diesel'],
  ['hybrid', 'Hybrid'],
  ['electric', 'Electric'],
  ['lpg', 'LPG'],
  ['other', 'Other'],
]

async function readResponse(response) {
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Vehicle request failed.')
  return result
}

export default function VehicleManager() {
  const [vehicles, setVehicles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyVehicle)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    async function loadVehicles() {
      try {
        const result = await readResponse(await fetch('/api/vehicles'))
        if (active) {
          setVehicles(result.vehicles)
          setError('')
        }
      } catch (loadError) {
        if (active) setError(loadError.message)
      } finally {
        if (active) setLoading(false)
      }
    }

    loadVehicles()
    return () => {
      active = false
    }
  }, [])

  function closeForm() {
    setForm(emptyVehicle)
    setEditingId(null)
    setFormOpen(false)
    setError('')
  }

  function editVehicle(vehicle) {
    setForm({
      vehicleType: vehicle.vehicle_type,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year ?? '',
      fuelType: vehicle.fuel_type,
      color: vehicle.color ?? '',
      registrationNumber: vehicle.registration_number ?? '',
    })
    setEditingId(vehicle.id)
    setFormOpen(true)
    setError('')
  }

  async function saveVehicle(event) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const response = await fetch(editingId ? `/api/vehicles/${editingId}` : '/api/vehicles', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const result = await readResponse(response)
      setVehicles((current) => editingId
        ? current.map((vehicle) => vehicle.id === editingId ? result.vehicle : vehicle)
        : [result.vehicle, ...current])
      closeForm()
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setSaving(false)
    }
  }

  async function deleteVehicle(vehicle) {
    const label = `${vehicle.make} ${vehicle.model}`
    if (!window.confirm(`Remove ${label} from your saved vehicles? Existing service records will be kept.`)) return

    setError('')
    try {
      const response = await fetch(`/api/vehicles/${vehicle.id}`, { method: 'DELETE' })
      await readResponse(response)
      setVehicles((current) => current.filter((item) => item.id !== vehicle.id))
      if (editingId === vehicle.id) closeForm()
    } catch (deleteError) {
      setError(deleteError.message)
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-[#DCCDA9] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#E0D5B7] bg-[#FFF9EF] px-4 py-3.5">
        <h2 className="flex items-center gap-2 text-sm font-black text-[#1F1B10]">
          <CarFront size={16} className="text-primary" />
          My Vehicles
        </h2>
        {!formOpen && (
          <button
            type="button"
            onClick={() => { setError(''); setFormOpen(true) }}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800"
          >
            <Plus size={14} />
            Add vehicle
          </button>
        )}
      </div>

      <div className="space-y-3 p-4">
        <p className="text-xs leading-5 text-slate-600">
          Save your vehicles here to select one quickly when requesting roadside assistance.
        </p>

        {error && (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-3 text-sm text-slate-500">Loading vehicles…</p>
        ) : vehicles.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[#DCCDA9] bg-[#FFFCF6] px-4 py-5 text-center text-sm text-slate-500">
            No saved vehicles yet. Add one to speed up your next request.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {vehicles.map((vehicle) => (
              <article key={vehicle.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-slate-900">
                      {vehicle.make} {vehicle.model}
                    </h3>
                    <p className="mt-1 text-xs capitalize text-slate-500">
                      {[vehicle.year, vehicle.vehicle_type, vehicle.fuel_type].filter(Boolean).join(' · ')}
                    </p>
                    {vehicle.registration_number && (
                      <p className="mt-1 font-mono text-xs font-semibold text-slate-700">
                        {vehicle.registration_number}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => editVehicle(vehicle)}
                      aria-label={`Edit ${vehicle.make} ${vehicle.model}`}
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteVehicle(vehicle)}
                      aria-label={`Remove ${vehicle.make} ${vehicle.model}`}
                      className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {formOpen && (
          <form onSubmit={saveVehicle} className="space-y-4 rounded-xl border border-amber-200 bg-[#FFFCF6] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                {editingId ? 'Edit vehicle' : 'Add a vehicle'}
              </h3>
              <button
                type="button"
                onClick={closeForm}
                aria-label="Close vehicle form"
                className="rounded-lg p-1.5 text-slate-500 hover:bg-white"
              >
                <X size={17} />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-slate-700">
                Vehicle type
                <select
                  value={form.vehicleType}
                  onChange={(event) => setForm({ ...form, vehicleType: event.target.value })}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {vehicleTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <Input
                label="Make"
                required
                maxLength={80}
                value={form.make}
                onChange={(event) => setForm({ ...form, make: event.target.value })}
                placeholder="e.g. Toyota"
              />
              <Input
                label="Model"
                required
                maxLength={100}
                value={form.model}
                onChange={(event) => setForm({ ...form, model: event.target.value })}
                placeholder="e.g. Corolla"
              />
              <Input
                label="Year"
                type="number"
                min="1886"
                max={new Date().getFullYear() + 1}
                value={form.year}
                onChange={(event) => setForm({ ...form, year: event.target.value })}
                placeholder="e.g. 2022"
              />
              <label className="space-y-1.5 text-xs font-semibold text-slate-700">
                Fuel type
                <select
                  value={form.fuelType}
                  onChange={(event) => setForm({ ...form, fuelType: event.target.value })}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                >
                  {fuelTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <Input
                label="Color"
                maxLength={40}
                value={form.color}
                onChange={(event) => setForm({ ...form, color: event.target.value })}
                placeholder="e.g. Silver"
              />
              <Input
                label="Registration number"
                maxLength={24}
                value={form.registrationNumber}
                onChange={(event) => setForm({ ...form, registrationNumber: event.target.value })}
                placeholder="Optional"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                <X size={14} />
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                <Check size={14} />
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Save vehicle'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
