export interface WebflowAsset {
    id: string;
    name?: string; // Making name optional with '?'
    url: string;
    createdOn: string;
    fileSize?: number;
    width?: number;
    height?: number;
    fileType?: string;
  }