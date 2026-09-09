// Converts any uploaded image into a web-optimised file (WebP, resized) in the browser.
const MAX_DIMENSION = 2400;
const QUALITY = 0.85;

const loadImage = (file: File): Promise<HTMLImageElement | ImageBitmap> => {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Kunde inte läsa bildfilen"));
    };
    img.src = url;
  });
};

export interface OptimizedImage {
  blob: Blob;
  extension: string;
  contentType: string;
  width: number;
  height: number;
}

export const optimizeImage = async (file: File): Promise<OptimizedImage> => {
  const source = await loadImage(file);
  const srcWidth = "width" in source ? source.width : 0;
  const srcHeight = "height" in source ? source.height : 0;

  const scale = Math.min(1, MAX_DIMENSION / Math.max(srcWidth, srcHeight) || 1);
  const width = Math.max(1, Math.round(srcWidth * scale));
  const height = Math.max(1, Math.round(srcHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Kunde inte bearbeta bilden");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
  if ("close" in source) source.close();

  const encode = (type: string) =>
    new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

  let blob = await encode("image/webp");
  let contentType = "image/webp";
  let extension = "webp";

  if (!blob || blob.type !== "image/webp") {
    blob = await encode("image/jpeg");
    contentType = "image/jpeg";
    extension = "jpg";
  }

  if (!blob) throw new Error("Kunde inte konvertera bilden");

  return { blob, extension, contentType, width, height };
};
