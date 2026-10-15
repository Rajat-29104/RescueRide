import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { isUuid, validateVehicleInput } from '../src/lib/vehicleValidation.js'

describe('vehicle input validation', () => {
  it('normalizes a valid vehicle before persistence', () => {
    const result = validateVehicleInput({
      make: ' Toyota ',
      model: ' Corolla ',
      vehicleType: 'car',
      year: '2020',
      fuelType: 'petrol',
      color: ' Silver ',
      registrationNumber: ' gr-1234-24 ',
    })

    assert.equal(result.valid, true)
    assert.deepEqual(result.value, {
      vehicle_type: 'car',
      make: 'Toyota',
      model: 'Corolla',
      year: 2020,
      fuel_type: 'petrol',
      color: 'Silver',
      registration_number: 'GR-1234-24',
    })
  })

  it('rejects missing fields, invalid types, and invalid years', () => {
    const result = validateVehicleInput({
      make: '',
      model: 'Corolla',
      vehicleType: 'spaceship',
      year: 1800,
      fuelType: 'steam',
    })

    assert.equal(result.valid, false)
    assert.equal(result.errors.length, 4)
  })

  it('accepts an omitted optional year and normalizes empty optional fields', () => {
    const result = validateVehicleInput({ make: 'Toyota', model: 'Corolla' })

    assert.equal(result.valid, true)
    assert.equal(result.value.year, null)
    assert.equal(result.value.color, null)
    assert.equal(result.value.registration_number, null)
  })
})

describe('vehicle identifier validation', () => {
  it('accepts UUIDs and rejects malformed identifiers', () => {
    assert.equal(isUuid('5a46bb94-ae95-4a98-884f-05d6cf4ed53b'), true)
    assert.equal(isUuid('not-a-uuid'), false)
  })
})
