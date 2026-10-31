import Link from "next/link";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { buttonStyles } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The page you're looking for doesn't exist or has moved."
        action={
          <Link href="/" className={buttonStyles()}>
            Back to Home
          </Link>
        }
      />
    </main>
  );
}
