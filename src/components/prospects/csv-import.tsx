"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileUp, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useWorkspace } from "@/components/workspace/workspace-context";
import { parseCsv } from "@/lib/domain/csv";
import { IMPORT_FIELDS, guessMapping, prepareImportRows, sourceResolver, type ColumnMapping, type ImportField } from "@/lib/domain/prospect-import";
import { checkImportDuplicatesAction, importProspectsAction } from "@/lib/actions/import";
import { useAction } from "@/lib/client/use-action";
import { cn } from "@/lib/utils";

const MAX_BYTES = 2_000_000;
const MAX_ROWS = 1000;

type Existing = { id: string; business_name: string; reasons: string[] }[];

export function CsvImport() {
  const router = useRouter();
  const { sources } = useWorkspace();
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [body, setBody] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [existing, setExisting] = useState<Existing[] | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [fileError, setFileError] = useState<string | null>(null);
  const check = useAction();
  const commit = useAction();

  const resolve = useMemo(() => sourceResolver(sources), [sources]);
  const rows = useMemo(() => (headers.length ? prepareImportRows(body, mapping, resolve, { maxRows: MAX_ROWS }) : []), [body, mapping, resolve, headers.length]);
  const sourceLabel = (key: string) => sources.find((s) => s.value === key)?.label ?? key;

  function onFile(file: File | undefined) {
    setExisting(null);
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setFileError("File is larger than 2 MB — split it into smaller files.");
      return;
    }
    file.text().then((text) => {
      const parsed = parseCsv(text).filter((r) => r.some((c) => c.trim()));
      if (parsed.length < 2) {
        setFileError("The file needs a header row and at least one data row.");
        return;
      }
      setFileName(file.name);
      setHeaders(parsed[0]);
      setBody(parsed.slice(1));
      setMapping(guessMapping(parsed[0]));
    });
  }

  function setField(field: ImportField, col: string) {
    setExisting(null);
    setMapping((m) => {
      const next = { ...m };
      if (col === "") delete next[field];
      else next[field] = Number(col);
      return next;
    });
  }

  function runCheck() {
    check.run(
      () =>
        checkImportDuplicatesAction({
          rows: rows.map((r) => ({
            business_name: r.values.business_name,
            website: r.values.website,
            email: r.values.email,
            phone: r.values.phone,
            location: r.values.location,
          })),
        }),
      { onSuccess: (r) => setExisting(r) },
    );
  }

  const isDuplicate = (i: number) => Boolean(existing?.[i]?.length) || rows[i].duplicateOfRow !== null;
  const importable = rows.filter((r, i) => !r.errors.length && !(skipDuplicates && isDuplicate(i)));
  const errorCount = rows.filter((r) => r.errors.length).length;
  const dupCount = existing ? rows.filter((_, i) => isDuplicate(i)).length : 0;

  function runImport() {
    commit.run(
      () =>
        importProspectsAction({
          rows: importable.map((r) => ({
            business_name: r.values.business_name!,
            contact_name: r.values.contact_name,
            email: r.values.email,
            phone: r.values.phone,
            website: r.values.website,
            linkedin_url: r.values.linkedin_url,
            instagram_url: r.values.instagram_url,
            industry: r.values.industry,
            location: r.values.location,
            lead_source: r.sourceKey,
            research_notes: r.values.research_notes,
          })),
        }),
      {
        success: (r) => `Imported ${r.imported} prospect${r.imported === 1 ? "" : "s"}${r.skipped.length ? ` (${r.skipped.length} skipped)` : ""}`,
        onSuccess: () => router.push("/prospects?sort=created_at&dir=desc"),
      },
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>1. Choose a CSV file</CardTitle>
          <CardDescription>
            Columns: Business, Contact, Email, Phone, Website, LinkedIn, Instagram, Industry, Location, Source, Notes. Up to {MAX_ROWS.toLocaleString()} rows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed p-4 text-sm hover:bg-accent">
            <FileUp className="size-5 text-muted-foreground" />
            <span>{fileName || "Click to choose a .csv file"}</span>
            <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="CSV file" />
          </label>
          {fileError ? <Alert tone="danger">{fileError}</Alert> : null}
          {body.length > MAX_ROWS ? <Alert tone="warning">Only the first {MAX_ROWS} rows will be imported.</Alert> : null}
        </CardContent>
      </Card>

      {headers.length ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Match columns</CardTitle>
            <CardDescription>We guessed from the header row — adjust anything that&apos;s wrong. Business is required.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {IMPORT_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} htmlFor={`map-${f.key}`} required={f.key === "business_name"}>
                <NativeSelect id={`map-${f.key}`} value={mapping[f.key] ?? ""} onChange={(e) => setField(f.key, e.target.value)}>
                  <option value="">— not imported —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `Column ${i + 1}`}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {rows.length ? (
        <Card className="overflow-hidden">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>3. Preview &amp; confirm</CardTitle>
                <CardDescription>
                  {rows.length} row{rows.length === 1 ? "" : "s"} · {errorCount} with errors
                  {existing ? ` · ${dupCount} possible duplicate${dupCount === 1 ? "" : "s"}` : ""}
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" onClick={runCheck} disabled={check.pending || mapping.business_name === undefined}>
                  {check.pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Check for duplicates
                </Button>
                <Button onClick={runImport} disabled={!existing || commit.pending || !importable.length}>
                  {commit.pending ? <Loader2 className="animate-spin" /> : <Upload />} Import {importable.length}
                </Button>
              </div>
            </div>
            {existing ? (
              <label className="mt-2 flex items-center gap-2 text-sm">
                <input type="checkbox" className="size-4 accent-primary" checked={skipDuplicates} onChange={(e) => setSkipDuplicates(e.target.checked)} />
                Skip possible duplicates
              </label>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">Check for duplicates before importing — rows are compared with your existing prospects by website domain, email, phone and name + location.</p>
            )}
          </CardHeader>
          <div className="max-h-[32rem] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Business</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email / phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => {
                  const matches = existing?.[i] ?? [];
                  const skipped = r.errors.length > 0 || (skipDuplicates && isDuplicate(i) && existing !== null);
                  return (
                    <TableRow key={r.rowNumber} className={cn(skipped && "opacity-60")}>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">{r.rowNumber}</TableCell>
                      <TableCell className="font-medium">{r.values.business_name ?? "—"}</TableCell>
                      <TableCell>{r.values.contact_name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{[r.values.email, r.values.phone].filter(Boolean).join(" · ") || "—"}</TableCell>
                      <TableCell className="text-xs">{sourceLabel(r.sourceKey)}</TableCell>
                      <TableCell className="space-y-0.5 text-xs">
                        {r.errors.map((e) => (
                          <p key={e} className="text-destructive">
                            {e}
                          </p>
                        ))}
                        {r.duplicateOfRow !== null ? <Badge tone="amber">Same as row {r.duplicateOfRow}</Badge> : null}
                        {matches.map((m) => (
                          <p key={m.id} className="flex items-center gap-1 text-amber-700">
                            <AlertTriangle className="size-3" /> Matches{" "}
                            <Link href={`/prospects/${m.id}`} target="_blank" className="underline">
                              {m.business_name}
                            </Link>{" "}
                            ({m.reasons.join(", ")})
                          </p>
                        ))}
                        {r.warnings.map((w) => (
                          <p key={w} className="text-muted-foreground">
                            {w}
                          </p>
                        ))}
                        {!r.errors.length && !matches.length && r.duplicateOfRow === null && !r.warnings.length ? <span className="text-emerald-700">OK</span> : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
