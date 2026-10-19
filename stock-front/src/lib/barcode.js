// Lecture de codes-barres par la caméra.
// Lecteur natif du navigateur quand il existe (Chrome, Android), sinon zxing (WebAssembly) embarqué
// dans l'application : fonctionne hors ligne et sur iPhone.

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "code_93", "itf", "codabar", "qr_code", "data_matrix"];

let detectorPromise = null;

async function createDetector() {
  if (typeof window !== "undefined" && "BarcodeDetector" in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter((f) => supported.includes(f));
      if (formats.length) return new window.BarcodeDetector({ formats });
    } catch {
      // lecteur natif indisponible : on passe à zxing
    }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  // Le module WebAssembly est servi par l'application (et mis en cache pour le hors ligne), pas par un CDN
  prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) } });
  return new BarcodeDetector({ formats: FORMATS });
}

/** Détecteur partagé (créé une seule fois). */
export function getBarcodeDetector() {
  detectorPromise ??= createDetector().catch((error) => {
    detectorPromise = null;
    throw error;
  });
  return detectorPromise;
}

/** Signal sonore et vibration à chaque lecture réussie. */
export function scanFeedback() {
  try {
    navigator.vibrate?.(60);
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1450;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
    osc.onended = () => ctx.close();
  } catch {
    // son indisponible
  }
}

/** Produit correspondant exactement à un code (code-barres ou référence). */
export function findByCode(products, code) {
  const value = String(code || "").trim().toLowerCase();
  if (!value) return null;
  return products.find((p) => (p.barcode || "").toLowerCase() === value) || products.find((p) => (p.sku || "").toLowerCase() === value) || null;
}
