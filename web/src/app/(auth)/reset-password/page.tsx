import { Suspense } from "react";
import type { Metadata } from "next";
import { AuthCard, AuthCentered } from "@/components/auth/auth-card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResetPasswordForm } from "@/features/authentication/components/reset-password-form";

export const metadata: Metadata = { title: "Reset password", description: "Choose a new password for your Explivio account." };

export default function ResetPasswordPage() {
  return (
    <AuthCentered>
      <AuthCard>
        <Suspense fallback={<Skeleton className="h-96" />}>
          <ResetPasswordForm />
        </Suspense>
      </AuthCard>
    </AuthCentered>
  );
}
