import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { validateVehiclePayload, archiveVehicle } from '../src/lib/vehicle.js'

describe('Vehicle CRUD validation and archive helpers', () => {
  it('accepts a valid vehicle payload and normalizes fields', () => {
    const result = validateVehiclePayload({
      make: '  toyota  ',
      model: ' corolla ',
      plate: ' gr 1234 20 ',
      year: '2020',
      color: ' silver ',
      vin: ' 1hgbh41x9pb123456 ',
      registrationExpiry: '2026-06-30',
      notes: '  regular service history ',
    })

    assert.equal(result.valid, true)
    assert.equal(result.normalized.make, 'toyota')
    assert.equal(result.normalized.model, 'corolla')
    assert.equal(result.normalized.plate, 'GR123420')
    assert.equal(result.normalized.year, 2020)
    assert.equal(result.normalized.color, 'silver')
    assert.equal(result.normalized.vin, '1HGBH41X9PB123456')
    assert.equal(result.normalized.registration_expiry, '2026-06-30')
    assert.equal(result.normalized.notes, 'regular service history')
  })

  it('rejects invalid vehicle payloads and out-of-range years', () => {
    const result = validateVehiclePayload({
      make: '',
      model: '',
      plate: '',
      year: '1800',
      color: '',
      vin: 'bad',
    })

    assert.equal(result.valid, false)
    assert.match(result.errors.join(' '), /make/i)
    assert.match(result.errors.join(' '), /model/i)
    assert.match(result.errors.join(' '), /plate/i)
    assert.match(result.errors.join(' '), /year/i)
    assert.match(result.errors.join(' '), /color/i)
  })

  it('marks a vehicle as archived without losing the record data', () => {
    const archived = archiveVehicle({
      id: 'veh-123',
      make: 'Honda',
      plate: 'AB-999',
      is_archived: false,
    })

    assert.equal(archived.is_archived, true)
    assert.equal(archived.make, 'Honda')
    assert.ok(archived.updated_at)
  })
})
