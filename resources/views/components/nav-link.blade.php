@props(['page', 'icon', 'active' => false])

<a {{ $attributes->merge([
    'href' => '#'.$page,
    'class' => 'nav-item'.($active ? ' active' : ''),
    'data-page' => $page,
    'aria-current' => $active ? 'page' : null,
]) }}>
    <x-icon :name="$icon" />
    {{ $slot }}
</a>
