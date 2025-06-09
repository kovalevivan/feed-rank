const Setting = require('../models/Setting');
const VkSourceGroup = require('../models/VkSourceGroup');

/**
 * Get combined stop words for a VK source (global + group-level)
 * @param {string} sourceId - VK source ID
 * @returns {Promise<Array>} - Array of combined stop words
 */
const getCombinedStopWords = async (sourceId) => {
  try {
    // Get global stop words from settings
    const stopWordsSetting = await Setting.findOne({ key: 'vk.stop_words' });
    let globalStopWords = [];
    
    if (stopWordsSetting) {
      if (Array.isArray(stopWordsSetting.value)) {
        // If value is already an array, use it directly
        globalStopWords = stopWordsSetting.value
          .filter(word => word && typeof word === 'string' && word.trim().length > 0)
          .map(word => word.toLowerCase());
      } else if (typeof stopWordsSetting.value === 'string') {
        // If value is a string, split by commas, spaces, or newlines
        globalStopWords = stopWordsSetting.value
          .split(/[,\n\s]+/)
          .map(word => word.trim().toLowerCase())
          .filter(word => word.length > 0);
      }
    }
    
    // Get group-level stop words
    let groupStopWords = [];
    
    // Find all groups that contain this source
    const groups = await VkSourceGroup.find({ 
      sources: sourceId,
      active: true 
    });
    
    // Combine stop words from all groups containing this source
    for (const group of groups) {
      if (group.stopWords && Array.isArray(group.stopWords)) {
        const groupWords = group.stopWords
          .filter(word => word && typeof word === 'string' && word.trim().length > 0)
          .map(word => word.toLowerCase());
        groupStopWords.push(...groupWords);
      }
    }
    
    // Combine and deduplicate stop words
    const combinedStopWords = [...new Set([...globalStopWords, ...groupStopWords])];
    
    return combinedStopWords;
  } catch (error) {
    console.error(`Error getting combined stop words for source ${sourceId}:`, error);
    return [];
  }
};

/**
 * Get global stop words from settings
 * @returns {Promise<Array>} - Array of global stop words
 */
const getGlobalStopWords = async () => {
  try {
    const stopWordsSetting = await Setting.findOne({ key: 'vk.stop_words' });
    let globalStopWords = [];
    
    if (stopWordsSetting) {
      if (Array.isArray(stopWordsSetting.value)) {
        globalStopWords = stopWordsSetting.value
          .filter(word => word && typeof word === 'string' && word.trim().length > 0)
          .map(word => word.toLowerCase());
      } else if (typeof stopWordsSetting.value === 'string') {
        globalStopWords = stopWordsSetting.value
          .split(/[,\n\s]+/)
          .map(word => word.trim().toLowerCase())
          .filter(word => word.length > 0);
      }
    }
    
    return globalStopWords;
  } catch (error) {
    console.error('Error getting global stop words:', error);
    return [];
  }
};

module.exports = {
  getCombinedStopWords,
  getGlobalStopWords
}; 