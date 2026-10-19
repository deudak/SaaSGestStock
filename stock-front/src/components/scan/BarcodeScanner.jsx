import { useEffect, useRef, useState } from "react";
import { FaBarcode, FaCamera, FaExclamationTriangle } from "react-icons/fa";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import { getBarcodeDetector, scanFeedback } from "../../lib/barcode";
import { t } from "../../i18n/index.js";

/**
 * Lecteur de codes-barres par la caméra (caméra arrière sur téléphone).
 * continuous : reste ouvert pour enchaîner les articles (point de vente) ; sinon se ferme à la première lecture.
 */
export default function BarcodeScanner({ isOpen, onClose, onDetected, continuous = false, title }) {
  const videoRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | scanning | error
  const [error, setError] = useState("");
  const [last, setLast] = useState("");
  const callback = useRef(onDetected);
  const closeRef = useRef(onClose);

  useEffect(() => {
    callback.current = onDetected;
    closeRef.current = onClose;
  }, [onDetected, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let stream = null;
    let timer = null;
    let stopped = false;
    let lastCode = "";
    let lastTime = 0;

    (async () => {
      setStatus("starting");
      setError("");
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("unsupported");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = await getBarcodeDetector();
        if (stopped) return;
        setStatus("scanning");

        const tick = async () => {
          if (stopped) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const code = codes[0]?.rawValue?.trim();
              const now = Date.now();
              // Même code relu tout de suite : ignoré (évite les doublons quand l'article reste devant la caméra)
              if (code && (code !== lastCode || now - lastTime > 1800)) {
                lastCode = code;
                lastTime = now;
                scanFeedback();
                setLast(code);
                callback.current(code);
                if (!continuous) {
                  stopped = true;
                  closeRef.current();
                  return;
                }
              }
            }
          } catch {
            // image illisible : on réessaie
          }
          timer = setTimeout(tick, 180);
        };
        tick();
      } catch (e) {
        setStatus("error");
        setError(
          e?.name === "NotAllowedError"
            ? t("Accès à la caméra refusé. Autorisez la caméra dans les réglages du navigateur.")
            : e?.message === "unsupported" || e?.name === "NotFoundError"
              ? t("Aucune caméra disponible sur cet appareil. Utilisez une douchette ou saisissez le code.")
              : t("Impossible de démarrer la caméra.")
        );
      }
    })();

    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [isOpen, continuous]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title || t("Scanner un code-barres")} description={continuous ? t("Présentez les articles un par un devant la caméra.") : undefined}>
      <div className="space-y-3">
        <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-950">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          {status === "scanning" && (
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-x-2 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-rose-500" />
            </div>
          )}
          {status === "starting" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-sm text-white/80">
              <FaCamera size={22} />
              {t("Démarrage de la caméra…")}
            </div>
          )}
          {status === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-6 text-center text-sm text-white">
              <FaExclamationTriangle size={22} className="text-amber-400" />
              {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="flex min-w-0 items-center gap-2 text-sm text-slate-500">
            <FaBarcode className="shrink-0" />
            <span className="truncate">{last ? t("Dernier code lu : {0}", [last]) : t("En attente d'un code…")}</span>
          </p>
          <Button variant="secondary" onClick={onClose}>
            {continuous ? t("Terminer") : t("Fermer")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
