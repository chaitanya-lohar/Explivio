import type { VideoProject, VideoRequest } from "@/types/video";

// In-memory sample projects for layout work only; replace with the real video service later.
// None has a downloadUrl, because no rendered file is hosted yet.
const mockVideos: VideoProject[] = [
  { id: "how-apis-work", title: "How APIs work", prompt: "Explain how APIs work to beginners using a restaurant analogy.", status: "ready", durationSeconds: 60, createdAt: "2026-10-29T15:45:52Z" },
  { id: "why-the-sky-is-blue", title: "Why the sky is blue", prompt: "Explain why the sky appears blue to beginners.", status: "generating", durationSeconds: 60, createdAt: "2026-10-31T09:10:00Z" },
  { id: "database-index", title: "How a database index speeds up a search", prompt: "Explain how a database index speeds up a query.", status: "failed", durationSeconds: 90, createdAt: "2026-10-27T11:20:00Z" },
];

/** Newest first. */
export async function listVideos(): Promise<readonly VideoProject[]> {
  return [...mockVideos].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getVideo(id: string): Promise<VideoProject | null> {
  return mockVideos.find((video) => video.id === id) ?? null;
}

/** Records a generation request. The mock only stores it; nothing is rendered. */
export async function createVideo(request: VideoRequest): Promise<VideoProject> {
  const video: VideoProject = {
    id: `draft-${crypto.randomUUID().slice(0, 8)}`,
    title: request.prompt.length > 60 ? `${request.prompt.slice(0, 57).trimEnd()}…` : request.prompt,
    prompt: request.prompt,
    status: "generating",
    durationSeconds: request.durationSeconds,
    createdAt: new Date().toISOString(),
  };
  mockVideos.push(video);
  return video;
}
