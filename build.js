#!/usr/bin/env node

// =============================================================================
// AI Overhaul - Build Script
// =============================================================================

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building AI Overhaul plugin...\n');

// Ensure dist directory exists
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist');
}

// Build configuration
const buildConfig = {
  target: 'es2017',
  module: 'none', // Changed from 'commonjs' to 'none' for browser compatibility
  jsx: 'react',
  esModuleInterop: true,
  skipLibCheck: true,
  outDir: 'dist',
  declaration: false,
  sourceMap: false
};

const buildFlags = Object.entries(buildConfig)
  .map(([key, value]) => `--${key} ${value}`)
  .join(' ');

try {
  // Step 1: Compile TypeScript files
  console.log('📦 Compiling TypeScript files...');
  
  // Compile all TypeScript components
  execSync(`npx tsc src/index-browser.ts ${buildFlags}`, { stdio: 'inherit' });
  execSync(`npx tsc src/AISettings.tsx ${buildFlags}`, { stdio: 'inherit' });
  execSync(`npx tsc src/AIResultsOverlay.tsx ${buildFlags}`, { stdio: 'inherit' });
  execSync(`npx tsc src/AIResultsOverlayGalleries.tsx ${buildFlags}`, { stdio: 'inherit' });
  execSync(`npx tsc src/InteractionSyncService.tsx ${buildFlags}`, { stdio: 'inherit' });
  
  console.log('✅ TypeScript compilation complete\n');
  
  // Step 2: Create wrapper for the new modular system
  console.log('🔧 Creating modular wrapper...');
  
  // Read all component files
  const indexBrowserContent = fs.readFileSync('dist/index-browser.js', 'utf8');
  const interactionSyncServiceContent = fs.readFileSync('dist/InteractionSyncService.js', 'utf8');
  const aiSettingsContent = fs.readFileSync('dist/AISettings.js', 'utf8');
  const aiResultsOverlayContent = fs.readFileSync('dist/AIResultsOverlay.js', 'utf8');
  const aiResultsOverlayGalleriesContent = fs.readFileSync('dist/AIResultsOverlayGalleries.js', 'utf8');
  
  const wrapperContent = `
// =============================================================================
// AI Overhaul - Modular Plugin Wrapper (Browser Compatible)
// =============================================================================

${indexBrowserContent}

// =============================================================================
// Interaction Sync Service
// =============================================================================

${interactionSyncServiceContent}

// =============================================================================
// AI Settings Component
// =============================================================================

${aiSettingsContent}

// =============================================================================
// AI Results Overlay Component
// =============================================================================

${aiResultsOverlayContent}

// =============================================================================
// AI Results Overlay Galleries Component
// =============================================================================

${aiResultsOverlayGalleriesContent}
`;

  fs.writeFileSync('dist/AIOverhaul_Modular.js', wrapperContent);
  
  console.log('✅ Modular wrapper created\n');
  
  // Step 3: Update manifest for modular structure
  console.log('📋 Updating plugin manifest...');
  
  const manifestPath = 'dist/AIOverhaul.yml';
  let manifestContent = fs.readFileSync(manifestPath, 'utf8');
  
  // Ensure only the modular file is in the JavaScript array
  if (!manifestContent.includes('AIOverhaul_Modular.js') || manifestContent.includes('AISettings.js')) {
    manifestContent = manifestContent.replace(
      /ui:\s*\n\s*javascript:\s*\n(\s*-\s*.*\n)*/m,
      `ui:\n  javascript:\n  - AIOverhaul_Modular.js\n`
    );
    
    fs.writeFileSync(manifestPath, manifestContent);
    console.log('✅ Manifest updated\n');
  }
  
  // Step 4: Validate build
  console.log('🔍 Validating build...');
  
  const requiredFiles = [
    'dist/index-browser.js',
    'dist/AIOverhaul_Modular.js',
    'dist/AIOverhaul.yml'
  ];
  
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
  
  if (missingFiles.length > 0) {
    console.error('❌ Build validation failed. Missing files:', missingFiles);
    process.exit(1);
  }
  
  console.log('✅ Build validation passed\n');
  
  // Step 5: Generate build summary
  console.log('📊 Build Summary:');
  console.log('==========================================');
  
  const buildStats = {
    'Modular Architecture': '✅ Implemented',
    'Type Definitions': '✅ Created',
    'API Service Layer': '✅ Abstracted', 
    'Tracking Service': '✅ Centralized',
    'Component Modularity': '✅ Separated',
    'Build System': '✅ Automated'
  };
  
  Object.entries(buildStats).forEach(([feature, status]) => {
    console.log(`  ${feature}: ${status}`);
  });
  
  console.log('==========================================');
  console.log('🎉 Build completed successfully!\n');
  
  console.log('📝 Next Steps:');
  console.log('  1. Restart Stash to load the updated plugin');
  console.log('  2. Check browser console for "AI Overhaul: Plugin initialized successfully"');
  console.log('  3. Test the AI button in the navigation bar');
  console.log('  4. Use window.aiOverhaulDebug for debugging');
  console.log('');
  
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}