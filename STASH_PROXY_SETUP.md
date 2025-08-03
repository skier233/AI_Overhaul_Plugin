# StashAI Server Proxy Setup

To resolve Content Security Policy (CSP) issues when accessing the StashAI Server from the Stash web interface, you need to proxy the StashAI Server through Stash itself.

## Option 1: Nginx Reverse Proxy (Recommended)

If you're using Nginx to serve Stash, add this location block to your Stash server configuration:

```nginx
# In your Stash server block
location /stash-ai/ {
    proxy_pass http://localhost:8080/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    
    # Handle CORS
    add_header Access-Control-Allow-Origin *;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
    add_header Access-Control-Allow-Headers "Authorization, Content-Type";
    
    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
        add_header Access-Control-Allow-Headers "Authorization, Content-Type";
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 200;
    }
}
```

## Option 2: Apache Reverse Proxy

If using Apache, add to your Stash VirtualHost:

```apache
<Location /stash-ai/>
    ProxyPass http://localhost:8080/
    ProxyPassReverse http://localhost:8080/
    ProxyPreserveHost On
    
    # CORS headers
    Header always set Access-Control-Allow-Origin "*"
    Header always set Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS"
    Header always set Access-Control-Allow-Headers "Authorization, Content-Type"
</Location>
```

## Option 3: Direct Stash Integration (Advanced)

If you have access to modify Stash's configuration, you can add a reverse proxy directly to Stash's configuration.

## Option 4: Run StashAI Server on Stash Port with Path Prefix

Modify the StashAI Server to run with a path prefix. This requires changes to the Docker Compose and FastAPI configuration.

## Testing the Proxy

Once configured, your StashAI Server should be accessible at:
- Health check: `http://your-stash-server/stash-ai/api/v1/health`
- API docs: `http://your-stash-server/stash-ai/docs`

## Plugin Configuration

In the StashAI Integration settings:
1. ✅ Check "Use relative URL (CSP compliant)"
2. The plugin will use `/stash-ai/api/v1/health` automatically
3. Test the connection to verify everything works

## Troubleshooting

### CSP Errors
If you still see CSP errors, the proxy is not configured correctly. Check:
- Proxy is active and receiving requests
- CORS headers are being set properly
- The path `/stash-ai/` correctly forwards to the StashAI Server

### Connection Refused
- Ensure StashAI Server is running on port 8080
- Check that the proxy configuration points to the correct port
- Verify firewall settings allow the connection

### 404 Errors
- The proxy path `/stash-ai/` must be configured exactly as shown
- Ensure the trailing slashes are correct in the proxy configuration
- Check that StashAI Server is responding on the backend