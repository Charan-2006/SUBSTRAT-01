const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('BROWSER ERROR:', msg.text());
            }
        });

        page.on('pageerror', error => {
            console.log('PAGE ERROR:', error.message);
            console.log(error.stack);
        });

        console.log('Navigating to http://localhost:5173/dashboard...');
        await page.goto('http://localhost:5173/dashboard', { waitUntil: 'networkidle2', timeout: 30000 });
        
        console.log('Done waiting.');
        await browser.close();
    } catch (e) {
        console.error('Script Error:', e);
    }
})();
