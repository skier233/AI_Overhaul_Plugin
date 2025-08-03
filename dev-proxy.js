#!/usr/bin/env node

/**
 * StashAI Proxy Server for Production Use
 * 
 * This proxy server acts as a bridge between Stash and the StashAI Server,
 * solving Content Security Policy issues by serving StashAI endpoints
 * from the same origin as Stash.
 * 
 * Features:
 * - Proxies /stash-ai/* requests to StashAI Server
 * - Serves static plugin files
 * - CORS handling for cross-origin requests  
 * - Health monitoring and logging
 * - Graceful shutdown handling
 * 
 * Usage: node dev-proxy.js [--port=PORT] [--stash-ai-url=URL]
 */

const http = require('http');
const httpProxy = require('http-proxy-middleware');
const express = require('express');
const path = require('path');

// Configuration from environment variables or command line
const PORT = process.env.STASH_AI_PROXY_PORT || process.argv.find(arg => arg.startsWith('--port='))?.split('=')[1] || 9999;
const STASH_AI_URL = process.env.STASH_AI_SERVER_URL || process.argv.find(arg => arg.startsWith('--stash-ai-url='))?.split('=')[1] || 'http://localhost:8080';
const STASH_URL = process.env.STASH_SERVER_URL || process.argv.find(arg => arg.startsWith('--stash-url='))?.split('=')[1] || 'http://localhost:9999';

const app = express();

// Create proxy middleware for StashAI Server
const stashAIProxy = httpProxy.createProxyMiddleware({
  target: STASH_AI_URL,
  changeOrigin: true,
  pathRewrite: {
    '^/stash-ai': '', // Remove /stash-ai prefix when forwarding
  },
  onProxyReq: (proxyReq, req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [STASH-AI] ${req.method} ${req.url} -> ${STASH_AI_URL}${req.url.replace('/stash-ai', '')}`);
  },
  onProxyRes: (proxyRes, req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [STASH-AI] ${proxyRes.statusCode} ${req.method} ${req.url}`);
  },
  onError: (err, req, res) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [STASH-AI ERROR] ${err.message} for ${req.url}`);
    
    if (!res.headersSent) {
      res.status(503).json({ 
        error: 'StashAI Server unavailable', 
        message: err.message,
        target: STASH_AI_URL,
        timestamp
      });
    }
  }
});

// Create proxy middleware for Stash Server (fallback)
const stashProxy = httpProxy.createProxyMiddleware({
  target: STASH_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [STASH] ${req.method} ${req.url} -> ${STASH_URL}${req.url}`);
  },
  onError: (err, req, res) => {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [STASH ERROR] ${err.message} for ${req.url}`);
    
    if (!res.headersSent) {
      res.status(503).json({ 
        error: 'Stash Server unavailable', 
        message: err.message,
        target: STASH_URL,
        timestamp
      });
    }
  }
});

// Apply CORS middleware to all responses
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  next();
});

// Health check endpoint for the proxy itself
app.get('/proxy/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'stash-ai-proxy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    configuration: {
      port: PORT,
      stash_ai_url: STASH_AI_URL,
      stash_url: STASH_URL
    }
  });
});

// Proxy /stash-ai/* requests to StashAI Server
app.use('/stash-ai', stashAIProxy);

// Handle plugin file requests specifically
app.get('/plugin/AIOverhaul/javascript', (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PLUGIN] Serving AIOverhaul plugin JavaScript files`);
  
  // Serve the main plugin file
  res.setHeader('Content-Type', 'application/javascript');
  res.setHeader('Cache-Control', 'no-cache');
  
  // Read and combine the plugin files
  const fs = require('fs');
  const path = require('path');
  
  try {
    let combinedJS = '';
    
    // Add main plugin
    const mainPluginPath = path.join(__dirname, 'dist', 'AIOverhaul_Modular.js');
    if (fs.existsSync(mainPluginPath)) {
      combinedJS += fs.readFileSync(mainPluginPath, 'utf8') + '\n\n';
      console.log(`[${timestamp}] [PLUGIN] Added AIOverhaul_Modular.js`);
    }
    
    // Add AISettings plugin
    const settingsPluginPath = path.join(__dirname, 'dist', 'AISettings.js');
    if (fs.existsSync(settingsPluginPath)) {
      combinedJS += fs.readFileSync(settingsPluginPath, 'utf8') + '\n\n';
      console.log(`[${timestamp}] [PLUGIN] Added AISettings.js`);
    }
    
    if (combinedJS) {
      res.send(combinedJS);
    } else {
      res.status(404).send('// Plugin files not found');
    }
  } catch (error) {
    console.error(`[${timestamp}] [PLUGIN ERROR] ${error.message}`);
    res.status(500).send(`// Error loading plugin: ${error.message}`);
  }
});

