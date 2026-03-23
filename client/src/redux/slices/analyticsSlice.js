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
  async ({ sourceId, limit = 50, minAgeMinutes = null, maxAgeMinutes = null }, { rejectWithValue }) => {
    try {
      const query = new URLSearchParams({ limit: String(limit) });
      if (minAgeMinutes !== null && minAgeMinutes !== undefined && minAgeMinutes !== '') {
        query.set('minAgeMinutes', String(minAgeMinutes));
      }
      if (maxAgeMinutes !== null && maxAgeMinutes !== undefined && maxAgeMinutes !== '') {
        query.set('maxAgeMinutes', String(maxAgeMinutes));
      }
      const response = await axios.get(`${API_URL}/telegram-analytics/sources/${sourceId}/posts?${query.toString()}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchAnalyticsSourceConfig = createAsyncThunk(
  'analytics/fetchSourceConfig',
  async ({ sourceId }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/telegram-sources/${sourceId}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

export const fetchAnalyticsPostSnapshots = createAsyncThunk(
  'analytics/fetchPostSnapshots',
  async ({ postId, limit = 200 }, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_URL}/telegram-analytics/posts/${postId}/snapshots?limit=${limit}`);
      return {
        postId,
        snapshots: response.data
      };
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
    selectedSourceConfig: null,
    selectedPostSnapshots: [],
    selectedPostId: null,
    overviewLoading: false,
    sourcesLoading: false,
    postsLoading: false,
    sourceConfigLoading: false,
    snapshotsLoading: false,
    error: null
  },
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    clearSelectedSourcePosts: (state) => {
      state.selectedSourcePosts = [];
    },
    clearSelectedPostSnapshots: (state) => {
      state.selectedPostSnapshots = [];
      state.selectedPostId = null;
    },
    clearSelectedSourceConfig: (state) => {
      state.selectedSourceConfig = null;
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
      })
      .addCase(fetchAnalyticsSourceConfig.pending, (state) => {
        state.sourceConfigLoading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsSourceConfig.fulfilled, (state, action) => {
        state.sourceConfigLoading = false;
        state.selectedSourceConfig = action.payload;
      })
      .addCase(fetchAnalyticsSourceConfig.rejected, (state, action) => {
        state.sourceConfigLoading = false;
        state.selectedSourceConfig = null;
        state.error = action.payload;
      })
      .addCase(fetchAnalyticsPostSnapshots.pending, (state, action) => {
        state.snapshotsLoading = true;
        state.selectedPostId = action.meta.arg.postId;
        state.error = null;
      })
      .addCase(fetchAnalyticsPostSnapshots.fulfilled, (state, action) => {
        state.snapshotsLoading = false;
        state.selectedPostId = action.payload.postId;
        state.selectedPostSnapshots = action.payload.snapshots;
      })
      .addCase(fetchAnalyticsPostSnapshots.rejected, (state, action) => {
        state.snapshotsLoading = false;
        state.selectedPostSnapshots = [];
        state.error = action.payload;
      });
  }
});

export const {
  clearError,
  clearSelectedSourcePosts,
  clearSelectedPostSnapshots,
  clearSelectedSourceConfig
} = analyticsSlice.actions;
export default analyticsSlice.reducer;
