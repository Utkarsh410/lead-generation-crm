import type { z } from "zod";
import { projectFinancials, type PaymentLike } from "@/lib/domain/commercials";
import type { clientSchema, paymentSchema, projectCreateSchema, projectUpdateSchema } from "@/lib/validation/schemas";
import { AppError, check, maybe, must } from "./errors";
import { logActivity } from "./activities";
import { getProspectOrThrow } from "./prospects";
import type { Db } from "./types";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

export async function listClients(db: Db, opts: { status?: string; q?: string } = {}) {
  let q = db
    .from("clients")
    .select("*, projects(id, name, status, total_project_value)")
    .order("company")
    .limit(1000);
  if (opts.status) q = q.eq("status", opts.status as never);
  if (opts.q) q = q.ilike("company", `%${opts.q.replace(/[%_*]/g, " ")}%`);
  return must(await q);
}

export async function getClient(db: Db, id: string) {
  return maybe(await db.from("clients").select("*, prospects(id, business_name)").eq("id", id).maybeSingle());
}

export async function createClient(db: Db, values: z.output<typeof clientSchema>) {
  return must(await db.from("clients").insert(values).select("id").single());
}

export async function updateClient(db: Db, id: string, values: z.output<typeof clientSchema>) {
  const rows = must(await db.from("clients").update(values).eq("id", id).select("id"));
  if (!rows.length) throw new AppError("Client not found.");
}

/**
 * Converts a prospect into a client (idempotent: returns the existing client).
 * Optionally creates a project from a (won) opportunity, copying its service,
 * partner, delivery model, value and commercial terms.
 */
