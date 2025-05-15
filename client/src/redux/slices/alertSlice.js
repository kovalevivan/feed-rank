import { createSlice } from '@reduxjs/toolkit';

// Generate unique ID for alerts
const generateId = () => `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

// Initial state
const initialState = {
  alerts: []
};

// Alert slice
const alertSlice = createSlice({
  name: 'alerts',
  initialState,
  reducers: {
    setAlert: (state, action) => {
      const { type, message, timeout = 5000 } = action.payload;
      const id = generateId();
      
      state.alerts.push({
        id,
        type,
        message,
        createdAt: new Date().toISOString()
      });
      
      // Auto-remove alert after timeout
      if (timeout > 0) {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('removeAlert', { detail: { id } }));
        }, timeout);
      }
    },
    removeAlert: (state, action) => {
      state.alerts = state.alerts.filter(alert => alert.id !== action.payload);
    },
    clearAlerts: (state) => {
      state.alerts = [];
    }
  }
});

export const { setAlert, removeAlert, clearAlerts } = alertSlice.actions;

// Action creator for setting alerts
export const showAlert = (message, type = 'info', timeout = 5000) => dispatch => {
  dispatch(setAlert({ message, type, timeout }));
};

export default alertSlice.reducer; 