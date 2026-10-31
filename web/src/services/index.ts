// Single import point for data access. Swap these re-exports for real API implementations without touching pages.
export { getCurrentUser } from "./mock/user";
export { createVideo, getVideo, listVideos } from "./mock/videos";
