import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-muted-foreground",
        blue: "border-blue-200 bg-blue-50 text-blue-700",
        indigo: "border-indigo-200 bg-indigo-50 text-indigo-700",
        violet: "border-violet-200 bg-violet-50 text-violet-700",
        green: "border-emerald-200 bg-emerald-50 text-emerald-700",
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        orange: "border-orange-200 bg-orange-50 text-orange-700",
        red: "border-red-200 bg-red-50 text-red-700",
        sky: "border-sky-200 bg-sky-50 text-sky-700",
        teal: "border-teal-200 bg-teal-50 text-teal-700",
        slate: "border-slate-300 bg-slate-100 text-slate-700",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({
  className,
  tone,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
