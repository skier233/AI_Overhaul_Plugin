(function () {
  const PluginApi = (window as any).PluginApi;
  const React = PluginApi.React;

  const { Button } = PluginApi.libraries.Bootstrap;

  interface StashAIServerStatus {
    success: boolean;
    message: string;
    status: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: Record<string, string>;
    metrics: {
      total_services: number;
      healthy_services: number;
      active_batch_jobs: number;
    };
    service_name: string;
    version: string;
    uptime: number;
  }

  const AISettingsDropdown: React.FC = () => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [serverUrl, setServerUrl] = React.useState('');
    const [serverStatus, setServerStatus] = (React as any).useState(null);
    const [isCheckingStatus, setIsCheckingStatus] = (React as any).useState(false);
    const [lastChecked, setLastChecked] = (React as any).useState(null);
    const [autoRefresh, setAutoRefresh] = React.useState(false);
    
    // AI Service Settings
    const [enableFacialRecognition, setEnableFacialRecognition] = React.useState(true);
    const [facialRecognitionThreshold, setFacialRecognitionThreshold] = React.useState(0.5);
    const [maxResults, setMaxResults] = React.useState(5);
    const [enableSceneAnalysis, setEnableSceneAnalysis] = React.useState(true);
    const [enableGalleryAnalysis, setEnableGalleryAnalysis] = React.useState(true);
    
    // AI Job History
    const [showHistory, setShowHistory] = React.useState(false);
    const [aiJobHistory, setAiJobHistory] = React.useState([]);
    const [expandedJobs, setExpandedJobs] = React.useState(new Set());
    const [jobTests, setJobTests] = React.useState({});
    const [historyLoading, setHistoryLoading] = React.useState(false);
    const [historyStats, setHistoryStats] = React.useState(null);
    
    // Database Sync Settings
    const [showSyncSettings, setShowSyncSettings] = React.useState(false);
    const [enableServerSync, setEnableServerSync] = React.useState(true);
    const [syncInterval, setSyncInterval] = React.useState(5);
    const [maxBatchSize, setMaxBatchSize] = React.useState(50);
    const [fallbackToLocal, setFallbackToLocal] = React.useState(true);
    const [syncStatus, setSyncStatus] = React.useState(null);
    
    // Test Results Overlay
    const [showTestResults, setShowTestResults] = React.useState(false);
    const [testResultsData, setTestResultsData] = React.useState(null);
    const [testResultsType, setTestResultsType] = React.useState(null);
    const [testResultsLoading, setTestResultsLoading] = React.useState(false);

    // Load settings from localStorage
    React.useEffect(() => {
      const saved = localStorage.getItem('stash_ai_settings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          setServerUrl(settings.serverUrl ?? '');
          setAutoRefresh(settings.autoRefresh ?? false);
          setEnableFacialRecognition(settings.enableFacialRecognition ?? true);
          setFacialRecognitionThreshold(settings.facialRecognitionThreshold ?? 0.5);
          setMaxResults(settings.maxResults ?? 5);
          setEnableSceneAnalysis(settings.enableSceneAnalysis ?? true);
          setEnableGalleryAnalysis(settings.enableGalleryAnalysis ?? true);
        } catch (e) {
          console.warn('Failed to load StashAI settings:', e);
        }
      }
      
      // Load sync settings
      const syncSaved = localStorage.getItem('stash_ai_sync_settings');
      if (syncSaved) {
        try {
          const syncSettings = JSON.parse(syncSaved);
          setEnableServerSync(syncSettings.enableServerSync ?? true);
          setSyncInterval(syncSettings.syncInterval ?? 5);
          setMaxBatchSize(syncSettings.maxBatchSize ?? 50);
          setFallbackToLocal(syncSettings.fallbackToLocal ?? true);
        } catch (e) {
          console.warn('Failed to load StashAI sync settings:', e);
        }
      }
    }, []);

    // Auto-refresh server status
    React.useEffect(() => {
      let interval: any;
      if (autoRefresh && isOpen) {
        checkServerStatus();
        interval = setInterval(checkServerStatus, 30000); // Check every 30 seconds
      }
      return () => {
        if (interval) clearInterval(interval);
      };
    }, [autoRefresh, isOpen, serverUrl]);

    const checkServerStatus = async () => {
      setIsCheckingStatus(true);
      try {
        // Use global endpoint configuration
        const endpoint = (window as any).stashAIEndpoint();
        const healthUrl = `${endpoint.url}/api/v1/health`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: endpoint.headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          setServerStatus(data);
          setLastChecked(new Date());
        } else {
          setServerStatus({
            success: false,
            message: `HTTP ${response.status}: ${response.statusText}`,
            status: 'unhealthy',
            dependencies: {},
            metrics: { total_services: 0, healthy_services: 0, active_batch_jobs: 0 },
            service_name: 'stash-ai-server',
            version: 'unknown',
            uptime: 0
          });
        }
      } catch (error: any) {
        setServerStatus({
          success: false,
          message: error.message || 'Connection failed',
          status: 'unhealthy',
          dependencies: {},
          metrics: { total_services: 0, healthy_services: 0, active_batch_jobs: 0 },
          service_name: 'stash-ai-server',
          version: 'unknown',
          uptime: 0
        });
      } finally {
        setIsCheckingStatus(false);
      }
    };

    const saveSettings = () => {
      const settings = {
        serverUrl,
        useRelativeUrl: serverUrl === '', // Use relative URL when serverUrl is empty
        apiKey: '', // No API key support in simplified version
        autoRefresh,
        enableFacialRecognition,
        facialRecognitionThreshold,
        maxResults,
        enableSceneAnalysis,
        enableGalleryAnalysis,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('stash_ai_settings', JSON.stringify(settings));
      
      // Notify other components that settings have changed
      if ((window as any).notifyStashAISettingsChange) {
        (window as any).notifyStashAISettingsChange();
      }
      
      alert('StashAI settings saved successfully!');
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'healthy': return '#28a745';
        case 'degraded': return '#ffc107';
        case 'unhealthy': return '#dc3545';
        default: return '#6c757d';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'healthy': return 'fa-check-circle';
        case 'degraded': return 'fa-exclamation-triangle';
        case 'unhealthy': return 'fa-times-circle';
        default: return 'fa-question-circle';
      }
    };

    const testConnection = () => {
      checkServerStatus();
    };

    const openServerDocs = () => {
      const endpoint = (window as any).stashAIEndpoint();
      const docsUrl = `${endpoint.url}/docs`;
      window.open(docsUrl, '_blank');
    };

    const clearSettings = () => {
      if (confirm('Clear all StashAI settings and reset to defaults?')) {
        localStorage.removeItem('stash_ai_settings');
        // Reset to defaults
        setServerUrl('');
        setAutoRefresh(false);
        setEnableFacialRecognition(true);
        setFacialRecognitionThreshold(0.5);
        setMaxResults(5);
        setEnableSceneAnalysis(true);
        setEnableGalleryAnalysis(true);
        setServerStatus(null);
        
        // Notify other components that settings have changed
        if ((window as any).notifyStashAISettingsChange) {
          (window as any).notifyStashAISettingsChange();
        }
        
        alert('Settings cleared! Using default relative URL configuration.');
      }
    };

    const debugSettings = () => {
      const currentSettings = {
        serverUrl,
        autoRefresh,
        enableFacialRecognition,
        facialRecognitionThreshold,
        maxResults,
        enableSceneAnalysis,
        enableGalleryAnalysis
      };
      
      const endpoint = (window as any).stashAIEndpoint();
      const savedSettings = localStorage.getItem('stash_ai_settings');
      
      console.log('Current Settings:', currentSettings);
      console.log('Saved Settings:', savedSettings ? JSON.parse(savedSettings) : 'None');
      console.log('Active Endpoint:', endpoint);
      
      alert(`Debug Info (check console for details):
      
Current Settings:
• Server URL: ${serverUrl || '[EMPTY - Using Relative URLs]'}
• Mode: ${serverUrl ? 'External Server' : 'Relative URLs (Default)'}

Active Endpoint:
• Base URL: ${endpoint.url}
• Health URL: ${endpoint.url}/api/v1/health`);
    };

    const fetchAIJobHistory = async () => {
      setHistoryLoading(true);
      try {
        const endpoint = (window as any).stashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/ai-jobs/history?limit=50`);
        
        if (response.ok) {
          const data = await response.json();
          setAiJobHistory(data.jobs || []);
        } else {
          console.error('Failed to fetch AI job history:', response.statusText);
          alert('Failed to fetch AI job history. Check server connection.');
        }
      } catch (error) {
        console.error('Error fetching AI job history:', error);
        alert('Error fetching AI job history. Check server connection.');
      }
      setHistoryLoading(false);
    };

    const fetchAIStatistics = async () => {
      try {
        const endpoint = (window as any).stashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/ai-runs/statistics`);
        
        if (response.ok) {
          const stats = await response.json();
          setHistoryStats(stats);
        } else {
          console.error('Failed to fetch AI statistics:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching AI statistics:', error);
      }
    };

    const fetchJobTests = async (jobId: string) => {
      try {
        const endpoint = (window as any).stashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/ai-jobs/${jobId}/tests`);
        
        if (response.ok) {
          const data = await response.json();
          setJobTests((prev: any) => ({
            ...prev,
            [jobId]: data.tests || []
          }));
        } else {
          console.error('Failed to fetch job tests:', response.statusText);
        }
      } catch (error) {
        console.error('Error fetching job tests:', error);
      }
    };

    const toggleJobExpansion = (jobId: string) => {
      const newExpanded = new Set(expandedJobs);
      if (newExpanded.has(jobId)) {
        newExpanded.delete(jobId);
      } else {
        newExpanded.add(jobId);
        // Fetch tests for this job if not already loaded
        if (!jobTests[jobId]) {
          fetchJobTests(jobId);
        }
      }
      setExpandedJobs(newExpanded);
    };

    const formatDuration = (seconds: number) => {
      if (seconds < 1) return `${(seconds * 1000).toFixed(0)}ms`;
      if (seconds < 60) return `${seconds.toFixed(1)}s`;
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleString();
    };

    const handleViewTestResults = async (testId: string, entityType: string) => {
      setTestResultsLoading(true);
      try {
        const endpoint = (window as any).stashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/ai-tests/${testId}/results`);
        
        if (response.ok) {
          const resultData = await response.json();
          setTestResultsData(resultData);
          setTestResultsType(entityType);
          setShowTestResults(true);
        } else {
          console.error('Failed to fetch test results:', response.statusText);
          alert('Failed to fetch test results. The test may not have completed successfully.');
        }
      } catch (error) {
        console.error('Error fetching test results:', error);
        alert('Error fetching test results. Check server connection.');
      }
      setTestResultsLoading(false);
    };

    const getStatusBadgeColor = (status: string) => {
      switch (status) {
        case 'completed': return '#28a745';
        case 'failed': return '#dc3545';
        case 'processing': return '#007bff';
        case 'pending': return '#ffc107';
        default: return '#6c757d';
      }
    };

    const fetchSyncStatus = async () => {
      try {
        if ((window as any).stashAIInteractionSync) {
          const status = (window as any).stashAIInteractionSync.getSyncStatus();
          setSyncStatus(status);
        }
        
        // Also get server sync status
        const endpoint = (window as any).stashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/interactions/status`);
        
        if (response.ok) {
          const serverStatus = await response.json();
          setSyncStatus((prev: any) => ({
            ...prev,
            serverStatus
          }));
        }
      } catch (error) {
        console.error('Error fetching sync status:', error);
      }
    };

    const saveSyncSettings = () => {
      const syncSettings = {
        enableServerSync,
        syncInterval,
        maxBatchSize,
        fallbackToLocal,
        updatedAt: new Date().toISOString()
      };
      
      localStorage.setItem('stash_ai_sync_settings', JSON.stringify(syncSettings));
      
      // Update the sync service if available
      if ((window as any).stashAIInteractionSync) {
        (window as any).stashAIInteractionSync.updateSyncSettings(syncSettings);
      }
      
      alert('Database sync settings saved successfully!');
    };

    const forceSyncNow = async () => {
      try {
        if ((window as any).stashAIInteractionSync) {
          const result = await (window as any).stashAIInteractionSync.forcSync();
          setSyncStatus(result);
          alert(`Sync completed! Synced: ${result.totalSynced}, Pending: ${result.pendingCount}, Failed: ${result.failedCount}`);
        } else {
          alert('Sync service not available. Please refresh the page.');
        }
      } catch (error) {
        alert(`Sync failed: ${(error as Error).message}`);
      }
    };

    const exportLocalInteractions = async () => {
      try {
        if ((window as any).stashAIInteractionSync) {
          const interactions = await (window as any).stashAIInteractionSync.exportLocalInteractions();
          const blob = new Blob([JSON.stringify(interactions, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `stash-ai-interactions-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        alert(`Export failed: ${(error as Error).message}`);
      }
    };

    const clearLocalInteractions = () => {
      if (confirm('Clear all local interaction data? This cannot be undone.')) {
        if ((window as any).stashAIInteractionSync) {
          (window as any).stashAIInteractionSync.clearLocalInteractions();
          setSyncStatus(null);
          alert('Local interaction data cleared.');
        }
      }
    };

    return (
      <div>
        <div 
          style={{ 
            cursor: 'pointer', 
            padding: '12px', 
            border: '1px solid #ddd', 
            borderRadius: '4px',
            backgroundColor: isOpen ? '#f8f9fa' : 'white',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span>
            <i className="fas fa-brain" style={{ marginRight: '8px' }}></i>
            StashAI Server Integration
            {serverStatus && (
              <span 
                style={{ 
                  marginLeft: '8px', 
                  padding: '2px 6px', 
                  borderRadius: '10px', 
                  fontSize: '10px', 
                  fontWeight: 'bold',
                  color: 'white',
                  backgroundColor: getStatusColor(serverStatus.status)
                }}
              >
                {serverStatus.status.toUpperCase()}
              </span>
            )}
          </span>
          <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`}></i>
        </div>
        
        {isOpen && (
          <div style={{ padding: '20px', border: '1px solid #ddd', borderTop: 'none', borderRadius: '0 0 4px 4px' }}>
            
            {/* Server Connection Settings */}
            <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <h5 style={{ marginBottom: '15px', color: '#495057' }}>
                <i className="fas fa-server" style={{ marginRight: '8px' }}></i>
                StashAI Server Connection
              </h5>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Server URL (leave empty for default setup):
                </label>
                <input
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:8080 (or leave empty for relative URLs)"
                  style={{ 
                    width: '100%', 
                    padding: '10px', 
                    border: '1px solid #ccc', 
                    borderRadius: '4px',
                    fontSize: '14px'
                  }}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '6px' }}>
                  {serverUrl ? 
                    `🌐 Using external server: ${serverUrl}` :
                    '🏠 Using relative URLs (default - works with proxied setup)'
                  }
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: '15px' }}>
                <Button 
                  onClick={testConnection} 
                  disabled={isCheckingStatus}
                  style={{ backgroundColor: '#007bff', border: 'none' }}
                >
                  {isCheckingStatus ? (
                    <>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                      Checking...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-plug" style={{ marginRight: '5px' }}></i>
                      Test Connection
                    </>
                  )}
                </Button>
                
                <Button 
                  onClick={openServerDocs}
                  style={{ backgroundColor: '#6c757d', border: 'none' }}
                >
                  <i className="fas fa-book" style={{ marginRight: '5px' }}></i>
                  API Docs
                </Button>

                <label style={{ display: 'flex', alignItems: 'center', marginLeft: '10px' }}>
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    style={{ marginRight: '5px' }}
                  />
                  Auto-refresh status
                </label>
              </div>

              {/* Server Status Display */}
              {serverStatus && (
                <div style={{ 
                  padding: '12px', 
                  borderRadius: '4px', 
                  backgroundColor: serverStatus.success ? '#d4edda' : '#f8d7da',
                  border: `1px solid ${serverStatus.success ? '#c3e6cb' : '#f5c6cb'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                    <i 
                      className={`fas ${getStatusIcon(serverStatus.status)}`}
                      style={{ 
                        color: getStatusColor(serverStatus.status), 
                        marginRight: '8px',
                        fontSize: '16px'
                      }}
                    ></i>
                    <strong>{serverStatus.message}</strong>
                  </div>
                  
                  <div style={{ fontSize: '12px', color: '#495057' }}>
                    <div><strong>Version:</strong> {serverStatus.version}</div>
                    <div><strong>Services:</strong> {serverStatus.metrics.healthy_services}/{serverStatus.metrics.total_services} healthy</div>
                    {serverStatus.metrics.active_batch_jobs > 0 && (
                      <div><strong>Active Jobs:</strong> {serverStatus.metrics.active_batch_jobs}</div>
                    )}
                    {lastChecked && (
                      <div><strong>Last Checked:</strong> {lastChecked.toLocaleTimeString()}</div>
                    )}
                  </div>

                  {/* Service Dependencies */}
                  {Object.keys(serverStatus.dependencies).length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px' }}>
                        Backend Services:
                      </div>
                      {Object.entries(serverStatus.dependencies).map(([service, status]) => (
                        <div key={service} style={{ fontSize: '11px', marginLeft: '10px' }}>
                          <i 
                            className={`fas ${getStatusIcon(status as string)}`}
                            style={{ 
                              color: getStatusColor(status as string), 
                              marginRight: '5px',
                              fontSize: '10px'
                            }}
                          ></i>
                          {service}: {status as any}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* AI Service Configuration */}
            <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
              <h5 style={{ marginBottom: '15px', color: '#1565c0' }}>
                <i className="fas fa-robot" style={{ marginRight: '8px' }}></i>
                AI Service Configuration
              </h5>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={enableFacialRecognition}
                    onChange={(e) => setEnableFacialRecognition(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <strong>Enable Facial Recognition</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={enableSceneAnalysis}
                    onChange={(e) => setEnableSceneAnalysis(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <strong>Enable Scene Analysis</strong>
                </label>

                <label style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="checkbox"
                    checked={enableGalleryAnalysis}
                    onChange={(e) => setEnableGalleryAnalysis(e.target.checked)}
                    style={{ marginRight: '8px' }}
                  />
                  <strong>Enable Gallery Analysis</strong>
                </label>
              </div>

              {enableFacialRecognition && (
                <div style={{ marginTop: '15px', padding: '10px', backgroundColor: 'white', borderRadius: '4px' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                      Recognition Threshold: {facialRecognitionThreshold}
                    </label>
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.1"
                      value={facialRecognitionThreshold}
                      onChange={(e) => setFacialRecognitionThreshold(parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6c757d' }}>
                      <span>Less strict (0.1)</span>
                      <span>More strict (1.0)</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                      Max Results per Request:
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={maxResults}
                      onChange={(e) => setMaxResults(parseInt(e.target.value))}
                      style={{ 
                        width: '100px', 
                        padding: '4px 8px', 
                        border: '1px solid #ccc', 
                        borderRadius: '4px' 
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button 
                onClick={debugSettings}
                style={{ backgroundColor: '#6c757d', border: 'none' }}
              >
                <i className="fas fa-bug" style={{ marginRight: '5px' }}></i>
                Debug
              </Button>
              
              <Button 
                onClick={clearSettings}
                style={{ backgroundColor: '#dc3545', border: 'none' }}
              >
                <i className="fas fa-trash" style={{ marginRight: '5px' }}></i>
                Clear Settings
              </Button>
              
              <Button 
                onClick={saveSettings} 
                style={{ backgroundColor: '#28a745', border: 'none' }}
              >
                <i className="fas fa-save" style={{ marginRight: '5px' }}></i>
                Save Settings
              </Button>
            </div>

            {/* Database Sync Settings Section */}
            <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#fff3cd', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h5 style={{ margin: '0', color: '#856404' }}>
                  <i className="fas fa-database" style={{ marginRight: '8px' }}></i>
                  Database Sync Settings
                </h5>
                <Button 
                  onClick={() => {
                    setShowSyncSettings(!showSyncSettings);
                    if (!showSyncSettings) {
                      fetchSyncStatus();
                    }
                  }}
                  style={{ backgroundColor: '#ffc107', border: 'none', color: '#212529', fontSize: '12px', padding: '5px 10px' }}
                >
                  {showSyncSettings ? 'Hide' : 'Configure'} Sync
                </Button>
              </div>

              {/* Sync Status Summary (always visible) */}
              {syncStatus && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: enableServerSync ? '#28a745' : '#6c757d' }}>
                      {enableServerSync ? 'ON' : 'OFF'}
                    </div>
                    <div style={{ fontSize: '10px', color: '#6c757d' }}>Server Sync</div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#007bff' }}>{syncStatus.pendingCount || 0}</div>
                    <div style={{ fontSize: '10px', color: '#6c757d' }}>Pending</div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#dc3545' }}>{syncStatus.failedCount || 0}</div>
                    <div style={{ fontSize: '10px', color: '#6c757d' }}>Failed</div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#28a745' }}>{syncStatus.totalSynced || 0}</div>
                    <div style={{ fontSize: '10px', color: '#6c757d' }}>Synced</div>
                  </div>
                </div>
              )}

              {/* Detailed Sync Settings (expandable) */}
              {showSyncSettings && (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <label style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={enableServerSync}
                        onChange={(e) => setEnableServerSync(e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      <strong>Enable Server Database Sync</strong>
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={fallbackToLocal}
                        onChange={(e) => setFallbackToLocal(e.target.checked)}
                        style={{ marginRight: '8px' }}
                      />
                      <strong>Fallback to Local Storage</strong>
                    </label>
                  </div>

                  {enableServerSync && (
                    <div style={{ padding: '15px', backgroundColor: 'white', borderRadius: '4px', marginBottom: '15px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Sync Interval (minutes): {syncInterval}
                          </label>
                          <input
                            type="range"
                            min="1"
                            max="60"
                            value={syncInterval}
                            onChange={(e) => setSyncInterval(parseInt(e.target.value))}
                            style={{ width: '100%' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#6c757d' }}>
                            <span>1 min</span>
                            <span>60 min</span>
                          </div>
                        </div>
                        <div>
                          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                            Max Batch Size:
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="200"
                            value={maxBatchSize}
                            onChange={(e) => setMaxBatchSize(parseInt(e.target.value))}
                            style={{
                              width: '100px',
                              padding: '4px 8px',
                              border: '1px solid #ccc',
                              borderRadius: '4px'
                            }}
                          />
                          <div style={{ fontSize: '11px', color: '#6c757d', marginTop: '2px' }}>
                            Items per sync batch
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Button 
                          onClick={forceSyncNow}
                          style={{ backgroundColor: '#007bff', border: 'none', fontSize: '12px' }}
                        >
                          <i className="fas fa-sync" style={{ marginRight: '5px' }}></i>
                          Force Sync Now
                        </Button>
                        <Button 
                          onClick={fetchSyncStatus}
                          style={{ backgroundColor: '#17a2b8', border: 'none', fontSize: '12px' }}
                        >
                          <i className="fas fa-info-circle" style={{ marginRight: '5px' }}></i>
                          Check Status
                        </Button>
                        <Button 
                          onClick={exportLocalInteractions}
                          style={{ backgroundColor: '#6c757d', border: 'none', fontSize: '12px' }}
                        >
                          <i className="fas fa-download" style={{ marginRight: '5px' }}></i>
                          Export Data
                        </Button>
                        <Button 
                          onClick={clearLocalInteractions}
                          style={{ backgroundColor: '#dc3545', border: 'none', fontSize: '12px' }}
                        >
                          <i className="fas fa-trash" style={{ marginRight: '5px' }}></i>
                          Clear Local
                        </Button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <Button 
                      onClick={saveSyncSettings}
                      style={{ backgroundColor: '#28a745', border: 'none' }}
                    >
                      <i className="fas fa-save" style={{ marginRight: '5px' }}></i>
                      Save Sync Settings
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* AI Run History Section */}
            <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h5 style={{ margin: '0', color: '#495057' }}>
                  <i className="fas fa-history" style={{ marginRight: '8px' }}></i>
                  AI Run History & Statistics
                </h5>
                <Button 
                  onClick={() => {
                    setShowHistory(!showHistory);
                    if (!showHistory) {
                      fetchAIJobHistory();
                      fetchAIStatistics();
                    }
                  }}
                  style={{ backgroundColor: '#17a2b8', border: 'none', fontSize: '12px', padding: '5px 10px' }}
                >
                  {showHistory ? 'Hide' : 'View'} History
                </Button>
              </div>

              {/* Statistics Summary (always visible) */}
              {historyStats && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginBottom: '15px' }}>
                  <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#007bff' }}>{historyStats.total_jobs || historyStats.total_runs}</div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>Total Jobs</div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>{historyStats.completed_jobs || historyStats.completed_runs}</div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>Completed</div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#dc3545' }}>{historyStats.failed_jobs || historyStats.failed_runs}</div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>Failed</div>
                  </div>
                  <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#17a2b8' }}>{(historyStats.job_success_rate || historyStats.success_rate || 0).toFixed(1)}%</div>
                    <div style={{ fontSize: '11px', color: '#6c757d' }}>Success Rate</div>
                  </div>
                  {historyStats.total_tests && (
                    <div style={{ padding: '8px', backgroundColor: 'white', borderRadius: '4px', textAlign: 'center' }}>
                      <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#6f42c1' }}>{historyStats.total_tests}</div>
                      <div style={{ fontSize: '11px', color: '#6c757d' }}>Total Tests</div>
                    </div>
                  )}
                </div>
              )}

              {/* Detailed History (expandable) */}
              {showHistory && (
                <div>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                      <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                      Loading AI job history...
                    </div>
                  ) : aiJobHistory.length > 0 ? (
                    <div style={{ maxHeight: '500px', overflowY: 'auto', backgroundColor: 'white', borderRadius: '4px', padding: '10px' }}>
                      {aiJobHistory.map((job: any, jobIndex: number) => (
                        <div key={job.job_id || jobIndex} style={{ 
                          marginBottom: '10px', 
                          border: '1px solid #dee2e6', 
                          borderRadius: '4px',
                          backgroundColor: '#f8f9fa'
                        }}>
                          {/* Job Header - Clickable to expand */}
                          <div 
                            style={{ 
                              padding: '12px', 
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              backgroundColor: expandedJobs.has(job.job_id) ? '#e9ecef' : '#f8f9fa'
                            }}
                            onClick={() => toggleJobExpansion(job.job_id)}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <i className={`fas fa-chevron-${expandedJobs.has(job.job_id) ? 'down' : 'right'}`} 
                                 style={{ fontSize: '10px', color: '#6c757d' }}></i>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  backgroundColor: '#007bff',
                                  color: 'white',
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  fontWeight: 'bold'
                                }}>
                                  JOB
                                </span>
                                
                                <span style={{
                                  backgroundColor: '#e9ecef',
                                  padding: '2px 6px',
                                  borderRadius: '10px',
                                  fontSize: '10px',
                                  fontWeight: 'bold'
                                }}>
                                  {job.action_type.replace('_', ' ').toUpperCase()}
                                </span>
                              </div>

                              <div style={{ fontSize: '12px', fontWeight: 'bold' }}>
                                {job.job_name || `${job.entity_type}:${job.entity_id}`}
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <span style={{
                                backgroundColor: getStatusBadgeColor(job.status),
                                color: 'white',
                                padding: '2px 6px',
                                borderRadius: '10px',
                                fontSize: '10px',
                                fontWeight: 'bold'
                              }}>
                                {job.status.toUpperCase()}
                              </span>
                              
                              <div style={{ fontSize: '11px', color: '#6c757d' }}>
                                {job.successful_items || 0}/{job.total_items || 0} items
                              </div>
                              
                              <div style={{ fontSize: '11px', color: '#6c757d' }}>
                                {formatDate(job.created_at)}
                              </div>
                            </div>
                          </div>

                          {/* Expanded Job Details - Show Tests */}
                          {expandedJobs.has(job.job_id) && (
                            <div style={{ borderTop: '1px solid #dee2e6', backgroundColor: 'white' }}>
                              {/* Job Summary */}
                              <div style={{ padding: '10px', backgroundColor: '#f8f9fa', fontSize: '11px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px' }}>
                                  <div><strong>Progress:</strong> {job.progress_percentage?.toFixed(1) || 0}%</div>
                                  <div><strong>Duration:</strong> {job.processing_time ? formatDuration(job.processing_time) : '-'}</div>
                                  <div><strong>Success:</strong> {job.successful_items || 0}</div>
                                  <div><strong>Failed:</strong> {job.failed_items || 0}</div>
                                  {job.top_confidence_score && (
                                    <div><strong>Top Confidence:</strong> {(job.top_confidence_score * 100).toFixed(1)}%</div>
                                  )}
                                </div>
                              </div>

                              {/* Tests List */}
                              {jobTests[job.job_id] ? (
                                <div style={{ padding: '10px' }}>
                                  <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#495057' }}>
                                    <i className="fas fa-vial" style={{ marginRight: '5px' }}></i>
                                    Test IDs ({jobTests[job.job_id].length})
                                  </div>
                                  
                                  {jobTests[job.job_id].map((test: any, testIndex: number) => (
                                    <div key={test.test_id || testIndex} style={{
                                      padding: '8px',
                                      marginBottom: '5px',
                                      backgroundColor: test.status === 'completed' ? '#f8fffe' : '#f8f9fa',
                                      borderRadius: '3px',
                                      border: `1px solid ${test.status === 'completed' ? '#28a745' : '#e9ecef'}`,
                                      fontSize: '11px',
                                      cursor: test.status === 'completed' ? 'pointer' : 'default',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onClick={() => {
                                      if (test.status === 'completed') {
                                        handleViewTestResults(test.test_id, test.entity_type);
                                      }
                                    }}
                                    onMouseEnter={(e: any) => {
                                      if (test.status === 'completed') {
                                        e.currentTarget.style.backgroundColor = '#e8f5e8';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                                      }
                                    }}
                                    onMouseLeave={(e: any) => {
                                      if (test.status === 'completed') {
                                        e.currentTarget.style.backgroundColor = '#f8fffe';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                        e.currentTarget.style.boxShadow = 'none';
                                      }
                                    }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{
                                            backgroundColor: '#6f42c1',
                                            color: 'white',
                                            padding: '1px 4px',
                                            borderRadius: '8px',
                                            fontSize: '9px',
                                            fontWeight: 'bold'
                                          }}>
                                            TEST
                                          </span>
                                          
                                          <span style={{ fontFamily: 'monospace', fontSize: '10px', color: '#6c757d' }}>
                                            {test.test_id.substring(0, 8)}...
                                          </span>
                                          
                                          <span>
                                            {test.test_name || `${test.entity_type}:${test.entity_id}`}
                                          </span>
                                          
                                          {test.status === 'completed' && (
                                            <span style={{ color: '#28a745', fontSize: '9px', fontWeight: 'bold' }}>
                                              👁️ Click to view results
                                            </span>
                                          )}
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                          <span style={{
                                            backgroundColor: getStatusBadgeColor(test.status),
                                            color: 'white',
                                            padding: '1px 4px',
                                            borderRadius: '8px',
                                            fontSize: '9px',
                                            fontWeight: 'bold'
                                          }}>
                                            {test.status.toUpperCase()}
                                          </span>
                                          
                                          {test.performers_found > 0 && (
                                            <span style={{ color: '#28a745', fontSize: '9px' }}>
                                              {test.performers_found} found
                                            </span>
                                          )}
                                          
                                          {test.max_confidence && (
                                            <span style={{ color: '#007bff', fontSize: '9px' }}>
                                              {(test.max_confidence * 100).toFixed(0)}%
                                            </span>
                                          )}
                                          
                                          <span style={{ color: '#6c757d', fontSize: '9px' }}>
                                            {test.processing_time ? formatDuration(test.processing_time) : '-'}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ padding: '10px', textAlign: 'center', color: '#6c757d', fontSize: '11px' }}>
                                  <i className="fas fa-spinner fa-spin" style={{ marginRight: '5px' }}></i>
                                  Loading tests...
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#6c757d' }}>
                      No AI jobs found. Start using facial recognition to see history here.
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status Summary */}
            <div style={{ marginTop: '15px', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
              <strong>Integration Status:</strong> {serverStatus?.success ? 
                `Connected to ${serverStatus.service_name} v${serverStatus.version}` : 
                'Not connected'
              }
            </div>
          </div>
        )}
        
        {/* Test Results Overlay */}
        {showTestResults && testResultsData && (
          <>
            {testResultsType === 'gallery' && (window as any).AIResultsOverlayGalleries && (
              React.createElement((window as any).AIResultsOverlayGalleries, {
                show: showTestResults,
                onHide: () => setShowTestResults(false),
                title: `Test Results - Gallery ${testResultsData.galleryId}`,
                galleryData: { id: testResultsData.galleryId },
                galleryResults: testResultsData,
                rawResponse: testResultsData
              })
            )}
            
            {testResultsType === 'scene' && (window as any).AIResultsOverlayScenes && (
              React.createElement((window as any).AIResultsOverlayScenes, {
                show: showTestResults,
                onHide: () => setShowTestResults(false),
                title: `Test Results - Scene ${testResultsData.sceneId}`,
                sceneData: { id: testResultsData.sceneId },
                sceneResults: testResultsData,
                rawResponse: testResultsData
              })
            )}
            
            {testResultsType === 'image' && (window as any).AIResultsOverlay && (
              React.createElement((window as any).AIResultsOverlay, {
                show: showTestResults,
                onHide: () => setShowTestResults(false),
                title: `Test Results - Image ${testResultsData.entity_id}`,
                imageData: { id: testResultsData.entity_id },
                aiResults: testResultsData,
                rawResponse: testResultsData
              })
            )}
            
            {/* Fallback for unsupported entity types or missing overlays */}
            {(!testResultsType || !['gallery', 'scene', 'image'].includes(testResultsType) || 
              (testResultsType === 'gallery' && !(window as any).AIResultsOverlayGalleries) ||
              (testResultsType === 'scene' && !(window as any).AIResultsOverlayScenes) ||
              (testResultsType === 'image' && !(window as any).AIResultsOverlay)) && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  backgroundColor: 'white',
                  padding: '20px',
                  borderRadius: '8px',
                  maxWidth: '600px',
                  maxHeight: '80vh',
                  overflow: 'auto'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '15px'
                  }}>
                    <h4>Test Results - {testResultsData.test_id}</h4>
                    <button 
                      onClick={() => setShowTestResults(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '20px',
                        cursor: 'pointer'
                      }}
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div style={{ marginBottom: '15px' }}>
                    <strong>Entity:</strong> {testResultsData.entity_type}:{testResultsData.entity_id}
                  </div>
                  
                  {testResultsData.performers && testResultsData.performers.length > 0 && (
                    <div style={{ marginBottom: '15px' }}>
                      <strong>Performers Found:</strong> {testResultsData.performers.length}
                      <ul>
                        {testResultsData.performers.slice(0, 5).map((performer: any, index: number) => (
                          <li key={index}>
                            {performer.name} ({((performer.confidence || 0) * 100).toFixed(1)}%)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div style={{ marginTop: '15px' }}>
                    <strong>Raw Response:</strong>
                    <pre style={{
                      backgroundColor: '#f8f9fa',
                      padding: '10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      maxHeight: '300px',
                      overflow: 'auto'
                    }}>
                      {JSON.stringify(testResultsData, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  PluginApi.patch.before("SettingsToolsSection", function (props: any) {
    const { Setting } = PluginApi.components;

    return [
      {
        children: (
          <>
            {props.children}
            <Setting heading="StashAI Integration">
              <AISettingsDropdown />
            </Setting>
          </>
        ),
      },
    ];
  });

})();