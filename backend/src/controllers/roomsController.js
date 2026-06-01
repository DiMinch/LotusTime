const Room = require('../models/rooms');

exports.list = async (req, res, next) => {
  try { res.json(await Room.findAll()); } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await Room.create(req.body)); } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const room = await Room.update(req.params.id, req.body);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try { await Room.remove(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
};
