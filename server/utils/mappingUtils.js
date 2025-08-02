const Mapping = require('../models/Mapping');

/**
 * Gets all mappings for a Telegram source
 * @param {string} sourceId - Telegram source ID
 * @returns {Promise<Array>} - Array of mappings
 */
const getAllMappingsForTelegramSource = async (sourceId) => {
  try {
    // Get individual mappings for this source
    const individualMappings = await Mapping.find({
      telegramSource: sourceId,
      active: true
    }).populate('telegramSource').populate('telegramChannel');

    // Get group mappings - find all groups that contain this source
    const SourceGroup = require('../models/SourceGroup');
    const groupsContainingSource = await SourceGroup.find({
      telegramSources: sourceId
    });

    // Get mappings for all groups that contain this source
    let groupMappings = [];
    if (groupsContainingSource.length > 0) {
      const groupIds = groupsContainingSource.map(group => group._id);
      groupMappings = await Mapping.find({
        sourceGroup: { $in: groupIds },
        active: true
      }).populate('sourceGroup').populate('telegramChannel');
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
    console.error(`Error getting mappings for Telegram source ${sourceId}:`, error);
    return [];
  }
};

/**
 * Gets all mappings for a VK source (both individual and group mappings)
 * @param {string} sourceId - VK source ID
 * @param {string} sourceType - Source type ('vk' or 'telegram')
 * @returns {Promise<Array>} - Array of mappings
 */
const getAllMappingsForSource = async (sourceId, sourceType = 'vk') => {
  if (sourceType === 'telegram') {
    return getAllMappingsForTelegramSource(sourceId);
  }
  try {
    // Get individual mappings for this source
    const individualMappings = await Mapping.find({
      vkSource: sourceId,
      active: true
    }).populate('vkSource').populate('telegramChannel');

    // Get group mappings - find all groups that contain this source
    const SourceGroup = require('../models/SourceGroup');
    const groupsContainingSource = await SourceGroup.find({
      vkSources: sourceId
    });

    // Get mappings for all groups that contain this source
    let groupMappings = [];
    if (groupsContainingSource.length > 0) {
      const groupIds = groupsContainingSource.map(group => group._id);
      groupMappings = await Mapping.find({
        sourceGroup: { $in: groupIds },
        active: true
      }).populate('sourceGroup').populate('telegramChannel');
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
  getAllMappingsForSource,
  getAllMappingsForTelegramSource
}; 