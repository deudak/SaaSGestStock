import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaEdit, FaKey, FaPlus, FaStore, FaTrash, FaUserCheck, FaUserSlash, FaUserTie } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Field, Input, SearchInput } from "../../components/ui/Form";
import { formatMoney, formatRelative, matches, startOfDay } from "../../lib/format";
import { activeSales, installmentRemaining, sumBy } from "../../store/selectors";

function VendorForm({ initial, onSubmit, onCancel }) {
  const isEdit = Boolean(initial.id);
  const [form, setForm] = useState({ name: "", email: "", phone: "", shop: "", ...initial, password: "" });
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
        if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Email invalide.";
        if (!isEdit && form.password.length < 6) next.password = "6 caractères minimum.";
        if (isEdit && form.password && form.password.length < 6) next.password = "6 caractères minimum.";
        setErrors(next);
        if (Object.keys(next).length) return;
        const result = onSubmit({ ...form, name: form.name.trim(), email: form.email.trim() });
        if (result && !result.ok) setErrors({ email: result.error });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet" error={errors.name} required>
          <Input value={form.name} onChange={set("name")} placeholder="Jean Vendeur" />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="6xx xx xx xx" />
        </Field>
      </div>
      <Field label="Email de connexion" error={errors.email} required>
        <Input type="email" value={form.email} onChange={set("email")} placeholder="vendeur@boutique.cm" />
      </Field>
      <Field label="Point de vente / boutique">
        <Input value={form.shop} onChange={set("shop")} placeholder="Boutique Akwa" />
      </Field>
      <Field label={isEdit ? "Nouveau mot de passe" : "Mot de passe"} error={errors.password} required={!isEdit} hint={isEdit ? "Laisser vide pour conserver l'actuel." : "Le vendeur pourra le modifier depuis son profil."}>
        <Input type="text" value={form.password} onChange={set("password")} placeholder={isEdit ? "••••••" : "6 caractères minimum"} autoComplete="new-password" />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" icon={FaCheck}>
          {isEdit ? "Enregistrer" : "Créer le compte"}
        </Button>
      </div>
    </form>
  );
}

