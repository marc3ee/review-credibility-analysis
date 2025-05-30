from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pickle
import pandas as pd
import numpy as np
import re
from collections import Counter

app = Flask(__name__)

# Enhanced CORS configuration
CORS(app, resources={
    r"/*": {
        "origins": ["chrome-extension://*", "http://localhost:*", "http://127.0.0.1:*"],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type"]
    }
})

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = jsonify()
        response.headers.add("Access-Control-Allow-Origin", "*")
        response.headers.add('Access-Control-Allow-Headers', "*")
        response.headers.add('Access-Control-Allow-Methods', "*")
        return response

# Global variables for models
sentiment_model = None
sentiment_vectorizer = None
feature_models = None
feature_scalers = None
feature_tfidf = None
feature_names = None

def load_all_models():
    """Load all models at startup"""
    global sentiment_model, sentiment_vectorizer, feature_models, feature_scalers, feature_tfidf, feature_names
    
    print("Loading models...")
    
    # Load sentiment analysis model
    try:
        sentiment_model = joblib.load('SA - LOGISTIC REGRESSION VER/LR_sentiment_model.pkl')
        sentiment_vectorizer = joblib.load('SA - LOGISTIC REGRESSION VER/LR_tfidf_vectorizer.pkl')
        print("✅ Sentiment model loaded")
    except Exception as e:
        print(f"❌ Sentiment model failed: {e}")
    
    # Load feature classification models
    try:
        with open('FEATURES/models.pkl', 'rb') as f:
            feature_models = pickle.load(f)
        with open('FEATURES/scalers.pkl', 'rb') as f:
            feature_scalers = pickle.load(f)
        with open('FEATURES/tfidf.pkl', 'rb') as f:
            feature_tfidf = pickle.load(f)
        with open('FEATURES/feature_names.pkl', 'rb') as f:
            feature_names = pickle.load(f)
        print("✅ Feature models loaded")
        print(f"✅ Available feature models: {list(feature_models.keys())}")
    except Exception as e:
        print(f"❌ Feature models failed: {e}")

# Initialize models at startup
load_all_models()

# =============================================================================
# PREPROCESSING FUNCTIONS (from your notebooks)
# =============================================================================

def preprocess_text_for_sentiment(text):
    """Preprocessing for sentiment analysis"""
    if not text or text == "N/A":
        return ""
    
    text = str(text)
    text = text.replace("\n", " ").replace("\t", " ").replace("\r", " ")
    
    # Remove emojis
    emoji_pattern = re.compile(
        "["
        "\U0001F600-\U0001F64F"
        "\U0001F300-\U0001F5FF" 
        "\U0001F680-\U0001F6FF"
        "\U0001F1E0-\U0001F1FF"
        "\U00002702-\U000027B0"
        "\U000024C2-\U0001F251"
        "\U0001F900-\U0001F9FF"
        "\U0001FA70-\U0001FAFF"
        "\U00002600-\U000026FF"
        "\U00002700-\U000027BF"
        "]+",
        flags=re.UNICODE
    )
    text = emoji_pattern.sub('', text)
    
    text = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', text)
    text = re.sub(r'[^\w\s\.\,\!\?\;\:\-\_\(\)\[\]\{\}\"\'`~@#$%^&*+=|\\/<>]', '', text, flags=re.UNICODE)
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def minimal_text_cleaning(text):
    """Minimal cleaning for feature models"""
    if pd.isna(text):
        return ""
    text = str(text)
    text = re.sub(r'\s+', ' ', text)
    text = text.strip()
    return text

