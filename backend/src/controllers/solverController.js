const axios = require('axios');
const db = require('../db/pool');
const Class = require('../models/classes');

exports.solveWeek = async (req, res, next) => {
  const weekId = req.params.id;
  try {
    // 1. Update week status to 'solving'
    await db.query(`UPDATE schedule_weeks SET status = 'solving' WHERE id = $1`, [weekId]);

    // 2. Fetch all necessary data
    const classes = await Class.findAll();
    const roomsRes = await db.query(`SELECT id, name, capacity FROM rooms`);
    const timeSlotsRes = await db.query(`SELECT id, day_of_week, start_time, end_time FROM time_slots`);
    const personsRes = await db.query(`
      SELECT p.id, p.short_name, COALESCE(array_agg(pc.capability) FILTER (WHERE pc.capability IS NOT NULL), '{}') as capabilities 
      FROM persons p
      LEFT JOIN person_capabilities pc ON p.id = pc.person_id
      GROUP BY p.id
    `);
    const availRes = await db.query(`SELECT person_id, time_slot_id FROM availabilities WHERE week_id = $1`, [weekId]);
    const pinsRes = await db.query(`SELECT class_id, time_slot_id, room_id FROM sessions WHERE week_id = $1 AND is_pinned = true`, [weekId]);
    const constraintsRes = await db.query(`SELECT parsed_json FROM special_constraints WHERE week_id = $1 AND is_active = true`, [weekId]);

    const payload = {
      classes,
      rooms: roomsRes.rows,
      time_slots: timeSlotsRes.rows,
      persons: personsRes.rows,
      availabilities: availRes.rows,
      pins: pinsRes.rows,
      constraints: constraintsRes.rows.map(c => c.parsed_json)
    };

    // 3. Call Solver Microservice
    const SOLVER_URL = process.env.SOLVER_SERVICE_URL || 'http://localhost:8000';
    const response = await axios.post(`${SOLVER_URL}/solve`, payload);

    if (response.data.status === 'optimal' || response.data.status === 'feasible') {
      // Clear old unpinned sessions
      await db.query(`DELETE FROM sessions WHERE week_id = $1 AND is_pinned = false`, [weekId]);

      // Insert new sessions
      const sessionsToInsert = response.data.sessions;
      for (const s of sessionsToInsert) {
        // If it overlaps with a pin, we skip inserting duplicate.
        // For now, insert all assigned slots from solver.
        console.log(s.role);
        const { rows } = await db.query(
          `INSERT INTO sessions (week_id, class_id, room_id, time_slot_id, is_pinned, pin_reason)
           VALUES ($1, $2, $3, $4, false, 'Solver Assigned') RETURNING id`,
          [weekId, s.class_id, s.room_id, s.time_slot_id]
        );
        
        if (s.teacher_id) {
          await db.query(
            `INSERT INTO session_assignments (session_id, person_id, role) VALUES ($1, $2, $3)`,
            [rows[0].id, s.teacher_id, s.role || 'lead_teacher']
          );
        }
      }

      // Update week status to review
      await db.query(`UPDATE schedule_weeks SET status = 'review' WHERE id = $1`, [weekId]);

      res.json({
        message: 'Xếp lịch thành công!',
        solved_count: response.data.solved_count,
        status: response.data.status
      });
    } else {
      await db.query(`UPDATE schedule_weeks SET status = 'draft' WHERE id = $1`, [weekId]);
      res.status(400).json({ error: 'Không thể tìm ra thời khóa biểu phù hợp.', details: response.data.message });
    }

  } catch (err) {
    await db.query(`UPDATE schedule_weeks SET status = 'draft' WHERE id = $1`, [weekId]);
    console.error("Solver Error:", err.message);
    next(err);
  }
};
