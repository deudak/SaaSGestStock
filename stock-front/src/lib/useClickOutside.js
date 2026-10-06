import { useEffect } from "react";

/** Appelle handler lors d'un clic en dehors de l'élément référencé ou d'un appui sur Échap. */
export default function useClickOutside(ref, handler, active = true) {
  useEffect(() => {
    if (!active) return undefined;
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handler();
    };
    const onKey = (event) => {
      if (event.key === "Escape") handler();
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [ref, handler, active]);
}
