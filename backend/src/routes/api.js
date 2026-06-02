const express = require('express');
const router = express.Router();

const persons = require('../controllers/personsController');
const rooms = require('../controllers/roomsController');
const classes = require('../controllers/classesController');
const timeSlots = require('../controllers/timeSlotsController');
const weeks = require('../controllers/weeksController');
const availability = require('../controllers/availabilitiesController');
const constraints = require('../controllers/constraintsController');
const sessions = require('../controllers/sessionsController');

// Persons
router.get('/persons', persons.list);
router.get('/persons/:id', persons.get);
router.post('/persons', persons.create);
router.put('/persons/:id', persons.update);
router.delete('/persons/:id', persons.remove);
router.put('/persons/:id/capabilities', persons.setCapabilities);
router.put('/persons/:id/permissions', persons.setPermissions);

// Rooms
router.get('/rooms', rooms.list);
router.get('/rooms/:id', rooms.get);
router.post('/rooms', rooms.create);
router.put('/rooms/:id', rooms.update);
router.delete('/rooms/:id', rooms.remove);

// Classes
router.get('/classes', classes.list);
router.get('/classes/:id', classes.get);
router.post('/classes', classes.create);
router.put('/classes/:id', classes.update);
router.delete('/classes/:id', classes.remove);
router.put('/classes/:id/permissions', classes.setPermissions);

// Time Slots
router.get('/time-slots', timeSlots.list);
router.get('/time-slots/:id', timeSlots.get);
router.post('/time-slots', timeSlots.create);
router.put('/time-slots/:id', timeSlots.update);
router.delete('/time-slots/:id', timeSlots.remove);

// Schedule Weeks
router.get('/weeks', weeks.list);
router.get('/weeks/:id', weeks.get);
router.post('/weeks', weeks.create);
router.patch('/weeks/:id', weeks.updateStatus);

// Availability
router.get('/weeks/:id/availability', availability.getByWeek);
router.post('/weeks/:id/availability', availability.bulkUpsert);
router.post('/weeks/:id/availability/copy', availability.copyFromPrevious);

// Constraints
router.get('/weeks/:id/constraints', constraints.list);
router.post('/weeks/:id/constraints', constraints.create);
router.put('/weeks/:id/constraints/:cid', constraints.update);
router.delete('/weeks/:id/constraints/:cid', constraints.remove);

// Sessions (Pinned)
router.get('/weeks/:id/sessions', sessions.listByWeek);
router.post('/weeks/:id/pin', sessions.pinSession);
router.delete('/weeks/:id/sessions/:sid', sessions.remove);

