ALTER TABLE public.rescue_requests
  ADD COLUMN priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'emergency', 'critical')),
  ADD COLUMN vehicle_type text NOT NULL DEFAULT 'car'
    CHECK (vehicle_type IN ('car', 'motorcycle', 'van', 'truck', 'bus', 'other')),
  ADD COLUMN estimated_cost_min numeric(10, 2)
    CHECK (estimated_cost_min IS NULL OR estimated_cost_min >= 0),
  ADD COLUMN estimated_cost_max numeric(10, 2)
    CHECK (estimated_cost_max IS NULL OR estimated_cost_max >= 0),
  ADD COLUMN cost_currency text NOT NULL DEFAULT 'INR'
    CHECK (cost_currency = 'INR'),
  ADD COLUMN final_cost numeric(10, 2)
    CHECK (final_cost IS NULL OR final_cost >= 0),
  ADD COLUMN payment_method text
    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'upi')),
  ADD COLUMN payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed')),
  ADD CONSTRAINT rescue_requests_estimate_range_check
    CHECK (
      estimated_cost_min IS NULL
      OR estimated_cost_max IS NULL
      OR estimated_cost_max >= estimated_cost_min
    );

CREATE INDEX IF NOT EXISTS idx_rescue_requests_priority_created
  ON public.rescue_requests (priority, created_at DESC)
  WHERE status = 'pending';