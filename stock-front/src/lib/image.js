import { t } from "../i18n/index.js";
/**
 * Redimensionne une image et la renvoie en data URL (garde le stockage local léger).
 * JPEG par défaut ; PNG pour conserver la transparence (logos).
 */
export function fileToDataUrl(file, maxSize = 480, quality = 0.82, type = "image/jpeg") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(t("Lecture du fichier impossible.")));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error(t("Image invalide.")));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        if (type === "image/jpeg") {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(type, quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
