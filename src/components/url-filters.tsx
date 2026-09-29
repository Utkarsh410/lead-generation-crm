"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";

export type FilterSelect = { key: string; label: string; options: { value: string; label: string }[] };

/** Filter bar whose state lives in the URL query string (server pages read it). */
export function UrlFilters({
  searchPlaceholder,
  selects = [],
  dates = false,
  keep = [],
}: {
  searchPlaceholder?: string;
  selects?: FilterSelect[];
  /** Show created-from/to date inputs (params `from` / `to`). */
  dates?: boolean;
  /** Params that "Clear" should keep (e.g. the current view). */
  keep?: string[];
}) {
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

  useEffect(() => {
    if (!searchPlaceholder) return;
    const current = params.get("q") ?? "";
    if (q.trim() === current) return;
    const t = setTimeout(() => update("q", q.trim() || null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const keys = [...(searchPlaceholder ? ["q"] : []), ...selects.map((s) => s.key), ...(dates ? ["from", "to"] : [])];
  const active = keys.some((k) => params.get(k));

  function clear() {
    const next = new URLSearchParams();
    for (const k of keep) {
      const v = params.get(k);
      if (v) next.set(k, v);
    }
    setQ("");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {searchPlaceholder ? (
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute top-2.5 left-2.5 size-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="pl-8" aria-label={searchPlaceholder} />
        </div>
      ) : null}
      {selects.map((s) => (
        <NativeSelect key={s.key} className="w-auto" value={params.get(s.key) ?? ""} onChange={(e) => update(s.key, e.target.value)} aria-label={`Filter by ${s.label.toLowerCase()}`}>
          <option value="">{s.label}: all</option>
          {s.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      ))}
      {dates ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          Created
          <Input type="date" className="w-auto" value={params.get("from") ?? ""} onChange={(e) => update("from", e.target.value)} aria-label="Created from" />
          to
          <Input type="date" className="w-auto" value={params.get("to") ?? ""} onChange={(e) => update("to", e.target.value)} aria-label="Created to" />
        </span>
      ) : null}
      {active ? (
        <Button variant="ghost" size="sm" onClick={clear}>
          <X /> Clear
        </Button>
      ) : null}
    </div>
  );
}
