import { PHOTO_JPEG_QUALITY, PHOTO_MAX_EDGE, scaledSize } from "./image.ts";

export async function downscalePhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = scaledSize(bitmap.width, bitmap.height, PHOTO_MAX_EDGE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, size.width, size.height);
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((value) => resolve(value), "image/jpeg", PHOTO_JPEG_QUALITY);
    });
    if (!blob) return file;
    return new File([blob], "hoja.jpg", { type: "image/jpeg" });
  } finally {
    bitmap.close();
  }
}
