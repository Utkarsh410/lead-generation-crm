import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionContext } from "@/lib/auth/session";
import { buildExport, EXPORT_KINDS } from "@/lib/data/exports";
import { AppError } from "@/lib/data/errors";
import { prospectListQuerySchema } from "@/lib/validation/schemas";
import { todayInTimezone } from "@/lib/domain/dates";

export async function GET(request: Request, ctx: RouteContext<"/api/export/[kind]">) {
  const session = await getSessionContext();
  if (!session) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (!session.approved) return NextResponse.json({ error: "Not approved" }, { status: 403 });

  const { kind } = await ctx.params;
  const parsedKind = z.enum(EXPORT_KINDS).safeParse(kind);
  if (!parsedKind.success) return NextResponse.json({ error: "Unknown export" }, { status: 404 });

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const query = prospectListQuerySchema.parse(params);
  const ids = z
    .array(z.uuid())
    .max(500)
    .safeParse((params.ids ?? "").split(",").filter(Boolean));

  try {
    const csv = await buildExport(session.db, parsedKind.data, { query, ids: ids.success ? ids.data : undefined });
    const filename = `leados-${parsedKind.data}-${todayInTimezone()}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const message = e instanceof AppError ? e.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
