import { Flame, Snowflake, Sun } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  CLIENT_STATUSES,
  HANDOFF_STATUSES,
  LEAD_STATUSES,
  LEAD_TEMPERATURES,
  PARTNER_STATUSES,
  PAYMENT_STATUSES,
  PROJECT_STATUSES,
  type ClientStatus,
  type LeadStatus,
  type PartnerStatus,
  type PaymentStatus,
  type ProjectStatus,
  type StageColor,
  QUALIFICATION_CLASSES,
  RESPONSE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type HandoffStatus,
  type LeadTemperature,
  type QualificationClass,
  type ResponseStatus,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain/constants";

export const LEAD_STATUS_TONES: Record<LeadStatus, BadgeTone> = {
  new: "slate",
  contacted: "sky",
  replied: "blue",
  qualified: "indigo",
  nurture: "teal",
  client: "green",
  lost: "red",
};

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  return <Badge tone={LEAD_STATUS_TONES[status] ?? "neutral"}>{LEAD_STATUSES.label(status)}</Badge>;
}

/** Opportunity pipeline stage (label/colour come from the user's pipeline). */
export function StageBadge({ label, color }: { label: string; color: StageColor | string }) {
  return <Badge tone={(color as BadgeTone) ?? "slate"}>{label}</Badge>;
}

const TEMP: Record<LeadTemperature, { tone: BadgeTone; icon: React.ReactNode }> = {
  hot: { tone: "red", icon: <Flame /> },
  warm: { tone: "amber", icon: <Sun /> },
  cold: { tone: "sky", icon: <Snowflake /> },
};

export function TemperatureBadge({ temperature, score }: { temperature: LeadTemperature; score?: number }) {
  const t = TEMP[temperature];
  return (
    <Badge tone={t.tone} title="Internal prioritisation only — not a prediction">
      {t.icon}
      {LEAD_TEMPERATURES.label(temperature)}
      {score !== undefined ? <span className="tabular-nums opacity-80">· {score}</span> : null}
    </Badge>
  );
}

const PRIORITY_TONES: Record<TaskPriority, BadgeTone> = { low: "neutral", medium: "blue", high: "amber", urgent: "red" };
export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <Badge tone={PRIORITY_TONES[priority]}>{TASK_PRIORITIES.label(priority)}</Badge>;
}

const TASK_STATUS_TONES: Record<TaskStatus, BadgeTone> = { pending: "blue", completed: "green", snoozed: "amber", cancelled: "neutral" };
export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <Badge tone={TASK_STATUS_TONES[status]}>{TASK_STATUSES.label(status)}</Badge>;
}

const RESPONSE_TONES: Record<ResponseStatus, BadgeTone> = {
  sent: "slate",
  delivered: "sky",
  replied: "blue",
  no_response: "neutral",
  interested: "green",
  not_interested: "red",
  not_now: "amber",
  wrong_contact: "orange",
};
export function ResponseBadge({ status }: { status: ResponseStatus }) {
  return <Badge tone={RESPONSE_TONES[status]}>{RESPONSE_STATUSES.label(status)}</Badge>;
}

const CLASS_TONES: Record<QualificationClass, BadgeTone> = {
  unqualified: "neutral",
  potential: "amber",
  qualified: "indigo",
  high_priority: "green",
};
export function ClassificationBadge({ value }: { value: QualificationClass }) {
  return <Badge tone={CLASS_TONES[value]}>{QUALIFICATION_CLASSES.label(value)}</Badge>;
}

const HANDOFF_TONES: Record<HandoffStatus, BadgeTone> = { draft: "neutral", sent: "blue", accepted: "green", declined: "red" };
export function HandoffStatusBadge({ status }: { status: HandoffStatus }) {
  return <Badge tone={HANDOFF_TONES[status]}>{HANDOFF_STATUSES.label(status)}</Badge>;
}

const PROJECT_TONES: Record<ProjectStatus, BadgeTone> = { not_started: "slate", active: "blue", on_hold: "amber", completed: "green", cancelled: "neutral" };
export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={PROJECT_TONES[status]}>{PROJECT_STATUSES.label(status)}</Badge>;
}

const PAYMENT_TONES: Record<PaymentStatus, BadgeTone> = { expected: "amber", received: "green", failed: "red", refunded: "neutral" };
export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge tone={PAYMENT_TONES[status]}>{PAYMENT_STATUSES.label(status)}</Badge>;
}

const PARTNER_TONES: Record<PartnerStatus, BadgeTone> = { prospect: "slate", contacted: "sky", interested: "blue", active: "green", inactive: "neutral" };
export function PartnerStatusBadge({ status }: { status: PartnerStatus }) {
  return <Badge tone={PARTNER_TONES[status]}>{PARTNER_STATUSES.label(status)}</Badge>;
}

const CLIENT_TONES: Record<ClientStatus, BadgeTone> = { active: "green", inactive: "neutral", past_client: "slate", nurture: "teal" };
export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  return <Badge tone={CLIENT_TONES[status]}>{CLIENT_STATUSES.label(status)}</Badge>;
}

export function DemoBadge() {
  return (
    <Badge tone="violet" title="Demo data — remove it from Settings">
      Demo
    </Badge>
  );
}
