// =============================================================================
// StashAI Plugin - Interaction Sync Service
// =============================================================================

(function() {
  const PluginApi = (window as any).PluginApi;
  
  if (!PluginApi) {
    console.error('InteractionSyncService: PluginApi not available');
    return;
  }

  // =============================================================================
  // Interface Definitions
  // =============================================================================

  interface SyncSettings {
    enableServerSync: boolean;
    serverSyncUrl: string;
    syncInterval: number; // minutes
    maxBatchSize: number;
    maxRetries: number;
    fallbackToLocal: boolean;
  }

  interface InteractionData {
    type: string;
    timestamp: string;
    page: string;
    element?: string;
    data?: any;
    sessionId: string;
  }

  interface SyncStatus {
    lastSync: string | null;
    pendingCount: number;
    failedCount: number;
    serverHealthy: boolean;
    totalSynced: number;
  }

  // =============================================================================
  // Interaction Sync Service
  // =============================================================================

  class InteractionSyncService {
    private settings: SyncSettings;
    private syncQueue: InteractionData[] = [];
    private failedQueue: InteractionData[] = [];
    private syncInProgress = false;
    private syncInterval: NodeJS.Timeout | null = null;
    private lastSyncAttempt: string | null = null;
    private totalSynced = 0;

    constructor() {
      this.settings = this.loadSyncSettings();
      this.startAutoSync();
      
      // Listen for settings changes
      if ((window as any).addStashAISettingsChangeListener) {
        (window as any).addStashAISettingsChangeListener(() => {
          this.settings = this.loadSyncSettings();
          this.restartAutoSync();
        });
      }
    }

    private loadSyncSettings(): SyncSettings {
      const aiSettings = JSON.parse(localStorage.getItem('stash_ai_settings') || '{}');
      const syncSettings = JSON.parse(localStorage.getItem('stash_ai_sync_settings') || '{}');
      
      return {
        enableServerSync: syncSettings.enableServerSync ?? true,
        serverSyncUrl: aiSettings.serverUrl || (window as any).stashAIEndpoint?.()?.url || '/stash-ai',
        syncInterval: syncSettings.syncInterval ?? 5, // 5 minutes default
        maxBatchSize: syncSettings.maxBatchSize ?? 50,
        maxRetries: syncSettings.maxRetries ?? 3,
        fallbackToLocal: syncSettings.fallbackToLocal ?? true
      };
    }

    private saveSyncSettings(settings: Partial<SyncSettings>) {
      const currentSettings = JSON.parse(localStorage.getItem('stash_ai_sync_settings') || '{}');
      const newSettings = { ...currentSettings, ...settings };
      localStorage.setItem('stash_ai_sync_settings', JSON.stringify(newSettings));
      this.settings = { ...this.settings, ...settings };
    }

    // =============================================================================
    // Public API Methods
    // =============================================================================

    public async queueInteraction(interaction: InteractionData): Promise<void> {
      // Always store locally first
      this.storeInteractionLocally(interaction);
      
      if (this.settings.enableServerSync) {
        // Add to sync queue for server sync
        this.syncQueue.push(interaction);
        
        // If it's an AI processing interaction, try to sync immediately
        if (interaction.type === 'ai_processing') {
          this.syncSingle(interaction);
        }
      }
    }

    public async forcSync(): Promise<SyncStatus> {
      if (this.syncInProgress) {
        throw new Error('Sync already in progress');
      }

      return await this.performSync();
    }

    public getSyncStatus(): SyncStatus {
      return {
        lastSync: this.lastSyncAttempt,
        pendingCount: this.syncQueue.length,
        failedCount: this.failedQueue.length,
        serverHealthy: this.isServerHealthy(),
        totalSynced: this.totalSynced
      };
    }

    public updateSyncSettings(settings: Partial<SyncSettings>) {
      this.saveSyncSettings(settings);
      this.restartAutoSync();
    }

    // =============================================================================
    // Sync Implementation
    // =============================================================================

    private async performSync(): Promise<SyncStatus> {
      if (!this.settings.enableServerSync) {
        return this.getSyncStatus();
      }

      this.syncInProgress = true;
      this.lastSyncAttempt = new Date().toISOString();

      try {
        // Check server health first
        const serverHealthy = await this.checkServerHealth();
        
        if (!serverHealthy) {
          console.warn('StashAI Server is not healthy, skipping sync');
          return this.getSyncStatus();
        }

        // Batch sync pending interactions
        const itemsToSync = [...this.failedQueue, ...this.syncQueue].slice(0, this.settings.maxBatchSize);
        
        if (itemsToSync.length === 0) {
          return this.getSyncStatus();
        }

        console.log(`Syncing ${itemsToSync.length} interactions to StashAI Server`);

        const success = await this.syncBatch(itemsToSync);
        
        if (success) {
          // Remove successfully synced items
          this.removeFromQueues(itemsToSync);
          this.totalSynced += itemsToSync.length;
          console.log(`Successfully synced ${itemsToSync.length} interactions`);
        } else {
          // Move sync queue items to failed queue
          this.failedQueue.push(...this.syncQueue.splice(0, itemsToSync.length));
        }

      } catch (error) {
        console.error('Sync failed:', error);
        // Move items to failed queue
        this.failedQueue.push(...this.syncQueue.splice(0, this.settings.maxBatchSize));
      } finally {
        this.syncInProgress = false;
      }

      return this.getSyncStatus();
    }

    private async syncBatch(interactions: InteractionData[]): Promise<boolean> {
      try {
        const endpoint = (window as any).stashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/interactions/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...endpoint.headers
          },
          body: JSON.stringify(interactions)
        });

        if (response.ok) {
          const result = await response.json();
          console.log(`Sync result: ${result.synced_count} synced, ${result.failed_count} failed`);
          return result.synced_count > 0;
        } else {
          console.error(`Sync failed with status: ${response.status} ${response.statusText}`);
          return false;
        }

      } catch (error) {
        console.error('Sync request failed:', error);
        return false;
      }
    }

    private async syncSingle(interaction: InteractionData): Promise<boolean> {
      try {
        const endpoint = (window as any).stashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/interactions/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...endpoint.headers
          },
          body: JSON.stringify(interaction)
        });

        if (response.ok) {
          const result = await response.json();
          console.log('Real-time interaction tracked:', result.message);
          
          // Remove from sync queue since it was sent immediately
          const index = this.syncQueue.findIndex(item => 
            item.timestamp === interaction.timestamp && item.sessionId === interaction.sessionId
          );
          if (index >= 0) {
            this.syncQueue.splice(index, 1);
          }
          
          this.totalSynced++;
          return true;
        } else {
          console.warn(`Failed to track interaction immediately: ${response.status}`);
          return false;
        }

      } catch (error) {
        console.warn('Failed to track interaction immediately:', error);
        return false;
      }
    }

    private async checkServerHealth(): Promise<boolean> {
      try {
        const endpoint = (window as any).stashAIEndpoint();
        const response = await fetch(`${endpoint.url}/api/v1/interactions/status`, {
          method: 'GET',
          headers: endpoint.headers
        });

        if (response.ok) {
          const status = await response.json();
          return status.database_healthy && status.sync_enabled;
        }
        
        return false;
      } catch (error) {
        console.warn('Server health check failed:', error);
        return false;
      }
    }

    private isServerHealthy(): boolean {
      // This is a simple check - in a more robust implementation,
      // we might cache the last health check result
      return true; // Optimistic default
    }

    // =============================================================================
    // Local Storage Management
    // =============================================================================

    private storeInteractionLocally(interaction: InteractionData): void {
      try {
        const interactions = JSON.parse(localStorage.getItem('stash_ai_interactions') || '[]');
        interactions.push(interaction);
        
        // Keep only the last 1000 interactions locally
        if (interactions.length > 1000) {
          interactions.splice(0, interactions.length - 1000);
        }
        
        localStorage.setItem('stash_ai_interactions', JSON.stringify(interactions));
      } catch (error) {
        console.error('Failed to store interaction locally:', error);
      }
    }

    private removeFromQueues(itemsToRemove: InteractionData[]): void {
      const itemIds = itemsToRemove.map(item => `${item.timestamp}_${item.sessionId}`);
      
      this.syncQueue = this.syncQueue.filter(item => 
        !itemIds.includes(`${item.timestamp}_${item.sessionId}`)
      );
      
      this.failedQueue = this.failedQueue.filter(item => 
        !itemIds.includes(`${item.timestamp}_${item.sessionId}`)
      );
    }

    // =============================================================================
    // Auto Sync Management
    // =============================================================================

    private startAutoSync(): void {
      if (this.settings.enableServerSync && this.settings.syncInterval > 0) {
        this.syncInterval = setInterval(() => {
          this.performSync().catch(error => {
            console.error('Auto-sync failed:', error);
          });
        }, this.settings.syncInterval * 60 * 1000); // Convert minutes to milliseconds
      }
    }

    private stopAutoSync(): void {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    }

    private restartAutoSync(): void {
      this.stopAutoSync();
      this.startAutoSync();
    }

    // =============================================================================
    // Cleanup and Management
    // =============================================================================

    public async exportLocalInteractions(): Promise<InteractionData[]> {
      return JSON.parse(localStorage.getItem('stash_ai_interactions') || '[]');
    }

    public async importInteractions(interactions: InteractionData[]): Promise<void> {
      // Add to sync queue for server sync
      if (this.settings.enableServerSync) {
        this.syncQueue.push(...interactions);
      }
      
      // Store locally as backup
      interactions.forEach(interaction => this.storeInteractionLocally(interaction));
    }

    public clearLocalInteractions(): void {
      localStorage.removeItem('stash_ai_interactions');
      this.syncQueue = [];
      this.failedQueue = [];
    }

    public destroy(): void {
      this.stopAutoSync();
    }
  }

  // =============================================================================
  // Global Service Instance
  // =============================================================================

  // Create global instance
  const syncService = new InteractionSyncService();

  // Expose service globally for other components
  (window as any).stashAIInteractionSync = syncService;

  // Enhanced interaction tracking function that uses the sync service
  (window as any).trackStashAIInteraction = async (interaction: InteractionData) => {
    try {
      await syncService.queueInteraction(interaction);
    } catch (error) {
      console.error('Failed to track interaction:', error);
    }
  };

  console.log('StashAI Interaction Sync Service initialized');

})();