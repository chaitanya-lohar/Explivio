import type { VideoProject } from "@/types/video";

// Static sample projects for layout work only; replace with the real video service later.
const mockVideos: readonly VideoProject[] = [
  { id: "how-apis-work", title: "How APIs work", prompt: "Explain how APIs work to beginners using a restaurant analogy.", status: "ready", durationSeconds: 60, createdAt: "2026-10-29T15:45:52Z" },
  { id: "why-the-sky-is-blue", title: "Why the sky is blue", prompt: "Explain why the sky appears blue to beginners.", status: "generating", durationSeconds: 60, createdAt: "2026-10-31T09:10:00Z" },
  { id: "database-index", title: "How a database index speeds up a search", prompt: "Explain how a database index speeds up a query.", status: "failed", durationSeconds: 90, createdAt: "2026-10-27T11:20:00Z" },
];

export async function listVideos(): Promise<readonly VideoProject[]> {
  return mockVideos;
}

export async function getVideo(id: string): Promise<VideoProject | null> {
  return mockVideos.find((video) => video.id === id) ?? null;
}
