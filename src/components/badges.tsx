import { Flame, Snowflake, Sun } from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  HANDOFF_STATUSES,
  LEAD_TEMPERATURES,
  PIPELINE_STAGES,
  QUALIFICATION_CLASSES,
  RESPONSE_STATUSES,
  TASK_PRIORITIES,
  TASK_STATUSES,
  type HandoffStatus,
  type LeadTemperature,
  type PipelineStage,
  type QualificationClass,
  type ResponseStatus,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/domain/constants";

export const STAGE_TONES: Record<PipelineStage, BadgeTone> = {
  prospect: "slate",
  contacted: "sky",
  replied: "blue",
  qualified: "indigo",
  discovery_call: "violet",
  technical_discussion: "violet",
  proposal_sent: "amber",
  negotiation: "orange",
  won: "green",
  lost: "red",
};

export function StageBadge({ stage }: { stage: PipelineStage }) {
  return <Badge tone={STAGE_TONES[stage]}>{PIPELINE_STAGES.label(stage)}</Badge>;
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

export function DemoBadge() {
  return (
    <Badge tone="violet" title="Demo data — remove it from Settings">
      Demo
    </Badge>
  );
}
