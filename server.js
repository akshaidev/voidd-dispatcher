import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';

const app = express();
const PORT = process.env.PORT || 3000;
const RECAPTCHA_SITE_KEY = '6Lf_NBgaAAAAAJyDanAyvywRHcAuAbedr5slkECB';

app.use(cors({ origin: '*' }));
app.use(express.json());

let browser;

// Initialize shared Chromium instance
async function initBrowser() {
    browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    console.log('Chromium instance launched');
}

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

app.post('/api/send-otp', async (req, res) => {
    const rawPhone = req.body?.phone;
    if (!rawPhone) {
        return res.status(400).json({ error: 'Phone number is required' });
    }

    const digits = String(rawPhone).replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
        return res.status(400).json({ error: 'Invalid 10-digit number' });
    }

    let context;
    try {
        if (!browser) await initBrowser();

        // Isolated context per request
        context = await browser.newContext({
            userAgent:
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        });

        const page = await context.newPage();

        // 1. Visit Newton login page to sit inside genuine domain origin
        await page.goto('https://my.newtonschool.co/login', {
            waitUntil: 'domcontentloaded',
            timeout: 15000,
        });

        // 2. Wait for Google reCAPTCHA v3 runtime to mount
        await page.waitForFunction(() => typeof window.grecaptcha?.execute === 'function', {
            timeout: 10000,
        });

        // 3. Execute reCAPTCHA inside genuine domain context and dispatch OTP
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
                            resolve({
                                ok: response.ok,
                                status: response.status,
                                data: payload,
                            });
                        } catch (err) {
                            resolve({ ok: false, status: 500, error: err.message });
                        }
                    });
                });
            },
            { siteKey: RECAPTCHA_SITE_KEY, phone: digits }
        );

        await context.close();

        if (!result.ok) {
            return res.status(result.status || 400).json({
                error: result.data?.message || result.data?.detail || 'Failed to dispatch OTP from portal',
            });
        }

        return res.json({ success: true, message: 'OTP sent successfully' });
    } catch (err) {
        if (context) await context.close().catch(() => { });
        console.error('Dispatcher error:', err);
        return res.status(500).json({ error: err.message || 'Internal dispatcher error' });
    }
});

// Graceful termination
process.on('SIGTERM', async () => {
    if (browser) await browser.close();
    process.exit(0);
});

initBrowser()
    .then(() => {
        app.listen(PORT, () => console.log(`Dispatcher listening on port ${PORT}`));
    })
    .catch((err) => {
        console.error('Failed to boot Chromium:', err);
        process.exit(1);
    });