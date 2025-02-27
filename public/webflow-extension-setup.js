// public/webflow-extension-setup.js

(function() {
    // This script is designed to be included directly in your index.html
    // and will run when your extension is loaded in Webflow
    
    console.log("Webflow extension setup script running");
    
    // Check if we're running in the Webflow environment
    function isInWebflow() {
      try {
        // If we're in Webflow, we should be able to send messages to the parent
        return window !== window.parent;
      } catch (e) {
        return false;
      }
    }
    
    // Function to communicate with Webflow
    function setupWebflowCommunication() {
      if (!isInWebflow()) {
        console.log("Not running in Webflow, skipping setup");
        return;
      }
      
      console.log("Running in Webflow environment, setting up messaging");
      
      // Send a message to resize the extension
      // This will be picked up by the Webflow Designer if it's listening
      // Try this specific message format
      function requestResize() {
        try {
        // Format exactly matching the Webflow documentation
        window.parent.postMessage({
            command: 'webflow.setExtensionSize',
            params: { size: 'large' }
        }, '*');
        
        console.log("Sent resize request to parent with updated format");
        
        // Also try the alternative format
        window.parent.postMessage({
            type: 'webflow-extension',
            action: 'setExtensionSize',
            size: 'large'
        }, '*');
        } catch (e) {
        console.error("Error sending postMessage:", e);
        }
      }
      
      // Try to resize initially
      requestResize();
      
      // Try again after a short delay
      setTimeout(requestResize, 500);
      
      // And again after a longer delay
      setTimeout(requestResize, 2000);
      
      // Set up a message listener in case Webflow sends a response
      window.addEventListener('message', function(event) {
        console.log("Received message from parent:", event.data);
        
        // You could handle responses from Webflow here if needed
      });
    }
    
    // Run the setup
    setupWebflowCommunication();
    
    // Also try after DOM content is loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupWebflowCommunication);
    }
    
    // And after window load, just to be thorough
    window.addEventListener('load', setupWebflowCommunication);
  })();