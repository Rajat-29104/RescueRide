CREATE TABLE public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL DEFAULT 'car'
    CHECK (vehicle_type IN ('car', 'motorcycle', 'van', 'truck', 'bus', 'other')),
  make text NOT NULL,
  model text NOT NULL,
  year smallint CHECK (year IS NULL OR year BETWEEN 1886 AND 2100),
  fuel_type text NOT NULL DEFAULT 'other'
    CHECK (fuel_type IN ('petrol', 'diesel', 'hybrid', 'electric', 'lpg', 'other')),
  color text,
  registration_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vehicles_make_not_blank CHECK (length(btrim(make)) > 0),
  CONSTRAINT vehicles_model_not_blank CHECK (length(btrim(model)) > 0)
);

CREATE INDEX idx_vehicles_user_created
  ON public.vehicles (user_id, created_at DESC);

CREATE UNIQUE INDEX uq_vehicles_user_registration
  ON public.vehicles (user_id, upper(registration_number))
  WHERE registration_number IS NOT NULL AND btrim(registration_number) <> '';

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can read own vehicles"
  ON public.vehicles
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'driver'
    )
  );

CREATE POLICY "Drivers can create own vehicles"
  ON public.vehicles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'driver'
    )
  );

CREATE POLICY "Drivers can update own vehicles"
  ON public.vehicles
  FOR UPDATE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'driver'
    )
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'driver'
    )
  );

CREATE POLICY "Drivers can delete own vehicles"
  ON public.vehicles
  FOR DELETE
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.profiles
      WHERE profiles.id = (SELECT auth.uid())
        AND profiles.role = 'driver'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vehicles TO authenticated;

ALTER TABLE public.rescue_requests
  ADD COLUMN vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL;

CREATE INDEX idx_rescue_requests_vehicle_id
  ON public.rescue_requests (vehicle_id)
  WHERE vehicle_id IS NOT NULL;

INSERT INTO public.vehicles (
  user_id,
  make,
  model,
  year,
  color,
  registration_number
)
SELECT
  user_id,
  btrim(vehicle_make),
  btrim(vehicle_model),
  vehicle_year,
  nullif(btrim(vehicle_color), ''),
  nullif(upper(btrim(vehicle_plate)), '')
FROM public.driver_profiles
WHERE nullif(btrim(vehicle_make), '') IS NOT NULL
  AND nullif(btrim(vehicle_model), '') IS NOT NULL
ON CONFLICT DO NOTHING;