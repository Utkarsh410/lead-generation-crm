import { Download } from "lucide-react";
import type { ExportKind } from "@/lib/data/exports";
import { Button } from "@/components/ui/button";

/** CSV download link (a plain anchor: downloads must not use client-side navigation). */
export function ExportButton({
  kind,
  query,
  label = "Export CSV",
  size = "default",
}: {
  kind: ExportKind;
  query?: string;
  label?: string;
  size?: "default" | "sm";
}) {
  const href = `/api/export/${kind}${query ? `?${query}` : ""}`;
  return (
    <Button asChild variant="outline" size={size}>
      <a href={href} download>
        <Download /> {label}
      </a>
    </Button>
  );
}
