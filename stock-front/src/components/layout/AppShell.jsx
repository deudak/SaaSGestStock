import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { FaBars, FaBell, FaCashRegister, FaChevronDown, FaSignOutAlt, FaTimes, FaUser, FaCog, FaCheckCircle } from "react-icons/fa";
import BrandLogo from "../ui/BrandLogo";
import { useBranding } from "../../lib/branding";
import { useStore } from "../../store/StoreContext";
import { Avatar } from "../ui/Badge";
import useClickOutside from "../../lib/useClickOutside";
import useNotifications from "./useNotifications";
import { extraTitles } from "../../routes/menus";
import { useConnectivity } from "../../store/ConnectivityContext";
import { ROLE_LABELS } from "../../store/selectors";
import { ConnectivityBadge, OfflineBanner, OfflineLock } from "./OfflineStatus";
import { LanguageSwitch, ThemeSwitch } from "./Preferences";
import { useTheme } from "../../lib/theme";

import { locale, t } from "../../i18n/index.js";

const toneDot = {
  red: "bg-rose-50 text-rose-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  blue: "bg-brand-50 text-brand-600",
};

function Sidebar({ menu, spaceLabel, isOpen, onClose, onLogout }) {
  const { state } = useStore();

  return (
    <>
      {isOpen && <div className="fixed inset-0 z-40 animate-fade-in bg-slate-950/60 backdrop-blur-[1px] lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col bg-ink-900 text-slate-300 transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
          isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
        aria-label={t("Navigation principale")}
      >
        <div className="flex h-16 items-center justify-between gap-3 px-5">
          <Link to="/" className="flex min-w-0 items-center gap-3" onClick={onClose}>
            <BrandLogo settings={state.settings} />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-tight text-white">{state.settings.shopName}</p>
              <p className="truncate text-[11px] font-medium text-slate-500">{spaceLabel}</p>
            </div>
          </Link>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white lg:hidden" aria-label={t("Fermer le menu")}>
            <FaTimes size={14} />
          </button>
        </div>

        <nav className="scrollbar-dark flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {menu.map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">{t(section.title)}</p>
              <div className="space-y-0.5">
                {section.items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end={item.end}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                        isActive ? "bg-white/[0.07] text-white" : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand-500" />}
                        <item.icon size={15} className={isActive ? "text-brand-400" : "text-slate-500 group-hover:text-slate-300"} aria-hidden="true" />
                        <span className="truncate">{t(item.label)}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <FaSignOutAlt size={15} aria-hidden="true" />{t("Déconnexion")}</button>
        </div>
      </aside>
    </>
  );
}

function NotificationsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const notifications = useNotifications();
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        aria-label={t("Notifications ({0})", [notifications.length])}
        aria-expanded={open}
      >
        <FaBell size={16} />
        {notifications.length > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white ring-2 ring-white">
            {notifications.length > 9 ? "9+" : notifications.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] animate-pop-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-semibold text-slate-900">{t("Notifications")}</p>
            <span className="text-xs text-slate-500">{notifications.length}{" "}{t("alerte")}{notifications.length > 1 ? "s" : ""}</span>
          </div>
          <div className="scrollbar-thin max-h-[60vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <FaCheckCircle className="text-emerald-500" size={22} />
                <p className="text-sm font-medium text-slate-700">{t("Tout est en ordre")}</p>
                <p className="text-xs text-slate-500">{t("Aucune alerte de stock, de paiement ou de maintenance.")}</p>
              </div>
            ) : (
              notifications.map((item) => (
                <Link key={item.id} to={item.to} onClick={close} className="flex gap-3 border-b border-slate-50 px-4 py-3 transition last:border-0 hover:bg-slate-50">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toneDot[item.tone]}`}>
                    <item.icon size={13} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold text-slate-800">{t(item.title)}</span>
                    <span className="block truncate text-xs text-slate-500">{t(item.detail)}</span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function UserMenu({ user, base, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2.5 rounded-xl py-1 pl-1 pr-2 transition hover:bg-slate-100"
        aria-expanded={open}
      >
        <Avatar name={user.name} size="sm" />
        <span className="hidden text-left md:block">
          <span className="block max-w-[140px] truncate text-[13px] font-semibold leading-tight text-slate-800">{user.name}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{user.role === "admin" ? ROLE_LABELS.admin : user.shop || ROLE_LABELS[user.role]}</span>
        </span>
        <FaChevronDown size={10} className="hidden text-slate-400 md:block" />
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-60 animate-pop-in overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 shadow-pop">
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold text-slate-900">{user.name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <div className="my-1 h-px bg-slate-100" />
          <Link to={`${base}/profile`} onClick={close} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <FaUser size={12} className="text-slate-400" />{" "}{t("Mon profil")}</Link>
          {user.role === "admin" && (
            <Link to="/admin/settings" onClick={close} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <FaCog size={12} className="text-slate-400" />{" "}{t("Paramètres")}</Link>
          )}
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-rose-600 hover:bg-rose-50">
            <FaSignOutAlt size={12} />{" "}{t("Déconnexion")}</button>
        </div>
      )}
    </div>
  );
}

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
    </div>
  );
}

export default function AppShell({ menu, mobileNav, spaceLabel, base }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state, currentUser, actions, sync } = useStore();
  const { shopName } = state.settings;
  const { theme } = useTheme();
  useBranding(state.settings, theme);
  const location = useLocation();
  const navigate = useNavigate();
  const mainRef = useRef(null);
  const { expired } = useConnectivity();

  const allItems = menu.flatMap((section) => section.items);
  const activeItem =
    allItems.find((item) => item.path === location.pathname) ||
    allItems.filter((item) => !item.end && location.pathname.startsWith(item.path)).sort((a, b) => b.path.length - a.path.length)[0];
  const pageTitle = extraTitles[location.pathname] || activeItem?.label || "";

  useEffect(() => {
    document.title = pageTitle ? `${pageTitle} · ${shopName}` : shopName;
    window.scrollTo({ top: 0 });
  }, [pageTitle, location.pathname, shopName]);

  // Hors de l'espace connecté (page de connexion), on revient à la marque DYM Stock
  useEffect(() => () => {
    document.title = "DYM Stock";
  }, []);

  const handleLogout = () => {
    actions.logout();
    navigate("/login", { replace: true });
  };

  const isSeller = currentUser?.role === "seller";

  if (expired) return <OfflineLock onLogout={handleLogout} />;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar menu={menu} spaceLabel={spaceLabel} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} onLogout={handleLogout} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur-md">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="-ml-1 flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label={t("Ouvrir le menu")}
            >
              <FaBars size={16} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-semibold text-slate-900">{pageTitle}</p>
              <p className="hidden truncate text-xs text-slate-500 sm:block">
                {new Date().toLocaleDateString(locale(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>

            {isSeller && location.pathname !== "/seller/pos" && (
              <Link
                to="/seller/pos"
                className="hidden h-9 items-center gap-2 rounded-xl bg-brand-600 px-3.5 text-[13px] font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 sm:inline-flex"
              >
                <FaCashRegister size={13} />{" "}{t("Nouvelle vente")}</Link>
            )}
            <ConnectivityBadge sync={sync} />
            <div className="hidden items-center sm:flex">
              <LanguageSwitch />
              <ThemeSwitch />
            </div>
            <NotificationsMenu />
            {currentUser && <UserMenu user={currentUser} base={base} onLogout={handleLogout} />}
          </div>
          <OfflineBanner />
        </header>

        <main ref={mainRef} className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-10 lg:pt-7">
          <div className="mx-auto w-full max-w-7xl animate-fade-in" key={location.pathname}>
            <Suspense fallback={<PageLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden" aria-label={t("Navigation mobile")}>
        <div className="mx-auto flex max-w-lg items-stretch justify-around px-2">
          {mobileNav.map((item) =>
            item.openMenu ? (
              <button
                key="more"
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold text-slate-500"
              >
                <item.icon size={17} />
                {t(item.label)}
              </button>
            ) : (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.end}
                className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-semibold transition ${isActive ? "text-brand-600" : "text-slate-500"}`}
              >
                {({ isActive }) =>
                  item.highlight ? (
                    <>
                      <span className={`-mt-5 flex h-11 w-11 items-center justify-center rounded-2xl text-white shadow-lg ring-4 ring-white ${isActive ? "bg-brand-700" : "bg-brand-600"} shadow-brand-600/30`}>
                        <item.icon size={17} />
                      </span>
                      {t(item.label)}
                    </>
                  ) : (
                    <>
                      <item.icon size={17} />
                      {t(item.label)}
                    </>
                  )
                }
              </NavLink>
            )
          )}
        </div>
      </nav>
    </div>
  );
}
