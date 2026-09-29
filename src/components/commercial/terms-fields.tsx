"use client";

import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert, Field } from "@/components/ui/misc";
import { useMoney } from "@/components/workspace/workspace-context";
import { COMMISSION_BASES, COMMISSION_TYPES, REVENUE_MODELS } from "@/lib/domain/constants";
import { describeTerms, validateCommercialTerms } from "@/lib/domain/commercials";
import { parseMoney } from "@/lib/domain/money";

export type TermsState = {
  revenue_model: string;
  commission_type: string;
  commission_percentage: string;
  fixed_commission: string;
  commission_basis: string;
  commission_custom_base?: string;
  commission_notes: string;
};

export function termsFromRow(r: {
  revenue_model?: string | null;
  commission_type?: string | null;
  commission_percentage?: number | string | null;
  fixed_commission?: number | string | null;
  commission_basis?: string | null;
  commission_custom_base?: number | string | null;
  commission_notes?: string | null;
}): TermsState {
  const s = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));
  return {
    revenue_model: r.revenue_model ?? "",
    commission_type: r.commission_type ?? "",
    commission_percentage: s(r.commission_percentage),
    fixed_commission: s(r.fixed_commission),
    commission_basis: r.commission_basis ?? "",
    commission_custom_base: s(r.commission_custom_base),
    commission_notes: r.commission_notes ?? "",
  };
}

const safeMoney = (v: string | undefined) => {
  try {
    return parseMoney(v ?? "");
  } catch {
    return null;
  }
};

/**
 * Commission terms are always chosen explicitly: there is no default percentage,
 * and a percentage requires choosing what it's calculated on.
 */
export function TermsFields({
  value,
  onChange,
  errors = {},
  showCustomBase = false,
}: {
  value: TermsState;
  onChange: (next: TermsState) => void;
  errors?: Record<string, string[]>;
  showCustomBase?: boolean;
}) {
  const { currency, money } = useMoney();
  const set = (k: keyof TermsState, v: string) => onChange({ ...value, [k]: v });
  const terms = {
    commission_type: (value.commission_type || null) as never,
    commission_percentage: value.commission_percentage || null,
    fixed_commission: safeMoney(value.fixed_commission),
    commission_basis: (value.commission_basis || null) as never,
    commission_custom_base: safeMoney(value.commission_custom_base),
  };
  const problems = value.commission_type ? validateCommercialTerms(terms) : [];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Revenue model" htmlFor="t-revenue">
        <NativeSelect id="t-revenue" value={value.revenue_model} onChange={(e) => set("revenue_model", e.target.value)}>
          <option value="">Not set</option>
          {REVENUE_MODELS.list.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <Field label="Commission" htmlFor="t-ctype" hint="What you earn from a partner/referrer, if anything">
        <NativeSelect id="t-ctype" value={value.commission_type} onChange={(e) => set("commission_type", e.target.value)}>
          <option value="">Not agreed yet</option>
          {COMMISSION_TYPES.list.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
      </Field>
      {value.commission_type === "percentage" ? (
        <Field label="Commission %" htmlFor="t-pct" error={errors.commission_percentage?.[0]}>
          <Input id="t-pct" inputMode="decimal" placeholder="e.g. 10" value={value.commission_percentage} onChange={(e) => set("commission_percentage", e.target.value)} />
        </Field>
      ) : null}
      {value.commission_type === "fixed" ? (
        <Field label={`Fixed commission (${currency})`} htmlFor="t-fixed" error={errors.fixed_commission?.[0]}>
          <Input id="t-fixed" inputMode="decimal" value={value.fixed_commission} onChange={(e) => set("fixed_commission", e.target.value)} />
        </Field>
      ) : null}
      {value.commission_type === "percentage" || value.commission_type === "fixed" ? (
        <Field
          label="Commission basis"
          htmlFor="t-basis"
          error={errors.commission_basis?.[0]}
          hint={value.commission_type === "fixed" ? "With “Amount Received”, a fixed fee accrues as the client pays" : "Choose explicitly — there is no default"}
        >
          <NativeSelect id="t-basis" value={value.commission_basis} onChange={(e) => set("commission_basis", e.target.value)}>
            <option value="">Choose a basis…</option>
            {COMMISSION_BASES.list.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
      ) : null}
      {showCustomBase && value.commission_type === "percentage" && value.commission_basis === "custom" ? (
        <Field label={`Custom base amount (${currency})`} htmlFor="t-custom" error={errors.commission_custom_base?.[0]}>
          <Input id="t-custom" inputMode="decimal" value={value.commission_custom_base ?? ""} onChange={(e) => set("commission_custom_base", e.target.value)} />
        </Field>
      ) : null}
      <Field label="Commission notes" htmlFor="t-notes" className="sm:col-span-2">
        <Textarea id="t-notes" rows={2} value={value.commission_notes} onChange={(e) => set("commission_notes", e.target.value)} placeholder="Exclusions (tax, hosting, licences…), payment timing, who pays whom" />
      </Field>
      {value.commission_type ? (
        problems.length ? (
          <Alert tone="warning" className="sm:col-span-2">
            {problems.join(" ")}
          </Alert>
        ) : (
          <p className="text-xs text-muted-foreground sm:col-span-2">Terms: {describeTerms(terms, (v) => money(v))}</p>
        )
      ) : null}
    </div>
  );
}
