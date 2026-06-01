const Week = require('../models/weeks');

exports.list = async (req, res, next) => {
  try { res.json(await Week.findAll()); } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const week = await Week.findById(req.params.id);
    if (!week) return res.status(404).json({ error: 'Week not found' });
    res.json(week);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await Week.create(req.body)); } catch (err) { next(err); }
};

exports.updateStatus = async (req, res, next) => {
  try {
    const week = await Week.updateStatus(req.params.id, req.body.status);
    if (!week) return res.status(404).json({ error: 'Week not found' });
    res.json(week);
  } catch (err) { next(err); }
};
