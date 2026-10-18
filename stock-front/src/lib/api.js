// Client HTTP minimal pour l'API Laravel (stock-api).

export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

/**
 * Appelle l'API et ne lève jamais d'exception :
 * { ok, status, data, error, network } — network = true si le serveur est injoignable.
 */
export async function apiRequest(method, path, { body, token, timeout = 15000 } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    return { ok: false, status: 0, data: null, network: true, error: "Serveur injoignable. Vérifiez votre connexion internet." };
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    // réponse vide
  }

  if (response.ok) return { ok: true, status: response.status, data, network: false, error: null };

  // Laravel : { message, errors: { champ: [..] } } — on remonte la première erreur de champ
  const fieldError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
  const fallback = response.status === 429 ? "Trop de tentatives, réessayez dans une minute." : "Une erreur est survenue.";
  return { ok: false, status: response.status, data, network: false, error: fieldError || data?.message || fallback };
}
