import { createSlice } from '@reduxjs/toolkit';

// Initial state
const initialState = {
  telegramSources: [],
  telegramSource: null,
  loading: false,
  error: null,
  success: false
};

// Telegram sources slice
const telegramSourcesSlice = createSlice({
  name: 'telegramSources',
  initialState,
  reducers: {
    setLoading: (state) => {
      console.log("🔄 Redux: setLoading called - setting loading to true");      state.loading = true;
      state.error = null;
    },
    setTelegramSources: (state, action) => {
      console.log("🔄 Redux: setTelegramSources called with", action.payload?.length, "sources");
      console.log("🔄 Redux: Setting loading to false");      state.telegramSources = action.payload;
      state.loading = false;
    },
    setTelegramSource: (state, action) => {
      state.telegramSource = action.payload;
      state.loading = false;
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
  setTelegramSources,
  setTelegramSource,
  setError,
  clearError,
  setSuccess
} = telegramSourcesSlice.actions;

export default telegramSourcesSlice.reducer;