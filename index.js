import { chromium } from 'playwright';
import retry from 'async-retry';
import fs from 'fs/promises';

async function main() {
    // channel: 'chromium' uses the "new" headless mode, which looks like a normal browser
    const browser = await chromium.launch({ headless: true, channel: 'chromium' });
    try {
        // default UA contains "HeadlessChrome", which triggers Booking's bot challenge (HTTP 202)
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36',
            locale: 'en-US',
        });
        const page = await context.newPage();

        const params = new URLSearchParams({
            ss: 'Kraków',
            checkin: '2026-10-04',
            checkout: '2026-10-07',
            group_adults: '2',
            no_rooms: '1',
            group_children: '0',
            lang: 'en-us',
        });
        await page.goto(`https://www.booking.com/searchresults.html?${params}`);

        // dismiss cookie banner if it shows up
        await page.locator('#onetrust-accept-btn-handler').click({ timeout: 5000 }).catch(() => {});

        await page.waitForSelector('[data-testid="property-card"]');

        const hotels = await page.$$eval('[data-testid="property-card"]', (items) =>
            items.map((item) => ({
                title: item.querySelector('[data-testid="title"]')?.innerText.trim(),
                link: item.querySelector('h3 a').href,
                price: item.querySelector('[data-testid="price-and-discounted-price"]')?.innerText.trim(),
            }))
        );

        const hotelsJson = JSON.stringify(hotels, null, 2);
        await fs.writeFile('./result.json', hotelsJson, 'utf8');
        console.log(hotels);
    } finally {
        await browser.close();
    }
}

retry(main, {
    retries: 3,
    onRetry: (err) => console.log('retrying...', err.message),
}).catch((err) => console.error('Failed after retries:', err));