import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaEdit, FaEnvelope, FaMapMarkerAlt, FaPhone, FaPlus, FaStar, FaTrash, FaTruck } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import Modal from "../../components/ui/Modal";
import { Field, Input, SearchInput, Select, Textarea } from "../../components/ui/Form";
import { formatMoney, matches } from "../../lib/format";
import { purchaseOrderTotal } from "../../store/selectors";

const emptySupplier = { name: "", contact: "", phone: "", email: "", category: "", address: "", status: "Actif", rating: 4, delay: 5, notes: "" };

function Stars({ value, onChange }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className={`${n <= value ? "text-amber-400" : "text-slate-200"} ${onChange ? "p-0.5 hover:scale-110" : "cursor-default"} transition`}
          aria-label={`${n} étoile${n > 1 ? "s" : ""}`}
        >
          <FaStar size={onChange ? 18 : 12} />
        </button>
      ))}
    </div>
  );
}

function SupplierForm({ initial, categories, onSubmit, onCancel }) {
  const [form, setForm] = useState({ ...emptySupplier, ...initial });
  const [errors, setErrors] = useState({});
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        const next = {};
        if (!form.name.trim()) next.name = "Nom obligatoire.";
        if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Email invalide.";
        setErrors(next);
        if (Object.keys(next).length) return;
        onSubmit({ ...form, name: form.name.trim(), delay: Number(form.delay) || 0 });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Raison sociale" error={errors.name} required>
          <Input value={form.name} onChange={set("name")} placeholder="TechDistrib SARL" />
        </Field>
        <Field label="Spécialité">
          <Select value={form.category} onChange={set("category")}>
            <option value="">—</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Contact principal">
          <Input value={form.contact} onChange={set("contact")} placeholder="Nom du contact" />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="6xx xx xx xx" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={set("email")} placeholder="commandes@fournisseur.cm" />
        </Field>
        <Field label="Délai de livraison moyen">
          <Input type="number" min="0" value={form.delay} onChange={set("delay")} suffix="jours" />
        </Field>
      </div>
      <Field label="Adresse">
        <Input value={form.address} onChange={set("address")} placeholder="Quartier, ville" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Statut">
          <Select value={form.status} onChange={set("status")}>
            <option>Actif</option>
            <option>En attente</option>
            <option>Suspendu</option>
          </Select>
        </Field>
        <Field label="Fiabilité">
          <Stars value={form.rating} onChange={(rating) => setForm((prev) => ({ ...prev, rating }))} />
        </Field>
      </div>
      <Field label="Notes internes">
        <Textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Conditions de paiement, remarques…" />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" icon={FaCheck}>
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

const statusTone = { Actif: "green", "En attente": "amber", Suspendu: "red" };

export default function AdminSuppliers() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState(null);

  const stats = useMemo(() => {
    const map = {};
    state.suppliers.forEach((s) => {
      const orders = state.purchaseOrders.filter((o) => o.supplierId === s.id);
      map[s.id] = {
        products: state.products.filter((p) => p.supplierId === s.id).length,
        purchased: orders.filter((o) => o.status === "received").reduce((sum, o) => sum + purchaseOrderTotal(o), 0),
        pending: orders.filter((o) => o.status === "sent").length,
      };
    });
    return map;
  }, [state.suppliers, state.products, state.purchaseOrders]);

  const list = state.suppliers.filter((s) => (status === "all" || s.status === status) && matches(search, s.name, s.contact, s.category, s.phone));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Stock"
        title="Fournisseurs"
        description="Contacts, fiabilité et volume d'achats de vos partenaires."
        actions={
          <Button icon={FaPlus} onClick={() => setEditing({})}>
            Nouveau fournisseur
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={status}
          onChange={setStatus}
          size="sm"
          options={[
            { value: "all", label: "Tous", count: state.suppliers.length },
            ...["Actif", "En attente", "Suspendu"].map((s) => ({ value: s, label: s, count: state.suppliers.filter((x) => x.status === s).length })),
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Nom, contact, spécialité…" className="sm:w-72" />
      </div>

      {list.length === 0 ? (
        <EmptyState icon={FaTruck} title="Aucun fournisseur" description="Ajoutez vos fournisseurs pour préparer vos commandes." action={<Button icon={FaPlus} onClick={() => setEditing({})}>Nouveau fournisseur</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((supplier) => {
            const s = stats[supplier.id] || {};
            return (
              <Card key={supplier.id} className="flex flex-col">
                <div className="flex items-start gap-3">
                  <Avatar name={supplier.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{supplier.name}</p>
                    <div className="mt-0.5 flex items-center gap-2">
                      <Stars value={supplier.rating} />
                      {supplier.category && <span className="truncate text-xs text-slate-500">{supplier.category}</span>}
                    </div>
                  </div>
                  <Badge tone={statusTone[supplier.status]} dot>
                    {supplier.status}
                  </Badge>
                </div>

                <div className="mt-4 space-y-1.5 text-[13px] text-slate-600">
                  {supplier.contact && <p className="font-medium text-slate-800">{supplier.contact}</p>}
                  {supplier.phone && (
                    <a href={`tel:${supplier.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-brand-600">
                      <FaPhone size={11} className="text-slate-400" /> {supplier.phone}
                    </a>
                  )}
                  {supplier.email && (
                    <a href={`mailto:${supplier.email}`} className="flex items-center gap-2 truncate hover:text-brand-600">
                      <FaEnvelope size={11} className="text-slate-400" /> {supplier.email}
                    </a>
                  )}
                  {supplier.address && (
                    <p className="flex items-center gap-2 truncate">
                      <FaMapMarkerAlt size={11} className="text-slate-400" /> {supplier.address}
                    </p>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
                  <div>
                    <p className="tabular text-sm font-bold text-slate-900">{s.products}</p>
                    <p className="text-[11px] text-slate-500">Produits</p>
                  </div>
                  <div>
                    <p className="tabular text-sm font-bold text-slate-900">{supplier.delay} j</p>
                    <p className="text-[11px] text-slate-500">Délai</p>
                  </div>
                  <div>
                    <p className="tabular truncate text-sm font-bold text-slate-900">{formatMoney(s.purchased)}</p>
                    <p className="text-[11px] text-slate-500">Achats reçus</p>
                  </div>
                </div>

                {supplier.notes && <p className="mt-3 line-clamp-2 text-xs italic text-slate-500">« {supplier.notes} »</p>}

                <div className="mt-auto flex items-center gap-2 pt-4">
                  {s.pending > 0 && <Badge tone="blue">{s.pending} livraison(s) attendue(s)</Badge>}
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="secondary" icon={FaEdit} onClick={() => setEditing(supplier)}>
                      Modifier
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="danger-ghost"
                      aria-label="Supprimer"
                      onClick={async () => {
                        const ok = await confirm({
                          title: "Supprimer ce fournisseur ?",
                          message: s.products ? `${s.products} produit(s) ne seront plus rattachés à un fournisseur.` : `« ${supplier.name} » sera supprimé.`,
                          confirmLabel: "Supprimer",
                        });
                        if (!ok) return;
                        actions.deleteSupplier(supplier.id);
                        toast.success("Fournisseur supprimé");
                      }}
                    >
                      <FaTrash size={11} />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? "Modifier le fournisseur" : "Nouveau fournisseur"} size="lg">
        {editing && (
          <SupplierForm
            initial={editing}
            categories={state.categories}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              actions.saveSupplier(editing.id ? { ...data, id: editing.id } : data);
              toast.success(editing.id ? "Fournisseur mis à jour" : "Fournisseur ajouté");
              setEditing(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}
