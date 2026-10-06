import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { FaCrown, FaEdit, FaEnvelope, FaFileExport, FaMapMarkerAlt, FaPhone, FaPlus, FaTrash, FaUserPlus, FaUsers, FaWhatsapp, FaWallet } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, EmptyState, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge, { Avatar } from "../../components/ui/Badge";
import Tabs from "../../components/ui/Tabs";
import Modal from "../../components/ui/Modal";
import StatCard from "../../components/ui/StatCard";
import { SearchInput, Select } from "../../components/ui/Form";
import CustomerForm from "../../components/pos/CustomerForm";
import { formatDate, formatMoney, formatRelative, matches } from "../../lib/format";
import { downloadCSV, todayStamp } from "../../lib/csv";
import { CUSTOMER_SEGMENTS, INSTALLMENT_STATUS, customerStats, installmentRemaining, installmentStatus } from "../../store/selectors";

function whatsappLink(phone) {
  const digits = phone.replace(/\D/g, "");
  return `https://wa.me/${digits.length === 9 ? `237${digits}` : digits}`;
}

export default function Customers() {
  const { state, actions, currentUser } = useStore();
  const confirm = useConfirm();
  const base = currentUser.role === "admin" ? "/admin" : "/seller";
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [sort, setSort] = useState("spent");
  const [editing, setEditing] = useState(null);
  const [detailId, setDetailId] = useState(null);

  const customers = useMemo(
    () => state.customers.map((customer) => ({ ...customer, stats: customerStats(customer, state.sales, state.installments) })),
    [state.customers, state.sales, state.installments]
  );

  const counts = useMemo(() => {
    const c = { all: customers.length, debt: customers.filter((x) => x.stats.debt > 0).length };
    Object.keys(CUSTOMER_SEGMENTS).forEach((k) => {
      c[k] = customers.filter((x) => x.stats.segment === k).length;
    });
    return c;
  }, [customers]);

  const list = useMemo(() => {
    const sorters = {
      spent: (a, b) => b.stats.spent - a.stats.spent,
      recent: (a, b) => (b.stats.lastSale || "").localeCompare(a.stats.lastSale || ""),
      name: (a, b) => a.name.localeCompare(b.name, "fr"),
      debt: (a, b) => b.stats.debt - a.stats.debt,
    };
    return customers
      .filter((c) => (segment === "all" ? true : segment === "debt" ? c.stats.debt > 0 : c.stats.segment === segment))
      .filter((c) => matches(search, c.name, c.phone, c.city, c.email))
      .sort(sorters[sort]);
  }, [customers, segment, search, sort]);

  const totalDebt = customers.reduce((s, c) => s + c.stats.debt, 0);
  const detail = customers.find((c) => c.id === detailId);
  const detailInstallments = detail ? state.installments.filter((i) => i.customerId === detail.id && !i.cancelled) : [];

  const remove = async (customer) => {
    if (customer.stats.orders > 0) return toast.error("Ce client a un historique d'achats et ne peut pas être supprimé.");
    if (await confirm({ title: "Supprimer ce client ?", message: `${customer.name} sera supprimé de votre fichier.`, confirmLabel: "Supprimer" })) {
      actions.deleteCustomer(customer.id);
      setDetailId(null);
      toast.success("Client supprimé");
    }
  };

  const exportCustomers = () =>
    downloadCSV(`clients-${todayStamp()}`, list, [
      { label: "Nom", value: (c) => c.name },
      { label: "Téléphone", value: (c) => c.phone },
      { label: "Email", value: (c) => c.email },
      { label: "Ville", value: (c) => c.city },
      { label: "Segment", value: (c) => CUSTOMER_SEGMENTS[c.stats.segment].label },
      { label: "Achats", value: (c) => c.stats.orders },
      { label: "Total dépensé", value: (c) => c.stats.spent },
      { label: "Reste dû", value: (c) => c.stats.debt },
      { label: "Dernier achat", value: (c) => (c.stats.lastSale ? formatDate(c.stats.lastSale) : "") },
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Clientèle"
        title="Clients"
        description="Fichier clients, historique d'achats et encours de crédit."
        actions={
          <>
            <Button variant="secondary" icon={FaFileExport} onClick={exportCustomers}>
              Exporter
            </Button>
            <Button icon={FaUserPlus} onClick={() => setEditing({})}>
              Nouveau client
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatCard title="Clients" value={customers.length} icon={FaUsers} hint={`${counts.new} nouveau(x) ce mois`} />
        <StatCard title="Clients VIP" value={counts.vip} icon={FaCrown} tone="amber" hint="≥ 500 000 F ou 10 achats" onClick={() => setSegment("vip")} />
        <StatCard title="Clients endettés" value={counts.debt} icon={FaWallet} tone="red" hint={`${formatMoney(totalDebt)} à recouvrer`} onClick={() => setSegment("debt")} />
        <StatCard title="Inactifs" value={counts.inactive} icon={FaUsers} tone="slate" hint="Sans achat depuis 45 jours" onClick={() => setSegment("inactive")} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={segment}
          onChange={setSegment}
          size="sm"
          options={[
            { value: "all", label: "Tous", count: counts.all },
            ...Object.entries(CUSTOMER_SEGMENTS).map(([value, meta]) => ({ value, label: meta.label, count: counts[value] })),
            { value: "debt", label: "Avec dette", count: counts.debt },
          ]}
        />
        <div className="flex gap-2">
          <SearchInput value={search} onChange={setSearch} placeholder="Nom, téléphone, ville…" className="flex-1 lg:w-64" />
          <Select value={sort} onChange={(e) => setSort(e.target.value)} className="w-40" aria-label="Trier">
            <option value="spent">Plus gros acheteurs</option>
            <option value="recent">Achat récent</option>
            <option value="debt">Dette décroissante</option>
            <option value="name">Nom (A-Z)</option>
          </Select>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={FaUsers} title="Aucun client trouvé" description="Modifiez la recherche ou ajoutez un nouveau client." action={<Button icon={FaPlus} onClick={() => setEditing({})}>Nouveau client</Button>} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((customer) => {
            const seg = CUSTOMER_SEGMENTS[customer.stats.segment];
            return (
              <Card
                key={customer.id}
                role="button"
                tabIndex={0}
                className="flex cursor-pointer flex-col outline-none transition hover:border-slate-300 hover:shadow-md focus-visible:ring-4 focus-visible:ring-brand-500/20"
                onClick={() => setDetailId(customer.id)}
                onKeyDown={(e) => e.key === "Enter" && setDetailId(customer.id)}
              >
                <div className="flex items-start gap-3">
                  <Avatar name={customer.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{customer.name}</p>
                    <p className="truncate text-xs text-slate-500">
                      {customer.phone}
                      {customer.city && ` · ${customer.city}`}
                    </p>
                  </div>
                  <Badge tone={seg.tone} icon={customer.stats.segment === "vip" ? FaCrown : undefined}>
                    {seg.label}
                  </Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 py-2">
                    <p className="tabular text-sm font-bold text-slate-900">{customer.stats.orders}</p>
                    <p className="text-[11px] text-slate-500">Achats</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 py-2">
                    <p className="tabular truncate px-1 text-sm font-bold text-slate-900">{formatMoney(customer.stats.spent)}</p>
                    <p className="text-[11px] text-slate-500">Dépensé</p>
                  </div>
                  <div className={`rounded-lg py-2 ${customer.stats.debt ? "bg-amber-50" : "bg-slate-50"}`}>
                    <p className={`tabular truncate px-1 text-sm font-bold ${customer.stats.debt ? "text-amber-700" : "text-slate-900"}`}>{formatMoney(customer.stats.debt)}</p>
                    <p className="text-[11px] text-slate-500">Dette</p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">{customer.stats.lastSale ? `Dernier achat ${formatRelative(customer.stats.lastSale)}` : "Aucun achat pour l'instant"}</p>
              </Card>
            );
          })}
        </div>
      )}

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? "Modifier le client" : "Nouveau client"} size="lg">
        {editing && (
          <CustomerForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={(data) => {
              // eslint-disable-next-line no-unused-vars
              const { stats, ...customer } = data;
              actions.saveCustomer(editing.id ? { ...customer, id: editing.id } : customer);
              toast.success(editing.id ? "Client mis à jour" : "Client ajouté");
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail?.name}
        description={detail ? `Client depuis le ${formatDate(detail.createdAt)}` : ""}
        size="lg"
        footer={
          detail && (
            <>
              <Button variant="danger-ghost" icon={FaTrash} onClick={() => remove(detail)} className="sm:mr-auto">
                Supprimer
              </Button>
              <Button
                variant="secondary"
                icon={FaEdit}
                onClick={() => {
                  setEditing(detail);
                  setDetailId(null);
                }}
              >
                Modifier
              </Button>
              {currentUser.role === "seller" && (
                <Button to="/seller/pos" icon={FaPlus}>
                  Nouvelle vente
                </Button>
              )}
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <a href={`tel:${detail.phone.replace(/\s/g, "")}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                <FaPhone size={11} className="text-slate-400" /> {detail.phone}
              </a>
              <a href={whatsappLink(detail.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
                <FaWhatsapp size={13} /> WhatsApp
              </a>
              {detail.email && (
                <a href={`mailto:${detail.email}`} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
                  <FaEnvelope size={11} className="text-slate-400" /> {detail.email}
                </a>
              )}
              {detail.city && (
                <span className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700">
                  <FaMapMarkerAlt size={11} className="text-slate-400" /> {detail.city}
                </span>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Achats", value: detail.stats.orders },
                { label: "Total dépensé", value: formatMoney(detail.stats.spent) },
                { label: "Reste dû", value: formatMoney(detail.stats.debt), warn: detail.stats.debt > 0 },
              ].map((item) => (
                <div key={item.label} className={`rounded-xl p-3 ${item.warn ? "bg-amber-50" : "bg-slate-50"}`}>
                  <p className="text-[11px] text-slate-500">{item.label}</p>
                  <p className={`tabular mt-0.5 truncate font-bold ${item.warn ? "text-amber-700" : "text-slate-900"}`}>{item.value}</p>
                </div>
              ))}
            </div>

            {detail.notes && <p className="rounded-xl bg-slate-50 p-3 text-sm italic text-slate-600">{detail.notes}</p>}

            {detailInstallments.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Paiements échelonnés</p>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
                  {detailInstallments.map((inst) => {
                    const st = INSTALLMENT_STATUS[installmentStatus(inst)];
                    return (
                      <li key={inst.id}>
                        <Link to={`${base}/installments?id=${inst.id}`} className="flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-slate-50">
                          <span className="font-mono text-xs font-semibold text-slate-500">{inst.id}</span>
                          <span className="min-w-0 flex-1 truncate text-slate-700">{inst.label}</span>
                          <span className="tabular font-semibold text-slate-900">{formatMoney(installmentRemaining(inst))}</span>
                          <Badge tone={st.tone}>{st.label}</Badge>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Historique d'achats</p>
              {detail.stats.sales.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun achat enregistré.</p>
              ) : (
                <ul className="scrollbar-thin max-h-64 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {[...detail.stats.sales]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((sale) => (
                      <li key={sale.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-slate-800">{sale.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}</p>
                          <p className="text-xs text-slate-500">
                            {sale.id} · {formatDate(sale.date)}
                          </p>
                        </div>
                        <span className="tabular font-semibold text-slate-900">{formatMoney(sale.total)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
