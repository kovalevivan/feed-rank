import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

/**
 * Helper function to standardize error handling from API responses
 * @param {Error} error - The error caught in the try/catch
 * @returns {Object} Standardized error object for the UI
 */
const handleApiError = (error) => {
  // If we have a server response with an error
  if (error.response && error.response.data) {
    return error.response.data;
  }
  
  // For network errors or other issues
  return {
    message: error.message || 'An unexpected error occurred',
    error: error.toString()
  };
};

// Initial state
const initialState = {
  vkSources: [],
  vkSource: null,
  loading: false,
  error: null,
  success: false
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
      state.vkSource = action.payload;
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
      state.error = null;
    });
    builder.addCase(calculateThreshold.fulfilled, (state, action) => {
      state.loading = false;
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