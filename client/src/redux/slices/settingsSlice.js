import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { handleApiError } from '../../utils/errorHandling';

// Fetch all settings
export const fetchSettings = createAsyncThunk(
  'settings/fetchSettings',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.get('/api/settings', config);
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Update a setting
export const updateSettingValue = createAsyncThunk(
  'settings/updateSettingValue',
  async ({ key, value, description, category }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.put(`/api/settings/${key}`, 
        { value, description, category }, 
        config
      );
      
      return response.data;
    } catch (error) {
      return rejectWithValue(handleApiError(error));
    }
  }
);

// Initial state
const initialState = {
  settings: {},
  loading: false,
  error: null,
  success: false
};

// Settings slice
const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
      state.error = null;
    },
    setSettings: (state, action) => {
      state.settings = action.payload;
      state.loading = false;
    },
    updateSetting: (state, action) => {
      const { category, key, value } = action.payload;
      
      if (!state.settings[category]) {
        state.settings[category] = [];
      }
      
      // Find the setting in the category
      const settingIndex = state.settings[category].findIndex(
        setting => setting.key === `${category}.${key}`
      );
      
      if (settingIndex >= 0) {
        // Update existing setting
        state.settings[category][settingIndex].value = value;
      } else {
        // Add new setting
        state.settings[category].push({
          key: `${category}.${key}`,
          value,
          category
        });
      }
    },
    setError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearError: (state) => {
      state.error = null;
    },
    setSuccess: (state, action) => {
      state.success = action.payload;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch settings
      .addCase(fetchSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchSettings.fulfilled, (state, action) => {
        state.settings = action.payload;
        state.loading = false;
      })
      .addCase(fetchSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      
      // Update setting
      .addCase(updateSettingValue.pending, (state) => {
        state.loading = true;
        state.error = null;
        state.success = false;
      })
      .addCase(updateSettingValue.fulfilled, (state, action) => {
        state.loading = false;
        state.success = true;
        
        // Update the setting in the state
        const setting = action.payload;
        const category = setting.category;
        
        if (!state.settings[category]) {
          state.settings[category] = [];
        }
        
        const settingIndex = state.settings[category].findIndex(
          s => s.key === setting.key
        );
        
        if (settingIndex >= 0) {
          state.settings[category][settingIndex] = setting;
        } else {
          state.settings[category].push(setting);
        }
      })
      .addCase(updateSettingValue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
        state.success = false;
      });
  }
});

export const {
  setLoading,
  setSettings,
  updateSetting,
  setError,
  clearError,
  setSuccess
} = settingsSlice.actions;

export default settingsSlice.reducer; 