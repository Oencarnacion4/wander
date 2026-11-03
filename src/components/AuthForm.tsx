"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { cn } from "@/lib/cn";

export function AuthForm() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb) return;
    setBusy(true);
    setMsg(null);
    if (mode === "signin") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) setMsg({ ok: false, text: error.message });
    } else {
      const { data, error } = await sb.auth.signUp({ email, password, options: { data: { display_name: name || undefined } } });
      if (error) setMsg({ ok: false, text: error.message });
      else if (!data.session) setMsg({ ok: true, text: "Check your email to confirm your account, then sign in." });
    }
    setBusy(false);
  }

  const input = "w-full rounded-2xl border border-line bg-card px-4 py-3 outline-none focus:ring-2 focus:ring-orchid/40";
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-2 rounded-full border border-line bg-paper p-1 text-sm">
        {(["signin", "signup"] as const).map((m) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-full py-2 font-semibold", mode === m ? "bg-plum text-white" : "text-ink-soft")}>
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>
      {mode === "signup" && <input className={input} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
      <input className={input} type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input className={input} type="password" required minLength={6} placeholder="Password (6+ characters)" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signin" ? "current-password" : "new-password"} />
      <button type="submit" disabled={busy} className="w-full rounded-full bg-orchid hover:bg-orchid-dark text-white font-semibold py-3 inline-flex justify-center items-center gap-2 disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />}
        {mode === "signin" ? "Sign in" : "Create account"}
      </button>
      {msg && <p className={cn("text-sm", msg.ok ? "text-confirm" : "text-orchid-dark")}>{msg.text}</p>}
    </form>
  );
}
