"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Menu, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS } from "./nav";
import { signOut } from "@/lib/actions/auth";

function NavLinks({ badges, onNavigate }: { badges: Partial<Record<string, number>>; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-3 px-2">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {group.label ? <p className="px-2.5 pb-0.5 text-[10px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">{group.label}</p> : null}
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            const count = badges[href];
            return (
              <Link
                key={href}
                href={href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-sidebar-active hover:text-white",
                  active && "bg-sidebar-active font-medium text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="size-4 shrink-0" />
                <span className="flex-1">{label}</span>
                {count ? <span className="rounded bg-red-500/90 px-1.5 text-[11px] font-semibold text-white tabular-nums">{count}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function GlobalSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form
      role="search"
      className="px-3 pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (q.trim().length < 2) return;
        onNavigate?.();
        router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      }}
    >
      <label className="relative block">
        <span className="sr-only">Search everything</span>
        <Search className="absolute top-2 left-2.5 size-4 text-sidebar-foreground/60" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything…"
          className="h-8 w-full rounded-md border border-white/10 bg-white/5 pr-2 pl-8 text-sm text-white placeholder:text-sidebar-foreground/50 focus:bg-white/10"
        />
      </label>
    </form>
  );
}

function Brand() {
  return (
    <div className="px-4 py-4">
      <p className="text-[15px] font-semibold tracking-tight text-white">
        LeadOS
      </p>
      <p className="text-[11px] text-sidebar-foreground/70">Personal Lead Generation &amp; Sales CRM</p>
    </div>
  );
}

function UserBox({ name, email }: { name: string; email: string | null }) {
  return (
    <div className="border-t border-white/10 px-4 py-3">
      <p className="truncate text-sm font-medium text-white">{name}</p>
      {email ? <p className="truncate text-xs text-sidebar-foreground/70">{email}</p> : null}
      <form action={signOut} className="mt-2">
        <button className="flex items-center gap-1.5 text-xs text-sidebar-foreground/80 hover:text-white" type="submit">
          <LogOut className="size-3.5" /> Sign out
        </button>
      </form>
    </div>
  );
}

export function Sidebar({
  name,
  email,
  badges,
}: {
  name: string;
  email: string | null;
  badges: Partial<Record<string, number>>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* desktop */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <Brand />
        <GlobalSearch />
        <div className="flex-1 overflow-y-auto">
          <NavLinks badges={badges} />
        </div>
        <UserBox name={name} email={email} />
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex h-12 items-center justify-between bg-sidebar px-3 text-white lg:hidden">
        <p className="text-sm font-semibold">LeadOS</p>
        <button onClick={() => setOpen(true)} aria-label="Open menu" className="rounded p-1.5 hover:bg-sidebar-active">
          <Menu className="size-5" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-sidebar text-sidebar-foreground">
            <div className="flex items-start justify-between">
              <Brand />
              <button onClick={() => setOpen(false)} aria-label="Close menu" className="m-3 rounded p-1 text-white hover:bg-sidebar-active">
                <X className="size-5" />
              </button>
            </div>
            <GlobalSearch onNavigate={() => setOpen(false)} />
            <div className="flex-1 overflow-y-auto">
              <NavLinks badges={badges} onNavigate={() => setOpen(false)} />
            </div>
            <UserBox name={name} email={email} />
          </aside>
        </div>
      ) : null}
    </>
  );
}
