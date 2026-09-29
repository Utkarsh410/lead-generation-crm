"use client";

import { createContext, useContext } from "react";
import type { Option } from "@/lib/data/workspace";
import { formatMoney, formatMoneyCompact } from "@/lib/domain/money";

export type WorkspaceValue = {
  currency: string;
  sources: Option[];
  industries: Option[];
  serviceCategories: Option[];
};

const WorkspaceContext = createContext<WorkspaceValue>({ currency: "INR", sources: [], industries: [], serviceCategories: [] });

export function WorkspaceProvider({ value, children }: { value: WorkspaceValue; children: React.ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

/** Currency-aware money formatters for client components. */
export function useMoney() {
  const { currency } = useWorkspace();
  return {
    currency,
    money: (v: string | number | null | undefined) => formatMoney(v, currency),
    compact: (v: string | number | null | undefined) => formatMoneyCompact(v, currency),
  };
}

export function useSourceLabel() {
  const { sources } = useWorkspace();
  return (value: string | null | undefined) => (value ? (sources.find((s) => s.value === value)?.label ?? value.replace(/_/g, " ")) : "—");
}
