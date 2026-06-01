-- Seed Time Slots for LotusTime
-- Based on "Schedule updated 2025.xlsx"
-- Mỗi slot = 45 phút, áp dụng cho: Thứ 2-7 (2-7) + Chủ nhật (8)

-- Xóa dữ liệu cũ (nếu có)
DELETE FROM time_slots;

-- ======================================
-- Buổi sáng (AM): 7:00 → 11:30
-- ======================================

-- Slot 1: 7:00 - 7:45
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S1 Sáng', '07:00', '07:45', 2),
  ('S1 Sáng', '07:00', '07:45', 3),
  ('S1 Sáng', '07:00', '07:45', 4),
  ('S1 Sáng', '07:00', '07:45', 5),
  ('S1 Sáng', '07:00', '07:45', 6),
  ('S1 Sáng', '07:00', '07:45', 7),
  ('S1 Sáng', '07:00', '07:45', 8);

-- Slot 2: 7:45 - 8:30
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S2 Sáng', '07:45', '08:30', 2),
  ('S2 Sáng', '07:45', '08:30', 3),
  ('S2 Sáng', '07:45', '08:30', 4),
  ('S2 Sáng', '07:45', '08:30', 5),
  ('S2 Sáng', '07:45', '08:30', 6),
  ('S2 Sáng', '07:45', '08:30', 7),
  ('S2 Sáng', '07:45', '08:30', 8);

-- Slot 3: 8:30 - 9:15
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S3 Sáng', '08:30', '09:15', 2),
  ('S3 Sáng', '08:30', '09:15', 3),
  ('S3 Sáng', '08:30', '09:15', 4),
  ('S3 Sáng', '08:30', '09:15', 5),
  ('S3 Sáng', '08:30', '09:15', 6),
  ('S3 Sáng', '08:30', '09:15', 7),
  ('S3 Sáng', '08:30', '09:15', 8);

-- Slot 4: 9:15 - 10:00
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S4 Sáng', '09:15', '10:00', 2),
  ('S4 Sáng', '09:15', '10:00', 3),
  ('S4 Sáng', '09:15', '10:00', 4),
  ('S4 Sáng', '09:15', '10:00', 5),
  ('S4 Sáng', '09:15', '10:00', 6),
  ('S4 Sáng', '09:15', '10:00', 7),
  ('S4 Sáng', '09:15', '10:00', 8);

-- Slot 5: 10:00 - 10:45
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S5 Sáng', '10:00', '10:45', 2),
  ('S5 Sáng', '10:00', '10:45', 3),
  ('S5 Sáng', '10:00', '10:45', 4),
  ('S5 Sáng', '10:00', '10:45', 5),
  ('S5 Sáng', '10:00', '10:45', 6),
  ('S5 Sáng', '10:00', '10:45', 7),
  ('S5 Sáng', '10:00', '10:45', 8);

-- Slot 6: 10:45 - 11:30
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S6 Sáng', '10:45', '11:30', 2),
  ('S6 Sáng', '10:45', '11:30', 3),
  ('S6 Sáng', '10:45', '11:30', 4),
  ('S6 Sáng', '10:45', '11:30', 5),
  ('S6 Sáng', '10:45', '11:30', 6),
  ('S6 Sáng', '10:45', '11:30', 7),
  ('S6 Sáng', '10:45', '11:30', 8);

-- ======================================
-- Buổi chiều (PM): 13:30 → 18:00
-- ======================================

-- Slot 7: 13:30 - 14:15
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S1 Chiều', '13:30', '14:15', 2),
  ('S1 Chiều', '13:30', '14:15', 3),
  ('S1 Chiều', '13:30', '14:15', 4),
  ('S1 Chiều', '13:30', '14:15', 5),
  ('S1 Chiều', '13:30', '14:15', 6),
  ('S1 Chiều', '13:30', '14:15', 7),
  ('S1 Chiều', '13:30', '14:15', 8);

-- Slot 8: 14:15 - 15:00
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S2 Chiều', '14:15', '15:00', 2),
  ('S2 Chiều', '14:15', '15:00', 3),
  ('S2 Chiều', '14:15', '15:00', 4),
  ('S2 Chiều', '14:15', '15:00', 5),
  ('S2 Chiều', '14:15', '15:00', 6),
  ('S2 Chiều', '14:15', '15:00', 7),
  ('S2 Chiều', '14:15', '15:00', 8);

-- Slot 9: 15:00 - 15:45
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S3 Chiều', '15:00', '15:45', 2),
  ('S3 Chiều', '15:00', '15:45', 3),
  ('S3 Chiều', '15:00', '15:45', 4),
  ('S3 Chiều', '15:00', '15:45', 5),
  ('S3 Chiều', '15:00', '15:45', 6),
  ('S3 Chiều', '15:00', '15:45', 7),
  ('S3 Chiều', '15:00', '15:45', 8);

-- Slot 10: 15:45 - 16:30
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S4 Chiều', '15:45', '16:30', 2),
  ('S4 Chiều', '15:45', '16:30', 3),
  ('S4 Chiều', '15:45', '16:30', 4),
  ('S4 Chiều', '15:45', '16:30', 5),
  ('S4 Chiều', '15:45', '16:30', 6),
  ('S4 Chiều', '15:45', '16:30', 7),
  ('S4 Chiều', '15:45', '16:30', 8);

-- Slot 11: 16:30 - 17:15
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S5 Chiều', '16:30', '17:15', 2),
  ('S5 Chiều', '16:30', '17:15', 3),
  ('S5 Chiều', '16:30', '17:15', 4),
  ('S5 Chiều', '16:30', '17:15', 5),
  ('S5 Chiều', '16:30', '17:15', 6),
  ('S5 Chiều', '16:30', '17:15', 7),
  ('S5 Chiều', '16:30', '17:15', 8);

-- Slot 12: 17:15 - 18:00
INSERT INTO time_slots (label, start_time, end_time, day_of_week) VALUES
  ('S6 Chiều', '17:15', '18:00', 2),
  ('S6 Chiều', '17:15', '18:00', 3),
  ('S6 Chiều', '17:15', '18:00', 4),
  ('S6 Chiều', '17:15', '18:00', 5),
  ('S6 Chiều', '17:15', '18:00', 6),
  ('S6 Chiều', '17:15', '18:00', 7),
  ('S6 Chiều', '17:15', '18:00', 8);
