import XLSX from 'xlsx';

/**
 * Map day name to numeric day of week (Monday = 1 ... Saturday = 6)
 */
export const DAYS_MAP = {
    monday: { name: 'Monday', dayOfWeek: 1 },
    tuesday: { name: 'Tuesday', dayOfWeek: 2 },
    wednesday: { name: 'Wednesday', dayOfWeek: 3 },
    thursday: { name: 'Thursday', dayOfWeek: 4 },
    friday: { name: 'Friday', dayOfWeek: 5 },
    saturday: { name: 'Saturday', dayOfWeek: 6 },
};

/**
 * Normalizes single time string (e.g. "9:00", "1:30", "12:30", "5:30", "09:00 AM") to 24-hour "HH:mm".
 * Uses college timetable context where hours 1-7 without AM/PM are PM (13:00-19:00).
 */
export function normalizeTimeTo24h(timeStr, referenceStartMinutes = null) {
    if (!timeStr) return null;
    const clean = timeStr.trim().toLowerCase();

    // Check for explicit AM/PM
    const isExplicitAm = clean.includes('am');
    const isExplicitPm = clean.includes('pm');

    // Extract hours and minutes
    const timeMatch = clean.match(/(\d{1,2})[:.](\d{2})?/);
    if (!timeMatch) return null;

    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;

    if (isExplicitAm) {
        if (hour === 12) hour = 0;
    } else if (isExplicitPm) {
        if (hour < 12) hour += 12;
    } else {
        // Timetable heuristic:
        // College hours: 8, 9, 10, 11 are AM (08:00 - 11:00)
        // 12 is 12:00 PM
        // 1, 2, 3, 4, 5, 6, 7 are PM (13:00 - 19:00)
        if (hour >= 1 && hour <= 7) {
            hour += 12;
        }
        // If referenceStartMinutes is provided (e.g. for endTime) and hour < start, shift to PM
        if (referenceStartMinutes !== null) {
            const currentTotal = hour * 60 + minute;
            if (currentTotal < referenceStartMinutes && hour < 12) {
                hour += 12;
            }
        }
    }

    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    return {
        formatted: `${hh}:${mm}`,
        totalMinutes: hour * 60 + minute,
    };
}

/**
 * Parses time range header e.g. "9:00-9:15", "9:30-10:00", "12:30-1:30", "5:30-6:00", "9:00-9.15"
 */
export function parseTimeRange(cellText) {
    if (!cellText) return null;
    const cleaned = cellText.replace(/\s+/g, ' ').trim();

    // Pattern for start - end
    const parts = cleaned.split(/\s*[-–—to]\s*/i);
    if (parts.length < 2) return null;

    const startObj = normalizeTimeTo24h(parts[0]);
    if (!startObj) return null;

    const endObj = normalizeTimeTo24h(parts[1], startObj.totalMinutes);
    if (!endObj) return null;

    return {
        startTime: startObj.formatted,
        endTime: endObj.formatted,
        startMinutes: startObj.totalMinutes,
        endMinutes: endObj.totalMinutes,
    };
}

/**
 * Normalizes batch array into deterministic slug (e.g. "batch_a1", "batch_a1_a2", "all")
 */
export function formatBatchPrefix(batches) {
    if (!batches || !Array.isArray(batches) || batches.length === 0 || batches.includes('ALL')) {
        return 'all';
    }

    const cleaned = batches
        .map((b) => String(b).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))
        .filter(Boolean)
        .sort();

    if (cleaned.length === 0) return 'all';
    if (cleaned.length === 1) return cleaned[0];

    // If all batches share a common prefix like "batch_", collapse common prefix (e.g. ['batch_a1', 'batch_a2'] -> "batch_a1_a2")
    const first = cleaned[0];
    const match = first.match(/^([a-z]+_)/);
    if (match) {
        const prefix = match[1];
        const allHavePrefix = cleaned.every((b) => b.startsWith(prefix));
        if (allHavePrefix) {
            const suffixes = cleaned.map((b) => b.slice(prefix.length));
            return `${prefix}${suffixes.join('_')}`;
        }
    }

    return cleaned.join('_');
}

