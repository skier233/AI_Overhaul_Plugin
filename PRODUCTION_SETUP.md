# StashAI Production Setup with Proxy Server

This guide shows you how to set up the StashAI Proxy Server for production use, solving Content Security Policy issues and providing seamless integration between Stash and StashAI Server.

## 🎯 What This Solves

- ✅ **Content Security Policy (CSP) Compliance**: No more browser blocks on API calls
- ✅ **Same-Origin Policy**: All requests appear to come from the same server
- ✅ **Seamless Integration**: Access Stash through the proxy with StashAI APIs available
- ✅ **Production Ready**: Logging, health checks, graceful shutdown

## 🚀 Quick Start

### Option 1: Direct Node.js (Recommended)

1. **Start StashAI Server** (if not already running):
   ```bash
   cd /path/to/StashAIServer
   docker-compose up -d
   ```

2. **Start the Proxy Server**:
   ```bash
   cd /path/to/plugins/AIOverhaul
   npm run proxy
   ```

3. **Access Stash through the proxy**:
   - Open: `http://localhost:9999`
   - StashAI APIs available at: `http://localhost:9999/stash-ai/api/v1/*`

### Option 2: Using Startup Script

```bash
./start-stash-ai-proxy.sh
```

### Option 3: Docker Compose

```bash
npm run proxy:docker
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file (copy from `.env.example`):

```bash
# Port for the proxy server
STASH_AI_PROXY_PORT=9999

# StashAI Server URL
STASH_AI_SERVER_URL=http://localhost:8080

# Stash Server URL
STASH_SERVER_URL=http://localhost:9999
```

### Command Line Options

```bash
node dev-proxy.js --port=9999 --stash-ai-url=http://localhost:8080 --stash-url=http://localhost:9999
```

## 🏗️ Architecture

```
Browser ────┐
            ├──> Proxy Server (Port 9999) ─┬──> Stash Server (Port 9999)
            │                               └──> StashAI Server (Port 8080)
            └──> /stash-ai/* requests ──────────> StashAI Server
```

The proxy server:
1. **Routes `/stash-ai/*` requests** → StashAI Server
2. **Routes all other requests** → Stash Server  
3. **Serves plugin files** from `/plugin/*`
4. **Handles CORS** and security headers

## 🔧 Plugin Configuration

In Stash Settings > Tools > StashAI Integration:

1. ✅ **Check "Use relative URL (CSP compliant)"**
2. **Test Connection** - should show green status
3. **Configure AI services** as needed

## 📊 Monitoring

### Health Checks

- **Proxy Health**: `http://localhost:9999/proxy/health`
- **StashAI Health**: `http://localhost:9999/stash-ai/api/v1/health`

```bash
# Check proxy health
npm run health

# Or manually
curl http://localhost:9999/proxy/health
```

### Logs

The proxy server provides detailed request logging:

```
[2025-07-30T23:45:12.123Z] [STASH-AI] GET /stash-ai/api/v1/health -> http://localhost:8080/api/v1/health
[2025-07-30T23:45:12.125Z] [STASH-AI] 200 GET /stash-ai/api/v1/health
```

## 🔄 Production Deployment

### Systemd Service (Linux)

Create `/etc/systemd/system/stash-ai-proxy.service`:

```ini
[Unit]
Description=StashAI Proxy Server
After=network.target

[Service]
Type=simple
User=stash
WorkingDirectory=/path/to/plugins/AIOverhaul
ExecStart=/usr/bin/node dev-proxy.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=STASH_AI_PROXY_PORT=9999
Environment=STASH_AI_SERVER_URL=http://localhost:8080
Environment=STASH_SERVER_URL=http://localhost:9999

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable stash-ai-proxy
sudo systemctl start stash-ai-proxy
sudo systemctl status stash-ai-proxy
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose -f docker-compose.proxy.yml up -d

# Or with custom configuration
STASH_AI_PROXY_PORT=8080 docker-compose -f docker-compose.proxy.yml up -d
```

### PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dev-proxy.js --name "stash-ai-proxy" -- --port=9999

# Save PM2 configuration
pm2 save
pm2 startup
```

## 🚨 Troubleshooting

### Common Issues

**1. "Port already in use"**
```bash
# Find what's using the port
lsof -i :9999
# Kill the process or use a different port
```

**2. "StashAI Server unavailable"**
```bash
# Check if StashAI Server is running
curl http://localhost:8080/api/v1/health
# Start StashAI Server if needed
cd /path/to/StashAIServer && docker-compose up -d
```

**3. "Stash Server unavailable"**
- Make sure Stash is running on the configured port
- Update `STASH_SERVER_URL` in configuration

**4. CSP errors still occurring**
- Ensure you're accessing Stash through the proxy URL
- Check that "Use relative URL" is enabled in plugin settings

### Debug Mode

Enable verbose logging:
```bash
DEBUG=* node dev-proxy.js
```

## 📋 Available Scripts

```bash
npm run proxy          # Start proxy with default settings
npm run proxy:docker   # Start with Docker Compose
npm run start          # Use startup script
npm run test           # Start on test port (9998)
npm run health         # Check proxy health
```

## 🔐 Security Considerations

- The proxy server runs with minimal privileges
- CORS headers are configured for security
- Health check endpoints don't expose sensitive information
- Graceful shutdown prevents data loss
- All requests are logged for monitoring

## 🎉 Success!

Once running successfully, you should see:

```
🚀 StashAI Proxy Server started successfully!
┌─────────────────────────────────────────────────┐
│                  Configuration                  │
├─────────────────────────────────────────────────┤
│ Proxy Server:    http://localhost:9999         │
│ StashAI Server:  http://localhost:8080         │
│ Stash Server:    http://localhost:9999         │
└─────────────────────────────────────────────────┘

🔧 Usage:
   • Access Stash through: http://localhost:9999
   • StashAI APIs available at: /stash-ai/api/v1/*
   • No more CSP violations! 🎉
```

Your StashAI integration is now production-ready! 🚀