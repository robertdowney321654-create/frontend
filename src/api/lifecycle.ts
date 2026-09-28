import { authApiBaseUrl, type OrganizationMember } from "./auth";
import type { ProjectSubmission, Workspace } from "./workspace";

export type TeamView = { id: number; eventId: string; name: string; track: string; members: number; joined: boolean; inviteCode: string };
export type JudgeReview = {
  eventId: string;
  eventTitle: string;
  eventTracks: string[];
  submissionId: number;
  submissionTitle: string;
  submissionTeam: string;
  track: string;
  description: string;
  rubric: { id: string; label: string; weight: number }[];
  score: Record<string, number>;
  comment: string;
};
export type Certificate = { eventId: string; eventTitle: string; recipientName: string; verificationCode: string; issuedAt: string };
export type CertificateVerification = { valid: boolean; eventId: string; eventTitle: string; recipientName: string; issuedAt: string; verificationCode: string };
export type EventJudge = { accountId: number; email: string; fullName: string };

async function request<T>(token: string, path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${authApiBaseUrl}/api/v1/lifecycle${path}`, {
    ...options,
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: string } | null;
    throw new Error(body?.detail || `Request failed with HTTP ${response.status}.`);
  }
  return await response.json() as T;
}

export function listTeams(token: string, eventId: string): Promise<TeamView[]> {
  return request(token, `/teams?eventId=${encodeURIComponent(eventId)}`);
}

export async function fetchPublicSubmissions(eventId: string): Promise<ProjectSubmission[]> {
  const response = await fetch(`${authApiBaseUrl}/api/v1/events/${encodeURIComponent(eventId)}/submissions`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
  if (!response.ok) throw new Error(`Projects request failed with HTTP ${response.status}.`);
  return await response.json() as ProjectSubmission[];
}

export function createTeam(token: string, eventId: string, name: string, track: string): Promise<TeamView> {
  return request(token, "/teams", { method: "POST", body: JSON.stringify({ eventId, name, track }) });
}

export function joinTeam(token: string, teamId: number): Promise<TeamView> {
  return request(token, `/teams/${teamId}/join`, { method: "POST" });
}

export function joinTeamByInvite(token: string, inviteCode: string): Promise<TeamView> {
  return request(token, `/teams/invite/${encodeURIComponent(inviteCode)}/join`, { method: "POST" });
}

export function assignJudge(token: string, eventId: string, email: string): Promise<void> {
  return request(token, `/events/${encodeURIComponent(eventId)}/judges`, { method: "POST", body: JSON.stringify({ email }) });
}

export function listEventJudges(token: string, eventId: string): Promise<EventJudge[]> {
  return request(token, `/events/${encodeURIComponent(eventId)}/judges`);
}

export function fetchJudgeReviews(token: string): Promise<JudgeReview[]> {
  return request(token, "/judge-reviews");
}

export function saveJudgeReview(token: string, eventId: string, submissionId: number, scores: Record<string, number>, comment: string): Promise<JudgeReview> {
  return request(token, `/judge-reviews/${encodeURIComponent(eventId)}`, { method: "PUT", body: JSON.stringify({ submissionId, criterionScores: scores, comment }) });
}

export function voteForSubmission(token: string, eventId: string, submissionId: number): Promise<{ votes: number }> {
  return request(token, `/events/${encodeURIComponent(eventId)}/votes`, { method: "POST", body: JSON.stringify({ submissionId }) });
}

export function normalizeScores(token: string, eventId: string): Promise<Workspace> {
  return request(token, `/events/${encodeURIComponent(eventId)}/normalize`, { method: "POST" });
}

export function archiveEvent(token: string, eventId: string): Promise<Workspace> {
  return request(token, `/events/${encodeURIComponent(eventId)}/archive`, { method: "POST" });
}

export function issueCertificates(token: string, eventId: string): Promise<Certificate[]> {
  return request(token, `/events/${encodeURIComponent(eventId)}/certificates`, { method: "POST" });
}

export function fetchMyCertificates(token: string): Promise<Certificate[]> {
  return request(token, "/certificates/me");
}

export function verifyCertificate(code: string): Promise<CertificateVerification> {
  const query = new URLSearchParams({ code });
  return fetch(`${authApiBaseUrl}/api/v1/lifecycle/certificates/verify?${query.toString()}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8_000),
  }).then(async (response) => {
    if (!response.ok) throw new Error(`Certificate verification failed with HTTP ${response.status}.`);
    return await response.json() as CertificateVerification;
  });
}

export function fetchOrganizationMembers(token: string): Promise<OrganizationMember[]> {
  return fetch(`${authApiBaseUrl}/api/v1/auth/organization/members`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8_000) })
    .then(async (response) => {
      if (!response.ok) throw new Error("Could not load organization members.");
      return await response.json() as OrganizationMember[];
    });
}