/**
 * Generates deterministic composite slot identifier (e.g. "mon_0900_batch_a1_a2", "mon_1230_all")
 */
export function generateSlotId(dayName, startTime, batches) {
    const dayPrefix = (dayName || 'slot').slice(0, 3).toLowerCase();
    const timeStr = (startTime || '0000').replace(':', '');
    const batchPrefix = formatBatchPrefix(batches);

    return `${dayPrefix}_${timeStr}_${batchPrefix}`;
}

/**
 * Determines whether a slot is instructional class or non-instructional break
 */
export function isClassSlot(subject) {
    if (!subject) return false;
    const lower = subject.trim().toLowerCase();
    const nonInstructionalPattern = /\b(lunch|break|recess|tea\s*break|free|leisure|gap)\b/i;
    return !nonInstructionalPattern.test(lower);
}

/**
 * Checks whether Column A value represents a Day name header
 */
export function matchDayName(cellValue) {
    if (!cellValue) return null;
    const clean = cellValue.trim().toLowerCase();
    for (const [dayKey, dayInfo] of Object.entries(DAYS_MAP)) {
        if (clean === dayKey || clean.startsWith(dayKey)) {
            return dayInfo;
        }
    }
    return null;
}

/**
 * Checks whether a text in Column A is a meta-label (not an actual batch)
 */
export function isMetaHeader(cellValue) {
    if (!cellValue) return true;
    const clean = cellValue.trim().toLowerCase();
    const headers = [
        'day',
        'time',
        'slot',
        'slots',
        'period',
        'periods',
        'batch',
        'batches',
        'section',
        'sections',
        'date',
        'sr no',
        'sr. no',
        'sr.no',
        'timetable',
        'schedule',
    ];
    return headers.includes(clean);
}

/**
 * Main XLSX timetable parser.
 * Reads workbook binary buffer via SheetJS and leverages exact `!merges` bounding boxes.
 * Completely eliminates time-bleeding and dropped batches.
 */
