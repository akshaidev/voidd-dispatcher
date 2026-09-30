import timetableRouter from './routes.js';
import { startTimetableCron, syncAllSheets, syncSingleSheet } from './service.js';
import { timetableCache } from './cache.js';
import { SHEETS_REGISTRY } from './config/sheets.js';

export function getTimetableHealth() {
    return timetableCache.getStatus(Object.keys(SHEETS_REGISTRY).length);
}

export {
    timetableRouter,
    startTimetableCron,
    syncAllSheets,
    syncSingleSheet,
    timetableCache,
};
