const express = require('express');
const router = express.Router();
const Todo = require('../models/Todo');
const auth = require('../middleware/auth');

// all routes below require auth
router.use(auth);

// GET all for current user
router.get('/', async (req, res) => {
  try {
    const todos = await Todo.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create
router.post('/', async (req, res) => {
  const { text, describtion, deadline } = req.body;
  const todo = await Todo.create({
    text,
    describtion,
    deadline,
    user: req.userId, // <-- This must be set!
  });
  res.json(todo);
});

// PUT update or toggle
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const todo = await Todo.findOneAndUpdate({ _id: id, user: req.userId }, updates, { new: true });
    if (!todo) return res.status(404).json({ error: 'Not found' });
    res.json(todo);
  } catch (err) {
    res.status(400).json({ error: 'Bad request' });
  }
});

// DELETE
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const todo = await Todo.findOneAndDelete({ _id: id, user: req.userId });
    if (!todo) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(400).json({ error: 'Bad request' });
  }
});

module.exports = router;