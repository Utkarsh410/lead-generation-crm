"use client";

import * as React from "react";

type Lazy = { $$typeof: symbol; _payload: unknown; _init: (payload: unknown) => unknown };
const REACT_LAZY = Symbol.for("react.lazy");
const isLazy = (node: unknown): node is Lazy =>
  typeof node === "object" && node !== null && (node as { $$typeof?: symbol }).$$typeof === REACT_LAZY;

/**
 * Elements passed from a Server Component (e.g. `trigger={<Button …/>}`) can reach
 * a client component as `React.lazy` wrappers — sometimes nested — until their
 * RSC chunk is parsed. Radix `asChild` needs a real element, so unwrap them first
 * (suspending while a chunk is still loading).
 */
export function useResolvedChild(node: React.ReactNode): React.ReactNode {
  let current: unknown = node;
  for (let i = 0; i < 10 && isLazy(current); i++) {
    const payload = current._payload as { then?: unknown } | null;
    current = payload && typeof payload.then === "function" ? React.use(payload as PromiseLike<unknown> as Promise<unknown>) : current._init(payload);
  }
  return current as React.ReactNode;
}

/** Wraps a Radix trigger so its `asChild` child is always a resolved element. */
export function SlotSafeTrigger<P extends { asChild?: boolean; children?: React.ReactNode }>(Trigger: React.ComponentType<P>) {
  function SafeTrigger(props: P) {
    const children = useResolvedChild(props.children);
    return <Trigger {...props}>{children}</Trigger>;
  }
  SafeTrigger.displayName = `SlotSafe(${Trigger.displayName ?? Trigger.name ?? "Trigger"})`;
  return SafeTrigger;
}
