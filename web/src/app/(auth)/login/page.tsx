import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { AuthCard, AuthSplit } from "@/components/auth/auth-card";
import { Skeleton } from "@/components/ui/skeleton";
import { LoginForm } from "@/features/authentication/components/login-form";

export const metadata: Metadata = { title: "Sign in", description: "Sign in to Explivio to keep creating educational videos." };

export default function LoginPage() {
  return (
    <AuthSplit aside={<AuthBrandPanel />}>
      <AuthCard>
        {/* Reads ?reset=1 (shown after a password reset), which needs Suspense under Cache Components. */}
        <Suspense fallback={<Skeleton className="h-96" />}>
          <LoginForm />
        </Suspense>
      </AuthCard>
    </AuthSplit>
  );
}
