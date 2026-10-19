import { Link } from "react-router-dom";
import { FaArrowRight, FaBoxOpen, FaCheckCircle, FaCreditCard, FaReceipt } from "react-icons/fa";
import { Card, CardHeader, EmptyState } from "../ui/Card";
import Badge, { Avatar } from "../ui/Badge";
import { formatDate, formatMoney, formatRelative } from "../../lib/format";
import { INSTALLMENT_STATUS, PAYMENT_LABELS, PRODUCT_STATUS, installmentRemaining, installmentStatus, lowStockProducts, productStatus } from "../../store/selectors";

import { t } from "../../i18n/index.js";

function SeeAll({ to }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">{t("Tout voir")}{" "}<FaArrowRight size={9} />
    </Link>
  );
}

export function RecentSalesCard({ sales, to, limit = 6, title = t("Dernières ventes") }) {
  const list = sales.slice(0, limit);
  return (
    <Card>
      <CardHeader title={title} subtitle={t("Activité la plus récente")} icon={FaReceipt} action={<SeeAll to={to} />} />
      {list.length === 0 ? (
        <EmptyState icon={FaReceipt} title={t("Aucune vente")} description={t("Les ventes enregistrées apparaîtront ici.")} />
      ) : (
        <ul className="-mx-2 divide-y divide-slate-100">
          {list.map((sale) => (
            <li key={sale.id} className="flex items-center gap-3 px-2 py-2.5">
              <Avatar name={sale.customerName} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-slate-800">{t(sale.customerName)}</p>
                <p className="truncate text-xs text-slate-500">
                  {sale.id} · {formatRelative(sale.date)}
                </p>
              </div>
              <div className="text-right">
                <p className={`tabular text-[13px] font-semibold ${sale.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-900"}`}>{formatMoney(sale.total)}</p>
                <p className="text-[11px] text-slate-500">{sale.mode === "credit" ? t("Crédit") : PAYMENT_LABELS[sale.method]}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function StockAlertsCard({ products, to, limit = 5 }) {
  const list = lowStockProducts(products).slice(0, limit);
  return (
    <Card>
      <CardHeader title={t("Alertes de stock")} subtitle={t("{0} article(s) sous le seuil", [lowStockProducts(products).length])} icon={FaBoxOpen} tone="amber" action={to && <SeeAll to={to} />} />
      {list.length === 0 ? (
        <EmptyState icon={FaCheckCircle} title={t("Stock sain")} description={t("Aucun article sous son seuil d'alerte.")} />
      ) : (
        <ul className="space-y-3">
          {list.map((product) => {
            const status = PRODUCT_STATUS[productStatus(product)];
            const ratio = Math.min(100, (product.stock / Math.max(product.alertThreshold * 2, 1)) * 100);
            return (
              <li key={product.id}>
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[13px] font-medium text-slate-800">{product.name}</p>
                  <Badge tone={status.tone}>{product.stock <= 0 ? t("Rupture") : t("{0} restant{1}", [product.stock, product.stock > 1 ? "s" : ""])}</Badge>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${product.stock <= 0 ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${Math.max(ratio, 3)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export function ReceivablesCard({ installments, to, limit = 5 }) {
  const list = installments
    .filter((item) => ["late", "soon"].includes(installmentStatus(item)))
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, limit);

  return (
    <Card>
      <CardHeader title={t("Créances à relancer")} subtitle={t("Retards et échéances sous 7 jours")} icon={FaCreditCard} tone="red" action={<SeeAll to={to} />} />
      {list.length === 0 ? (
        <EmptyState icon={FaCheckCircle} title={t("Aucune relance")} description={t("Tous les paiements échelonnés sont à jour.")} />
      ) : (
        <ul className="-mx-2 divide-y divide-slate-100">
          {list.map((item) => {
            const status = INSTALLMENT_STATUS[installmentStatus(item)];
            return (
              <li key={item.id}>
                <Link to={`${to}?id=${item.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-800">{item.customerName}</p>
                    <p className="truncate text-xs text-slate-500">{t("Échéance")}{" "}{formatDate(item.dueDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular text-[13px] font-semibold text-slate-900">{formatMoney(installmentRemaining(item))}</p>
                    <Badge tone={status.tone}>{t(status.label)}</Badge>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
