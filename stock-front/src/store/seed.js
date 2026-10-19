// Structure des données locales d'une entreprise et valeurs par défaut.
// Les données réelles viennent du serveur (GET /api/bootstrap) puis vivent sur l'appareil.

export const STORE_VERSION = 2;

let idCounter = 0;
export function uid(prefix = "id") {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export const PAYMENT_METHODS = [
  { id: "cash", label: "Espèces" },
  { id: "mobile", label: "Mobile Money" },
  { id: "card", label: "Carte" },
  { id: "transfer", label: "Virement" },
];

/** Paramètres par défaut d'une entreprise (identiques à Company::DEFAULT_SETTINGS côté API). */
export const DEFAULT_SETTINGS = {
  shopName: "",
  tagline: "",
  logo: "",
  brandColor: "#2554eb",
  address: "",
  phone: "",
  email: "",
  taxId: "",
  currency: "F",
  taxRate: 0,
  defaultAlertThreshold: 5,
  maxDiscountPercent: 10,
  invoiceFooter: "Merci pour votre confiance.",
  emailNotifications: true,
  allowSellerCredit: true,
  // Comptabilité : date d'ouverture des comptes et soldes à cette date
  accountingStart: "",
  openingCash: 0,
  openingBank: 0,
  openingMobile: 0,
  openingPayables: 0,
};

/** Données d'une entreprise qui démarre (ou d'un appareil hors ligne sans données). */
export function createEmptyState() {
  return {
    version: STORE_VERSION,
    users: [],
    categories: ["Autre"],
    suppliers: [],
    products: [],
    customers: [],
    sales: [],
    installments: [],
    stockMovements: [],
    purchaseOrders: [],
    maintenanceTasks: [],
    maintenanceHistory: [],
    techSheets: [],
    // Comptabilité (administrateur) : dépenses, règlements fournisseurs, écritures manuelles
    expenses: [],
    supplierPayments: [],
    journalEntries: [],
    // Caisse journalière : sessions de caisse des vendeurs
    cashSessions: [],
    // Synchronisation : modifications en attente d'envoi, position dans le journal du serveur,
    // et code de l'appareil utilisé dans les numéros (V-K7Q-0001)
    outbox: [],
    syncCursor: null,
    deviceCode: "",
  };
}
