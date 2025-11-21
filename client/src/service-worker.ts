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
      
      // Stop polling
      if (activePolling[requestId]) {
        clearInterval(activePolling[requestId]);
        delete activePolling[requestId];
      }
    } else if (data.status === 'failed') {
      console.log(`[SERVICE-WORKER] Analysis failed. Notifying client.`);
      port.postMessage({
        type: 'ANALYSIS_FAILED',
        requestId,
        error: data.error
      });
      
      // Stop polling
      if (activePolling[requestId]) {
        clearInterval(activePolling[requestId]);
        delete activePolling[requestId];
      }
    }
  } catch (error) {
    console.error(`[SERVICE-WORKER] Error polling analysis status:`, error);
  }
}
