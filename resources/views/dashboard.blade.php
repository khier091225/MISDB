<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#087f72">
    <meta name="description" content="MISDB — equipment inventory, service requests, and maintenance monitoring for Laguna Carparts Manufacturing Inc.">
    <title>MISDB · Overview</title>
    <link rel="icon" type="image/svg+xml" href="{{ asset('misdb.svg') }}">
    @fonts
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body>
    @include('partials.icons')
    <a class="skip-link" href="#main-content">Skip to content</a>
    <button class="sidebar-scrim" aria-label="Close navigation" hidden></button>
    <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <a href="#overview" class="brand"><span class="brand-icon"><svg><use href="#i-layers"/></svg></span><span>MIS<span class="brand-accent">DB</span><small>MANAGEMENT INFORMATION SYSTEM</small></span></a>
        <div class="workspace"><span class="company-icon">L</span><div><strong>Laguna Carparts</strong><small>Manufacturing Incorporated</small></div><span class="workspace-dot"></span></div>
        <nav class="flex flex-col gap-1">
            <p class="nav-label">WORKSPACE</p>
            <a href="#overview" class="nav-item active" data-page="overview" aria-current="page"><svg><use href="#i-grid"/></svg>Overview</a>
            <a href="#inventory" class="nav-item" data-page="inventory"><svg><use href="#i-monitor"/></svg>Computer inventory</a>
            <p class="nav-label nav-label-spaced">SERVICE MANAGEMENT</p>
            <a href="#complaints" class="nav-item" data-page="complaints"><svg><use href="#i-message"/></svg>Complaints & actions<span class="nav-count" id="open-count">5</span></a>
            <a href="#repairs" class="nav-item" data-page="repairs"><svg><use href="#i-tool"/></svg>Repair requests</a>
            <a href="#history" class="nav-item" data-page="history"><svg><use href="#i-history"/></svg>Maintenance history</a>
            <a href="#accountability" class="nav-item" data-page="accountability"><svg><use href="#i-box"/></svg>Parts & accountability</a>
            <p class="nav-label nav-label-spaced">MONITORING</p>
            <a href="#maintenance" class="nav-item" data-page="maintenance"><svg><use href="#i-calendar"/></svg>Preventive maintenance</a>
            <a href="#backups" class="nav-item" data-page="backups"><svg><use href="#i-database"/></svg>Backup monitoring</a>
            <a href="#forms" class="nav-item" data-page="forms"><svg><use href="#i-folder"/></svg>Forms library<span class="nav-count neutral">7</span></a>
        </nav>
        <div class="sidebar-bottom"><button class="profile" data-action="profile"><span class="avatar">MA</span><span><strong>MIS Administrator</strong><small>Preview workspace</small></span><svg><use href="#i-chevron-right"/></svg></button></div>
    </aside>
    <div class="app-shell">
        <header class="topbar">
            <div class="flex items-center gap-3"><button class="icon-button menu-toggle" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false"><svg><use href="#i-menu"/></svg></button><span class="breadcrumb">Workspace <svg><use href="#i-chevron-right"/></svg><strong id="breadcrumb-current">Overview</strong></span></div>
            <div class="topbar-actions"><label class="global-search"><svg><use href="#i-search"/></svg><input id="global-search" type="search" placeholder="Search equipment…" aria-label="Search equipment"><kbd>/</kbd></label><span class="preview-indicator"><span></span>Design preview</span><button class="icon-button notification-button" data-action="notifications" aria-label="View reminders"><svg><use href="#i-bell"/></svg><i></i></button><span class="topbar-divider"></span><button class="avatar avatar-small" data-action="profile" aria-label="Workspace profile">MA</button></div>
        </header>
        <main id="main-content" tabindex="-1">
            <div class="page-heading"><div><div class="eyebrow" id="eyebrow">YOUR IT, AT A GLANCE</div><h1 id="page-title">Workspace overview<span class="title-dot">.</span></h1><p id="page-description">A little clarity for a productive day. Here’s where things stand.</p></div><div class="heading-actions"><button class="button button-secondary" data-action="export"><svg><use href="#i-download"/></svg>Export report</button><button class="button button-primary" data-action="new-request"><svg><use href="#i-plus"/></svg>New request</button></div></div>
            <div class="context-bar"><div class="flex items-center gap-2"><span class="context-dot"></span><strong>LCMI IT operations</strong><span class="context-separator">/</span><span id="context-label">Monthly snapshot</span></div><label class="period-picker"><svg><use href="#i-calendar"/></svg><select id="period" aria-label="Reporting month"><option value="2026-10">October 2026</option><option value="2026-09">September 2026</option></select></label></div>
            <section id="overview-content" aria-label="Workspace overview">
                <div class="stats-grid" id="stats-grid"></div>
                <div class="analytics-grid"><section class="panel activity-panel"><div class="panel-heading"><div><h2>Service activity</h2><p>Reported issues and resolutions over time</p></div><span class="subtle-tag">Last 6 months</span></div><div class="chart-summary"><strong id="activity-total">0</strong><span>requests this month</span><span class="chart-legend"><i class="legend-dot teal"></i>Reported<i class="legend-dot mint"></i>Resolved</span></div><div id="activity-chart" class="activity-chart"></div></section><section class="panel health-panel"><div class="panel-heading"><div><h2>Equipment health</h2><p>Your inventory, at a glance</p></div><svg class="muted-icon"><use href="#i-monitor"/></svg></div><div class="health-content"><div class="donut" id="health-donut"><div><strong id="health-percent">85<span>%</span></strong><small>Operational</small></div></div><div class="health-legend" id="health-legend"></div></div><a href="#inventory" class="panel-footer-link">Explore computer inventory<svg><use href="#i-arrow-right"/></svg></a></section></div>
                <div class="operations-grid"><section class="panel requests-panel"><div class="panel-heading"><div class="flex items-center gap-2"><h2>Recent service requests</h2><span class="small-count" id="request-count">8</span></div><a href="#complaints" class="text-link">View all <svg><use href="#i-arrow-right"/></svg></a></div><div class="table-tabs" role="group" aria-label="Filter recent requests"><button class="table-tab active" data-status="All" aria-pressed="true">All requests</button><button class="table-tab" data-status="Open" aria-pressed="false">Open <span id="tab-open-count">5</span></button><button class="table-tab" data-status="Resolved" aria-pressed="false">Resolved</button></div><div class="table-scroll"><table class="data-table requests-table"><caption class="sr-only">Recent service requests, sample data</caption><thead><tr><th>Equipment / issue</th><th>Department</th><th>Status</th><th>Reported</th><th><span class="sr-only">Details</span></th></tr></thead><tbody id="recent-requests"></tbody></table></div><div class="table-footer"><span id="recent-summary"></span><span>F-MIS-01 · F-MIS-03</span></div></section><section class="panel monitoring-panel"><div class="panel-heading"><div><h2>Monthly checklist</h2><p>A little upkeep goes a long way.</p></div><svg class="muted-icon"><use href="#i-check-square"/></svg></div><div id="monitoring-summary"></div><div class="reminder"><svg><use href="#i-info"/></svg><p>Keep your records up to date for a smoother month-end review.</p></div></section></div>
                <section class="quick-access"><div class="section-heading"><h2>Your everyday essentials</h2><a href="#forms" class="text-link">All forms <svg><use href="#i-arrow-right"/></svg></a></div><div class="quick-grid"><a class="quick-card" href="#inventory"><span class="quick-icon teal-tint"><svg><use href="#i-monitor"/></svg></span><span><strong>Computer inventory</strong><small>Equipment & assignments</small></span><svg class="quick-arrow"><use href="#i-arrow-up-right"/></svg></a><a class="quick-card" href="#accountability"><span class="quick-icon blue-tint"><svg><use href="#i-box"/></svg></span><span><strong>Parts & accountability</strong><small>Components & custodians</small></span><svg class="quick-arrow"><use href="#i-arrow-up-right"/></svg></a><a class="quick-card" href="#history"><span class="quick-icon purple-tint"><svg><use href="#i-history"/></svg></span><span><strong>Maintenance history</strong><small>Every action, on record</small></span><svg class="quick-arrow"><use href="#i-arrow-up-right"/></svg></a></div></section>
            </section>
            <section id="module-content" aria-label="Module records" hidden></section>
            <footer class="main-footer"><span><span class="footer-logo">MISDB</span> A more organized IT workspace.</span><span>UI preview · Sample records · No database connected</span></footer>
        </main>
    </div>
    <dialog id="workspace-dialog" aria-labelledby="dialog-title"><div class="dialog-heading"><span class="eyebrow">MISDB WORKSPACE</span><button class="icon-button" data-action="close-dialog" aria-label="Close dialog"><svg><use href="#i-close"/></svg></button></div><div id="dialog-content"></div></dialog>
    <div class="toast" id="toast" role="status" hidden></div>
    <noscript><div class="noscript">Enable JavaScript to explore the interactive MISDB dashboard.</div></noscript>
</body>
</html>
