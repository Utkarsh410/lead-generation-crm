import {
  BarChart3,
  Briefcase,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  Handshake,
  KanbanSquare,
  LayoutDashboard,
  Send,
  Settings,
  Users,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/prospects", label: "Prospects", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/outreach", label: "Outreach", icon: Send },
  { href: "/follow-ups", label: "Follow-ups", icon: CalendarCheck },
  { href: "/qualification", label: "Qualification", icon: ClipboardCheck },
  { href: "/services", label: "Services", icon: Briefcase },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/handoffs", label: "Handoffs", icon: Handshake },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
