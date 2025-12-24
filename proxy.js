const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - allow your Firebase domain
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'https://ai-scheduler-ab53e.web.app',
    'https://ai-scheduler-ab53e.firebaseapp.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}));

app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'AI Scheduler Proxy Running',
    timestamp: new Date().toISOString(),
    endpoints: ['/api/claude']
  });
});

// Main API endpoint - proxies requests to Anthropic
app.post('/api/claude', async (req, res) => {
  try {
    console.log('📨 Received request to /api/claude');
    
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('❌ API key not configured');
      return res.status(500).json({ 
        error: { message: 'API key not configured in environment variables' } 
      });
    }

    console.log('🔄 Forwarding to Anthropic API...');
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('❌ Anthropic API error:', response.status);
      return res.status(response.status).json(data);
    }

    console.log('✅ Success! Returning response');
    res.json(data);
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ 
      error: { 
        message: error.message || 'Internal server error',
        type: 'proxy_error'
      } 
    });
  }
});

// Catch-all for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    availableRoutes: ['GET /', 'POST /api/claude']
  });
});

app.listen(PORT, () => {
  console.log('=================================');
  console.log('✅ AI Scheduler Proxy Server');
  console.log(`📡 Running on port ${PORT}`);
  console.log('🔗 Endpoints:');
  console.log('   GET  / (health check)');
  console.log('   POST /api/claude (proxy)');
  console.log('=================================');
});