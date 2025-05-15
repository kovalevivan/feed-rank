import { createSlice } from '@reduxjs/toolkit';

// Initial state
const initialState = {
  telegramChannels: [],
  telegramChannel: null,
  loading: false,
  error: null,
  success: false
};

// Telegram channels slice
const telegramChannelsSlice = createSlice({
  name: 'telegramChannels',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
      state.error = null;
    },
    setTelegramChannels: (state, action) => {
      state.telegramChannels = action.payload;
      state.loading = false;
    },
    setTelegramChannel: (state, action) => {
      state.telegramChannel = action.payload;
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
  setTelegramChannels,
  setTelegramChannel,
  setError,
  clearError,
  setSuccess
} = telegramChannelsSlice.actions;

export default telegramChannelsSlice.reducer; 