CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('driver', 'mechanic', 'admin')),
  full_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  issue_flag_count integer NOT NULL DEFAULT 0,
  is_flagged boolean NOT NULL DEFAULT false,
  cancellation_count integer NOT NULL DEFAULT 0,
  is_suspended boolean NOT NULL DEFAULT false,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profile_sessions_user_expires
  ON profile_sessions(user_id, expires_at);

CREATE TABLE IF NOT EXISTS blocked_emails (
  email text PRIMARY KEY,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS driver_profiles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  home_area text,
  vehicle_make text NOT NULL DEFAULT '',
  vehicle_model text NOT NULL DEFAULT '',
  vehicle_year integer,
  vehicle_color text NOT NULL DEFAULT '',
  vehicle_plate text NOT NULL DEFAULT '',
  emergency_contact_name text NOT NULL DEFAULT '',
  emergency_contact_phone text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mechanic_profiles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  business_name text NOT NULL DEFAULT '',
  years_experience integer NOT NULL DEFAULT 0,
  specializations jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_status text NOT NULL DEFAULT 'pending'
    CHECK (verification_status IN ('pending', 'approved', 'rejected', 'more_info')),
  is_available boolean NOT NULL DEFAULT false,
  rating_avg numeric(3,2) NOT NULL DEFAULT 5.0,
  rating_count integer NOT NULL DEFAULT 0,
  service_mode text NOT NULL DEFAULT 'mobile'
    CHECK (service_mode IN ('mobile', 'fixed_location', 'hybrid')),
  location_label text,
  current_location geometry(Point, 4326),
  base_location geometry(Point, 4326),
  show_base_location_offline boolean NOT NULL DEFAULT false,
  location_updated_at timestamptz,
  current_status text DEFAULT 'offline',
  hourly_rate numeric(10,2) DEFAULT 0,
  license_expiry date,
  license_number text,
  service_radius integer DEFAULT 50,
  total_jobs integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mechanic_geo
  ON mechanic_profiles USING gist(current_location);
CREATE INDEX IF NOT EXISTS idx_mechanic_base_geo
  ON mechanic_profiles USING gist(base_location);

CREATE TABLE IF NOT EXISTS admin_profiles (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  relationship text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emergency_user ON user_emergency_contacts(user_id);

CREATE TABLE IF NOT EXISTS vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_type text NOT NULL DEFAULT 'car'
    CHECK (vehicle_type IN ('car', 'motorcycle', 'van', 'truck', 'bus', 'other')),
  make text NOT NULL CHECK (length(btrim(make)) > 0),
  model text NOT NULL CHECK (length(btrim(model)) > 0),
  year smallint CHECK (year IS NULL OR year BETWEEN 1886 AND 2100),
  fuel_type text NOT NULL DEFAULT 'other'
    CHECK (fuel_type IN ('petrol', 'diesel', 'hybrid', 'electric', 'lpg', 'other')),
  color text,
  registration_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_user_created
  ON vehicles(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_vehicles_user_registration
  ON vehicles(user_id, upper(registration_number))
  WHERE registration_number IS NOT NULL AND btrim(registration_number) <> '';

CREATE TABLE IF NOT EXISTS rescue_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mechanic_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'offered', 'accepted', 'en_route', 'arrived', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'emergency', 'critical')),
  service_type text NOT NULL DEFAULT 'other',
  problem_description text NOT NULL DEFAULT '',
  incident_address text,
  incident_location geometry(Point, 4326),
  incident_lat numeric(10,8),
  incident_lng numeric(11,8),
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_color text,
  vehicle_plate text,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  vehicle_type text NOT NULL DEFAULT 'car'
    CHECK (vehicle_type IN ('car', 'motorcycle', 'van', 'truck', 'bus', 'other')),
  vehicle_image_url text,
  ai_diagnostic_result jsonb,
  estimated_cost_min numeric(10,2) CHECK (estimated_cost_min IS NULL OR estimated_cost_min >= 0),
  estimated_cost_max numeric(10,2) CHECK (estimated_cost_max IS NULL OR estimated_cost_max >= 0),
  cost_currency text NOT NULL DEFAULT 'INR' CHECK (cost_currency = 'INR'),
  final_cost numeric(10,2) CHECK (final_cost IS NULL OR final_cost >= 0),
  payment_method text CHECK (payment_method IS NULL OR payment_method IN ('cash', 'upi')),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'failed')),
  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  cancellation_reason text,
  completion_notes text,
  performed_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rescue_requests_estimate_range_check
    CHECK (estimated_cost_min IS NULL OR estimated_cost_max IS NULL OR estimated_cost_max >= estimated_cost_min)
);
CREATE INDEX IF NOT EXISTS idx_requests_driver ON rescue_requests(driver_id);
CREATE INDEX IF NOT EXISTS idx_requests_mechanic ON rescue_requests(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON rescue_requests(status);
CREATE INDEX IF NOT EXISTS idx_rescue_requests_vehicle_id
  ON rescue_requests(vehicle_id) WHERE vehicle_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rescue_requests_priority_created
  ON rescue_requests(priority, created_at DESC) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_rescue_requests_active_driver
  ON rescue_requests(driver_id, created_at DESC)
  WHERE status IN ('pending', 'offered', 'accepted', 'en_route', 'arrived', 'in_progress');

CREATE TABLE IF NOT EXISTS mechanic_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES mechanic_profiles(user_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'more_info')),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  notes text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mechanic_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES mechanic_profiles(user_id) ON DELETE CASCADE,
  document_name text,
  file_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mechanic_verification_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  mechanic_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('verified', 'rejected', 'more_info_requested')),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT check_rejection_reason
    CHECK (action <> 'rejected' OR (reason IS NOT NULL AND btrim(reason) <> ''))
);
CREATE INDEX IF NOT EXISTS idx_mech_verif_audit_mechanic_id ON mechanic_verification_audit(mechanic_id);
CREATE INDEX IF NOT EXISTS idx_mech_verif_audit_admin_id ON mechanic_verification_audit(admin_id);
CREATE INDEX IF NOT EXISTS idx_mech_verif_audit_created_at ON mechanic_verification_audit(created_at DESC);

