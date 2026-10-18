import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { FaCheck, FaEdit, FaKey, FaPlus, FaStore, FaTools, FaTrash, FaUserCheck, FaUserSlash, FaUserTie } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import Tabs from "../../components/ui/Tabs";
import { Field, Input, SearchInput, Select } from "../../components/ui/Form";
import { formatMoney, formatRelative, matches, startOfDay } from "../../lib/format";
import { ROLE_LABELS, activeSales, installmentRemaining, isAssignedTo, sumBy } from "../../store/selectors";

function VendorForm({ initial, onSubmit, onCancel }) {
  const isEdit = Boolean(initial.id);
  const [form, setForm] = useState({ name: "", email: "", phone: "", shop: "", role: "seller", ...initial, password: "" });
  const isTechnician = form.role === "technician";
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  return (
    <form
      className="space-y-4"
      noValidate
      onSubmit={async (event) => {
        event.preventDefault();
        const next = {};
        if (!form.name.trim()) next.name = "Nom obligatoire.";
        if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Email invalide.";
        if (!isEdit && form.password.length < 6) next.password = "6 caractères minimum.";
        if (isEdit && form.password && form.password.length < 6) next.password = "6 caractères minimum.";
        setErrors(next);
        if (Object.keys(next).length) return;
        setSaving(true);
        const result = await onSubmit({ ...form, name: form.name.trim(), email: form.email.trim() });
        setSaving(false);
        if (result && !result.ok) setErrors({ email: result.error });
      }}
    >
      <Field label="Rôle" hint={isTechnician ? "Accès aux interventions et aux équipements uniquement (ni ventes, ni stock, ni prix)." : "Accès au point de vente, aux clients et aux ventes."}>
        <Select value={form.role} onChange={set("role")}>
          <option value="seller">{ROLE_LABELS.seller}</option>
          <option value="technician">{ROLE_LABELS.technician}</option>
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet" error={errors.name} required>
          <Input value={form.name} onChange={set("name")} placeholder={isTechnician ? "Lucas Technicien" : "Jean Vendeur"} />
        </Field>
        <Field label="Téléphone">
          <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="6xx xx xx xx" />
        </Field>
      </div>
      <Field label="Email de connexion" error={errors.email} required>
        <Input type="email" value={form.email} onChange={set("email")} placeholder="vendeur@boutique.cm" />
      </Field>
      <Field label={isTechnician ? "Zone d'intervention / spécialité" : "Point de vente / boutique"}>
        <Input value={form.shop} onChange={set("shop")} placeholder={isTechnician ? "Froid & climatisation" : "Boutique Akwa"} />
      </Field>
      <Field label={isEdit ? "Nouveau mot de passe" : "Mot de passe"} error={errors.password} required={!isEdit} hint={isEdit ? "Laisser vide pour conserver l'actuel." : "Modifiable ensuite depuis son profil."}>
        <Input type="text" value={form.password} onChange={set("password")} placeholder={isEdit ? "••••••" : "6 caractères minimum"} autoComplete="new-password" />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" icon={FaCheck} disabled={saving}>
          {isEdit ? "Enregistrer" : "Créer le compte"}
        </Button>
      </div>
    </form>
  );
}

const TEAM_TABS = {
  seller: { title: "Vendeurs", empty: "Créez un compte pour chaque membre de votre équipe de vente.", icon: FaUserTie },
  technician: { title: "Maintenanciers", empty: "Créez un compte pour chaque technicien : il verra ses interventions et les pannes signalées.", icon: FaTools },
};

