// pages/api/proxy-image.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { url } = req.query;
  
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ message: 'Missing or invalid image URL' });
  }

  try {
    // Fetch the image from the provided URL
    const response = await axios.get(url, {
      responseType: 'arraybuffer'
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
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}