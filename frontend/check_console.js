const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER_PAGE_ERROR:', error.message));

    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle2' });
    
    // Check if the page is blank by getting its inner text
    const text = await page.evaluate(() => document.body.innerText);
    console.log('PAGE_TEXT_LENGTH:', text.length);
    console.log('PAGE_TEXT:', text.substring(0, 100));
    
    await browser.close();
  } catch (error) {
    console.error('SCRIPT_ERROR:', error);
  }
})();
