import { AuthLayout } from "@/components/auth/auth-layout";

/** Authentication pages: own shell, no dashboard sidebar or navigation. Not a security boundary. */
export default function AuthGroupLayout({ children }: LayoutProps<"/">) {
  return <AuthLayout>{children}</AuthLayout>;
}