def extract_template_features(text):
    """Extract comprehensive features including template detection and spam detection"""
    features = {}

    if not text or pd.isna(text):
        text = ""

    text_clean = str(text).strip()
    words = text_clean.split() if text_clean else []

    # =============================================================================
    # BASIC TEXT FEATURES
    # =============================================================================
    features['char_length'] = len(text_clean)
    features['word_count'] = len(words)
    features['sentence_count'] = len(re.split(r'[.!?]+', text_clean)) - 1
    features['avg_word_length'] = np.mean([len(word) for word in words]) if words else 0
    features['avg_sentence_length'] = len(words) / max(1, features['sentence_count'])

    # Character type ratios
    if text_clean:
        features['alpha_ratio'] = sum(c.isalpha() for c in text_clean) / len(text_clean)
        features['digit_ratio'] = sum(c.isdigit() for c in text_clean) / len(text_clean)
        features['space_ratio'] = sum(c.isspace() for c in text_clean) / len(text_clean)
        features['punct_ratio'] = sum(not c.isalnum() and not c.isspace() for c in text_clean) / len(text_clean)
        features['upper_ratio'] = sum(c.isupper() for c in text_clean) / len(text_clean)
    else:
        features['alpha_ratio'] = features['digit_ratio'] = features['space_ratio'] = 0
        features['punct_ratio'] = features['upper_ratio'] = 0

    # =============================================================================
    # SPAM DETECTION FEATURES
    # =============================================================================

    # 1. Repetitive Text Detection
    if words:
        word_freq = Counter(words)
        most_common_freq = word_freq.most_common(1)[0][1]
        features['word_repetition_ratio'] = most_common_freq / len(words)
        features['unique_word_ratio'] = len(set(words)) / len(words)
    else:
        features['word_repetition_ratio'] = 0
        features['unique_word_ratio'] = 0

    # 2. Character-level repetition patterns
    if text_clean:
        char_freq = Counter(text_clean.lower())
        most_common_char_freq = char_freq.most_common(1)[0][1]
        features['char_repetition_ratio'] = most_common_char_freq / len(text_clean)

        # Consecutive character repetition
        consecutive_chars = re.findall(r'(.)\1{2,}', text_clean.lower())  # 3+ same chars in a row
        features['consecutive_char_groups'] = len(consecutive_chars)
        features['max_consecutive_chars'] = max([len(match) + 1 for match in consecutive_chars], default=0)
    else:
        features['char_repetition_ratio'] = 0
        features['consecutive_char_groups'] = 0
        features['max_consecutive_chars'] = 0

    # 3. Random/Nonsensical patterns
    # Vowel to consonant ratio (natural language has patterns)
    vowels = 'aeiouAEIOU'
    if text_clean:
        vowel_count = sum(1 for c in text_clean if c in vowels)
        consonant_count = sum(1 for c in text_clean if c.isalpha() and c not in vowels)
        features['vowel_consonant_ratio'] = vowel_count / max(1, consonant_count)
    else:
        features['vowel_consonant_ratio'] = 0

    # Character sequence patterns (randomness indicators)
    features['has_random_sequences'] = bool(re.search(r'[a-z]{10,}', text_clean.lower()))
    features['has_number_sequences'] = bool(re.search(r'\d{5,}', text_clean))

    # 4. Excessive punctuation patterns
    features['dot_count'] = text_clean.count('.')
    features['comma_count'] = text_clean.count(',')
    features['colon_count'] = text_clean.count(':')
    features['exclamation_count'] = text_clean.count('!')
    features['question_count'] = text_clean.count('?')
    features['total_punct_count'] = sum(not c.isalnum() and not c.isspace() for c in text_clean)

    # Specific punctuation sequence patterns
    features['dot_comma_count'] = text_clean.count('.,')
    features['comma_space_count'] = text_clean.count(', ')
    features['colon_space_count'] = text_clean.count(': ')

    # Excessive punctuation sequences
    features['excessive_dots'] = len(re.findall(r'\.{3,}', text_clean))
    features['excessive_commas'] = len(re.findall(r',{2,}', text_clean))
    features['excessive_colons'] = len(re.findall(r':{2,}', text_clean))
    features['excessive_exclamations'] = len(re.findall(r'!{2,}', text_clean))
    features['punct_density'] = features['total_punct_count'] / max(1, len(text_clean))

    # 5. Very short/minimal content
    features['is_very_short'] = len(text_clean.strip()) <= 3
    features['is_single_word'] = len(words) == 1
    features['is_single_char'] = len(text_clean.strip()) == 1

    # 6. Extended character patterns (like "goooooood")
    extended_patterns = re.findall(r'(\w)\1{3,}', text_clean.lower())
    features['extended_char_patterns'] = len(extended_patterns)
    features['has_extended_chars'] = len(extended_patterns) > 0

    # 7. Keyboard mashing detection
    # Common keyboard sequences
    keyboard_patterns = ['qwerty', 'asdf', 'zxcv', '123', 'abc', 'qaz', 'wsx']
    features['keyboard_mashing'] = any(pattern in text_clean.lower() for pattern in keyboard_patterns)

    # Random alternating pattern
    features['alternating_pattern'] = bool(re.search(r'([a-z])\1*([a-z])\2*\1', text_clean.lower()))

    # Enhanced nonsense detection
    random_sequences = re.findall(r'\b[a-z]{8,}\b', text_clean.lower())
    features['random_word_count'] = len(random_sequences)
    features['has_random_words'] = len(random_sequences) > 0

    repetitive_patterns = re.findall(r'\b(\w{2,3})\1{2,}\b', text_clean.lower())
    features['repetitive_nonsense'] = len(repetitive_patterns)
    features['has_repetitive_nonsense'] = len(repetitive_patterns) > 0

    # Additional gibberish patterns for attribute values
    weird_sequences = re.findall(r'\b[a-z]*[0-9]+[a-z]*\b', text_clean.lower())  # Mixed letters/numbers
    consonant_heavy = re.findall(r'\b[bcdfghjklmnpqrstvwxyz]{5,}\b', text_clean.lower())  # Too many consonants
    features['weird_sequences'] = len(weird_sequences)
    features['consonant_heavy_words'] = len(consonant_heavy)

    # =============================================================================
    # TEMPLATE DETECTION FEATURES (from previous implementation)
    # =============================================================================

    # Punctuation & Formatting Patterns - Enhanced colon detection
    colon_pairs = len(re.findall(r'\b\w+:\s*\w+', text_clean))
    features['colon_pairs'] = colon_pairs
    features['colon_density'] = colon_pairs / max(1, len(words))
    features['attribute_pattern'] = bool(re.search(r'(\w+:\s*\w+.*){2,}', text_clean))

    # NEW: Single attribute detection (attribute + colon pattern)
    single_attributes = re.findall(r'\b\w+:', text_clean)
    features['single_attribute_count'] = len(single_attributes)
    features['single_attribute_density'] = len(single_attributes) / max(1, len(words))
    features['has_single_attributes'] = len(single_attributes) > 0

    # Extract unique attribute words for analysis
    attribute_words = [attr.replace(':', '') for attr in single_attributes]
    features['unique_attributes'] = len(set(attribute_words))

    # Common template attribute words
    common_attributes = [
        'design', 'quality', 'price', 'material', 'size', 'color', 'weight',
        'sound', 'battery', 'comfort', 'durability', 'packaging', 'delivery',
        'service', 'value', 'performance', 'rating', 'review', 'product',
        'portability', 'build', 'appearance', 'style', 'function', 'usability', 'reliability'
    ]

    template_attribute_matches = sum(1 for attr in attribute_words
                                   if attr.lower() in common_attributes)
    features['template_attribute_count'] = template_attribute_matches
    features['template_attribute_ratio'] = template_attribute_matches / max(1, len(attribute_words))

    # Separator consistency (moved to avoid duplication)
    features['semicolon_count'] = text_clean.count(';')

    # Lexical Repetition Patterns for templates
    value_words = ['good', 'great', 'perfect', 'excellent', 'amazing', 'nice', 'awesome', 'fantastic']
    value_word_count = sum(text_clean.lower().count(word) for word in value_words)
    features['value_word_count'] = value_word_count
    features['value_word_density'] = value_word_count / max(1, len(words))

    # Template phrases - Enhanced detection
    template_phrases = [
        'great value for money', 'perfect for', 'ideal for', 'highly recommend',
        'easy to use', 'good quality', 'fast delivery', 'excellent service',
        'worth the price', 'as expected', 'satisfied with', 'durable and long-lasting',
        'stylish design', 'comfortable to wear', 'perfect fit', 'great for everyday',
        'versatile and practical', 'good for the price', 'would recommend',
        'nice and comfortable', 'looks good', 'feels good'
    ]
    features['template_phrase_count'] = sum(1 for phrase in template_phrases if phrase in text_clean.lower())
    features['has_template_phrases'] = features['template_phrase_count'] > 0
    features['has_any_template_phrase'] = features['template_phrase_count'] > 0

    # Enhanced template phrase detection - partial matches
    template_keywords = [
        'durable', 'long-lasting', 'stylish', 'comfortable', 'perfect',
        'versatile', 'practical', 'recommend', 'excellent', 'amazing',
        'fantastic', 'great', 'nice', 'good quality', 'high quality'
    ]

    template_keyword_matches = sum(1 for keyword in template_keywords
                                 if keyword in text_clean.lower())
    features['template_keyword_count'] = template_keyword_matches
    features['template_keyword_density'] = template_keyword_matches / max(1, len(words))

    # MIXED PATTERN DETECTION - Template + Natural combination
    # Detect structured beginning + natural ending
    has_early_attributes = bool(re.search(r'^[^.!?]*\w+:\s*\w+', text_clean))
    has_natural_continuation = bool(re.search(r'[.!?]\s*[a-z]', text_clean))  # lowercase after punctuation
    features['mixed_structure_pattern'] = has_early_attributes and has_natural_continuation

    # Template-to-natural transition detection
    sentences_with_colons = [s for s in re.split(r'[.!?]+', text_clean) if ':' in s]
    sentences_without_colons = [s for s in re.split(r'[.!?]+', text_clean) if ':' not in s and s.strip()]

    features['structured_sentences'] = len(sentences_with_colons)
    features['natural_sentences'] = len(sentences_without_colons)
    features['structure_transition_ratio'] = len(sentences_with_colons) / max(1, len(sentences_without_colons))

    # Comma-separated template values after colons
    colon_segments = re.findall(r'\w+:\s*([^,.:!?]+)', text_clean)
    template_like_segments = 0
    for segment in colon_segments:
        segment_words = segment.strip().split()
        if len(segment_words) >= 2 and any(word.lower() in template_keywords for word in segment_words):
            template_like_segments += 1

    features['template_value_segments'] = template_like_segments
    features['template_value_ratio'] = template_like_segments / max(1, len(colon_segments))

    # Adjective diversity
    adjectives = value_words + ['nice', 'bad', 'terrible', 'okay', 'fine']
    text_adjectives = [word for word in words if word.lower() in adjectives]
    features['unique_adjectives'] = len(set(text_adjectives))
    features['adjective_diversity'] = features['unique_adjectives'] / max(1, len(text_adjectives))

    # Attribute + gibberish pattern detection (enhanced to handle spaces)
    # Pattern 1: "attribute:gibberish" (no space after colon)
    attribute_gibberish_nospace = re.findall(r'\b\w+:[a-z]{6,}', text_clean.lower())
    # Pattern 2: "attribute: gibberish" (space after colon)
    attribute_gibberish_space = re.findall(r'\b\w+:\s+[a-z]{6,}', text_clean.lower())
    # Pattern 3: "attribute:value gibberish" (value followed by gibberish)
    attribute_value_gibberish = re.findall(r'\b\w+:\s*\w+\s+[a-z]{6,}', text_clean.lower())

    total_gibberish_patterns = len(attribute_gibberish_nospace) + len(attribute_gibberish_space) + len(attribute_value_gibberish)
    features['attribute_gibberish_count'] = total_gibberish_patterns
    features['has_attribute_gibberish'] = total_gibberish_patterns > 0

    # Enhanced repeated values detection (handles both spaced and non-spaced)
    attribute_values_nospace = re.findall(r'\b\w+:([a-z]+)', text_clean.lower())
    attribute_values_space = re.findall(r'\b\w+:\s+([a-z]+)', text_clean.lower())
    all_attribute_values = attribute_values_nospace + attribute_values_space

    if all_attribute_values:
        value_freq = Counter(all_attribute_values)
        most_common_value_freq = value_freq.most_common(1)[0][1]
        features['repeated_value_ratio'] = most_common_value_freq / len(all_attribute_values)
        features['has_repeated_values'] = most_common_value_freq > 1

        # Check if most values are gibberish (6+ random chars)
        gibberish_values = sum(1 for val in all_attribute_values if len(val) >= 6 and val.isalpha())
        features['gibberish_value_ratio'] = gibberish_values / len(all_attribute_values)
        features['has_mostly_gibberish_values'] = features['gibberish_value_ratio'] > 0.5
    else:
        features['repeated_value_ratio'] = 0
        features['has_repeated_values'] = False
        features['gibberish_value_ratio'] = 0
        features['has_mostly_gibberish_values'] = False

    # =============================================================================
    # LANGUAGE AND STRUCTURE PATTERNS
    # =============================================================================

    # Mixed language detection (basic)
    features['has_mixed_language'] = bool(re.search(r'[^\x00-\x7F]', text_clean))  # Non-ASCII chars

    # Sentence structure
    complete_sentences = [s for s in re.split(r'[.!?]+', text_clean)
                         if s.strip() and re.search(r'\b(is|are|was|were|have|has|do|does|will|can|should|the|a|an)\b', s.lower())]
    features['complete_sentences'] = len(complete_sentences)
    features['fragment_ratio'] = 1 - (len(complete_sentences) / max(1, features['sentence_count']))

    # Grammatical patterns
    features['has_articles'] = bool(re.search(r'\b(the|a|an)\b', text_clean.lower()))
    features['has_pronouns'] = bool(re.search(r'\b(i|you|he|she|it|we|they|me|him|her|us|them)\b', text_clean.lower()))
    features['has_verbs'] = bool(re.search(r'\b(is|are|was|were|have|has|do|does|will|can|should|go|get|make|take)\b', text_clean.lower()))

    # =============================================================================
    # COMPREHENSIVE SPAM SCORING SYSTEM
    # =============================================================================

    spam_score = 0
    template_score = 0

    # === HIGH SPAM INDICATORS (0.4 each) ===

    # 1. Attribute gibberish patterns
    if features['has_attribute_gibberish']:
        spam_score += 0.4

    # 2. Mostly gibberish values in attributes
    if features['has_mostly_gibberish_values']:
        spam_score += 0.4

    # 3. Multiple random sequences OR weird patterns
    if features['random_word_count'] >= 2 or features['weird_sequences'] >= 2 or features['consonant_heavy_words'] >= 2:
        spam_score += 0.4

    # 4. Attribute + random word combination (strong spam indicator)
    if features['colon_pairs'] >= 2 and (features['random_word_count'] >= 1 or features['weird_sequences'] >= 1):
        spam_score += 0.4

    # === MEDIUM SPAM INDICATORS (0.3 each) ===

    # 4. Pure attribute spam (multiple attributes, no natural language)
    if (features['colon_pairs'] >= 3 and
        not features['has_articles'] and not features['has_pronouns'] and
        features['word_count'] <= features['colon_pairs'] * 2):
        spam_score += 0.3

    # 5. Repeated simple values across attributes
    if features['has_repeated_values'] and features['colon_pairs'] >= 2:
        spam_score += 0.3

    # 6. High template phrase density (multiple template phrases in short text)
    template_phrase_density = features['template_phrase_count'] / max(1, features['word_count'] / 10)
    if template_phrase_density > 1.5:  # More than 1.5 template phrases per 10 words
        spam_score += 0.3

    # === TEMPLATE INDICATORS (separate scoring) ===

    # 7. Multiple colon pairs
    if features['colon_pairs'] >= 3:
        template_score += 0.3
    elif features['colon_pairs'] >= 2:
        template_score += 0.2

    # 8. High template attribute ratio
    if features['template_attribute_ratio'] > 0.7:
        template_score += 0.3

    # 9. Multiple template phrases
    if features['template_phrase_count'] >= 3:
        template_score += 0.3
    elif features['template_phrase_count'] >= 2:
        template_score += 0.2

    # 10. High simple value word density
    simple_value_density = features['value_word_count'] / max(1, features['word_count'])
    if simple_value_density > 0.5:  # More than 50% simple value words
        template_score += 0.3
    elif simple_value_density > 0.3:
        template_score += 0.2

    # 11. Low adjective diversity with template patterns
    if (features['adjective_diversity'] < 0.5 and
        (features['colon_pairs'] > 0 or features['template_phrase_count'] > 0)):
        template_score += 0.2

    # === MIXED PATTERN DETECTION ===

    # 12. Template + attribute mixed patterns
    if features['colon_pairs'] >= 2 and features['template_phrase_count'] >= 1:
        mixed_boost = 0.3
        spam_score += mixed_boost
        template_score += mixed_boost

    # 13. Natural + spam mixed (unnatural insertion of structured content)
    # Only flag if it's clearly spam insertion, not natural mentions
    if (features['has_articles'] and features['has_pronouns'] and
        features['colon_pairs'] >= 2 and features['word_count'] > 8 and
        (features['random_word_count'] > 0 or not features['has_verbs'])):
        spam_score += 0.2  # Only if it has suspicious patterns

    # === LOW-LEVEL INDICATORS (0.1 each) ===

    # 14. Repetitive nonsense
    if features['has_repetitive_nonsense']:
        spam_score += 0.1

    # 15. Low unique word ratio
    if features['unique_word_ratio'] < 0.6:
        spam_score += 0.1

    # 16. Unnatural vowel/consonant ratio
    if features['vowel_consonant_ratio'] < 0.3 or features['vowel_consonant_ratio'] > 2.0:
        spam_score += 0.1

    # 17. High fragment ratio with structured content
    if features['fragment_ratio'] > 0.7 and features['colon_pairs'] > 0:
        spam_score += 0.1

    # === SPECIAL CASE DETECTION ===

    # 18. Short template spam (few words, all template-like)
    if (features['word_count'] <= 8 and
        (features['template_phrase_count'] >= 1 or simple_value_density > 0.4) and
        not features['has_pronouns']):
        template_score += 0.4

    # 19. Pure attribute list spam (no natural language at all)
    if (features['colon_pairs'] >= 2 and
        features['word_count'] <= features['colon_pairs'] * 2.5 and
        not features['has_articles'] and not features['has_pronouns'] and not features['has_verbs']):
        spam_score += 0.4

    # === FINAL SCORING ===

    # Take maximum of spam_score and template_score, but combine for mixed patterns
    final_spam_score = max(spam_score, template_score)

    # Bonus for clear spam patterns
    if spam_score > 0.5 and template_score > 0.3:
        final_spam_score = min(1.0, final_spam_score + 0.2)

    features['spam_probability_score'] = min(1.0, final_spam_score)
    features['template_probability_score'] = min(1.0, template_score)
    features['is_likely_spam'] = final_spam_score > 0.5
    features['is_likely_template'] = template_score > 0.5

    # Additional diagnostic features
    features['template_phrase_density'] = template_phrase_density
    features['simple_value_density'] = simple_value_density

    return features

