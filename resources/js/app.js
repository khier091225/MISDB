import { assets, requests, forms, monitoringStatus } from './dashboard-data';
import { backupWorkbook, loadBackupWorkbook, backupRows, backupSummary, backupPeriods, backupForEquipment } from './backup-workbook';
import { inventoryWorkbook, loadInventoryWorkbook, inventoryRows, inventorySummary, mutateInventory } from './inventory-workbook';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { page: 'overview', period: '2026-10', status: 'All', search: '', filter: 'All', pageNumber: 1, backupPeriod: null, inventoryKind: 'All' };
const pageSize = 10;
const workspaceTimezone = document.body.dataset.timezone || 'Asia/Manila';
const workspaceTimezoneLabel = workspaceTimezone === 'Asia/Manila' ? 'PHT' : workspaceTimezone;
const dialog = $('#workspace-dialog');
const pageDescriptions = {
    overview: 'A little clarity for a productive day. Here’s where things stand.',
    inventory: 'Manage PC parts and laptop specifications directly in your Excel inventory workbook.',
    complaints: 'Track reported concerns and follow every action through to resolution.',
    repairs: 'Keep repair requests, assessments, and next steps in one place.',
    history: 'The story of your equipment, one service record at a time.',
    accountability: 'Know what is inside each computer and who it is assigned to.',
    maintenance: 'Keep equipment running smoothly with a consistent monthly routine.',
    backups: 'Monthly backup records, linked directly to your F-MIS-06 Excel workbook.',
    forms: 'Your familiar Excel forms, organized into one connected workspace.',
};
function escape(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function icon(name, className = '') { return '<svg aria-hidden="true" class="' + className + '"><use href="#i-' + name + '"/></svg>'; }
function badge(status) {
    const color = ['Resolved','Operational','Completed'].includes(status) ? 'green' : ['In progress','Maintenance'].includes(status) ? 'blue' : ['Pending','Under repair','High','Attention'].includes(status) ? 'amber' : 'gray';
    return '<span class="badge badge-' + color + '">' + escape(status) + '</span>';
}
function formatDate(date) { return date === '—' ? date : new Intl.DateTimeFormat('en', { month:'short',day:'2-digit',timeZone:'UTC' }).format(new Date(date + 'T00:00:00Z')); }
function monthName(period = state.period) { return new Intl.DateTimeFormat('en', { month:'long',year:'numeric',timeZone:'UTC' }).format(new Date(period + '-01T00:00:00Z')); }
function periodRequests() { return requests.filter(item => item.date.startsWith(state.period)).sort((a,b) => b.date.localeCompare(a.date)); }
function completedCount(kind) { return assets.filter(asset => monitoringStatus(asset, kind, state.period) === 'Completed').length; }
function equipment(code, description = '') {
    return '<div class="equipment-cell"><span class="equipment-icon">' + icon('monitor') + '</span><span><strong>' + escape(code) + '</strong><small>' + escape(description) + '</small></span></div>';
}
function detailButton(type, id) { return '<button class="row-action" data-detail="' + type + '" data-id="' + escape(id) + '" aria-label="View ' + escape(id) + ' details">' + icon('chevron-right') + '</button>'; }
function emptyRow(columns) { return '<tr><td colspan="' + columns + '" class="empty-state"><strong>No matching records</strong>Try another search or change the selected filter.</td></tr>'; }
function renderOverview() {
    const current = periodRequests();
    const open = current.filter(item => item.status !== 'Resolved').length;
    const pm = completedCount('maintenance');
    const inventory = inventorySummary();
    const backup = backupSummary(state.period);
    const stats = [
        {label:'Total equipment',value:inventory.available ? inventory.total : '—',suffix:'',note:inventory.available ? 'Across '+inventory.departments+' sections · Excel' : inventoryWorkbook.status==='loading'?'Reading inventory Excel…':'Inventory Excel unavailable',icon:'monitor',tint:'teal',page:'inventory',status:'Registered inventory',noteIcon:'monitor'},
        {label:'Open requests',value:open,suffix:'',note:current.filter(r => r.status === 'In progress').length + ' currently in progress',icon:'message',tint:'amber',page:'complaints',status:'Needs attention',noteIcon:'clock'},
        {label:'Preventive maintenance',value:Math.round(pm / assets.length * 100) + '%',suffix:'',note:pm + ' of ' + assets.length + ' completed',icon:'tool',tint:'blue',page:'maintenance',status:'Monthly coverage',noteIcon:'check'},
        {label:'Backup completion',value:backup.available ? backup.percentage + '%' : '—',suffix:'',note:backup.available ? backup.completed + ' of ' + backup.total + ' confirmed · Excel' : backupWorkbook.status === 'loading' ? 'Reading Excel…' : 'Excel data unavailable',icon:'shield',tint:'purple',page:'backups',status:'Excel coverage',noteIcon:'database'},
    ];
    $('#stats-grid').innerHTML = stats.map(s => '<a class="stat-card" href="#' + s.page + '"><div class="stat-head"><span>' + s.label + '</span><span class="stat-icon ' + s.tint + '-tint">' + icon(s.icon) + '</span></div><div class="stat-value">' + s.value + '</div><div class="stat-note"><span class="' + (s.tint === 'amber' ? 'pending' : 'positive') + '">' + icon(s.noteIcon) + '</span>' + s.note + '</div></a>').join('');
    $('#open-count').textContent = open;
    $('#tab-open-count').textContent = open;
    $('#request-count').textContent = current.length;
    $('#activity-total').textContent = current.length;
    renderChart();
    const healthyPercent = inventory.total ? inventory.operational/inventory.total*100 : 0;
    const attentionPercent = inventory.total ? (inventory.operational+inventory.attention)/inventory.total*100 : 0;
    $('#health-percent').innerHTML = inventory.available ? Math.round(healthyPercent)+'<span>%</span>' : '—';
    $('#health-donut').style.background = 'conic-gradient(#148976 0 '+healthyPercent+'%,#efc573 '+healthyPercent+'% '+attentionPercent+'%,#9cb9d6 0 100%)';
    $('#health-donut').setAttribute('aria-label',inventory.available ? inventory.operational+' of '+inventory.total+' equipment marked operational in Excel' : 'Inventory data unavailable');
    $('.health-panel .panel-heading p').textContent = inventory.available ? 'Status from inventory remarks' : 'Reading inventory Excel…';
    $('#health-legend').innerHTML = [['Operational',inventory.operational,'teal'],['Needs attention',inventory.attention,'amber'],['Not recorded',inventory.notRecorded,'blue']].map(([label,count,color])=>'<div><i class="legend-dot '+color+'"></i><span>'+label+'</span><strong>'+(inventory.available?count:'—')+'</strong></div>').join('');
    const checklist = [
        { page:'maintenance', title:'Preventive maintenance', code:'F-MIS-05', icon:'tool', count:pm, total:assets.length, tint:'teal', note:(assets.length-pm)+' remaining this month · Sample' },
        { page:'backups', title:'Monthly backup', code:'F-MIS-06', icon:'database', count:backup.completed, total:backup.total, tint:'blue', note:backup.available ? backup.notRecorded+' not recorded · Excel' + (backup.recorded ? ' · '+backup.recorded+' entries to review' : '') : backupWorkbook.status==='loading' ? 'Reading the Excel workbook…' : 'Excel unavailable · Open to retry' },
    ];
    $('#monitoring-summary').innerHTML = checklist.map(item => {
        const percent = item.total ? Math.round(item.count/item.total*100) : 0;
        const unavailable = item.page === 'backups' && !backup.available;
        const coverage = unavailable ? (backupWorkbook.status === 'loading' ? 'Reading Excel…' : 'Excel unavailable') : item.count+' of '+item.total+' computers'+(item.page==='backups'?' confirmed':'');
        const currentValue = unavailable ? '' : ' aria-valuenow="'+item.count+'"';
        return '<a class="monitoring-item" href="#'+item.page+'"><div class="monitoring-title"><span class="'+item.tint+'-tint">'+icon(item.icon)+'</span><div><strong>'+item.title+'</strong><small>'+item.code+' · '+monthName()+'</small></div>'+icon('chevron-right')+'</div><div class="progress-label"><span>'+coverage+'</span><strong>'+(unavailable?'—':percent+'%')+'</strong></div><div class="progress-track '+(item.tint==='blue'?'blue':'')+'" role="progressbar" aria-label="'+item.title+'" aria-valuemin="0" aria-valuemax="'+(item.total||1)+'"'+currentValue+'><span style="width:'+percent+'%"></span></div><div class="monitoring-note">'+item.note+'</div></a>';
    }).join('');
    renderRecent();
}
function renderChart() {
    const month = Number(state.period.slice(5));
    const series = Array.from({length:6}, (_, i) => {
        const number = month - 5 + i;
        const prefix = '2026-' + String(number).padStart(2,'0');
        const rows = requests.filter(r => r.date.startsWith(prefix));
        return { label:new Intl.DateTimeFormat('en',{month:'short',timeZone:'UTC'}).format(new Date(prefix + '-01T00:00:00Z')), reported:rows.length,resolved:rows.filter(r => r.status === 'Resolved').length };
    });
    const maximum = Math.max(20, Math.ceil(Math.max(...series.map(s => s.reported)) / 5) * 5);
    $('#activity-chart').innerHTML = '<div class="chart-grid" aria-hidden="true">' + [maximum,maximum*.75,maximum*.5,maximum*.25,0].map(value => '<div><span>' + value + '</span></div>').join('') + '</div><div class="bar-groups">' + series.map(s => '<div class="bar-group"><div class="bar-pair">' + [['reported','Reported'],['resolved','Resolved']].map(([key,label]) => '<div class="bar ' + key + '" style="height:' + s[key] / maximum * 100 + '%" tabindex="0" role="img" aria-label="' + s.label + ': ' + s[key] + ' ' + label.toLowerCase() + '"><span class="bar-tooltip">' + label + ': ' + s[key] + '</span></div>').join('') + '</div><span>' + s.label + '</span></div>').join('') + '</div>';
}
function renderRecent() {
    const rows = periodRequests().filter(r => state.status === 'All' || (state.status === 'Open' ? r.status !== 'Resolved' : r.status === 'Resolved'));
    $('#recent-requests').innerHTML = rows.slice(0,4).map(r => '<tr><td>' + equipment(r.code,r.issue) + '</td><td>' + escape(r.department) + '</td><td>' + badge(r.status) + '</td><td>' + formatDate(r.date) + '</td><td>' + detailButton('request',r.id) + '</td></tr>').join('') || emptyRow(5);
    $('#recent-summary').textContent = 'Showing ' + Math.min(4,rows.length) + ' of ' + rows.length + ' requests';
    $$('.table-tab').forEach(button => { const active = button.dataset.status === state.status; button.classList.toggle('active',active); button.setAttribute('aria-pressed',String(active)); });
}
function currentRows() {
    let rows;
    if (state.page === 'inventory') {
        rows = inventoryRows();
    } else if (state.page === 'backups') {
        rows = backupRows(state.backupPeriod);
    } else if (['complaints','repairs','history'].includes(state.page)) {
        rows = periodRequests();
        if (state.page === 'history') rows = rows.filter(r => r.status === 'Resolved');
    } else {
        rows = assets.map(a => ({ ...a, status:['maintenance','backups'].includes(state.page) ? monitoringStatus(a,state.page,state.period) : a.status }));
    }
    if(state.page==='inventory')return rows.filter(row => (state.inventoryKind==='All'||row.kind===state.inventoryKind) && (state.filter==='All'||row.status===state.filter) && [row.code,row.department,row.custodian,row.brand,row.model,row.status,...row.components.flatMap(part=>Object.values(part)),...Object.values(row.specifications)].join(' ').toLowerCase().includes(state.search.toLowerCase().trim()));
    return rows.filter(row => (state.filter === 'All' || row.status === state.filter) && [...Object.values(row), row.entry?.display ?? ''].join(' ').toLowerCase().includes(state.search.toLowerCase().trim()));
}
function renderModule() {
    if(state.page==='inventory'){renderInventoryModule();return;}
    if (state.page === 'backups') { renderBackupModule(); return; }
    if (state.page === 'forms') {
        $('#module-content').innerHTML = '<div class="module-intro">' + icon('folder') + '<span>Built around the seven Excel workbooks in your forms folder. Explore each form’s fields and its dashboard module.</span></div><div class="form-library">' + forms.map((form,index) => '<article class="panel form-card"><span class="quick-icon ' + ['teal','blue','purple'][index%3] + '-tint">' + icon(form.icon) + '</span><span class="form-code">' + form.code + ' · ' + (form.file.endsWith('.xls') ? 'XLS' : 'XLSX') + '</span><h2>' + form.title + '</h2><p>' + form.description + '</p><button class="text-link" data-form="' + form.page + '">Explore form ' + icon('arrow-right') + '</button></article>').join('') + '</div>';
        return;
    }
    const form = forms.find(f => f.page === state.page);
    const monitoring = ['maintenance','backups'].includes(state.page);
    const service = ['complaints','repairs','history'].includes(state.page);
    const filterOptions = monitoring ? ['All','Completed','Pending'] : service ? ['All','Pending','In progress','Resolved'] : ['All','Operational','Under repair','Maintenance'];
    $('#module-content').innerHTML = '<div class="module-intro">' + icon(form.icon) + '<span><strong>' + form.code + '</strong> · ' + (monitoring ? completedCount(state.page) + ' of ' + assets.length + ' computers completed for ' + monthName() + '.' : form.description) + ' Sample records for UI review.</span></div><div class="panel"><div class="module-toolbar"><label>' + icon('search') + '<input id="module-search" type="search" aria-label="Search records" placeholder="Search code, department, or user…" value="' + escape(state.search) + '"></label><label><span class="sr-only">Filter status</span><select id="module-filter">' + filterOptions.map(option => '<option' + (option === state.filter ? ' selected' : '') + '>' + option + '</option>').join('') + '</select></label></div><div class="table-scroll"><table class="data-table module-table"><caption class="sr-only">' + form.title + ' sample records</caption><thead id="module-head"></thead><tbody id="module-rows"></tbody></table></div><div class="table-footer"><span id="module-summary"></span><div class="pagination"><button data-action="previous-page" aria-label="Previous page">Previous</button><span id="page-number"></span><button data-action="next-page" aria-label="Next page">Next</button></div></div></div>';
    renderModuleRows();
}
function renderModuleRows() {
    if(state.page==='inventory'){renderInventoryRows();return;}
    if (state.page === 'backups') { renderBackupRows(); return; }
    const rows = currentRows();
    const totalPages = Math.max(1,Math.ceil(rows.length / pageSize));
    state.pageNumber = Math.min(state.pageNumber,totalPages);
    const visible = rows.slice((state.pageNumber-1)*pageSize,state.pageNumber*pageSize);
    const monitoring = ['maintenance','backups'].includes(state.page);
    const service = ['complaints','repairs','history'].includes(state.page);
    const accountability = state.page === 'accountability';
    const headers = service ? ['Equipment / issue','Department',state.page === 'history' ? 'Action taken' : 'Priority','Status','Reported',''] : ['Equipment','Department','Custodian',accountability ? 'Memory / storage' : monitoring ? 'Period' : 'Type','Status',''];
    $('#module-head').innerHTML = '<tr>' + headers.map((h,i) => '<th>' + (h || '<span class="sr-only">Details</span>') + '</th>').join('') + '</tr>';
    $('#module-rows').innerHTML = visible.map(row => {
        const middle = service ? '<td>' + (state.page === 'history' ? escape(row.action) : badge(row.priority)) + '</td><td>' + badge(row.status) + '</td><td>' + formatDate(row.date) + '</td>' : '<td>' + escape(row.custodian) + '</td><td>' + escape(accountability ? row.memory + ' / ' + row.storage : monitoring ? monthName() : row.type) + '</td><td>' + badge(row.status) + '</td>';
        return '<tr><td>' + equipment(row.code,service ? row.issue : row.brand) + '</td><td>' + escape(row.department) + '</td>' + middle + '<td>' + detailButton(service ? 'request' : 'asset', service ? row.id : row.code) + '</td></tr>';
    }).join('') || emptyRow(6);
    $('#module-summary').textContent = rows.length ? 'Showing ' + ((state.pageNumber-1)*pageSize+1) + '–' + Math.min(state.pageNumber*pageSize,rows.length) + ' of ' + rows.length + ' records' : '0 matching records';
    $('#page-number').textContent = state.pageNumber + ' / ' + totalPages;
    $('[data-action="previous-page"]').disabled = state.pageNumber === 1;
    $('[data-action="next-page"]').disabled = state.pageNumber === totalPages;
}
function navigate(reset = true) {
    const hash = window.location.hash.slice(1) || 'overview';
    if (hash === 'main-content') return;
    state.page = Object.hasOwn(pageDescriptions,hash) ? hash : 'overview';
    if (reset) { state.search='';state.filter='All';state.pageNumber=1;$('#global-search').value=''; }
    const title = state.page === 'overview' ? 'Workspace overview' : state.page === 'forms' ? 'Forms library' : forms.find(f => f.page === state.page).title;
    $('#page-title').innerHTML = escape(title) + '<span class="title-dot">.</span>';
    $('#breadcrumb-current').textContent = state.page === 'overview' ? 'Overview' : title;
    $('#page-description').textContent = pageDescriptions[state.page];
    $('#eyebrow').textContent = state.page === 'overview' ? 'YOUR IT, AT A GLANCE' : state.page === 'forms' ? 'FAMILIAR FORMS. BETTER FLOW.' : 'AN ORGANIZED IT WORKSPACE';
    $('#context-label').textContent = ['inventory','accountability','forms'].includes(state.page) ? 'Equipment & records' : 'Monthly snapshot';
    $('.period-picker').hidden = ['inventory','accountability','forms'].includes(state.page);
    $('#overview-content').hidden = state.page !== 'overview';
    $('#module-content').hidden = state.page === 'overview';
    $$('[data-page]').forEach(link => { const active = link.dataset.page === state.page;link.classList.toggle('active',active);if(active)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current'); });
    document.title = 'MISDB · ' + title;
    configureBackupControls();
    renderOverview();
    if(state.page !== 'overview') renderModule();
    if(dialog.open) dialog.close();
    toggleSidebar(false);
}
function showDialog(title,content) {
    $('#dialog-content').innerHTML = '<h2 id="dialog-title">' + escape(title) + '</h2>' + content;
    if(!dialog.open) dialog.showModal();
}
function showDetails(type,id) {
    if(type==='inventory'){showInventoryDetails(id);return;}
    if (type === 'backup') { showBackupDetails(id); return; }
    if(type === 'request') {
        const row = requests.find(r => r.id === id);
        if(!row) return;
        showDialog(row.code + ' · Service request','<p class="dialog-description">' + escape(row.id) + ' · F-MIS-01 / F-MIS-03</p>' + badge(row.status) + '<dl class="detail-grid">' + details({Department:row.department,'Requested by':row.requestedBy,'Date reported':formatDate(row.date) + ', 2026',Priority:row.priority,'Date repaired':row.repaired === '—' ? 'Not yet repaired' : formatDate(row.repaired) + ', 2026','Approval': 'Sample · For MIS review'}) + '</dl><div class="detail-block"><h3>Complaint</h3><p>' + escape(row.issue) + '</p><h3 style="margin-top:15px">Action taken</h3><p>' + escape(row.action) + '</p></div><p class="preview-note">Sample record. Changes and approvals are not connected to a database.</p>');
    } else {
        const asset = assets.find(a => a.code === id);
        if(!asset) return;
        const monitoring = ['maintenance','backups'].includes(state.page);
        showDialog(asset.code,'<p class="dialog-description">Computer inventory · F-MIS-04</p>' + badge(monitoring ? monitoringStatus(asset,state.page,state.period) : asset.status) + '<dl class="detail-grid">' + details({Department:asset.department,Custodian:asset.custodian,Brand:asset.brand,Type:asset.type,Processor:asset.processor,Memory:asset.memory,Storage:asset.storage,'Operating system':'Windows 11 Pro','Preventive maintenance':monitoringStatus(asset,'maintenance',state.period),'Monthly backup':(backupForEquipment(asset.code,state.period)?.status ?? 'Not listed in Excel')}) + '</dl><p class="preview-note">Illustrative equipment specifications and assignments. Monitoring period: ' + monthName() + '.</p>');
    }
}
function details(values) { return Object.entries(values).map(([label,value]) => '<div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>').join(''); }
function newRequest() {
    showDialog('Create a service request','<p class="dialog-description">Log an equipment concern using the fields from F-MIS-03.</p><form id="request-form"><div class="fields-grid"><label class="field field-full">Computer / equipment<select name="code" required><option value="">Select equipment</option>' + assets.map(a => '<option value="' + a.code + '">' + a.code + ' · ' + a.department + '</option>').join('') + '</select></label><label class="field">Requested by<input name="requestedBy" required maxlength="80" placeholder="Your name" autocomplete="name"></label><label class="field">Priority<select name="priority"><option>Normal</option><option>High</option></select></label><label class="field">Date requested<input name="date" type="date" min="' + state.period + '-01" max="' + state.period + (state.period === '2026-10' ? '-31' : '-30') + '" value="' + state.period + (state.period === '2026-10' ? '-07' : '-30') + '" required></label><label class="field">Department<input name="department" readonly placeholder="From equipment"></label><label class="field field-full">Complaint<textarea name="issue" required minlength="5" maxlength="500" placeholder="Describe the problem with this equipment…"></textarea></label></div><p class="preview-note">Preview only. This request is kept in this tab until you reload the page; nothing is submitted to a database.</p><div class="dialog-actions"><button type="button" class="button button-secondary" data-action="close-dialog">Cancel</button><button type="submit" class="button button-primary">' + icon('plus') + 'Add preview request</button></div></form>');
}
function exportReport() {
    const excel = ['inventory','backups'].includes(state.page);
    const sourceName = state.page==='inventory' ? inventoryWorkbook.data?.source.file : backupWorkbook.data?.source.file;
    const scope = state.page === 'overview' ? 'Service requests' : state.page === 'forms' ? 'Forms catalog' : forms.find(f => f.page === state.page).title;
    if (excel && (state.page==='inventory' ? inventoryWorkbook.status!=='ready' : !backupSummary(state.backupPeriod).available)) { toast('Load the Excel records before exporting.'); return; }
    showDialog('Export report','<p class="dialog-description">Download '+escape(scope.toLowerCase())+' as a CSV file, ready to open in Excel.</p><dl class="detail-grid">'+details({Report:scope,Period:['inventory','accountability','forms'].includes(state.page)?'All equipment / forms':monthName(excel?state.backupPeriod:state.period),Filters:state.page==='overview'||state.page==='forms'?'All records':state.filter+(state.search?' · '+state.search:''),'Data source':excel?sourceName:'UI sample records'})+'</dl>'+(excel?'<p class="dialog-description">The export includes the displayed records and their original Excel fields.</p>':'<p class="preview-note">The export contains sample data, not a live database report.</p>')+'<div class="dialog-actions"><button class="button button-secondary" data-action="close-dialog">Cancel</button><button class="button button-primary" data-action="download-csv">'+icon('download')+'Download CSV</button></div>');
}
function downloadCsv() {
    let rows;
    if(state.page==='inventory')rows=currentRows().map(row=>({Equipment:row.code,Type:row.type,Department:row.department,Custodian:row.custodian,Brand:row.brand,Model:row.model,Status:row.status,Parts:JSON.stringify(row.components),Specifications:JSON.stringify(row.specifications),Sheet:row.sheet}));
    else if(state.page === 'backups') rows=currentRows().map(row=>({Equipment:row.code,User:row.user,Period:row.period,'Excel entry':row.entry.display,Status:row.status,Sheet:row.sheet,Cell:row.entry.cell}));
    else if(state.page === 'forms') rows=forms.map(f => ({Code:f.code,Form:f.title,Workbook:f.file,Fields:f.fields.join('; ')}));
    else if(state.page === 'overview' || ['complaints','repairs','history'].includes(state.page)) rows=(state.page === 'overview' ? periodRequests() : currentRows()).map(r => ({Request:r.id,Equipment:r.code,Department:r.department,Complaint:r.issue,Status:r.status,Priority:r.priority,Reported:r.date,'Requested by':r.requestedBy,'Action taken':r.action}));
    else rows=currentRows().map(r => ({Equipment:r.code,Department:r.department,Custodian:r.custodian,Brand:r.brand,Status:r.status,Period:['maintenance','backups'].includes(state.page) ? monthName() : 'Inventory snapshot',Memory:r.memory,Storage:r.storage}));
    if(!rows.length){toast('No matching records to export.');return;}
    // Prevent spreadsheet formulas in user-entered CSV cells.
    const cell = value => '"' + (/^[=+@\-\t\r]/.test(String(value)) ? "'" : '') + String(value).replaceAll('"','""') + '"';
    const csv = '\uFEFF' + [Object.keys(rows[0]),...rows.map(Object.values)].map(row => row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download=state.page==='inventory'?'MISDB-excel-inventory.csv':'MISDB-'+(state.page==='backups'?'excel-':'sample-')+state.page+'-'+(state.page==='backups'?state.backupPeriod:state.period)+'.csv';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    dialog.close();toast(['inventory','backups'].includes(state.page)?'Excel report downloaded.':'Sample report downloaded.');
}
let toastTimeout;
function toast(message) { $('#toast').textContent=message;$('#toast').hidden=false;clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('#toast').hidden=true,4500); }
function toggleSidebar(open) {
    const mobile = matchMedia('(max-width:760px)').matches;
    $('#sidebar').classList.toggle('open',open);
    $('.sidebar-scrim').hidden=!open;
    $('.menu-toggle').setAttribute('aria-expanded',String(open));
    $('#sidebar').inert = mobile && !open;
    $('.app-shell').inert = mobile && open;
    document.body.style.overflow = mobile && open ? 'hidden' : '';
    if(open) $('#sidebar a').focus();
}
document.addEventListener('click',event => {
    const navigationLink = event.target.closest('a[href^="#"]');
    if (navigationLink && dialog.contains(navigationLink)) dialog.close();
    if (navigationLink && $('#sidebar').contains(navigationLink)) toggleSidebar(false);
    const detail=event.target.closest('[data-detail]');
    if(detail){showDetails(detail.dataset.detail,detail.dataset.id);return;}
    const tab=event.target.closest('[data-status]');
    if(tab){state.status=tab.dataset.status;renderRecent();return;}
    const formButton=event.target.closest('[data-form]');
    if(formButton){
        const form=forms.find(f=>f.page===formButton.dataset.form);
        showDialog(form.title,'<p class="dialog-description">' + form.code + ' · ' + escape(form.file) + '</p><div class="detail-block"><h3>Fields from the original workbook</h3><ul class="list-disc pl-5 space-y-2">' + form.fields.map(f=>'<li>'+escape(f)+'</li>').join('') + '</ul></div><div class="dialog-actions"><a class="button button-primary" href="#' + form.page + '">Open module ' + icon('arrow-right') + '</a></div>');
        return;
    }
    const edit=event.target.closest('[data-edit-inventory]');
    if(edit){openInventoryForm(inventoryRows().find(row=>row.id===edit.dataset.editInventory));return;}
    const remove=event.target.closest('[data-delete-inventory]');
    if(remove){confirmInventoryDelete(remove.dataset.deleteInventory);return;}
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='close-dialog' && dialog.dataset.inventorySaving!=='true')dialog.close();
    if(action==='new-request')newRequest();
    if(action==='new-equipment')openInventoryForm();
    if(action==='refresh-inventory')refreshInventory(true);
    if(action==='confirm-delete-inventory')deleteInventoryRecord(event.target.closest('[data-action]'));
    if(action==='add-inventory-part')addInventoryPart();
    if(action==='remove-inventory-part'){const rows=$('[data-component-row]');if(rows.length>1)event.target.closest('[data-component-row]').remove();else toast('Keep at least one part.');}
    if(action==='export')exportReport();
    if(action==='refresh-backups')refreshBackups(true);
    if(action==='mark-backup-completed') { const btn = event.target.closest('[data-action]'); updateBackupStatus(btn.dataset.recordCode, btn.dataset.recordPeriod, 'Completed', btn); }
    if(action==='download-csv')downloadCsv();
    if(action==='previous-page'){state.pageNumber--;renderModuleRows();}
    if(action==='next-page'){state.pageNumber++;renderModuleRows();}
    if(action==='profile')showDialog('MIS Administrator','<p class="dialog-description">LCMI · Management Information System</p><dl class="detail-grid">'+details({Workspace:'Laguna Carparts Manufacturing Inc.',Mode:'Frontend design preview',Role:'Sample administrator',Storage:'Temporary in this browser tab'})+'</dl><p class="preview-note">User accounts and permissions will be connected during backend implementation.</p>');
    if(action==='notifications')showDialog('Your monthly reminders','<p class="dialog-description">'+monthName()+' · Service samples / Excel backups</p>'+[['complaints',periodRequests().filter(r=>r.status!=='Resolved').length+' open service requests','Review pending concerns and ongoing repairs.','message'],['maintenance',(assets.length-completedCount('maintenance'))+' computers awaiting maintenance','Complete your preventive maintenance checklist.','tool'],['backups',backupSummary(state.period).notRecorded+' backups not recorded','Review saved entries in the Excel workbook.','database']].map(([page,title,description,name])=>'<a href="#'+page+'" class="notification-item">'+icon(name)+'<span><strong>'+title+'</strong><small>'+description+'</small></span>'+icon('chevron-right')+'</a>').join(''));
    if(action==='help')showDialog('Welcome to your workspace','<p class="dialog-description">MISDB brings your seven Excel-based workflows into one place.</p><div class="detail-block"><p><strong>Find equipment.</strong> Use the search box or Computer inventory to locate a computer, department, or custodian.</p><p class="mt-4"><strong>Follow up on concerns.</strong> Open a service request to see its complaint, priority, and action taken.</p><p class="mt-4"><strong>Keep a monthly routine.</strong> Switch reporting months to review maintenance and backup completion.</p></div><p class="preview-note">All figures are sample data for design review. New preview requests reset when you reload.</p>');
});
document.addEventListener('input',event=>{
    if(event.target.id==='module-search'){state.search=event.target.value;state.pageNumber=1;renderModuleRows();}
    if(event.target.id==='global-search'){
        state.search=event.target.value;state.pageNumber=1;state.filter='All';state.inventoryKind='All';
        if(state.page!=='inventory'){history.replaceState(null,'','#inventory');navigate(false);}else if($('#module-search')){$('#module-search').value=state.search;$('#inventory-kind').value='All';renderModuleRows();}
    }
});
document.addEventListener('change',event=>{
    if(event.target.id==='inventory-kind'){state.inventoryKind=event.target.value;state.pageNumber=1;renderInventoryRows();}
    if(event.target.id==='equipment-kind')updateInventoryKind();
    if(event.target.id==='module-filter'){state.filter=event.target.value;state.pageNumber=1;renderModuleRows();}
    if(event.target.id==='period'){if(state.page==='backups')state.backupPeriod=event.target.value;else state.period=event.target.value;state.pageNumber=1;renderOverview();if(state.page!=='overview')renderModule();}
    if(event.target.matches('#request-form [name="code"]'))$('#request-form [name="department"]').value=assets.find(a=>a.code===event.target.value)?.department ?? '';
});
document.addEventListener('submit',event=>{
    if(event.target.id==='inventory-form'){event.preventDefault();saveInventoryForm(event.target);return;}
    if(event.target.id!=='request-form')return;
    event.preventDefault();
    const values=Object.fromEntries(new FormData(event.target));
    if(!values.requestedBy.trim() || values.issue.trim().length<5){toast('Please enter a name and a complaint with at least 5 characters.');return;}
    const asset=assets.find(a=>a.code===values.code);
    if(!asset || !values.date.startsWith(state.period))return;
    requests.unshift({id:'PREVIEW-'+Date.now(),code:asset.code,department:asset.department,requestedBy:values.requestedBy.trim(),issue:values.issue.trim(),priority:values.priority,date:values.date,status:'Pending',action:'Awaiting initial assessment.',repaired:'—'});
    dialog.close();renderOverview();if(state.page!=='overview')renderModule();toast('Preview request added. It will reset when this page is reloaded.');
});
$('.menu-toggle').addEventListener('click',()=>toggleSidebar(true));
$('.sidebar-scrim').addEventListener('click',()=>{toggleSidebar(false);$('.menu-toggle').focus();});
dialog.addEventListener('click',event=>{if(event.target===dialog && dialog.dataset.inventorySaving!=='true'){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('cancel',event=>{if(dialog.dataset.inventorySaving==='true')event.preventDefault();});
document.addEventListener('keydown',event=>{
    if(event.key==='/'&&!event.target.matches('input,textarea,select')&&!dialog.open&&getComputedStyle($('.global-search')).display!=='none'){event.preventDefault();$('#global-search').focus();}
    if(event.key==='Escape'&&$('#sidebar').classList.contains('open')){toggleSidebar(false);$('.menu-toggle').focus();}
    if(event.key==='Tab'&&$('#sidebar').classList.contains('open')){
        const focusable=$$('#sidebar a, #sidebar button');const first=focusable[0];const last=focusable.at(-1);
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
});
matchMedia('(max-width:760px)').addEventListener('change',()=>toggleSidebar(false));
window.addEventListener('hashchange',()=>{navigate();$('#main-content').focus();});
navigate();

function configureBackupControls() {
    const excel = state.page === 'backups';
    const periods = excel ? backupPeriods() : ['2026-10','2026-09'];
    const selected = excel ? state.backupPeriod : state.period;
    $('#period').innerHTML = periods.length ? periods.map(period=>'<option value="'+period+'"'+(period===selected?' selected':'')+'>'+monthName(period)+'</option>').join('') : '<option>Loading Excel…</option>';
    $('#period').disabled = excel && backupWorkbook.status !== 'ready';
    $('.heading-actions [data-action="new-request"]').hidden = excel || state.page==='inventory';
    $('.heading-actions [data-action="new-equipment"]').hidden = state.page!=='inventory';
    $('.heading-actions [data-action="new-equipment"]').disabled = inventoryWorkbook.status!=='ready';
    $('.heading-actions [data-action="export"]').disabled = state.page==='inventory' ? inventoryWorkbook.status!=='ready' : excel && !backupSummary(state.backupPeriod ?? '').available;
    $('.preview-indicator').innerHTML = '<span></span>' + (excel || state.page==='inventory' ? 'Excel source' : 'Design preview');
    $('.main-footer > span:last-child').textContent = state.page==='inventory' ? 'Excel inventory · Webpage changes are saved to the workbook' : excel ? 'F-MIS-06 · Excel records · Save the file, then refresh' : state.page==='overview' ? 'Inventory & backups: Excel · Service modules: sample data' : 'UI preview · Sample records';
    if(excel || state.page==='inventory') $('#context-label').textContent = 'Excel source';
}
async function refreshBackups(showFeedback = false) {
    if (backupWorkbook.status === 'loading' && refreshBackups.running) return;
    refreshBackups.running = true;
    const pending = loadBackupWorkbook(document.body.dataset.backupUrl);
    renderOverview();
    if(state.page === 'backups') { configureBackupControls(); renderBackupModule(); }
    await pending;
    refreshBackups.running = false;
    const periods = backupPeriods();
    if(backupWorkbook.status==='ready' && (!state.backupPeriod || !periods.includes(state.backupPeriod))) state.backupPeriod = backupWorkbook.data.default_period;
    renderOverview();
    if(state.page === 'backups') { configureBackupControls(); renderBackupModule(); }
    if(showFeedback) toast(backupWorkbook.status==='ready'?'Backup records refreshed from Excel.':backupWorkbook.error);
}
function renderBackupModule() {
    const container = $('#module-content');
    if(backupWorkbook.status !== 'ready') {
        const loading = backupWorkbook.status==='loading';
        container.innerHTML = '<div class="panel backup-state" role="status">'+icon(loading?'database':'info')+'<h2>'+(loading?'Reading backup records…':'Excel file unavailable')+'</h2><p>'+escape(loading?'Loading computer codes, users, and monthly entries from F-MIS-06.':backupWorkbook.error)+'</p>'+(loading?'':'<button class="button button-secondary" data-action="refresh-backups">'+icon('history')+'Retry reading Excel</button>')+'</div>';
        return;
    }
    const summary = backupSummary(state.backupPeriod);
    const source = backupWorkbook.data.source;
    const checked = new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:workspaceTimezone}).format(new Date(source.checked_at));
    const cards = [['Computers in Excel',summary.total,'monitor','teal'],['Confirmed backups',summary.completed,'shield','blue'],['Not recorded',summary.notRecorded,'calendar','amber'],['Other entries',summary.recorded+summary.pending,'file','purple']];
    container.innerHTML = '<div class="backup-source"><div><span class="eyebrow">CONNECTED EXCEL WORKBOOK</span><strong>'+escape(source.file)+'</strong><p>Sheet '+escape(state.backupPeriod.slice(0,4))+' · Last read '+escape(checked)+' '+escape(workspaceTimezoneLabel)+'</p></div><button class="button button-secondary" data-action="refresh-backups">'+icon('history')+'Refresh Excel</button></div><div class="stats-grid backup-stats">'+cards.map(([label,value,name,tint])=>'<div class="stat-card"><div class="stat-head"><span>'+label+'</span><span class="stat-icon '+tint+'-tint">'+icon(name)+'</span></div><div class="stat-value">'+value+'</div></div>').join('')+'</div><div class="module-intro">'+icon('info')+'<span><strong>'+monthName(state.backupPeriod)+'</strong> · Blank cells appear as <strong>Not recorded</strong>. Checkmarks and backup dates confirm completion; other entries are shown as written.</span></div><div class="panel"><div class="module-toolbar"><label>'+icon('search')+'<input id="module-search" type="search" aria-label="Search backup records" placeholder="Search computer code or assigned user…" value="'+escape(state.search)+'"></label><label><span class="sr-only">Filter backup status</span><select id="module-filter">'+['All','Completed','Not recorded','Recorded','Pending'].map(option=>'<option'+(option===state.filter?' selected':'')+'>'+option+'</option>').join('')+'</select></label></div><div class="table-scroll"><table class="data-table module-table backup-table"><caption class="sr-only">Backup records from the Excel workbook for '+monthName(state.backupPeriod)+'</caption><thead id="module-head"><tr><th>#</th><th>Computer code</th><th>Assigned user</th><th>Excel entry</th><th>Status</th><th><span class="sr-only">Details</span></th></tr></thead><tbody id="module-rows"></tbody></table></div><div class="table-footer"><span id="module-summary"></span><div class="pagination"><button data-action="previous-page" aria-label="Previous page">Previous</button><span id="page-number"></span><button data-action="next-page" aria-label="Next page">Next</button></div></div></div>';
    renderBackupRows();
}
function renderBackupRows() {
    if(backupWorkbook.status!=='ready' || !$('#module-rows'))return;
    const rows=currentRows();
    const pages=Math.max(1,Math.ceil(rows.length/pageSize));
    state.pageNumber=Math.min(state.pageNumber,pages);
    $('#module-rows').innerHTML=rows.slice((state.pageNumber-1)*pageSize,state.pageNumber*pageSize).map(row=>'<tr><td>'+escape(row.number)+'</td><td>'+equipment(row.code,'Sheet '+row.sheet+' · '+row.entry.cell)+'</td><td>'+escape(row.user||'Not specified')+'</td><td class="backup-entry">'+escape(row.entry.display||'—')+'</td><td>'+badge(row.status)+'</td><td>'+detailButton('backup',row.id)+'</td></tr>').join('')||emptyRow(6);
    $('#module-summary').textContent=rows.length?'Showing '+((state.pageNumber-1)*pageSize+1)+'–'+Math.min(state.pageNumber*pageSize,rows.length)+' of '+rows.length+' Excel records':'0 matching Excel records';
    $('#page-number').textContent=state.pageNumber+' / '+pages;
    $('[data-action="previous-page"]').disabled=state.pageNumber===1;
    $('[data-action="next-page"]').disabled=state.pageNumber===pages;
}
async function updateBackupStatus(code, period, status, button) {
    if(button.disabled)return;
    button.disabled=true;
    try {
        const response = await fetch(document.body.dataset.backupUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
            },
            body: JSON.stringify({code, period, status})
        });
        if (!response.ok) throw new Error((await response.json()).message || 'Failed to update backup status.');
        dialog.close();
        await refreshBackups();
        toast('Backup marked as ' + status + '.');
    } catch (e) {
        toast(e.message);
        button.disabled=false;
    }
}

function showBackupDetails(id) {
    const record=backupWorkbook.data?.records.find(row=>row.id===id);
    if(!record)return;
    const entry=record.months[state.backupPeriod];
    const history=Object.entries(record.months).map(([period,value])=>'<tr><td>'+monthName(period)+'</td><td>'+escape(value.display||'—')+'</td><td>'+badge(value.status)+'</td></tr>').join('');
    
    let actions = '';
    if (entry.status !== 'Completed') {
        actions = '<div class="dialog-actions"><button class="button button-primary" data-action="mark-backup-completed" data-record-code="'+escape(record.code)+'" data-record-period="'+escape(state.backupPeriod)+'">'+icon('check')+'Mark as Completed</button></div>';
    }
    
    showDialog(record.code+' · Backup record','<p class="dialog-description">F-MIS-06 · '+monthName(state.backupPeriod)+'</p>'+badge(entry.status)+'<dl class="detail-grid">'+details({'Assigned user':record.user||'Not specified','Computer code':record.code,'Source sheet':record.sheet,'Source cell':entry.cell,'Excel entry':entry.display||'Blank / not recorded','Last read':new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:workspaceTimezone}).format(new Date(backupWorkbook.data.source.checked_at))+' '+workspaceTimezoneLabel})+'</dl><h3 class="backup-history-title">Monthly entries · '+record.year+'</h3><div class="table-scroll"><table class="data-table"><thead><tr><th>Month</th><th>Excel entry</th><th>Status</th></tr></thead><tbody>'+history+'</tbody></table></div><p class="dialog-description backup-detail-note">Edits via the Mark as Completed button will override the Excel workbook status directly in the database.</p>' + actions);
}
refreshBackups();

