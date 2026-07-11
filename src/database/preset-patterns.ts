/**
 * Official pattern catalog (files live in assets/patterns/, committed).
 * Shared by storage:bootstrap (uploads bytes + thumbnails) and db:seed (rows).
 */
export const PRESET_PATTERNS = [
  {
    id: '00000000-0000-4000-8000-00000000d001',
    name: 'Stripes',
    file: 'stripes.png',
  },
  {
    id: '00000000-0000-4000-8000-00000000d002',
    name: 'Dots',
    file: 'dots.png',
  },
  {
    id: '00000000-0000-4000-8000-00000000d003',
    name: 'Checks',
    file: 'checks.png',
  },
  {
    id: '00000000-0000-4000-8000-00000000d004',
    name: 'Grid',
    file: 'grid.png',
  },
].map((preset) => ({
  ...preset,
  localPath: `assets/patterns/${preset.file}`,
  objectKey: `patterns/presets/${preset.file}`,
  thumbnailKey: `thumbnails/patterns/${preset.id}.webp`,
}));
