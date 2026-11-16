<style>
    /* File Icons plugin: unlayered on purpose, so it beats Filament's @layer components. */
    .fi-icon:has(> .fic-icon) {
        width: 1.25rem;
        height: 1.25rem;
        flex-shrink: 0;
        vertical-align: middle;
        margin-inline-end: 0.25rem;
    }

    .fic-icon {
        display: inline-flex;
        width: 100%;
        height: 100%;
        align-items: center;
        justify-content: center;
    }

    .fic-icon > .fic-icon-img {
        display: block;
        width: 100%;
        height: 100%;
        max-width: none;
        object-fit: contain;
        pointer-events: none;
        user-select: none;
    }

    .fic-icon > .fic-icon-light {
        display: none;
    }

    html:not(.dark) .fic-icon-has-light > .fic-icon-dark {
        display: none;
    }

    html:not(.dark) .fic-icon-has-light > .fic-icon-light {
        display: block;
    }
</style>
