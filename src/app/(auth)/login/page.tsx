import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  return (
    <main className="flex min-h-dvh items-center justify-center bg-sidebar p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-lg">
        <div className="mb-6">
          <p className="text-lg font-semibold tracking-tight">LeadOS</p>
          <p className="text-sm text-muted-foreground">Personal Lead Generation &amp; Sales CRM</p>
        </div>
        <LoginForm next={typeof next === "string" ? next : undefined} />
        <p className="mt-6 text-center text-[11px] text-muted-foreground">Private workspace</p>
      </div>
    </main>
  );
}
