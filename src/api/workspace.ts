export type Participant = { id: number; name: string; email: string; track: string; team: string };
export type Team = { id: number; name: string; track: string; members: number; stage: string };
export type Submission = { id: number; title: string; team: string; track: string; status: string; score: number; votes: number };
export type ScheduleItem = { date: string; title: string; detail: string };
export type HackathonRecord = {
  id: string;
  title: string;
  host: string;
  category: string;
  format: "Online" | "In person" | "Hybrid";
  dates: string;
  deadline: string;
  registrationDeadline?: string;
  submissionDeadline: string;
  votingDeadline?: string;
  location: string;
  description: string;
  prize: string;
  participants: number;
  spots: number;
  tracks: string[];
  eligibility: string;
  isArchived?: boolean;
  color: string;
  symbol: string;
  schedule: ScheduleItem[];
};
export type Registration = { eventId: string; name: string; email: string; track: string; teamPreference: string; teamName: string };
export type ProjectSubmission = {
  id: number;
  eventId: string;
  title: string;
  team: string;
  track: string;
  submitterEmail: string;
  description: string;
  repositoryUrl: string;
  demoUrl: string;
  status: string;
  score: number;
  votes: number;
};
export type RubricCriterion = { id: string; label: string; weight: number };
export type JudgeScore = {
  id: number;
  eventId: string;
  submissionId: number;
  judgeEmail: string;
  criterionScores: Record<string, number>;
  comment: string;
};
export type ProjectComment = { id: number; author: string; body: string; createdAt: string };
export type Workspace = {
  events: HackathonRecord[];
  registrations: Registration[];
  projectSubmissions: ProjectSubmission[];
  judgingRubric: RubricCriterion[];
  judgeScores: JudgeScore[];
  publishedEventIds: string[];
  participants: Participant[];
  teams: Team[];
  submissions: Submission[];
  judgingNormalized: boolean;
  resultsPublished: boolean;
  certificatesIssued: number;
  archived: boolean;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const workspaceUrl = `${apiBaseUrl}/api/v1/workspace`;
const publicEventsUrl = `${apiBaseUrl}/api/v1/events`;

export async function fetchPublicEvents(): Promise<HackathonRecord[]> {
  const response = await fetch(publicEventsUrl, { headers: { Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`Event listings request failed with HTTP ${response.status}.`);
  return await response.json() as HackathonRecord[];
}

export function isCutoffPassed(value: string | undefined): boolean {
  if (!value) return false;
  const cutoff = new Date(value);
  if (Number.isNaN(cutoff.getTime())) return false;
  if (!/[T ]\d{2}:\d{2}/.test(value)) cutoff.setHours(23, 59, 59, 999);
  return Date.now() >= cutoff.getTime();
}

export function formatCutoff(value: string): string {
  const cutoff = new Date(value);
  if (Number.isNaN(cutoff.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(cutoff);
}

export async function fetchWorkspace(token: string): Promise<Workspace | null> {
  const response = await fetch(workspaceUrl, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(5_000),
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Workspace request failed with HTTP ${response.status}.`);
  return await response.json() as Workspace;
}

export async function saveWorkspace(token: string, workspace: Workspace): Promise<void> {
  const response = await fetch(workspaceUrl, {
    method: "PUT",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(workspace),
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Workspace save failed with HTTP ${response.status}.`);
}

export async function updateProjectSubmission(
  token: string,
  eventId: string,
  submissionId: number,
  update: Pick<ProjectSubmission, "title" | "description" | "repositoryUrl" | "demoUrl" | "track" | "status">,
): Promise<ProjectSubmission> {
  const response = await fetch(`${apiBaseUrl}/api/v1/events/${encodeURIComponent(eventId)}/submissions/${submissionId}`, {
    method: "PUT",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(update),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `Project update failed with HTTP ${response.status}.`);
  }
  return await response.json() as ProjectSubmission;
}

export async function fetchProjectComments(eventId: string, submissionId: number): Promise<ProjectComment[]> {
  const response = await fetch(`${apiBaseUrl}/api/v1/events/${encodeURIComponent(eventId)}/submissions/${submissionId}/comments`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Comments request failed with HTTP ${response.status}.`);
  return await response.json() as ProjectComment[];
}

export async function addProjectComment(token: string, eventId: string, submissionId: number, body: string): Promise<ProjectComment> {
  const response = await fetch(`${apiBaseUrl}/api/v1/events/${encodeURIComponent(eventId)}/submissions/${submissionId}/comments`, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(result?.detail || `Comment could not be added (HTTP ${response.status}).`);
  }
  return await response.json() as ProjectComment;
}