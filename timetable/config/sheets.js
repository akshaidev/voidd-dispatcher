/**
 * Campus & Semester Google Sheets Registry
 * 
 * Central registry for 4 campuses across 8 semesters (32 total sheets).
 * The admin pastes active Google Sheet links into the `url` field below.
 * (e.g. 16 active links for Odd Semesters 1,3,5,7 or Even Semesters 2,4,6,8).
 * 
 * Supported URL formats:
 * - Full browser URL: https://docs.google.com/spreadsheets/d/{sheetId}/edit#gid={gid}
 * - Direct export URL: https://docs.google.com/spreadsheets/d/{sheetId}/export?format=csv&gid={gid}
 * - Raw Sheet ID: {sheetId}
 */

export const CAMPUSES = {
    'rishihood': {
        name: 'Rishihood University',
        slug: 'rishihood',
    },
    'adypu': {
        name: 'Ajeenkya DY Patil University',
        slug: 'adypu',
    },
    'smru': {
        name: "St. Mary's Group of Institutions",
        slug: 'smru',
    },
    's-vyasa': {
        name: 'S-VYASA University',
        slug: 's-vyasa',
    },
};

export const SEMESTERS = [
    { num: 1, key: 'sem-01' },
    { num: 2, key: 'sem-02' },
    { num: 3, key: 'sem-03' },
    { num: 4, key: 'sem-04' },
    { num: 5, key: 'sem-05' },
    { num: 6, key: 'sem-06' },
    { num: 7, key: 'sem-07' },
    { num: 8, key: 'sem-08' },
];

export function normalizeSemester(semInput) {
    if (!semInput) return null;
    const cleaned = String(semInput).trim().toLowerCase();
    const match = cleaned.match(/(\d+)/);
    if (!match) return null;
    const num = parseInt(match[1], 10);
    if (num >= 1 && num <= 8) {
        return String(num);
    }
    return null;
}

export function normalizeCampus(campusInput) {
    if (!campusInput) return null;
    const cleaned = String(campusInput).trim().toLowerCase();
    return CAMPUSES[cleaned] ? cleaned : null;
}

/**
 * 32 PRODUCTION SHEET PLACEHOLDERS
 * Paste your Google Sheet links into the `url` field for the active semester.
 */
