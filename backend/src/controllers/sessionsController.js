const Session = require('../models/sessions');

exports.listByWeek = async (req, res, next) => {
  try {
    res.json(await Session.findByWeek(req.params.id));
  } catch (err) { next(err); }
};

exports.pinSession = async (req, res, next) => {
  try {
    const { class_id, room_id, time_slot_id, pin_reason } = req.body;
    const session = await Session.create({
      week_id: req.params.id,
      class_id, room_id, time_slot_id,
      is_pinned: true,
      pin_reason: pin_reason || 'Manual Pin'
    });
    res.status(201).json(session);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Session.remove(req.params.sid);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
