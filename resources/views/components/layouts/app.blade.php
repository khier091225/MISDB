@props(['backupUrl', 'inventoryUrl', 'timezone' => 'Asia/Manila', 'title' => 'MISDB · Overview'])

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="theme-color" content="#087f72">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="description" content="MISDB — equipment inventory, service requests, and maintenance monitoring for Laguna Carparts Manufacturing Inc.">
    <title>{{ $title }}</title>
    <link rel="icon" type="image/svg+xml" href="{{ asset('misdb.svg') }}">
    @fonts
    @vite(['resources/css/app.css', 'resources/js/app.js'])
    @stack('styles')
</head>
<body {{ $attributes->merge(['data-backup-url' => $backupUrl, 'data-inventory-url' => $inventoryUrl, 'data-timezone' => $timezone]) }}>
    @include('partials.icons')

    <a class="skip-link" href="#main-content">Skip to content</a>
    <button class="sidebar-scrim" aria-label="Close navigation" hidden></button>

    <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        {{ $navigation }}
    </aside>

    <div class="app-shell">
        <header class="topbar">
            {{ $header }}
        </header>
        <main id="main-content" tabindex="-1">
            {{ $slot }}
        </main>
    </div>

    <dialog id="workspace-dialog" aria-labelledby="dialog-title">
        <div class="dialog-heading">
            <span class="eyebrow">MISDB WORKSPACE</span>
            <button class="icon-button" data-action="close-dialog" aria-label="Close dialog">
                <x-icon name="close" />
            </button>
        </div>
        <div id="dialog-content"></div>
    </dialog>

    <div class="toast" id="toast" role="status" hidden></div>
    <noscript>
        <div class="noscript">Enable JavaScript to explore the interactive MISDB dashboard.</div>
    </noscript>
    @stack('scripts')
</body>
</html>
