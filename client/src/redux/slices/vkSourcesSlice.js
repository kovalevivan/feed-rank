import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { handleApiError } from '../../utils/errorHandling';

// Initial state
const initialState = {
  vkSources: [],
  vkSource: null,
  loading: false,
  error: null,
  success: false,
  thresholdStats: null,
  calculatingThreshold: false,
  thresholdStatsLoading: false
};

// Get all VK sources
export const fetchVkSources = createAsyncThunk(
  'vkSources/fetchAll',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.get('/api/vk-sources', config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Get VK source by ID
export const fetchVkSourceById = createAsyncThunk(
  'vkSources/fetchById',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.get(`/api/vk-sources/${id}`, config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Create VK source
export const createVkSource = createAsyncThunk(
  'vkSources/create',
  async (sourceData, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.post('/api/vk-sources', sourceData, config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Update VK source
export const updateVkSource = createAsyncThunk(
  'vkSources/update',
  async ({ id, sourceData }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.put(`/api/vk-sources/${id}`, sourceData, config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Delete VK source
export const deleteVkSource = createAsyncThunk(
  'vkSources/delete',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      await axios.delete(`/api/vk-sources/${id}`, config);
      
      return id;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Calculate threshold for a source
export const calculateThreshold = createAsyncThunk(
  'vkSources/calculateThreshold',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.post(`/api/vk-sources/${id}/calculate-threshold`, {}, config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Calculate threshold with advanced parameters
export const calculateThresholdAdvanced = createAsyncThunk(
  'vkSources/calculateThresholdAdvanced',
  async ({ id, params }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      // Parse and validate multiplier as a number if present
      if (params.multiplier !== undefined) {
        const multiplier = parseFloat(params.multiplier);
        if (!isNaN(multiplier)) {
          params.multiplier = multiplier;
          console.log(`Validated multiplier for calculation: ${multiplier} (${typeof multiplier})`);
        } else {
          console.warn(`Invalid multiplier value: ${params.multiplier}, using default`);
          delete params.multiplier; // Let server use default
        }
      }
      
      console.log('Sending calculateThresholdAdvanced request with params:', params);
      
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.post(`/api/vk-sources/${id}/calculate-threshold`, params, config);
      
      console.log('Received calculateThresholdAdvanced response:', response.data);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Get threshold statistics
export const getThresholdStats = createAsyncThunk(
  'vkSources/getThresholdStats',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.get(`/api/vk-sources/${id}/threshold-stats`, config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Process posts for a source now
export const processSourceNow = createAsyncThunk(
  'vkSources/processNow',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.post(`/api/vk-sources/${id}/process-now`, {}, config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// VK sources slice
const vkSourcesSlice = createSlice({
  name: 'vkSources',
  initialState,
  reducers: {
    clearVkSourcesError: (state) => {
      state.error = null;
    },
    clearVkSourceSuccess: (state) => {
      state.success = false;
    },
    clearCurrentVkSource: (state) => {
      state.vkSource = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch all VK sources cases
    builder.addCase(fetchVkSources.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchVkSources.fulfilled, (state, action) => {
      state.loading = false;
      state.vkSources = action.payload;
    });
    builder.addCase(fetchVkSources.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    
    // Fetch VK source by ID cases
    builder.addCase(fetchVkSourceById.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchVkSourceById.fulfilled, (state, action) => {
      state.loading = false;
      
      // Store the source as-is without modifying the multiplier
      const source = action.payload;
      console.log('Received source:', source);
      console.log(`Source statisticalMultiplier value: ${source.statisticalMultiplier}`);
      
      // Only set default if server explicitly sends null (not if undefined or 0)
      if (source.statisticalMultiplier === null) {
        console.log('Source had null statisticalMultiplier, setting default placeholder');
        source.statisticalMultiplier = undefined; // Let component handle defaults
      }
      
      state.vkSource = source;
    });
    builder.addCase(fetchVkSourceById.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    
    // Create VK source cases
    builder.addCase(createVkSource.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.success = false;
    });
    builder.addCase(createVkSource.fulfilled, (state, action) => {
      state.loading = false;
      state.vkSources.push(action.payload);
      state.vkSource = action.payload;
      state.success = true;
    });
    builder.addCase(createVkSource.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.success = false;
    });
    
    // Update VK source cases
    builder.addCase(updateVkSource.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.success = false;
    });
    builder.addCase(updateVkSource.fulfilled, (state, action) => {
      state.loading = false;
      state.vkSources = state.vkSources.map((source) =>
        source._id === action.payload._id ? action.payload : source
      );
      state.vkSource = action.payload;
      state.success = true;
    });
    builder.addCase(updateVkSource.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
      state.success = false;
    });
    
    // Delete VK source cases
    builder.addCase(deleteVkSource.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(deleteVkSource.fulfilled, (state, action) => {
      state.loading = false;
      state.vkSources = state.vkSources.filter((source) => source._id !== action.payload);
      state.success = true;
    });
    builder.addCase(deleteVkSource.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    
    // Calculate threshold cases
    builder.addCase(calculateThreshold.pending, (state) => {
      state.loading = true;
      state.calculatingThreshold = true;
      state.error = null;
    });
    builder.addCase(calculateThreshold.fulfilled, (state, action) => {
      state.loading = false;
      state.calculatingThreshold = false;
      state.vkSource = action.payload;
      
      // Update source in sources array
      const index = state.vkSources.findIndex((source) => source._id === action.payload._id);
      if (index !== -1) {
        state.vkSources[index] = action.payload;
      }
      
      state.success = true;
    });
    builder.addCase(calculateThreshold.rejected, (state, action) => {
      state.loading = false;
      state.calculatingThreshold = false;
      state.error = action.payload;
    });
    
    // Calculate threshold advanced cases
    builder.addCase(calculateThresholdAdvanced.pending, (state) => {
      state.calculatingThreshold = true;
      state.error = null;
    });
    builder.addCase(calculateThresholdAdvanced.fulfilled, (state, action) => {
      state.calculatingThreshold = false;
      state.thresholdStats = action.payload;
      
      console.log('Processing calculateThresholdAdvanced response:', action.payload);
      
      // If we have a current source, update its relevant fields based on the calculation results
      if (state.vkSource && state.vkSource._id === action.payload.sourceId) {
        state.vkSource.calculatedThreshold = action.payload.calculatedThreshold;
        state.vkSource.thresholdMethod = action.payload.thresholdMethod;
        
        // Always update statistical multiplier if it's provided in the response
        if (action.payload.multiplier !== undefined) {
          console.log(`Updating vkSource.statisticalMultiplier to ${action.payload.multiplier}`);
          state.vkSource.statisticalMultiplier = action.payload.multiplier;
        } else if (action.payload.statisticalMultiplier !== undefined) {
          console.log(`Updating vkSource.statisticalMultiplier to ${action.payload.statisticalMultiplier} (from statisticalMultiplier field)`);
          state.vkSource.statisticalMultiplier = action.payload.statisticalMultiplier;
        }
        
        // Update lastPostsData
        if (!state.vkSource.lastPostsData) {
          state.vkSource.lastPostsData = {};
        }
        
        state.vkSource.lastPostsData.averageViews = action.payload.detailedStats?.mean || 0;
        state.vkSource.lastPostsData.postsAnalyzed = action.payload.postsAnalyzed || 0;
        state.vkSource.lastPostsData.lastAnalysisDate = new Date().toISOString();
        state.vkSource.lastPostsData.thresholdMethod = action.payload.thresholdMethod;
        state.vkSource.lastPostsData.multiplierUsed = 
          action.payload.thresholdMethod === 'statistical' ? action.payload.multiplier : null;
        state.vkSource.lastPostsData.detailedStats = action.payload.detailedStats;
      }
      
      // Also update the source in the sources array if it exists
      const sourceIndex = state.vkSources.findIndex(source => source._id === action.payload.sourceId);
      if (sourceIndex !== -1) {
        state.vkSources[sourceIndex].calculatedThreshold = action.payload.calculatedThreshold;
        state.vkSources[sourceIndex].thresholdMethod = action.payload.thresholdMethod;
        
        // Always update statistical multiplier if it's provided in the response
        if (action.payload.multiplier !== undefined) {
          console.log(`Updating vkSources[${sourceIndex}].statisticalMultiplier to ${action.payload.multiplier}`);
          state.vkSources[sourceIndex].statisticalMultiplier = action.payload.multiplier;
        } else if (action.payload.statisticalMultiplier !== undefined) {
          console.log(`Updating vkSources[${sourceIndex}].statisticalMultiplier to ${action.payload.statisticalMultiplier} (from statisticalMultiplier field)`);
          state.vkSources[sourceIndex].statisticalMultiplier = action.payload.statisticalMultiplier;
        }
        
        // Update lastPostsData 
        if (!state.vkSources[sourceIndex].lastPostsData) {
          state.vkSources[sourceIndex].lastPostsData = {};
        }
        
        state.vkSources[sourceIndex].lastPostsData.averageViews = action.payload.detailedStats?.mean || 0;
        state.vkSources[sourceIndex].lastPostsData.postsAnalyzed = action.payload.postsAnalyzed || 0;
        state.vkSources[sourceIndex].lastPostsData.lastAnalysisDate = new Date().toISOString();
        state.vkSources[sourceIndex].lastPostsData.thresholdMethod = action.payload.thresholdMethod;
        state.vkSources[sourceIndex].lastPostsData.multiplierUsed = 
          action.payload.thresholdMethod === 'statistical' ? action.payload.multiplier : null;
        state.vkSources[sourceIndex].lastPostsData.detailedStats = action.payload.detailedStats;
      }
    });
    builder.addCase(calculateThresholdAdvanced.rejected, (state, action) => {
      state.calculatingThreshold = false;
      state.error = action.payload;
    });
    
    // Get threshold stats cases
    builder.addCase(getThresholdStats.pending, (state) => {
      state.thresholdStatsLoading = true;
      state.error = null;
    });
    builder.addCase(getThresholdStats.fulfilled, (state, action) => {
      state.thresholdStatsLoading = false;
      state.thresholdStats = action.payload;
      
      // Update multiplier in source when present in response
      // Ensure we handle all numerical values including zero
      if (state.vkSource && state.vkSource._id === action.payload.sourceId) {
        // First check if the response has a valid multiplier
        const hasMultiplier = action.payload.multiplier !== undefined && 
                              action.payload.multiplier !== null;
                          
        const hasStatisticalMultiplier = action.payload.statisticalMultiplier !== undefined && 
                                         action.payload.statisticalMultiplier !== null;
        
        if (hasMultiplier) {
          console.log(`Updating vkSource statisticalMultiplier to ${action.payload.multiplier} (from multiplier field)`);
          state.vkSource.statisticalMultiplier = action.payload.multiplier;
        } else if (hasStatisticalMultiplier) {
          console.log(`Updating vkSource statisticalMultiplier to ${action.payload.statisticalMultiplier} (from statisticalMultiplier field)`);
          state.vkSource.statisticalMultiplier = action.payload.statisticalMultiplier;
        }
      }
    });
    builder.addCase(getThresholdStats.rejected, (state, action) => {
      state.thresholdStatsLoading = false;
      state.error = action.payload;
    });
    
    // Process source now cases
    builder.addCase(processSourceNow.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(processSourceNow.fulfilled, (state) => {
      state.loading = false;
      state.success = true;
    });
    builder.addCase(processSourceNow.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
  }
});

export const {
  clearVkSourcesError,
  clearVkSourceSuccess,
  clearCurrentVkSource
} = vkSourcesSlice.actions;

export default vkSourcesSlice.reducer; 