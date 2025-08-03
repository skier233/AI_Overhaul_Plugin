// Use the global PluginApi interface instead of redefining it

(function () {
  const PluginApi = (window as any).PluginApi;
  const React = PluginApi.React;
  const { Modal, Button, Card, Badge, Row, Col, Alert } = PluginApi.libraries.Bootstrap;

  // Types for gallery processing results
  interface DetectedPerformer {
    id: string;
    name: string;
    confidence: number;
    distance: number;
    image: string;
    image_url?: string;
    performer_url: string;
    stash_url?: string;
    faceIndex?: number;
    additional_info?: any;
  }

  interface ImageProcessingResult {
    imageId: string;
    imageUrl: string;
    success: boolean;
    performers: DetectedPerformer[];
    error?: string;
    processingTime?: number;
  }

  interface PerformerFrequency {
    performer: DetectedPerformer;
    frequency: number;
    appearances: {
      imageId: string;
      imageUrl: string;
      confidence: number;
    }[];
    averageConfidence: number;
    bestConfidence: number;
  }

  interface GalleryProcessingResult {
    success: boolean;
    galleryId: string;
    totalImages: number;
    processedImages: number;
    skippedImages: number;
    performers: PerformerFrequency[];
    processingResults: ImageProcessingResult[];
    error?: string;
    totalProcessingTime?: number;
  }

  interface AIResultsOverlayGalleriesProps {
    show: boolean;
    onHide: () => void;
    title: string;
    galleryData?: any;
    galleryResults?: GalleryProcessingResult;
    rawResponse?: any;
    onPerformerAction?: (performer: PerformerFrequency, action: string) => void;
  }

  // GraphQL mutation functions - using direct fetch to Stash GraphQL endpoint
  const makeGraphQLRequest = async (query: string, variables: any) => {
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables
        })
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.errors) {
        throw new Error(`GraphQL errors: ${result.errors.map((e: any) => e.message).join(', ')}`);
      }

      return result;
    } catch (error) {
      console.error('GraphQL request failed:', error);
      throw error;
    }
  };

  const galleryUpdateMutation = async (variables: any) => {
    const query = `
      mutation GalleryUpdate($input: GalleryUpdateInput!) {
        galleryUpdate(input: $input) {
          id
          title
          performers {
            id
            name
          }
        }
      }
    `;
    return makeGraphQLRequest(query, variables);
  };

  const bulkImageUpdateMutation = async (variables: any) => {
    const query = `
      mutation BulkImageUpdate($input: BulkImageUpdateInput!) {
        bulkImageUpdate(input: $input) {
          id
          performers {
            id
            name
          }
        }
      }
    `;
    return makeGraphQLRequest(query, variables);
  };

  // Toast notification function
  const showToast = (message: string, variant: 'success' | 'danger' | 'warning' | 'info' = 'info') => {
    try {
      // Try to use PluginApi toast if available
      if ((PluginApi as any).util && (PluginApi as any).util.showToast) {
        (PluginApi as any).util.showToast({ message, variant });
      } else {
        // Fallback to browser alert
        console.log(`Toast [${variant}]: ${message}`);
        // Try to show as a temporary overlay in the top right
        const toast = document.createElement('div');
        toast.style.cssText = `
          position: fixed;
          top: 20px;
          right: 20px;
          background: ${variant === 'success' ? '#28a745' : variant === 'danger' ? '#dc3545' : variant === 'warning' ? '#ffc107' : '#17a2b8'};
          color: white;
          padding: 12px 20px;
          border-radius: 4px;
          z-index: 9999;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        // Remove after 5 seconds
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 5000);
      }
    } catch (error) {
      console.error('Failed to show toast:', error);
      alert(message); // Ultimate fallback
    }
  };

  // Utility functions
  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 80) return 'success';
    if (confidence >= 60) return 'warning';
    return 'danger';
  };

  const formatProcessingTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  const AIResultsOverlayGalleries: React.FC<AIResultsOverlayGalleriesProps> = ({
    show,
    onHide,
    title,
    galleryData,
    galleryResults,
    rawResponse,
    onPerformerAction
  }) => {
    // Debug logging
    React.useEffect(() => {
      if (show && galleryResults) {
        console.log('🖼️ Gallery Results Data:', galleryResults);
        console.log('🎭 Performers:', galleryResults.performers);
        if (galleryResults.performers && galleryResults.performers.length > 0) {
          console.log('🎯 First Performer:', galleryResults.performers[0]);
          console.log('📊 First Performer Confidence:', galleryResults.performers[0].averageConfidence);
          console.log('🖼️ First Performer Appearances:', galleryResults.performers[0].appearances?.slice(0, 3));
        }
      }
    }, [show, galleryResults]);
    const [expandedImage, setExpandedImage] = React.useState(false);
    const [showRawData, setShowRawData] = React.useState(false);
    const [selectedPerformer, setSelectedPerformer] = React.useState(null);
    const [isTagging, setIsTagging] = React.useState({} as {[key: string]: boolean});

    // No need for hooks since we're using direct functions

    // Tagging functions
    const tagGalleryWithPerformer = async (performerFreq: PerformerFrequency) => {
      if (!galleryData?.id) {
        console.error('Gallery ID not available for tagging');
        return;
      }

      const actionKey = `tag_gallery_${performerFreq.performer.id}`;
      setIsTagging((prev: any) => ({ ...prev, [actionKey]: true }));

      try {
        console.log(`🏷️ Tagging gallery ${galleryData.id} with performer ${performerFreq.performer.name}`);
        
        const response = await galleryUpdateMutation({
          input: {
            id: galleryData.id,
            performer_ids: {
              ids: [performerFreq.performer.id],
              mode: 'ADD' // Add to existing performers
            }
          }
        });

        if (response?.data?.galleryUpdate) {
          console.log('✅ Gallery tagged successfully:', response.data.galleryUpdate);
          // Show success notification
          const message = `Gallery tagged with ${performerFreq.performer.name}`;
          showToast(message, 'success');
        }
      } catch (error: any) {
        console.error('❌ Failed to tag gallery:', error);
        const message = `Failed to tag gallery: ${error.message || 'Unknown error'}`;
        showToast(message, 'danger');
      } finally {
        setIsTagging((prev: any) => ({ ...prev, [actionKey]: false }));
      }
    };

    const tagImagesWithPerformer = async (performerFreq: PerformerFrequency) => {
      if (!performerFreq.appearances || performerFreq.appearances.length === 0) {
        console.error('No image appearances available for tagging');
        return;
      }

      const actionKey = `tag_images_${performerFreq.performer.id}`;
      setIsTagging((prev: any) => ({ ...prev, [actionKey]: true }));

      try {
        const imageIds = performerFreq.appearances.map(app => app.imageId);
        console.log(`🏷️ Tagging ${imageIds.length} images with performer ${performerFreq.performer.name}`);
        
        const response = await bulkImageUpdateMutation({
          input: {
            ids: imageIds,
            performer_ids: {
              ids: [performerFreq.performer.id],
              mode: 'ADD' // Add to existing performers
            }
          }
        });

        if (response?.data) {
          console.log('✅ Images tagged successfully:', response.data);
          // Show success notification
          const message = `${imageIds.length} images tagged with ${performerFreq.performer.name}`;
          showToast(message, 'success');
        }
      } catch (error: any) {
        console.error('❌ Failed to tag images:', error);
        const message = `Failed to tag images: ${error.message || 'Unknown error'}`;
        showToast(message, 'danger');
      } finally {
        setIsTagging((prev: any) => ({ ...prev, [actionKey]: false }));
      }
    };

    const handlePerformerAction = async (performer: PerformerFrequency, action: string) => {
      console.log(`🎯 Performer action: ${action} for ${performer.performer.name}`);
      
      switch (action) {
        case 'tag_gallery':
          await tagGalleryWithPerformer(performer);
          break;
        case 'tag_all_images':
          await tagImagesWithPerformer(performer);
          break;
        case 'view':
          // Open performer details in a new tab
          if (performer.performer.stash_url || performer.performer.performer_url) {
            window.open(performer.performer.stash_url || performer.performer.performer_url, '_blank');
          }
          break;
        default:
          // Fallback to custom handler if provided
          if (onPerformerAction) {
            onPerformerAction(performer, action);
          }
          break;
      }
    };

    const renderPerformerFrequencyCard = (performerFreq: PerformerFrequency, index: number) => {
      const { performer, frequency, appearances, averageConfidence, bestConfidence } = performerFreq;
      const isExpanded = selectedPerformer === `${performer.id}_${index}`;

      return React.createElement(Card, {
        key: `performer-freq-${index}`,
        style: { 
          marginBottom: '15px',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          transition: 'box-shadow 0.2s ease',
          cursor: 'pointer'
        },
        className: 'ai-performer-frequency-card',
        onMouseEnter: (e: any) => {
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
        },
        onMouseLeave: (e: any) => {
          e.currentTarget.style.boxShadow = 'none';
        }
      },
        React.createElement('div', { style: { padding: '15px' } },
          React.createElement('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'start',
              marginBottom: '15px'
            }
          },
            React.createElement('div', { className: 'performer-info' },
              React.createElement('div', {
                style: { display: 'flex', alignItems: 'center', marginBottom: '8px' }
              },
                React.createElement('h5', { style: { margin: 0 } }, performer.name),
                React.createElement(Badge, {
                  variant: 'primary',
                  style: { marginLeft: '8px' }
                }, `${frequency} image${frequency > 1 ? 's' : ''}`)
              ),
              React.createElement('div', { className: 'confidence-metrics' },
                React.createElement('small', { style: { color: '#6c757d' } },
                  'Best: ',
                  React.createElement(Badge, {
                    variant: getConfidenceColor(bestConfidence * 100)
                  }, `${(bestConfidence * 100).toFixed(1)}%`),
                  ' Avg: ',
                  React.createElement(Badge, {
                    variant: getConfidenceColor(averageConfidence * 100)
                  }, `${(averageConfidence * 100).toFixed(1)}%`)
                )
              )
            ),
            React.createElement('div', { 
              className: 'performer-thumbnail',
              style: {
                width: '60px',
                height: '60px',
                borderRadius: '4px',
                overflow: 'hidden',
                border: '1px solid #dee2e6',
                backgroundColor: '#f8f9fa',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }
            },
              (performer.image || performer.image_url) ? React.createElement('img', {
                src: performer.image_url || performer.image,
                alt: performer.name,
                style: {
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                },
                onError: (e: any) => {
                  console.warn(`Failed to load performer image: ${performer.image_url || performer.image}`);
                  e.target.style.display = 'none';
                  // Show performer initials instead
                  const placeholder = document.createElement('div');
                  placeholder.style.cssText = 'width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #6c5ce7; color: white; font-weight: bold; font-size: 16px;';
                  placeholder.textContent = performer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2);
                  e.target.parentNode.appendChild(placeholder);
                }
              }) : React.createElement('div', {
                style: {
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#6c5ce7',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: '16px'
                }
              }, performer.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2))
            )
          ),

          // Gallery-specific actions
          React.createElement('div', {
            className: 'gallery-performer-actions',
            style: { marginBottom: '15px' }
          },
            React.createElement(Button, {
              size: 'sm',
              variant: 'primary',
              style: { marginRight: '8px' },
              disabled: isTagging[`tag_images_${performerFreq.performer.id}`],
              onClick: () => handlePerformerAction(performerFreq, 'tag_all_images')
            }, 
              isTagging[`tag_images_${performerFreq.performer.id}`] ? 
                React.createElement('span', null, '⏳ Tagging...') : 
                `🏷️ Tag All ${frequency} Images`
            ),
            React.createElement(Button, {
              size: 'sm',
              variant: 'outline-success',
              style: { marginRight: '8px' },
              disabled: isTagging[`tag_gallery_${performerFreq.performer.id}`],
              onClick: () => handlePerformerAction(performerFreq, 'tag_gallery')
            }, 
              isTagging[`tag_gallery_${performerFreq.performer.id}`] ? 
                React.createElement('span', null, '⏳ Tagging...') : 
                '🎯 Tag Gallery'
            ),
            React.createElement(Button, {
              size: 'sm',
              variant: 'outline-secondary',
              onClick: () => handlePerformerAction(performerFreq, 'view')
            }, '👁️ View Details')
          ),

          // Image appearances
          React.createElement('div', { className: 'image-appearances' },
            React.createElement(Button, {
              variant: 'link',
              size: 'sm',
              onClick: () => setSelectedPerformer(isExpanded ? null : `${performer.id}_${index}`),
              style: { padding: 0, marginBottom: '8px' }
            },
              isExpanded ? '🗜️' : '🔍',
              ` ${isExpanded ? 'Hide' : 'Show'} Image Appearances (${frequency})`
            ),

            isExpanded && React.createElement('div', { className: 'appearances-grid' },
              React.createElement(Row, null,
                appearances.map((appearance, appIndex) =>
                  React.createElement(Col, {
                    key: appIndex,
                    xs: 6,
                    md: 4,
                    lg: 3,
                    style: { marginBottom: '8px' }
                  },
                    React.createElement('div', {
                      className: 'appearance-thumbnail',
                      style: { 
                        position: 'relative',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px solid #dee2e6',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                        cursor: 'pointer'
                      },
                      onMouseEnter: (e: any) => {
                        e.currentTarget.style.transform = 'scale(1.02)';
                        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
                      },
                      onMouseLeave: (e: any) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      },
                      onClick: () => {
                        // Could add click functionality to view full image
                        console.log(`Clicked on appearance image: ${appearance.imageUrl}`);
                      }
                    },
                      React.createElement('img', {
                        src: appearance.imageUrl,
                        alt: `Appearance ${appIndex + 1}`,
                        style: {
                          maxHeight: '80px',
                          objectFit: 'cover',
                          width: '100%',
                          display: 'block'
                        },
                        onError: (e: any) => {
                          // Try fallback URL or show placeholder
                          console.warn(`Failed to load image: ${appearance.imageUrl}`);
                          e.target.style.display = 'none';
                          // Add a placeholder div
                          const placeholder = document.createElement('div');
                          placeholder.style.cssText = 'width: 100%; height: 80px; background: #f8f9fa; display: flex; align-items: center; justify-content: center; color: #6c757d; font-size: 12px;';
                          placeholder.textContent = '🖼️ Image unavailable';
                          e.target.parentNode.appendChild(placeholder);
                        }
                      }),
                      React.createElement('div', {
                        className: 'appearance-overlay',
                        style: {
                          position: 'absolute',
                          top: '4px',
                          right: '4px',
                          zIndex: 10
                        }
                      },
                        React.createElement(Badge, {
                          variant: getConfidenceColor(appearance.confidence * 100), // Convert 0-1 to 0-100 for color calculation
                          style: {
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '2px 6px'
                          }
                        }, `${(appearance.confidence * 100).toFixed(1)}%`) // Display as percentage
                      ),
                      // Add image info overlay at bottom
                      React.createElement('div', {
                        style: {
                          position: 'absolute',
                          bottom: '0',
                          left: '0',
                          right: '0',
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                          color: 'white',
                          fontSize: '10px',
                          padding: '8px 4px 4px',
                          textAlign: 'center'
                        }
                      }, `Image ${appIndex + 1}`)
                    )
                  )
                )
              )
            )
          )
        )
      );
    };

    const renderProcessingStats = () => {
      if (!galleryResults) return null;

      const successRate = (galleryResults.processedImages / galleryResults.totalImages) * 100;

      return React.createElement(Card, {
        className: 'processing-stats-card',
        style: { marginBottom: '15px' }
      },
        React.createElement('div', { style: { padding: '15px' } },
          React.createElement('h6', { style: { marginBottom: '15px' } },
            '📊 Processing Statistics'
          ),

          React.createElement(Row, null,
            React.createElement(Col, { md: 6 },
              React.createElement('div', { className: 'stat-item', style: { marginBottom: '8px' } },
                React.createElement('span', { className: 'stat-label' }, 'Total Images: '),
                React.createElement('span', { className: 'stat-value' }, galleryResults.totalImages)
              ),
              React.createElement('div', { className: 'stat-item', style: { marginBottom: '8px' } },
                React.createElement('span', { className: 'stat-label' }, 'Processed: '),
                React.createElement('span', {
                  className: 'stat-value',
                  style: { color: '#28a745' }
                }, `✅ ${galleryResults.processedImages}`)
              ),
              React.createElement('div', { className: 'stat-item', style: { marginBottom: '8px' } },
                React.createElement('span', { className: 'stat-label' }, 'Skipped: '),
                React.createElement('span', {
                  className: 'stat-value',
                  style: { color: '#ffc107' }
                }, `⚠️ ${galleryResults.skippedImages}`)
              )
            ),
            React.createElement(Col, { md: 6 },
              React.createElement('div', { className: 'stat-item', style: { marginBottom: '8px' } },
                React.createElement('span', { className: 'stat-label' }, 'Success Rate: '),
                React.createElement('span', { className: 'stat-value' }, `${successRate.toFixed(1)}%`)
              ),
              React.createElement('div', { className: 'stat-item', style: { marginBottom: '8px' } },
                React.createElement('span', { className: 'stat-label' }, 'Processing Time: '),
                React.createElement('span', { className: 'stat-value' },
                  '⏱️ ',
                  galleryResults.totalProcessingTime ? formatProcessingTime(galleryResults.totalProcessingTime) : 'N/A'
                )
              ),
              React.createElement('div', { className: 'stat-item', style: { marginBottom: '8px' } },
                React.createElement('span', { className: 'stat-label' }, 'Unique Performers: '),
                React.createElement('span', {
                  className: 'stat-value',
                  style: { color: '#17a2b8' }
                }, `👥 ${galleryResults.performers.length}`)
              )
            )
          ),

          React.createElement('div', { style: { marginTop: '15px' } },
            React.createElement('div', {
              style: {
                backgroundColor: '#e9ecef',
                borderRadius: '4px',
                height: '20px',
                position: 'relative',
                overflow: 'hidden'
              }
            },
              React.createElement('div', {
                style: {
                  width: `${successRate}%`,
                  height: '100%',
                  backgroundColor: successRate > 80 ? '#28a745' : successRate > 50 ? '#ffc107' : '#dc3545',
                  transition: 'width 0.3s ease'
                }
              }),
              React.createElement('div', {
                style: {
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: successRate > 50 ? '#fff' : '#000'
                }
              }, `${successRate.toFixed(1)}% processed`)
            )
          )
        )
      );
    };

    const renderGalleryResults = () => {
      if (!galleryResults) {
        return React.createElement(Alert, { variant: 'info' },
          React.createElement('span', null,
            React.createElement('i', { className: 'fas fa-brain', style: { marginRight: '8px' } }),
            'No gallery results to display'
          )
        );
      }

      if (!galleryResults.success) {
        return React.createElement(Alert, { variant: 'danger' },
          `❌ Error: ${galleryResults.error || 'Gallery processing failed'}`
        );
      }

      if (galleryResults.performers.length === 0) {
        return React.createElement(Alert, { variant: 'warning' },
          `👁️ No performers detected across ${galleryResults.processedImages} processed images`
        );
      }

      return React.createElement('div', { className: 'gallery-results' },
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            marginBottom: '15px'
          }
        },
          React.createElement('span', { style: { marginRight: '8px' } }, '🖼️'),
          React.createElement('h6', { style: { margin: 0 } }, 'Gallery Analysis Results'),
          React.createElement(Badge, {
            variant: 'info',
            style: { marginLeft: '8px' }
          }, `${galleryResults.performers.length} performer${galleryResults.performers.length > 1 ? 's' : ''} found`)
        ),

        // Processing Statistics
        renderProcessingStats(),

        // Performer Frequencies
        React.createElement('div', { className: 'performers-section' },
          React.createElement('h6', {
            style: { marginBottom: '15px' }
          },
            '👥 Detected Performers (by frequency)'
          ),

          galleryResults.performers.map((performerFreq, index) =>
            renderPerformerFrequencyCard(performerFreq, index)
          )
        )
      );
    };

    return React.createElement(Modal, {
      show,
      onHide,
      size: 'xl',
      className: 'ai-results-overlay ai-results-overlay-galleries',
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
          // Source Gallery Column
          React.createElement(Col, { md: expandedImage ? 12 : 4, className: 'ai-source-column' },
            React.createElement('div', {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px'
              }
            },
              React.createElement('h6', null, 'Gallery Info'),
              React.createElement(Button, {
                size: 'sm',
                variant: 'outline-secondary',
                style: { marginRight: '8px' },
                onClick: () => setExpandedImage(!expandedImage)
              }, expandedImage ? '🗜️' : '🔍')
            ),

            React.createElement('div', { className: 'gallery-info-section' },
              galleryData && React.createElement(Card, { className: 'gallery-info-card' },
                React.createElement('div', { style: { padding: '15px' } },
                  React.createElement('h6', null, galleryData.title || 'Untitled Gallery'),
                  galleryData.studio && React.createElement('p', {
                    style: { color: '#6c757d', marginBottom: '4px' }
                  }, `Studio: ${galleryData.studio.name}`),
                  React.createElement('p', {
                    style: { color: '#6c757d', marginBottom: '4px' }
                  }, `Total Images: ${galleryResults?.totalImages || 'Unknown'}`),
                  galleryData.date && React.createElement('p', {
                    style: { color: '#6c757d', marginBottom: 0 }
                  }, `Date: ${galleryData.date}`)
                )
              )
            )
          ),

          // Results Column
          !expandedImage && React.createElement(Col, { md: 8, className: 'ai-results-column' },
            React.createElement('div', {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '15px'
              }
            },
              React.createElement('h6', null, 'Analysis Results'),
              React.createElement(Button, {
                size: 'sm',
                variant: 'outline-secondary',
                onClick: () => setShowRawData(!showRawData)
              },
                `💻 ${showRawData ? 'Hide' : 'Show'} Raw Data`
              )
            ),

            React.createElement('div', {
              className: 'ai-results-content',
              style: { maxHeight: '600px', overflowY: 'auto' }
            },
              renderGalleryResults()
            ),

            // Raw Data Section
            showRawData && React.createElement('div', {
              className: 'ai-raw-data',
              style: { marginTop: '20px' }
            },
              React.createElement('h6', null, 'Raw Processing Results'),
              React.createElement('div', { className: 'ai-debug-info' },
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
                }, JSON.stringify(galleryResults || rawResponse, null, 2))
              )
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
          React.createElement('div', { className: 'ai-results-summary' },
            galleryResults && React.createElement('small', { style: { color: '#6c757d' } },
              `${galleryResults.performers.length} performer${galleryResults.performers.length > 1 ? 's' : ''} detected `,
              `across ${galleryResults.processedImages} of ${galleryResults.totalImages} images`,
              galleryResults.totalProcessingTime && ` in ${formatProcessingTime(galleryResults.totalProcessingTime)}`
            )
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
  (window as any).AIResultsOverlayGalleries = AIResultsOverlayGalleries;

})();