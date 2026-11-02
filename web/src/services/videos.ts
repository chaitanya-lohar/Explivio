import * as mock from "./mock/videos";
import * as pipeline from "./pipeline/videos";

/*
 * Chooses the video service. Default: the real pipeline (repo root CLI + runs/ folder).
 * Set VIDEO_SERVICE=mock in web/.env.local to work on the UI without API keys or rendering.
 */
const impl = process.env.VIDEO_SERVICE === "mock" ? mock : pipeline;

export const listVideos = impl.listVideos;
export const listVideoIds = impl.listVideoIds;
export const getVideo = impl.getVideo;
export const getVideoTitle = impl.getVideoTitle;
export const getVideoFilePath = impl.getVideoFilePath;
export const createVideo = impl.createVideo;
export const retryVideo = impl.retryVideo;
export { PipelineBusyError } from "./pipeline/videos";
