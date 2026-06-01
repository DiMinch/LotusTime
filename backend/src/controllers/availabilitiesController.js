const Availability = require('../models/availabilities');

exports.getByWeek = async (req, res, next) => {
  try { res.json(await Availability.findByWeek(req.params.id)); } catch (err) { next(err); }
};

exports.bulkUpsert = async (req, res, next) => {
  try {
    const result = await Availability.bulkUpsert(req.params.id, req.body.entries);
    res.json({ count: result.length, entries: result });
  } catch (err) { next(err); }
};

exports.copyFromPrevious = async (req, res, next) => {
  try {
    const { previous_week_id } = req.body;
    if (!previous_week_id) return res.status(400).json({ error: 'previous_week_id is required' });
    const result = await Availability.copyFromPreviousWeek(req.params.id, previous_week_id);
    res.json({ copied: result.length });
  } catch (err) { next(err); }
};
