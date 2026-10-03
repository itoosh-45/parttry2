export async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("imageError"))),
      "image/jpeg",
      0.86,
    ),
  );
}
export async function upload(blob: Blob) {
  const r = await fetch("/api/images", {
    method: "POST",
    body: blob,
    headers: { "Content-Type": blob.type },
  });
  if (!r.ok) throw new Error("imageError");
  return ((await r.json()) as { url: string }).url;
}
type Worker = {
  recognize: (image: Blob) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<void>;
};
declare global {
  interface Window {
    Tesseract?: { createWorker: (languages: string) => Promise<Worker> };
  }
}
let loading: Promise<void> | null = null;
export async function recognize(image: Blob) {
  if (!window.Tesseract) {
    loading ??= new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.min.js";
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null;
        reject(new Error("ocrFailed"));
      };
      document.head.appendChild(script);
    });
    await loading;
  }
  const worker = await window.Tesseract!.createWorker("heb+eng");
  try {
    return (await worker.recognize(image)).data.text;
  } finally {
    await worker.terminate();
  }
}
