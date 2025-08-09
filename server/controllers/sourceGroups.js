const SourceGroup = require('../models/SourceGroup');
const VkSourceGroup = require('../models/VkSourceGroup');
const VkSource = require('../models/VkSource');
const TelegramSource = require('../models/TelegramSource');
const mongoose = require('mongoose');
const { validationResult, check } = require('express-validator');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { getGlobalStopWords } = require('../utils/stopWordsUtils');

// @route   GET api/source-groups
// @desc    Get all source groups
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    // Fetch new-style unified groups
    const unifiedGroupsPromise = SourceGroup.find()
      .populate('vkSources', 'name url active groupId')
      .populate('telegramSources', 'name username active chatId');

    // Fetch legacy VK groups and map to unified shape
    const legacyVkGroupsPromise = VkSourceGroup.find()
      .populate('sources', 'name url active groupId');

    const [unifiedGroups, legacyVkGroups] = await Promise.all([
      unifiedGroupsPromise,
      legacyVkGroupsPromise
    ]);

    const legacyMapped = legacyVkGroups.map((g) => {
      const obj = g.toObject({ virtuals: false });
      return {
        _id: obj._id,
        name: obj.name,
        description: obj.description,
        stopWords: obj.stopWords || [],
        active: obj.active,
        createdBy: obj.createdBy,
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt,
        vkSources: obj.sources || [],
        telegramSources: [],
        legacyType: 'vk'
      };
    });

    const combined = [...unifiedGroups, ...legacyMapped]
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    res.json(combined);
  } catch (err) {
    console.error('Error fetching source groups:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET api/source-groups/global-stop-words
// @desc    Get global stop words for display in group forms
// @access  Private
router.get('/global-stop-words', auth, async (req, res) => {
  try {
    const globalStopWords = await getGlobalStopWords();
    res.json({ stopWords: globalStopWords });
  } catch (err) {
    console.error('Error fetching global stop words:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET api/source-groups/:id
// @desc    Get a source group by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    // Try unified group first
    let sourceGroup = await SourceGroup.findById(req.params.id)
      .populate('vkSources', 'name url active _id groupId')
      .populate('telegramSources', 'name username active _id chatId');

    if (sourceGroup) {
      console.log('Fetched source group with populated sources:', {
        id: sourceGroup._id,
        name: sourceGroup.name,
        vkSourcesCount: sourceGroup.vkSources.length,
        telegramSourcesCount: sourceGroup.telegramSources.length,
        vkSources: sourceGroup.vkSources.map((s) => ({ id: s._id, name: s.name, groupId: s.groupId })),
        telegramSources: sourceGroup.telegramSources.map((s) => ({ id: s._id, name: s.name, username: s.username }))
      });
      return res.json(sourceGroup);
    }

    // Fallback to legacy VK group, mapped to unified shape
    const legacy = await VkSourceGroup.findById(req.params.id)
      .populate('sources', 'name url active _id groupId');

    if (!legacy) {
      return res.status(404).json({ message: 'Source group not found' });
    }

    const legacyMapped = {
      _id: legacy._id,
      name: legacy.name,
      description: legacy.description,
      stopWords: legacy.stopWords || [],
      active: legacy.active,
      createdBy: legacy.createdBy,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      vkSources: legacy.sources || [],
      telegramSources: [],
      legacyType: 'vk'
    };

    console.log('Fetched legacy VK source group (mapped):', {
      id: legacyMapped._id,
      name: legacyMapped.name,
      vkSourcesCount: legacyMapped.vkSources.length
    });

    return res.json(legacyMapped);
  } catch (err) {
    console.error('Error fetching source group:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST api/source-groups
// @desc    Create a new source group
// @access  Private
router.post('/', [
  auth,
  check('name', 'Name is required').not().isEmpty(),
  check('name', 'Name must be between 1 and 100 characters').isLength({ min: 1, max: 100 }),
  check('description', 'Description must be less than 500 characters').optional().isLength({ max: 500 }),
  check('vkSources', 'VK Sources must be an array').optional().isArray(),
  check('telegramSources', 'Telegram Sources must be an array').optional().isArray(),
  check('stopWords', 'Stop words must be an array').optional().isArray()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, vkSources = [], telegramSources = [], stopWords = [], active = true } = req.body;

    // Validate VK source IDs
    if (vkSources.length > 0) {
      const validVkSources = await VkSource.find({ _id: { $in: vkSources } });
      if (validVkSources.length !== vkSources.length) {
        return res.status(400).json({ 
          message: 'One or more VK sources not found',
          invalidIds: vkSources.filter(id => !validVkSources.some(s => s._id.toString() === id))
        });
      }
    }

    // Validate Telegram source IDs
    if (telegramSources.length > 0) {
      const validTelegramSources = await TelegramSource.find({ _id: { $in: telegramSources } });
      if (validTelegramSources.length !== telegramSources.length) {
        return res.status(400).json({ 
          message: 'One or more Telegram sources not found',
          invalidIds: telegramSources.filter(id => !validTelegramSources.some(s => s._id.toString() === id))
        });
      }
    }

    const newSourceGroup = new SourceGroup({
      name,
      description,
      vkSources,
      telegramSources,
      stopWords,
      active,
      createdBy: req.user?.id
    });

    const savedSourceGroup = await newSourceGroup.save();
    
    // Populate the saved group before returning
    const populatedGroup = await SourceGroup.findById(savedSourceGroup._id)
      .populate('vkSources', 'name url active groupId')
      .populate('telegramSources', 'name username active chatId');

    res.status(201).json(populatedGroup);
  } catch (err) {
    console.error('Error creating source group:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   PUT api/source-groups/:id
// @desc    Update a source group
// @access  Private
router.put('/:id', [
  auth,
  check('name', 'Name must be between 1 and 100 characters').optional().isLength({ min: 1, max: 100 }),
  check('description', 'Description must be less than 500 characters').optional().isLength({ max: 500 }),
  check('vkSources', 'VK Sources must be an array').optional().isArray(),
  check('telegramSources', 'Telegram Sources must be an array').optional().isArray(),
  check('stopWords', 'Stop words must be an array').optional().isArray(),
  check('active', 'Active must be a boolean').optional().isBoolean()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { name, description, vkSources, telegramSources, stopWords, active } = req.body;

    let sourceGroup = await SourceGroup.findById(req.params.id);

    // If not a unified group, try legacy VK group
    if (!sourceGroup) {
      const legacyGroup = await VkSourceGroup.findById(req.params.id);
      if (!legacyGroup) {
        return res.status(404).json({ message: 'Source group not found' });
      }

      // Validate VK source IDs if provided
      if (vkSources && vkSources.length > 0) {
        const validVkSources = await VkSource.find({ _id: { $in: vkSources } });
        if (validVkSources.length !== vkSources.length) {
          return res.status(400).json({
            message: 'One or more VK sources not found',
            invalidIds: vkSources.filter((id) => !validVkSources.some((s) => s._id.toString() === id))
          });
        }
      }

      // Update legacy VK group fields (telegramSources ignored for legacy)
      if (name !== undefined) legacyGroup.name = name;
      if (description !== undefined) legacyGroup.description = description;
      if (vkSources !== undefined) legacyGroup.sources = vkSources;
      if (stopWords !== undefined) legacyGroup.stopWords = stopWords;
      if (active !== undefined) legacyGroup.active = active;

      const saved = await legacyGroup.save();

      const populatedLegacy = await VkSourceGroup.findById(saved._id)
        .populate('sources', 'name url active groupId');

      // Map to unified shape in response
      const response = {
        _id: populatedLegacy._id,
        name: populatedLegacy.name,
        description: populatedLegacy.description,
        stopWords: populatedLegacy.stopWords || [],
        active: populatedLegacy.active,
        createdBy: populatedLegacy.createdBy,
        createdAt: populatedLegacy.createdAt,
        updatedAt: populatedLegacy.updatedAt,
        vkSources: populatedLegacy.sources || [],
        telegramSources: [],
        legacyType: 'vk'
      };

      return res.json(response);
    }

    // Unified group update path
    if (vkSources && vkSources.length > 0) {
      const validVkSources = await VkSource.find({ _id: { $in: vkSources } });
      if (validVkSources.length !== vkSources.length) {
        return res.status(400).json({
          message: 'One or more VK sources not found',
          invalidIds: vkSources.filter((id) => !validVkSources.some((s) => s._id.toString() === id))
        });
      }
    }

    if (telegramSources && telegramSources.length > 0) {
      const validTelegramSources = await TelegramSource.find({ _id: { $in: telegramSources } });
      if (validTelegramSources.length !== telegramSources.length) {
        return res.status(400).json({
          message: 'One or more Telegram sources not found',
          invalidIds: telegramSources.filter((id) => !validTelegramSources.some((s) => s._id.toString() === id))
        });
      }
    }

    if (name !== undefined) sourceGroup.name = name;
    if (description !== undefined) sourceGroup.description = description;
    if (vkSources !== undefined) sourceGroup.vkSources = vkSources;
    if (telegramSources !== undefined) sourceGroup.telegramSources = telegramSources;
    if (stopWords !== undefined) sourceGroup.stopWords = stopWords;
    if (active !== undefined) sourceGroup.active = active;

    const updatedSourceGroup = await sourceGroup.save();

    const populatedGroup = await SourceGroup.findById(updatedSourceGroup._id)
      .populate('vkSources', 'name url active groupId')
      .populate('telegramSources', 'name username active chatId');

    res.json(populatedGroup);
  } catch (err) {
    console.error('Error updating source group:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   DELETE api/source-groups/:id
// @desc    Delete a source group
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const sourceGroup = await SourceGroup.findById(req.params.id);
    if (sourceGroup) {
      await SourceGroup.findByIdAndDelete(req.params.id);
      return res.json({ message: 'Source group deleted successfully' });
    }

    const legacyGroup = await VkSourceGroup.findById(req.params.id);
    if (!legacyGroup) {
      return res.status(404).json({ message: 'Source group not found' });
    }

    await VkSourceGroup.findByIdAndDelete(req.params.id);
    return res.json({ message: 'Legacy VK source group deleted successfully' });
  } catch (err) {
    console.error('Error deleting source group:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;