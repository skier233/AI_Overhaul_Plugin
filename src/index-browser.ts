// =============================================================================
// AI Overhaul - Browser-Compatible Entry Point
// =============================================================================

(function() {
  // Get PluginApi from global scope
  const PluginApi = (window as any).PluginApi;
  
  if (!PluginApi) {
    console.error('AI Overhaul: PluginApi not available');
    return;
  }

  // =============================================================================
  // Inline Type Definitions (Browser Compatible)
  // =============================================================================
  
  interface PageContext {
    page: 'scenes' | 'galleries' | 'images' | 'groups' | 'performers' | 'home' | 'unknown';
    entityId: string | null;
    isDetailView: boolean;
  }

  interface AIAction {
    id: string;
    label: string;
    description: string;
    icon: string;
    category: string;
    endpoint?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    payload?: any;
  }

  interface InteractionData {
    type: string;
    timestamp: string;
    page: string;
    element?: string;
    data?: any;
    sessionId: string;
  }

  // =============================================================================
  // Global Endpoint Management
  // =============================================================================
  
  interface StashAISettings {
    serverUrl: string;
    useRelativeUrl: boolean;
    apiKey: string;
    autoRefresh: boolean;
    enableFacialRecognition: boolean;
    facialRecognitionThreshold: number;
    maxResults: number;
    enableSceneAnalysis: boolean;
    enableGalleryAnalysis: boolean;
    updatedAt?: string;
  }

  const getStashAIEndpoint = (): { url: string; headers: Record<string, string> } => {
    const settings: StashAISettings = JSON.parse(localStorage.getItem('stash_ai_settings') || '{}');
    const useRelativeUrl = settings.useRelativeUrl ?? true;
    const serverUrl = settings.serverUrl ?? '';
    const apiKey = settings.apiKey ?? '';
    
    // Determine base URL
    const baseUrl = useRelativeUrl ? '/stash-ai' : serverUrl;
    
    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }
    
    return {
      url: baseUrl,
      headers
    };
  };

  // Global variable for consistent endpoint access
  (window as any).stashAIEndpoint = getStashAIEndpoint;

  // Event system for settings changes
  const settingsChangeListeners: (() => void)[] = [];
  
  const notifySettingsChange = () => {
    settingsChangeListeners.forEach(listener => listener());
  };

  const addSettingsChangeListener = (listener: () => void) => {
    settingsChangeListeners.push(listener);
    return () => {
      const index = settingsChangeListeners.indexOf(listener);
      if (index > -1) {
        settingsChangeListeners.splice(index, 1);
      }
    };
  };

  // Make settings change notification available globally
  (window as any).notifyStashAISettingsChange = notifySettingsChange;

  // =============================================================================
  // Utility Functions
  // =============================================================================
  
  const detectPageContext = (): PageContext => {
    const path = window.location.pathname;
    
    let page: PageContext['page'] = 'unknown';
    let entityId: string | null = null;
    let isDetailView = false;

    if (path.includes('/scenes')) {
      page = 'scenes';
      const sceneMatch = path.match(/\/scenes\/(\d+)/);
      if (sceneMatch) {
        entityId = sceneMatch[1];
        isDetailView = true;
      }
    } else if (path.includes('/galleries')) {
      page = 'galleries';
      const galleryMatch = path.match(/\/galleries\/(\d+)/);
      if (galleryMatch) {
        entityId = galleryMatch[1];
        isDetailView = true;
      }
    } else if (path.includes('/images')) {
      page = 'images';
      const imageMatch = path.match(/\/images\/(\d+)/);
      if (imageMatch) {
        entityId = imageMatch[1];
        isDetailView = true;
      }
    } else if (path.includes('/groups')) {
      page = 'groups';
      const groupMatch = path.match(/\/groups\/(\d+)/);
      if (groupMatch) {
        entityId = groupMatch[1];
        isDetailView = true;
      }
    } else if (path.includes('/performers')) {
      page = 'performers';
      const performerMatch = path.match(/\/performers\/(\d+)/);
      if (performerMatch) {
        entityId = performerMatch[1];
        isDetailView = true;
      }
    } else if (path === '/' || path === '/home') {
      page = 'home';
    }

    return { page, entityId, isDetailView };
  };

  const getContextualActions = (context: PageContext): AIAction[] => {
    const actions: AIAction[] = [];

    switch (context.page) {
      case 'scenes':
        if (context.isDetailView) {
          actions.push({
            id: 'identify_performers_scene',
            label: 'Identify Performers in Scene',
            description: 'Analyze scene screenshots and video frames to identify performers',
            icon: '🎬',
            category: 'Facial Recognition',
            endpoint: '/api/v1/facial-recognition/identify-scene',
            method: 'POST'
          });
        } else {
          actions.push({
            id: 'batch_identify_scenes',
            label: 'Batch Identify Scenes',
            description: 'Identify performers across multiple selected scenes',
            icon: '🎭',
            category: 'Facial Recognition',
            endpoint: '/api/v1/facial-recognition/batch-identify',
            method: 'POST'
          });
        }
        break;

      case 'galleries':
        if (context.isDetailView) {
          actions.push({
            id: 'batch_analyze_gallery',
            label: 'Batch Analyze Gallery',
            description: 'Analyze all images in gallery to identify performers with frequency tracking',
            icon: '🖼️',
            category: 'Facial Recognition',
            endpoint: '/api/v1/facial-recognition/identify-gallery',
            method: 'POST'
          });
        }
        break;

      case 'images':
        if (context.isDetailView) {
          actions.push({
            id: 'identify_performers_image',
            label: 'Identify Performers in Image',
            description: 'Detect and identify faces in this image',
            icon: '👤',
            category: 'Facial Recognition',
            endpoint: '/api/v1/facial-recognition/identify-image',
            method: 'POST'
          });
        }
        break;

      case 'performers':
        actions.push({
          id: 'compare_performers',
          label: 'Compare Performer Faces',
          description: 'Compare facial similarity between performers',
          icon: '⚖️',
          category: 'Facial Recognition',
          endpoint: '/api/v1/facial-recognition/compare-faces',
          method: 'POST'
        });
        break;

      default:
        actions.push({
          id: 'facial_recognition_help',
          label: 'Facial Recognition Help',
          description: 'Learn how to use facial recognition features',
          icon: '❓',
          category: 'Help'
        });
        break;
    }

    return actions;
  };

  const getContextLabel = (context: PageContext): string => {
    const labels: Record<PageContext['page'], string> = {
      scenes: context.isDetailView ? 'Scene Detail' : 'Scenes',
      galleries: context.isDetailView ? 'Gallery Detail' : 'Galleries', 
      images: context.isDetailView ? 'Image Detail' : 'Images',
      groups: context.isDetailView ? 'Group Detail' : 'Groups',
      performers: context.isDetailView ? 'Performer Detail' : 'Performers',
      home: 'Home',
      unknown: 'General'
    };
    return labels[context.page] || 'General';
  };

  // =============================================================================
  // Tracking Service
  // =============================================================================
  
  class TrackingService {
    private sessionId: string;

    constructor() {
      this.sessionId = this.getOrCreateSessionId();
    }

    private getOrCreateSessionId(): string {
      let sessionId = localStorage.getItem('ai_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        localStorage.setItem('ai_session_id', sessionId);
      }
      return sessionId;
    }

    public getSessionId(): string {
      return this.sessionId;
    }

    track(type: string, element?: string, data?: any): void {
      const settings = JSON.parse(localStorage.getItem('ai_overhaul_settings') || '{}');
      
      if (!settings.trackingEnabled) {
        return;
      }

      const interaction: InteractionData = {
        type,
        timestamp: new Date().toISOString(),
        page: window.location.pathname,
        element,
        data,
        sessionId: this.sessionId
      };

      // Use the new sync service if available, otherwise fallback to local storage
      if ((window as any).trackStashAIInteraction) {
        (window as any).trackStashAIInteraction(interaction);
      } else {
        // Fallback to old local storage method
        const existingInteractions = JSON.parse(localStorage.getItem('ai_interactions') || '[]');
        existingInteractions.push(interaction);
        
        if (existingInteractions.length > 1000) {
          existingInteractions.splice(0, existingInteractions.length - 1000);
        }
        
        localStorage.setItem('ai_interactions', JSON.stringify(existingInteractions));
      }
    }

    getStats() {
      // Try to get stats from sync service first
      if ((window as any).stashAIInteractionSync) {
        const syncStatus = (window as any).stashAIInteractionSync.getSyncStatus();
        const localInteractions = JSON.parse(localStorage.getItem('stash_ai_interactions') || '[]');
        const oldInteractions = JSON.parse(localStorage.getItem('ai_interactions') || '[]');
        
        return {
          totalInteractions: localInteractions.length + oldInteractions.length,
          sessionInteractions: localInteractions.filter((i: InteractionData) => i.sessionId === this.sessionId).length +
                              oldInteractions.filter((i: InteractionData) => i.sessionId === this.sessionId).length,
          syncStatus: syncStatus
        };
      } else {
        // Fallback to old method
        const interactions = JSON.parse(localStorage.getItem('ai_interactions') || '[]');
        return {
          totalInteractions: interactions.length,
          sessionInteractions: interactions.filter((i: InteractionData) => i.sessionId === this.sessionId).length
        };
      }
    }

    exportInteractions(): Blob {
      // Export from sync service if available
      if ((window as any).stashAIInteractionSync) {
        return new Blob(['Use the "Export Data" button in StashAI Settings for comprehensive export'], { type: 'text/plain' });
      } else {
        // Fallback to old method
        const interactions = JSON.parse(localStorage.getItem('ai_interactions') || '[]');
        return new Blob([JSON.stringify(interactions, null, 2)], { type: 'application/json' });
      }
    }
  }

  // =============================================================================
  // Page Context Hook
  // =============================================================================
  
  const usePageContext = () => {
    const React = PluginApi.React;
    const [context, setContext] = React.useState(detectPageContext());

    React.useEffect(() => {
      const updateContext = () => {
        const newContext = detectPageContext();
        setContext((prevContext: PageContext) => {
          if (
            prevContext.page !== newContext.page ||
            prevContext.entityId !== newContext.entityId ||
            prevContext.isDetailView !== newContext.isDetailView
          ) {
            return newContext;
          }
          return prevContext;
        });
      };

      updateContext();

      const handleLocationChange = () => {
        setTimeout(updateContext, 100);
      };

      window.addEventListener('popstate', handleLocationChange);
      
      let lastUrl = location.href;
      const observer = new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          handleLocationChange();
        }
      });

      observer.observe(document, { subtree: true, childList: true });

      return () => {
        window.removeEventListener('popstate', handleLocationChange);
        observer.disconnect();
      };
    }, []);

    return context;
  };

  // =============================================================================
  // AI Button Styles
  // =============================================================================
  
  const aiButtonStyles = {
    button: {
      base: 'minimal d-flex align-items-center h-100',
      colors: {
        connected: '#6c5ce7',
        disconnected: '#dc3545',
        warning: '#ffc107'
      }
    },
    dropdown: {
      container: {
        position: 'absolute' as const,
        top: '100%',
        right: 0,
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '8px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
        minWidth: '280px',
        zIndex: 1000,
        color: '#333',
        marginTop: '4px'
      }
    },
    header: {
      container: {
        padding: '12px 16px',
        borderBottom: '1px solid #eee',
        marginBottom: '8px'
      },
      title: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontWeight: 'bold' as const,
        fontSize: '14px',
        marginBottom: '6px'
      },
      status: {
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px'
      }
    },
    services: {
      statusDot: {
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        flexShrink: 0
      }
    },
    actions: {
      item: {
        width: '100%',
        background: 'none',
        border: 'none',
        padding: '8px 16px',
        textAlign: 'left' as const,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '14px',
        color: '#333',
        transition: 'background-color 0.2s ease'
      },
      icon: {
        width: '16px',
        textAlign: 'center' as const
      }
    }
  };

  // =============================================================================
  // AI Dropdown Component
  // =============================================================================
  
  const AIDropdown = () => {
    const React = PluginApi.React;
    const { Button } = PluginApi.libraries.Bootstrap;
    
    const [showDropdown, setShowDropdown] = React.useState(false);
    const [healthStatus, setHealthStatus] = React.useState({
      status: 'unknown',
      serverHealthy: false,
      visageHealthy: false,
      lastChecked: null
    });
    const [showOverlay, setShowOverlay] = React.useState(false);
    const [overlayData, setOverlayData] = React.useState(null);
    
    // Unified Queue Management System - WebSocket-based real-time updates
    const [serverQueueInfo, setServerQueueInfo] = React.useState({});
    const [websocket, setWebsocket] = React.useState(null);
    const [connectionStatus, setConnectionStatus] = React.useState('disconnected'); // 'connecting', 'connected', 'disconnected', 'error'
    const [initialStatusReceived, setInitialStatusReceived] = React.useState(false);
    // Removed assumedActiveJobs - was causing performance issues and log spam
    const [showQueueDropdown, setShowQueueDropdown] = React.useState(false);
    const [showAISettings, setShowAISettings] = React.useState(false);
    const [showAIInteractions, setShowAIInteractions] = React.useState(false);
    const [aiSettingsData, setAISettingsData] = React.useState({
      jobs: [],
      evaluatorStats: null,
      trends: null,
      databaseStatus: null,
      loading: true
    });
    const [isHovering, setIsHovering] = React.useState(false);
    const [completedJobNotifications, setCompletedJobNotifications] = React.useState(new Set());
    const [recentCompletedJobs, setRecentCompletedJobs] = React.useState([]);
    // Initialize jobProgress from localStorage
    const [jobProgress, setJobProgress] = React.useState(() => {
      try {
        const stored = localStorage.getItem('ai_job_progress');
        if (stored) {
          const parsed = JSON.parse(stored);
          const progressMap = new Map(Object.entries(parsed));
          
          // Clean up completed jobs from localStorage on startup
          const activeProgress = new Map();
          for (const [jobId, progress] of progressMap.entries()) {
            // Only keep jobs that don't have completion markers
            if (progress && !(progress as any).message?.includes('✅') && !(progress as any).message?.includes('❌') && !(progress as any).message?.includes('🚫')) {
              activeProgress.set(jobId, progress);
            }
          }
          
          // Update localStorage with cleaned data
          if (activeProgress.size !== progressMap.size) {
            try {
              const cleanedObj = Object.fromEntries(activeProgress);
              localStorage.setItem('ai_job_progress', JSON.stringify(cleanedObj));
              console.log(`Cleaned up ${progressMap.size - activeProgress.size} completed jobs from localStorage`);
            } catch (error) {
              console.warn('Failed to update localStorage after cleanup:', error);
            }
          }
          
          // Debug: Log any suspicious progress data
          for (const [jobId, progress] of activeProgress.entries()) {
            if (progress && ((progress as any).current === 21 || (progress as any).total === 40)) {
              console.warn(`Found suspicious progress data for job ${jobId}:`, progress);
              console.warn('Removing hardcoded 21/40 progress data');
              activeProgress.delete(jobId);
            }
          }
          
          return activeProgress;
        }
      } catch (error) {
        console.warn('Failed to load job progress from localStorage:', error);
      }
      return new Map();
    });
    
    // Local queue for immediate UI feedback before server processing
    const [localQueue, setLocalQueue] = React.useState(new Map());
    const [processingQueue, setProcessingQueue] = React.useState([]);
    const [processingProgress, setProcessingProgress] = React.useState({ current: 0, total: 0 });

    // Server queue is the source of truth for active jobs
    const serverJobs = Array.isArray(serverQueueInfo.active_jobs) ? serverQueueInfo.active_jobs : [];
    // Include local queue for immediate UI feedback
    const isProcessing = serverJobs.length > 0 || localQueue.size > 0;
    const hasNotifications = completedJobNotifications.size > 0;
    
    // Debug logging for processing state
    if (serverJobs.length > 0) {
      console.log('🔄 Processing active - server jobs:', serverJobs.length, serverJobs);
    }
    
    // Removed assumedActiveJobs debug logging - was causing log spam
    
    // Calculate progress from server queue info (tests, not jobs)
    const serverProcessingProgress = {
      current: serverQueueInfo.completed_tests || 0,
      total: serverQueueInfo.total_active_tests || 0
    };
    
    // For immediate feedback, show local job counts if no server data yet
    const displayProgress = serverProcessingProgress.total > 0 ? serverProcessingProgress : 
      (localQueue.size > 0 ? { current: 0, total: localQueue.size } : { current: 0, total: 0 });
    
    // Server-side queue management - queue information is updated via health check endpoint every 30 seconds
    // No client-side polling needed since queue state comes from server
    const context = usePageContext();
    const trackingService = new TrackingService();

    // Queue management functions for local UI feedback
    const addToQueue = (task: any) => {
      const taskId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newTask = {
        id: taskId,
        status: 'pending',
        startTime: Date.now(),
        ...task
      };
      
      setLocalQueue((prev: any) => new Map(prev.set(taskId, newTask)));
      setProcessingQueue((prev: any) => [...prev, newTask]);
      return taskId;
    };

    const updateQueueTask = (taskId: string, updates: any) => {
      if (typeof updates === 'function') {
        setLocalQueue((prev: any) => {
          const task = prev.get(taskId);
          if (task) {
            const updatedTask = { ...task, ...updates(task) };
            return new Map(prev.set(taskId, updatedTask));
          }
          return prev;
        });
        
        setProcessingQueue((prev: any) => prev.map((task: any) => 
          task.id === taskId ? { ...task, ...updates(task) } : task
        ));
      } else {
        setLocalQueue((prev: any) => {
          const task = prev.get(taskId);
          if (task) {
            const updatedTask = { ...task, ...updates };
            return new Map(prev.set(taskId, updatedTask));
          }
          return prev;
        });
        
        setProcessingQueue((prev: any) => prev.map((task: any) => 
          task.id === taskId ? { ...task, ...updates } : task
        ));
      }
      
      // Update processing progress
      const queue = Array.from(localQueue.values());
      const total = queue.length;
      const completed = queue.filter((t: any) => t.status === 'completed' || t.status === 'failed').length;
      setProcessingProgress({ current: completed, total });
    };

    const removeLocalTask = (taskId: string) => {
      setLocalQueue((prev: any) => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });
      
      setProcessingQueue((prev: any) => prev.filter((task: any) => task.id !== taskId));
      
      // Update processing progress
      const queue = Array.from(localQueue.values()).filter((t: any) => t.id !== taskId);
      const total = queue.length;
      const completed = queue.filter((t: any) => t.status === 'completed' || t.status === 'failed').length;
      setProcessingProgress({ current: completed, total });
    };

    const toggleDropdown = () => {
      setShowQueueDropdown(!showQueueDropdown);
    };

    // Clear notification for a specific job
    const clearNotification = (jobId: string) => {
      setCompletedJobNotifications((prev: any) => {
        const newSet = new Set(prev);
        newSet.delete(jobId);
        return newSet;
      });
    };

    // Cancel job function
    const cancelJob = async (jobId: string) => {
      try {
        console.log(`Cancelling job ${jobId}...`);
        const endpoint = getStashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/ai-jobs/${jobId}/cancel`, {
          method: 'POST',
          headers: endpoint.headers
        });
        
        if (!response.ok) {
          throw new Error(`Failed to cancel job: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Job cancelled successfully:', result);
        
        // Trigger immediate health check to update queue status
        setTimeout(checkHealth, 100);
        
        return result;
      } catch (error) {
        console.error('Failed to cancel job:', error);
        throw error;
      }
    };

    // Cancel test function
    const cancelTest = async (testId: string) => {
      try {
        console.log(`Cancelling test ${testId}...`);
        const endpoint = getStashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/ai-tests/${testId}/cancel`, {
          method: 'POST',
          headers: endpoint.headers
        });
        
        if (!response.ok) {
          throw new Error(`Failed to cancel test: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('Test cancelled successfully:', result);
        
        // Force refresh health status to update server queue
        setHealthStatus({ status: 'checking', services: {} });
        
        return result;
      } catch (error) {
        console.error('Failed to cancel test:', error);
        throw error;
      }
    };

    // Helper function to create AI Job on server and track in queue
    const createAIJob = async (entityType: string, entityId: string, entityName: string, actionType: string, totalItems: number = 1) => {
      try {
        const endpoint = getStashAIEndpoint();
        const apiUrl = `${endpoint.url}/api/v1/ai-jobs`;
        
        const jobPayload = {
          entity_type: entityType,
          entity_id: entityId,
          entity_name: entityName,
          action_type: actionType,
          total_items: totalItems
        };
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: endpoint.headers,
          body: JSON.stringify(jobPayload)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create AI Job: ${response.status}`);
        }
        
        const jobResult = await response.json();
        console.log('Created AI Job:', jobResult.job_id);
        return jobResult;
      } catch (error) {
        console.error('Failed to create AI Job:', error);
        throw error;
      }
    };

    // Helper function to create AI Test on server
    const createAITest = async (jobId: string, entityType: string, entityId: string, entityName: string, actionType: string) => {
      try {
        const endpoint = getStashAIEndpoint();
        const apiUrl = `${endpoint.url}/api/v1/ai-jobs/${jobId}/tests`;
        
        const testPayload = {
          entity_type: entityType,
          entity_id: entityId,
          entity_name: entityName,
          action_type: actionType
        };
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: endpoint.headers,
          body: JSON.stringify(testPayload)
        });
        
        if (!response.ok) {
          throw new Error(`Failed to create AI Test: ${response.status}`);
        }
        
        const testResult = await response.json();
        console.log('Created AI Test:', testResult.test_id);
        return testResult;
      } catch (error) {
        console.error('Failed to create AI Test:', error);
        throw error;
      }
    };

    // Queue management functions removed - handled server-side via health check updates

    const getQueueSummary = () => {
      // Use server queue information with safety checks
      const activeJobs = Array.isArray(serverQueueInfo.active_jobs) ? serverQueueInfo.active_jobs : [];
      return {
        active: activeJobs,
        queued: [],
        completed: [],
        failed: [], 
        total: activeJobs.length,
        totalTests: serverQueueInfo.total_active_tests || 0,
        completedTests: serverQueueInfo.completed_tests || 0,
        failedTests: serverQueueInfo.failed_tests || 0
      };
    };

    const checkHealth = async () => {
      try {
        // Use global endpoint configuration
        const endpoint = getStashAIEndpoint();
        const healthUrl = `${endpoint.url}/api/v1/health`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(healthUrl, {
          method: 'GET',
          headers: endpoint.headers,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          // console.log('🔍 Health endpoint response:', data);
          
          // Determine overall health status
          const serverHealthy = data.success === true;
          const visageHealthy = data.dependencies?.visage === 'healthy';
          
          let status: 'healthy' | 'degraded' | 'unhealthy';
          if (serverHealthy && visageHealthy) {
            status = 'healthy';
          } else if (serverHealthy && !visageHealthy) {
            status = 'degraded';
          } else {
            status = 'unhealthy';
          }
          
          setHealthStatus({
            status,
            serverHealthy,
            visageHealthy,
            lastChecked: new Date()
          });
          
          // Update server queue information from health check
          if (data.metrics && data.metrics.queue_status) {
            console.log('🔍 Health check received queue status:', data.metrics.queue_status);
            
            // Update recent completed jobs for result viewing
            if (data.metrics.queue_status.recent_completed_jobs) {
              setRecentCompletedJobs(data.metrics.queue_status.recent_completed_jobs);
            }
            setServerQueueInfo(data.metrics.queue_status);
            
            // WebSocket handles real-time updates, no need for adaptive polling intervals
            
            // Check for newly completed jobs to add as notifications
            const previousActiveJobIds = Array.isArray(serverQueueInfo.active_jobs) ? 
              serverQueueInfo.active_jobs.map((job: any) => job.job_id) : [];
            const currentActiveJobIds = Array.isArray(data.metrics.queue_status.active_jobs) ? 
              data.metrics.queue_status.active_jobs.map((job: any) => job.job_id) : [];
            
            // Find jobs that were active but are no longer active (completed)
            const completedJobIds = previousActiveJobIds.filter((jobId: string) => 
              !currentActiveJobIds.includes(jobId)
            );
            
            // console.log('🔍 Previous active jobs:', previousActiveJobIds);
            // console.log('🔍 Current active jobs:', currentActiveJobIds);
            if (completedJobIds.length > 0) {
              console.log('🔍 Detected completed jobs:', completedJobIds);
            }
            
            // Removed assumedActiveJobs logic - was causing performance issues
            
            // Add completed jobs to notifications
            if (completedJobIds.length > 0) {
              setCompletedJobNotifications((prev: any) => {
                const newSet = new Set(prev);
                completedJobIds.forEach((jobId: string) => newSet.add(jobId));
                return newSet;
              });
              console.log('Jobs completed:', completedJobIds);
            }
          }
        } else {
          setHealthStatus({
            status: 'unhealthy',
            serverHealthy: false,
            visageHealthy: false,
            lastChecked: new Date()
          });
          setServerQueueInfo({}); // Clear queue info on server error
        }
      } catch (error) {
        setHealthStatus({
          status: 'unhealthy',
          serverHealthy: false,
          visageHealthy: false,
          lastChecked: new Date()
        });
        setServerQueueInfo({}); // Clear queue info on error
      }
    };

    // Clean up old localStorage keys from assumedActiveJobs on mount
    React.useEffect(() => {
      try {
        localStorage.removeItem('ai_assumed_active_jobs');
        localStorage.removeItem('ai_assumed_active_jobs_timestamp');
        
        // Clean up any suspicious progress data with 21/40 values
        const progressData = localStorage.getItem('ai_job_progress');
        if (progressData) {
          const parsed = JSON.parse(progressData);
          let cleaned = false;
          for (const [jobId, progress] of Object.entries(parsed)) {
            if (progress && ((progress as any).current === 21 || (progress as any).total === 40)) {
              console.warn(`Found and removing suspicious hardcoded progress data for job ${jobId}:`, progress);
              delete parsed[jobId];
              cleaned = true;
            }
          }
          if (cleaned) {
            localStorage.setItem('ai_job_progress', JSON.stringify(parsed));
            console.log('Cleaned up hardcoded 21/40 progress data from localStorage');
          }
        }
      } catch (error) {
        console.error('Failed to clean up old localStorage keys:', error);
      }
    }, []);

    // WebSocket connection management
    const connectWebSocket = React.useCallback(() => {
      const { url } = getStashAIEndpoint();
      const wsUrl = url.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws/queue';
      
      console.log('🔌 Connecting to WebSocket:', wsUrl);
      setConnectionStatus('connecting');
      
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnectionStatus('connected');
        setWebsocket(ws);
        
        // Send initial request for status
        ws.send('get_status');
      };
      
      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket message:', message);
          
          if (message.type === 'queue_status' || message.type === 'queue_update') {
            const queueData = message.queue_status || message.data;
            console.log('📊 Setting server queue info:', queueData);
            setServerQueueInfo(queueData);
            
            // Mark that we've received initial status
            if (!initialStatusReceived && message.type === 'queue_status') {
              setInitialStatusReceived(true);
            }
            
            if (message.type === 'queue_update') {
              // Handle specific queue events
              switch (message.event) {
                case 'job_submitted':
                  console.log('🚀 Job submitted:', message.job_id);
                  break;
                case 'job_started':
                  console.log('⚡ Job started:', message.job_id);
                  break;
                case 'job_completed':
                  console.log('✅ Job completed:', message.job_id, message.data);
                  
                  // Log evaluation results if available
                  if (message.data?.evaluation_results?.evaluation_available) {
                    const eval_data = message.data.evaluation_results;
                    console.log(`📊 Evaluation Results for ${message.job_id}:`, {
                      overall_result: eval_data.overall_result,
                      tests_passed: eval_data.tests_passed,
                      tests_failed: eval_data.tests_failed,
                      performers_found: eval_data.performers_found_total,
                      confidence_summary: eval_data.confidence_scores_summary
                    });
                  }
                  
                  // Add to completed notifications
                  setCompletedJobNotifications((prev: any) => {
                    const newSet = new Set(prev);
                    newSet.add(message.job_id);
                    return newSet;
                  });
                  
                  // Track interaction when job completes successfully
                  const trackJobCompletion = async () => {
                    try {
                      // Get job details from server to get entity information
                      const endpoint = getStashAIEndpoint();
                      const jobResponse = await fetch(`${endpoint.url}/api/v1/ai-jobs/${message.job_id}`, {
                        headers: endpoint.headers
                      });
                      
                      if (jobResponse.ok) {
                        const jobData = await jobResponse.json();
                        
                        // Create interaction data for this completed job (will be wrapped by trackingService)
                        const interactionData = {
                          entityType: jobData.entity_type,
                          entityId: jobData.entity_id,
                          entityName: jobData.entity_name || `${jobData.entity_type} ${jobData.entity_id}`,
                          actionType: jobData.action_type || 'facial_recognition',
                          success: true,
                          jobId: message.job_id,
                          processingTime: message.data?.processing_time || 0,
                          evaluationResults: message.data?.evaluation_results || null,
                          requestId: message.job_id
                        };
                        
                        // Track the interaction (trackingService will wrap this in proper format)
                        trackingService.track('ai_processing', 'job_completion', interactionData);
                        console.log('📝 Tracked interaction for completed job:', interactionData);
                      }
                    } catch (error) {
                      console.warn('Failed to track job completion interaction:', error);
                    }
                  };
                  
                  trackJobCompletion();
                  
                  // Keep progress for a few seconds to show completion with evaluation results, then clean up
                  setJobProgress((prev: any) => {
                    const newMap = new Map(prev);
                    if (newMap.has(message.job_id)) {
                      const progress = newMap.get(message.job_id) as any;
                      const eval_data = message.data?.evaluation_results;
                      let completionMessage = '✅ Completed!';
                      
                      // Enhanced completion message with evaluation results
                      if (eval_data?.evaluation_available) {
                        const result = eval_data.overall_result;
                        const tests_passed = eval_data.tests_passed || 0;
                        const tests_total = (eval_data.tests_passed || 0) + (eval_data.tests_failed || 0) + (eval_data.tests_error || 0);
                        const performers = eval_data.performers_found_total || 0;
                        
                        if (result === 'pass') {
                          completionMessage = `✅ Passed! ${tests_passed}/${tests_total} tests, ${performers} performers`;
                        } else if (result === 'fail') {
                          completionMessage = `❌ Failed! ${tests_passed}/${tests_total} tests, ${performers} performers`;
                        } else {
                          completionMessage = `✅ Completed! ${tests_passed}/${tests_total} tests, ${performers} performers`;
                        }
                      }
                      
                      newMap.set(message.job_id, {
                        current: progress.current,
                        total: progress.total,
                        percentage: 100,
                        message: completionMessage,
                        evaluation_results: eval_data || null
                      });
                    }
                    return newMap;
                  });
                  // Clean up after 3 seconds
                  setTimeout(() => {
                    setJobProgress((prev: any) => {
                      const newMap = new Map(prev);
                      newMap.delete(message.job_id);
                      // Update localStorage
                      try {
                        const progressObj = Object.fromEntries(newMap);
                        localStorage.setItem('ai_job_progress', JSON.stringify(progressObj));
                      } catch (error) {
                        console.warn('Failed to update localStorage after cleanup:', error);
                      }
                      return newMap;
                    });
                  }, 3000);
                  break;
                case 'job_failed':
                  console.log('❌ Job failed:', message.job_id);
                  // Show failure status briefly, then clean up
                  setJobProgress((prev: any) => {
                    const newMap = new Map(prev);
                    if (newMap.has(message.job_id)) {
                      const progress = newMap.get(message.job_id) as any;
                      newMap.set(message.job_id, {
                        current: progress.current,
                        total: progress.total,
                        percentage: progress.percentage,
                        message: '❌ Failed!'
                      });
                    }
                    return newMap;
                  });
                  // Clean up after 3 seconds
                  setTimeout(() => {
                    setJobProgress((prev: any) => {
                      const newMap = new Map(prev);
                      newMap.delete(message.job_id);
                      // Update localStorage
                      try {
                        const progressObj = Object.fromEntries(newMap);
                        localStorage.setItem('ai_job_progress', JSON.stringify(progressObj));
                      } catch (error) {
                        console.warn('Failed to update localStorage after cleanup:', error);
                      }
                      return newMap;
                    });
                  }, 3000);
                  break;
                case 'job_progress':
                  console.log('📊 Job progress:', message.job_id, message.data);
                  // Update job progress
                  setJobProgress((prev: any) => {
                    const newMap = new Map(prev);
                    newMap.set(message.job_id, {
                      current: message.data.current,
                      total: message.data.total,
                      percentage: message.data.progress_percentage,
                      message: message.data.message
                    });
                    // Persist to localStorage
                    try {
                      const progressObj = Object.fromEntries(newMap);
                      localStorage.setItem('ai_job_progress', JSON.stringify(progressObj));
                    } catch (error) {
                      console.warn('Failed to save job progress to localStorage:', error);
                    }
                    return newMap;
                  });
                  break;
                case 'job_cancelled':
                  console.log('🚫 Job cancelled:', message.job_id);
                  // Show cancelled status briefly, then clean up
                  setJobProgress((prev: any) => {
                    const newMap = new Map(prev);
                    if (newMap.has(message.job_id)) {
                      const progress = newMap.get(message.job_id) as any;
                      newMap.set(message.job_id, {
                        current: progress.current,
                        total: progress.total,
                        percentage: progress.percentage,
                        message: '🚫 Cancelled!'
                      });
                    }
                    return newMap;
                  });
                  // Clean up after 3 seconds
                  setTimeout(() => {
                    setJobProgress((prev: any) => {
                      const newMap = new Map(prev);
                      newMap.delete(message.job_id);
                      // Update localStorage
                      try {
                        const progressObj = Object.fromEntries(newMap);
                        localStorage.setItem('ai_job_progress', JSON.stringify(progressObj));
                      } catch (error) {
                        console.warn('Failed to update localStorage after cleanup:', error);
                      }
                      return newMap;
                    });
                  }, 3000);
                  break;
              }
            }
          } else if (message.type === 'cancel_response') {
            // Handle cancellation response
            console.log('🚫 Cancel response:', message);
            if (message.success) {
              console.log(`✅ Job ${message.job_id} cancelled successfully`);
            } else {
              console.error(`❌ Failed to cancel job ${message.job_id}: ${message.message}`);
            }
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        setConnectionStatus('disconnected');
        setWebsocket(null);
        
        // Attempt to reconnect after 5 seconds if not intentionally closed
        if (event.code !== 1000) {
          setTimeout(connectWebSocket, 5000);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');
      };
      
      return ws;
    }, []);

    // Function to cancel a job via WebSocket
    const cancelJobViaWebSocket = React.useCallback((jobId: string) => {
      if (websocket && websocket.readyState === WebSocket.OPEN) {
        console.log(`🚫 Sending cancel request for job: ${jobId}`);
        const cancelMessage = {
          type: 'cancel_job',
          job_id: jobId
        };
        websocket.send(JSON.stringify(cancelMessage));
      } else {
        console.error('❌ WebSocket not connected, cannot cancel job');
      }
    }, [websocket]);

    // Initialize WebSocket connection on mount
    React.useEffect(() => {
      const ws = connectWebSocket();
      
      // Listen for settings changes and reconnect
      const removeListener = addSettingsChangeListener(() => {
        console.log('AI Overhaul: Settings changed, reconnecting WebSocket...');
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Settings changed');
        }
        setTimeout(connectWebSocket, 1000);
      });

      // Cleanup on unmount
      return () => {
        removeListener();
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Component unmount');
        }
      };
    }, [connectWebSocket]);

    // Keep WebSocket connection alive with periodic pings
    React.useEffect(() => {
      if (websocket && connectionStatus === 'connected') {
        const pingInterval = setInterval(() => {
          if (websocket.readyState === WebSocket.OPEN) {
            websocket.send('ping');
          }
        }, 30000); // Ping every 30 seconds
        
        return () => clearInterval(pingInterval);
      }
    }, [websocket, connectionStatus]);

    // Fallback health check for server status (WebSocket handles queue updates)
    React.useEffect(() => {
      // Initial health check
      checkHealth();
      
      // Periodic health check for server status only (not queue info) - less frequent since WebSocket handles real-time updates
      const healthInterval = setInterval(checkHealth, 60000); // Every minute
      
      return () => clearInterval(healthInterval);
    }, []);

    // Get status color based on health
    const getStatusColor = () => {
      switch (healthStatus.status) {
        case 'healthy': return '#28a745';   // Green
        case 'degraded': return '#ffc107';  // Yellow/Amber
        case 'unhealthy': return '#dc3545'; // Red
        default: return '#6c757d';          // Gray
      }
    };

    // Get status tooltip
    const getStatusTooltip = () => {
      switch (healthStatus.status) {
        case 'healthy': return 'All AI services are healthy';
        case 'degraded': return 'StashAI Server is healthy, but Visage service is down';
        case 'unhealthy': return 'StashAI Server is not responding';
        default: return 'Checking AI service status...';
      }
    };

    const performFacialRecognition = async (imageId: string) => {
      const taskId = addToQueue({
        type: 'image',
        entityId: imageId,
        title: 'Image Analysis',
        total: 1
      });
      
      try {
        const endpoint = getStashAIEndpoint();
        const apiUrl = `${endpoint.url}/api/v1/queue/submit/image`;
        
        // Get image data from Stash
        const imageData = await getImageData(imageId);
        if (!imageData) {
          throw new Error('Could not retrieve image data from Stash');
        }
        
        updateQueueTask(taskId, { 
          title: `Image: ${imageData.title}`,
          status: 'processing'
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: endpoint.headers,
          body: JSON.stringify({
            entity: {
              id: imageId,
              type: "image",
              url: imageData.url,
              title: imageData.title
            },
            image_data: {
              data: imageData.base64,
              format: "jpeg"
            },
            threshold: 0.5,
            max_results: 5
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success && result.job_id) {
          // Update local task with server job ID
          updateQueueTask(taskId, { 
            job_id: result.job_id,
            status: 'queued_on_server',
            server_message: result.message
          });
          
          // Removed assumedActiveJobs tracking - was causing performance issues
          
          // Start polling for job status
          pollJobStatus(result.job_id, taskId, imageData);
        } else {
          throw new Error(result.error || 'Failed to submit job to queue');
        }
        
        trackingService.track('facial_recognition_submitted', 'queue_api', {
          imageId,
          job_id: result.job_id,
          success: true
        });

      } catch (error: any) {
        console.error('Facial recognition submission failed:', error);
        alert(`Facial recognition failed: ${error.message}`);
        
        // Mark task as failed and remove after delay
        updateQueueTask(taskId, { 
          status: 'failed',
          error: error.message
        });
        
        // Remove from local queue after 5 seconds
        setTimeout(() => removeLocalTask(taskId), 5000);
        
        trackingService.track('facial_recognition_failed', 'queue_api', {
          imageId,
          error: error.message
        });
      }
    };

    // Function to poll job status from the simple queue
    const pollJobStatus = async (jobId: string, taskId: string, imageData: any) => {
      const endpoint = getStashAIEndpoint();
      const statusUrl = `${endpoint.url}/api/v1/queue/status/${jobId}`;
      
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch(statusUrl, {
            method: 'GET',
            headers: endpoint.headers
          });
          
          if (!response.ok) {
            throw new Error(`Status check failed: ${response.status}`);
          }
          
          const statusResult = await response.json();
          
          if (statusResult.status === 'completed') {
            clearInterval(pollInterval);
            
            // Update task as completed
            updateQueueTask(taskId, { 
              status: 'completed',
              result: statusResult.result
            });
            
            // Show results in overlay if available
            if (statusResult.result) {
              // Check if this is a gallery result
              if (statusResult.result.ai_model_info?.gallery_results) {
                const galleryResults = statusResult.result.ai_model_info.gallery_results;
                setOverlayData({
                  title: `Gallery Analysis: ${imageData.title || 'Untitled Gallery'}`,
                  galleryData: imageData,
                  galleryResults: galleryResults,
                  rawResponse: statusResult.result,
                  actionType: 'gallery'
                });
              } else {
                // Regular image results
                setOverlayData({
                  title: 'Facial Recognition Results',
                  sourceImage: imageData.url,
                  results: statusResult.result,
                  rawResponse: statusResult.result,
                  actionType: statusResult.result.isMultiDetection ? 'multi' : 'single',
                  imageData: imageData
                });
              }
              setShowOverlay(true);
            }
            
            // Remove from local queue after 3 seconds and trigger health check
            setTimeout(() => {
              removeLocalTask(taskId);
              // Trigger immediate health check to update server queue status
              checkHealth();
            }, 3000);
            
            trackingService.track('facial_recognition_completed', 'queue_poll', {
              job_id: jobId,
              task_id: taskId,
              success: true,
              performersFound: statusResult.result?.performers?.length || 0
            });
            
          } else if (statusResult.status === 'failed') {
            clearInterval(pollInterval);
            
            // Update task as failed
            updateQueueTask(taskId, { 
              status: 'failed',
              error: statusResult.error || 'Job failed on server'
            });
            
            // Remove from local queue after 5 seconds and trigger health check
            setTimeout(() => {
              removeLocalTask(taskId);
              // Trigger immediate health check to update server queue status
              checkHealth();
            }, 5000);
            
            trackingService.track('facial_recognition_failed', 'queue_poll', {
              job_id: jobId,
              task_id: taskId,
              error: statusResult.error
            });
            
          } else if (statusResult.status === 'processing') {
            // Update task status
            updateQueueTask(taskId, { 
              status: 'processing_on_server'
            });
          }
          
        } catch (error: any) {
          console.error('Job status polling error:', error);
          // Continue polling, don't clear interval for temporary errors
        }
      }, 2000); // Poll every 2 seconds
      
      // Clear polling after 5 minutes to avoid infinite polling
      setTimeout(() => {
        clearInterval(pollInterval);
        updateQueueTask(taskId, { 
          status: 'timeout',
          error: 'Job status polling timed out'
        });
        setTimeout(() => removeLocalTask(taskId), 3000);
      }, 300000); // 5 minutes
    };

    // Gallery batch processing functionality with simple queue
    const performGalleryBatchProcessing = async (galleryId: string) => {
      const taskId = addToQueue({
        type: 'gallery',
        entityId: galleryId,
        title: 'Gallery Analysis',
        total: 1
      });
      
      try {
        const endpoint = getStashAIEndpoint();
        const apiUrl = `${endpoint.url}/api/v1/queue/submit/gallery`;
        
        // Get gallery data from Stash
        const galleryData = await getGalleryData(galleryId);
        if (!galleryData) {
          throw new Error('Could not retrieve gallery data from Stash');
        }

        // Get gallery images
        const galleryImages = await getGalleryImages(galleryId);
        if (!galleryImages || galleryImages.length === 0) {
          throw new Error('No images found in gallery');
        }
        
        updateQueueTask(taskId, { 
          title: `Gallery: ${galleryData.title} (${galleryImages.length} images)`,
          status: 'converting_images'
        });

        // Convert ALL gallery images to base64 (not limited!)
        const imagesToProcess = galleryImages; // Process ALL images
        const processedImages = [];
        
        for (let i = 0; i < imagesToProcess.length; i++) {
          try {
            const base64Data = await imageToBase64(imagesToProcess[i].url);
            processedImages.push({
              id: imagesToProcess[i].id,
              url: imagesToProcess[i].url,
              title: imagesToProcess[i].title,
              base64: base64Data
            });
            
            updateQueueTask(taskId, { 
              title: `Gallery: ${galleryData.title} (converting ${i + 1}/${imagesToProcess.length})`,
              status: 'converting_images'
            });
          } catch (error) {
            console.error(`Failed to convert image ${imagesToProcess[i].id} to base64:`, error);
            // Skip this image and continue
          }
        }
        
        if (processedImages.length === 0) {
          throw new Error('No images could be converted for processing');
        }

        updateQueueTask(taskId, { 
          title: `Gallery: ${galleryData.title} (${processedImages.length} images ready)`,
          status: 'submitting'
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout for galleries
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: endpoint.headers,
          body: JSON.stringify({
            entity: {
              id: galleryId,
              type: "gallery",
              title: galleryData.title
            },
            images: processedImages.map(img => ({
              id: img.id,
              url: img.url,
              title: img.title,
              base64: img.base64
            })),
            threshold: 0.5,
            max_results: 5
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success && result.job_id) {
          // Update local task with server job ID
          updateQueueTask(taskId, { 
            job_id: result.job_id,
            status: 'queued_on_server',
            server_message: result.message
          });
          
          // Removed assumedActiveJobs tracking - was causing performance issues
          
          // Start polling for job status
          pollJobStatus(result.job_id, taskId, galleryData);
        } else {
          throw new Error(result.error || 'Failed to submit gallery job to queue');
        }
        
        trackingService.track('gallery_processing_submitted', 'queue_api', {
          galleryId,
          job_id: result.job_id,
          success: true
        });

      } catch (error: any) {
        console.error('Gallery processing submission failed:', error);
        alert(`Gallery processing failed: ${error.message}`);
        
        // Mark task as failed and remove after delay
        updateQueueTask(taskId, { 
          status: 'failed',
          error: error.message
        });
        
        // Remove from local queue after 5 seconds
        setTimeout(() => removeLocalTask(taskId), 5000);
        
        trackingService.track('gallery_processing_failed', 'queue_api', {
          galleryId,
          error: error.message
        });
      }
    };

    // Scene batch processing functionality with simple queue
    const performSceneBatchProcessing = async (sceneId: string) => {
      const taskId = addToQueue({
        type: 'scene',
        entityId: sceneId,
        title: 'Scene Analysis',
        total: 1
      });
      
      try {
        const endpoint = getStashAIEndpoint();
        const apiUrl = `${endpoint.url}/api/v1/queue/submit/scene`;
        
        // Get scene data from Stash
        const sceneData = await getSceneData(sceneId);
        if (!sceneData) {
          throw new Error('Could not retrieve scene data from Stash');
        }
        
        updateQueueTask(taskId, { 
          title: `Scene: ${sceneData.title}`,
          status: 'processing'
        });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: endpoint.headers,
          body: JSON.stringify({
            entity: {
              id: sceneId,
              type: "scene",
              title: sceneData.title
            }
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const result = await response.json();
        
        if (result.success && result.job_id) {
          // Update local task with server job ID
          updateQueueTask(taskId, { 
            job_id: result.job_id,
            status: 'queued_on_server',
            server_message: result.message
          });
          
          // Removed assumedActiveJobs tracking - was causing performance issues
          
          // Start polling for job status
          pollJobStatus(result.job_id, taskId, sceneData);
        } else {
          throw new Error(result.error || 'Failed to submit scene job to queue');
        }
        
        trackingService.track('scene_processing_submitted', 'queue_api', {
          sceneId,
          job_id: result.job_id,
          success: true
        });

      } catch (error: any) {
        console.error('Scene processing submission failed:', error);
        alert(`Scene processing failed: ${error.message}`);
        
        // Mark task as failed and remove after delay
        updateQueueTask(taskId, { 
          status: 'failed',
          error: error.message
        });
        
        // Remove from local queue after 5 seconds
        setTimeout(() => removeLocalTask(taskId), 5000);
        
        trackingService.track('scene_processing_failed', 'queue_api', {
          sceneId,
          error: error.message
        });
      }
    };

    // Function to get scene data from DOM/API
    const getSceneData = async (sceneId: string) => {
      try {
        // Try to get scene data from the current page DOM
        const sceneTitle = document.querySelector('.scene-header h2')?.textContent || 
                         document.querySelector('h1')?.textContent ||
                         'Unknown Scene';
        
        const studioElement = document.querySelector('.scene-details .studio a');
        const studio = studioElement ? { name: studioElement.textContent } : null;
        
        const dateElement = document.querySelector('.scene-details .date');
        const date = dateElement?.textContent || null;

        return {
          id: sceneId,
          title: sceneTitle,
          studio,
          date
        };
      } catch (error) {
        console.error('Failed to get scene data:', error);
        return {
          id: sceneId,
          title: 'Unknown Scene',
          studio: null,
          date: null
        };
      }
    };

    // Function to get all screenshots from a scene
    const getSceneScreenshots = async (sceneId: string) => {
      try {
        // Get screenshots from the scene page DOM
        const screenshotElements = document.querySelectorAll('.scene-image img, .wall-item img, .screenshot img');
        const screenshots: any[] = [];

        screenshotElements.forEach((img: any, index: number) => {
          if (img.src && !img.src.includes('data:')) {
            const screenshotId = `${sceneId}_screenshot_${index}`;
            screenshots.push({
              id: screenshotId,
              url: img.src,
              title: img.alt || `Screenshot ${index + 1}`,
              timestamp: index * 30 // Rough estimate: 30 seconds apart
            });
          }
        });

        // If no screenshots found in DOM, try alternative selectors
        if (screenshots.length === 0) {
          const altImages = document.querySelectorAll('img[src*="/scene/"], img[src*="/screenshot/"]');
          altImages.forEach((img: any, index: number) => {
            if (img.src && !img.src.includes('data:')) {
              const screenshotId = `${sceneId}_screenshot_${index}`;
              screenshots.push({
                id: screenshotId,
                url: img.src,
                title: img.alt || `Screenshot ${index + 1}`,
                timestamp: index * 30
              });
            }
          });
        }

        console.log(`Found ${screenshots.length} screenshots in scene ${sceneId}`);
        console.log('Sample screenshot URLs:', screenshots.slice(0, 3).map(s => ({ id: s.id, url: s.url })));
        
        // Debug: Log all screenshot URLs to check validity
        screenshots.forEach((screenshot, index) => {
          console.log(`Screenshot ${index}: ${screenshot.url}`);
        });
        
        return screenshots;
      } catch (error) {
        console.error('Failed to get scene screenshots:', error);
        return [];
      }
    };

    // Function to get gallery data from DOM/API
    const getGalleryData = async (galleryId: string) => {
      try {
        // Try to get gallery data from the current page DOM
        const galleryTitle = document.querySelector('.gallery-head h2')?.textContent || 
                           document.querySelector('h1')?.textContent ||
                           'Unknown Gallery';
        
        const studioElement = document.querySelector('.gallery-details .studio a');
        const studio = studioElement ? { name: studioElement.textContent } : null;
        
        const dateElement = document.querySelector('.gallery-details .date');
        const date = dateElement?.textContent || null;

        return {
          id: galleryId,
          title: galleryTitle,
          studio,
          date
        };
      } catch (error) {
        console.error('Failed to get gallery data:', error);
        return {
          id: galleryId,
          title: 'Unknown Gallery',
          studio: null,
          date: null
        };
      }
    };

    // Function to extract real image ID from Stash URL
    const extractImageIdFromUrl = (imageUrl: string): string | null => {
      // Stash image URLs are typically: /image/{id} or /image/{id}/thumbnail
      const match = imageUrl.match(/\/image\/(\d+)(?:\/|$|\?)/);
      return match ? match[1] : null;
    };

    // Function to get all images from a gallery
    const getGalleryImages = async (galleryId: string) => {
      try {
        // Get images from the gallery page DOM
        const imageElements = document.querySelectorAll('.gallery-image-container img, .wall-item img');
        const images: any[] = [];

        imageElements.forEach((img: any, index: number) => {
          if (img.src && !img.src.includes('data:')) {
            const realImageId = extractImageIdFromUrl(img.src);
            if (realImageId) {
              images.push({
                id: realImageId, // Use real Stash image ID
                url: img.src,
                title: img.alt || `Image ${index + 1}`
              });
            } else {
              console.warn(`Could not extract image ID from URL: ${img.src}`);
            }
          }
        });

        // If no images found in DOM, try alternative selectors
        if (images.length === 0) {
          const altImages = document.querySelectorAll('img[src*="/image/"]');
          altImages.forEach((img: any, index: number) => {
            if (img.src && !img.src.includes('data:')) {
              const realImageId = extractImageIdFromUrl(img.src);
              if (realImageId) {
                images.push({
                  id: realImageId, // Use real Stash image ID
                  url: img.src,
                  title: img.alt || `Image ${index + 1}`
                });
              } else {
                console.warn(`Could not extract image ID from URL: ${img.src}`);
              }
            }
          });
        }

        console.log(`Found ${images.length} images in gallery ${galleryId}`);
        console.log('Sample image IDs:', images.slice(0, 3).map(img => ({ id: img.id, url: img.url })));
        return images;
      } catch (error) {
        console.error('Failed to get gallery images:', error);
        return [];
      }
    };

    // Function to convert image to base64
    const imageToBase64 = async (imageUrl: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          
          try {
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            resolve(base64);
          } catch (error) {
            reject(error);
          }
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });
    };

    // Function to get image data from the current page
    const getImageData = async (imageId: string) => {
      try {
        // Try to get image data from the current page DOM
        const imageElement = document.querySelector('img[src*="/image/"]') as HTMLImageElement;
        if (imageElement && imageElement.src) {
          const base64Data = await imageToBase64(imageElement.src);
          return {
            id: imageId,
            title: document.title || `Image ${imageId}`,
            url: imageElement.src,
            thumbnail: imageElement.src,
            base64: base64Data
          };
        }

        // Fallback: construct the image URL based on Stash's URL patterns
        const baseUrl = window.location.origin;
        const imageUrl = `${baseUrl}/image/${imageId}`;
        const base64Data = await imageToBase64(imageUrl);
        
        return {
          id: imageId,
          title: `Image ${imageId}`,
          url: imageUrl,
          thumbnail: `${baseUrl}/image/${imageId}/thumbnail`,
          base64: base64Data
        };
      } catch (error) {
        console.error('Failed to get image data:', error);
        return null;
      }
    };

    const handleActionClick = async (action: AIAction) => {
      console.log('AI Action triggered:', action);
      
      trackingService.track('ai_action_triggered', 'ai_dropdown', {
        actionId: action.id,
        actionLabel: action.label,
        context: context.page,
        entityId: context.entityId
      });

      if (action.endpoint) {
        setShowDropdown(false);
        
        // Handle specific actions with API calls
        if (action.id === 'identify_performers_image' && context.entityId) {
          await performFacialRecognition(context.entityId);
        } else if (action.id === 'batch_analyze_gallery' && context.entityId) {
          await performGalleryBatchProcessing(context.entityId);
        } else if (action.id === 'identify_performers_scene' && context.entityId) {
          await performSceneBatchProcessing(context.entityId);
        } else {
          // Generic API call for other actions
          const endpoint = getStashAIEndpoint();
          const fullUrl = `${endpoint.url}${action.endpoint}`;
          alert(`API call would be made to: ${fullUrl}\n\nAction: ${action.label}\nContext: ${context.page}\nEntity ID: ${context.entityId || 'N/A'}`);
        }
      } else {
        alert(`Action "${action.label}" triggered!\n\nContext: ${context.page}\nEntity ID: ${context.entityId || 'N/A'}\nDetail View: ${context.isDetailView}`);
        setShowDropdown(false);
      }
    };

    const exportData = () => {
      const blob = trackingService.exportInteractions();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ai_interactions_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setShowDropdown(false);
    };

    const showStats = () => {
      const stats = trackingService.getStats();
      alert(`Total interactions tracked: ${stats.totalInteractions}\nSession interactions: ${stats.sessionInteractions}`);
      setShowDropdown(false);
    };

    const fetchAISettingsData = async () => {
      try {
        setAISettingsData((prev: any) => ({ ...prev, loading: true }));
        const endpoint = getStashAIEndpoint();
        
        // Fetch jobs with evaluation results (V2 schema)
        const jobsResponse = await fetch(`${endpoint.url}/api/v1/ai-jobs/evaluation-results?limit=50`, {
          headers: endpoint.headers
        });
        
        // Fetch model evaluator statistics
        const statsResponse = await fetch(`${endpoint.url}/api/v1/ai-jobs/evaluator-stats`, {
          headers: endpoint.headers
        });
        
        // Fetch evaluation trends
        const trendsResponse = await fetch(`${endpoint.url}/api/v1/ai-jobs/evaluation-trends?days=30`, {
          headers: endpoint.headers
        });
        
        // Fetch database status
        const dbStatusResponse = await fetch(`${endpoint.url}/api/v1/database/status`, {
          headers: endpoint.headers
        });
        
        const [jobs, evaluatorStats, trends, databaseStatus] = await Promise.all([
          jobsResponse.ok ? jobsResponse.json() : [],
          statsResponse.ok ? statsResponse.json() : null,
          trendsResponse.ok ? trendsResponse.json() : null,
          dbStatusResponse.ok ? dbStatusResponse.json() : null
        ]);
        
        setAISettingsData({
          jobs: jobs || [],
          evaluatorStats,
          trends,
          databaseStatus,
          loading: false
        });
        
      } catch (error) {
        console.error('Failed to fetch AI Settings data:', error);
        setAISettingsData((prev: any) => ({ ...prev, loading: false }));
      }
    };

    const goToSettings = () => {
      setShowAISettings(true);
      setShowDropdown(false);
      fetchAISettingsData(); // Load data when opening settings
    };

    const goToInteractions = () => {
      setShowAIInteractions(true);
      setShowDropdown(false);
    };

    const handlePerformerAction = (performer: any, action: string) => {
      console.log('Performer action:', action, performer);
      
      switch (action) {
        case 'tag_image':
          // TODO: Implement image tagging
          alert(`Tagging image with ${performer.name}`);
          break;
        case 'tag_gallery':
          // TODO: Implement gallery tagging
          alert(`Tagging gallery with ${performer.name}`);
          break;
        case 'view':
          // Navigate to performer page
          if (performer.id) {
            window.location.href = `/performers/${performer.id}`;
          }
          break;
        default:
          console.log('Unknown performer action:', action);
      }
      
      trackingService.track('performer_action', 'overlay', {
        action,
        performerId: performer.id,
        performerName: performer.name
      });
    };

    const viewJobResults = async (jobId: string) => {
      try {
        setShowDropdown(false); // Close dropdown
        
        const endpoint = getStashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/ai-jobs/${jobId}?include_results=true&include_tests=true`, {
          headers: endpoint.headers
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch job results: ${response.status}`);
        }
        
        const jobData = await response.json();
        console.log('Job results:', jobData);
        
        // Determine the result type and show appropriate overlay
        if (jobData.entity_type === 'gallery' && jobData.detailed_results) {
          // Show gallery results
          setOverlayData({
            title: `Gallery Results: ${jobData.entity_name}`,
            galleryData: {
              id: jobData.entity_id,
              title: jobData.entity_name
            },
            galleryResults: jobData.detailed_results,
            rawResponse: jobData,
            actionType: 'gallery'
          });
          setShowOverlay(true);
        } else if (jobData.entity_type === 'scene' && jobData.detailed_results) {
          // Show scene results (reuse gallery overlay)
          setOverlayData({
            title: `Scene Results: ${jobData.entity_name}`,
            sceneData: {
              id: jobData.entity_id,
              title: jobData.entity_name
            },
            sceneResults: jobData.detailed_results,
            rawResponse: jobData,
            actionType: 'scene'
          });
          setShowOverlay(true);
        } else if (jobData.entity_type === 'image' && jobData.detailed_results) {
          // Show image results
          setOverlayData({
            title: `Image Results: ${jobData.entity_name}`,
            sourceImage: null, // We'd need to fetch the image URL
            results: jobData.detailed_results,
            rawResponse: jobData,
            actionType: 'single',
            imageData: {
              id: jobData.entity_id,
              url: null // Would need to construct this
            }
          });
          setShowOverlay(true);
        } else {
          // Fallback - show raw data
          alert(`Job completed:\n${JSON.stringify(jobData, null, 2)}`);
        }
        
      } catch (error: any) {
        console.error('Failed to load job results:', error);
        alert(`Failed to load results: ${error.message}`);
      }
    };

    React.useEffect(() => {
      const handleClickOutside = (event: Event) => {
        const target = event.target as Element;
        if (!target.closest('[data-ai-dropdown]')) {
          setShowDropdown(false);
        }
      };

      if (showDropdown) {
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
      }
    }, [showDropdown]);

    const contextualActions = getContextualActions(context);
    const contextLabel = getContextLabel(context);

    // Toggle function for main dropdown (different from queue dropdown)
    const toggleMainDropdown = () => setShowDropdown(!showDropdown);

    return React.createElement('div', { style: { position: 'relative' }, 'data-ai-dropdown': true },
      React.createElement(Button, {
        className: aiButtonStyles.button.base,
        onClick: toggleMainDropdown, // Always clickable
        disabled: false, // Never disable, allow hover interactions  
        title: isProcessing ? 'Click to view queue or add more tasks...' : `AI Overhaul - ${contextLabel} Context\n${getStatusTooltip()}`,
        onMouseEnter: () => {
          setIsHovering(true);
          setShowQueueDropdown(true);
        },
        onMouseLeave: () => {
          setIsHovering(false);
          setShowQueueDropdown(false);
        },
        style: {
          color: aiButtonStyles.button.colors.connected,
          backgroundColor: 'transparent',
          border: 'none',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          position: 'relative',
          opacity: 1,
          cursor: 'pointer'
        }
      },
        // Queue System Display
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            position: 'relative'
          }
        },
          // Main icon/progress indicator
          React.createElement('span', { style: { fontSize: '16px' } }, 
            isProcessing ? 
              (displayProgress.total > 0 ? 
                React.createElement('div', {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    color: '#6c757d'
                  }
                },
                  React.createElement('div', {
                    style: {
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid #e9ecef',
                      borderTop: '2px solid #6c5ce7',
                      animation: 'spin 1s linear infinite'
                    }
                  }),
                  React.createElement('span', { style: { fontSize: '9px', fontWeight: 'bold' } }, 
                    `${displayProgress.current}/${displayProgress.total}`
                  )
                ) : React.createElement('div', {
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '12px',
                    color: '#6c757d'
                  }
                },
                  React.createElement('div', {
                    style: {
                      width: '14px',
                      height: '14px',
                      borderRadius: '50%',
                      border: '2px solid #e9ecef',
                      borderTop: '2px solid #6c5ce7',
                      animation: 'spin 1s linear infinite'
                    }
                  })
                )
              ) : (hasNotifications ? 
                React.createElement('span', null,
                  React.createElement('i', { className: 'fas fa-brain', style: { marginRight: '2px' } }),
                  '❗'
                ) : (isHovering ? '➕' : React.createElement('i', { className: 'fas fa-brain' })))
          ),
          
          // Queue indicator (+ symbol if multiple tasks)
          (serverJobs.length + localQueue.size) > 1 && React.createElement('span', {
            style: {
              fontSize: '10px',
              color: '#6c5ce7',
              fontWeight: 'bold',
              marginLeft: '2px'
            }
          }, `+${(serverJobs.length + localQueue.size) - 1}`),
          
          // Queue dropdown - show if there are active jobs OR notifications
          showQueueDropdown && (serverJobs.length > 0 || localQueue.size > 0 || hasNotifications || recentCompletedJobs.length > 0) && React.createElement('div', {
            style: {
              position: 'absolute',
              top: '100%',
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
              minWidth: '280px',
              maxWidth: '400px',
              zIndex: 1001,
              color: '#333',
              marginTop: '8px'
            }
          },
            // Queue header
            React.createElement('div', {
              style: {
                padding: '12px 16px',
                borderBottom: '1px solid #eee',
                backgroundColor: '#f8f9fa',
                borderRadius: '8px 8px 0 0'
              }
            },
              React.createElement('div', {
                style: { fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }
              }, (serverJobs.length > 0 || localQueue.size > 0) ? '🔄 AI Processing Queue' : '✅ AI Job Notifications'),
              React.createElement('div', {
                style: { fontSize: '12px', color: '#666' }
              }, (serverJobs.length > 0 || localQueue.size > 0) ? 
                `${serverJobs.length + localQueue.size} Jobs active, ${displayProgress.total} Tests total (${displayProgress.current} completed)` :
                `${completedJobNotifications.size} completed job${completedJobNotifications.size !== 1 ? 's' : ''} ready to view`
              )
            ),
            
            // Detailed job listings with test information
            React.createElement("div", {
              style: { maxHeight: "350px", overflowY: "auto" }
            },
              // Show active jobs (both local and server)
              (serverJobs.length > 0 || localQueue.size > 0) ? 
                React.createElement("div", {},
                  // Local jobs first (immediate feedback)
                  Array.from(localQueue.values()).map((task: any) =>
                    React.createElement('div', {
                      key: task.id,
                      style: {
                        padding: '8px 16px',
                        borderBottom: '1px solid #e9ecef',
                        cursor: 'pointer'
                      }
                    },
                      React.createElement('div', {
                        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
                      },
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                          React.createElement('span', { style: { fontSize: '12px' } },
                            task.type === 'gallery' ? '🖼️' : 
                            task.type === 'scene' ? '🎬' : '🖼️'
                          ),
                          React.createElement('div', {},
                            React.createElement('span', { style: { fontSize: '11px', fontWeight: 'bold' } }, 
                              task.title || `${task.type} processing`
                            ),
                            task.job_id && React.createElement('div', {
                              style: { fontSize: '9px', color: '#999', fontFamily: 'monospace' }
                            }, `ID: ${task.job_id.substring(0, 12)}...`)
                          )
                        ),
                        React.createElement('div', {
                          style: {
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '12px',
                            backgroundColor: '#fff3e0',
                            color: '#f57c00'
                          }
                        }, task.status || 'pending')
                      )
                    )
                  ),
                  // Server jobs - show progress for ANY job with progress data, regardless of server status
                  (() => {
                    console.log(`🔍 Server jobs:`, serverJobs.map((j: any) => j.job_id));
                    console.log(`🔍 Progress keys:`, Array.from(jobProgress.keys()));
                    return null;
                  })(),
                  // Show server-reported jobs
                  serverJobs.map((job: any, index: number) =>
                    React.createElement('div', {
                      key: job.job_id || index,
                      style: {
                        padding: '8px 16px',
                        borderBottom: '1px solid #e9ecef'
                      }
                    },
                      React.createElement('div', {
                        style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
                      },
                        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                          React.createElement('span', { 
                            style: { fontSize: '12px' } 
                          }, 
                            job.job_type === 'gallery' ? '🖼️' : 
                            job.job_type === 'scene' ? '🎬' : 
                            job.job_type === 'image' ? '📷' : '🤖'
                          ),
                          React.createElement('div', {},
                            React.createElement('span', { style: { fontSize: '11px', fontWeight: 'bold' } }, 
                              job.entity_name || `Job ${job.job_id?.substring(0, 8) || index}`
                            ),
                            job.job_id && React.createElement('div', {
                              style: { fontSize: '9px', color: '#999', fontFamily: 'monospace' }
                            }, `ID: ${job.job_id.substring(0, 12)}...`)
                          )
                        ),
                        React.createElement('div', {
                          style: {
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '12px',
                            backgroundColor: '#e3f2fd',
                            color: '#1976d2'
                          }
                        }, job.status || 'processing')
                      ),
                      // Show progress bar if available
                      jobProgress.has(job.job_id) && (() => {
                        console.log(`🎯 Rendering progress for job ${job.job_id}:`, jobProgress.get(job.job_id));
                        const progress = jobProgress.get(job.job_id);
                        return React.createElement('div', {
                          style: { marginTop: '8px', marginLeft: '20px', marginRight: '8px' }
                        },
                          React.createElement('div', {
                            style: { 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              fontSize: '10px', 
                              color: '#666', 
                              marginBottom: '4px' 
                            }
                          }, 
                            React.createElement('span', {}, progress.message || `${progress.current}/${progress.total} items`),
                            // Cancel button (only show if job is not completed/failed/cancelled)
                            !progress.message?.includes('✅') && !progress.message?.includes('❌') && !progress.message?.includes('🚫') && 
                            React.createElement('button', {
                              style: {
                                fontSize: '10px',
                                padding: '2px 6px',
                                border: '1px solid #f44336',
                                borderRadius: '3px',
                                backgroundColor: '#fff',
                                color: '#f44336',
                                cursor: 'pointer',
                                marginLeft: '8px'
                              },
                              onClick: (e: Event) => {
                                e.stopPropagation();
                                cancelJobViaWebSocket(job.job_id);
                              },
                              onMouseOver: (e: Event) => {
                                (e.target as HTMLElement).style.backgroundColor = '#f44336';
                                (e.target as HTMLElement).style.color = '#fff';
                              },
                              onMouseOut: (e: Event) => {
                                (e.target as HTMLElement).style.backgroundColor = '#fff';
                                (e.target as HTMLElement).style.color = '#f44336';
                              }
                            }, 'Cancel')
                          ),
                          React.createElement('div', {
                            style: {
                              width: '100%',
                              height: '6px',
                              backgroundColor: '#e0e0e0',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }
                          },
                            React.createElement('div', {
                              style: {
                                width: `${progress.percentage}%`,
                                height: '100%',
                                backgroundColor: '#4caf50',
                                transition: 'width 0.3s ease'
                              }
                            })
                          )
                        );
                      })(),
                      // Show tests for this job
                      job.tests && job.tests.length > 0 && React.createElement('div', {
                        style: {
                          backgroundColor: '#f8f9fa',
                          borderLeft: '3px solid #6c5ce7',
                          marginLeft: '20px',
                          marginTop: '4px',
                          borderRadius: '0 4px 4px 0'
                        }
                      },
                        job.tests.slice(0, 5).map((test: any, testIndex: number) =>
                          React.createElement('div', {
                            key: test.test_id || testIndex,
                            style: {
                              padding: '6px 12px',
                              borderBottom: testIndex < Math.min(job.tests.length, 5) - 1 ? '1px solid #e9ecef' : 'none',
                              fontSize: '10px'
                            }
                          },
                            React.createElement('div', {
                              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
                            },
                              React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '4px' } },
                                React.createElement('span', { style: { color: '#6c5ce7' } }, '🧪'),
                                React.createElement('span', { style: { fontFamily: 'monospace', color: '#666' } }, 
                                  `Test ${(test.test_id || `test_${testIndex}`).substring(0, 8)}...`
                                )
                              ),
                              React.createElement('div', {
                                style: {
                                  fontSize: '9px',
                                  padding: '1px 4px',
                                  borderRadius: '8px',
                                  backgroundColor: 
                                    test.status === 'processing' ? '#e3f2fd' :
                                    test.status === 'completed' ? '#e8f5e8' :
                                    test.status === 'failed' ? '#ffebee' : '#f5f5f5',
                                  color: 
                                    test.status === 'processing' ? '#1976d2' :
                                    test.status === 'completed' ? '#388e3c' :
                                    test.status === 'failed' ? '#d32f2f' : '#666'
                                }
                              }, test.status || 'queued')
                            )
                          )
                        ),
                        job.tests.length > 5 && React.createElement('div', {
                          style: {
                            padding: '6px 12px',
                            fontSize: '9px',
                            color: '#666',
                            fontStyle: 'italic',
                            textAlign: 'center'
                          }
                        }, `... and ${job.tests.length - 5} more tests`)
                      )
                    )
                  ),
                  // Show jobs with active progress that aren't reported by server
                  (() => {
                    const serverJobIds = new Set(serverJobs.map((job: any) => job.job_id));
                    const progressOnlyJobs = Array.from(jobProgress.keys()).filter((jobId: any) => {
                      if (serverJobIds.has(jobId)) return false;
                      
                      // Filter out completed jobs that shouldn't show as active
                      const progress = jobProgress.get(jobId);
                      if (progress && (progress.message?.includes('✅') || progress.message?.includes('❌') || progress.message?.includes('🚫'))) {
                        return false;
                      }
                      
                      return true;
                    });
                    
                    return progressOnlyJobs.map((jobId: any) => {
                      const progress = jobProgress.get(jobId);
                      
                      // Determine job type from job ID prefix
                      const jobIdStr = jobId as string;
                      let jobType = 'gallery'; // default
                      let jobIcon = '🖼️';
                      let jobTitle = 'Gallery Processing';
                      
                      if (jobIdStr.startsWith('image_')) {
                        jobType = 'image';
                        jobIcon = '📷';
                        jobTitle = 'Image Processing';
                      } else if (jobIdStr.startsWith('scene_')) {
                        jobType = 'scene';
                        jobIcon = '🎬';
                        jobTitle = 'Scene Processing';
                      }
                      
                      return React.createElement('div', {
                        key: `progress-${jobId}`,
                        style: {
                          padding: '8px 16px',
                          borderBottom: '1px solid #e9ecef'
                        }
                      },
                        React.createElement('div', {
                          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
                        },
                          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                            React.createElement('span', { style: { fontSize: '12px' } }, jobIcon),
                            React.createElement('div', {},
                              React.createElement('span', { style: { fontSize: '11px', fontWeight: 'bold' } }, 
                                `${jobTitle} ${jobIdStr.substring(0, 8)}...`
                              ),
                              React.createElement('div', {
                                style: { fontSize: '9px', color: '#999', fontFamily: 'monospace' }
                              }, `ID: ${jobIdStr.substring(0, 12)}...`)
                            )
                          ),
                          React.createElement('div', {
                            style: {
                              fontSize: '10px',
                              padding: '2px 6px',
                              borderRadius: '12px',
                              backgroundColor: '#e3f2fd',
                              color: '#1976d2'
                            }
                          }, 'processing')
                        ),
                        // Progress bar for virtual job
                        React.createElement('div', {
                          style: { marginTop: '8px', marginLeft: '20px', marginRight: '8px' }
                        },
                          React.createElement('div', {
                            style: { 
                              display: 'flex', 
                              justifyContent: 'space-between', 
                              alignItems: 'center',
                              fontSize: '10px', 
                              color: '#666', 
                              marginBottom: '4px' 
                            }
                          },
                            React.createElement('span', {}, progress.message || `${progress.current}/${progress.total} items`),
                            // Cancel button for virtual jobs (only show if job is not completed/failed/cancelled)
                            !progress.message?.includes('✅') && !progress.message?.includes('❌') && !progress.message?.includes('🚫') && 
                            React.createElement('button', {
                              style: {
                                fontSize: '10px',
                                padding: '2px 6px',
                                border: '1px solid #f44336',
                                borderRadius: '3px',
                                backgroundColor: '#fff',
                                color: '#f44336',
                                cursor: 'pointer',
                                marginLeft: '8px'
                              },
                              onClick: (e: Event) => {
                                e.stopPropagation();
                                cancelJobViaWebSocket(jobId as string);
                              },
                              onMouseOver: (e: Event) => {
                                (e.target as HTMLElement).style.backgroundColor = '#f44336';
                                (e.target as HTMLElement).style.color = '#fff';
                              },
                              onMouseOut: (e: Event) => {
                                (e.target as HTMLElement).style.backgroundColor = '#fff';
                                (e.target as HTMLElement).style.color = '#f44336';
                              }
                            }, 'Cancel')
                          ),
                          React.createElement('div', {
                            style: {
                              width: '100%',
                              height: '6px',
                              backgroundColor: '#e0e0e0',
                              borderRadius: '3px',
                              overflow: 'hidden'
                            }
                          },
                            React.createElement('div', {
                              style: {
                                width: `${progress.percentage}%`,
                                height: '100%',
                                backgroundColor: '#4caf50',
                                transition: 'width 0.3s ease'
                              }
                            })
                          )
                        )
                      );
                    });
                  })(),
                  // Removed assumedActiveJobs section - was causing performance issues
                ) :
                // No active jobs fallback 
                React.createElement("div", {
                  style: { padding: "16px", textAlign: "center", color: "#666", fontSize: "12px" }
                }, hasNotifications ? "Completed jobs ready to view" : "No active jobs")
              ),
              
              // Recent completed jobs section (always show if available)
              recentCompletedJobs.length > 0 && React.createElement('div', {
                style: {
                  borderTop: '1px solid #e9ecef',
                  marginTop: '8px',
                  paddingTop: '8px'
                }
              },
                React.createElement('div', {
                  style: { 
                    padding: '8px 16px', 
                    fontSize: '12px', 
                    fontWeight: 'bold', 
                    color: '#666',
                    backgroundColor: '#f8f9fa'
                  }
                }, '📋 Recent Results'),
                
                recentCompletedJobs.slice(0, 5).map((job: any) =>
                  React.createElement('div', {
                    key: job.job_id,
                    style: {
                      padding: '8px 16px',
                      borderBottom: '1px solid #f0f0f0',
                      cursor: 'pointer',
                      backgroundColor: 'white'
                    },
                    onClick: () => viewJobResults(job.job_id),
                    onMouseEnter: (e: any) => e.currentTarget.style.backgroundColor = '#f8f9fa',
                    onMouseLeave: (e: any) => e.currentTarget.style.backgroundColor = 'white'
                  },
                    React.createElement('div', {
                      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
                    },
                      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                        React.createElement('span', { style: { fontSize: '12px' } }, 
                          job.entity_type === 'gallery' ? '🖼️' : 
                          job.entity_type === 'scene' ? '🎬' : '📷'
                        ),
                        React.createElement('div', {},
                          React.createElement('span', { style: { fontSize: '11px', fontWeight: 'bold' } }, 
                            job.job_name || job.entity_name
                          ),
                          React.createElement('div', {
                            style: { fontSize: '9px', color: '#999', fontFamily: 'monospace' }
                          }, `${job.successful_items || 0}/${job.total_items || 0} items • ${job.completed_at ? new Date(job.completed_at).toLocaleTimeString() : 'Recently'}`)
                        )
                      ),
                      React.createElement('div', {
                        style: {
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '12px',
                          backgroundColor: '#e8f5e8',
                          color: '#388e3c'
                        }
                      }, '✓ View Results')
                    )
                  )
                )
            ),
          )
        ),
        // Status dot
        React.createElement('div', {
          style: {
            position: 'absolute',
            top: '6px',
            right: '6px',
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            border: '1px solid rgba(255,255,255,0.8)',
            boxShadow: '0 0 4px rgba(0,0,0,0.3)',
            zIndex: 10
          }
        })
      ),

      showDropdown && React.createElement('div', { style: aiButtonStyles.dropdown.container },
        // Header
        React.createElement('div', { style: aiButtonStyles.header.container },
          React.createElement('div', { style: aiButtonStyles.header.title },
            React.createElement('i', { className: 'fas fa-brain', style: { color: '#6c5ce7' } }),
            'AI Overhaul'
          ),
          React.createElement('div', { style: aiButtonStyles.header.status },
            React.createElement('div', { 
              style: {
                ...aiButtonStyles.services.statusDot,
                backgroundColor: getStatusColor()
              }
            }),
            `${contextLabel} Context • ${healthStatus.status.charAt(0).toUpperCase() + healthStatus.status.slice(1)}`
          )
        ),

        // Health Status Details
        React.createElement('div', { 
          style: { 
            padding: '8px 16px', 
            backgroundColor: '#f8f9fa', 
            borderBottom: '1px solid #eee',
            marginBottom: '8px' 
          } 
        },
          React.createElement('div', { 
            style: { 
              fontSize: '12px', 
              fontWeight: 'bold', 
              color: '#666', 
              marginBottom: '6px' 
            } 
          }, 'Service Health Status'),
          
          // StashAI Server Status
          React.createElement('div', { 
            style: { 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '11px', 
              marginBottom: '3px' 
            } 
          },
            React.createElement('div', { 
              style: {
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: healthStatus.serverHealthy ? '#28a745' : '#dc3545'
              }
            }),
            `StashAI Server: ${healthStatus.serverHealthy ? 'Healthy' : 'Down'}`
          ),
          
          // Visage Service Status
          React.createElement('div', { 
            style: { 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              fontSize: '11px', 
              marginBottom: '3px' 
            } 
          },
            React.createElement('div', { 
              style: {
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: healthStatus.visageHealthy ? '#28a745' : '#dc3545'
              }
            }),
            `Visage Service: ${healthStatus.visageHealthy ? 'Healthy' : 'Down'}`
          ),
          
          // Last checked
          healthStatus.lastChecked && React.createElement('div', { 
            style: { 
              fontSize: '10px', 
              color: '#999', 
              marginTop: '4px' 
            } 
          }, `Last checked: ${healthStatus.lastChecked.toLocaleTimeString()}`)
        ),

        // Actions
        React.createElement('div', { style: { marginBottom: '8px' } },
          React.createElement('div', { 
            style: { 
              padding: '8px 16px', 
              backgroundColor: '#f8f9fa', 
              borderBottom: '1px solid #eee',
              fontSize: '12px',
              fontWeight: 'bold',
              color: '#666'
            }
          }, 'Available Actions'),
          
          contextualActions.length > 0 ? (
            contextualActions.map((action) => 
              React.createElement('button', {
                key: action.id,
                onClick: () => handleActionClick(action),
                style: aiButtonStyles.actions.item,
                onMouseEnter: (e: any) => e.currentTarget.style.backgroundColor = '#f8f9fa',
                onMouseLeave: (e: any) => e.currentTarget.style.backgroundColor = 'transparent'
              },
                React.createElement('span', { 
                  style: { ...aiButtonStyles.actions.icon, color: '#6c5ce7', fontSize: '16px' }
                }, action.icon),
                React.createElement('div', { style: { flex: 1, textAlign: 'left' } },
                  React.createElement('div', { style: { fontWeight: '500', marginBottom: '2px' } }, action.label),
                  React.createElement('div', { style: { fontSize: '11px', color: '#666' } }, action.description)
                )
              )
            )
          ) : (
            React.createElement('div', { 
              style: { padding: '16px', textAlign: 'center', color: '#666', fontSize: '12px' }
            }, 'No AI actions available for this context')
          )
        ),

        // Utility actions
        React.createElement('div', { style: { borderTop: '1px solid #eee', marginTop: '8px', paddingTop: '8px' } },
          React.createElement('button', {
            onClick: goToSettings,
            style: aiButtonStyles.actions.item,
            onMouseEnter: (e: any) => e.currentTarget.style.backgroundColor = '#f8f9fa',
            onMouseLeave: (e: any) => e.currentTarget.style.backgroundColor = 'transparent'
          },
            React.createElement('span', { style: aiButtonStyles.actions.icon }, '⚙️'),
            'Settings'
          ),
          React.createElement('button', {
            onClick: goToInteractions,
            style: aiButtonStyles.actions.item,
            onMouseEnter: (e: any) => e.currentTarget.style.backgroundColor = '#f8f9fa',
            onMouseLeave: (e: any) => e.currentTarget.style.backgroundColor = 'transparent'
          },
            React.createElement('span', { style: aiButtonStyles.actions.icon }, '📈'),
            'AI Interactions'
          ),
          React.createElement('button', {
            onClick: exportData,
            style: aiButtonStyles.actions.item,
            onMouseEnter: (e: any) => e.currentTarget.style.backgroundColor = '#f8f9fa',
            onMouseLeave: (e: any) => e.currentTarget.style.backgroundColor = 'transparent'
          },
            React.createElement('span', { style: aiButtonStyles.actions.icon }, '⬇️'),
            'Export Data'
          ),
          React.createElement('button', {
            onClick: showStats,
            style: aiButtonStyles.actions.item,
            onMouseEnter: (e: any) => e.currentTarget.style.backgroundColor = '#f8f9fa',
            onMouseLeave: (e: any) => e.currentTarget.style.backgroundColor = 'transparent'
          },
            React.createElement('span', { style: aiButtonStyles.actions.icon }, '📊'),
            'View Stats'
          )
        )
      ),

      // AI Results Overlay
      showOverlay && overlayData && (
        // Render gallery overlay for gallery results
        overlayData.actionType === 'gallery' && (window as any).AIResultsOverlayGalleries ?
          React.createElement((window as any).AIResultsOverlayGalleries, {
            show: showOverlay,
            onHide: () => setShowOverlay(false),
            title: overlayData.title,
            galleryData: overlayData.galleryData,
            galleryResults: overlayData.galleryResults,
            rawResponse: overlayData.rawResponse,
            onPerformerAction: handlePerformerAction
          }) :
          // Render scene overlay for scene results (reuse gallery overlay for now)
          overlayData.actionType === 'scene' && (window as any).AIResultsOverlayGalleries ?
            React.createElement((window as any).AIResultsOverlayGalleries, {
              show: showOverlay,
              onHide: () => setShowOverlay(false),
              title: overlayData.title,
              galleryData: overlayData.sceneData, // Pass scene data as gallery data
              galleryResults: overlayData.sceneResults, // Pass scene results as gallery results
              rawResponse: overlayData.rawResponse,
              onPerformerAction: handlePerformerAction
            }) :
            // Render standard image overlay for image results
          (window as any).AIResultsOverlay && React.createElement((window as any).AIResultsOverlay, {
            show: showOverlay,
            onHide: () => setShowOverlay(false),
            title: overlayData.title,
            sourceImage: overlayData.sourceImage,
            results: overlayData.results,
            rawResponse: overlayData.rawResponse,
            actionType: overlayData.actionType,
            imageData: overlayData.imageData,
            onPerformerAction: handlePerformerAction
          })
      ),

      // AI Settings Modal
      showAISettings && React.createElement('div', {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        onClick: (e: any) => {
          if (e.target === e.currentTarget) {
            setShowAISettings(false);
          }
        }
      },
        React.createElement('div', {
          style: {
            backgroundColor: 'white',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '1200px',
            height: '80%',
            maxHeight: '800px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }
        },
          // Header
          React.createElement('div', {
            style: {
              padding: '20px',
              borderBottom: '1px solid #eee',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8f9fa'
            }
          },
            React.createElement('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }
            },
              React.createElement('i', { 
                className: 'fas fa-brain', 
                style: { color: '#6c5ce7', fontSize: '24px' } 
              }),
              React.createElement('h2', {
                style: { margin: 0, color: '#333' }
              }, 'AI Overhaul Settings')
            ),
            React.createElement('button', {
              onClick: () => setShowAISettings(false),
              style: {
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '0',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }
            }, '×')
          ),

          // Content
          React.createElement('div', {
            style: {
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }
          },
            aiSettingsData.loading ? (
              React.createElement('div', {
                style: {
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '400px'
                }
              },
                React.createElement('div', {
                  style: {
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f3f3',
                    borderTop: '4px solid #6c5ce7',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }
                }),
                React.createElement('span', {
                  style: { marginLeft: '15px', fontSize: '16px', color: '#666' }
                }, 'Loading AI Settings...')
              )
            ) : (
              React.createElement('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '20px',
                  height: '100%'
                }
              },
                // Left Column: Database Status & Model Performance
                React.createElement('div', {
                  style: { display: 'flex', flexDirection: 'column', gap: '20px' }
                },
                  // Database Status Card
                  React.createElement('div', {
                    style: {
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      padding: '15px',
                      backgroundColor: '#f8f9fa'
                    }
                  },
                    React.createElement('h3', {
                      style: { margin: '0 0 15px 0', color: '#333', fontSize: '18px' }
                    }, '🗄️ Database Status'),
                    
                    aiSettingsData.databaseStatus ? (
                      React.createElement('div', {
                        style: { fontSize: '14px' }
                      },
                        React.createElement('div', {
                          style: { 
                            marginBottom: '8px',
                            padding: '8px',
                            backgroundColor: aiSettingsData.databaseStatus.schema_up_to_date ? '#d4edda' : '#fff3cd',
                            border: `1px solid ${aiSettingsData.databaseStatus.schema_up_to_date ? '#c3e6cb' : '#ffeaa7'}`,
                            borderRadius: '4px'
                          }
                        },
                          React.createElement('strong', null, 'Schema Version: '),
                          `${aiSettingsData.databaseStatus.current_version} → ${aiSettingsData.databaseStatus.target_version}`
                        ),
                        React.createElement('div', { style: { marginBottom: '8px' } },
                          React.createElement('strong', null, 'V2 Features: '),
                          aiSettingsData.databaseStatus.v2_schema_available ? '✅ Available' : '❌ Not Available'
                        ),
                        React.createElement('div', { style: { marginBottom: '8px' } },
                          React.createElement('strong', null, 'Model Evaluators: '),
                          aiSettingsData.databaseStatus.schema_compatibility?.model_evaluators_available ? '✅ Active' : '❌ Inactive'
                        )
                      )
                    ) : (
                      React.createElement('div', {
                        style: { color: '#dc3545', fontStyle: 'italic' }
                      }, 'Database status unavailable')
                    )
                  ),

                  // Model Performance Card
                  aiSettingsData.evaluatorStats && !aiSettingsData.evaluatorStats.error && (
                    React.createElement('div', {
                      style: {
                        border: '1px solid #eee',
                        borderRadius: '8px',
                        padding: '15px',
                        backgroundColor: '#f8f9fa'
                      }
                    },
                      React.createElement('h3', {
                        style: { margin: '0 0 15px 0', color: '#333', fontSize: '18px' }
                      }, '📊 Model Performance'),
                      
                      React.createElement('div', {
                        style: { fontSize: '14px' }
                      },
                        React.createElement('div', { style: { marginBottom: '12px' } },
                          React.createElement('strong', null, `Total Evaluators: ${aiSettingsData.evaluatorStats.stats?.total_evaluators || 0}`)
                        ),
                        
                        aiSettingsData.evaluatorStats.stats?.model_performance?.map((model: any, index: number) =>
                          React.createElement('div', {
                            key: index,
                            style: {
                              marginBottom: '10px',
                              padding: '8px',
                              backgroundColor: 'white',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }
                          },
                            React.createElement('div', {
                              style: { fontWeight: 'bold', marginBottom: '4px' }
                            }, `${model.ai_model} - ${model.action_type}`),
                            React.createElement('div', {
                              style: { fontSize: '12px', color: '#666' }
                            },
                              `Pass Rate: ${model.pass_rate?.toFixed(1) || 0}% | `,
                              `Tests: ${model.total_tests || 0} | `,
                              `Avg Confidence: ${model.avg_confidence?.toFixed(2) || 'N/A'}`
                            )
                          )
                        )
                      )
                    )
                  )
                ),

                // Right Column: Job History & Trends
                React.createElement('div', {
                  style: { display: 'flex', flexDirection: 'column', gap: '20px' }
                },
                  // Recent Jobs Card
                  React.createElement('div', {
                    style: {
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      padding: '15px',
                      backgroundColor: '#f8f9fa',
                      flex: 1
                    }
                  },
                    React.createElement('h3', {
                      style: { margin: '0 0 15px 0', color: '#333', fontSize: '18px' }
                    }, '📝 Recent Jobs'),
                    
                    React.createElement('div', {
                      style: {
                        maxHeight: '400px',
                        overflow: 'auto',
                        fontSize: '13px'
                      }
                    },
                      aiSettingsData.jobs?.length > 0 ? (
                        aiSettingsData.jobs.slice(0, 10).map((job: any, index: number) =>
                          React.createElement('div', {
                            key: index,
                            style: {
                              marginBottom: '8px',
                              padding: '8px',
                              backgroundColor: 'white',
                              border: '1px solid #ddd',
                              borderRadius: '4px'
                            }
                          },
                            React.createElement('div', {
                              style: {
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '4px'
                              }
                            },
                              React.createElement('strong', {
                                style: { fontSize: '12px' }
                              }, job.job_name || job.job_id?.substring(0, 8)),
                              React.createElement('span', {
                                style: {
                                  padding: '2px 6px',
                                  borderRadius: '12px',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  backgroundColor: 
                                    job.overall_result === 'pass' ? '#d4edda' :
                                    job.overall_result === 'fail' ? '#f8d7da' :
                                    job.status === 'completed' ? '#d1ecf1' : '#fff3cd',
                                  color:
                                    job.overall_result === 'pass' ? '#155724' :
                                    job.overall_result === 'fail' ? '#721c24' :
                                    job.status === 'completed' ? '#0c5460' : '#856404'
                                }
                              }, job.overall_result || job.status)
                            ),
                            React.createElement('div', {
                              style: { fontSize: '11px', color: '#666' }
                            },
                              `${job.entity_type} | ${job.action_type} | `,
                              `Tests: ${job.tests_passed || 0}/${job.tests_planned || 0} | `,
                              `${job.performers_found_total || 0} performers`
                            )
                          )
                        )
                      ) : (
                        React.createElement('div', {
                          style: { textAlign: 'center', color: '#666', fontStyle: 'italic' }
                        }, 'No recent jobs found')
                      )
                    )
                  ),

                  // Trends Summary Card
                  aiSettingsData.trends && !aiSettingsData.trends.error && (
                    React.createElement('div', {
                      style: {
                        border: '1px solid #eee',
                        borderRadius: '8px',
                        padding: '15px',
                        backgroundColor: '#f8f9fa'
                      }
                    },
                      React.createElement('h3', {
                        style: { margin: '0 0 15px 0', color: '#333', fontSize: '18px' }
                      }, '📈 30-Day Trends'),
                      
                      React.createElement('div', {
                        style: { fontSize: '14px' }
                      },
                        React.createElement('div', { style: { marginBottom: '8px' } },
                          React.createElement('strong', null, 'Total Tests: '),
                          aiSettingsData.trends.trends?.summary?.total_tests || 0
                        ),
                        React.createElement('div', { style: { marginBottom: '8px' } },
                          React.createElement('strong', null, 'Success Rate: '),
                          `${(aiSettingsData.trends.trends?.summary?.overall_success_rate || 0).toFixed(1)}%`
                        ),
                        React.createElement('div', { style: { marginBottom: '8px' } },
                          React.createElement('strong', null, 'Passed: '),
                          `${aiSettingsData.trends.trends?.summary?.total_passed || 0} | `,
                          React.createElement('strong', null, 'Failed: '),
                          `${aiSettingsData.trends.trends?.summary?.total_failed || 0}`
                        )
                      )
                    )
                  )
                )
              )
            )
          )
        )
      ),

      // AI Interactions Modal
      showAIInteractions && React.createElement('div', {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        },
        onClick: (e: any) => {
          if (e.target === e.currentTarget) {
            setShowAIInteractions(false);
          }
        }
      },
        React.createElement('div', {
          style: {
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            width: '90%',
            maxWidth: '1200px',
            height: '90%',
            maxHeight: '800px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }
        },
          // Header
          React.createElement('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px',
              borderBottom: '1px solid #eee',
              backgroundColor: '#f8f9fa'
            }
          },
            React.createElement('div', {
              style: { display: 'flex', alignItems: 'center' }
            },
              React.createElement('i', {
                className: 'fas fa-history',
                style: { color: '#6c5ce7', fontSize: '24px', marginRight: '12px' }
              }),
              React.createElement('h2', {
                style: { margin: 0, color: '#333' }
              }, 'AI Interactions')
            ),
            React.createElement('button', {
              onClick: () => setShowAIInteractions(false),
              style: {
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#666',
                padding: '5px',
                borderRadius: '4px'
              },
              onMouseEnter: (e: any) => e.currentTarget.style.backgroundColor = '#f0f0f0',
              onMouseLeave: (e: any) => e.currentTarget.style.backgroundColor = 'transparent'
            }, '×')
          ),
          // Content
          React.createElement('div', {
            style: {
              flex: 1,
              overflow: 'auto',
              padding: '20px'
            }
          },
            // Initialize and render AIInteractionsComponent if available
            (window as any).AIInteractionsComponent ?
              React.createElement((window as any).AIInteractionsComponent) :
              React.createElement('div', {
                style: {
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '200px',
                  color: '#666',
                  fontSize: '16px'
                }
              },
                React.createElement('i', { 
                  className: 'fas fa-exclamation-triangle',
                  style: { marginRight: '10px', color: '#f39c12' } 
                }),
                'AI Interactions component not loaded'
              )
          )
        )
      )
    );
  };

  // =============================================================================
  // Initialize Plugin
  // =============================================================================
  
  try {
    console.log('AI Overhaul: Initializing plugin...');

    // Add CSS for spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    // Patch the MainNavBar.UtilityItems component to add our AI button
    PluginApi.patch.before("MainNavBar.UtilityItems", function (props: any) {
      const React = PluginApi.React;
      return [
        {
          children: React.createElement(React.Fragment, null,
            props.children,
            React.createElement(AIDropdown, null)
          )
        }
      ];
    });

    // Set up global tracking
    const trackingService = new TrackingService();

    // Set up page navigation tracking
    PluginApi.Event.addEventListener("stash:location", (e: any) => {
      trackingService.track('page_view', 'navigation', { 
        path: e.detail.data.location.pathname,
        search: e.detail.data.location.search 
      });
    });

    // Initialize AI Interactions Tracker
    if ((window as any).AIInteractionsTracker) {
      const tracker = (window as any).AIInteractionsTracker.getInstance({
        enableLocalStorage: true,
        enableServerTracking: true,
        serverBaseUrl: 'http://localhost:8080',
        maxLocalInteractions: 200,
        trackingInterval: 5000,
        debugMode: false,
        immediateServerSync: true  // Enable immediate database updates
      });
      console.log('AI Interactions Tracker initialized:', tracker.getStatus());
    }

    // Make AIInteractionsComponent available globally if loaded
    if ((window as any).AIInteractionsComponent) {
      console.log('AI Interactions Component available');
    }

    // Track plugin initialization
    trackingService.track('plugin_init', 'ai_overhaul', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      version: '2.0.0'
    });

    // Make debugging functions available globally
    (window as any).aiOverhaulDebug = {
      trackingService,
      
      testTracking: () => {
        trackingService.track('manual_test', 'console_test', {
          message: 'Manual test from console',
          timestamp: new Date().toISOString()
        });
        console.log('Test tracking event created');
      },
      
      getStats: () => {
        const stats = trackingService.getStats();
        console.table(stats);
        return stats;
      },
      
      exportData: () => {
        const blob = trackingService.exportInteractions();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ai_interactions_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        console.log('Data exported');
      }
    };

    console.log('AI Overhaul: Plugin initialized successfully');
    console.log('AI Overhaul: Debug functions available at window.aiOverhaulDebug');
    
  } catch (error) {
    console.error('AI Overhaul: Error during initialization:', error);
  }

})();