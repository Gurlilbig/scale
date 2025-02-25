import axios from 'axios';
import { NextApiRequest, NextApiResponse } from 'next';

const WEBFLOW_API_TOKEN = process.env.WEBFLOW_API_TOKEN;
const WEBFLOW_SITE_ID = process.env.WEBFLOW_SITE_ID;

interface Collection {
  id: string;
  name: string;
  items: {
    id: string;
    name: string;
    lastUpdated: string; // Adding this field
    slug: string | null; // Adding this field
    images: {
      id: string;
      name: string;
      field: string;
      url: string;
      fileId: string | null; // Adding this field
      alt: string | null; // Adding this field
    }[];
    fieldData: Record<string, any>; // Adding this field
  }[];
}

let cachedToken: string | null = null;
export async function fetchWebflowToken(): Promise<string> {
  // Return cached token if available
  if (cachedToken) {
    return cachedToken;
  }
  
  // Get token from environment variable or your secure storage
  const token = process.env.WEBFLOW_API_TOKEN;
  
  if (!token) {
    throw new Error('Webflow API token not found in environment variables');
  }
  
  // Cache the token for future use
  cachedToken = token;
  return token;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Fetch collections from Webflow
    const collectionsResponse = await axios.get(
      `https://api.webflow.com/v2/sites/${WEBFLOW_SITE_ID}/collections`,
      {
        headers: {
          Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
          'accept-version': '1.0.0',
        },
      }
    );

    console.log('✅ Collections API Response:', JSON.stringify(collectionsResponse.data, null, 2));

    if (!collectionsResponse.data || !collectionsResponse.data.collections) {
      console.error('❌ Unexpected API response structure:', collectionsResponse.data);
      return res.status(500).json({ error: 'Unexpected API response structure' });
    }

    // Fetch items for each collection
    const collections = await Promise.all(
      collectionsResponse.data.collections.map(async (collection: any) => {
        console.log(`📌 Collection ID: ${collection.id}, Name: ${collection.displayName}`);

        const collectionName = collection.displayName || 'Unnamed Collection';

        try {
          const itemsResponse = await axios.get(
            `https://api.webflow.com/v2/collections/${collection.id}/items`,
            {
              headers: {
                Authorization: `Bearer ${WEBFLOW_API_TOKEN}`,
                'accept-version': '1.0.0',
              },
            }
          );

          console.log(`✅ Items Response for Collection ID ${collection.id}:`, JSON.stringify(itemsResponse.data, null, 2));

          return {
            id: collection.id,
            name: collectionName,
            items: itemsResponse.data.items.map((item: any) => {
              console.log(`📌 Item ID: ${item.id}, Raw Data:`, JSON.stringify(item, null, 2));

              const itemName = item.fieldData?.name || 'Unnamed Item';
              
              // Extract images from fieldData
              const images: Collection['items'][0]['images'] = [];
              
              if (item.fieldData) {
                // Look for image fields in fieldData
                Object.entries(item.fieldData).forEach(([key, value]: [string, any]) => {
                  // Check if the value has a url property (indicating it's an image)
                  if (value && typeof value === 'object' && value.url) {
                    images.push({
                      id: `${collection.id}-${item.id}-${key}`,
                      name: key,
                      field: key,
                      url: value.url,
                      fileId: value.fileId || null,
                      alt: value.alt || null
                    });
                  }
                });
              }

              return {
                id: item.id,
                name: itemName,
                lastUpdated: item.lastUpdated,
                slug: item.fieldData?.slug || null,
                images: images,
                fieldData: item.fieldData || {}
              };
            }),
          };
        } catch (itemError) {
          console.error(`❌ Error fetching items for Collection ID: ${collection.id}`, itemError);
          return { id: collection.id, name: collectionName, items: [] };
        }
      })
    );

    res.status(200).json(collections);
  } catch (error) {
    console.error('❌ Error fetching Webflow collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
}