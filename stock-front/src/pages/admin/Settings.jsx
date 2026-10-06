import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { FaDatabase, FaDownload, FaFileInvoice, FaRedo, FaSave, FaStore, FaUpload, FaSlidersH } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, CardHeader, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Field, Input, Textarea, Toggle } from "../../components/ui/Form";
import { downloadBlob, todayStamp } from "../../lib/csv";

export default function AdminSettings() {
  const { state, actions } = useStore();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const fileRef = useRef(null);
  const [form, setForm] = useState(state.settings);
  const dirty = JSON.stringify(form) !== JSON.stringify(state.settings);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const setValue = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const save = (event) => {
    event?.preventDefault();
    if (!form.shopName.trim()) return toast.error("Le nom de la boutique est obligatoire.");
    const normalized = {
      ...form,
      shopName: form.shopName.trim(),
      taxRate: Math.max(0, Number(form.taxRate) || 0),
      maxDiscountPercent: Math.min(100, Math.max(0, Number(form.maxDiscountPercent) || 0)),
      defaultAlertThreshold: Math.max(0, Number(form.defaultAlertThreshold) || 0),
    };
    actions.saveSettings(normalized);
    setForm({ ...state.settings, ...normalized });
    toast.success("Paramètres enregistrés");
  };

  const exportBackup = () => {
    downloadBlob(new Blob([actions.exportData()], { type: "application/json" }), `sauvegarde-dym-stock-${todayStamp()}.json`);
    toast.success("Sauvegarde téléchargée");
  };

  const importBackup = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const ok = await confirm({ title: "Restaurer cette sauvegarde ?", message: "Toutes les données actuelles seront remplacées par celles du fichier.", confirmLabel: "Restaurer" });
    if (!ok) return;
    try {
      actions.importData(await file.text());
      toast.success("Données restaurées");
    } catch (error) {
      toast.error(error.message || "Fichier invalide");
    }
  };

  const reset = async () => {
    const ok = await confirm({
      title: "Réinitialiser toutes les données ?",
      message: "Produits, ventes, clients et réglages seront remplacés par les données de démonstration. Vous serez déconnecté. Pensez à télécharger une sauvegarde avant.",
      confirmLabel: "Tout réinitialiser",
    });
    if (!ok) return;
    actions.resetData();
    navigate("/login", { replace: true });
    toast.success("Données réinitialisées");
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader
        eyebrow="Organisation"
        title="Paramètres"
        description="Informations de la boutique, règles de vente et gestion des données."
        actions={
          <Button type="submit" icon={FaSave} disabled={!dirty}>
            Enregistrer
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Boutique" subtitle="Apparaît sur les factures, tickets et bons de commande" icon={FaStore} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom commercial" required>
                <Input value={form.shopName} onChange={set("shopName")} />
              </Field>
              <Field label="Activité / slogan">
                <Input value={form.tagline} onChange={set("tagline")} />
              </Field>
              <Field label="Adresse" className="sm:col-span-2">
                <Input value={form.address} onChange={set("address")} />
              </Field>
              <Field label="Téléphone">
                <Input value={form.phone} onChange={set("phone")} />
              </Field>
              <Field label="Email">
                <Input type="email" value={form.email} onChange={set("email")} />
              </Field>
              <Field label="Numéro d'identifiant fiscal (NIU)">
                <Input value={form.taxId} onChange={set("taxId")} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title="Ventes & facturation" subtitle="Règles appliquées au point de vente" icon={FaFileInvoice} tone="green" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="TVA incluse dans les prix" hint="0 si non assujetti">
                <Input type="number" min="0" step="0.25" value={form.taxRate} onChange={set("taxRate")} suffix="%" />
              </Field>
              <Field label="Remise maximale vendeur" hint="Sur le total du panier">
                <Input type="number" min="0" max="100" value={form.maxDiscountPercent} onChange={set("maxDiscountPercent")} suffix="%" />
              </Field>
              <Field label="Seuil d'alerte par défaut" hint="Pour les nouveaux produits">
                <Input type="number" min="0" value={form.defaultAlertThreshold} onChange={set("defaultAlertThreshold")} />
              </Field>
            </div>
            <Field label="Mention de bas de facture" className="mt-4">
              <Textarea value={form.invoiceFooter} onChange={set("invoiceFooter")} rows={2} />
            </Field>
          </Card>

          <Card>
            <CardHeader title="Options" icon={FaSlidersH} tone="violet" />
            <div className="space-y-5">
              <Toggle checked={form.allowSellerCredit} onChange={setValue("allowSellerCredit")} label="Autoriser la vente à crédit" description="Les vendeurs peuvent enregistrer des ventes avec acompte et échéance." />
              <Toggle checked={form.emailNotifications} onChange={setValue("emailNotifications")} label="Notifications par email" description="Résumé quotidien des alertes de stock et des retards de paiement (nécessite l'API)." />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Données" subtitle="Sauvegarde et restauration" icon={FaDatabase} tone="slate" />
            <div className="space-y-2.5 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <span>{state.products.length} produits</span>
                <span>{state.sales.length} ventes</span>
                <span>{state.customers.length} clients</span>
                <span>{state.installments.length} créances</span>
              </div>
              <Button variant="secondary" className="w-full" icon={FaDownload} onClick={exportBackup}>
                Télécharger une sauvegarde
              </Button>
              <Button variant="secondary" className="w-full" icon={FaUpload} onClick={() => fileRef.current?.click()}>
                Restaurer une sauvegarde
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={importBackup} />
            </div>
          </Card>

          <Card className="border-rose-200">
            <CardHeader title="Zone sensible" icon={FaRedo} tone="red" />
            <p className="mb-3 text-sm text-slate-600">Remet l'application dans son état de démonstration initial.</p>
            <Button variant="danger" className="w-full" icon={FaRedo} onClick={reset}>
              Réinitialiser les données
            </Button>
          </Card>
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-pop lg:bottom-6">
          <span>Modifications non enregistrées</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setForm(state.settings)}>
              Annuler
            </Button>
            <Button size="sm" type="submit" icon={FaSave}>
              Enregistrer
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
