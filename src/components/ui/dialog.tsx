"use client";

import * as React from "react";
import { Dialog as DialogPrimitive, AlertDialog as AlertPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

const overlay = "fixed inset-0 z-50 bg-black/40";
const panel =
  "fixed top-[50%] left-[50%] z-50 grid max-h-[90vh] w-[calc(100%-1.5rem)] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto rounded-lg border bg-card p-5 shadow-lg";

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content>) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay} />
      <DialogPrimitive.Content className={cn(panel, "max-w-lg", className)} {...props}>
        {children}
        <DialogPrimitive.Close className="absolute top-3.5 right-3.5 rounded-sm opacity-60 hover:opacity-100">
          <XIcon className="size-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col gap-1 pr-6", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("text-base font-semibold", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

/** Confirmation dialog for destructive or irreversible actions. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <AlertPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger ? <AlertPrimitive.Trigger asChild>{trigger}</AlertPrimitive.Trigger> : null}
      <AlertPrimitive.Portal>
        <AlertPrimitive.Overlay className={overlay} />
        <AlertPrimitive.Content className={cn(panel, "max-w-md")}>
          <div className="flex flex-col gap-1.5">
            <AlertPrimitive.Title className="text-base font-semibold">{title}</AlertPrimitive.Title>
            <AlertPrimitive.Description className="text-sm text-muted-foreground">{description}</AlertPrimitive.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertPrimitive.Cancel className={buttonVariants({ variant: "outline" })}>Cancel</AlertPrimitive.Cancel>
            <AlertPrimitive.Action
              className={buttonVariants({ variant: destructive ? "destructive" : "default" })}
              onClick={() => void onConfirm()}
            >
              {confirmLabel}
            </AlertPrimitive.Action>
          </div>
        </AlertPrimitive.Content>
      </AlertPrimitive.Portal>
    </AlertPrimitive.Root>
  );
}