async function refreshInventory(feedback = false) {
    if(refreshInventory.running)return;
    if(feedback && dialog.open)dialog.close();
    refreshInventory.running=true;
    const pending=loadInventoryWorkbook(document.body.dataset.inventoryUrl);
    configureBackupControls();renderOverview();if(state.page==='inventory')renderInventoryModule();
    await pending;
    refreshInventory.running=false;
    configureBackupControls();renderOverview();if(state.page==='inventory')renderInventoryModule();
    if(feedback)toast(inventoryWorkbook.status==='ready'?'Inventory refreshed from Excel.':inventoryWorkbook.error);
}
function renderInventoryModule() {
    if(inventoryWorkbook.status!=='ready'){
        const loading=inventoryWorkbook.status==='loading';
        $('#module-content').innerHTML='<div class="panel backup-state" role="status">'+icon(loading?'monitor':'info')+'<h2>'+(loading?'Reading inventory…':'Inventory Excel unavailable')+'</h2><p>'+escape(loading?'Loading PC parts and laptop specifications from the workbook.':inventoryWorkbook.error)+'</p>'+(loading?'':'<button class="button button-secondary" data-action="refresh-inventory">Retry reading Excel</button>')+'</div>';
        return;
    }
    const summary=inventorySummary();
    const source=inventoryWorkbook.data.source;
    const modified=new Intl.DateTimeFormat('en',{dateStyle:'medium',timeStyle:'short',timeZone:workspaceTimezone}).format(new Date(source.modified_at));
    const cards=[['Total equipment',summary.total,'monitor','teal'],['PC / desktop',summary.pc,'box','blue'],['Laptops',summary.laptops,'file','purple'],['Needs attention',summary.attention,'tool','amber']];
    $('#module-content').innerHTML='<div class="backup-source"><div><span class="eyebrow">EDITABLE EXCEL INVENTORY</span><strong>'+escape(source.file)+'</strong><p>'+escape(source.period||'PC and laptop inventory')+' · Saved '+escape(modified)+' '+escape(workspaceTimezoneLabel)+'</p></div><button class="button button-secondary" data-action="refresh-inventory">'+icon('history')+'Refresh Excel</button></div><div class="stats-grid">'+cards.map(([label,value,name,tint])=>'<div class="stat-card"><div class="stat-head"><span>'+label+'</span><span class="stat-icon '+tint+'-tint">'+icon(name)+'</span></div><div class="stat-value">'+value+'</div></div>').join('')+'</div><div class="module-intro">'+icon('info')+'<span>Add, edit, or remove equipment. Changes are saved to Excel with an automatic backup. Equipment status comes from the parts or specification remarks.</span></div><div class="panel"><div class="module-toolbar inventory-toolbar"><label>'+icon('search')+'<input id="module-search" type="search" aria-label="Search inventory" placeholder="Search label, department, user, or part…" value="'+escape(state.search)+'"></label><div class="inventory-filters"><label><span class="sr-only">Equipment type</span><select id="inventory-kind">'+[['All','All equipment'],['pc','PC / desktop'],['laptop','Laptops']].map(([value,label])=>'<option value="'+value+'"'+(state.inventoryKind===value?' selected':'')+'>'+label+'</option>').join('')+'</select></label><label><span class="sr-only">Inventory status</span><select id="module-filter">'+['All','Operational','Attention','Under repair','Maintenance','Not recorded'].map(option=>'<option'+(state.filter===option?' selected':'')+'>'+option+'</option>').join('')+'</select></label></div></div><div class="table-scroll"><table class="data-table module-table inventory-table"><caption class="sr-only">PC and laptop records from inventory Excel</caption><thead><tr><th>Equipment</th><th>Department</th><th>Assigned user</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody id="module-rows"></tbody></table></div><div class="table-footer"><span id="module-summary"></span><div class="pagination"><button data-action="previous-page" aria-label="Previous page">Previous</button><span id="page-number"></span><button data-action="next-page" aria-label="Next page">Next</button></div></div></div>';
    renderInventoryRows();
}
function renderInventoryRows() {
    if(inventoryWorkbook.status!=='ready'||!$('#module-rows'))return;
    const rows=currentRows();
    const pages=Math.max(1,Math.ceil(rows.length/pageSize));
    state.pageNumber=Math.min(state.pageNumber,pages);
    $('#module-rows').innerHTML=rows.slice((state.pageNumber-1)*pageSize,state.pageNumber*pageSize).map(row=>'<tr><td>'+equipment(row.code,row.brand||row.sheet)+'</td><td>'+escape(row.department)+'</td><td>'+escape(row.custodian||'—')+'</td><td>'+escape(row.type)+'</td><td>'+badge(row.status)+'</td><td><div class="inventory-row-actions">'+detailButton('inventory',row.id)+'<button class="compact-button" data-edit-inventory="'+row.id+'" aria-label="Edit '+escape(row.code)+'">'+icon('tool')+'Edit</button><button class="compact-button danger-text" data-delete-inventory="'+row.id+'" aria-label="Delete '+escape(row.code)+'">'+icon('close')+'Delete</button></div></td></tr>').join('')||emptyRow(6);
    $('#module-summary').textContent=rows.length?'Showing '+((state.pageNumber-1)*pageSize+1)+'–'+Math.min(state.pageNumber*pageSize,rows.length)+' of '+rows.length+' Excel records':'0 matching Excel records';
    $('#page-number').textContent=state.pageNumber+' / '+pages;
    $('[data-action="previous-page"]').disabled=state.pageNumber===1;
    $('[data-action="next-page"]').disabled=state.pageNumber===pages;
}
function showInventoryDetails(id) {
    const row=inventoryRows().find(record=>record.id===id);
    if(!row){toast('This inventory record is no longer available. Refresh Excel.');return;}
    const parts=row.kind==='pc'?row.components.map(part=>'<tr><td>'+escape(part.name)+'</td><td>'+escape(part.brand||'—')+'</td><td>'+escape(part.remarks||'—')+'</td></tr>').join(''):Object.entries(row.specifications).map(([key,value])=>'<tr><td>'+escape(key.toUpperCase())+'</td><td>'+escape(value||'—')+'</td><td>'+escape(row.specification_remarks[key]||'—')+'</td></tr>').join('');
    showDialog(row.code+' · Inventory','<p class="dialog-description">'+escape(row.sheet)+' · '+escape(inventoryWorkbook.data.source.file)+'</p>'+badge(row.status)+'<dl class="detail-grid">'+details({Department:row.department,'Assigned user':row.kind==='pc'?(row.custodian||'Not specified'):'Not recorded in laptop sheet',Type:row.type,Brand:row.brand||'Not specified'})+'</dl><div class="table-scroll"><table class="data-table"><thead><tr><th>'+(row.kind==='pc'?'Part':'Specification')+'</th><th>'+(row.kind==='pc'?'Brand':'Value')+'</th><th>Remarks</th></tr></thead><tbody>'+parts+'</tbody></table></div><div class="dialog-actions"><button class="button button-secondary danger-text" data-delete-inventory="'+row.id+'">Delete equipment</button><button class="button button-primary" data-edit-inventory="'+row.id+'">'+icon('tool')+'Edit equipment</button></div>');
    dialog.classList.add('inventory-dialog');
}
function componentFields(part = {}) {
    return '<div class="inventory-part-row" data-component-row><label class="field">Part<input data-part-name required maxlength="80" value="'+escape(part.name||'')+'" placeholder="CPU, monitor, keyboard…"></label><label class="field">Brand<input data-part-brand maxlength="255" value="'+escape(part.brand||'')+'" placeholder="Brand / model"></label><label class="field">Remarks<input data-part-remarks maxlength="500" value="'+escape(part.remarks||'')+'" placeholder="GOOD or describe condition"></label><button type="button" class="icon-button danger-text" data-action="remove-inventory-part" aria-label="Remove part">'+icon('close')+'</button></div>';
}
function addInventoryPart() {
    if($$('[data-component-row]').length>=20){toast('A record can contain up to 20 parts.');return;}
    $('#inventory-parts').insertAdjacentHTML('beforeend',componentFields());
}
function openInventoryForm(row = null) {
    if(inventoryWorkbook.status!=='ready'){toast('Load inventory Excel before editing.');return;}
    const kind=row?.kind||'pc';
    const parts=row?.components?.length?row.components:['LED MONITOR','CPU','KEYBOARD','MOUSE','UPS / AVR'].map(name=>({name}));
    const specs=[['os','Operating system'],['ram','RAM'],['processor','Processor'],['storage','Storage'],['gpu','GPU']];
    showDialog(row?'Edit equipment':'Add equipment','<p class="dialog-description">Save equipment details directly to the Excel inventory. A backup is created before each change.</p><form id="inventory-form" data-record-id="'+escape(row?.id||'')+'" data-version="'+inventoryWorkbook.data.version+'"><div class="form-error" role="alert" hidden></div><div class="fields-grid"><label class="field">Equipment type<select id="equipment-kind"'+(row?' disabled':'')+'><option value="pc"'+(kind==='pc'?' selected':'')+'>PC / desktop</option><option value="laptop"'+(kind==='laptop'?' selected':'')+'>Laptop</option></select></label><label class="field">Department / section<input name="department" required maxlength="120" value="'+escape(row?.department||'')+'"></label></div><div data-inventory-kind-panel="pc"><div class="fields-grid inventory-fields"><label class="field">Computer label'+(row?' (optional if not recorded)':'')+'<input name="code"'+(row?'':' required')+' maxlength="80" value="'+escape(row?.label||'')+'" placeholder="e.g. MIS-PC1"></label><label class="field">Assigned user<input name="custodian" maxlength="255" value="'+escape(row?.custodian||'')+'"></label></div><div class="inventory-form-section"><div class="section-heading"><h3>Computer parts</h3><button type="button" class="text-link" data-action="add-inventory-part">'+icon('plus')+'Add part</button></div><div id="inventory-parts">'+parts.map(componentFields).join('')+'</div></div></div><div data-inventory-kind-panel="laptop"><div class="fields-grid inventory-fields"><label class="field">Brand<input name="brand" required maxlength="120" value="'+escape(row?.brand||'')+'"></label><label class="field">Model<input name="model" required maxlength="120" value="'+escape(row?.model||'')+'"></label></div><div class="inventory-form-section"><h3>Laptop specifications</h3>'+specs.map(([key,label])=>'<div class="inventory-spec-row"><label class="field">'+label+'<input data-spec="'+key+'" maxlength="255" value="'+escape(row?.specifications?.[key]||'')+'"></label><label class="field">Remarks<input data-spec-remark="'+key+'" maxlength="500" value="'+escape(row?.specification_remarks?.[key]||'')+'"></label></div>').join('')+'</div></div><p class="inventory-form-note">Use GOOD for a working part, or describe its condition. Blank remarks stay unrecorded. Close the workbook in Excel before saving here.</p><div class="dialog-actions"><button type="button" class="button button-secondary" data-action="close-dialog">Cancel</button><button type="submit" class="button button-primary">'+icon('check')+'Save to Excel</button></div></form>');
    dialog.classList.add('inventory-dialog');
    updateInventoryKind();
}
function updateInventoryKind() {
    const kind=$('#equipment-kind').value;
    $$('[data-inventory-kind-panel]').forEach(panel=>{
        const hidden=panel.dataset.inventoryKindPanel!==kind;
        panel.hidden=hidden;
        [...panel.querySelectorAll('input,textarea,button')].forEach(input=>input.disabled=hidden);
    });
}
function inventoryError(element,error) {
    element.hidden=false;
    const messages=Object.values(error.errors||{}).flat();
    element.textContent=messages.length?messages.join(' '):error.message;
    if(error.status===409){
        const refresh=document.createElement('button');refresh.type='button';refresh.className='button button-secondary';refresh.dataset.action='refresh-inventory';refresh.textContent='Close editor & refresh';element.appendChild(document.createElement('br'));element.appendChild(refresh);
    }
}
async function saveInventoryForm(form) {
    if(form.dataset.saving==='true')return;
    const kind=$('#equipment-kind').value;
    const payload={version:form.dataset.version,kind,department:form.querySelector('[name="department"]').value.trim()};
    if(kind==='pc'){
        payload.code=form.querySelector('[name="code"]').value.trim();
        payload.custodian=form.querySelector('[name="custodian"]').value.trim();
        payload.components=[...form.querySelectorAll('[data-component-row]')].map(row=>({name:row.querySelector('[data-part-name]').value.trim(),brand:row.querySelector('[data-part-brand]').value.trim(),remarks:row.querySelector('[data-part-remarks]').value.trim()}));
    }else{
        payload.brand=form.querySelector('[name="brand"]').value.trim();
        payload.model=form.querySelector('[name="model"]').value.trim();
        payload.specifications=Object.fromEntries([...form.querySelectorAll('[data-spec]')].map(input=>[input.dataset.spec,input.value.trim()]));
        payload.specification_remarks=Object.fromEntries([...form.querySelectorAll('[data-spec-remark]')].map(input=>[input.dataset.specRemark,input.value.trim()]));
    }
    const button=form.querySelector('[type="submit"]');
    const controls=[...form.elements].map(control=>[control,control.disabled]);
    form.dataset.saving='true';dialog.dataset.inventorySaving='true';controls.forEach(([control])=>control.disabled=true);form.querySelector('.form-error').hidden=true;
    try{
        const id=form.dataset.recordId;
        await mutateInventory(document.body.dataset.inventoryUrl+(id?'/'+encodeURIComponent(id):''),id?'PATCH':'POST',payload);
        dialog.close();renderOverview();configureBackupControls();if(state.page==='inventory')renderInventoryModule();
        toast(id?'Equipment updated in Excel.':'Equipment added to Excel.');
    }catch(error){inventoryError(form.querySelector('.form-error'),error);}
    finally{form.dataset.saving='false';dialog.dataset.inventorySaving='false';controls.forEach(([control,disabled])=>control.disabled=disabled);button.disabled=false;}
}
function confirmInventoryDelete(id) {
    const row=inventoryRows().find(record=>record.id===id);
    if(!row){toast('This record no longer exists. Refresh Excel.');return;}
    showDialog('Delete equipment?','<p class="dialog-description">Remove <strong>'+escape(row.code)+'</strong> and its parts from the inventory workbook? An automatic backup will be kept.</p><dl class="detail-grid">'+details({Equipment:row.code,Department:row.department,Sheet:row.sheet,'Assigned user':row.custodian||'Not specified'})+'</dl><div class="form-error" role="alert" hidden></div><div class="dialog-actions"><button class="button button-secondary" data-action="close-dialog">Cancel</button><button class="button button-danger" data-action="confirm-delete-inventory" data-record-id="'+id+'" data-version="'+inventoryWorkbook.data.version+'">Delete equipment</button></div>');
}
async function deleteInventoryRecord(button) {
    if(button.disabled)return;
    button.disabled=true;dialog.dataset.inventorySaving='true';
    try{
        await mutateInventory(document.body.dataset.inventoryUrl+'/'+encodeURIComponent(button.dataset.recordId),'DELETE',{version:button.dataset.version});
        dialog.close();renderOverview();configureBackupControls();if(state.page==='inventory')renderInventoryModule();
        toast('Equipment deleted from Excel. A backup was kept.');
    }catch(error){inventoryError($('#dialog-content .form-error'),error);}
    finally{button.disabled=false;dialog.dataset.inventorySaving='false';}
}
dialog.addEventListener('close',()=>{dialog.classList.remove('inventory-dialog');dialog.dataset.inventorySaving='false';});
refreshInventory();
