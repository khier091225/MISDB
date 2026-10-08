@props(['variant' => 'secondary', 'icon' => null])

<button {{ $attributes->merge(['type' => 'button', 'class' => 'button button-'.$variant]) }}>
    @if ($icon)
        <x-icon :name="$icon" />
    @endif
    {{ $slot }}
</button>
