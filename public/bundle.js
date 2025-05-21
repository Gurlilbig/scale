(function() {
  const API_BASE_URL = 'http://localhost:3001'; 
  
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
    lazyLoadObserver: null,     
    loadedAssetIds: new Set(),  
    assetPlaceholders: {},
    currentSiteInfo: null,
    eventTracker: false
  };

  
  function initPostHog() {
    
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="capture identify alias people.set people.set_once set_config register register_once unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled onFeatureFlags getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures getActiveMatchingSurveys getSurveys".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
    
    posthog.init('phc_7E8lVibe3sjH18hwID2lTu7K3IJmCotiiQN7BBTp5mi', {
      api_host: 'https://us.i.posthog.com',
      capture_pageview: false, 
      person_profiles: 'identified_only' 
    });
    
    
    window.posthogAnalytics = {
      
      trackAuth: function(eventName, properties = {}) {
        try {
          
          const userEmail = localStorage.getItem('userEmail');
          const userId = localStorage.getItem('token');
          
          if (userId) {
            
            posthog.identify(userId, {
              email: userEmail || 'unknown-email'
            });
            
            
            properties.userEmail = userEmail;
            
            
            posthog.capture(eventName, properties);
          } else {
            
            posthog.capture(eventName, properties);
          }
        } catch (error) {
          console.error('Error tracking auth event:', error);
        }
      },
      
      
      trackAssetAction: function(eventName, asset, properties = {}) {
        try {
          const userId = localStorage.getItem('token');
          
          
          const assetData = {
            assetId: asset?.id || 'unknown',
            assetName: asset?.name || getFilenameFromUrl(asset?.url) || 'unknown',
            assetType: asset?.fileType || 'unknown',
            assetDimensions: `${asset?.width || '?'}x${asset?.height || '?'}`
          };
          
          
          const eventProperties = {
            ...assetData,
            ...properties
          };
          
          
          if (userId) {
            posthog.identify(userId);
          }
          
          
          posthog.capture(eventName, eventProperties);
        } catch (error) {
          console.error('Error tracking asset event:', error);
        }
      }
    };
    
    console.log('PostHog initialized successfully');
  }

  
  const TRANSPARENT_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiNlNmU2ZTYiLz48L3N2Zz4=';

  
  function initLazyLoading() {
    try {
      
      if (state.lazyLoadObserver) {
        state.lazyLoadObserver.disconnect();
      }
      
      
      state.lazyLoadObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const assetItem = entry.target;
            const assetId = assetItem.getAttribute('data-asset-id');
            const imgElement = assetItem.querySelector('img');
            
            if (imgElement && assetId && !state.loadedAssetIds.has(assetId)) {
              
              const asset = state.filteredAssets.find(a => a.id === assetId);
              if (asset) {
                
                const actualSrc = getProxiedImageUrl(asset.url);
                
                
                const tempImg = new Image();
                tempImg.onload = () => {
                  
                  imgElement.src = actualSrc;
                  imgElement.classList.remove('loading');
                  imgElement.classList.remove('asset-image-placeholder');
                  imgElement.classList.add('asset-image-loaded');
                  
                  
                  imgElement.animate([
                    { opacity: 0.4 },
                    { opacity: 1 }
                  ], {
                    duration: 300,
                    easing: 'ease-in'
                  });
                  
                  
                  state.loadedAssetIds.add(assetId);
                };
                
                tempImg.onerror = () => {
                  
                  imgElement.src = '/file.svg';
                  imgElement.classList.remove('loading');
                  imgElement.classList.remove('asset-image-placeholder');
                  imgElement.classList.add('asset-image-loaded');
                };
                
                
                imgElement.classList.add('loading');
                tempImg.src = actualSrc;
              }
            }
            
            
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
      
      state.lazyLoadObserver = null;
    }
  }

  
  function verifyImageLoading() {
    
    setTimeout(() => {
      const assetItems = document.querySelectorAll('.asset-item');
      const loadedImages = document.querySelectorAll('.asset-image-loaded');
      
      
      if (loadedImages.length === 0 && assetItems.length > 0) {
        console.log('No images are loaded, forcing reload of all visible assets');
        
        
        state.loadedAssetIds.clear();
        
        
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
    }, 1200); 
  }

  
  function forceLoadInitialImages() {
    
    setTimeout(() => {
      
      const assetItems = document.querySelectorAll('.asset-item');
      
      if (!assetItems.length) {
        console.log('No asset items found, possibly on an empty page');
        return; 
      }
      
      
      if (!state.lazyLoadObserver) {
        console.log('Lazy load observer not initialized, reinitializing');
        initLazyLoading();
      }
      
      
      let loadedCount = 0;
      
      assetItems.forEach((item, index) => {
        const assetId = item.getAttribute('data-asset-id');
        const imgElement = item.querySelector('img');
        const dimensionsElement = item.querySelector('.text-xs.text-gray-700');
        
        if (!assetId) return;
        
        
        const asset = state.filteredAssets.find(a => a.id === assetId);
        if (!asset) return;
        
        
        if (imgElement && !state.loadedAssetIds.has(assetId)) {
          
          setTimeout(() => {
            const imageUrl = getProxiedImageUrl(asset.url);
            
            
            const preloadImg = new Image();
            preloadImg.onload = () => {
              imgElement.src = imageUrl;
              imgElement.classList.remove('loading');
              imgElement.classList.remove('asset-image-placeholder');
              imgElement.classList.add('asset-image-loaded');
              
              
              state.loadedAssetIds.add(assetId);
            };
            
            preloadImg.onerror = () => {
              
              imgElement.src = '/file.svg';
              imgElement.classList.remove('loading');
              imgElement.classList.remove('asset-image-placeholder');
              imgElement.classList.add('asset-image-loaded');
            };
            
            
            imgElement.classList.add('loading');
            preloadImg.src = imageUrl;
            
            loadedCount++;
          }, index * 30);
        }
        
        
        if (dimensionsElement && (!asset.width || !asset.height)) {
          
          setTimeout(() => {
            preloadImageDimensions(asset)
              .then(updatedAsset => {
                
                const assetIndex = state.filteredAssets.findIndex(a => a.id === assetId);
                if (assetIndex !== -1) {
                  state.filteredAssets[assetIndex] = updatedAsset;
                  
                  
                  const fullAssetIndex = state.assets.findIndex(a => a.id === assetId);
                  if (fullAssetIndex !== -1) {
                    state.assets[fullAssetIndex] = updatedAsset;
                  }
                  
                  
                  dimensionsElement.textContent = `${updatedAsset.width || 'N/A'}px × ${updatedAsset.height || 'N/A'}px`;
                }
              })
              .catch(error => {
                console.error(`Failed to preload dimensions for asset ${assetId}:`, error);
              });
          }, index * 50 + 100); 
        }
        
        
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

  
  
  setTimeout(() => {
    
    initLazyLoading();
    
    
    
    forceLoadInitialImages();
    
    
    
    setTimeout(() => {
      const loadedImages = document.querySelectorAll('.asset-image-loaded');
      if (loadedImages.length === 0) {
        console.log('No images loaded after initial attempt, forcing reload');
        
        state.loadedAssetIds.clear();
        forceLoadInitialImages();
      }
    }, 800);
    
    
  }, 50); 
  
  
  function initWebflowExtension() {
    const root = document.getElementById('root');
    if (!root) {
      console.error('Root element not found');
      return;
    }
    
    
    applyGlobalStyles();
    
    
    initPostHog();
    
    state.currentView = 'assets-browser';
    
    const jwtToken = localStorage.getItem('token2');
    
    
    if (jwtToken) {
      console.log('Found JWT token in localStorage');
      
      
      
      const tokenTimestamp = localStorage.getItem('token2_timestamp');
      if (tokenTimestamp) {
        const tokenAge = Date.now() - parseInt(tokenTimestamp);
        
        
        if (tokenAge < 5000) {
          
          setTimeout(() => {
            showPopupNotification({
              type: 'success',
              title: 'Authentication Successful',
              message: 'Your Webflow account has been connected successfully.'
            });
          }, 500);
        }
      }
    }

    renderApp(root);
    
    checkExistingWebflowConnection()
      .then(isConnected => {
        if (isConnected) {
          console.log('Using existing Webflow connection');
          
          
          if (window.posthogAnalytics) {
            window.posthogAnalytics.trackAuth('indesigner_app_loaded', {
              with_connection: true,
              view: state.currentView
            });
          }
          
          
          if (state.currentView === 'assets-browser') {
            fetchWebflowAssets();
          }
        } else {
          console.log('No existing Webflow connection found');
          
          state.needsAuthorization = true;
          
          
          if (window.posthogAnalytics) {
            window.posthogAnalytics.trackAuth('indesigner_app_loaded', {
              with_connection: false,
              auth_required: true
            });
          }
          
          
          renderApp(root);
        }
      })
      .catch(error => {
        console.error('Error checking for existing Webflow connection:', error);
        
        
        if (window.posthogAnalytics) {
          window.posthogAnalytics.trackAuth('indesigner_app_load_error', {
            error: error.message || 'Connection check failed'
          });
        }
      });
      
    
    
    const originalRenderApp = renderApp;
    renderApp = function(container) {
      
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAuth('indesigner_page_view', {
          view: state.currentView,
          has_selection: !!state.selectedAsset
        });
      }
      
      
      return originalRenderApp(container);
    };
  }
  
  // function showCompressionAuthPopup() {
  //   const existingPopup = document.querySelector('.auth-popup-overlay');
  //   if (existingPopup) {
  //     try {
  //       if (existingPopup.parentNode) {
  //         existingPopup.parentNode.removeChild(existingPopup);
  //       }
  //     } catch (error) {
  //       console.log('Error removing existing auth popup, may already be removed', error);
  //     }
  //   }
    
  //   const isLoggedIn = localStorage.getItem('token') !== null;

  //   const popup = document.createElement('div');
  //   popup.className = 'auth-popup-overlay';
  //   popup.style.position = 'fixed';
  //   popup.style.top = '0';
  //   popup.style.left = '0';
  //   popup.style.width = '100%';
  //   popup.style.height = '100%';
  //   popup.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
  //   popup.style.display = 'flex';
  //   popup.style.alignItems = 'center';
  //   popup.style.justifyContent = 'center';
  //   popup.style.zIndex = '9999';

    
  //   if (isLoggedIn) {
  //     popup.innerHTML = `
  //       <div class="auth-popup-content" style="background-color: white; border: 2px solid black; border-radius: 10px; box-shadow: 4px 4px 0 0 black; width: 90%; max-width: 480px; padding: 2rem;">
  //         <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Pixie Account</h2>
  //         <p style="margin-bottom: 2rem;">You are currently logged in. What would you like to do?</p>
          
  //         <div style="margin-bottom: 1.5rem;">
  //           <button id="check-plan-button" class="button button-primary" style="width: 100%;">
  //             Check Plan Status
  //           </button>
  //         </div>
          
  //         <div style="margin-bottom: 1.5rem;">
  //           <button id="logout-button" class="button button-outline" style="width: 100%;">
  //             Logout
  //           </button>
  //         </div>
          
  //         <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
  //           <button id="close-auth-popup" class="button button-outline">Close</button>
  //         </div>
  //       </div>
  //     `;
  //   } else {
  //     popup.innerHTML = `
  //       <div class="auth-popup-content" style="background-color: white; border: 2px solid black; border-radius: 10px; box-shadow: 4px 4px 0 0 black; width: 90%; max-width: 480px; padding: 2rem;">
  //         <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Pixie Compression</h2>
  //         <p style="margin-bottom: 2rem;">In order to use compression, please sign up/log in with Pixie and choose a plan.</p>
          
  //         <div style="margin-bottom: 1.5rem;">
  //           <button id="login-button" class="button button-primary" style="width: 100%;">
  //             Log In
  //           </button>
  //         </div>
          
  //         <div style="text-align: center; margin-bottom: 1.5rem;">
  //           <span style="color: #333;">Don't have an account?</span> 
  //           <a href="#" id="signup-link" class="signup-link" style="color: #ffab69; text-decoration: underline; font-weight: 500; transition: text-decoration 0.2s;">Sign Up</a>
  //         </div>
          
  //         <div style="display: flex; justify-content: flex-end; margin-top: 1rem;">
  //           <button id="close-auth-popup" class="button button-outline">Close</button>
  //         </div>
  //       </div>
  //     `;
  //   }

    
  //   document.body.appendChild(popup);

    
  //   const style = document.createElement('style');
  //   style.textContent = `
  //     .signup-link:hover {
  //       text-decoration: underline !important;
  //     }
  //   `;
  //   document.head.appendChild(style);

    
  //   const popupContent = popup.querySelector('.auth-popup-content');
  //   popupContent.animate(
  //     [
  //       { opacity: 0, transform: 'translateY(-20px)' },
  //       { opacity: 1, transform: 'translateY(0)' }
  //     ],
  //     {
  //       duration: 300,
  //       easing: 'ease-out'
  //     }
  //   );

  //   document.getElementById('close-auth-popup').addEventListener('click', () => {
  //     try {
  //       const popupToRemove = document.querySelector('.auth-popup-overlay');
  //       if (popupToRemove && popupToRemove.parentNode) {
  //         popupToRemove.parentNode.removeChild(popupToRemove);
  //       }
  //     } catch (error) {
  //       console.log('Error closing auth popup, it may already be removed', error);
  //     }
  //   });
     
  //   if (isLoggedIn) {
      
  //     document.getElementById('check-plan-button').addEventListener('click', () => {
  //       document.body.removeChild(popup);
        
  //       checkUserPlan().then(planResult => {
  //         if (planResult.success && planResult.hasPlan) {
  //           redirectToHomePage();
  //         } else {
  //           redirectToPricingPage();
  //         }
  //       }).catch(error => {
  //         console.error("Error checking plan:", error);
  //         showPopupNotification({
  //           type: 'error',
  //           title: 'Error',
  //           message: 'Failed to check your subscription status. Please try again.'
  //         });
  //       });
  //     });
      
      
  //     document.getElementById('logout-button').addEventListener('click', () => {
  //       document.body.removeChild(popup);
  //       logoutUser();
  //     });
  //   } else {
  //     document.getElementById('signup-link').addEventListener('click', (e) => {
  //       e.preventDefault();
  //       showSignupForm(popup);
  //     });

  //     document.getElementById('login-button').addEventListener('click', () => {
  //       showLoginForm(popup);
  //     });
  //   }
  // }

  
  // function showError(errorMessage) {
    
  //   let errorContainer = document.querySelector('.auth-error-message');
    
  //   if (!errorContainer) {
      
  //     errorContainer = document.createElement('div');
  //     errorContainer.className = 'auth-error-message';
  //     errorContainer.style.backgroundColor = '#fee2e2';
  //     errorContainer.style.color = '#b91c1c';
  //     errorContainer.style.padding = '0.75rem';
  //     errorContainer.style.borderRadius = '0.5rem';
  //     errorContainer.style.marginBottom = '1rem';
  //     errorContainer.style.marginTop = '1rem';
      
      
  //     const form = document.querySelector('#signup-form') || document.querySelector('#login-form');
  //     const heading = form?.previousElementSibling;
      
  //     if (heading && heading.nextSibling) {
  //       heading.parentNode.insertBefore(errorContainer, heading.nextSibling);
  //     } else {
        
  //       const popupContent = document.querySelector('.auth-popup-content');
  //       if (popupContent && popupContent.firstChild) {
  //         popupContent.insertBefore(errorContainer, popupContent.firstChild);
  //       }
  //     }
  //   }
    
    
  //   errorContainer.textContent = errorMessage;
    
    
  //   errorContainer.animate(
  //     [
  //       { opacity: 0, transform: 'translateY(-5px)' },
  //       { opacity: 1, transform: 'translateY(0)' }
  //     ],
  //     {
  //       duration: 300,
  //       easing: 'ease-out'
  //     }
  //   );
  // }

  
  // async function checkUserPlan() {
    
  //   const token = localStorage.getItem('token');
  //   if (!token) {
  //     return { success: false, error: 'No authentication token' };
  //   }
    
  //   try {
      
  //     const response = await fetch(`${API_BASE_URL}/user/get-user-profile`, {
  //       method: 'GET',
  //       headers: {
  //         'token': token,
          
  //       }
  //     });
      
  //     if (!response.ok) {
  //       if (response.status === 401) {
  //         localStorage.removeItem('token');
  //         return { success: false, error: 'Authentication failed', status: 401 };
  //       }
        
  //       const errorData = await response.json();
  //       return {
  //         success: false,
  //         error: errorData.message || 'Failed to get user profile',
  //         status: response.status
  //       };
  //     }
      
  //     const data = await response.json();
      
  //     if (data.success && data.user) {
  //       return {
  //         success: true,
  //         hasPlan: !!data.user.planQuota,
  //         userData: data.user
  //       };
  //     }
      
  //     return {
  //       success: false,
  //       error: 'Failed to get user profile data'
  //     };
  //   } catch (error) {
  //     console.error('Error checking user plan:', error);
  //     return {
  //       success: false,
  //       error: error.message || 'Failed to connect to server'
  //     };
  //   }
  // }
  
  // function showLoginForm(container) {
  //   const authContent = container.querySelector('.auth-popup-content');
    
    
  //   authContent.innerHTML = `
  //     <h2 style="margin-top: 0; font-size: 1.5rem; font-weight: 600;">Log In to Pixie</h2>
  //     <p>Log in to your account to use our compression feature.</p>
      
  //     <form id="login-form" style="margin-top: 1.5rem;">
  //       <div style="margin-bottom: 1rem;">
  //         <label for="email" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Email</label>
  //         <input type="email" id="email" name="email" class="input" required style="width: 90%;">
  //       </div>
        
  //       <div style="margin-bottom: 1.5rem;">
  //         <label for="password" style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Password</label>
  //         <input type="password" id="password" name="password" class="input" required style="width: 90%;">
  //       </div>
        
  //       <div style="display: flex; justify-content: space-between; align-items: center;">
  //         <button type="submit" id="submit-login" class="button button-primary">
  //           Log In
  //         </button>
  //         <button type="button" id="back-to-auth-options" class="button button-outline">
  //           Back
  //         </button>
  //       </div>
  //     </form>
      
  //     <p style="margin-top: 1.5rem; text-align: center; font-size: 0.875rem;">
  //       Don't have an account? <a href="#" id="show-signup" style="color: #ffab69; text-decoration: underline; font-weight: 500;">Sign Up</a>
  //     </p>
  //   `;
    
    
  //   document.getElementById('back-to-auth-options').addEventListener('click', () => {
  //     showCompressionAuthPopup();
  //   });
    
  //   document.getElementById('show-signup').addEventListener('click', (e) => {
  //     e.preventDefault();
  //     showSignupForm(container);
  //   });
    
    
  //   setupLoginForm(container);
  // }

  
  // function redirectToHomePage() {
  //   const token = localStorage.getItem('token');
    
    
  //   const homeUrl = `http://localhost:3000/pixie?token=${token}&sync=true`;
    
    
  //   showPopupNotification({
  //     type: 'success',
  //     title: 'Start with Compression',
  //     message: 'You\'re all set to use the compression feature!',
  //     buttons: [
  //       {
  //         text: 'Start Compression',
  //         action: () => {
            
  //           window.open(homeUrl, '_blank');
  //           showReloadReminderNotification();
  //         }
  //       },
  //       {
  //         text: 'Logout',
  //         action: () => {
  //           logoutUser();
  //         },
  //         isSecondary: true
  //       },
  //       {
  //         text: 'Cancel',
  //         action: null,
  //         isSecondary: true
  //       }
  //     ],
  //     onClose: () => {
        
  //       const popup = document.querySelector('.auth-popup-overlay');
  //       if (popup) {
  //         document.body.removeChild(popup);
  //       }
  //     }
  //   });
  // }

  
  // function redirectToPricingPage() {
  //   const token = localStorage.getItem('token');
    
  //   const pricingUrl = `http://localhost:3000/pixie/pricing?token=${token}&sync=true`;
    
  //   showPopupNotification({
  //     type: 'info',
  //     title: 'Choose a Plan',
  //     message: 'You need to select a compression plan to continue.',
  //     buttons: [
  //       {
  //         text: 'Choose a Plan',
  //         action: () => {
            
  //           window.open(pricingUrl, '_blank');
            
  //           showReloadReminderNotification();
  //         }
  //       },
  //       {
  //         text: 'Logout',
  //         action: () => {
  //           logoutUser();
  //         },
  //         isSecondary: true
  //       },
  //       {
  //         text: 'Cancel',
  //         action: null,
  //         isSecondary: true
  //       }
  //     ],
  //     onClose: () => {
        
  //       const popup = document.querySelector('.auth-popup-overlay');
  //       if (popup && popup.parentNode) {
  //         try {
  //           popup.parentNode.removeChild(popup);
  //         } catch (error) {
  //           console.log('Error removing auth popup, it may already be removed', error);
  //         }
  //       }
  //     }
  //   });
  // }

  
  // function showReloadReminderNotification() {
    
  //   const existingReminder = document.getElementById('reload-reminder');
  //   if (existingReminder && existingReminder.parentNode) {
  //     try {
  //       existingReminder.parentNode.removeChild(existingReminder);
  //     } catch (error) {
  //       console.log('Error removing existing reminder', error);
  //     }
  //   }
    
    
  //   const reminder = document.createElement('div');
  //   reminder.id = 'reload-reminder';
  //   reminder.style.position = 'fixed';
  //   reminder.style.bottom = '20px';
  //   reminder.style.right = '20px';
  //   reminder.style.backgroundColor = 'white';
  //   reminder.style.border = '2px solid black';
  //   reminder.style.borderRadius = '8px';
  //   reminder.style.boxShadow = '4px 4px 0 0 rgba(0, 0, 0, 0.8)';
  //   reminder.style.padding = '10px 15px';
  //   reminder.style.zIndex = '9990';
  //   reminder.style.maxWidth = '250px';
  //   reminder.style.fontSize = '14px';
    
  //   reminder.innerHTML = `
  //     <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 5px;">
  //       <div style="display: flex; align-items: center;">
  //         <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#047857" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;">
  //           <circle cx="12" cy="12" r="10"></circle>
  //           <line x1="12" y1="16" x2="12.01" y2="16"></line>
  //           <line x1="12" y1="8" x2="12" y2="12"></line>
  //         </svg>
  //         <strong style="color: #047857;">Reminder</strong>
  //       </div>
  //       <button id="close-reminder" style="background: none; border: none; font-size: 16px; line-height: 1; cursor: pointer; padding: 0; margin-left: 10px;">×</button>
  //     </div>
  //     <p style="margin: 0; color: #333;">--Complete dialog after the compression--</p>
  //   `;
    
    
  //   document.body.appendChild(reminder);
    
    
  //   reminder.animate(
  //     [
  //       { opacity: 0, transform: 'translateY(20px)' },
  //       { opacity: 1, transform: 'translateY(0)' }
  //     ],
  //     {
  //       duration: 300,
  //       easing: 'ease-out'
  //     }
  //   );
    
    
  //   document.getElementById('close-reminder').addEventListener('click', () => {
  //     if (reminder && reminder.parentNode) {
  //       try {
  //         document.body.removeChild(reminder);
  //       } catch (error) {
  //         console.log('Error removing reminder', error);
  //       }
  //     }
  //   });
    
    
  //   setTimeout(() => {
  //     if (reminder && reminder.parentNode) {
  //       try {
          
  //         const fadeAnimation = reminder.animate(
  //           [
  //             { opacity: 1 },
  //             { opacity: 0 }
  //           ],
  //           {
  //             duration: 500,
  //             easing: 'ease-out'
  //           }
  //         );
          
  //         fadeAnimation.onfinish = () => {
  //           try {
  //             if (reminder.parentNode) {
  //               reminder.parentNode.removeChild(reminder);
  //             }
  //           } catch (error) {
  //             console.log('Error removing reminder after animation', error);
  //           }
  //         };
  //       } catch (error) {
          
  //         try {
  //           if (reminder.parentNode) {
  //             reminder.parentNode.removeChild(reminder);
  //           }
  //         } catch (innerError) {
  //           console.log('Error removing reminder', innerError);
  //         }
  //       }
  //     }
  //   }, 120000); 
  // }

  function applyGlobalStyles() {
    if (document.getElementById('webflow-extension-styles')) return;
    
    
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
        width: 82%; /* Reduced width to match reference */
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
  
  
  function renderApp(container) {
    container.innerHTML = '';
    
    
    const app = document.createElement('div');
    app.className = 'min-h-screen flex flex-col';
    
    
    const headerElement = document.createElement('div');
    headerElement.id = 'app-header-container';
    app.appendChild(headerElement);
    
    const mainElement = document.createElement('div');
    mainElement.id = 'app-main-container';
    app.appendChild(mainElement);
    
    const footerElement = document.createElement('div');
    footerElement.id = 'app-footer-container';
    app.appendChild(footerElement);
    
    
    container.appendChild(app);
    
    
    renderHeader(headerElement);
    
    
    switch (state.currentView) {
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
    
    
    renderFooter(footerElement);
  }

  
  function isSvgAsset(asset) {
    if (!asset) return false;
    
    
    if (asset.fileType === 'image/svg+xml') {
      return true;
    }
    
    
    if (asset.url && asset.url.toLowerCase().endsWith('.svg')) {
      return true;
    }
    
    return false;
  }

  async function resizeSvgFile(svgFile, newWidth, newHeight, keepAspectRatio = true) {
    try {
      
      let svgText;
      
      if (typeof svgFile === 'string') {
        
        const response = await fetch(svgFile);
        svgText = await response.text();
      } else if (svgFile instanceof File || svgFile instanceof Blob) {
        
        svgText = await readFileAsText(svgFile);
      } else {
        throw new Error('Invalid SVG source');
      }
      
      
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
      
      
      const parserError = svgDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('SVG parsing error');
      }
      
      
      const svgElement = svgDoc.documentElement;
      
      
      let originalWidth = svgElement.getAttribute('width');
      let originalHeight = svgElement.getAttribute('height');
      const viewBox = svgElement.getAttribute('viewBox');
      
      
      if ((!originalWidth || !originalHeight) && viewBox) {
        const viewBoxParts = viewBox.split(' ');
        if (viewBoxParts.length === 4) {
          if (!originalWidth) originalWidth = viewBoxParts[2];
          if (!originalHeight) originalHeight = viewBoxParts[3];
        }
      }
      
      
      originalWidth = parseFloat(originalWidth) || 100;
      originalHeight = parseFloat(originalHeight) || 100;
      
      
      if (keepAspectRatio) {
        const aspectRatio = originalWidth / originalHeight;
        
        if (newWidth && !newHeight) {
          newHeight = Math.round(newWidth / aspectRatio);
        } else if (!newWidth && newHeight) {
          newWidth = Math.round(newHeight * aspectRatio);
        } else if (!newWidth && !newHeight) {
          
          newWidth = originalWidth;
          newHeight = originalHeight;
        }
      }
      
      
      svgElement.setAttribute('width', newWidth);
      svgElement.setAttribute('height', newHeight);
      
      
      if (!viewBox) {
        svgElement.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
      }
      
      
      const serializer = new XMLSerializer();
      const modifiedSvgText = serializer.serializeToString(svgDoc);
      
      
      const filename = (typeof svgFile === 'string') 
        ? svgFile.split('/').pop() 
        : (svgFile.name || 'resized.svg');
        
      return new File([modifiedSvgText], filename, { type: 'image/svg+xml' });
    } catch (error) {
      console.error('Error processing SVG:', error);
      throw error;
    }
  }

  
  async function cropSvgFile(svgFile, cropX, cropY, cropWidth, cropHeight) {
    try {
      
      let svgText;
      
      if (typeof svgFile === 'string') {
        
        const response = await fetch(getProxiedImageUrl(svgFile));
        if (!response.ok) throw new Error('Failed to fetch SVG for cropping');
        svgText = await response.text();
      } else if (svgFile instanceof File || svgFile instanceof Blob) {
        
        svgText = await readFileAsText(svgFile);
      } else {
        throw new Error('Invalid SVG source');
      }
      
      
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
      
      
      const parserError = svgDoc.querySelector('parsererror');
      if (parserError) {
        throw new Error('SVG parsing error: ' + parserError.textContent);
      }
      
      
      const svgElement = svgDoc.documentElement;
      
      
      let originalWidth = svgElement.getAttribute('width');
      let originalHeight = svgElement.getAttribute('height');
      let viewBox = svgElement.getAttribute('viewBox');
      
      
      if ((!originalWidth || !originalHeight) && viewBox) {
        const viewBoxParts = viewBox.split(/\s+/);
        if (viewBoxParts.length === 4) {
          if (!originalWidth) originalWidth = viewBoxParts[2];
          if (!originalHeight) originalHeight = viewBoxParts[3];
        }
      }
      
      
      originalWidth = parseFloat(originalWidth) || 0;
      originalHeight = parseFloat(originalHeight) || 0;
      
      
      if (originalWidth <= 0 || originalHeight <= 0) {
        console.log("SVG has invalid dimensions, checking for stored dimensions");
        
        
        if (state.selectedAsset && state.selectedAsset.width && state.selectedAsset.height) {
          originalWidth = state.selectedAsset.width;
          originalHeight = state.selectedAsset.height;
        } 
        
        if (originalWidth <= 0 || originalHeight <= 0) {
          originalWidth = 150;
          originalHeight = 150;
        }
      }
      
      
      if (!viewBox && originalWidth > 0 && originalHeight > 0) {
        viewBox = `0 0 ${originalWidth} ${originalHeight}`;
        svgElement.setAttribute('viewBox', viewBox);
      }
      
      
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
      
      
      const newViewBoxMinX = Math.round(viewBoxMinX + (cropX / 100) * viewBoxWidth);
      const newViewBoxMinY = Math.round(viewBoxMinY + (cropY / 100) * viewBoxHeight);
      const newViewBoxWidth = Math.round((cropWidth / 100) * viewBoxWidth);
      const newViewBoxHeight = Math.round((cropHeight / 100) * viewBoxHeight);
      
      
      svgElement.setAttribute('viewBox', `${newViewBoxMinX} ${newViewBoxMinY} ${newViewBoxWidth} ${newViewBoxHeight}`);
      
      
      svgElement.setAttribute('width', Math.round(newViewBoxWidth));
      svgElement.setAttribute('height', Math.round(newViewBoxHeight));
      
      
      svgElement.style.width = `${Math.round(newViewBoxWidth)}px`;
      svgElement.style.height = `${Math.round(newViewBoxHeight)}px`;
      
      
      const serializer = new XMLSerializer();
      const modifiedSvgText = serializer.serializeToString(svgDoc);
      
      
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

  
  function logoutUser() {
    
    if (window.posthogAnalytics) {
      const userEmail = localStorage.getItem('userEmail');
      window.posthogAnalytics.trackAuth('indesigner_user_logout', {
        email: userEmail || 'unknown'
      });
    }
    
    
    localStorage.removeItem('token2');
    state.userInfo = null;
    state.assets = [];
    state.filteredAssets = [];
    state.selectedAsset = null;
    state.isLoading = false;
    state.error = null;
    
    
    renderApp(document.getElementById('root'));
    
    
    showPopupNotification({
      type: 'success',
      title: 'Logged Out',
      message: 'You have been successfully logged out.'
    });
  }

  async function renderHeader(container) {
    
    const currentSiteId = await getCurrentWebflowSiteId();
    
    const header = document.createElement('header');
    header.className = 'bg-white border-b';
    header.style.border = '2px solid black';
    header.style.borderRadius = '10px';
  
    
    const hasSiteSpecificToken = localStorage.getItem(`token2`) !== null;
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
      
      
      const loginWebflowButton = document.getElementById('login-webflow-button');
      if (loginWebflowButton) {
        loginWebflowButton.addEventListener('click', (e) => {
          e.preventDefault();
          
          openOAuthWindow()
            .then(result => {
              console.log('Authentication completed successfully. Starting auto reloading.');
            })
            .catch(error => {
              console.error('Authentication failed.');
            });
        });
      }
      
      
      const logoutWebflowButton = document.getElementById('logout-webflow-button');
      if (logoutWebflowButton) {
        logoutWebflowButton.addEventListener('click', () => {
          
          logoutUser();
        });
      }
    }, 0);
  }
  
  
  function navigateToPage(pageNumber) {
    try {
      
      if (pageNumber < 1) pageNumber = 1;
      if (pageNumber > state.totalPages) pageNumber = state.totalPages;

      
      cleanupLazyLoading();
      
      
      state.currentPage = pageNumber;
      
      
      state.selectedAsset = null;
      
      
      state.loadedAssetIds.clear();
      
      
      renderApp(document.getElementById('root'));
    } catch (error) {
      console.error("Error navigating to page:", error);
      
      
      showPopupNotification({
        type: 'error',
        title: 'Navigation Error',
        message: 'There was an error loading this page. Please try again.'
      });
    }
  }
  
  function preloadCriticalAssets() {
    
    const assetsToPreload = getCurrentPageAssets().slice(0, 12); 
    
    if (assetsToPreload.length === 0) return;
    
    
    const preloadPromises = assetsToPreload.map((asset, index) => {
      return new Promise((resolve) => {
        if (!isImageAsset(asset)) {
          resolve(); 
          return;
        }
        
        const imageUrl = getProxiedImageUrl(asset.url);
        const img = new Image();
        
        
        img.onload = () => {
          state.loadedAssetIds.add(asset.id);
          
          
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
          
          state.loadedAssetIds.add(asset.id);
          resolve();
        };
        
        
        setTimeout(() => {
          img.src = imageUrl;
        }, index * 20); 
      });
    });
    
    
    Promise.all(preloadPromises).then(() => {
      
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
  
  function generateAssetHTML(asset) {
    const isImage = isImageAsset(asset);
    const isSelected = state.selectedAsset?.id === asset.id;

    
    const isLoaded = state.loadedAssetIds.has(asset.id);
    
    
    let imgClass = isLoaded 
      ? 'w-full h-full object-cover asset-image-loaded' 
      : 'w-full h-full object-cover asset-image-placeholder';
    
    
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

  
  function formatAspectRatio(width, height) {
    if (!width || !height) return "N/A";
    
    
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    
    
    let simplifiedWidth = width / divisor;
    let simplifiedHeight = height / divisor;
    
    
    const commonRatios = [
      { width: 1, height: 1 },      
      { width: 4, height: 3 },      
      { width: 16, height: 9 },     
      { width: 3, height: 2 },      
      { width: 5, height: 4 },      
      { width: 21, height: 9 },     
      { width: 2, height: 1 },      
      { width: 3, height: 1 },      
      { width: 9, height: 16 }      
    ];
    
    
    if (simplifiedWidth > 20 || simplifiedHeight > 20) {
      
      const ratio = width / height;
      
      
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
      
      
      if (closestRatio) {
        const commonRatio = closestRatio.width / closestRatio.height;
        const percentDiff = Math.abs(ratio - commonRatio) / commonRatio;
        
        if (percentDiff < 0.1) {
          return `${closestRatio.width}:${closestRatio.height}`;
        }
      }
      
      
      
      if (simplifiedWidth > 20 || simplifiedHeight > 20) {
        
        
        let a = Math.max(width, height);
        let b = Math.min(width, height);
        let approximations = [];
        
        
        while (b > 0 && approximations.length < 10) {
          approximations.push({ n: a, d: b });
          const temp = a % b;
          a = b;
          b = temp;
        }
        
        
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
    
    
    return `${simplifiedWidth}:${simplifiedHeight}`;
  }

  
  // async function handleCompressOption(asset) {
  //   try {
      
  //     const token = localStorage.getItem('token');
      
  //     if (!token) {
        
  //       showCompressionAuthPopup();
  //       return;
  //     }
      
      
  //     const loadingNotification = showPopupNotification({
  //       type: 'info',
  //       title: 'Checking your account',
  //       message: 'Please wait while we verify your subscription status...'
  //     });
      
      
  //     const planResult = await checkUserPlan();
      
      
  //     if (loadingNotification) loadingNotification();
      
  //     if (!planResult.success) {
  //       console.error('Error checking plan:', planResult.error);
        
  //       if (planResult.status === 401) {
          
  //         localStorage.removeItem('token');
  //         showCompressionAuthPopup();
  //       } else {
          
  //         showPopupNotification({
  //           type: 'error',
  //           title: 'Error',
  //           message: 'Failed to check your subscription status. Please try again later.'
  //         });
  //       }
  //       return;
  //     }
      
  //     if (planResult.hasPlan) {
        
  //       redirectToHomePage();
  //     } else {
        
  //       redirectToPricingPage();
  //     }
  //   } catch (error) {
  //     console.error('Error handling compression option:', error);
  //     showPopupNotification({
  //       type: 'error',
  //       title: 'Error',
  //       message: 'An unexpected error occurred. Please try again later.'
  //     });
  //   }
  // }

  function openOAuthWindow() {
    
    return new Promise((resolve, reject) => {
      
      
      const apiEndpoint = `${API_BASE_URL}/api/webflow-auth-window/authorize?source=indesigner`;
      
      
      fetch(apiEndpoint)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to get authorization URL: ${response.status}`);
          }
          return response.json();
        })
        .then(data => {
          
          const oauthUrl = data.authorizeUrl;
          
          if (!oauthUrl) {
            throw new Error('No authorization URL returned from server');
          }
          
          
          localStorage.setItem('oauth_source', 'indesigner');
          
          
          const oauthWindow = window.open(
            oauthUrl,
            '_blank'
          );
          
          window.addEventListener('message', async function inDesignerMessageHandler(event) {
            if (event.data && event.data.type === 'INDESIGNER_AUTH_COMPLETE') {
              
              window.removeEventListener('message', inDesignerMessageHandler);
              
              console.log('Received auth completion message from InDesigner OAuth redirect');
              
              
              startTokenPolling()
                .then(result => {
                  resolve({ success: true });
                })
                .catch(error => {
                  reject(error);
                });
            }
          });

          if (oauthWindow) {
            oauthWindow.focus();
          } else {
            reject(new Error('Failed to open OAuth window'));
          }
        })
        .catch(error => {
          console.error('Error initiating OAuth flow:', error);
          showPopupNotification({
            type: 'error',
            title: 'Authorization Failed',
            message: 'Could not initiate Webflow authorization. Please try again.'
          });
          reject(error);
        });
    });
  }

  function startTokenPolling() {
    return new Promise((resolve, reject) => {
      
      getCurrentWebflowSiteId()
        .then(currentSiteId => {
          if (!currentSiteId) {
            throw new Error('Could not determine current site ID');
          }
          
          console.log('Polling for token for site ID:', currentSiteId);

          let attempts = 0;
          const maxAttempts = 15; 
          let isTokenFound = false; 
          
          const pollingInterval = setInterval(async () => {
            
            if (isTokenFound) {
              return;
            }
            
            attempts++;
            
            try {
              
              const authResponse = await fetch(`${API_BASE_URL}/user/verify-indesigner-auth`, {
                method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      
                      siteId: currentSiteId  
                    })
                  });
                console.log('Response from checking token-:', authResponse);
                  if (!authResponse.ok) {
                    console.error('Error verifying auth:', authResponse.status);
                    throw new Error('Failed to verify authentication');
                  }
                  else {
                    isTokenFound = true;
                  }
                  
                  const authData = await authResponse.json();
                  console.log('Auth data: - ', authData.success, authData.token);

                  if (authData.success && authData.token) {
                    
                    localStorage.setItem('token2', authData.token);
                    localStorage.setItem('token2_timestamp', Date.now().toString());

                    setTimeout(() => {
                      
                      window.location.reload();
                    }, 1000);
                    
                    console.log('JWT authentication token stored successfully');

                    state.needsAuthorization = false;
                    
                  } else {
                    console.error('Authentication failed:', authData.message || 'No JWT token received');
                    throw new Error('Authentication failed');
                  }
                } catch (authError) {
                  console.error('Error during authentication verification:', authError);
                } 
          }, 1000); 
        })
        .catch(error => {
          console.error('Error getting current site ID:', error);
          reject(error);
        });
    });
  }
  
  async function checkExistingWebflowConnection() {
    try {
      
      const currentSiteId = await getCurrentWebflowSiteId();
      if (!currentSiteId) {
        console.log('No current site ID available');
        return false;
      }
      
      const jwt = localStorage.getItem('token2');
      console.log('JWT token:', jwt);
      if (!jwt) {
        console.log('No JWT token found in localStorage');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking existing Webflow connection:', error);
      return false;
    }
  }

  function getShortFilename(filename) {
    if (!filename) return 'Unnamed';
    
    
    let extension = '';
    if (filename.includes('.')) {
      extension = filename.substring(filename.lastIndexOf('.'));
    }
    
    
    let baseName = extension ? filename.substring(0, filename.lastIndexOf('.')) : filename;
    
    
    if (baseName.includes('_')) {
      const parts = baseName.split('_');
      baseName = parts[parts.length - 1]; 
    }
    
    const MAX_LENGTH = 15;
    const ELLIPSIS = '...';
    
    const maxBaseNameLength = MAX_LENGTH - extension.length;
    
    
    if (baseName.length > maxBaseNameLength) {
      
      const truncateLength = maxBaseNameLength - ELLIPSIS.length;
      
      
      if (truncateLength > 0) {
        baseName = baseName.substring(0, truncateLength) + ELLIPSIS;
      } else {
        
        baseName = baseName.substring(0, Math.max(1, maxBaseNameLength - 1)) + ELLIPSIS;
      }
    }
  
    return baseName + extension;
  }
  
  async function autoReloadAssets() {
    console.log("Auto-reloading assets after operation");
    
    state.assets = [];
    state.filteredAssets = [];
    state.selectedAsset = null;
    
    if (window.posthogAnalytics) {
      window.posthogAnalytics.trackAuth('indesigner_auto_reload_assets', {
        from_view: state.currentView,
        after_operation: state.resizeMode ? 'resize' : (state.cropMode ? 'crop' : 'unknown')
      });
    }
    
    fetchWebflowAssets().then(() => {
      showPopupNotification({
        type: 'success',
        title: 'Assets Updated',
        message: 'Assets have been updated successfully.'
      });
    }).catch(error => {
      showPopupNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to update assets: ' + error.message
      });
    });
  }
  
  function renderAssetsBrowserView(container) {
    const main = document.createElement('main');
    main.className = 'flex-grow bg-gray-50 py-6 mt-6';
    main.style.border = '2px solid black';
    main.style.borderRadius = '10px';

    const isAuthenticated2 = !!(localStorage.getItem('token2'));

    
    if (!isAuthenticated2) {
      
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

      return;
    }

    
    const isAuthenticated = !!(localStorage.getItem('token2'));
    
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

    
    if (!document.getElementById('lazy-loading-style')) {
      style.id = 'lazy-loading-style';
      document.head.appendChild(style);
    }
    
    container.appendChild(main);
    
    
    if (!state.isLoading && state.assets.length === 0 && !state.error && isAuthenticated) {
      fetchWebflowAssets();
    }
    
    
    setTimeout(() => {
      
      initLazyLoading();
      
      
      const assetItemsObserve = document.querySelectorAll('.asset-item');
      
      
      if (state.lazyLoadObserver && assetItemsObserve.length > 0) {
        assetItemsObserve.forEach(item => {
          state.lazyLoadObserver.observe(item);
        });
        
        
        forceLoadInitialImages();
        batchPreloadDimensions();
      }
      
      const reloadButton = document.getElementById('reload-assets-button');
      if (reloadButton) {
        reloadButton.addEventListener('click', () => {
          
          if (!localStorage.getItem('token2')) {
            showPopupNotification({
              type: 'info',
              title: 'Connect Webflow',
              message: 'Please connect your Webflow account first to load assets.'
            });
            return;
          }
          
          
          reloadButton.disabled = true;
          reloadButton.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin mr-1">
              <circle cx="12" cy="12" r="10"></circle>
              <path d="M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"></path>
            </svg>
            Reloading...
          `;
          
          
          state.assets = [];
          state.filteredAssets = [];
          state.selectedAsset = null;
          
          
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
      
      const searchInput = document.getElementById('search-input');
      if (searchInput) {
        
        if (state.searchInputHadFocus) {
          searchInput.focus();
          
          if (state.searchSelectionStart !== undefined && state.searchSelectionEnd !== undefined) {
            searchInput.setSelectionRange(state.searchSelectionStart, state.searchSelectionEnd);
          }
          state.searchInputHadFocus = false;
        }
        
        searchInput.addEventListener('input', (e) => {
          state.searchTerm = e.target.value;
          
          
          clearTimeout(state.searchDebounceTimer);
          state.searchDebounceTimer = setTimeout(() => {
            
            state.searchInputHadFocus = (document.activeElement === searchInput);
            if (state.searchInputHadFocus) {
              state.searchSelectionStart = searchInput.selectionStart;
              state.searchSelectionEnd = searchInput.selectionEnd;
            }
            
            applyFiltersAndSearch();
            preloadCriticalAssets();
            renderApp(document.getElementById('root'));
          }, 300); 
        });
      }
      
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
          e.stopPropagation(); 
          const assetId = button.getAttribute('data-asset-id');
          const asset = state.filteredAssets.find(a => a.id === assetId);
          
          if (asset) {
            
            if (!asset.width || !asset.height) {
              
              preloadImageDimensions(asset)
                .then(assetWithDimensions => {
                  
                  const assetIndex = state.filteredAssets.findIndex(a => a.id === assetId);
                  if (assetIndex !== -1) {
                    state.filteredAssets[assetIndex] = assetWithDimensions;
                  }
                  
                  
                  const fullAssetIndex = state.assets.findIndex(a => a.id === assetId);
                  if (fullAssetIndex !== -1) {
                    state.assets[fullAssetIndex] = assetWithDimensions;
                  }
                  
                  
                  showImageSelectionNotification(assetWithDimensions);
                })
                .catch(error => {
                  console.error('Failed to load image dimensions:', error);
                  showImageSelectionNotification(asset);
                });
            } else {
              
              showImageSelectionNotification(asset);
            }
          }
        });
      });
      
      const assetItems = document.querySelectorAll('.asset-item');
      assetItems.forEach(item => {
        
        const imageContainer = item.querySelector('.aspect-square');
        if (imageContainer) {
          imageContainer.addEventListener('click', () => {
            const assetId = item.getAttribute('data-asset-id');
            const asset = state.filteredAssets.find(a => a.id === assetId);
            if (asset) {
              selectAsset(asset);
              
            }
          });
        }
      });
      
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
              
              state.resizeMode = 'specific-assets';
              state.currentView = 'resize';
            }
            renderApp(document.getElementById('root'));
          }
        });
      }
      
      const retryButton = document.getElementById('retry-button');
      if (retryButton) {
        retryButton.addEventListener('click', () => {
          if (!!(localStorage.getItem('token2'))) {
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
                <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 60px; margin-left: -100px;">
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
  
    setTimeout(() => {
      const widthInput = document.getElementById('width-input');
      const heightInput = document.getElementById('height-input');
      const aspectRatioToggle = document.getElementById('aspect-ratio-toggle');
      const qualitySlider = document.getElementById('quality-slider');
      const qualityValue = document.getElementById('quality-value');
      const backButton = document.getElementById('back-to-assets');
      const resizeButton = document.getElementById('resize-submit');
      
      
      let maintainAspectRatio = true;
  
      
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
  
      
      if (state.selectedAsset.width && state.selectedAsset.height) {
        widthInput.value = state.selectedAsset.width;
        heightInput.value = state.selectedAsset.height;
      }
  
      
      if (aspectRatioToggle) {
        aspectRatioToggle.addEventListener('click', () => {
          maintainAspectRatio = !maintainAspectRatio;
          
          
          const inlineRatioElement = document.getElementById('inline-aspect-ratio');
          
          if (maintainAspectRatio) {
            
            aspectRatioToggle.classList.remove('inactive');
            
            
            if (inlineRatioElement) {
              const ratioText = formatAspectRatio(
                state.selectedAsset.width || 1, 
                state.selectedAsset.height || 1
              );
              inlineRatioElement.textContent = `(${ratioText})`;
              inlineRatioElement.style.color = 'grey'; 
            }
            
            
            if (state.selectedAsset.width && state.selectedAsset.height && widthInput.value) {
              const aspectRatio = state.selectedAsset.width / state.selectedAsset.height;
              const newWidth = parseInt(widthInput.value) || state.selectedAsset.width;
              heightInput.value = Math.round(newWidth / aspectRatio);
            }
          } else {
            
            aspectRatioToggle.classList.add('inactive');
            
            
            if (inlineRatioElement) {
              inlineRatioElement.textContent = '';
            }
          }
        });
      }
      
      
      if (qualitySlider && qualityValue) {
        qualitySlider.addEventListener('input', () => {
          qualityValue.value = qualitySlider.value;
        });
        
        qualityValue.addEventListener('input', () => {
          
          let value = parseInt(qualityValue.value);
          value = Math.max(1, Math.min(100, value || 1)); 
          
          
          qualityValue.value = value;
          qualitySlider.value = value;
        });
      }
      
      
      if (state.selectedAsset.width && state.selectedAsset.height) {
        const aspectRatio = state.selectedAsset.width / state.selectedAsset.height;
        
        if (widthInput) {
          widthInput.addEventListener('input', () => {
            if (maintainAspectRatio) {
              
              const newWidth = parseInt(widthInput.value) || 0;
              heightInput.value = Math.round(newWidth / aspectRatio);
              
              
              const inlineRatioElement = document.getElementById('inline-aspect-ratio');
              if (inlineRatioElement) {
                const ratioText = formatAspectRatio(state.selectedAsset.width, state.selectedAsset.height);
                inlineRatioElement.textContent = `(${ratioText})`;
                inlineRatioElement.style.color = 'grey';
              }
            }
            
          });
        }
  
        if (heightInput) {
          heightInput.addEventListener('input', () => {
            if (maintainAspectRatio) {
              
              const newHeight = parseInt(heightInput.value) || 0;
              widthInput.value = Math.round(newHeight * aspectRatio);
              
              
              const inlineRatioElement = document.getElementById('inline-aspect-ratio');
              if (inlineRatioElement) {
                const ratioText = formatAspectRatio(state.selectedAsset.width, state.selectedAsset.height);
                inlineRatioElement.textContent = `(${ratioText})`;
                inlineRatioElement.style.color = 'grey';
              }
            }
            
          });
        }
      }
      
      
      if (backButton) {
        backButton.addEventListener('click', () => {
          state.currentView = 'assets-browser';
          renderApp(document.getElementById('root'));
        });
      }
  
      
      if (resizeButton) {
        const newResizeButton = resizeButton.cloneNode(true);
        resizeButton.parentNode.replaceChild(newResizeButton, resizeButton);
        
        
        newResizeButton.addEventListener('click', async () => {
          try {
            
            if (isResizeUploadInProgress) {
              console.log("Resize upload already in progress, ignoring additional click");
              return;
            }
            
            
            isResizeUploadInProgress = true;
            
            
            newResizeButton.disabled = true;
            newResizeButton.innerHTML = `Processing...`;
            
            
            const widthInput = document.getElementById('width-input');
            const heightInput = document.getElementById('height-input');
            const qualitySlider = document.getElementById('quality-slider');
            
            
            let width = widthInput && !isNaN(parseInt(widthInput.value)) ? 
              parseInt(widthInput.value) : state.selectedAsset.width || 800;
            
            let height = heightInput && !isNaN(parseInt(heightInput.value)) ? 
              parseInt(heightInput.value) : state.selectedAsset.height || 600;
            
            const quality = qualitySlider && !isNaN(parseInt(qualitySlider.value)) ? 
              parseInt(qualitySlider.value) : 90;
            
            
            const keepAspectRatio = maintainAspectRatio;
            
            
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
  
            
            
            
            if (!state.selectedAsset || !state.selectedAsset.url) {
              throw new Error("No image selected or image URL not available");
            }
  
            
            const isSvg = isSvgAsset(state.selectedAsset);
            let resizedFile;
  
            if (isSvg) {
              
              console.log("Processing SVG file");
              
              
              resizedFile = await resizeSvgFile(
                state.selectedAsset.url, 
                width, 
                height, 
                keepAspectRatio
              );
            } else {
              
              console.log("Processing raster image");
              
              
              const imageUrl = state.selectedAsset.url;
              const response = await fetch(imageUrl);
              const blob = await response.blob();
              
              
              const img = new Image();
              const imgLoaded = new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
              });
              img.src = URL.createObjectURL(blob);
              await imgLoaded;
              
              
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
              
              
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, width, height);
              
              
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
              
              
              ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
              
              
              const resizedBlob = await new Promise((resolve, reject) => {
                canvas.toBlob(
                  (blob) => blob ? resolve(blob) : reject(new Error("Failed to create blob")), 
                  'image/jpeg', 
                  quality / 100
                );
              });
              
              
              const originalFilename = state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url);
              const fileExt = originalFilename.includes('.') 
                ? originalFilename.substring(originalFilename.lastIndexOf('.')+1)
                : 'jpg';
              
              
              const timestamp = new Date().getTime();
              const randomStr = Math.random().toString(36).substring(2, 8);
              const resizedFilename = `resized_${timestamp}_${randomStr}.${fileExt}`;
              
              resizedFile = new File([resizedBlob], resizedFilename, { 
                type: isSvg ? 'image/svg+xml' : 'image/jpeg' 
              });
            }
            
            
            const currentSiteId = await getCurrentWebflowSiteId();
            console.log("Current Site Id in resize", currentSiteId);
            
            
            const formData = new FormData();
            
            formData.append('file', resizedFile);

            console.log("resized file:", resizedFile);
            console.log("Uploading resized file form:", formData.get('file'));

            
            const uploadUrl = `${API_BASE_URL}/user/api/direct-upload-webflow-image?siteId=${currentSiteId}`;
                     
            
            const controller = new AbortController();
            const signal = controller.signal;
            
            
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const jwtToken = localStorage.getItem('token2');

            try {
              
              const uploadResponse = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                  token: jwtToken,
                },
                body: formData
              });

              console.log("Upload response:", uploadResponse);
              
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
  
              
              if (uploadResult && uploadResult.imageUrl) {
                
                state.selectedAsset = {
                  ...state.selectedAsset,
                  url: uploadResult.imageUrl,
                  id: uploadResult.assetId,
                  
                  name: resizedFile.name
                };
              }
  
              showPopupNotification({
                type: 'success',
                title: 'Success!',
                message: "Image has been resized and uploaded to Webflow. Click 'Continue' to return to the Assets Browser window. Your changes will be visible on Page 1. To see them live in Webflow, just reload the site's page.",
                onClose: () => {
                  
                  state.currentView = 'assets-browser';
                  renderApp(document.getElementById('root'));
                  
                  
                  autoReloadAssets();
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
            
            
            showPopupNotification({
              type: 'error',
              title: 'Error',
              message: `Failed to resize image: ${error.message}`,
            });
          } finally {
            
            newResizeButton.disabled = false;
            newResizeButton.innerHTML = 'Resize & Save to Webflow';
            
            
            isResizeUploadInProgress = false;
          }
        });
      }
    }, 0);
  }
  
  function cleanupLazyLoading() {
    try {
      if (state.lazyLoadObserver) {
        state.lazyLoadObserver.disconnect();
        state.lazyLoadObserver = null;
      }
    } catch (error) {
      console.error("Error cleaning up lazy loading:", error);
      
      state.lazyLoadObserver = null;
    }
  }
  
  function cleanupFilename(filename) {
    if (!filename) return 'unnamed';
    
    
    const parts = filename.split('/');
    let name = parts[parts.length - 1];
    
    
    name = name.split('?')[0];
    
    
    const MAX_LENGTH = 50;
    if (name.length > MAX_LENGTH) {
      const extension = name.includes('.') ? name.substring(name.lastIndexOf('.')) : '';
      const basename = name.includes('.') ? name.substring(0, name.lastIndexOf('.')) : name;
      name = basename.substring(0, MAX_LENGTH - extension.length) + extension;
    }
    
    return name;
  }
  
  function showPopupNotification(options) {
    const { type = 'success', title, message, onClose, buttons = [] } = options;
    
    
    const existingPopup = document.body.querySelector('.popup-notification');
    if (existingPopup && existingPopup.parentNode) {
      try {
        existingPopup.parentNode.removeChild(existingPopup);
      } catch (error) {
        console.log('Error removing existing popup, may already be removed', error);
      }
    }
    
    
    const popup = document.createElement('div');
    popup.className = 'popup-notification';
    
    
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
    
    
    const closeButton = popup.querySelector('.popup-close-btn');
    if (closeButton) {
      closeButton.addEventListener('click', closePopup);
    }
    
    
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
    
    
    return closePopup;
  }
  
  function renderCropView(container) {
    if (!state.selectedAsset) {
      
      state.currentView = 'assets-browser';
      renderApp(document.getElementById('root'));
      return;
    }
    
    
    if (!state.crop) {
      state.crop = {
        x: 25,
        y: 25,
        width: 50,
        height: 50
      };
    }
    
    
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
    
    setTimeout(() => {
      initSimpleCropper();
      
      const backButton = document.getElementById('back-to-assets-crop');
      const cropButton = document.getElementById('crop-submit');
      const previewCloseButton = document.getElementById('crop-preview-close');
      
      
      if (backButton) {
        backButton.addEventListener('click', () => {
          state.currentView = 'assets-browser';
          renderApp(document.getElementById('root'));
        });
      }
      
      
      if (cropButton) {
        cropButton.addEventListener('click', handleFinishCropping);
      }
      
      
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
    
    console.log("Initializing cropper with image element:", imgElement);
    console.log("Crop overlay element:", cropOverlay);
    console.log("Crop container element:", cropContainer);

    if (!imgElement || !cropOverlay || !cropContainer) {
      console.error('Missing required crop elements');
      return;
    }
    
    const isSvg = state.selectedAsset && isSvgAsset(state.selectedAsset);
    
    imgElement.crossOrigin = "anonymous";
    
    const showSvgFallback = () => {
      console.log("Using SVG fallback display");
      
      imgElement.style.display = 'none';
      
      const width = state.selectedAsset.width || 300;
      const height = state.selectedAsset.height || 300;
      
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
      
      cropContainer.insertBefore(fallbackElement, cropOverlay);
      
      cropContainer.style.width = `${width}px`;
      cropContainer.style.height = `${height}px`;
      
      updateCropValues();
      
      setupCropOverlayInteractions(width, height);
    };
    
    
    if (isSvg) {
      
      fetch(getProxiedImageUrl(state.selectedAsset.url))
        .then(response => {
          if (!response.ok) throw new Error('Failed to fetch SVG');
          return response.text();
        })
        .then(svgContent => {
          try {
            
            const svgContainer = document.createElement('div');
            svgContainer.id = 'svg-container';
            svgContainer.style.position = 'relative';
            svgContainer.style.zIndex = '2';
            svgContainer.style.display = 'flex';
            svgContainer.style.alignItems = 'center';
            svgContainer.style.justifyContent = 'center';
            svgContainer.innerHTML = svgContent;
            
            
            const svgElement = svgContainer.querySelector('svg');
            if (!svgElement) throw new Error('No SVG element found in content');
            
            
            const width = state.selectedAsset.width || 
                        svgElement.getAttribute('width') || 
                        (svgElement.viewBox && svgElement.viewBox.baseVal.width) || 
                        300;
                        
            const height = state.selectedAsset.height || 
                          svgElement.getAttribute('height') || 
                          (svgElement.viewBox && svgElement.viewBox.baseVal.height) || 
                          300;

            const originalWidth = width;
            const originalHeight = height;
            let scale = 1;
            
            const MIN_CROP_DIMENSION = 150; 
            
            if (width < MIN_CROP_DIMENSION || height < MIN_CROP_DIMENSION) {
              
              const scaleX = MIN_CROP_DIMENSION / width;
              const scaleY = MIN_CROP_DIMENSION / height;
              scale = Math.max(Math.min(scaleX, scaleY), 1); 
              scale = Math.min(scale, 5); 
            }
            
            
            const MAX_CROP_DIMENSION = 500; 
            const TARGET_MAX_DIMENSION = 480; 
            
            if (width > MAX_CROP_DIMENSION || height > MAX_CROP_DIMENSION) {
              
              const scaleDownX = MAX_CROP_DIMENSION / width;
              const scaleDownY = MAX_CROP_DIMENSION / height;
              
              
              const scaleDown = Math.min(scaleDownX, scaleDownY);
              
              
              
              const largerDimension = Math.max(width, height);
              const idealScale = TARGET_MAX_DIMENSION / largerDimension;
              
              
              scale = idealScale;
              
              
            }
            
            
            const MIN_DISPLAY_SIZE = 45; 
            let displayWidth = Math.round(width * scale);
            let displayHeight = Math.round(height * scale);
            
            
            if (displayWidth < MIN_DISPLAY_SIZE || displayHeight < MIN_DISPLAY_SIZE) {
              const smallestDim = Math.min(displayWidth, displayHeight);
              const additionalScale = MIN_DISPLAY_SIZE / smallestDim;
              displayWidth = Math.round(displayWidth * additionalScale);
              displayHeight = Math.round(displayHeight * additionalScale);
              
            }
            
            svgElement.setAttribute('width', displayWidth);
            svgElement.setAttribute('height', displayHeight);
            svgElement.style.width = `${displayWidth}px`;
            svgElement.style.height = `${displayHeight}px`;
            
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svgElement.style.maxWidth = '100%';
            svgElement.style.display = 'block';
            
            
            imgElement.style.display = 'none';
            cropContainer.insertBefore(svgContainer, cropOverlay);
            
            cropContainer.style.width = `${displayWidth}px`;
            cropContainer.style.height = `${displayHeight}px`;
            
            
            cropContainer.dataset.originalWidth = originalWidth;
            cropContainer.dataset.originalHeight = originalHeight;
            cropContainer.dataset.scaleFactor = scale;
            
            
            updateCropValues();
            
            
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
      
      imgElement.onload = function() {
        
        
        
        const imgRect = imgElement.getBoundingClientRect();
        
        
        cropContainer.style.width = `${imgRect.width}px`;
        cropContainer.style.height = `${imgRect.height}px`;
        
        
        updateCropValues();
        
        
        setupCropOverlayInteractions(imgRect.width, imgRect.height);
      };
      
      imgElement.onerror = function(error) {
        console.error("Error loading image:", error);
        
        imgElement.src = '/file.svg';
        imgElement.style.width = '300px';
        imgElement.style.height = '300px';
        cropContainer.style.width = '300px';
        cropContainer.style.height = '300px';
        updateCropValues();
        setupCropOverlayInteractions(300, 300);
      };
    }
    
    function setupCropOverlayInteractions(containerWidth, containerHeight) {
      let isDragging = false;
      let activeHandle = null;
      let startX, startY, startLeft, startTop, startWidth, startHeight;
      
      
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
        
        
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
      }
      
      function onMouseMove(e) {
        if (!isDragging) return;
        
        e.preventDefault();
        
        
        const aspectRatio = startWidth / startHeight;
        
        
        const containerRect = cropContainer.getBoundingClientRect();
        
        
        const currentXPercent = ((e.clientX - containerRect.left) / containerRect.width) * 100;
        const currentYPercent = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        
        
        const boundedX = Math.max(0, Math.min(100, currentXPercent));
        const boundedY = Math.max(0, Math.min(100, currentYPercent));
        
        
        const startXPercent = ((startX - containerRect.left) / containerRect.width) * 100;
        const startYPercent = ((startY - containerRect.top) / containerRect.height) * 100;
        
        
        switch (activeHandle) {
          case 'move':
            
            const deltaX = boundedX - startXPercent;
            const deltaY = boundedY - startYPercent;
            
            let newX = startLeft + deltaX;
            let newY = startTop + deltaY;
            
            
            newX = Math.max(0, Math.min(100 - state.crop.width, newX));
            newY = Math.max(0, Math.min(100 - state.crop.height, newY));
            
            state.crop.x = newX;
            state.crop.y = newY;
            break;
            
          case 'tl': 
            let tlWidth = startWidth + startLeft - boundedX;
            let tlHeight = startHeight + startTop - boundedY;
            
            
            if ((tlWidth / aspectRatio) > tlHeight) {
              tlHeight = tlWidth / aspectRatio;
            } else {
              tlWidth = tlHeight * aspectRatio;
            }
            
            
            tlWidth = Math.max(10, tlWidth);
            tlHeight = Math.max(10, tlHeight);
            
            
            state.crop.x = Math.min(startLeft + startWidth - tlWidth, 100 - tlWidth);
            state.crop.y = Math.min(startTop + startHeight - tlHeight, 100 - tlHeight);
            state.crop.width = tlWidth;
            state.crop.height = tlHeight;
            break;
            
          case 'tr': 
            
            let trWidth = boundedX - startLeft;
            let trHeight = startHeight + startTop - boundedY;
            
            
            if ((trWidth / aspectRatio) > trHeight) {
              
              trHeight = trWidth / aspectRatio;
            } else {
              
              trWidth = trHeight * aspectRatio;
            }
            
            
            trWidth = Math.max(10, trWidth);
            trHeight = Math.max(10, trHeight);
            
            
            state.crop.y = Math.min(startTop + startHeight - trHeight, 100 - trHeight);
            state.crop.width = trWidth;
            state.crop.height = trHeight;
            break;
            
          case 'bl': 
          
            let blWidth = startWidth + startLeft - boundedX;
            let blHeight = boundedY - startTop;
            
            
            if ((blWidth / aspectRatio) > blHeight) {
              
              blHeight = blWidth / aspectRatio;
            } else {
              
              blWidth = blHeight * aspectRatio;
            }
            
            
            blWidth = Math.max(10, blWidth);
            blHeight = Math.max(10, blHeight);
            
            
            state.crop.x = Math.min(startLeft + startWidth - blWidth, 100 - blWidth);
            state.crop.width = blWidth;
            state.crop.height = blHeight;
            break;
            
          case 'br': 

            let brWidth = boundedX - startLeft;
            let brHeight = boundedY - startTop;
            
            
            if ((brWidth / aspectRatio) > brHeight) {
              brHeight = brWidth / aspectRatio;
            } else {
              brWidth = brHeight * aspectRatio;
            }
            
            
            brWidth = Math.max(10, brWidth);
            brHeight = Math.max(10, brHeight);
            
            
            state.crop.width = brWidth;
            state.crop.height = brHeight;
            break;
            
          case 't': 
            let tHeight = startHeight + startTop - boundedY;
            tHeight = Math.max(10, tHeight);
            
            state.crop.y = Math.min(startTop + startHeight - tHeight, 100 - tHeight);
            state.crop.height = tHeight;
            break;
            
          case 'r': 
            let rWidth = boundedX - startLeft;
            rWidth = Math.max(10, rWidth);
            
            state.crop.width = rWidth;
            break;
            
          case 'b': 
            let bHeight = boundedY - startTop;
            bHeight = Math.max(10, bHeight);
            
            state.crop.height = bHeight;
            break;
            
          case 'l': 
            let lWidth = startWidth + startLeft - boundedX;
            lWidth = Math.max(10, lWidth);
            
            state.crop.x = Math.min(startLeft + startWidth - lWidth, 100 - lWidth);
            state.crop.width = lWidth;
            break;
        }
        
        
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
        
        updateCropOverlay();
        updateCropValues();
      }
      
      function onMouseUp() {
        isDragging = false;
        activeHandle = null;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      
      
      function updateCropOverlay() {
        cropOverlay.style.top = `${state.crop.y}%`;
        cropOverlay.style.left = `${state.crop.x}%`;
        cropOverlay.style.width = `${state.crop.width}%`;
        cropOverlay.style.height = `${state.crop.height}%`;
      }
      
      
      cropOverlay.addEventListener('mousedown', onMouseDown);
      
      const handles = cropOverlay.querySelectorAll('[data-handle]');
      handles.forEach(handle => {
        handle.addEventListener('mousedown', onMouseDown);
      });
      
      
      updateCropOverlay();
      updateCropValues();
    }
  }
  
  function updateCropValues() {
    const imgElement = document.getElementById('crop-image');
    if (!imgElement) return;
    
    
    const naturalWidth = state.selectedAsset.width || imgElement.naturalWidth || 150;
    const naturalHeight = state.selectedAsset.height || imgElement.naturalHeight || 150;
    
    
    const xPixels = Math.round((state.crop.x / 100) * naturalWidth);
    const yPixels = Math.round((state.crop.y / 100) * naturalHeight);
    const widthPixels = Math.round((state.crop.width / 100) * naturalWidth);
    const heightPixels = Math.round((state.crop.height / 100) * naturalHeight);
    
    
    const xValueElement = document.getElementById('crop-x-value');
    const yValueElement = document.getElementById('crop-y-value');
    const widthValueElement = document.getElementById('crop-width-value');
    const heightValueElement = document.getElementById('crop-height-value');
    
    if (xValueElement) xValueElement.textContent = xPixels;
    if (yValueElement) yValueElement.textContent = yPixels;
    if (widthValueElement) widthValueElement.textContent = widthPixels;
    if (heightValueElement) heightValueElement.textContent = heightPixels;
  }

  
  
  async function cropImage() {
    const imgElement = document.getElementById('crop-image');
    if (!imgElement || !state.crop.width || !state.crop.height) {
      throw new Error('Invalid image reference or crop dimensions');
    }

    
    const naturalWidth = state.selectedAsset.width || imgElement.naturalWidth || 150;
    const naturalHeight = state.selectedAsset.height || imgElement.naturalHeight || 150;

    
    const cropX = Math.round((state.crop.x / 100) * naturalWidth);
    const cropY = Math.round((state.crop.y / 100) * naturalHeight);
    const cropWidth = Math.round((state.crop.width / 100) * naturalWidth);
    const cropHeight = Math.round((state.crop.height / 100) * naturalHeight);

    
    const canvas = document.createElement('canvas');
    canvas.width = cropWidth;
    canvas.height = cropHeight;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }
    
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        try {
          
          const shouldPreserveTransparency = state.selectedAsset.fileType === 'image/png' || 
                                            state.selectedAsset.url.toLowerCase().endsWith('.png') ||
                                            isSvgAsset(state.selectedAsset);
          
          if (!shouldPreserveTransparency) {
            
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, cropWidth, cropHeight);
          }
          
          
          ctx.drawImage(
            img,
            cropX, cropY, cropWidth, cropHeight,
            0, 0, cropWidth, cropHeight
          );
          
          
          const format = shouldPreserveTransparency ? 'image/png' : 'image/jpeg';
          const quality = shouldPreserveTransparency ? 1.0 : 0.92; 
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
      
      
      img.src = getProxiedImageUrl(state.selectedAsset.url);
    });
  }

  
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

  
  async function handleFinishCropping() {
    try {
      const cropButton = document.getElementById('crop-submit');
      if (!cropButton) return;
      
      
      cropButton.disabled = true;
      cropButton.innerHTML = `Processing...`;
      
      
      const successMessage = document.getElementById('crop-preview-success');
      if (successMessage) {
        successMessage.classList.add('hidden');
      }
      
      
      const cropData = {
        x: state.crop.x,
        y: state.crop.y,
        width: state.crop.width,
        height: state.crop.height,
        originalWidth: state.selectedAsset.width || 0,
        originalHeight: state.selectedAsset.height || 0
      };
      
      
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAssetAction('image_crop_started_INDESIGNER', state.selectedAsset, cropData);
      }
      
      
      const isSvg = isSvgAsset(state.selectedAsset);
      let croppedFile;
      let croppedDataUrl;

      if (isSvg) {
        
        console.log("Cropping SVG file");
        
        const cropX = state.crop.x;
        const cropY = state.crop.y;
        const cropWidth = state.crop.width;
        const cropHeight = state.crop.height;
        
        
        croppedFile = await cropSvgFile(
          state.selectedAsset.url, 
          cropX, 
          cropY, 
          cropWidth, 
          cropHeight
        );
        
        
        const reader = new FileReader();
        const dataUrlPromise = new Promise((resolve, reject) => {
          reader.onload = (event) => resolve(event.target.result);
          reader.onerror = reject;
        });
        reader.readAsDataURL(croppedFile);
        croppedDataUrl = await dataUrlPromise;
      } else {
        
        console.log("Cropping raster image");
        
        
        croppedDataUrl = await cropImage();
        
        if (!croppedDataUrl) {
          throw new Error('Failed to create cropped image');
        }
        
        
        const blob = dataURLtoBlob(croppedDataUrl);
        
        
        const originalFilename = state.selectedAsset.name || getFilenameFromUrl(state.selectedAsset.url);
        const fileExt = originalFilename.includes('.') 
          ? originalFilename.substring(originalFilename.lastIndexOf('.')+1)
          : (state.selectedAsset.fileType === 'image/png' ? 'png' : 'jpg');
        
        
        const timestamp = new Date().getTime();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const croppedFilename = `cropped_${timestamp}_${randomStr}.${fileExt}`;
        
        
        const fileType = fileExt === 'png' ? 'image/png' : 'image/jpeg';
        croppedFile = new File([blob], croppedFilename, { type: fileType });
      }
      
      
      const currentSiteId = await getCurrentWebflowSiteId();
      if (!currentSiteId) {
        throw new Error('Could not determine the current site ID');
      }
      
      
      const formData = new FormData();
      formData.append('file', croppedFile);

      
      const uploadUrl = `${API_BASE_URL}/user/api/direct-upload-webflow-image?siteId=${currentSiteId}`;
      const jwtToken = localStorage.getItem('token2');

      
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          token: jwtToken,
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
      
      
      const uploadResult = await uploadResponse.json();
      
      
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAssetAction('image_crop_completed_INDESIGNER', state.selectedAsset, {
          ...cropData,
          success: true,
          isSvg: isSvg,
          uploadResultUrl: uploadResult.imageUrl
        });
      }
      
      
      if (uploadResult && uploadResult.imageUrl) {
        
        state.selectedAsset = {
          ...state.selectedAsset,
          url: uploadResult.imageUrl,
          id: uploadResult.assetId,
          
          name: croppedFile.name
        };
      }
      
      
      showPopupNotification({
        type: 'success',
        title: 'Success!',
        message: "Image has been cropped and uploaded to Webflow. Click 'Continue' to return to the Assets Browser window. Your changes will be visible on Page 1. To see them live in Webflow, just reload the site's page.",
        onClose: () => {
          
          state.currentView = 'assets-browser';
          renderApp(document.getElementById('root'));
          
          
          autoReloadAssets();
        }
      });
    } catch (error) {
      console.error('Error during crop operation:', error);

      
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAssetAction('image_crop_failed_INDESIGNER', state.selectedAsset, {
          error: error.message || 'Unknown error',
          cropX: state.crop.x,
          cropY: state.crop.y,
          cropWidth: state.crop.width,
          cropHeight: state.crop.height
        });
      }
      
      
      showPopupNotification({
        type: 'error',
        title: 'Error',
        message: `Failed to crop image: ${error.message}`,
      });
    } finally {
      
      const cropButton = document.getElementById('crop-submit');
      if (cropButton) {
        cropButton.disabled = false;
        cropButton.innerHTML = 'Crop & Save to Webflow';
      }
    }
  }

  function isImageAsset(asset) {
    if (!asset) return false;
    
    
    if (asset.fileType && asset.fileType.startsWith('image/')) {
      return true;
    }
    
    
    if (asset.url && asset.url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
      return true;
    }
    
    return false;
  }
  
  
  function getProxiedImageUrl(originalUrl) {
    if (!originalUrl) return '/file.svg';
    
    
    const encodedUrl = encodeURIComponent(originalUrl);
    return `${API_BASE_URL}/api/proxy-image?url=${encodedUrl}`;
  }
  
  function getFilenameFromUrl(url) {
    if (!url) return 'Unnamed asset';
    
    
    
    const urlParts = url.split('/');
    let filename = urlParts[urlParts.length - 1];
    
    
    filename = filename.split('?')[0];
    
    
    try {
      filename = decodeURIComponent(filename);
    } catch (e) {
      
    }
    
    return cleanupFilename(filename);
  }
  
  function getCurrentPageAssets() {
    return state.filteredAssets.slice(
      (state.currentPage - 1) * state.itemsPerPage,
      state.currentPage * state.itemsPerPage
    );
  }
  
  function createCompressButton(asset) {
    
    let isNotified = localStorage.getItem('notified_feature_image-compression') === 'true';
    
    
    const notifyText = isNotified ? 'You will be notified!' : 'Notify when released';
    const notifyClass = isNotified ? 'notify-success' : '';
    
    
    const buttonId = `notify-btn-${asset.id}`;
    
    
    const html = `
      <div class="action-button coming-soon-container" title="Compression feature coming soon">
        <span class="coming-soon-text">COMING SOON</span>
        <a href="#" id="${buttonId}" class="notify-link ${notifyClass}" data-action="notify">${notifyText}</a>
      </div>
    `;
    
    
    
    checkNotificationStatus(asset.id, buttonId);
    
    return html;
  }

  function checkNotificationStatus(assetId, buttonId) {
    const token = localStorage.getItem('token2');
    
    
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
        
        
        localStorage.setItem('notified_feature_image-compression', isNotified.toString());
        
        
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
        
      });
    }
  }

  
  function handleNotifyClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    
    const notifyButton = event.target;
    
    
    if (notifyButton.textContent === 'You will be notified!') {
      
      showPopupNotification({
        type: 'info',
        title: 'Already Registered',
        message: 'You\'re already registered to be notified when this feature is released.'
      });
      
      
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAuth('compression_notification_reminder_INDESIGNER', {
          already_registered: true,
          asset_id: state.selectedAsset?.id
        });
      }
      
      return;
    }
    
    const token = localStorage.getItem('token2');
    if (!token) {
      
      // showCompressionAuthPopup();
      
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAuth('compression_notification_auth_required_INDESIGNER', {
          asset_id: state.selectedAsset?.id
        });
      }
      
      return;
    }
    
    const loadingNotification = showPopupNotification({
      type: 'info',
      title: 'Processing',
      message: 'Registering you for feature notifications...'
    });
    
    
    const featureId = 'image-compression';
    
    
    if (window.posthogAnalytics) {
      window.posthogAnalytics.trackAuth('compression_notification_requested_INDESIGNER', {
        feature_id: featureId,
        asset_id: state.selectedAsset?.id
      });
    }
    
    
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
      
      if (loadingNotification) loadingNotification();
      
      if (data.success) {
        
        
        const notifyLinks = document.querySelectorAll('.notify-link');
        notifyLinks.forEach(link => {
          link.textContent = 'You will be notified!';
          
          link.classList.add('notify-success');
        });
        
        
        localStorage.setItem(`notified_feature_${featureId}`, 'true');
        
        
        showPopupNotification({
          type: 'success',
          title: 'Notification Set',
          message: data.msg || 'You will be notified when this feature is released.'
        });
        
        
        if (window.posthogAnalytics) {
          window.posthogAnalytics.trackAuth('compression_notification_subscribed_INDESIGNER', {
            feature_id: featureId,
            success: true,
            asset_id: state.selectedAsset?.id
          });
        }
      } else {
        
        showPopupNotification({
          type: 'error',
          title: 'Error',
          message: data.msg || 'Failed to register for notifications. Please try again.',
          onClose: () => {
            
            const existingNotification = document.querySelector('.image-selection-notification');
            if (existingNotification) {
              existingNotification.remove();
            }
          }
        });
        
        
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
      
      if (loadingNotification) loadingNotification();
      
      console.error('Error registering for notifications:', error);
      
      
      showPopupNotification({
        type: 'error',
        title: 'Error',
        message: 'Failed to connect to the server. Please try again later.',
        onClose: () => {
          
          const existingNotification = document.querySelector('.image-selection-notification');
          if (existingNotification) {
            existingNotification.remove();
          }
        }
      });
       
      if (window.posthogAnalytics) {
        window.posthogAnalytics.trackAuth('compression_notification_error_INDESIGNER', {
          feature_id: featureId,
          error: error.message || 'Connection error',
          asset_id: state.selectedAsset?.id
        });
      }
    });
  }

  
  function showImageSelectionNotification(asset) {
    
    const allActiveDotsIcons = document.querySelectorAll('.dots-icon-active');
    allActiveDotsIcons.forEach(icon => {
      icon.classList.remove('dots-icon-active');
    });

    const existingNotification = document.querySelector('.image-selection-notification');
    if (existingNotification) {
      existingNotification.remove();
    }
    
    
    const notification = document.createElement('div');
    notification.className = 'image-selection-notification dropdown-menu';
    
    
    const assetElement = document.querySelector(`[data-asset-id="${asset.id}"]`);
    
    if (!assetElement) {
      console.error('Could not find asset element in DOM');
      return;
    }
    
    
    const dotsButton = assetElement.querySelector('.asset-options');
    if (!dotsButton) {
      console.error('Could not find three dots button');
      return;
    }
    
    
    const dotsIcon = dotsButton.querySelector('.dots-icon');
    if (dotsIcon) {
      dotsIcon.classList.add('dots-icon-active');
    }
    
    
    const dotsRect = dotsButton.getBoundingClientRect();
    
    
    const compressButtonHtml = createCompressButton(asset);

    
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
    
    
    
    const absoluteX = window.pageXOffset + dotsRect.left - 170; 
    const absoluteY = window.pageYOffset + dotsRect.top - 10 - notification.offsetHeight - 150; 
    
    
    notification.style.left = `${absoluteX}px`;
    notification.style.top = `${absoluteY}px`;
    
    
    document.body.appendChild(notification);
    
    
    const notificationRect = notification.getBoundingClientRect();
    notification.style.top = `${window.pageYOffset + dotsRect.top - notificationRect.height - 10}px`;
    
    
    document.addEventListener('click', function closeOnClickOutside(e) {
      if (!notification.contains(e.target) && 
          e.target !== dotsButton && 
          !dotsButton.contains(e.target)) {
        
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
    
    
    const actionButtons = notification.querySelectorAll('.dropdown-item:not(.coming-soon)');
    actionButtons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action');
        
        
        if (dotsIcon) {
          dotsIcon.classList.remove('dots-icon-active');
        }
        
        
        notification.remove();
        
        
        if (state.selectedAsset?.id !== asset.id) {
          selectAsset(asset);
        }
        
        
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
        
        
        renderApp(document.getElementById('root'));
      });
    });
    
    
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

  
  function updateSelectedAssetUI(asset) {
    
    const assetItems = document.querySelectorAll('.asset-item');
    assetItems.forEach(item => {
      item.classList.remove('ring-2', 'ring-blue-500', 'border-blue-500');
    });

    const actionButtons = document.querySelectorAll('[data-requires-selection]');
    actionButtons.forEach(button => {
      button.disabled = false;
    });
  }

  
  function selectAsset(asset) {
    
    state.selectedAsset = asset;
    updateSelectedAssetUI(asset);
    
    if (!state.loadedAssetIds.has(asset.id)) {
      const assetElement = document.querySelector(`[data-asset-id="${asset.id}"]`);
      if (assetElement) {
        const imgElement = assetElement.querySelector('img');
        if (imgElement) {
          imgElement.src = getProxiedImageUrl(asset.url);
          
          imgElement.classList.remove('asset-image-placeholder');
          imgElement.classList.add('asset-image-loaded');
          state.loadedAssetIds.add(asset.id);
        }
      }
    }

    if (!asset.width || !asset.height) {
      preloadImageDimensions(asset)
        .then(assetWithDimensions => {
          
          const assetIndex = state.filteredAssets.findIndex(a => a.id === asset.id);
          if (assetIndex !== -1) {
            state.filteredAssets[assetIndex] = assetWithDimensions;
            state.selectedAsset = assetWithDimensions;
            
            
            const fullAssetIndex = state.assets.findIndex(a => a.id === asset.id);
            if (fullAssetIndex !== -1) {
              state.assets[fullAssetIndex] = assetWithDimensions;
            }
            
            
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
  
  function batchPreloadDimensions() {
    const currentAssets = getCurrentPageAssets();
    const assetsNeedingDimensions = currentAssets.filter(asset => !asset.width || !asset.height);
    
    if (assetsNeedingDimensions.length === 0) {
      console.log('No assets need dimension preloading');
      return;
    }
    
    
    const BATCH_SIZE = 3;
    const processBatch = (startIndex) => {
      if (startIndex >= assetsNeedingDimensions.length) {
        console.log('Finished batch preloading dimensions');
        return;
      }
      
      const batch = assetsNeedingDimensions.slice(startIndex, startIndex + BATCH_SIZE);
      
      
      const promises = batch.map(asset => {
        return preloadImageDimensions(asset)
          .then(updatedAsset => {
            
            const assetIndex = state.filteredAssets.findIndex(a => a.id === updatedAsset.id);
            if (assetIndex !== -1) {
              state.filteredAssets[assetIndex] = updatedAsset;
              
              
              const fullAssetIndex = state.assets.findIndex(a => a.id === updatedAsset.id);
              if (fullAssetIndex !== -1) {
                state.assets[fullAssetIndex] = updatedAsset;
              }
              
              
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
      
      
      Promise.all(promises)
        .then(() => {
          setTimeout(() => {
            processBatch(startIndex + BATCH_SIZE);
          }, 200); 
        })
        .catch(error => {
          console.error('Error in dimension preloading batch:', error);
          
          setTimeout(() => {
            processBatch(startIndex + BATCH_SIZE);
          }, 200);
        });
    };
    
    
    processBatch(0);
  }
  
  function preloadImageDimensions(asset) {
    return new Promise((resolve, reject) => {
      
      if (asset.width && asset.height) {
        resolve(asset);
        return;
      }
      
      
      const isSvg = asset.url.toLowerCase().endsWith('.svg') || 
                  (asset.fileType && asset.fileType === 'image/svg+xml');
      
      
      const encodedUrl = encodeURIComponent(asset.url);
      const proxiedUrl = `${API_BASE_URL}/api/proxy-image?url=${encodedUrl}`;
      
      if (isSvg) {
        
        fetch(proxiedUrl)
          .then(response => response.text())
          .then(svgText => {
            try {
              
              const parser = new DOMParser();
              const svgDoc = parser.parseFromString(svgText, "image/svg+xml");
              const svgElement = svgDoc.documentElement;
              
              
              let width = svgElement.getAttribute('width');
              let height = svgElement.getAttribute('height');
              const viewBox = svgElement.getAttribute('viewBox');
              
              
              if ((!width || !height) && viewBox) {
                const viewBoxParts = viewBox.split(' ');
                if (viewBoxParts.length === 4) {
                  width = width || viewBoxParts[2];
                  height = height || viewBoxParts[3];
                }
              }
              
              
              width = parseFloat(width) || 150;   
              height = parseFloat(height) || 150; 
              
              
              resolve({
                ...asset,
                width: width,
                height: height
              });
            } catch (error) {
              console.error(`Error parsing SVG for asset ${asset.id}:`, error);
              
              resolve({
                ...asset,
                width: 150,
                height: 150
              });
            }
          })
          .catch(error => {
            console.error(`Failed to fetch SVG for asset ${asset.id}:`, error);
            
            resolve({
              ...asset,
              width: 150,
              height: 150
            });
          });
      } else {
        
        const img = new Image();
        
        
        const timeoutId = setTimeout(() => {
          console.warn(`Timeout loading dimensions for asset ${asset.id}`);
          resolve({
            ...asset,
            width: 150,  
            height: 150  
          });
        }, 5000); 
        
        img.onload = () => {
          clearTimeout(timeoutId);
          
          
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
  
  function applyFiltersAndSearch() {
    if (!state.assets || state.assets.length === 0) {
      state.filteredAssets = [];
      state.totalPages = 1;
      return;
    }
    
    let result = [...state.assets];
    
    
    if (state.filter === 'images') {
      result = result.filter(asset => isImageAsset(asset));
    }
    
    
    if (state.searchTerm) {
      const term = state.searchTerm.toLowerCase();
      result = result.filter(asset => {
        
        const name = asset.name || getFilenameFromUrl(asset.url);
        return name.toLowerCase().includes(term);
      });
    }
    
    
    result.sort((a, b) => {
      const dateA = new Date(a.createdOn || 0).getTime();
      const dateB = new Date(b.createdOn || 0).getTime();
      return dateB - dateA;
    });

    
    
    state.filteredAssets = result;
    
    
    
    state.totalPages = Math.max(1, Math.ceil(result.length / state.itemsPerPage));
    
    
    
    if (state.isFilterOrSearchChange) {
      state.currentPage = 1;
      state.isFilterOrSearchChange = false;
    }
  }

  
  async function getCurrentWebflowSiteId() {
    try {
      
      if (window.webflow && window.webflow.getSiteInfo) {
        const siteInfo = await window.webflow.getSiteInfo();

        if (siteInfo && siteInfo.siteId) {
          
          localStorage.setItem('currentWebflowSiteId', siteInfo.siteId);
          return siteInfo.siteId;
        }
      }
      
      
      const storedSiteId = localStorage.getItem('currentWebflowSiteId');
      if (storedSiteId) {
        return storedSiteId;
      }
      
      
      const urlMatch = window.location.hostname.match(/\.webflow\.io$/);
      if (urlMatch) {
        
        
        const pathParts = window.location.pathname.split('/');
        if (pathParts.length > 1 && pathParts[1].length > 10) {
          const possibleSiteId = pathParts[1];
          
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

  async function fetchWebflowAssets() {
    state.isLoading = true;
    state.error = null;
    renderApp(document.getElementById('root'));
    
    try {
      
      const currentSiteId = await getCurrentWebflowSiteId();
      console.log('Current Site ID:', currentSiteId);
      if (!currentSiteId) {
        throw new Error('Could not determine current site ID');
      }
      
      
      const jwtToken = localStorage.getItem('token2');
      console.log('JWT Token in fetchwebflowassets:', jwtToken);

      if (!jwtToken) {
        throw new Error('Authentication required. Please connect your Webflow account.');
      }
      
      const response = await fetch(`${API_BASE_URL}/user/api/direct-webflow-assets`, {
        method: 'POST',
        headers: {
          token: jwtToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          siteId: currentSiteId,
        })
      });
      
      console.log('Response from Webflow API for assets:', response);

      const responseData = await response.json();
      
      
      
      if (!response.ok || !responseData.success) {
        console.error('Server Error Response:', responseData);
        
        if (response.status === 401) {
          
          state.assets = [];
          state.filteredAssets = [];
          state.selectedAsset = null;
          
          throw new Error('Authentication expired. Please reconnect your Webflow account.');
        }

        if (response.status === 404) {
          localStorage.removeItem('token2');
          
          setTimeout(() => {
            
            window.location.reload();
          }, 1000);
        }
        
        throw new Error(responseData.message || 'Failed to fetch assets');
      }
      
      state.assets = responseData.assets || [];
      
      if (responseData.siteInfo) {
        state.currentSiteInfo = responseData.siteInfo;
      }

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
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWebflowExtension);
  } else {
    initWebflowExtension();
  }
})();