export function parseTimetableXlsx(buffer, campusSlug = '', sem = '') {
    if (!buffer || (Buffer.isBuffer(buffer) && buffer.length === 0)) {
        return {
            campus: campusSlug,
            sem: String(sem),
            lastUpdated: Date.now(),
            availableBatches: [],
            schedule: [],
        };
    }

    let workbook;
    try {
        workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (err) {
        throw new Error(`Failed to parse XLSX workbook: ${err.message}`);
    }

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        return {
            campus: campusSlug,
            sem: String(sem),
            lastUpdated: Date.now(),
            availableBatches: [],
            schedule: [],
        };
    }

    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    if (!sheet || !sheet['!ref']) {
        return {
            campus: campusSlug,
            sem: String(sem),
            lastUpdated: Date.now(),
            availableBatches: [],
            schedule: [],
        };
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const merges = sheet['!merges'] || [];

    // Fast coordinate lookup for merged cells: `${r}_${c}` -> { merge, isTopLeft }
    const mergeMap = new Map();
    for (const m of merges) {
        for (let r = m.s.r; r <= m.e.r; r++) {
            for (let c = m.s.c; c <= m.e.c; c++) {
                mergeMap.set(`${r}_${c}`, {
                    merge: m,
                    isTopLeft: (r === m.s.r && c === m.s.c),
                });
            }
        }
    }

    function getCellValue(r, c) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[addr];
        if (!cell || cell.v === undefined || cell.v === null) return '';
        return String(cell.v).trim();
    }

    function extractTimeHeadersFromSheetRow(r) {
        const headersMap = new Map();
        for (let c = range.s.c + 1; c <= range.e.c; c++) {
            const val = getCellValue(r, c);
            const parsed = parseTimeRange(val);
            if (parsed) {
                headersMap.set(c, {
                    colIndex: c,
                    startTime: parsed.startTime,
                    endTime: parsed.endTime,
                });
            }
        }
        return headersMap;
    }

    const availableBatchesSet = new Set();
    const rawSlots = [];

    let currentDay = null;
    let currentTimeHeadersMap = null;
    let dayBatchRows = [];

    function processDayBlock(dayInfo, timeHeadersMap, batchRows) {
        if (!dayInfo || !timeHeadersMap || timeHeadersMap.size === 0 || batchRows.length === 0) {
            return;
        }

        const rowToBatch = new Map();
        for (const b of batchRows) {
            rowToBatch.set(b.rowIndex, b);
        }

        for (const bRow of batchRows) {
            const r = bRow.rowIndex;

            for (const [c, header] of timeHeadersMap.entries()) {
                const mInfo = mergeMap.get(`${r}_${c}`);

                // If cell is an interior cell of a merge, skip (handled by top-left)
                if (mInfo && !mInfo.isTopLeft) {
                    continue;
                }

                let startTime, endTime;
                let slotBatches = [];
                let cellValue = '';

                if (mInfo && mInfo.isTopLeft) {
                    const m = mInfo.merge;
                    cellValue = getCellValue(m.s.r, m.s.c);
                    if (!cellValue) continue;

                    // Start time from s.c, End time from e.c (never expand past e.c)
                    let startH = timeHeadersMap.get(m.s.c);
                    let endH = timeHeadersMap.get(m.e.c);

                    if (!startH) {
                        for (let col = m.s.c; col <= m.e.c; col++) {
                            if (timeHeadersMap.has(col)) {
                                startH = timeHeadersMap.get(col);
                                break;
                            }
                        }
                    }
                    if (!endH) {
                        for (let col = m.e.c; col >= m.s.c; col--) {
                            if (timeHeadersMap.has(col)) {
                                endH = timeHeadersMap.get(col);
                                break;
                            }
                        }
                    }

                    if (!startH || !endH) continue;
                    startTime = startH.startTime;
                    endTime = endH.endTime;

                    // Collect all batches in Column A across rows s.r through e.r
                    if (bRow.isUniversal) {
                        slotBatches = ['ALL'];
                    } else {
                        for (let rIdx = m.s.r; rIdx <= m.e.r; rIdx++) {
                            if (rowToBatch.has(rIdx)) {
                                const b = rowToBatch.get(rIdx);
                                if (b.isUniversal) {
                                    slotBatches.push('ALL');
                                } else {
                                    slotBatches.push(b.batchLabel);
                                }
                            }
                        }
                    }
                } else {
                    // Cell not in !merges: single period or free period
                    cellValue = getCellValue(r, c);
                    if (!cellValue) continue;

                    startTime = header.startTime;
                    endTime = header.endTime;
                    slotBatches = bRow.isUniversal ? ['ALL'] : [bRow.batchLabel];
                }

                if (slotBatches.length === 0) {
                    slotBatches = [bRow.batchLabel];
                }

                // Split Subject and Room on '-' or newline
                let subject = cellValue;
                let room = null;
                const dashIndex = cellValue.indexOf('-');
                if (dashIndex !== -1) {
                    subject = cellValue.substring(0, dashIndex).trim();
                    room = cellValue.substring(dashIndex + 1).trim() || null;
                } else if (cellValue.includes('\n')) {
                    const lines = cellValue.split('\n').map(l => l.trim()).filter(Boolean);
                    subject = lines[0] || cellValue;
                    room = lines.slice(1).join(' ') || null;
                }

                const isClass = isClassSlot(subject);

                for (const batch of slotBatches) {
                    rawSlots.push({
                        day: dayInfo.name,
                        dayOfWeek: dayInfo.dayOfWeek,
                        startTime,
                        endTime,
                        subject,
                        room,
                        isClass,
                        batch,
                    });
                }
            }
        }
    }

    function flushCurrentDay() {
        if (currentDay && dayBatchRows.length > 0) {
            processDayBlock(currentDay, currentTimeHeadersMap, dayBatchRows);
        }
        dayBatchRows = [];
    }

    for (let r = range.s.r; r <= range.e.r; r++) {
        const colA = getCellValue(r, 0);

        // 1. Check if row defines a new Day
        const detectedDay = matchDayName(colA);
        if (detectedDay) {
            flushCurrentDay();
            currentDay = detectedDay;
            const headersInSameRow = extractTimeHeadersFromSheetRow(r);
            if (headersInSameRow.size >= 2) {
                currentTimeHeadersMap = headersInSameRow;
            }
            continue;
        }

        // 2. Check if row is a time header row
        const timeHeadersInRow = extractTimeHeadersFromSheetRow(r);
        if (timeHeadersInRow.size >= 2) {
            currentTimeHeadersMap = timeHeadersInRow;
            continue;
        }

        // 3. Skip meta-headers (e.g. "BATCH", "TIME")
        if (isMetaHeader(colA)) {
            continue;
        }

        // 4. Batch row under active day block
        if (currentDay && currentTimeHeadersMap && colA) {
            const isUniversalRow = /^(lunch|break|recess|tea\s*break|all|common)$/i.test(colA);
            const batchLabel = colA;

            if (!isUniversalRow) {
                availableBatchesSet.add(batchLabel);
            }

            dayBatchRows.push({
                rowIndex: r,
                batchLabel,
                isUniversal: isUniversalRow,
            });
        }
    }

    flushCurrentDay();

    const availableBatches = Array.from(availableBatchesSet).sort();
    const consolidatedSchedule = aggregateSlots(rawSlots, availableBatches);

    return {
        campus: campusSlug,
        sem: String(sem),
        lastUpdated: Date.now(),
        availableBatches,
        schedule: consolidatedSchedule,
    };
}

