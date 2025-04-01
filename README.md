**For Web Scraping**

1. Download Google Chrome. (https://www.google.com/intl/en_ph/chrome/)
2. Download Chrome Webdriver. (https://googlechromelabs.github.io/chrome-for-testing/)
   <br> 2.1 Go to the site, go to *Stable*.
   <br> 2.2 Choose your platform. Copy the corresponding URL then hit download.
   <br><br>  ***P.S. DAPAT PAREHO ANG CHROME DRIVER VERSION AT GOOGLE CHROME VERSION*** <br><br>
3. Download Pycharm. (https://www.jetbrains.com/pycharm/download/?section=windows)
4. Download Python 3.13. (https://www.python.org/downloads/)
   <br> Configure mo yung Python sa Pycharm if merong any problems. Kaya mo na yan <br>
5. When webscraping, palitan yung paths sa code. <br>
   <br> * **chrome_driver_path** = r"C:\Users\marce\Downloads\chromedriver-win64\chromedriver-win64\chromedriver.exe" (*palitan ng path mo ng chrome driver*) <br>
   <br> * **brave_path** = r"C:\Program Files\Google\Chrome\Application\chrome.exe" (*palitan ng path mo ng Chrome*, *brave talaga yan 'di ko napalitan, tinry ko una sa Brave eh.*) <br>
   <br> * **driver.get**(
    "https://www.lazada.com.ph/products/win-premium-treasures-2025gift-for-you-mobile-gadgets-and-accessories-awesome-freebies-mega-flash-specially-gift-for-you-i4943459256-s28804156813.html") (*palitan ng link ng product na pagwwebscrape-an mo*) <br>
6. After niyan, automatically magssave ng CSV file yan. Hanapin mo sa directory ng PyCharm. Then upload mo sa GDrive link. (https://drive.google.com/drive/folders/174aHQIe1u0EHe3h6phNdtBR4RmgZ2llU?usp=sharing) or diretso na mismo dito sa GitHub Repo.
