-- Migration 007: Notification System

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Null if sent by system
  type VARCHAR(50) NOT NULL, -- 'SCH_PUB', 'SES_UPD', 'SUB_REQ', 'ATT_APP', 'ATT_REJ', 'PWD_RST'
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  target_url VARCHAR(255), -- Action target
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- Create notification_settings table
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{
    "SCH_PUB": { "email": true, "inapp": true },
    "SES_UPD": { "email": true, "inapp": true },
    "SUB_REQ": { "email": true, "inapp": true },
    "ATT_APP": { "email": false, "inapp": true },
    "ATT_REJ": { "email": true, "inapp": true }
  }',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed notification settings for existing users
INSERT INTO notification_settings (user_id)
SELECT id FROM users
ON CONFLICT (user_id) DO NOTHING;
