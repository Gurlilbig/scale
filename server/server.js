// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); // Import axios
const multer = require('multer'); // Import multer
const crypto = require('crypto'); // Import crypto
const FormData = require('form-data'); // Import form-data

const app = express();
const port = 3000; 

// Enable CORS
app.use(cors({
  origin: '*', // Allow all origins during development
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

// Add options handling for preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Add proper headers to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Serve the redirect page
app.get('/oauth/callback', (req, res) => {
  res.sendFile(path.join(__dirname, 'redirect.html'));
});

// New endpoint to exchange code for token
app.post('/oauth/exchange-token', async (req, res) => {
  const { code, redirect_uri } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing' });
  }
  
  try {
    // Exchange the code for an access token
    const tokenResponse = await axios.post('https://api.webflow.com/oauth/access_token', {
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      code: code,
      redirect_uri: redirect_uri || 'http://localhost:3000/oauth/callback', // Add this
      grant_type: 'authorization_code'
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Store the token in a database in a real application
    // For simplicity, we're just returning it
    res.json({
      type: 'WEBFLOW_AUTH_SUCCESS',
      access_token: tokenResponse.data.access_token,
      token_type: tokenResponse.data.token_type,
      expires_in: tokenResponse.data.expires_in
    });
  } catch (error) {
    console.error('OAuth error:', error);
    res.status(500).json({ error: error.response?.data?.error || error.message, error_description: error.response?.data?.error_description });
  }
});

// API proxy routes for your extension
app.get('/api/webflow-assets', async (req, res) => {
  try {
    // Get the token from request headers
    const token = req.headers.authorization?.split(' ')[1];
      
    if (!token) {
      return res.status(401).json({ message: 'Authentication token required' });
    }
      
    // Use the token to make the request to Webflow
    const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;
      
    if (!WEBFLOW_SITE_ID) {
       return res.status(500).json({ message: 'Missing Webflow site ID configuration' });
    }
    
    // Get pagination parameters from query
    const offset = req.query.offset ? parseInt(req.query.offset) : A0;
    const limit = req.query.limit ? parseInt(req.query.limit) : 100;
    
    // Fetch assets from Webflow
    try {
      // Try v2 API first
      const assetsResponse = await axios.get(
        `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/assets`,
        {
          headers: {
            'Authorization': `Bearer ${token}`, // Use token instead of webflowToken
            'accept-version': '1.0.0'
          },
          params: {
            offset,
            limit
          }
        }
      );
      
      // Map the data to a consistent format
      const assets = assetsResponse.data.assets.map((asset) => ({
        id: asset._id || asset.id,
        name: asset.fileName || asset.name,
        url: asset.url || asset.hostedUrl,
        createdOn: asset.createdOn || asset.dateCreated,
        fileSize: asset.fileSize,
        width: asset.dimensions?.width,
        height: asset.dimensions?.height,
        fileType: asset.contentType || asset.mimeType
      }));
      
      return res.status(200).json({
        assets,
        count: assetsResponse.data.count,
        limit: assetsResponse.data.limit,
        offset: assetsResponse.data.offset,
        total: assetsResponse.data.total
      });
    } catch (error) {
      // If v2 API fails, fall back to v1
      console.log('V2 API failed, falling back to v1:', error.message);
      
      const assetsResponse = await axios.get(
        `https://api.webflow.com/sites/${WEBFLOW_SITE_ID}/assets`,
        {
          headers: {
            'Authorization': `Bearer ${token}`, // Use token instead of webflowToken
            'Accept': 'application/json'
          },
          params: {
            offset,
            limit
          }
        }
      );
      
      // Map the data to a consistent format
      const assets = assetsResponse.data.assets.map((asset) => ({
        id: asset._id || asset.id,
        name: asset.fileName || asset.name,
        url: asset.url || asset.hostedUrl,
        createdOn: asset.createdOn || asset.dateCreated,
        fileSize: asset.fileSize,
        width: asset.dimensions?.width,
        height: asset.dimensions?.height,
        fileType: asset.contentType || asset.mimeType
      }));
      
      return res.status(200).json({
        assets,
        count: assets.length,
        limit,
        offset,
        total: assets.length // v1 API might not provide total count
      });
    }
  } catch (error) {
    console.error('Error fetching Webflow assets:', error);
    
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    
    return res.status(error.response?.status || 500).json({ 
      message: 'Failed to fetch Webflow assets',
      error: errorMessage
    });
  }
});

app.post('/api/update-webflow-image', async (req, res) => {
  try {
    // We need to handle multipart form data with file upload
    const storage = multer.memoryStorage();
    const upload = multer({ storage: storage });
    
    // Use multer to handle the file upload
    upload.single('file')(req, res, async function(err) {
      if (err) {
        return res.status(500).json({ message: 'File upload failed', error: err.message });
      }
      
      const file = req.file;
      if (!file) {
        return res.status(400).json({ message: 'Missing file' });
      }
      
      // Get the token from request headers
      const token = req.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'Authentication token required' });
      }
      
      // Get Webflow site ID from environment variables
      const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;
      
      if (!WEBFLOW_SITE_ID) {
        return res.status(500).json({ message: 'Missing Webflow site ID configuration' });
      }
      
      // Calculate MD5 hash of the file for the Webflow API
      const fileHash = crypto.createHash('md5').update(file.buffer).digest('hex');
      const fileName = file.originalname || 'resized-image.png';
      
      // STEP 1: Create asset metadata
      console.log('Creating asset metadata in Webflow...');
      let createAssetResponse;
      try {
        createAssetResponse = await axios.post(
          `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/assets`,
          {
            fileName,
            fileHash,
          },
          {
            headers: {
              'Authorization': `Bearer ${token}`, // Use token instead of webflowToken
              'accept-version': '1.0.0',
              'Content-Type': 'application/json'
            }
          }
        );
        
        console.log('✅ Webflow asset created successfully:', {
          status: createAssetResponse.status,
          id: createAssetResponse.data.asset?._id || createAssetResponse.data.id
        });
      } catch (error) {
        console.error('❌ Webflow asset creation failed:', error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
          message: 'Failed to create asset metadata in Webflow',
          details: error.response?.data || error.message
        });
      }
      
      // Extract the necessary data from the response
      // Handle both v1 and v2 API response formats
      let uploadUrl, uploadDetails, asset, imageAssetId, imageUrl;
      
      if (createAssetResponse.data.asset) {
        // V2 API format
        ({ uploadUrl, uploadDetails, asset } = createAssetResponse.data);
        imageAssetId = asset._id;
        imageUrl = asset.url;
      } else {
        // V1 API format or different structure
        uploadUrl = createAssetResponse.data.uploadUrl;
        uploadDetails = createAssetResponse.data.uploadDetails;
        imageAssetId = createAssetResponse.data.id;
        imageUrl = createAssetResponse.data.hostedUrl || createAssetResponse.data.assetUrl;
      }
      
      // STEP 2: Upload asset to S3
      console.log('Uploading asset to S3...');
      const s3FormData = new FormData();
      
      // Add all upload details to the form
      for (const [key, value] of Object.entries(uploadDetails)) {
        s3FormData.append(key, value);
      }
      
      // Add the file as the last field
      s3FormData.append('file', file.buffer, fileName);
      
      try {
        const s3UploadResponse = await axios.post(uploadUrl, s3FormData, {
          headers: {
            ...s3FormData.getHeaders(),
          }
        });
        
        console.log('✅ S3 upload successful with status:', s3UploadResponse.status);
      } catch (error) {
        console.error('❌ S3 upload failed:', error.response?.data || error.message);
        return res.status(error.response?.status || 500).json({
          message: 'Failed to upload image to S3',
          details: error.response?.data || error.message
        });
      }
      
      return res.status(200).json({ 
        success: true, 
        message: 'Image successfully uploaded to Webflow assets',
        assetId: imageAssetId,
        imageUrl: imageUrl
      });
    });
  } catch (error) {
    console.error('❌ Error handling image upload:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message || 'Unknown error'
    });
  }
});

app.get('/api/proxy-image', async (req, res) => {
  // Only allow GET requests
  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid image URL' });
  }

  try {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    
    // Fetch the image from the provided URL
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: {
        // Add a user agent to avoid some servers blocking the request
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    // Set the appropriate headers
    const contentType = response.headers['content-type'];
    res.setHeader('Content-Type', contentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Return the image data
    return res.status(200).send(response.data);
  } catch (error) {
    console.error('Error proxying image:', error);
    return res.status(500).json({ 
      message: 'Failed to proxy the image',
      error: error.message || 'Unknown error'
    });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});