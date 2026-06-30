-- Migration 004: Create branches, attendance logs, declared sessions, and attendance claims tables
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    allowed_radius_meters INT DEFAULT 50,
    
    -- Hourly salary rates for TA roles at this branch (in VND)
    rate_ta_ielts INT DEFAULT 50000,
    rate_ta_kids INT DEFAULT 45000,
    rate_ta_independent INT DEFAULT 60000,
    rate_ta_support INT DEFAULT 40000,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    check_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
    check_out_time TIMESTAMP WITH TIME ZONE,
    
    check_in_lat DOUBLE PRECISION,
    check_in_lng DOUBLE PRECISION,
    check_out_lat DOUBLE PRECISION,
    check_out_lng DOUBLE PRECISION,
    
    check_in_gps_valid BOOLEAN DEFAULT TRUE,
    check_out_gps_valid BOOLEAN DEFAULT TRUE,
    ip_address VARCHAR(45),
    
    status VARCHAR(20) DEFAULT 'active', -- active, completed, auto_closed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_declared_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attendance_log_id UUID REFERENCES attendance_logs(id) ON DELETE CASCADE,
    class_id UUID, -- For future schedule linkage
    ta_capability VARCHAR(30) NOT NULL, -- 'TA_IELTS', 'TA_KIDS', 'TA_INDEPENDENT', 'TA_SUPPORT'
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_hours NUMERIC(4, 2) NOT NULL,
    snapshot_hourly_rate INT NOT NULL,
    total_pay INT NOT NULL,
    is_approved BOOLEAN DEFAULT FALSE, -- Pending approval by default
    admin_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id) ON DELETE SET NULL,
    claim_date DATE NOT NULL,
    claimed_check_in TIMESTAMP WITH TIME ZONE NOT NULL,
    claimed_check_out TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
    admin_notes TEXT,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_attendance_logs_user_id ON attendance_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_status ON attendance_logs(status);
CREATE INDEX IF NOT EXISTS idx_attendance_declared_sessions_log ON attendance_declared_sessions(attendance_log_id);
CREATE INDEX IF NOT EXISTS idx_attendance_claims_user ON attendance_claims(user_id);

-- Seed initial default branch
INSERT INTO branches (name, latitude, longitude, allowed_radius_meters, rate_ta_ielts, rate_ta_kids, rate_ta_independent, rate_ta_support)
VALUES ('Lotus Time HCMC Center', 10.7769, 106.7009, 100, 50000, 45000, 60000, 40000)
ON CONFLICT DO NOTHING;
