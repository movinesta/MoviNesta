import React, { useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { Button } from "../components/Button";
import { Input } from "../components/Input";

export default function SignIn() {
  const appName = useMemo(() => (import.meta.env.VITE_APP_NAME as string | undefined) ?? "MoviNesta Admin", []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"password" | "magic">("password");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function signInPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
  }

  async function sendMagic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.href,
      },
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else setMsg("Check your email for the sign-in link.");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
        <div className="w-full rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-xl font-semibold tracking-tight">{appName}</div>
          <div className="mt-1 text-sm text-zinc-600">Sign in to manage MoviNesta</div>

          <div className="mt-5 flex gap-2">
            <Button
              type="button"
              variant={mode === "password" ? "primary" : "secondary"}
              onClick={() => setMode("password")}
            >
              Password
            </Button>
            <Button
              type="button"
              variant={mode === "magic" ? "primary" : "secondary"}
              onClick={() => setMode("magic")}
            >
              Magic link
            </Button>
          </div>

          <form className="mt-5 space-y-3" onSubmit={mode === "password" ? signInPassword : sendMagic}>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Email</div>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" type="email" required />
            </div>

            {mode === "password" ? (
              <div>
                <div className="mb-1 text-xs font-medium text-zinc-600">Password</div>
                <Input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" type="password" required />
              </div>
            ) : null}

            {msg ? <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">{msg}</div> : null}

            <Button type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "password" ? "Sign in" : "Send magic link"}
            </Button>
          </form>

          <div className="mt-5 text-xs text-zinc-500">
            Tip: add your user id to <span className="font-mono">public.app_admins</span> to grant access.
          </div>
        </div>
      </div>
    </div>
  );
}
