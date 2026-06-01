const Constraint = require('../models/constraints');
const geminiService = require('../services/gemini');

exports.list = async (req, res, next) => {
  try {
    res.json(await Constraint.findByWeek(req.params.id));
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const { raw_text } = req.body;
    if (!raw_text) return res.status(400).json({ error: 'raw_text is required' });

    // 1. Call Gemini to parse NLP
    const parsed = await geminiService.parseConstraint(raw_text);

    // 2. Save to DB
    const constraint = await Constraint.create({
      week_id: req.params.id,
      raw_text,
      parsed_json: parsed,
      constraint_type: parsed.constraint_type || 'unknown',
      priority: parsed.priority || 5
    });

    res.status(201).json(constraint);
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const constraint = await Constraint.update(req.params.cid, req.body);
    if (!constraint) return res.status(404).json({ error: 'Not found' });
    res.json(constraint);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Constraint.remove(req.params.cid);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};
