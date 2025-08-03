// =============================================================================
// AI Interactions Tracker - Modular tracking system with server integration
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

interface TrackerConfig {
  enableLocalStorage: boolean;
  enableServerTracking: boolean;
  serverBaseUrl: string;
  maxLocalInteractions: number;
  trackingInterval: number;
  debugMode: boolean;
  immediateServerSync: boolean; // New option for immediate vs batched sync
}

declare global {
  interface Window {
    AIInteractionsTracker?: AIInteractionsTracker;
    trackAIInteraction: (data: Partial<AIInteraction>) => void;
    PluginApi: any;
  }
}

/**
 * Enhanced AI Interactions Tracker with modular design
 * Combines localStorage persistence with StashAI Server integration
 */
export class AIInteractionsTracker {
  private static instance: AIInteractionsTracker;
  private sessionId: string;
  private isTracking: boolean = true;
  private serverConnected: boolean = false;
  private config: TrackerConfig;
  private observerActive: boolean = false;
  private mutationObserver?: MutationObserver;
  private navigationObserver?: PerformanceObserver;
  private interactionQueue: AIInteraction[] = [];
  private flushTimer?: NodeJS.Timeout;

  private constructor(config?: Partial<TrackerConfig>) {
    this.config = {
      enableLocalStorage: true,
      enableServerTracking: true,
      serverBaseUrl: 'http://localhost:8080',
      maxLocalInteractions: 200,
      trackingInterval: 5000,
      debugMode: false,
      immediateServerSync: true, // Default to immediate sync for real-time database updates
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.initializeTracking();
  }

  /**
   * Get singleton instance of the tracker
   */
  public static getInstance(config?: Partial<TrackerConfig>): AIInteractionsTracker {
    if (!AIInteractionsTracker.instance) {
      AIInteractionsTracker.instance = new AIInteractionsTracker(config);
    }
    return AIInteractionsTracker.instance;
  }

  /**
   * Initialize tracking system
   */
  private async initializeTracking(): Promise<void> {
    try {
      // Load tracking state
      const trackingEnabled = localStorage.getItem('ai_overhaul_tracking_enabled');
      this.isTracking = trackingEnabled !== 'false';

      // Set up session
      this.setupSession();

      // Check server connection
      if (this.config.enableServerTracking) {
        await this.checkServerConnection();
      }

      // Start observers
      this.startObservers();

      // Set up periodic flush
      this.setupPeriodicFlush();

      // Make tracking globally available
      this.exposeGlobalAPI();

      this.log('AI Interactions Tracker initialized', {
        sessionId: this.sessionId,
        serverConnected: this.serverConnected,
        trackingEnabled: this.isTracking
      });

    } catch (error) {
      console.error('Failed to initialize AI Interactions Tracker:', error);
    }
  }

  /**
   * Set up session management
   */
  private setupSession(): void {
    let existingSession = sessionStorage.getItem('ai_overhaul_session_id');
    if (!existingSession) {
      existingSession = this.sessionId;
      sessionStorage.setItem('ai_overhaul_session_id', existingSession);
    } else {
      this.sessionId = existingSession;
    }

    // Track session start
    this.trackInteraction({
      action_type: 'session_start',
      entity_type: 'plugin',
      entity_id: 'ai_overhaul',
      service: 'plugin',
      status: 'success',
      metadata: {
        user_agent: navigator.userAgent,
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        url: window.location.href
      }
    });
  }

  /**
   * Check StashAI Server connection
   */
  private async checkServerConnection(): Promise<void> {
    try {
      const response = await fetch(`${this.config.serverBaseUrl}/api/v1/health`, {
        method: 'GET',
        timeout: 5000
      });

      this.serverConnected = response.ok;
      
      if (this.serverConnected) {
        this.log('Connected to StashAI Server');
        // Send any queued interactions
        await this.flushQueue();
      } else {
        this.log('StashAI Server health check failed');
      }
    } catch (error) {
      this.serverConnected = false;
      this.log('Failed to connect to StashAI Server:', error);
    }
  }

  /**
   * Start DOM and navigation observers
   */
  private startObservers(): void {
    if (this.observerActive) return;

    try {
      // DOM Mutation Observer for dynamic content tracking
      this.mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node as Element;
                
                // Track AI-related elements being added
                if (element.classList.contains('ai-result') || 
                    element.classList.contains('ai-overlay') ||
                    element.querySelector('[data-ai-result]')) {
                  
                  this.trackInteraction({
                    action_type: 'ui_element_added',
                    entity_type: 'ui',
                    entity_id: element.id || 'dynamic',
                    service: 'plugin',
                    status: 'success',
                    metadata: {
                      element_type: element.tagName.toLowerCase(),
                      classes: Array.from(element.classList).join(' '),
                      has_ai_data: !!element.querySelector('[data-ai-result]')
                    }
                  });
                }
              }
            });
          }
        });
      });

      this.mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false
      });

      // Navigation Observer for performance tracking
      if ('PerformanceObserver' in window) {
        this.navigationObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'navigation') {
              this.trackInteraction({
                action_type: 'page_navigation',
                entity_type: 'page',
                entity_id: window.location.pathname,
                service: 'plugin',
                status: 'success',
                response_time: entry.duration,
                metadata: {
                  navigation_type: (entry as PerformanceNavigationTiming).type,
                  load_time: entry.loadEventEnd - entry.loadEventStart,
                  dom_content_loaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
                  url: window.location.href
                }
              });
            }
          });
        });

        this.navigationObserver.observe({ entryTypes: ['navigation'] });
      }

      this.observerActive = true;
      this.log('DOM and navigation observers started');

    } catch (error) {
      console.error('Failed to start observers:', error);
    }
  }

  /**
   * Set up periodic queue flush
   */
  private setupPeriodicFlush(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    this.flushTimer = setInterval(() => {
      if (this.interactionQueue.length > 0) {
        this.flushQueue();
      }
      
      // Periodic server connection check
      if (this.config.enableServerTracking && !this.serverConnected) {
        this.checkServerConnection();
      }
    }, this.config.trackingInterval);
  }

  /**
   * Track an AI interaction
   */
  public trackInteraction(data: Partial<AIInteraction>): void {
    if (!this.isTracking) return;

    const interaction: AIInteraction = {
      id: this.generateInteractionId(),
      timestamp: new Date().toISOString(),
      session_id: this.sessionId,
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
        viewport_height: window.innerHeight,
        session_id: this.sessionId,
        timestamp_local: Date.now()
      }
    };

    try {
      // Store locally if enabled
      if (this.config.enableLocalStorage) {
        this.storeLocally(interaction);
      }

      // Send to server based on configuration
      if (this.config.enableServerTracking) {
        if (this.config.immediateServerSync) {
          // Send immediately for real-time database updates
          this.sendToServer(interaction).catch(error => {
            // If immediate send fails, queue for retry
            this.interactionQueue.push(interaction);
            this.log('Failed immediate send, queued for retry:', error);
          });
        } else {
          // Queue for batch sending
          this.interactionQueue.push(interaction);
          
          // Immediate flush for high priority interactions
          if (data.action_type?.includes('error') || data.status === 'error') {
            this.flushQueue();
          }
        }
      }

      this.log('Tracked interaction:', interaction);

    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  }

  /**
   * Store interaction locally
   */
  private storeLocally(interaction: AIInteraction): void {
    try {
      const stored = localStorage.getItem('ai_overhaul_interactions');
      const allInteractions = stored ? JSON.parse(stored) : [];
      
      allInteractions.push(interaction);
      
      // Keep only latest interactions
      const trimmed = allInteractions
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, this.config.maxLocalInteractions);
      
      localStorage.setItem('ai_overhaul_interactions', JSON.stringify(trimmed));
      
    } catch (error) {
      console.error('Failed to store interaction locally:', error);
    }
  }

  /**
   * Flush interaction queue to server
   */
  private async flushQueue(): Promise<void> {
    if (!this.serverConnected || this.interactionQueue.length === 0) return;

    const toSend = [...this.interactionQueue];
    this.interactionQueue = [];

    try {
      for (const interaction of toSend) {
        await this.sendToServer(interaction);
      }
      
      this.log(`Flushed ${toSend.length} interactions to server`);
      
    } catch (error) {
      // Re-queue failed interactions
      this.interactionQueue.unshift(...toSend);
      console.error('Failed to flush interactions to server:', error);
    }
  }

  /**
   * Send single interaction to StashAI Server
   */
  private async sendToServer(interaction: AIInteraction): Promise<void> {
    try {
      const response = await fetch(`${this.config.serverBaseUrl}/api/v1/interactions/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interaction_type: 'plugin_action',
          user_id: this.sessionId,
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
            performers_found: interaction.performers_found,
            entity_title: interaction.entity_title,
            entity_filepath: interaction.entity_filepath
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

    } catch (error) {
      // Server tracking failures are non-critical
      this.log('Failed to send interaction to server:', error);
      throw error;
    }
  }

  /**
   * Get local interactions
   */
  public getLocalInteractions(): AIInteraction[] {
    try {
      const stored = localStorage.getItem('ai_overhaul_interactions');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get local interactions:', error);
      return [];
    }
  }

  /**
   * Clear local interactions
   */
  public clearLocalInteractions(): void {
    localStorage.removeItem('ai_overhaul_interactions');
    this.log('Cleared local interactions');
  }

  /**
   * Export interactions
   */
  public exportInteractions(): any {
    const exportData = {
      metadata: {
        exported_at: new Date().toISOString(),
        session_id: this.sessionId,
        plugin_version: '2.0.0',
        server_connected: this.serverConnected,
        tracker_config: this.config
      },
      local_interactions: this.getLocalInteractions(),
      queued_interactions: this.interactionQueue
    };

    return exportData;
  }

  /**
   * Toggle tracking on/off
   */
  public toggleTracking(): boolean {
    this.isTracking = !this.isTracking;
    localStorage.setItem('ai_overhaul_tracking_enabled', this.isTracking.toString());
    
    this.log(`Tracking ${this.isTracking ? 'enabled' : 'disabled'}`);
    return this.isTracking;
  }

  /**
   * Get tracker status
   */
  public getStatus(): any {
    return {
      isTracking: this.isTracking,
      serverConnected: this.serverConnected,
      sessionId: this.sessionId,
      localInteractions: this.getLocalInteractions().length,
      queuedInteractions: this.interactionQueue.length,
      config: this.config
    };
  }

  /**
   * Expose global API
   */
  private exposeGlobalAPI(): void {
    window.AIInteractionsTracker = this;
    window.trackAIInteraction = (data: Partial<AIInteraction>) => {
      this.trackInteraction(data);
    };
  }

  /**
   * Cleanup and destroy tracker
   */
  public destroy(): void {
    // Stop observers
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }
    if (this.navigationObserver) {
      this.navigationObserver.disconnect();
    }

    // Clear timers
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }

    // Flush any remaining interactions
    if (this.interactionQueue.length > 0) {
      this.flushQueue();
    }

    // Clean up global references
    delete window.AIInteractionsTracker;
    delete window.trackAIInteraction;

    this.observerActive = false;
    this.log('AI Interactions Tracker destroyed');
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  private generateSessionId(): string {
    return 'plugin_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateInteractionId(): string {
    return 'int_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
  }

  private log(message: string, data?: any): void {
    if (this.config.debugMode) {
      console.log(`[AIInteractionsTracker] ${message}`, data);
    }
  }
}

// =============================================================================
// React Hook for easy integration
// =============================================================================

export const useAIInteractionsTracker = (config?: Partial<TrackerConfig>) => {
  const React = (window as any).PluginApi.React;
  const [tracker, setTracker] = React.useState<AIInteractionsTracker | null>(null);
  const [status, setStatus] = React.useState<any>(null);

  React.useEffect(() => {
    const trackerInstance = AIInteractionsTracker.getInstance(config);
    setTracker(trackerInstance);
    setStatus(trackerInstance.getStatus());

    // Set up status updates
    const statusInterval = setInterval(() => {
      setStatus(trackerInstance.getStatus());
    }, 5000);

    return () => {
      clearInterval(statusInterval);
    };
  }, []);

  const trackInteraction = React.useCallback((data: Partial<AIInteraction>) => {
    if (tracker) {
      tracker.trackInteraction(data);
    }
  }, [tracker]);

  const toggleTracking = React.useCallback(() => {
    if (tracker) {
      const newState = tracker.toggleTracking();
      setStatus(tracker.getStatus());
      return newState;
    }
    return false;
  }, [tracker]);

  const exportInteractions = React.useCallback(() => {
    if (tracker) {
      return tracker.exportInteractions();
    }
    return null;
  }, [tracker]);

  const clearInteractions = React.useCallback(() => {
    if (tracker) {
      tracker.clearLocalInteractions();
      setStatus(tracker.getStatus());
    }
  }, [tracker]);

  return {
    tracker,
    status,
    trackInteraction,
    toggleTracking,
    exportInteractions,
    clearInteractions,
    isTracking: status?.isTracking || false,
    serverConnected: status?.serverConnected || false,
    sessionId: status?.sessionId || ''
  };
};

export default AIInteractionsTracker;

// Make AIInteractionsTracker available globally for browser use
declare global {
  interface Window {
    AIInteractionsTracker?: AIInteractionsTracker;
  }
}

if (typeof window !== 'undefined') {
  // Initialize tracker instance if it doesn't exist
  if (!window.AIInteractionsTracker) {
    window.AIInteractionsTracker = AIInteractionsTracker.getInstance();
    console.log('AIInteractionsTracker initialized and made available globally');
  }
}