CREATE TABLE IF NOT EXISTS mechanic_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mechanic_id uuid NOT NULL REFERENCES mechanic_profiles(user_id) ON DELETE CASCADE,
  location geometry(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mechanic_locations_geo ON mechanic_locations USING gist(location);

CREATE TABLE IF NOT EXISTS request_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES rescue_requests(id) ON DELETE CASCADE,
  status text NOT NULL,
  changed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES rescue_requests(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_request ON messages(request_id, created_at);

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  request_id uuid REFERENCES rescue_requests(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'system',
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_recipient_required CHECK (profile_id IS NOT NULL OR user_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_profile_created
  ON notifications(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS request_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES rescue_requests(id) ON DELETE CASCADE,
  driver_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  mechanic_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reviews_mechanic ON request_reviews(mechanic_id);

CREATE TABLE IF NOT EXISTS system_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES rescue_requests(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  offender_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  category text NOT NULL
    CHECK (category IN ('pricing_dispute', 'behavioral_issue', 'no_show', 'faulty_repair', 'app_bug', 'other')),
  comments text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES rescue_requests(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  reason_header text NOT NULL,
  comment text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'reviewed', 'resolved', 'dismissed')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS issue_reports_request_id_idx ON issue_reports(request_id);
CREATE INDEX IF NOT EXISTS issue_reports_reporter_id_idx ON issue_reports(reporter_id);
CREATE INDEX IF NOT EXISTS issue_reports_created_at_idx ON issue_reports(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_issue_reports_unique_report
  ON issue_reports(request_id, reporter_id, reason_header);

CREATE TABLE IF NOT EXISTS account_moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('flagged', 'unflagged', 'suspended', 'unsuspended')),
  reason text,
  actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mod_log_user_id ON account_moderation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_mod_log_created_at ON account_moderation_log(created_at DESC);

CREATE TABLE IF NOT EXISTS profile_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  theme text DEFAULT 'system',
  preferred_language text DEFAULT 'en',
  onboarding_state jsonb,
  notification_preferences jsonb NOT NULL DEFAULT '{"push": true, "jobAlerts": true, "messageAlerts": true}'::jsonb,
  communication_preferences text[] NOT NULL DEFAULT ARRAY['call', 'sms']::text[],
  secondary_phone text,
  home_location_label text,
  work_location_label text,
  bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text,
  target_table text,
  field_key text,
  old_value text,
  new_value jsonb,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

CREATE TABLE IF NOT EXISTS ai_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES rescue_requests(id) ON DELETE CASCADE,
  symptoms jsonb NOT NULL DEFAULT '{}'::jsonb,
  probable_causes jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS request_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES rescue_requests(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  matched_at timestamptz,
  accepted_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  candidate_mechanics_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_request_metrics_created_at ON request_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_metrics_status ON request_metrics(status);

CREATE TABLE IF NOT EXISTS fuel_ev_stations (
  id bigserial PRIMARY KEY,
  name varchar(255) NOT NULL,
  type varchar(50) NOT NULL DEFAULT 'fuel' CHECK (type IN ('fuel', 'ev')),
  latitude numeric(10,6) NOT NULL,
  longitude numeric(11,6) NOT NULL,
  location geometry(Point, 4326),
  address text,
  region varchar(100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fuel_ev_stations_location ON fuel_ev_stations USING gist(location);

CREATE OR REPLACE FUNCTION get_nearby_verified_mechanics(
  lat double precision,
  lng double precision,
  radius_km double precision DEFAULT 10
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  business_name text,
  rating_avg numeric,
  distance_km double precision,
  service_mode text,
  location_label text,
  email text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    mp.user_id,
    p.full_name,
    mp.business_name,
    mp.rating_avg,
    ROUND((ST_Distance(
      COALESCE(mp.current_location, mp.base_location)::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography
    ) / 1000)::numeric, 2)::double precision AS distance_km,
    mp.service_mode,
    mp.location_label,
    p.email
  FROM mechanic_profiles mp
  JOIN profiles p ON p.id = mp.user_id
  WHERE mp.verification_status = 'approved'
    AND p.is_active = true
    AND (
      (mp.is_available = true AND mp.current_location IS NOT NULL)
      OR (mp.show_base_location_offline = true AND mp.base_location IS NOT NULL)
    )
    AND ST_DWithin(
      COALESCE(mp.current_location, mp.base_location)::geography,
      ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
      radius_km * 1000
    )
  ORDER BY distance_km ASC;
$$;
