-- Add status column to attendance_declared_sessions
ALTER TABLE attendance_declared_sessions ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending';

-- Migrate existing data based on is_approved
UPDATE attendance_declared_sessions SET status = 'approved' WHERE is_approved = true;
UPDATE attendance_declared_sessions SET status = 'rejected' WHERE is_approved = false AND admin_notes IS NOT NULL;
