import type { UserProfile } from "@/types/user";

// Placeholder profile until authentication exists.
const mockUser: UserProfile = { displayName: "Alex Chen", role: "Educator & Creator" };

export function getCurrentUser(): UserProfile {
  return mockUser;
}