export { parseTimetableXlsx as parseTimetableCsv };

/**
 * Aggregates raw slots that share the same day, time, subject, and room across batches.
 * Assigns ["ALL"] if slot covers all discovered batches or is a universal event (like Lunch).
 */
export function aggregateSlots(rawSlots, availableBatches) {
    const slotMap = new Map();

    for (const slot of rawSlots) {
        // Group key
        const key = `${slot.dayOfWeek}_${slot.startTime}_${slot.endTime}_${slot.subject}_${slot.room || ''}`;

        if (!slotMap.has(key)) {
            slotMap.set(key, {
                day: slot.day,
                dayOfWeek: slot.dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
                subject: slot.subject,
                room: slot.room,
                isClass: slot.isClass,
                batchesSet: new Set(),
            });
        }

        const entry = slotMap.get(key);
        if (slot.batch === 'ALL') {
            entry.hasUniversal = true;
        } else {
            entry.batchesSet.add(slot.batch);
        }
    }

    const finalSchedule = [];

    for (const entry of slotMap.values()) {
        let batches;
        const totalBatchesCount = availableBatches.length;

        // If universal event (e.g. Lunch), or explicitly covers all available batches
        if (
            entry.hasUniversal ||
            (totalBatchesCount > 0 && entry.batchesSet.size >= totalBatchesCount) ||
            !entry.isClass
        ) {
            batches = ['ALL'];
        } else {
            batches = Array.from(entry.batchesSet).sort();
            if (batches.length === 0) {
                batches = ['ALL'];
            }
        }

        finalSchedule.push({
            id: generateSlotId(entry.day, entry.startTime, batches),
            day: entry.day,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            subject: entry.subject,
            room: entry.room,
            batches,
            isClass: entry.isClass,
        });
    }

    // Sort chronologically by dayOfWeek then startTime
    finalSchedule.sort((a, b) => {
        if (a.dayOfWeek !== b.dayOfWeek) {
            return a.dayOfWeek - b.dayOfWeek;
        }
        return a.startTime.localeCompare(b.startTime);
    });

    return finalSchedule;
}
