// Per-user configuration used across pages: lead sources, industries, service
// categories (built-in defaults + the user's own), the default sales pipeline,
// services and partners for pickers.

import {
  DEFAULT_INDUSTRIES,
  DEFAULT_SERVICE_CATEGORIES,
  LEAD_SOURCES,
  type LookupKind,
  type StageColor,
  type StageKey,
  type StageKind,
} from "@/lib/domain/constants";
import { AppError, maybe, must } from "./errors";
import type { Db } from "./types";

export type Option = { value: string; label: string; custom?: boolean };

export type PipelineStageRow = {
  id: string;
  pipeline_id: string;
  key: StageKey | null;
  label: string;
  color: StageColor;
  kind: StageKind;
  probability: number;
  sort_order: number;
};

export type PipelineWithStages = { id: string; name: string; stages: PipelineStageRow[] };

export async function listLookups(db: Db, kind?: LookupKind) {
  let q = db.from("lookup_values").select("id, kind, value, label, sort_order, active").order("sort_order").order("label");
  if (kind) q = q.eq("kind", kind);
  return must(await q);
}

/** Built-in options followed by the user's active custom ones (custom may relabel a built-in). */
export function mergeOptions(builtIn: Option[], custom: { value: string; label: string; active: boolean }[]): Option[] {
  const byValue = new Map(builtIn.map((o) => [o.value, { ...o }]));
  for (const c of custom) {
    if (!c.active) {
      byValue.delete(c.value);
      continue;
    }
    byValue.set(c.value, { value: c.value, label: c.label, custom: !builtIn.some((b) => b.value === c.value) });
  }
  return [...byValue.values()];
}

export async function getLookupOptions(db: Db) {
  const rows = await listLookups(db);
  const of = (kind: LookupKind) => rows.filter((r) => r.kind === kind);
  const sources = mergeOptions(LEAD_SOURCES.list, of("lead_source"));
  // "Other" always stays available and last
  const other = sources.find((s) => s.value === "other");
  return {
    sources: other ? [...sources.filter((s) => s.value !== "other"), other] : sources,
    industries: mergeOptions(DEFAULT_INDUSTRIES.map((i) => ({ value: slugify(i), label: i })), of("industry")),
    serviceCategories: mergeOptions(DEFAULT_SERVICE_CATEGORIES.list, of("service_category")),
  };
}

export type LookupOptions = Awaited<ReturnType<typeof getLookupOptions>>;

export function labelFor(options: Option[], value: string | null | undefined): string {
  if (!value) return "—";
  return options.find((o) => o.value === value)?.label ?? value.replace(/_/g, " ");
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

/** The user's default pipeline with ordered stages (created on first use if missing). */
export async function getDefaultPipeline(db: Db): Promise<PipelineWithStages> {
  let pipeline = maybe(await db.from("pipelines").select("id, name").eq("is_default", true).maybeSingle());
  if (!pipeline) {
    pipeline = must(await db.from("pipelines").insert({ name: "Sales pipeline", is_default: true }).select("id, name").single());
    const defaults: Array<[StageKey, string, StageColor, StageKind, number]> = [
      ["new", "New", "slate", "open", 5],
      ["contacted", "Contacted", "sky", "open", 10],
      ["replied", "Replied", "blue", "open", 20],
      ["qualified", "Qualified", "indigo", "open", 30],
      ["discovery", "Discovery", "violet", "open", 40],
      ["proposal", "Proposal", "amber", "open", 60],
      ["negotiation", "Negotiation", "orange", "open", 75],
      ["won", "Won", "green", "won", 100],
      ["lost", "Lost", "red", "lost", 0],
      ["nurture", "Nurture", "teal", "parked", 5],
    ];
    must(
      await db
        .from("pipeline_stages")
        .insert(
          defaults.map(([key, label, color, kind, probability], i) => ({
            pipeline_id: pipeline!.id,
            key,
            label,
            color,
            kind,
            probability,
            sort_order: i + 1,
          })),
        )
        .select("id"),
    );
  }
  const stages = must(
    await db
      .from("pipeline_stages")
      .select("id, pipeline_id, key, label, color, kind, probability, sort_order")
      .eq("pipeline_id", pipeline.id)
      .order("sort_order"),
  ) as PipelineStageRow[];
  return { id: pipeline.id, name: pipeline.name, stages };
}

export function stageByKey(pipeline: PipelineWithStages, key: StageKey): PipelineStageRow {
  const stage = pipeline.stages.find((s) => s.key === key);
  if (!stage) throw new AppError(`Your pipeline has no “${key}” stage. Restore it in Settings → Pipeline.`);
  return stage;
}

export async function listServiceOptions(db: Db, opts: { activeOnly?: boolean } = {}) {
  let q = db.from("services").select("id, name, category, active, default_price, delivery_model").order("name");
  if (opts.activeOnly) q = q.eq("active", true);
  return must(await q);
}

export async function listPartnerOptions(db: Db) {
  return must(await db.from("partners").select("id, name, partner_type, status").order("name"));
}
