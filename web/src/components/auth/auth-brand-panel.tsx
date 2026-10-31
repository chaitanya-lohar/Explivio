import { Captions, FileText, Mic, Smartphone } from "lucide-react";
import { appConfig } from "@/config/app";

const steps = [
  { icon: FileText, title: "Describe your topic", detail: "Write what you want to explain and who it's for." },
  { icon: Mic, title: "Script and narration", detail: "Explivio plans the video and records a clear voice-over." },
  { icon: Smartphone, title: "Download your MP4", detail: `${appConfig.video.aspectRatio} vertical, ${appConfig.video.width} × ${appConfig.video.height}, captions burned in.` },
];

/** Product summary beside the login and sign-up forms. States only what the product actually does. */
export function AuthBrandPanel() {
  return (
    <section aria-label={`About ${appConfig.name}`} className="flex flex-col gap-8">
      <div className="flex flex-col gap-5">
        <span className="inline-flex items-center gap-2 self-start rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-meta font-medium text-secondary">
          <Captions aria-hidden="true" className="size-4" />
          Educational video studio
        </span>
        <p className="text-5xl leading-[1.05] font-semibold tracking-tight text-foreground xl:text-6xl">
          Turn Ideas Into <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">Videos.</span>
        </p>
        <p className="max-w-lg text-lg text-muted">Turn a topic into a short, narrated, captioned vertical video your learners can watch anywhere.</p>
      </div>
      <ol className="flex max-w-lg flex-col gap-3 rounded-card border border-border bg-card/70 p-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex items-start gap-4 rounded-control border border-border bg-background/60 p-4">
              <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-control bg-surface-raised text-[#c7bfff]">
                <Icon className="size-5" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-title text-foreground">
                  {index + 1}. {step.title}
                </span>
                <span className="text-meta text-muted">{step.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