export default function AdminVendors() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null);

  const monthStart = useMemo(() => {
    const d = startOfDay();
    d.setDate(1);
    return d;
  }, []);

  const vendors = useMemo(
    () =>
      state.users
        .filter((u) => u.role === "seller")
        .map((user) => {
          const sales = activeSales(state.sales).filter((s) => s.sellerId === user.id);
          const month = sales.filter((s) => new Date(s.date) >= monthStart);
          return {
            ...user,
            totalSales: sales.length,
            monthRevenue: sumBy(month, (s) => s.total),
            monthCount: month.length,
            receivables: sumBy(state.installments.filter((i) => i.sellerId === user.id && !i.cancelled), installmentRemaining),
            lastSale: sales.reduce((latest, s) => (!latest || s.date > latest ? s.date : latest), null),
          };
        })
        .filter((v) => matches(search, v.name, v.email, v.shop))
        .sort((a, b) => b.monthRevenue - a.monthRevenue),
    [state.users, state.sales, state.installments, search, monthStart]
  );

  const toggleStatus = async (vendor) => {
    const activating = vendor.status !== "actif";
    const ok = await confirm({
      title: activating ? "Réactiver ce compte ?" : "Désactiver ce compte ?",
      message: activating ? `${vendor.name} pourra à nouveau se connecter.` : `${vendor.name} ne pourra plus se connecter. Son historique est conservé.`,
      confirmLabel: activating ? "Réactiver" : "Désactiver",
      tone: activating ? "primary" : "danger",
    });
    if (!ok) return;
    actions.saveUser({ id: vendor.id, email: vendor.email, status: activating ? "actif" : "inactif" });
    toast.success(activating ? "Compte réactivé" : "Compte désactivé");
  };

  const remove = async (vendor) => {
    if (vendor.totalSales > 0) {
      toast.error("Ce vendeur a des ventes enregistrées : désactivez plutôt son compte.");
      return;
    }
    if (await confirm({ title: "Supprimer ce compte ?", message: `Le compte de ${vendor.name} sera supprimé définitivement.`, confirmLabel: "Supprimer" })) {
      actions.deleteUser(vendor.id);
      toast.success("Compte supprimé");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="Vendeurs"
        description="Comptes d'accès au point de vente et performance de l'équipe ce mois-ci."
        actions={
          <Button icon={FaPlus} onClick={() => setEditing({})}>
            Nouveau vendeur
          </Button>
        }
      />

      <SearchInput value={search} onChange={setSearch} placeholder="Rechercher un vendeur…" className="sm:max-w-sm" />

      {vendors.length === 0 ? (
        <EmptyState icon={FaUserTie} title="Aucun vendeur" description="Créez un compte pour chaque membre de votre équipe de vente." action={<Button icon={FaPlus} onClick={() => setEditing({})}>Nouveau vendeur</Button>} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {vendors.map((vendor) => {
            const active = vendor.status === "actif";
            return (
              <Card key={vendor.id} className={`flex flex-col ${active ? "" : "opacity-75"}`}>
                <div className="flex items-start gap-3">
                  <Avatar name={vendor.name} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{vendor.name}</p>
                    <p className="truncate text-xs text-slate-500">{vendor.email}</p>
                    {vendor.shop && (
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                        <FaStore size={10} className="text-slate-400" /> {vendor.shop}
                      </p>
                    )}
                  </div>
                  <Badge tone={active ? "green" : "slate"} dot>
                    {active ? "Actif" : "Inactif"}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">CA du mois</p>
                    <p className="tabular mt-0.5 truncate text-sm font-bold text-slate-900">{formatMoney(vendor.monthRevenue)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Ventes du mois</p>
                    <p className="tabular mt-0.5 text-sm font-bold text-slate-900">{vendor.monthCount}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Créances suivies</p>
                    <p className={`tabular mt-0.5 truncate text-sm font-bold ${vendor.receivables ? "text-amber-600" : "text-slate-900"}`}>{formatMoney(vendor.receivables)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-[11px] text-slate-500">Dernière vente</p>
                    <p className="mt-0.5 truncate text-sm font-bold text-slate-900">{vendor.lastSale ? formatRelative(vendor.lastSale) : "—"}</p>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                  <Button size="sm" variant="secondary" icon={FaEdit} onClick={() => setEditing(vendor)}>
                    Modifier
                  </Button>
                  <Button size="sm" variant="secondary" icon={FaKey} onClick={() => setEditing({ ...vendor, focusPassword: true })}>
                    Mot de passe
                  </Button>
                  <Button size="icon-sm" variant={active ? "danger-ghost" : "ghost"} onClick={() => toggleStatus(vendor)} aria-label={active ? "Désactiver" : "Réactiver"} title={active ? "Désactiver" : "Réactiver"}>
                    {active ? <FaUserSlash size={12} /> : <FaUserCheck size={12} />}
                  </Button>
                  <Button size="icon-sm" variant="danger-ghost" onClick={() => remove(vendor)} aria-label="Supprimer" title="Supprimer">
                    <FaTrash size={11} />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Modifier ${editing.name}` : "Nouveau vendeur"} description={editing?.id ? undefined : "Un compte de connexion vendeur sera créé."}>
        {editing && (
          <VendorForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              // eslint-disable-next-line no-unused-vars
              const { focusPassword, totalSales, monthRevenue, monthCount, receivables, lastSale, ...user } = data;
              const result = actions.saveUser(editing.id ? { ...user, id: editing.id } : { ...user, role: "seller", status: "actif" });
              if (result.ok) {
                toast.success(editing.id ? "Compte mis à jour" : `Compte créé pour ${user.name}`);
                setEditing(null);
              }
              return result;
            }}
          />
        )}
      </Modal>
    </div>
  );
}
