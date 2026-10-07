import { assets, requests, forms, monitoringStatus } from './dashboard-data';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = { page: 'overview', period: '2026-10', status: 'All', search: '', filter: 'All', pageNumber: 1 };
const pageSize = 10;
const dialog = $('#workspace-dialog');
const pageDescriptions = {
    overview: 'A little clarity for a productive day. Here’s where things stand.',
    inventory: 'A home for every computer, every department, and every custodian.',
    complaints: 'Track reported concerns and follow every action through to resolution.',
    repairs: 'Keep repair requests, assessments, and next steps in one place.',
    history: 'The story of your equipment, one service record at a time.',
    accountability: 'Know what is inside each computer and who it is assigned to.',
    maintenance: 'Keep equipment running smoothly with a consistent monthly routine.',
    backups: 'A clear view of monthly backup coverage across your departments.',
    forms: 'Your familiar Excel forms, organized into one connected workspace.',
};
function escape(value) {
    const element = document.createElement('span');
    element.textContent = String(value ?? '');
    return element.innerHTML.replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
function icon(name, className = '') { return '<svg aria-hidden="true" class="' + className + '"><use href="#i-' + name + '"/></svg>'; }
function badge(status) {
    const color = ['Resolved','Operational','Completed'].includes(status) ? 'green' : ['In progress','Maintenance'].includes(status) ? 'blue' : ['Pending','Under repair','High'].includes(status) ? 'amber' : 'gray';
    return '<span class="badge badge-' + color + '">' + escape(status) + '</span>';
}
function formatDate(date) { return date === '—' ? date : new Intl.DateTimeFormat('en', { month:'short',day:'2-digit',timeZone:'UTC' }).format(new Date(date + 'T00:00:00Z')); }
function monthName() { return new Intl.DateTimeFormat('en', { month:'long',year:'numeric',timeZone:'UTC' }).format(new Date(state.period + '-01T00:00:00Z')); }
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
    const backup = completedCount('backups');
    const stats = [
        {label:'Total equipment',value:assets.length,suffix:'',note:'Across ' + new Set(assets.map(a => a.department)).size + ' departments',icon:'monitor',tint:'teal',page:'inventory',status:'Registered inventory',noteIcon:'check'},
        {label:'Open requests',value:open,suffix:'',note:current.filter(r => r.status === 'In progress').length + ' currently in progress',icon:'message',tint:'amber',page:'complaints',status:'Needs attention',noteIcon:'clock'},
        {label:'Preventive maintenance',value:Math.round(pm / assets.length * 100) + '%',suffix:'',note:pm + ' of ' + assets.length + ' completed',icon:'tool',tint:'blue',page:'maintenance',status:'Monthly coverage',noteIcon:'check'},
        {label:'Backup completion',value:Math.round(backup / assets.length * 100) + '%',suffix:'',note:backup + ' of ' + assets.length + ' completed',icon:'shield',tint:'purple',page:'backups',status:'Monthly coverage',noteIcon:'check'},
    ];
    $('#stats-grid').innerHTML = stats.map(s => '<a class="stat-card" href="#' + s.page + '"><div class="stat-head"><span>' + s.label + '</span><span class="stat-icon ' + s.tint + '-tint">' + icon(s.icon) + '</span></div><div class="stat-value">' + s.value + '</div><div class="stat-note"><span class="' + (s.tint === 'amber' ? 'pending' : 'positive') + '">' + icon(s.noteIcon) + '</span>' + s.note + '</div></a>').join('');
    $('#open-count').textContent = open;
    $('#tab-open-count').textContent = open;
    $('#request-count').textContent = current.length;
    $('#activity-total').textContent = current.length;
    renderChart();
    const operational = assets.filter(a => a.status === 'Operational').length;
    const repair = assets.filter(a => a.status === 'Under repair').length;
    const healthyPercent = operational / assets.length * 100;
    $('#health-percent').innerHTML = Math.round(healthyPercent) + '<span>%</span>';
    $('#health-donut').style.background = 'conic-gradient(#148976 0 ' + healthyPercent + '%,#efc573 ' + healthyPercent + '% ' + ((operational + repair) / assets.length * 100) + '%,#9cb9d6 0 100%)';
    $('#health-donut').setAttribute('aria-label', operational + ' of ' + assets.length + ' equipment operational');
    $('#health-legend').innerHTML = [['Operational',operational,'teal'],['Under repair',repair,'amber'],['Maintenance',assets.length - operational - repair,'blue']].map(([label,count,color]) => '<div><i class="legend-dot ' + color + '"></i><span>' + label + '</span><strong>' + count + '</strong></div>').join('');
    $('#monitoring-summary').innerHTML = [['maintenance','Preventive maintenance','F-MIS-05','tool',pm,'teal'],['backups','Monthly backup','F-MIS-06','database',backup,'blue']].map(([page,title,code,name,count,tint]) => '<a class="monitoring-item" href="#' + page + '"><div class="monitoring-title"><span class="' + tint + '-tint">' + icon(name) + '</span><div><strong>' + title + '</strong><small>' + code + ' · ' + monthName() + '</small></div>' + icon('chevron-right') + '</div><div class="progress-label"><span>' + count + ' of ' + assets.length + ' computers</span><strong>' + Math.round(count / assets.length * 100) + '%</strong></div><div class="progress-track ' + (tint === 'blue' ? 'blue' : '') + '" role="progressbar" aria-label="' + title + '" aria-valuemin="0" aria-valuemax="' + assets.length + '" aria-valuenow="' + count + '"><span style="width:' + count / assets.length * 100 + '%"></span></div><div class="monitoring-note">' + (assets.length - count) + ' remaining this month</div></a>').join('');
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
    if (['complaints','repairs','history'].includes(state.page)) {
        rows = periodRequests();
        if (state.page === 'history') rows = rows.filter(r => r.status === 'Resolved');
    } else {
        rows = assets.map(a => ({ ...a, status:['maintenance','backups'].includes(state.page) ? monitoringStatus(a,state.page,state.period) : a.status }));
    }
    return rows.filter(row => (state.filter === 'All' || row.status === state.filter) && Object.values(row).join(' ').toLowerCase().includes(state.search.toLowerCase().trim()));
}
function renderModule() {
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
    if(type === 'request') {
        const row = requests.find(r => r.id === id);
        if(!row) return;
        showDialog(row.code + ' · Service request','<p class="dialog-description">' + escape(row.id) + ' · F-MIS-01 / F-MIS-03</p>' + badge(row.status) + '<dl class="detail-grid">' + details({Department:row.department,'Requested by':row.requestedBy,'Date reported':formatDate(row.date) + ', 2026',Priority:row.priority,'Date repaired':row.repaired === '—' ? 'Not yet repaired' : formatDate(row.repaired) + ', 2026','Approval': 'Sample · For MIS review'}) + '</dl><div class="detail-block"><h3>Complaint</h3><p>' + escape(row.issue) + '</p><h3 style="margin-top:15px">Action taken</h3><p>' + escape(row.action) + '</p></div><p class="preview-note">Sample record. Changes and approvals are not connected to a database.</p>');
    } else {
        const asset = assets.find(a => a.code === id);
        if(!asset) return;
        const monitoring = ['maintenance','backups'].includes(state.page);
        showDialog(asset.code,'<p class="dialog-description">Computer inventory · F-MIS-04</p>' + badge(monitoring ? monitoringStatus(asset,state.page,state.period) : asset.status) + '<dl class="detail-grid">' + details({Department:asset.department,Custodian:asset.custodian,Brand:asset.brand,Type:asset.type,Processor:asset.processor,Memory:asset.memory,Storage:asset.storage,'Operating system':'Windows 11 Pro','Preventive maintenance':monitoringStatus(asset,'maintenance',state.period),'Monthly backup':monitoringStatus(asset,'backups',state.period)}) + '</dl><p class="preview-note">Illustrative equipment specifications and assignments. Monitoring period: ' + monthName() + '.</p>');
    }
}
function details(values) { return Object.entries(values).map(([label,value]) => '<div><dt>' + escape(label) + '</dt><dd>' + escape(value) + '</dd></div>').join(''); }
function newRequest() {
    showDialog('Create a service request','<p class="dialog-description">Log an equipment concern using the fields from F-MIS-03.</p><form id="request-form"><div class="fields-grid"><label class="field field-full">Computer / equipment<select name="code" required><option value="">Select equipment</option>' + assets.map(a => '<option value="' + a.code + '">' + a.code + ' · ' + a.department + '</option>').join('') + '</select></label><label class="field">Requested by<input name="requestedBy" required maxlength="80" placeholder="Your name" autocomplete="name"></label><label class="field">Priority<select name="priority"><option>Normal</option><option>High</option></select></label><label class="field">Date requested<input name="date" type="date" min="' + state.period + '-01" max="' + state.period + (state.period === '2026-10' ? '-31' : '-30') + '" value="' + state.period + (state.period === '2026-10' ? '-07' : '-30') + '" required></label><label class="field">Department<input name="department" readonly placeholder="From equipment"></label><label class="field field-full">Complaint<textarea name="issue" required minlength="5" maxlength="500" placeholder="Describe the problem with this equipment…"></textarea></label></div><p class="preview-note">Preview only. This request is kept in this tab until you reload the page; nothing is submitted to a database.</p><div class="dialog-actions"><button type="button" class="button button-secondary" data-action="close-dialog">Cancel</button><button type="submit" class="button button-primary">' + icon('plus') + 'Add preview request</button></div></form>');
}
function exportReport() {
    const scope = state.page === 'overview' ? 'Service requests' : state.page === 'forms' ? 'Forms catalog' : forms.find(f => f.page === state.page).title;
    showDialog('Export report','<p class="dialog-description">Download ' + escape(scope.toLowerCase()) + ' as a CSV file, ready to open in Excel.</p><dl class="detail-grid">' + details({Report:scope,Period:['inventory','accountability','forms'].includes(state.page) ? 'All equipment / forms' : monthName(),Filters:state.page === 'overview' || state.page === 'forms' ? 'All records' : (state.filter + (state.search ? ' · ' + state.search : '')),'Data source':'UI sample records'}) + '</dl><p class="preview-note">The export contains sample data, not a live database report.</p><div class="dialog-actions"><button class="button button-secondary" data-action="close-dialog">Cancel</button><button class="button button-primary" data-action="download-csv">' + icon('download') + 'Download CSV</button></div>');
}
function downloadCsv() {
    let rows;
    if(state.page === 'forms') rows=forms.map(f => ({Code:f.code,Form:f.title,Workbook:f.file,Fields:f.fields.join('; ')}));
    else if(state.page === 'overview' || ['complaints','repairs','history'].includes(state.page)) rows=(state.page === 'overview' ? periodRequests() : currentRows()).map(r => ({Request:r.id,Equipment:r.code,Department:r.department,Complaint:r.issue,Status:r.status,Priority:r.priority,Reported:r.date,'Requested by':r.requestedBy,'Action taken':r.action}));
    else rows=currentRows().map(r => ({Equipment:r.code,Department:r.department,Custodian:r.custodian,Brand:r.brand,Status:r.status,Period:['maintenance','backups'].includes(state.page) ? monthName() : 'Inventory snapshot',Memory:r.memory,Storage:r.storage}));
    if(!rows.length){toast('No matching records to export.');return;}
    // Prevent spreadsheet formulas in user-entered CSV cells.
    const cell = value => '"' + (/^[=+@\-\t\r]/.test(String(value)) ? "'" : '') + String(value).replaceAll('"','""') + '"';
    const csv = '\uFEFF' + [Object.keys(rows[0]),...rows.map(Object.values)].map(row => row.map(cell).join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const link=document.createElement('a');link.href=url;link.download='MISDB-sample-' + state.page + '-' + state.period + '.csv';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    dialog.close();toast('Sample report downloaded.');
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
    const action=event.target.closest('[data-action]')?.dataset.action;
    if(action==='close-dialog')dialog.close();
    if(action==='new-request')newRequest();
    if(action==='export')exportReport();
    if(action==='download-csv')downloadCsv();
    if(action==='previous-page'){state.pageNumber--;renderModuleRows();}
    if(action==='next-page'){state.pageNumber++;renderModuleRows();}
    if(action==='profile')showDialog('MIS Administrator','<p class="dialog-description">LCMI · Management Information System</p><dl class="detail-grid">'+details({Workspace:'Laguna Carparts Manufacturing Inc.',Mode:'Frontend design preview',Role:'Sample administrator',Storage:'Temporary in this browser tab'})+'</dl><p class="preview-note">User accounts and permissions will be connected during backend implementation.</p>');
    if(action==='notifications')showDialog('Your monthly reminders','<p class="dialog-description">'+monthName()+' · Sample workspace</p>'+[['complaints',periodRequests().filter(r=>r.status!=='Resolved').length+' open service requests','Review pending concerns and ongoing repairs.','message'],['maintenance',(assets.length-completedCount('maintenance'))+' computers awaiting maintenance','Complete your preventive maintenance checklist.','tool'],['backups',(assets.length-completedCount('backups'))+' backups remaining','Review monthly backup coverage.','database']].map(([page,title,description,name])=>'<a href="#'+page+'" class="notification-item">'+icon(name)+'<span><strong>'+title+'</strong><small>'+description+'</small></span>'+icon('chevron-right')+'</a>').join(''));
    if(action==='help')showDialog('Welcome to your workspace','<p class="dialog-description">MISDB brings your seven Excel-based workflows into one place.</p><div class="detail-block"><p><strong>Find equipment.</strong> Use the search box or Computer inventory to locate a computer, department, or custodian.</p><p class="mt-4"><strong>Follow up on concerns.</strong> Open a service request to see its complaint, priority, and action taken.</p><p class="mt-4"><strong>Keep a monthly routine.</strong> Switch reporting months to review maintenance and backup completion.</p></div><p class="preview-note">All figures are sample data for design review. New preview requests reset when you reload.</p>');
});
document.addEventListener('input',event=>{
    if(event.target.id==='module-search'){state.search=event.target.value;state.pageNumber=1;renderModuleRows();}
    if(event.target.id==='global-search'){
        state.search=event.target.value;state.pageNumber=1;state.filter='All';
        if(state.page!=='inventory'){history.replaceState(null,'','#inventory');navigate(false);}else {$('#module-search').value=state.search;renderModuleRows();}
    }
});
document.addEventListener('change',event=>{
    if(event.target.id==='module-filter'){state.filter=event.target.value;state.pageNumber=1;renderModuleRows();}
    if(event.target.id==='period'){state.period=event.target.value;state.pageNumber=1;renderOverview();if(state.page!=='overview')renderModule();}
    if(event.target.matches('#request-form [name="code"]'))$('#request-form [name="department"]').value=assets.find(a=>a.code===event.target.value)?.department ?? '';
});
document.addEventListener('submit',event=>{
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
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
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
