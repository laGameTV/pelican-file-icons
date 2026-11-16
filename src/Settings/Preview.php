<?php

namespace LaGameTV\FileIcons\Settings;

use Filament\Support\Enums\IconSize;
use LaGameTV\FileIcons\Icons\IconResolver;
use LaGameTV\FileIcons\Icons\IconTheme;
use LaGameTV\FileIcons\Icons\Themes;
use LaGameTV\FileIcons\Rendering\IconRenderer;
use LaGameTV\FileIcons\Rendering\Styles;
use LaGameTV\FileIcons\Support\ConfigOptions;
use Throwable;

use function Filament\Support\generate_icon_html;

/**
 * Side-by-side preview of typical game-server entries in every icon theme, used by the admin
 * settings (live, with the unsaved form state) and by the profile tab. Self-contained markup with
 * inline styles and inline icons, because it is shown outside the server panel.
 */
final class Preview
{
    /** Sample entries: [name, directory, is folder, MIME type reported by Wings]. */
    public const array SAMPLES = [
        ['plugins', '/', true, null],
        ['world', '/', true, null],
        ['config', '/', true, null],
        ['logs', '/', true, null],
        ['crash-reports', '/', true, null],
        ['server.properties', '/', false, null],
        ['eula.txt', '/', false, null],
        ['server.jar', '/', false, null],
        ['start.sh', '/', false, null],
        ['run', '/', false, 'text/x-shellscript'],
        ['paper-global.yml', '/config', false, null],
        ['latest.log', '/logs', false, null],
        ['level.dat', '/world', false, null],
        ['r.0.0.mca', '/world/region', false, null],
        ['spawn.schem', '/plugins/WorldEdit/schematics', false, null],
    ];

    private const string CELL = 'padding:0.375rem 0.5rem;';

    private const string BORDER = 'border-top:1px solid color-mix(in srgb,currentColor 15%,transparent)';

    private const string BADGE = 'display:inline-block;margin-top:0.25rem;font-size:0.75rem;font-weight:500;line-height:1rem;'
        . 'padding:0.125rem 0.5rem;border-radius:9999px;background:color-mix(in srgb,currentColor 12%,transparent);white-space:nowrap';

    /**
     * Badge per theme for a choice (theme id or 'auto').
     *
     * @param  array{default: string, minecraft: string, other: string}  $labels
     * @return array<string, string>
     */
    public static function badges(string $choice, array $labels): array
    {
        if ($choice === ConfigOptions::AUTO) {
            return [Themes::DATAPACK => $labels['minecraft'], Themes::MATERIAL => $labels['other']];
        }

        return Themes::isValid($choice) ? [$choice => $labels['default']] : [];
    }

    /**
     * A table with one row per sample entry and one icon column per theme.
     *
     * @param  list<array{theme: IconTheme, title: string, badge: ?string}>  $columns
     * @param  ?string  $mimeLabel  tooltip for entries detected by MIME type (':mime' is replaced)
     */
    public static function render(array $columns, ?string $mimeLabel = null): string
    {
        $headers = '';
        $icons = [];
        foreach ($columns as $column) {
            try {
                $cells = self::icons($column['theme']);
            } catch (Throwable) {
                continue; // A broken theme only hides its own column.
            }

            $icons[] = $cells;
            $badge = $column['badge'] === null ? '' : '<br><span style="' . self::BADGE . '">' . e($column['badge']) . '</span>';
            $headers .= '<th style="' . self::CELL . 'width:7rem;text-align:center;font-weight:600;vertical-align:bottom">' . e($column['title']) . $badge . '</th>';
        }

        if ($icons === []) {
            return '';
        }

        $rows = '';
        foreach (self::SAMPLES as $index => [$name, $directory, , $mime]) {
            // Only the parent folder is shown; the full path (and the MIME type) is in the tooltip.
            $parent = $directory === '/' ? '' : basename($directory) . '/';
            $prefix = $parent === '' ? '' : '<span style="opacity:0.6">' . e($parent) . '</span>';
            $tooltip = rtrim($directory, '/') . '/' . $name . ($mime !== null && $mimeLabel !== null ? ' - ' . str_replace(':mime', $mime, $mimeLabel) : '');

            $rows .= '<tr style="' . self::BORDER . '">'
                . '<td style="' . self::CELL . 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' . e($tooltip) . '">' . $prefix . e($name) . '</td>';

            foreach ($icons as $cells) {
                $rows .= '<td style="' . self::CELL . 'text-align:center">'
                    . '<span style="display:inline-flex;width:1.25rem;height:1.25rem;vertical-align:middle">' . $cells[$index] . '</span></td>';
            }

            $rows .= '</tr>';
        }

        return Styles::render()
            . '<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:0.875rem;line-height:1.25rem">'
            . '<thead><tr><th style="' . self::CELL . '"></th>' . $headers . '</tr></thead>'
            . '<tbody>' . $rows . '</tbody></table>';
    }

    /**
     * Icon markup of every sample entry in one theme.
     *
     * @return list<string>
     */
    private static function icons(IconTheme $theme): array
    {
        $resolver = new IconResolver($theme);
        $renderer = new IconRenderer($theme, 'inline');

        $icons = [];
        foreach (self::SAMPLES as [$name, $directory, $isFolder, $mime]) {
            $resolved = $isFolder ? $resolver->forFolder($name, $directory) : $resolver->forFile($name, $directory, $mime);
            $icons[] = $resolved === null ? self::panelFolderIcon() : $renderer->html($resolved)->toHtml();
        }

        return $icons;
    }

    /**
     * The panel's own folder icon (folder theme "none" keeps it in the file manager).
     */
    private static function panelFolderIcon(): string
    {
        try {
            return generate_icon_html('tabler-folder', size: IconSize::Medium)?->toHtml() ?? '';
        } catch (Throwable) {
            return '';
        }
    }
}
