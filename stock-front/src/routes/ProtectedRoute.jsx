import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../store/StoreContext";
import { homePathFor } from "./paths";

/** Exige une session active et, si précisé, un rôle donné. */
export default function ProtectedRoute({ role }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to={homePathFor(user)} replace />;
  }

  return <Outlet />;
}
