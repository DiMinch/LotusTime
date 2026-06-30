-- Migration 003: Add is_first_login and link existing teachers to accounts
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_first_login BOOLEAN NOT NULL DEFAULT TRUE;

-- Pre-seeded admin is marked as already logged in so they are not forced to change password
UPDATE users SET is_first_login = FALSE WHERE username = 'admin';

-- Auto-provision accounts for existing active persons who don't have one
-- Default password: lotustime123 (hashed)
INSERT INTO users (username, email, password_hash, role, person_id, is_first_login)
SELECT 
    LOWER(p.short_name) AS username,
    COALESCE(NULLIF(p.email, ''), LOWER(p.short_name) || '@lotustime.local') AS email,
    '$2b$10$k25Jd4csi9VscUvWymVGxuI60Kowhy4nGMgHHrZJQgPfviXiT97Hy' AS password_hash,
    'staff' AS role,
    p.id AS person_id,
    TRUE AS is_first_login
FROM persons p
LEFT JOIN users u ON u.person_id = p.id
WHERE u.id IS NULL AND p.is_active = true
ON CONFLICT (username) DO NOTHING;
