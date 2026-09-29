import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  FolderKanban,
  Handshake,
  KanbanSquare,
  LayoutDashboard,
  Network,
  Send,
  Settings,
  Users,
} from "lucide-react";

export const NAV_GROUPS = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/follow-ups", label: "Follow-ups", icon: CalendarCheck },
    ],
  },
  {
    label: "Acquisition",
    items: [
      { href: "/prospects", label: "Prospects", icon: Users },
      { href: "/outreach", label: "Outreach", icon: Send },
      { href: "/qualification", label: "Qualification", icon: ClipboardCheck },
      { href: "/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    label: "Sales",
    items: [
      { href: "/opportunities", label: "Opportunities", icon: KanbanSquare },
      { href: "/handoffs", label: "Handoffs", icon: Handshake },
    ],
  },
  {
    label: "Delivery & revenue",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/projects", label: "Projects", icon: FolderKanban },
      { href: "/partners", label: "Partners", icon: Network },
      { href: "/services", label: "Services", icon: Briefcase },
    ],
  },
  {
    label: null,
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
] as const;

export const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = NAV_GROUPS.flatMap((g) => [...g.items]);
