-- Migration 001: Initialize database schema for LotusTime

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Persons (Teachers & TAs)
CREATE TABLE persons (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name     TEXT NOT NULL,
  short_name    TEXT NOT NULL UNIQUE,     -- VD: "Jasmine", "Mark"
  email         TEXT,
  phone         TEXT,
  is_active     BOOLEAN DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Person capabilities (e.g., lead_teacher, ta_support)
CREATE TABLE person_capabilities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id    UUID REFERENCES persons(id) ON DELETE CASCADE,
  capability   TEXT NOT NULL, -- 'lead_teacher', 'ta_support', 'ta_solo', 'ta_ielts'
  UNIQUE (person_id, capability)
);

-- 3. Rooms
CREATE TABLE rooms (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,   -- "Room 1", "Room 2"
  capacity     INT,
  is_active    BOOLEAN DEFAULT true
);

-- 4. Time Slots (User defined)
CREATE TABLE time_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,           -- "08:00 - 09:30"
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  day_of_week INT NOT NULL,            -- 2=Thứ 2 ... 8=Chủ nhật
  is_active   BOOLEAN DEFAULT true,
  CONSTRAINT unique_time_slot UNIQUE (day_of_week, start_time, end_time)
);

-- 5. Classes
CREATE TABLE classes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code              TEXT NOT NULL UNIQUE,  -- "L01", "Camb.Movers"
  class_type        TEXT NOT NULL,         -- 'regular', 'kids', 'cambridge', 'ielts'
  level             TEXT,                  -- "Gr.9", "Starters"
  sessions_per_week INT NOT NULL DEFAULT 2,
  duration_minutes  INT NOT NULL,          -- Duration in minutes
  requires_ta       BOOLEAN DEFAULT false,
  is_active         BOOLEAN DEFAULT true,
  notes             TEXT
);

-- 6. Person-Class Permissions
CREATE TABLE person_class_permissions (
  person_id     UUID REFERENCES persons(id) ON DELETE CASCADE,
  class_id      UUID REFERENCES classes(id) ON DELETE CASCADE,
  allowed_roles TEXT[] NOT NULL,           -- ARRAY of roles (e.g., ['lead_teacher'])
  PRIMARY KEY (person_id, class_id)
);

-- 7. Family Groups
CREATE TABLE family_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT,                        -- "Gia đình Nguyễn"
  preference  TEXT                         -- "same_session", "morning_only"
);

-- 8. Students
CREATE TABLE students (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name  TEXT NOT NULL,
  class_id   UUID REFERENCES classes(id) ON DELETE SET NULL,
  family_id  UUID REFERENCES family_groups(id) ON DELETE SET NULL,
  notes      TEXT
);

-- 9. Schedule Weeks
CREATE TABLE schedule_weeks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   DATE NOT NULL UNIQUE,       -- Monday's date
  status       TEXT DEFAULT 'draft',       -- 'draft', 'solving', 'review', 'published'
  created_at   TIMESTAMPTZ DEFAULT now(),
  published_at TIMESTAMPTZ
);

-- 10. Availabilities (linked to time_slots for precision)
CREATE TABLE availabilities (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     UUID REFERENCES persons(id) ON DELETE CASCADE,
  week_id       UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  time_slot_id  UUID REFERENCES time_slots(id) ON DELETE CASCADE,
  CONSTRAINT unique_person_availability UNIQUE (person_id, week_id, time_slot_id)
);

-- 11. Sessions
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id         UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  class_id        UUID REFERENCES classes(id) ON DELETE CASCADE,
  room_id         UUID REFERENCES rooms(id) ON DELETE SET NULL,
  time_slot_id    UUID REFERENCES time_slots(id) ON DELETE SET NULL,
  is_pinned       BOOLEAN DEFAULT false,
  pin_reason      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- 12. Session Assignments
CREATE TABLE session_assignments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID REFERENCES sessions(id) ON DELETE CASCADE,
  person_id   UUID REFERENCES persons(id) ON DELETE CASCADE,
  role        TEXT NOT NULL,               -- 'lead_teacher', 'ta_support', 'ta_solo', 'ta_ielts'
  is_confirmed BOOLEAN DEFAULT false,
  CONSTRAINT unique_session_person UNIQUE (session_id, person_id)
);

-- 13. Special Constraints
CREATE TABLE special_constraints (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id           UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE, -- NULL = global
  raw_text          TEXT NOT NULL,
  parsed_json       JSONB,
  constraint_type   TEXT,                  -- 'same_session', 'morning_only', etc.
  priority          INT DEFAULT 5,         -- 1 to 10
  is_active         BOOLEAN DEFAULT true,
  confirmed_by_user BOOLEAN DEFAULT false,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 14. Solver Runs
CREATE TABLE solver_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id          UUID REFERENCES schedule_weeks(id) ON DELETE CASCADE,
  started_at       TIMESTAMPTZ DEFAULT now(),
  finished_at      TIMESTAMPTZ,
  status           TEXT,                   -- 'running', 'optimal', 'feasible', 'infeasible', 'error'
  pinned_count     INT,
  solved_count     INT,
  objective_score  FLOAT,
  conflict_details JSONB
);

-- Create basic indexes for performance
CREATE INDEX idx_availabilities_week ON availabilities(week_id);
CREATE INDEX idx_sessions_week ON sessions(week_id);
CREATE INDEX idx_session_assignments_session ON session_assignments(session_id);
CREATE INDEX idx_students_family ON students(family_id);
