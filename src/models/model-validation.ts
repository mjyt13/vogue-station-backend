/** Magic-byte sniffing for the .glb binary container: never trust the extension alone. */
export function sniffGlb(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 && buffer.subarray(0, 4).toString('ascii') === 'glTF'
  );
}

export const MAX_GLB_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_MODEL_THUMBNAIL_BYTES = 5 * 1024 * 1024; // 5 MB
