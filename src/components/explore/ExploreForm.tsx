"use client";

import { Baby, Bike, Bus, Car, CarTaxiFront, Footprints, Loader2, Minus, Plus, Sparkles } from "lucide-react";
import { INTERESTS } from "@/lib/categories";
import type { BudgetMode, Interest, Transport } from "@/lib/types";
import type { HomeBase } from "@/lib/store-types";
import { LocationPicker, type PickedLocation } from "@/components/LocationPicker";
import { cn } from "@/lib/cn";

export interface FormState {
  location: PickedLocation | null;
  date: string;
  slot: "morning" | "afternoon" | "evening" | "custom";
  startTime: string; // HH:MM
  hours: number;
  budget: number;
  budgetMode: BudgetMode;
  adults: number;
  kids: number[]; // ages
  transport: Transport;
  interests: Interest[];
}

export const SLOTS = {
  morning: { label: "Morning", time: "09:00", hint: "from 9am" },
  afternoon: { label: "Afternoon", time: "13:00", hint: "from 1pm" },
  evening: { label: "Evening", time: "18:00", hint: "from 6pm" },
  custom: { label: "Pick a time", time: "", hint: "" },
} as const;

const TRANSPORTS: { key: Transport; label: string; Icon: typeof Car }[] = [
  { key: "walk", label: "Walk", Icon: Footprints },
  { key: "bike", label: "Bike", Icon: Bike },
  { key: "transit", label: "Transit", Icon: Bus },
  { key: "drive", label: "Drive", Icon: Car },
  { key: "rideshare", label: "Rideshare", Icon: CarTaxiFront },
];

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <p className="text-sm font-semibold text-ink mb-2">
      {children}
      {hint && <span className="font-normal text-muted"> · {hint}</span>}
    </p>
  );
}

function Stepper({ value, onChange, min, max, label }: { value: number; onChange: (n: number) => void; min: number; max: number; label: string }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-line bg-card px-3 py-2">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="size-8 rounded-full border border-line grid place-items-center disabled:opacity-30 hover:bg-mist">
          <Minus className="size-3.5" />
        </button>
        <span className="w-5 text-center font-semibold tabular-nums">{value}</span>
        <button type="button" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="size-8 rounded-full border border-line grid place-items-center disabled:opacity-30 hover:bg-mist">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}

