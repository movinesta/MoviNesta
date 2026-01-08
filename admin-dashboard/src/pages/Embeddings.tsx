import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getEmbeddings, setActiveProfile, setRerank } from "../lib/api";
import { Card } from "../components/Card";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { Table, Th, Td } from "../components/Table";
import { fmtInt } from "../lib/ui";

function Title(props: { children: React.ReactNode }) {
  return <div className="mb-4 text-xl font-semibold tracking-tight">{props.children}</div>;
}

export default function Embeddings() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["embeddings"], queryFn: getEmbeddings });

  const settings = q.data?.embedding_settings ?? null;

  const activeProvider = settings?.active_provider ?? "—";
  const activeModel = settings?.active_model ?? "—";
  const activeDim = settings?.active_dimensions ?? 1024;
  const activeTask = settings?.active_task ?? "swipe";

  // Form state: initialize *once* after settings are loaded.
  const [isInitialized, setIsInitialized] = useState(false);
  // Locked profile (Voyage-only)
  const [provider, setProvider] = useState<string>("voyage");
  const [model, setModel] = useState<string>("voyage-3-large");
  const [dimensions, setDimensions] = useState<number>(1024);
  const [task, setTask] = useState<string>("swipe");

  const [rerankSwipe, setRerankSwipe] = useState<boolean>(false);
  const [rerankSearch, setRerankSearch] = useState<boolean>(false);
  const [topK, setTopK] = useState<number>(50);

  useEffect(() => {
    if (!settings) return;
    if (isInitialized) return;

    // Force Voyage-only values in UI (server enforces too)
    setProvider("voyage");
    setModel("voyage-3-large");
    setDimensions(1024);
    setTask(String(settings.active_task ?? "swipe"));

    setRerankSwipe(Boolean(settings.rerank_swipe_enabled ?? false));
    setRerankSearch(Boolean(settings.rerank_search_enabled ?? false));
    setTopK(Number(settings.rerank_top_k ?? 50));

    setIsInitialized(true);
  }, [settings, isInitialized]);

  const providerPresets = useMemo(() => [{ provider: "voyage", model: "voyage-3-large", dimensions: 1024, task: "swipe" }], []);

  const mutProfile = useMutation({
    mutationFn: () => setActiveProfile({ provider, model, dimensions, task }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["embeddings"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  const mutRerank = useMutation({
    mutationFn: () => setRerank({ swipe_enabled: rerankSwipe, search_enabled: rerankSearch, top_k: topK }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["embeddings"] });
      await qc.invalidateQueries({ queryKey: ["overview"] });
    },
  });

  if (q.isLoading) return <div className="text-sm text-zinc-500">Loading…</div>;
  if (q.error) return <div className="text-sm text-red-600">{(q.error as any).message}</div>;

  // Avoid a controlled-input flash while we sync state from the loaded settings.
  if (settings && !isInitialized) return <div className="text-sm text-zinc-500">Loading…</div>;

  return (
    <div className="space-y-6">
      <Title>Embeddings</Title>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Active embedding profile">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Provider</div>
              <Input value={provider} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Model</div>
              <Input value={model} disabled />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Dimensions</div>
              <Input
                value={String(dimensions)}
                disabled
                type="number"
              />
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Task</div>
              <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="swipe" />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {providerPresets.map((p) => (
              <button
                key={`${p.provider}-${p.model}`}
                className="rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-200"
                onClick={() => {
                  setProvider(p.provider);
                  setModel(p.model);
                  setDimensions(p.dimensions);
                  setTask(p.task);
                }}
              >
                {p.provider}: {p.model}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Button onClick={() => mutProfile.mutate()} disabled={mutProfile.isPending}>
              {mutProfile.isPending ? "Saving…" : "Set active profile"}
            </Button>
            {mutProfile.isError ? (
              <div className="mt-2 text-sm text-red-600">{(mutProfile.error as any).message}</div>
            ) : null}
          </div>

          <div className="mt-4 text-xs text-zinc-500">
            Current: <span className="font-mono">{activeProvider}</span> / <span className="font-mono">{activeModel}</span> ({activeDim}) task={activeTask}
          </div>
        </Card>

        <Card title="Rerank settings (Voyage rerank-2.5)">
          <div className="space-y-3">
            <label className="flex items-center gap-3 text-sm text-zinc-700">
              <input type="checkbox" checked={rerankSwipe} onChange={(e) => setRerankSwipe(e.target.checked)} />
              Enable rerank for swipe deck
            </label>
            <label className="flex items-center gap-3 text-sm text-zinc-700">
              <input type="checkbox" checked={rerankSearch} onChange={(e) => setRerankSearch(e.target.checked)} />
              Enable rerank for search results
            </label>
            <div>
              <div className="mb-1 text-xs font-medium text-zinc-600">Top K candidates to rerank</div>
              <Input value={String(topK)} onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") return;
                const n = Number(raw);
                if (!Number.isFinite(n)) return;
                const clamped = Math.max(5, Math.min(200, Math.trunc(n)));
                setTopK(clamped);
              }} type="number" min={5} max={200} />
            </div>

            <Button onClick={() => mutRerank.mutate()} disabled={mutRerank.isPending}>
              {mutRerank.isPending ? "Saving…" : "Save rerank settings"}
            </Button>
            {mutRerank.isError ? (
              <div className="text-sm text-red-600">{(mutRerank.error as any).message}</div>
            ) : null}
          </div>
        </Card>
      </div>

      <Card title="Stored embedding coverage">
        <Table>
          <thead>
            <tr>
              <Th>Provider</Th>
              <Th>Model</Th>
              <Th className="text-right">Count</Th>
            </tr>
          </thead>
          <tbody>
            {q.data!.coverage.map((r, i) => (
              <tr key={i}>
                <Td>{r.provider}</Td>
                <Td className="font-mono text-xs">{r.model}</Td>
                <Td className="text-right">{fmtInt(r.count)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
