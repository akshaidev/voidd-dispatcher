/**
 * In-Memory Timetable Cache
 *
 * Keeps parsed timetable payloads in-memory keyed by `${campus}_${sem}`.
 * Updates entries strictly in-place to prevent empty responses or cache flushes during network sync.
 */

class TimetableCache {
    constructor() {
        this.cache = new Map();
        this.lastSyncTimestamp = null;
        this.isInitialized = false;
    }

    /**
     * Cache key format: e.g. "s-vyasa_1"
     */
    _makeKey(campus, sem) {
        return `${String(campus).trim().toLowerCase()}_${String(sem).trim()}`;
    }

    /**
     * Returns cached payload for campus and semester, or null.
     */
    get(campus, sem) {
        const key = this._makeKey(campus, sem);
        return this.cache.get(key) || null;
    }

    /**
     * Updates an entry in place. Does NOT remove old data before updating.
     */
    set(campus, sem, payload) {
        const key = this._makeKey(campus, sem);
        this.cache.set(key, {
            ...payload,
            lastUpdated: payload.lastUpdated || Date.now(),
        });
        this.isInitialized = true;
    }

    /**
     * Checks if a sheet entry is present in cache.
     */
    has(campus, sem) {
        return this.cache.has(this._makeKey(campus, sem));
    }

    /**
     * Returns total number of successfully loaded sheets.
     */
    getLoadedCount() {
        return this.cache.size;
    }

    /**
     * Updates the last sync timestamp.
     */
    setLastSync(timestamp = Date.now()) {
        this.lastSyncTimestamp = timestamp;
    }

    /**
     * Returns health status of timetable cache.
     */
    getStatus(totalConfiguredSheets = 32) {
        return {
            initialized: this.isInitialized,
            totalSheets: totalConfiguredSheets,
            loadedSheets: this.cache.size,
            lastSync: this.lastSyncTimestamp,
        };
    }
}

export const timetableCache = new TimetableCache();
