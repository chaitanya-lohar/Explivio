import * as mock from "./mock/videos";
import * as pipeline from "./pipeline/videos";
import type { VideoProject, VideoRequest } from "@/types/video";

/*
 * Chooses the video service. Default: the real pipeline (repo root CLI + runs/ folder), where every call is scoped to
 * the signed-in user (F10). VIDEO_SERVICE=mock serves shared sample data for UI work and ignores ownership.
 */
const useMock = process.env.VIDEO_SERVICE === "mock";

export const listVideos = (ownerUserId: string): Promise<readonly VideoProject[]> => (useMock ? mock.listVideos() : pipeline.listVideos(ownerUserId));
export const getVideo = (id: string, ownerUserId: string): Promise<VideoProject | null> => (useMock ? mock.getVideo(id) : pipeline.getVideo(id, ownerUserId));
export const getVideoTitle = (id: string, ownerUserId: string): Promise<string | null> => (useMock ? mock.getVideoTitle(id) : pipeline.getVideoTitle(id, ownerUserId));
export const getVideoFilePath = async (id: string, ownerUserId: string): Promise<string | null> => (useMock ? mock.getVideoFilePath(id) : pipeline.getVideoFilePath(id, ownerUserId));
/** Where a ready video's bytes are (local file or Cloudflare R2 object), for the owner only. */
export const getVideoSource = async (id: string, ownerUserId: string): Promise<pipeline.VideoSource | null> => {
  if (!useMock) return pipeline.getVideoSource(id, ownerUserId);
  const filePath = await mock.getVideoFilePath(id);
  return filePath ? { kind: "local", path: filePath } : null;
};
export type { VideoSource } from "./pipeline/videos";
export const createVideo = (request: VideoRequest, ownerUserId: string): Promise<VideoProject> => (useMock ? mock.createVideo(request) : pipeline.createVideo(request, ownerUserId));
export const retryVideo = (id: string, ownerUserId: string): Promise<VideoProject | null> => (useMock ? mock.retryVideo(id) : pipeline.retryVideo(id, ownerUserId));
/** Deletes the user's video and its file (R2 or local); refused while it is being made. */
export const deleteVideo = (id: string, ownerUserId: string): Promise<pipeline.DeleteResult> => (useMock ? mock.deleteVideo(id) : pipeline.deleteVideo(id, ownerUserId));
export { GenerationLimitError, PipelineBusyError } from "./pipeline/videos";
