-- Module 4 schema for RescueRide
-- Compatible with the existing Next.js + Supabase PostgreSQL architecture.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE job_location_status AS ENUM ('sharing', 'paused', 'permission_denied', 'connection_lost', 'completed');
CREATE TYPE chat_message_status AS ENUM ('sent', 'delivered', 'read', 'failed');
CREATE TYPE notification_status AS ENUM ('unread', 'read');
CREATE TYPE sos_status AS ENUM ('RAISED', 'ACKNOWLEDGED', 'RESOLVED');
CREATE TYPE incident_status AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

CREATE TABLE IF NOT EXISTS public.job_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES public.rescue_requests(id) ON DELETE CASCADE,
    mechanic_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude DOUBLE PRECISION NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    accuracy_m DOUBLE PRECISION DEFAULT 0,
    status job_location_status NOT NULL DEFAULT 'sharing',
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
    message_status chat_message_status NOT NULL DEFAULT 'sent',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_messages_job_id_created_at
    ON public.job_messages (job_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_messages_sender_id
    ON public.job_messages (sender_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    related_request_id UUID REFERENCES public.rescue_requests(id) ON DELETE SET NULL,
    related_job_id UUID REFERENCES public.rescue_requests(id) ON DELETE SET NULL,
    related_entity_type TEXT NOT NULL DEFAULT 'request',
    notification_type TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    status notification_status NOT NULL DEFAULT 'unread',
    dedupe_key TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    read_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_notifications_dedupe
    ON public.notifications (recipient_id, related_entity_type, notification_type, dedupe_key)
    WHERE dedupe_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_status
    ON public.notifications (recipient_id, status, created_at DESC);

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
    status sos_status NOT NULL DEFAULT 'RAISED',
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
    previous_status sos_status,
    new_status sos_status NOT NULL,
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
    status incident_status NOT NULL DEFAULT 'OPEN',
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

-- Recommended RLS notes:
-- - Only authenticated users can insert/select depending on resource ownership.
-- - Drivers can manage only their own emergency contacts and SOS events.
-- - Assigned mechanic and driver can access job messages for a specific request/job.
-- - Administrators can read admin queues for SOS and incidents.
-- - All sensitive geolocation data should be hidden from unrelated participants.
