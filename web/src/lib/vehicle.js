export function normalizeVehiclePlate(value) {
  if (typeof value !== 'string') return ''
  return value.trim().replace(/\s+/g, '').toUpperCase()
}

export function normalizeVehicleVin(value) {
  if (typeof value !== 'string') return ''
  return value.trim().toUpperCase()
}

export function validateVehiclePayload(body = {}) {
  const errors = []
  const make = typeof body.make === 'string' ? body.make.trim() : ''
  const model = typeof body.model === 'string' ? body.model.trim() : ''
  const plate = normalizeVehiclePlate(body.plate || body.vehiclePlate || '')
  const yearRaw = Number(body.year ?? body.vehicleYear)
  const year = Number.isInteger(yearRaw) ? yearRaw : null
  const color = typeof body.color === 'string' ? body.color.trim() : ''
  const vin = normalizeVehicleVin(body.vin || body.vehicleVin || '')
  const registrationExpiry = body.registrationExpiry || body.registration_expiry || null

  if (!make) errors.push('make is required')
  if (!model) errors.push('model is required')
  if (!plate) errors.push('plate is required')
  if (!year || year < 1900 || year > new Date().getFullYear() + 1) {
    errors.push('year must be a valid 4-digit year')
  }
  if (!color) errors.push('color is required')

  if (typeof body.notes === 'string' && body.notes.trim().length > 500) {
    errors.push('notes must be 500 characters or fewer')
  }

  if (vin && !/^[A-HJ-NPR-Z0-9]{8,17}$/i.test(vin)) {
    errors.push('VIN must be 8 to 17 characters using alphanumeric characters excluding I, O, and Q')
  }

  if (registrationExpiry && Number.isNaN(Date.parse(registrationExpiry))) {
    errors.push('registrationExpiry must be a valid date')
  }

  return errors.length > 0
    ? { valid: false, errors }
    : {
        valid: true,
        normalized: {
          make,
          model,
          plate,
          year,
          color,
          vin: vin || null,
          registration_expiry: registrationExpiry || null,
          notes: typeof body.notes === 'string' ? body.notes.trim() : null,
        },
      }
}

export function archiveVehicle(vehicle) {
  if (!vehicle || typeof vehicle !== 'object') {
    return null
  }

  return {
    ...vehicle,
    is_archived: true,
    updated_at: new Date().toISOString(),
  }
}
