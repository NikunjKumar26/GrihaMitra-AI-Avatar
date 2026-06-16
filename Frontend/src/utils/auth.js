/**
 * Safely decodes a JWT token to check if it has expired.
 * @param {string} token - The JWT token to verify.
 * @returns {boolean} True if the token is expired or invalid, false otherwise.
 */
export const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length < 2) return true;
    
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    
    const jsonPayload = decodeURIComponent(
      window.atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    const { exp } = JSON.parse(jsonPayload);
    if (!exp) return false; // Token does not have an expiration timestamp
    
    // Check if the current time is past the expiration time
    return Date.now() >= exp * 1000;
  } catch (error) {
    console.error('Error decoding JWT token:', error);
    return true; // Assume expired or invalid on parsing error
  }
};
