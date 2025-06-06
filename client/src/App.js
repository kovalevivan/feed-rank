import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import store from './redux/store';

// Translation Provider
import { TranslationProvider } from './translations/TranslationContext';

// Components
import Layout from './components/common/Layout';
import PrivateRoute from './components/common/PrivateRoute';

// Pages
import Dashboard from './components/dashboard/Dashboard';
import Login from './components/auth/Login';
import Register from './components/auth/Register';
import SourcesList from './components/sources/SourcesList';
import SourceForm from './components/sources/SourceForm';
import ChannelsList from './components/destinations/ChannelsList';
import ChannelForm from './components/destinations/ChannelForm';
import MappingsList from './components/mappings/MappingsList';
import MappingForm from './components/mappings/MappingForm';
import Settings from './components/settings/Settings';
import SourceGroupsList from './components/sources/SourceGroupsList';
import SourceGroupForm from './components/sources/SourceGroupForm';
import Analytics from './components/analytics/Analytics';

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
              {/* Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              
              {/* Protected Routes */}
              <Route path="/" element={<Layout />}>
                <Route index element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                
                {/* Sources Routes */}
                <Route path="sources" element={<PrivateRoute><SourcesList /></PrivateRoute>} />
                <Route path="sources/new" element={<PrivateRoute><SourceForm /></PrivateRoute>} />
                <Route path="sources/:id" element={<PrivateRoute><SourceForm /></PrivateRoute>} />
                
                {/* Source Groups Routes */}
                <Route path="source-groups" element={<PrivateRoute><SourceGroupsList /></PrivateRoute>} />
                <Route path="source-groups/new" element={<PrivateRoute><SourceGroupForm /></PrivateRoute>} />
                <Route path="source-groups/:id" element={<PrivateRoute><SourceGroupForm /></PrivateRoute>} />
                
                {/* Channels Routes */}
                <Route path="channels" element={<PrivateRoute><ChannelsList /></PrivateRoute>} />
                <Route path="channels/new" element={<PrivateRoute><ChannelForm /></PrivateRoute>} />
                <Route path="channels/:id" element={<PrivateRoute><ChannelForm /></PrivateRoute>} />
                
                {/* Mappings Routes */}
                <Route path="mappings" element={<PrivateRoute><MappingsList /></PrivateRoute>} />
                <Route path="mappings/new" element={<PrivateRoute><MappingForm /></PrivateRoute>} />
                <Route path="mappings/:id" element={<PrivateRoute><MappingForm /></PrivateRoute>} />
                
                {/* Settings Route */}
                <Route path="settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                
                {/* Analytics Route */}
                <Route path="analytics" element={<PrivateRoute><Analytics /></PrivateRoute>} />
                
                {/* Catch all - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          </Router>
        </TranslationProvider>
      </ThemeProvider>
    </Provider>
  );
}

export default App; 