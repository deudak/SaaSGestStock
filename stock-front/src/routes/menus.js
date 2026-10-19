import {
  FaHome,
  FaChartPie,
  FaBoxes,
  FaTruck,
  FaClipboardList,
  FaReceipt,
  FaUsers,
  FaUserTie,
  FaTools,
  FaCog,
  FaCashRegister,
  FaCreditCard,
  FaUser,
  FaEllipsisH,
  FaWallet,
  FaBalanceScale,
  FaFileInvoiceDollar,
  FaBook,
  FaListOl,
  FaChartLine,
  FaSlidersH,
  FaClipboardCheck,
  FaHistory,
  FaFileAlt,
} from "react-icons/fa";

export const adminMenu = [
  {
    title: "Pilotage",
    items: [
      { path: "/admin", label: "Tableau de bord", icon: FaHome, end: true },
      { path: "/admin/analytics", label: "Statistiques", icon: FaChartPie },
    ],
  },
  {
    title: "Stock",
    items: [
      { path: "/admin/products", label: "Produits & stock", icon: FaBoxes },
      { path: "/admin/purchases", label: "Approvisionnements", icon: FaClipboardList },
      { path: "/admin/suppliers", label: "Fournisseurs", icon: FaTruck },
    ],
  },
  {
    title: "Ventes",
    items: [
      { path: "/admin/sales", label: "Ventes", icon: FaReceipt },
      { path: "/admin/cash", label: "Caisses", icon: FaCashRegister },
      { path: "/admin/installments", label: "Créances", icon: FaCreditCard },
      { path: "/admin/customers", label: "Clients", icon: FaUsers },
    ],
  },
  {
    title: "Comptabilité",
    items: [
      { path: "/admin/accounting", label: "Synthèse", icon: FaBalanceScale, end: true },
      { path: "/admin/accounting/expenses", label: "Dépenses & fournisseurs", icon: FaFileInvoiceDollar },
      { path: "/admin/accounting/journal", label: "Journal", icon: FaBook },
      { path: "/admin/accounting/ledger", label: "Grand livre & balance", icon: FaListOl },
      { path: "/admin/accounting/statements", label: "États financiers", icon: FaChartLine },
      { path: "/admin/accounting/settings", label: "Paramètres comptables", icon: FaSlidersH },
    ],
  },
  {
    title: "Organisation",
    items: [
      { path: "/admin/vendors", label: "Équipe", icon: FaUserTie },
      { path: "/admin/maintenance", label: "Maintenance", icon: FaTools },
      { path: "/admin/settings", label: "Paramètres", icon: FaCog },
    ],
  },
];

export const adminMobileNav = [
  { path: "/admin", label: "Accueil", icon: FaHome, end: true },
  { path: "/admin/products", label: "Stock", icon: FaBoxes },
  { path: "/admin/sales", label: "Ventes", icon: FaReceipt },
  { path: "/admin/installments", label: "Créances", icon: FaCreditCard },
  { label: "Plus", icon: FaEllipsisH, openMenu: true },
];

export const sellerMenu = [
  {
    title: "Mon activité",
    items: [
      { path: "/seller", label: "Tableau de bord", icon: FaHome, end: true },
      { path: "/seller/pos", label: "Point de vente", icon: FaCashRegister },
      { path: "/seller/cash", label: "Ma caisse", icon: FaWallet },
      { path: "/seller/sales", label: "Mes ventes", icon: FaReceipt },
    ],
  },
  {
    title: "Clientèle",
    items: [
      { path: "/seller/customers", label: "Clients", icon: FaUsers },
      { path: "/seller/installments", label: "Paiements échelonnés", icon: FaCreditCard },
    ],
  },
  {
    title: "Compte",
    items: [
      { path: "/seller/maintenance", label: "Signalements", icon: FaTools },
      { path: "/seller/profile", label: "Mon profil", icon: FaUser },
    ],
  },
];

export const sellerMobileNav = [
  { path: "/seller", label: "Accueil", icon: FaHome, end: true },
  { path: "/seller/pos", label: "Vendre", icon: FaCashRegister, highlight: true },
  { path: "/seller/sales", label: "Ventes", icon: FaReceipt },
  { path: "/seller/customers", label: "Clients", icon: FaUsers },
  { label: "Plus", icon: FaEllipsisH, openMenu: true },
];

export const technicianMenu = [
  {
    title: "Interventions",
    items: [
      { path: "/technician", label: "Mes interventions", icon: FaClipboardCheck, end: true },
      { path: "/technician/history", label: "Historique", icon: FaHistory },
      { path: "/technician/equipment", label: "Équipements", icon: FaFileAlt },
    ],
  },
  {
    title: "Compte",
    items: [{ path: "/technician/profile", label: "Mon profil", icon: FaUser }],
  },
];

export const technicianMobileNav = [
  { path: "/technician", label: "Interventions", icon: FaClipboardCheck, end: true },
  { path: "/technician/history", label: "Historique", icon: FaHistory },
  { path: "/technician/equipment", label: "Équipements", icon: FaFileAlt },
  { path: "/technician/profile", label: "Profil", icon: FaUser },
];

export const accountantMenu = [
  {
    title: "Comptabilité",
    items: [
      { path: "/accountant", label: "Synthèse", icon: FaBalanceScale, end: true },
      { path: "/accountant/expenses", label: "Dépenses & fournisseurs", icon: FaFileInvoiceDollar },
      { path: "/accountant/journal", label: "Journal", icon: FaBook },
      { path: "/accountant/ledger", label: "Grand livre & balance", icon: FaListOl },
      { path: "/accountant/statements", label: "États financiers", icon: FaChartLine },
    ],
  },
  {
    title: "Compte",
    items: [
      { path: "/accountant/settings", label: "Paramètres comptables", icon: FaSlidersH },
      { path: "/accountant/profile", label: "Mon profil", icon: FaUser },
    ],
  },
];

export const accountantMobileNav = [
  { path: "/accountant", label: "Synthèse", icon: FaBalanceScale, end: true },
  { path: "/accountant/expenses", label: "Dépenses", icon: FaFileInvoiceDollar },
  { path: "/accountant/journal", label: "Journal", icon: FaBook },
  { path: "/accountant/statements", label: "États", icon: FaChartLine },
  { label: "Plus", icon: FaEllipsisH, openMenu: true },
];

export const extraTitles = {
  "/admin/profile": "Mon profil",
};
