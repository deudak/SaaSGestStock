import { FaCompass } from "react-icons/fa";
import Button from "../components/ui/Button";
import { useAuth } from "../store/StoreContext";
import { homePathFor } from "../routes/paths";

export default function NotFound() {
  const { user } = useAuth();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
        <FaCompass size={22} />
      </div>
      <p className="text-sm font-semibold text-brand-600">Erreur 404</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Page introuvable</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">L'adresse demandée n'existe pas ou a été déplacée.</p>
      <Button to={homePathFor(user)} className="mt-6">
        Retour à l'accueil
      </Button>
    </div>
  );
}