// Session Move (Drag & Drop)
router.patch('/sessions/:id/move', async (req, res, next) => {
  try {
    const { time_slot_id, room_id } = req.body;
    const db = require('../db/pool');
    
    // 1. Get week_id of the session
    const { rows: sessRows } = await db.query(
      `SELECT week_id FROM sessions WHERE id = $1`, [req.params.id]
    );
    if (sessRows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const week_id = sessRows[0].week_id;

    // 2. Check room conflict
    const { rows: roomConflicts } = await db.query(
      `SELECT id FROM sessions WHERE week_id = $1 AND time_slot_id = $2 AND room_id = $3 AND id != $4`,
      [week_id, time_slot_id, room_id, req.params.id]
    );
    if (roomConflicts.length > 0) return res.status(400).json({ error: 'Phòng học này đã có lớp khác xếp vào giờ này!' });

    // 3. Check teacher double booking
    const { rows: doubleBookings } = await db.query(
      `SELECT p.short_name
       FROM session_assignments sa
       JOIN sessions s ON s.id = sa.session_id
       JOIN persons p ON p.id = sa.person_id
       WHERE s.week_id = $1 AND s.time_slot_id = $2 AND s.id != $3
         AND sa.person_id IN (
           SELECT person_id FROM session_assignments WHERE session_id = $3
         )`,
      [week_id, time_slot_id, req.params.id]
    );
    if (doubleBookings.length > 0) {
      const names = doubleBookings.map(r => r.short_name).join(', ');
      return res.status(400).json({ error: `Giáo viên ${names} đã có lịch dạy vào giờ này!` });
    }

    const { rows } = await db.query(
      `UPDATE sessions SET time_slot_id=$1, room_id=$2 WHERE id=$3 AND is_pinned=false RETURNING *`,
      [time_slot_id, room_id, req.params.id]
    );
    if (rows.length === 0) return res.status(400).json({ error: 'Không thể di chuyển (lớp đã gán cứng hoặc không tồn tại)' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// Update Session Assignment (Teacher assignment)
router.put('/sessions/:id/assignment', async (req, res, next) => {
  let client;
  try {
    const { person_id, role, ta_id, ta_role } = req.body;
    const db = require('../db/pool');

    if (person_id && ta_id && person_id === ta_id) {
       return res.status(400).json({ error: 'Một người không thể vừa làm GV chính vừa làm TA trong cùng 1 tiết!' });
    }
    
    const { rows: sessRows } = await db.query(
      `SELECT week_id, time_slot_id FROM sessions WHERE id = $1`, [req.params.id]
    );
    if (sessRows.length === 0) return res.status(404).json({ error: 'Session not found' });
    const { week_id, time_slot_id } = sessRows[0];

    if (person_id) {
      const { rows: doubleBookings } = await db.query(
        `SELECT s.id FROM session_assignments sa
         JOIN sessions s ON s.id = sa.session_id
         WHERE s.week_id = $1 AND s.time_slot_id = $2 AND s.id != $3 AND sa.person_id = $4`,
        [week_id, time_slot_id, req.params.id, person_id]
      );
      if (doubleBookings.length > 0) return res.status(400).json({ error: 'Giáo viên chính này đã có lịch dạy vào giờ này!' });
    }

    if (ta_id) {
      const { rows: doubleBookings } = await db.query(
        `SELECT s.id FROM session_assignments sa
         JOIN sessions s ON s.id = sa.session_id
         WHERE s.week_id = $1 AND s.time_slot_id = $2 AND s.id != $3 AND sa.person_id = $4`,
        [week_id, time_slot_id, req.params.id, ta_id]
      );
      if (doubleBookings.length > 0) return res.status(400).json({ error: 'Trợ giảng (TA) này đã có lịch dạy vào giờ này!' });
    }

    client = await db.pool.connect();
    await client.query('BEGIN');
    await client.query('DELETE FROM session_assignments WHERE session_id = $1', [req.params.id]);
    
    const results = [];
    if (person_id) {
      const { rows } = await client.query(
        `INSERT INTO session_assignments (session_id, person_id, role)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.params.id, person_id, role || 'lead_teacher']
      );
      results.push(rows[0]);
    }
    if (ta_id) {
      const { rows } = await client.query(
        `INSERT INTO session_assignments (session_id, person_id, role)
         VALUES ($1, $2, $3) RETURNING *`,
        [req.params.id, ta_id, ta_role || 'ta_support']
      );
      results.push(rows[0]);
    }
    
    await client.query('COMMIT');
    res.json({ success: true, assignments: results });
  } catch (err) {
    if (client) try { await client.query('ROLLBACK'); } catch (_) {}
    next(err);
  } finally {
    if (client) client.release();
  }
});

// Solver (Sprint 4)
const solverController = require('../controllers/solverController');
router.post('/weeks/:id/solve', solverController.solveWeek);
router.get('/weeks/:id/solver-status', (req, res) => res.json({ status: 'idle' }));

// Export (Sprint 6)
const exportController = require('../controllers/exportController');
router.get('/weeks/:id/export/excel', exportController.exportExcel);
router.get('/weeks/:id/export/pdf', exportController.exportPdf);
router.post('/weeks/:id/export', exportController.exportCustom);

router.get('/download/:filename', (req, res) => {
  const fs = require('fs');
  const path = require('path');
  const filePath = path.join(__dirname, '../../public/temp', req.params.filename);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(req.params.filename)}"`);
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found');
  }
});

module.exports = router;
