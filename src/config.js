// src/config.js
const isDevelopment = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';

export const API_URL = isDevelopment
  ? 'http://localhost:3001/api'
  : 'https://us-central1-ai-scheduler-ab53e.cloudfunctions.net';  // Your Cloud Function URL

export default API_URL;