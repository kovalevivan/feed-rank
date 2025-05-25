import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

// Async thunks
export const fetchExperimentalSources = createAsyncThunk(
  'analytics/fetchExperimentalSources',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/analytics/experimental-sources`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchSourceDynamics = createAsyncThunk(
  'analytics/fetchSourceDynamics',
  async ({ sourceId, days = 7 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/analytics/source-dynamics/${sourceId}?days=${days}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchAggregatedDynamics = createAsyncThunk(
  'analytics/fetchAggregatedDynamics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/analytics/aggregated-dynamics`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

// Slice
const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    experimentalSources: [],
    selectedSourceDynamics: null,
    aggregatedDynamics: null,
    loading: false,
    sourceDynamicsLoading: false,
    aggregatedLoading: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSourceDynamics: (state) => {
      state.selectedSourceDynamics = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // Fetch experimental sources
      .addCase(fetchExperimentalSources.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchExperimentalSources.fulfilled, (state, action) => {
        state.loading = false;
        state.experimentalSources = action.payload;
      })
      .addCase(fetchExperimentalSources.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // Fetch source dynamics
      .addCase(fetchSourceDynamics.pending, (state) => {
        state.sourceDynamicsLoading = true;
        state.error = null;
      })
      .addCase(fetchSourceDynamics.fulfilled, (state, action) => {
        state.sourceDynamicsLoading = false;
        state.selectedSourceDynamics = action.payload;
      })
      .addCase(fetchSourceDynamics.rejected, (state, action) => {
        state.sourceDynamicsLoading = false;
        state.error = action.payload;
      })
      // Fetch aggregated dynamics
      .addCase(fetchAggregatedDynamics.pending, (state) => {
        state.aggregatedLoading = true;
        state.error = null;
      })
      .addCase(fetchAggregatedDynamics.fulfilled, (state, action) => {
        state.aggregatedLoading = false;
        state.aggregatedDynamics = action.payload;
      })
      .addCase(fetchAggregatedDynamics.rejected, (state, action) => {
        state.aggregatedLoading = false;
        state.error = action.payload;
      });
  }
});

export const { clearError, clearSourceDynamics } = analyticsSlice.actions;
export default analyticsSlice.reducer; 