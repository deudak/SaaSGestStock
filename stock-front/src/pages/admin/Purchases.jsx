import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaClipboardList, FaEdit, FaLightbulb, FaPaperPlane, FaPlus, FaPrint, FaTimes, FaTrash, FaTruckLoading } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, CardHeader, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import Modal from "../../components/ui/Modal";
import { Field, Input, SearchInput, Select, Textarea } from "../../components/ui/Form";
import { addDays, formatDate, formatMoney, matches, toDateInput } from "../../lib/format";
import { printPurchaseOrder } from "../../lib/print";
import { PO_STATUS, lowStockProducts, purchaseOrderTotal } from "../../store/selectors";

function suggestedQty(product) {
  return Math.max(product.alertThreshold * 3 - product.stock, product.alertThreshold, 1);
}

function OrderForm({ initial, onSubmit, onCancel }) {
  const { state } = useStore();
  const [supplierId, setSupplierId] = useState(initial.supplierId || "");
  const [expectedAt, setExpectedAt] = useState(toDateInput(initial.expectedAt || addDays(new Date(), 5)));
  const [notes, setNotes] = useState(initial.notes || "");
  const [items, setItems] = useState(initial.items?.length ? initial.items : []);
  const [productToAdd, setProductToAdd] = useState("");

  const supplierProducts = state.products.filter((p) => !supplierId || p.supplierId === supplierId || items.some((i) => i.productId === p.id));
  const total = items.reduce((sum, item) => sum + item.qty * item.cost, 0);

  const addProduct = (productId) => {
    const product = state.products.find((p) => p.id === productId);
    if (!product || items.some((i) => i.productId === productId)) return;
    setItems((prev) => [...prev, { productId, name: product.name, qty: suggestedQty(product), cost: product.cost }]);
    setProductToAdd("");
  };

  const addAlerts = () => {
    const alerts = lowStockProducts(state.products).filter((p) => p.supplierId === supplierId && !items.some((i) => i.productId === p.id));
    if (!alerts.length) return toast("Aucun produit en alerte pour ce fournisseur.");
    setItems((prev) => [...prev, ...alerts.map((p) => ({ productId: p.id, name: p.name, qty: suggestedQty(p), cost: p.cost }))]);
  };

  const updateItem = (productId, field, value) => setItems((prev) => prev.map((i) => (i.productId === productId ? { ...i, [field]: Math.max(0, Number(value) || 0) } : i)));

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!supplierId) return toast.error("Choisissez un fournisseur.");
        const lines = items.filter((i) => i.qty > 0);
        if (!lines.length) return toast.error("Ajoutez au moins un article.");
        onSubmit({ supplierId, expectedAt: new Date(expectedAt).toISOString(), notes, items: lines });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fournisseur" required>
          <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Choisir…</option>
            {state.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Livraison souhaitée">
          <Input type="date" value={expectedAt} onChange={(e) => setExpectedAt(e.target.value)} />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-medium text-slate-700">Articles</p>
          {supplierId && (
            <Button size="xs" variant="ghost" icon={FaLightbulb} onClick={addAlerts}>
              Ajouter les produits en alerte
            </Button>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-slate-500">Aucun article. Sélectionnez un produit ci-dessous.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {items.map((item) => (
                <li key={item.productId} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <p className="w-full truncate text-sm font-medium text-slate-800 sm:w-auto sm:flex-1">{item.name}</p>
                  <div className="w-24">
                    <Input type="number" min="1" value={item.qty} onChange={(e) => updateItem(item.productId, "qty", e.target.value)} className="py-1.5" suffix="u." aria-label="Quantité" />
                  </div>
                  <div className="w-36 flex-1 sm:flex-none">
                    <Input type="number" min="0" value={item.cost} onChange={(e) => updateItem(item.productId, "cost", e.target.value)} className="py-1.5" suffix="F" aria-label="Prix d'achat unitaire" />
                  </div>
                  <Button size="icon-sm" variant="danger-ghost" onClick={() => setItems((prev) => prev.filter((i) => i.productId !== item.productId))} aria-label="Retirer">
                    <FaTimes size={11} />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 border-t border-slate-100 bg-slate-50/60 p-2.5">
            <Select value={productToAdd} onChange={(e) => addProduct(e.target.value)} className="py-2" aria-label="Ajouter un produit">
              <option value="">+ Ajouter un produit{supplierId ? " de ce fournisseur" : ""}…</option>
              {supplierProducts
                .filter((p) => !items.some((i) => i.productId === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (stock {p.stock})
                  </option>
                ))}
            </Select>
          </div>
        </div>
        <p className="mt-2 text-right text-sm text-slate-600">
          Total : <b className="tabular text-slate-900">{formatMoney(total)}</b>
        </p>
      </div>

      <Field label="Notes">
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Conditions, délais, contact…" />
      </Field>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" icon={FaCheck}>
          Enregistrer le bon
        </Button>
      </div>
    </form>
  );
}

export default function AdminPurchases() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

  const suppliersById = useMemo(() => Object.fromEntries(state.suppliers.map((s) => [s.id, s])), [state.suppliers]);

  const suggestions = useMemo(() => {
    const groups = {};
    lowStockProducts(state.products).forEach((product) => {
      const key = product.supplierId || "none";
      groups[key] = groups[key] || [];
      groups[key].push(product);
    });
    const pending = new Set(state.purchaseOrders.filter((o) => o.status === "draft" || o.status === "sent").flatMap((o) => o.items.map((i) => i.productId)));
    return Object.entries(groups)
      .map(([supplierId, products]) => ({ supplierId, products: products.filter((p) => !pending.has(p.id)) }))
      .filter((group) => group.products.length && group.supplierId !== "none");
  }, [state.products, state.purchaseOrders]);

  const counts = Object.fromEntries(Object.keys(PO_STATUS).map((k) => [k, state.purchaseOrders.filter((o) => o.status === k).length]));
  const list = state.purchaseOrders.filter((o) => (tab === "all" || o.status === tab) && matches(search, o.id, suppliersById[o.supplierId]?.name, ...o.items.map((i) => i.name)));
  const pendingValue = state.purchaseOrders.filter((o) => o.status === "sent").reduce((s, o) => s + purchaseOrderTotal(o), 0);

  const receive = async (order) => {
    const ok = await confirm({
      title: `Réceptionner ${order.id} ?`,
      message: `${order.items.reduce((s, i) => s + i.qty, 0)} article(s) seront ajoutés au stock et les prix d'achat mis à jour.`,
      confirmLabel: "Réceptionner",
      tone: "primary",
    });
    if (!ok) return;
    actions.setPurchaseOrderStatus(order.id, "received");
    toast.success("Marchandise réceptionnée, stock mis à jour");
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock"
        title="Approvisionnements"
        description="Bons de commande fournisseurs. La réception met automatiquement le stock à jour."
        actions={
          <Button icon={FaPlus} onClick={() => setEditing({})}>
            Nouveau bon de commande
          </Button>
        }
      />

      {suggestions.length > 0 && (
        <Card className="border-amber-200 bg-linear-to-br from-amber-50/80 to-white">
          <CardHeader title="Réapprovisionnement suggéré" subtitle="Produits sous le seuil d'alerte sans commande en cours" icon={FaLightbulb} tone="amber" />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {suggestions.map((group) => (
              <div key={group.supplierId} className="rounded-xl border border-amber-200/70 bg-white p-4">
                <p className="text-sm font-semibold text-slate-900">{suppliersById[group.supplierId]?.name}</p>
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {group.products.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2">
                      <span className="truncate">{p.name}</span>
                      <span className="tabular shrink-0 font-semibold text-rose-600">{p.stock} / {p.alertThreshold}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-3 w-full"
                  icon={FaPlus}
                  onClick={() => setEditing({ supplierId: group.supplierId, items: group.products.map((p) => ({ productId: p.id, name: p.name, qty: suggestedQty(p), cost: p.cost })) })}
                >
                  Préparer la commande
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={tab}
            onChange={setTab}
            size="sm"
            options={[{ value: "all", label: "Toutes", count: state.purchaseOrders.length }, ...Object.entries(PO_STATUS).map(([value, meta]) => ({ value, label: meta.label, count: counts[value] }))]}
          />
          <div className="flex items-center gap-3">
            <p className="hidden text-xs text-slate-500 xl:block">
              En attente de livraison : <b className="tabular text-slate-800">{formatMoney(pendingValue)}</b>
            </p>
            <SearchInput value={search} onChange={setSearch} placeholder="N°, fournisseur, article…" className="w-full lg:w-64" />
          </div>
        </div>

        {list.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={FaClipboardList} title="Aucun bon de commande" description="Créez un bon pour commander auprès d'un fournisseur." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((order) => {
              const supplier = suppliersById[order.supplierId];
              const status = PO_STATUS[order.status];
              const late = order.status === "sent" && new Date(order.expectedAt) < new Date();
              return (
                <li key={order.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-slate-900">{order.id}</span>
                      <Badge tone={status.tone} dot>
                        {status.label}
                      </Badge>
                      {late && <Badge tone="red">Livraison en retard</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{supplier?.name || "Fournisseur supprimé"}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      {order.items.map((i) => `${i.qty} × ${i.name}`).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm lg:w-64 lg:justify-end">
                    <div className="text-xs text-slate-500">
                      <p>Créé le {formatDate(order.createdAt)}</p>
                      <p>{order.status === "received" ? `Reçu le ${formatDate(order.receivedAt)}` : `Prévu le ${formatDate(order.expectedAt)}`}</p>
                    </div>
                    <p className="tabular ml-auto font-semibold text-slate-900 lg:ml-0">{formatMoney(purchaseOrderTotal(order))}</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 lg:w-75 lg:justify-end">
                    {order.status === "draft" && (
                      <>
                        <Button size="sm" icon={FaPaperPlane} onClick={() => { actions.setPurchaseOrderStatus(order.id, "sent"); toast.success(`${order.id} marqué comme envoyé`); }}>
                          Envoyer
                        </Button>
                        <Button size="icon-sm" variant="ghost" onClick={() => setEditing(order)} aria-label="Modifier">
                          <FaEdit size={12} />
                        </Button>
                      </>
                    )}
                    {order.status === "sent" && (
                      <Button size="sm" variant="success" icon={FaTruckLoading} onClick={() => receive(order)}>
                        Réceptionner
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" onClick={() => printPurchaseOrder(order, { settings: state.settings, supplier })} aria-label="Imprimer">
                      <FaPrint size={12} />
                    </Button>
                    {(order.status === "draft" || order.status === "sent") && (
                      <Button
                        size="icon-sm"
                        variant="danger-ghost"
                        aria-label="Annuler la commande"
                        onClick={async () => {
                          if (await confirm({ title: "Annuler ce bon de commande ?", message: "Le bon restera visible avec le statut « Annulée ».", confirmLabel: "Annuler le bon" })) {
                            actions.setPurchaseOrderStatus(order.id, "cancelled");
                            toast.success("Bon de commande annulé");
                          }
                        }}
                      >
                        <FaTimes size={12} />
                      </Button>
                    )}
                    {order.status === "cancelled" && (
                      <Button
                        size="icon-sm"
                        variant="danger-ghost"
                        aria-label="Supprimer"
                        onClick={async () => {
                          if (await confirm({ title: "Supprimer définitivement ?", message: `${order.id} sera supprimé.`, confirmLabel: "Supprimer" })) {
                            actions.deletePurchaseOrder(order.id);
                          }
                        }}
                      >
                        <FaTrash size={11} />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Modifier ${editing.id}` : "Nouveau bon de commande"} size="lg">
        {editing && (
          <OrderForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              const id = actions.savePurchaseOrder(editing.id ? { ...data, id: editing.id } : data);
              toast.success(editing.id ? "Bon de commande mis à jour" : `Bon ${id} créé en brouillon`);
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
