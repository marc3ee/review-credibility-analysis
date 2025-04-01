import csv
import time
import datetime
import re
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains


# Function to remove emojis
def remove_emojis(text):
    emoji_pattern = re.compile("[" \
                               u"\U0001F600-\U0001F64F"  # emoticons\
                               u"\U0001F300-\U0001F5FF"  # symbols & pictographs\
                               u"\U0001F680-\U0001F6FF"  # transport & map symbols\
                               u"\U0001F1E0-\U0001F1FF"  # flags (iOS)\
                               u"\U00002702-\U000027B0" \
                               u"\U000024C2-\U0001F251" \
                               "]", flags=re.UNICODE)
    return emoji_pattern.sub(r'', text)


# Function to count words
def count_words(text):
    if not text or text == "N/A":
        return 0
    text = remove_emojis(text)
    text = re.sub(r'([a-zA-Z])\.([a-zA-Z])', r'\1 \2', text)
    text = re.sub(r'([a-zA-Z])\/([a-zA-Z])', r'\1 \2', text)
    text = re.sub(r'([a-zA-Z])\-([a-zA-Z])', r'\1 \2', text)
    text = re.sub(r'[^\w\s]', ' ', text)
    words = text.split()
    return len(words)


# Function to scroll until reviews load
def scroll_until_reviews_load(driver):
    """Scroll down gradually until the reviews section appears."""
    scroll_pause_time = 1  # Adjust pause time if needed
    for _ in range(10):  # Scroll multiple times
        driver.execute_script("window.scrollBy(0, 500);")  # Scroll down in steps
        time.sleep(scroll_pause_time)
        try:
            reviews_section = driver.find_element(By.CLASS_NAME, "pdp-mod-review")
            if reviews_section.is_displayed():
                print("Reviews section found!")
                return True
        except:
            pass  # Keep scrolling if not found
    print("Could not locate reviews section after scrolling.")
    return False


# Paths
chrome_driver_path = r"C:\Users\marce\Downloads\chromedriver-win64\chromedriver-win64\chromedriver.exe"
brave_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

# Set up Brave options
options = webdriver.ChromeOptions()
options.binary_location = brave_path
options.add_argument("--disable-blink-features=AutomationControlled")
options.add_experimental_option("excludeSwitches", ["enable-automation"])
options.add_experimental_option("useAutomationExtension", False)

# Initialize the WebDriver
service = Service(chrome_driver_path)
driver = webdriver.Chrome(service=service, options=options)
actions = ActionChains(driver)

# Open the product page
driver.get(
    "https://www.lazada.com.ph/products/win-premium-treasures-2025gift-for-you-mobile-gadgets-and-accessories-awesome-freebies-mega-flash-specially-gift-for-you-i4943459256-s28804156813.html"
)

time.sleep(3)  # Allow page to load

# Scroll to reviews section
scroll_until_reviews_load(driver)

time.sleep(2)  # Allow time for the page to render

# Get today's date and time for CSV filename
today_datetime = datetime.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
csv_filename = f"reviews_{today_datetime}.csv"

# Open CSV file
with open(csv_filename, mode="w", newline="", encoding="utf-8-sig") as file:
    writer = csv.writer(file)
    writer.writerow(
        ["Review", "Star Rating", "Length", "Valence", "Review Quantity", "Internal Consistency", "Review Quality",
         "Credibility"])


    def get_total_review_count():
        try:
            review_count_element = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, ".pdp-mod-review .mod-rating .count"))
            )
            review_count_text = review_count_element.text.strip()
            review_count = re.search(r'(\d+)', review_count_text).group(1)
            return review_count
        except:
            return "N/A"


    total_reviews = get_total_review_count()


    def scrape_reviews():
        try:
            reviews = WebDriverWait(driver, 10).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".pdp-mod-review .mod-reviews .item"))
            )
            if not reviews:
                return False
            for review in reviews:
                try:
                    star_images = review.find_elements(By.CLASS_NAME, "star")
                    full_stars = sum(
                        "TB19ZvEgfDH8KJjy1XcXXcpdXXa-64-64.png" in star.get_attribute("src") for star in star_images
                    )
                    star_rating = full_stars
                except:
                    star_rating = "N/A"
                try:
                    review_text = review.find_element(By.CLASS_NAME, "content").text.strip()
                except:
                    review_text = "N/A"
                word_count = count_words(review_text)
                review_text = review_text.replace("\n", " ").replace(",", " ")
                writer.writerow([review_text, star_rating, word_count, "", total_reviews, "", "", ""])
            return True
        except:
            return False


    def go_to_next_page():
        try:
            next_buttons = driver.find_elements(By.CSS_SELECTOR,
                                                "button.next-btn.next-btn-normal.next-btn-medium.next-pagination-item.next")
            if not next_buttons:
                return False
            next_button = next_buttons[0]
            if next_button.get_attribute("disabled") is None:
                driver.execute_script("arguments[0].scrollIntoView({behavior: 'smooth', block: 'center'});",
                                      next_button)
                time.sleep(1)
                driver.execute_script("arguments[0].click();", next_button)
                time.sleep(5)
                return True
            else:
                return False
        except:
            return False


    while True:
        if not scrape_reviews():
            break
        if not go_to_next_page():
            break

driver.quit()
print(f"Scraping complete! Reviews saved to {csv_filename}")
