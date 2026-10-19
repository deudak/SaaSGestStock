import AppRoutes from "./routes/AppRoutes";
import { useLanguage } from "./i18n/index.js";

function App() {
  // Changer de langue réaffiche toute l'interface dans la nouvelle langue
  const { language } = useLanguage();
  return <AppRoutes key={language} />;
}

export default App;
