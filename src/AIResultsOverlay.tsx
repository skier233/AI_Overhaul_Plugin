interface IPluginApi {
  React: typeof React;
  GQL: any;
  Event: {
    addEventListener: (event: string, callback: (e: CustomEvent) => void) => void;
  };
  libraries: {
    ReactRouterDOM: {
      Link: React.FC<any>;
      Route: React.FC<any>;
      NavLink: React.FC<any>;
    },
    Bootstrap: {
      Button: React.FC<any>;
      Modal: React.FC<any>;
      Card: React.FC<any>;
      Badge: React.FC<any>;
      Row: React.FC<any>;
      Col: React.FC<any>;
      Alert: React.FC<any>;
    },
    FontAwesomeSolid: {
      faBrain: any;
      faEye: any;
      faUsers: any;
      faTimes: any;
      faExpand: any;
      faCompress: any;
      faCode: any;
      faTag: any;
      faImage: any;
    },
    Intl: {
      FormattedMessage: React.FC<any>;
    }
  },
  loadableComponents: any;
  components: Record<string, React.FC<any>>;
  utils: {
    NavUtils: any;
    loadComponents: any;
  },
  hooks: any;
  patch: {
    before: (target: string, fn: Function) => void;
    instead: (target: string, fn: Function) => void;
    after: (target: string, fn: Function) => void;
  },
  register: {
    route: (path: string, component: React.FC<any>) => void;
  }
}

