// Données de démonstration. Générées une seule fois puis conservées dans le navigateur.
// Les ventes sont réparties sur les 75 derniers jours pour alimenter graphiques et indicateurs.

export const STORE_VERSION = 2;

let idCounter = 0;
export function uid(prefix = "id") {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// Générateur pseudo-aléatoire déterministe (mulberry32)
function createRandom(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const PAYMENT_METHODS = [
  { id: "cash", label: "Espèces" },
  { id: "mobile", label: "Mobile Money" },
  { id: "card", label: "Carte" },
  { id: "transfer", label: "Virement" },
];

export const DEFAULT_SETTINGS = {
  shopName: "DYM Stock",
  tagline: "Informatique & accessoires",
  address: "Bd de la Liberté, Akwa — Douala",
  phone: "+237 699 000 000",
  email: "contact@dymstock.cm",
  taxId: "M012345678901X",
  currency: "F",
  taxRate: 0,
  defaultAlertThreshold: 5,
  maxDiscountPercent: 10,
  invoiceFooter: "Merci pour votre confiance. Les marchandises vendues ne sont ni reprises ni échangées après 7 jours.",
  emailNotifications: true,
  allowSellerCredit: true,
};

export function createSeed() {
  const random = createRandom(20260702);
  const pick = (list) => list[Math.floor(random() * list.length)];
  const now = new Date();

  const users = [
    { id: "u_admin", name: "Admin DYM", email: "admin@dymstock.test", password: "Password123", phone: "699 000 000", role: "admin", shop: "Siège", status: "actif", createdAt: daysAgo(now, 200) },
    { id: "u_jean", name: "Jean Vendeur", email: "seller@dymstock.test", password: "Seller123", phone: "699 112 200", role: "seller", shop: "Boutique Akwa", status: "actif", createdAt: daysAgo(now, 180) },
    { id: "u_marie", name: "Marie Commerce", email: "marie@dymstock.test", password: "Seller123", phone: "677 440 011", role: "seller", shop: "Boutique Bonapriso", status: "actif", createdAt: daysAgo(now, 120) },
    { id: "u_pierre", name: "Pierre Boutique", email: "pierre@dymstock.test", password: "Seller123", phone: "690 330 022", role: "seller", shop: "Boutique Deido", status: "inactif", createdAt: daysAgo(now, 90) },
  ];

  const categories = ["Informatique", "Accessoires", "Impression", "Stockage", "Réseau", "Téléphonie"];

  const suppliers = [
    { id: "s_tech", name: "TechDistrib Cameroun", contact: "Sophie Diallo", phone: "675 12 34 56", email: "commandes@techdistrib.cm", category: "Informatique", address: "Zone industrielle Bassa, Douala", status: "Actif", rating: 5, delay: 3, notes: "Livraison sous 72 h, paiement à 30 jours." },
    { id: "s_acc", name: "Accessoires Pro", contact: "Pierre Ndao", phone: "671 98 76 54", email: "ventes@accpro.cm", category: "Accessoires", address: "Marché Central, Yaoundé", status: "Actif", rating: 4, delay: 5, notes: "" },
    { id: "s_print", name: "PrintOffice SARL", contact: "Jean Diop", phone: "686 55 44 22", email: "contact@printoffice.cm", category: "Impression", address: "Bonanjo, Douala", status: "Actif", rating: 3, delay: 10, notes: "Retards fréquents sur les cartouches." },
    { id: "s_net", name: "NetLink Afrique", contact: "Aminata Sow", phone: "694 10 20 30", email: "pro@netlink.africa", category: "Réseau", address: "Bastos, Yaoundé", status: "En attente", rating: 4, delay: 7, notes: "Nouveau fournisseur, premier contrat en cours." },
  ];

  const productDefs = [
    ["Ordinateur portable HP 250 G9", "Informatique", "s_tech", 285000, 260000, 225000, 9, 4],
    ["Ordinateur Dell Latitude 5420", "Informatique", "s_tech", 340000, 315000, 270000, 3, 3],
    ["Écran Samsung 24\" FHD", "Informatique", "s_tech", 95000, 85000, 68000, 14, 4],
    ["Clavier gamer RGB", "Accessoires", "s_acc", 15000, 12000, 8500, 25, 8],
    ["Souris sans fil Logitech", "Accessoires", "s_acc", 8000, 6500, 4200, 2, 6],
    ["Casque Bluetooth JBL", "Accessoires", "s_acc", 28000, 24000, 17000, 11, 5],
    ["Câble HDMI 2 m", "Accessoires", "s_acc", 5000, 4000, 1800, 48, 10],
    ["Imprimante Canon Pixma G3410", "Impression", "s_print", 95000, 85000, 72000, 0, 3],
    ["Cartouche encre HP 305", "Impression", "s_print", 12000, 10500, 7500, 18, 6],
    ["Clé USB 32 Go", "Stockage", "s_acc", 3500, 3000, 1600, 60, 10],
    ["Disque dur externe 1 To", "Stockage", "s_tech", 45000, 40000, 31000, 7, 4],
    ["Routeur Wi‑Fi TP-Link", "Réseau", "s_net", 22000, 19000, 13500, 4, 5],
    ["Smartphone Samsung A15", "Téléphonie", "s_tech", 120000, 110000, 92000, 6, 3],
    ["Chargeur rapide USB‑C", "Téléphonie", "s_acc", 6500, 5500, 3000, 35, 10],
  ];

  const products = productDefs.map(([name, category, supplierId, price, minPrice, cost, stock, alertThreshold], index) => ({
    id: `p_${index + 1}`,
    sku: `DYM-${String(index + 1).padStart(4, "0")}`,
    name,
    category,
    supplierId,
    price,
    minPrice,
    cost,
    stock,
    alertThreshold,
    image: "",
    description: "",
    createdAt: daysAgo(now, 150 - index),
  }));

  const customers = [
    ["Jean Paul Etoa", "699 112 233", "jpaul@email.com", "Douala"],
    ["Marie Claire Ngo", "677 445 566", "mclaire@email.com", "Yaoundé"],
    ["Fabrice Mbodj", "690 887 766", "fmbodj@email.com", "Douala"],
    ["Pauline Ngo Bassa", "655 443 322", "pngo@email.com", "Bafoussam"],
    ["Robert Tchinda", "676 554 433", "rtchinda@email.com", "Douala"],
    ["Aïcha Moussa", "691 223 344", "amoussa@email.com", "Maroua"],
    ["Moussa Fall", "682 778 899", "mfall@email.com", "Garoua"],
    ["Ndeye Sarr", "698 334 455", "nsarr@email.com", "Kribi"],
    ["Cabinet Ekambi & Associés", "233 42 18 90", "compta@ekambi.cm", "Douala"],
  ].map(([name, phone, email, city], index) => ({
    id: `c_${index + 1}`,
    name,
    phone,
    email,
    city,
    notes: "",
    createdAt: daysAgo(now, 120 - index * 9),
  }));

  // ---- Ventes ----
  const sellers = ["u_jean", "u_marie", "u_pierre"];
  const sales = [];
  const installments = [];
  let saleCounter = 0;
  let installmentCounter = 1040;

  for (let day = 74; day >= 0; day -= 1) {
    const count = Math.floor(random() * 4) + (day < 7 ? 2 : 1);
    for (let n = 0; n < count; n += 1) {
      const date = daysAgo(now, day);
      const d = new Date(date);
      d.setHours(9 + Math.floor(random() * 9), Math.floor(random() * 60), 0, 0);
      if (d > now) d.setTime(now.getTime() - (n + 1) * 600000);

      const lineCount = random() < 0.6 ? 1 : 2;
      const items = [];
      for (let l = 0; l < lineCount; l += 1) {
        const product = pick(products);
        if (items.some((item) => item.productId === product.id)) continue;
        const cheap = product.price < 20000;
        const qty = cheap ? 1 + Math.floor(random() * 3) : 1;
        const price = random() < 0.25 ? Math.round((product.minPrice + (product.price - product.minPrice) / 2) / 500) * 500 : product.price;
        items.push({ productId: product.id, name: product.name, qty, price, cost: product.cost });
      }

      const subtotal = items.reduce((sum, item) => sum + item.qty * item.price, 0);
      const sellerId = day > 85 ? "u_pierre" : pick(sellers.slice(0, day > 60 ? 3 : 2));
      const customer = random() < 0.7 ? pick(customers) : null;
      const isCredit = customer && subtotal >= 90000 && random() < 0.35;
      const cancelled = !isCredit && random() < 0.03;
      saleCounter += 1;
      const saleId = `V-${String(saleCounter).padStart(5, "0")}`;

      const sale = {
        id: saleId,
        date: d.toISOString(),
        sellerId,
        customerId: customer?.id ?? null,
        customerName: customer?.name ?? "Client de passage",
        items,
        subtotal,
        discount: 0,
        total: subtotal,
        paid: subtotal,
        method: pick(["cash", "cash", "cash", "mobile", "mobile", "card", "transfer"]),
        mode: isCredit ? "credit" : "cash",
        status: cancelled ? "cancelled" : "completed",
        installmentId: null,
      };

      if (isCredit) {
        installmentCounter += 1;
        const installmentId = `TR-${installmentCounter}`;
        const deposit = Math.round((subtotal * (0.2 + random() * 0.3)) / 5000) * 5000;
        const payments = [{ id: uid("pay"), date: d.toISOString(), amount: deposit, method: "cash", note: "Acompte" }];
        let paid = deposit;
        const extra = Math.floor(random() * 3);
        for (let p = 1; p <= extra; p += 1) {
          const payDate = new Date(d.getTime() + p * 12 * 86400000);
          if (payDate > now) break;
          const amount = Math.min(subtotal - paid, Math.round((subtotal * 0.25) / 5000) * 5000);
          if (amount <= 0) break;
          paid += amount;
          payments.push({ id: uid("pay"), date: payDate.toISOString(), amount, method: pick(["cash", "mobile"]), note: "" });
        }
        const dueDate = new Date(d.getTime() + (30 + Math.floor(random() * 30)) * 86400000);
        installments.push({
          id: installmentId,
          saleId,
          customerId: customer.id,
          customerName: customer.name,
          label: items.map((item) => item.name).join(", "),
          total: subtotal,
          payments,
          dueDate: dueDate.toISOString(),
          sellerId,
          createdAt: d.toISOString(),
          notes: "",
        });
        sale.paid = deposit;
        sale.installmentId = installmentId;
      }

      sales.push(sale);
    }
  }

  // ---- Mouvements de stock initiaux ----
  const stockMovements = [
    { id: uid("mv"), productId: "p_1", productName: products[0].name, type: "in", qty: 5, reason: "Réception fournisseur", reference: "BC-0002", date: daysAgo(now, 6), userName: "Admin DYM" },
    { id: uid("mv"), productId: "p_5", productName: products[4].name, type: "out", qty: 1, reason: "Article défectueux", reference: "AJ-0011", date: daysAgo(now, 4), userName: "Admin DYM" },
    { id: uid("mv"), productId: "p_10", productName: products[9].name, type: "in", qty: 40, reason: "Réception fournisseur", reference: "BC-0003", date: daysAgo(now, 2), userName: "Admin DYM" },
  ];

  const purchaseOrders = [
    { id: "BC-0003", supplierId: "s_acc", items: [{ productId: "p_10", name: products[9].name, qty: 40, cost: 1600 }], status: "received", createdAt: daysAgo(now, 6), receivedAt: daysAgo(now, 2), expectedAt: daysAgo(now, 2), notes: "" },
    { id: "BC-0004", supplierId: "s_print", items: [{ productId: "p_8", name: products[7].name, qty: 6, cost: 72000 }, { productId: "p_9", name: products[8].name, qty: 20, cost: 7500 }], status: "sent", createdAt: daysAgo(now, 3), receivedAt: null, expectedAt: daysAgo(now, -4), notes: "Urgent : rupture imprimantes." },
    { id: "BC-0005", supplierId: "s_acc", items: [{ productId: "p_5", name: products[4].name, qty: 30, cost: 4200 }], status: "draft", createdAt: daysAgo(now, 1), receivedAt: null, expectedAt: daysAgo(now, -7), notes: "" },
  ];

  const maintenanceTasks = [
    { id: uid("mt"), product: "Climatiseur Samsung (boutique Akwa)", task: "Entretien filtres et recharge gaz", date: daysAgo(now, -9), status: "Planifié", assignedTo: "Michel", costEstimate: 25000, source: "admin", reportedBy: null },
    { id: uid("mt"), product: "Serveur Dell PowerEdge", task: "Mise à jour système et test RAID", date: daysAgo(now, -2), status: "En cours", assignedTo: "Nadia", costEstimate: 18000, source: "admin", reportedBy: null },
    { id: uid("mt"), product: "Imprimante de caisse Epson", task: "Tête d'impression défaillante", date: daysAgo(now, 1), status: "À remplacer", assignedTo: "Lucas", costEstimate: 12000, source: "admin", reportedBy: null },
    { id: uid("mt"), product: "Terminal POS boutique Bonapriso", task: "L'écran tactile ne répond plus par moments.", date: daysAgo(now, 0), status: "Signalé", assignedTo: "", costEstimate: 0, source: "seller", reportedBy: "u_marie" },
  ];

  const maintenanceHistory = [
    { id: uid("mh"), product: "Serveur Dell PowerEdge", action: "Remplacement disque RAID", technician: "Claire", date: daysAgo(now, 40), cost: 42000, note: "Disque 2 en erreur SMART." },
    { id: uid("mh"), product: "Climatiseur Samsung (boutique Akwa)", action: "Nettoyage complet", technician: "Michel", date: daysAgo(now, 70), cost: 15000, note: "" },
    { id: uid("mh"), product: "Imprimante de caisse Epson", action: "Changement tête d'impression", technician: "Lucas", date: daysAgo(now, 55), cost: 65000, note: "Pannes répétées." },
    { id: uid("mh"), product: "Imprimante de caisse Epson", action: "Remplacement carte mère", technician: "Lucas", date: daysAgo(now, 20), cost: 30000, note: "" },
  ];

  const techSheets = [
    { id: uid("ts"), product: "Climatiseur Samsung (boutique Akwa)", model: "AR18 WindFree", info: "18 000 BTU, filtre anti-poussière, Wi‑Fi intégré", originalValue: 450000, purchaseDate: daysAgo(now, 400) },
    { id: uid("ts"), product: "Serveur Dell PowerEdge", model: "R250", info: "Xeon E-2314, 32 Go RAM, rack 1U, RAID 1", originalValue: 850000, purchaseDate: daysAgo(now, 600) },
    { id: uid("ts"), product: "Imprimante de caisse Epson", model: "TM-T20III", info: "Thermique 80 mm, USB + Ethernet", originalValue: 85000, purchaseDate: daysAgo(now, 500) },
  ];

  return {
    version: STORE_VERSION,
    users,
    categories,
    suppliers,
    products,
    customers,
    sales,
    installments,
    stockMovements,
    purchaseOrders,
    maintenanceTasks,
    maintenanceHistory,
    techSheets,
    settings: { ...DEFAULT_SETTINGS },
    counters: { sale: saleCounter, installment: installmentCounter, purchaseOrder: 5, adjustment: 11 },
  };
}

function daysAgo(now, days) {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}
