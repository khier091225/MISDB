// UI fixtures use the workbook fields and equipment naming; they are not imported operational records.
const groups = [
    ['Accounting', ['ACCTC-1','ACCTC-2','ACCTC-3','ACCTC-4','ACCTC-5','ACCTC-6','ACCTC-7','ACCTC-GL']],
    ['Design', ['DESIGN-1','DESIGN-2','DESIGN-3','DESIGN-4','DESIGN-5']],
    ['Engineering', ['PROD-DEVT1','PROD-DEVT2','PROD-DEVT3','PROD-DEVT4','ENGINEERING']],
    ['Planning', ['PPC-PC1','PPC-PC2','PPC-PC3','PPC-PC4','PPC-PC5','PPC-PC6']],
    ['Quality Assurance', ['QA-PC1','QA-PC2','QA-PCO','QA-SAFETY','QA-DIC']],
    ['Human Resources', ['HR-PC1','HR-PC2','HR-PC3']],
    ['Purchasing', ['PURCHASING-PC1','PURCHASING-PC2','PURCHASING-PC3']],
    ['Marketing', ['MKTG-PC1','MKTG-PC2']],
    ['Logistics', ['DELIVERY-PC1','DELIVERY-PC2']],
    ['Warehouse', ['WAREHOUSE-PC1','WAREHOUSE-PC2']],
    ['Production', ['PROD-PC','LASER-PC','TDD-PC','FEM-PC','PROD-OFFICE']],
    ['MIS', ['SERVER','MIS-PC']],
];
export const assets = groups.flatMap(([department, codes]) => codes.map(code => ({ code, department }))).map((asset, index) => ({
    ...asset,
    id: index + 1,
    custodian: ['A. Santos','M. Reyes','J. Cruz','R. Garcia','K. Ramos','L. Mendoza'][index % 6],
    type: asset.code === 'SERVER' ? 'Server' : 'Desktop',
    brand: ['Dell','Acer','ASUS','Lenovo'][index % 4],
    status: [0,8,23,40].includes(index) ? 'Under repair' : [12,27,36].includes(index) ? 'Maintenance' : 'Operational',
    memory: index % 3 === 0 ? '16 GB DDR4' : '8 GB DDR4',
    storage: index % 3 === 0 ? '512 GB SSD' : '256 GB SSD',
    processor: index % 3 === 0 ? 'Intel Core i7' : 'Intel Core i5',
}));
const issueTypes = [
    ['No network connection','Re-crimped LAN cable.'],
    ['Computer will not turn on','Replaced defective power supply.'],
    ['Printer connection issue','Reinstalled the printer driver.'],
    ['Slow startup','Disabled unnecessary startup applications.'],
    ['No boot device found','Replaced SATA cable and checked storage.'],
    ['Monitor display issue','Reseated the display cable.'],
    ['Application not responding','Repaired the application installation.'],
    ['Keyboard not responding','Replaced the defective keyboard.'],
];
const monthlyCounts = [14,18,12,16,11,10,8];
export const requests = monthlyCounts.flatMap((count, monthIndex) =>
    Array.from({ length: count }, (_, index) => {
        const month = String(monthIndex + 4).padStart(2, '0');
        const asset = assets[(index * 5 + monthIndex) % assets.length];
        const [issue, action] = issueTypes[index % issueTypes.length];
        const resolved = index >= (monthIndex === 6 ? 5 : monthIndex === 5 ? 2 : 1);
        const day = monthIndex === 6 ? 7 - Math.floor(index / 2) : Math.min(27, 28 - index);
        const date = '2026-' + month + '-' + String(day).padStart(2, '0');
        return {
            id: 'REQ-' + month + '-' + String(index + 1).padStart(3, '0'),
            code: asset.code,
            department: asset.department,
            requestedBy: asset.custodian,
            issue,
            action: resolved ? action : index % 2 === 0 ? 'Awaiting initial assessment.' : 'MIS technician is investigating the issue.',
            status: resolved ? 'Resolved' : index % 2 === 0 ? 'Pending' : 'In progress',
            priority: index % 4 === 0 ? 'High' : 'Normal',
            date,
            repaired: resolved ? date : '—',
        };
    })
);
export const forms = [
    { page:'inventory', code:'INVENTORY', title:'Computer inventory', icon:'monitor', description:'Equipment, departments, assigned users, brands, and specifications.', file:'COMPUTER INVENTORY FORM.xlsx', fields:['Department / Section','Computer code / Label','User / Custodian','Brand','OS, RAM, processor, storage, GPU','Remarks'] },
    { page:'complaints', code:'F-MIS-01', title:'Complaints & actions', icon:'message', description:'Reported issues, the actions taken, and the status of each concern.', file:'F-MIS-01 Computer  Printer Complaints & Actions Monitoring Sheet(1).xlsx', fields:['Date reported','Department / Section','Code','Complaints','Action taken','Date repaired','Remarks'] },
    { page:'history', code:'F-MIS-02', title:'Maintenance history', icon:'history', description:'A continuous service record for every computer in your inventory.', file:'F-MIS-02 Computer Maintenance History.xls', fields:['Computer name','Department / Section','Particulars','Signature'] },
    { page:'repairs', code:'F-MIS-03', title:'Repair requests', icon:'tool', description:'Repair requests, approvals, actions, and servicing time.', file:'F-MIS-03 Computer Repair Form.xlsx', fields:['Computer code','Department / Section','Complaint','Requested by','Approved by','Date requested','Time of complaint','Date / time repaired','MIS repairing time: started / finished','Action taken','Remarks','Repaired by'] },
    { page:'accountability', code:'F-MIS-04', title:'Parts & accountability', icon:'box', description:'Computer components, specifications, and assigned custodians.', file:'F-MIS-04 Computer Desktop Parts & Accountability.xls', fields:['Computer code','Department','Brand / Model','Identification','Motherboard / Processor','Memory slots 1–4','Hard disk drives 1–2','Monitor / Keyboard / Mouse','OS / Product key','IP / MAC address','Amount / Date purchased','AIAF number','Prepared by / Conforme / Approved by'] },
    { page:'maintenance', code:'F-MIS-05', title:'Preventive maintenance', icon:'calendar', description:'Monthly preventive maintenance coverage for each computer.', file:'F-MIS-05 Computers Preventive Maintenance Monitoring Sheet.xlsx', fields:['Year','Computer code','User','January–December monitoring','Prepared by','Approved by'] },
    { page:'backups', code:'F-MIS-06', title:'Backup monitoring', icon:'database', description:'Monthly backup completion, organized by computer and user.', file:'F-MIS-06 Monthly Back-up Monitoring Sheet(1).xlsx', fields:['Year','Computer code','User','January–December monitoring','Prepared by','Approved by'] },
];
export function monitoringStatus(asset, kind, period) {
    if (kind !== 'maintenance') return 'Not connected';
    const completed = period === '2026-09' ? 46 : 36;
    return asset.id <= completed ? 'Completed' : 'Pending';
}
