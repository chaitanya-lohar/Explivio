import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard, AuthCentered } from "@/components/auth/auth-card";
import { Skeleton } from "@/components/ui/skeleton";
import { VerifyEmailPanel } from "@/features/authentication/components/verify-email-panel";

export const metadata: Metadata = { title: "Verify your email", description: "Confirm your email address to activate your Explivio account." };

export default function VerifyEmailPage() {
  return (
    <AuthCentered>
      <AuthCard>
        <Suspense fallback={<Skeleton className="h-80" />}>
          <VerifyEmailPanel />
        </Suspense>
      </AuthCard>
    </AuthCentered>
  );
}
