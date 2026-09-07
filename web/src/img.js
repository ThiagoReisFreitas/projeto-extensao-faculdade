import imageCompression from 'browser-image-compression';

// Comprime NO CLIENT antes do upload: ~1600px, WebP ~72%.
// Foto crua de camera (4-8MB) -> ~80-200KB.
export async function comprimir(file) {
  return imageCompression(file, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.72,
    fileType: 'image/webp',
    useWebWorker: true,
  });
}
