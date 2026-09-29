"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { TermsFields, termsFromRow, type TermsState } from "@/components/commercial/terms-fields";
import { useMoney } from "@/components/workspace/workspace-context";
import { projectFinancials } from "@/lib/domain/commercials";
import { parseMoney } from "@/lib/domain/money";

const safe = (v: string) => {
  try {
    return parseMoney(v);
  } catch {
    return null;
  }
};

/** What-if calculator: same maths as projects, nothing is saved. */
export function CommissionCalculator() {
  const { currency, money } = useMoney();
  const [total, setTotal] = useState("");
  const [received, setReceived] = useState("");
  const [partnerCost, setPartnerCost] = useState("");
  // deliberately blank: there is no default commission
  const [terms, setTerms] = useState<TermsState>(termsFromRow({}));
  const f = projectFinancials(
    {
      total_project_value: safe(total),
      partner_cost: safe(partnerCost),
      commission_received: null,
      payment_flow: "client_pays_partner",
      commission_type: (terms.commission_type || null) as never,
      commission_percentage: terms.commission_percentage || null,
      fixed_commission: safe(terms.fixed_commission),
      commission_basis: (terms.commission_basis || null) as never,
      commission_custom_base: safe(terms.commission_custom_base ?? ""),
    },
    safe(received) ? [{ amount: safe(received)!, status: "received" }] : [],
  );
  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="space-y-3 lg:col-span-2">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={`Project value (${currency})`} htmlFor="calc-total">
            <Input id="calc-total" inputMode="decimal" value={total} onChange={(e) => setTotal(e.target.value)} />
          </Field>
          <Field label={`Client has paid (${currency})`} htmlFor="calc-received">
            <Input id="calc-received" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} />
          </Field>
          <Field label={`Partner cost (${currency})`} htmlFor="calc-cost" hint="Used by the Net Revenue basis">
            <Input id="calc-cost" inputMode="decimal" value={partnerCost} onChange={(e) => setPartnerCost(e.target.value)} />
          </Field>
        </div>
        <TermsFields value={terms} onChange={setTerms} showCustomBase />
      </div>
      <div className="rounded-md border bg-muted/40 p-4">
        <p className="text-xs text-muted-foreground">Commission earned so far</p>
        <p className="text-2xl font-semibold tabular-nums">{f.commissionEarned === null ? "—" : money(f.commissionEarned)}</p>
        <p className="mt-3 text-xs text-muted-foreground">
          Exact decimal maths (no floating point). Example: {money(200000)} project, 10% on amount received, client pays {money(100000)} → {money(10000)}.
        </p>
      </div>
    </div>
  );
}
