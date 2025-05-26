const fs = require('fs');
const path = require('path');

// Get target from command line argument
const target = process.argv[2] || 'all';

const requiredFiles = {
  chrome: [
    'manifest.json',
    'background.js',
    'popup.js',
    'popup.html',
    'options.js',
    'options.html',
    'theme-detector.js',
    'node_modules/webextension-polyfill/dist/browser-polyfill.min.js'
  ],
  firefox: [
    'manifest.json',
    'background.js',
    'popup.js',
    'popup.html',
    'options.js',
    'options.html',
    'theme-detector.js',
    'node_modules/webextension-polyfill/dist/browser-polyfill.min.js'
  ]
};

function validateBuild(targetBrowser) {
  const distDir = path.join(__dirname, 'dist', targetBrowser);
  
  if (!fs.existsSync(distDir)) {
    console.error(`❌ Build directory does not exist: ${distDir}`);
    return false;
  }
  
  console.log(`\nValidating ${targetBrowser} build...`);
  
  let hasErrors = false;
  const missingFiles = [];
  
  requiredFiles[targetBrowser].forEach(file => {
    const filePath = path.join(distDir, file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
      hasErrors = true;
    }
  });
  
  if (missingFiles.length > 0) {
    console.error(`❌ Missing files in ${targetBrowser} build:`);
    missingFiles.forEach(file => console.error(`   - ${file}`));
  }
  
  // Validate manifest.json structure
  const manifestPath = path.join(distDir, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      
      // Check required manifest fields
      const requiredFields = ['manifest_version', 'name', 'version', 'description'];
      const missingFields = requiredFields.filter(field => !manifest[field]);
      
      if (missingFields.length > 0) {
        console.error(`❌ Missing manifest fields in ${targetBrowser}:`, missingFields);
        hasErrors = true;
      }
      
      // Browser-specific checks
      if (targetBrowser === 'firefox') {
        if (!manifest.browser_specific_settings || !manifest.browser_specific_settings.gecko) {
          console.error(`❌ Firefox manifest missing browser_specific_settings.gecko`);
          hasErrors = true;
        }
      }
      
    } catch (error) {
      console.error(`❌ Invalid manifest.json in ${targetBrowser}:`, error.message);
      hasErrors = true;
    }
  }
  
  if (!hasErrors) {
    console.log(`✅ ${targetBrowser} build validated successfully!`);
  }
  
  return !hasErrors;
}

// Execute validation
let success = true;

if (target === 'chrome' || target === 'all') {
  success = validateBuild('chrome') && success;
}

if (target === 'firefox' || target === 'all') {
  success = validateBuild('firefox') && success;
}

if (!success) {
  console.error('\n❌ Build validation failed');
  process.exit(1);
} else {
  console.log('\n✅ All builds validated successfully!');
}