// Handle individual plugin JavaScript files
app.get('/plugin/AIOverhaul/:filename', (req, res) => {
  const filename = req.params.filename;
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PLUGIN] Request for individual file: ${filename}`);
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    let filePath;
    let contentType = 'application/javascript';
    
    // Map requested files to actual files
    if (filename === 'AIOverhaul_Modular.js' || filename === 'AISettings.js') {
      filePath = path.join(__dirname, 'dist', filename);
    } else if (filename === 'config' || filename === 'AIOverhaul.yml') {
      filePath = path.join(__dirname, 'dist', 'AIOverhaul.yml');
      contentType = 'text/yaml';
    } else {
      // Try to serve from dist directory
      filePath = path.join(__dirname, 'dist', filename);
    }
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'no-cache');
      res.send(content);
      console.log(`[${timestamp}] [PLUGIN] Served ${filename} successfully`);
    } else {
      console.log(`[${timestamp}] [PLUGIN] File not found: ${filename}`);
      res.status(404).send(`Plugin file not found: ${filename}`);
    }
  } catch (error) {
    console.error(`[${timestamp}] [PLUGIN ERROR] ${error.message}`);
    res.status(500).send(`Error loading plugin file: ${error.message}`);
  }
});

// Handle plugin YAML config requests (legacy)
app.get('/plugin/AIOverhaul/config', (req, res) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [PLUGIN] Serving AIOverhaul plugin config (legacy route)`);
  
  const fs = require('fs');
  const path = require('path');
  
  try {
    const configPath = path.join(__dirname, 'dist', 'AIOverhaul.yml');
    if (fs.existsSync(configPath)) {
      const config = fs.readFileSync(configPath, 'utf8');
      res.setHeader('Content-Type', 'text/yaml');
      res.send(config);
    } else {
      res.status(404).send('Plugin config not found');
    }
  } catch (error) {
    console.error(`[${timestamp}] [PLUGIN ERROR] ${error.message}`);
    res.status(500).send(`Error loading plugin config: ${error.message}`);
  }
});

// Serve other plugin static files
app.use('/plugin', express.static(__dirname));

// Fallback: Proxy everything else to Stash Server
app.use('/', stashProxy);

// Start the server
const server = app.listen(PORT, () => {
  console.log(`\n🚀 StashAI Proxy Server started successfully!`);
  console.log(`┌─────────────────────────────────────────────────┐`);
  console.log(`│                  Configuration                  │`);
  console.log(`├─────────────────────────────────────────────────┤`);
  console.log(`│ Proxy Server:    http://localhost:${PORT.toString().padEnd(12)} │`);
  console.log(`│ StashAI Server:  ${STASH_AI_URL.padEnd(23)} │`);
  console.log(`│ Stash Server:    ${STASH_URL.padEnd(23)} │`);
  console.log(`├─────────────────────────────────────────────────┤`);
  console.log(`│                    Endpoints                    │`);
  console.log(`├─────────────────────────────────────────────────┤`);
  console.log(`│ Proxy Health:    /proxy/health                  │`);
  console.log(`│ StashAI API:     /stash-ai/api/v1/*             │`);
  console.log(`│ Plugin Files:    /plugin/*                      │`);
  console.log(`│ Stash UI:        /* (fallback)                  │`);
  console.log(`└─────────────────────────────────────────────────┘`);
  console.log(`\n🔧 Usage:`);
  console.log(`   • Access Stash through: http://localhost:${PORT}`);
  console.log(`   • StashAI APIs available at: /stash-ai/api/v1/*`);
  console.log(`   • No more CSP violations! 🎉\n`);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n📡 Received ${signal}, shutting down gracefully...`);
  
  server.close(() => {
    console.log('🔒 HTTP server closed');
    console.log('👋 StashAI Proxy Server shutdown complete');
    process.exit(0);
  });
  
  // Force close after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));