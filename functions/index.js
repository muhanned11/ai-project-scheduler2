const functions = require('firebase-functions');
const cors = require('cors')({origin: true});

exports.claude = functions.https.onRequest((request, response) => {
  cors(request, response, async () => {
    if (request.method !== 'POST') {
      return response.status(405).json({
        error: { message: 'Method not allowed. Use POST.' }
      });
    }

    try {
      const fetch = (await import('node-fetch')).default;
      const apiKey = functions.config().anthropic?.key;
      
      if (!apiKey) {
        console.error('Anthropic API key not configured');
        return response.status(500).json({
          error: { message: 'API key not configured. Run: firebase functions:config:set anthropic.key="your-key"' }
        });
      }

      console.log('Forwarding request to Anthropic API');

      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(request.body)
      });

      const data = await anthropicResponse.json();
      
      if (!anthropicResponse.ok) {
        console.error('Anthropic API error:', data);
        return response.status(anthropicResponse.status).json(data);
      }

      return response.status(200).json(data);
      
    } catch (error) {
      console.error('Cloud Function error:', error);
      return response.status(500).json({
        error: {
          message: error.message || 'Internal server error',
          type: 'cloud_function_error'
        }
      });
    }
  });
});