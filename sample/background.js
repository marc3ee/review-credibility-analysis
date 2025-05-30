// Background service worker for InCrediView extension
console.log('InCrediView background service worker loaded');

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('InCrediView extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Show welcome notification or setup
    console.log('Welcome to InCrediView - Review Credibility Analyzer!');
  }
});

// Handle tab updates to detect Lazada pages
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('lazada.com')) {
      console.log('Lazada page detected:', tab.url);
      
      // Optional: Could inject a small indicator that the extension is ready
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          // Small indicator that extension is ready (optional)
          console.log('InCrediView extension is ready for this Lazada page');
        }
      }).catch(err => {
        console.log('Could not inject into page:', err);
      });
    }
  }
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  switch (request.type) {
    case 'SCRAPING_STATUS':
      console.log('Scraping status update:', request.status);
      // You could store status or broadcast to other parts of extension
      break;
      
    case 'ANALYSIS_COMPLETE':
      console.log('Analysis complete:', request.results);
      break;
      
    case 'ERROR_OCCURRED':
      console.error('Extension error:', request.error);
      break;
      
    case 'KEEP_ALIVE':
      // Simple keep-alive ping
      sendResponse({ alive: true });
      break;
      
    default:
      console.log('Unknown message type:', request.type);
  }
  
  // Always send a response to prevent "port closed" errors
  if (sendResponse) {
    sendResponse({ received: true });
  }
  
  return true; // Keep message channel open for async responses
});

// Keep service worker alive during long operations
let keepAliveInterval;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'keepAlive') {
    console.log('Keep-alive port connected');
    
    // Send periodic pings to keep the connection alive
    keepAliveInterval = setInterval(() => {
      try {
        port.postMessage({ type: 'ping', timestamp: Date.now() });
      } catch (error) {
        console.log('Error sending ping:', error);
        clearInterval(keepAliveInterval);
      }
    }, 25000); // Send ping every 25 seconds (well under 30s limit)
    
    port.onDisconnect.addListener(() => {
      console.log('Keep-alive port disconnected');
      if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    });
    
    port.onMessage.addListener((message) => {
      if (message.type === 'pong') {
        console.log('Received pong from content script');
      }
    });
  }
});

// Handle service worker suspension
chrome.runtime.onSuspend.addListener(() => {
  console.log('InCrediView service worker is being suspended');
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('InCrediView extension started');
});

// Helper function to broadcast messages to all tabs
async function broadcastToAllTabs(message) {
  try {
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url && tab.url.includes('lazada.com')) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Ignore errors for tabs that don't have the content script
        });
      }
    }
  } catch (error) {
    console.log('Error broadcasting to tabs:', error);
  }
}

// Function to handle long-running operations
async function handleLongOperation(operationType, tabId) {
  console.log(`Starting long operation: ${operationType} on tab ${tabId}`);
  
  try {
    // Send status update to content script
    await chrome.tabs.sendMessage(tabId, {
      type: 'OPERATION_STATUS',
      status: 'STARTED',
      operation: operationType
    });
    
    // You could add more sophisticated operation tracking here
    
  } catch (error) {
    console.error(`Error in long operation ${operationType}:`, error);
    
    // Send error notification
    await chrome.tabs.sendMessage(tabId, {
      type: 'OPERATION_STATUS',
      status: 'ERROR',
      operation: operationType,
      error: error.message
    }).catch(() => {
      console.log('Could not send error message to tab');
    });
  }
}

// Export functions for use by other parts of the extension
globalThis.incrediviewBackground = {
  broadcastToAllTabs,
  handleLongOperation
};