# AI Overhaul Plugin - Modular Architecture

A comprehensive AI integration plugin for Stash with modular architecture and extensible API abstraction layer.

## 🏗️ Architecture Overview

The plugin has been streamlined into a clean, efficient structure:

```
src/
└── index-browser.ts    # Single browser-compatible entry point
                        # Contains all modular components internally:
                        # - Type definitions
                        # - API abstraction layer  
                        # - Tracking service
                        # - React components
                        # - Context detection
                        # - Styling system
```

**Why This Approach?**
- ✅ **Zero Dependencies** - No module loader required
- ✅ **Browser Native** - Pure JavaScript, no `exports` errors
- ✅ **Single File** - Easy deployment and debugging
- ✅ **Modular Inside** - Clean internal organization
- ✅ **TypeScript Source** - Full type safety during development

## 🚀 Key Features

### ✅ **Modular Architecture**
- Clean separation of concerns
- Reusable components and services
- Type-safe interfaces throughout

### ✅ **API Abstraction Layer**
- Extensible service architecture for multiple AI backends
- Built-in support for Facial Recognition and Content Analysis services
- Easy integration of new API endpoints

### ✅ **Context-Aware AI Actions**
- Dynamic action menus based on current page (scenes, galleries, performers, etc.)
- Smart context detection with real-time URL monitoring
- Relevant AI actions for each content type

### ✅ **Comprehensive Tracking**
- Centralized tracking service with granular controls
- SQLite database integration for persistent storage
- Configurable filtering and privacy controls

### ✅ **React Error Prevention**
- Safe component patching to avoid React render cycle interference
- URL-based tracking instead of unsafe component patches
- Proper error handling and fallbacks

## 🔧 Development Workflow

### Building the Plugin

```bash
# Build the entire modular structure
node build.js

# The build process will:
# 1. Compile TypeScript to JavaScript
# 2. Create modular wrapper
# 3. Update plugin manifest
# 4. Validate build integrity
```

### File Structure After Build

```
dist/
├── index-browser.js       # Compiled browser-compatible entry point
├── AIOverhaul_Modular.js  # Main plugin file (wraps index-browser.js)
├── AIOverhaul.yml         # Plugin manifest (loads only AIOverhaul_Modular.js)
├── ai_database_manager.py # Python SQLite database manager
└── backups/               # JSON export backups
```

## 🎯 Usage

### For Users

1. **AI Button**: Look for the 🧠 brain icon in the navigation bar
2. **Context Actions**: Actions change based on the current page
3. **Settings**: Configure tracking and filtering in Settings → Tools
4. **Debugging**: Use `window.aiOverhaulDebug` in browser console

### For Developers

```typescript
// Access services globally
const trackingService = window.aiOverhaulDebug.trackingService;
const apiManager = window.aiOverhaulDebug.apiServiceManager;

// Test tracking
window.aiOverhaulDebug.testTracking();

// Export interaction data
window.aiOverhaulDebug.exportData();

// Check service health
await window.aiOverhaulDebug.checkServices();
```

## 🔌 API Integration

### Facial Recognition Service

```typescript
import { FacialRecognitionService } from './services/api/APIService';

const facialService = new FacialRecognitionService('http://localhost:8000');

// Identify performers in a scene
const result = await facialService.identifyPerformersInScene(sceneInfo);
```

### Adding New Services

```typescript
export class MyCustomService extends APIService {
  async checkHealth() {
    return this.makeRequest('/health');
  }
  
  getEndpoints() {
    return [
      {
        name: 'My Custom Action',
        url: '/api/v1/my-action',
        method: 'POST',
        description: 'Does something awesome',
        category: 'custom'
      }
    ];
  }
}

// Register the service
apiServiceManager.registerService('my_service', new MyCustomService());
```

## 📊 Context-Aware Actions

The plugin automatically detects the current page and shows relevant AI actions:

- **Scenes**: Identify performers, analyze content
- **Galleries**: Batch identify images, extract metadata  
- **Images**: Face detection, content analysis
- **Performers**: Compare faces, similarity analysis
- **Groups**: Bulk operations, content categorization

## 🛠️ Configuration

### Tracking Settings
- **Granular Controls**: Enable/disable specific tracking types
- **ID Filtering**: Exclude specific entities from tracking
- **Video Tracking**: Configurable intervals and background tracking
- **Data Export**: JSON export with configurable retention

### API Configuration
- **Service URLs**: Configure backend service endpoints
- **Authentication**: API key management
- **Timeouts**: Request timeout configuration
- **Health Checks**: Automatic service availability monitoring

## 🐛 Debugging

### Console Commands

```javascript
// View tracking statistics
window.aiOverhaulDebug.getStats()

// Test tracking functionality  
window.aiOverhaulDebug.testTracking()

// Export interaction data
window.aiOverhaulDebug.exportData()

// Check API service health
await window.aiOverhaulDebug.checkServices()
```

### Common Issues

1. **Missing Brain Icon**: Check browser console for initialization errors
2. **React Error #31**: Fixed in v2.0 with safer URL-based tracking
3. **API Connectivity**: Use health check commands to diagnose service issues

## 🚀 Future Roadmap

- [ ] Docker integration for backend services
- [ ] Custom icon support replacing emoji placeholders
- [ ] Advanced analytics dashboard
- [ ] Real-time service monitoring
- [ ] Plugin marketplace integration

## 📝 Version History

- **v2.0.0**: Complete modular architecture rewrite
- **v1.1.0**: Context-aware actions and React error fixes  
- **v1.0.0**: Initial release with basic tracking

## 🤝 Contributing

The modular architecture makes it easy to contribute:

1. **Components**: Add new UI components in `src/components/`
2. **Services**: Extend API services in `src/services/api/`
3. **Utils**: Add utility functions in `src/utils/`
4. **Types**: Update type definitions in `src/types/`

Build and test your changes with `node build.js` before submitting.