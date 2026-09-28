"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/misc";
import { commissionOnReceived, referenceTier, type CommissionTier } from "@/lib/domain/commission";
import { formatINR, InvalidMoneyError, parseMoney } from "@/lib/domain/money";

/** Reference-only calculator: shows the default tier, but uses the % you enter. */
export function CommissionCalculator({ tiers }: { tiers: CommissionTier[] }) {
  const [amount, setAmount] = useState("");
  const [received, setReceived] = useState("");
  const [pct, setPct] = useState("");

  let error: string | null = null;
  let amountValue: string | null = null;
  let receivedValue: string | null = null;
  try {
    amountValue = parseMoney(amount);
    receivedValue = parseMoney(received);
  } catch (e) {
    error = e instanceof InvalidMoneyError ? e.message : "Invalid amount";
  }
  const tier = referenceTier(amountValue, tiers);
  const pctValid = pct === "" || (/^\d{1,3}(\.\d{1,2})?$/.test(pct) && Number(pct) <= 100);
  let commission: number | null = null;
  try {
    commission = pctValid && pct !== "" ? commissionOnReceived(receivedValue, pct) : null;
  } catch {
    commission = null;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Eligible project amount (₹)" htmlFor="cc-amt" hint="Excluding GST & pass-through costs">
          <Input id="cc-amt" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 1.5L" />
        </Field>
        <Field label="Agreed commission %" htmlFor="cc-pct" error={pctValid ? undefined : "0–100, max 2 decimals"}>
          <Input id="cc-pct" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder={tier ? String(tier.percentage) : ""} />
        </Field>
        <Field label="Received by BharatCoder so far (₹)" htmlFor="cc-rcv">
          <Input id="cc-rcv" inputMode="decimal" value={received} onChange={(e) => setReceived(e.target.value)} placeholder="e.g. 75000" />
        </Field>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-sm sm:grid-cols-2">
        <p>
          <span className="text-muted-foreground">Reference tier:</span>{" "}
          {amountValue ? (tier ? `${tier.tier_name} — ${tier.percentage}%` : "Below ₹25K — negotiate separately") : "—"}
        </p>
        <p>
          <span className="text-muted-foreground">Commission earned so far:</span>{" "}
          <strong>{commission === null ? "Enter the agreed %" : formatINR(commission)}</strong>
        </p>
      </div>
    </div>
  );
}
