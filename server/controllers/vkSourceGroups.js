const VkSourceGroup = require('../models/VkSourceGroup');
const mongoose = require('mongoose');
const { validationResult, check } = require('express-validator');
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');

// @route   GET api/vk-source-groups
// @desc    Get all VK source groups
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const vkSourceGroups = await VkSourceGroup.find()
      .populate('sources', 'name url active')
      .sort({ name: 1 });
    
    res.json(vkSourceGroups);
  } catch (err) {
    console.error('Error fetching VK source groups:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   GET api/vk-source-groups/:id
// @desc    Get a VK source group by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const vkSourceGroup = await VkSourceGroup.findById(req.params.id)
      .populate('sources', 'name url active _id');
    
    if (!vkSourceGroup) {
      return res.status(404).json({ message: 'VK source group not found' });
    }
    
    // Log the populated group for debugging
    console.log('Fetched VK source group with populated sources:', 
      { 
        id: vkSourceGroup._id, 
        name: vkSourceGroup.name, 
        sourcesCount: vkSourceGroup.sources.length,
        sources: vkSourceGroup.sources.map(s => ({ id: s._id, name: s.name }))
      });
    
    res.json(vkSourceGroup);
  } catch (err) {
    console.error('Error fetching VK source group:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST api/vk-source-groups
// @desc    Create a new VK source group
// @access  Private
router.post(
  '/',
  [
    auth,
    [
      check('name', 'Name is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { name, description, sources, active } = req.body;
      
      // Create a new VK source group
      const vkSourceGroup = new VkSourceGroup({
        name,
        description,
        sources: sources || [],
        active: active !== undefined ? active : true,
        createdBy: req.user.id
      });
      
      await vkSourceGroup.save();
      
      res.status(201).json(vkSourceGroup);
    } catch (err) {
      console.error('Error creating VK source group:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// @route   PUT api/vk-source-groups/:id
// @desc    Update a VK source group
// @access  Private
router.put(
  '/:id',
  [
    auth,
    [
      check('name', 'Name is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    try {
      const { name, description, sources, active } = req.body;
      
      // Find the VK source group
      let vkSourceGroup = await VkSourceGroup.findById(req.params.id);
      
      if (!vkSourceGroup) {
        return res.status(404).json({ message: 'VK source group not found' });
      }
      
      // Update fields
      vkSourceGroup.name = name || vkSourceGroup.name;
      vkSourceGroup.description = description !== undefined ? description : vkSourceGroup.description;
      vkSourceGroup.sources = sources || vkSourceGroup.sources;
      vkSourceGroup.active = active !== undefined ? active : vkSourceGroup.active;
      
      await vkSourceGroup.save();
      
      // Return the updated group with populated sources
      const updatedGroup = await VkSourceGroup.findById(req.params.id)
        .populate('sources', 'name url active _id');
      
      res.json(updatedGroup);
    } catch (err) {
      console.error('Error updating VK source group:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// @route   DELETE api/vk-source-groups/:id
// @desc    Delete a VK source group
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const vkSourceGroup = await VkSourceGroup.findById(req.params.id);
    
    if (!vkSourceGroup) {
      return res.status(404).json({ message: 'VK source group not found' });
    }
    
    await VkSourceGroup.findByIdAndRemove(req.params.id);
    
    res.json({ message: 'VK source group removed' });
  } catch (err) {
    console.error('Error deleting VK source group:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// @route   POST api/vk-source-groups/:id/add-source
// @desc    Add a source to a VK source group
// @access  Private
router.post(
  '/:id/add-source',
  [
    auth,
    [
      check('sourceId', 'Source ID is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    try {
      const { sourceId } = req.body;
      const groupId = req.params.id;
      
      console.log(`Adding source to group - Group ID: ${groupId}, Source ID: ${sourceId}`);
      
      if (!mongoose.Types.ObjectId.isValid(sourceId)) {
        console.error('Invalid source ID format:', sourceId);
        return res.status(400).json({ message: 'Invalid source ID' });
      }
      
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        console.error('Invalid group ID format:', groupId);
        return res.status(400).json({ message: 'Invalid group ID' });
      }
      
      const vkSourceGroup = await VkSourceGroup.findById(groupId);
      
      if (!vkSourceGroup) {
        console.error('VK source group not found:', groupId);
        return res.status(404).json({ message: 'VK source group not found' });
      }
      
      // Check if the source exists
      const sourceExists = await mongoose.model('VkSource').findById(sourceId);
      if (!sourceExists) {
        console.error('VK source not found:', sourceId);
        return res.status(404).json({ message: 'VK source not found' });
      }
      
      // Check if the source is already in the group - compare as strings
      const isSourceInGroup = vkSourceGroup.sources.some(source => 
        source.toString() === sourceId
      );
      
      if (isSourceInGroup) {
        console.warn('Source already in group:', { groupId, sourceId });
        return res.status(400).json({ message: 'Source already in this group' });
      }
      
      // Add the source to the group
      vkSourceGroup.sources.push(sourceId);
      
      await vkSourceGroup.save();
      
      console.log('Source successfully added to group');
      
      // Return the updated group with populated sources
      const updatedGroup = await VkSourceGroup.findById(groupId)
        .populate('sources', 'name url active _id');
      
      res.json(updatedGroup);
    } catch (err) {
      console.error('Error adding source to group:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

// @route   POST api/vk-source-groups/:id/remove-source
// @desc    Remove a source from a VK source group
// @access  Private
router.post(
  '/:id/remove-source',
  [
    auth,
    [
      check('sourceId', 'Source ID is required').not().isEmpty()
    ]
  ],
  async (req, res) => {
    try {
      const { sourceId } = req.body;
      const groupId = req.params.id;
      
      console.log(`Removing source from group - Group ID: ${groupId}, Source ID: ${sourceId}`);
      
      if (!mongoose.Types.ObjectId.isValid(sourceId)) {
        console.error('Invalid source ID format:', sourceId);
        return res.status(400).json({ message: 'Invalid source ID' });
      }
      
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        console.error('Invalid group ID format:', groupId);
        return res.status(400).json({ message: 'Invalid group ID' });
      }
      
      const vkSourceGroup = await VkSourceGroup.findById(groupId);
      
      if (!vkSourceGroup) {
        console.error('VK source group not found:', groupId);
        return res.status(404).json({ message: 'VK source group not found' });
      }
      
      // Check if the source is in the group - compare as strings
      const isSourceInGroup = vkSourceGroup.sources.some(source => 
        source.toString() === sourceId
      );
      
      if (!isSourceInGroup) {
        console.warn('Source not in group:', { groupId, sourceId });
        return res.status(400).json({ message: 'Source not in this group' });
      }
      
      // Remove the source from the group
      vkSourceGroup.sources = vkSourceGroup.sources.filter(
        source => source.toString() !== sourceId
      );
      
      await vkSourceGroup.save();
      
      console.log('Source successfully removed from group');
      
      // Return the updated group with populated sources
      const updatedGroup = await VkSourceGroup.findById(groupId)
        .populate('sources', 'name url active _id');
      
      res.json(updatedGroup);
    } catch (err) {
      console.error('Error removing source from group:', err);
      res.status(500).json({ message: 'Server error', error: err.message });
    }
  }
);

module.exports = router; 