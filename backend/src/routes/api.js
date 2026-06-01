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
  try {
    const { person_id, role, ta_id, ta_role } = req.body;
    const db = require('../db/pool');
    
    await db.query('BEGIN');
    await db.query('DELETE FROM session_assignments WHERE session_id = $1', [req.params.id]);
    
    const results = [];
    if (person_id) {
      const { rows } = await db.query(
        `INSERT INTO session_assignments (session_id, person_id, role)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.params.id, person_id, role || 'lead_teacher']
      );
      results.push(rows[0]);
    }
    if (ta_id) {
      const { rows } = await db.query(
        `INSERT INTO session_assignments (session_id, person_id, role)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [req.params.id, ta_id, ta_role || 'ta_support']
      );
      results.push(rows[0]);
    }
    
    await db.query('COMMIT');
    res.json({ success: true, assignments: results });
  } catch (err) {
    const db = require('../db/pool');
    try { await db.query('ROLLBACK'); } catch (_) {}
    next(err);
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
