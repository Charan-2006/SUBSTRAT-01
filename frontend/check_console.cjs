const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
    page.on('pageerror', error => console.error('BROWSER_PAGE_ERROR:', error.message));

    await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2', timeout: 5000 }).catch(e => {});
    
    await new Promise(r => setTimeout(r, 2000));

    const html = await page.content();
    console.log('PAGE_HTML:', html.substring(0, 1000));
    
    await browser.close();
  } catch (error) {
    console.error('SCRIPT_ERROR:', error);
  }
})();
