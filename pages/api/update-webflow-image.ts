// pages/api/update-webflow-image.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
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

    // Extract fields and file
    const collectionItemId = Array.isArray(fields.collectionItemId) 
      ? fields.collectionItemId[0] 
      : fields.collectionItemId;
    
    const fieldName = Array.isArray(fields.fieldName) 
      ? fields.fieldName[0] 
      : fields.fieldName;
    
    const file = Array.isArray(files.file) 
      ? files.file[0] 
      : files.file;

    if (!collectionItemId || !fieldName || !file) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get Webflow API token
    const webflowToken = await fetchWebflowToken();
    
    // Get Webflow site ID from environment variables
    const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;
    const COLLECTION_ID = process.env.WEBFLOW_COLLECTION_ID;
    
    if (!WEBFLOW_SITE_ID) {
      return res.status(500).json({ message: 'Missing Webflow site ID configuration' });
    }
    
    // Read file as buffer
    const fileBuffer = fs.readFileSync(file.filepath);
    
    // Calculate MD5 hash of the file for the Webflow API
    const fileHash = crypto.createHash('md5').update(fileBuffer).digest('hex');
    const fileName = file.originalFilename || 'resized-image.png';
    
    // STEP 1: Create asset metadata
    const createAssetResponse = await axios.post(
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
    
    if (createAssetResponse.status !== 201) {
      console.error('Webflow create asset error:', createAssetResponse.data);
      return res.status(createAssetResponse.status).json({
        message: 'Failed to create asset metadata in Webflow',
        details: createAssetResponse.data
      });
    }
    
    const { uploadUrl, uploadDetails, asset } = createAssetResponse.data;
    
    // STEP 2: Upload asset to S3
    const s3FormData = new FormData();
    
    // Add all upload details to the form
    for (const [key, value] of Object.entries(uploadDetails)) {
      s3FormData.append(key, value);
    }
    
    // Add the file as the last field
    s3FormData.append('file', fileBuffer, fileName);
    
    const s3UploadResponse = await axios.post(uploadUrl, s3FormData, {
      headers: {
        ...s3FormData.getHeaders(),
      }
    });
    
    if (s3UploadResponse.status !== 204 && s3UploadResponse.status !== 200) {
      console.error('S3 upload error:', s3UploadResponse.data);
      return res.status(s3UploadResponse.status).json({
        message: 'Failed to upload image to S3',
        details: s3UploadResponse.data
      });
    }
    
    // STEP 3: Update the collection item with the new image
    const imageAssetId = asset._id;
    const imageUrl = asset.url;
    
    const updateResponse = await axios.patch(
      `https://api.webflow.com/collections/${COLLECTION_ID}/items/${collectionItemId}`,
      {
        fields: {
          [fieldName]: {
            url: imageUrl,
            asset: imageAssetId
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${webflowToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'accept-version': '1.0.0',
        }
      }
    );
    
    if (updateResponse.status !== 200) {
      console.error('Webflow item update error:', updateResponse.data);
      return res.status(updateResponse.status).json({ 
        message: 'Failed to update collection item in Webflow',
        details: updateResponse.data
      });
    }
    
    // Clean up temp file
    fs.unlinkSync(file.filepath);
    
    return res.status(200).json({ 
      success: true, 
      message: 'Image successfully uploaded and updated in Webflow',
      itemId: collectionItemId,
      assetId: imageAssetId,
      imageUrl: imageUrl
    });
  } catch (error) {
    console.error('Error handling image upload:', error);
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}