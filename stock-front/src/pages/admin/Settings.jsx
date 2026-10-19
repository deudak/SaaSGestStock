import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { FaDatabase, FaDownload, FaFileInvoice, FaPalette, FaRedo, FaSave, FaStore, FaTrash, FaUpload, FaSlidersH } from "react-icons/fa";
import { useStore } from "../../store/StoreContext";
import { useConfirm } from "../../components/ui/Confirm";
import { Card, CardHeader, PageHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { Field, Input, Textarea, Toggle } from "../../components/ui/Form";
import { downloadBlob, todayStamp } from "../../lib/csv";
import { fileToDataUrl } from "../../lib/image";
import { BRAND_PRESETS, DEFAULT_BRAND_COLOR, brandBase, isHexColor, isTooLight } from "../../lib/branding";
import BrandLogo from "../../components/ui/BrandLogo";

import { t } from "../../i18n/index.js";

export default function AdminSettings() {
  const { state, actions, sync } = useStore();
  const confirm = useConfirm();
  const logoRef = useRef(null);
  const [form, setForm] = useState(state.settings);
  const dirty = JSON.stringify(form) !== JSON.stringify(state.settings);

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));
  const setValue = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const save = (event) => {
    event?.preventDefault();
    if (!form.shopName.trim()) return toast.error(t("Le nom de la boutique est obligatoire."));
    const normalized = {
      ...form,
      shopName: form.shopName.trim(),
      taxRate: Math.max(0, Number(form.taxRate) || 0),
      maxDiscountPercent: Math.min(100, Math.max(0, Number(form.maxDiscountPercent) || 0)),
      defaultAlertThreshold: Math.max(0, Number(form.defaultAlertThreshold) || 0),
    };
    actions.saveSettings(normalized);
    setForm({ ...state.settings, ...normalized });
    toast.success(t("Paramètres enregistrés"));
  };

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error(t("Choisissez un fichier image."));
    if (file.size > 5 * 1024 * 1024) return toast.error(t("Image trop lourde (5 Mo maximum)."));
    try {
      setValue("logo")(await fileToDataUrl(file, 400, 0.92, "image/png"));
    } catch (error) {
      toast.error(error.message);
    }
  };

  const exportBackup = () => {
    downloadBlob(new Blob([actions.exportData()], { type: "application/json" }), `sauvegarde-dym-stock-${todayStamp()}.json`);
    toast.success(t("Sauvegarde téléchargée"));
  };

  const reset = async () => {
    const ok = await confirm({
      title: t("Recharger les données depuis le serveur ?"),
      message: t("Les données de cet appareil seront remplacées par celles enregistrées sur le serveur. Les saisies faites hors ligne et pas encore synchronisées seront perdues : téléchargez une sauvegarde avant."),
      confirmLabel: t("Recharger"),
    });
    if (!ok) return;
    const result = await actions.resetData();
    if (!result.ok) return toast.error(result.error);
    toast.success(t("Données rechargées depuis le serveur"));
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader
        eyebrow={t("Organisation")}
        title={t("Paramètres")}
        description={t("Informations de la boutique, règles de vente et gestion des données.")}
        actions={
          <Button type="submit" icon={FaSave} disabled={!dirty}>{t("Enregistrer")}</Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Boutique")} subtitle={t("Apparaît sur les factures, tickets et bons de commande")} icon={FaStore} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Nom commercial")} required>
                <Input value={form.shopName} onChange={set("shopName")} />
              </Field>
              <Field label={t("Activité / slogan")}>
                <Input value={form.tagline} onChange={set("tagline")} />
              </Field>
              <Field label={t("Adresse")} className="sm:col-span-2">
                <Input value={form.address} onChange={set("address")} />
              </Field>
              <Field label={t("Téléphone")}>
                <Input value={form.phone} onChange={set("phone")} />
              </Field>
              <Field label={t("Email")}>
                <Input type="email" value={form.email} onChange={set("email")} />
              </Field>
              <Field label={t("Numéro d'identifiant fiscal (NIU)")}>
                <Input value={form.taxId} onChange={set("taxId")} />
              </Field>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("Identité visuelle")} subtitle={t("Visible par vous et vos vendeurs, et sur tous vos documents")} icon={FaPalette} tone="violet" />
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-4">
                <Field label={t("Logo")} hint={t("PNG, JPG ou SVG — fond transparent conseillé")}>
                  <div className="flex items-center gap-3">
                    <BrandLogo settings={form} className="h-14 w-14 border border-slate-200" />
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" icon={FaUpload} onClick={() => logoRef.current?.click()}>
                        {form.logo ? t("Changer") : t("Importer")}
                      </Button>
                      {form.logo && (
                        <Button size="sm" variant="danger-ghost" icon={FaTrash} onClick={() => setValue("logo")("")}>{t("Retirer")}</Button>
                      )}
                    </div>
                  </div>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                </Field>
                <Field label={t("Couleur principale")} hint={isTooLight(form.brandColor) ? t("Couleur claire : elle sera assombrie pour rester lisible.") : t("Boutons, menus et en-têtes de facture")}>
                  <div className="flex flex-wrap items-center gap-2">
                    {BRAND_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setValue("brandColor")(color)}
                        className={`h-7 w-7 rounded-full ring-offset-2 transition ${form.brandColor === color ? "ring-2 ring-slate-900" : "hover:scale-110"}`}
                        style={{ background: color }}
                        aria-label={t("Couleur {0}", [color])}
                      />
                    ))}
                    <input
                      type="color"
                      value={isHexColor(form.brandColor) ? form.brandColor : DEFAULT_BRAND_COLOR}
                      onChange={set("brandColor")}
                      className="h-7 w-10 cursor-pointer rounded border border-slate-200 bg-white"
                      aria-label={t("Couleur personnalisée")}
                    />
                  </div>
                </Field>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200" aria-label={t("Aperçu de l'en-tête de facture")}>
                <div className="flex items-start justify-between gap-3 border-b-2 bg-white p-4" style={{ borderColor: brandBase(form.brandColor) }}>
                  <div className="min-w-0">
                    {form.logo && <img src={form.logo} alt="" className="mb-2 max-h-10 max-w-[120px] object-contain" />}
                    <p className="truncate text-sm font-extrabold text-slate-900">{form.shopName || t("Nom commercial")}</p>
                    <p className="truncate text-[11px] text-slate-500">{form.tagline}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-slate-900">{t("Facture")}</p>
                    <p className="text-[11px] font-semibold" style={{ color: brandBase(form.brandColor) }}>{t("V-00042")}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-slate-50 p-4">
                  <span className="text-[11px] text-slate-500">{t("Aperçu")}</span>
                  <span className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: brandBase(form.brandColor) }}>{t("Nouvelle vente")}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title={t("Ventes & facturation")} subtitle={t("Règles appliquées au point de vente")} icon={FaFileInvoice} tone="green" />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("TVA incluse dans les prix")} hint={t("0 si non assujetti")}>
                <Input type="number" min="0" step="0.25" value={form.taxRate} onChange={set("taxRate")} suffix="%" />
              </Field>
              <Field label={t("Remise maximale vendeur")} hint={t("Sur le total du panier")}>
                <Input type="number" min="0" max="100" value={form.maxDiscountPercent} onChange={set("maxDiscountPercent")} suffix="%" />
              </Field>
              <Field label={t("Seuil d'alerte par défaut")} hint={t("Pour les nouveaux produits")}>
                <Input type="number" min="0" value={form.defaultAlertThreshold} onChange={set("defaultAlertThreshold")} />
              </Field>
            </div>
            <Field label={t("Mention de bas de facture")} className="mt-4">
              <Textarea value={form.invoiceFooter} onChange={set("invoiceFooter")} rows={2} />
            </Field>
          </Card>

          <Card>
            <CardHeader title={t("Options")} icon={FaSlidersH} tone="violet" />
            <div className="space-y-5">
              <Toggle checked={form.allowSellerCredit} onChange={setValue("allowSellerCredit")} label={t("Autoriser la vente à crédit")} description={t("Les vendeurs peuvent enregistrer des ventes avec acompte et échéance.")} />
              <Toggle checked={form.emailNotifications} onChange={setValue("emailNotifications")} label={t("Notifications par email")} description={t("Résumé quotidien des alertes de stock et des retards de paiement (nécessite l'API).")} />
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title={t("Données")} subtitle={t("Synchronisées avec le serveur")} icon={FaDatabase} tone="slate" />
            <div className="space-y-2.5 text-sm">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
                <span>{state.products.length}{" "}{t("produits")}</span>
                <span>{state.sales.length}{" "}{t("ventes")}</span>
                <span>{state.customers.length}{" "}{t("clients")}</span>
                <span>{state.installments.length}{" "}{t("créances")}</span>
              </div>
              <Button variant="secondary" className="w-full" icon={FaDownload} onClick={exportBackup}>{t("Télécharger une sauvegarde")}</Button>
              <p className="text-xs text-slate-500">
                {sync.pending ? t("{0} modification{1} de cet appareil en attente d'envoi au serveur.", [sync.pending, sync.pending > 1 ? "s" : ""]) : t("Toutes les modifications de cet appareil sont enregistrées sur le serveur.")}
              </p>
            </div>
          </Card>

          <Card className="border-rose-200">
            <CardHeader title={t("Zone sensible")} icon={FaRedo} tone="red" />
            <p className="mb-3 text-sm text-slate-600">{t("Remplace les données de cet appareil par celles du serveur.")}</p>
            <Button variant="danger" className="w-full" icon={FaRedo} onClick={reset}>{t("Recharger depuis le serveur")}</Button>
          </Card>
        </div>
      </div>

      {dirty && (
        <div className="sticky bottom-20 z-20 flex items-center justify-between gap-3 rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white shadow-pop lg:bottom-6">
          <span>{t("Modifications non enregistrées")}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setForm(state.settings)}>{t("Annuler")}</Button>
            <Button size="sm" type="submit" icon={FaSave}>{t("Enregistrer")}</Button>
          </div>
        </div>
      )}
    </form>
  );
}
