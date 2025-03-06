// // scripts/build-webflow-extension.js
// const fs = require('fs');
// const path = require('path');
// const { execSync } = require('child_process');

// // Make sure directories exist
// const scriptsDir = path.resolve(__dirname);
// const publicDir = path.resolve(__dirname, '../public');

// if (!fs.existsSync(publicDir)) {
//   fs.mkdirSync(publicDir, { recursive: true });
// }

// try {
//   // Skip Next.js build for now as it's causing issues
//   console.log('Skipping Next.js build for debugging...');
  
//   // Create a simple entry point JS file if it doesn't exist yet
//   const entryFile = path.join(publicDir, 'webflow-extension-bundle.js');
//   if (!fs.existsSync(entryFile)) {
//     console.log('Creating simple entry point JS file...');
//     const simpleContent = `
//       // Webflow Extension Entry Point
//       document.addEventListener('DOMContentLoaded', () => {
//         const root = document.getElementById('root');
//         root.innerHTML = '<h1>Webflow Extension</h1><p>Basic setup is working!</p>';
//         console.log('Webflow extension initialized');
//       });
//     `;
//     fs.writeFileSync(entryFile, simpleContent);
//   }
  
//   // Run the Webflow extension bundler
//   console.log('Bundling Webflow extension...');
//   try {
//     execSync('npx webflow extension bundle', { stdio: 'inherit' });
//     console.log('Webflow extension build completed successfully!');
//   } catch (bundleError) {
//     console.error('Error during bundling:', bundleError.message);
//     // Continue execution
//   }
// } catch (error) {
//   console.error('Error in build script:', error.message);
//   process.exit(1);
// }