import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

export const fetchAnalyticsOverview = createAsyncThunk(
  'analytics/fetchOverview',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/telegram-analytics/overview`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchAnalyticsSources = createAsyncThunk(
  'analytics/fetchSources',
  async (_, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/telegram-analytics/sources`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchAnalyticsSourcePosts = createAsyncThunk(
  'analytics/fetchSourcePosts',
  async ({ sourceId, limit = 50 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/telegram-analytics/sources/${sourceId}/posts?limit=${limit}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    overview: null,
    sources: [],
    selectedSourcePosts: [],
    overviewLoading: false,
    sourcesLoading: false,
    postsLoading: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedSourcePosts: (state) => {
      state.selectedSourcePosts = [];
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalyticsOverview.pending, (state) => {
        state.overviewLoading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsOverview.fulfilled, (state, action) => {
        state.overviewLoading = false;
        state.overview = action.payload;
      })
      .addCase(fetchAnalyticsOverview.rejected, (state, action) => {
        state.overviewLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchAnalyticsSources.pending, (state) => {
        state.sourcesLoading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsSources.fulfilled, (state, action) => {
        state.sourcesLoading = false;
        state.sources = action.payload;
      })
      .addCase(fetchAnalyticsSources.rejected, (state, action) => {
        state.sourcesLoading = false;
        state.error = action.payload;
      })
      .addCase(fetchAnalyticsSourcePosts.pending, (state) => {
        state.postsLoading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsSourcePosts.fulfilled, (state, action) => {
        state.postsLoading = false;
        state.selectedSourcePosts = action.payload;
      })
      .addCase(fetchAnalyticsSourcePosts.rejected, (state, action) => {
        state.postsLoading = false;
        state.selectedSourcePosts = [];
        state.error = action.payload;
      });
  }
});

export const { clearError, clearSelectedSourcePosts } = analyticsSlice.actions;
export default analyticsSlice.reducer;
