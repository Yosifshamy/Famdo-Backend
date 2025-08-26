const express = require('express');
const router = express.Router();
const Family = require('../models/Family');
const FamilyTodo = require('../models/FamilyTodo');
const User = require('../models/User');
const auth = require('../middleware/auth');
const generateReferralCode = require('../utils/referral');

router.use(auth);

// Create a family
router.post('/create', async (req, res) => {
  const { name } = req.body;
  const referralCode = generateReferralCode();
  const family = await Family.create({ name, referralCode, members: [req.userId] });
  await User.findByIdAndUpdate(req.userId, { family: family._id });
  const populatedFamily = await Family.findById(family._id).populate('members', 'username email');
  res.json(populatedFamily);
});

// Join a family
router.post('/join', async (req, res) => {
  const { referralCode } = req.body;
  const family = await Family.findOne({ referralCode });
  if (!family) return res.status(404).json({ error: 'Family not found' });
  if (!family.members.includes(req.userId)) {
    family.members.push(req.userId);
    await family.save();
  }
  // Populate members before returning
  await User.findByIdAndUpdate(req.userId, { family: family._id });
  const populatedFamily = await Family.findById(family._id).populate('members', 'username email');
  res.json(populatedFamily);
});

router.get('/my', async (req, res) => {
  try {
    const user = await User.findById(req.userId).populate({
      path: 'family',
      populate: { path: 'members', select: 'username email' }
    });
    if (!user || !user.family) return res.status(404).json({ error: 'No family found' });
    res.json(user.family);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get family todos
router.get('/:familyId/todos', async (req, res) => {
  try {
    const { familyId } = req.params;

    // Verify the user is a member of this family
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }

    if (!family.members.includes(req.userId)) {
      return res.status(403).json({ error: 'Not authorized to view this family\'s todos' });
    }

    // Fetch todos with user information populated
    const todos = await FamilyTodo.find({ family: familyId })
      .populate('user', 'username email')
      .sort({ createdAt: -1 });

    res.json(todos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST create family todo
router.post('/:familyId/todos', async (req, res) => {
  const { familyId } = req.params;
  const { text, describtion, deadline } = req.body;
  try {
    const family = await Family.findById(familyId);
    if (!family) {
      return res.status(404).json({ error: 'Family not found' });
    }
    // Ensure the user is a member of the family
    if (!family.members.includes(req.userId)) {
      return res.status(403).json({ error: 'Not authorized to add todos to this family' });
    }
    const todo = await FamilyTodo.create({
      text,
      describtion,
      deadline,
      family: familyId,
      user: req.userId, // Associate with the user who created it, even if it's a family todo
    });

    // Populate the user information before sending response
    const populatedTodo = await FamilyTodo.findById(todo._id).populate('user', 'username email');

    res.status(201).json(populatedTodo);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Bad request' });
  }
});
// Toggle family todo completion
router.put('/:familyId/todos/:todoId', auth, async (req, res) => {
  try {
    const { familyId, todoId } = req.params;
    const { done } = req.body;

    // Verify user belongs to this family
    const family = await Family.findById(familyId);
    if (!family || !family.members.includes(req.userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Update the todo
    const todo = await FamilyTodo.findOneAndUpdate(
      { _id: todoId, family: familyId },
      { done },
      { new: true }
    ).populate('user', 'username email');

    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    res.json(todo);
  } catch (error) {
    console.error('Error updating family todo:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete family todo
router.delete('/:familyId/todos/:todoId', auth, async (req, res) => {
  try {
    const { familyId, todoId } = req.params;

    // Verify user belongs to this family
    const family = await Family.findById(familyId);
    if (!family || !family.members.includes(req.userId)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Find the todo to check ownership or family membership
    const todo = await FamilyTodo.findOne({ _id: todoId, family: familyId });
    if (!todo) {
      return res.status(404).json({ error: 'Todo not found' });
    }

    // Allow deletion if user created the todo or is family member
    // (since we already verified family membership above, any family member can delete)
    await FamilyTodo.findByIdAndDelete(todoId);

    res.json({ message: 'Todo deleted successfully' });
  } catch (error) {
    console.error('Error deleting family todo:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;