export async function convertProspectToClient(
  db: Db,
  input: { prospect_id: string; opportunity_id?: string | null; create_project: boolean },
): Promise<{ clientId: string; projectId: string | null; created: boolean }> {
  const prospect = await getProspectOrThrow(db, input.prospect_id);
  let client = maybe(await db.from("clients").select("id").eq("prospect_id", prospect.id).maybeSingle());
  const created = !client;
  if (!client) {
    client = must(
      await db
        .from("clients")
        .insert({
          prospect_id: prospect.id,
          company: prospect.business_name,
          primary_contact: prospect.contact_name,
          email: prospect.email,
          phone: prospect.phone,
          website: prospect.website,
          industry: prospect.industry,
          location: prospect.location,
          is_demo: prospect.is_demo,
        })
        .select("id")
        .single(),
    );
    check(await db.from("prospects").update({ stage: "client" }).eq("id", prospect.id));
    await logActivity(db, { prospect_id: prospect.id, activity_type: "client", title: "Converted to client", metadata: { client_id: client.id } });
  }

  let projectId: string | null = null;
  if (input.create_project && input.opportunity_id) {
    const existing = maybe(await db.from("projects").select("id").eq("opportunity_id", input.opportunity_id).maybeSingle());
    if (existing) {
      projectId = existing.id;
    } else {
      const opp = maybe(await db.from("opportunities").select("*").eq("id", input.opportunity_id).maybeSingle());
      if (!opp || opp.prospect_id !== prospect.id) throw new AppError("Opportunity not found for this prospect.");
      const project = must(
        await db
          .from("projects")
          .insert({
            client_id: client.id,
            opportunity_id: opp.id,
            service_id: opp.service_id,
            partner_id: opp.partner_id,
            name: opp.title,
            delivery_model: opp.delivery_model,
            total_project_value: opp.estimated_value,
            status: "not_started",
            revenue_model: opp.revenue_model,
            // referrals: the client usually pays the partner, who pays me commission
            payment_flow: opp.delivery_model === "referral" ? "client_pays_partner" : "client_pays_me",
            commission_type: opp.commission_type,
            commission_percentage: opp.commission_percentage,
            fixed_commission: opp.fixed_commission,
            commission_basis: opp.commission_basis,
            commission_notes: opp.commission_notes,
          })
          .select("id")
          .single(),
      );
      projectId = project.id;
      await logActivity(db, { prospect_id: prospect.id, activity_type: "project", title: `Project created: ${opp.title}`, metadata: { project_id: project.id } });
    }
  }
  return { clientId: client.id, projectId, created };
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const PROJECT_SELECT =
  "*, clients(id, company, prospect_id, is_demo), services(id, name), partners(id, name), opportunities(id, title), payments(id, amount, status, payment_date, payment_type, reference, notes)";

export async function listProjects(
  db: Db,
  filters: { clientId?: string; status?: string; partnerId?: string; serviceId?: string; deliveryModel?: string; revenueModel?: string; q?: string } = {},
) {
  let q = db.from("projects").select(PROJECT_SELECT).order("created_at", { ascending: false }).limit(1000);
  if (filters.clientId) q = q.eq("client_id", filters.clientId);
  if (filters.status) q = q.eq("status", filters.status as never);
  if (filters.partnerId) q = q.eq("partner_id", filters.partnerId);
  if (filters.serviceId) q = q.eq("service_id", filters.serviceId);
  if (filters.deliveryModel) q = q.eq("delivery_model", filters.deliveryModel as never);
  if (filters.revenueModel) q = q.eq("revenue_model", filters.revenueModel as never);
  if (filters.q) q = q.ilike("name", `%${filters.q.replace(/[%_*]/g, " ")}%`);
  return must(await q).map((p) => ({ ...p, financials: projectFinancials(p, (p.payments ?? []) as PaymentLike[]) }));
}

export type ProjectRow = Awaited<ReturnType<typeof listProjects>>[number];

export async function getProject(db: Db, id: string) {
  const p = maybe(await db.from("projects").select(PROJECT_SELECT).eq("id", id).maybeSingle());
  if (!p) return null;
  return { ...p, financials: projectFinancials(p, (p.payments ?? []) as PaymentLike[]) };
}

async function prospectIdForClient(db: Db, clientId: string) {
  const c = maybe(await db.from("clients").select("prospect_id").eq("id", clientId).maybeSingle());
  return c?.prospect_id ?? null;
}

export async function createProject(db: Db, values: z.output<typeof projectCreateSchema>) {
  const row = must(
    await db
      .from("projects")
      .insert({ ...values, commission_received: values.commission_received ?? "0" })
      .select("id")
      .single(),
  );
  const prospectId = await prospectIdForClient(db, values.client_id);
  if (prospectId) await logActivity(db, { prospect_id: prospectId, activity_type: "project", title: `Project created: ${values.name}` });
  return row;
}

export async function updateProject(db: Db, values: z.output<typeof projectUpdateSchema>) {
  const { id, ...fields } = values;
  const rows = must(
    await db
      .from("projects")
      .update({ ...fields, commission_received: fields.commission_received ?? "0" })
      .eq("id", id)
      .select("id"),
  );
  if (!rows.length) throw new AppError("Project not found.");
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function addPayment(db: Db, values: z.output<typeof paymentSchema>) {
  const project = maybe(await db.from("projects").select("id, name, client_id").eq("id", values.project_id).maybeSingle());
  if (!project) throw new AppError("Project not found.");
  const row = must(await db.from("payments").insert({ ...values, amount: values.amount! }).select("id").single());
  const prospectId = await prospectIdForClient(db, project.client_id);
  if (prospectId) {
    await logActivity(db, {
      prospect_id: prospectId,
      activity_type: "payment",
      title: `Payment ${values.status}: ${project.name}`,
      details: `${values.amount} on ${values.payment_date}`,
    });
  }
  return row;
}

export async function updatePayment(db: Db, id: string, values: z.output<typeof paymentSchema>) {
  const rows = must(await db.from("payments").update({ ...values, amount: values.amount! }).eq("id", id).select("id"));
  if (!rows.length) throw new AppError("Payment not found.");
}

export async function deletePayment(db: Db, id: string) {
  check(await db.from("payments").delete().eq("id", id));
}
