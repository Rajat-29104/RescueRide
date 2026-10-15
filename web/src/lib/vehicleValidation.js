export const VEHICLE_TYPES = ['car', 'motorcycle', 'van', 'truck', 'bus', 'other']
export const FUEL_TYPES = ['petrol', 'diesel', 'hybrid', 'electric', 'lpg', 'other']

export function validateVehicleInput(input = {}) {
  const source = input && typeof input === 'object' ? input : {}
  const make = typeof source.make === 'string' ? source.make.trim() : ''
  const model = typeof source.model === 'string' ? source.model.trim() : ''
  const vehicleType = source.vehicleType || 'car'
  const fuelType = source.fuelType || 'other'
  const year = source.year === '' || source.year === null || source.year === undefined
    ? null
    : Number(source.year)
  const color = typeof source.color === 'string' ? source.color.trim() : ''
  const registrationNumber = typeof source.registrationNumber === 'string'
    ? source.registrationNumber.trim().toUpperCase()
    : ''
  const errors = []

  if (!make || make.length > 80) errors.push('Make is required and must be 80 characters or fewer.')
  if (!model || model.length > 100) errors.push('Model is required and must be 100 characters or fewer.')
  if (!VEHICLE_TYPES.includes(vehicleType)) errors.push('Choose a valid vehicle type.')
  if (!FUEL_TYPES.includes(fuelType)) errors.push('Choose a valid fuel type.')
  if (year !== null && (!Number.isInteger(year) || year < 1886 || year > new Date().getFullYear() + 1)) {
    errors.push('Year must be a valid four-digit year.')
  }
  if (color.length > 40) errors.push('Color must be 40 characters or fewer.')
  if (registrationNumber.length > 24) errors.push('Registration number must be 24 characters or fewer.')

  if (errors.length) return { valid: false, errors }

  return {
    valid: true,
    value: {
      vehicle_type: vehicleType,
      make,
      model,
      year,
      fuel_type: fuelType,
      color: color || null,
      registration_number: registrationNumber || null,
    },
  }
}

export function isUuid(value) {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