(function () {
  const PluginApi = (window as any).PluginApi as IPluginApi;
  const React = PluginApi.React;
  const { Modal, Button, Card, Badge, Row, Col, Alert } = PluginApi.libraries.Bootstrap;

  // Types for facial recognition results
  interface DetectedPerformer {
    id: string;
    name: string;
    confidence: number;
    distance: number;
    image: string;
    performer_url: string;
    faceIndex?: number;
  }

  interface FaceDetectionResult {
    success: boolean;
    performers: DetectedPerformer[];
    isMultiDetection: boolean;
    error?: string;
    rawResponse?: any;
  }

  // Utility functions
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'warning';
    return 'danger';
  };

  const formatConfidence = (performer: DetectedPerformer): string => {
    if (performer.confidence > 0) {
      return `${performer.confidence.toFixed(1)}%`;
    } else if (performer.distance !== undefined) {
      const confidence = Math.max(0, 100 - (performer.distance * 2));
      return `${confidence.toFixed(1)}%`;
    }
    return 'N/A';
  };

  const getCalculatedConfidence = (performer: DetectedPerformer): number => {
    return performer.confidence > 0 ? performer.confidence : 
      Math.max(0, 100 - (performer.distance * 2));
  };

  const groupPerformersByFace = (performers: DetectedPerformer[]): { [key: number]: DetectedPerformer[] } => {
    const grouped: { [key: number]: DetectedPerformer[] } = {};
    
    performers.forEach(performer => {
      const faceIndex = performer.faceIndex || 1;
      if (!grouped[faceIndex]) {
        grouped[faceIndex] = [];
      }
      grouped[faceIndex].push(performer);
    });

    return grouped;
  };

  const parseMultiFaceData = (results?: FaceDetectionResult, rawResponse?: any): DetectedPerformer[] => {
    // Handle StashAI Server response format
    if (rawResponse && rawResponse.performers && Array.isArray(rawResponse.performers)) {
      const performers = rawResponse.performers.map((performer: any, index: number) => ({
        id: performer.id,
        name: performer.name,
        confidence: performer.confidence * 100, // Convert from 0-1 to 0-100
        distance: performer.additional_info?.distance || 0,
        image: performer.image_url,
        performer_url: performer.stash_url,
        faceIndex: index + 1 // Assign sequential face indices
      }));
      
      // Apply confidence filtering - only keep highest confidence match per face
      if (rawResponse.faces && rawResponse.faces.length > 1) {
        console.log(`Multi-face detection: ${rawResponse.faces.length} faces detected, ${performers.length} performers identified (before filtering)`);
        
        // Group performers by face and keep only highest confidence per face
        const faceGroups: { [faceIndex: number]: DetectedPerformer[] } = {};
        performers.forEach((performer: DetectedPerformer) => {
          const faceIndex = performer.faceIndex || 1;
          if (!faceGroups[faceIndex]) {
            faceGroups[faceIndex] = [];
          }
          faceGroups[faceIndex].push(performer);
        });
        
        // Filter to highest confidence per face and remove duplicates
        const filteredPerformers: DetectedPerformer[] = [];
        const seenPerformerIds = new Set<string>();
        
        Object.values(faceGroups).forEach(facePerformers => {
          // Sort by confidence descending and take the top match
          const sortedByConfidence = facePerformers.sort((a, b) => b.confidence - a.confidence);
          const topMatch = sortedByConfidence[0];
          
          // Only add if we haven't seen this performer ID before
          if (topMatch && !seenPerformerIds.has(topMatch.id)) {
            filteredPerformers.push(topMatch);
            seenPerformerIds.add(topMatch.id);
          }
        });
        
        console.log(`Confidence filtering applied: ${filteredPerformers.length} performers after filtering`);
        return filteredPerformers;
      }
      
      return performers;
    }
    
    // Check if we have raw response data with multi-face structure (legacy format)
    if (results?.rawResponse?.data && Array.isArray(results.rawResponse.data) && results.rawResponse.data.length > 0) {
      const allPerformers: DetectedPerformer[] = [];
      const faceResults = results.rawResponse.data[0];
      
      if (Array.isArray(faceResults)) {
        faceResults.forEach((faceData: any, faceIndex: number) => {
          if (faceData && faceData.performers && Array.isArray(faceData.performers)) {
            faceData.performers.forEach((performer: any) => {
              allPerformers.push({
                ...performer,
                faceIndex: faceIndex + 1,
                confidence: performer.confidence || 0
              });
            });
          }
        });
      }
      
      return allPerformers;
    }
    
    return results?.performers || [];
  };

  interface AIResultsOverlayProps {
    show: boolean;
    onHide: () => void;
    title: string;
    sourceImage?: string;
    results?: FaceDetectionResult;
    rawResponse?: any;
    actionType?: 'single' | 'multi';
    imageData?: any;
    onPerformerAction?: (performer: DetectedPerformer, action: string) => void;
  }

  const AIResultsOverlay: React.FC<AIResultsOverlayProps> = ({
    show,
    onHide,
    title,
    sourceImage,
    results,
    rawResponse,
    actionType = 'single',
    imageData,
    onPerformerAction
  }) => {
    const [expandedImage, setExpandedImage] = React.useState(false);
    const [showRawData, setShowRawData] = React.useState(false);

    const handlePerformerAction = (performer: DetectedPerformer, action: string) => {
      if (onPerformerAction) {
        onPerformerAction(performer, action);
      }
    };

    const renderPerformerCard = (performer: DetectedPerformer, index: number | string) => {
      const confidence = getCalculatedConfidence(performer);

      return React.createElement(Card, {
        key: `performer-${index}`,
        style: { marginBottom: '15px' }
      },
        React.createElement(Row, { className: 'g-0' },
          React.createElement(Col, { md: 4 },
            React.createElement('div', {
              style: {
                height: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8f9fa',
                borderRadius: '4px'
              }
            },
              performer.image ? React.createElement('img', {
                src: performer.image,
                alt: performer.name,
                style: {
                  maxWidth: '100%',
                  maxHeight: '100%',
                  borderRadius: '4px'
                },
                onError: (e: any) => {
                  e.target.style.display = 'none';
                }
              }) : React.createElement('div', {
                style: {
                  textAlign: 'center',
                  color: '#6c757d'
                }
              }, '👤')
            )
          ),
          React.createElement(Col, { md: 8 },
            React.createElement('div', { style: { padding: '15px' } },
              React.createElement('div', {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'start',
                  marginBottom: '10px'
                }
              },
                React.createElement('div', null,
                  React.createElement('h6', { style: { margin: 0 } }, performer.name),
                  performer.faceIndex && actionType === 'multi' && React.createElement(Badge, {
                    variant: 'info',
                    style: { marginLeft: '8px' }
                  }, `Face #${performer.faceIndex}`)
                ),
                React.createElement(Badge, {
                  variant: getConfidenceColor(confidence)
                }, formatConfidence(performer))
              ),
              performer.distance !== undefined && React.createElement('div', {
                style: { marginBottom: '10px' }
              },
                React.createElement('small', {
                  style: { color: '#6c757d' }
                }, `Distance: ${performer.distance.toFixed(2)}`)
              ),
              React.createElement('div', {
                style: { display: 'flex', gap: '8px', flexWrap: 'wrap' }
              },
                React.createElement(Button, {
                  size: 'sm',
                  variant: 'primary',
                  onClick: () => handlePerformerAction(performer, 'tag_image')
                }, '🏷️ Tag Image'),
                React.createElement(Button, {
                  size: 'sm',
                  variant: 'outline-secondary',
                  onClick: () => handlePerformerAction(performer, 'view')
                }, '👁️ View Details')
              )
            )
          )
        )
      );
    };

    const renderResults = () => {
      const performers = parseMultiFaceData(results, rawResponse);
      
      if (!results && !rawResponse) {
        return React.createElement(Alert, { variant: 'info' },
          React.createElement('span', null,
            React.createElement('i', { className: 'fas fa-brain', style: { marginRight: '8px' } }),
            'No results to display'
          )
        );
      }

      if (results && !results.success) {
        return React.createElement(Alert, { variant: 'danger' },
          `❌ Error: ${results.error || 'Unknown error occurred'}`
        );
      }

      if (performers.length === 0) {
        return React.createElement(Alert, { variant: 'warning' },
          '👁️ No performers detected in the image'
        );
      }

      // Multi-face detection grouping
      if (results?.isMultiDetection || actionType === 'multi' || results?.rawResponse?.data) {
        const groupedPerformers = groupPerformersByFace(performers);
        
        return React.createElement('div', null,
          React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              marginBottom: '15px'
            }
          },
            React.createElement('span', { style: { marginRight: '8px' } }, '👥'),
            React.createElement('h6', { style: { margin: 0 } }, 'Multi-Face Detection Results'),
            React.createElement(Badge, {
              variant: 'info',
              style: { marginLeft: '8px' }
            }, `${Object.keys(groupedPerformers).length} face(s) detected`)
          ),
          Object.entries(groupedPerformers).map(([faceIndex, performers]) =>
            React.createElement('div', {
              key: `face-${faceIndex}`,
              style: {
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                marginBottom: '15px'
              }
            },
              React.createElement('div', {
                style: {
                  padding: '10px 15px',
                  backgroundColor: '#f8f9fa',
                  borderBottom: '1px solid #dee2e6',
                  display: 'flex',
                  alignItems: 'center'
                }
              },
                React.createElement('span', { style: { marginRight: '8px' } }, '👁️'),
                `Face #${faceIndex}`,
                React.createElement(Badge, {
                  variant: 'secondary',
                  style: { marginLeft: '8px' }
                }, `${performers.length} match(es)`)
              ),
              React.createElement('div', { style: { padding: '15px' } },
                performers.map((performer, perfIndex) => 
                  renderPerformerCard(performer, `${faceIndex}-${perfIndex}`)
                )
              )
            )
          )
        );
      }

      // Single face detection
      return React.createElement('div', null,
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '15px'
          }
        },
          React.createElement('span', { style: { marginRight: '8px' } }, '👁️'),
          React.createElement('h6', { style: { margin: 0 } }, 'Single Face Detection Results'),
          React.createElement(Badge, {
            variant: 'info',
            style: { marginLeft: '8px' }
          }, `${performers.length} match(es) found`)
        ),
        performers.map((performer, index) => 
          renderPerformerCard(performer, index)
        )
      );
    };

    return React.createElement(Modal, {
      show,
      onHide,
      size: 'xl',
      backdrop: 'static',
      keyboard: false
    },
      React.createElement('div', { 
        style: { 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: '15px 20px',
          borderBottom: '1px solid #dee2e6'
        } 
      },
        React.createElement('h4', {
          style: { display: 'flex', alignItems: 'center', margin: 0 }
        },
          React.createElement('span', { style: { marginRight: '8px' } }, '🖼️'),
          title
        ),
        React.createElement(Button, {
          variant: 'outline-secondary',
          size: 'sm',
          onClick: onHide
        }, '✕')
      ),
      React.createElement('div', { style: { padding: '20px' } },
        React.createElement(Row, null,
          // Source Image Column
          React.createElement(Col, { md: expandedImage ? 12 : 4 },
            React.createElement('div', {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px'
              }
            },
              React.createElement('h6', null, 'Source Image'),
              React.createElement(Button, {
                size: 'sm',
                variant: 'outline-secondary',
                onClick: () => setExpandedImage(!expandedImage)
              }, expandedImage ? '🗜️' : '🔍')
            ),
            sourceImage ? React.createElement('div', null,
              React.createElement('img', {
                src: sourceImage,
                alt: 'Source',
                style: {
                  width: '100%',
                  height: 'auto',
                  borderRadius: '4px'
                }
              })
            ) : React.createElement('div', {
              style: {
                textAlign: 'center',
                padding: '40px',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                color: '#6c757d'
              }
            },
              React.createElement('div', { style: { fontSize: '48px', marginBottom: '10px' } }, '👁️'),
              React.createElement('p', null, 'No source image available')
            )
          ),
          // Results Column
          !expandedImage && React.createElement(Col, { md: 8 },
            React.createElement('div', {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px'
              }
            },
              React.createElement('h6', null, 'Detection Results'),
              React.createElement(Button, {
                size: 'sm',
                variant: 'outline-secondary',
                onClick: () => setShowRawData(!showRawData)
              }, `💻 ${showRawData ? 'Hide' : 'Show'} Raw Data`)
            ),
            React.createElement('div', { style: { maxHeight: '400px', overflowY: 'auto' } },
              renderResults()
            ),
            showRawData && React.createElement('div', { style: { marginTop: '20px' } },
              React.createElement('h6', null, 'Raw API Response'),
              React.createElement('pre', {
                style: {
                  backgroundColor: '#2d3748',
                  color: '#e2e8f0',
                  padding: '15px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto'
                }
              }, JSON.stringify(rawResponse || results, null, 2))
            )
          )
        )
      ),
      React.createElement('div', { 
        style: { 
          padding: '15px 20px', 
          borderTop: '1px solid #dee2e6',
          backgroundColor: '#f8f9fa'
        } 
      },
        React.createElement('div', {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            width: '100%'
          }
        },
          React.createElement('div', null,
            (() => {
              const performers = parseMultiFaceData(results, rawResponse);
              if (performers.length > 0) {
                return React.createElement('small', { style: { color: '#6c757d' } },
                  `${performers.length} performer(s) detected`,
                  (results?.isMultiDetection || actionType === 'multi' || results?.rawResponse?.data) && 
                    ` across ${Object.keys(groupPerformersByFace(performers)).length} face(s)`
                );
              }
              return null;
            })()
          ),
          React.createElement(Button, {
            variant: 'secondary',
            onClick: onHide
          }, 'Close')
        )
      )
    );
  };

  // Make the component available globally
  (window as any).AIResultsOverlay = AIResultsOverlay;

  // Global function to show the overlay with proper state management
  (window as any).showAIResultsOverlay = (overlayData: any) => {
    console.log('showAIResultsOverlay called with data:', overlayData);
    
    // Create a container element if it doesn't exist
    let overlayContainer = document.getElementById('ai-results-overlay-container');
    if (!overlayContainer) {
      overlayContainer = document.createElement('div');
      overlayContainer.id = 'ai-results-overlay-container';
      document.body.appendChild(overlayContainer);
    }

    // State management for the overlay
    let overlayState = {
      show: true,
      title: overlayData.title || 'AI Results',
      sourceImage: overlayData.sourceImage,
      results: overlayData.results,
      rawResponse: overlayData.rawResponse,
      actionType: overlayData.actionType || 'single',
      imageData: overlayData.imageData,
      galleryData: overlayData.galleryData,
      galleryResults: overlayData.galleryResults
    };

    const handleHide = () => {
      overlayState.show = false;
      renderOverlay();
    };

    const handlePerformerAction = (performer: any, action: string) => {
      console.log('Performer action:', action, performer);
      if (action === 'view' && performer.performer_url) {
        window.open(performer.performer_url, '_blank');
      } else if (action === 'tag_image') {
        // Handle tagging action - could integrate with Stash's tagging system
        console.log('Tag image action for performer:', performer.name);
      }
    };

    const renderOverlay = () => {
      if (!overlayState.show) {
        // Clean up the container when hiding
        if (overlayContainer && overlayContainer.parentNode) {
          overlayContainer.parentNode.removeChild(overlayContainer);
        }
        return;
      }

      // Handle gallery results format
      let processedResults = overlayState.results;
      let processedRawResponse = overlayState.rawResponse;
      
      if (overlayState.galleryResults) {
        // Convert gallery results to standard format
        processedResults = {
          success: true,
          performers: overlayState.galleryResults.performers || [],
          isMultiDetection: false
        };
        processedRawResponse = overlayState.rawResponse;
      }

      const overlayElement = React.createElement(AIResultsOverlay, {
        show: overlayState.show,
        onHide: handleHide,
        title: overlayState.title,
        sourceImage: overlayState.sourceImage,
        results: processedResults,
        rawResponse: processedRawResponse,
        actionType: overlayState.actionType,
        imageData: overlayState.imageData || overlayState.galleryData,
        onPerformerAction: handlePerformerAction
      });

      // Use ReactDOM to render the overlay
      if ((window as any).ReactDOM) {
        (window as any).ReactDOM.render(overlayElement, overlayContainer);
      } else {
        console.error('ReactDOM not available for overlay rendering');
      }
    };

    // Initial render
    renderOverlay();
  };

})();