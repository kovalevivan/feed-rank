import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Async thunks
export const fetchSourceGroups = createAsyncThunk(
  'sourceGroups/fetchSourceGroups',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/source-groups');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch source groups');
    }
  }
);

export const createSourceGroup = createAsyncThunk(
  'sourceGroups/createSourceGroup',
  async (sourceGroupData, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/source-groups', sourceGroupData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to create source group');
    }
  }
);

export const updateSourceGroup = createAsyncThunk(
  'sourceGroups/updateSourceGroup',
  async ({ id, sourceGroupData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/source-groups/${id}`, sourceGroupData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to update source group');
    }
  }
);

export const deleteSourceGroup = createAsyncThunk(
  'sourceGroups/deleteSourceGroup',
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/api/source-groups/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to delete source group');
    }
  }
);

export const fetchSourceGroupById = createAsyncThunk(
  'sourceGroups/fetchSourceGroupById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`/api/source-groups/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data?.message || 'Failed to fetch source group');
    }
  }
);

const sourceGroupsSlice = createSlice({
  name: 'sourceGroups',
  initialState: {
    sourceGroups: [],
    currentSourceGroup: null,
    loading: false,
    error: null,
    success: false,
    deleting: {}
  },
  reducers: {
    clearSourceGroupsError: (state) => {
      state.error = null;
    },
    resetSuccess: (state) => {
      state.success = false;
    },
    clearCurrentSourceGroup: (state) => {
      state.currentSourceGroup = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch source groups
      .addCase(fetchSourceGroups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSourceGroups.fulfilled, (state, action) => {
        state.loading = false;
        state.sourceGroups = action.payload;
      })
      .addCase(fetchSourceGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Create source group
      .addCase(createSourceGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createSourceGroup.fulfilled, (state, action) => {
        state.loading = false;
        state.sourceGroups.push(action.payload);
        state.success = true;
      })
      .addCase(createSourceGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update source group
      .addCase(updateSourceGroup.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(updateSourceGroup.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.sourceGroups.findIndex(group => group._id === action.payload._id);
        if (index !== -1) {
          state.sourceGroups[index] = action.payload;
        }
        state.currentSourceGroup = action.payload;
        state.success = true;
      })
      .addCase(updateSourceGroup.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Delete source group
      .addCase(deleteSourceGroup.pending, (state, action) => {
        state.deleting[action.meta.arg] = true;
        state.error = null;
      })
      .addCase(deleteSourceGroup.fulfilled, (state, action) => {
        state.sourceGroups = state.sourceGroups.filter(group => group._id !== action.payload);
        delete state.deleting[action.payload];
      })
      .addCase(deleteSourceGroup.rejected, (state, action) => {
        delete state.deleting[action.meta.arg];
        state.error = action.payload;
      })
      
      // Fetch source group by ID
      .addCase(fetchSourceGroupById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSourceGroupById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentSourceGroup = action.payload;
      })
      .addCase(fetchSourceGroupById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearSourceGroupsError, resetSuccess, clearCurrentSourceGroup } = sourceGroupsSlice.actions;
export default sourceGroupsSlice.reducer;