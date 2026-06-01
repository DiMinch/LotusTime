-- Migration 003: Add student_count and segments to classes
-- student_count: Số học sinh trong lớp, dùng để kiểm tra sức chứa phòng
-- segments: Mô hình buổi học nhiều phân đoạn (VD: 1h GV Việt + 1h GV nước ngoài)

ALTER TABLE classes ADD COLUMN IF NOT EXISTS student_count INT;

-- segments là JSONB array, mỗi phần tử:
-- { "label": "GV Việt", "duration_minutes": 60, "required_capability": "lead_teacher" }
-- Nếu null → buổi học đơn giản (1 segment = toàn bộ duration_minutes)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS segments JSONB DEFAULT NULL;
