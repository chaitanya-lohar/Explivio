import type { Metadata } from "next";
import { AuthCard, AuthCentered } from "@/components/auth/auth-card";
import { ForgotPasswordForm } from "@/features/authentication/components/forgot-password-form";

export const metadata: Metadata = { title: "Forgot password", description: "Request a link to reset your Explivio password." };

export default function ForgotPasswordPage() {
  return (
    <AuthCentered>
      <AuthCard>
        <ForgotPasswordForm />
      </AuthCard>
    </AuthCentered>
  );
}
