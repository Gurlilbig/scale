// pages/api/webflow-assets.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { fetchWebflowToken } from '../api/fetch-collections';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get Webflow API token
    const webflowToken = await fetchWebflowToken();
    
    // Get Webflow site ID from environment variables
    const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;
    
    if (!WEBFLOW_SITE_ID) {
      return res.status(500).json({ message: 'Missing Webflow site ID configuration' });
    }
    
    // Get pagination parameters from query
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    
    // Fetch assets from Webflow
    try {
      // Try v2 API first
      const assetsResponse = await axios.get(
        `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/assets`,
        {
          headers: {
            'Authorization': `Bearer ${webflowToken}`,
            'accept-version': '1.0.0'
          },
          params: {
            offset,
            limit
          }
        }
      );
      
      // Map the data to a consistent format
      const assets = assetsResponse.data.assets.map((asset: any) => ({
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
    } catch (error: any) {
      // If v2 API fails, fall back to v1
      console.log('V2 API failed, falling back to v1:', error.message);
      
      const assetsResponse = await axios.get(
        `https://api.webflow.com/sites/${WEBFLOW_SITE_ID}/assets`,
        {
          headers: {
            'Authorization': `Bearer ${webflowToken}`,
            'Accept': 'application/json'
          },
          params: {
            offset,
            limit
          }
        }
      );
      
      // Map the data to a consistent format
      const assets = assetsResponse.data.assets.map((asset: any) => ({
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
  } catch (error: any) {
    console.error('Error fetching Webflow assets:', error);
    
    const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
    
    return res.status(error.response?.status || 500).json({ 
      message: 'Failed to fetch Webflow assets',
      error: errorMessage
    });
  }
}