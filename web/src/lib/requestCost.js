const serviceCostBands = {
  repair: [500, 2500],
  towing: [800, 2500],
  tyre_change: [200, 500],
  battery_jump: [300, 1500],
  fuel_delivery: [500, 1000],
  other: [300, 1500],
}

const vehicleCostMultipliers = {
  car: 1,
  motorcycle: 0.75,
  van: 1.25,
  truck: 1.5,
  bus: 1.5,
  other: 1,
}

export const REQUEST_PRIORITIES = ['normal', 'emergency', 'critical']

export function getRequestCostEstimate(serviceType, vehicleType = 'car') {
  const [minimum, maximum] = serviceCostBands[serviceType] || serviceCostBands.other
  const multiplier = vehicleCostMultipliers[vehicleType] || vehicleCostMultipliers.other
  const roundTo50 = (amount) => Math.round((amount * multiplier) / 50) * 50

  return {
    minimum: roundTo50(minimum),
    maximum: roundTo50(maximum),
    currency: 'INR',
  }
}

export function isValidRequestPriority(value) {
  return REQUEST_PRIORITIES.includes(value)
}

export function formatINR(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function isValidFinalCost(value) {
  if (
    (typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && value.trim() === '')
  ) {
    return false
  }

  const amount = Number(value)
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000
}
