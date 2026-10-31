import { Breadcrumbs, type Crumb } from "@/components/shared/breadcrumbs";
import { PageHeader } from "@/components/shared/page-header";

/** Breadcrumb + "Step n of 2" + page title for the creation flow. */
export function StepHeader({ step, crumbs, title, description }: { step: 1 | 2; crumbs: readonly Crumb[]; title: string; description: string }) {
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={crumbs} />
      <PageHeader eyebrow={`Step ${step} of 2`} title={title} description={description} />
    </div>
  );
}
