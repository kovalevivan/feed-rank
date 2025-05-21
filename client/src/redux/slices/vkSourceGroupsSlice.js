import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from '../../api/axios';

// Async thunks
export const fetchVkSourceGroups = createAsyncThunk(
  'vkSourceGroups/fetchAll',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get('/api/vk-source-groups');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const fetchVkSourceGroupById = createAsyncThunk(
  'vkSourceGroups/fetchById',
  async (id, { rejectWithValue }) => {
    try {
      console.log(`🔍 Making API request to fetch group with ID: ${id}`);
      const response = await axios.get(`/api/vk-source-groups/${id}`);
      console.log(`✅ Received response for group ${id}:`, response.data);
      return response.data;
    } catch (error) {
      console.error(`❌ Failed to fetch group ${id}:`, 
        error.response?.data || error.message);
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const createVkSourceGroup = createAsyncThunk(
  'vkSourceGroups/create',
  async (groupData, { rejectWithValue }) => {
    try {
      const response = await axios.post('/api/vk-source-groups', groupData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const updateVkSourceGroup = createAsyncThunk(
  'vkSourceGroups/update',
  async ({ id, groupData }, { rejectWithValue }) => {
    try {
      const response = await axios.put(`/api/vk-source-groups/${id}`, groupData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const deleteVkSourceGroup = createAsyncThunk(
  'vkSourceGroups/delete',
  async (id, { rejectWithValue }) => {
    try {
      await axios.delete(`/api/vk-source-groups/${id}`);
      return id;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const addSourceToGroup = createAsyncThunk(
  'vkSourceGroups/addSource',
  async ({ groupId, sourceId }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/vk-source-groups/${groupId}/add-source`, { sourceId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

export const removeSourceFromGroup = createAsyncThunk(
  'vkSourceGroups/removeSource',
  async ({ groupId, sourceId }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`/api/vk-source-groups/${groupId}/remove-source`, { sourceId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: error.message });
    }
  }
);

// Initial state
const initialState = {
  vkSourceGroups: [],
  currentVkSourceGroup: null,
  loading: false,
  creating: false,
  updating: false,
  deleting: false,
  error: null,
  success: false
};

// Create slice
const vkSourceGroupsSlice = createSlice({
  name: 'vkSourceGroups',
  initialState,
  reducers: {
    clearVkSourceGroupsError: (state) => {
      state.error = null;
    },
    clearCurrentVkSourceGroup: (state) => {
      state.currentVkSourceGroup = null;
    },
    resetSuccess: (state) => {
      state.success = false;
    }
  },
  extraReducers: (builder) => {
    builder
      // fetchVkSourceGroups
      .addCase(fetchVkSourceGroups.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVkSourceGroups.fulfilled, (state, action) => {
        state.loading = false;
        state.vkSourceGroups = action.payload;
      })
      .addCase(fetchVkSourceGroups.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || { message: 'Failed to fetch VK source groups' };
      })
      
      // fetchVkSourceGroupById
      .addCase(fetchVkSourceGroupById.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchVkSourceGroupById.fulfilled, (state, action) => {
        state.loading = false;
        state.currentVkSourceGroup = action.payload;
      })
      .addCase(fetchVkSourceGroupById.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || { message: 'Failed to fetch VK source group' };
      })
      
      // createVkSourceGroup
      .addCase(createVkSourceGroup.pending, (state) => {
        state.creating = true;
        state.error = null;
        state.success = false;
      })
      .addCase(createVkSourceGroup.fulfilled, (state, action) => {
        state.creating = false;
        state.vkSourceGroups.push(action.payload);
        state.success = true;
      })
      .addCase(createVkSourceGroup.rejected, (state, action) => {
        state.creating = false;
        state.error = action.payload || { message: 'Failed to create VK source group' };
        state.success = false;
      })
      
      // updateVkSourceGroup
      .addCase(updateVkSourceGroup.pending, (state) => {
        state.updating = true;
        state.error = null;
        state.success = false;
      })
      .addCase(updateVkSourceGroup.fulfilled, (state, action) => {
        state.updating = false;
        state.vkSourceGroups = state.vkSourceGroups.map(group => 
          group._id === action.payload._id ? action.payload : group
        );
        state.currentVkSourceGroup = action.payload;
        state.success = true;
      })
      .addCase(updateVkSourceGroup.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload || { message: 'Failed to update VK source group' };
        state.success = false;
      })
      
      // deleteVkSourceGroup
      .addCase(deleteVkSourceGroup.pending, (state) => {
        state.deleting = true;
        state.error = null;
      })
      .addCase(deleteVkSourceGroup.fulfilled, (state, action) => {
        state.deleting = false;
        state.vkSourceGroups = state.vkSourceGroups.filter(group => group._id !== action.payload);
        state.success = true;
      })
      .addCase(deleteVkSourceGroup.rejected, (state, action) => {
        state.deleting = false;
        state.error = action.payload || { message: 'Failed to delete VK source group' };
      })
      
      // addSourceToGroup
      .addCase(addSourceToGroup.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(addSourceToGroup.fulfilled, (state, action) => {
        state.updating = false;
        state.vkSourceGroups = state.vkSourceGroups.map(group => 
          group._id === action.payload._id ? action.payload : group
        );
        state.currentVkSourceGroup = action.payload;
      })
      .addCase(addSourceToGroup.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload || { message: 'Failed to add source to group' };
      })
      
      // removeSourceFromGroup
      .addCase(removeSourceFromGroup.pending, (state) => {
        state.updating = true;
        state.error = null;
      })
      .addCase(removeSourceFromGroup.fulfilled, (state, action) => {
        state.updating = false;
        state.vkSourceGroups = state.vkSourceGroups.map(group => 
          group._id === action.payload._id ? action.payload : group
        );
        state.currentVkSourceGroup = action.payload;
      })
      .addCase(removeSourceFromGroup.rejected, (state, action) => {
        state.updating = false;
        state.error = action.payload || { message: 'Failed to remove source from group' };
      });
  }
});

export const { clearVkSourceGroupsError, clearCurrentVkSourceGroup, resetSuccess } = vkSourceGroupsSlice.actions;

export default vkSourceGroupsSlice.reducer; 