# =============================================================================
# PREDICTION FUNCTIONS
# =============================================================================

def predict_sentiment(text):
    """Predict sentiment using the logistic regression model"""
    if sentiment_model is None or sentiment_vectorizer is None:
        return {"error": "Sentiment model not loaded"}
    
    try:
        preprocessed_text = preprocess_text_for_sentiment(text)
        text_features = sentiment_vectorizer.transform([preprocessed_text])
        prediction = sentiment_model.predict(text_features)[0]
        probabilities = sentiment_model.predict_proba(text_features)[0]
        
        sentiment_labels = {0: 'NEGATIVE', 1: 'NEUTRAL', 2: 'POSITIVE'}
        predicted_label = sentiment_labels[prediction]
        
        confidence_scores = {
            'NEGATIVE': float(probabilities[0]),
            'NEUTRAL': float(probabilities[1]),
            'POSITIVE': float(probabilities[2])
        }
        
        return {
            'original_text': text,
            'preprocessed_text': preprocessed_text,
            'predicted_sentiment': predicted_label,
            'confidence_scores': confidence_scores
        }
    except Exception as e:
        return {"error": f"Sentiment prediction failed: {str(e)}"}

def predict_features(text):
    """Predict all feature classifications (PD_F, PD_F_TMP, MAN_UI, QUAL, SPM)"""
    if not all([feature_models, feature_scalers, feature_tfidf, feature_names]):
        return {"error": "Feature models not loaded"}
    
    try:
        # Clean the text
        clean_text = minimal_text_cleaning(text)
        
        # Extract template/spam features
        template_features = extract_template_features(clean_text)
        template_df = pd.DataFrame([template_features])
        
        # Extract TF-IDF features
        tfidf_features = feature_tfidf.transform([clean_text])
        tfidf_df = pd.DataFrame(tfidf_features.toarray(),
                               columns=[f'tfidf_{i}' for i in range(tfidf_features.shape[1])])
        
        # Combine features
        final_features = pd.concat([template_df, tfidf_df], axis=1)
        
        # Ensure feature alignment
        for col in feature_names:
            if col not in final_features.columns:
                final_features[col] = 0
        
        final_features = final_features[feature_names]
        
        # Make predictions for all targets
        predictions = {}
        target_descriptions = {
            'PD_F': 'Template Detection',
            'PD_F_TMP': 'Template Phrases',
            'MAN_UI': 'Manual UI',
            'QUAL': 'Quality',
            'SPM': 'Spam'
        }
        
        for target, model in feature_models.items():
            # Scale features
            scaler = feature_scalers[target]
            X_scaled = scaler.transform(final_features)
            
            # Make prediction
            prediction = model.predict(X_scaled)[0]
            probability = model.predict_proba(X_scaled)[0]
            
            predictions[target] = {
                'prediction': int(prediction),
                'label': 'POSITIVE' if prediction == 1 else 'NEGATIVE',
                'probability': float(probability[1]),  # Probability of class 1
                'confidence': float(max(probability)),
                'description': target_descriptions[target]
            }
        
        # Add the new spam and template scoring features to the response
        spam_features = {
            'spam_probability_score': template_features.get('spam_probability_score', 0),
            'template_probability_score': template_features.get('template_probability_score', 0),
            'is_likely_spam': template_features.get('is_likely_spam', False),
            'is_likely_template': template_features.get('is_likely_template', False),
            'template_phrase_density': template_features.get('template_phrase_density', 0),
            'simple_value_density': template_features.get('simple_value_density', 0)
        }
        
        return {
            'original_text': text,
            'preprocessed_text': clean_text,
            'feature_predictions': predictions,
            'spam_template_analysis': spam_features
        }
        
    except Exception as e:
        return {"error": f"Feature prediction failed: {str(e)}"}

