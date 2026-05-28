export function thumbnailPathForVideoPath(storagePath: string) {
  const parts = storagePath.split("/");
  const file = parts.pop() || "video.mp4";
  const base = file.replace(/\.[^.]+$/, "") || "video";
  return [...parts, "thumbs", `${base}.jpg`].filter(Boolean).join("/");
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Não foi possível gerar o preview do vídeo."))),
      "image/jpeg",
      quality,
    );
  });
}

export async function createVideoThumbnailBlob(file: File | Blob): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const v = document.createElement("video");
      let done = false;
      const finish = () => {
        if (!done) {
          done = true;
          resolve(v);
        }
      };
      v.preload = "auto";
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      v.onloadedmetadata = () => {
        const target = Math.min(1, Math.max(0, Number.isFinite(v.duration) ? v.duration * 0.1 : 0));
        if (target > 0) v.currentTime = target;
        else finish();
      };
      v.onseeked = finish;
      v.onerror = () => reject(new Error("Não foi possível gerar o preview do vídeo."));
    });
    for (const maxSide of [320, 240, 160]) {
      const scale = Math.min(1, maxSide / Math.max(video.videoWidth || maxSide, video.videoHeight || maxSide));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round((video.videoWidth || maxSide) * scale));
      canvas.height = Math.max(1, Math.round((video.videoHeight || maxSide) * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Não foi possível gerar o preview do vídeo.");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.78, 0.62, 0.48, 0.34, 0.24]) {
        const blob = await canvasToJpegBlob(canvas, quality);
        if (blob.size <= 20 * 1024 || (maxSide === 160 && quality === 0.24)) return blob;
      }
    }
    throw new Error("Não foi possível gerar o preview do vídeo.");
  } finally {
    URL.revokeObjectURL(url);
  }
}