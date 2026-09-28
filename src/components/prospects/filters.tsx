"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Input, NativeSelect } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LEAD_SOURCES, PIPELINE_STAGES, PROSPECT_TYPES } from "@/lib/domain/constants";

export function ProspectFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  // debounce search input
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (q.trim() === current) return;
    const t = setTimeout(() => update("q", q.trim() || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const hasFilters = ["q", "stage", "type", "source", "temp", "archived", "demo"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-52 flex-1 sm:max-w-xs">
        <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search business, contact, email…"
          className="pl-8"
          aria-label="Search prospects"
        />
      </div>
      <NativeSelect className="w-auto" value={params.get("stage") ?? ""} onChange={(e) => update("stage", e.target.value)} aria-label="Stage">
        <option value="">All stages</option>
        {PIPELINE_STAGES.list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect className="w-auto" value={params.get("type") ?? ""} onChange={(e) => update("type", e.target.value)} aria-label="Prospect type">
        <option value="">All types</option>
        {PROSPECT_TYPES.list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect className="w-auto" value={params.get("source") ?? ""} onChange={(e) => update("source", e.target.value)} aria-label="Source">
        <option value="">All sources</option>
        {LEAD_SOURCES.list.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect className="w-auto" value={params.get("temp") ?? ""} onChange={(e) => update("temp", e.target.value)} aria-label="Priority">
        <option value="">Any priority</option>
        <option value="hot">Hot</option>
        <option value="warm">Warm</option>
        <option value="cold">Cold</option>
      </NativeSelect>
      <NativeSelect className="w-auto" value={params.get("archived") ?? ""} onChange={(e) => update("archived", e.target.value)} aria-label="Archived">
        <option value="">Active</option>
        <option value="only">Archived</option>
        <option value="include">Active + archived</option>
      </NativeSelect>
      {hasFilters ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setQ("");
            router.replace(pathname);
          }}
        >
          <X /> Clear
        </Button>
      ) : null}
    </div>
  );
}
