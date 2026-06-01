const TimeSlot = require('../models/timeSlots');

exports.list = async (req, res, next) => {
  try { res.json(await TimeSlot.findAll()); } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const slot = await TimeSlot.findById(req.params.id);
    if (!slot) return res.status(404).json({ error: 'Time slot not found' });
    res.json(slot);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await TimeSlot.create(req.body)); } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const slot = await TimeSlot.update(req.params.id, req.body);
    if (!slot) return res.status(404).json({ error: 'Time slot not found' });
    res.json(slot);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try { await TimeSlot.remove(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
};
