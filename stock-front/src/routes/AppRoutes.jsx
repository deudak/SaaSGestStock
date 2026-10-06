import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { homePathFor } from "./paths";
import AppShell from "../components/layout/AppShell";
import { adminMenu, adminMobileNav, sellerMenu, sellerMobileNav } from "./menus";
import { useAuth } from "../store/StoreContext";

const Login = lazy(() => import("../pages/auth/Login"));
const Register = lazy(() => import("../pages/auth/Register"));
const NotFound = lazy(() => import("../pages/NotFound"));

const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"));
const AdminAnalytics = lazy(() => import("../pages/admin/Analytics"));
const AdminProducts = lazy(() => import("../pages/admin/Products"));
const AdminPurchases = lazy(() => import("../pages/admin/Purchases"));
const AdminSuppliers = lazy(() => import("../pages/admin/Suppliers"));
const AdminVendors = lazy(() => import("../pages/admin/Vendors"));
const AdminMaintenance = lazy(() => import("../pages/admin/Maintenance"));
const AdminSettings = lazy(() => import("../pages/admin/Settings"));

const SellerDashboard = lazy(() => import("../pages/seller/Dashboard"));
const SellerPOS = lazy(() => import("../pages/seller/POS"));
const SellerMaintenance = lazy(() => import("../pages/seller/Maintenance"));

const Sales = lazy(() => import("../pages/shared/Sales"));
const Customers = lazy(() => import("../pages/shared/Customers"));
const Installments = lazy(() => import("../pages/shared/Installments"));
const Profile = lazy(() => import("../pages/shared/Profile"));

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={homePathFor(user)} replace />;
}

function GuestOnly({ children }) {
  const { user } = useAuth();
  return user ? <Navigate to={homePathFor(user)} replace /> : children;
}

function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-brand-600" />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<FullPageLoader />}>
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

          <Route element={<ProtectedRoute role="admin" />}>
            <Route path="/admin" element={<AppShell menu={adminMenu} mobileNav={adminMobileNav} spaceLabel="Espace administrateur" base="/admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="purchases" element={<AdminPurchases />} />
              <Route path="suppliers" element={<AdminSuppliers />} />
              <Route path="sales" element={<Sales />} />
              <Route path="installments" element={<Installments />} />
              <Route path="customers" element={<Customers />} />
              <Route path="vendors" element={<AdminVendors />} />
              <Route path="maintenance" element={<AdminMaintenance />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="seller" />}>
            <Route path="/seller" element={<AppShell menu={sellerMenu} mobileNav={sellerMobileNav} spaceLabel="Espace vendeur" base="/seller" />}>
              <Route index element={<SellerDashboard />} />
              <Route path="pos" element={<SellerPOS />} />
              <Route path="sales" element={<Sales />} />
              <Route path="customers" element={<Customers />} />
              <Route path="installments" element={<Installments />} />
              <Route path="maintenance" element={<SellerMaintenance />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
