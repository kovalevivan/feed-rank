import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice';
import alertReducer from './slices/alertSlice';
import vkSourcesReducer from './slices/vkSourcesSlice';
import telegramChannelsReducer from './slices/telegramChannelsSlice';
import mappingsReducer from './slices/mappingsSlice';
import postsReducer from './slices/postsSlice';
import settingsReducer from './slices/settingsSlice';
import vkSourceGroupsReducer from './slices/vkSourceGroupsSlice';
import analyticsReducer from './slices/analyticsSlice';

const store = configureStore({
  reducer: {
    auth: authReducer,
    alerts: alertReducer,
    vkSources: vkSourcesReducer,
    telegramChannels: telegramChannelsReducer,
    mappings: mappingsReducer,
    posts: postsReducer,
    settings: settingsReducer,
    vkSourceGroups: vkSourceGroupsReducer,
    analytics: analyticsReducer
  }
});

export default store; 