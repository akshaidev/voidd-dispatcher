import express from 'express';
import { CAMPUSES, normalizeCampus, normalizeSemester, SHEETS_REGISTRY, getSheetExportUrl } from './config/sheets.js';
import { timetableCache } from './cache.js';
import { syncAllSheets, syncSingleSheet } from './service.js';

const router = express.Router();

/**
 * GET /api/timetable?campus={campus}&sem={sem}
 *
 * Query Params:
 * - campus: Campus identifier slug (rishihood, adypu, smru, s-vyasa)
 * - sem: Semester number or slug (1..8, 01..08, sem-01..sem-08)
 */
router.get('/', async (req, res) => {
    const rawCampus = req.query.campus;
    const rawSem = req.query.sem;

    // 1. Validate campus
    const campus = normalizeCampus(rawCampus);
    if (!campus) {
        const allowed = Object.keys(CAMPUSES).join(', ');
        return res.status(400).json({
            error: "Missing or invalid 'campus' parameter.",
            allowedCampuses: Object.keys(CAMPUSES),
            message: `Please specify a valid campus: ${allowed}`,
        });
    }

    // 2. Validate semester
    const sem = normalizeSemester(rawSem);
    if (!sem) {
        return res.status(400).json({
            error: "Missing or invalid 'sem' parameter.",
            message: "Please specify a valid semester between 1 and 8 (e.g. sem=1 or sem=sem-01).",
        });
    }

    // 3. Retrieve from in-memory cache
    let cached = timetableCache.get(campus, sem);

    // If not cached yet, attempt on-demand fetch if a URL is configured
    if (!cached) {
        const key = `${campus}_${sem}`;
        const sheetConfig = SHEETS_REGISTRY[key];
        if (sheetConfig && getSheetExportUrl(sheetConfig)) {
            await syncSingleSheet(sheetConfig);
            cached = timetableCache.get(campus, sem);
        }
    }

    // If still not cached (unconfigured URL or not parsed), return null
    if (!cached) {
        return res.json(null);
    }

    return res.json(cached);
});

/**
 * POST /api/timetable/refresh
 *
 * Manual trigger that immediately re-fetches all configured sheets,
 * updates the cache in place, and returns the sync status summary.
 */
router.post('/refresh', async (req, res) => {
    try {
        const syncSummary = await syncAllSheets();
        return res.json({
            success: true,
            message: 'Timetable refresh completed successfully.',
            timestamp: syncSummary.timestamp,
            results: {
                total: syncSummary.total,
                updated: syncSummary.updated,
                failed: syncSummary.failed,
                skipped: syncSummary.skipped,
            },
        });
    } catch (err) {
        console.error('[Timetable Refresh Error]:', err.message);
        return res.status(500).json({
            success: false,
            error: 'Failed to execute timetable refresh.',
            details: err.message,
        });
    }
});

export default router;
