import { createSlice } from '@reduxjs/toolkit';

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
        state.settings[category] = {};
      }
      
      state.settings[category][key] = value;
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