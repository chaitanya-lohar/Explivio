import type { Metadata } from "next";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { AuthCard, AuthSplit } from "@/components/auth/auth-card";
import { SignupForm } from "@/features/authentication/components/signup-form";

export const metadata: Metadata = { title: "Create your account", description: "Create an Explivio account to start turning ideas into educational videos." };

export default function SignupPage() {
  return (
    <AuthSplit aside={<AuthBrandPanel />}>
      <AuthCard>
        <SignupForm />
      </AuthCard>
    </AuthSplit>
  );
}
