import { formatDate, formatDateTime, formatMoney } from "./format";
import { PAYMENT_LABELS, installmentPaid, installmentRemaining } from "../store/selectors";
import { brandBase } from "./branding";

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

const baseStyles = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: "Inter", "Segoe UI", Arial, sans-serif; color: #0f172a; font-size: 13px; line-height: 1.5; padding: 36px; }
  .head { display: flex; justify-content: space-between; gap: 24px; padding-bottom: 20px; border-bottom: 2px solid var(--brand); }
  .brand { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
  .muted { color: #64748b; }
  .small { font-size: 11px; }
  .doc-title { font-size: 20px; font-weight: 800; text-align: right; text-transform: uppercase; letter-spacing: 0.04em; }
  .doc-number { text-align: right; font-weight: 600; color: var(--brand); }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 14px; }
  .label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #64748b; font-weight: 700; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; padding: 10px 8px; border-bottom: 1px solid #cbd5e1; }
  td { padding: 10px 8px; border-bottom: 1px solid #f1f5f9; }
  .r { text-align: right; } .c { text-align: center; }
  .totals { margin-left: auto; width: 300px; margin-top: 16px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; }
  .totals .grand { border-top: 2px solid var(--brand); margin-top: 6px; padding-top: 10px; font-size: 16px; font-weight: 800; }
  .stamp { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  .ok { background: #ecfdf5; color: #047857; } .warn { background: #fffbeb; color: #b45309; } .ko { background: #fef2f2; color: #b91c1c; }
  .foot { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
  @page { margin: 12mm; }
`;

function companyBlock(settings) {
  return `
    <div>
      ${settings.logo ? `<img src="${escapeHtml(settings.logo)}" alt="" style="max-height:64px;max-width:180px;object-fit:contain;margin-bottom:8px;display:block" />` : ""}
      <div class="brand">${escapeHtml(settings.shopName)}</div>
      <div class="muted">${escapeHtml(settings.tagline)}</div>
      <div class="muted small" style="margin-top:6px">${escapeHtml(settings.address)}<br/>${escapeHtml(settings.phone)} · ${escapeHtml(settings.email)}${settings.taxId ? `<br/>NIU : ${escapeHtml(settings.taxId)}` : ""}</div>
    </div>`;
}

/** Imprime un document HTML via une iframe invisible (pas de pop-up à autoriser). */
export function printHtml(title, body, settings, extraStyles = "") {
  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"/><title>${escapeHtml(title)}</title><style>:root { --brand: ${brandBase(settings?.brandColor)}; }${baseStyles}${extraStyles}</style></head><body>${body}</body></html>`);
  doc.close();
  // Attendre le chargement du logo avant d'imprimer
  const images = [...doc.images].map((img) => (img.complete ? null : new Promise((resolve) => { img.onload = img.onerror = resolve; })));
  Promise.all(images).then(() =>
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    }, 250)
  );
}

export function printSaleInvoice(sale, { settings, customer, seller, installment }) {
  const taxRate = Number(settings.taxRate) || 0;
  const taxBase = sale.total / (1 + taxRate / 100);
  const tax = sale.total - taxBase;
  const remaining = installment ? installmentRemaining(installment) : Math.max(0, sale.total - (sale.paid ?? sale.total));
  const status = sale.status === "cancelled" ? '<span class="stamp ko">Annulée</span>' : remaining > 0 ? '<span class="stamp warn">Solde à régler</span>' : '<span class="stamp ok">Payée</span>';

  const rows = sale.items
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="c">${item.qty}</td><td class="r">${formatMoney(item.price)}</td><td class="r"><b>${formatMoney(item.qty * item.price)}</b></td></tr>`)
    .join("");

  const body = `
    <div class="head">
      ${companyBlock(settings)}
      <div>
        <div class="doc-title">Facture</div>
        <div class="doc-number">${escapeHtml(sale.id)}</div>
        <div class="muted small" style="text-align:right">${formatDateTime(sale.date)}</div>
        <div style="text-align:right;margin-top:8px">${status}</div>
      </div>
    </div>
    <div class="grid">
      <div class="box">
        <div class="label">Facturé à</div>
        <div><b>${escapeHtml(sale.customerName)}</b></div>
        ${customer ? `<div class="muted">${escapeHtml(customer.phone || "")}${customer.email ? ` · ${escapeHtml(customer.email)}` : ""}</div><div class="muted">${escapeHtml(customer.city || "")}</div>` : ""}
      </div>
      <div class="box">
        <div class="label">Règlement</div>
        <div>${escapeHtml(PAYMENT_LABELS[sale.method] || sale.method)} · ${sale.mode === "credit" ? "Paiement échelonné" : "Comptant"}</div>
        <div class="muted">Vendeur : ${escapeHtml(seller?.name || "—")}</div>
        ${installment ? `<div class="muted">Échéance : ${formatDate(installment.dueDate)}</div>` : ""}
      </div>
    </div>
    <table>
      <thead><tr><th>Désignation</th><th class="c">Qté</th><th class="r">P.U.</th><th class="r">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span class="muted">Sous-total</span><span>${formatMoney(sale.subtotal)}</span></div>
      ${sale.discount ? `<div><span class="muted">Remise</span><span>− ${formatMoney(sale.discount)}</span></div>` : ""}
      ${taxRate ? `<div><span class="muted">dont TVA (${taxRate} %)</span><span>${formatMoney(tax)}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>${formatMoney(sale.total)}</span></div>
      ${sale.mode === "credit" ? `<div><span class="muted">Déjà versé</span><span>${formatMoney(installment ? installmentPaid(installment) : sale.paid)}</span></div><div><span><b>Reste à payer</b></span><span><b>${formatMoney(remaining)}</b></span></div>` : ""}
    </div>
    <div class="sign"><span>Signature du client</span><span>Cachet et signature</span></div>
    <div class="foot">${escapeHtml(settings.invoiceFooter)}</div>`;

  printHtml(`Facture ${sale.id}`, body, settings);
}

/** Ticket de caisse au format 80 mm */
export function printReceipt(sale, { settings, seller }) {
  const rows = sale.items
    .map((item) => `<tr><td colspan="2">${escapeHtml(item.name)}</td></tr><tr><td class="muted">${item.qty} × ${formatMoney(item.price)}</td><td class="r">${formatMoney(item.qty * item.price)}</td></tr>`)
    .join("");
  const body = `
    <div style="text-align:center">
      ${settings.logo ? `<img src="${escapeHtml(settings.logo)}" alt="" style="max-height:44px;max-width:60mm;object-fit:contain;margin:0 auto 6px;display:block" />` : ""}
      <div class="brand" style="font-size:16px">${escapeHtml(settings.shopName)}</div>
      <div class="muted small">${escapeHtml(settings.address)}<br/>${escapeHtml(settings.phone)}</div>
    </div>
    <div class="dash"></div>
    <div class="small">Ticket <b>${escapeHtml(sale.id)}</b><br/>${formatDateTime(sale.date)}<br/>Vendeur : ${escapeHtml(seller?.name || "—")}<br/>Client : ${escapeHtml(sale.customerName)}</div>
    <div class="dash"></div>
    <table>${rows}</table>
    <div class="dash"></div>
    <table>
      ${sale.discount ? `<tr><td>Remise</td><td class="r">− ${formatMoney(sale.discount)}</td></tr>` : ""}
      <tr><td><b>TOTAL</b></td><td class="r"><b>${formatMoney(sale.total)}</b></td></tr>
      <tr><td>${escapeHtml(PAYMENT_LABELS[sale.method])}</td><td class="r">${formatMoney(sale.paid)}</td></tr>
      ${sale.total - sale.paid > 0 ? `<tr><td>Reste à payer</td><td class="r">${formatMoney(sale.total - sale.paid)}</td></tr>` : ""}
    </table>
    <div class="dash"></div>
    <div class="small muted" style="text-align:center">${escapeHtml(settings.invoiceFooter)}</div>`;

  printHtml(`Ticket ${sale.id}`, body, settings, `
    body { width: 76mm; padding: 4mm; font-size: 11px; }
    td { padding: 2px 0; border: 0; }
    .dash { border-top: 1px dashed #94a3b8; margin: 8px 0; }
    @page { size: 80mm auto; margin: 0; }
  `);
}

export function printInstallmentStatement(installment, { settings, customer }) {
  const paid = installmentPaid(installment);
  const remaining = installmentRemaining(installment);
  const rows = installment.payments
    .map((p) => `<tr><td>${formatDate(p.date)}</td><td>${escapeHtml(PAYMENT_LABELS[p.method] || p.method)}</td><td>${escapeHtml(p.note || "")}</td><td class="r">${formatMoney(p.amount)}</td></tr>`)
    .join("");

  const body = `
    <div class="head">
      ${companyBlock(settings)}
      <div>
        <div class="doc-title">Relevé de compte</div>
        <div class="doc-number">${escapeHtml(installment.id)}</div>
        <div class="muted small" style="text-align:right">Édité le ${formatDate(new Date())}</div>
      </div>
    </div>
    <div class="grid">
      <div class="box">
        <div class="label">Client</div>
        <div><b>${escapeHtml(installment.customerName)}</b></div>
        ${customer ? `<div class="muted">${escapeHtml(customer.phone || "")} · ${escapeHtml(customer.city || "")}</div>` : ""}
      </div>
      <div class="box">
        <div class="label">Objet</div>
        <div>${escapeHtml(installment.label)}</div>
        <div class="muted">Échéance finale : ${formatDate(installment.dueDate)}${installment.saleId ? ` · Vente ${escapeHtml(installment.saleId)}` : ""}</div>
      </div>
    </div>
    <div class="label">Historique des versements</div>
    <table>
      <thead><tr><th>Date</th><th>Mode</th><th>Note</th><th class="r">Montant</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4" class="muted">Aucun versement.</td></tr>'}</tbody>
    </table>
    <div class="totals">
      <div><span class="muted">Montant total</span><span>${formatMoney(installment.total)}</span></div>
      <div><span class="muted">Total versé</span><span>${formatMoney(paid)}</span></div>
      <div class="grand"><span>Reste à payer</span><span>${formatMoney(remaining)}</span></div>
    </div>
    <div class="sign"><span>Signature du client</span><span>Signature du vendeur</span></div>
    <div class="foot">${escapeHtml(settings.invoiceFooter)}</div>`;

  printHtml(`Relevé ${installment.id}`, body, settings);
}

export function printPurchaseOrder(order, { settings, supplier }) {
  const rows = order.items
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td class="c">${item.qty}</td><td class="r">${formatMoney(item.cost)}</td><td class="r"><b>${formatMoney(item.qty * item.cost)}</b></td></tr>`)
    .join("");
  const total = order.items.reduce((sum, item) => sum + item.qty * item.cost, 0);
  const body = `
    <div class="head">
      ${companyBlock(settings)}
      <div>
        <div class="doc-title">Bon de commande</div>
        <div class="doc-number">${escapeHtml(order.id)}</div>
        <div class="muted small" style="text-align:right">${formatDate(order.createdAt)}</div>
      </div>
    </div>
    <div class="grid">
      <div class="box">
        <div class="label">Fournisseur</div>
        <div><b>${escapeHtml(supplier?.name || "—")}</b></div>
        <div class="muted">${escapeHtml(supplier?.contact || "")} · ${escapeHtml(supplier?.phone || "")}</div>
        <div class="muted">${escapeHtml(supplier?.address || "")}</div>
      </div>
      <div class="box">
        <div class="label">Livraison souhaitée</div>
        <div>${formatDate(order.expectedAt)}</div>
        <div class="muted">${escapeHtml(settings.address)}</div>
      </div>
    </div>
    <table>
      <thead><tr><th>Article</th><th class="c">Qté</th><th class="r">Prix d'achat</th><th class="r">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals"><div class="grand"><span>Total commande</span><span>${formatMoney(total)}</span></div></div>
    ${order.notes ? `<p style="margin-top:20px"><span class="label">Notes</span><br/>${escapeHtml(order.notes)}</p>` : ""}
    <div class="sign"><span>Bon pour accord fournisseur</span><span>Signature acheteur</span></div>`;
  printHtml(`Bon de commande ${order.id}`, body, settings);
}
