const HOME_BY_ROLE = { admin: "/admin", seller: "/seller", technician: "/technician", accountant: "/accountant" };

/** Page d'accueil selon le rôle de l'utilisateur connecté. */
export function homePathFor(user) {
  if (!user) return "/login";
  return HOME_BY_ROLE[user.role] || "/seller";
}
