// Content script for InCrediView extension
console.log('InCrediView content script loaded on:', window.location.href);

// Check if this is a Lazada product page with reviews
function isLazadaProductPage() {
  return window.location.href.includes('lazada.com') && 
         window.location.href.includes('/products/');
}

// Keep connection alive with background script during long operations
let port;
let isConnected = false;

function connectToBackground() {
  try {
    port = chrome.runtime.connect({ name: 'keepAlive' });
    isConnected = true;
    
    port.onMessage.addListener((msg) => {
      // Handle ping messages to keep connection alive
      if (msg.type === 'ping') {
        console.log('Received ping from background at:', new Date(msg.timestamp));
        // Send pong back to confirm we're alive
        try {
          port.postMessage({ type: 'pong', timestamp: Date.now() });
        } catch (error) {
          console.log('Error sending pong:', error);
        }
      }
    });
    
    port.onDisconnect.addListener(() => {
      console.log('Port disconnected, attempting to reconnect...');
      isConnected = false;
      setTimeout(connectToBackground, 1000);
    });
    
    console.log('Successfully connected to background script');
  } catch (error) {
    console.log('Error connecting to background:', error);
    isConnected = false;
    setTimeout(connectToBackground, 2000);
  }
}

// Initialize if this is a valid page
if (isLazadaProductPage()) {
  console.log('Valid Lazada product page detected');
  connectToBackground();
  
  // Add a small indicator that the extension is active (optional)
  const indicator = document.createElement('div');
  indicator.id = 'incrediview-indicator';
  indicator.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 12px;
    font-family: Arial, sans-serif;
    z-index: 10000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    transition: opacity 0.3s ease;
    opacity: 0.9;
    pointer-events: none;
    border: 1px solid rgba(255,255,255,0.2);
  `;
  indicator.textContent = '🔍 InCrediView Ready';
  
  // Add indicator briefly
  document.body.appendChild(indicator);
  
  // Fade out after 3 seconds
  setTimeout(() => {
    indicator.style.opacity = '0';
    setTimeout(() => {
      if (indicator.parentNode) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 300);
  }, 3000);
} else {
  console.log('Not a Lazada product page, content script will be limited');
}

// Helper function to send status updates to background
function sendStatusUpdate(status, data = {}) {
  try {
    if (chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({
        type: 'SCRAPING_STATUS',
        status: status,
        url: window.location.href,
        timestamp: Date.now(),
        ...data
      }).catch(error => {
        console.log('Error sending status update:', error);
      });
    }
  } catch (error) {
    console.log('Error in sendStatusUpdate:', error);
  }
}

// Enhanced page readiness check
function checkPageReadiness() {
  const hasReviewSection = !!(
    document.querySelector('.pdp-mod-review') ||
    document.querySelector('#module_product_review') ||
    document.querySelector('.mod-reviews') ||
    document.querySelector('[class*="review"]')
  );
  
  const hasProductInfo = !!(
    document.querySelector('.pdp-product-name') ||
    document.querySelector('.pdp-mod-product-badge-title') ||
    document.querySelector('[class*="product"]')
  );
  
  return {
    ready: isLazadaProductPage(),
    url: window.location.href,
    hasReviews: hasReviewSection,
    hasProductInfo: hasProductInfo,
    isFullyLoaded: document.readyState === 'complete'
  };
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request);
  
  try {
    switch (request.type) {
      case 'CHECK_PAGE_READY':
        const readiness = checkPageReadiness();
        console.log('Page readiness check:', readiness);
        sendResponse(readiness);
        break;
        
      case 'START_DEEP_SCRAPE':
        sendStatusUpdate('STARTING_DEEP_SCRAPE');
        sendResponse({ started: true, timestamp: Date.now() });
        break;
        
      case 'PING':
        sendResponse({ pong: true, timestamp: Date.now() });
        break;
        
      case 'GET_PAGE_INFO':
        const pageInfo = {
          url: window.location.href,
          title: document.title,
          isLazada: isLazadaProductPage(),
          readyState: document.readyState,
          hasContent: document.body.children.length > 0
        };
        sendResponse(pageInfo);
        break;
        
      case 'OPERATION_STATUS':
        console.log('Operation status update:', request.status, request.operation);
        if (request.status === 'ERROR') {
          console.error('Operation error:', request.error);
        }
        sendResponse({ received: true });
        break;
        
      default:
        console.log('Unknown message type:', request.type);
        sendResponse({ received: true, unknown: true });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ error: error.message });
  }
  
  return true; // Keep message channel open for async responses
});

// Monitor for review section loading
let reviewSectionObserver;

function observeReviewSection() {
  if (reviewSectionObserver) {
    reviewSectionObserver.disconnect();
  }
  
  const targetNode = document.body;
  
  reviewSectionObserver = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
      if (mutation.type === 'childList') {
        const reviewSection = document.querySelector('.pdp-mod-review, #module_product_review, .mod-reviews');
        if (reviewSection && !reviewSection.dataset.observerNotified) {
          console.log('Review section detected by observer');
          reviewSection.dataset.observerNotified = 'true';
          sendStatusUpdate('REVIEW_SECTION_LOADED', {
            selector: reviewSection.className || reviewSection.id
          });
        }
      }
    }
  });
  
  reviewSectionObserver.observe(targetNode, {
    childList: true,
    subtree: true
  });
}

// Start observing if on product page
if (isLazadaProductPage()) {
  // Wait a bit for page to stabilize before starting observer
  setTimeout(() => {
    observeReviewSection();
  }, 1000);
}

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
  console.log('Page unloading, cleaning up...');
  
  if (reviewSectionObserver) {
    reviewSectionObserver.disconnect();
    reviewSectionObserver = null;
  }
  
  if (port && isConnected) {
    try {
      port.disconnect();
    } catch (error) {
      console.log('Error disconnecting port:', error);
    }
    isConnected = false;
  }
});

// Enhanced utility function to wait for element
function waitForElement(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      const element = document.querySelector(selector);
      if (element) {
        obs.disconnect();
        resolve(element);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Element ${selector} not found within ${timeout}ms`));
    }, timeout);
  });
}

