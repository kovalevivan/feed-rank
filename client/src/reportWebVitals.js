// Simplified version without web-vitals dependency
const reportWebVitals = (onPerfEntry) => {
  if (onPerfEntry && onPerfEntry instanceof Function) {
    // We'll just log a message instead of actually measuring vitals
    console.log('Web Vitals reporting is disabled');
  }
};

export default reportWebVitals; 