import { createSlice } from '@reduxjs/toolkit';

// Initial state
const initialState = {
  mappings: [],
  mapping: null,
  loading: false,
  error: null,
  success: false
};

// Mappings slice
const mappingsSlice = createSlice({
  name: 'mappings',
  initialState,
  reducers: {
    setLoading: (state) => {
      state.loading = true;
      state.error = null;
    },
    setMappings: (state, action) => {
      state.mappings = action.payload;
      state.loading = false;
    },
    setMapping: (state, action) => {
      state.mapping = action.payload;
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
  setMappings,
  setMapping,
  setError,
  clearError,
  setSuccess
} = mappingsSlice.actions;

export default mappingsSlice.reducer; 