# =============================================================================
# API ROUTES
# =============================================================================

@app.route('/predict_comprehensive', methods=['POST'])
def predict_comprehensive():
    """Predict both sentiment and features for a single review"""
    try:
        data = request.json
        text = data.get('text', '')
        
        if not text:
            return jsonify({"error": "No text provided"}), 400
        
        # Get sentiment prediction
        sentiment_result = predict_sentiment(text)
        
        # Get feature predictions
        feature_result = predict_features(text)
        
        # Combine results
        combined_result = {
            'original_text': text,
            'sentiment_analysis': sentiment_result,
            'feature_analysis': feature_result
        }
        
        return jsonify(combined_result)
        
    except Exception as e:
        return jsonify({"error": f"Comprehensive prediction failed: {str(e)}"}), 500

@app.route('/predict_comprehensive_batch', methods=['POST'])
def predict_comprehensive_batch():
    """Predict both sentiment and features for multiple reviews"""
    try:
        data = request.json
        texts = data.get('texts', [])
        
        if not texts:
            return jsonify({"error": "No texts provided"}), 400
        
        results = []
        for text in texts:
            # Get sentiment prediction
            sentiment_result = predict_sentiment(text)
            
            # Get feature predictions  
            feature_result = predict_features(text)
            
            # Combine results
            combined_result = {
                'original_text': text,
                'sentiment_analysis': sentiment_result,
                'feature_analysis': feature_result
            }
            
            results.append(combined_result)
        
        return jsonify({"results": results})
        
    except Exception as e:
        return jsonify({"error": f"Batch prediction failed: {str(e)}"}), 500

