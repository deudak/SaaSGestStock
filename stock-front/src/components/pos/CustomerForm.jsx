import { useState } from "react";
import { FaCheck } from "react-icons/fa";
import Button from "../ui/Button";
import { Field, Input, Textarea } from "../ui/Form";

/** Formulaire client réutilisé par la page Clients et le point de vente. */
export default function CustomerForm({ initial = {}, onSubmit, onCancel, submitLabel = "Enregistrer" }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", city: "", notes: "", ...initial });
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
        if (!form.phone.trim()) next.phone = "Téléphone obligatoire.";
        if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = "Email invalide.";
        setErrors(next);
        if (Object.keys(next).length) return;
        onSubmit({ ...form, name: form.name.trim(), phone: form.phone.trim() });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet / raison sociale" error={errors.name} required>
          <Input value={form.name} onChange={set("name")} placeholder="Ex : Jean Dupont" />
        </Field>
        <Field label="Téléphone" error={errors.phone} required>
          <Input type="tel" value={form.phone} onChange={set("phone")} placeholder="6xx xx xx xx" />
        </Field>
        <Field label="Email" error={errors.email}>
          <Input type="email" value={form.email} onChange={set("email")} placeholder="client@email.com" />
        </Field>
        <Field label="Ville">
          <Input value={form.city} onChange={set("city")} placeholder="Douala" />
        </Field>
      </div>
      <Field label="Notes">
        <Textarea value={form.notes} onChange={set("notes")} rows={2} placeholder="Préférences, informations utiles…" />
      </Field>
      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>
          Annuler
        </Button>
        <Button type="submit" icon={FaCheck}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
