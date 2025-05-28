document.addEventListener('DOMContentLoaded', function() {
    const findReviewsButton = document.getElementById('findReviewsButton');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    
    findReviewsButton.addEventListener('click', async function() {
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
                        text = text.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2702}-\u{27B0}]|[\u{24C2}-\u{1F251}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
                        
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
                            
                            // Method 2: Alternative Lazada star selectors
                            const alternativeSelectors = [
                                '.star',
                                '.stars', 
                                '[class*="star"]',
                                '.rating img',
                                '[class*="rating"] img'
                            ];
                            
                            for (const selector of alternativeSelectors) {
                                const elements = reviewElement.querySelectorAll(selector);
                                if (elements.length > 0) {
                                    console.log(`Checking alternative selector "${selector}": found ${elements.length} elements`);
                                    
                                    let filledCount = 0;
                                    elements.forEach((element, index) => {
                                        // Check if this element contains the star images
                                        const imgs = element.querySelectorAll('img');
                                        imgs.forEach(img => {
                                            const src = img.getAttribute('src') || '';
                                            if (src.includes('TB19ZvEgfDH8KJjy1XcXXcpdXXa-64-64.png')) {
                                                filledCount++;
                                            }
                                        });
                                        
                                        // Also check if the element itself is an img
                                        if (element.tagName === 'IMG') {
                                            const src = element.getAttribute('src') || '';
                                            if (src.includes('TB19ZvEgfDH8KJjy1XcXXcpdXXa-64-64.png')) {
                                                filledCount++;
                                            }
                                        }
                                    });
                                    
                                    if (filledCount > 0) {
                                        console.log(`Found ${filledCount} filled stars from alternative selector`);
                                        return filledCount;
                                    }
                                }
                            }
                            
                            // Method 3: Direct image search in entire review element
                            const allImages = reviewElement.querySelectorAll('img');
                            let directFilledCount = 0;
                            
                            console.log(`Checking all ${allImages.length} images in review element`);
                            allImages.forEach((img, index) => {
                                const src = img.getAttribute('src') || '';
                                console.log(`Image ${index}: ${src}`);
                                
                                if (src.includes('TB19ZvEgfDH8KJjy1XcXXcpdXXa-64-64.png')) {
                                    directFilledCount++;
                                    console.log(`  Found filled star image!`);
                                }
                            });
                            
                            if (directFilledCount > 0) {
                                console.log(`DIRECT IMAGE SEARCH: Found ${directFilledCount} filled stars`);
                                return directFilledCount;
                            }
                            
                            // Method 4: Look in parent elements (sometimes stars are outside the review content)
                            let parent = reviewElement.parentElement;
                            let depth = 0;
                            
                            while (parent && depth < 3) {
                                const parentImages = parent.querySelectorAll('img[src*="TB19ZvEgfDH8KJjy1XcXXcpdXXa"]');
                                if (parentImages.length > 0) {
                                    console.log(`Found ${parentImages.length} filled stars in parent element (depth ${depth})`);
                                    return parentImages.length;
                                }
                                parent = parent.parentElement;
                                depth++;
                            }
                            
                            // Method 5: Fallback to data attributes and text patterns
                            const allDataAttributes = ['data-rating', 'data-rate', 'data-stars', 'data-score', 'data-value'];
                            for (const attr of allDataAttributes) {
                                const element = reviewElement.querySelector(`[${attr}]`);
                                if (element) {
                                    const value = element.getAttribute(attr);
                                    const rating = parseFloat(value);
                                    if (rating >= 1 && rating <= 5) {
                                        console.log(`Found rating from ${attr}: ${rating}`);
                                        return Math.round(rating);
                                    }
                                }
                            }
                            
                            // Method 6: Text pattern search as final fallback
                            const fullText = reviewElement.textContent || '';
                            const textPatterns = [
                                /(\d+)\s*(?:star|stars|stars)/i,
                                /(\d+)\s*\/\s*5/i,
                                /(\d+)\s*out\s*of\s*5/i,
                                /rating:?\s*(\d+)/i
                            ];
                            
                            for (const pattern of textPatterns) {
                                const match = fullText.match(pattern);
                                if (match) {
                                    const rating = parseInt(match[1]);
                                    if (rating >= 1 && rating <= 5) {
                                        console.log(`Found rating from text pattern: ${rating}`);
                                        return rating;
                                    }
                                }
                            }
                            
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
                                            element: reviewItem // Store reference to DOM element
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
                
                // Show everything in popup (no page injection)
                displayResultsInPopup(reviewsWithSentiment);
                
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
    });

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

    // Display everything in popup - individual reviews with badges + summary
    function displayResultsInPopup(reviews) {
        statusDiv.textContent = `Analysis complete! Found ${reviews.length} reviews.`;
        
        // Individual reviews section first
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
            
            // Details section (collapsed by default, expandable)
            const sentimentDisplay = review.sentiment.label;
            
            // Feature breakdown
            const featureLabels = {
                'PD_F': 'Template',
                'PD_F_TMP': 'Phrases',
                'MAN_UI': 'Manual',
                'QUAL': 'Quality', 
                'SPM': 'Spam'
            };
            
            let featureBreakdown = 'No API data';
            if (review.features && Object.keys(review.features).length > 0) {
                featureBreakdown = Object.entries(featureLabels).map(([key, label]) => {
                    const feature = review.features[key];
                    const status = feature ? (feature.prediction === 1 ? 'Y' : 'N') : '?';
                    const badFeatures = ['PD_F', 'PD_F_TMP', 'SPM'];
                    const color = feature ? (
                        badFeatures.includes(key) ? 
                        (feature.prediction === 1 ? '#dc3545' : '#28a745') : 
                        (feature.prediction === 1 ? '#28a745' : '#dc3545')
                    ) : '#6c757d';
                    
                    return `<span style="color: ${color}; font-size: 9px;">${label}:${status}</span>`;
                }).join(' ');
            }
            
            const detailsHTML = `
                <div style="font-size: 9px; color: #666; border-top: 1px solid #eee; padding-top: 4px;">
                    <strong>Inconsistency:</strong> ${starDisplay} vs ${sentimentDisplay} | 
                    <strong>Features:</strong> ${featureBreakdown}
                </div>
            `;
            
            reviewDiv.innerHTML = badgesHTML + reviewTextHTML + detailsHTML;
            reviewsDiv.appendChild(reviewDiv);
        });
        
        resultsDiv.appendChild(reviewsDiv);
        
        // Summary section at the bottom
        const sentimentCounts = { POSITIVE: 0, NEGATIVE: 0, NEUTRAL: 0 };
        const consistencyCounts = { CONSISTENT: 0, 'PARTIALLY CONSISTENT': 0, INCONSISTENT: 0, UNKNOWN: 0 };
        const authenticityCounts = { HIGH: 0, MODERATE: 0, LOW: 0, UNKNOWN: 0 };
        const credibilityCounts = { HIGH: 0, MODERATE: 0, LOW: 0 };
        const starCounts = {};
        
        reviews.forEach(review => {
            sentimentCounts[review.sentiment.label]++;
            
            const consistency = getConsistencyLabel(review.sentiment.label, review.starRating);
            consistencyCounts[consistency]++;
            
            const authenticity = getAuthenticityScore(review.features);
            authenticityCounts[authenticity]++;
            
            const credibility = getCredibilityScore(consistency, authenticity);
            credibilityCounts[credibility]++;
            
            if (review.starRating) {
                starCounts[review.starRating] = (starCounts[review.starRating] || 0) + 1;
            }
        });
        
        const summaryDiv = document.createElement('div');
        summaryDiv.style.cssText = 'margin-top: 15px; padding: 12px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 8px; font-size: 11px;';
        
        const consistencySummary = Object.entries(consistencyCounts)
            .filter(([_, count]) => count > 0)
            .map(([consistency, count]) => `${consistency}: ${count}`)
            .join(' | ');
            
        const authenticitySummary = Object.entries(authenticityCounts)
            .filter(([_, count]) => count > 0)
            .map(([authenticity, count]) => `${authenticity}: ${count}`)
            .join(' | ');
            
        const credibilitySummary = Object.entries(credibilityCounts)
            .filter(([_, count]) => count > 0)
            .map(([credibility, count]) => {
                const percentage = Math.round((count / reviews.length) * 100);
                return `${credibility}: ${count} (${percentage}%)`;
            })
            .join(' | ');
        
        // Calculate credibility percentages for big display
        const highCredibilityPercentage = Math.round((credibilityCounts.HIGH / reviews.length) * 100) || 0;
        const moderateCredibilityPercentage = Math.round((credibilityCounts.MODERATE / reviews.length) * 100) || 0;
        const lowCredibilityPercentage = Math.round((credibilityCounts.LOW / reviews.length) * 100) || 0;
        
        summaryDiv.innerHTML = `
            <div style="text-align: center; margin-bottom: 8px;">
                <strong style="font-size: 13px;">Summary</strong>
            </div>
            <div style="font-size: 10px; line-height: 1.4;">
                <strong>Consistency:</strong> ${consistencySummary}<br>
                <strong>Authenticity:</strong> ${authenticitySummary}<br>
            </div>
            <div style="margin-top: 10px; text-align: center;">
                <div style="font-size: 11px; color: rgba(255,255,255,0.8); margin-bottom: 6px;">
                    <strong>Credibility Distribution</strong>
                </div>
                <div style="display: flex; justify-content: space-around; align-items: center;">
                    <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: bold; color: #90EE90;">
                            ${highCredibilityPercentage}%
                        </div>
                        <div style="font-size: 9px; color: rgba(255,255,255,0.9);">HIGH</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: bold; color: #FFD700;">
                            ${moderateCredibilityPercentage}%
                        </div>
                        <div style="font-size: 9px; color: rgba(255,255,255,0.9);">MODERATE</div>
                    </div>
                    <div style="text-align: center;">
                        <div style="font-size: 18px; font-weight: bold; color: #FFB6C1;">
                            ${lowCredibilityPercentage}%
                        </div>
                        <div style="font-size: 9px; color: rgba(255,255,255,0.9);">LOW</div>
                    </div>
                </div>
            </div>
        `;
        resultsDiv.appendChild(summaryDiv);
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