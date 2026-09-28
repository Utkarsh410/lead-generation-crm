"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav";
import { signOut } from "@/lib/actions/auth";

function NavLinks({ badges, onNavigate }: { badges: Partial<Record<string, number>>; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
            {count ? (
              <span className="rounded bg-red-500/90 px-1.5 text-[11px] font-semibold text-white tabular-nums">{count}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <div className="px-4 py-4">
      <p className="text-[15px] font-semibold tracking-tight text-white">
        BharatCoder <span className="text-indigo-300">LeadOS</span>
      </p>
      <p className="text-[11px] text-sidebar-foreground/70">Client Acquisition &amp; Sales Pipeline</p>
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
        <div className="flex-1 overflow-y-auto">
          <NavLinks badges={badges} />
        </div>
        <UserBox name={name} email={email} />
      </aside>

      {/* mobile top bar */}
      <div className="sticky top-0 z-40 flex h-12 items-center justify-between bg-sidebar px-3 text-white lg:hidden">
        <p className="text-sm font-semibold">
          BharatCoder <span className="text-indigo-300">LeadOS</span>
        </p>
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
