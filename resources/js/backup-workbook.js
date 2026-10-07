export const backupWorkbook = { status: 'loading', data: null, error: '' };

export async function loadBackupWorkbook(url) {
    backupWorkbook.status = 'loading';
    backupWorkbook.error = '';
    try {
        const response = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', credentials: 'same-origin' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'The backup Excel file could not be read.');
        if (!Array.isArray(data.records) || !Array.isArray(data.years) || !data.source) throw new Error('The backup workbook response is incomplete.');
        backupWorkbook.data = data;
        backupWorkbook.status = 'ready';
    } catch (error) {
        backupWorkbook.data = null;
        backupWorkbook.status = 'error';
        backupWorkbook.error = error.message || 'Unable to load the backup Excel file.';
    }
}

export function backupRows(period) {
    if (backupWorkbook.status !== 'ready') return [];
    const year = Number(period.slice(0, 4));
    return backupWorkbook.data.records.filter(record => record.year === year).map(record => ({
        id: record.id,
        number: record.number,
        code: record.code,
        user: record.user,
        custodian: record.user,
        sheet: record.sheet,
        row: record.row,
        period,
        entry: record.months[period],
        status: record.months[period].status,
    }));
}

export function backupSummary(period) {
    const rows = backupRows(period);
    const count = status => rows.filter(row => row.status === status).length;
    const completed = count('Completed');
    return {
        total: rows.length,
        completed,
        recorded: count('Recorded'),
        pending: count('Pending'),
        notRecorded: count('Not recorded'),
        percentage: rows.length ? Math.round(completed / rows.length * 100) : null,
        available: backupWorkbook.status === 'ready' && rows.length > 0,
    };
}

export function backupPeriods() {
    return (backupWorkbook.data?.years ?? []).flatMap(year => Array.from({ length: 12 }, (_, index) => year + '-' + String(index + 1).padStart(2, '0')));
}

export function backupForEquipment(code, period) {
    const normalized = code.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    return backupRows(period).find(row => row.code.replace(/[^A-Z0-9]/gi, '').toUpperCase() === normalized);
}
