// Webflow extension entry point (bundle.js)
(function() {
  // State management for the application
  const state = {
    currentView: 'home', // 'home', 'assets-browser', 'resize', 'crop'
    selectedAsset: null,
    assets: [],
    filteredAssets: [],
    isLoading: false,
    error: null,
    searchTerm: '',
    filter: 'images', // 'all' or 'images'
    currentPage: 1,
    itemsPerPage: 12,
    totalPages: 1,
    resizeMode: null, // 'specific-assets'
    cropMode: null, // 'specific-assets'
    webflowToken: null,
    searchDebounceTimer: null,
  };

  // Main initialization function
  function initWebflowExtension() {
    const root = document.getElementById('root');
    if (!root) {
      console.error('Root element not found');
      return;
    }
    
    // Apply global styles
    applyGlobalStyles();
    
    // Initial render
    renderApp(root);
    
    // Check for Webflow token
    fetchWebflowToken()
      .then(token => {
        state.webflowToken = token;
        console.log('Webflow token retrieved successfully');
      })
      .catch(error => {
        console.error('Failed to retrieve Webflow token:', error);
        state.error = 'Failed to authenticate with Webflow. Please check your credentials.';
        renderApp(root);
      });
    
    console.log('Webflow extension initialized successfully');
  }
  
  // Apply global styles to the document
  function applyGlobalStyles() {
    if (document.getElementById('webflow-extension-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'webflow-extension-styles';
    style.textContent = `
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        margin: 0;
        padding: 0;
      }
      
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }
      
      .flex {
        display: flex;
      }
      
      .flex-col {
        flex-direction: column;
      }
      
      .items-center {
        align-items: center;
      }
      
      .justify-center {
        justify-content: center;
      }
      
      .justify-between {
        justify-content: space-between;
      }
      
      .min-h-screen {
        min-height: 100vh;
      }
      
      .text-center {
        text-align: center;
      }
      
      .grid {
        display: grid;
      }
      
      .grid-cols-2 {
        grid-template-columns: repeat(2, 1fr);
      }
      
      .grid-cols-3 {
        grid-template-columns: repeat(3, 1fr);
      }
      
      .grid-cols-4 {
        grid-template-columns: repeat(4, 1fr);
      }
      
      @media (max-width: 768px) {
        .grid-cols-2, .grid-cols-3, .grid-cols-4 {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      
      @media (max-width: 480px) {
        .grid-cols-2, .grid-cols-3, .grid-cols-4 {
          grid-template-columns: 1fr;
        }
      }
      
      .gap-4 {
        gap: 1rem;
      }
      
      .gap-8 {
        gap: 2rem;
      }
      
      .mb-2 {
        margin-bottom: 0.5rem;
      }
      
      .mb-4 {
        margin-bottom: 1rem;
      }
      
      .mb-8 {
        margin-bottom: 2rem;
      }
      
      .mt-2 {
        margin-top: 0.5rem;
      }
      
      .mt-4 {
        margin-top: 1rem;
      }
      
      .mt-6 {
        margin-top: 1.5rem;
      }
      
      .ml-2 {
        margin-left: 0.5rem;
      }
      
      .mx-auto {
        margin-left: auto;
        margin-right: auto;
      }
      
      .p-2 {
        padding: 0.5rem;
      }
      
      .p-4 {
        padding: 1rem;
      }
      
      .p-6 {
        padding: 1.5rem;
      }
      
      .py-2 {
        padding-top: 0.5rem;
        padding-bottom: 0.5rem;
      }
      
      .py-4 {
        padding-top: 1rem;
        padding-bottom: 1rem;
      }
      
      .py-6 {
        padding-top: 1.5rem;
        padding-bottom: 1.5rem;
      }
      
      .py-10 {
        padding-top: 2.5rem;
        padding-bottom: 2.5rem;
      }
      
      .py-12 {
        padding-top: 3rem;
        padding-bottom: 3rem;
      }
      
      .px-2 {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
      }
      
      .px-4 {
        padding-left: 1rem;
        padding-right: 1rem;
      }
      
      .text-xs {
        font-size: 0.75rem;
      }
      
      .text-sm {
        font-size: 0.875rem;
      }
      
      .text-base {
        font-size: 1rem;
      }
      
      .text-lg {
        font-size: 1.125rem;
      }
      
      .text-xl {
        font-size: 1.25rem;
      }
      
      .text-2xl {
        font-size: 1.5rem;
      }
      
      .text-4xl {
        font-size: 2.25rem;
      }
      
      .font-medium {
        font-weight: 500;
      }
      
      .font-semibold {
        font-weight: 600;
      }
      
      .font-bold {
        font-weight: 700;
      }
      
      .text-gray-400 {
        color: #9ca3af;
      }
      
      .text-gray-500 {
        color: #6b7280;
      }
      
      .text-gray-600 {
        color: #4b5563;
      }
      
      .text-gray-700 {
        color: #374151;
      }
      
      .text-gray-900 {
        color: #111827;
      }
      
      .text-blue-500 {
        color: #3b82f6;
      }
      
      .text-blue-600 {
        color: #2563eb;
      }
      
      .text-red-700 {
        color: #b91c1c;
      }
      
      .bg-white {
        background-color: white;
      }
      
      .bg-gray-50 {
        background-color: #f9fafb;
      }
      
      .bg-gray-100 {
        background-color: #f3f4f6;
      }
      
      .bg-blue-100 {
        background-color: #dbeafe;
      }
      
      .bg-blue-500 {
        background-color: #3b82f6;
      }
      
      .bg-blue-600 {
        background-color: #2563eb;
      }
      
      .bg-green-100 {
        background-color: #d1fae5;
      }
      
      .bg-red-50 {
        background-color: #fef2f2;
      }
      
      .border {
        border: 1px solid #e5e7eb;
      }
      
      .border-t {
        border-top: 1px solid #e5e7eb;
      }
      
      .border-b {
        border-bottom: 1px solid #e5e7eb;
      }
      
      .border-blue-400 {
        border-color: #60a5fa;
      }
      
      .border-blue-500 {
        border-color: #3b82f6;
      }
      
      .rounded-md {
        border-radius: 0.375rem;
      }
      
      .rounded-full {
        border-radius: 9999px;
      }
      
      .shadow-md {
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      }
      
      .ring-2 {
        outline: 2px solid transparent;
        outline-offset: 2px;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
      }
      
      .ring-blue-500 {
        --tw-ring-color: #3b82f6;
      }
      
      .cursor-pointer {
        cursor: pointer;
      }
      
      .truncate {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .max-w-4xl {
        max-width: 56rem;
      }
      
      .max-w-7xl {
        max-width: 80rem;
      }
      
      .h-4 {
        height: 1rem;
      }
      
      .h-6 {
        height: 1.5rem;
      }
      
      .h-10 {
        height: 2.5rem;
      }
      
      .h-64 {
        height: 16rem;
      }
      
      .h-full {
        height: 100%;
      }
      
      .w-4 {
        width: 1rem;
      }
      
      .w-6 {
        width: 1.5rem;
      }
      
      .w-10 {
        width: 2.5rem;
      }
      
      .w-full {
        width: 100%;
      }
      
      .flex-1 {
        flex: 1 1 0%;
      }
      
      .flex-grow {
        flex-grow: 1;
      }
      
      .overflow-hidden {
        overflow: hidden;
      }
      
      .overflow-x-auto {
        overflow-x: auto;
      }
      
      .object-cover {
        object-fit: cover;
      }
      
      .space-x-2 > * + * {
        margin-left: 0.5rem;
      }
      
      .space-y-4 > * + * {
        margin-top: 1rem;
      }
      
      .whitespace-nowrap {
        white-space: nowrap;
      }
      
      .aspect-square {
        aspect-ratio: 1 / 1;
      }
      
      .transition-all {
        transition-property: all;
        transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
        transition-duration: 150ms;
      }
      
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border-width: 0;
      }
      
      /* Button styles */
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-weight: 500;
        padding: 0.5rem 1rem;
        border-radius: 0.375rem;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
      
      .button-primary {
        background-color: #2563eb;
        color: white;
        border: none;
      }
      
      .button-primary:hover:not(:disabled) {
        background-color: #1d4ed8;
      }
      
      .button-outline {
        background-color: white;
        color: #374151;
        border: 1px solid #d1d5db;
      }
      
      .button-outline:hover:not(:disabled) {
        background-color: #f9fafb;
      }
      
      .button-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
      }
      
      /* Input styles */
      .input {
        width: 100%;
        padding: 0.5rem;
        border-radius: 0.375rem;
        border: 1px solid #d1d5db;
        outline: none;
        transition: border-color 0.2s;
      }
      
      .input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }
      
      /* Animation */
      .animate-spin {
        animation: spin 1s linear infinite;
      }
      
      @keyframes spin {
        from {
          transform: rotate(0deg);
        }
        to {
          transform: rotate(360deg);
        }
      }
      
      /* Feature card styles */
      .feature-card {
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
      }
      
      .feature-card:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
      }
      
      .icon-container {
        width: 3rem;
        height: 3rem;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 1rem;
      }
      
      .blue-accent {
        background-color: #dbeafe;
      }
      
      .green-accent {
        background-color: #d1fae5;
      }
      
      .feature-card:hover .blue-accent {
        background-color: #bfdbfe;
      }
      
      .feature-card:hover .green-accent {
        background-color: #a7f3d0;
      }

      /* Popup notification styles */
      .popup-notification {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        background-color: rgba(0, 0, 0, 0.5);
        animation: fadeIn 0.3s ease;
      }
      
      .popup-content {
        background-color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
        width: 90%;
        max-width: 400px;
        overflow: hidden;
        animation: slideUp 0.3s ease;
      }
      
      .popup-header {
        padding: 1rem;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        align-items: center;
      }
      
      .popup-icon {
        width: 2rem;
        height: 2rem;
        border-radius: 9999px;
        display: flex;
        align-items: center;
        justify-content: center;
        margin-right: 0.75rem;
      }
      
      .popup-icon-success {
        background-color: #d1fae5;
        color: #047857;
      }
      
      .popup-icon-error {
        background-color: #fee2e2;
        color: #b91c1c;
      }
      
      .popup-title {
        font-size: 1.125rem;
        font-weight: 600;
        margin: 0;
        flex-grow: 1;
      }
      
      .popup-body {
        padding: 1rem;
      }
      
      .popup-message {
        font-size: 0.875rem;
        color: #4b5563;
        margin: 0;
      }
      
      .popup-footer {
        padding: 0.75rem;
        background-color: #f9fafb;
        display: flex;
        justify-content: flex-end;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Main app rendering function
  function renderApp(container) {
    // Clear the container
    container.innerHTML = '';
    
    // Create the app layout
    const app = document.createElement('div');
    app.className = 'min-h-screen flex flex-col';
    
    // Render the appropriate view
    renderHeader(app);
    
    switch (state.currentView) {
      case 'home':
        renderHomeView(app);
        break;
      case 'assets-browser':
        renderAssetsBrowserView(app);
        break;
      case 'resize':
        renderResizeView(app);
        break;
      case 'crop':
        renderCropView(app);
        break;
      default:
        renderHomeView(app);
    }
    
    renderFooter(app);
    
    // Append the app to the container
    container.appendChild(app);
  }
  
  // SVG Processing Functions for Webflow Extension
  // Check if a file is an SVG based on file name/extension
  function isSvgFile(filename) {
    return filename.toLowerCase().endsWith('.svg');
  }

  // Check if a file is an SVG based on its MIME type
  function isSvgType(file) {
    return file && file.type === 'image/svg+xml';
  }

  // Detect if an asset is an SVG by URL or type
  function isSvgAsset(asset) {
    if (!asset) return false;
    
    // Check if the file type indicates SVG
    if (asset.fileType === 'image/svg+xml') {
      return true;
    }
    
    // Check if the URL ends with .svg
    if (asset.url && asset.url.toLowerCase().endsWith('.svg')) {
      return true;
    }
    
    return false;
  }

  // Process SVG file for resizing
  async function resizeSvgFile(svgFile, newWidth, newHeight, keepAspectRatio = true) {
    try {
      // Fetch the SVG content
      let svgText;
      
      if (typeof svgFile === 'string') {
        // If svgFile is a URL string, fetch it
        const response = await fetch(svgFile);
        svgText = await response.text();
      } else if (svgFile instanceof File || svgFile instanceof Blob) {
        // If svgFile is a File or Blob object
        svgText = await readFileAsText(svgFile);
      } else {
        throw new Error('Invalid SVG source');
      }
      
      // Parse SVG as XML
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
      
      // Check for parsing errors
      const parserError = svgDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('SVG parsing error');
      }
      
      // Get the root SVG element
      const svgElement = svgDoc.documentElement;
      
      // Get original dimensions
      let originalWidth = svgElement.getAttribute('width');
      let originalHeight = svgElement.getAttribute('height');
      const viewBox = svgElement.getAttribute('viewBox');
      
      // Extract dimensions from viewBox if width/height aren't set
      if ((!originalWidth || !originalHeight) && viewBox) {
        const viewBoxParts = viewBox.split(' ');
        if (viewBoxParts.length === 4) {
          if (!originalWidth) originalWidth = viewBoxParts[2];
          if (!originalHeight) originalHeight = viewBoxParts[3];
        }
      }
      
      // Parse dimensions to numbers, assuming px if no unit is specified
      originalWidth = parseFloat(originalWidth) || 100;
      originalHeight = parseFloat(originalHeight) || 100;
      
      // Calculate new dimensions while respecting aspect ratio if needed
      if (keepAspectRatio) {
        const aspectRatio = originalWidth / originalHeight;
        
        if (newWidth && !newHeight) {
          newHeight = Math.round(newWidth / aspectRatio);
        } else if (!newWidth && newHeight) {
          newWidth = Math.round(newHeight * aspectRatio);
        } else if (!newWidth && !newHeight) {
          // If neither dimension is provided, keep original
          newWidth = originalWidth;
          newHeight = originalHeight;
        }
      }
      
      // Set new dimensions
      svgElement.setAttribute('width', newWidth);
      svgElement.setAttribute('height', newHeight);
      
      // Ensure viewBox exists to maintain proper scaling
      if (!viewBox) {
        svgElement.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
      }
      
      // Serialize back to string
      const serializer = new XMLSerializer();
      const modifiedSvgText = serializer.serializeToString(svgDoc);
      
      // Create new file with SVG MIME type
      const filename = (typeof svgFile === 'string') 
        ? svgFile.split('/').pop() 
        : (svgFile.name || 'resized.svg');
        
      return new File([modifiedSvgText], filename, { type: 'image/svg+xml' });
    } catch (error) {
      console.error('Error processing SVG:', error);
      throw error;
    }
  }

  // Crop an SVG file
  async function cropSvgFile(svgFile, cropX, cropY, cropWidth, cropHeight) {
    try {
      // Fetch the SVG content
      let svgText;
      
      if (typeof svgFile === 'string') {
        // If svgFile is a URL string, fetch it
        const response = await fetch(svgFile);
        svgText = await response.text();
      } else if (svgFile instanceof File || svgFile instanceof Blob) {
        // If svgFile is a File or Blob object
        svgText = await readFileAsText(svgFile);
      } else {
        throw new Error('Invalid SVG source');
      }
      
      // Parse SVG as XML
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
      
      // Check for parsing errors
      const parserError = svgDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('SVG parsing error');
      }
      
      // Get the root SVG element
      const svgElement = svgDoc.documentElement;
      
      // Get original dimensions
      let originalWidth = svgElement.getAttribute('width');
      let originalHeight = svgElement.getAttribute('height');
      let viewBox = svgElement.getAttribute('viewBox');
      
      // Extract dimensions from viewBox if width/height aren't set
      if ((!originalWidth || !originalHeight) && viewBox) {
        const viewBoxParts = viewBox.split(' ');
        if (viewBoxParts.length === 4) {
          if (!originalWidth) originalWidth = viewBoxParts[2];
          if (!originalHeight) originalHeight = viewBoxParts[3];
        }
      }
      
      // Parse dimensions to numbers, assuming px if no unit is specified
      originalWidth = parseFloat(originalWidth) || 100;
      originalHeight = parseFloat(originalHeight) || 100;
      
      // Create a new viewBox that represents the cropped area
      // The viewBox format is: min-x min-y width height
      let viewBoxMinX = 0;
      let viewBoxMinY = 0;
      
      if (viewBox) {
        const viewBoxParts = viewBox.split(' ');
        if (viewBoxParts.length === 4) {
          viewBoxMinX = parseFloat(viewBoxParts[0]) || 0;
          viewBoxMinY = parseFloat(viewBoxParts[1]) || 0;
        }
      }
      
      // Calculate the new viewBox values based on crop parameters
      const newViewBoxMinX = viewBoxMinX + (cropX / 100) * originalWidth;
      const newViewBoxMinY = viewBoxMinY + (cropY / 100) * originalHeight;
      const newViewBoxWidth = (cropWidth / 100) * originalWidth;
      const newViewBoxHeight = (cropHeight / 100) * originalHeight;
      
      // Update the viewBox to crop the SVG
      svgElement.setAttribute('viewBox', `${newViewBoxMinX} ${newViewBoxMinY} ${newViewBoxWidth} ${newViewBoxHeight}`);
      
      // Set the new width and height to match the crop dimensions
      svgElement.setAttribute('width', newViewBoxWidth);
      svgElement.setAttribute('height', newViewBoxHeight);
      
      // Serialize back to string
      const serializer = new XMLSerializer();
      const modifiedSvgText = serializer.serializeToString(svgDoc);
      
      // Create new file with SVG MIME type
      const filename = (typeof svgFile === 'string') 
        ? svgFile.split('/').pop() 
        : (svgFile.name || 'cropped.svg');
        
      return new File([modifiedSvgText], filename, { type: 'image/svg+xml' });
    } catch (error) {
      console.error('Error cropping SVG:', error);
      throw error;
    }
  }

  // Helper function to read a file as text
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }

  // Utility function to fetch SVG content from URL with CORS handling
  async function fetchSvgContent(url) {
    try {
      // Use proxy if needed
      const proxyUrl = url.startsWith('http') 
        ? `http://localhost:3001/api/proxy-image?url=${encodeURIComponent(url)}`
        : url;
        
      const response = await fetch(proxyUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch SVG: ${response.statusText}`);
      }
      
      const contentType = response.headers.get('content-type');
      
      // Ensure we're dealing with SVG content
      if (contentType && !contentType.includes('image/svg+xml') && !contentType.includes('text/xml') && !contentType.includes('text/plain')) {
        throw new Error('Fetched content is not an SVG');
      }
      
      return await response.text();
    } catch (error) {
      console.error('Error fetching SVG content:', error);
      throw error;
    }
  }

  // Render header component
  function renderHeader(container) {
    const header = document.createElement('header');
    header.className = 'bg-white border-b';
    
    header.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center">
          <div class="cursor-pointer" id="home-link">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
          </div>
          <span class="ml-2 text-xl font-semibold text-gray-900">Welcome back</span>
        </div>
      </div>
    `;
    
    container.appendChild(header);
    
    // Add event listener to home link
    // Add event listener to home link
    setTimeout(() => {
      const homeLink = document.getElementById('home-link');
      if (homeLink) {
        homeLink.addEventListener('click', () => {
          state.currentView = 'home';
          state.resizeMode = null;  // Reset resize mode
          state.cropMode = null;    // Reset crop mode
          renderApp(document.getElementById('root'));
        });
      }
    }, 0);
  }
  
  // Render home view
  function renderHomeView(container) {
    const main = document.createElement('main');
    main.className = 'flex-grow flex items-center justify-center bg-gray-50';
    
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 class="text-4xl font-bold text-center text-gray-900 mb-8">
          What would you like to do?
        </h1>
        <div class="grid grid-cols-2 gap-8 max-w-4xl mx-auto">
          <div class="feature-card" id="resize-card">
            <div class="icon-container blue-accent">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Resize</h3>
            <p class="text-gray-600 mb-4">Resize multiple images from your Webflow collections or specific assets while maintaining quality.</p>
            <button class="button button-primary" id="resize-button">Get Started</button>
          </div>
          
          <div class="feature-card" id="crop-card">
            <div class="icon-container green-accent">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
                <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
              </svg>
            </div>
            <h3 class="text-lg font-semibold mb-2">Crop</h3>
            <p class="text-gray-600 mb-4">Precisely crop specific images from your Webflow assets with our intuitive cropping tool.</p>
            <button class="button button-primary" id="crop-button">Get Started</button>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(main);
    
    // Add event listeners
    setTimeout(() => {
      document.getElementById('resize-button').addEventListener('click', () => {
        state.resizeMode = 'specific-assets';
        state.currentView = 'assets-browser';
        renderApp(document.getElementById('root'));
      });
      
      document.getElementById('crop-button').addEventListener('click', () => {
        state.cropMode = 'specific-assets';
        state.currentView = 'assets-browser';
        renderApp(document.getElementById('root'));
      });
    }, 0);
  }
  
  // Helper function to get a shortened filename (part after the last underscore)
  function getShortFilename(filename) {
    if (!filename) return 'Unnamed';
    
    // If there's an underscore, get the part after the last one
    if (filename.includes('_')) {
      const parts = filename.split('_');
      return parts[parts.length - 1];
    }
    
    // If no underscore, just return the filename or a shorter version if it's too long
    return filename.length > 25 ? filename.substring(0, 22) + '...' : filename;
  }

  // Render assets browser view
  function renderAssetsBrowserView(container) {
    const main = document.createElement('main');
    main.className = 'flex-grow bg-gray-50 py-6';
    
    // Title based on the mode - KEEP THIS PART
    const title = state.resizeMode ? 'Select an image to resize' : 'Select an image to crop';
    
    // REPLACE the main.innerHTML section with this updated version:
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4">
        <h1 class="text-2xl font-bold mb-4">${title}</h1>
        <div id="assets-browser-content" class="bg-white p-6 rounded-md shadow-md">
          ${state.isLoading ? `
            <div class="flex justify-center items-center h-64">
              <svg class="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          ` : state.error ? `
            <div class="text-center p-6 bg-red-50 text-red-700 rounded-md">
              <p>${state.error}</p>
              <button id="retry-button" class="button button-outline mt-4">Retry</button>
            </div>
          ` : `
            <div class="space-y-4">
              <div class="flex items-center gap-8">
                <div class="flex-1">
                  <input
                    type="text"
                    placeholder="Search assets..."
                    id="search-input"
                    class="input"
                    value="${state.searchTerm}"
                  />
                </div>
                <div class="flex gap-4">
                  <button
                    id="filter-all"
                    class="button ${state.filter === 'all' ? 'button-primary' : 'button-outline'} button-sm"
                  >
                    All Files
                  </button>
                  <button
                    id="filter-images"
                    class="button ${state.filter === 'images' ? 'button-primary' : 'button-outline'} button-sm"
                  >
                    Images
                  </button>
                </div>
              </div>
              
              ${state.filteredAssets.length === 0 ? `
                <div class="text-center py-10 text-gray-500">
                  ${state.searchTerm ? 'No assets match your search.' : 'No assets found.'}
                </div>
              ` : `
                <div class="grid grid-cols-4 gap-4" id="assets-grid">
                  ${getCurrentPageAssets().map(asset => `
                    <div 
                      class="asset-item border rounded-md overflow-hidden cursor-pointer transition-all hover:shadow-md hover:border-blue-400 ${state.selectedAsset?.id === asset.id ? 'ring-2 ring-blue-500 border-blue-500' : ''}"
                      data-asset-id="${asset.id}"
                    >
                      <div class="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
                        ${isImageAsset(asset) ? `
                          <img 
                            src="${getProxiedImageUrl(asset.url)}" 
                            alt="${asset.name || getFilenameFromUrl(asset.url)}" 
                            class="w-full h-full object-cover"
                            onerror="this.src='/file.svg';"
                          />
                        ` : `
                          <div class="text-gray-400 text-xs text-center p-4">
                            ${asset.fileType || 'Unknown file type'}
                          </div>
                        `}
                      </div>
                      <div class="p-2">
                        <div class="text-xs truncate" title="${asset.name || getFilenameFromUrl(asset.url)}">
                          ${getShortFilename(asset.name || getFilenameFromUrl(asset.url))}
                        </div>
                        <div class="text-xs text-gray-500">
                          ${asset.createdOn 
                            ? new Date(asset.createdOn).toLocaleDateString() 
                            : 'Unknown date'}
                        </div>
                      </div>
                    </div>
                  `).join('')}
                </div>
                <!-- Pagination Controls -->
                <div class="flex items-center justify-between border-t pt-4 mt-6 pb-2">
                    <div>
                      <div class="text-sm text-gray-500">
                        Showing ${Math.min(state.filteredAssets.length, (state.currentPage - 1) * state.itemsPerPage + 1)} - 
                        ${Math.min(state.filteredAssets.length, state.currentPage * state.itemsPerPage)} of 
                        ${state.filteredAssets.length} assets
                      </div>
                      
                      ${state.selectedAsset ? `
                        <div class="mt-2 text-sm text-gray-600">
                          Selected: <span class="font-medium">${getShortFilename(state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url))}</span>
                          ${state.selectedAsset.width && state.selectedAsset.height ? 
                            `(${state.selectedAsset.width} × ${state.selectedAsset.height}px)` : 
                            ''}
                        </div>
                      ` : ''}
                    </div>
                    
                    <div class="mt-4 flex items-center space-x-2">
                    <button 
                      id="prev-page"
                      class="button button-outline button-sm"
                      ${state.currentPage === 1 ? 'disabled' : ''}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                      </svg>
                      <span class="sr-only">Previous Page</span>
                    </button>
                    <div class="text-sm font-medium">
                      Page ${state.currentPage} of ${state.totalPages}
                    </div>
                    <button 
                      id="next-page"
                      class="button button-outline button-sm"
                      ${state.currentPage === state.totalPages ? 'disabled' : ''}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="9 18 15 12 9 6"></polyline>
                      </svg>
                      <span class="sr-only">Next Page</span>
                    </button>
                  </div>
                </div>
              `}
            </div>
          `}
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-between mt-6">
          <button id="back-button" class="button button-outline">Back</button>
          <button id="continue-button" class="button button-primary" ${!state.selectedAsset ? 'disabled' : ''}>
            Continue with selected image
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(main);
    
    // If assets have not been loaded yet, fetch them
    if (!state.isLoading && state.assets.length === 0 && !state.error) {
      fetchWebflowAssets();
    }
    
    // Add event listeners
    setTimeout(() => {
      // Modify the search input event handler
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        // Focus the search input if it had focus before re-rendering
        if (state.searchInputHadFocus) {
          searchInput.focus();
          // If there was a selection range, restore it
          if (state.searchSelectionStart !== undefined && state.searchSelectionEnd !== undefined) {
            searchInput.setSelectionRange(state.searchSelectionStart, state.searchSelectionEnd);
          }
          state.searchInputHadFocus = false;
        }
        
        searchInput.addEventListener('input', (e) => {
          state.searchTerm = e.target.value;
          
          // Use a debounce function to delay filter application
          clearTimeout(state.searchDebounceTimer);
          state.searchDebounceTimer = setTimeout(() => {
            // Save focus state before re-rendering
            state.searchInputHadFocus = (document.activeElement === searchInput);
            if (state.searchInputHadFocus) {
              state.searchSelectionStart = searchInput.selectionStart;
              state.searchSelectionEnd = searchInput.selectionEnd;
            }
            
            applyFiltersAndSearch();
            renderApp(document.getElementById('root'));
          }, 300); // 300ms debounce is usually a good balance
        });
      }
      
      // Filter buttons
      const filterAll = document.getElementById('filter-all');
      const filterImages = document.getElementById('filter-images');
      
      if (filterAll) {
        filterAll.addEventListener('click', () => {
          state.filter = 'all';
          applyFiltersAndSearch();
          renderApp(document.getElementById('root'));
        });
      }
      
      if (filterImages) {
        filterImages.addEventListener('click', () => {
          state.filter = 'images';
          applyFiltersAndSearch();
          renderApp(document.getElementById('root'));
        });
      }
      
      // Asset selection
      const assetItems = document.querySelectorAll('.asset-item');
      assetItems.forEach(item => {
        item.addEventListener('click', () => {
          const assetId = item.getAttribute('data-asset-id');
          const asset = state.filteredAssets.find(a => a.id === assetId);
          if (asset) {
            selectAsset(asset);
            renderApp(document.getElementById('root'));
          }
        });
      });
      
      // Pagination
      const prevPage = document.getElementById('prev-page');
      const nextPage = document.getElementById('next-page');
      
      if (prevPage) {
        prevPage.addEventListener('click', () => {
          if (state.currentPage > 1) {
            state.currentPage--;
            renderApp(document.getElementById('root'));
          }
        });
      }
      
      if (nextPage) {
        nextPage.addEventListener('click', () => {
          if (state.currentPage < state.totalPages) {
            state.currentPage++;
            renderApp(document.getElementById('root'));
          }
        });
      }
      
      // Navigation buttons
      const backButton = document.getElementById('back-button');
      const continueButton = document.getElementById('continue-button');
      
      if (backButton) {
        backButton.addEventListener('click', () => {
          state.currentView = 'home';
          state.resizeMode = null;
          state.cropMode = null;
          renderApp(document.getElementById('root'));
        });
      }
      
      if (continueButton) {
        continueButton.addEventListener('click', () => {
          if (state.selectedAsset) {
            if (state.resizeMode) {
              state.currentView = 'resize';
            } else if (state.cropMode) {
              state.currentView = 'crop';
            }
            renderApp(document.getElementById('root'));
          }
        });
      }
      
      // Retry button
      const retryButton = document.getElementById('retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          fetchWebflowAssets();
        });
      }
    }, 0);
  }
  
  // Render footer component
  function renderFooter(container) {
    const footer = document.createElement('footer');
    footer.className = 'bg-white border-t';
    
    const currentYear = new Date().getFullYear();
    
    footer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-4">
        <p class="text-center text-gray-600">
          © ${currentYear} Lil Big Things. All rights reserved.
        </p>
      </div>
    `;
    
    container.appendChild(footer);
  }
  
  // Render resize view
  function renderResizeView(container) {
    if (!state.selectedAsset) {
      // If no asset is selected, go back to assets browser
      state.currentView = 'assets-browser';
      renderApp(document.getElementById('root'));
      return;
    }
    
    const main = document.createElement('main');
    main.className = 'flex-grow bg-gray-50 py-6';
    
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4">
        <h1 class="text-2xl font-bold mb-4">Resize Image</h1>
        
        <div class="bg-white p-6 rounded-md shadow-md mb-6">
          <div class="flex flex-col md:flex-row gap-6">
            <!-- Image Preview -->
            <div class="flex-1">
              <h3 class="text-lg font-medium mb-2">Image Preview</h3>
              <div class="overflow-hidden bg-gray-0 max-w-md mx-auto" style="max-height: 400px;">
                <img 
                  src="${getProxiedImageUrl(state.selectedAsset.url)}" 
                  alt="${state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url)}" 
                  class="w-full object-contain"
                  style="max-height: 400px; width: auto;"
                  onerror="this.src='/file.svg';"
                />
              </div>
              <div class="text-sm text-gray-500 mt-2 text-center">
                Original dimensions: ${state.selectedAsset.width || '?'}px × ${state.selectedAsset.height || '?'}px
              </div>
            </div>
            
            <!-- Resize Options -->
            <div class="flex-1">
              <h3 class="text-lg font-medium mb-4">Resize Options</h3>
              
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Width (px)</label>
                  <input type="number" id="width-input" class="input" placeholder="Width in pixels" />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Height (px)</label>
                  <input type="number" id="height-input" class="input" placeholder="Height in pixels" />
                </div>
                
                <div class="flex items-center">
                  <input type="checkbox" id="maintain-aspect-ratio" class="mr-2" checked />
                  <label for="maintain-aspect-ratio" class="text-sm text-gray-700">Maintain aspect ratio</label>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">Quality</label>
                  <div class="flex items-center">
                    <input type="range" id="quality-slider" min="1" max="100" value="90" class="w-full" />
                    <span id="quality-value" class="ml-2 text-sm text-gray-700">90%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-between">
          <button id="back-to-assets" class="button button-outline mt-6">Back to image selection</button>
          <button id="resize-submit" class="button button-primary mt-6">
            Resize & Save to Webflow
          </button>
        </div>
      </div>
    `;
    
    container.appendChild(main);
    
    // Add event listeners
    setTimeout(() => {
      const widthInput = document.getElementById('width-input');
      const heightInput = document.getElementById('height-input');
      const maintainAspectRatio = document.getElementById('maintain-aspect-ratio');
      const qualitySlider = document.getElementById('quality-slider');
      const qualityValue = document.getElementById('quality-value');
      const backButton = document.getElementById('back-to-assets');
      const resizeButton = document.getElementById('resize-submit');
      
      // Set initial values if asset has dimensions
      if (state.selectedAsset.width && state.selectedAsset.height) {
        widthInput.value = state.selectedAsset.width;
        heightInput.value = state.selectedAsset.height;
      }
      
      // Update quality value display
      qualitySlider.addEventListener('input', () => {
        qualityValue.textContent = `${qualitySlider.value}%`;
      });
      
      // Maintain aspect ratio if checked
      if (state.selectedAsset.width && state.selectedAsset.height) {
        const aspectRatio = state.selectedAsset.width / state.selectedAsset.height;
        
        widthInput.addEventListener('input', () => {
          if (maintainAspectRatio.checked) {
            const newWidth = parseInt(widthInput.value) || 0;
            heightInput.value = Math.round(newWidth / aspectRatio);
          }
        });
        
        heightInput.addEventListener('input', () => {
          if (maintainAspectRatio.checked) {
            const newHeight = parseInt(heightInput.value) || 0;
            widthInput.value = Math.round(newHeight * aspectRatio);
          }
        });
      }
      
      // Back button
      backButton.addEventListener('click', () => {
        state.currentView = 'assets-browser';
        renderApp(document.getElementById('root'));
      });

      // Inside the resize button click handler in renderResizeView function:
      resizeButton.addEventListener('click', async () => {
        try {
          // Show loading state
          resizeButton.disabled = true;
          resizeButton.innerHTML = `Processing...`;
          
          // Get resize parameters
          const widthInput = document.getElementById('width-input');
          const heightInput = document.getElementById('height-input');
          const maintainAspectRatio = document.getElementById('maintain-aspect-ratio');
          const qualitySlider = document.getElementById('quality-slider');
          
          // Get dimensions and quality settings
          let width = widthInput && !isNaN(parseInt(widthInput.value)) ? 
            parseInt(widthInput.value) : state.selectedAsset.width || 800;
          
          let height = heightInput && !isNaN(parseInt(heightInput.value)) ? 
            parseInt(heightInput.value) : state.selectedAsset.height || 600;
          
          const quality = qualitySlider && !isNaN(parseInt(qualitySlider.value)) ? 
            parseInt(qualitySlider.value) : 90;
          
          const keepAspectRatio = maintainAspectRatio ? maintainAspectRatio.checked : true;
          
          console.log("Resize parameters:", { width, height, quality, keepAspectRatio });
          
          // Check if we have a valid image URL
          if (!state.selectedAsset || !state.selectedAsset.url) {
            throw new Error("No image selected or image URL not available");
          }
      
          // Check if file is SVG
          const isSvg = isSvgAsset(state.selectedAsset);
          let resizedFile;
      
          if (isSvg) {
            // SVG-specific processing path
            console.log("Processing SVG file");
            
            // Fetch the SVG from URL and resize it
            resizedFile = await resizeSvgFile(
              state.selectedAsset.url, 
              width, 
              height, 
              keepAspectRatio
            );
          } else {
            // Raster image processing
            console.log("Processing raster image");
            
            // Fetch the original image
            const imageUrl = state.selectedAsset.url;
            const response = await fetch(imageUrl);
            const blob = await response.blob();
            
            // Create an image element and load the blob
            const img = new Image();
            const imgLoaded = new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
            });
            img.src = URL.createObjectURL(blob);
            await imgLoaded;
            
            // Adjust dimensions if maintaining aspect ratio
            if (keepAspectRatio) {
              const imgRatio = img.width / img.height;
              if (widthInput && widthInput.value && !heightInput.value) {
                height = Math.round(width / imgRatio);
              } else if (heightInput && heightInput.value && !widthInput.value) {
                width = Math.round(height * imgRatio);
              } else {
                height = Math.round(width / imgRatio);
              }
            }
            
            // Create a canvas and resize the image
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            
            // Fill with white background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            
            // Draw the image with proper centering
            let drawWidth, drawHeight, offsetX = 0, offsetY = 0;
            
            if (keepAspectRatio) {
              const imgRatio = img.width / img.height;
              const canvasRatio = width / height;
              
              if (imgRatio > canvasRatio) {
                drawWidth = width;
                drawHeight = width / imgRatio;
                offsetY = (height - drawHeight) / 2;
              } else {
                drawHeight = height;
                drawWidth = height * imgRatio;
                offsetX = (width - drawWidth) / 2;
              }
            } else {
              drawWidth = width;
              drawHeight = height;
            }
            
            // Draw the image
            ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
            
            // Convert canvas to blob
            const resizedBlob = await new Promise((resolve, reject) => {
              canvas.toBlob(
                (blob) => blob ? resolve(blob) : reject(new Error("Failed to create blob")), 
                'image/jpeg', 
                quality / 100
              );
            });
            
            // Create a file from the blob with a shorter name
            const originalFilename = state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url);
            const fileExt = originalFilename.includes('.') 
              ? originalFilename.substring(originalFilename.lastIndexOf('.')+1)
              : 'jpg';
            
            // Use timestamp for uniqueness
            const timestamp = new Date().getTime();
            const randomStr = Math.random().toString(36).substring(2, 8);
            const resizedFilename = `resized_${timestamp}_${randomStr}.${fileExt}`;
            
            resizedFile = new File([resizedBlob], resizedFilename, { 
              type: isSvg ? 'image/svg+xml' : 'image/jpeg' 
            });
          }
          
          // Upload to Webflow
          console.log("Preparing to upload file:", resizedFile.name);
          const formData = new FormData();
          formData.append('file', resizedFile);
          
          const uploadResponse = await fetch('http://localhost:3001/api/update-webflow-image', {
            method: 'POST',
            body: formData
          });
          
          if (!uploadResponse.ok) {
            const errorData = await uploadResponse.json();
            throw new Error(`Failed to upload: ${errorData.message || 'Unknown error'}`);
          }
          
          const uploadResult = await uploadResponse.json();
          console.log("Upload successful:", uploadResult);
      
          // Update the selected asset with the new asset information
          if (uploadResult && uploadResult.imageUrl) {
            // Create a new asset object with the uploaded image URL
            state.selectedAsset = {
              ...state.selectedAsset,
              url: uploadResult.imageUrl,
              id: uploadResult.assetId,
              // Reset the filename in the asset to avoid it getting longer
              name: resizedFile.name
            };
          }
      
          showPopupNotification({
            type: 'success',
            title: 'Success!',
            message: 'NOTE: Reload the app and webflow site to see the resized image in assets!',
            onClose: () => {
              // Redirect back to assets browser after OK is clicked
              state.currentView = 'assets-browser';
              renderApp(document.getElementById('root'));
            }
          });
      
        } catch (error) {
          console.error('Error resizing and uploading image:', error);
          
          // Show error message as popup
          showPopupNotification({
            type: 'error',
            title: 'Error',
            message: `Failed to resize image: ${error.message}`,
          });
        } finally {
          // Reset button state
          resizeButton.disabled = false;
          resizeButton.innerHTML = 'Resize & Save to Webflow';
        }
      });
    }, 0);
  }

  // 4. Also add a function to clean up filenames when extracting from URLs
  function cleanupFilename(filename) {
    if (!filename) return 'unnamed';
    
    // Get just the filename without the path
    const parts = filename.split('/');
    let name = parts[parts.length - 1];
    
    // Remove query parameters
    name = name.split('?')[0];
    
    // If the name is still too long, truncate it
    const MAX_LENGTH = 50;
    if (name.length > MAX_LENGTH) {
      const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';
      const basename = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
      name = basename.substring(0, MAX_LENGTH - extension.length) + extension;
    }
    
    return name;
  }

  function showPopupNotification(options) {
    const { type = 'success', title, message, onClose } = options;
    
    // Remove any existing popups first
    const existingPopup = document.body.querySelector('.popup-notification');
    if (existingPopup) {
      document.body.removeChild(existingPopup);
    }
    
    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'popup-notification';
    
    // Determine icon based on type
    let iconSvg;
    if (type === 'success') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>`;
    } else {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>`;
    }
    
    // Create popup content
    popup.innerHTML = `
      <div class="popup-content">
        <div class="popup-header">
          <div class="popup-icon popup-icon-${type}">${iconSvg}</div>
          <h3 class="popup-title">${title}</h3>
        </div>
        <div class="popup-body">
          <p class="popup-message">${message}</p>
        </div>
        <div class="popup-footer">
          <button class="button button-primary popup-close-btn">OK</button>
        </div>
      </div>
    `;
    
    // Prevent background interaction
    popup.style.position = 'fixed';
    popup.style.top = '0';
    popup.style.left = '0';
    popup.style.width = '100%';
    popup.style.height = '100%';
    popup.style.backgroundColor = 'rgba(0,0,0,0.5)';
    popup.style.display = 'flex';
    popup.style.alignItems = 'center';
    popup.style.justifyContent = 'center';
    popup.style.zIndex = '9999';
    
    // Add to DOM
    document.body.appendChild(popup);
    
    // Add close handler
    const closeButton = popup.querySelector('.popup-close-btn');
    const closePopup = () => {
      document.body.removeChild(popup);
      if (typeof onClose === 'function') {
        onClose();
      }
    };
    
    closeButton.addEventListener('click', closePopup);
    
    // Return a function to close the popup programmatically
    return closePopup;
  }  
  
  // Render crop view
  // Replace the renderCropView function with this updated version
  // Update renderCropView to ensure the crop container is properly set up
  function renderCropView(container) {
    if (!state.selectedAsset) {
      // If no asset is selected, go back to assets browser
      state.currentView = 'assets-browser';
      renderApp(document.getElementById('root'));
      return;
    }
    
    // Add crop state to the application state if it doesn't exist
    if (!state.crop) {
      state.crop = {
        x: 25,
        y: 25,
        width: 50,
        height: 50
      };
    }
    
    // Ensure crop doesn't exceed image bounds to begin with
    if (state.crop.x + state.crop.width > 99.9) {
      state.crop.width = 99.9 - state.crop.x;
    }
    if (state.crop.y + state.crop.height > 99.9) {
      state.crop.height = 99.9 - state.crop.y;
    }

    const main = document.createElement('main');
    main.className = 'flex-grow bg-gray-50 py-6';
    
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4">
        <h1 class="text-2xl font-bold mb-4">Crop Image</h1>
        
        <div class="bg-white p-6 rounded-md shadow-md mb-6">
          <h3 class="text-lg font-medium mb-4">Drag the corners or edges to adjust the crop area.</h3>
          
          <!-- Crop Container -->
          <div class="mb-6 text-center">
            <div id="crop-container" style="position: relative; display: inline-block; margin: 0 auto; overflow: hidden;">
              <img 
                id="crop-image"
                src="${getProxiedImageUrl(state.selectedAsset.url)}" 
                alt="${state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url)}"
                style="max-height: 500px; max-width: 100%; display: block;"
                crossorigin="anonymous"
              />
              <div id="crop-overlay" style="position: absolute; top: ${state.crop.y}%; left: ${state.crop.x}%; width: ${state.crop.width}%; height: ${state.crop.height}%; border: 2px dashed #2563eb; background-color: rgba(59, 130, 246, 0.2); cursor: move; box-sizing: border-box;">
                <div data-handle="tl" style="position: absolute; width: 5px; height: 5px; background-color: white; border: 2px solid #2563eb; top: -6px; left: -6px; cursor: nwse-resize; z-index: 2;"></div>
                <div data-handle="tr" style="position: absolute; width: 5px; height: 5px; background-color: white; border: 2px solid #2563eb; top: -6px; right: -6px; cursor: nesw-resize; z-index: 2;"></div>
                <div data-handle="bl" style="position: absolute; width: 5px; height: 5px; background-color: white; border: 2px solid #2563eb; bottom: -6px; left: -6px; cursor: nesw-resize; z-index: 2;"></div>
                <div data-handle="br" style="position: absolute; width: 5px; height: 5px; background-color: white; border: 2px solid #2563eb; bottom: -6px; right: -6px; cursor: nwse-resize; z-index: 2;"></div>
                <div data-handle="t" style="position: absolute; width: 5px; height: 5px; background-color: white; border: 2px solid #2563eb; top: -6px; left: 50%; transform: translateX(-50%); cursor: ns-resize; z-index: 2;"></div>
                <div data-handle="r" style="position: absolute; width: 5px; height: 5px; background-color: white; border: 2px solid #2563eb; right: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; z-index: 2;"></div>
                <div data-handle="b" style="position: absolute; width: 5px; height: 5px; background-color: white; border: 2px solid #2563eb; bottom: -6px; left: 50%; transform: translateX(-50%); cursor: ns-resize; z-index: 2;"></div>
                <div data-handle="l" style="position: absolute; width: 5px; height: 5px; background-color: white; border: 2px solid #2563eb; left: -6px; top: 50%; transform: translateY(-50%); cursor: ew-resize; z-index: 2;"></div>
              </div>
            </div>
          </div>
          
          <!-- Crop Dimensions Display -->
          <div class="grid grid-cols-2 gap-4 mb-4 p-4 bg-gray-100 rounded-lg max-w-md mx-auto">
            <div class="text-sm">X: <span id="crop-x-value">0</span>px</div>
            <div class="text-sm">Y: <span id="crop-y-value">0</span>px</div>
            <div class="text-sm">Width: <span id="crop-width-value">0</span>px</div>
            <div class="text-sm">Height: <span id="crop-height-value">0</span>px</div>
            <div class="col-span-2 text-xs text-gray-500 mt-2">
              Note: 'X' is the distance from left edge and 'Y' is the distance from top edge.
            </div>
          </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-between">
          <button id="back-to-assets-crop" class="button button-outline mt-6">Back to image selection</button>
          <button id="crop-submit" class="button button-primary mt-6">
            Crop & Save to Webflow
          </button>
        </div>
        
        <!-- Preview Modal (Hidden by default) -->
        <div id="crop-preview-modal" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center" style="display: none;">
          <div class="bg-white rounded-lg max-w-3xl w-full mx-4 overflow-hidden">
            <div class="p-6">
              <h3 class="text-xl font-semibold mb-4">Cropped Image Preview</h3>
              
              <div id="crop-preview-success" class="p-3 bg-green-100 text-green-800 rounded-md text-sm mt-2 mb-4 hidden">
                Image successfully cropped and uploaded to Webflow assets!
              </div>
              
              <div class="mt-4">
                <img id="crop-preview-image" src="" alt="Cropped preview" class="max-h-[60vh] w-auto mx-auto" />
              </div>
              
              <div class="flex justify-end mt-6">
                <button id="crop-preview-close" class="button button-primary">
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(main);
    
    // Add event listeners after DOM is updated
    setTimeout(() => {
      initSimpleCropper();
      
      const backButton = document.getElementById('back-to-assets-crop');
      const cropButton = document.getElementById('crop-submit');
      const previewCloseButton = document.getElementById('crop-preview-close');
      
      // Back button
      if (backButton) {
        backButton.addEventListener('click', () => {
          state.currentView = 'assets-browser';
          renderApp(document.getElementById('root'));
        });
      }
      
      // Crop button
      if (cropButton) {
        cropButton.addEventListener('click', handleFinishCropping);
      }
      
      // Preview close button
      if (previewCloseButton) {
        previewCloseButton.addEventListener('click', () => {
          document.getElementById('crop-preview-modal').classList.add('hidden');
        });
      }
    }, 0);
  }
  
  // Improved crop functionality
  // Function to initialize ReactCrop
  function initSimpleCropper() {
    const imgElement = document.getElementById('crop-image');
    const cropOverlay = document.getElementById('crop-overlay');
    const cropContainer = document.getElementById('crop-container');
    
    if (!imgElement || !cropOverlay || !cropContainer) {
      console.error('Missing required crop elements');
      return;
    }
    
    // Initialize drag variables
    let isDragging = false;
    let activeHandle = null;
    let startX, startY, startLeft, startTop, startWidth, startHeight;
    
    // Wait for image to load
    imgElement.onload = function() {
      console.log("Image loaded with dimensions:", imgElement.offsetWidth, "x", imgElement.offsetHeight);
      
      // Measure the actual rendered image dimensions
      const imgRect = imgElement.getBoundingClientRect();
      
      // Set crop container dimensions to match image dimensions exactly
      cropContainer.style.width = `${imgRect.width}px`;
      cropContainer.style.height = `${imgRect.height}px`;
      
      // Ensure initial crop is within image bounds (important for right and bottom edges)
      if (state.crop.x + state.crop.width > 99.9) { // Using 99.9 instead of 100 to avoid rounding issues
        state.crop.width = 99.9 - state.crop.x;
      }
      if (state.crop.y + state.crop.height > 99.9) {
        state.crop.height = 99.9 - state.crop.y;
      }
      
      // Update the overlay
      updateCropOverlay();
      // Update values display
      updateCropValues();
      
      console.log("Crop initialized with:", state.crop);
    };
    
    // Handle mouse down on overlay and handles
    function onMouseDown(e) {
      e.preventDefault();
      
      const target = e.target;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = state.crop.x;
      startTop = state.crop.y;
      startWidth = state.crop.width;
      startHeight = state.crop.height;
      
      if (target.hasAttribute('data-handle')) {
        activeHandle = target.getAttribute('data-handle');
      } else if (target === cropOverlay) {
        activeHandle = 'move';
      } else {
        isDragging = false;
        return;
      }
      
      // Add document listeners to track mouse even outside the crop area
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    }
    
    // Handle mouse move for resizing and moving - with strict boundary enforcement
    function onMouseMove(e) {
      if (!isDragging) return;
      
      e.preventDefault();
      
      // Get image dimensions to calculate percentages correctly
      const imgRect = imgElement.getBoundingClientRect();
      
      // Calculate mouse movement as percentage of image dimensions
      const deltaXPercent = ((e.clientX - startX) / imgRect.width) * 100;
      const deltaYPercent = ((e.clientY - startY) / imgRect.height) * 100;
      
      // Create temporary values to check boundaries before applying
      let newX = state.crop.x;
      let newY = state.crop.y;
      let newWidth = state.crop.width;
      let newHeight = state.crop.height;
      
      // Apply movement based on the active handle
      switch (activeHandle) {
        case 'move':
          // Move the entire crop box
          newX = startLeft + deltaXPercent;
          newY = startTop + deltaYPercent;
          break;
        case 'tl': // Top-left
          newX = startLeft + deltaXPercent;
          newY = startTop + deltaYPercent;
          newWidth = startWidth - deltaXPercent;
          newHeight = startHeight - deltaYPercent;
          break;
        case 'tr': // Top-right
          newY = startTop + deltaYPercent;
          newWidth = startWidth + deltaXPercent;
          newHeight = startHeight - deltaYPercent;
          break;
        case 'bl': // Bottom-left
          newX = startLeft + deltaXPercent;
          newWidth = startWidth - deltaXPercent;
          newHeight = startHeight + deltaYPercent;
          break;
        case 'br': // Bottom-right
          newWidth = startWidth + deltaXPercent;
          newHeight = startHeight + deltaYPercent;
          break;
        case 't': // Top
          newY = startTop + deltaYPercent;
          newHeight = startHeight - deltaYPercent;
          break;
        case 'r': // Right
          newWidth = startWidth + deltaXPercent;
          break;
        case 'b': // Bottom
          newHeight = startHeight + deltaYPercent;
          break;
        case 'l': // Left
          newX = startLeft + deltaXPercent;
          newWidth = startWidth - deltaXPercent;
          break;
      }
      
      // Enforce minimum size (10% of image)
      const MIN_SIZE = 10;
      if (newWidth < MIN_SIZE) {
        if (activeHandle === 'tl' || activeHandle === 'bl' || activeHandle === 'l') {
          newX = state.crop.x + state.crop.width - MIN_SIZE;
        }
        newWidth = MIN_SIZE;
      }
      
      if (newHeight < MIN_SIZE) {
        if (activeHandle === 'tl' || activeHandle === 'tr' || activeHandle === 't') {
          newY = state.crop.y + state.crop.height - MIN_SIZE;
        }
        newHeight = MIN_SIZE;
      }
      
      // Enforce right/bottom boundaries with stricter limits
      const MAX_POSITION = 99.9; // Using 99.9% instead of 100% to avoid rounding issues
      
      if (newX + newWidth > MAX_POSITION) {
        if (activeHandle === 'tr' || activeHandle === 'br' || activeHandle === 'r') {
          newWidth = MAX_POSITION - newX;
        } else {
          newX = MAX_POSITION - newWidth;
        }
      }
      
      if (newY + newHeight > MAX_POSITION) {
        if (activeHandle === 'bl' || activeHandle === 'br' || activeHandle === 'b') {
          newHeight = MAX_POSITION - newY;
        } else {
          newY = MAX_POSITION - newHeight;
        }
      }
      
      // Enforce left/top boundaries
      if (newX < 0) {
        newX = 0;
        if (activeHandle === 'tl' || activeHandle === 'bl' || activeHandle === 'l') {
          newWidth = startLeft + startWidth;
        }
      }
      
      if (newY < 0) {
        newY = 0;
        if (activeHandle === 'tl' || activeHandle === 'tr' || activeHandle === 't') {
          newHeight = startTop + startHeight;
        }
      }
      
      // Apply the adjusted values
      state.crop.x = newX;
      state.crop.y = newY;
      state.crop.width = newWidth;
      state.crop.height = newHeight;
      
      // Update the crop overlay position and size
      updateCropOverlay();
      // Update the displayed pixel values
      updateCropValues();
    }
    
    // Handle mouse up to end dragging
    function onMouseUp() {
      isDragging = false;
      activeHandle = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
    
    // Update the crop overlay position and size
    function updateCropOverlay() {
      cropOverlay.style.top = `${state.crop.y}%`;
      cropOverlay.style.left = `${state.crop.x}%`;
      cropOverlay.style.width = `${state.crop.width}%`;
      cropOverlay.style.height = `${state.crop.height}%`;
    }
    
    // Attach event listeners
    cropOverlay.addEventListener('mousedown', onMouseDown);
    
    // Attach event listeners to handles
    const handles = cropOverlay.querySelectorAll('[data-handle]');
    handles.forEach(handle => {
      handle.addEventListener('mousedown', onMouseDown);
    });
  }  

  function updateCropValues() {
    const imgElement = document.getElementById('crop-image');
    if (!imgElement) return;
    
    // Calculate crop pixels
    const xPixels = Math.round((state.crop.x / 100) * imgElement.naturalWidth);
    const yPixels = Math.round((state.crop.y / 100) * imgElement.naturalHeight);
    const widthPixels = Math.round((state.crop.width / 100) * imgElement.naturalWidth);
    const heightPixels = Math.round((state.crop.height / 100) * imgElement.naturalHeight);
    
    // Update display
    document.getElementById('crop-x-value').textContent = xPixels;
    document.getElementById('crop-y-value').textContent = yPixels;
    document.getElementById('crop-width-value').textContent = widthPixels;
    document.getElementById('crop-height-value').textContent = heightPixels;
  }

  // Function to crop the image using canvas
  // Create cropped image using canvas
  async function cropImage() {
    const imgElement = document.getElementById('crop-image');
    if (!imgElement || !state.crop.width || !state.crop.height) {
      throw new Error('Invalid image reference or crop dimensions');
    }

    // Create canvas for cropping
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Calculate crop dimensions
    const cropX = Math.round((state.crop.x / 100) * imgElement.naturalWidth);
    const cropY = Math.round((state.crop.y / 100) * imgElement.naturalHeight);
    const cropWidth = Math.round((state.crop.width / 100) * imgElement.naturalWidth);
    const cropHeight = Math.round((state.crop.height / 100) * imgElement.naturalHeight);
    
    // Set canvas size
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    
    // Create a new image with proper CORS settings
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Fill with white background
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, cropWidth, cropHeight);
          
          // Draw the cropped portion
          ctx.drawImage(
            img,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
          );
          
          // Get data URL
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          resolve(dataUrl);
        } catch (error) {
          console.error('Canvas drawing error:', error);
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image for cropping'));
      };
      
      // Use proxied URL to avoid CORS issues
      img.src = getProxiedImageUrl(state.selectedAsset.url);
    });
  }

  // Convert data URL to Blob
  function dataURLtoBlob(dataURL) {
    const parts = dataURL.split(';base64,');
    const contentType = parts[0].split(':')[1];
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);
    
    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }
    
    return new Blob([uInt8Array], { type: contentType });
  }

  async function uploadToWebflow(blob) {
    // Create a shorter filename by using a timestamp + original extension
    const originalFilename = state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url);
    const fileExt = originalFilename.includes('.') 
      ? originalFilename.substring(originalFilename.lastIndexOf('.') + 1)
      : 'jpg';
    
    // Use a timestamp + random string to ensure uniqueness
    const timestamp = new Date().getTime();
    const randomStr = Math.random().toString(36).substring(2, 8); // 6 character random string
    const newFilename = `img_${timestamp}_${randomStr}.${fileExt}`;
    
    // Create File object from Blob
    const processedFile = new File([blob], newFilename, { type: 'image/jpeg' });
    
    // Create FormData for upload
    const formData = new FormData();
    formData.append('file', processedFile);
    
    // Send to the server
    const uploadResponse = await fetch('http://localhost:3001/api/update-webflow-image', {
      method: 'POST',
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(`Failed to upload: ${errorData.message || 'Unknown error'}`);
    }
    
    const uploadResult = await uploadResponse.json();
    console.log('Upload successful:', uploadResult);
    
    return uploadResult;
  }  

  // Update the handleFinishCropping function to use the correct dimensions
  // Handle finish cropping button
  async function handleFinishCropping() {
    try {
      const cropButton = document.getElementById('crop-submit');
      if (!cropButton) return;
      
      // Show loading state
      cropButton.disabled = true;
      cropButton.innerHTML = `Processing...`;
      
      // Hide success message initially
      const successMessage = document.getElementById('crop-preview-success');
      if (successMessage) {
        successMessage.classList.add('hidden');
      }
      
      // Check if file is SVG
      const isSvg = isSvgAsset(state.selectedAsset);
      let croppedFile;
      let croppedDataUrl;
  
      if (isSvg) {
        // SVG-specific processing path
        console.log("Cropping SVG file");
        
        const cropX = state.crop.x;
        const cropY = state.crop.y;
        const cropWidth = state.crop.width;
        const cropHeight = state.crop.height;
        
        // Crop the SVG
        croppedFile = await cropSvgFile(
          state.selectedAsset.url, 
          cropX, 
          cropY, 
          cropWidth, 
          cropHeight
        );
        
        // For preview display, create a data URL from the SVG content
        const reader = new FileReader();
        const dataUrlPromise = new Promise((resolve, reject) => {
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = reject;
        });
        reader.readAsDataURL(croppedFile);
        croppedDataUrl = await dataUrlPromise;
      } else {
        // Raster image processing
        console.log("Cropping raster image");
        
        // Create cropped image using canvas
        croppedDataUrl = await cropImage();
        
        if (!croppedDataUrl) {
          throw new Error('Failed to create cropped image');
        }
        
        // Convert to blob
        const blob = dataURLtoBlob(croppedDataUrl);
        
        // Create a shorter filename using timestamp
        const originalFilename = state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url);
        const fileExt = originalFilename.includes('.') 
          ? originalFilename.substring(originalFilename.lastIndexOf('.')+1)
          : 'jpg';
        
        // Use timestamp for uniqueness
        const timestamp = new Date().getTime();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const croppedFilename = `cropped_${timestamp}_${randomStr}.${fileExt}`;
        
        // Create File object
        croppedFile = new File([blob], croppedFilename, { 
          type: isSvg ? 'image/svg+xml' : 'image/jpeg' 
        });
      }
      
      // Upload to Webflow (common code for both SVG and raster)
      const formData = new FormData();
      formData.append('file', croppedFile);
      
      const uploadResponse = await fetch('http://localhost:3001/api/update-webflow-image', {
        method: 'POST',
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(`Upload failed: ${errorData.message || 'Unknown error'}`);
      }
      
      const uploadResult = await uploadResponse.json();
      console.log('Upload successful:', uploadResult);
      
      // Update the selected asset with the new asset information
      // This is important - replace the old asset with the new one
      if (uploadResult && uploadResult.imageUrl) {
        // Create a new asset object with the uploaded image URL
        state.selectedAsset = {
          ...state.selectedAsset,
          url: uploadResult.imageUrl,
          id: uploadResult.assetId,
          // Reset the filename in the asset to avoid it getting longer
          name: croppedFile.name
        };
      }
      
      // Show preview
      const previewModal = document.getElementById('crop-preview-modal');
      const previewImage = document.getElementById('crop-preview-image');
      
      if (previewModal && previewImage) {
        // Set image source
        previewImage.src = croppedDataUrl;
        
        // Show success message
        if (successMessage) {
          successMessage.classList.remove('hidden');
        }
        
        // Show preview modal
        previewModal.classList.remove('hidden');
      }
      
      // Show notification popup
      showPopupNotification({
        type: 'success',
        title: 'Success!',
        message: 'NOTE: Reload the app and webflow site to see the cropped image in assets!',
        onClose: () => {
          // Redirect back to assets browser after OK is clicked
          state.currentView = 'assets-browser';
          renderApp(document.getElementById('root'));
        }
      });
    } catch (error) {
      console.error('Error during crop operation:', error);
      
      // Show error message
      showPopupNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to crop image: ${error.message}`,
      });
    } finally {
      // Reset button state
      const cropButton = document.getElementById('crop-submit');
      if (cropButton) {
        cropButton.disabled = false;
        cropButton.innerHTML = 'Crop & Save to Webflow';
      }
    }
  }
  
  // Helper functions for assets browser
  function isImageAsset(asset) {
    if (!asset) return false;
    
    // Check the file type if available
    if (asset.fileType && asset.fileType.startsWith('image/')) {
      return true;
    }
    
    // Check the URL for common image extensions
    if (asset.url && asset.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
      return true;
    }
    
    return false;
  }
  
  // Function to get a proxied image URL that supports CORS
  function getProxiedImageUrl(originalUrl) {
    if (!originalUrl) return '/file.svg';
    
    // Use a proxy endpoint to avoid CORS issues
    const encodedUrl = encodeURIComponent(originalUrl);
    return `http://localhost:3001/api/proxy-image?url=${encodedUrl}`;
  }
  
  function getFilenameFromUrl(url) {
    if (!url) return 'Unnamed asset';
    
    // Extract the filename from the URL
    const urlParts = url.split('/');
    let filename = urlParts[urlParts.length - 1];
    
    // Remove any query parameters
    filename = filename.split('?')[0];
    
    // URL decode the filename
    try {
      filename = decodeURIComponent(filename);
    } catch (e) {
      // If decoding fails, use the encoded version
    }
    
    return cleanupFilename(filename);
  }
  
  function getCurrentPageAssets() {
    return state.filteredAssets.slice(
      (state.currentPage - 1) * state.itemsPerPage,
      state.currentPage * state.itemsPerPage
    );
  }
  
  function selectAsset(asset) {
    // Ensure the asset has dimensions
    if (!asset.width || !asset.height) {
      // Preload dimensions if not available
      preloadImageDimensions(asset)
        .then(assetWithDimensions => {
          state.selectedAsset = assetWithDimensions;
          renderApp(document.getElementById('root'));
        })
        .catch(error => {
          console.error('Failed to load image dimensions:', error);
          state.selectedAsset = asset;
          renderApp(document.getElementById('root'));
        });
    } else {
      state.selectedAsset = asset;
    }
  }
  
  function preloadImageDimensions(asset) {
    return new Promise((resolve, reject) => {
      // If dimensions already exist, return immediately
      if (asset.width && asset.height) {
        resolve(asset);
        return;
      }
      
      // Create a proxied URL to avoid CORS issues
      const encodedUrl = encodeURIComponent(asset.url);
      const proxiedUrl = `http://localhost:3001/api/proxy-image?url=${encodedUrl}`;
      
      // Load the image to get its dimensions
      const img = new Image();
      img.onload = () => {
        // Return the asset with added dimensions
        resolve({
          ...asset,
          width: img.naturalWidth,
          height: img.naturalHeight
        });
      };
      img.onerror = () => {
        // If loading fails, just return the original asset
        reject(new Error('Failed to load image'));
      };
      img.src = proxiedUrl;
    });
  }
  
  function applyFiltersAndSearch() {
    if (!state.assets || state.assets.length === 0) {
      state.filteredAssets = [];
      state.totalPages = 1;
      return;
    }
    
    let result = [...state.assets];
    
    // Apply file type filter
    if (state.filter === 'images') {
      result = result.filter(asset => isImageAsset(asset));
    }
    
    // Apply search term
    if (state.searchTerm) {
      const term = state.searchTerm.toLowerCase();
      result = result.filter(asset => {
        // Use name if available, otherwise use filename from URL
        const name = asset.name || getFilenameFromUrl(asset.url);
        return name.toLowerCase().includes(term);
      });
    }
    
    // Sort by most recent first
    result.sort((a, b) => {
      const dateA = new Date(a.createdOn || 0).getTime();
      const dateB = new Date(b.createdOn || 0).getTime();
      return dateB - dateA;
    });
    
    state.filteredAssets = result;
    
    // Update total pages
    state.totalPages = Math.max(1, Math.ceil(result.length / state.itemsPerPage));
    
    // Reset to first page when filters change
    state.currentPage = 1;
  }
  
  // API functions
  async function fetchWebflowToken() {
    // Hardcoded token instead of fetching from API
    const WEBFLOW_API_TOKEN = 'd154393afda576c253cd161fdb04bc1fa750c6ec3cd82add662f2cf807a228ca';
    
    // Return the token directly
    return WEBFLOW_API_TOKEN;
  }
  
  async function fetchWebflowAssets() {
    state.isLoading = true;
    state.error = null;
    renderApp(document.getElementById('root'));
    
    try {
      // Specify the full URL to your Next.js API
      const response = await fetch('http://localhost:3001/api/webflow-assets');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch assets: ${response.statusText}`);
      }
      
      const data = await response.json();
      state.assets = data.assets || [];
      
      // Apply filters and search
      applyFiltersAndSearch();
    } catch (error) {
      console.error('Error fetching Webflow assets:', error);
      state.error = 'Failed to load assets. Please try again later.';
    } finally {
      state.isLoading = false;
      renderApp(document.getElementById('root'));
    }
  }
  
  async function calculateMD5(buffer) {
    // Use SubtleCrypto API if available (secure contexts)
    if (window.crypto && window.crypto.subtle) {
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } else {
      // Fallback for environments without SubtleCrypto
      // This is a very simple hash function and not a real MD5
      // In production, you should use a proper MD5 library
      let hash = 0;
      const view = new DataView(buffer);
      for (let i = 0; i < view.byteLength; i += 4) {
        hash = ((hash << 5) - hash + view.getUint32(i, true)) | 0;
      }
      return Math.abs(hash).toString(16);
    }
  }

  async function updateWebflowImage(imageFile, onProgress) {
    try {
      const WEBFLOW_SITE_ID = '67b55ebd54d85a2c52752f6c';
      const WEBFLOW_API_TOKEN = await fetchWebflowToken();
      
      // Calculate MD5 hash of the file
      const fileBuffer = await imageFile.arrayBuffer();
      const fileHash = await calculateMD5(fileBuffer);
      const fileName = imageFile.name || 'image.png';
      
      // STEP 1: Create asset metadata in Webflow
      const createAssetResponse = await fetch(
        `https://api.webflow.com/sites/${WEBFLOW_SITE_ID}/assets`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WEBFLOW_API_TOKEN}`,
            'accept-version': '1.0.0',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            fileName,
            fileHash
          })
        }
      );
      
      if (!createAssetResponse.ok) {
        throw new Error(`Failed to create asset: ${createAssetResponse.statusText}`);
      }
      
      const assetData = await createAssetResponse.json();
      
      // Extract upload details
      let uploadUrl, uploadDetails, asset, imageAssetId, imageUrl;
      
      if (assetData.asset) {
        // V2 API format
        uploadUrl = assetData.uploadUrl;
        uploadDetails = assetData.uploadDetails;
        asset = assetData.asset;
        imageAssetId = asset._id;
        imageUrl = asset.url;
      } else {
        // V1 API format
        uploadUrl = assetData.uploadUrl;
        uploadDetails = assetData.uploadDetails;
        imageAssetId = assetData.id;
        imageUrl = assetData.hostedUrl || assetData.assetUrl;
      }
      
      // STEP 2: Upload to S3
      const formData = new FormData();
      
      // Add all upload details to the form
      for (const [key, value] of Object.entries(uploadDetails)) {
        formData.append(key, value);
      }
      
      // Add the file as the last field
      formData.append('file', imageFile);
      
      // Upload to S3
      const s3UploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        body: formData
      });
      
      if (!s3UploadResponse.ok) {
        throw new Error(`Failed to upload to S3: ${s3UploadResponse.statusText}`);
      }
      
      return {
        success: true,
        message: 'Image successfully uploaded to Webflow assets',
        assetId: imageAssetId,
        imageUrl: imageUrl
      };
    } catch (error) {
      console.error('Error updating image:', error);
      throw error;
    }
  }
  
  // Initialize the extension when the DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebflowExtension);
  } else {
    initWebflowExtension();
  }
})();