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

# ======================
# TEXT PREPROCESSING
# ======================
def preprocess_text(text):
    """Minimal preprocessing: collapse excess whitespace while preserving dates, times, and currency amounts."""
    if not text or text == "N/A":
        return ""

    # Normalize newlines and tabs to spaces
    text = text.replace("\n", " ").replace("\t", " ")

    # Define patterns for dates, times, and currency amounts
    patterns = {
        'DATE': r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|[A-Za-z]{3,9} \d{1,2}, \d{4})\b",
        'TIME': r"\b\d{1,2}:\d{2}(?:\s?[APMapm]{2})?\b",
        'CURRENCY': r"\b(?:\$|€|£)\s?\d{1,3}(?:[,\.]\d{3})*(?:\.\d+)?\b"
    }

    # Mask matched substrings to placeholders
    masks = {}
    counts = {key: 0 for key in patterns}
    for label, pat in patterns.items():
        def _mask(m):
            idx = counts[label]
            placeholder = f"__{label}{idx}__"
            masks[placeholder] = m.group(0)
            counts[label] += 1
            return placeholder

        text = re.sub(pat, _mask, text)

    # Collapse all other excess whitespace
    text = re.sub(r"\s+", " ", text).strip()

    # Unmask placeholders back to original substrings
    for placeholder, original in masks.items():
        text = text.replace(placeholder, original)

    return text


# Function to scroll until reviews load
def scroll_until_reviews_load(driver):
    """Scroll down gradually until the reviews section appears."""
    scroll_pause_time = 1  # Adjust pause time if needed
    for _ in range(10):  # Scroll multiple times
        driver.execute_script("window.scrollBy(0, 500);")
        time.sleep(scroll_pause_time)
        try:
            reviews_section = driver.find_element(By.CLASS_NAME, "pdp-mod-review")
            if reviews_section.is_displayed():
                print("Reviews section found!")
                return True
        except:
            pass
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
    "https://www.lazada.com.ph/products/pdp-i4937255353-s28882693231.html"
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
    writer.writerow([
        "Review", "Star Rating", "Valence", "Internal Consistency", "Argument Quality",
        "Objectivity", "Sidedness", "RIQ Score", "RIQ Label", "Template Flag", "Spam Flag", "CREDIBILITY"
    ])

    def scrape_reviews():
        try:
            reviews = WebDriverWait(driver, 10).until(
                EC.presence_of_all_elements_located((By.CSS_SELECTOR, ".pdp-mod-review .mod-reviews .item"))
            )
            if not reviews:
                return False
            for review in reviews:
                # Extract raw text
                try:
                    raw_text = review.find_element(By.CLASS_NAME, "content").text.strip()
                except:
                    raw_text = "N/A"

                # Skip reviews with placeholder text
                if raw_text == "N/A":
                    continue

                # Get star rating
                try:
                    star_images = review.find_elements(By.CLASS_NAME, "star")
                    full_stars = sum(
                        "TB19ZvEgfDH8KJjy1XcXXcpdXXa-64-64.png" in star.get_attribute("src") for star in star_images
                    )
                    star_rating = full_stars
                except:
                    star_rating = "N/A"

                # Preprocess and write
                cleaned_text = preprocess_text(raw_text)
                writer.writerow([cleaned_text, star_rating, "", "", "", "", "", "", "", "", ""])
            return True
        except Exception as e:
            print("Error scraping reviews:", e)
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
