-- Tablas sin dependencias
CREATE TABLE public."Commissions" (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public."Companies" (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    rif text NOT NULL,
    email text,
    phone text,
    address text,
    is_active boolean NOT NULL DEFAULT true
);

CREATE TABLE public."EventCategories" (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true
);

-- Tablas con dependencias
CREATE TABLE public."Events" (
    id text NOT NULL PRIMARY KEY,
    subject text NOT NULL,
    date date NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone,
    location text,
    external_participants_count integer DEFAULT 0,
    description text,
    cost numeric,
    investment numeric,
    revenue numeric,
    is_cancelled boolean NOT NULL DEFAULT false
);

CREATE TABLE public."Meetings" (
    id text NOT NULL PRIMARY KEY,
    subject text,
    commission_id text NOT NULL REFERENCES public."Commissions"(id),
    date date NOT NULL,
    start_time time without time zone,
    end_time time without time zone,
    location text,
    external_participants_count integer DEFAULT 0,
    description text,
    is_cancelled boolean NOT NULL DEFAULT false
);

CREATE TABLE public."Participants" (
    id text NOT NULL PRIMARY KEY,
    name text NOT NULL,
    company_id text REFERENCES public."Companies"(id),
    role text,
    email text UNIQUE,
    phone text,
    affiliation_type text CHECK (affiliation_type = ANY (ARRAY['company'::text, 'external'::text, 'independent'::text])),
    external_company_name text,
    is_active boolean NOT NULL DEFAULT true
);

-- Tablas de unión (Join Tables)
CREATE TABLE public.event_attendees (
    event_id text NOT NULL REFERENCES public."Events"(id),
    participant_id text NOT NULL REFERENCES public."Participants"(id),
    attendance_type text NOT NULL,
    PRIMARY KEY (event_id, participant_id)
);

CREATE TABLE public.event_organizing_categories (
    event_id text NOT NULL REFERENCES public."Events"(id),
    category_id text NOT NULL REFERENCES public."EventCategories"(id),
    PRIMARY KEY (event_id, category_id)
);

CREATE TABLE public.event_organizing_commissions (
    event_id text NOT NULL REFERENCES public."Events"(id),
    commission_id text NOT NULL REFERENCES public."Commissions"(id),
    PRIMARY KEY (event_id, commission_id)
);

CREATE TABLE public.meeting_attendees (
    meeting_id text NOT NULL REFERENCES public."Meetings"(id),
    participant_id text NOT NULL REFERENCES public."Participants"(id),
    attendance_type text NOT NULL,
    PRIMARY KEY (meeting_id, participant_id)
);

CREATE TABLE public.participant_commissions (
    participant_id text NOT NULL REFERENCES public."Participants"(id),
    commission_id text NOT NULL REFERENCES public."Commissions"(id),
    PRIMARY KEY (participant_id, commission_id)
);

-- Permisos necesarios para la API
GRANT ALL ON TABLE public."Commissions" TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public."Companies" TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public."EventCategories" TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public."Events" TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public."Meetings" TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public."Participants" TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.event_attendees TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.event_organizing_categories TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.event_organizing_commissions TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.meeting_attendees TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.participant_commissions TO postgres, anon, authenticated, service_role;