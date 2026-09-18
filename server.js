import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';

const app = express();
const PORT = process.env.PORT || 3000;
const RECAPTCHA_SITE_KEY = '6Lf_NBgaAAAAAJyDanAyvywRHcAuAbedr5slkECB';

app.use(cors({ origin: '*' }));
app.use(express.json());

let browser;
let warmPage = null;
let isWarming = false;

// Launch browser with hardware acceleration flags disabled for speed
async function initBrowser() {
    browser = await chromium.launch({
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-blink-features=AutomationControlled',
            '--disable-extensions',
            '--disable-gpu',
        ],
    });
    console.log('Chromium ready');
    await prepareWarmPage();
}

// Pre-load a page so it is sitting ready in memory before any request arrives
async function prepareWarmPage() {
    if (isWarming || !browser) return;
    isWarming = true;

    try {
        const context = await browser.newContext({
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        });

        await context.addInitScript(() => {
            Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        });

        const page = await context.newPage();

        // Block images, styles, fonts, and analytics to make loads near-instant
        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            const url = route.request().url();
            if (
                ['image', 'stylesheet', 'font', 'media'].includes(type) ||
                url.includes('google-analytics') ||
                url.includes('mixpanel') ||
                url.includes('segment')
            ) {
                return route.abort();
            }
            route.continue();
        });

        await page.goto('https://my.newtonschool.co/login', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
        });

        // Pre-inject reCAPTCHA so it is ready for immediate execution
        await page.evaluate((siteKey) => {
            return new Promise((resolve) => {
                if (window.grecaptcha?.execute) return resolve();
                const script = document.createElement('script');
                script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
                script.onload = () => resolve();
                document.head.appendChild(script);
            });
        }, RECAPTCHA_SITE_KEY);

        await page.waitForFunction(
            () => typeof window.grecaptcha?.execute === 'function',
            null,
            { timeout: 10000 }
        );

        warmPage = page;
        console.log('⚡ Standby page warm and ready for instant dispatch');
    } catch (err) {
        console.error('Failed to warm page:', err.message);
        warmPage = null;
    } finally {
        isWarming = false;
    }
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', warm: Boolean(warmPage) });
});

app.post('/api/send-otp', async (req, res) => {
    const rawPhone = req.body?.phone;
    if (!rawPhone) return res.status(400).json({ error: 'Phone is required' });

    const digits = String(rawPhone).replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) return res.status(400).json({ error: 'Invalid 10-digit number' });

    const startTime = Date.now();

    try {
        // If a warm page is ready, use it instantly. Otherwise, wait for one.
        if (!warmPage) {
            console.log('No warm page available, spinning up immediately...');
            await prepareWarmPage();
        }

        const page = warmPage;
        warmPage = null; // Take ownership so next request doesn't clash

        // Trigger pre-warming for the next request in the background
        setTimeout(() => prepareWarmPage(), 100);

        // Execute directly in the pre-warmed DOM
        const result = await page.evaluate(
            async ({ siteKey, phone }) => {
                return new Promise((resolve) => {
                    window.grecaptcha.ready(async () => {
                        try {
                            const token = await window.grecaptcha.execute(siteKey, { action: 'login' });

                            const response = await fetch('/api/v1/user/otp/', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    Accept: 'application/json, text/plain, */*',
                                },
                                body: JSON.stringify({
                                    phone: `+91${phone}`,
                                    'g-recaptcha-response': token,
                                }),
                            });

                            const payload = await response.json().catch(() => ({}));
                            resolve({ ok: response.ok, status: response.status, data: payload });
                        } catch (err) {
                            resolve({ ok: false, status: 500, error: err.message });
                        }
                    });
                });
            },
            { siteKey: RECAPTCHA_SITE_KEY, phone: digits }
        );

        // Close used context asynchronously
        page.context().close().catch(() => { });

        console.log(`[${digits}] Dispatched in ${Date.now() - startTime}ms`);

        if (!result.ok) {
            return res.status(result.status || 400).json({
                error: result.data?.message || result.data?.detail || 'Portal rejected OTP request',
            });
        }

        return res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
        console.error('Dispatch failed:', err);
        prepareWarmPage().catch(() => { });
        return res.status(500).json({ error: err.message || 'Internal dispatcher error' });
    }
});

initBrowser()
    .then(() => {
        app.listen(PORT, () => console.log(`Dispatcher listening on port ${PORT}`));
    })
    .catch((err) => {
        console.error('Failed to start:', err);
        process.exit(1);
    });