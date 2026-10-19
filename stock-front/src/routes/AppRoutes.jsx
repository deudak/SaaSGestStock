import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import { homePathFor } from "./paths";
import AppShell from "../components/layout/AppShell";
import { accountantMenu, accountantMobileNav, adminMenu, adminMobileNav, sellerMenu, sellerMobileNav, technicianMenu, technicianMobileNav } from "./menus";
import { useAuth } from "../store/StoreContext";

import { t } from "../i18n/index.js";

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
const CashRegisters = lazy(() => import("../pages/admin/CashRegisters"));
const SellerCash = lazy(() => import("../pages/seller/Cash"));
const AccountingOverview = lazy(() => import("../pages/admin/accounting/Overview"));
const AccountingExpenses = lazy(() => import("../pages/admin/accounting/Expenses"));
const AccountingJournal = lazy(() => import("../pages/admin/accounting/Journal"));
const AccountingLedger = lazy(() => import("../pages/admin/accounting/Ledger"));
const AccountingStatements = lazy(() => import("../pages/admin/accounting/Statements"));
const AccountingSettings = lazy(() => import("../pages/admin/accounting/AccountingSettings"));

const SellerDashboard = lazy(() => import("../pages/seller/Dashboard"));
const SellerPOS = lazy(() => import("../pages/seller/POS"));
const SellerMaintenance = lazy(() => import("../pages/seller/Maintenance"));

const TechnicianInterventions = lazy(() => import("../pages/technician/Interventions"));
const TechnicianHistory = lazy(() => import("../pages/technician/History"));
const TechnicianEquipment = lazy(() => import("../pages/technician/Equipment"));

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
            <Route path="/admin" element={<AppShell menu={adminMenu} mobileNav={adminMobileNav} spaceLabel={t("Espace administrateur")} base="/admin" />}>
              <Route index element={<AdminDashboard />} />
              <Route path="analytics" element={<AdminAnalytics />} />
              <Route path="products" element={<AdminProducts />} />
              <Route path="purchases" element={<AdminPurchases />} />
              <Route path="suppliers" element={<AdminSuppliers />} />
              <Route path="sales" element={<Sales />} />
              <Route path="cash" element={<CashRegisters />} />
              <Route path="installments" element={<Installments />} />
              <Route path="customers" element={<Customers />} />
              <Route path="vendors" element={<AdminVendors />} />
              <Route path="maintenance" element={<AdminMaintenance />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="accounting" element={<AccountingOverview />} />
              <Route path="accounting/expenses" element={<AccountingExpenses />} />
              <Route path="accounting/journal" element={<AccountingJournal />} />
              <Route path="accounting/ledger" element={<AccountingLedger />} />
              <Route path="accounting/statements" element={<AccountingStatements />} />
              <Route path="accounting/settings" element={<AccountingSettings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="seller" />}>
            <Route path="/seller" element={<AppShell menu={sellerMenu} mobileNav={sellerMobileNav} spaceLabel={t("Espace vendeur")} base="/seller" />}>
              <Route index element={<SellerDashboard />} />
              <Route path="pos" element={<SellerPOS />} />
              <Route path="cash" element={<SellerCash />} />
              <Route path="sales" element={<Sales />} />
              <Route path="customers" element={<Customers />} />
              <Route path="installments" element={<Installments />} />
              <Route path="maintenance" element={<SellerMaintenance />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="accountant" />}>
            <Route path="/accountant" element={<AppShell menu={accountantMenu} mobileNav={accountantMobileNav} spaceLabel={t("Espace comptable")} base="/accountant" />}>
              <Route index element={<AccountingOverview />} />
              <Route path="expenses" element={<AccountingExpenses />} />
              <Route path="journal" element={<AccountingJournal />} />
              <Route path="ledger" element={<AccountingLedger />} />
              <Route path="statements" element={<AccountingStatements />} />
              <Route path="settings" element={<AccountingSettings />} />
              <Route path="profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute role="technician" />}>
            <Route path="/technician" element={<AppShell menu={technicianMenu} mobileNav={technicianMobileNav} spaceLabel={t("Espace maintenancier")} base="/technician" />}>
              <Route index element={<TechnicianInterventions />} />
              <Route path="history" element={<TechnicianHistory />} />
              <Route path="equipment" element={<TechnicianEquipment />} />
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
