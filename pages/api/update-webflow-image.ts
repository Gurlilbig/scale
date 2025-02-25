// pages/api/update-webflow-image.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import crypto from 'crypto';
import axios from 'axios';
import FormData from 'form-data';
import { fetchWebflowToken } from '../api/fetch-collections';

export const config = {
  api: {
    bodyParser: false, // Disabling body parser for file upload
  },
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Parse form data with formidable
    const form = new IncomingForm();
    const { fields, files }: any = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        resolve({ fields, files });
      });
    });
    
    const file = Array.isArray(files.file) 
      ? files.file[0] 
      : files.file;

    if (!file) {
      return res.status(400).json({ message: 'Missing file' });
    }

    // Get Webflow API token
    const webflowToken = await fetchWebflowToken();
    
    // Get Webflow site ID from environment variables
    const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;
    
    if (!WEBFLOW_SITE_ID) {
      return res.status(500).json({ message: 'Missing Webflow site ID configuration' });
    }
    
    // Read file as buffer
    const fileBuffer = fs.readFileSync(file.filepath);
    
    // Calculate MD5 hash of the file for the Webflow API
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const fileName = file.originalFilename || 'resized-image.png';
    
    // STEP 1: Create asset metadata
    console.log('Creating asset metadata in Webflow...');
    let createAssetResponse;
    try {
      createAssetResponse = await axios.post(
        `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/assets`,
        {
          fileName,
          fileHash,
          // parentFolder: 'optional_folder_id' // Optional
        },
        {
          headers: {
            'Authorization': `Bearer ${webflowToken}`,
            'accept-version': '1.0.0',
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Webflow asset created successfully:', {
        status: createAssetResponse.status,
        id: createAssetResponse.data.asset?._id || createAssetResponse.data.id
      });
    } catch (error: any) {
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
    s3FormData.append('file', fileBuffer, fileName);
    
    try {
      const s3UploadResponse = await axios.post(uploadUrl, s3FormData, {
        headers: {
          ...s3FormData.getHeaders(),
        }
      });
      
      console.log('✅ S3 upload successful with status:', s3UploadResponse.status);
    } catch (error: any) {
      console.error('❌ S3 upload failed:', error.response?.data || error.message);
      return res.status(error.response?.status || 500).json({
        message: 'Failed to upload image to S3',
        details: error.response?.data || error.message
      });
    }
    
    // Clean up temp file
    fs.unlinkSync(file.filepath);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Image successfully uploaded to Webflow assets',
      assetId: imageAssetId,
      imageUrl: imageUrl
    });
  } catch (error: any) {
    // Improved error logging with more details
    console.error('❌ Error handling image upload:');
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('Response error data:', error.response.data);
      console.error('Response status:', error.response.status);
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request error:', error.message);
    }
    
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
      details: error.response?.data || null
    });
  }
}