@app.route('/predict', methods=['POST'])
def predict_single():
    """Legacy endpoint for sentiment only"""
    data = request.json
    text = data.get('text', '')
    
    if not text:
        return jsonify({"error": "No text provided"}), 400
    
    result = predict_sentiment(text)
    return jsonify(result)

@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    """Legacy endpoint for sentiment batch"""
    data = request.json
    texts = data.get('texts', [])
    
    if not texts:
        return jsonify({"error": "No texts provided"}), 400
    
    results = []
    for text in texts:
        result = predict_sentiment(text)
        results.append(result)
    
    return jsonify({"results": results})

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        "status": "healthy",
        "sentiment_model_loaded": sentiment_model is not None,
        "sentiment_vectorizer_loaded": sentiment_vectorizer is not None,
        "feature_models_loaded": feature_models is not None,
        "available_feature_models": list(feature_models.keys()) if feature_models else []
    })

if __name__ == '__main__':
    print("🚀 Starting comprehensive sentiment and feature analysis API server...")
    print("📍 API will be available at: http://localhost:5000")
    print("📍 Health check: http://localhost:5000/health")
    print("📍 Comprehensive prediction: POST http://localhost:5000/predict_comprehensive")
    print("📍 Batch comprehensive: POST http://localhost:5000/predict_comprehensive_batch")
    print("📍 Legacy sentiment: POST http://localhost:5000/predict")
    app.run(debug=True, host='0.0.0.0', port=5000)