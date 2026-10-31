import { AppShell } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/services";

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return <AppShell user={getCurrentUser()}>{children}</AppShell>;
}
