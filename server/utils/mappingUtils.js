const Mapping = require('../models/Mapping');

/**
 * Gets all mappings for a VK source (both individual and group mappings)
 * @param {string} sourceId - VK source ID
 * @returns {Promise<Array>} - Array of mappings
 */
const getAllMappingsForSource = async (sourceId) => {
  try {
    // Get individual mappings for this source
    const individualMappings = await Mapping.find({
      vkSource: sourceId,
      active: true
    }).populate('vkSource').populate('telegramChannel');

    // Get group mappings - find all groups that contain this source
    const VkSourceGroup = require('../models/VkSourceGroup');
    const groupsContainingSource = await VkSourceGroup.find({
      sources: sourceId,
      active: true
    });

    // Get mappings for all groups that contain this source
    let groupMappings = [];
    if (groupsContainingSource.length > 0) {
      const groupIds = groupsContainingSource.map(group => group._id);
      groupMappings = await Mapping.find({
        vkSourceGroup: { $in: groupIds },
        active: true
      }).populate('vkSourceGroup').populate('telegramChannel');
    }

    // Combine and deduplicate by telegram channel ID
    const allMappings = [...individualMappings, ...groupMappings];
    const uniqueMappings = [];
    const seenChannelIds = new Set();

    for (const mapping of allMappings) {
      if (mapping.telegramChannel && !seenChannelIds.has(mapping.telegramChannel._id.toString())) {
        seenChannelIds.add(mapping.telegramChannel._id.toString());
        uniqueMappings.push(mapping);
      }
    }

    return uniqueMappings;
  } catch (error) {
    console.error(`Error getting mappings for source ${sourceId}:`, error);
    return [];
  }
};

module.exports = {
  getAllMappingsForSource
}; 