export const SHEETS_REGISTRY = {
    // ==========================================
    // 1. RISHIHOOD UNIVERSITY (rishihood)
    // ==========================================
    'rishihood_1': {
        title: 'Rishihood_Sem_01',
        campus: 'rishihood',
        sem: '1',
        url: '', // Paste Google Sheet link here
    },
    'rishihood_2': {
        title: 'Rishihood_Sem_02',
        campus: 'rishihood',
        sem: '2',
        url: '',
    },
    'rishihood_3': {
        title: 'Rishihood_Sem_03',
        campus: 'rishihood',
        sem: '3',
        url: '',
    },
    'rishihood_4': {
        title: 'Rishihood_Sem_04',
        campus: 'rishihood',
        sem: '4',
        url: '',
    },
    'rishihood_5': {
        title: 'Rishihood_Sem_05',
        campus: 'rishihood',
        sem: '5',
        url: '',
    },
    'rishihood_6': {
        title: 'Rishihood_Sem_06',
        campus: 'rishihood',
        sem: '6',
        url: '',
    },
    'rishihood_7': {
        title: 'Rishihood_Sem_07',
        campus: 'rishihood',
        sem: '7',
        url: '',
    },
    'rishihood_8': {
        title: 'Rishihood_Sem_08',
        campus: 'rishihood',
        sem: '8',
        url: '',
    },

    // ==========================================
    // 2. AJEENKYA DY PATIL UNIVERSITY (adypu)
    // ==========================================
    'adypu_1': {
        title: 'ADYPU_Sem_01',
        campus: 'adypu',
        sem: '1',
        url: '',
    },
    'adypu_2': {
        title: 'ADYPU_Sem_02',
        campus: 'adypu',
        sem: '2',
        url: '',
    },
    'adypu_3': {
        title: 'ADYPU_Sem_03',
        campus: 'adypu',
        sem: '3',
        url: '',
    },
    'adypu_4': {
        title: 'ADYPU_Sem_04',
        campus: 'adypu',
        sem: '4',
        url: '',
    },
    'adypu_5': {
        title: 'ADYPU_Sem_05',
        campus: 'adypu',
        sem: '5',
        url: '',
    },
    'adypu_6': {
        title: 'ADYPU_Sem_06',
        campus: 'adypu',
        sem: '6',
        url: '',
    },
    'adypu_7': {
        title: 'ADYPU_Sem_07',
        campus: 'adypu',
        sem: '7',
        url: '',
    },
    'adypu_8': {
        title: 'ADYPU_Sem_08',
        campus: 'adypu',
        sem: '8',
        url: '',
    },

    // ==========================================
    // 3. ST. MARY'S GROUP OF INSTITUTIONS (smru)
    // ==========================================
    'smru_1': {
        title: 'SMRU_Sem_01',
        campus: 'smru',
        sem: '1',
        url: '',
    },
    'smru_2': {
        title: 'SMRU_Sem_02',
        campus: 'smru',
        sem: '2',
        url: '',
    },
    'smru_3': {
        title: 'SMRU_Sem_03',
        campus: 'smru',
        sem: '3',
        url: '',
    },
    'smru_4': {
        title: 'SMRU_Sem_04',
        campus: 'smru',
        sem: '4',
        url: '',
    },
    'smru_5': {
        title: 'SMRU_Sem_05',
        campus: 'smru',
        sem: '5',
        url: '',
    },
    'smru_6': {
        title: 'SMRU_Sem_06',
        campus: 'smru',
        sem: '6',
        url: '',
    },
    'smru_7': {
        title: 'SMRU_Sem_07',
        campus: 'smru',
        sem: '7',
        url: '',
    },
    'smru_8': {
        title: 'SMRU_Sem_08',
        campus: 'smru',
        sem: '8',
        url: '',
    },

    // ==========================================
    // 4. S-VYASA UNIVERSITY (s-vyasa)
    // ==========================================
    's-vyasa_1': {
        title: 'SVYASA_Sem_01',
        campus: 's-vyasa',
        sem: '1',
        url: 'https://docs.google.com/spreadsheets/d/1N5-MVGIZR2EruBgZ0DSY9ZpR3VhW3OYZ1OCtdXJX7rQ/edit?gid=0#gid=0',
    },
    's-vyasa_2': {
        title: 'SVYASA_Sem_02',
        campus: 's-vyasa',
        sem: '2',
        url: '',
    },
    's-vyasa_3': {
        title: 'SVYASA_Sem_03',
        campus: 's-vyasa',
        sem: '3',
        url: 'https://docs.google.com/spreadsheets/d/1vcX7VPLyVBrXB1wL1MoNp6OW-5xXRP-Bmq7ndm5jpJw/edit?gid=0#gid=0',
    },
    's-vyasa_4': {
        title: 'SVYASA_Sem_04',
        campus: 's-vyasa',
        sem: '4',
        url: '',
    },
    's-vyasa_5': {
        title: 'SVYASA_Sem_05',
        campus: 's-vyasa',
        sem: '5',
        url: '',
    },
    's-vyasa_6': {
        title: 'SVYASA_Sem_06',
        campus: 's-vyasa',
        sem: '6',
        url: '',
    },
    's-vyasa_7': {
        title: 'SVYASA_Sem_07',
        campus: 's-vyasa',
        sem: '7',
        url: '',
    },
    's-vyasa_8': {
        title: 'SVYASA_Sem_08',
        campus: 's-vyasa',
        sem: '8',
        url: '',
    },
};

/**
 * Builds the public XLSX export URL from a sheet config entry.
 * Supports:
 * - Full Google Sheets browser URLs (with #gid= or ?gid=)
 * - Already formatted export URLs
 * - Raw Sheet IDs (with optional sheetConfig.gid)
 */
export function getSheetExportUrl(sheetConfig) {
    const raw = (sheetConfig?.url || sheetConfig?.link || sheetConfig?.id || sheetConfig?.sheetId || '').trim();
    if (!raw) return null;

    // 1. If it's already an export link:
    if (raw.includes('/export?format=')) {
        return raw.replace(/format=[a-z0-9]+/i, 'format=xlsx');
    }

    // 2. If it's a full Google Sheets URL:
    if (raw.includes('docs.google.com/spreadsheets')) {
        const idMatch = raw.match(/\/d\/([a-zA-Z0-9-_]+)/);
        const gidMatch = raw.match(/[#&?]gid=([0-9]+)/);

        const sheetId = idMatch ? idMatch[1] : null;
        const gid = gidMatch ? gidMatch[1] : (sheetConfig.gid || '0');

        if (!sheetId) return null;
        return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx&gid=${gid}`;
    }

    // 3. If raw Sheet ID was passed:
    const gid = sheetConfig.gid || '0';
    return `https://docs.google.com/spreadsheets/d/${raw}/export?format=xlsx&gid=${gid}`;
}

export { getSheetExportUrl as getSheetCsvUrl };

