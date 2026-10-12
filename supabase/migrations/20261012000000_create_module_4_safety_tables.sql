-- Module 4 safety and live-assistance tables
-- This migration adds the additional safety and coordination tables described in the
-- module 4 design while preserving the application's existing notification and request schemas.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_location_status') THEN
    CREATE TYPE public.job_location_status AS ENUM ('sharing', 'paused', 'permission_denied', 'connection_lost', 'completed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_message_status') THEN
    CREATE TYPE public.chat_message_status AS ENUM ('sent', 'delivered', 'read', 'failed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE public.notification_status AS ENUM ('unread', 'read');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sos_status') THEN
    CREATE TYPE public.sos_status AS ENUM ('RAISED', 'ACKNOWLEDGED', 'RESOLVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'incident_status') THEN
    CREATE TYPE public.incident_status AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.job_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.rescue_requests(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    accuracy_m DOUBLE PRECISION DEFAULT 0,
    status public.job_location_status NOT NULL DEFAULT 'sharing',
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (job_id, mechanic_id)
);

CREATE INDEX IF NOT EXISTS idx_job_locations_job_id
    ON public.job_locations (job_id, captured_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_locations_mechanic_id
    ON public.job_locations (mechanic_id, captured_at DESC);

CREATE TABLE IF NOT EXISTS public.job_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.rescue_requests(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL CHECK (length(trim(message)) > 0 AND length(message) <= 2000),
    message_status public.chat_message_status NOT NULL DEFAULT 'sent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_messages_job_id_created_at
    ON public.job_messages (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_messages_sender_id
    ON public.job_messages (sender_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    relationship TEXT NOT NULL CHECK (length(trim(relationship)) > 0),
    phone_number TEXT NOT NULL CHECK (length(trim(phone_number)) >= 7),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_driver_id
    ON public.emergency_contacts (driver_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.sos_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    related_request_id UUID REFERENCES public.rescue_requests(id) ON DELETE SET NULL,
    latitude DOUBLE PRECISION CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION CHECK (longitude BETWEEN -180 AND 180),
    status public.sos_status NOT NULL DEFAULT 'RAISED',
    raised_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (driver_id, related_request_id, raised_at)
);

CREATE INDEX IF NOT EXISTS idx_sos_events_driver_id
    ON public.sos_events (driver_id, raised_at DESC);

CREATE INDEX IF NOT EXISTS idx_sos_events_status
    ON public.sos_events (status, raised_at DESC);

CREATE TABLE IF NOT EXISTS public.sos_event_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sos_event_id UUID NOT NULL REFERENCES public.sos_events(id) ON DELETE CASCADE,
    previous_status public.sos_status,
    new_status public.sos_status NOT NULL,
    changed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_sos_event_history_event_id
    ON public.sos_event_history (sos_event_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id UUID REFERENCES public.rescue_requests(id) ON DELETE SET NULL,
    job_id UUID REFERENCES public.rescue_requests(id) ON DELETE SET NULL,
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    subject_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL CHECK (length(trim(description)) > 0),
    status public.incident_status NOT NULL DEFAULT 'OPEN',
    assigned_admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_incident_reports_request_id
    ON public.incident_reports (request_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_reports_job_id
    ON public.incident_reports (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_reports_status
    ON public.incident_reports (status, created_at DESC);

ALTER TABLE public.job_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sos_event_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "job locations visible to participants"
ON public.job_locations FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rescue_requests rr
    WHERE rr.id = public.job_locations.job_id
      AND (rr.driver_id = auth.uid() OR rr.mechanic_id = auth.uid())
  )
);

CREATE POLICY "job locations writable by assigned mechanic"
ON public.job_locations FOR INSERT
TO authenticated
WITH CHECK (
  public.job_locations.mechanic_id = auth.uid()
);

CREATE POLICY "job messages visible to request participants"
ON public.job_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.rescue_requests rr
    WHERE rr.id = public.job_messages.job_id
      AND (rr.driver_id = auth.uid() OR rr.mechanic_id = auth.uid())
  )
);

CREATE POLICY "job messages insertable by request participants"
ON public.job_messages FOR INSERT
TO authenticated
WITH CHECK (
  public.job_messages.sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.rescue_requests rr
    WHERE rr.id = public.job_messages.job_id
      AND (rr.driver_id = auth.uid() OR rr.mechanic_id = auth.uid())
  )
);

CREATE POLICY "driver manages own emergency contacts"
ON public.emergency_contacts FOR ALL
TO authenticated
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "drivers manage own sos events"
ON public.sos_events FOR ALL
TO authenticated
USING (driver_id = auth.uid())
WITH CHECK (driver_id = auth.uid());

CREATE POLICY "admins review sos event history"
ON public.sos_event_history FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

CREATE POLICY "admins review incidents"
ON public.incident_reports FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- The existing application keeps a single `public.notifications` table for request chatter and assignment
-- events. This migration intentionally does not redefine that table in order to preserve the current app
-- architecture and avoid creating a second source of truth for notifications.

-- Recommended access model:
-- - Drivers manage only their own emergency contacts and SOS records.
-- - Assigned mechanic and driver can access request/job messages for a specific rescue request.
-- - Administrators review SOS and incident queues.
-- - Sensitive geolocation data should be limited to authorized participants.
