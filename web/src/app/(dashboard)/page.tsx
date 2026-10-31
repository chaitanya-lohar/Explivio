import Link from "next/link";
import { Plus } from "lucide-react";
import { PageContainer } from "@/components/layout/page-container";
import { MilestonePlaceholder } from "@/components/shared/milestone-placeholder";
import { PageHeader } from "@/components/shared/page-header";
import { buttonStyles } from "@/components/ui/button";

export default function HomePage() {
  return (
    <PageContainer>
      <PageHeader
        title="What will you create today?"
        description="Turn an educational idea into a narrated, captioned vertical video."
        actions={
          <Link href="/create" className={buttonStyles()}>
            <Plus aria-hidden="true" className="size-5" />
            Create video
          </Link>
        }
      />
      <MilestonePlaceholder description="The home dashboard will hold the prompt composer, idea suggestions and your recent videos." next={{ href: "/create", label: "Go to Create Video" }} />
    </PageContainer>
  );
}
