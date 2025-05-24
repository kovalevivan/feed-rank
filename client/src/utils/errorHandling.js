/**
 * Helper function to standardize error handling from API responses
 * @param {Error} error - The error caught in the try/catch
 * @returns {Object} Standardized error object for the UI
 */
export const handleApiError = (error) => {
  // If we have a server response with an error
  if (error.response && error.response.data) {
    return error.response.data;
  }
  
  // For network errors or other issues
  return {
    message: error.message || 'An unexpected error occurred',
    error: error.toString()
  };
}; 