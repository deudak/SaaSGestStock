import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  FaCheck,
  FaCheckCircle,
  FaCreditCard,
  FaExchangeAlt,
  FaFileInvoice,
  FaMinus,
  FaMobileAlt,
  FaMoneyBillWave,
  FaPlus,
  FaReceipt,
  FaShoppingCart,
  FaTimes,
  FaTrash,
  FaUniversity,
  FaUserPlus,
} from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import ProductThumb from "../../components/ui/ProductThumb";
import { Field, Input, SearchInput, Select } from "../../components/ui/Form";
import CustomerForm from "../../components/pos/CustomerForm";
import { addDays, formatDate, formatMoney, matches, toDateInput } from "../../lib/format";
import { printReceipt, printSaleInvoice } from "../../lib/print";
import { productStatus } from "../../store/selectors";

const METHODS = [
  { id: "cash", label: "Espèces", icon: FaMoneyBillWave },
  { id: "mobile", label: "Mobile Money", icon: FaMobileAlt },
  { id: "card", label: "Carte", icon: FaCreditCard },
  { id: "transfer", label: "Virement", icon: FaUniversity },
];

function CartPanel({ cart, setCart, products, customers, settings, onCheckout, onNewCustomer, checkout, setCheckout, onClose }) {
  const subtotal = cart.reduce((sum, line) => sum + line.qty * line.price, 0);
  const maxDiscount = Math.floor((subtotal * (Number(settings.maxDiscountPercent) || 0)) / 100);
  const discount = Math.min(Math.max(0, Number(checkout.discount) || 0), maxDiscount);
  const total = subtotal - discount;
  const isCredit = checkout.mode === "credit";
  const deposit = Math.min(total, Math.max(0, Number(checkout.deposit) || 0));
  const received = Number(checkout.received) || 0;
  const invalidLines = cart.filter((line) => line.price < line.minPrice);
  const itemsCount = cart.reduce((sum, line) => sum + line.qty, 0);

  const updateLine = (productId, patch) => setCart((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  const changeQty = (productId, delta) => {
    const stock = products.find((p) => p.id === productId)?.stock ?? 0;
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.productId !== productId) return l;
          const qty = l.qty + delta;
          if (qty > stock) {
            toast.error(`Stock disponible : ${stock}`);
            return l;
          }
          return { ...l, qty };
        })
        .filter((l) => l.qty > 0)
    );
  };

  const set = (field) => (value) => setCheckout((prev) => ({ ...prev, [field]: value }));
  const canSubmit = cart.length > 0 && invalidLines.length === 0 && (!isCredit || (checkout.customerId && checkout.dueDate));

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
            <FaShoppingCart size={14} />
          </span>
          <div>
            <p className="text-[15px] font-semibold text-slate-900">Panier</p>
            <p className="text-xs text-slate-500">
              {itemsCount} article{itemsCount > 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {cart.length > 0 && (
            <Button size="xs" variant="danger-ghost" icon={FaTrash} onClick={() => setCart([])}>
              Vider
            </Button>
          )}
          {onClose && (
            <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-500" aria-label="Fermer le panier">
              <FaTimes size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="scrollbar-thin flex-1 overflow-y-auto px-5 py-4">
        {/* Client */}
        <div className="mb-4">
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="pos-customer" className="text-[13px] font-medium text-slate-700">
              Client {isCredit && <span className="text-rose-500">*</span>}
            </label>
            <button type="button" onClick={onNewCustomer} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
              <FaUserPlus size={10} /> Nouveau
            </button>
          </div>
          <Select id="pos-customer" value={checkout.customerId} onChange={(e) => set("customerId")(e.target.value)}>
            <option value="">Client de passage</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.phone}
              </option>
            ))}
          </Select>
        </div>

        {/* Lignes */}
        {cart.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-200 py-10 text-center">
            <FaShoppingCart size={26} className="text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-600">Panier vide</p>
            <p className="mt-0.5 text-xs text-slate-400">Touchez un produit pour l'ajouter</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {cart.map((line) => {
              const tooLow = line.price < line.minPrice;
              return (
                <li key={line.productId} className={`rounded-xl border p-3 ${tooLow ? "border-rose-300 bg-rose-50/50" : "border-slate-200"}`}>
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-slate-800">{line.name}</p>
                    <button type="button" onClick={() => setCart((prev) => prev.filter((l) => l.productId !== line.productId))} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Retirer ${line.name}`}>
                      <FaTimes size={11} />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                      <button type="button" onClick={() => changeQty(line.productId, -1)} className="flex h-8 w-8 items-center justify-center text-slate-500 hover:text-slate-900" aria-label="Diminuer">
                        <FaMinus size={9} />
                      </button>
                      <span className="tabular w-7 text-center text-sm font-semibold">{line.qty}</span>
                      <button type="button" onClick={() => changeQty(line.productId, 1)} className="flex h-8 w-8 items-center justify-center text-slate-500 hover:text-slate-900" aria-label="Augmenter">
                        <FaPlus size={9} />
                      </button>
                    </div>
                    <span className="text-xs text-slate-400">×</span>
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        value={line.price}
                        onChange={(e) => updateLine(line.productId, { price: Number(e.target.value) || 0 })}
                        className={`tabular h-8 w-full rounded-lg border bg-white pl-2.5 pr-6 text-right text-[13px] font-semibold outline-none focus:ring-4 ${tooLow ? "border-rose-400 text-rose-700 focus:ring-rose-500/10" : "border-slate-200 text-slate-800 focus:border-brand-500 focus:ring-brand-500/10"}`}
                        aria-label={`Prix unitaire de ${line.name}`}
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">F</span>
                    </div>
                    <span className="tabular w-24 text-right text-[13px] font-bold text-slate-900">{formatMoney(line.qty * line.price)}</span>
                  </div>
                  {tooLow ? (
                    <p className="mt-1.5 text-[11px] font-medium text-rose-600">Prix minimum autorisé : {formatMoney(line.minPrice)}</p>
                  ) : (
                    line.price !== line.listPrice && (
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        Prix catalogue {formatMoney(line.listPrice)} ·{" "}
                        <button type="button" className="font-semibold text-brand-600" onClick={() => updateLine(line.productId, { price: line.listPrice })}>
                          rétablir
                        </button>
                      </p>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {cart.length > 0 && (
          <div className="mt-5 space-y-4">
            {/* Remise */}
            {maxDiscount > 0 && (
              <Field label="Remise" hint={`Maximum ${settings.maxDiscountPercent} % soit ${formatMoney(maxDiscount)}`}>
                <Input type="number" min="0" max={maxDiscount} value={checkout.discount} onChange={(e) => set("discount")(e.target.value)} suffix="F" placeholder="0" />
              </Field>
            )}

            {/* Type de vente */}
            {settings.allowSellerCredit && (
              <div>
                <p className="mb-1.5 text-[13px] font-medium text-slate-700">Type de vente</p>
                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  {[
                    { value: "cash", label: "Comptant" },
                    { value: "credit", label: "Échelonné" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => set("mode")(option.value)}
                      className={`rounded-lg py-2 text-[13px] font-semibold transition ${checkout.mode === option.value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Paiement */}
            <div>
              <p className="mb-1.5 text-[13px] font-medium text-slate-700">{isCredit ? "Mode de paiement de l'acompte" : "Mode de paiement"}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => set("method")(m.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border px-1 py-2.5 text-[10px] font-semibold transition ${checkout.method === m.id ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                  >
                    <m.icon size={14} />
                    <span className="w-full truncate text-center">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {isCredit ? (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <Field label="Acompte versé">
                  <Input type="number" min="0" value={checkout.deposit} onChange={(e) => set("deposit")(e.target.value)} suffix="F" placeholder="0" />
                </Field>
                <Field label="Échéance">
                  <Input type="date" min={toDateInput()} value={checkout.dueDate} onChange={(e) => set("dueDate")(e.target.value)} />
                </Field>
                {!checkout.customerId && <p className="col-span-2 text-xs font-medium text-amber-700">Sélectionnez un client pour une vente échelonnée.</p>}
              </div>
            ) : (
              checkout.method === "cash" && (
                <Field label="Montant reçu" hint={received >= total && received > 0 ? `Monnaie à rendre : ${formatMoney(received - total)}` : undefined}>
                  <Input type="number" min="0" value={checkout.received} onChange={(e) => set("received")(e.target.value)} suffix="F" placeholder={String(total)} />
                </Field>
              )
            )}
          </div>
        )}
      </div>

      {/* Totaux */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Sous-total</span>
            <span className="tabular">{formatMoney(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Remise</span>
              <span className="tabular">− {formatMoney(discount)}</span>
            </div>
          )}
          {isCredit && cart.length > 0 && (
            <div className="flex justify-between text-amber-700">
              <span>Reste à payer après acompte</span>
              <span className="tabular">{formatMoney(total - deposit)}</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-700">{isCredit ? "Total de la vente" : "Total à payer"}</span>
          <span className="tabular text-2xl font-bold tracking-tight text-slate-900">{formatMoney(total)}</span>
        </div>
        <Button size="lg" variant="success" className="mt-3 w-full" icon={FaCheck} disabled={!canSubmit} onClick={() => onCheckout({ subtotal, discount, total, deposit })}>
          {isCredit ? `Valider · acompte ${formatMoney(deposit)}` : "Encaisser"}
        </Button>
        {invalidLines.length > 0 && <p className="mt-2 text-center text-xs font-medium text-rose-600">Corrigez les prix inférieurs au minimum autorisé.</p>}
      </div>
    </div>
  );
}

const initialCheckout = () => ({ customerId: "", method: "cash", mode: "cash", discount: "", deposit: "", received: "", dueDate: toDateInput(addDays(new Date(), 30)) });

export default function POS() {
  const { state, actions, currentUser } = useStore();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [cart, setCart] = useState([]);
  const [checkout, setCheckout] = useState(initialCheckout);
  const [cartOpen, setCartOpen] = useState(false);
  const [customerModal, setCustomerModal] = useState(false);
  const [lastSale, setLastSale] = useState(null);

  const products = useMemo(
    () =>
      state.products
        .filter((p) => (category === "all" || p.category === category) && matches(search, p.name, p.sku, p.category))
        .sort((a, b) => (b.stock > 0) - (a.stock > 0) || a.name.localeCompare(b.name, "fr")),
    [state.products, category, search]
  );
  const customers = useMemo(() => [...state.customers].sort((a, b) => a.name.localeCompare(b.name, "fr")), [state.customers]);

  const addToCart = (product) => {
    if (product.stock <= 0) return toast.error("Produit en rupture de stock");
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.qty >= product.stock) {
          toast.error(`Stock disponible : ${product.stock}`);
          return prev;
        }
        return prev.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { productId: product.id, name: product.name, qty: 1, price: product.price, listPrice: product.price, minPrice: product.minPrice }];
    });
  };

  const handleCheckout = ({ discount, total, deposit }) => {
    const customer = state.customers.find((c) => c.id === checkout.customerId);
    if (checkout.mode === "cash" && checkout.method === "cash" && checkout.received && Number(checkout.received) < total) {
      return toast.error("Le montant reçu est inférieur au total.");
    }
    const sale = actions.createSale({
      items: cart.map(({ productId, name, qty, price }) => ({ productId, name, qty, price })),
      customerId: customer?.id || null,
      customerName: customer?.name || "Client de passage",
      discount,
      method: checkout.method,
      mode: checkout.mode,
      deposit,
      dueDate: new Date(checkout.dueDate).toISOString(),
      sellerId: currentUser.id,
    });
    setLastSale({ sale, change: checkout.mode === "cash" && checkout.method === "cash" ? Math.max(0, (Number(checkout.received) || total) - total) : 0 });
    setCart([]);
    setCheckout(initialCheckout());
    setCartOpen(false);
  };

  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.qty * l.price, 0);

  const renderPanel = (onClose) => (
    <CartPanel
      onClose={onClose}
      cart={cart}
      setCart={setCart}
      products={state.products}
      customers={customers}
      settings={state.settings}
      checkout={checkout}
      setCheckout={setCheckout}
      onCheckout={handleCheckout}
      onNewCustomer={() => setCustomerModal(true)}
    />
  );

  const saleCustomer = lastSale && state.customers.find((c) => c.id === lastSale.sale.customerId);
  const saleInstallment = lastSale && state.installments.find((i) => i.id === lastSale.sale.installmentId);

  return (
    <div className="lg:grid lg:grid-cols-[1fr_400px] lg:gap-6">
      <section className="min-w-0 space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Point de vente</h1>
          <p className="mt-1 text-sm text-slate-500">Recherchez par nom ou référence, puis appuyez sur Entrée pour ajouter.</p>
        </div>

        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un produit ou scanner un code…"
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && products.length) {
              e.preventDefault();
              const exact = products.find((p) => p.sku.toLowerCase() === search.trim().toLowerCase()) || products[0];
              addToCart(exact);
              setSearch("");
            }
          }}
        />
        <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {["all", ...state.categories].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${category === c ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-slate-300"}`}
            >
              {c === "all" ? "Tous" : c}
            </button>
          ))}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-500">Aucun produit ne correspond à votre recherche.</div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {products.map((product) => {
              const inCart = cart.find((l) => l.productId === product.id);
              const st = productStatus(product);
              const out = st === "out";
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addToCart(product)}
                  disabled={out}
                  className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-card transition ${
                    inCart ? "border-brand-500 ring-2 ring-brand-500/20" : "border-slate-200/80 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  } ${out ? "cursor-not-allowed opacity-55" : ""}`}
                >
                  <div className="aspect-4/3 w-full p-2 pb-0">
                    <ProductThumb product={product} size="lg" />
                  </div>
                  {inCart && <span className="tabular absolute left-3 top-3 flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white shadow">{inCart.qty}</span>}
                  {st !== "ok" && (
                    <span className="absolute right-3 top-3">
                      <Badge tone={out ? "red" : "amber"}>{out ? "Rupture" : `Plus que ${product.stock}`}</Badge>
                    </span>
                  )}
                  <div className="flex flex-1 flex-col p-3">
                    <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-800">{product.name}</p>
                    <div className="mt-auto flex items-end justify-between gap-2 pt-2">
                      <span className="tabular text-[15px] font-bold text-brand-700">{formatMoney(product.price)}</span>
                      <span className="text-[11px] text-slate-400">{product.stock} en stock</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* Panier desktop */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 h-[calc(100vh-7.5rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-card">{renderPanel()}</div>
      </aside>

      {/* Barre panier mobile */}
      {cart.length > 0 && (
        <div className="fixed inset-x-3 bottom-19 z-30 lg:hidden">
          <button type="button" onClick={() => setCartOpen(true)} className="flex w-full items-center gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-pop">
            <span className="tabular flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/15 px-2 text-sm font-bold">{cartCount}</span>
            <span className="text-sm font-semibold">Voir le panier</span>
            <span className="tabular ml-auto text-base font-bold">{formatMoney(cartTotal)}</span>
          </button>
        </div>
      )}
      {cartOpen && (
        <div className="fixed inset-0 z-70 lg:hidden">
          <div className="absolute inset-0 animate-fade-in bg-slate-950/50" onClick={() => setCartOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 top-10 animate-pop-in overflow-hidden rounded-t-2xl bg-white">
            {renderPanel(() => setCartOpen(false))}
          </div>
        </div>
      )}

      <Modal isOpen={customerModal} onClose={() => setCustomerModal(false)} title="Nouveau client" size="lg">
        {customerModal && (
          <CustomerForm
            submitLabel="Créer et sélectionner"
            onCancel={() => setCustomerModal(false)}
            onSubmit={(data) => {
              const id = actions.saveCustomer(data);
              setCheckout((prev) => ({ ...prev, customerId: id }));
              setCustomerModal(false);
              toast.success("Client ajouté");
            }}
          />
        )}
      </Modal>

      <Modal isOpen={Boolean(lastSale)} onClose={() => setLastSale(null)} title="Vente enregistrée" size="sm">
        {lastSale && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <FaCheckCircle size={26} />
            </div>
            <p className="mt-3 font-mono text-sm font-semibold text-slate-500">{lastSale.sale.id}</p>
            <p className="tabular mt-1 text-3xl font-bold tracking-tight text-slate-900">{formatMoney(lastSale.sale.total)}</p>
            <p className="mt-1 text-sm text-slate-500">{lastSale.sale.customerName}</p>
            {lastSale.change > 0 && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                <FaExchangeAlt size={11} /> Monnaie à rendre : {formatMoney(lastSale.change)}
              </p>
            )}
            {lastSale.sale.mode === "credit" && (
              <div className="mt-4 rounded-xl bg-amber-50 p-3 text-left text-sm text-amber-800">
                <p>
                  Acompte : <b>{formatMoney(lastSale.sale.paid)}</b>
                </p>
                <p>
                  Reste : <b>{formatMoney(lastSale.sale.total - lastSale.sale.paid)}</b> avant le {formatDate(saleInstallment?.dueDate)}
                </p>
              </div>
            )}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={FaReceipt} onClick={() => printReceipt(lastSale.sale, { settings: state.settings, seller: currentUser })}>
                Ticket
              </Button>
              <Button variant="secondary" icon={FaFileInvoice} onClick={() => printSaleInvoice(lastSale.sale, { settings: state.settings, customer: saleCustomer, seller: currentUser, installment: saleInstallment })}>
                Facture
              </Button>
            </div>
            <Button
              className="mt-2 w-full"
              icon={FaPlus}
              onClick={() => {
                setLastSale(null);
                setTimeout(() => document.querySelector('input[type="search"]')?.focus(), 50);
              }}
            >
              Nouvelle vente
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
