import React from "react";
import { Card } from "../components/Card";
import { Button } from "../components/Button";

export default function NotConfigured() {
  const example = `# admin-dashboard/.env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY

# Optional:
VITE_APP_NAME=MoviNesta Admin`;

  function copy(text: string) {
    try {
      void navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-2xl items-center px-4">
        <Card title="Admin dashboard not configured">
          <div className="space-y-3 text-sm text-zinc-700">
            <p>
              The admin dashboard needs Supabase environment variables to connect.
            </p>

            <ol className="list-decimal space-y-1 pl-5">
              <li>Copy <span className="font-mono">admin-dashboard/.env.example</span> to <span className="font-mono">admin-dashboard/.env</span></li>
              <li>
                Fill <span className="font-mono">VITE_SUPABASE_URL</span> and <span className="font-mono">VITE_SUPABASE_ANON_KEY</span>
              </li>
              <li>Restart the dev server (or rebuild)</li>
            </ol>

            <div className="rounded-xl border border-zinc-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs font-semibold text-zinc-600">Example</div>
                <Button variant="ghost" onClick={() => copy(example)}>
                  Copy
                </Button>
              </div>
              <pre className="overflow-auto whitespace-pre-wrap text-[12px] text-zinc-800">{example}</pre>
            </div>

            <div className="text-xs text-zinc-500">
              Tip: You can find the URL and anon key in your Supabase project settings.
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
