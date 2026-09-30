import cron from 'node-cron';
import { SHEETS_REGISTRY, getSheetExportUrl } from './config/sheets.js';
import { parseTimetableXlsx } from './parser.js';
import { timetableCache } from './cache.js';

const FETCH_TIMEOUT_MS = 15000;

/**
 * Fetches and parses a single sheet from its Google Sheet export XLSX URL.
 * If url is empty, skips fetching.
 * If live fetch fails, logs warning and leaves cache untouched (no mock data).
 */
export async function syncSingleSheet(sheetConfig) {
    const { campus, sem } = sheetConfig;
    const exportUrl = getSheetExportUrl(sheetConfig);

    // If no URL is configured, skip immediately
    if (!exportUrl) {
        return { campus, sem, skipped: true };
    }

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        const response = await fetch(exportUrl, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; TimetableIngest/1.0)',
                Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream, */*',
            },
        });
        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`Google Sheets export returned HTTP ${response.status}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const parsedPayload = parseTimetableXlsx(buffer, campus, sem);
        timetableCache.set(campus, sem, parsedPayload);
        console.log(`[Timetable] Successfully fetched and parsed live XLSX for ${campus} sem-${sem}`);
        return { campus, sem, updated: true };
    } catch (err) {
        console.warn(`[Timetable] Live fetch failed for ${campus} sem-${sem}:`, err.message);
        return { campus, sem, updated: false, error: err.message };
    }
}

/**
 * Synchronizes all configured sheets across all campuses and semesters.
 * Only attempts fetch for sheets with configured URLs.
 */
export async function syncAllSheets() {
    console.log('[Timetable] Starting timetable sync across configured campus sheets...');
    const sheetEntries = Object.values(SHEETS_REGISTRY);

    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    await Promise.allSettled(
        sheetEntries.map(async (sheetConfig) => {
            const res = await syncSingleSheet(sheetConfig);
            if (res.updated) {
                updatedCount++;
            } else if (res.error) {
                failedCount++;
            } else if (res.skipped) {
                skippedCount++;
            }
            return res;
        })
    );

    const now = Date.now();
    timetableCache.setLastSync(now);

    console.log(
        `[Timetable] Sync complete: ${updatedCount} updated, ${failedCount} errors, ${skippedCount} unconfigured sheets.`
    );

    return {
        total: sheetEntries.length,
        updated: updatedCount,
        failed: failedCount,
        skipped: skippedCount,
        timestamp: now,
    };
}

/**
 * Initializes the 6-hour cron schedule (0 *\/6 * * *) and fires initial boot sync.
 */
export function startTimetableCron() {
    // Run an initial sync asynchronously on boot
    syncAllSheets().catch((err) => {
        console.error('[Timetable] Initial background sync error:', err.message);
    });

    // Schedule cron every 6 hours
    const cronJob = cron.schedule('0 */6 * * *', async () => {
        console.log('[Timetable Cron] Executing scheduled 6-hour timetable sync...');
        try {
            await syncAllSheets();
        } catch (err) {
            console.error('[Timetable Cron] Sync failed:', err.message);
        }
    });

    console.log('[Timetable] 6-hour background synchronization cron initialized (0 */6 * * *).');
    return cronJob;
}
