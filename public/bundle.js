// Webflow extension entry point (bundle.js)
(function() {
  // API base URL - change this to match your production environment
  const API_BASE_URL = 'https://pixie-backend-bheg.onrender.com'; // Local development
  // const client_id = process.env.CLIENT_ID;
  // console.log('Client ID:', client_id); 

  // State management for the application
  const state = {
    currentView: 'home',
    selectedAsset: null,
    assets: [],
    filteredAssets: [],
    isLoading: false,
    error: null,
    searchTerm: '',
    filter: 'images',
    currentPage: 1,
    itemsPerPage: 12,
    totalPages: 1,
    resizeMode: null,
    cropMode: null,
    webflowToken: null,
    searchDebounceTimer: null,
    userInfo: null,
    isFilterOrSearchChange: false,
    needsAuthorization: false,
    currentSiteId: null,
    lazyLoadObserver: null,     // For IntersectionObserver
    loadedAssetIds: new Set(),  // To track loaded assets
    assetPlaceholders: {},
    currentSiteInfo: null,
    eventTracker: false
  };

  // PostHog initialization
  function initPostHog() {
    // Initialize PostHog with your project API key
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    
    posthog.init('phc_7E8lVibe3sjH18hwID2lTu7K3IJmCotiiQN7BBTp5mi', {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: false, // We'll manually capture events
      person_profiles: 'identified_only' // Only create profiles for identified users
    });
    
    // Add this to the window object for easy access
    window.posthogAnalytics = {
      // Track user authentication events
      trackAuth: function(eventName, properties = {}) {
        try {
          // Get user info to include with event
          const userEmail = localStorage.getItem('userEmail');
          const userId = localStorage.getItem('token');
          
          if (userId) {
            // Identify the user first if we have their ID
            posthog.identify(userId, {
              email: userEmail || 'unknown-email'
            });
            
            // Add user info to properties
            properties.userEmail = userEmail;
            
            // Capture the event
            posthog.capture(eventName, properties);
          } else {
            // For anonymous events
            posthog.capture(eventName, properties);
          }
        } catch (error) {
          console.error('Error tracking auth event:', error);
        }
      },
      
      // Track asset-related events (resize, crop, etc.)
      trackAssetAction: function(eventName, asset, properties = {}) {
        try {
          const userId = localStorage.getItem('token');
          
          // Prepare asset data
          const assetData = {
            assetId: asset?.id || 'unknown',
            assetName: asset?.name || getFilenameFromUrl(asset?.url) || 'unknown',
            assetType: asset?.fileType || 'unknown',
            assetDimensions: `${asset?.width || '?'}x${asset?.height || '?'}`
          };
          
          // Merge asset data with additional properties
          const eventProperties = {
            ...assetData,
            ...properties
          };
          
          // Identify user if possible
          if (userId) {
            posthog.identify(userId);
          }
          
          // Capture the event
          posthog.capture(eventName, eventProperties);
        } catch (error) {
          console.error('Error tracking asset event:', error);
        }
      }
    };
    
    console.log('PostHog initialized successfully');
  }

  // Improve the transparent placeholder with a better background color
  const TRANSPARENT_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlNmU2ZTYiLz48L3N2Zz4=';

  // Add this extra protection to the initLazyLoading function
  function initLazyLoading() {
    try {
      // Clean up existing observer if it exists
      if (state.lazyLoadObserver) {
        state.lazyLoadObserver.disconnect();
      }
      
      // Create new IntersectionObserver
      state.lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const assetItem = entry.target;
            const assetId = assetItem.getAttribute('data-asset-id');
            const imgElement = assetItem.querySelector('img');
            
            if (imgElement && assetId && !state.loadedAssetIds.has(assetId)) {
              // Get the asset data
              const asset = state.filteredAssets.find(a => a.id === assetId);
              if (asset) {
                // Load the actual image
                const actualSrc = getProxiedImageUrl(asset.url);
                
                // Create a new image object to preload
                const tempImg = new Image();
                tempImg.onload = () => {
                  // Once loaded, update the visible image
                  imgElement.src = actualSrc;
                  imgElement.classList.remove('loading');
                  imgElement.classList.remove('asset-image-placeholder');
                  imgElement.classList.add('asset-image-loaded');
                  
                  // Fade in effect
                  imgElement.animate([
                    { opacity: 0.4 },
                    { opacity: 1 }
                  ], {
                    duration: 300,
                    easing: 'ease-in'
                  });
                  
                  // Mark this asset as loaded
                  state.loadedAssetIds.add(assetId);
                };
                
                tempImg.onerror = () => {
                  // If loading fails, show fallback
                  imgElement.src = '/file.svg';
                  imgElement.classList.remove('loading');
                  imgElement.classList.remove('asset-image-placeholder');
                  imgElement.classList.add('asset-image-loaded');
                };
                
                // Start loading
                imgElement.classList.add('loading');
                tempImg.src = actualSrc;
              }
            }
            
            // Safely unobserve this element once it's processed
            try {
              observer.unobserve(assetItem);
            } catch (error) {
              console.error("Error unobserving item:", error);
            }
          }
        });
      }, {
        root: null,
        rootMargin: '200px',
        threshold: 0.1
      });
    } catch (error) {
      console.error("Error initializing lazy loading:", error);
      // Make sure we don't have a broken observer
      state.lazyLoadObserver = null;
    }
  }

  // Add a new function to verify that images are loading properly
  function verifyImageLoading() {
    // Check after a reasonable delay
    setTimeout(() => {
      const assetItems = document.querySelectorAll('.asset-item');
      const loadedImages = document.querySelectorAll('.asset-image-loaded');
      
      // If no images are loaded but we have asset items, force reload
      if (loadedImages.length === 0 && assetItems.length > 0) {
        console.log('No images are loaded, forcing reload of all visible assets');
        
        // Reset loaded assets tracking
        state.loadedAssetIds.clear();
        
        // Force immediate loading of all visible assets
        assetItems.forEach((item, index) => {
          const assetId = item.getAttribute('data-asset-id');
          const imgElement = item.querySelector('img');
          
          if (imgElement && assetId) {
            const asset = state.filteredAssets.find(a => a.id === assetId);
            if (asset) {
              setTimeout(() => {
                imgElement.src = getProxiedImageUrl(asset.url);
                imgElement.classList.remove('asset-image-placeholder');
                imgElement.classList.add('asset-image-loaded');
                state.loadedAssetIds.add(assetId);
              }, index * 20);
            }
          }
        });
      }
    }, 1200); // Check after 1.2 seconds
  }

  // Enhanced forceLoadInitialImages function to preload dimensions
  function forceLoadInitialImages() {
    // First, ensure we have a delay to let the DOM render completely
    setTimeout(() => {
      // Get all currently visible asset items
      const assetItems = document.querySelectorAll('.asset-item');
      
      if (!assetItems.length) {
        console.log('No asset items found, possibly on an empty page');
        return; // Exit gracefully if no items
      }
      
      // Make sure the observer exists before proceeding
      if (!state.lazyLoadObserver) {
        console.log('Lazy load observer not initialized, reinitializing');
        initLazyLoading();
      }
      
      // Use a more aggressive approach for initial page load
      let loadedCount = 0;
      
      assetItems.forEach((item, index) => {
        const assetId = item.getAttribute('data-asset-id');
        const imgElement = item.querySelector('img');
        const dimensionsElement = item.querySelector('.text-xs.text-gray-700');
        
        if (!assetId) return;
        
        // Find the asset in our filtered assets array
        const asset = state.filteredAssets.find(a => a.id === assetId);
        if (!asset) return;
        
        // Check if we need to load the image
        if (imgElement && !state.loadedAssetIds.has(assetId)) {
          // Short staggered delay to prevent browser throttling
          setTimeout(() => {
            const imageUrl = getProxiedImageUrl(asset.url);
            
            // Create a new image object for preloading
            const preloadImg = new Image();
            preloadImg.onload = () => {
              imgElement.src = imageUrl;
              imgElement.classList.remove('loading');
              imgElement.classList.remove('asset-image-placeholder');
              imgElement.classList.add('asset-image-loaded');
              
              // Mark this asset as loaded
              state.loadedAssetIds.add(assetId);
            };
            
            preloadImg.onerror = () => {
              // If loading fails, show fallback
              imgElement.src = '/file.svg';
              imgElement.classList.remove('loading');
              imgElement.classList.remove('asset-image-placeholder');
              imgElement.classList.add('asset-image-loaded');
            };
            
            // Start loading with loading class
            imgElement.classList.add('loading');
            preloadImg.src = imageUrl;
            
            loadedCount++;
          }, index * 30);
        }
        
        // NEW: Preload dimensions if they're missing
        if (dimensionsElement && (!asset.width || !asset.height)) {
          // Stagger dimension loading to avoid overwhelming the browser
          setTimeout(() => {
            preloadImageDimensions(asset)
              .then(updatedAsset => {
                // Update the asset in the state array to have the dimensions
                const assetIndex = state.filteredAssets.findIndex(a => a.id === assetId);
                if (assetIndex !== -1) {
                  state.filteredAssets[assetIndex] = updatedAsset;
                  
                  // Also update in the full assets array
                  const fullAssetIndex = state.assets.findIndex(a => a.id === assetId);
                  if (fullAssetIndex !== -1) {
                    state.assets[fullAssetIndex] = updatedAsset;
                  }
                  
                  // Update the dimension display in the DOM
                  dimensionsElement.textContent = `${updatedAsset.width || 'N/A'}px × ${updatedAsset.height || 'N/A'}px`;
                }
              })
              .catch(error => {
                console.error(`Failed to preload dimensions for asset ${assetId}:`, error);
              });
          }, index * 50 + 100); // Add a bit more delay for dimension loading after image loading
        }
        
        // Make sure the observer exists before observing
        if (state.lazyLoadObserver) {
          try {
            state.lazyLoadObserver.observe(item);
          } catch (error) {
            console.error("Error observing item:", error);
          }
        }
      });
    }, 150);
  }

  // Also update the renderAssetsBrowserView function to ensure proper loading
  // Find the setTimeout call at the end of the renderAssetsBrowserView function and replace with:
  setTimeout(() => {
    // Initialize lazy loading
    initLazyLoading();
    
    // Ensure immediate loading of initial images with adequate timing
    // This initial timeout ensures the DOM is fully rendered
    forceLoadInitialImages();
    
    // Also set up a backup loader that runs after a longer delay
    // This handles cases where the initial load might have failed
    setTimeout(() => {
      const loadedImages = document.querySelectorAll('.asset-image-loaded');
      if (loadedImages.length === 0) {
        console.log('No images loaded after initial attempt, forcing reload');
        // Clear the loaded assets set to force a fresh attempt
        state.loadedAssetIds.clear();
        forceLoadInitialImages();
      }
    }, 800);
    
    // Rest of your event listeners...
  }, 50); // Slightly longer timeout to ensure DOM is fully ready
  
  // Update the initWebflowExtension function to initialize PostHog
  function initWebflowExtension() {
    const root = document.getElementById('root');
    if (!root) {
      console.error('Root element not found');
      return;
    }
    
    // Apply global styles
    applyGlobalStyles();
    
    // Initialize PostHog for analytics
    initPostHog();
    
    // Set initial state
    state.currentView = 'assets-browser';
    
    // Try to get tokens from localStorage first
    const webflowToken = localStorage.getItem('webflowToken');
    const userToken = localStorage.getItem('token');
    
    if (webflowToken) {
      state.webflowToken = webflowToken;
      console.log('Loaded Webflow token from localStorage');
    }
    
    // Render the initial UI
    renderApp(root);
    
    // Check for existing Webflow connection
    checkExistingWebflowConnection()
      .then(isConnected => {
        if (isConnected) {
          console.log('Using existing Webflow connection');
          
          // Track app loaded with existing connection
          if (window.posthogAnalytics) {
            window.posthogAnalytics.trackAuth('indesigner_app_loaded', {
              with_connection: true,
              view: state.currentView
            });
          }
          
          // Fetch assets once we confirm we have a connection
          if (state.currentView === 'assets-browser') {
            fetchWebflowAssets();
          }
        } else {
          console.log('No existing Webflow connection found');
          // Set state to indicate we need authorization for this site
          state.needsAuthorization = true;
          
          // Track app loaded without connection
          if (window.posthogAnalytics) {
            window.posthogAnalytics.trackAuth('indesigner_app_loaded', {
              with_connection: false,
              auth_required: true
            });
          }
          
          // Re-render to show the authorization screen
          renderApp(root);
        }
      })
      .catch(error => {
        console.error('Error checking for existing Webflow connection:', error);
        
        // Track app load error
        if (window.posthogAnalytics) {
          window.posthogAnalytics.trackAuth('indesigner_app_load_error', {
            error: error.message || 'Connection check failed'
          });
        }
      });
      
    // Track page views when changing views
    // Add a listener for view changes by modifying the renderApp function
    const originalRenderApp = renderApp;
    renderApp = function(container) {
      // Track the page view if posthog is initialized
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAuth('indesigner_page_view', {
          view: state.currentView,
          has_selection: !!state.selectedAsset
        });
      }
      
      // Call the original function
      return originalRenderApp(container);
    };
  }

  // Helper function to make API calls with consistent headers and error handling
  async function callApi(endpoint, options = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Set default headers if not provided
    if (!options.headers) {
      options.headers = {
        'Content-Type': 'application/json'
      };
    }
    
    // Add auth token if available and not already set
    const token = localStorage.getItem('token');
    if (token) {
      options.headers['token'] = token;
      // options.headers['x-auth-token'] = token; // Include this for Pixie's API
    }
    
    try {
      const response = await fetch(url, options);
      
      // Handle specific status codes
      if (response.status === 401) {
        console.warn('Authentication failed with 401 status');
        // Clear token on authentication failure
        localStorage.removeItem('token');
        return { success: false, error: 'Authentication failed', status: 401 };
      }
      
      // Try to parse JSON response
      let data;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('Failed to parse JSON response:', jsonError);
        return { 
          success: false, 
          error: 'Invalid response format', 
          status: response.status 
        };
      }
      
      // Return success or failure with data
      return {
        success: response.ok,
        status: response.status,
        data,
        error: !response.ok ? (data.message || data.msg || 'API request failed') : null
      };
    } catch (error) {
      console.error(`API call to ${url} failed:`, error);
      return {
        success: false,
        error: error.message || 'Network request failed',
        status: 0
      };
    }
  }

  // Enhanced login function to handle site connection
  async function loginUser(email, password, siteId, webflowToken) {
    try {
      // First, perform the standard login
      const result = await callApi('/user/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      
      if (result.success && result.data.token) {
        // Store the user token
        localStorage.setItem('token', result.data.token);
        
        // If we have a site ID and webflow token, store the site connection
        if (siteId && webflowToken) {
          // Call the API to add this site to the user's record
          const siteResult = await callApi('/user/add-site-connection', {
            method: 'POST',
            body: JSON.stringify({ 
              siteId, 
              accessToken: webflowToken,
              siteName: 'Webflow Site' // You can get the actual name if available
            })
          });
          
          if (!siteResult.success) {
            console.error('Failed to add site connection:', siteResult.error);
            // Don't fail the login, but log the error
          }
        }
        
        return { success: true };
      }
      
      return { 
        success: false, 
        error: result.error || 'Login failed' 
      };
    } catch (error) {
      console.error('Login process error:', error);
      return { 
        success: false, 
        error: 'Unexpected error during login' 
      };
    }
  }

  // Enhanced signup function to handle site connection
  async function signupUser(username, email, password, siteId, webflowToken) {
    try {
      // First, perform the standard signup
      const result = await callApi('/user/signup', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      
      if (result.success && result.data.token) {
        // Store the user token
        localStorage.setItem('token', result.data.token);
        
        // If we have a site ID and webflow token, store the site connection
        if (siteId && webflowToken) {
          // Call the API to add this site to the user's record
          const siteResult = await callApi('/user/add-site-connection', {
            method: 'POST',
            body: JSON.stringify({ 
              siteId, 
              accessToken: webflowToken,
              siteName: 'Webflow Site' // You can get the actual name if available
            })
          });
          
          if (!siteResult.success) {
            console.error('Failed to add site connection:', siteResult.error);
            // Don't fail the signup, but log the error
          }
        }
        
        return { success: true };
      }
      
      return { 
        success: false, 
        error: result.error || 'Signup failed' 
      };
    } catch (error) {
      console.error('Signup process error:', error);
      return { 
        success: false, 
        error: 'Unexpected error during signup' 
      };
    }
  }
    
  // Update the showCompressionAuthPopup function to safely handle popup removal
  function showCompressionAuthPopup() {
    // Safely remove any existing popups first
    const existingPopup = document.querySelector('.auth-popup-overlay');
    if (existingPopup) {
      try {
        if (existingPopup.parentNode) {
          existingPopup.parentNode.removeChild(existingPopup);
        }
      } catch (error) {
        console.log('Error removing existing auth popup, may already be removed', error);
      }
    }

    // Check if user is already logged in
    const isLoggedIn = localStorage.getItem('token') !== null;

    // Create popup container
    const popup = document.createElement('div');
    popup.className = 'auth-popup-overlay';
    popup.style.position = 'fixed';
    popup.style.top = '0';
    popup.style.left = '0';
    popup.style.width = '100%';
    popup.style.height = '100%';
    popup.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    popup.style.display = 'flex';
    popup.style.alignItems = 'center';
    popup.style.justifyContent = 'center';
    popup.style.zIndex = '9999';

    // Create popup content - if logged in, show logout option
    if (isLoggedIn) {
      popup.innerHTML = `
        <div class="auth-popup-content" style="background-color: white; border: 2px solid black; border-radius: 10px; box-shadow: 4px 4px 0 0 black; width: 90%; max-width: 480px; padding: 2rem;">
          <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Pixie Account</h2>
          <p style="margin-bottom: 2rem;">You are currently logged in. What would you like to do?</p>
          
          <div style="margin-bottom: 1.5rem;">
            <button id="check-plan-button" class="button button-primary" style="width: 100%;">
              Check Plan Status
            </button>
          </div>
          
          <div style="margin-bottom: 1.5rem;">
            <button id="logout-button" class="button button-outline" style="width: 100%;">
              Logout
            </button>
          </div>
          
          <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
            <button id="close-auth-popup" class="button button-outline">Close</button>
          </div>
        </div>
      `;
    } else {
      popup.innerHTML = `
        <div class="auth-popup-content" style="background-color: white; border: 2px solid black; border-radius: 10px; box-shadow: 4px 4px 0 0 black; width: 90%; max-width: 480px; padding: 2rem;">
          <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Pixie Compression</h2>
          <p style="margin-bottom: 2rem;">In order to use compression, please sign up/log in with Pixie and choose a plan.</p>
          
          <div style="margin-bottom: 1.5rem;">
            <button id="login-button" class="button button-primary" style="width: 100%;">
              Log In
            </button>
          </div>
          
          <div style="text-align: center; margin-bottom: 1.5rem;">
            <span style="color: #333;">Don't have an account?</span> 
            <a href="#" id="signup-link" class="signup-link" style="color: #ffab69; text-decoration: underline; font-weight: 500; transition: text-decoration 0.2s;">Sign Up</a>
          </div>
          
          <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
            <button id="close-auth-popup" class="button button-outline">Close</button>
          </div>
        </div>
      `;
    }

    // Add to DOM
    document.body.appendChild(popup);

    // Add CSS for the hover effect
    const style = document.createElement('style');
    style.textContent = `
      .signup-link:hover {
        text-decoration: underline !important;
      }
    `;
    document.head.appendChild(style);

    // Add animation
    const popupContent = popup.querySelector('.auth-popup-content');
    popupContent.animate(
      [
        { opacity: 0, transform: 'translateY(-20px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 300,
        easing: 'ease-out'
      }
    );

    document.getElementById('close-auth-popup').addEventListener('click', () => {
      try {
        const popupToRemove = document.querySelector('.auth-popup-overlay');
        if (popupToRemove && popupToRemove.parentNode) {
          popupToRemove.parentNode.removeChild(popupToRemove);
        }
      } catch (error) {
        console.log('Error closing auth popup, it may already be removed', error);
      }
    });
     
    if (isLoggedIn) {
      // Event listener for checking plan
      document.getElementById('check-plan-button').addEventListener('click', () => {
        document.body.removeChild(popup);
        // Call the plan check function
        checkUserPlan().then(planResult => {
          if (planResult.success && planResult.hasPlan) {
            redirectToHomePage();
          } else {
            redirectToPricingPage();
          }
        }).catch(error => {
          console.error("Error checking plan:", error);
          showPopupNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to check your subscription status. Please try again.'
          });
        });
      });
      
      // Event listener for logout
      document.getElementById('logout-button').addEventListener('click', () => {
        document.body.removeChild(popup);
        logoutUser();
      });
    } else {
      document.getElementById('signup-link').addEventListener('click', (e) => {
        e.preventDefault();
        showSignupForm(popup);
      });

      document.getElementById('login-button').addEventListener('click', () => {
        showLoginForm(popup);
      });
    }
  }

  // Show error message function
  function showError(errorMessage) {
    // Check if error container already exists
    let errorContainer = document.querySelector('.auth-error-message');
    
    if (!errorContainer) {
      // Create error container
      errorContainer = document.createElement('div');
      errorContainer.className = 'auth-error-message';
      errorContainer.style.backgroundColor = '#fee2e2';
      errorContainer.style.color = '#b91c1c';
      errorContainer.style.padding = '0.75rem';
      errorContainer.style.borderRadius = '0.5rem';
      errorContainer.style.marginBottom = '1rem';
      errorContainer.style.marginTop = '1rem';
      
      // Insert after the first heading in the form
      const form = document.querySelector('#signup-form') || document.querySelector('#login-form');
      const heading = form?.previousElementSibling;
      
      if (heading && heading.nextSibling) {
        heading.parentNode.insertBefore(errorContainer, heading.nextSibling);
      } else {
        // Fallback - insert at the beginning of the popup content
        const popupContent = document.querySelector('.auth-popup-content');
        if (popupContent && popupContent.firstChild) {
          popupContent.insertBefore(errorContainer, popupContent.firstChild);
        }
      }
    }
    
    // Set error message
    errorContainer.textContent = errorMessage;
    
    // Add animation
    errorContainer.animate(
      [
        { opacity: 0, transform: 'translateY(-5px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 300,
        easing: 'ease-out'
      }
    );
  }

  // When checking user plan, include proper headers for Pixie's API
  async function checkUserPlan() {
    // Ensure we have a token
    const token = localStorage.getItem('token');
    if (!token) {
      return { success: false, error: 'No authentication token' };
    }
    
    try {
      // Call the API
      const response = await fetch(`${API_BASE_URL}/user/get-user-profile`, {
        method: 'GET',
        headers: {
          'token': token,
          // 'x-auth-token': token // Include this header as Pixie's API expects it
        }
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('token');
          return { success: false, error: 'Authentication failed', status: 401 };
        }
        
        const errorData = await response.json();
        return {
          success: false,
          error: errorData.message || 'Failed to get user profile',
          status: response.status
        };
      }
      
      const data = await response.json();
      
      if (data.success && data.user) {
        return {
          success: true,
          hasPlan: !!data.user.planQuota,
          userData: data.user
        };
      }
      
      return {
        success: false,
        error: 'Failed to get user profile data'
      };
    } catch (error) {
      console.error('Error checking user plan:', error);
      return {
        success: false,
        error: error.message || 'Failed to connect to server'
      };
    }
  }

  // Modify setupLoginForm to pass site info
  function setupLoginForm(container) {
    const form = container.querySelector('#login-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitButton = form.querySelector('#submit-login');
      submitButton.disabled = true;
      submitButton.textContent = 'Logging in...';
      
      // Get form values
      const email = form.querySelector('#email').value;
      const password = form.querySelector('#password').value;
      
      // Get current site ID and token if available
      const currentSiteId = await getCurrentWebflowSiteId();
      const webflowToken = localStorage.getItem('webflowToken');
      
      try {
        // Use the enhanced loginUser helper
        const result = await loginUser(email, password, currentSiteId, webflowToken);
        
        if (result.success) {
          // Check the user's plan after login
          const planResult = await checkUserPlan();
          
          // Close the popup
          const popup = document.querySelector('.auth-popup-overlay');
          if (popup) {
            document.body.removeChild(popup);
          }
          
          if (planResult.success && planResult.hasPlan) {
            // User has a plan, redirect to home page
            redirectToHomePage();
          } else {
            // User doesn't have a plan or check failed, redirect to pricing page
            redirectToPricingPage();
          }
        } else {
          // Show error message
          showError(result.error || 'Failed to log in. Please check your credentials.');
          
          // Re-enable submit button
          submitButton.disabled = false;
          submitButton.textContent = 'Log In';
        }
      } catch (error) {
        console.error('Login process error:', error);
        showError('An unexpected error occurred. Please try again later.');
        
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = 'Log In';
      }
    });
  }

  // Updated showLoginForm function
  function showLoginForm(container) {
    const authContent = container.querySelector('.auth-popup-content');
    
    // Set the HTML content
    authContent.innerHTML = `
      <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Log In to Pixie</h2>
      <p>Log in to your account to use our compression feature.</p>
      
      <form id="login-form" style="margin-top: 1.5rem;">
        <div style="margin-bottom: 1rem;">
          <label for="email" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email</label>
          <input type="email" id="email" name="email" class="input" required style="width: 90%;">
        </div>
        
        <div style="margin-bottom: 1.5rem;">
          <label for="password" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Password</label>
          <input type="password" id="password" name="password" class="input" required style="width: 90%;">
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <button type="submit" id="submit-login" class="button button-primary">
            Log In
          </button>
          <button type="button" id="back-to-auth-options" class="button button-outline">
            Back
          </button>
        </div>
      </form>
      
      <p style="margin-top: 1.5rem; text-align: center; font-size: 0.875rem;">
        Don't have an account? <a href="#" id="show-signup" style="color: #ffab69; text-decoration: underline; font-weight: 500;">Sign Up</a>
      </p>
    `;
    
    // Add basic event listeners
    document.getElementById('back-to-auth-options').addEventListener('click', () => {
      showCompressionAuthPopup();
    });
    
    document.getElementById('show-signup').addEventListener('click', (e) => {
      e.preventDefault();
      showSignupForm(container);
    });
    
    // Use the new setup function for form submission
    setupLoginForm(container);
  }

  // Update the redirectToHomePage function to include a logout button
  function redirectToHomePage() {
    const token = localStorage.getItem('token');
    
    // Construct URL with token and a sync parameter
    const homeUrl = `http://localhost:3000/pixie?token=${token}&sync=true`;
    
    // Show notification about redirection with logout button
    showPopupNotification({
      type: 'success',
      title: 'Start with Compression',
      message: 'You\'re all set to use the compression feature!',
      buttons: [
        {
          text: 'Start Compression',
          action: () => {
            // Open the home page
            window.open(homeUrl, '_blank');
            showReloadReminderNotification();
          }
        },
        {
          text: 'Logout',
          action: () => {
            logoutUser();
          },
          isSecondary: true
        },
        {
          text: 'Cancel',
          action: null,
          isSecondary: true
        }
      ],
      onClose: () => {
        // Close any existing popup
        const popup = document.querySelector('.auth-popup-overlay');
        if (popup) {
          document.body.removeChild(popup);
        }
      }
    });
  }

  // Modified redirectToPricingPage function to show reminder ONLY after clicking the button
  function redirectToPricingPage() {
    const token = localStorage.getItem('token');
    
    // Construct URL with token and a sync parameter
    const pricingUrl = `http://localhost:3000/pixie/pricing?token=${token}&sync=true`;
    
    // Show notification about redirection with reload instructions
    // BUT don't show the reload reminder yet
    showPopupNotification({
      type: 'info',
      title: 'Choose a Plan',
      message: 'You need to select a compression plan to continue.',
      buttons: [
        {
          text: 'Choose a Plan',
          action: () => {
            // Open the pricing page
            window.open(pricingUrl, '_blank');
            
            showReloadReminderNotification();
          }
        },
        {
          text: 'Logout',
          action: () => {
            logoutUser();
          },
          isSecondary: true
        },
        {
          text: 'Cancel',
          action: null,
          isSecondary: true
        }
      ],
      onClose: () => {
        // Close any existing popup
        const popup = document.querySelector('.auth-popup-overlay');
        if (popup && popup.parentNode) {
          try {
            popup.parentNode.removeChild(popup);
          } catch (error) {
            console.log('Error removing auth popup, it may already be removed', error);
          }
        }
      }
    });
  }

  // New function to show a smaller, persistent reminder in the corner
  function showReloadReminderNotification() {
    // Remove any existing reminder first
    const existingReminder = document.getElementById('reload-reminder');
    if (existingReminder && existingReminder.parentNode) {
      try {
        existingReminder.parentNode.removeChild(existingReminder);
      } catch (error) {
        console.log('Error removing existing reminder', error);
      }
    }
    
    // Create the reminder element
    const reminder = document.createElement('div');
    reminder.id = 'reload-reminder';
    reminder.style.position = 'fixed';
    reminder.style.bottom = '20px';
    reminder.style.right = '20px';
    reminder.style.backgroundColor = 'white';
    reminder.style.border = '2px solid black';
    reminder.style.borderRadius = '8px';
    reminder.style.boxShadow = '4px 4px 0 0 rgba(0, 0, 0, 0.8)';
    reminder.style.padding = '10px 15px';
    reminder.style.zIndex = '9990';
    reminder.style.maxWidth = '250px';
    reminder.style.fontSize = '14px';
    
    reminder.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 5px;">
        <div style="display: flex; align-items: center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
            <line x1="12" y1="8" x2="12" y2="12"></line>
          </svg>
          <strong style="color: #047857;">Reminder</strong>
        </div>
        <button id="close-reminder" style="background: none; border: none; font-size: 16px; line-height: 1; cursor: pointer; padding: 0; margin-left: 10px;">×</button>
      </div>
      <p style="margin: 0; color: #333;">--Complete dialog after the compression--</p>
    `;
    
    // Add to DOM
    document.body.appendChild(reminder);
    
    // Add animation
    reminder.animate(
      [
        { opacity: 0, transform: 'translateY(20px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 300,
        easing: 'ease-out'
      }
    );
    
    // Add event listener for close button
    document.getElementById('close-reminder').addEventListener('click', () => {
      if (reminder && reminder.parentNode) {
        try {
          document.body.removeChild(reminder);
        } catch (error) {
          console.log('Error removing reminder', error);
        }
      }
    });
    
    // Auto remove after 1 minute
    setTimeout(() => {
      if (reminder && reminder.parentNode) {
        try {
          // Fade out animation
          const fadeAnimation = reminder.animate(
            [
              { opacity: 1 },
              { opacity: 0 }
            ],
            {
              duration: 500,
              easing: 'ease-out'
            }
          );
          
          fadeAnimation.onfinish = () => {
            try {
              if (reminder.parentNode) {
                reminder.parentNode.removeChild(reminder);
              }
            } catch (error) {
              console.log('Error removing reminder after animation', error);
            }
          };
        } catch (error) {
          // Fallback if animation fails
          try {
            if (reminder.parentNode) {
              reminder.parentNode.removeChild(reminder);
            }
          } catch (innerError) {
            console.log('Error removing reminder', innerError);
          }
        }
      }
    }, 120000); // 120 seconds
  }

  // Modify setupSignupForm to pass site info
  function setupSignupForm(container) {
    const form = container.querySelector('#signup-form');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const submitButton = form.querySelector('#submit-signup');
      submitButton.disabled = true;
      submitButton.textContent = 'Signing up...';
      
      // Get form values
      const username = form.querySelector('#username').value;
      const email = form.querySelector('#email').value;
      const password = form.querySelector('#password').value;
      
      // Get current site ID and token if available
      const currentSiteId = await getCurrentWebflowSiteId();
      const webflowToken = localStorage.getItem('webflowToken');
      
      try {
        // Use the enhanced signup helper
        const result = await signupUser(username, email, password, currentSiteId, webflowToken);
        
        if (result.success) {
          // Close the popup
          const popup = document.querySelector('.auth-popup-overlay');
          if (popup) {
            document.body.removeChild(popup);
          }
          
          // For new users, always redirect to pricing page
          redirectToPricingPage();
        } else {
          // Show error message
          showError(result.error || 'Failed to sign up. Please try again.');
          
          // Re-enable submit button
          submitButton.disabled = false;
          submitButton.textContent = 'Sign Up';
        }
      } catch (error) {
        console.error('Signup process error:', error);
        showError('An unexpected error occurred. Please try again later.');
        
        // Re-enable submit button
        submitButton.disabled = false;
        submitButton.textContent = 'Sign Up';
      }
    });
  }

  // Updated showSignupForm function
  function showSignupForm(container) {
    const authContent = container.querySelector('.auth-popup-content');
    
    authContent.innerHTML = `
      <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Sign Up for Pixie</h2>
      <p>Create your account to use our compression feature.</p>
      
      <form id="signup-form" style="margin-top: 1.5rem;">
        <div style="margin-bottom: 1rem;">
          <label for="username" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Username</label>
          <input type="text" id="username" name="username" class="input" required style="width: 90%;">
        </div>
        
        <div style="margin-bottom: 1rem;">
          <label for="email" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email</label>
          <input type="email" id="email" name="email" class="input" required style="width: 90%;">
        </div>
        
        <div style="margin-bottom: 1.5rem;">
          <label for="password" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Password</label>
          <input type="password" id="password" name="password" class="input" required style="width: 90%;">
          <p style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280;">Password must be at least 6 characters long</p>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <button type="submit" id="submit-signup" class="button button-primary">
            Sign Up
          </button>
          <button type="button" id="back-to-auth-options" class="button button-outline">
            Back
          </button>
        </div>
      </form>
      
      <p style="margin-top: 1.5rem; text-align: center; font-size: 0.875rem;">
        Already have an account? <a href="#" id="show-login" style="color: #ffab69; text-decoration: underline; font-weight: 500;">Log In</a>
      </p>
    `;
    
    // Add event listeners
    document.getElementById('back-to-auth-options').addEventListener('click', () => {
      showCompressionAuthPopup();
    });
    
    document.getElementById('show-login').addEventListener('click', (e) => {
      e.preventDefault();
      showLoginForm(container);
    });
    
    // Use our improved signup form handler
    setupSignupForm(container);
  }

  function applyGlobalStyles() {
    if (document.getElementById('webflow-extension-styles')) return;
    
    // First, add the Roboto font from Google Fonts
    const fontLink = document.createElement('link');
    fontLink.id = 'roboto-font';
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap';
    document.head.appendChild(fontLink);
    
    const style = document.createElement('style');
    style.id = 'webflow-extension-styles';
    style.textContent = `
      body, html, * {
        font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      }

      /* Remove arrows/spinners from number inputs */
      .no-spinner::-webkit-inner-spin-button, 
      .no-spinner::-webkit-outer-spin-button { 
        -webkit-appearance: none;
        margin: 0;
      }
      
      /* Firefox */
      .no-spinner {
        -moz-appearance: textfield;
        appearance: textfield;
      }

      .notify-success {
        color: #047857 !important; /* Green color to indicate success */
        font-weight: 500;
        text-decoration: none !important; /* Remove underline */
        cursor: default;
      }

      .dots-icon-active {
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 50%;
      }

      /* You may also want to add a transition for a smoother effect */
      .dots-icon {
        transition: background-color 0.2s ease;
      }

      .notify-success:hover {
        text-decoration: none !important; /* Ensure no underline on hover */
        color: #047857 !important; /* Keep the same color on hover */
      }

      .asset-options {
        opacity: 0.7;
        transition: opacity 0.2s;
      }

      .asset-options:hover {
        opacity: 1;
      }

      .asset-item:hover .asset-options {
        opacity: 1;
      }
            
      body {
        margin: 0;
        padding: 0;
        background-color: #FFF8E1; /* Lighter amber/cream background */
      }
      
      #header-left {
        text-decoration: none;
      }

      /* Container styles */
      .container {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 1rem;
      }
      
      .button-container {
        display: flex;
        gap: 10px; /* Adjust as needed */
      }

      /* Improved Loader Animation */
      .loader-container {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 16rem;
      }

      .fancy-loader {
        width: 50px;
        height: 50px;
        position: relative;
      }

      .fancy-loader .dot {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .fancy-loader .dot:before {
        content: "";
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background-color: black;
        margin-left: -20px; /* Position the dot away from center */
        animation: pulse 1.2s linear infinite;
      }

      .fancy-loader .dot:nth-child(1) {
        transform: rotate(0deg);
      }

      .fancy-loader .dot:nth-child(2) {
        transform: rotate(45deg);
      }

      .fancy-loader .dot:nth-child(3) {
        transform: rotate(90deg);
      }

      .fancy-loader .dot:nth-child(4) {
        transform: rotate(135deg);
      }

      .fancy-loader .dot:nth-child(5) {
        transform: rotate(180deg);
      }

      .fancy-loader .dot:nth-child(6) {
        transform: rotate(225deg);
      }

      .fancy-loader .dot:nth-child(7) {
        transform: rotate(270deg);
      }

      .fancy-loader .dot:nth-child(8) {
        transform: rotate(315deg);
      }

      @keyframes pulse {
        0% {
          opacity: 0.2;
          transform: scale(0.8);
        }
        20% {
          opacity: 1;
          transform: scale(1);
        }
        100% {
          opacity: 0.2;
          transform: scale(0.8);
        }
      }

      /* Alternative loader with blinking dots */
      .dots-loader {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .dots-loader .dot {
        width: 8px;
        height: 8px;
        background-color: black;
        border-radius: 50%;
        animation: dotPulse 1s infinite ease-in-out;
      }

      .dots-loader .dot:nth-child(1) {
        animation-delay: 0s;
      }

      .dots-loader .dot:nth-child(2) {
        animation-delay: 0.1s;
      }

      .dots-loader .dot:nth-child(3) {
        animation-delay: 0.2s;
      }

      @keyframes dotPulse {
        0%, 100% {
          transform: scale(0.6);
          opacity: 0.4;
        }
        50% {
          transform: scale(1);
          opacity: 1;
        }
      }

      /* Custom checkbox styling */
      input[type="checkbox"] {
        -webkit-appearance: none;
        appearance: none;
        width: 18px;
        height: 18px;
        border: 2px solid #374151;
        border-radius: 4px;
        margin-right: 8px;
        position: relative;
        cursor: pointer;
        vertical-align: middle;
      }

      /* Checked state */
      input[type="checkbox"]:checked {
        background-color: #ffab69; /* Orange background when checked */
        border-color: black;
      }

      /* Checkmark */
      input[type="checkbox"]:checked::after {
        content: '';
        position: absolute;
        left: 3px;
        top: -0.5px;
        width: 5px;
        height: 10px;
        border: solid black;
        border-width: 0 2px 2px 0;
        transform: rotate(45deg);
      }

      /* Focus state */
      input[type="checkbox"]:focus {
        outline: none;
      }

      /* Hover state */
      input[type="checkbox"]:hover {
        border-color: black;
      }

      /* Range slider styling */
      input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 10px;
        background: #ffe0b2; /* Light orange background */
        border-radius: 5px;
        outline: none;
        margin: 10px 0; /* Fix alignment issues with some spacing */
      }

      /* Slider thumb */
      input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 20px;
        height: 20px;
        background: #ffab69; /* Darker orange for thumb */
        border: 2px solid black;
        border-radius: 50%;
        cursor: pointer;
        margin-top: -6.5px; /* This helps center the thumb on the track */
      }

      input[type="range"]::-moz-range-thumb {
        width: 20px;
        height: 20px;
        background: #ffab69;
        border: 2px solid black;
        border-radius: 50%;
        cursor: pointer;
        box-shadow: 2px 2px 0 0 black;
      }

      /* Slider track */
      input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: 10px;
        background: #ffe0b2; /* Light orange for the track */
        border-radius: 5px;
        border: 2px solid black;
      }

      input[type="range"]::-moz-range-track {
        width: 100%;
        height: 10px;
        background: #ffe0b2;
        border-radius: 5px;
      }

      /* Active state */
      input[type="range"]:active::-webkit-slider-thumb {
        transform: scale(1.1);
      }

      input[type="range"]:active::-moz-range-thumb {
        transform: scale(1.1);
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
        padding: 0.6rem;
      }
      
      .p-4 {
        padding: 1rem;
      }
      
      .p-6 {
        padding: 1.5rem;
      }

      .pb-40 {
        padding-bottom: 65px;
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
        border: 1px solid black;
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
        border-width: 2px;
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
      
      /* Button styles - UPDATED with shadow */
      .button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-family: 'Roboto', sans-serif;
        font-weight: 500;
        padding: 0.75rem 1rem;
        border-radius: 9999px; /* Fully rounded corners */
        cursor: pointer;
        transition: all 0.2s;
        position: relative; /* Added for shadow positioning */
      }

      .button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .button-primary {
        background-color: #ffab69; /* Button color */
        color: black;
        border: 2px solid black;
        box-shadow: 4px 4px 0 0 black; /* Moves shadow to bottom-right */
        transform: translateY(-1px); /* Slight lift for shadow effect */
      }

      .button-primary:hover:not(:disabled) {
        background-color: #ff9c50; /* Slightly darker on hover */
        transform: translateY(-2px);
        box-shadow: 0 4px 0 0 black; /* Increased shadow on hover */
      }

      .button-primary:active:not(:disabled) {
        transform: translateY(0);
        box-shadow: 0 1px 0 0 rgba(0, 0, 0, 0.3); /* Reduced shadow when pressed */
      }
      
      .button-outline {
        background-color: white;
        color: #374151;
        border: 1px solid #d1d5db;
        border-radius: 9999px;
      }
      
      .button-outline:hover:not(:disabled) {
        background-color: #f9fafb;
      }
      
      .button-sm {
        padding: 0.25rem 0.5rem;
        font-size: 0.875rem;
      }
      
      /* Input styles - UPDATED */
      .input {
        width: 90%; /* Reduced width to match reference */
        margin: 0 auto; /* Center the input */
        padding: 0.75rem 1rem;
        border-radius: 0.5rem;
        border: 2px solid black;
        outline: none;
        font-family: 'Roboto', sans-serif;
        transition: border-color 0.2s, box-shadow 0.2s;
      }
      
      .input:focus {
        border-color: #ffab69; /* Match the button color */
        box-shadow: 0 0 0 2px rgba(255, 171, 105, 0.1);
      }
      
      /* Login form container */
      .auth-container {
        background-color: white;
        border-radius: 0.75rem;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
        padding: 2rem;
      }
      
      .max-w-md {
        background-color: white;
        border-radius: 0.75rem;
        box-shadow: 4px 4px 0 0 black;
        border: 2px solid black;
        padding: 2rem;
      }

      /* Link styling */
      #show-signup, #show-login {
        color: #ffab69; /* Match button color */
        text-decoration: none;
        font-weight: 500;
      }
      
      #show-signup:hover, #show-login:hover {
        color: #ff9c50; /* Slightly darker on hover */
        text-decoration: underline;
      }
      
      /* Header styling */
      header {
        background-color: #FFF8E1;
      }
      
      /* Footer styling */
      footer {
        background-color: #FFF8E1;
        margin-top: auto;
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
        border: 2px solid black;
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
        background-color: #FFF3E0; /* Orange 50 */
        color: #FB8C00; /* Orange 600 */
      }
      
      .green-accent {
        background-color: #FFF3E0; /* Orange 50 */
        color: #FB8C00; /* Orange 600 */
      }
      
      .feature-card:hover .blue-accent {
        background-color: #FFE0B2; /* Orange 100 */
      }
      
      .feature-card:hover .green-accent {
        background-color: #FFE0B2; /* Orange 100 */
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
        font-family: 'Roboto', sans-serif;
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

      .action-button {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: none;
        border: none;
        cursor: pointer;
        font-size: 12px;
        color: #333;
        padding: 8px;
        border-radius: 8px;
        transition: background-color 0.2s;
      }

      .action-button svg {
        margin-bottom: 4px;
      }

      .action-button:hover:not(:disabled) {
        background-color: #f5f5f5;
      }

      /* Disabled button styling */
      .action-button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
        color: #999;
      }

      .action-button:disabled svg {
        opacity: 0.5;
      }
    `;
    document.head.appendChild(style);
  }
  
  // Update your renderApp function to ensure header is added first
  function renderApp(container) {
    // // Check if we're just updating a selection or need a full render
    // const isSelectionChange = !forceFullRender && 
    // container.querySelector('#app-main-container') && 
    // ['assets-browser', 'resize', 'crop'].includes(state.currentView);

    // if (isSelectionChange) {
    // // If it's just a selection change and the main structure exists, 
    // // don't re-render everything
    // return;
    // }

    // Clear the container
    container.innerHTML = '';
    
    // Create the app layout
    const app = document.createElement('div');
    app.className = 'min-h-screen flex flex-col';
    
    // Create and append each section in the correct order
    const headerElement = document.createElement('div');
    headerElement.id = 'app-header-container';
    app.appendChild(headerElement);
    
    const mainElement = document.createElement('div');
    mainElement.id = 'app-main-container';
    app.appendChild(mainElement);
    
    const footerElement = document.createElement('div');
    footerElement.id = 'app-footer-container';
    app.appendChild(footerElement);
    
    // Append the app to the container
    container.appendChild(app);
    
    // Render the header first
    renderHeader(headerElement);
    
    // Then render the main content based on view
    switch (state.currentView) {
      case 'home':
        renderHomeView(mainElement);
        break;
      case 'assets-browser':
        renderAssetsBrowserView(mainElement);
        break;
      case 'resize':
        renderResizeView(mainElement);
        break;
      case 'crop':
        renderCropView(mainElement);
        break;
      default:
        renderHomeView(mainElement);
    }
    
    // Finally render the footer
    renderFooter(footerElement);
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

  // Also improve the cropSvgFile function to handle SVGs better
  async function cropSvgFile(svgFile, cropX, cropY, cropWidth, cropHeight) {
    try {
      // Fetch the SVG content
      let svgText;
      
      if (typeof svgFile === 'string') {
        // If svgFile is a URL string, fetch it with CORS handling
        const response = await fetch(getProxiedImageUrl(svgFile));
        if (!response.ok) throw new Error('Failed to fetch SVG for cropping');
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
        throw new Error('SVG parsing error: ' + parserError.textContent);
      }
      
      // Get the root SVG element
      const svgElement = svgDoc.documentElement;
      
      // Get original dimensions
      let originalWidth = svgElement.getAttribute('width');
      let originalHeight = svgElement.getAttribute('height');
      let viewBox = svgElement.getAttribute('viewBox');
      
      // Extract dimensions from viewBox if width/height aren't set
      if ((!originalWidth || !originalHeight) && viewBox) {
        const viewBoxParts = viewBox.split(/\s+/);
        if (viewBoxParts.length === 4) {
          if (!originalWidth) originalWidth = viewBoxParts[2];
          if (!originalHeight) originalHeight = viewBoxParts[3];
        }
      }
      
      // Parse dimensions to numbers, with improved fallbacks
      originalWidth = parseFloat(originalWidth) || 0;
      originalHeight = parseFloat(originalHeight) || 0;
      
      // If dimensions are still 0, check stored dimensions
      if (originalWidth <= 0 || originalHeight <= 0) {
        console.log("SVG has invalid dimensions, checking for stored dimensions");
        
        // Try to get from state.selectedAsset first (more reliable)
        if (state.selectedAsset && state.selectedAsset.width && state.selectedAsset.height) {
          originalWidth = state.selectedAsset.width;
          originalHeight = state.selectedAsset.height;
        } 
        // If we still don't have dimensions, use defaults
        if (originalWidth <= 0 || originalHeight <= 0) {
          originalWidth = 150;
          originalHeight = 150;
        }
      }
      
      // Ensure we have a viewBox
      if (!viewBox && originalWidth > 0 && originalHeight > 0) {
        viewBox = `0 0 ${originalWidth} ${originalHeight}`;
        svgElement.setAttribute('viewBox', viewBox);
      }
      
      // Get viewBox parameters
      let viewBoxMinX = 0;
      let viewBoxMinY = 0;
      let viewBoxWidth = originalWidth;
      let viewBoxHeight = originalHeight;
      
      if (viewBox) {
        const viewBoxParts = viewBox.split(/\s+/);
        if (viewBoxParts.length === 4) {
          viewBoxMinX = parseFloat(viewBoxParts[0]) || 0;
          viewBoxMinY = parseFloat(viewBoxParts[1]) || 0;
          viewBoxWidth = parseFloat(viewBoxParts[2]) || originalWidth;
          viewBoxHeight = parseFloat(viewBoxParts[3]) || originalHeight;
        }
      }
      
      // Calculate the new viewBox values based on crop parameters and ensure integer values
      const newViewBoxMinX = Math.round(viewBoxMinX + (cropX / 100) * viewBoxWidth);
      const newViewBoxMinY = Math.round(viewBoxMinY + (cropY / 100) * viewBoxHeight);
      const newViewBoxWidth = Math.round((cropWidth / 100) * viewBoxWidth);
      const newViewBoxHeight = Math.round((cropHeight / 100) * viewBoxHeight);
      
      // Update the viewBox to crop the SVG
      svgElement.setAttribute('viewBox', `${newViewBoxMinX} ${newViewBoxMinY} ${newViewBoxWidth} ${newViewBoxHeight}`);
      
      // Set the new width and height attributes as integer values
      svgElement.setAttribute('width', Math.round(newViewBoxWidth));
      svgElement.setAttribute('height', Math.round(newViewBoxHeight));
      
      // Also set integer values in the style for consistent rendering
      svgElement.style.width = `${Math.round(newViewBoxWidth)}px`;
      svgElement.style.height = `${Math.round(newViewBoxHeight)}px`;
      
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

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = (error) => reject(error);
      reader.readAsText(file);
    });
  }

  // Add event for logout
  function logoutUser() {
    // Track logout event before clearing data
    if (window.posthogAnalytics) {
      const userEmail = localStorage.getItem('userEmail');
      window.posthogAnalytics.trackAuth('indesigner_user_logout', {
        email: userEmail || 'unknown'
      });
    }
    
    // Clear all tokens
    localStorage.removeItem('token');
    localStorage.removeItem('webflowToken');
    localStorage.removeItem('webflowTokenTimestamp');
    localStorage.removeItem('userEmail');
    
    // Also clear site-specific tokens
    getCurrentWebflowSiteId().then(currentSiteId => {
      if (currentSiteId) {
        localStorage.removeItem(`webflow_token_${currentSiteId}`);
      }
    }).catch(error => {
      console.error('Error clearing site-specific token:', error);
    });
    
    // Reset ALL relevant state
    state.userInfo = null;
    state.webflowToken = null;
    state.assets = [];
    state.filteredAssets = [];
    state.selectedAsset = null;
    state.isLoading = false;
    state.error = null;
    
    // Re-render the UI
    renderApp(document.getElementById('root'));
    
    // Show success notification
    showPopupNotification({
      type: 'success',
      title: 'Logged Out',
      message: 'You have been successfully logged out.'
    });
  }

  async function renderHeader(container) {
    // Get the current site ID
    const currentSiteId = await getCurrentWebflowSiteId();
    
    // Create header element
    const header = document.createElement('header');
    header.className = 'bg-white border-b';
    header.style.border = '2px solid black';
    header.style.borderRadius = '10px';
  
    // Check for tokens
    const hasGeneralToken = localStorage.getItem('webflowToken') !== null;
    const hasUserToken = localStorage.getItem('token') !== null;
    const hasSiteSpecificToken = localStorage.getItem(`webflow_token_${currentSiteId}`) !== null;
    
    // Set token in state if site-specific token exists
    if (hasSiteSpecificToken) {
      state.webflowToken = localStorage.getItem(`webflow_token_${currentSiteId}`);
    }
    
    // Determine if we should show login or logout button
    const showLoginButton = !hasSiteSpecificToken;
  
    header.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <!-- Left side - Home link -->
          <div class="flex items-center">
            <a href="https://www.trypixie.io/?ref=in-designer-app" target="_blank" class="flex items-center cursor-pointer" id="header-left">
              <img src="logo.png" width="37" height="37" alt="Logo">
              <span class="text-xl font-semibold text-gray-900 ml-1">Pixie</span>
            </a>
          </div>
          
          <!-- Right side - buttons -->
          <div class="flex items-center space-x-3">
            ${showLoginButton ? `
              <button class="button button-primary text-sm py-1 px-3" id="login-webflow-button">
                Login/Signup
              </button>
            ` : `
              <button class="button button-outline text-sm py-1 px-3" id="logout-webflow-button">
                Logout
              </button>
            `}
          </div>
        </div>
      </div>
    `;
    
    container.appendChild(header);
    
    // Add event listeners
    setTimeout(() => {
      const homeLink = document.getElementById('home-link');
      if (homeLink) {
        homeLink.addEventListener('click', () => {
          state.currentView = 'home';
          state.resizeMode = null;
          state.cropMode = null;
          renderApp(document.getElementById('root'));
        });
      }
      
      // Add event listener to login/signup button in header
      const loginWebflowButton = document.getElementById('login-webflow-button');
      if (loginWebflowButton) {
        loginWebflowButton.addEventListener('click', (e) => {
          e.preventDefault();
          // Use the updated openOAuthWindow function that returns a promise
          openOAuthWindow()
            .then(result => {
              console.log('Authentication completed successfully.');
            })
            .catch(error => {
              console.error('Authentication failed.');
              // You may want to show a notification here, but the function already handles that
            });
        });
      }
      
      // Add event listener to logout button
      const logoutWebflowButton = document.getElementById('logout-webflow-button');
      if (logoutWebflowButton) {
        logoutWebflowButton.addEventListener('click', () => {
          // Use the site-specific logout function
          logoutUser();
        });
      }
    }, 0);
  }
  
  // Update the navigateToPage function to include better error handling
  function navigateToPage(pageNumber) {
    try {
      // Validate the page number is within bounds
      if (pageNumber < 1) pageNumber = 1;
      if (pageNumber > state.totalPages) pageNumber = state.totalPages;

      // Clean up before changing pages
      cleanupLazyLoading();
      
      // Set the page directly
      state.currentPage = pageNumber;
      
      // Clear selection when changing pages
      state.selectedAsset = null;
      
      // Clear the loaded assets set when changing pages
      state.loadedAssetIds.clear();
      
      // Re-render the app
      renderApp(document.getElementById('root'));
    } catch (error) {
      console.error("Error navigating to page:", error);
      
      // Show a user-friendly error message
      showPopupNotification({
        type: 'error',
        title: 'Navigation Error',
        message: 'There was an error loading this page. Please try again.'
      });
    }
  }

  // 3. Update the renderHomeView function to adapt to login status
  function renderHomeView(container) {
    const main = document.createElement('main');
    main.className = 'flex-grow flex items-center justify-center bg-amber-50 bg-white mt-6';
    main.style.border = '2px solid black';
    main.style.borderRadius = '10px';

    const hasToken = !!(localStorage.getItem('token') && localStorage.getItem('webflowToken'));

    // Regular content
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
            <p class="text-gray-600 mb-4">Resize specific images from your Webflow assets while maintaining quality.</p>
            <button class="button button-primary" id="resize-button">
              Get Started
            </button>
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
            <button class="button button-primary" id="crop-button">
              Get Started
            </button>
          </div>
        </div>
        
        ${!hasToken ? `
          <div class="text-center mt-8">
            <p class="text-gray-600 mb-4">To manage your Webflow site's assets, click 'Login/Signup' to get started.</p>
          </div>
        ` : ''}
      </div>
    `;
    
    container.appendChild(main);
    
    // Add event listeners
    setTimeout(() => {
      // Add login button in the main content area when needed
      // const loginWebflowHomeButton = document.getElementById('login-webflow-home-button');
      // if (loginWebflowHomeButton) {
      //   loginWebflowHomeButton.addEventListener('click', (e) => {
      //     e.preventDefault();
      //     openOAuthWindow();
      //   });
      // }
      
      // Regular app buttons
      document.getElementById('resize-button')?.addEventListener('click', () => {
        // Check if user is logged in before allowing to proceed
        if (!localStorage.getItem('token') || !localStorage.getItem('webflowToken')) {
          showPopupNotification({
            type: 'info',
            title: 'Login Required',
            message: 'Please login with your Webflow account to use this feature.'
          });
          return;
        }
        
        state.resizeMode = 'specific-assets';
        state.cropMode = null;
        state.currentView = 'assets-browser';
        renderApp(document.getElementById('root'));
      });
      
      document.getElementById('crop-button')?.addEventListener('click', () => {
        // Check if user is logged in before allowing to proceed
        if (!localStorage.getItem('token') || !localStorage.getItem('webflowToken')) {
          showPopupNotification({
            type: 'info',
            title: 'Login Required',
            message: 'Please login with your Webflow account to use this feature.'
          });
          return;
        }
        
        state.cropMode = 'specific-assets';
        state.resizeMode = null;
        state.currentView = 'assets-browser';
        renderApp(document.getElementById('root'));
      });
    }, 0);
  }
  
  // Update the storeWebflowToken function to store site-specific tokens
  function storeWebflowToken(token, siteId) {
    if (!token || !siteId) {
      console.error('Cannot store token: Missing token or siteId');
      return false;
    }
    
    try {
      // Store token with site-specific key
      const siteSpecificKey = `webflow_token_${siteId}`;
      localStorage.setItem(siteSpecificKey, token);
      
      // Also store in the generic key for backward compatibility
      localStorage.setItem('webflowToken', token);
      
      // Add a timestamp
      localStorage.setItem('webflowTokenTimestamp', new Date().getTime().toString());
      
      // Update state
      state.webflowToken = token;
      return true;
    } catch (error) {
      console.error('Error storing token:', error);
      return false;
    }
  }

  // Function to retrieve the token from localStorage
  function retrieveWebflowToken() {
    const token = localStorage.getItem('webflowToken');
    if (token) {
      state.webflowToken = token;
      console.log('Webflow token retrieved from localStorage');
      return token;
    }
    return null;
  }

  // Update the logout function to handle site-specific tokens
  // function logoutWebflow() {
  //   getCurrentWebflowSiteId().then(currentSiteId => {
  //     // Clear site-specific token if we have a site ID
  //     if (currentSiteId) {
  //       localStorage.removeItem(`webflow_token_${currentSiteId}`);
  //     }
      
  //     // Clear all tokens
  //     localStorage.removeItem('webflowToken');
  //     localStorage.removeItem('token');
  //     localStorage.removeItem('webflowTokenTimestamp');
  //     localStorage.removeItem('userEmail');
      
  //     // Reset ALL state related to assets and auth
  //     state.webflowToken = null;
  //     state.userInfo = null;
  //     state.assets = [];
  //     state.filteredAssets = [];
  //     state.selectedAsset = null;
  //     state.isLoading = false;
  //     state.error = null;
      
  //     // Re-render the UI
  //     renderApp(document.getElementById('root'));
      
  //     // Show success notification
  //     showPopupNotification({
  //       type: 'success',
  //       title: 'Logged Out',
  //       message: 'You have been disconnected from your Webflow account.'
  //     });
  //   }).catch(error => {
  //     console.error('Error during logout:', error);
  //   });
  // }

  // Add a function to preload critical assets
  function preloadCriticalAssets() {
    // Preload the first page of assets
    const assetsToPreload = getCurrentPageAssets().slice(0, 12); // First page
    
    if (assetsToPreload.length === 0) return;
    
    // Create an array of promises to track loading
    const preloadPromises = assetsToPreload.map((asset, index) => {
      return new Promise((resolve) => {
        if (!isImageAsset(asset)) {
          resolve(); // Skip non-image assets
          return;
        }
        
        const imageUrl = getProxiedImageUrl(asset.url);
        const img = new Image();
        
        // Set up completion handlers
        img.onload = () => {
          state.loadedAssetIds.add(asset.id);
          
          // If we have the DOM element, update it directly
          const assetItem = document.querySelector(`[data-asset-id="${asset.id}"]`);
          if (assetItem) {
            const imgElement = assetItem.querySelector('img');
            if (imgElement) {
              imgElement.src = imageUrl;
              imgElement.classList.remove('asset-image-placeholder');
              imgElement.classList.add('asset-image-loaded');
            }
          }
          
          resolve();
        };
        
        img.onerror = () => {
          // Still consider it "loaded" to prevent retry loops
          state.loadedAssetIds.add(asset.id);
          resolve();
        };
        
        // Start loading with a slight stagger
        setTimeout(() => {
          img.src = imageUrl;
        }, index * 20); // Short stagger of 20ms between each image
      });
    });
    
    // After all critical assets are loaded, update any visible elements
    Promise.all(preloadPromises).then(() => {
      // Find all asset-item elements that should now show their images
      const assetItems = document.querySelectorAll('.asset-item');
      assetItems.forEach(item => {
        const assetId = item.getAttribute('data-asset-id');
        if (state.loadedAssetIds.has(assetId)) {
          const imgElement = item.querySelector('img');
          if (imgElement && imgElement.classList.contains('asset-image-placeholder')) {
            const asset = state.filteredAssets.find(a => a.id === assetId);
            if (asset) {
              imgElement.src = getProxiedImageUrl(asset.url);
              imgElement.classList.remove('asset-image-placeholder');
              imgElement.classList.add('asset-image-loaded');
            }
          }
        }
      });
    });
  }

  // 1. Modify the generateAssetHTML function to add the 3-dot menu
  function generateAssetHTML(asset) {
    const isImage = isImageAsset(asset);
    const isSelected = state.selectedAsset?.id === asset.id;

    // If this asset is already loaded, use the actual image
    const isLoaded = state.loadedAssetIds.has(asset.id);
    
    // Use different classes based on loaded state
    let imgClass = isLoaded 
      ? 'w-full h-full object-cover asset-image-loaded' 
      : 'w-full h-full object-cover asset-image-placeholder';
    
    // Use the actual image URL if already loaded, otherwise use placeholder
    let imgSrc = isLoaded 
      ? getProxiedImageUrl(asset.url) 
      : TRANSPARENT_PLACEHOLDER;

    return `
      <div 
        class="asset-item border rounded-md overflow-hidden hover:shadow-md"
        data-asset-id="${asset.id}"
      >
        <div class="aspect-square bg-gray-100 flex items-center justify-center overflow-hidden">
          ${isImage ? `
            <img 
              src="${imgSrc}" 
              alt="${asset.name || getFilenameFromUrl(asset.url)}" 
              class="${imgClass}"
              data-original-url="${asset.url}"
              onerror="this.src='/file.svg'; this.classList.remove('asset-image-placeholder'); this.classList.add('asset-image-loaded');"
            />
          ` : `
            <div class="text-gray-400 text-xs text-center p-4">
              ${asset.fileType || 'Unknown file type'}
            </div>
          `}
        </div>
        <div class="p-2 relative"> <!-- Added relative positioning for the menu -->
          <div class="flex justify-between items-start">
            <div class="flex-grow">
              <div class="text-xs truncate" title="${asset.name || getFilenameFromUrl(asset.url)}">
                ${getShortFilename(asset.name || getFilenameFromUrl(asset.url))}
              </div>
              <div>
                <div class="text-xs text-gray-600 asset-dimensions">${asset.width || 'N/A'}px × ${asset.height || 'N/A'}px</div>
              </div>
              <div class="text-xs text-gray-500 mt-2">
                ${asset.createdOn 
                  ? new Date(asset.createdOn).toLocaleDateString() 
                  : 'Unknown date'}
              </div>
            </div>
            <!-- Add 3-dot menu -->
            <div class="asset-options cursor-pointer p-1 hover:bg-gray-400 rounded" data-asset-id="${asset.id}">
              <svg class="dots-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="5" r="1"></circle>
                <circle cx="12" cy="12" r="1"></circle>
                <circle cx="12" cy="19" r="1"></circle>
              </svg>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // Replace the existing formatAspectRatio function with this improved version
  function formatAspectRatio(width, height) {
    if (!width || !height) return "N/A";
    
    // Calculate GCD for simplifying the fraction
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    
    // Simplify the ratio
    let simplifiedWidth = width / divisor;
    let simplifiedHeight = height / divisor;
    
    // Common ratios to check against (in order of preference)
    const commonRatios = [
      { width: 1, height: 1 },      // Square
      { width: 4, height: 3 },      // Standard TV
      { width: 16, height: 9 },     // HD TV/Widescreen
      { width: 3, height: 2 },      // Classic Photo
      { width: 5, height: 4 },      // Classic Photo
      { width: 21, height: 9 },     // Ultrawide
      { width: 2, height: 1 },      // 2:1
      { width: 3, height: 1 },      // Panoramic
      { width: 9, height: 16 }      // Vertical video
    ];
    
    // If both numbers are still fairly large after simplification
    if (simplifiedWidth > 20 || simplifiedHeight > 20) {
      // Calculate the actual ratio
      const ratio = width / height;
      
      // Find the closest common ratio
      let closestRatio = null;
      let closestDiff = Infinity;
      
      for (const common of commonRatios) {
        const commonRatio = common.width / common.height;
        const diff = Math.abs(ratio - commonRatio);
        
        if (diff < closestDiff) {
          closestDiff = diff;
          closestRatio = common;
        }
      }
      
      // If we found a reasonably close match (within 10%)
      if (closestRatio) {
        const commonRatio = closestRatio.width / closestRatio.height;
        const percentDiff = Math.abs(ratio - commonRatio) / commonRatio;
        
        if (percentDiff < 0.1) {
          return `${closestRatio.width}:${closestRatio.height}`;
        }
      }
      
      // If we couldn't find a close common ratio,
      // and the numbers are still too large, find smaller integers with similar ratio
      if (simplifiedWidth > 20 || simplifiedHeight > 20) {
        // Approach: Continued fraction approximation
        // Convert to a sequence of integer approximations
        let a = Math.max(width, height);
        let b = Math.min(width, height);
        let approximations = [];
        
        // Generate approximations
        while (b > 0 && approximations.length < 10) {
          approximations.push({ n: a, d: b });
          const temp = a % b;
          a = b;
          b = temp;
        }
        
        // Find a good approximation (reasonable size numbers)
        for (let i = 0; i < approximations.length; i++) {
          const approx = approximations[i];
          if (approx.n <= 20 && approx.d <= 20) {
            if (width > height) {
              return `${approx.n}:${approx.d}`;
            } else {
              return `${approx.d}:${approx.n}`;
            }
          }
        }
      }
    }
    
    // Return the simplified ratio
    return `${simplifiedWidth}:${simplifiedHeight}`;
  }

  // Updated handleCompressOption function to check login status first
  async function handleCompressOption(asset) {
    try {
      // First check if user is authenticated
      const token = localStorage.getItem('token');
      
      if (!token) {
        // User is not logged in, show auth popup
        showCompressionAuthPopup();
        return;
      }
      
      // Show loading notification
      const loadingNotification = showPopupNotification({
        type: 'info',
        title: 'Checking your account',
        message: 'Please wait while we verify your subscription status...'
      });
      
      // Check user's plan
      const planResult = await checkUserPlan();
      
      // Close loading notification
      if (loadingNotification) loadingNotification();
      
      if (!planResult.success) {
        console.error('Error checking plan:', planResult.error);
        
        if (planResult.status === 401) {
          // Authentication failed, clear token and show auth popup
          localStorage.removeItem('token');
          showCompressionAuthPopup();
        } else {
          // Other error, show error message
          showPopupNotification({
            type: 'error',
            title: 'Error',
            message: 'Failed to check your subscription status. Please try again later.'
          });
        }
        return;
      }
      
      if (planResult.hasPlan) {
        // User has a plan, redirect to home page for compression
        redirectToHomePage();
      } else {
        // User doesn't have a plan, redirect to pricing page
        redirectToPricingPage();
      }
    } catch (error) {
      console.error('Error handling compression option:', error);
      showPopupNotification({
        type: 'error',
        title: 'Error',
        message: 'An unexpected error occurred. Please try again later.'
      });
    }
  }

  function openOAuthWindow() {
    // Return a promise so we can await the result
    return new Promise((resolve, reject) => {
      // Simplified OAuth URL without redirect_uri (keep your existing URL)
      const oauthUrl = `https://webflow.com/oauth/authorize?response_type=code&client_id=6f8cb14d040524684edc96b0711c28949096cc16fc17d86437beac9825e40d00&scope=authorized_user%3Aread%20assets%3Aread%20assets%3Awrite%20sites%3Aread%20cms%3Aread%20cms%3Awrite`;
        
      // Open the popup
      const oauthWindow = window.open(
        oauthUrl,
        'WebflowOAuth',
        `width=800,height=600,top=5,left=${window.screen.width - 820},menubar=no,toolbar=no,location=no,resizable=yes,scrollbars=yes,status=no`
      );
        
      // Handle message event for the auth code
      // let eventTracker = false;
      // console.log("Event tracker outside- ", state.eventTracker);
      window.addEventListener('message', async function messageHandler(event) {
        // console.log("event tracker inside 1- ", state.eventTracker);
        // Clean up the event listener
        window.removeEventListener('message', messageHandler);
            
        if (event.data && event.data.type === 'WEBFLOW_AUTH_SUCCESS' && state.eventTracker === false) {
          state.eventTracker = true;
          // console.log("event tracker inside 2- ", state.eventTracker);
          
          // Get the auth code
          const authCode = event.data.code;
            
          try {
            // Get the current site ID
            const currentSiteId = await getCurrentWebflowSiteId();
            if (!currentSiteId) {
              throw new Error('Could not determine current site ID');
            }
                
            // Make the API call to exchange code for token
            const response = await fetch(`${API_BASE_URL}/user/verify-user-auth`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                authCode: authCode,
                clientId: '6f8cb14d040524684edc96b0711c28949096cc16fc17d86437beac9825e40d00'
              })
            });
            
            if (!response.ok) {
              const errorText = await response.text();
              throw new Error(`Server error: ${response.status} - ${errorText}`);
            }
            
            const result = await response.json();
                
            if (result.success) {
              // Store the webflow token with site-specific key
              storeWebflowToken(result.userSecretKey, currentSiteId);
              
              // Store user authentication token
              localStorage.setItem('token', result.token);
              
              // Also store user email if available
              if (result.email) {
                localStorage.setItem('userEmail', result.email);
              }
              
              // Set user logged in state
              state.webflowToken = result.userSecretKey;
              state.userInfo = {
                email: result.email,
                newUser: result.newUser
              };
              
              // Clear the needs authorization flag
              state.needsAuthorization = false;
              
              // Show success notification
              showPopupNotification({
                type: 'success', 
                title: 'Connected Successfully',
                message: 'Your Webflow account has been connected for this site.'
              });
                
              // Immediately update the UI to reflect the new state
              renderApp(document.getElementById('root'));
                
              // Fetch assets if we're in the assets browser view
              if (state.currentView === 'assets-browser') {
                fetchWebflowAssets();
              }
          
              if (result.token) {
                try {
                  const verifyResponse = await fetch(`${API_BASE_URL}/user/verify-auth-code-webflow`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      token: result.token
                    },
                    body: JSON.stringify({
                      secret: result.userSecretKey,
                      clientId: '6f8cb14d040524684edc96b0711c28949096cc16fc17d86437beac9825e40d00'
                    })
                  });

                  const verifyResult = await verifyResponse.json();
                  
                  if (verifyResult.success) {
                    console.log('Successfully added site information to user account.');
                    // You can optionally show another notification or update the UI here
                  } else {
                    console.error('Failed to add site information.');
                  }
                } catch (verifyError) {
                  console.error('Error verifying auth code for site info.');
                }
              }
              
              // Resolve the promise with the result
              resolve(result);
            } else {
              throw new Error(result.message || result.details || 'Failed to connect Webflow account');
            }
          } catch (error) {
            console.error('Token exchange error:', error);
            
            // // Add retry logic
            // if (retryCount < 2) {
            //   console.log(`Retrying OAuth flow (Attempt ${retryCount + 1})`);
              
            //   // Wait a short time before retrying
            //   setTimeout(() => {
            //     openOAuthWindow(retryCount + 1)
            //       .then(resolve)
            //       .catch(reject);
            //   }, 1000);
            // } else {
            //   showPopupNotification({
            //     type: 'error',
            //     title: 'Authorization Failed',
            //     message: 'Could not complete Webflow authorization. Please try again.'
            //   });
            //   reject(error);
            // }
          }
        }
      });
  
      // Handle case where window is closed without completing auth
      const checkClosed = setInterval(() => {
        if (oauthWindow && oauthWindow.closed) {
          clearInterval(checkClosed);
          console.log('OAuth window was closed without completion');
          reject(new Error('Authorization window was closed'));
        }
      }, 500);
  
      // Focus the window to bring it to the front
      if (oauthWindow) {
        oauthWindow.focus();
      } else {
        reject(new Error('Failed to open OAuth window'));
      }
    });
  }

  // Update the checkExistingWebflowConnection function to respect site-specific authorization
  async function checkExistingWebflowConnection() {
    try {
      // Get the current site ID
      const currentSiteId = await getCurrentWebflowSiteId();
      if (!currentSiteId) {
        console.log('No current site ID available');
        return false;
      }
      
      // console.log('Checking for Webflow connection for site ID:', currentSiteId);
      
      // Check if we have a site-specific token first
      const siteSpecificToken = localStorage.getItem(`webflow_token_${currentSiteId}`);
      if (siteSpecificToken) {
        console.log('Found site-specific token for current site');
        state.webflowToken = siteSpecificToken;
        return true;
      }
      
      // If we get here, we don't have a valid connection for this site
      return false;
    } catch (error) {
      console.error('Error checking existing Webflow connection:', error);
      return false;
    }
  }

  // Add a new function to validate a token for a specific site
  async function validateTokenForSite(token, siteId) {
    try {
      // Make a lightweight API call to check if the token is valid for this site
      const url = `${API_BASE_URL}/api/validate-site-access`;
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-webflow-site': siteId
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.success === true;
      }
      
      return false;
    } catch (error) {
      console.error('Error validating token for site:', error);
      return false;
    }
  }

  // Helper function to get a shortened filename (with improved truncation)
  function getShortFilename(filename) {
    if (!filename) return 'Unnamed';
    
    // Get the extension (if any)
    let extension = '';
    if (filename.includes('.')) {
      extension = filename.substring(filename.lastIndexOf('.'));
    }
    
    // Get the base name without extension
    let baseName = extension ? filename.substring(0, filename.lastIndexOf('.')) : filename;
    
    // Check if baseName already has underscore structure
    if (baseName.includes('_')) {
      const parts = baseName.split('_');
      baseName = parts[parts.length - 1]; // Get part after last underscore
    }
    
    // Define maximum length (accounting for extension and ellipsis)
    const MAX_LENGTH = 15;
    const ELLIPSIS = '...';
    
    // Calculate how much space we can use for the base name
    // We need to reserve space for the extension and possibly the ellipsis
    const maxBaseNameLength = MAX_LENGTH - extension.length;
    
    // If the baseName is too long, truncate it and add ellipsis
    if (baseName.length > maxBaseNameLength) {
      // Reserve space for the ellipsis
      const truncateLength = maxBaseNameLength - ELLIPSIS.length;
      
      // Make sure we don't have a negative truncate length
      if (truncateLength > 0) {
        baseName = baseName.substring(0, truncateLength) + ELLIPSIS;
      } else {
        // For extremely short max lengths, just use first few chars
        baseName = baseName.substring(0, Math.max(1, maxBaseNameLength - 1)) + ELLIPSIS;
      }
    }
    
    // Return the shortened filename with the original extension
    return baseName + extension;
  }

  // Add this function to handle automatic reload of assets
  async function autoReloadAssets() {
    console.log("Auto-reloading assets after operation");
    
    // Clear the current assets and fetch fresh ones
    state.assets = [];
    state.filteredAssets = [];
    
    // Keep the selected asset since we just modified it
    const previouslySelectedAsset = state.selectedAsset;
    
    // Log reloading action for debugging
    console.log("Auto-reloading assets after operation", { 
      currentView: state.currentView, 
      previousAsset: previouslySelectedAsset?.name || "None"
    });
    
    // Track analytics event if available
    if (window.posthogAnalytics) {
      window.posthogAnalytics.trackAuth('indesigner_auto_reload_assets', {
        from_view: state.currentView,
        after_operation: state.resizeMode ? 'resize' : (state.cropMode ? 'crop' : 'unknown')
      });
    }
    
    // Fetch assets and re-render
    return fetchWebflowAssets().then(() => {
      // If we had a previously selected asset, try to find its updated version
      if (previouslySelectedAsset) {
        // First try to find by ID
        const updatedAsset = state.filteredAssets.find(a => a.id === previouslySelectedAsset.id);
        
        // If not found by ID (which might happen with newly uploaded assets), try by name
        if (!updatedAsset && previouslySelectedAsset.name) {
          const assetByName = state.filteredAssets.find(a => 
            a.name === previouslySelectedAsset.name || 
            getFilenameFromUrl(a.url) === previouslySelectedAsset.name
          );
          
          if (assetByName) {
            selectAsset(assetByName);
          }
        } else if (updatedAsset) {
          selectAsset(updatedAsset);
        }
      }
      
      console.log("Assets reloaded successfully");
    }).catch(error => {
      console.error("Auto-reload failed:", error);
    });
  }

  // Update renderAssetsBrowserView to hide or de-emphasize the manual reload button
  function renderAssetsBrowserView(container) {
    const main = document.createElement('main');
    main.className = 'flex-grow bg-gray-50 py-6 mt-6';
    main.style.border = '2px solid black';
    main.style.borderRadius = '10px';

    // Check if we need to show the authorization screen
    if (state.needsAuthorization) {
      // Render the authorization UI instead of assets browser
      main.innerHTML = `
        <div class="max-w-7xl mx-auto px-4">
          <div id="assets-browser-content" class="bg-white p-6 rounded-md shadow-md">
            <div class="text-center p-6">
              <p class="text-gray-600 mb-4">To manage your Webflow site's assets, click 'Login/Signup' to get started.</p>
            </div>
          </div>
        </div>
      `;
      
      container.appendChild(main);
      
      // Add event listener for the authorize button
      // setTimeout(() => {
      //   const authorizeButton = document.getElementById('authorize-webflow-button');
      //   if (authorizeButton) {
      //     authorizeButton.addEventListener('click', (e) => {
      //       e.preventDefault();
      //       openOAuthWindow();
      //     });
      //   }
      // }, 0);
    
      return;
    }

    // Check if user is authenticated
    const isAuthenticated = !!(localStorage.getItem('token') && localStorage.getItem('webflowToken'));
    
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4">
        <div class="flex justify-between items-center mb-4">
            <h1 class="text-2xl font-bold">Select an image to edit</h1>
            <button id="reload-assets-button" class="button button-outline flex items-center" title="Reload assets" ${!isAuthenticated ? 'disabled' : ''}>
              Reload Assets
            </button>
        </div>
        <div id="assets-browser-content" class="bg-white p-6 rounded-md shadow-md">
          ${!isAuthenticated ? `
            <div class="text-center p-6">
              <p class="text-gray-600 mb-4">To manage your Webflow site's assets, click 'Login/Signup' to get started.</p>
            </div>
          ` : state.isLoading ?
            `<div class="loader-container">
              <div class="dots-loader">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
              </div>
            </div>`: state.error ? `
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
                  ${getCurrentPageAssets().map(asset => generateAssetHTML(asset)).join('')}
                </div>
                <!-- Pagination Controls -->
                <div class="flex items-center justify-between border-t pt-4 mt-6 pb-2">
                    <div>
                      <div class="text-sm text-gray-500">
                        Showing ${Math.min(state.filteredAssets.length, (state.currentPage - 1) * state.itemsPerPage + 1)} - 
                        ${Math.min(state.filteredAssets.length, state.currentPage * state.itemsPerPage)} of 
                        ${state.filteredAssets.length} assets
                      </div>
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
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .asset-image-placeholder {
        background-color: #f0f0f0;
        animation: pulse 1.5s ease-in-out infinite;
      }
      
      .asset-image-loaded {
        animation: none;
        background-color: transparent;
      }
      
      @keyframes pulse {
        0%, 100% {
          opacity: 0.6;
        }
        50% {
          opacity: 0.9;
        }
      }
      
      .loading {
        filter: blur(5px);
        transition: filter 0.3s;
      }
    `;

    // Make sure this gets added to the head
    if (!document.getElementById('lazy-loading-style')) {
      style.id = 'lazy-loading-style';
      document.head.appendChild(style);
    }
    
    container.appendChild(main);
    
    // If assets have not been loaded yet and user is authenticated, fetch them
    if (!state.isLoading && state.assets.length === 0 && !state.error && isAuthenticated) {
      fetchWebflowAssets();
    }
    
    // Add event listeners
    setTimeout(() => {
      // Initialize lazy loading
      initLazyLoading();
      
      // Get all asset items to observe
      const assetItemsObserve = document.querySelectorAll('.asset-item');
      
      // Only try to observe items if there are any and if the observer exists
      if (state.lazyLoadObserver && assetItemsObserve.length > 0) {
        assetItemsObserve.forEach(item => {
          state.lazyLoadObserver.observe(item);
        });
        
        // Only try to force load images if there are items to load
        forceLoadInitialImages();
        batchPreloadDimensions();
      }

      // Add event listener for the connect webflow button in browser view
      // const connectWebflowBrowserButton = document.getElementById('connect-webflow-browser-button');
      // if (connectWebflowBrowserButton) {
      //   connectWebflowBrowserButton.addEventListener('click', (e) => {
      //     e.preventDefault();
      //     openOAuthWindow();
      //   });
      // }

      // Add event listener for the reload button
      const reloadButton = document.getElementById('reload-assets-button');
      if (reloadButton) {
        reloadButton.addEventListener('click', () => {
          // Only allow reload if webflow is connected
          if (!localStorage.getItem('webflowToken')) {
            showPopupNotification({
              type: 'info',
              title: 'Connect Webflow',
              message: 'Please connect your Webflow account first to load assets.'
            });
            return;
          }
          
          // Show loading state on the button
          reloadButton.disabled = true;
          reloadButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin mr-1">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"></path>
            </svg>
            Reloading...
          `;
          
          // Clear the current assets and fetch fresh ones
          state.assets = [];
          state.filteredAssets = [];
          state.selectedAsset = null;
          
          // Fetch assets and re-render
          fetchWebflowAssets().then(() => {
            showPopupNotification({
              type: 'success',
              title: 'Assets Reloaded',
              message: 'Assets have been refreshed.'
            });
          }).catch(error => {
            showPopupNotification({
              type: 'error',
              title: 'Error',
              message: 'Failed to reload assets: ' + error.message
            });
          });
        });
      }
      
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
            preloadCriticalAssets();
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
          state.isFilterOrSearchChange = true;
          applyFiltersAndSearch();
          renderApp(document.getElementById('root'));
        });
      }

      if (filterImages) {
        filterImages.addEventListener('click', () => {
          state.filter = 'images';
          state.isFilterOrSearchChange = true;
          applyFiltersAndSearch();
          renderApp(document.getElementById('root'));
        });
      }

      const assetOptionsButtons = document.querySelectorAll('.asset-options');
      assetOptionsButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent triggering the asset click event
          const assetId = button.getAttribute('data-asset-id');
          const asset = state.filteredAssets.find(a => a.id === assetId);
          
          if (asset) {
            // Make sure dimensions are loaded before showing the notification
            if (!asset.width || !asset.height) {
              // Preload dimensions if not available
              preloadImageDimensions(asset)
                .then(assetWithDimensions => {
                  // Update the asset in state arrays with the dimensions
                  const assetIndex = state.filteredAssets.findIndex(a => a.id === assetId);
                  if (assetIndex !== -1) {
                    state.filteredAssets[assetIndex] = assetWithDimensions;
                  }
                  
                  // Also update in the full assets array
                  const fullAssetIndex = state.assets.findIndex(a => a.id === assetId);
                  if (fullAssetIndex !== -1) {
                    state.assets[fullAssetIndex] = assetWithDimensions;
                  }
                  
                  // Show the notification with the updated asset
                  showImageSelectionNotification(assetWithDimensions);
                })
                .catch(error => {
                  console.error('Failed to load image dimensions:', error);
                  showImageSelectionNotification(asset);
                });
            } else {
              // Show notification immediately if dimensions are available
              showImageSelectionNotification(asset);
            }
          }
        });
      });
      
      // Asset selection
      const assetItems = document.querySelectorAll('.asset-item');
      assetItems.forEach(item => {
        // Find the image container part to add click handler (not for the whole item anymore)
        const imageContainer = item.querySelector('.aspect-square');
        if (imageContainer) {
          imageContainer.addEventListener('click', () => {
            const assetId = item.getAttribute('data-asset-id');
            const asset = state.filteredAssets.find(a => a.id === assetId);
            if (asset) {
              selectAsset(asset);
              // No need to call renderApp since selectAsset updates UI directly
            }
          });
        }
      });
      
      // Pagination
      const prevPage = document.getElementById('prev-page');
      const nextPage = document.getElementById('next-page');

      if (prevPage) {
        prevPage.replaceWith(prevPage.cloneNode(true));
        const newPrevButton = document.getElementById('prev-page');
        
        newPrevButton.addEventListener('click', () => {
          if (state.currentPage > 1) {
            navigateToPage(state.currentPage - 1);
          }
        });
      }

      if (nextPage) {
        nextPage.replaceWith(nextPage.cloneNode(true));
        const newNextButton = document.getElementById('next-page');
        
        newNextButton.addEventListener('click', () => {
          if (state.currentPage < state.totalPages) {
            navigateToPage(state.currentPage + 1);
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
            } else {
              // If no mode is set, default to resize
              state.resizeMode = 'specific-assets';
              state.currentView = 'resize';
            }
            renderApp(document.getElementById('root'));
          }
        });
      }
      
      // Retry button
      const retryButton = document.getElementById('retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          if (state.webflowToken) {
            fetchWebflowAssets();
          } else {
            showPopupNotification({
              type: 'info',
              title: 'Connect Webflow',
              message: 'Please connect your Webflow account first to fetch assets.'
            });
          }
        });
      }

      verifyImageLoading();
    }, 50);
  }
  
  // Modified renderFooter to be more minimal
  function renderFooter(container) {
    const footer = document.createElement('footer');
    footer.className = 'mt-10 bg-amber-50 border-t border-amber-100';
    footer.style.marginBottom = '0';
        
    const currentYear = new Date().getFullYear();
    
    footer.innerHTML = `
      <div class="max-w-7xl mx-auto px-4 py-2">
        <p class="text-center text-gray-600">
          © ${currentYear} Pixie. All rights reserved.
        </p>
      </div>
    `;
    
    container.appendChild(footer);
  }
  
  function renderResizeView(container) {
    if (!state.selectedAsset) {
      // If no asset is selected, go back to assets browser
      state.currentView = 'assets-browser';
      renderApp(document.getElementById('root'));
      return;
    }
    
    const main = document.createElement('main');
    main.className = 'flex-grow bg-gray-50 py-6 mt-6';
    main.style.border = '2px solid black';
    main.style.borderRadius = '10px';
    
    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4">
        <h1 class="text-2xl font-bold mb-4">Resize Image</h1>
        
        <div class="bg-white p-6 rounded-md mb-6 shadow-md pb-40">
          <!-- Use a flex container for better layout control -->
          <div class="flex flex-wrap gap-10" style="min-height: 350px;">
            <!-- Image Preview Container - Fixed size -->
            <div class="w-full md:w-5/12 mb-6">
              <h3 class="text-lg font-medium mb-2" style="margin-left: 8px; text-decoration: underline;">Image Preview</h3>
              <!-- Fixed height/width preview container with proper centering -->
              <div style="
                width: 400px; 
                height: 400px; 
                margin: 0 auto; 
                position: relative; 
                left: 10px;
                overflow: hidden;
                background-image: linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
                  linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                  linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
                background-size: 20px 20px;
                background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
                border: 1px solid #e5e7eb;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
              ">
                <img 
                  id="preview-image"
                  src="${getProxiedImageUrl(state.selectedAsset.url)}" 
                  alt="${state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url)}" 
                  style="
                    max-width: 100%; 
                    max-height: 100%; 
                    object-fit: contain;
                    position: relative;
                    z-index: 2;
                  "
                  onerror="this.src='/file.svg';"
                />
              </div>
              <div class="text-sm text-gray-600 mt-2 text-center">
                Original dimensions: ${state.selectedAsset.width || '?'}px × ${state.selectedAsset.height || '?'}px
              </div>
            </div>
            
            <!-- Resize Options - Now in their own column -->
            <div class="w-full md:w-5/12" style="position: relative; left: 60px;">
              <h3 class="text-lg font-medium mb-4" style="text-decoration: underline;">Resize Options</h3>
              
              <!-- Grid layout for inputs and aspect ratio toggle -->
              <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px; align-items: start;">
                <!-- Left column for width and height inputs -->
                <div>
                  <!-- Width Input with label -->
                  <div class="mb-6" style="margin-bottom: 10px;">
                    <label class="block text-md font-medium text-gray-700 mb-1">Width (px)</label>
                    <input 
                      type="number" 
                      id="width-input" 
                      class="input text-md no-spinner" 
                      min="1" 
                      style="width: 50%;" 
                    />
                  </div>

                  <!-- Height input -->
                  <div class="mb-8">
                    <label class="block text-md font-medium text-gray-700 mb-1">Height (px)</label>
                    <input 
                      type="number" 
                      id="height-input" 
                      class="input text-md no-spinner" 
                      min="1" 
                      style="width: 50%;" 
                    />
                  </div>
                </div>
                
                <!-- Right column for aspect ratio toggle -->
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 60px; margin-left: -115px;">
                  <button id="aspect-ratio-toggle" class="aspect-ratio-toggle p-2 rounded-md" title="Maintain aspect ratio">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 25 25" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                    </svg>
                  </button>
                  <span id="inline-aspect-ratio" class="text-sm font-mono block text-center text-gray-500 mt-2">
                    (${state.selectedAsset.width && state.selectedAsset.height ? 
                      formatAspectRatio(state.selectedAsset.width, state.selectedAsset.height) : "N/A"})
                  </span>
                </div>
              </div>
              
              <!-- Quality slider with more spacing -->
              <div class="mt-10">
                <label class="block text-md font-medium text-gray-700 mb-2">Quality</label>
                <div class="flex items-center">
                  <input type="range" id="quality-slider" min="1" max="100" value="90" class="w-full" style="width: 45%;" />
                  <input type="number" id="quality-value" class="ml-2 text-sm text-gray-700 input" min="1" max="100" value="90" style="width: 38px; padding: 4px 8px; margin-left: 12px;" />
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
    
    let isResizeUploadInProgress = false;
  
    // Add event listeners
    setTimeout(() => {
      const widthInput = document.getElementById('width-input');
      const heightInput = document.getElementById('height-input');
      const aspectRatioToggle = document.getElementById('aspect-ratio-toggle');
      const qualitySlider = document.getElementById('quality-slider');
      const qualityValue = document.getElementById('quality-value');
      const backButton = document.getElementById('back-to-assets');
      const resizeButton = document.getElementById('resize-submit');
      
      // Initially set the aspect ratio toggle to active (maintain ratio)
      let maintainAspectRatio = true;
  
      // Add CSS for the maintain aspect ratio toggle
      const style = document.createElement('style');
      style.textContent = `
        .aspect-ratio-toggle {
          transition: all 0.3s ease;
          cursor: pointer;
          outline: none;
          border: 2px solid black;
          background-color: #ffab69;
          height: 32px;
          width: 38px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .aspect-ratio-toggle.inactive {
          background-color: white !important;
        }
        
        .aspect-ratio-toggle.inactive svg {
          stroke-dasharray: 25;
          stroke-dashoffset: 0;
        }
        
        .aspect-ratio-toggle:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
        }
        
        .aspect-ratio-toggle:active {
          transform: translateY(0);
        }
  
        /* Make sure input fields have proper contrast with clean borders */
        .input {
          border: 2px solid black;
          background-color: white;
        }
      `;
      
      document.head.appendChild(style);
  
      // Set initial values if asset has dimensions
      if (state.selectedAsset.width && state.selectedAsset.height) {
        widthInput.value = state.selectedAsset.width;
        heightInput.value = state.selectedAsset.height;
      }
  
      // FIX: Check if aspectRatioToggle exists before adding event listener
      if (aspectRatioToggle) {
        aspectRatioToggle.addEventListener('click', () => {
          maintainAspectRatio = !maintainAspectRatio;
          
          // Get the element that displays the ratio text
          const inlineRatioElement = document.getElementById('inline-aspect-ratio');
          
          if (maintainAspectRatio) {
            // Visual state for ON
            aspectRatioToggle.classList.remove('inactive');
            
            // Show the ratio text
            if (inlineRatioElement) {
              const ratioText = formatAspectRatio(
                state.selectedAsset.width || 1, 
                state.selectedAsset.height || 1
              );
              inlineRatioElement.textContent = `(${ratioText})`;
              inlineRatioElement.style.color = 'grey'; 
            }
            
            // Update height based on current width to maintain ratio
            if (state.selectedAsset.width && state.selectedAsset.height && widthInput.value) {
              const aspectRatio = state.selectedAsset.width / state.selectedAsset.height;
              const newWidth = parseInt(widthInput.value) || state.selectedAsset.width;
              heightInput.value = Math.round(newWidth / aspectRatio);
            }
          } else {
            // Visual state for OFF
            aspectRatioToggle.classList.add('inactive');
            
            // Clear the ratio text immediately
            if (inlineRatioElement) {
              inlineRatioElement.textContent = '';
            }
          }
        });
      }
      
      // Quality slider and input synchronization
      if (qualitySlider && qualityValue) {
        qualitySlider.addEventListener('input', () => {
          qualityValue.value = qualitySlider.value;
        });
        
        qualityValue.addEventListener('input', () => {
          // Ensure the value is within valid range
          let value = parseInt(qualityValue.value);
          value = Math.max(1, Math.min(100, value || 1)); // Default to 1 if NaN
          
          // Update both the input and slider
          qualityValue.value = value;
          qualitySlider.value = value;
        });
      }
      
      // Maintain aspect ratio if toggled on
      if (state.selectedAsset.width && state.selectedAsset.height) {
        const aspectRatio = state.selectedAsset.width / state.selectedAsset.height;
        
        if (widthInput) {
          widthInput.addEventListener('input', () => {
            if (maintainAspectRatio) {
              // Only update height and aspect ratio display when maintainAspectRatio is true
              const newWidth = parseInt(widthInput.value) || 0;
              heightInput.value = Math.round(newWidth / aspectRatio);
              
              // Update the display with the original ratio text
              const inlineRatioElement = document.getElementById('inline-aspect-ratio');
              if (inlineRatioElement) {
                const ratioText = formatAspectRatio(state.selectedAsset.width, state.selectedAsset.height);
                inlineRatioElement.textContent = `(${ratioText})`;
                inlineRatioElement.style.color = 'grey';
              }
            }
            // When maintainAspectRatio is false, we don't update anything about the display
          });
        }
  
        if (heightInput) {
          heightInput.addEventListener('input', () => {
            if (maintainAspectRatio) {
              // Only update width and aspect ratio display when maintainAspectRatio is true
              const newHeight = parseInt(heightInput.value) || 0;
              widthInput.value = Math.round(newHeight * aspectRatio);
              
              // Update the display with the original ratio text
              const inlineRatioElement = document.getElementById('inline-aspect-ratio');
              if (inlineRatioElement) {
                const ratioText = formatAspectRatio(state.selectedAsset.width, state.selectedAsset.height);
                inlineRatioElement.textContent = `(${ratioText})`;
                inlineRatioElement.style.color = 'grey';
              }
            }
            // When maintainAspectRatio is false, we don't update anything about the display
          });
        }
      }
      
      // Back button
      if (backButton) {
        backButton.addEventListener('click', () => {
          state.currentView = 'assets-browser';
          renderApp(document.getElementById('root'));
        });
      }
  
      // Replace the resize button with a clone to remove any existing event listeners
      if (resizeButton) {
        const newResizeButton = resizeButton.cloneNode(true);
        resizeButton.parentNode.replaceChild(newResizeButton, resizeButton);
        
        // Now modify the resize button event handler for the same functionality
        newResizeButton.addEventListener('click', async () => {
          try {
            // If upload is already in progress, prevent duplicate uploads
            if (isResizeUploadInProgress) {
              console.log("Resize upload already in progress, ignoring additional click");
              return;
            }
            
            // Set the flag to indicate an upload is in progress
            isResizeUploadInProgress = true;
            
            // Show loading state
            newResizeButton.disabled = true;
            newResizeButton.innerHTML = `Processing...`;
            
            // Get resize parameters
            const widthInput = document.getElementById('width-input');
            const heightInput = document.getElementById('height-input');
            const qualitySlider = document.getElementById('quality-slider');
            
            // Get dimensions and quality settings
            let width = widthInput && !isNaN(parseInt(widthInput.value)) ? 
              parseInt(widthInput.value) : state.selectedAsset.width || 800;
            
            let height = heightInput && !isNaN(parseInt(heightInput.value)) ? 
              parseInt(heightInput.value) : state.selectedAsset.height || 600;
            
            const quality = qualitySlider && !isNaN(parseInt(qualitySlider.value)) ? 
              parseInt(qualitySlider.value) : 90;
            
            // Use the maintainAspectRatio variable from the closure instead of reading from a checkbox
            const keepAspectRatio = maintainAspectRatio;
            
            // Track the resize start event
            if (window.posthogAnalytics) {
              window.posthogAnalytics.trackAssetAction('image_resize_started_INDESIGNER', state.selectedAsset, {
                originalWidth: state.selectedAsset.width,
                originalHeight: state.selectedAsset.height,
                newWidth: width,
                newHeight: height,
                quality: quality,
                keepAspectRatio: keepAspectRatio,
              });
            }
  
            // console.log("Resize parameters:", { width, height, quality, keepAspectRatio });
            
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
            
            // Get the current site ID to send to the server
            const currentSiteId = await getCurrentWebflowSiteId();
            // console.log("Current Site Info:", currentSiteId);
            
            // Upload to Webflow with site ID
            const formData = new FormData();
            formData.append('file', resizedFile);
            
            // Create URL with site ID as query parameter
            const uploadUrl = `${API_BASE_URL}/api/direct-upload-webflow-image?siteId=${currentSiteId}`;
                     
            // Use AbortController to handle timeouts
            const controller = new AbortController();
            const signal = controller.signal;
            
            // Set a timeout of 30 seconds
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            
            try {
              // Make the request with both tokens
              const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${state.webflowToken}`,
                  'x-webflow-site': currentSiteId
                },
                body: formData
              });
              
              clearTimeout(timeoutId);
              
              if (!uploadResponse.ok) {
                const errorText = await uploadResponse.text();
                console.error("Upload failed with status:", uploadResponse.status);
                console.error("Response text:", errorText);
                
                let errorData;
                try {
                  errorData = JSON.parse(errorText);
                } catch (e) {
                  errorData = { message: 'Unknown error', details: errorText };
                }
                
                throw new Error(`Failed to upload: ${errorData.message || 'Unknown error'}`);
              }
              
              const uploadResult = await uploadResponse.json();
              console.log("Upload successful.");
  
              // Track successful resize
              if (window.posthogAnalytics) {
                window.posthogAnalytics.trackAssetAction('image_resize_completed_INDESIGNER', state.selectedAsset, {
                  originalWidth: state.selectedAsset.width,
                  originalHeight: state.selectedAsset.height,
                  newWidth: width,
                  newHeight: height,
                  quality: quality,
                  keepAspectRatio: keepAspectRatio,
                  success: true,
                  isSvg: isSvg,
                  uploadResultUrl: uploadResult.imageUrl
                });
              }
  
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
                message: "Image has been resized and uploaded to Webflow. Click 'Continue' to return to the Assets Browser window. Your changes will be visible on Page 1. To see them live in Webflow, just reload the site's page.",
                onClose: () => {
                  // Auto-reload assets before redirecting back
                  autoReloadAssets().then(() => {
                    // Redirect back to assets browser after reload completes
                    state.currentView = 'assets-browser';
                    renderApp(document.getElementById('root'));
                  });
                }
              });
            } catch (fetchError) {
              clearTimeout(timeoutId);
              
              if (fetchError.name === 'AbortError') {
                throw new Error('Upload request timed out. Please try again.');
              } else {
                throw fetchError;
              }
            }
  
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
            newResizeButton.disabled = false;
            newResizeButton.innerHTML = 'Resize & Save to Webflow';
            
            // Reset the upload progress flag
            isResizeUploadInProgress = false;
          }
        });
      }
    }, 0);
  }

  // Update the cleanupLazyLoading function to be more robust
  function cleanupLazyLoading() {
    try {
      if (state.lazyLoadObserver) {
        state.lazyLoadObserver.disconnect();
        state.lazyLoadObserver = null;
      }
    } catch (error) {
      console.error("Error cleaning up lazy loading:", error);
      // Reset the observer even if there's an error
      state.lazyLoadObserver = null;
    }
  }

  // Added a function to clean up filenames when extracting from URLs
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

  // Enhanced popup notification function with buttons
  // Also update the showPopupNotification function to safely handle element removal
  function showPopupNotification(options) {
    const { type = 'success', title, message, onClose, buttons = [] } = options;
    
    // Safely remove any existing popups first
    const existingPopup = document.body.querySelector('.popup-notification');
    if (existingPopup && existingPopup.parentNode) {
      try {
        existingPopup.parentNode.removeChild(existingPopup);
      } catch (error) {
        console.log('Error removing existing popup, may already be removed', error);
      }
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
    } else if (type === 'error') {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>`;
    } else {
      iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
        <line x1="12" y1="8" x2="12" y2="12"></line>
      </svg>`;
    }
    
    // Create buttons HTML
    const buttonsHtml = `
      <div class="button-container">
        ${
          buttons.length > 0 
          ? buttons.map((button, index) => `
            <button class="button ${button.isSecondary ? 'button-outline' : 'button-primary'} popup-action-btn" data-index="${index}">
              ${button.text}
            </button>
          `).join('')
          : `<button class="button button-primary popup-close-btn">Continue</button>`
        }
      </div>
    `;
    
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
          ${buttonsHtml}
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
    
    const closePopup = () => {
      try {
        if (popup && popup.parentNode) {
          popup.parentNode.removeChild(popup);
          if (typeof onClose === 'function') {
            onClose();
          }
        }
      } catch (error) {
        console.log('Error closing popup, it may already be removed', error);
      }
    };
    
    // Handle default close button
    const closeButton = popup.querySelector('.popup-close-btn');
    if (closeButton) {
      closeButton.addEventListener('click', closePopup);
    }
    
    // Handle action buttons
    const actionButtons = popup.querySelectorAll('.popup-action-btn');
    if (actionButtons.length > 0) {
      actionButtons.forEach(button => {
        button.addEventListener('click', () => {
          const index = parseInt(button.getAttribute('data-index'));
          if (buttons[index] && typeof buttons[index].action === 'function') {
            buttons[index].action();
          }
          closePopup();
        });
      });
    }
    
    // Add animation
    popup.animate(
      [
        { opacity: 0, transform: 'translateY(-10px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 200,
        easing: 'ease-out'
      }
    );
    
    // Return a function to close the popup programmatically
    return closePopup;
  }
  
  // Updated renderCropView function with checkered background and aspect ratio maintenance
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
    main.className = 'flex-grow bg-gray-50 py-6 mt-6';
    main.style.border = '2px solid black';
    main.style.borderRadius = '10px';

    main.innerHTML = `
      <div class="max-w-7xl mx-auto px-4">
        <h1 class="text-2xl font-bold mb-4">Crop Image</h1>
        
        <div class="bg-white p-6 rounded-md shadow-md mb-6">
          <h3 class="text-lg font-medium mb-4" style="text-decoration: underline;">Drag the corners or edges to adjust the crop area</h3>
          
          <!-- Crop Container -->
          <div class="mb-6 text-center">
            <div id="crop-container" style="position: relative; display: inline-block; margin: 0 auto; overflow: hidden;">
              <!-- Checkered background for transparency -->
              <div style="
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background-image: 
                  linear-gradient(45deg, #f0f0f0 25%, transparent 25%), 
                  linear-gradient(-45deg, #f0f0f0 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #f0f0f0 75%),
                  linear-gradient(-45deg, transparent 75%, #f0f0f0 75%);
                background-size: 20px 20px;
                background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
                z-index: 1;
              "></div>
              
              <img 
                id="crop-image"
                src="${getProxiedImageUrl(state.selectedAsset.url)}" 
                alt="${state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url)}"
                style="max-height: 500px; max-width: 99%; display: block; position: relative; z-index: 2; object-fit: contain; border: 2px solid black;"
                crossorigin="anonymous"
              />
              
              <div id="crop-overlay" style="position: absolute; top: ${state.crop.y}%; left: ${state.crop.x}%; width: ${state.crop.width}%; height: ${state.crop.height}%; border: 2px dashed #2563eb; background-color: rgba(59, 130, 246, 0.2); cursor: move; box-sizing: border-box; z-index: 3;">
                <!-- Corner handles -->
                <div data-handle="tl" style="position: absolute; width: 10px; height: 10px; background-color: white; border: 2px solid #2563eb; top: -8px; left: -8px; cursor: nwse-resize; z-index: 5;"></div>
                <div data-handle="tr" style="position: absolute; width: 10px; height: 10px; background-color: white; border: 2px solid #2563eb; top: -8px; right: -8px; cursor: nesw-resize; z-index: 5;"></div>
                <div data-handle="bl" style="position: absolute; width: 10px; height: 10px; background-color: white; border: 2px solid #2563eb; bottom: -8px; left: -8px; cursor: nesw-resize; z-index: 5;"></div>
                <div data-handle="br" style="position: absolute; width: 10px; height: 10px; background-color: white; border: 2px solid #2563eb; bottom: -8px; right: -8px; cursor: nwse-resize; z-index: 5;"></div>
                
                <!-- Edge center handles -->
                <div data-handle="t" style="position: absolute; width: 10px; height: 10px; background-color: white; border: 2px solid #2563eb; top: -8px; left: 50%; transform: translateX(-50%); cursor: ns-resize; z-index: 5;"></div>
                <div data-handle="r" style="position: absolute; width: 10px; height: 10px; background-color: white; border: 2px solid #2563eb; right: -8px; top: 50%; transform: translateY(-50%); cursor: ew-resize; z-index: 5;"></div>
                <div data-handle="b" style="position: absolute; width: 10px; height: 10px; background-color: white; border: 2px solid #2563eb; bottom: -8px; left: 50%; transform: translateX(-50%); cursor: ns-resize; z-index: 5;"></div>
                <div data-handle="l" style="position: absolute; width: 10px; height: 10px; background-color: white; border: 2px solid #2563eb; left: -8px; top: 50%; transform: translateY(-50%); cursor: ew-resize; z-index: 5;"></div>
                
                <!-- Full edge handles - these span the entire edge -->
                <div data-handle="t" style="position: absolute; height: 10px; width: calc(100% - 16px); top: -5px; left: 8px; cursor: ns-resize; z-index: 4;"></div>
                <div data-handle="r" style="position: absolute; width: 10px; height: calc(100% - 16px); right: -5px; top: 8px; cursor: ew-resize; z-index: 4;"></div>
                <div data-handle="b" style="position: absolute; height: 10px; width: calc(100% - 16px); bottom: -5px; left: 8px; cursor: ns-resize; z-index: 4;"></div>
                <div data-handle="l" style="position: absolute; width: 10px; height: calc(100% - 16px); left: -5px; top: 8px; cursor: ew-resize; z-index: 4;"></div>
              </div>
            </div>
            
            <div class="text-sm text-gray-600 mt-2 text-center">
              Original dimensions: ${state.selectedAsset.width || '?'}px × ${state.selectedAsset.height || '?'}px
            </div>
          </div>
          
          <!-- Crop Dimensions Display -->
          <div class="border-black border-2 grid grid-cols-2 gap-4 mb-4 mt-2 p-4 rounded-lg max-w-md mx-auto">
            <div class="text-md">X: <strong id="crop-x-value">0</strong>px</div>
            <div class="text-md">Y: <strong id="crop-y-value">0</strong>px</div>
            <div class="text-md">Width: <strong id="crop-width-value">0</strong>px</div>
            <div class="text-md">Height: <strong id="crop-height-value">0</strong>px</div>
            <div class="col-span-2 text-sm text-gray-500 mt-2">
              <u>Note</u>: 'X' is the distance from left edge and 'Y' is the distance from top edge.
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
  
  function initSimpleCropper() {
    const imgElement = document.getElementById('crop-image');
    const cropOverlay = document.getElementById('crop-overlay');
    const cropContainer = document.getElementById('crop-container');
    
    if (!imgElement || !cropOverlay || !cropContainer) {
      console.error('Missing required crop elements');
      return;
    }
    
    // Check if image is an SVG
    const isSvg = state.selectedAsset && isSvgAsset(state.selectedAsset);
    // console.log("Is SVG image:", isSvg);
    
    // Set crossorigin to anonymous for all images to help with CORS
    imgElement.crossOrigin = "anonymous";
    
    // Create a fallback function to show a placeholder when the image fails to load
    const showSvgFallback = () => {
      console.log("Using SVG fallback display");
      
      // Hide the original image element
      imgElement.style.display = 'none';
      
      // Get the dimensions from state or use defaults
      const width = state.selectedAsset.width || 300;
      const height = state.selectedAsset.height || 300;
      
      // Create a placeholder element
      const fallbackElement = document.createElement('div');
      fallbackElement.id = 'svg-fallback';
      fallbackElement.style.width = `${width}px`;
      fallbackElement.style.height = `${height}px`;
      fallbackElement.style.backgroundColor = '#f5f5f5';
      fallbackElement.style.border = '1px solid #ddd';
      fallbackElement.style.display = 'flex';
      fallbackElement.style.alignItems = 'center';
      fallbackElement.style.justifyContent = 'center';
      fallbackElement.style.position = 'relative';
      fallbackElement.style.zIndex = '2';
      
      // Add SVG icon and text
      fallbackElement.innerHTML = `
        <div style="text-align: center;">
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2">
            <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
            <circle cx="8" cy="8" r="2"></circle>
            <polyline points="16 16 10 10"></polyline>
          </svg>
          <p style="margin-top: 10px; color: #666; font-size: 14px;">
            SVG (${width}×${height})
          </p>
        </div>
      `;
      
      // Insert the fallback before the crop overlay
      cropContainer.insertBefore(fallbackElement, cropOverlay);
      
      // Set the crop container dimensions
      cropContainer.style.width = `${width}px`;
      cropContainer.style.height = `${height}px`;
      
      // Update the crop values display
      updateCropValues();
      
      // Set up drag and resize functionality for the crop overlay
      setupCropOverlayInteractions(width, height);
    };
    
    // Special handling for SVG images
    if (isSvg) {
      // Try to fetch SVG content directly and render it as an object instead of img
      fetch(getProxiedImageUrl(state.selectedAsset.url))
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch SVG');
          return response.text();
        })
        .then(svgContent => {
          try {
            // Create a container for the SVG content
            const svgContainer = document.createElement('div');
            svgContainer.id = 'svg-container';
            svgContainer.style.position = 'relative';
            svgContainer.style.zIndex = '2';
            svgContainer.style.display = 'flex';
            svgContainer.style.alignItems = 'center';
            svgContainer.style.justifyContent = 'center';
            svgContainer.innerHTML = svgContent;
            
            // Get the SVG element
            const svgElement = svgContainer.querySelector('svg');
            if (!svgElement) throw new Error('No SVG element found in content');
            
            // Set dimensions based on what we know about the SVG
            const width = state.selectedAsset.width || 
                        svgElement.getAttribute('width') || 
                        (svgElement.viewBox && svgElement.viewBox.baseVal.width) || 
                        300;
                        
            const height = state.selectedAsset.height || 
                          svgElement.getAttribute('height') || 
                          (svgElement.viewBox && svgElement.viewBox.baseVal.height) || 
                          300;
            
            // SCALING LOGIC
            // ----------------------------------------------
            
            // Store original dimensions for reference
            const originalWidth = width;
            const originalHeight = height;
            let scale = 1;
            
            // Case 1: Scale up small SVGs to a minimum size for better cropping experience
            const MIN_CROP_DIMENSION = 150; // Minimum size for better usability
            
            if (width < MIN_CROP_DIMENSION || height < MIN_CROP_DIMENSION) {
              // Find which dimension needs more scaling
              const scaleX = MIN_CROP_DIMENSION / width;
              const scaleY = MIN_CROP_DIMENSION / height;
              scale = Math.max(Math.min(scaleX, scaleY), 1); // Always scale up, capped at 5x
              scale = Math.min(scale, 5); // Cap at 5x to prevent extreme scaling
            }
            
            // Case 2: Scale down large SVGs to maximum size
            const MAX_CROP_DIMENSION = 500; // Maximum size as per requirement
            const TARGET_MAX_DIMENSION = 480; // Target slightly below max for some margin
            
            if (width > MAX_CROP_DIMENSION || height > MAX_CROP_DIMENSION) {
              // Calculate scale factors to bring dimensions under maximum
              const scaleDownX = MAX_CROP_DIMENSION / width;
              const scaleDownY = MAX_CROP_DIMENSION / height;
              
              // Use the smaller scale factor to ensure both dimensions are below max
              const scaleDown = Math.min(scaleDownX, scaleDownY);
              
              // Adjust scale to target around 480px for the larger dimension
              // This keeps us safely under 500px while not being too small
              const largerDimension = Math.max(width, height);
              const idealScale = TARGET_MAX_DIMENSION / largerDimension;
              
              // Update the scale
              scale = idealScale;
              
              // console.log(`Scaling large SVG down by factor of ${scale} from ${width}×${height}`);
            }
            
            // Apply scaled dimensions - ensure we have a minimum size
            const MIN_DISPLAY_SIZE = 45; // Minimum size to ensure visibility
            let displayWidth = Math.round(width * scale);
            let displayHeight = Math.round(height * scale);
            
            // If dimensions are still too small after scaling, enforce minimum
            if (displayWidth < MIN_DISPLAY_SIZE || displayHeight < MIN_DISPLAY_SIZE) {
              const smallestDim = Math.min(displayWidth, displayHeight);
              const additionalScale = MIN_DISPLAY_SIZE / smallestDim;
              displayWidth = Math.round(displayWidth * additionalScale);
              displayHeight = Math.round(displayHeight * additionalScale);
              // console.log(`Enforcing minimum display size: ${displayWidth}×${displayHeight}`);
            }
            
            // console.log(`Final display dimensions: ${displayWidth}×${displayHeight} (scaled from ${width}×${height})`);
            
            // ----------------------------------------------
            
            // Update SVG element dimensions and styling
            // For small SVGs, we need to make sure the dimensions are applied more forcefully
            svgElement.setAttribute('width', displayWidth);
            svgElement.setAttribute('height', displayHeight);
            svgElement.style.width = `${displayWidth}px`;
            svgElement.style.height = `${displayHeight}px`;
            // Force the SVG to respect the new dimensions
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svgElement.style.maxWidth = '100%';
            svgElement.style.display = 'block';
            
            // Hide the original image element and insert SVG container
            imgElement.style.display = 'none';
            cropContainer.insertBefore(svgContainer, cropOverlay);
            
            // Add a debug overlay to visualize the actual dimensions (can be removed in production)
            const debugBox = document.createElement('div');
            debugBox.style.position = 'absolute';
            debugBox.style.border = '1px dashed red';
            debugBox.style.width = `${displayWidth}px`;
            debugBox.style.height = `${displayHeight}px`;
            debugBox.style.top = '0';
            debugBox.style.left = '0';
            debugBox.style.zIndex = '1';
            debugBox.style.pointerEvents = 'none'; // Make sure it doesn't interfere with interaction
            svgContainer.appendChild(debugBox);
            
            // Update crop container dimensions with the scaled values
            cropContainer.style.width = `${displayWidth}px`;
            cropContainer.style.height = `${displayHeight}px`;
            
            // Store original dimensions in a data attribute for reference when cropping
            cropContainer.dataset.originalWidth = originalWidth;
            cropContainer.dataset.originalHeight = originalHeight;
            cropContainer.dataset.scaleFactor = scale;
            
            // Update the crop values display
            updateCropValues();
            
            // Set up crop interactions
            setupCropOverlayInteractions(originalWidth, originalHeight);
          } catch (error) {
            console.error("Error rendering SVG content:", error);
            showSvgFallback();
          }
        })
        .catch(error => {
          console.error("Error fetching SVG:", error);
          showSvgFallback();
        });
    } else {
      // Regular image handling (non-SVG)
      imgElement.onload = function() {
        // console.log("Image loaded with dimensions:", imgElement.offsetWidth, "x", imgElement.offsetHeight);
        
        // Measure the actual rendered image dimensions
        const imgRect = imgElement.getBoundingClientRect();
        
        // Set crop container dimensions to match image dimensions exactly
        cropContainer.style.width = `${imgRect.width}px`;
        cropContainer.style.height = `${imgRect.height}px`;
        
        // Update the crop values display
        updateCropValues();
        
        // Set up crop interactions
        setupCropOverlayInteractions(imgRect.width, imgRect.height);
      };
      
      imgElement.onerror = function(error) {
        console.error("Error loading image:", error);
        // Show a generic fallback for non-SVG images
        imgElement.src = '/file.svg';
        imgElement.style.width = '300px';
        imgElement.style.height = '300px';
        cropContainer.style.width = '300px';
        cropContainer.style.height = '300px';
        updateCropValues();
        setupCropOverlayInteractions(300, 300);
      };
    }
    
    // Function to set up the crop overlay interactions
    function setupCropOverlayInteractions(containerWidth, containerHeight) {
      let isDragging = false;
      let activeHandle = null;
      let startX, startY, startLeft, startTop, startWidth, startHeight;
      
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
        
        // Add document listeners
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
      
      function onMouseMove(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        // Calculate aspect ratio
        const aspectRatio = startWidth / startHeight;
        
        // Get the container rect
        const containerRect = cropContainer.getBoundingClientRect();
        
        // Calculate the current position in percentage
        const currentXPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        const currentYPercent = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        
        // Ensure values are within bounds
        const boundedX = Math.max(0, Math.min(100, currentXPercent));
        const boundedY = Math.max(0, Math.min(100, currentYPercent));
        
        // Calculate initial drag position in percentage
        const startXPercent = ((startX - containerRect.left) / containerRect.width) * 100;
        const startYPercent = ((startY - containerRect.top) / containerRect.height) * 100;
        
        // Handle different drag actions
        switch (activeHandle) {
          case 'move':
            // Move logic
            const deltaX = boundedX - startXPercent;
            const deltaY = boundedY - startYPercent;
            
            let newX = startLeft + deltaX;
            let newY = startTop + deltaY;
            
            // Ensure within bounds
            newX = Math.max(0, Math.min(100 - state.crop.width, newX));
            newY = Math.max(0, Math.min(100 - state.crop.height, newY));
            
            state.crop.x = newX;
            state.crop.y = newY;
            break;
            
          case 'tl': // Top-left corner - maintain aspect ratio
            let tlWidth = startWidth + startLeft - boundedX;
            let tlHeight = startHeight + startTop - boundedY;
            
            // Maintain aspect ratio
            if ((tlWidth / aspectRatio) > tlHeight) {
              tlHeight = tlWidth / aspectRatio;
            } else {
              tlWidth = tlHeight * aspectRatio;
            }
            
            // Apply minimums
            tlWidth = Math.max(10, tlWidth);
            tlHeight = Math.max(10, tlHeight);
            
            // Update state
            state.crop.x = Math.min(startLeft + startWidth - tlWidth, 100 - tlWidth);
            state.crop.y = Math.min(startTop + startHeight - tlHeight, 100 - tlHeight);
            state.crop.width = tlWidth;
            state.crop.height = tlHeight;
            break;
            
          case 'tr': // Top-right corner - MAINTAIN ASPECT RATIO
            // Width increases as x moves right, but position stays the same
            // Height decreases as y moves up, and y position needs to change
            
            // Calculate the new width and height
            let trWidth = boundedX - startLeft;
            let trHeight = startHeight + startTop - boundedY;
            
            // Get the dimension that will maintain aspect ratio
            if ((trWidth / aspectRatio) > trHeight) {
              // Width is dominant, calculate height from width
              trHeight = trWidth / aspectRatio;
            } else {
              // Height is dominant, calculate width from height
              trWidth = trHeight * aspectRatio;
            }
            
            // Apply minimums
            trWidth = Math.max(10, trWidth);
            trHeight = Math.max(10, trHeight);
            
            // Update state - only need to adjust y position 
            state.crop.y = Math.min(startTop + startHeight - trHeight, 100 - trHeight);
            state.crop.width = trWidth;
            state.crop.height = trHeight;
            break;
            
          case 'bl': // Bottom-left corner - MAINTAIN ASPECT RATIO
            // Width decreases as x moves left, and x position needs to change
            // Height increases as y moves down, but position stays the same
            
            // Calculate the new width and height
            let blWidth = startWidth + startLeft - boundedX;
            let blHeight = boundedY - startTop;
            
            // Get the dimension that will maintain aspect ratio
            if ((blWidth / aspectRatio) > blHeight) {
              // Width is dominant, calculate height from width
              blHeight = blWidth / aspectRatio;
            } else {
              // Height is dominant, calculate width from height
              blWidth = blHeight * aspectRatio;
            }
            
            // Apply minimums
            blWidth = Math.max(10, blWidth);
            blHeight = Math.max(10, blHeight);
            
            // Update state - only need to adjust x position
            state.crop.x = Math.min(startLeft + startWidth - blWidth, 100 - blWidth);
            state.crop.width = blWidth;
            state.crop.height = blHeight;
            break;
            
          case 'br': // Bottom-right corner - MAINTAIN ASPECT RATIO
            // Both width and height increase, no position changes
            
            // Calculate the new width and height
            let brWidth = boundedX - startLeft;
            let brHeight = boundedY - startTop;
            
            // Get the dimension that will maintain aspect ratio
            if ((brWidth / aspectRatio) > brHeight) {
              // Width is dominant, calculate height from width
              brHeight = brWidth / aspectRatio;
            } else {
              // Height is dominant, calculate width from height
              brWidth = brHeight * aspectRatio;
            }
            
            // Apply minimums
            brWidth = Math.max(10, brWidth);
            brHeight = Math.max(10, brHeight);
            
            // Update state
            state.crop.width = brWidth;
            state.crop.height = brHeight;
            break;
            
          case 't': // Top edge - only changes height and y
            let tHeight = startHeight + startTop - boundedY;
            tHeight = Math.max(10, tHeight);
            
            state.crop.y = Math.min(startTop + startHeight - tHeight, 100 - tHeight);
            state.crop.height = tHeight;
            break;
            
          case 'r': // Right edge - only changes width
            let rWidth = boundedX - startLeft;
            rWidth = Math.max(10, rWidth);
            
            state.crop.width = rWidth;
            break;
            
          case 'b': // Bottom edge - only changes height
            let bHeight = boundedY - startTop;
            bHeight = Math.max(10, bHeight);
            
            state.crop.height = bHeight;
            break;
            
          case 'l': // Left edge - only changes width and x
            let lWidth = startWidth + startLeft - boundedX;
            lWidth = Math.max(10, lWidth);
            
            state.crop.x = Math.min(startLeft + startWidth - lWidth, 100 - lWidth);
            state.crop.width = lWidth;
            break;
        }
        
        // Ensure crop box stays within bounds
        if (state.crop.x < 0) {
          state.crop.width += state.crop.x;
          state.crop.x = 0;
        }
        
        if (state.crop.y < 0) {
          state.crop.height += state.crop.y;
          state.crop.y = 0;
        }
        
        if (state.crop.x + state.crop.width > 100) {
          state.crop.width = 100 - state.crop.x;
        }
        
        if (state.crop.y + state.crop.height > 100) {
          state.crop.height = 100 - state.crop.y;
        }
        
        // Update the crop overlay position and values
        updateCropOverlay();
        updateCropValues();
      }
      
      function onMouseUp() {
        isDragging = false;
        activeHandle = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      
      // Update crop overlay position and size
      function updateCropOverlay() {
        cropOverlay.style.top = `${state.crop.y}%`;
        cropOverlay.style.left = `${state.crop.x}%`;
        cropOverlay.style.width = `${state.crop.width}%`;
        cropOverlay.style.height = `${state.crop.height}%`;
      }
      
      // Attach event listeners
      cropOverlay.addEventListener('mousedown', onMouseDown);
      
      const handles = cropOverlay.querySelectorAll('[data-handle]');
      handles.forEach(handle => {
        handle.addEventListener('mousedown', onMouseDown);
      });
      
      // Update overlay and values initially
      updateCropOverlay();
      updateCropValues();
    }
  }

  // Enhanced updateCropValues function that shows proper pixel dimensions
  // Enhanced updateCropValues function that shows proper pixel dimensions
  function updateCropValues() {
    const imgElement = document.getElementById('crop-image');
    if (!imgElement) return;
    
    // Get natural dimensions with fallbacks for SVGs
    const naturalWidth = state.selectedAsset.width || imgElement.naturalWidth || 150;
    const naturalHeight = state.selectedAsset.height || imgElement.naturalHeight || 150;
    
    // Calculate crop pixels using natural dimensions (with fallbacks)
    const xPixels = Math.round((state.crop.x / 100) * naturalWidth);
    const yPixels = Math.round((state.crop.y / 100) * naturalHeight);
    const widthPixels = Math.round((state.crop.width / 100) * naturalWidth);
    const heightPixels = Math.round((state.crop.height / 100) * naturalHeight);
    
    // Update display
    const xValueElement = document.getElementById('crop-x-value');
    const yValueElement = document.getElementById('crop-y-value');
    const widthValueElement = document.getElementById('crop-width-value');
    const heightValueElement = document.getElementById('crop-height-value');
    
    if (xValueElement) xValueElement.textContent = xPixels;
    if (yValueElement) yValueElement.textContent = yPixels;
    if (widthValueElement) widthValueElement.textContent = widthPixels;
    if (heightValueElement) heightValueElement.textContent = heightPixels;
  }

  // Function to crop the image using canvas with proper handling for transparency
  // Function to crop the image using canvas with proper handling for transparency
  async function cropImage() {
    const imgElement = document.getElementById('crop-image');
    if (!imgElement || !state.crop.width || !state.crop.height) {
      throw new Error('Invalid image reference or crop dimensions');
    }

    // Get dimensions from the state or fallback to natural dimensions
    const naturalWidth = state.selectedAsset.width || imgElement.naturalWidth || 150;
    const naturalHeight = state.selectedAsset.height || imgElement.naturalHeight || 150;

    // Calculate crop dimensions
    const cropX = Math.round((state.crop.x / 100) * naturalWidth);
    const cropY = Math.round((state.crop.y / 100) * naturalHeight);
    const cropWidth = Math.round((state.crop.width / 100) * naturalWidth);
    const cropHeight = Math.round((state.crop.height / 100) * naturalHeight);

    // Create canvas for cropping
    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    // Create a new image with proper CORS settings
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          // Determine if we should preserve transparency
          const shouldPreserveTransparency = state.selectedAsset.fileType === 'image/png' || 
                                            state.selectedAsset.url.toLowerCase().endsWith('.png') ||
                                            isSvgAsset(state.selectedAsset);
          
          if (!shouldPreserveTransparency) {
            // Fill with white background for non-transparent images
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, cropWidth, cropHeight);
          }
          
          // Draw the cropped portion
          ctx.drawImage(
            img,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
          );
          
          // Get data URL with appropriate format
          const format = shouldPreserveTransparency ? 'image/png' : 'image/jpeg';
          const quality = shouldPreserveTransparency ? 1.0 : 0.92; // Higher quality for PNG
          const dataUrl = canvas.toDataURL(format, quality);
          
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

  // Update the handleFinishCropping function to automatically reload assets after cropping
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
      
      // Get crop dimensions for tracking
      const cropData = {
        x: state.crop.x,
        y: state.crop.y,
        width: state.crop.width,
        height: state.crop.height,
        originalWidth: state.selectedAsset.width || 0,
        originalHeight: state.selectedAsset.height || 0
      };
      
      // Track the crop start event
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAssetAction('image_crop_started_INDESIGNER', state.selectedAsset, cropData);
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
          : (state.selectedAsset.fileType === 'image/png' ? 'png' : 'jpg');
        
        // Use timestamp for uniqueness
        const timestamp = new Date().getTime();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const croppedFilename = `cropped_${timestamp}_${randomStr}.${fileExt}`;
        
        // Create File object with appropriate MIME type
        const fileType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
        croppedFile = new File([blob], croppedFilename, { type: fileType });
      }
      
      // Get the current site ID
      const currentSiteId = await getCurrentWebflowSiteId();
      if (!currentSiteId) {
        throw new Error('Could not determine the current site ID');
      }
      
      // Upload to Webflow
      const formData = new FormData();
      formData.append('file', croppedFile);
      
      // Create URL with site ID as query parameter
      const uploadUrl = `${API_BASE_URL}/api/direct-upload-webflow-image?siteId=${currentSiteId}`;
      
      // Make the request
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.webflowToken}`,
          'x-webflow-site': currentSiteId
        },
        body: formData
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Upload failed with status:", uploadResponse.status);
        console.error("Response text:", errorText);
        
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          errorData = { message: 'Unknown error', details: errorText };
        }
        
        throw new Error(`Failed to upload: ${errorData.message || 'Unknown error'}`);
      }
      
      // Add tracking after successful upload
      const uploadResult = await uploadResponse.json();
      
      // Track successful crop
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAssetAction('image_crop_completed_INDESIGNER', state.selectedAsset, {
          ...cropData,
          success: true,
          isSvg: isSvg,
          uploadResultUrl: uploadResult.imageUrl
        });
      }
      
      // Update the selected asset with the new asset information
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
      
      // Show notification popup
      showPopupNotification({
        type: 'success',
        title: 'Success!',
        message: "Image has been cropped and uploaded to Webflow. Click 'Continue' to return to the Assets Browser window. Your changes will be visible on Page 1. To see them live in Webflow, just reload the site's page.",
        onClose: () => {
          // Auto-reload assets before redirecting back
          autoReloadAssets().then(() => {
            // Redirect back to assets browser after reload completes
            state.currentView = 'assets-browser';
            renderApp(document.getElementById('root'));
          });
        }
      });
    } catch (error) {
      console.error('Error during crop operation:', error);

      // Track crop failure
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAssetAction('image_crop_failed_INDESIGNER', state.selectedAsset, {
          error: error.message || 'Unknown error',
          cropX: state.crop.x,
          cropY: state.crop.y,
          cropWidth: state.crop.width,
          cropHeight: state.crop.height
        });
      }
      
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
    return `${API_BASE_URL}/api/proxy-image?url=${encodedUrl}`;
  }
  
  function getFilenameFromUrl(url) {
    if (!url) return 'Unnamed asset';
    // console.log("Extracting filename from URL:", url)
    
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

  // Function to detect image format from file type or URL
  function detectImageFormat(asset) {
    if (!asset) return 'No Asset Selected';
    
    // Check if fileType is available
    if (asset.fileType) {
      if (asset.fileType.includes('png')) return 'Compress in PNG';
      if (asset.fileType.includes('jpeg') || asset.fileType.includes('jpg')) {
        // Check the actual file extension to be more precise
        if (asset.url && asset.url.toLowerCase().endsWith('.jpg')) {
          return 'Compress in JPG';
        } else {
          return 'Compress in JPEG';
        }
      }
      if (asset.fileType.includes('webp')) return 'Compress in WebP';
    }
    
    // Fallback to checking URL extension
    if (asset.url) {
      const url = asset.url.toLowerCase();
      if (url.endsWith('.png')) return 'Compress in PNG';
      if (url.endsWith('.jpeg')) return 'Compress in JPEG';
      if (url.endsWith('.jpg')) return 'Compress in JPG';
      if (url.endsWith('.webp')) return 'Compress in WebP';
    }
    
    // Default fallback
    return 'Compress N/A';
  }
  
  // Modified version that doesn't return a Promise
  function createCompressButton(asset) {
    // Default to not notified - we'll check asynchronously and update later
    let isNotified = localStorage.getItem('notified_feature_image-compression') === 'true';
    
    // Set the initial notification text based on localStorage
    const notifyText = isNotified ? 'You will be notified!' : 'Notify when released';
    const notifyClass = isNotified ? 'notify-success' : '';
    
    // Create a unique ID for this button so we can update it later
    const buttonId = `notify-btn-${asset.id}`;
    
    // Return the initial button HTML
    const html = `
      <div class="action-button coming-soon-container" title="Compression feature coming soon">
        <span class="coming-soon-text">COMING SOON</span>
        <a href="#" id="${buttonId}" class="notify-link ${notifyClass}" data-action="notify">${notifyText}</a>
      </div>
    `;
    
    // Immediately check the notification status from the server
    // This happens after the button is rendered
    checkNotificationStatus(asset.id, buttonId);
    
    return html;
  }

  // Function to check notification status and update the button
  function checkNotificationStatus(assetId, buttonId) {
    const token = localStorage.getItem('token');
    
    // Only check notification status if user is logged in
    if (token) {
      fetch(`${API_BASE_URL}/feature-notification/status/image-compression`, {
        method: 'GET',
        headers: {
          'token': token
        }
      })
      .then(response => {
        if (response.ok) return response.json();
        throw new Error('Failed to check notification status');
      })
      .then(result => {
        const isNotified = result.isRegistered || false;
        
        // Update localStorage for future reference
        localStorage.setItem('notified_feature_image-compression', isNotified.toString());
        
        // Find and update the button if it exists
        setTimeout(() => {
          const button = document.getElementById(buttonId);
          if (button) {
            button.textContent = isNotified ? 'You will be notified!' : 'Notify when released';
            
            if (isNotified) {
              button.classList.add('notify-success');
            } else {
              button.classList.remove('notify-success');
            }
          }
        }, 0);
      })
      .catch(error => {
        console.error('Error checking notification status:', error);
        // We already used the localStorage fallback, so nothing to do here
      });
    }
  }

  // Modify the handleNotifyClick function to track notification subscription events
  function handleNotifyClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Get the button that was clicked
    const notifyButton = event.target;
    
    // Check if the user is already notified (based on button text)
    if (notifyButton.textContent === 'You will be notified!') {
      // User is already registered, show a small reminder popup
      showPopupNotification({
        type: 'info',
        title: 'Already Registered',
        message: 'You\'re already registered to be notified when this feature is released.'
      });
      
      // Track reminder event
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAuth('compression_notification_reminder_INDESIGNER', {
          already_registered: true,
          asset_id: state.selectedAsset?.id
        });
      }
      
      return;
    }
    
    // First check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      // Show login popup if user is not logged in
      showCompressionAuthPopup();
      
      // Track auth required event
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAuth('compression_notification_auth_required_INDESIGNER', {
          asset_id: state.selectedAsset?.id
        });
      }
      
      return;
    }
    
    // Show loading state
    const loadingNotification = showPopupNotification({
      type: 'info',
      title: 'Processing',
      message: 'Registering you for feature notifications...'
    });
    
    // Determine which feature the user wants to be notified about
    const featureId = 'image-compression';
    
    // Track notification request started
    if (window.posthogAnalytics) {
      window.posthogAnalytics.trackAuth('compression_notification_requested_INDESIGNER', {
        feature_id: featureId,
        asset_id: state.selectedAsset?.id
      });
    }
    
    // Call the API endpoint to register for notifications
    fetch(`${API_BASE_URL}/feature-notification/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': token
      },
      body: JSON.stringify({ featureId })
    })
    .then(response => response.json())
    .then(data => {
      // Close the loading notification
      if (loadingNotification) loadingNotification();
      
      if (data.success) {
        // Update the button text to show user is now registered
        // Find all notify links in the document and update them
        const notifyLinks = document.querySelectorAll('.notify-link');
        notifyLinks.forEach(link => {
          link.textContent = 'You will be notified!';
          // Add a success style to the link
          link.classList.add('notify-success');
        });
        
        // Also store in localStorage as a cache for quicker UI updates
        localStorage.setItem(`notified_feature_${featureId}`, 'true');
        
        // Show success notification
        showPopupNotification({
          type: 'success',
          title: 'Notification Set',
          message: data.msg || 'You will be notified when this feature is released.'
        });
        
        // Track notification success
        if (window.posthogAnalytics) {
          window.posthogAnalytics.trackAuth('compression_notification_subscribed_INDESIGNER', {
            feature_id: featureId,
            success: true,
            asset_id: state.selectedAsset?.id
          });
        }
      } else {
        // Show error notification
        showPopupNotification({
          type: 'error',
          title: 'Error',
          message: data.msg || 'Failed to register for notifications. Please try again.',
          onClose: () => {
            // Close any open selection notifications if there was an error
            const existingNotification = document.querySelector('.image-selection-notification');
            if (existingNotification) {
              existingNotification.remove();
            }
          }
        });
        
        // Track notification failure
        if (window.posthogAnalytics) {
          window.posthogAnalytics.trackAuth('compression_notification_failed_INDESIGNER', {
            feature_id: featureId,
            error: data.msg || 'API request failed',
            asset_id: state.selectedAsset?.id
          });
        }
      }
    })
    .catch(error => {
      // Close the loading notification
      if (loadingNotification) loadingNotification();
      
      console.error('Error registering for notifications:', error);
      
      // Show error notification
      showPopupNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to connect to the server. Please try again later.',
        onClose: () => {
          // Close any open selection notifications
          const existingNotification = document.querySelector('.image-selection-notification');
          if (existingNotification) {
            existingNotification.remove();
          }
        }
      });
      
      // Track connection error
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAuth('compression_notification_error_INDESIGNER', {
          feature_id: featureId,
          error: error.message || 'Connection error',
          asset_id: state.selectedAsset?.id
        });
      }
    });
  }

  // Update 1: modify the showImageSelectionNotification function to add dots-icon-active class
  function showImageSelectionNotification(asset) {
    // First, remove active class from any previously activated dots
    const allActiveDotsIcons = document.querySelectorAll('.dots-icon-active');
    allActiveDotsIcons.forEach(icon => {
      icon.classList.remove('dots-icon-active');
    });
    
    // Remove any existing notification
    const existingNotification = document.querySelector('.image-selection-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'image-selection-notification dropdown-menu';
    
    // Find the selected asset element in the DOM
    const assetElement = document.querySelector(`[data-asset-id="${asset.id}"]`);
    
    if (!assetElement) {
      console.error('Could not find asset element in DOM');
      return;
    }
    
    // Find the three dots button
    const dotsButton = assetElement.querySelector('.asset-options');
    if (!dotsButton) {
      console.error('Could not find three dots button');
      return;
    }
    
    // Add active class to the dots icon when opening the dropdown
    const dotsIcon = dotsButton.querySelector('.dots-icon');
    if (dotsIcon) {
      dotsIcon.classList.add('dots-icon-active');
    }
    
    // Get the position of the three dots button
    const dotsRect = dotsButton.getBoundingClientRect();
    
    // Create the dropdown menu content
    const compressButtonHtml = createCompressButton(asset);

    // Create the notification content without arrow
    notification.innerHTML = `
      <div class="dropdown-content">
        <button class="dropdown-item" data-action="resize">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 3 21 3 21 9"></polyline>
            <polyline points="9 21 3 21 3 15"></polyline>
            <line x1="21" y1="3" x2="14" y2="10"></line>
            <line x1="3" y1="21" x2="10" y2="14"></line>
          </svg>
          <span>Resize</span>
        </button>
        <button class="dropdown-item" data-action="crop">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6.13 1L6 16a2 2 0 0 0 2 2h15"></path>
            <path d="M1 6.13L16 6a2 2 0 0 1 2 2v15"></path>
          </svg>
          <span>Crop</span>
        </button>
        <div class="dropdown-item coming-soon" title="Compression Feature">
          <span class="coming-soon-text">Feature, Coming soon!</span>
          <a href="#" class="notify-link ${compressButtonHtml.includes('notify-success') ? 'notify-success' : ''}" data-action="notify">
            ${compressButtonHtml.includes('You will be notified!') ? 'You will be notified!' : 'Notify when released'}
          </a>
        </div>
      </div>
    `;
    
    const style = document.createElement('style');
    style.textContent = `
      .dots-icon-active {
        background-color: rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        padding: 2px;
        transition: background-color 0.3s ease;
      }
      
      .dropdown-menu {
        position: absolute;
        z-index: 1000;
        font-family: 'Roboto', sans-serif;
      }
      
      .dropdown-content {
        background-color: white;
        border: 1px solid #ddd;
        border-radius: 16px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
        width: 175px;
        overflow: hidden;
        margin-left: 5px;
      }
      
      .dropdown-item {
        display: flex;
        align-items: center;
        padding: 12px 15px;
        border: none;
        background: none;
        width: 100%;
        text-align: left;
        cursor: pointer;
        font-size: 14px;
      }
      
      .dropdown-item:not(:last-child) {
        border-bottom: 1px solid #eee;
      }
      
      .dropdown-item:hover {
        background-color: #f5f5f5;
      }
      
      .dropdown-item svg {
        margin-right: 8px;
      }
      
      .coming-soon {
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        cursor: default;
      }
      
      .coming-soon-text {
        font-weight: 500;
        color: #e98537;
        margin-bottom: 5px;
        display: flex;
        align-items: center;
      }
      
      .notify-link {
        font-size: 12px;
        color: #2563eb;
        text-decoration: none;
        cursor: pointer;
      }

      .notify-link:hover {
        text-decoration: underline;
      }
      
      .notify-success {
        color: #047857 !important;
        font-weight: 500;
        text-decoration: none !important;
      }

      .notify-success:hover {
        text-decoration: none !important;
        color: #047857 !important;
      }
    `;
    
    if (!document.querySelector('style#dropdown-menu-styles')) {
      style.id = 'dropdown-menu-styles';
      document.head.appendChild(style);
    }
    
    // Calculate the absolute position where the dropdown should be placed
    // Position it above the dots button
    const absoluteX = window.pageXOffset + dotsRect.left - 170; // Align right edge near dots
    const absoluteY = window.pageYOffset + dotsRect.top - 10 - notification.offsetHeight - 150; // Position above dots
    
    // Position the notification
    notification.style.left = `${absoluteX}px`;
    notification.style.top = `${absoluteY}px`;
    
    // Add to document
    document.body.appendChild(notification);
    
    // Position again now that we have dimensions
    const notificationRect = notification.getBoundingClientRect();
    notification.style.top = `${window.pageYOffset + dotsRect.top - notificationRect.height - 10}px`;
    
    // Add click outside to close
    document.addEventListener('click', function closeOnClickOutside(e) {
      if (!notification.contains(e.target) && 
          e.target !== dotsButton && 
          !dotsButton.contains(e.target)) {
        // Remove the active class from dots icon when closing the dropdown
        if (dotsIcon) {
          dotsIcon.classList.remove('dots-icon-active');
        }
        
        notification.remove();
        document.removeEventListener('click', closeOnClickOutside);
      }
    });

    const notifyLinks = notification.querySelectorAll('.notify-link');
    notifyLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        handleNotifyClick(e);
      });
    });
    
    // Add event listeners for dropdown buttons
    const actionButtons = notification.querySelectorAll('.dropdown-item:not(.coming-soon)');
    actionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        
        // Remove active class from dots icon when an action is selected
        if (dotsIcon) {
          dotsIcon.classList.remove('dots-icon-active');
        }
        
        // Close the notification
        notification.remove();
        
        // Only update selectAsset if not already selected
        if (state.selectedAsset?.id !== asset.id) {
          selectAsset(asset);
        }
        
        // Navigate to the appropriate view based on the action
        switch (action) {
          case 'resize':
            state.resizeMode = 'specific-assets';
            state.cropMode = null;
            state.currentView = 'resize';
            break;
          case 'crop':
            state.cropMode = 'specific-assets';
            state.resizeMode = null;
            state.currentView = 'crop';
            break;
          case 'notify':
            handleNotifyClick(e);
            return;
        }
        
        // Update the UI
        renderApp(document.getElementById('root'));
      });
    });
    
    // Add animation
    notification.animate(
      [
        { opacity: 0, transform: 'translateY(5px)' },
        { opacity: 1, transform: 'translateY(0)' }
      ],
      {
        duration: 200,
        easing: 'ease-out'
      }
    );
  }

  // New function to just update selection UI without re-rendering everything
  function updateSelectedAssetUI(asset) {
    // First remove selection from all asset items
    const assetItems = document.querySelectorAll('.asset-item');
    assetItems.forEach(item => {
      item.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500');
    });
    
    // Add selection highlight to the selected asset
    // const selectedItem = document.querySelector(`[data-asset-id="${asset.id}"]`);
    // if (selectedItem) {
    //   selectedItem.classList.add('ring-2', 'ring-blue-500', 'border-blue-500');
    // }
    
    // Update any other UI elements that show selection info
    // For example, enable buttons that require selection
    const actionButtons = document.querySelectorAll('[data-requires-selection]');
    actionButtons.forEach(button => {
      button.disabled = false;
    });
  }

  // 2. Modify the selectAsset function to not show the notification automatically
  function selectAsset(asset) {
    // Set the selected asset in state
    state.selectedAsset = asset;
    
    // Only update the image selection UI, not the entire page
    updateSelectedAssetUI(asset);
    
    // Immediately load the image if it hasn't been loaded yet
    if (!state.loadedAssetIds.has(asset.id)) {
      const assetElement = document.querySelector(`[data-asset-id="${asset.id}"]`);
      if (assetElement) {
        const imgElement = assetElement.querySelector('img');
        if (imgElement) {
          imgElement.src = getProxiedImageUrl(asset.url);
          // Make sure to add the loaded class and remove placeholder class
          imgElement.classList.remove('asset-image-placeholder');
          imgElement.classList.add('asset-image-loaded');
          state.loadedAssetIds.add(asset.id);
        }
      }
    }
    
    // We no longer show the notification automatically.
    // The notification will only show when the user clicks the 3-dot menu.
    
    // Optionally, you could still preload the dimensions in the background
    // so they're ready when the user clicks the menu
    if (!asset.width || !asset.height) {
      preloadImageDimensions(asset)
        .then(assetWithDimensions => {
          // Update the asset with dimensions
          const assetIndex = state.filteredAssets.findIndex(a => a.id === asset.id);
          if (assetIndex !== -1) {
            state.filteredAssets[assetIndex] = assetWithDimensions;
            state.selectedAsset = assetWithDimensions;
            
            // Also update the full assets array
            const fullAssetIndex = state.assets.findIndex(a => a.id === asset.id);
            if (fullAssetIndex !== -1) {
              state.assets[fullAssetIndex] = assetWithDimensions;
            }
            
            // Update any dimension display in the UI
            const assetElement = document.querySelector(`[data-asset-id="${asset.id}"]`);
            if (assetElement) {
              const dimensionElement = assetElement.querySelector('.asset-dimensions');
              if (dimensionElement) {
                dimensionElement.textContent = `${assetWithDimensions.width || 'N/A'}px × ${assetWithDimensions.height || 'N/A'}px`;
              }
            }
          }
        })
        .catch(error => {
          console.error('Failed to preload dimensions:', error);
        });
    }
  }

  // Add a function to batch preload dimensions for all assets in current page
  function batchPreloadDimensions() {
    const currentAssets = getCurrentPageAssets();
    const assetsNeedingDimensions = currentAssets.filter(asset => !asset.width || !asset.height);
    
    if (assetsNeedingDimensions.length === 0) {
      console.log('No assets need dimension preloading');
      return;
    }
    
    // Process in batches to avoid overwhelming the browser
    const BATCH_SIZE = 3;
    const processBatch = (startIndex) => {
      if (startIndex >= assetsNeedingDimensions.length) {
        console.log('Finished batch preloading dimensions');
        return;
      }
      
      const batch = assetsNeedingDimensions.slice(startIndex, startIndex + BATCH_SIZE);
      
      // Create an array of promises for this batch
      const promises = batch.map(asset => {
        return preloadImageDimensions(asset)
          .then(updatedAsset => {
            // Update the asset in the filtered assets array
            const assetIndex = state.filteredAssets.findIndex(a => a.id === updatedAsset.id);
            if (assetIndex !== -1) {
              state.filteredAssets[assetIndex] = updatedAsset;
              
              // Also update in the full assets array
              const fullAssetIndex = state.assets.findIndex(a => a.id === updatedAsset.id);
              if (fullAssetIndex !== -1) {
                state.assets[fullAssetIndex] = updatedAsset;
              }
              
              // Update the dimension display in the DOM if the element exists
              const assetItem = document.querySelector(`[data-asset-id="${updatedAsset.id}"]`);
              if (assetItem) {
                const dimensionsElement = assetItem.querySelector('.asset-dimensions');
                if (dimensionsElement) {
                  dimensionsElement.textContent = `${updatedAsset.width || 'N/A'}px × ${updatedAsset.height || 'N/A'}px`;
                }
              }
            }
            return updatedAsset;
          });
      });
      
      // When this batch is done, process the next batch
      Promise.all(promises)
        .then(() => {
          setTimeout(() => {
            processBatch(startIndex + BATCH_SIZE);
          }, 200); // Add a small delay between batches
        })
        .catch(error => {
          console.error('Error in dimension preloading batch:', error);
          // Continue with next batch even if there was an error
          setTimeout(() => {
            processBatch(startIndex + BATCH_SIZE);
          }, 200);
        });
    };
    
    // Start processing the first batch
    processBatch(0);
  }
  
  // Update the preloadImageDimensions function for better error handling and logging
  function preloadImageDimensions(asset) {
    return new Promise((resolve, reject) => {
      // Skip if dimensions already exist
      if (asset.width && asset.height) {
        resolve(asset);
        return;
      }
      
      // Check if this is an SVG
      const isSvg = asset.url.toLowerCase().endsWith('.svg') || 
                  (asset.fileType && asset.fileType === 'image/svg+xml');
      
      // Create a proxied URL to avoid CORS issues
      const encodedUrl = encodeURIComponent(asset.url);
      const proxiedUrl = `${API_BASE_URL}/api/proxy-image?url=${encodedUrl}`;
      
      if (isSvg) {
        // For SVGs, fetch the content and parse it to extract dimensions
        fetch(proxiedUrl)
          .then(response => response.text())
          .then(svgText => {
            try {
              // Parse SVG content
              const parser = new DOMParser();
              const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
              const svgElement = svgDoc.documentElement;
              
              // Try to get dimensions from the SVG
              let width = svgElement.getAttribute('width');
              let height = svgElement.getAttribute('height');
              const viewBox = svgElement.getAttribute('viewBox');
              
              // If no width/height but has viewBox, extract from viewBox
              if ((!width || !height) && viewBox) {
                const viewBoxParts = viewBox.split(' ');
                if (viewBoxParts.length === 4) {
                  width = width || viewBoxParts[2];
                  height = height || viewBoxParts[3];
                }
              }
              
              // Parse dimensions to numbers, use defaults if parsing fails
              width = parseFloat(width) || 150;   // Default width if can't determine
              height = parseFloat(height) || 150; // Default height if can't determine
              
              // Return asset with dimensions
              resolve({
                ...asset,
                width: width,
                height: height
              });
            } catch (error) {
              console.error(`Error parsing SVG for asset ${asset.id}:`, error);
              // Use default dimensions as fallback
              resolve({
                ...asset,
                width: 150,
                height: 150
              });
            }
          })
          .catch(error => {
            console.error(`Failed to fetch SVG for asset ${asset.id}:`, error);
            // Use default dimensions as fallback
            resolve({
              ...asset,
              width: 150,
              height: 150
            });
          });
      } else {
        // For raster images, use the Image approach
        const img = new Image();
        
        // Set a timeout to avoid hanging too long on problem images
        const timeoutId = setTimeout(() => {
          console.warn(`Timeout loading dimensions for asset ${asset.id}`);
          resolve({
            ...asset,
            width: 150,  // Default fallback width
            height: 150  // Default fallback height
          });
        }, 5000); // 5 second timeout
        
        img.onload = () => {
          clearTimeout(timeoutId);
          
          // Check if dimensions are valid
          const width = img.naturalWidth || 150;
          const height = img.naturalHeight || 150;
          
          resolve({
            ...asset,
            width: width,
            height: height
          });
        };
        
        img.onerror = (err) => {
          clearTimeout(timeoutId);
          console.error(`Failed to load image for asset ${asset.id}:`, err);
          
          // Resolve with fallback dimensions instead of rejecting
          resolve({
            ...asset,
            width: 150,
            height: 150
          });
        };
        
        img.src = proxiedUrl;
      }
    });
  }
  
  // Also update the applyFiltersAndSearch function to not reset to page 1 when a selection is made
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
    
    // Only reset to first page when filters or search terms change, not when just selecting an asset
    // Add a flag to check if this function was called due to a filter/search change
    if (state.isFilterOrSearchChange) {
      state.currentPage = 1;
      state.isFilterOrSearchChange = false;
    }
  }

  // Function to get current Webflow site ID using the Webflow API
  async function getCurrentWebflowSiteId() {
    try {
      // First try to use the Webflow API if available
      if (window.webflow && window.webflow.getSiteInfo) {
        const siteInfo = await window.webflow.getSiteInfo();
        
        if (siteInfo && siteInfo.siteId) {
          // Store the site ID for later use
          localStorage.setItem('currentWebflowSiteId', siteInfo.siteId);
          
          console.log('Current Site Info from API:', {
            siteId: siteInfo.siteId,
            siteName: siteInfo.siteName || siteInfo.shortName || 'Webflow Site'
          });
          
          return siteInfo.siteId;
        }
      }
      
      // If the API method fails, try to get the site ID from localStorage
      const storedSiteId = localStorage.getItem('currentWebflowSiteId');
      if (storedSiteId) {
        return storedSiteId;
      }
      
      // If all else fails, try to extract it from the URL
      const urlMatch = window.location.hostname.match(/\.webflow\.io$/);
      if (urlMatch) {
        // This is likely a Webflow preview URL - try to extract the site ID
        // This is just a fallback and may not always work correctly
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1].length > 10) {
          const possibleSiteId = pathParts[1];
          // console.log('Extracted site ID from URL:', possibleSiteId);
          return possibleSiteId;
        }
      }
      
      console.error('Could not determine current site ID');
      return null;
    } catch (error) {
      console.error('Error getting site info:', error);
      return null;
    }
  }

  // Function to fetch Webflow assets with site-specific token support
  async function fetchWebflowAssets() {
    state.isLoading = true;
    state.error = null;
    renderApp(document.getElementById('root'));
    
    try {
      // Get the current site ID
      const currentSiteId = await getCurrentWebflowSiteId();
      if (!currentSiteId) {
        throw new Error('Could not determine current site ID');
      }
      
      // First check for a site-specific token
      const siteSpecificToken = localStorage.getItem(`webflow_token_${currentSiteId}`);
      
      // // Fallback to generic token if no site-specific token exists
      // const genericToken = localStorage.getItem('webflowToken');
      
      // Use site-specific token if available, otherwise use generic token
      const token = siteSpecificToken;
      
      if (!token) {
        throw new Error('No Webflow token available. Please connect your Webflow account.');
      }
      
      // Store the token in state for later use
      state.webflowToken = token;
      
      console.log('Site token - ', state.webflowToken);

      // Make the API call with the appropriate token
      const response = await fetch(`${API_BASE_URL}/api/direct-webflow-assets`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-webflow-site': currentSiteId,
          // 'Content-Type': 'application/json'
        }
      });
      
      console.log('Response - ', response);
      
      const responseData = await response.json();
      
      if (!response.ok || !responseData.success) {
        console.error('Server Error Response:', responseData);
        
        // If the token is invalid or expired, clear it and reset state
        if (response.status === 401) {
          // Clear the specific token that failed
          if (siteSpecificToken) {
            localStorage.removeItem(`webflow_token_${currentSiteId}`);
          }
          localStorage.removeItem('webflowToken');
          
          // Reset state
          state.webflowToken = null;
          state.assets = [];
          state.filteredAssets = [];
          state.selectedAsset = null;
          
          throw new Error('Authentication expired. Please reconnect your Webflow account.');
        }
        
        throw new Error(responseData.message || 'Failed to fetch assets');
      }
      
      state.assets = responseData.assets || [];
      
      // Store the site info if available
      if (responseData.siteInfo) {
        state.currentSiteInfo = responseData.siteInfo;
      }
      
      // Apply filters and search
      applyFiltersAndSearch();
    } catch (error) {
      console.error('Detailed Fetch Assets Error:', {
        message: error.message,
        stack: error.stack
      });
      
      state.error = error.message || 'Failed to load assets. Please connect your Webflow account.';
      state.needsAuthorization = true;
    } finally {
      state.isLoading = false;
      renderApp(document.getElementById('root'));
    }
  }
  
  // Initialize the extension when the DOM is fully loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebflowExtension);
  } else {
    initWebflowExtension();
  }
})();