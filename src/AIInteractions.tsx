// =============================================================================
// AI Interactions Component - Enhanced tracking with StashAI Server integration
// =============================================================================

interface AIInteraction {
  id: string;
  timestamp: string;
  session_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  entity_title?: string;
  entity_filepath?: string;
  service: string;
  status: 'success' | 'error' | 'pending';
  response_time?: number;
  confidence_scores?: number[];
  max_confidence?: number;
  performers_found?: number;
  metadata?: Record<string, any>;
}

interface StashAIJob {
  job_id: string;
  status: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  action_type: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  processing_time_seconds?: number;
  tests_completed?: number;
  tests_passed?: number;
  tests_failed?: number;
  progress_percentage?: number;
  performers_found_total?: number;
  results_json?: any;
}

declare global {
  interface Window {
    trackAIInteraction: (data: Partial<AIInteraction>) => void;
    PluginApi: any;
  }
}

export const AIInteractionsComponent: React.FC = () => {
  const React = window.PluginApi.React;
  const [interactions, setInteractions] = React.useState<AIInteraction[]>([]);
  const [serverJobs, setServerJobs] = React.useState<StashAIJob[]>([]);
  const [isTracking, setIsTracking] = React.useState<boolean>(true);
  const [sessionId, setSessionId] = React.useState<string>('');
  const [serverConnected, setServerConnected] = React.useState<boolean>(false);
  const [activeView, setActiveView] = React.useState<'local' | 'server' | 'combined'>('combined');

  // StashAI Server configuration
  const STASH_AI_BASE_URL = 'http://localhost:8080';

  // Initialize session and load interactions
  React.useEffect(() => {
    initializeSession();
    loadInteractions();
    checkServerConnection();
    
    // Set up periodic refresh
    const interval = setInterval(() => {
      loadInteractions();
      if (serverConnected) {
        fetchServerJobs();
      }
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const initializeSession = () => {
    let session = sessionStorage.getItem('ai_overhaul_session_id');
    if (!session) {
      session = generateSessionId();
      sessionStorage.setItem('ai_overhaul_session_id', session);
    }
    setSessionId(session);
  };

  const generateSessionId = () => {
    return 'plugin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const loadInteractions = () => {
    try {
      const stored = localStorage.getItem('ai_overhaul_interactions');
      if (stored) {
        const allInteractions = JSON.parse(stored);
        // Keep only the latest 50 interactions, sorted by timestamp
        const latest = allInteractions
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 50);
        setInteractions(latest);
      }
    } catch (error) {
      console.warn('Failed to load AI interactions:', error);
    }
  };

  const checkServerConnection = async () => {
    try {
      const response = await fetch(`${STASH_AI_BASE_URL}/api/v1/health`);
      if (response.ok) {
        setServerConnected(true);
        fetchServerJobs();
      } else {
        setServerConnected(false);
      }
    } catch (error) {
      setServerConnected(false);
    }
  };

  const fetchServerJobs = async () => {
    if (!serverConnected) return;
    
    try {
      // Fetch recent jobs from StashAI Server for current session
      const response = await fetch(`${STASH_AI_BASE_URL}/api/v1/jobs/recent?limit=20`);
      if (response.ok) {
        const jobs = await response.json();
        setServerJobs(jobs);
      }
    } catch (error) {
      console.warn('Failed to fetch server jobs:', error);
    }
  };

  const trackInteraction = (data: Partial<AIInteraction>) => {
    if (!isTracking) return;

    const interaction: AIInteraction = {
      id: generateInteractionId(),
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      action_type: data.action_type || 'unknown',
      entity_type: data.entity_type || 'unknown',
      entity_id: data.entity_id || 'unknown',
      entity_title: data.entity_title,
      entity_filepath: data.entity_filepath,
      service: data.service || 'plugin',
      status: data.status || 'success',
      response_time: data.response_time,
      confidence_scores: data.confidence_scores,
      max_confidence: data.max_confidence,
      performers_found: data.performers_found,
      metadata: {
        ...data.metadata,
        user_agent: navigator.userAgent,
        page_url: window.location.href,
        viewport_width: window.innerWidth,
        session_id: sessionId
      }
    };

    try {
      // Store locally
      const stored = localStorage.getItem('ai_overhaul_interactions');
      const allInteractions = stored ? JSON.parse(stored) : [];
      
      allInteractions.push(interaction);
      
      // Keep only latest 200 interactions in storage
      const trimmed = allInteractions
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 200);
      
      localStorage.setItem('ai_overhaul_interactions', JSON.stringify(trimmed));
      loadInteractions();
      
      // Send to StashAI Server if connected
      if (serverConnected) {
        sendToStashAIServer(interaction);
      }
    } catch (error) {
      console.warn('Failed to track AI interaction:', error);
    }
  };

  const sendToStashAIServer = async (interaction: AIInteraction) => {
    try {
      await fetch(`${STASH_AI_BASE_URL}/api/v1/interactions/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_type: 'plugin_action',
          user_id: sessionId,
          entity_type: interaction.entity_type,
          entity_id: interaction.entity_id,
          action_type: interaction.action_type,
          service_name: interaction.service,
          metadata: {
            ...interaction.metadata,
            response_time: interaction.response_time,
            status: interaction.status,
            confidence_scores: interaction.confidence_scores,
            max_confidence: interaction.max_confidence,
            performers_found: interaction.performers_found
          }
        })
      });
    } catch (error) {
      // Silently fail - server tracking is optional
      console.warn('Failed to send interaction to StashAI Server:', error);
    }
  };

  const generateInteractionId = () => {
    return 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  };

  const clearInteractions = () => {
    if (confirm('Clear all tracked AI interactions?')) {
      localStorage.removeItem('ai_overhaul_interactions');
      setInteractions([]);
    }
  };

  const exportInteractions = () => {
    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        session_id: sessionId,
        plugin_version: '2.0.0',
        server_connected: serverConnected,
        total_interactions: interactions.length,
        total_server_jobs: serverJobs.length
      },
      local_interactions: interactions,
      server_jobs: serverJobs
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `ai_interactions_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);
  };

  const toggleTracking = () => {
    setIsTracking(!isTracking);
    localStorage.setItem('ai_overhaul_tracking_enabled', (!isTracking).toString());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed': return 'text-success';
      case 'error':
      case 'failed': return 'text-danger';
      case 'pending':
      case 'processing': return 'text-warning';
      case 'cancelled': return 'text-secondary';
      default: return 'text-secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed': return 'fa-check-circle';
      case 'error':
      case 'failed': return 'fa-times-circle';
      case 'pending':
      case 'processing': return 'fa-spinner fa-spin';
      case 'cancelled': return 'fa-ban';
      default: return 'fa-question-circle';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  const getServiceIcon = (service: string) => {
    switch (service.toLowerCase()) {
      case 'visage': return 'fa-user';
      case 'stash-ai-server': return 'fa-server';
      case 'plugin': return 'fa-puzzle-piece';
      case 'queue': return 'fa-tasks';
      default: return 'fa-cog';
    }
  };

  const getCombinedData = () => {
    const combined = [];
    
    // Add local interactions
    interactions.forEach(interaction => {
      combined.push({
        ...interaction,
        source: 'local',
        display_title: `${interaction.action_type} • ${interaction.entity_type}`,
        display_subtitle: interaction.entity_title || `ID: ${interaction.entity_id}`
      });
    });

    // Add server jobs
    serverJobs.forEach(job => {
      combined.push({
        id: job.job_id,
        timestamp: job.created_at,
        session_id: sessionId,
        action_type: job.action_type,
        entity_type: job.entity_type,
        entity_id: job.entity_id,
        entity_title: job.entity_name,
        service: 'stash-ai-server',
        status: job.status,
        response_time: job.processing_time_seconds ? job.processing_time_seconds * 1000 : undefined,
        performers_found: job.performers_found_total,
        metadata: {
          tests_completed: job.tests_completed,
          tests_passed: job.tests_passed,
          tests_failed: job.tests_failed,
          progress_percentage: job.progress_percentage,
          results: job.results_json
        },
        source: 'server',
        display_title: `${job.action_type} • ${job.entity_type}`,
        display_subtitle: job.entity_name || `ID: ${job.entity_id}`
      });
    });

    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  };

  const getDisplayData = () => {
    switch (activeView) {
      case 'local': return interactions.map(i => ({ ...i, source: 'local' }));
      case 'server': return serverJobs.map(j => ({ ...j, source: 'server' }));
      case 'combined': return getCombinedData();
      default: return getCombinedData();
    }
  };

  // Make tracking function globally available
  React.useEffect(() => {
    window.trackAIInteraction = trackInteraction;
    return () => {
      delete window.trackAIInteraction;
    };
  }, [trackInteraction]);

  const displayData = getDisplayData();

  return React.createElement('div', { className: 'ai-interactions-container' },
    // Header
    React.createElement('div', { className: 'ai-interactions-header mb-3' },
      React.createElement('div', { className: 'd-flex justify-content-between align-items-center mb-2' },
        React.createElement('h5', null,
          React.createElement('i', { className: 'fas fa-history me-2' }),
          'AI Interactions'
        ),
        React.createElement('div', { className: 'btn-group btn-group-sm' },
          React.createElement('button', {
            className: `btn btn-outline-${isTracking ? 'success' : 'secondary'}`,
            onClick: toggleTracking,
            title: isTracking ? 'Tracking Enabled' : 'Tracking Disabled'
          }, 
            React.createElement('i', { className: `fas ${isTracking ? 'fa-record-vinyl' : 'fa-pause'}` })
          ),
          React.createElement('button', {
            className: 'btn btn-outline-primary',
            onClick: exportInteractions,
            title: 'Export Interactions'
          }, 
            React.createElement('i', { className: 'fas fa-download' })
          ),
          React.createElement('button', {
            className: 'btn btn-outline-danger',
            onClick: clearInteractions,
            title: 'Clear Local Interactions'
          }, 
            React.createElement('i', { className: 'fas fa-trash' })
          )
        )
      ),
      
      // View Toggle Buttons
      React.createElement('div', { className: 'btn-group btn-group-sm mb-2' },
        React.createElement('button', {
          className: `btn ${activeView === 'combined' ? 'btn-primary' : 'btn-outline-primary'}`,
          onClick: () => setActiveView('combined')
        }, 'Combined'),
        React.createElement('button', {
          className: `btn ${activeView === 'local' ? 'btn-primary' : 'btn-outline-primary'}`,
          onClick: () => setActiveView('local')
        }, `Local (${interactions.length})`),
        React.createElement('button', {
          className: `btn ${activeView === 'server' ? 'btn-primary' : 'btn-outline-primary'}`,
          onClick: () => setActiveView('server'),
          disabled: !serverConnected
        }, `Server (${serverJobs.length})`)
      ),

      // Status Info
      React.createElement('div', { className: 'small text-muted d-flex justify-content-between' },
        React.createElement('span', null, `Session: ${sessionId.slice(-8)}`),
        React.createElement('span', null,
          React.createElement('i', { 
            className: `fas fa-circle me-1 ${serverConnected ? 'text-success' : 'text-danger'}` 
          }),
          `Server: ${serverConnected ? 'Connected' : 'Disconnected'}`
        )
      )
    ),

    // Interactions List
    displayData.length === 0 ? 
      React.createElement('div', { className: 'text-center text-muted py-4' },
        React.createElement('i', { className: 'fas fa-info-circle me-2' }),
        'No AI interactions tracked yet'
      ) :
      React.createElement('div', { className: 'ai-interactions-list' },
        displayData.slice(0, 30).map(item =>
          React.createElement('div', {
            key: item.id,
            className: `ai-interaction-item mb-2 p-3 border rounded ${item.source === 'server' ? 'border-primary' : ''}`
          },
            React.createElement('div', { className: 'd-flex justify-content-between align-items-start' },
              React.createElement('div', { className: 'd-flex align-items-center' },
                React.createElement('i', { 
                  className: `fas ${getServiceIcon(item.service)} me-2 text-primary` 
                }),
                React.createElement('div', null,
                  React.createElement('div', { className: 'fw-bold' },
                    item.display_title || `${item.action_type} • ${item.entity_type}`
                  ),
                  (item.display_subtitle || item.entity_title) && 
                    React.createElement('div', { className: 'small text-muted' },
                      item.display_subtitle || item.entity_title
                    )
                )
              ),
              React.createElement('div', { className: 'text-end' },
                React.createElement('div', { 
                  className: `d-flex align-items-center ${getStatusColor(item.status)}` 
                },
                  React.createElement('i', { 
                    className: `fas ${getStatusIcon(item.status)} me-1` 
                  }),
                  React.createElement('span', { className: 'small' }, item.status)
                ),
                React.createElement('div', { className: 'small text-muted' },
                  formatTimestamp(item.timestamp)
                )
              )
            ),
            React.createElement('div', { className: 'mt-2 small' },
              React.createElement('span', { 
                className: `badge ${item.source === 'server' ? 'bg-primary' : 'bg-secondary'} me-2` 
              }, item.service),
              item.response_time && 
                React.createElement('span', { className: 'text-muted me-2' },
                  `${Math.round(item.response_time)}ms`
                ),
              item.performers_found !== undefined &&
                React.createElement('span', { className: 'text-muted me-2' },
                  `${item.performers_found} performers`
                ),
              item.metadata && Object.keys(item.metadata).length > 0 &&
                React.createElement('span', { className: 'text-muted' },
                  `+${Object.keys(item.metadata).length} metadata`
                )
            )
          )
        )
      )
  );
};

export default AIInteractionsComponent;