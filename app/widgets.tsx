"use client";
import { useState, type ReactNode } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { rulesSchema, type Rules } from "@/lib/game";
export function Picker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (s: string) => void;
  options: { value: string; label: string }[];
  label: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="picker" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent position="popper">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="app-modal">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Confirm({
  title,
  description,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>{title}</AlertDialogTitle>
        <AlertDialogDescription>{description}</AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirmer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function RulesEditor({
  initial,
  onSave,
  busy,
}: {
  initial: Rules;
  onSave: (r: Rules) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(initial),
    [error, setError] = useState("");
  const fields: {
    key: keyof Rules;
    label: string;
    hint: string;
    min: number;
    max: number;
  }[] = [
    {
      key: "periods",
      label: "Nombre de périodes",
      hint: "De 1 à 12 périodes",
      min: 1,
      max: 12,
    },
    {
      key: "minutes",
      label: "Durée d’une période",
      hint: "En minutes",
      min: 1,
      max: 60,
    },
    {
      key: "overtime",
      label: "Durée d’une prolongation",
      hint: "En minutes, en cas d’égalité",
      min: 1,
      max: 30,
    },
    {
      key: "onCourt",
      label: "Joueurs sur le terrain",
      hint: "Pour le 3×3, le 4×4 ou le 5×5",
      min: 1,
      max: 5,
    },
    {
      key: "foulLimit",
      label: "Fautes avant exclusion",
      hint: "Le joueur ne peut plus marquer une fois exclu",
      min: 1,
      max: 12,
    },
    {
      key: "teamFouls",
      label: "Seuil de fautes d’équipe",
      hint: "Alerte bonus par période ; prolongations rattachées à la dernière",
      min: 1,
      max: 20,
    },
    {
      key: "timeouts",
      label: "Temps morts par équipe",
      hint: "Quota pour l’ensemble du match",
      min: 0,
      max: 12,
    },
    {
      key: "pointCap",
      label: "Plafond des joueurs limités",
      hint: "Points de tirs uniquement. Les lancers francs restent autorisés.",
      min: 1,
      max: 100,
    },
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const r = rulesSchema.safeParse(draft);
        if (r.success) {
          setError("");
          onSave(r.data);
        } else setError("Vérifiez les valeurs du règlement.");
      }}
    >
      <div className="form-grid">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <input
              type="number"
              min={f.min}
              max={f.max}
              required
              value={draft[f.key]}
              onChange={(e) =>
                setDraft({ ...draft, [f.key]: Number(e.target.value) })
              }
            />
          </Field>
        ))}
      </div>
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button disabled={busy} className="button primary" type="submit">
          Enregistrer le règlement
        </button>
      </div>
    </form>
  );
}
export const download = (filename: string, content: string, type: string) => {
  const u = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = u;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 1000);
};
