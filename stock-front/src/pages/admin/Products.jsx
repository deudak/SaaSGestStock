import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FaArrowDown,
  FaArrowUp,
  FaBoxes,
  FaCamera,
  FaCheck,
  FaEdit,
  FaExchangeAlt,
  FaFileExport,
  FaPlus,
  FaTags,
  FaTimes,
  FaTrash,
  FaWarehouse,
  FaExclamationTriangle,
  FaHistory,
} from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import ProductThumb from "../../components/ui/ProductThumb";
import { Field, Input, SearchInput, Select, Textarea } from "../../components/ui/Form";
import { formatDateTime, formatMoney, formatNumber, matches } from "../../lib/format";
import { downloadCSV, todayStamp } from "../../lib/csv";
import { fileToDataUrl } from "../../lib/image";
import { PRODUCT_STATUS, lowStockProducts, productStatus, stockValue } from "../../store/selectors";

import { t } from "../../i18n/index.js";
import BarcodeScanner from "../../components/scan/BarcodeScanner";
import { FaBarcode } from "react-icons/fa";

const emptyProduct = { name: "", sku: "", barcode: "", category: "", supplierId: "", price: "", minPrice: "", cost: "", stock: "", alertThreshold: "", description: "", image: "" };

const adjustReasons = {
  in: ["Réception fournisseur", "Retour client", "Correction d'inventaire", "Transfert entrant"],
  out: ["Article défectueux / casse", "Correction d'inventaire", "Usage interne", "Perte / vol", "Transfert sortant"],
};