export function ExploreForm({
  form,
  setForm,
  onSubmit,
  loading,
  homeBase,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  onSubmit: () => void;
  loading: boolean;
  homeBase?: HomeBase | null;
}) {
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm({ ...form, [k]: v });
  const people = form.adults + form.kids.length;
  const total = form.budgetMode === "per_person" ? form.budget * people : form.budget;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="space-y-6"
    >
      <div>
        <Label>Where</Label>
        <LocationPicker value={form.location} onChange={(l) => set("location", l)} homeBase={homeBase} usOnly />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>When</Label>
          <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} required className="w-full rounded-2xl border border-line bg-card px-3 py-2.5" />
        </div>
        <div>
          <Label hint={`${form.hours} hour${form.hours === 1 ? "" : "s"}`}>How much time</Label>
          <input type="range" min={1} max={12} step={0.5} value={form.hours} onChange={(e) => set("hours", Number(e.target.value))} className="w-full mt-3" aria-label="Hours available" />
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SLOTS) as FormState["slot"][]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setForm({ ...form, slot: s, startTime: SLOTS[s].time || form.startTime })}
              className={cn("rounded-full border px-4 py-2 text-sm font-medium transition-colors", form.slot === s ? "bg-plum text-white border-plum" : "border-line bg-card hover:bg-mist")}
            >
              {SLOTS[s].label}
              {SLOTS[s].hint && <span className={cn("ml-1 text-xs", form.slot === s ? "text-white/70" : "text-muted")}>{SLOTS[s].hint}</span>}
            </button>
          ))}
          {form.slot === "custom" && (
            <input type="time" value={form.startTime} onChange={(e) => set("startTime", e.target.value)} required className="rounded-full border border-line bg-card px-3 py-1.5 text-sm" aria-label="Start time" />
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label>Who&apos;s going</Label>
          <div className="space-y-2">
            <Stepper label="Adults" value={form.adults} min={1} max={20} onChange={(n) => set("adults", n)} />
            <Stepper label="Kids" value={form.kids.length} min={0} max={8} onChange={(n) => set("kids", n > form.kids.length ? [...form.kids, 6] : form.kids.slice(0, n))} />
          </div>
          {form.kids.length > 0 && (
            <div className="mt-3 rounded-2xl bg-sand/60 p-3">
              <p className="text-xs font-semibold text-ink-soft mb-2 flex items-center gap-1.5">
                <Baby className="size-3.5" /> Kids&apos; ages
              </p>
              <div className="flex flex-wrap gap-2">
                {form.kids.map((age, i) => (
                  <select
                    key={i}
                    value={age}
                    aria-label={`Age of kid ${i + 1}`}
                    onChange={(e) => set("kids", form.kids.map((a, j) => (j === i ? Number(e.target.value) : a)))}
                    className="rounded-full border border-line bg-card px-3 py-1.5 text-sm"
                  >
                    {Array.from({ length: 18 }, (_, a) => (
                      <option key={a} value={a}>
                        {a === 0 ? "Under 1" : `${a} yr${a === 1 ? "" : "s"}`}
                      </option>
                    ))}
                  </select>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <Label hint={people > 1 ? `≈ $${total} total` : undefined}>Budget</Label>
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-card px-3 py-2">
            <span className="text-muted">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={form.budget === 0 ? "" : String(form.budget)}
              placeholder="0"
              onChange={(e) => set("budget", Number(e.target.value.replace(/\D/g, "").slice(0, 6)) || 0)}
              className="w-full bg-transparent outline-none font-semibold"
              aria-label="Budget amount"
            />
          </div>
          <div className="mt-2 grid grid-cols-2 rounded-full border border-line bg-card p-1 text-sm">
            {(["per_person", "total"] as BudgetMode[]).map((m) => (
              <button key={m} type="button" onClick={() => set("budgetMode", m)} className={cn("rounded-full py-1.5 font-medium", form.budgetMode === m ? "bg-plum text-white" : "text-ink-soft")}>
                {m === "per_person" ? "Per person" : "Whole group"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label>Getting around</Label>
        <div className="grid grid-cols-5 gap-2">
          {TRANSPORTS.map(({ key, label, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => set("transport", key)}
              className={cn("flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-xs font-medium transition-colors", form.transport === key ? "border-orchid bg-orchid/10 text-orchid-dark" : "border-line bg-card hover:bg-mist")}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label hint="pick as many as you like">Into</Label>
        <div className="flex flex-wrap gap-2">
          {INTERESTS.map((i) => {
            const on = form.interests.includes(i.key);
            const blocked = i.key === "nightlife" && form.kids.length > 0;
            return (
              <button
                key={i.key}
                type="button"
                disabled={blocked}
                title={blocked ? "Nightlife is hidden when kids are coming" : i.blurb}
                onClick={() => set("interests", on ? form.interests.filter((x) => x !== i.key) : [...form.interests, i.key])}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-35 disabled:cursor-not-allowed",
                  on ? "bg-plum text-white border-plum" : "border-line bg-card hover:bg-mist",
                )}
              >
                {i.label}
              </button>
            );
          })}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading || !form.location}
        className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-orchid hover:bg-orchid-dark text-white font-semibold py-3.5 text-base shadow-card disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 className="size-5 animate-spin" /> : <Sparkles className="size-5" />}
        {loading ? "Finding real places…" : "Plan my outing"}
      </button>
      {!form.location && <p className="text-center text-sm text-muted -mt-3">Choose a location to start.</p>}
    </form>
  );
}
