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
export const createVideo = (request: VideoRequest, ownerUserId: string): Promise<VideoProject> => (useMock ? mock.createVideo(request) : pipeline.createVideo(request, ownerUserId));
export const retryVideo = (id: string, ownerUserId: string): Promise<VideoProject | null> => (useMock ? mock.retryVideo(id) : pipeline.retryVideo(id, ownerUserId));
export { PipelineBusyError } from "./pipeline/videos";
