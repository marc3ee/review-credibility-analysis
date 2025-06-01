document.addEventListener('DOMContentLoaded', function() {
    const findReviewsButton = document.getElementById('findReviewsButton');
    const webScrapeButton = document.getElementById('webScrapeButton');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    
    // Existing current page analysis functionality
    findReviewsButton.addEventListener('click', async function() {
        await analyzeCurrentPage();
    });

    // New web scraping functionality
    webScrapeButton.addEventListener('click', async function() {
        await performDeepScrapeAnalysis();
    });

    async function analyzeCurrentPage() {
        statusDiv.style.display = 'block';
        statusDiv.textContent = 'Starting review search...';
        resultsDiv.innerHTML = '';
        
        console.log('Extension started');
        
        try {
            // Get the active tab
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            console.log('Active tab found:', tab.url);
            
            // Execute the review finding script with all functions included
            statusDiv.textContent = 'Scraping reviews from page...';
            
            const results = await chrome.scripting.executeScript({
                target: {tabId: tab.id},
                func: () => {
                    console.log('Starting review scraping...');
                    
                    // Include all the preprocessing and review finding functions from the original code
                    // [Include all the original functions here - CONTRACTION_MAP, fixSpacedContractions, etc.]
                    
                    // Preprocessing functions for sentiment analysis
                    const CONTRACTION_MAP = {
                        "ain't": "is not", "aren't": "are not", "can't": "cannot", "couldn't": "could not",
                        "didn't": "did not", "doesn't": "does not", "don't": "do not", "hadn't": "had not",
                        "hasn't": "has not", "haven't": "have not", "he'd": "he would", "he'll": "he will",
                        "he's": "he is", "i'd": "i would", "i'll": "i will", "i'm": "i am", "i've": "i have",
                        "isn't": "is not", "it'd": "it would", "it'll": "it will", "it's": "it is",
                        "let's": "let us", "mightn't": "might not", "mustn't": "must not", "shan't": "shall not",
                        "she'd": "she would", "she'll": "she will", "she's": "she is", "shouldn't": "should not",
                        "that's": "that is", "there's": "there is", "they'd": "they would", "they'll": "they will",
                        "they're": "they are", "they've": "they have", "we'd": "we would", "we're": "we are",
                        "we've": "we have", "weren't": "were not", "what's": "what is", "where's": "where is",
                        "who's": "who is", "won't": "will not", "wouldn't": "would not", "you'd": "you would",
                        "you'll": "you will", "you're": "you are", "you've": "you have",
                        "'cause": "because", "'em": "them", "'bout": "about", "'til": "until", "'round": "around",
                        "gonna": "going to", "wanna": "want to", "gimme": "give me", "lemme": "let me",
                        "kinda": "kind of", "sorta": "sort of", "outta": "out of", "lotta": "lot of"
                    };

                    function fixSpacedContractions(text) {
                        if (!text) return "";
                        const patterns = [
                            /\b(\w+)\s+'\s+([a-z]{1,3})\b/gi,
                            /\b(\w+)'\s+([a-z]{1,3})\b/gi,
                            /\b(\w+)\s+'([a-z]{1,3})\b/gi
                        ];
                        patterns.forEach(pattern => {
                            text = text.replace(pattern, "$1'$2");
                        });
                        return text;
                    }

                    function expandContractions(text) {
                        if (!text) return "";
                        text = fixSpacedContractions(text);
                        text = text.toLowerCase();
                        const contractions = Object.keys(CONTRACTION_MAP).sort((a, b) => b.length - a.length);
                        contractions.forEach(contraction => {
                            const pattern = new RegExp('\\b' + contraction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'g');
                            text = text.replace(pattern, CONTRACTION_MAP[contraction]);
                        });
                        return text;
                    }

                    function preprocessTextWithExpansion(text) {
                        if (!text || text === "N/A") return "";
                        
                        // Expand contractions
                        text = expandContractions(text);
                        
                        // Replace line breaks and tabs
                        text = text.replace(/\n/g, " ").replace(/\t/g, " ").replace(/\r/g, " ");
                        
                        // Remove emojis
                        text = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2702}-\u{27B0}]|[\u{24C2}-\u{1F251}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '.');
                        
                        // Clean Unicode and normalize
                        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                        text = text.replace(/[^\w\s\.\,\!\?\;\:\-\_\(\)\[\]\{\}\"\'`~@#$%^&*+=|\\/<>]/g, '');
                        text = text.replace(/\s+/g, ' ').trim();
                        
                        // Punctuation spacing
                        text = text.replace(/([.!?,:;])\s*/g, '$1 ');
                        text = text.replace(/\s*(["'])/g, ' $1');
                        text = text.replace(/(["'])\s*/g, '$1 ');
                        text = text.replace(/\s*([([])/g, ' $1');
                        text = text.replace(/([)\]])\s*/g, '$1 ');
                        
                        return text.replace(/\s+/g, ' ').trim();
                    }

                    function preprocessTextMinimal(text) {
                        if (!text || text === "N/A") return "";
                        text = text.replace(/\n/g, " ").replace(/\t/g, " ").replace(/\r/g, " ");
                        text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                        text = text.replace(/\s+/g, ' ').trim();
                        return text;
                    }

                    function getStarRating(reviewElement) {
                        console.log('Searching for Lazada star rating in:', reviewElement);
                        
                        try {
                            // Method 1: Lazada-specific star images (MOST ACCURATE)
                            const starImages = reviewElement.querySelectorAll('.star img, img[src*="TB19ZvEgfDH8KJjy1XcXXcpdXXa"], img[src*="TB18ZvEgfDH8KJjy1XcXXcpdXXa"]');
                            
                            if (starImages.length > 0) {
                                let filledStars = 0;
                                console.log(`Found ${starImages.length} star images in review`);
                                
                                starImages.forEach((star, index) => {
                                    const src = star.getAttribute('src') || '';
                                    console.log(`Star ${index + 1}: src="${src}"`);
                                    
                                    // Check for filled star (TB19ZvEgfDH8KJjy1XcXXcpdXXa = filled)
                                    // Missing star would be TB18ZvEgfDH8KJjy1XcXXcpdXXa
                                    if (src.includes('TB19ZvEgfDH8KJjy1XcXXcpdXXa-64-64.png')) {
                                        filledStars++;
                                        console.log(`  This is a FILLED star`);
                                    } else if (src.includes('TB18ZvEgfDH8KJjy1XcXXcpdXXa-64-64.png')) {
                                        console.log(`  This is an EMPTY star`);
                                    } else {
                                        console.log(`  Unknown star type`);
                                    }
                                });
                                
                                if (filledStars > 0) {
                                    console.log(`FOUND RATING: ${filledStars} out of ${starImages.length} stars`);
                                    return filledStars;
                                }
                            }
                            
                            // [Include all other star rating detection methods from original code]
                            // ... [rest of getStarRating function]
                            
                            console.log('No star rating found with any method');
                            return null;
                            
                        } catch (error) {
                            console.error('Error in getStarRating:', error);
                            return null;
                        }
                    }

                    // Main scraping function
                    return new Promise((resolve) => {
                        const reviews = [];
                        const processedTexts = new Set();
                        let scrollAttempts = 0;
                        const maxScrollAttempts = 25;
                        let lastScrollPosition = 0;
                        let consecutiveEmptyAttempts = 0;
                        const maxEmptyAttempts = 3;
                        
                        function findReviewsSection() {
                            const reviewsSections = [
                                document.querySelector('.pdp-mod-review'),
                                document.querySelector('#module_product_review'),
                                document.querySelector('.mod-reviews'),
                                document.querySelector('[class*="review"]')
                            ];
                            
                            return reviewsSections.find(section => section && section.offsetParent !== null);
                        }
                        
                        function scrollAndSearch() {
                            window.scrollBy(0, 500);
                            scrollAttempts++;
                            
                            setTimeout(() => {
                                const reviewItems = document.querySelectorAll('.pdp-mod-review .mod-reviews .item, .review-item, [class*="review-item"]');
                                console.log(`Scroll attempt ${scrollAttempts}: Found ${reviewItems.length} review items`);
                                
                                let foundNewReviews = 0;
                                
                                reviewItems.forEach(reviewItem => {
                                    try {
                                        let rawText = '';
                                        const contentSelectors = ['.content', '.review-content', '.review-text', '[class*="content"]'];
                                        
                                        for (const selector of contentSelectors) {
                                            const contentElement = reviewItem.querySelector(selector);
                                            if (contentElement) {
                                                rawText = contentElement.textContent.trim();
                                                break;
                                            }
                                        }
                                        
                                        if (!rawText || rawText === "N/A" || rawText.length === 0) {
                                            return;
                                        }
                                        
                                        // Use both preprocessing methods
                                        const cleanedText = preprocessTextMinimal(rawText);
                                        const sentimentText = preprocessTextWithExpansion(rawText);
                                        
                                        if (processedTexts.has(cleanedText) || cleanedText.length < 10) {
                                            return;
                                        }
                                        
                                        const starRating = getStarRating(reviewItem);
                                        
                                        reviews.push({
                                            text: cleanedText,
                                            sentimentText: sentimentText,
                                            starRating: starRating,
                                            rawText: rawText,
                                            element: reviewItem
                                        });
                                        
                                        processedTexts.add(cleanedText);
                                        foundNewReviews++;
                                        
                                        console.log(`Added review ${reviews.length}: ${starRating ? starRating + ' stars' : 'no rating'} - ${cleanedText.substring(0, 50)}...`);
                                        
                                    } catch (error) {
                                        console.log('Error processing review item:', error);
                                    }
                                });
                                
                                const currentScrollPosition = window.pageYOffset;
                                const isAtBottom = currentScrollPosition + window.innerHeight >= document.body.scrollHeight - 100;
                                
                                if (foundNewReviews === 0) {
                                    consecutiveEmptyAttempts++;
                                } else {
                                    consecutiveEmptyAttempts = 0;
                                }
                                
                                if (scrollAttempts < maxScrollAttempts && 
                                    !isAtBottom && 
                                    consecutiveEmptyAttempts < maxEmptyAttempts &&
                                    currentScrollPosition !== lastScrollPosition) {
                                    
                                    lastScrollPosition = currentScrollPosition;
                                    scrollAndSearch();
                                } else {
                                    console.log(`Scraping complete. Found ${reviews.length} reviews after ${scrollAttempts} scroll attempts`);
                                    resolve(reviews);
                                }
                            }, 1000);
                        }
                        
                        const reviewsSection = findReviewsSection();
                        if (reviewsSection) {
                            console.log('Reviews section found, starting to scrape...');
                            reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            setTimeout(() => {
                                scrollAndSearch();
                            }, 2000);
                        } else {
                            console.log('Reviews section not found, trying general scraping...');
                            scrollAndSearch();
                        }
                    });
                }
            });
            
            const reviews = results[0].result;
            console.log('Scraping results:', reviews);
            
            if (reviews && reviews.length > 0) {
                statusDiv.textContent = `Found ${reviews.length} reviews. Analyzing sentiment...`;
                console.log(`Found ${reviews.length} reviews, starting analysis...`);
                
                // Process reviews for sentiment analysis
                const reviewsWithSentiment = await analyzeSentiment(reviews);
                console.log('Analysis complete:', reviewsWithSentiment);
                
                // Show everything in popup AND inject into page
                displayResultsInPopup(reviewsWithSentiment);
                
                // Inject results into the actual Lazada page
                await injectResultsIntoPage(reviewsWithSentiment, tab.id);
                
                // Scroll back up to review section after analysis
                await chrome.scripting.executeScript({
                    target: {tabId: tab.id},
                    func: () => {
                        // Find the review section
                        const reviewsSections = [
                            document.querySelector('.pdp-mod-review'),
                            document.querySelector('#module_product_review'),
                            document.querySelector('.mod-reviews'),
                            document.querySelector('[class*="review"]')
                        ];
                        
                        const reviewsSection = reviewsSections.find(section => section && section.offsetParent !== null);
                        
                        if (reviewsSection) {
                            console.log('Scrolling back to reviews section...');
                            reviewsSection.scrollIntoView({ 
                                behavior: 'smooth', 
                                block: 'start',
                                inline: 'nearest' 
                            });
                        } else {
                            // Fallback: scroll to top of page
                            console.log('Review section not found, scrolling to top...');
                            window.scrollTo({ 
                                top: 0, 
                                behavior: 'smooth' 
                            });
                        }
                    }
                });
                
            } else {
                statusDiv.textContent = 'No reviews found on this page. Make sure you are on a Lazada product page with reviews.';
                console.log('No reviews found');
            }
            
        } catch (error) {
            statusDiv.textContent = 'Error: ' + error.message;
            console.error('Extension error:', error);
        }
    }

    async function performDeepScrapeAnalysis() {
        // Disable buttons during scraping
        findReviewsButton.disabled = true;
        webScrapeButton.disabled = true;
        webScrapeButton.textContent = 'Scraping...';
        
        statusDiv.style.display = 'block';
        statusDiv.textContent = 'Starting comprehensive deep scrape analysis (ALL reviews)...';
        resultsDiv.innerHTML = '';
        
        try {
            // Get the active tab URL
            const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
            const currentUrl = tab.url;
            
            if (!currentUrl.includes('lazada.com')) {
                throw new Error('Please navigate to a Lazada product page first');
            }
            
            statusDiv.textContent = 'Performing comprehensive review scraping (this may take several minutes)...';
            
            // Execute the comprehensive scraping function
            const scrapingResults = await chrome.scripting.executeScript({
                target: {tabId: tab.id},
                func: performComprehensiveScraping
            });
            
            const allReviews = scrapingResults[0].result;
            console.log('Deep scraping results:', allReviews);
            
            if (allReviews && allReviews.length > 0) {
                statusDiv.textContent = `Deep scrape complete! Found ${allReviews.length} total reviews. Analyzing...`;
                
                // Analyze all reviews
                const analyzedReviews = await analyzeSentiment(allReviews);
                
                // Display comprehensive results
                displayComprehensiveResults(analyzedReviews);
                
            } else {
                statusDiv.textContent = 'Deep scrape found no reviews. The product may not have any reviews or the page structure has changed.';
            }
            
        } catch (error) {
            statusDiv.textContent = 'Deep scrape error: ' + error.message;
            console.error('Deep scrape error:', error);
        } finally {
            // Re-enable buttons
            findReviewsButton.disabled = false;
            webScrapeButton.disabled = false;
            webScrapeButton.textContent = 'Deep Scrape Analysis';
        }
    }

    // Comprehensive scraping function that mimics the Python pagination logic
    function performComprehensiveScraping() {
        return new Promise(async (resolve) => {
            console.log('Starting comprehensive scraping...');
            
            const allReviews = [];
            const starRatings = [5, 4, 3, 2, 1];
            const targetPerStar = 10; // Match Python script
            
            // Helper functions (redefined for page context)
            function preprocessTextMinimal(text) {
                if (!text || text === "N/A") return "";
                text = text.replace(/\n/g, " ").replace(/\t/g, " ").replace(/\r/g, " ");
                text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                text = text.replace(/\s+/g, ' ').trim();
                return text;
            }

            function getStarRating(reviewElement) {
                try {
                    console.log('Attempting to detect star rating...');
                    
                    // Method 1: Count filled star images (most accurate for Lazada)
                    const starImages = reviewElement.querySelectorAll('.star img, img[src*="star"], [class*="star"] img');
                    let filledStars = 0;
                    
                    if (starImages.length > 0) {
                        starImages.forEach((star, index) => {
                            const src = star.getAttribute('src') || '';
                            // Check for various filled star indicators
                            if (src.includes('TB19ZvEgfDH8KJjy1XcXXcpdXXa-64-64.png') || 
                                src.includes('filled') || 
                                src.includes('full') ||
                                star.alt === 'filled star' ||
                                star.title === 'filled star') {
                                filledStars++;
                            }
                        });
                        
                        if (filledStars > 0 && filledStars <= 5) {
                            console.log(`Star rating detected via images: ${filledStars} stars`);
                            return filledStars;
                        }
                    }
                    
                    // Method 2: Look for star containers with different approaches
                    const starContainers = [
                        reviewElement.querySelector('.star'),
                        reviewElement.querySelector('[class*="star"]'),
                        reviewElement.querySelector('[class*="rating"]'),
                        reviewElement.querySelector('.score')
                    ].filter(Boolean);
                    
                    for (const container of starContainers) {
                        // Check data attributes
                        const dataRating = container.getAttribute('data-rating') || 
                                          container.getAttribute('data-score') || 
                                          container.getAttribute('data-stars');
                        if (dataRating) {
                            const rating = parseInt(dataRating);
                            if (rating >= 1 && rating <= 5) {
                                console.log(`Star rating detected via data attribute: ${rating} stars`);
                                return rating;
                            }
                        }
                        
                        // Check for CSS classes that might indicate rating
                        const classList = container.className.toLowerCase();
                        for (let i = 1; i <= 5; i++) {
                            if (classList.includes(`star-${i}`) || 
                                classList.includes(`rating-${i}`) || 
                                classList.includes(`score-${i}`)) {
                                console.log(`Star rating detected via CSS class: ${i} stars`);
                                return i;
                            }
                        }
                        
                        // Count child elements that might represent stars
                        const starChildren = container.querySelectorAll('[class*="filled"], [class*="active"], .on');
                        if (starChildren.length > 0 && starChildren.length <= 5) {
                            console.log(`Star rating detected via filled children: ${starChildren.length} stars`);
                            return starChildren.length;
                        }
                    }
                    
                    // Method 3: Look in parent elements (sometimes rating is outside review content)
                    let parent = reviewElement.parentElement;
                    let depth = 0;
                    
                    while (parent && depth < 3) {
                        const parentImages = parent.querySelectorAll('img[src*="TB19ZvEgfDH8KJjy1XcXXcpdXXa"]');
                        if (parentImages.length > 0) {
                            console.log(`Star rating detected in parent (depth ${depth}): ${parentImages.length} stars`);
                            return parentImages.length;
                        }
                        parent = parent.parentElement;
                        depth++;
                    }
                    
                    // Method 4: Text pattern search
                    const reviewText = reviewElement.textContent || '';
                    const textPatterns = [
                        /(\d+)\s*(?:star|stars)/i,
                        /(\d+)\s*\/\s*5/i,
                        /(\d+)\s*out\s*of\s*5/i,
                        /rating[:\s]*(\d+)/i,
                        /score[:\s]*(\d+)/i
                    ];
                    
                    for (const pattern of textPatterns) {
                        const match = reviewText.match(pattern);
                        if (match) {
                            const rating = parseInt(match[1]);
                            if (rating >= 1 && rating <= 5) {
                                console.log(`Star rating detected from text pattern: ${rating} stars`);
                                return rating;
                            }
                        }
                    }
                    
                    // Method 5: Look for specific Lazada rating structures
                    const lazadaRatingSelectors = [
                        '.next-rating',
                        '[data-spm*="rating"]',
                        '.rating-stars',
                        '.product-rating'
                    ];
                    
                    for (const selector of lazadaRatingSelectors) {
                        const ratingElement = reviewElement.querySelector(selector);
                        if (ratingElement) {
                            const filledStars = ratingElement.querySelectorAll('[class*="filled"], [class*="on"], .active');
                            if (filledStars.length > 0 && filledStars.length <= 5) {
                                console.log(`Star rating detected via Lazada structure: ${filledStars.length} stars`);
                                return filledStars.length;
                            }
                        }
                    }
                    
                    console.log('Could not detect star rating with any method');
                    return null;
                    
                } catch (error) {
                    console.error('Error in getStarRating:', error);
                    return null;
                }
            }

            async function clickStarFilter(starRating) {
                try {
                    console.log(`Attempting to filter for ${starRating} stars...`);
                    
                    // Find filter dropdown - multiple selectors to try
                    const filterSelectors = [
                        "#module_product_review > div > div > div:nth-child(2) > div > div:nth-child(2)",
                        "[data-spm-anchor-id*='ratings_reviews']",
                        ".pdp-mod-review .filter-dropdown",
                        ".review-filter-dropdown"
                    ];

                    let filterElement = null;
                    for (const selector of filterSelectors) {
                        try {
                            filterElement = document.querySelector(selector);
                            if (filterElement && filterElement.offsetParent !== null) {
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (!filterElement) {
                        console.log(`Could not find filter dropdown for ${starRating} stars`);
                        return false;
                    }

                    // Scroll to and click the filter element
                    filterElement.scrollIntoView({behavior: 'smooth', block: 'center'});
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    // Try clicking
                    try {
                        filterElement.click();
                    } catch (e) {
                        try {
                            filterElement.dispatchEvent(new MouseEvent('click', {bubbles: true}));
                        } catch (e2) {
                            console.log('Click failed');
                            return false;
                        }
                    }

                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Look for dropdown menu
                    const dropdownSelectors = [
                        "[data-tag='gateway-wrapper'] .next-menu-content",
                        ".next-menu-content",
                        ".filter-dropdown-menu",
                        ".review-filter-menu"
                    ];

                    let dropdownMenu = null;
                    for (const selector of dropdownSelectors) {
                        try {
                            dropdownMenu = document.querySelector(selector);
                            if (dropdownMenu && dropdownMenu.offsetParent !== null) {
                                break;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    if (!dropdownMenu) {
                        console.log(`Dropdown menu not found for ${starRating} stars`);
                        return false;
                    }

                    // Find and check if the specific star rating option exists and is enabled
                    const starOptions = dropdownMenu.querySelectorAll('li');
                    let targetOption = null;
                    let isDisabled = false;

                    for (const option of starOptions) {
                        const optionText = option.textContent.trim().toLowerCase();
                        if (optionText.includes(`${starRating}`) && optionText.includes('star')) {
                            targetOption = option;
                            
                            // Check if option is disabled - multiple ways to detect this
                            isDisabled = (
                                option.disabled ||
                                option.classList.contains('disabled') ||
                                option.classList.contains('next-disabled') ||
                                option.getAttribute('aria-disabled') === 'true' ||
                                option.style.pointerEvents === 'none' ||
                                option.style.opacity === '0.5' ||
                                option.style.color === 'grey' ||
                                option.style.color === 'gray' ||
                                option.classList.contains('unavailable') ||
                                option.classList.contains('no-reviews') ||
                                // Check if it has (0) reviews indicator
                                optionText.includes('(0)') ||
                                optionText.includes('no reviews') ||
                                // Check for visual indicators of being disabled
                                getComputedStyle(option).opacity < 1 ||
                                getComputedStyle(option).pointerEvents === 'none'
                            );
                            
                            break;
                        }
                    }

                    if (!targetOption) {
                        console.log(`Could not find ${starRating} star option in dropdown`);
                        return false;
                    }

                    if (isDisabled) {
                        console.log(`${starRating} star filter is DISABLED (no reviews available) - skipping`);
                        
                        // Close the dropdown before returning
                        try {
                            // Click outside dropdown to close it
                            document.body.click();
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        } catch (e) {
                            console.log('Could not close dropdown');
                        }
                        
                        return 'DISABLED'; // Special return value to indicate disabled state
                    }

                    // Option exists and is enabled, try to click it
                    try {
                        targetOption.click();
                        await new Promise(resolve => setTimeout(resolve, 3000));
                        console.log(`Successfully selected ${starRating} star filter`);
                        return true;
                    } catch (e) {
                        try {
                            targetOption.dispatchEvent(new MouseEvent('click', {bubbles: true}));
                            await new Promise(resolve => setTimeout(resolve, 3000));
                            console.log(`Successfully selected ${starRating} star filter`);
                            return true;
                        } catch (e2) {
                            console.log(`Failed to click ${starRating} star option`);
                            return false;
                        }
                    }

                } catch (error) {
                    console.log(`Error clicking star filter for ${starRating} stars:`, error);
                    return false;
                }
            }

            async function goToNextPage() {
                try {
                    const nextButtons = document.querySelectorAll("button.next-btn.next-btn-normal.next-btn-medium.next-pagination-item.next");
                    if (nextButtons.length === 0) {
                        return false;
                    }

                    const nextButton = nextButtons[0];
                    if (nextButton.disabled) {
                        return false;
                    }

                    nextButton.scrollIntoView({behavior: 'smooth', block: 'center'});
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    nextButton.click();
                    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait for page load
                    return true;
                } catch (error) {
                    console.log('Error going to next page:', error);
                    return false;
                }
            }

            async function resetFilters() {
                try {
                    // Try to reset filters by clicking "All" or similar
                    const resetSelectors = [
                        "button[data-testid='filter-reset']",
                        ".filter-reset",
                        ".clear-filters"
                    ];

                    for (const selector of resetSelectors) {
                        try {
                            const resetButton = document.querySelector(selector);
                            if (resetButton && resetButton.offsetParent !== null) {
                                resetButton.click();
                                await new Promise(resolve => setTimeout(resolve, 2000));
                                return true;
                            }
                        } catch (e) {
                            continue;
                        }
                    }

                    // If no reset button, try clicking back to all reviews
                    return await clickStarFilter("all");
                } catch (error) {
                    console.log('Could not reset filters:', error);
                    return false;
                }
            }

            async function scrapeReviewsForStarRating(starRating) {
                console.log(`\n=== Scraping ${starRating}-star reviews (ALL PAGES) ===`);
                
                const reviewsForThisStar = [];
                let reviewsScraped = 0;
                const maxPages = 50; // Increased limit for comprehensive scraping
                let currentPage = 0;
                let consecutiveEmptyPages = 0;
                const maxEmptyPages = 5; // Increased tolerance

                // Apply star filter and check if it's available
                const filterResult = await clickStarFilter(starRating);
                
                if (filterResult === 'DISABLED') {
                    console.log(`${starRating} star filter is disabled (no reviews) - resetting filters and moving to next star`);
                    
                    // Reset filters before moving to next star
                    await resetFilters();
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    return []; // Return empty array immediately for disabled filters
                }
                
                if (filterResult === true) {
                    console.log(`Successfully applied ${starRating} star filter`);
                } else {
                    console.log(`Failed to apply ${starRating} star filter, continuing anyway`);
                }

                while (currentPage < maxPages) {
                    currentPage++;
                    console.log(`Scraping page ${currentPage} for ${starRating}-star reviews...`);

                    try {
                        // Wait for reviews to load
                        await new Promise(resolve => setTimeout(resolve, 3000)); // Increased wait time
                        
                        const reviewItems = document.querySelectorAll('.pdp-mod-review .mod-reviews .item');
                        
                        if (reviewItems.length === 0) {
                            console.log('No reviews found on this page');
                            consecutiveEmptyPages++;
                            if (consecutiveEmptyPages >= maxEmptyPages) {
                                console.log('Too many empty pages, stopping');
                                break;
                            }
                            
                            // Try to go to next page anyway
                            const nextPageSuccess = await goToNextPage();
                            if (!nextPageSuccess) {
                                console.log('No more pages available');
                                break;
                            }
                            continue;
                        } else {
                            consecutiveEmptyPages = 0;
                        }

                        let pageReviewsCount = 0;
                        let validReviewsOnPage = 0;
                        
                        for (const reviewItem of reviewItems) {
                            try {
                                // Extract review text
                                const contentElement = reviewItem.querySelector('.content');
                                const rawText = contentElement ? contentElement.textContent.trim() : '';

                                if (!rawText || rawText === "N/A" || rawText.length < 10) {
                                    continue;
                                }

                                // Get star rating and VALIDATE it matches the filter
                                const reviewStarRating = getStarRating(reviewItem);
                                
                                // STAR RATING VALIDATION - Skip if doesn't match filter
                                if (reviewStarRating !== null && reviewStarRating !== starRating) {
                                    console.log(`Skipping review: found ${reviewStarRating} stars when filtering for ${starRating} stars`);
                                    continue;
                                }
                                
                                // If we can't detect star rating, use filter rating but log it
                                const finalStarRating = reviewStarRating || starRating;
                                if (reviewStarRating === null) {
                                    console.log(`Could not detect star rating for review, using filter rating: ${starRating}`);
                                }

                                // Process text
                                const cleanedText = preprocessTextMinimal(rawText);

                                // Check for duplicates to avoid adding same review multiple times
                                const isDuplicate = reviewsForThisStar.some(existingReview => 
                                    existingReview.text === cleanedText
                                );
                                
                                if (isDuplicate) {
                                    console.log('Skipping duplicate review');
                                    continue;
                                }

                                // Add to results
                                reviewsForThisStar.push({
                                    text: cleanedText,
                                    sentimentText: cleanedText, // Simplified for extension
                                    starRating: finalStarRating,
                                    rawText: rawText
                                });

                                reviewsScraped++;
                                pageReviewsCount++;
                                validReviewsOnPage++;

                            } catch (error) {
                                console.log('Error processing review:', error);
                            }
                        }

                        console.log(`Page ${currentPage}: Found ${reviewItems.length} items, processed ${pageReviewsCount}, valid ${starRating}-star reviews: ${validReviewsOnPage} (Total: ${reviewsScraped})`);

                        // If we got very few valid reviews on this page, it might indicate filter issues
                        if (validReviewsOnPage === 0 && reviewItems.length > 0) {
                            console.log(`Warning: No valid ${starRating}-star reviews found on page with ${reviewItems.length} reviews - possible filter mismatch`);
                        }

                        // Try to go to next page
                        const nextPageSuccess = await goToNextPage();
                        if (!nextPageSuccess) {
                            console.log('No more pages available - reached end');
                            break;
                        }

                    } catch (error) {
                        console.log('Error scraping page:', error);
                        consecutiveEmptyPages++;
                        if (consecutiveEmptyPages >= maxEmptyPages) {
                            console.log('Too many consecutive errors, stopping');
                            break;
                        }
                        
                        // Still try to go to next page
                        const nextPageSuccess = await goToNextPage();
                        if (!nextPageSuccess) {
                            break;
                        }
                    }
                }

                console.log(`Total ${starRating}-star reviews scraped: ${reviewsScraped}`);
                return reviewsForThisStar;
            }

            // Main scraping loop - scrape ALL reviews for each star rating
            try {
                // Scroll to reviews section first
                const reviewsSections = [
                    document.querySelector('.pdp-mod-review'),
                    document.querySelector('#module_product_review'),
                    document.querySelector('.mod-reviews')
                ];
                
                const reviewsSection = reviewsSections.find(section => section && section.offsetParent !== null);
                if (reviewsSection) {
                    reviewsSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }

                // Track disabled star ratings
                const disabledStarRatings = [];
                const availableStarRatings = [];

                // Scrape ALL reviews for each star rating
                for (const starRating of starRatings) {
                    console.log(`\n=== Starting ${starRating}-star review collection ===`);
                    
                    const reviewsForStar = await scrapeReviewsForStarRating(starRating);
                    
                    if (reviewsForStar.length === 0) {
                        disabledStarRatings.push(starRating);
                        console.log(`${starRating}-star rating had no reviews (disabled or empty)`);
                    } else {
                        availableStarRatings.push(starRating);
                        allReviews.push(...reviewsForStar);
                        console.log(`Completed ${starRating}-star collection: ${reviewsForStar.length} reviews`);
                    }

                    // Reset filters between star ratings
                    await resetFilters();
                    await new Promise(resolve => setTimeout(resolve, 3000));
                }

                console.log(`\n=== COMPREHENSIVE SCRAPING COMPLETE ===`);
                console.log(`Total reviews collected: ${allReviews.length}`);
                console.log(`Available star ratings: ${availableStarRatings.join(', ')}`);
                if (disabledStarRatings.length > 0) {
                    console.log(`Disabled/empty star ratings: ${disabledStarRatings.join(', ')}`);
                }
                
                // Log breakdown by star rating
                const breakdown = {};
                allReviews.forEach(review => {
                    const rating = review.starRating;
                    breakdown[rating] = (breakdown[rating] || 0) + 1;
                });
                console.log('Final breakdown by star rating:', breakdown);
                
                resolve(allReviews);

            } catch (error) {
                console.error('Error in comprehensive scraping:', error);
                resolve(allReviews); // Return what we have so far
            }
        });
    }

    async function analyzeSentiment(reviews) {
        try {
            // Prepare texts for batch prediction
            const texts = reviews.map(review => review.sentimentText || review.text);
            
            statusDiv.textContent = `Found ${reviews.length} reviews. Analyzing with comprehensive models...`;
            
            // Try multiple API URLs for comprehensive analysis
            const apiUrls = [
                'http://localhost:5000/predict_comprehensive_batch',
                'http://127.0.0.1:5000/predict_comprehensive_batch'
            ];
            
            let response = null;
            let lastError = null;
            
            for (const url of apiUrls) {
                try {
                    console.log(`Trying comprehensive API URL: ${url}`);
                    response = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ texts: texts })
                    });
                    
                    if (response.ok) {
                        console.log(`Successfully connected to: ${url}`);
                        break;
                    } else {
                        console.log(`Failed to connect to: ${url} (Status: ${response.status})`);
                    }
                } catch (error) {
                    console.log(`Error connecting to: ${url}`, error);
                    lastError = error;
                    continue;
                }
            }
            
            if (!response || !response.ok) {
                throw new Error(`All comprehensive API URLs failed. Last error: ${lastError?.message || 'Unknown'}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Combine original reviews with comprehensive predictions
            return reviews.map((review, index) => {
                const comprehensiveResult = data.results[index];
                const sentimentResult = comprehensiveResult.sentiment_analysis;
                const featureResult = comprehensiveResult.feature_analysis;
                
                return {
                    ...review,
                    sentiment: {
                        label: sentimentResult.predicted_sentiment,
                        confidence: Math.max(...Object.values(sentimentResult.confidence_scores)),
                        scores: sentimentResult.confidence_scores
                    },
                    features: featureResult.feature_predictions || {}
                };
            });
            
        } catch (error) {
            console.error('Comprehensive analysis failed:', error);
            statusDiv.textContent = `Found ${reviews.length} reviews. Comprehensive API failed: ${error.message}. Using fallback analysis.`;
            
            // Fallback to basic sentiment analysis
            return reviews.map(review => {
                const sentiment = getBasicSentiment(review.sentimentText || review.text);
                return {
                    ...review,
                    sentiment: sentiment,
                    features: {} // Empty features
                };
            });
        }
    }

    function getBasicSentiment(text) {
        // Simple keyword-based sentiment analysis as placeholder
        const positiveWords = ['good', 'great', 'excellent', 'amazing', 'perfect', 'love', 'awesome', 'fantastic', 'wonderful', 'best', 'nice', 'happy', 'satisfied', 'recommend'];
        const negativeWords = ['bad', 'terrible', 'awful', 'hate', 'worst', 'horrible', 'disappointing', 'poor', 'useless', 'broken', 'defective', 'waste'];
        
        const lowerText = text.toLowerCase();
        let positiveCount = 0;
        let negativeCount = 0;
        
        positiveWords.forEach(word => {
            if (lowerText.includes(word)) positiveCount++;
        });
        
        negativeWords.forEach(word => {
            if (lowerText.includes(word)) negativeCount++;
        });
        
        if (positiveCount > negativeCount) {
            return { label: 'POSITIVE', confidence: 0.7 + (positiveCount * 0.1) };
        } else if (negativeCount > positiveCount) {
            return { label: 'NEGATIVE', confidence: 0.7 + (negativeCount * 0.1) };
        } else {
            return { label: 'NEUTRAL', confidence: 0.6 };
        }
    }

    // Display comprehensive results with per-star analysis
    function displayComprehensiveResults(reviews) {
        statusDiv.textContent = `Deep analysis complete! Analyzed ${reviews.length} reviews.`;
        
        // Group reviews by star rating
        const reviewsByStars = {};
        for (let i = 1; i <= 5; i++) {
            reviewsByStars[i] = reviews.filter(review => review.starRating === i);
        }

        // Calculate overall statistics
        const totalReviews = reviews.length;
        let totalCredibilityScore = 0;
        const overallStats = {
            consistent: 0,
            partiallyConsistent: 0,
            inconsistent: 0,
            unknown: 0,
            highAuth: 0,
            moderateAuth: 0,
            lowAuth: 0,
            unknownAuth: 0
        };

        // Create star-by-star analysis
        const starAnalysis = {};
        for (let starRating = 5; starRating >= 1; starRating--) {
            const starReviews = reviewsByStars[starRating];
            if (starReviews.length === 0) continue;

            const analysis = analyzeStarRating(starReviews);
            starAnalysis[starRating] = analysis;
            
            // Add to overall stats
            totalCredibilityScore += analysis.avgCredibilityScore * starReviews.length;
            overallStats.consistent += analysis.consistency.CONSISTENT;
            overallStats.partiallyConsistent += analysis.consistency['PARTIALLY CONSISTENT'];
            overallStats.inconsistent += analysis.consistency.INCONSISTENT;
            overallStats.unknown += analysis.consistency.UNKNOWN;
            overallStats.highAuth += analysis.authenticity.HIGH;
            overallStats.moderateAuth += analysis.authenticity.MODERATE;
            overallStats.lowAuth += analysis.authenticity.LOW;
            overallStats.unknownAuth += analysis.authenticity.UNKNOWN;
        }

        const overallAvgCredibility = totalCredibilityScore / totalReviews;

        // Display results
        resultsDiv.innerHTML = '';

        // 1. Overall Summary
        const overallDiv = document.createElement('div');
        overallDiv.className = 'overall-summary';
        overallDiv.innerHTML = `
            <div class="overall-credibility">
                Overall Credibility: ${getCredibilityLabel(overallAvgCredibility)}
            </div>
            <div style="font-size: 14px; margin-bottom: 10px;">
                Average Score: ${overallAvgCredibility.toFixed(2)}/3.0
            </div>
            <div class="summary-stats">
                <div class="stat-item">
                    <span class="stat-number">${overallStats.consistent}</span>
                    <span>Consistent</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${overallStats.inconsistent}</span>
                    <span>Inconsistent</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${overallStats.highAuth}</span>
                    <span>High Auth</span>
                </div>
                <div class="stat-item">
                    <span class="stat-number">${overallStats.lowAuth}</span>
                    <span>Low Auth</span>
                </div>
            </div>
        `;
        resultsDiv.appendChild(overallDiv);

        // 2. Star-by-star breakdown
        for (let starRating = 5; starRating >= 1; starRating--) {
            if (!starAnalysis[starRating]) continue;
            
            const analysis = starAnalysis[starRating];
            const starDiv = createStarSummaryDiv(starRating, analysis);
            resultsDiv.appendChild(starDiv);
        }
    }

    function analyzeStarRating(reviews) {
        const consistency = { CONSISTENT: 0, 'PARTIALLY CONSISTENT': 0, INCONSISTENT: 0, UNKNOWN: 0 };
        const authenticity = { HIGH: 0, MODERATE: 0, LOW: 0, UNKNOWN: 0 };
        const credibility = { HIGH: 0, MODERATE: 0, LOW: 0 };
        
        let totalCredibilityScore = 0;

        reviews.forEach(review => {
            const consistencyLabel = getConsistencyLabel(review.sentiment.label, review.starRating);
            const authenticityLabel = getAuthenticityScore(review.features);
            const credibilityLabel = getCredibilityScore(consistencyLabel, authenticityLabel);
            
            consistency[consistencyLabel]++;
            authenticity[authenticityLabel]++;
            credibility[credibilityLabel]++;
            
            // Convert credibility to numeric score (HIGH=3, MODERATE=2, LOW=1)
            const credibilityScore = credibilityLabel === 'HIGH' ? 3 : credibilityLabel === 'MODERATE' ? 2 : 1;
            totalCredibilityScore += credibilityScore;
        });

        return {
            totalReviews: reviews.length,
            consistency,
            authenticity,
            credibility,
            avgCredibilityScore: totalCredibilityScore / reviews.length,
            dominantCredibility: Object.entries(credibility).reduce((a, b) => credibility[a[0]] > credibility[b[0]] ? a : b)[0]
        };
    }

    function createStarSummaryDiv(starRating, analysis) {
        const starDiv = document.createElement('div');
        starDiv.className = 'star-summary';
        
        const credibilityPercentages = {
            HIGH: Math.round((analysis.credibility.HIGH / analysis.totalReviews) * 100),
            MODERATE: Math.round((analysis.credibility.MODERATE / analysis.totalReviews) * 100),
            LOW: Math.round((analysis.credibility.LOW / analysis.totalReviews) * 100)
        };

        // Create star display without emojis
        const starDisplay = `${starRating} STAR${starRating > 1 ? 'S' : ''}`;

        starDiv.innerHTML = `
            <div class="star-header">
                <div class="star-rating">
                    ${starDisplay} (${analysis.totalReviews} reviews)
                </div>
                <div class="star-credibility" style="background: ${getCredibilityColor(analysis.dominantCredibility)};">
                    ${analysis.dominantCredibility} CREDIBILITY
                </div>
            </div>
            
            <div style="margin: 10px 0;">
                <div style="font-size: 11px; color: #666; margin-bottom: 5px;">Credibility Distribution:</div>
                <div style="display: flex; gap: 5px;">
                    <div class="progress-bar" style="flex: ${credibilityPercentages.HIGH};">
                        <div class="progress-fill" style="background: #28a745; width: 100%;">
                            ${credibilityPercentages.HIGH}% HIGH
                        </div>
                    </div>
                    <div class="progress-bar" style="flex: ${credibilityPercentages.MODERATE};">
                        <div class="progress-fill" style="background: #ffc107; width: 100%;">
                            ${credibilityPercentages.MODERATE}% MOD
                        </div>
                    </div>
                    <div class="progress-bar" style="flex: ${credibilityPercentages.LOW};">
                        <div class="progress-fill" style="background: #dc3545; width: 100%;">
                            ${credibilityPercentages.LOW}% LOW
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; justify-content: space-between; font-size: 10px; color: #666;">
                <div>
                    <strong>Consistency:</strong> 
                    OK:${analysis.consistency.CONSISTENT} PARTIAL:${analysis.consistency['PARTIALLY CONSISTENT']} BAD:${analysis.consistency.INCONSISTENT}
                </div>
                <div>
                    <strong>Authenticity:</strong> 
                    H${analysis.authenticity.HIGH} M${analysis.authenticity.MODERATE} L${analysis.authenticity.LOW}
                </div>
            </div>
        `;
        
        return starDiv;
    }

    function getCredibilityLabel(avgScore) {
        if (avgScore >= 2.5) return 'HIGH';
        if (avgScore >= 1.5) return 'MODERATE';
        return 'LOW';
    }

    // Display results for current page analysis (existing function with original detailed breakdown)
    function displayResultsInPopup(reviews) {
        statusDiv.textContent = `Analysis complete! Found ${reviews.length} reviews.`;
        
        // Calculate credibility distribution first
        const credibilityCounts = { HIGH: 0, MODERATE: 0, LOW: 0 };
        
        reviews.forEach(review => {
            const consistency = getConsistencyLabel(review.sentiment.label, review.starRating);
            const authenticity = getAuthenticityScore(review.features);
            const credibility = getCredibilityScore(consistency, authenticity);
            credibilityCounts[credibility]++;
        });
        
        // Calculate credibility percentages
        const highCredibilityPercentage = Math.round((credibilityCounts.HIGH / reviews.length) * 100) || 0;
        const moderateCredibilityPercentage = Math.round((credibilityCounts.MODERATE / reviews.length) * 100) || 0;
        const lowCredibilityPercentage = Math.round((credibilityCounts.LOW / reviews.length) * 100) || 0;
        
        // Find ALL credibility levels with the maximum count (handle ties)
        const maxCount = Math.max(...Object.values(credibilityCounts));
        const dominantCredibilityLevels = Object.entries(credibilityCounts)
            .filter(([_, count]) => count === maxCount)
            .map(([credibility, _]) => credibility);
        
        // 1. CREDIBILITY DISTRIBUTION AT TOP (Enhanced and bigger)
        const credibilityDiv = document.createElement('div');
        credibilityDiv.style.cssText = 'margin-top: 15px; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 10px; font-size: 12px; box-shadow: 0 4px 8px rgba(0,0,0,0.2);';
        
        // Create the percentage display HTML with tie handling
        const percentageDisplayHTML = `
            <div style="display: flex; justify-content: space-around; align-items: center; margin-bottom: 15px;">
                <div style="text-align: center; ${dominantCredibilityLevels.includes('HIGH') ? 'transform: scale(1.15); z-index: 2;' : ''}">
                    <div style="font-size: ${dominantCredibilityLevels.includes('HIGH') ? '24px' : '20px'}; font-weight: bold; color: #90EE90; ${dominantCredibilityLevels.includes('HIGH') ? 'text-shadow: 0 0 10px rgba(144,238,144,0.5);' : ''}">
                        ${highCredibilityPercentage}%
                    </div>
                    <div style="font-size: 10px; color: rgba(255,255,255,0.9);">HIGH</div>
                    <div style="font-size: 9px; color: rgba(255,255,255,0.7);">(${credibilityCounts.HIGH})</div>
                </div>
                <div style="text-align: center; ${dominantCredibilityLevels.includes('MODERATE') ? 'transform: scale(1.15); z-index: 2;' : ''}">
                    <div style="font-size: ${dominantCredibilityLevels.includes('MODERATE') ? '24px' : '20px'}; font-weight: bold; color: #FFD700; ${dominantCredibilityLevels.includes('MODERATE') ? 'text-shadow: 0 0 10px rgba(255,215,0,0.5);' : ''}">
                        ${moderateCredibilityPercentage}%
                    </div>
                    <div style="font-size: 10px; color: rgba(255,255,255,0.9);">MODERATE</div>
                    <div style="font-size: 9px; color: rgba(255,255,255,0.7);">(${credibilityCounts.MODERATE})</div>
                </div>
                <div style="text-align: center; ${dominantCredibilityLevels.includes('LOW') ? 'transform: scale(1.15); z-index: 2;' : ''}">
                    <div style="font-size: ${dominantCredibilityLevels.includes('LOW') ? '24px' : '20px'}; font-weight: bold; color: #FFB6C1; ${dominantCredibilityLevels.includes('LOW') ? 'text-shadow: 0 0 10px rgba(255,182,193,0.5);' : ''}">
                        ${lowCredibilityPercentage}%
                    </div>
                    <div style="font-size: 10px; color: rgba(255,255,255,0.9);">LOW</div>
                    <div style="font-size: 9px; color: rgba(255,255,255,0.7);">(${credibilityCounts.LOW})</div>
                </div>
            </div>
        `;
        
        // Generate dominant credibility text and message
        let dominantText, dominantMessage, dominantColor;
        if (dominantCredibilityLevels.length === 1) {
            dominantText = `DOMINANT: ${dominantCredibilityLevels[0]} CREDIBILITY`;
            dominantMessage = getCredibilityMessage(dominantCredibilityLevels[0]);
            dominantColor = getCredibilityGlowColor(dominantCredibilityLevels[0]);
        } else if (dominantCredibilityLevels.length === 2) {
            dominantText = `TIE: ${dominantCredibilityLevels.join(' & ')} CREDIBILITY`;
            dominantMessage = `Equal distribution between ${dominantCredibilityLevels.join(' and ').toLowerCase()} credibility`;
            dominantColor = '#FFFFFF'; // White for ties
        } else {
            // All three are tied
            dominantText = `THREE-WAY TIE: ALL CREDIBILITY LEVELS`;
            dominantMessage = `Equal distribution across all credibility levels`;
            dominantColor = '#FFFFFF'; // White for ties
        }
        
        credibilityDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 15px;">
                <div style="font-size: 16px; font-weight: bold; margin-bottom: 5px;">CREDIBILITY ANALYSIS</div>
                <div style="font-size: 11px; color: rgba(255,255,255,0.8);">${reviews.length} reviews analyzed</div>
            </div>
            
            ${percentageDisplayHTML}
            
            <div style="text-align: center; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.3);">
                <div style="font-size: 13px; font-weight: bold; color: ${dominantColor}; text-shadow: 0 0 8px ${dominantColor};">
                    ${dominantText}
                </div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.8); margin-top: 3px;">
                    ${dominantMessage}
                </div>
            </div>
        `;
        
        resultsDiv.appendChild(credibilityDiv);
        
        // 2. INDIVIDUAL REVIEWS SECTION (restored original detailed version)
        const reviewsDiv = document.createElement('div');
        reviewsDiv.style.cssText = 'margin-top: 15px; max-height: 250px; overflow-y: auto;';
        
        reviews.forEach((review, index) => {
            const consistency = getConsistencyLabel(review.sentiment.label, review.starRating);
            const authenticity = getAuthenticityScore(review.features);
            const credibility = getCredibilityScore(consistency, authenticity);
            
            const reviewDiv = document.createElement('div');
            reviewDiv.style.cssText = 'margin: 8px 0; padding: 10px; background: white; border-radius: 6px; border: 1px solid #ddd; font-size: 11px;';
            
            // Header with review number and star rating
            const starDisplay = review.starRating ? `${review.starRating} stars` : 'No rating';
            
            // Badges section
            const badgesHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                    <strong style="font-size: 12px;">Review ${index + 1}</strong>
                    <span style="font-size: 10px; color: #666;">${starDisplay}</span>
                </div>
                <div style="display: flex; gap: 6px; margin-bottom: 8px; flex-wrap: wrap;">
                    <span style="background: ${getConsistencyColor(consistency)}; color: white; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 10px;">
                        ${consistency}
                    </span>
                    <span style="background: ${getAuthenticityColor(authenticity)}; color: white; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 10px;">
                        ${authenticity} AUTHENTICITY
                    </span>
                    <span style="background: ${getCredibilityColor(credibility)}; color: white; padding: 3px 8px; border-radius: 12px; font-weight: bold; font-size: 10px;">
                        ${credibility} CREDIBILITY
                    </span>
                </div>
            `;
            
            // Review text preview
            const reviewTextHTML = `
                <div style="padding: 6px; background: #f9f9f9; border-radius: 4px; font-size: 10px; color: #333; line-height: 1.3; margin-bottom: 6px;">
                    ${review.text.substring(0, 120)}${review.text.length > 120 ? '...' : ''}
                </div>
            `;
            
            // Details section (consistency and authenticity breakdown)
            const sentimentDisplay = review.sentiment.label;
            
            // Feature breakdown (authenticity warnings)
            const featureLabels = {
                'PD_F': 'Used template for reviewing the product\'s features',
                'PD_F_TMP': 'Used Lazada template',
                'MAN_UI': 'Low user input',
                'QUAL': 'Low on information', 
                'SPM': 'Potential spam'
            };
            
            let featureBreakdown = 'No API data';
            if (review.features && Object.keys(review.features).length > 0) {
                const warningFeatures = [];
                Object.entries(featureLabels).forEach(([key, label]) => {
                    const feature = review.features[key];
                    if (feature) {
                        const badFeatures = ['PD_F', 'PD_F_TMP', 'SPM'];
                        const isWarning = badFeatures.includes(key) ? 
                            (feature.prediction === 1) : 
                            (feature.prediction === 0 && key === 'MAN_UI') || (feature.prediction === 0 && key === 'QUAL');
                        
                        if (isWarning) {
                            warningFeatures.push(label);
                        }
                    }
                });
                
                featureBreakdown = warningFeatures.length > 0 ? 
                    warningFeatures.map(warning => `<span style="color: #dc3545; font-size: 9px; display: block; margin-top: 2px;">${warning}</span>`).join('') :
                    '<span style="color: #28a745; font-size: 9px;">No authenticity warnings detected</span>';
            }
            
            const detailsHTML = `
                <div style="font-size: 9px; color: #666; border-top: 1px solid #eee; padding-top: 4px;">
                    <div style="margin-bottom: 5px;"><strong>Consistency:</strong> ${starDisplay} vs ${sentimentDisplay}</div>
                    <div><strong>Authenticity Warnings:</strong> ${featureBreakdown}</div>
                </div>
            `;
            
            reviewDiv.innerHTML = badgesHTML + reviewTextHTML + detailsHTML;
            reviewsDiv.appendChild(reviewDiv);
        });
        
        resultsDiv.appendChild(reviewsDiv);
        
        // 3. SUMMARY SECTION AT BOTTOM (Simplified)
        const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
        const consistencyCounts = { CONSISTENT: 0, 'PARTIALLY CONSISTENT': 0, INCONSISTENT: 0, UNKNOWN: 0 };
        const authenticityCounts = { HIGH: 0, MODERATE: 0, LOW: 0, UNKNOWN: 0 };
        
        reviews.forEach(review => {
            sentimentCounts[review.sentiment.label]++;
            
            const consistency = getConsistencyLabel(review.sentiment.label, review.starRating);
            consistencyCounts[consistency]++;
            
            const authenticity = getAuthenticityScore(review.features);
            authenticityCounts[authenticity]++;
        });
        
        const summaryDiv = document.createElement('div');
        summaryDiv.style.cssText = 'margin-top: 15px; padding: 10px; background: #f8f9fa; color: #333; border-radius: 6px; font-size: 10px; border: 1px solid #ddd;';
        
        const consistencySummary = Object.entries(consistencyCounts)
            .filter(([_, count]) => count > 0)
            .map(([consistency, count]) => `${consistency}: ${count}`)
            .join(' | ');
            
        const authenticitySummary = Object.entries(authenticityCounts)
            .filter(([_, count]) => count > 0)
            .map(([authenticity, count]) => `${authenticity}: ${count}`)
            .join(' | ');
        
        summaryDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 6px;">
                <strong style="font-size: 11px;">Additional Details</strong>
            </div>
            <div style="font-size: 9px; line-height: 1.4;">
                <strong>Consistency:</strong> ${consistencySummary}<br>
                <strong>Authenticity:</strong> ${authenticitySummary}
            </div>
        `;
        resultsDiv.appendChild(summaryDiv);
    }

    // NEW FUNCTION: Inject results into the actual Lazada page
    async function injectResultsIntoPage(reviewsWithSentiment, tabId) {
        try {
            console.log('Injecting results into Lazada page...');
            
            await chrome.scripting.executeScript({
                target: {tabId: tabId},
                func: (reviewsData) => {
                    console.log('Starting page injection with data:', reviewsData);
                    
                    // Helper functions for injection (need to be redefined in page context)
                    function getConsistencyLabel(sentiment, starRating) {
                        if (!starRating) return 'UNKNOWN';
                        
                        const consistencyMap = {
                            'POSITIVE': {
                                5: 'CONSISTENT',
                                4: 'PARTIALLY CONSISTENT',
                                3: 'INCONSISTENT',
                                2: 'INCONSISTENT', 
                                1: 'INCONSISTENT'
                            },
                            'NEUTRAL': {
                                5: 'INCONSISTENT',
                                4: 'PARTIALLY CONSISTENT',
                                3: 'CONSISTENT',
                                2: 'PARTIALLY CONSISTENT',
                                1: 'INCONSISTENT'
                            },
                            'NEGATIVE': {
                                5: 'INCONSISTENT',
                                4: 'INCONSISTENT',
                                3: 'PARTIALLY CONSISTENT',
                                2: 'CONSISTENT',
                                1: 'CONSISTENT'
                            }
                        };
                        
                        return consistencyMap[sentiment]?.[starRating] || 'UNKNOWN';
                    }

                    function getAuthenticityScore(features) {
                        const pdF = features.PD_F?.prediction || 0;
                        const pdFTmp = features.PD_F_TMP?.prediction || 0;
                        const manUI = features.MAN_UI?.prediction || 0;
                        const qual = features.QUAL?.prediction || 0;
                        const spm = features.SPM?.prediction || 0;
                        
                        if (manUI === 0) {
                            return 'LOW';
                        }
                        
                        const pattern = `(${pdF},${pdFTmp},${manUI},${qual},${spm})`;
                        
                        const lowPatterns = [
                            '(0,0,1,0,0)', '(1,0,1,0,0)', '(0,1,1,0,0)', '(1,1,1,0,0)',
                            '(0,1,1,0,1)', '(1,0,1,0,1)', '(1,1,1,0,1)', '(0,0,1,0,1)'
                        ];
                        
                        const moderatePatterns = [
                            '(1,1,1,1,0)', '(1,1,1,1,1)',
                            '(0,1,1,1,1)', '(1,0,1,1,1)'
                        ];
                        
                        const highPatterns = [
                            '(0,1,1,1,0)', '(1,0,1,1,0)', '(0,0,1,1,0)'
                        ];
                        
                        if (lowPatterns.includes(pattern)) {
                            return 'LOW';
                        } else if (moderatePatterns.includes(pattern)) {
                            return 'MODERATE';
                        } else if (highPatterns.includes(pattern)) {
                            return 'HIGH';
                        } else {
                            return 'MODERATE';
                        }
                    }

                    function getCredibilityScore(consistency, authenticity) {
                        const credibilityMap = {
                            'CONSISTENT': {
                                'HIGH': 'HIGH',
                                'MODERATE': 'HIGH', 
                                'LOW': 'MODERATE'
                            },
                            'PARTIALLY CONSISTENT': {
                                'HIGH': 'HIGH',
                                'MODERATE': 'MODERATE',
                                'LOW': 'LOW'
                            },
                            'INCONSISTENT': {
                                'HIGH': 'MODERATE',
                                'MODERATE': 'LOW',
                                'LOW': 'LOW'
                            }
                        };
                        
                        return credibilityMap[consistency]?.[authenticity] || 'LOW';
                    }

                    function getCredibilityColor(credibility) {
                        switch(credibility) {
                            case 'HIGH': return '#28a745';
                            case 'MODERATE': return '#ffc107';
                            case 'LOW': return '#dc3545';
                            default: return '#6c757d';
                        }
                    }

                    function getCredibilityGradientColor(credibility) {
                        switch(credibility) {
                            case 'HIGH': return '#20c997';
                            case 'MODERATE': return '#fd7e14';
                            case 'LOW': return '#e74c3c';
                            default: return '#868e96';
                        }
                    }
                    
                    // Find all review items on the page
                    const reviewItems = document.querySelectorAll('.pdp-mod-review .mod-reviews .item, .review-item, [class*="review-item"]');
                    console.log(`Found ${reviewItems.length} review items on page for injection`);
                    
                    let matchedReviews = 0;
                    
                    reviewItems.forEach((reviewItem, index) => {
                        try {
                            // Remove any existing injected badges first
                            const existingBadges = reviewItem.querySelector('.credibility-analysis-badges');
                            if (existingBadges) {
                                existingBadges.remove();
                            }
                            
                            // Get review text for matching
                            let reviewText = '';
                            const contentSelectors = ['.content', '.review-content', '.review-text', '[class*="content"]'];
                            
                            for (const selector of contentSelectors) {
                                const contentElement = reviewItem.querySelector(selector);
                                if (contentElement) {
                                    reviewText = contentElement.textContent.trim();
                                    break;
                                }
                            }
                            
                            if (!reviewText) {
                                console.log(`Skipping review ${index} - no text found`);
                                return;
                            }
                            
                            // Find matching review from our analysis
                            let matchingReviewData = null;
                            
                            for (const reviewData of reviewsData) {
                                // Try to match by text similarity
                                const similarity = calculateTextSimilarity(reviewText, reviewData.text);
                                if (similarity > 0.8) { // 80% similarity threshold
                                    matchingReviewData = reviewData;
                                    break;
                                }
                            }
                            
                            if (!matchingReviewData) {
                                console.log(`No matching data found for review ${index}`);
                                return;
                            }
                            
                            console.log(`Injecting badges for review ${index}`);
                            
                            // Calculate scores
                            const consistency = getConsistencyLabel(matchingReviewData.sentiment.label, matchingReviewData.starRating);
                            const authenticity = getAuthenticityScore(matchingReviewData.features);
                            const credibility = getCredibilityScore(consistency, authenticity);
                            
                            // Find the target location (.bottom div)
                            let targetLocation = reviewItem.querySelector('.bottom');
                            
                            // If .bottom not found, try alternative selectors
                            if (!targetLocation) {
                                const alternatives = [
                                    '.item-content .bottom',
                                    '[class*="bottom"]',
                                    '.review-bottom',
                                    '[class*="review-bottom"]'
                                ];
                                
                                for (const altSelector of alternatives) {
                                    targetLocation = reviewItem.querySelector(altSelector);
                                    if (targetLocation) break;
                                }
                            }
                            
                            // If still no target, create one at the end of the review item
                            if (!targetLocation) {
                                targetLocation = reviewItem;
                            }
                            
                            // Create badges container
                            const badgesContainer = document.createElement('div');
                            badgesContainer.className = 'credibility-analysis-badges';
                            badgesContainer.style.cssText = `
                                margin-top: 8px; 
                                padding: 8px; 
                                background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%); 
                                border-radius: 6px; 
                                border: 1px solid #e9ecef;
                                font-family: Arial, sans-serif;
                                box-shadow: 0 2px 6px rgba(0,0,0,0.08);
                                text-align: center;
                            `;
                            
                            // Create label text
                            const labelText = document.createElement('span');
                            labelText.style.cssText = `
                                font-size: 9px;
                                color: #6c757d;
                                font-weight: bold;
                                margin-right: 6px;
                                letter-spacing: 0.3px;
                            `;
                            labelText.textContent = 'InCrediView Classification:';
                            
                            // Create the credibility badge
                            const credibilityBadge = document.createElement('span');
                            credibilityBadge.style.cssText = `
                                background: linear-gradient(135deg, ${getCredibilityColor(credibility)} 0%, ${getCredibilityGradientColor(credibility)} 100%); 
                                color: white; 
                                padding: 5px 10px; 
                                border-radius: 14px; 
                                font-weight: bold; 
                                font-size: 9px;
                                text-transform: uppercase;
                                box-shadow: 0 3px 8px rgba(0,0,0,0.2);
                                border: 1px solid white;
                                letter-spacing: 0.5px;
                                text-shadow: 0 1px 2px rgba(0,0,0,0.3);
                                display: inline-block;
                                margin-left: 2px;
                            `;
                            credibilityBadge.textContent = `${credibility} CREDIBILITY`;
                            
                            badgesContainer.appendChild(labelText);
                            badgesContainer.appendChild(credibilityBadge);
                            
                            // Insert the badges after the target location
                            if (targetLocation === reviewItem) {
                                // Append to the end of review item
                                targetLocation.appendChild(badgesContainer);
                            } else {
                                // Insert after the .bottom div
                                targetLocation.parentNode.insertBefore(badgesContainer, targetLocation.nextSibling);
                            }
                            
                            matchedReviews++;
                            
                        } catch (error) {
                            console.error(`Error injecting badges for review ${index}:`, error);
                        }
                    });
                    
                    console.log(`Successfully injected badges for ${matchedReviews} reviews`);
                    
                    // Text similarity function
                    function calculateTextSimilarity(text1, text2) {
                        // Simple similarity check - normalize and compare
                        const normalize = (text) => text.toLowerCase().replace(/\s+/g, ' ').trim();
                        const norm1 = normalize(text1);
                        const norm2 = normalize(text2);
                        
                        if (norm1 === norm2) return 1.0;
                        
                        // Check if one is substring of another
                        if (norm1.includes(norm2) || norm2.includes(norm1)) return 0.9;
                        
                        // Word-based similarity
                        const words1 = norm1.split(' ');
                        const words2 = norm2.split(' ');
                        const commonWords = words1.filter(word => words2.includes(word));
                        
                        return commonWords.length / Math.max(words1.length, words2.length);
                    }
                },
                args: [reviewsWithSentiment]
            });
            
            console.log('Page injection completed');
            
        } catch (error) {
            console.error('Error injecting results into page:', error);
        }
    }

    function getCredibilityScore(consistency, authenticity) {
        // Based on the credibility classification table
        const credibilityMap = {
            'CONSISTENT': {
                'HIGH': 'HIGH',
                'MODERATE': 'HIGH', 
                'LOW': 'MODERATE'
            },
            'PARTIALLY CONSISTENT': {
                'HIGH': 'HIGH',
                'MODERATE': 'MODERATE',
                'LOW': 'LOW'
            },
            'INCONSISTENT': {
                'HIGH': 'MODERATE',
                'MODERATE': 'LOW',
                'LOW': 'LOW'
            }
        };
        
        return credibilityMap[consistency]?.[authenticity] || 'LOW';
    }

    function getCredibilityColor(credibility) {
        switch(credibility) {
            case 'HIGH': return '#28a745';
            case 'MODERATE': return '#ffc107';
            case 'LOW': return '#dc3545';
            default: return '#6c757d';
        }
    }

    function getCredibilityGlowColor(credibility) {
        switch(credibility) {
            case 'HIGH': return '#90EE90';
            case 'MODERATE': return '#FFD700';
            case 'LOW': return '#FFB6C1';
            default: return '#FFFFFF';
        }
    }

    function getCredibilityMessage(credibility) {
        switch(credibility) {
            case 'HIGH': return 'Most reviews appear trustworthy';
            case 'MODERATE': return 'Reviews show mixed reliability signals';
            case 'LOW': return 'Many reviews show concerning patterns';
            default: return 'Analysis complete';
        }
    }

    function getConsistencyLabel(sentiment, starRating) {
        if (!starRating) return 'UNKNOWN';
        
        const consistencyMap = {
            'POSITIVE': {
                5: 'CONSISTENT',
                4: 'PARTIALLY CONSISTENT',
                3: 'INCONSISTENT',
                2: 'INCONSISTENT', 
                1: 'INCONSISTENT'
            },
            'NEUTRAL': {
                5: 'INCONSISTENT',
                4: 'PARTIALLY CONSISTENT',
                3: 'CONSISTENT',
                2: 'PARTIALLY CONSISTENT',
                1: 'INCONSISTENT'
            },
            'NEGATIVE': {
                5: 'INCONSISTENT',
                4: 'INCONSISTENT',
                3: 'PARTIALLY CONSISTENT',
                2: 'CONSISTENT',
                1: 'CONSISTENT'
            }
        };
        
        return consistencyMap[sentiment]?.[starRating] || 'UNKNOWN';
    }

    function getConsistencyColor(consistency) {
        switch(consistency) {
            case 'CONSISTENT': return '#28a745';
            case 'PARTIALLY CONSISTENT': return '#ffc107';
            case 'INCONSISTENT': return '#dc3545';
            default: return '#6c757d';
        }
    }

    function getAuthenticityScore(features) {
        // Extract feature predictions in order: PD_F, PD_F_TMP, MAN_UI, QUAL, SPM
        const pdF = features.PD_F?.prediction || 0;
        const pdFTmp = features.PD_F_TMP?.prediction || 0;
        const manUI = features.MAN_UI?.prediction || 0;
        const qual = features.QUAL?.prediction || 0;
        const spm = features.SPM?.prediction || 0;
        
        const pattern = `(${pdF},${pdFTmp},${manUI},${qual},${spm})`;
        
        // DEBUG: Log the pattern for troubleshooting
        console.log('DEBUG - Authenticity pattern:', pattern, features);
        
        // NEW RULE: If MAN_UI is 0 (not manually created), automatically LOW authenticity
        if (manUI === 0) {
            console.log('MAN_UI is 0 - Automatically assigning LOW authenticity');
            return 'LOW';
        }
        
        // Continue with original rules only if MAN_UI is 1
        // LOW Authenticity Rules
        const lowPatterns = [
            '(0,0,1,0,0)', '(1,0,1,0,0)', '(0,1,1,0,0)', '(1,1,1,0,0)',
            '(0,1,1,0,1)', '(1,0,1,0,1)', '(1,1,1,0,1)', '(0,0,1,0,1)'
        ];
        
        // MODERATE Authenticity Rules
        const moderatePatterns = [
            '(1,1,1,1,0)', '(1,1,1,1,1)',
            '(0,1,1,1,1)', '(1,0,1,1,1)'
        ];
        
        // HIGH Authenticity Rules
        const highPatterns = [
            '(0,1,1,1,0)', '(1,0,1,1,0)', '(0,0,1,1,0)'
        ];
        
        if (lowPatterns.includes(pattern)) {
            return 'LOW';
        } else if (moderatePatterns.includes(pattern)) {
            return 'MODERATE';
        } else if (highPatterns.includes(pattern)) {
            return 'HIGH';
        } else {
            // DEBUG: Log unknown patterns
            console.log('UNKNOWN PATTERN DETECTED:', pattern);
            console.log('Features object:', features);
            
            // For now, let's classify unknown patterns as MODERATE
            return 'MODERATE';
        }
    }

    function getAuthenticityColor(authenticity) {
        switch(authenticity) {
            case 'HIGH': return '#28a745';
            case 'MODERATE': return '#ffc107';
            case 'LOW': return '#dc3545';
            default: return '#6c757d';
        }
    }
});