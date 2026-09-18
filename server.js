import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import { createProxyMiddleware } from 'http-proxy-middleware';

const app = express();
const PORT = process.env.PORT || 3000;
const RECAPTCHA_SITE_KEY = '6Lf_NBgaAAAAAJyDanAyvywRHcAuAbedr5slkECB';

app.use(
    cors({
        origin: (origin, callback) => callback(null, true),
        credentials: true,
    })
);

// 1. REVERSE PROXY: Catches ALL /api calls (v1, v2, etc.) EXCEPT our local /api/send-otp
app.use(
    createProxyMiddleware({
        target: 'https://my.newtonschool.co',
        changeOrigin: true,
        secure: true,
        pathFilter: (pathname) => pathname.startsWith('/api') && pathname !== '/api/send-otp',
        on: {
            proxyReq: (proxyReq, req) => {
                proxyReq.removeHeader('origin');
                proxyReq.removeHeader('referer');
                console.log(`[Proxy Outgoing] ${req.method} ${req.originalUrl}`);
            },
            proxyRes: (proxyRes, req) => {
                console.log(`[Proxy Response] ${req.method} ${req.originalUrl} -> ${proxyRes.statusCode}`);
            },
            error: (err, req) => {
                console.error(`[Proxy Error] ${req.originalUrl}:`, err.message);
            },
        },
    })
);

let browser;
let warmPage = null;
let isWarming = false;
let otpQueue = Promise.resolve();

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

        await page.route('**/*', (route) => {
            const type = route.request().resourceType();
            const url = route.request().url();
            if (
                ['image', 'stylesheet', 'font', 'media'].includes(type) ||
                url.includes('google-analytics') ||
                url.includes('mixpanel')
            ) {
                return route.abort();
            }
            route.continue();
        });

        await page.goto('https://my.newtonschool.co/login', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
        });

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
    } catch {
        warmPage = null;
    } finally {
        isWarming = false;
    }
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', warm: Boolean(warmPage) });
});

// 2. OTP DISPATCHER: Apply express.json() specifically to this endpoint
app.post('/api/send-otp', express.json(), (req, res) => {
    const rawPhone = req.body?.phone;
    if (!rawPhone) return res.status(400).json({ error: 'Phone is required' });

    const digits = String(rawPhone).replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) return res.status(400).json({ error: 'Invalid 10-digit number' });

    otpQueue = otpQueue
        .then(async () => {
            if (!warmPage) await prepareWarmPage();

            const page = warmPage;
            warmPage = null;
            setTimeout(() => prepareWarmPage(), 100);

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

            page.context().close().catch(() => { });

            if (!result.ok) {
                return res.status(result.status || 400).json({
                    error: result.data?.message || result.data?.detail || 'Portal rejected OTP',
                });
            }

            res.json({ success: true, message: 'OTP sent successfully' });
        })
        .catch((err) => {
            prepareWarmPage().catch(() => { });
            res.status(500).json({ error: err.message || 'Dispatcher failure' });
        });
});

initBrowser()
    .then(() => {
        app.listen(PORT, () => console.log(`Consolidated backend live on port ${PORT}`));
    })
    .catch((err) => {
        console.error('Boot error:', err);
        process.exit(1);
    });