export default function AdminVendors() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("seller");
  const [editing, setEditing] = useState(null);

  const monthStart = useMemo(() => {
    const d = startOfDay();
    d.setDate(1);
    return d;
  }, []);

  const countByRole = (r) => state.users.filter((u) => u.role === r).length;

  const vendors = useMemo(
    () =>
      state.users
        .filter((u) => u.role === role)
        .map((user) => {
          if (user.role === "technician") {
            const open = state.maintenanceTasks.filter((t) => t.status !== "Terminé" && isAssignedTo(t, user));
            const done = state.maintenanceHistory.filter((h) => (h.technicianId ? h.technicianId === user.id : h.technician === user.name));
            const month = done.filter((h) => new Date(h.date) >= monthStart);
            const last = done.reduce((latest, h) => (!latest || h.date > latest ? h.date : latest), null);
            return {
              ...user,
              totalSales: 0,
              sortKey: open.length,
              stats: [
                { label: "Interventions ouvertes", value: open.length, warn: open.some((t) => new Date(t.date) < startOfDay()) },
                { label: "Terminées ce mois", value: month.length },
                { label: "Coût du mois", value: formatMoney(sumBy(month, (h) => h.cost)) },
                { label: "Dernière intervention", value: last ? formatRelative(last) : "—" },
              ],
            };
          }
          const sales = activeSales(state.sales).filter((s) => s.sellerId === user.id);
          const month = sales.filter((s) => new Date(s.date) >= monthStart);
          const receivables = sumBy(state.installments.filter((i) => i.sellerId === user.id && !i.cancelled), installmentRemaining);
          const lastSale = sales.reduce((latest, s) => (!latest || s.date > latest ? s.date : latest), null);
          const monthRevenue = sumBy(month, (s) => s.total);
          return {
            ...user,
            totalSales: sales.length,
            sortKey: monthRevenue,
            stats: [
              { label: "CA du mois", value: formatMoney(monthRevenue) },
              { label: "Ventes du mois", value: month.length },
              { label: "Créances suivies", value: formatMoney(receivables), warn: receivables > 0 },
              { label: "Dernière vente", value: lastSale ? formatRelative(lastSale) : "—" },
            ],
          };
        })
        .filter((v) => matches(search, v.name, v.email, v.shop))
        .sort((a, b) => b.sortKey - a.sortKey),
    [state.users, state.sales, state.installments, state.maintenanceTasks, state.maintenanceHistory, role, search, monthStart]
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
    const result = await actions.saveUser({ id: vendor.id, email: vendor.email, status: activating ? "actif" : "inactif" });
    if (!result.ok) return toast.error(result.error);
    toast.success(activating ? "Compte réactivé" : "Compte désactivé");
  };

  const remove = async (vendor) => {
    if (vendor.totalSales > 0) {
      toast.error("Ce vendeur a des ventes enregistrées : désactivez plutôt son compte.");
      return;
    }
    if (await confirm({ title: "Supprimer ce compte ?", message: `Le compte de ${vendor.name} sera supprimé définitivement.`, confirmLabel: "Supprimer" })) {
      const result = await actions.deleteUser(vendor.id);
      if (!result.ok) return toast.error(result.error);
      toast.success("Compte supprimé");
    }
  };

  const tabInfo = TEAM_TABS[role];
  const newMember = () => setEditing({ role });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="Équipe"
        description="Comptes de vos vendeurs et maintenanciers, et leur activité ce mois-ci."
        actions={
          <Button icon={FaPlus} onClick={newMember}>
            Nouveau membre
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={role}
          onChange={setRole}
          options={[
            { value: "seller", label: "Vendeurs", icon: FaUserTie, count: countByRole("seller") },
            { value: "technician", label: "Maintenanciers", icon: FaTools, count: countByRole("technician") },
          ]}
        />
        <SearchInput value={search} onChange={setSearch} placeholder="Rechercher…" className="sm:max-w-xs" />
      </div>

      {vendors.length === 0 ? (
        <EmptyState icon={tabInfo.icon} title={`Aucun ${role === "seller" ? "vendeur" : "maintenancier"}`} description={tabInfo.empty} action={<Button icon={FaPlus} onClick={newMember}>Créer un compte</Button>} />
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
                        {vendor.role === "technician" ? <FaTools size={10} className="text-slate-400" /> : <FaStore size={10} className="text-slate-400" />} {vendor.shop}
                      </p>
                    )}
                  </div>
                  <Badge tone={active ? "green" : "slate"} dot>
                    {active ? "Actif" : "Inactif"}
                  </Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  {vendor.stats.map((stat) => (
                    <div key={stat.label} className="rounded-xl bg-slate-50 p-3">
                      <p className="text-[11px] text-slate-500">{stat.label}</p>
                      <p className={`tabular mt-0.5 truncate text-sm font-bold ${stat.warn ? "text-amber-600" : "text-slate-900"}`}>{stat.value}</p>
                    </div>
                  ))}
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

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? `Modifier ${editing.name}` : "Nouveau membre de l'équipe"} description={editing?.id ? undefined : "Un compte de connexion sera créé dans votre entreprise."}>
        {editing && (
          <VendorForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (data) => {
              // eslint-disable-next-line no-unused-vars
              const { focusPassword, totalSales, sortKey, stats, ...user } = data;
              const result = await actions.saveUser(editing.id ? { ...user, id: editing.id } : { ...user, status: "actif" });
              if (result.ok) {
                toast.success(editing.id ? "Compte mis à jour" : `Compte ${ROLE_LABELS[user.role].toLowerCase()} créé pour ${user.name}`);
                if (!editing.id) setRole(user.role);
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
