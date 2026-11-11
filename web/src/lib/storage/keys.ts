/*
 * Object keys are built only from ids the server created and checked: users/<userId>/videos/<videoId>/video.mp4.
 * Nothing from the browser (file names, paths) ever becomes part of a key.
 */

const USER_ID = /^usr_[0-9a-f]{32}$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function videoObjectKey(userId: string, videoId: string): string {
  if (!USER_ID.test(userId)) throw new Error("Invalid user id for a storage key.");
  if (!VIDEO_ID.test(videoId)) throw new Error("Invalid video id for a storage key.");
  return `users/${userId}/videos/${videoId}/video.mp4`;
}

/** The video's thumbnail, next to it: users/<userId>/videos/<videoId>/thumbnail.jpg. */
export function thumbnailObjectKey(userId: string, videoId: string): string {
  return videoObjectKey(userId, videoId).replace(/video.mp4$/, "thumbnail.jpg");
}

/** Keys used by the R2 connectivity check (npm run r2:check): a separate prefix, never a user's video. */
export function checkObjectKey(stamp: string): string {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(stamp)) throw new Error("Invalid check id.");
  return `system/r2-check/${stamp}.mp4`;
}
