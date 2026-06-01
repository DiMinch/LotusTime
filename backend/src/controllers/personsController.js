const Person = require('../models/persons');

exports.list = async (req, res, next) => {
  try {
    const persons = await Person.findAll();
    res.json(persons);
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const person = await Person.findById(req.params.id);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (err) { next(err); }
};

exports.create = async (req, res, next) => {
  try {
    const person = await Person.create(req.body);
    if (req.body.capabilities) {
      await Person.setCapabilities(person.id, req.body.capabilities);
    }
    res.status(201).json(await Person.findById(person.id));
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const person = await Person.update(req.params.id, req.body);
    if (!person) return res.status(404).json({ error: 'Person not found' });
    res.json(person);
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    await Person.remove(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.setCapabilities = async (req, res, next) => {
  try {
    await Person.setCapabilities(req.params.id, req.body.capabilities);
    res.json(await Person.findById(req.params.id));
  } catch (err) { next(err); }
};

exports.setPermissions = async (req, res, next) => {
  try {
    await Person.setPermissions(req.params.id, req.body.permissions);
    res.json(await Person.findById(req.params.id));
  } catch (err) { next(err); }
};
