<?php

namespace LaGameTV\FileIcons\Icons;

final readonly class ResolvedIcon
{
    /**
     * @param  string  $icon  shipped icon id (dark theme / default)
     * @param  ?string  $lightIcon  icon to show in light mode, null => same as $icon
     * @param  string  $source  'fileName' | 'fileExtension' | 'languageId' | 'mimeType' | 'default' | 'folderName' | 'folderDefault'
     */
    public function __construct(
        public string $icon,
        public ?string $lightIcon,
        public string $source,
    ) {}
}