function ProductForm({ initial, categories, suppliers, defaultThreshold, products = [], onSubmit, onCancel }) {
  const [form, setForm] = useState(() => ({ ...emptyProduct, alertThreshold: String(defaultThreshold), ...initial }));
  const [errors, setErrors] = useState({});
  const [scanning, setScanning] = useState(false);
  const set = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const price = Number(form.price) || 0;
  const cost = Number(form.cost) || 0;
  const margin = price && cost ? Math.round(((price - cost) / price) * 100) : null;

  const handleImage = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const image = await fileToDataUrl(file);
      setForm((prev) => ({ ...prev, image }));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const submit = (event) => {
    event.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = t("Nom obligatoire.");
    if (!form.category) next.category = t("Choisissez une catégorie.");
    if (price <= 0) next.price = t("Prix de vente requis.");
    if (Number(form.minPrice) > price) next.minPrice = t("Doit être inférieur au prix de vente.");
    if (cost > price) next.cost = t("Le coût dépasse le prix de vente.");
    if (Number(form.stock) < 0) next.stock = t("Valeur invalide.");
    const barcode = (form.barcode || "").trim();
    const duplicate = barcode && products.find((p) => p.id !== form.id && (p.barcode || "").toLowerCase() === barcode.toLowerCase());
    if (duplicate) next.barcode = t("Code déjà utilisé par « {0} ».", [duplicate.name]);
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      ...form,
      name: form.name.trim(),
      price,
      minPrice: Number(form.minPrice) || price,
      cost,
      stock: Number(form.stock) || 0,
      alertThreshold: Number(form.alertThreshold) || 0,
    });
  };

  return (
    <form id="product-form" onSubmit={submit} className="space-y-5" noValidate>
      <div className="flex items-center gap-4">
        <label className="group relative flex h-20 w-20 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-brand-400 hover:text-brand-500">
          {form.image ? <img src={form.image} alt="" className="h-full w-full object-cover" /> : <FaCamera size={18} />}
          <input type="file" accept="image/*" className="sr-only" onChange={handleImage} />
        </label>
        <div className="text-sm">
          <p className="font-medium text-slate-800">{t("Photo du produit")}</p>
          <p className="text-xs text-slate-500">{t("JPG ou PNG, redimensionnée automatiquement.")}</p>
          {form.image && (
            <button type="button" onClick={() => setForm((prev) => ({ ...prev, image: "" }))} className="mt-1 text-xs font-semibold text-rose-600">{t("Retirer la photo")}</button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t("Nom du produit")} error={errors.name} required className="sm:col-span-2">
          <Input value={form.name} onChange={set("name")} placeholder={t("Ex : Ordinateur HP 250 G9")} />
        </Field>
        <Field label={t("Référence (SKU)")} hint={t("Générée si vide")}>
          <Input value={form.sku} onChange={set("sku")} placeholder={t("DYM-0015")} />
        </Field>
        <Field label={t("Code-barres")} error={errors.barcode} hint={t("EAN, UPC… : scannez l'étiquette ou saisissez le code")}>
          <div className="flex gap-2">
            <Input value={form.barcode || ""} onChange={set("barcode")} placeholder="6001234567890" inputMode="numeric" className="flex-1" />
            <Button variant="secondary" icon={FaBarcode} onClick={() => setScanning(true)} aria-label={t("Scanner avec la caméra")} title={t("Scanner avec la caméra")} />
          </div>
        </Field>
      </div>
      <BarcodeScanner isOpen={scanning} onClose={() => setScanning(false)} onDetected={(code) => setForm((prev) => ({ ...prev, barcode: code }))} title={t("Scanner le code du produit")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Catégorie")} error={errors.category} required>
          <Select value={form.category} onChange={set("category")}>
            <option value="">{t("Choisir…")}</option>
            {categories.map((category) => (
              <option key={category} value={category}>{t(category)}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("Fournisseur")}>
          <Select value={form.supplierId} onChange={set("supplierId")}>
            <option value="">{t("Aucun")}</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("Prix")}</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("Prix de vente")} error={errors.price} required>
            <Input type="number" min="0" value={form.price} onChange={set("price")} suffix="F" />
          </Field>
          <Field label={t("Prix plancher")} error={errors.minPrice} hint={t("Minimum autorisé au POS")}>
            <Input type="number" min="0" value={form.minPrice} onChange={set("minPrice")} suffix="F" />
          </Field>
          <Field label={t("Prix d'achat")} error={errors.cost}>
            <Input type="number" min="0" value={form.cost} onChange={set("cost")} suffix="F" />
          </Field>
        </div>
        {margin !== null && (
          <p className="mt-3 text-xs text-slate-600">{t("Marge unitaire :")}{" "}<b className="tabular">{formatMoney(price - cost)}</b>({margin}%)
                      </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={initial?.id ? t("Stock (correction d'inventaire)") : t("Stock initial")} error={errors.stock} hint={initial?.id ? t("Un mouvement sera créé si la valeur change.") : undefined}>
          <Input type="number" min="0" value={form.stock} onChange={set("stock")} />
        </Field>
        <Field label={t("Seuil d'alerte")} hint={t("Alerte quand le stock atteint ce niveau")}>
          <Input type="number" min="0" value={form.alertThreshold} onChange={set("alertThreshold")} />
        </Field>
      </div>

      <Field label={t("Description")}>
        <Textarea value={form.description} onChange={set("description")} placeholder={t("Caractéristiques, garantie…")} />
      </Field>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" icon={FaCheck}>
          {initial?.id ? t("Enregistrer") : t("Créer le produit")}
        </Button>
      </div>
    </form>
  );
}

function AdjustStockForm({ product, onSubmit, onCancel }) {
  const [type, setType] = useState("in");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState(adjustReasons.in[0]);
  const quantity = Number(qty) || 0;
  const next = type === "in" ? product.stock + quantity : Math.max(0, product.stock - quantity);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (quantity <= 0) return toast.error(t("Indiquez une quantité."));
        if (type === "out" && quantity > product.stock) return toast.error(t("Quantité supérieure au stock disponible."));
        onSubmit(type, quantity, reason);
      }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
        <ProductThumb product={product} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{product.name}</p>
          <p className="text-xs text-slate-500">{t("Stock actuel :")}{" "}{product.stock}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          { value: "in", label: t("Entrée"), icon: FaArrowDown, active: "border-emerald-500 bg-emerald-50 text-emerald-700" },
          { value: "out", label: t("Sortie"), icon: FaArrowUp, active: "border-rose-500 bg-rose-50 text-rose-700" },
        ].map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              setType(option.value);
              setReason(adjustReasons[option.value][0]);
            }}
            className={`flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition ${type === option.value ? option.active : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
          >
            <option.icon size={12} /> {t(option.label)}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("Quantité")} required>
          <Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" />
        </Field>
        <Field label={t("Motif")}>
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            {adjustReasons[type].map((r) => (
              <option key={r} value={r}>{t(r)}</option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
        <span className="text-slate-500">{t("Nouveau stock")}</span>
        <span className="tabular text-base font-bold text-slate-900">
          {product.stock} → <span className={next > product.stock ? "text-emerald-600" : next < product.stock ? "text-rose-600" : ""}>{next}</span>
        </span>
      </div>
      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>{t("Annuler")}</Button>
        <Button type="submit" variant={type === "in" ? "success" : "danger"} icon={FaCheck}>{t("Valider le mouvement")}</Button>
      </div>
    </form>
  );
}

function CategoriesPanel() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const [name, setName] = useState("");
  const [editing, setEditing] = useState(null);
  const [editValue, setEditValue] = useState("");

  const counts = useMemo(() => {
    const map = {};
    state.products.forEach((p) => {
      map[p.category] = (map[p.category] || 0) + 1;
    });
    return map;
  }, [state.products]);

  const exists = (value) => state.categories.some((c) => c.toLowerCase() === value.toLowerCase());

  return (
    <Card>
      <form
        className="flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const value = name.trim();
          if (!value) return;
          if (exists(value)) return toast.error(t("Cette catégorie existe déjà."));
          actions.addCategory(value);
          setName("");
          toast.success(t("Catégorie « {0} » ajoutée", [value]));
        }}
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Nouvelle catégorie…")} className="sm:max-w-sm" />
        <Button type="submit" icon={FaPlus}>{t("Ajouter")}</Button>
      </form>

      <ul className="mt-5 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
        {state.categories.map((category) => (
          <li key={category} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <FaTags size={12} />
            </span>
            {editing === category ? (
              <form
                className="flex flex-1 items-center gap-1.5"
                onSubmit={(event) => {
                  event.preventDefault();
                  const value = editValue.trim();
                  if (!value || value === category) return setEditing(null);
                  if (exists(value)) return toast.error(t("Cette catégorie existe déjà."));
                  actions.renameCategory(category, value);
                  setEditing(null);
                  toast.success(t("Catégorie renommée"));
                }}
              >
                <Input value={editValue} onChange={(e) => setEditValue(e.target.value)} className="py-1.5" autoFocus />
                <Button type="submit" size="icon-sm" variant="ghost" aria-label={t("Valider")}>
                  <FaCheck size={12} />
                </Button>
                <Button size="icon-sm" variant="ghost" onClick={() => setEditing(null)} aria-label={t("Annuler")}>
                  <FaTimes size={12} />
                </Button>
              </form>
            ) : (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{category}</p>
                  <p className="text-xs text-slate-500">{counts[category] || 0}{" "}{t("produit(s)")}</p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t("Renommer")}
                  onClick={() => {
                    setEditing(category);
                    setEditValue(category);
                  }}
                >
                  <FaEdit size={12} />
                </Button>
                <Button
                  size="icon-sm"
                  variant="danger-ghost"
                  aria-label={t("Supprimer")}
                  onClick={async () => {
                    const ok = await confirm({
                      title: t("Supprimer la catégorie ?"),
                      message: counts[category] ? t("{0} produit(s) seront déplacés vers « Autre ».", [counts[category]]) : t("La catégorie « {0} » sera supprimée.", [category]),
                      confirmLabel: t("Supprimer"),
                    });
                    if (!ok) return;
                    if (counts[category] && !state.categories.includes("Autre")) actions.addCategory("Autre");
                    actions.deleteCategory(category);
                    toast.success(t("Catégorie supprimée"));
                  }}
                >
                  <FaTrash size={11} />
                </Button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MovementsPanel() {
  const { state } = useStore();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");

  const list = state.stockMovements.filter((m) => (type === "all" || m.type === type) && matches(search, m.productName, m.reference, m.reason, m.userName));

  return (
    <Card padded={false}>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder={t("Produit, référence, motif…")} className="flex-1" />
        <Tabs
          value={type}
          onChange={setType}
          size="sm"
          options={[
            { value: "all", label: t("Tous") },
            { value: "in", label: t("Entrées") },
            { value: "out", label: t("Sorties") },
          ]}
        />
        <Button
          variant="secondary"
          size="sm"
          icon={FaFileExport}
          onClick={() =>
            downloadCSV(`mouvements-stock-${todayStamp()}`, list, [
              { label: t("Date"), value: (m) => formatDateTime(m.date) },
              { label: t("Produit"), value: (m) => m.productName },
              { label: t("Type"), value: (m) => (m.type === "in" ? t("Entrée") : t("Sortie")) },
              { label: t("Quantité"), value: (m) => m.qty },
              { label: t("Motif"), value: (m) => m.reason },
              { label: t("Référence"), value: (m) => m.reference },
              { label: t("Utilisateur"), value: (m) => m.userName },
            ])
          }
        >{t("Exporter")}</Button>
      </div>
      {list.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={FaHistory} title={t("Aucun mouvement")} description={t("Ventes, réceptions et ajustements apparaîtront ici.")} />
        </div>
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-180 text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">{t("Date")}</th>
                <th className="px-4 py-3">{t("Produit")}</th>
                <th className="px-4 py-3">{t("Mouvement")}</th>
                <th className="px-4 py-3">{t("Motif")}</th>
                <th className="px-4 py-3">{t("Référence")}</th>
                <th className="px-4 py-3">{t("Par")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.slice(0, 200).map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDateTime(m.date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{m.productName}</td>
                  <td className="px-4 py-3">
                    <Badge tone={m.type === "in" ? "green" : "red"} icon={m.type === "in" ? FaArrowDown : FaArrowUp}>
                      {m.type === "in" ? "+" : "−"}
                      {m.qty}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t(m.reason)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{m.reference}</td>
                  <td className="px-4 py-3 text-slate-600">{m.userName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function AdminProducts() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState("inventory");
  const [search, setSearch] = useState(params.get("q") || "");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState(params.get("status") || "all");
  const [sort, setSort] = useState("name");
  const [editing, setEditing] = useState(null); // null | {} | product
  const [adjusting, setAdjusting] = useState(null);

  const suppliersById = useMemo(() => Object.fromEntries(state.suppliers.map((s) => [s.id, s])), [state.suppliers]);
  const value = stockValue(state.products);
  const alerts = lowStockProducts(state.products);

  const filtered = useMemo(() => {
    const list = state.products.filter((product) => {
      const st = productStatus(product);
      const statusOk = status === "all" || (status === "alert" ? st !== "ok" : st === status);
      return statusOk && (category === "all" || product.category === category) && matches(search, product.name, product.sku, product.barcode, product.category);
    });
    const sorters = {
      name: (a, b) => a.name.localeCompare(b.name, "fr"),
      stock: (a, b) => a.stock - b.stock,
      price: (a, b) => b.price - a.price,
      value: (a, b) => b.stock * b.cost - a.stock * a.cost,
    };
    return list.sort(sorters[sort]);
  }, [state.products, status, category, search, sort]);

  const updateStatus = (next) => {
    setStatus(next);
    const copy = new URLSearchParams(params);
    if (next === "all") copy.delete("status");
    else copy.set("status", next);
    setParams(copy, { replace: true });
  };

  const handleDelete = async (product) => {
    const ok = await confirm({ title: t("Supprimer ce produit ?"), message: t("« {0} » sera retiré du catalogue. L'historique des ventes est conservé.", [product.name]), confirmLabel: t("Supprimer") });
    if (!ok) return;
    actions.deleteProduct(product.id);
    toast.success(t("Produit supprimé"));
  };

  const exportProducts = () =>
    downloadCSV(`produits-${todayStamp()}`, filtered, [
      { label: t("Référence"), value: (p) => p.sku },
      { label: t("Nom"), value: (p) => p.name },
      { label: t("Catégorie"), value: (p) => p.category },
      { label: t("Fournisseur"), value: (p) => suppliersById[p.supplierId]?.name || "" },
      { label: t("Prix de vente"), value: (p) => p.price },
      { label: t("Prix plancher"), value: (p) => p.minPrice },
      { label: t("Prix d'achat"), value: (p) => p.cost },
      { label: t("Stock"), value: (p) => p.stock },
      { label: t("Seuil"), value: (p) => p.alertThreshold },
      { label: t("Statut"), value: (p) => PRODUCT_STATUS[productStatus(p)].label },
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("Catalogue")}
        title={t("Produits & stock")}
        description={t("Inventaire, prix, seuils d'alerte et traçabilité de chaque mouvement.")}
        actions={
          <>
            <Button variant="secondary" icon={FaFileExport} onClick={exportProducts}>{t("Exporter")}</Button>
            <Button icon={FaPlus} onClick={() => setEditing({})}>{t("Nouveau produit")}</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title={t("Références")} value={formatNumber(state.products.length)} icon={FaBoxes} hint={t("{0} catégories", [state.categories.length])} />
        <StatCard title={t("Articles en stock")} value={formatNumber(state.products.reduce((s, p) => s + p.stock, 0))} icon={FaWarehouse} tone="violet" hint={t("Toutes références")} />
        <StatCard title={t("Valeur d'achat")} value={formatMoney(value.cost)} icon={FaExchangeAlt} tone="green" hint={t("{0} en prix de vente", [formatMoney(value.retail)])} />
        <StatCard title={t("Alertes")} value={alerts.length} icon={FaExclamationTriangle} tone={alerts.length ? "red" : "green"} hint={t("{0} en rupture", [alerts.filter((p) => p.stock <= 0).length])} onClick={() => { setTab("inventory"); updateStatus("alert"); }} />
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        options={[
          { value: "inventory", label: t("Inventaire"), icon: FaBoxes, count: state.products.length },
          { value: "movements", label: t("Mouvements"), icon: FaHistory },
          { value: "categories", label: t("Catégories"), icon: FaTags, count: state.categories.length },
        ]}
      />

      {tab === "movements" && <MovementsPanel />}
      {tab === "categories" && <CategoriesPanel />}

      {tab === "inventory" && (
        <Card padded={false}>
          <div className="grid gap-3 border-b border-slate-100 p-4 md:grid-cols-[1fr_auto_auto_auto]">
            <SearchInput value={search} onChange={setSearch} placeholder={t("Nom, référence, catégorie…")} />
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="md:w-44" aria-label={t("Catégorie")}>
              <option value="all">{t("Toutes catégories")}</option>
              {state.categories.map((c) => (
                <option key={c} value={c}>{t(c)}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => updateStatus(e.target.value)} className="md:w-40" aria-label={t("Statut")}>
              <option value="all">{t("Tous statuts")}</option>
              <option value="alert">{t("À réapprovisionner")}</option>
              <option value="ok">{t("En stock")}</option>
              <option value="low">{t("Stock bas")}</option>
              <option value="out">{t("Rupture")}</option>
            </Select>
            <Select value={sort} onChange={(e) => setSort(e.target.value)} className="md:w-44" aria-label={t("Trier")}>
              <option value="name">{t("Tri : nom")}</option>
              <option value="stock">{t("Tri : stock croissant")}</option>
              <option value="price">{t("Tri : prix décroissant")}</option>
              <option value="value">{t("Tri : valeur de stock")}</option>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FaBoxes} title={t("Aucun produit trouvé")} description={t("Modifiez vos filtres ou ajoutez un nouveau produit.")} action={<Button icon={FaPlus} onClick={() => setEditing({})}>{t("Nouveau produit")}</Button>} />
            </div>
          ) : (
            <>
              {/* Tableau (écrans moyens et plus) */}
              <div className="scrollbar-thin hidden overflow-x-auto md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3">{t("Produit")}</th>
                      <th className="px-4 py-3">{t("Catégorie")}</th>
                      <th className="px-4 py-3 text-right">{t("Prix")}</th>
                      <th className="hidden px-4 py-3 text-right xl:table-cell">{t("Marge")}</th>
                      <th className="px-4 py-3 text-right">{t("Stock")}</th>
                      <th className="px-4 py-3">{t("Statut")}</th>
                      <th className="px-4 py-3 text-right">{t("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((product) => {
                      const st = PRODUCT_STATUS[productStatus(product)];
                      const margin = product.price ? Math.round(((product.price - product.cost) / product.price) * 100) : 0;
                      return (
                        <tr key={product.id} className="group hover:bg-slate-50/60">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <ProductThumb product={product} size="sm" />
                              <div className="min-w-0">
                                <p className="max-w-70 truncate font-semibold text-slate-800">{product.name}</p>
                                <p className="text-xs text-slate-500">
                                  <span className="font-mono">{product.sku}</span>
                                  {suppliersById[product.supplierId] && ` · ${suppliersById[product.supplierId].name}`}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{product.category}</td>
                          <td className="tabular px-4 py-3 text-right">
                            <p className="font-semibold text-slate-900">{formatMoney(product.price)}</p>
                            <p className="text-xs text-slate-400">{t("min.")}{" "}{formatMoney(product.minPrice)}</p>
                          </td>
                          <td className="tabular hidden px-4 py-3 text-right text-slate-600 xl:table-cell">{margin} %</td>
                          <td className="tabular px-4 py-3 text-right">
                            <p className="font-semibold text-slate-900">{product.stock}</p>
                            <p className="text-xs text-slate-400">{t("seuil")}{" "}{product.alertThreshold}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={st.tone} dot>
                              {t(st.label)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="secondary" icon={FaExchangeAlt} onClick={() => setAdjusting(product)}>{t("Stock")}</Button>
                              <Button size="icon-sm" variant="ghost" onClick={() => setEditing(product)} aria-label={t("Modifier")}>
                                <FaEdit size={12} />
                              </Button>
                              <Button size="icon-sm" variant="danger-ghost" onClick={() => handleDelete(product)} aria-label={t("Supprimer")}>
                                <FaTrash size={11} />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Cartes (mobile) */}
              <ul className="divide-y divide-slate-100 md:hidden">
                {filtered.map((product) => {
                  const st = PRODUCT_STATUS[productStatus(product)];
                  return (
                    <li key={product.id} className="p-4">
                      <div className="flex gap-3">
                        <ProductThumb product={product} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-slate-800">{product.name}</p>
                            <Badge tone={st.tone}>{t(st.label)}</Badge>
                          </div>
                          <p className="text-xs text-slate-500">
                            {product.sku} · {product.category}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-sm">
                            <span className="tabular font-semibold text-slate-900">{formatMoney(product.price)}</span>
                            <span className="tabular text-slate-600">{t("Stock :")}{" "}{product.stock}</span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="secondary" className="flex-1" icon={FaExchangeAlt} onClick={() => setAdjusting(product)}>{t("Stock")}</Button>
                        <Button size="sm" variant="secondary" className="flex-1" icon={FaEdit} onClick={() => setEditing(product)}>{t("Modifier")}</Button>
                        <Button size="icon-sm" variant="danger-ghost" onClick={() => handleDelete(product)} aria-label={t("Supprimer")}>
                          <FaTrash size={11} />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
            {filtered.length}{" "}{t("produit(s) affiché(s) sur")}{" "}{state.products.length}
          </div>
        </Card>
      )}

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? t("Modifier le produit") : t("Nouveau produit")} size="lg">
        {editing && (
          <ProductForm
            initial={editing.id ? { ...editing, price: String(editing.price), minPrice: String(editing.minPrice), cost: String(editing.cost), stock: String(editing.stock), alertThreshold: String(editing.alertThreshold) } : undefined}
            categories={state.categories}
            suppliers={state.suppliers}
            products={state.products}
            defaultThreshold={state.settings.defaultAlertThreshold}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              actions.saveProduct(editing.id ? { ...data, id: editing.id } : data);
              toast.success(editing.id ? t("Produit mis à jour") : t("Produit créé"));
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <Modal isOpen={Boolean(adjusting)} onClose={() => setAdjusting(null)} title={t("Mouvement de stock")} description={t("Chaque mouvement est historisé.")}>
        {adjusting && (
          <AdjustStockForm
            product={adjusting}
            onCancel={() => setAdjusting(null)}
            onSubmit={(type, qty, reason) => {
              actions.adjustStock(adjusting.id, type, qty, reason);
              toast.success(t("{0} de {1} enregistrée", [type === "in" ? "Entrée" : "Sortie", qty]));
              setAdjusting(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
