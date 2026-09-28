"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

const ASC_BY_DEFAULT = new Set(["business_name", "next_follow_up_date"]);

export function SortHeader({ column, label }: { column: string; label: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const currentSort = params.get("sort") ?? "opportunity_score";
  const active = currentSort === column;
  const currentDir = params.get("dir") ?? (ASC_BY_DEFAULT.has(currentSort) ? "asc" : "desc");
  const nextDir = active ? (currentDir === "asc" ? "desc" : "asc") : ASC_BY_DEFAULT.has(column) ? "asc" : "desc";
  const next = new URLSearchParams(params.toString());
  next.set("sort", column);
  next.set("dir", nextDir);
  next.delete("page");
  const Icon = active ? (currentDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <Link
      href={`${pathname}?${next.toString()}`}
      className="inline-flex items-center gap-1 hover:text-foreground"
      scroll={false}
      aria-sort={active ? (currentDir === "asc" ? "ascending" : "descending") : undefined}
    >
      {label}
      <Icon className={active ? "size-3.5 text-foreground" : "size-3.5 opacity-40"} />
    </Link>
  );
}