// Function to wait for multiple elements
function waitForAnyElement(selectors, timeout = 10000) {
  return new Promise((resolve, reject) => {
    // Check if any element already exists
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        resolve({ element, selector });
        return;
      }
    }
    
    const observer = new MutationObserver((mutations, obs) => {
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve({ element, selector });
          return;
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`None of the elements found within ${timeout}ms: ${selectors.join(', ')}`));
    }, timeout);
  });
}

// Function to check if reviews are loaded and ready
function areReviewsReady() {
  const reviewItems = document.querySelectorAll('.pdp-mod-review .mod-reviews .item, .review-item, [class*="review-item"]');
  const hasReviewContent = Array.from(reviewItems).some(item => {
    const content = item.querySelector('.content, .review-content, .review-text');
    return content && content.textContent.trim().length > 10;
  });
  
  return {
    hasReviewSection: !!document.querySelector('.pdp-mod-review, #module_product_review'),
    reviewCount: reviewItems.length,
    hasContent: hasReviewContent,
    ready: reviewItems.length > 0 && hasReviewContent
  };
}

// Export utility functions for use by injected scripts
window.incrediviewUtils = {
  waitForElement,
  waitForAnyElement,
  sendStatusUpdate,
  isLazadaProductPage,
  checkPageReadiness,
  areReviewsReady,
  // Additional helper for deep scrape
  getReviewElements: () => document.querySelectorAll('.pdp-mod-review .mod-reviews .item, .review-item, [class*="review-item"]'),
  getReviewSection: () => document.querySelector('.pdp-mod-review, #module_product_review, .mod-reviews'),
  // Helper to check if page is fully interactive
  isPageInteractive: () => document.readyState === 'complete' || document.readyState === 'interactive'
};

// Send initial status when content script loads
if (isLazadaProductPage()) {
  setTimeout(() => {
    sendStatusUpdate('CONTENT_SCRIPT_LOADED', checkPageReadiness());
  }, 500);
}

console.log('InCrediView content script initialization complete');