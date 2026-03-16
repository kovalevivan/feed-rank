import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import store from './redux/store';
import './api/axios';

// Translation Provider
import { TranslationProvider } from './translations/TranslationContext';

// Components
import Layout from './components/common/Layout';

// Pages
import Dashboard from './components/dashboard/Dashboard';
import SourceForm from './components/sources/SourceForm';
import UnifiedSourcesList from './components/sources/UnifiedSourcesList';
import UnifiedSourceForm from './components/sources/UnifiedSourceForm';
import ChannelsList from './components/destinations/ChannelsList';
import ChannelForm from './components/destinations/ChannelForm';
import MappingsList from './components/mappings/MappingsList';
import MappingForm from './components/mappings/MappingForm';
import Settings from './components/settings/Settings';
import SourceGroupsList from './components/sources/SourceGroupsList';
import SourceGroupForm from './components/sources/SourceGroupForm';
import Analytics from './components/analytics/Analytics';
import { TelegramSourcesList, TelegramSourceForm } from './components/telegramSources';

// Create a Material UI theme
const theme = createTheme({
  palette: {
    primary: {
      main: '#2196F3', // Blue
    },
    secondary: {
      main: '#FF9800', // Orange
    },
    background: {
      default: '#F5F7FA',
    },
  },
  typography: {
    fontFamily: 'Roboto, Arial, sans-serif',
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        },
      },
    },
  },
});

function App() {
  return (
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <TranslationProvider>
          <CssBaseline />
          <Router>
            <Routes>
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="/login" element={<Navigate to="/app" replace />} />
              <Route path="/register" element={<Navigate to="/app" replace />} />

              <Route path="/app" element={<Layout />}>
                <Route index element={<Dashboard />} />
                
                <Route path="sources" element={<UnifiedSourcesList />} />
                <Route path="sources/new" element={<UnifiedSourceForm />} />
                <Route path="sources/:id" element={<UnifiedSourceForm />} />
                
                <Route path="vk-sources/new" element={<SourceForm />} />
                <Route path="vk-sources/:id" element={<SourceForm />} />
                
                <Route path="source-groups" element={<SourceGroupsList />} />
                <Route path="source-groups/new" element={<SourceGroupForm />} />
                <Route path="source-groups/:id" element={<SourceGroupForm />} />
                
                <Route path="channels" element={<ChannelsList />} />
                <Route path="channels/new" element={<ChannelForm />} />
                <Route path="channels/:id" element={<ChannelForm />} />
                
                <Route path="telegram-sources" element={<TelegramSourcesList />} />
                <Route path="telegram-sources/new" element={<TelegramSourceForm />} />
                <Route path="telegram-sources/:id" element={<TelegramSourceForm />} />
                
                <Route path="mappings" element={<MappingsList />} />
                <Route path="mappings/new" element={<MappingForm />} />
                <Route path="mappings/:id" element={<MappingForm />} />
                
                <Route path="settings" element={<Settings />} />
                
                <Route path="analytics" element={<Analytics />} />
              </Route>
              
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          </Router>
        </TranslationProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App; 
