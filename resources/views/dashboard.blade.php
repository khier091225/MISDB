<x-layouts.app :backup-url="route('backup-monitoring.index')" :inventory-url="route('inventory.index')" :timezone="config('misdb.timezone')">
    <x-slot:navigation>
        <a href="#overview" class="brand">
            <span class="brand-icon"><x-icon name="layers" /></span>
            <span>MIS<span class="brand-accent">DB</span><small>MANAGEMENT INFORMATION SYSTEM</small></span>
        </a>

        <nav class="mt-8 flex flex-col gap-1">
            <p class="nav-label">WORKSPACE</p>
            <x-nav-link page="overview" icon="grid" :active="true">Overview</x-nav-link>
            <x-nav-link page="inventory" icon="monitor">Computer inventory</x-nav-link>

            <p class="nav-label nav-label-spaced">SERVICE MANAGEMENT</p>
            <x-nav-link page="complaints" icon="message">
                Complaints & actions
                <span class="nav-count" id="open-count">5</span>
            </x-nav-link>
            <x-nav-link page="repairs" icon="tool">Repair requests</x-nav-link>
            <x-nav-link page="history" icon="history">Maintenance history</x-nav-link>
            <x-nav-link page="accountability" icon="box">Parts & accountability</x-nav-link>

            <p class="nav-label nav-label-spaced">MONITORING</p>
            <x-nav-link page="maintenance" icon="calendar">Preventive maintenance</x-nav-link>
            <x-nav-link page="backups" icon="database">Backup monitoring</x-nav-link>
            <x-nav-link page="forms" icon="folder">
                Forms library
                <span class="nav-count neutral">7</span>
            </x-nav-link>
        </nav>

        <div class="sidebar-bottom">
            <button class="profile" data-action="profile">
                <span class="avatar">MA</span>
                <span>
                    <strong>MIS Administrator</strong>
                    <small>Preview workspace</small>
                </span>
                <x-icon name="chevron-right" />
            </button>
        </div>
    </x-slot:navigation>

    <x-slot:header>
        <div class="flex items-center gap-3">
            <button class="icon-button menu-toggle" aria-label="Open navigation" aria-controls="sidebar" aria-expanded="false">
                <x-icon name="menu" />
            </button>
            <span class="breadcrumb">
                Workspace
                <x-icon name="chevron-right" />
                <strong id="breadcrumb-current">Overview</strong>
            </span>
        </div>

        <div class="topbar-actions">
            <label class="global-search">
                <x-icon name="search" />
                <input id="global-search" type="search" placeholder="Search equipment…" aria-label="Search equipment">
                <kbd>/</kbd>
            </label>
            <span class="preview-indicator"><span></span>Design preview</span>
            <button class="icon-button notification-button" data-action="notifications" aria-label="View reminders">
                <x-icon name="bell" />
                <i></i>
            </button>
            <span class="topbar-divider"></span>
            <button class="avatar avatar-small" data-action="profile" aria-label="Workspace profile">MA</button>
        </div>
    </x-slot:header>

    <div class="page-heading">
        <div>
            <div class="eyebrow" id="eyebrow">YOUR IT, AT A GLANCE</div>
            <h1 id="page-title">Workspace overview<span class="title-dot">.</span></h1>
            <p id="page-description">A little clarity for a productive day. Here’s where things stand.</p>
        </div>
        <div class="heading-actions">
            <x-button variant="secondary" icon="download" data-action="export">Export report</x-button>
            <x-button variant="primary" icon="plus" data-action="new-request">New request</x-button>
            <x-button variant="primary" icon="plus" data-action="new-equipment" hidden>Add equipment</x-button>
        </div>
    </div>

    <div class="context-bar">
        <div class="flex items-center gap-2">
            <span class="context-dot"></span>
            <strong>LCMI IT operations</strong>
            <span class="context-separator">/</span>
            <span id="context-label">Monthly snapshot</span>
        </div>
        <label class="period-picker">
            <x-icon name="calendar" />
            <select id="period" aria-label="Reporting month">
                <option value="2026-10">October 2026</option>
                <option value="2026-09">September 2026</option>
            </select>
        </label>
    </div>

    <section id="overview-content" aria-label="Workspace overview">
        <div class="stats-grid" id="stats-grid"></div>

        <div class="analytics-grid">
            <section class="panel activity-panel">
                <div class="panel-heading">
                    <div>
                        <h2>Service activity</h2>
                        <p>Reported issues and resolutions over time</p>
                    </div>
                    <span class="subtle-tag">Last 6 months</span>
                </div>
                <div class="chart-summary">
                    <strong id="activity-total">0</strong>
                    <span>requests this month</span>
                    <span class="chart-legend">
                        <i class="legend-dot teal"></i>Reported
                        <i class="legend-dot mint"></i>Resolved
                    </span>
                </div>
                <div id="activity-chart" class="activity-chart"></div>
            </section>

            <section class="panel health-panel">
                <div class="panel-heading">
                    <div>
                        <h2>Equipment health</h2>
                        <p>Your inventory, at a glance</p>
                    </div>
                    <x-icon name="monitor" class="muted-icon" />
                </div>
                <div class="health-content">
                    <div class="donut" id="health-donut">
                        <div>
                            <strong id="health-percent">85<span>%</span></strong>
                            <small>Operational</small>
                        </div>
                    </div>
                    <div class="health-legend" id="health-legend"></div>
                </div>
                <a href="#inventory" class="panel-footer-link">
                    Explore computer inventory
                    <x-icon name="arrow-right" />
                </a>
            </section>
        </div>

        <div class="operations-grid">
            <section class="panel requests-panel">
                <div class="panel-heading">
                    <div class="flex items-center gap-2">
                        <h2>Recent service requests</h2>
                        <span class="small-count" id="request-count">8</span>
                    </div>
                    <a href="#complaints" class="text-link">View all <x-icon name="arrow-right" /></a>
                </div>
                <div class="table-tabs" role="group" aria-label="Filter recent requests">
                    <button class="table-tab active" data-status="All" aria-pressed="true">All requests</button>
                    <button class="table-tab" data-status="Open" aria-pressed="false">
                        Open <span id="tab-open-count">5</span>
                    </button>
                    <button class="table-tab" data-status="Resolved" aria-pressed="false">Resolved</button>
                </div>
                <div class="table-scroll">
                    <table class="data-table requests-table">
                        <caption class="sr-only">Recent service requests, sample data</caption>
                        <thead>
                            <tr>
                                <th>Equipment / issue</th>
                                <th>Department</th>
                                <th>Status</th>
                                <th>Reported</th>
                                <th><span class="sr-only">Details</span></th>
                            </tr>
                        </thead>
                        <tbody id="recent-requests"></tbody>
                    </table>
                </div>
                <div class="table-footer">
                    <span id="recent-summary"></span>
                    <span>F-MIS-01 · F-MIS-03</span>
                </div>
            </section>

            <section class="panel monitoring-panel">
                <div class="panel-heading">
                    <div>
                        <h2>Monthly checklist</h2>
                        <p>A little upkeep goes a long way.</p>
                    </div>
                    <x-icon name="check-square" class="muted-icon" />
                </div>
                <div id="monitoring-summary"></div>
                <div class="reminder">
                    <x-icon name="info" />
                    <p>Keep your records up to date for a smoother month-end review.</p>
                </div>
            </section>
        </div>

        <section class="quick-access">
            <div class="section-heading">
                <h2>Your everyday essentials</h2>
                <a href="#forms" class="text-link">All forms <x-icon name="arrow-right" /></a>
            </div>
            <div class="quick-grid">
                <a class="quick-card" href="#inventory">
                    <span class="quick-icon teal-tint"><x-icon name="monitor" /></span>
                    <span>
                        <strong>Computer inventory</strong>
                        <small>Equipment & assignments</small>
                    </span>
                    <x-icon name="arrow-up-right" class="quick-arrow" />
                </a>
                <a class="quick-card" href="#accountability">
                    <span class="quick-icon blue-tint"><x-icon name="box" /></span>
                    <span>
                        <strong>Parts & accountability</strong>
                        <small>Components & custodians</small>
                    </span>
                    <x-icon name="arrow-up-right" class="quick-arrow" />
                </a>
                <a class="quick-card" href="#history">
                    <span class="quick-icon purple-tint"><x-icon name="history" /></span>
                    <span>
                        <strong>Maintenance history</strong>
                        <small>Every action, on record</small>
                    </span>
                    <x-icon name="arrow-up-right" class="quick-arrow" />
                </a>
            </div>
        </section>
    </section>

    <section id="module-content" aria-label="Module records" hidden></section>

    <footer class="main-footer">
        <span><span class="footer-logo">MISDB</span> A more organized IT workspace.</span>
        <span>UI preview · Sample records · No database connected</span>
    </footer>
</x-layouts.app>
