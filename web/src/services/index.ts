// Single import point for data access. Swap these re-exports for real API implementations without touching pages.
// Server-only: these touch the filesystem and start processes, so client components must go through server actions or /api routes.
export { getCurrentUser } from "./mock/user";
export { createVideo, getVideo, getVideoFilePath, getVideoTitle, listVideoIds, listVideos, PipelineBusyError, retryVideo } from "./videos";
export {
  mockRequestPasswordReset as requestPasswordReset,
  mockResendVerification as resendVerification,
  mockResetPassword as resetPassword,
  mockSignIn as signIn,
  mockSignUp as signUp,
} from "./mock/auth";
