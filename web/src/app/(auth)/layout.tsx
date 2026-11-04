import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthLayout } from "@/components/auth/auth-layout";
import { getCurrentUser } from "@/lib/auth/session";

/** Signed-in visitors don't need the sign-in screens: send them to the dashboard (checked on the server). */
async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/");
  return null;
}

/** Authentication pages: own shell, no dashboard sidebar or navigation. */
export default function AuthGroupLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <RedirectIfSignedIn />
      </Suspense>
      {children}
    </AuthLayout>
  );
}
