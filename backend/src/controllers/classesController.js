const Class = require('../models/classes');

exports.list = async (req, res, next) => {
  try { res.json(await Class.findAll()); } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const cls = await Class.findById(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    res.json(cls);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try { res.status(201).json(await Class.create(req.body)); } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const cls = await Class.update(req.params.id, req.body);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    res.json(cls);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try { await Class.remove(req.params.id); res.json({ message: 'Deleted' }); } catch (err) { next(err); }
};

exports.setPermissions = async (req, res, next) => {
  try {
    await Class.setPermissions(req.params.id, req.body.permissions);
    res.json(await Class.findById(req.params.id));
  } catch (err) { next(err); }
};
