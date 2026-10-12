import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  validateEmergencyContact,
  validateSosPayload,
  validateSosStatusTransition,
  validateIncidentStatusTransition,
  validateLocation,
} from '../src/lib/safety.js'

describe('Module 4 safety validation helpers', () => {
  it('accepts a valid emergency contact', () => {
    const result = validateEmergencyContact({
      name: 'Taylor Morgan',
      relationship: 'Spouse',
      phoneNumber: '+1 (555) 123-4567',
    })

    assert.equal(result.valid, true)
    assert.equal(result.normalized.name, 'Taylor Morgan')
    assert.equal(result.normalized.phoneNumber, '15551234567')
  })

  it('rejects an invalid emergency contact payload', () => {
    const result = validateEmergencyContact({
      name: '',
      relationship: 'Spouse',
      phoneNumber: '123',
    })

    assert.equal(result.valid, false)
    assert.match(result.errors.join(' '), /name/i)
    assert.match(result.errors.join(' '), /phone/i)
  })

  it('normalizes SOS payloads and accepts valid status transitions', () => {
    const result = validateSosPayload({
      requestId: '5d6c3d11-1234-4f60-bb41-22f2d1b4d123',
      status: 'triggered',
      latitude: 47.6062,
      longitude: -122.3321,
      message: 'Vehicle breakdown and need assistance',
    })

    assert.equal(result.valid, true)
    assert.equal(result.normalized.status, 'RAISED')

    const transition = validateSosStatusTransition('RAISED', 'ACKNOWLEDGED')
    assert.equal(transition.valid, true)
    assert.equal(transition.nextRequestStatus, null)
  })

  it('rejects invalid SOS lifecycle transitions', () => {
    const transition = validateSosStatusTransition('RESOLVED', 'ACKNOWLEDGED')
    assert.equal(transition.valid, false)
    assert.match(transition.reason, /Invalid SOS status transition/i)
  })

  it('allows valid incident review transitions and rejects invalid ones', () => {
    assert.equal(validateIncidentStatusTransition('OPEN', 'IN_REVIEW').valid, true)
    assert.equal(validateIncidentStatusTransition('OPEN', 'REJECTED').valid, true)
    assert.equal(validateIncidentStatusTransition('IN_REVIEW', 'RESOLVED').valid, true)
    assert.equal(validateIncidentStatusTransition('RESOLVED', 'CLOSED').valid, false)
    assert.equal(validateIncidentStatusTransition('OPEN', 'OPEN').valid, false)
  })

  it('validates location coordinates for access checks', () => {
    assert.deepEqual(validateLocation({ latitude: 12.34, longitude: 56.78 }), {
      valid: true,
      latitude: 12.34,
      longitude: 56.78,
    })

    assert.equal(validateLocation({ latitude: 200, longitude: 0 }).valid, false)
    assert.equal(validateLocation({ latitude: 10, longitude: 181 }).valid, false)
  })
})
