import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatINR,
  getRequestCostEstimate,
  isValidFinalCost,
  isValidRequestPriority,
} from '../src/lib/requestCost.js'

describe('request cost estimates', () => {
  it('uses the requested INR service bands for a car', () => {
    assert.deepEqual(getRequestCostEstimate('tyre_change', 'car'), {
      minimum: 200,
      maximum: 500,
      currency: 'INR',
    })
    assert.deepEqual(getRequestCostEstimate('towing', 'car'), {
      minimum: 800,
      maximum: 2500,
      currency: 'INR',
    })
  })

  it('adjusts the estimate for vehicle type and safely falls back for unknown services', () => {
    assert.deepEqual(getRequestCostEstimate('battery_jump', 'truck'), {
      minimum: 450,
      maximum: 2250,
      currency: 'INR',
    })
    assert.deepEqual(getRequestCostEstimate('unknown', 'car'), {
      minimum: 300,
      maximum: 1500,
      currency: 'INR',
    })
  })

  it('formats estimates in Indian rupees', () => {
    assert.equal(formatINR(1000), '₹1,000')
  })
})

describe('request priority and final cost validation', () => {
  it('accepts only supported priority levels', () => {
    assert.equal(isValidRequestPriority('critical'), true)
    assert.equal(isValidRequestPriority('admin'), false)
  })

  it('accepts non-negative finite costs within the configured maximum', () => {
    assert.equal(isValidFinalCost(0), true)
    assert.equal(isValidFinalCost(1299.5), true)
    assert.equal(isValidFinalCost('1299.5'), true)
    assert.equal(isValidFinalCost(null), false)
    assert.equal(isValidFinalCost(''), false)
    assert.equal(isValidFinalCost(true), false)
    assert.equal(isValidFinalCost(-1), false)
    assert.equal(isValidFinalCost('Infinity'), false)
    assert.equal(isValidFinalCost(1_000_001), false)
  })
})
