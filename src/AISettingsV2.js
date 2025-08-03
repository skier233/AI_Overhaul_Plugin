// =============================================================================
// AI Settings Page V2 - Card-based layout matching Stash design
// =============================================================================

(function () {
    const PluginApi = window.PluginApi;
    const React = PluginApi.React;
    const { Link } = PluginApi.libraries.ReactRouterDOM;
    const { Button, Card, Row, Col, Nav, Tab, Form, Badge } = PluginApi.libraries.Bootstrap;

    // AI Settings Page Component with card-based layout
    const AISettingsPage = () => {
        const [activeTab, setActiveTab] = React.useState('overview');
        const [syncMode, setSyncMode] = React.useState('immediate');
        const [batchInterval, setBatchInterval] = React.useState(5);
        const [settings, setSettings] = React.useState({
            serverUrl: 'http://localhost:8080',
            apiKey: '',
            enableTracking: true,
            debugMode: false,
            useRelativeUrl: true
        });
        const [jobsData, setJobsData] = React.useState({
            jobs: [],
            loading: false,
            error: null,
            stats: {
                totalJobs: 0,
                completedJobs: 0,
                failedJobs: 0,
                avgProcessingTime: 0
            }
        });
        const [connectionStatus, setConnectionStatus] = React.useState({
            connected: false,
            status: 'unknown',
            message: 'Not tested',
            testing: false
        });
        const [interactionsData, setInteractionsData] = React.useState({
            interactions: [],
            loading: false,
            error: null,
            stats: {
                totalInteractions: 0,
                todayInteractions: 0,
                avgDuration: 0,
                successRate: 0
            }
        });
        const [showOverlay, setShowOverlay] = React.useState(false);
        const [overlayData, setOverlayData] = React.useState(null);

        // Load settings from localStorage on mount
        React.useEffect(() => {
            const saved = localStorage.getItem('stash_ai_settings');
            if (saved) {
                try {
                    const savedSettings = JSON.parse(saved);
                    setSettings(prev => ({
                        ...prev,
                        serverUrl: savedSettings.serverUrl || 'http://localhost:8080',
                        apiKey: savedSettings.apiKey || '',
                        useRelativeUrl: savedSettings.useRelativeUrl ?? true
                    }));
                } catch (e) {
                    console.warn('Failed to load settings:', e);
                }
            }

            // Load sync settings from AIInteractionsTracker
            if (window.AIInteractionsTracker) {
                const tracker = window.AIInteractionsTracker;
                const trackerStatus = tracker.getStatus();
                setSyncMode(trackerStatus.config?.immediateServerSync ? 'immediate' : 'batch');
                setBatchInterval(trackerStatus.config?.trackingInterval / 1000 || 5);
            }
        }, []);

        const handleSettingChange = (key, value) => {
            setSettings(prev => {
                const newSettings = { ...prev, [key]: value };
                
                // Save to localStorage
                localStorage.setItem('stash_ai_settings', JSON.stringify(newSettings));
                
                // Notify other components of settings change
                if (window.notifyStashAISettingsChange) {
                    window.notifyStashAISettingsChange();
                }
                
                return newSettings;
            });
        };

        const testConnection = async () => {
            setConnectionStatus(prev => ({ ...prev, testing: true, message: 'Testing connection...' }));
            
            try {
                // Use the same endpoint logic as V1
                const endpoint = window.stashAIEndpoint();
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
                    setConnectionStatus({
                        connected: true,
                        status: data.status || 'healthy',
                        message: `Connected to ${data.service_name || 'StashAI Server'} v${data.version || 'unknown'}`,
                        testing: false
                    });
                } else {
                    setConnectionStatus({
                        connected: false,
                        status: 'error',
                        message: `Server responded with ${response.status}`,
                        testing: false
                    });
                }
            } catch (error) {
                setConnectionStatus({
                    connected: false,
                    status: 'error',
                    message: error.message || 'Connection failed',
                    testing: false
                });
            }
        };

        const fetchJobsHistory = async () => {
            setJobsData(prev => ({ ...prev, loading: true, error: null }));
            
            try {
                const endpoint = window.stashAIEndpoint();
                const response = await fetch(`${endpoint.url}/api/v1/ai-jobs/history`, {
                    method: 'GET',
                    headers: endpoint.headers
                });

                if (response.ok) {
                    const data = await response.json();
                    
                    // Calculate stats from the jobs array
                    const jobs = data.jobs || [];
                    const completedJobs = jobs.filter(job => job.status === 'completed').length;
                    const failedJobs = jobs.filter(job => job.status === 'failed').length;
                    const avgProcessingTime = jobs.length > 0 
                        ? jobs.reduce((sum, job) => sum + (job.processing_time_seconds || 0), 0) / jobs.length 
                        : 0;

                    setJobsData({
                        jobs: jobs,
                        loading: false,
                        error: null,
                        stats: {
                            totalJobs: data.total_count || jobs.length,
                            completedJobs,
                            failedJobs,
                            avgProcessingTime: Math.round(avgProcessingTime * 100) / 100
                        }
                    });
                } else {
                    setJobsData(prev => ({ 
                        ...prev, 
                        loading: false, 
                        error: `Failed to fetch jobs: ${response.status}` 
                    }));
                }
            } catch (error) {
                setJobsData(prev => ({ 
                    ...prev, 
                    loading: false, 
                    error: error.message || 'Failed to fetch jobs history' 
                }));
            }
        };

        const viewJobResults = async (job) => {
            console.log('Viewing job results for:', job);
            
            // Try to recreate the results overlay using the saved job data
            if (job.results_json && typeof job.results_json === 'object') {
                // Fetch the source image URL
                const sourceImageUrl = await fetchImageUrl(job.entity_type, job.entity_id);
                
                // Extract the raw Visage API response from results_json for proper overlay recreation
                let overlayDataToShow;
                
                if (job.entity_type === 'gallery' && job.results_json.ai_model_info?.gallery_results) {
                    // Gallery job - use gallery_results format
                    overlayDataToShow = {
                        title: `Gallery Analysis: ${job.entity_name || 'Gallery'}`,
                        galleryData: {
                            id: job.entity_id,
                            title: job.entity_name,
                            url: sourceImageUrl
                        },
                        galleryResults: job.results_json.ai_model_info.gallery_results,
                        rawResponse: job.results_json,
                        actionType: 'gallery'
                    };
                } else {
                    // Image/Scene job - use regular results format with proper entity data
                    const entityData = {
                        id: job.entity_id,
                        title: job.entity_name,
                        url: sourceImageUrl
                    };
                    
                    overlayDataToShow = {
                        title: `AI Results: ${job.entity_name || job.entity_id}`,
                        sourceImage: sourceImageUrl, // Now properly fetched
                        results: job.results_json,
                        rawResponse: job.results_json,
                        actionType: job.results_json.isMultiDetection ? 'multi' : 'single'
                    };
                    
                    // Set the correct entity data based on entity type
                    if (job.entity_type === 'image') {
                        overlayDataToShow.imageData = entityData;
                    } else if (job.entity_type === 'scene') {
                        overlayDataToShow.sceneData = entityData;
                    } else {
                        // Default to imageData for backward compatibility
                        overlayDataToShow.imageData = entityData;
                    }
                }
                
                console.log('Setting overlay data with source image:', overlayDataToShow);
                setOverlayData(overlayDataToShow);
                setShowOverlay(true);
            } else {
                // Debug mode - show what data is available
                const debugInfo = `Job Debug Info:
        
Job ID: ${job.job_id}
Entity: ${job.entity_name || job.entity_id} (${job.entity_type})
Status: ${job.status}
Tests: ${job.tests_completed}/${job.total_tests_planned} (${job.tests_passed} passed)
Results JSON: ${job.results_json ? 'Available' : 'Not available'}
Performers Found: ${job.performers_found_total || 0}
Processing Time: ${job.processing_time_seconds || 'Unknown'}s

${job.results_json ? `Results: ${JSON.stringify(job.results_json, null, 2)}` : 'No results_json field - job may not have saved results properly'}`;
                
                alert(debugInfo);
            }
        };

        const formatDuration = (seconds) => {
            if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
            if (seconds < 60) return `${seconds.toFixed(1)}s`;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return `${minutes}m ${remainingSeconds}s`;
        };

        const formatTimestamp = (timestamp) => {
            const date = new Date(timestamp);
            const now = new Date();
            const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
            
            if (diffInHours < 1) {
                const minutes = Math.round(diffInHours * 60);
                return `${minutes} min${minutes === 1 ? '' : 's'} ago`;
            } else if (diffInHours < 24) {
                const hours = Math.round(diffInHours);
                return `${hours} hour${hours === 1 ? '' : 's'} ago`;
            } else {
                const days = Math.round(diffInHours / 24);
                return `${days} day${days === 1 ? '' : 's'} ago`;
            }
        };

        const fetchInteractionsData = async () => {
            setInteractionsData(prev => ({ ...prev, loading: true, error: null }));
            
            try {
                let interactions = [];
                
                // Debug: Check what's available
                console.log('Checking for interactions data sources:');
                console.log('- window.AIInteractionsTracker:', !!window.AIInteractionsTracker);
                console.log('- localStorage ai_overhaul_interactions:', !!localStorage.getItem('ai_overhaul_interactions'));
                
                // Get local interactions from tracker
                if (window.AIInteractionsTracker) {
                    console.log('Getting interactions from tracker...');
                    const localInteractions = window.AIInteractionsTracker.getLocalInteractions();
                    console.log('Tracker returned interactions:', localInteractions.length);
                    interactions = localInteractions;
                } else {
                    // Fallback: Try to get directly from localStorage
                    console.log('Tracker not available, checking localStorage directly...');
                    const stored = localStorage.getItem('ai_overhaul_interactions');
                    if (stored) {
                        try {
                            const parsed = JSON.parse(stored);
                            console.log('Found interactions in localStorage:', parsed.length);
                            interactions = Array.isArray(parsed) ? parsed : [];
                        } catch (e) {
                            console.error('Error parsing stored interactions:', e);
                        }
                    }
                }
                
                console.log('Total interactions found:', interactions.length);
                
                // Calculate statistics
                const now = new Date();
                const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                const todayInteractions = interactions.filter(interaction => 
                    new Date(interaction.timestamp) >= todayStart
                ).length;
                
                const successfulInteractions = interactions.filter(interaction => 
                    interaction.status === 'success' || interaction.status === 'completed'
                ).length;
                
                const successRate = interactions.length > 0 ? 
                    Math.round((successfulInteractions / interactions.length) * 100) : 0;
                
                // Calculate average duration (if available)
                const interactionsWithDuration = interactions.filter(interaction => interaction.duration);
                const avgDuration = interactionsWithDuration.length > 0 ?
                    interactionsWithDuration.reduce((sum, interaction) => sum + parseFloat(interaction.duration || 0), 0) / interactionsWithDuration.length : 0;
                
                // Sort interactions by timestamp (newest first)
                const sortedInteractions = interactions.sort((a, b) => 
                    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                
                setInteractionsData({
                    interactions: sortedInteractions.slice(0, 100), // Limit to last 100 interactions
                    loading: false,
                    error: null,
                    stats: {
                        totalInteractions: interactions.length,
                        todayInteractions,
                        avgDuration: Math.round(avgDuration * 100) / 100,
                        successRate
                    }
                });
                
            } catch (error) {
                setInteractionsData(prev => ({
                    ...prev,
                    loading: false,
                    error: error.message || 'Failed to fetch interactions data'
                }));
            }
        };

        const clearInteractions = () => {
            if (confirm('Are you sure you want to clear all interactions? This cannot be undone.')) {
                // Clear local storage
                localStorage.removeItem('ai_overhaul_interactions');
                if (window.AIInteractionsTracker) {
                    window.AIInteractionsTracker.clearLocalInteractions();
                }
                // Refresh the data
                fetchInteractionsData();
            }
        };

        const createTestInteraction = () => {
            // Create a test interaction to verify the display works
            const testInteraction = {
                id: 'test_' + Date.now(),
                timestamp: new Date().toISOString(),
                session_id: 'test_session_123',
                action_type: 'test_action',
                entity_type: 'image',
                entity_id: '123',
                entity_title: 'Test Image',
                service: 'plugin',
                status: 'success',
                response_time: 1.5,
                metadata: {
                    test: true,
                    user_agent: navigator.userAgent
                }
            };

            // Store directly to localStorage for testing
            const stored = localStorage.getItem('ai_overhaul_interactions');
            const interactions = stored ? JSON.parse(stored) : [];
            interactions.push(testInteraction);
            localStorage.setItem('ai_overhaul_interactions', JSON.stringify(interactions));
            
            console.log('Created test interaction:', testInteraction);
            
            // Refresh the display
            fetchInteractionsData();
        };

        const exportInteractions = () => {
            if (interactionsData.interactions.length === 0) {
                alert('No interactions to export');
                return;
            }
            
            const dataStr = JSON.stringify(interactionsData.interactions, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `ai-interactions-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        const handlePerformerAction = (performer, action) => {
            console.log('Performer action:', action, performer);
            switch (action) {
                case 'view':
                    if (performer.performer_url) {
                        window.open(performer.performer_url, '_blank');
                    }
                    break;
                case 'tag_image':
                    // Extract entity information from overlay data
                    let entityType, entityId;
                    
                    if (overlayData.imageData) {
                        entityType = 'image';
                        entityId = overlayData.imageData.id;
                    } else if (overlayData.galleryData) {
                        entityType = 'gallery';
                        entityId = overlayData.galleryData.id;
                    } else if (overlayData.sceneData) {
                        entityType = 'scene';
                        entityId = overlayData.sceneData.id;
                    } else {
                        console.error('No entity data found in overlay for tagging');
                        alert('Error: Cannot determine entity type for tagging');
                        return;
                    }
                    
                    // Use centralized function from AIResultsOverlay
                    if (window.AIOverlay?.tagEntityWithPerformer) {
                        window.AIOverlay.tagEntityWithPerformer(entityType, entityId, performer);
                    } else {
                        console.error('AIOverlay utilities not available');
                        alert('AI Overlay utilities not loaded. Please refresh the page.');
                    }
                    break;
                default:
                    console.log('Unknown performer action:', action);
            }
        };

        const fetchImageUrl = async (entityType, entityId) => {
            // Use centralized function from AIResultsOverlay
            if (window.AIOverlay?.fetchImageUrl) {
                return await window.AIOverlay.fetchImageUrl(entityType, entityId);
            } else {
                console.error('AIOverlay utilities not available - falling back to null');
                return null;
            }
        };


        // Load jobs when switching to jobs tab
        React.useEffect(() => {
            if (activeTab === 'jobs' && jobsData.jobs.length === 0 && !jobsData.loading) {
                fetchJobsHistory();
            }
        }, [activeTab]);

        // Load interactions when switching to interactions tab
        React.useEffect(() => {
            if (activeTab === 'interactions' && interactionsData.interactions.length === 0 && !interactionsData.loading) {
                console.log('Interactions tab activated, fetching data...');
                fetchInteractionsData();
            }
        }, [activeTab]);

        // Try to initialize the tracker if it's not available
        React.useEffect(() => {
            if (!window.AIInteractionsTracker && typeof require !== 'undefined') {
                try {
                    // Try to load the tracker
                    console.log('Attempting to initialize AIInteractionsTracker...');
                    // This might help if the tracker wasn't loaded yet
                    setTimeout(() => {
                        if (window.AIInteractionsTracker) {
                            console.log('Tracker became available after delay');
                        } else {
                            console.log('Tracker still not available, using localStorage fallback');
                        }
                    }, 1000);
                } catch (e) {
                    console.error('Error initializing tracker:', e);
                }
            }
        }, []);

        return React.createElement("div", { className: "container-fluid" },
            React.createElement("div", { className: "row" },
                React.createElement("div", { className: "col-md-12" },
                    React.createElement("h1", { className: "mb-4" }, "AI Overhaul Settings"),
                    
                    // Tab Navigation
                    React.createElement(Tab.Container, { activeKey: activeTab, onSelect: (k) => setActiveTab(k || 'overview') },
                        React.createElement(Nav, { variant: "tabs", className: "mb-4" },
                            React.createElement(Nav.Item, null,
                                React.createElement(Nav.Link, { eventKey: "overview" }, "Overview")
                            ),
                            React.createElement(Nav.Item, null,
                                React.createElement(Nav.Link, { eventKey: "jobs" }, "AI Jobs History")
                            ),
                            React.createElement(Nav.Item, null,
                                React.createElement(Nav.Link, { eventKey: "interactions" }, "All Interactions")
                            )
                        ),
                        
                        React.createElement(Tab.Content, null,
                            // Overview Tab
                            React.createElement(Tab.Pane, { eventKey: "overview" },
                                React.createElement(Row, null,
                                    React.createElement(Col, { md: 6 },
                                        // Endpoint Details Card
                                        React.createElement(Card, { className: "mb-4" },
                                            React.createElement(Card.Header, null,
                                                React.createElement("h5", { className: "mb-0" }, "Endpoint Details")
                                            ),
                                            React.createElement(Card.Body, null,
                                                React.createElement(Form.Group, { className: "mb-3" },
                                                    React.createElement(Form.Check, {
                                                        type: "checkbox",
                                                        label: "Use Relative URL (proxy mode)",
                                                        checked: settings.useRelativeUrl,
                                                        onChange: (e) => handleSettingChange('useRelativeUrl', e.target.checked),
                                                        className: "mb-2"
                                                    })
                                                ),
                                                !settings.useRelativeUrl && React.createElement(Form.Group, { className: "mb-3" },
                                                    React.createElement(Form.Label, null, "Server URL"),
                                                    React.createElement(Form.Control, {
                                                        type: "url",
                                                        value: settings.serverUrl,
                                                        onChange: (e) => handleSettingChange('serverUrl', e.target.value),
                                                        placeholder: "http://localhost:8080"
                                                    })
                                                ),
                                                React.createElement(Form.Group, { className: "mb-3" },
                                                    React.createElement(Form.Label, null, "API Key (Optional)"),
                                                    React.createElement(Form.Control, {
                                                        type: "password",
                                                        value: settings.apiKey,
                                                        onChange: (e) => handleSettingChange('apiKey', e.target.value),
                                                        placeholder: "Leave empty if not required"
                                                    })
                                                ),
                                                React.createElement("div", { className: "d-flex justify-content-between align-items-center" },
                                                    React.createElement("div", null,
                                                        React.createElement(Badge, {
                                                            variant: connectionStatus.connected ? "success" : connectionStatus.status === 'error' ? "danger" : "secondary"
                                                        }, connectionStatus.connected ? "Connected" : connectionStatus.status === 'error' ? "Disconnected" : "Unknown"),
                                                        React.createElement("small", { className: "ms-2 text-muted" }, connectionStatus.message)
                                                    ),
                                                    React.createElement(Button, {
                                                        variant: "outline-primary",
                                                        size: "sm",
                                                        onClick: testConnection,
                                                        disabled: connectionStatus.testing
                                                    }, connectionStatus.testing ? "Testing..." : "Test Connection")
                                                )
                                            )
                                        )
                                    ),
                                    
                                    React.createElement(Col, { md: 6 },
                                        // Database Sync Settings Card
                                        React.createElement(Card, { className: "mb-4" },
                                            React.createElement(Card.Header, null,
                                                React.createElement("h5", { className: "mb-0" }, "Database Sync Settings")
                                            ),
                                            React.createElement(Card.Body, null,
                                                React.createElement(Form.Group, { className: "mb-3" },
                                                    React.createElement(Form.Label, null, "Sync Mode"),
                                                    React.createElement("div", null,
                                                        React.createElement(Form.Check, {
                                                            type: "radio",
                                                            name: "syncMode",
                                                            id: "immediate",
                                                            label: "Immediate Sync",
                                                            checked: syncMode === 'immediate',
                                                            onChange: () => setSyncMode('immediate'),
                                                            className: "mb-2"
                                                        }),
                                                        React.createElement(Form.Check, {
                                                            type: "radio",
                                                            name: "syncMode",
                                                            id: "batch",
                                                            label: "Batch Sync",
                                                            checked: syncMode === 'batch',
                                                            onChange: () => setSyncMode('batch')
                                                        })
                                                    )
                                                ),
                                                
                                                syncMode === 'batch' && React.createElement(Form.Group, { className: "mb-3" },
                                                    React.createElement(Form.Label, null, `Batch Interval: ${batchInterval} seconds`),
                                                    React.createElement("input", {
                                                        type: "range",
                                                        className: "form-range",
                                                        min: 1,
                                                        max: 60,
                                                        value: batchInterval,
                                                        onChange: (e) => setBatchInterval(parseInt(e.target.value))
                                                    }),
                                                    React.createElement("small", { className: "form-text text-muted" },
                                                        `Sync interactions every ${batchInterval} seconds`
                                                    )
                                                ),
                                                
                                                React.createElement(Form.Group, null,
                                                    React.createElement(Form.Check, {
                                                        type: "checkbox",
                                                        label: "Enable Interaction Tracking",
                                                        checked: settings.enableTracking,
                                                        onChange: (e) => handleSettingChange('enableTracking', e.target.checked)
                                                    })
                                                )
                                            )
                                        )
                                    )
                                ),
                                
                                React.createElement(Row, null,
                                    React.createElement(Col, { md: 12 },
                                        // Quick Stats Card
                                        React.createElement(Card, { className: "mb-4" },
                                            React.createElement(Card.Header, null,
                                                React.createElement("h5", { className: "mb-0" }, "Quick Statistics")
                                            ),
                                            React.createElement(Card.Body, null,
                                                React.createElement(Row, null,
                                                    React.createElement(Col, { md: 3, className: "text-center" },
                                                        React.createElement("h3", { className: "text-primary" }, "142"),
                                                        React.createElement("small", null, "Total Jobs")
                                                    ),
                                                    React.createElement(Col, { md: 3, className: "text-center" },
                                                        React.createElement("h3", { className: "text-success" }, "1,247"),
                                                        React.createElement("small", null, "Interactions")
                                                    ),
                                                    React.createElement(Col, { md: 3, className: "text-center" },
                                                        React.createElement("h3", { className: "text-info" }, "3.2s"),
                                                        React.createElement("small", null, "Avg Response Time")
                                                    ),
                                                    React.createElement(Col, { md: 3, className: "text-center" },
                                                        React.createElement("h3", { className: "text-warning" }, "89%"),
                                                        React.createElement("small", null, "Success Rate")
                                                    )
                                                )
                                            )
                                        )
                                    )
                                )
                            ),
                            
                            // AI Jobs History Tab
                            React.createElement(Tab.Pane, { eventKey: "jobs" },
                                React.createElement(Card, null,
                                    React.createElement(Card.Header, null,
                                        React.createElement("div", { className: "d-flex justify-content-between align-items-center" },
                                            React.createElement("h5", { className: "mb-0" }, "AI Jobs History"),
                                            React.createElement("div", null,
                                                React.createElement(Button, {
                                                    variant: "outline-primary",
                                                    size: "sm",
                                                    className: "me-2",
                                                    onClick: fetchJobsHistory,
                                                    disabled: jobsData.loading
                                                }, jobsData.loading ? "Loading..." : "Refresh"),
                                                React.createElement("small", { className: "text-muted" },
                                                    `${jobsData.stats.totalJobs} total, ${jobsData.stats.completedJobs} completed, ${jobsData.stats.failedJobs} failed`
                                                )
                                            )
                                        )
                                    ),
                                    React.createElement(Card.Body, null,
                                        jobsData.error && React.createElement("div", { className: "alert alert-danger", role: "alert" },
                                            jobsData.error
                                        ),
                                        
                                        jobsData.loading ? React.createElement("div", { className: "text-center py-4" },
                                            React.createElement("div", { className: "spinner-border text-primary", role: "status" },
                                                React.createElement("span", { className: "visually-hidden" }, "Loading...")
                                            ),
                                            React.createElement("p", { className: "mt-2" }, "Loading jobs history...")
                                        ) : jobsData.jobs.length === 0 ? React.createElement("div", { className: "text-center py-4 text-muted" },
                                            React.createElement("p", null, "No jobs found"),
                                            React.createElement(Button, { variant: "outline-primary", onClick: fetchJobsHistory },
                                                "Load Jobs History"
                                            )
                                        ) : React.createElement("div", { className: "table-responsive" },
                                            React.createElement("table", { className: "table table-sm table-hover" },
                                                React.createElement("thead", null,
                                                    React.createElement("tr", null,
                                                        React.createElement("th", null, "Job ID"),
                                                        React.createElement("th", null, "Type"),
                                                        React.createElement("th", null, "Entity"),
                                                        React.createElement("th", null, "Status"),
                                                        React.createElement("th", null, "Tests"),
                                                        React.createElement("th", null, "Duration"),
                                                        React.createElement("th", null, "Completed"),
                                                        React.createElement("th", null, "Actions")
                                                    )
                                                ),
                                                React.createElement("tbody", null,
                                                    jobsData.jobs.map(job => React.createElement("tr", { key: job.job_id },
                                                        React.createElement("td", null,
                                                            React.createElement("code", { className: "small" }, `${job.job_id.substring(0, 8)}...`)
                                                        ),
                                                        React.createElement("td", null,
                                                            React.createElement(Badge, {
                                                                variant: job.entity_type === 'gallery' ? 'info' : 
                                                                        job.entity_type === 'scene' ? 'primary' : 
                                                                        job.entity_type === 'image' ? 'secondary' : 'dark'
                                                            }, job.entity_type)
                                                        ),
                                                        React.createElement("td", { 
                                                            className: "text-truncate", 
                                                            style: { maxWidth: '200px' }, 
                                                            title: job.entity_name || job.entity_id 
                                                        }, job.entity_name || job.entity_id),
                                                        React.createElement("td", null,
                                                            React.createElement(Badge, {
                                                                variant: job.status === 'completed' ? 'success' :
                                                                        job.status === 'failed' ? 'danger' :
                                                                        job.status === 'processing' ? 'warning' :
                                                                        job.status === 'cancelled' ? 'secondary' : 'primary'
                                                            }, job.status)
                                                        ),
                                                        React.createElement("td", null,
                                                            React.createElement("span", { className: "small" },
                                                                `${job.tests_completed || 0}/${job.total_tests_planned || 0}`,
                                                                job.tests_passed !== undefined && React.createElement("span", { className: "text-success ms-1" },
                                                                    `(${job.tests_passed} ✓)`
                                                                )
                                                            )
                                                        ),
                                                        React.createElement("td", { className: "small" },
                                                            job.processing_time_seconds ? formatDuration(job.processing_time_seconds) : '-'
                                                        ),
                                                        React.createElement("td", { className: "small" },
                                                            job.completed_at ? formatTimestamp(job.completed_at) : 
                                                            job.started_at ? `Started ${formatTimestamp(job.started_at)}` : '-'
                                                        ),
                                                        React.createElement("td", null,
                                                            job.status === 'completed' ? React.createElement("div", { className: "d-flex gap-1" },
                                                                React.createElement(Button, {
                                                                    variant: "outline-success",
                                                                    size: "sm",
                                                                    onClick: () => viewJobResults(job),
                                                                    title: "View results (debug mode if no results_json)"
                                                                }, "View"),
                                                                React.createElement(Button, {
                                                                    variant: "outline-secondary",
                                                                    size: "sm",
                                                                    onClick: () => console.log('Job Debug:', job),
                                                                    title: "Debug job data"
                                                                }, "🐛")
                                                            ) : job.status === 'failed' && job.error_message ? React.createElement(Button, {
                                                                variant: "outline-danger",
                                                                size: "sm",
                                                                onClick: () => alert(`Error: ${job.error_message || 'Unknown error'}`),
                                                                title: "View error details"
                                                            }, "Error") : React.createElement("span", { className: "text-muted small" }, "-")
                                                        )
                                                    ))
                                                )
                                            )
                                        ),
                                        
                                        React.createElement("div", { className: "mt-3 d-flex justify-content-between" },
                                            React.createElement("div", null,
                                                React.createElement("small", { className: "text-muted" },
                                                    `Showing ${jobsData.jobs.length} of ${jobsData.stats.totalJobs} jobs`,
                                                    jobsData.stats.avgProcessingTime > 0 && React.createElement("span", null,
                                                        ` • Avg processing time: ${formatDuration(jobsData.stats.avgProcessingTime)}`
                                                    )
                                                )
                                            ),
                                            React.createElement("div", null,
                                                React.createElement(Button, { variant: "outline-secondary", size: "sm", className: "me-2" }, "Export CSV"),
                                                React.createElement(Button, { variant: "outline-danger", size: "sm" }, "Clear History")
                                            )
                                        )
                                    )
                                )
                            ),
                            
                            // All Interactions Tab
                            React.createElement(Tab.Pane, { eventKey: "interactions" },
                                React.createElement(Card, null,
                                    React.createElement(Card.Header, null,
                                        React.createElement("div", { className: "d-flex justify-content-between align-items-center" },
                                            React.createElement("h5", { className: "mb-0" }, "All Interactions"),
                                            React.createElement("div", null,
                                                React.createElement(Button, {
                                                    variant: "outline-primary",
                                                    size: "sm",
                                                    className: "me-2",
                                                    onClick: fetchInteractionsData,
                                                    disabled: interactionsData.loading
                                                }, interactionsData.loading ? "Loading..." : "Refresh"),
                                                React.createElement(Button, {
                                                    variant: "outline-success",
                                                    size: "sm",
                                                    className: "me-2",
                                                    onClick: createTestInteraction
                                                }, "Create Test"),
                                                React.createElement("small", { className: "text-muted" },
                                                    `${interactionsData.stats.totalInteractions} total, ${interactionsData.stats.todayInteractions} today`
                                                )
                                            )
                                        )
                                    ),
                                    React.createElement(Card.Body, null,
                                        interactionsData.error && React.createElement("div", { className: "alert alert-danger", role: "alert" },
                                            interactionsData.error
                                        ),
                                        
                                        interactionsData.loading ? React.createElement("div", { className: "text-center py-4" },
                                            React.createElement("div", { className: "spinner-border text-primary", role: "status" },
                                                React.createElement("span", { className: "visually-hidden" }, "Loading...")
                                            ),
                                            React.createElement("p", { className: "mt-2" }, "Loading interactions...")
                                        ) : interactionsData.interactions.length === 0 ? React.createElement("div", { className: "text-center py-4 text-muted" },
                                            React.createElement("p", null, "No interactions found"),
                                            React.createElement(Button, { variant: "outline-primary", onClick: fetchInteractionsData },
                                                "Load Interactions"
                                            )
                                        ) : React.createElement("div", { className: "table-responsive" },
                                            React.createElement("table", { className: "table table-sm table-hover" },
                                                React.createElement("thead", null,
                                                    React.createElement("tr", null,
                                                        React.createElement("th", null, "Timestamp"),
                                                        React.createElement("th", null, "Action"),
                                                        React.createElement("th", null, "Entity Type"),
                                                        React.createElement("th", null, "Entity ID"),
                                                        React.createElement("th", null, "Service"),
                                                        React.createElement("th", null, "Status"),
                                                        React.createElement("th", null, "Duration"),
                                                        React.createElement("th", null, "Session")
                                                    )
                                                ),
                                                React.createElement("tbody", null,
                                                    interactionsData.interactions.map((interaction, index) => React.createElement("tr", { key: `${interaction.timestamp}-${index}` },
                                                        React.createElement("td", { className: "small" },
                                                            new Date(interaction.timestamp).toLocaleTimeString()
                                                        ),
                                                        React.createElement("td", null,
                                                            React.createElement("code", { className: "small" }, 
                                                                interaction.action_type || interaction.action || 'unknown'
                                                            )
                                                        ),
                                                        React.createElement("td", null,
                                                            React.createElement(Badge, {
                                                                variant: (interaction.entity_type || interaction.entityType) === 'gallery' ? 'info' : 
                                                                        (interaction.entity_type || interaction.entityType) === 'scene' ? 'primary' : 
                                                                        (interaction.entity_type || interaction.entityType) === 'image' ? 'secondary' : 'dark'
                                                            }, interaction.entity_type || interaction.entityType || 'unknown')
                                                        ),
                                                        React.createElement("td", { 
                                                            className: "text-truncate", 
                                                            style: { maxWidth: '150px' }, 
                                                            title: interaction.entity_id || interaction.entityId
                                                        }, interaction.entity_id || interaction.entityId || '-'),
                                                        React.createElement("td", null,
                                                            React.createElement("small", null, interaction.service || 'plugin')
                                                        ),
                                                        React.createElement("td", null,
                                                            React.createElement(Badge, {
                                                                variant: interaction.status === 'success' || interaction.status === 'completed' ? 'success' :
                                                                        interaction.status === 'error' || interaction.status === 'failed' ? 'danger' :
                                                                        interaction.status === 'pending' || interaction.status === 'processing' ? 'warning' : 'secondary'
                                                            }, interaction.status || 'unknown')
                                                        ),
                                                        React.createElement("td", { className: "small" },
                                                            interaction.response_time ? `${parseFloat(interaction.response_time).toFixed(2)}s` : 
                                                            interaction.duration ? `${parseFloat(interaction.duration).toFixed(2)}s` : '-'
                                                        ),
                                                        React.createElement("td", { className: "small" },
                                                            (interaction.session_id || interaction.sessionId) ? React.createElement("code", { className: "small" }, 
                                                                (interaction.session_id || interaction.sessionId).substring(0, 8) + '...'
                                                            ) : '-'
                                                        )
                                                    ))
                                                )
                                            )
                                        ),
                                        
                                        React.createElement("div", { className: "mt-3 d-flex justify-content-between" },
                                            React.createElement("div", null,
                                                React.createElement("small", { className: "text-muted" },
                                                    `Showing ${interactionsData.interactions.length} of ${interactionsData.stats.totalInteractions} interactions`,
                                                    interactionsData.stats.avgDuration > 0 && React.createElement("span", null,
                                                        ` • Avg duration: ${interactionsData.stats.avgDuration}s`
                                                    ),
                                                    React.createElement("span", null,
                                                        ` • Success rate: ${interactionsData.stats.successRate}%`
                                                    )
                                                )
                                            ),
                                            React.createElement("div", null,
                                                React.createElement(Button, { 
                                                    variant: "outline-secondary", 
                                                    size: "sm", 
                                                    className: "me-2",
                                                    onClick: exportInteractions,
                                                    disabled: interactionsData.interactions.length === 0
                                                }, "Export Interactions"),
                                                React.createElement(Button, { 
                                                    variant: "outline-danger", 
                                                    size: "sm",
                                                    onClick: clearInteractions,
                                                    disabled: interactionsData.interactions.length === 0
                                                }, "Clear Interactions")
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            ),
            
            // AI Results Overlay - same pattern as queue viewer
            showOverlay && overlayData && (
                // Render gallery overlay for gallery results
                overlayData.actionType === 'gallery' && window.AIResultsOverlayGalleries ?
                    React.createElement(window.AIResultsOverlayGalleries, {
                        show: showOverlay,
                        onHide: () => setShowOverlay(false),
                        title: overlayData.title,
                        galleryData: overlayData.galleryData,
                        galleryResults: overlayData.galleryResults,
                        rawResponse: overlayData.rawResponse,
                        onPerformerAction: handlePerformerAction
                    }) :
                    // Render scene overlay for scene results (reuse gallery overlay)
                    overlayData.actionType === 'scene' && window.AIResultsOverlayGalleries ?
                        React.createElement(window.AIResultsOverlayGalleries, {
                            show: showOverlay,
                            onHide: () => setShowOverlay(false),
                            title: overlayData.title,
                            galleryData: overlayData.sceneData || overlayData.galleryData,
                            galleryResults: overlayData.sceneResults || overlayData.galleryResults,
                            rawResponse: overlayData.rawResponse,
                            onPerformerAction: handlePerformerAction
                        }) :
                        // Render standard image overlay for image results
                        window.AIResultsOverlay && React.createElement(window.AIResultsOverlay, {
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
            )
        );
    };

    // Register the AI Settings page route
    PluginApi.register.route("/plugin/ai-settings", AISettingsPage);

    // Add AI Settings button to Stash Settings Tools section
    PluginApi.patch.before("SettingsToolsSection", function (props) {
        const { Setting } = PluginApi.components;

        return [
            {
                children: React.createElement(React.Fragment, null,
                    props.children,
                    React.createElement(Setting, {
                        heading: React.createElement(Link, { to: "/plugin/ai-settings" },
                            React.createElement(Button, null, "AI Overhaul Settings")
                        )
                    })
                )
            }
        ];
    });
})();