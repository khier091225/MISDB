export const inventoryWorkbook = { status: 'loading', data: null, error: '' };

export async function loadInventoryWorkbook(url) {
    inventoryWorkbook.status = 'loading';
    inventoryWorkbook.error = '';
    try {
        const response = await fetch(url, { headers: { Accept: 'application/json' }, credentials: 'same-origin', cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message || 'The inventory Excel file could not be read.');
        if (!Array.isArray(data.records) || typeof data.version !== 'string' || !data.source) throw new Error('The inventory workbook response is incomplete.');
        inventoryWorkbook.data = data;
        inventoryWorkbook.status = 'ready';
    } catch (error) {
        inventoryWorkbook.data = null;
        inventoryWorkbook.status = 'error';
        inventoryWorkbook.error = error.message || 'Unable to read inventory Excel.';
    }
}

export function inventoryRows() {
    return inventoryWorkbook.status === 'ready' ? inventoryWorkbook.data.records : [];
}

export function inventorySummary() {
    const rows = inventoryRows();
    const count = status => rows.filter(row => row.status === status).length;
    return {
        available: inventoryWorkbook.status === 'ready',
        total: rows.length,
        pc: rows.filter(row => row.kind === 'pc').length,
        laptops: rows.filter(row => row.kind === 'laptop').length,
        operational: count('Operational'),
        notRecorded: count('Not recorded'),
        attention: rows.filter(row => ['Attention','Under repair','Maintenance'].includes(row.status)).length,
        departments: new Set(rows.map(row => row.department)).size,
    };
}

export async function mutateInventory(url, method, payload) {
    const response = await fetch(url, {
        method, credentials: 'same-origin',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content },
        body: JSON.stringify(payload),
    });
    let data;
    try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) {
        const error = new Error(response.status === 419 ? 'Your page session expired. Reload the page before saving.' : data.message || 'The inventory could not be saved. Please try again.');
        error.errors = data.errors || {};
        error.status = response.status;
        throw error;
    }
    inventoryWorkbook.data = data;
    inventoryWorkbook.status = 'ready';
    inventoryWorkbook.error = '';
    return data;
}
