/** Page d'accueil selon le rôle de l'utilisateur connecté. */
export function homePathFor(user) {
  if (!user) return "/login";
  return user.role === "admin" ? "/admin" : "/seller";
}
