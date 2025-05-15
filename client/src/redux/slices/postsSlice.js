import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

// Initial state
const initialState = {
  posts: [],
  pagination: {
    total: 0,
    page: 1,
    limit: 20,
    pages: 0
  },
  post: null,
  dashboardData: null,
  loading: false,
  error: null
};

// Get all posts with filters
export const fetchPosts = createAsyncThunk(
  'posts/fetchPosts',
  async (params = {}, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        },
        params
      };
      
      const response = await axios.get('/api/posts', config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message
      );
    }
  }
);

// Get dashboard data
export const fetchDashboardData = createAsyncThunk(
  'posts/fetchDashboardData',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.get('/api/posts/dashboard', config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message
      );
    }
  }
);

// Get post by ID
export const fetchPostById = createAsyncThunk(
  'posts/fetchPostById',
  async (id, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.get(`/api/posts/${id}`, config);
      
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message
      );
    }
  }
);

// Update post status (approve/reject)
export const updatePostStatus = createAsyncThunk(
  'posts/updatePostStatus',
  async ({ id, status }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.put(
        `/api/posts/${id}/status`,
        { status },
        config
      );
      
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message
      );
    }
  }
);

// Bulk update post status
export const bulkUpdatePostStatus = createAsyncThunk(
  'posts/bulkUpdatePostStatus',
  async ({ ids, status }, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      
      const config = {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': auth.token
        }
      };
      
      const response = await axios.put(
        '/api/posts/bulk/status',
        { ids, status },
        config
      );
      
      return response.data;
    } catch (error) {
      return rejectWithValue(
        error.response && error.response.data.message
          ? error.response.data.message
          : error.message
      );
    }
  }
);

// Posts slice
const postsSlice = createSlice({
  name: 'posts',
  initialState,
  reducers: {
    clearPostsError: (state) => {
      state.error = null;
    },
    clearCurrentPost: (state) => {
      state.post = null;
    }
  },
  extraReducers: (builder) => {
    // Fetch posts cases
    builder.addCase(fetchPosts.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchPosts.fulfilled, (state, action) => {
      state.loading = false;
      state.posts = action.payload.posts;
      state.pagination = action.payload.pagination;
    });
    builder.addCase(fetchPosts.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    
    // Fetch dashboard data cases
    builder.addCase(fetchDashboardData.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchDashboardData.fulfilled, (state, action) => {
      state.loading = false;
      state.dashboardData = action.payload;
    });
    builder.addCase(fetchDashboardData.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    
    // Fetch post by ID cases
    builder.addCase(fetchPostById.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchPostById.fulfilled, (state, action) => {
      state.loading = false;
      state.post = action.payload;
    });
    builder.addCase(fetchPostById.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    
    // Update post status cases
    builder.addCase(updatePostStatus.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(updatePostStatus.fulfilled, (state, action) => {
      state.loading = false;
      state.post = action.payload.post;
      
      // Update post in posts array if it exists
      const updatedPostIndex = state.posts.findIndex(
        (post) => post._id === action.payload.post._id
      );
      
      if (updatedPostIndex !== -1) {
        state.posts[updatedPostIndex] = action.payload.post;
      }
    });
    builder.addCase(updatePostStatus.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
    
    // Bulk update post status cases
    builder.addCase(bulkUpdatePostStatus.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(bulkUpdatePostStatus.fulfilled, (state) => {
      state.loading = false;
      // We'll reload the posts after bulk update to get fresh data
    });
    builder.addCase(bulkUpdatePostStatus.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload;
    });
  }
});

export const { clearPostsError, clearCurrentPost } = postsSlice.actions;

export default postsSlice.reducer; 