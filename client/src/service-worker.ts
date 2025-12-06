// Service Worker for background polling of analysis results
let activePolling: Record<string, number> = {};

self.addEventListener('message', (event: any) => {
  const message = event.data;

  if (message.type === 'START_POLLING' && message.requestId) {
    console.log(`[SERVICE-WORKER] Starting background polling for request ${message.requestId}`);
    
    if (!activePolling[message.requestId]) {
      // Poll every 2 seconds in background
      activePolling[message.requestId] = setInterval(() => {
        pollAnalysisStatus(message.requestId, event.ports[0]);
      }, 2000) as unknown as number;

      // Initial poll immediately
      pollAnalysisStatus(message.requestId, event.ports[0]);
    }
  } else if (message.type === 'STOP_POLLING' && message.requestId) {
    console.log(`[SERVICE-WORKER] Stopping background polling for request ${message.requestId}`);
    
    if (activePolling[message.requestId]) {
      clearInterval(activePolling[message.requestId]);
      delete activePolling[message.requestId];
    }
  }
});

// Track OCR completion per request to avoid sending duplicate notifications
const ocrNotified: Record<string, boolean> = {};

async function pollAnalysisStatus(requestId: string, port: any) {
  try {
    const response = await fetch(`/api/analysis-status/${requestId}`);
    const data = await response.json();

    if (data.status === 'completed') {
      console.log(`[SERVICE-WORKER] Analysis completed! Notifying client.`);
      port.postMessage({
        type: 'ANALYSIS_COMPLETE',
        requestId,
        data
      });
      
      // Stop polling and cleanup
      if (activePolling[requestId]) {
        clearInterval(activePolling[requestId]);
        delete activePolling[requestId];
      }
      delete ocrNotified[requestId];
    } else if (data.status === 'failed') {
      console.log(`[SERVICE-WORKER] Analysis failed. Notifying client.`);
      port.postMessage({
        type: 'ANALYSIS_FAILED',
        requestId,
        error: data.error
      });
      
      // Stop polling and cleanup
      if (activePolling[requestId]) {
        clearInterval(activePolling[requestId]);
        delete activePolling[requestId];
      }
      delete ocrNotified[requestId];
    } else if (data.status === 'ocr_complete' && !ocrNotified[requestId]) {
      console.log(`[SERVICE-WORKER] OCR complete! Notifying client.`);
      port.postMessage({
        type: 'OCR_COMPLETE',
        requestId
      });
      ocrNotified[requestId] = true;
    }
  } catch (error) {
    console.error(`[SERVICE-WORKER] Error polling analysis status:`, error);
  }
}
