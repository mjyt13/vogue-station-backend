/** Magic-byte sniffing: never trust the declared extension/mime alone. */
export function sniffImageMime(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer.subarray(0, 8).equals(PNG_MAGIC)) return 'image/png';
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export const MAX_PATTERN_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_PATTERN_DIMENSION = 4096; // px
export const THUMBNAIL_SIZE = 256; // px
export const MAX_LOOK_PREVIEW_BYTES = 5 * 1024 * 1024; // 5 MB
