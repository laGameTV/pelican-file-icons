<?php

namespace LaGameTV\FileIcons\Icons;

/**
 * Fallback icons by MIME type (Wings sniffs the content), used only when the name based
 * resolution ended at the default file icon. text/plain and application/octet-stream are
 * deliberately never mapped.
 */
final class MimeTypeIcons
{
    /**
     * Exact MIME types => icon per theme.
     *
     * @var array<string, array<string, string>>
     */
    private const array EXACT = [
        Themes::MATERIAL => [
            'text/x-shellscript' => 'console',
            'text/x-python' => 'python',
            'text/x-perl' => 'perl',
            'text/x-php' => 'php',
            'text/javascript' => 'javascript',
            'application/javascript' => 'javascript',
            'text/x-lua' => 'lua',
            'text/x-ruby' => 'ruby',
            'text/x-tcl' => 'tcl',
            'application/json' => 'json',
            'application/x-ndjson' => 'json',
            'text/xml' => 'xml',
            'application/xml' => 'xml',
            'text/html' => 'html',
            'image/svg+xml' => 'svg',
            'text/csv' => 'table',
            'text/tab-separated-values' => 'table',
            'application/zip' => 'zip',
            'application/gzip' => 'zip',
            'application/x-gzip' => 'zip',
            'application/x-tar' => 'zip',
            'application/x-7z-compressed' => 'zip',
            'application/x-xz' => 'zip',
            'application/x-bzip2' => 'zip',
            'application/x-rar-compressed' => 'zip',
            'application/vnd.rar' => 'zip',
            'application/zstd' => 'zip',
            'application/java-archive' => 'jar',
            'application/x-executable' => 'exe',
            'application/x-elf' => 'exe',
            'application/x-mach-binary' => 'exe',
            'application/vnd.microsoft.portable-executable' => 'exe',
            'application/x-msdownload' => 'exe',
            'application/x-sharedlib' => 'dll',
            'application/pdf' => 'pdf',
            'application/x-sqlite3' => 'database',
            'application/vnd.sqlite3' => 'database',
        ],
        Themes::DATAPACK => [
            'text/x-shellscript' => 'shell_file',
            'text/x-python' => 'python_file',
            'text/x-perl' => 'perl_file',
            'text/x-php' => 'php_file',
            'text/javascript' => 'javascript_file',
            'application/javascript' => 'javascript_file',
            'text/x-lua' => 'lua_file',
            'text/x-ruby' => 'ruby_file',
            'application/json' => 'json_file',
            'application/x-ndjson' => 'json_file',
            'text/xml' => 'xml_file',
            'application/xml' => 'xml_file',
            'text/html' => 'html_file',
            'image/svg+xml' => 'image_file',
            'text/csv' => 'excel_file',
            'text/tab-separated-values' => 'excel_file',
            'application/zip' => 'archive_file',
            'application/gzip' => 'archive_file',
            'application/x-gzip' => 'archive_file',
            'application/x-tar' => 'archive_file',
            'application/x-7z-compressed' => 'archive_file',
            'application/x-xz' => 'archive_file',
            'application/x-bzip2' => 'archive_file',
            'application/x-rar-compressed' => 'archive_file',
            'application/vnd.rar' => 'archive_file',
            'application/zstd' => 'archive_file',
            'application/java-archive' => 'jar_file',
            'application/x-executable' => 'executable_file',
            'application/x-elf' => 'executable_file',
            'application/x-mach-binary' => 'executable_file',
            'application/vnd.microsoft.portable-executable' => 'executable_file',
            'application/x-msdownload' => 'executable_file',
            'application/x-sharedlib' => 'binary_file',
            'application/pdf' => 'pdf_file',
            'application/x-sqlite3' => 'database_file',
            'application/vnd.sqlite3' => 'database_file',
        ],
    ];

    /**
     * Top-level type => icon per theme.
     *
     * @var array<string, array<string, string>>
     */
    private const array WILDCARD = [
        Themes::MATERIAL => [
            'image' => 'image',
            'audio' => 'audio',
            'video' => 'video',
            'font' => 'font',
        ],
        Themes::DATAPACK => [
            'image' => 'image_file',
            'audio' => 'audio_file',
            'video' => 'video_file',
            'font' => 'font_file',
        ],
    ];

    public static function iconFor(string $mimeType, string $theme = Themes::MATERIAL): ?string
    {
        $mime = strtolower(trim(explode(';', $mimeType, 2)[0]));

        if ($mime === '') {
            return null;
        }

        if (isset(self::EXACT[$theme][$mime])) {
            return self::EXACT[$theme][$mime];
        }

        $slash = strpos($mime, '/');
        if ($slash === false || $slash === 0 || $slash === strlen($mime) - 1) {
            return null;
        }

        return self::WILDCARD[$theme][substr($mime, 0, $slash)] ?? null;
    }
}
