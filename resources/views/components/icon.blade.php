@props(['name'])

<svg {{ $attributes->merge(['aria-hidden' => 'true']) }}>
    <use href="#i-{{ $name }}" />
</svg>
