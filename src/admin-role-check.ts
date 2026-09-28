import type { AppRole } from "./api/auth";

export const supportedRoles: AppRole[] = [
  "participant",
  "organizer",
  "judge",
  "admin",
];
