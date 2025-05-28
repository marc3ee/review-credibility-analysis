// Content script - this runs on every page
// It provides additional functionality for interacting with page content

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'findReviews') {
        findReviewsWithScroll().then(reviews => {
            sendResponse({reviews: reviews});
        });
        return true; // Indicates we will send a response asynchronously
    }
});

async function findReviewsWithScroll() {
    const reviews = [];
    let scrollAttempts = 0;
    const maxScrollAttempts = 30;
    let lastScrollPosition = 0;
    
    return new Promise((resolve) => {
        function scrollAndSearch() {
            // Scroll down gradually
            window.scrollBy(0, 300);
            scrollAttempts++;
            
            setTimeout(() => {
                // Multiple selectors to catch different review formats
                const selectors = [
                    '.pdp-mod-review .content',
                    '#module_product_review .content',
                    '#module_product_review > div > div > div:nth-child(3) > div.mod-reviews > div > div.item-content > div.content',
                    '[class*="review-content"]',
                    '[class*="review-text"]',
                    '.review-item .content',
                    '.review .content',
                    '[data-testid*="review"] .content'
                ];
                
                let foundNew = false;
                
                selectors.forEach(selector => {
                    const elements = document.querySelectorAll(selector);
                    elements.forEach(element => {
                        const text = element.textContent.trim();
                        if (text && text.length > 15 && !reviews.includes(text)) {
                            reviews.push(text);
                            foundNew = true;
                        }
                    });
                });
                
                const currentScrollPosition = window.pageYOffset;
                const isAtBottom = currentScrollPosition + window.innerHeight >= document.body.scrollHeight - 100;
                
                if (scrollAttempts < maxScrollAttempts && 
                    !isAtBottom && 
                    (foundNew || currentScrollPosition !== lastScrollPosition)) {
                    
                    lastScrollPosition = currentScrollPosition;
                    scrollAndSearch();
                } else {
                    resolve(reviews);
                }
            }, 800); // Wait for content to load
        }
        
        scrollAndSearch();
    });
}