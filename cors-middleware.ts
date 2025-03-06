import type { NextApiRequest, NextApiResponse } from 'next';

export default function corsMiddleware(
  req: NextApiRequest, 
  res: NextApiResponse, 
  next: () => void
) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', 'https://gurmehars-trial-site.design.webflow.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight OPTIONS requests immediately
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  return next();
}