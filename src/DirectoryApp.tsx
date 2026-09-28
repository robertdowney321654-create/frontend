import { useEffect, useState, type FormEvent } from "react";

import {
  fetchWorkspace,
  fetchPublicEvents,
  fetchProjectComments,
  addProjectComment,
  formatCutoff,
  isCutoffPassed,
  saveWorkspace,
  updateProjectSubmission as updateProjectSubmissionRequest,
  type HackathonRecord,
  type JudgeScore,
  type ProjectSubmission,
  type ProjectComment,
  type Registration,
  type RubricCriterion,
  type Workspace,
} from "./api/workspace";
import { loadSession, saveOrganizationProfile, savePersonProfile, type AuthSession } from "./api/auth";
import {
  assignJudge,
  archiveEvent,
  fetchJudgeReviews,
  fetchMyCertificates,
  fetchPublicSubmissions,
  issueCertificates,
  joinTeamByInvite,
  normalizeScores,
  saveJudgeReview,
  voteForSubmission,
  type Certificate,
  type JudgeReview,
} from "./api/lifecycle";
import RoleEntry from "./RoleEntry";
import RoleWorkspace, { type AccessRole, type RoleProfile } from "./RoleWorkspace";

type Hackathon = HackathonRecord;
type EventFormat = Hackathon["format"];

const workspaceStorageKey = "sparks-hackathon-workspace-v1";
const registrationsKey = "sparks-public-registrations-v1";
const hostedEventsKey = "sparks-hosted-events-v1";
const sessionStorageKey = "sparks-session-v1";
const defaultRubric: RubricCriterion[] = [
  { id: "impact", label: "Potential impact", weight: 40 },
  { id: "feasibility", label: "Feasibility", weight: 25 },
  { id: "originality", label: "Originality", weight: 20 },
  { id: "presentation", label: "Presentation", weight: 15 },
];

const emptyWorkspace: Workspace = {
  events: [], registrations: [], projectSubmissions: [], judgingRubric: defaultRubric, judgeScores: [], publishedEventIds: [],
  participants: [], teams: [], submissions: [], judgingNormalized: false,
  resultsPublished: false, certificatesIssued: 0, archived: false,
};

const sampleHackathons: Hackathon[] = [
  {
    id: "build-for-better", title: "Build for Better", host: "Sparks Community", category: "Climate & sustainability", format: "Hybrid",
    dates: "Oct 18–20, 2026", deadline: "2026-10-17T23:59:00-07:00", submissionDeadline: "2026-10-20T12:00:00-07:00", location: "Oakland, CA + online", description: "Build practical ideas for a brighter, fairer, more sustainable everyday. Bring a half-formed idea or come find your people on arrival.",
    prize: "$12,000", participants: 86, spots: 120, tracks: ["Climate tech", "Future of work", "Civic access", "Open innovation"], eligibility: "Open to all builders, designers, and curious problem-solvers, age 18+.", color: "mint", symbol: "B",
    schedule: [{ date: "Oct 18 · 9:00 AM", title: "Doors open & team forming", detail: "Meet the community, find a team, pick a challenge." }, { date: "Oct 19 · 10:00 AM", title: "Build day", detail: "Mentors and workshops available throughout the day." }, { date: "Oct 20 · 12:00 PM", title: "Submissions close", detail: "Share your demo, project story, and what comes next." }],
  },
  {
    id: "ai-for-everyone", title: "AI for Everyone", host: "Common Ground Labs", category: "AI & accessibility", format: "Online",
    dates: "Nov 6–8, 2026", deadline: "2026-11-02T23:59:00Z", submissionDeadline: "2026-11-08T18:00:00Z", location: "Online · global teams", description: "Make AI more useful, understandable, and accessible. Prototype tools that put people first, not the model.",
    prize: "$8,000", participants: 214, spots: 280, tracks: ["Accessible AI", "Trust & safety", "Learning tools"], eligibility: "Open worldwide to individuals and teams of up to five.", color: "blue", symbol: "AI",
    schedule: [{ date: "Nov 6 · 4:00 PM UTC", title: "Virtual kickoff", detail: "Challenge reveal, team matching, and mentor introductions." }, { date: "Nov 7 · All day", title: "Build & mentor hours", detail: "Drop-in sessions with product, design, and ML mentors." }, { date: "Nov 8 · 6:00 PM UTC", title: "Demos & awards", detail: "Present to judges and the community." }],
  },
  {
    id: "civic-makers", title: "Civic Makers Weekend", host: "CityLab Collective", category: "Civic tech", format: "In person",
    dates: "Oct 24–25, 2026", deadline: "2026-10-22T23:59:00-05:00", submissionDeadline: "2026-10-25T15:00:00-05:00", location: "Chicago, IL", description: "Work alongside local organizers to make public services easier to find, understand, and use.",
    prize: "$5,000", participants: 78, spots: 90, tracks: ["Public data", "Local services", "Community safety"], eligibility: "Open to adults. Chicago-area experience is welcome, not required.", color: "coral", symbol: "C",
    schedule: [{ date: "Oct 24 · 10:00 AM", title: "Community briefings", detail: "Hear directly from residents and public-interest partners." }, { date: "Oct 24 · 1:00 PM", title: "Build session", detail: "Form teams and work with civic design mentors." }, { date: "Oct 25 · 3:00 PM", title: "Public showcase", detail: "Demo your work to community reviewers." }],
  },
  {
    id: "open-source-build", title: "Open Source Buildathon", host: "Patchwork Foundation", category: "Open source", format: "Online",
    dates: "Nov 13–15, 2026", deadline: "2026-11-12T23:59:00Z", submissionDeadline: "2026-11-15T16:00:00Z", location: "Online · global teams", description: "Make open-source software friendlier to contribute to, easier to maintain, and more welcoming to new builders.",
    prize: "$10,000", participants: 159, spots: 240, tracks: ["Developer experience", "Digital commons", "First contribution"], eligibility: "All experience levels. New open-source contributors especially welcome.", color: "violet", symbol: "</>",
    schedule: [{ date: "Nov 13 · 5:00 PM UTC", title: "Project marketplace", detail: "Browse maintainer briefs and form contributor teams." }, { date: "Nov 14 · All day", title: "Contribution sprint", detail: "Pair with maintainers and ship useful improvements." }, { date: "Nov 15 · 4:00 PM UTC", title: "Project demos", detail: "Share merged work, prototypes, and next steps." }],
  },
  {
    id: "campus-climate", title: "Campus Climate Jam", host: "Student Impact Network", category: "Student hackathon", format: "In person",
    dates: "Oct 10–11, 2026", deadline: "2026-10-08T23:59:00-07:00", submissionDeadline: "2026-10-11T14:00:00-07:00", location: "Berkeley, CA", description: "Turn campus climate ideas into small, testable projects students can put into action this semester.",
    prize: "$3,000", participants: 112, spots: 150, tracks: ["Low-waste campus", "Clean mobility", "Food systems"], eligibility: "Current college and university students, any discipline.", color: "yellow", symbol: "J",
    schedule: [{ date: "Oct 10 · 9:30 AM", title: "Student-led kickoff", detail: "Choose a campus challenge and build a cross-discipline team." }, { date: "Oct 10 · 2:00 PM", title: "Prototype lab", detail: "Get feedback from campus sustainability partners." }, { date: "Oct 11 · 2:00 PM", title: "Pitch & showcase", detail: "Present practical projects to student and faculty judges." }],
  },
  {
    id: "health-futures", title: "Health Futures 2027", host: "Care, Designed", category: "Health & wellbeing", format: "Hybrid",
    dates: "Jan 15–17, 2027", deadline: "2027-01-10T23:59:00-05:00", submissionDeadline: "2027-01-17T13:00:00-05:00", location: "Toronto, ON + online", description: "Imagine more human healthcare experiences with patients, clinicians, and builders in the same room.",
    prize: "$15,000", participants: 201, spots: 250, tracks: ["Care access", "Patient experience", "Wellbeing at work"], eligibility: "Open to builders and healthcare practitioners worldwide.", color: "pink", symbol: "H",
    schedule: [{ date: "Jan 15 · 9:00 AM ET", title: "Care stories & kickoff", detail: "Learn from patients, clinicians, and care teams." }, { date: "Jan 16 · All day", title: "Build with mentors", detail: "Prototype with clinical, design, and technology mentors." }, { date: "Jan 17 · 1:00 PM ET", title: "Demo day", detail: "Present to judges and community partners." }],
  },
];

function loadWorkspace(accountId: number): Workspace {
  try {
    const saved = localStorage.getItem(`${workspaceStorageKey}-${accountId}`);
    return saved ? { ...emptyWorkspace, ...JSON.parse(saved) as Partial<Workspace> } : emptyWorkspace;
  } catch {
    return emptyWorkspace;
  }
}

function loadRegistrations(accountId: number): Registration[] {
  try {
    const saved = localStorage.getItem(`${registrationsKey}-${accountId}`);
    return saved ? JSON.parse(saved) as Registration[] : [];
  } catch {
    return [];
  }
}

function loadHackathons(accountId: number): Hackathon[] {
  try {
    const saved = localStorage.getItem(`${hostedEventsKey}-${accountId}`);
    return [...sampleHackathons, ...(saved ? JSON.parse(saved) as Hackathon[] : [])];
  } catch {
    return sampleHackathons;
  }
}

function App() {
  const [entryRole, setEntryRole] = useState<AccessRole | null>(null);
  const [isHostFormOpen, setIsHostFormOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<AccessRole | null>(null);
  const [identityEmail, setIdentityEmail] = useState("");
  const [profile, setProfile] = useState<RoleProfile>({ name: "", email: "", organization: "", website: "", description: "" });
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showAuthChooser, setShowAuthChooser] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [editingEvent, setEditingEvent] = useState<Hackathon | null>(null);
  const [events, setEvents] = useState<Hackathon[]>(sampleHackathons);
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [judgeReviews, setJudgeReviews] = useState<JudgeReview[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [apiConnected, setApiConnected] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem(sessionStorageKey);
    if (!token) { setAuthReady(true); return; }
    void loadSession(token).then((session) => {
      localStorage.setItem(sessionStorageKey, session.access_token);
      setAuthSession(session);
      setEntryRole(session.account.role === "organizer" ? "organizer" : "participant");
      setIdentityEmail(session.account.email);
      setProfile({ name: session.account.full_name, email: session.account.email, organization: session.organization?.name ?? "", website: session.organization?.website ?? "", description: session.organization?.description ?? "" });
      setActiveRole(session.account.role === "organizer" ? "organizer" : session.account.roles.includes("judge") ? "participant" : null);
      setEvents(loadHackathons(session.account.id));
      setWorkspace(loadWorkspace(session.account.id));
      setRegistrations(loadRegistrations(session.account.id));
    }).catch(() => localStorage.removeItem(sessionStorageKey)).finally(() => setAuthReady(true));
  }, []);

  useEffect(() => {
    if (!authSession) return;
    try { localStorage.setItem(`${workspaceStorageKey}-${authSession.account.id}`, JSON.stringify(workspace)); } catch { /* Keep this session's data in memory. */ }
  }, [workspace, authSession]);

  useEffect(() => {
    try {
      if (authSession) localStorage.setItem(`${registrationsKey}-${authSession.account.id}`, JSON.stringify(registrations));
    } catch {
      // Keep registration confirmation available for this page session.
    }
  }, [registrations, authSession]);

  useEffect(() => {
    try {
      if (authSession) localStorage.setItem(`${hostedEventsKey}-${authSession.account.id}`, JSON.stringify(events.filter((event) => !sampleHackathons.some((sample) => sample.id === event.id))));
    } catch {
      // Keep created event details available for this page session.
    }
  }, [events, authSession]);

  useEffect(() => {
    if (!authSession) { setIsHydrated(false); setApiConnected(false); return; }
    let isMounted = true;
    setIsHydrated(false);
    void fetchWorkspace(authSession.access_token).then((remoteWorkspace) => {
      if (!isMounted) return;
      if (remoteWorkspace) {
        setWorkspace({ ...emptyWorkspace, ...remoteWorkspace });
        setRegistrations(remoteWorkspace.registrations);
        setEvents((current) => {
          const merged = new Map([...sampleHackathons, ...current, ...remoteWorkspace.events].map((event) => [event.id, event]));
          return [...merged.values()];
        });
      }
      setApiConnected(true);
    }).catch(() => undefined).finally(() => {
      if (isMounted) setIsHydrated(true);
    });
    return () => { isMounted = false; };
  }, [authSession]);

  useEffect(() => {
    if (!authSession || entryRole !== "participant") return;
    const inviteCode = new URLSearchParams(window.location.search).get("teamInvite");
    if (!inviteCode) return;
    let isMounted = true;
    void joinTeamByInvite(authSession.access_token, inviteCode).then(async () => {
      const refreshed = await fetchWorkspace(authSession.access_token);
      if (!isMounted || !refreshed) return;
      setWorkspace({ ...emptyWorkspace, ...refreshed });
      setRegistrations(refreshed.registrations);
      setActiveRole("participant");
    }).catch((reason) => {
      if (isMounted) window.alert(reason instanceof Error ? reason.message : "The team invite could not be used.");
    }).finally(() => {
      if (!isMounted) return;
      const url = new URL(window.location.href);
      url.searchParams.delete("teamInvite");
      window.history.replaceState(null, "", url.toString());
    });
    return () => { isMounted = false; };
  }, [authSession, entryRole]);

  useEffect(() => {
    if (!authSession) return;
    void fetchPublicEvents().then((publicEvents) => {
      setEvents((current) => [...new Map([...sampleHackathons, ...current, ...publicEvents].map((event) => [event.id, event])).values()]);
    }).catch(() => undefined);
    void fetchJudgeReviews(authSession.access_token).then(setJudgeReviews).catch(() => setJudgeReviews([]));
    void fetchMyCertificates(authSession.access_token).then(setCertificates).catch(() => setCertificates([]));
  }, [authSession]);

  useEffect(() => {
    if (!isHydrated || !apiConnected || !authSession) return;
    const timeout = window.setTimeout(() => {
      void saveWorkspace(authSession.access_token, {
        ...workspace,
        events: workspace.events.filter((event) => !sampleHackathons.some((sample) => sample.id === event.id)),
      }).catch(() => setApiConnected(false));
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [workspace, apiConnected, isHydrated, authSession]);

  const registerForEvent = (event: Hackathon, registration: Registration) => {
    if (isCutoffPassed(event.registrationDeadline || event.deadline) || event.participants + registrations.filter((item) => item.eventId === event.id).length >= event.spots) return;
    setRegistrations((current) => {
      if (current.some((item) => item.eventId === event.id && item.email.toLowerCase() === registration.email.toLowerCase())) return current;
      return [...current, registration];
    });
    setWorkspace((current) => {
      const alreadyRegistered = current.registrations.some((item) => item.eventId === event.id && item.email.toLowerCase() === registration.email.toLowerCase());
      if (alreadyRegistered) return current;
      const participants = event.id === "build-for-better" && !current.participants.some((item) => item.email.toLowerCase() === registration.email.toLowerCase())
        ? [...current.participants, { id: Date.now(), name: registration.name, email: registration.email, track: registration.track, team: registration.teamName || registration.teamPreference }]
        : current.participants;
      return {
        ...current,
        registrations: [...current.registrations, registration],
        participants,
      };
    });
  };

  const createHackathon = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    const values = new FormData(formEvent.currentTarget);
    const title = String(values.get("title") ?? "").trim();
    const tracks = String(values.get("tracks") ?? "").split(",").map((track) => track.trim()).filter(Boolean);
    if (!title) return;
    const palettes = ["mint", "blue", "coral", "yellow", "pink"] as const;
    const dates = String(values.get("dates") ?? "").trim();
    const registrationDeadline = String(values.get("deadline") ?? "");
    const submissionDeadline = String(values.get("submissionDeadline") ?? "");
    const votingDeadline = String(values.get("votingDeadline") ?? submissionDeadline);
    const registrationCutoff = new Date(registrationDeadline).toISOString();
    const event: Hackathon = {
      id: `hosted-${Date.now()}`, title,
      host: String(values.get("host") ?? "").trim() || profile.organization || profile.name || "Independent organizer",
      category: String(values.get("category") ?? "Open source"),
      format: String(values.get("format") ?? "Online") as EventFormat,
      dates,
      deadline: formatCutoff(registrationCutoff),
      registrationDeadline: registrationCutoff,
      submissionDeadline: new Date(submissionDeadline).toISOString(),
      votingDeadline: new Date(votingDeadline).toISOString(),
      location: String(values.get("location") ?? "Online").trim() || "Online",
      description: String(values.get("description") ?? "").trim(),
      prize: String(values.get("prize") ?? "No prize listed").trim() || "No prize listed",
      participants: 0, spots: Math.max(1, Number(values.get("spots") ?? 100)),
      tracks: tracks.length ? tracks : ["Open innovation"],
      eligibility: String(values.get("eligibility") ?? "").trim() || "Open to builders and curious problem-solvers.",
      color: palettes[events.length % palettes.length],
      symbol: title.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      schedule: [{ date: dates, title: "Kickoff & team forming", detail: "Meet other participants and choose a challenge." }, { date: dates, title: "Build and share", detail: "Develop your idea, then present it to the community." }],
    };
    setEvents((current) => [event, ...current]);
    setWorkspace((current) => ({ ...current, events: [event, ...current.events.filter((item) => item.id !== event.id)] }));
    setIsHostFormOpen(false);
    setSelectedEventId(event.id);
  };

  const updateHackathon = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!editingEvent || !authSession) throw new Error("The event could not be loaded for editing.");
    const values = new FormData(formEvent.currentTarget);
    const registrationDeadline = new Date(String(values.get("deadline") ?? ""));
    const submissionDeadline = new Date(String(values.get("submissionDeadline") ?? ""));
    const votingDeadline = new Date(String(values.get("votingDeadline") ?? ""));
    if (Number.isNaN(registrationDeadline.getTime()) || Number.isNaN(submissionDeadline.getTime()) || Number.isNaN(votingDeadline.getTime())) {
      throw new Error("Enter valid registration and submission deadlines.");
    }
    const dates = String(values.get("dates") ?? "").trim();
    const tracks = String(values.get("tracks") ?? "").split(",").map((track) => track.trim()).filter(Boolean);
    const updatedEvent: Hackathon = {
      ...editingEvent,
      title: String(values.get("title") ?? "").trim(),
      host: String(values.get("host") ?? "").trim(),
      category: String(values.get("category") ?? editingEvent.category),
      format: String(values.get("format") ?? editingEvent.format) as EventFormat,
      dates,
      deadline: formatCutoff(registrationDeadline.toISOString()),
      registrationDeadline: registrationDeadline.toISOString(),
      submissionDeadline: submissionDeadline.toISOString(),
      votingDeadline: votingDeadline.toISOString(),
      location: String(values.get("location") ?? "").trim() || "Online",
      description: String(values.get("description") ?? "").trim(),
      prize: String(values.get("prize") ?? "").trim() || "No prize listed",
      spots: Math.max(1, Number(values.get("spots") ?? editingEvent.spots)),
      tracks: tracks.length ? tracks : ["Open innovation"],
      eligibility: String(values.get("eligibility") ?? "").trim(),
      schedule: editingEvent.schedule.map((item) => ({ ...item, date: dates })),
    };
    const nextWorkspace = {
      ...workspace,
      events: workspace.events.map((event) => event.id === updatedEvent.id ? updatedEvent : event),
    };
    await saveWorkspace(authSession.access_token, nextWorkspace);
    setWorkspace(nextWorkspace);
    setEvents((current) => current.map((event) => event.id === updatedEvent.id ? updatedEvent : event));
    setEditingEvent(null);
  };

  const createProjectSubmission = (event: Hackathon, submission: Omit<ProjectSubmission, "id" | "eventId" | "score" | "votes">) => {
    const project: ProjectSubmission = { ...submission, id: Date.now(), eventId: event.id, score: 0, votes: 0 };
    setWorkspace((current) => ({ ...current, projectSubmissions: [...current.projectSubmissions, project] }));
  };

  const updateProject = async (
    eventId: string,
    submissionId: number,
    update: Pick<ProjectSubmission, "title" | "description" | "repositoryUrl" | "demoUrl" | "track" | "status">,
  ) => {
    if (!authSession) throw new Error("Sign in to update your project.");
    const saved = await updateProjectSubmissionRequest(authSession.access_token, eventId, submissionId, update);
    setWorkspace((current) => ({
      ...current,
      projectSubmissions: current.projectSubmissions.map((item) => item.eventId === eventId && item.id === submissionId ? saved : item),
    }));
  };

  const saveRubric = (rubric: RubricCriterion[]) => {
    setWorkspace((current) => ({ ...current, judgingRubric: rubric }));
  };

  const saveJudgeScore = (submissionId: number, judgeEmail: string, criterionScores: Record<string, number>, comment: string) => {
    setWorkspace((current) => {
      const project = current.projectSubmissions.find((item) => item.id === submissionId);
      if (!project) return current;
      const score: JudgeScore = { id: Date.now(), eventId: project.eventId, submissionId, judgeEmail, criterionScores, comment };
      const judgeScores = [...current.judgeScores.filter((item) => !(item.submissionId === submissionId && item.judgeEmail.toLowerCase() === judgeEmail.toLowerCase())), score];
      const projectScores = judgeScores.filter((item) => item.submissionId === submissionId);
      const average = projectScores.reduce((total, item) => total + current.judgingRubric.reduce((weighted, criterion) => weighted + ((item.criterionScores[criterion.id] ?? 0) / 5) * criterion.weight, 0), 0) / projectScores.length;
      return {
        ...current,
        judgeScores,
        projectSubmissions: current.projectSubmissions.map((item) => item.id === submissionId ? { ...item, score: Math.round(average), status: "Scored" } : item),
      };
    });
  };

  const toggleResults = (eventId: string) => {
    setWorkspace((current) => ({
      ...current,
      publishedEventIds: current.publishedEventIds.includes(eventId)
        ? current.publishedEventIds.filter((id) => id !== eventId)
        : [...current.publishedEventIds, eventId],
    }));
  };

    const refreshWorkspace = async () => {
      if (!authSession) return;
      const refreshed = await fetchWorkspace(authSession.access_token);
      if (refreshed) {
        setWorkspace({ ...emptyWorkspace, ...refreshed });
        setRegistrations(refreshed.registrations);
      }
    };

    const updateTeamRegistration = (eventId: string, email: string, teamName: string) => {
      const updateRegistration = (item: Registration) => item.eventId === eventId && item.email.toLowerCase() === email.toLowerCase()
        ? { ...item, teamName, teamPreference: "I have a team" }
        : item;
      setRegistrations((current) => current.map(updateRegistration));
      setWorkspace((current) => ({ ...current, registrations: current.registrations.map(updateRegistration) }));
    };

    const normalizeEventScores = async (eventId: string) => {
      if (!authSession) return;
      setWorkspace(await normalizeScores(authSession.access_token, eventId));
    };

    const archiveHackathon = async (eventId: string) => {
      if (!authSession) return;
      const nextWorkspace = await archiveEvent(authSession.access_token, eventId);
      setWorkspace(nextWorkspace);
      setEvents((current) => current.map((event) => event.id === eventId ? { ...event, isArchived: true } : event));
    };

    const issueEventCertificates = async (eventId: string) => {
      if (!authSession) return;
      const issued = await issueCertificates(authSession.access_token, eventId);
      const mine = await fetchMyCertificates(authSession.access_token);
      setCertificates(mine);
      setWorkspace((current) => ({ ...current, certificatesIssued: Math.max(current.certificatesIssued, issued.length) }));
    };

    const castVote = async (eventId: string, submissionId: number) => {
      if (!authSession) return;
      await voteForSubmission(authSession.access_token, eventId, submissionId);
    };

    const submitJudgeReview = async (review: JudgeReview, scores: Record<string, number>, comment: string) => {
      if (!authSession) return;
      await saveJudgeReview(authSession.access_token, review.eventId, review.submissionId, scores, comment);
      setJudgeReviews(await fetchJudgeReviews(authSession.access_token));
    };

    const addEventJudge = async (eventId: string, email: string) => {
      if (!authSession) return;
      await assignJudge(authSession.access_token, eventId, email);
      setJudgeReviews(await fetchJudgeReviews(authSession.access_token));
    };

  const acceptSession = (session: AuthSession) => {
    localStorage.setItem(sessionStorageKey, session.access_token);
    setAuthSession(session);
    setShowAuthChooser(false);
    setEntryRole(session.account.role === "organizer" ? "organizer" : "participant");
    setIdentityEmail(session.account.email);
    setProfile({ name: session.account.full_name, email: session.account.email, organization: session.organization?.name ?? "", website: session.organization?.website ?? "", description: session.organization?.description ?? "" });
    setEvents(loadHackathons(session.account.id));
    setWorkspace(loadWorkspace(session.account.id));
    setRegistrations(loadRegistrations(session.account.id));
    setActiveRole(session.account.role === "organizer" ? "organizer" : session.account.roles.includes("judge") ? "participant" : null);
    setSelectedEventId(null);
  };

  const logout = () => {
    localStorage.removeItem(sessionStorageKey);
    setAuthSession(null);
    setShowAuthChooser(false);
    setActiveRole(null);
    setEntryRole(null);
    setSelectedEventId(null);
    setIdentityEmail("");
    setProfile({ name: "", email: "", organization: "", website: "", description: "" });
    setWorkspace(emptyWorkspace);
    setRegistrations([]);
    setEvents(sampleHackathons);
    setIsHostFormOpen(false);
  };

  const chooseWorkspace = () => {
    setShowAuthChooser(true);
    setActiveRole(null);
    setEntryRole(null);
    setSelectedEventId(null);
  };

  if (!authReady) return <div className="auth-loading" role="status">Loading your account…</div>;

  if (showAuthChooser) {
    return <RoleEntry onAuthenticated={acceptSession} onBack={() => setShowAuthChooser(false)} />;
  }

  if (!authSession) {
    return <HackathonDirectory
      viewerRole="participant"
      profile={profile}
      events={events}
      accessToken=""
      selectedEvent={events.find((event) => event.id === selectedEventId) ?? null}
      registrations={registrations}
      isHostFormOpen={isHostFormOpen}
      onSelectEvent={setSelectedEventId}
      onBackToDirectory={() => setSelectedEventId(null)}
      onRegister={registerForEvent}
      onOpenHostForm={() => setIsHostFormOpen(true)}
      onCloseHostForm={() => setIsHostFormOpen(false)}
      onCreateHackathon={createHackathon}
      onOpenWorkspace={() => setShowAuthChooser(true)}
      onVote={castVote}
    />;
  }

  if (activeRole && authSession) {
    return <><RoleWorkspace
      role={activeRole}
      email={identityEmail}
      profile={profile}
      events={events}
      managedEvents={workspace.events}
      accessToken={authSession.access_token}
      availableRoles={authSession.account.roles}
      registrations={workspace.registrations}
      submissions={workspace.projectSubmissions}
      rubric={workspace.judgingRubric}
      judgeScores={workspace.judgeScores}
      publishedEventIds={workspace.publishedEventIds}
      judgeReviews={judgeReviews}
      certificates={certificates}
      onBack={() => { setSelectedEventId(null); setActiveRole(null); }}
      onLogout={logout}
      onChooseWorkspace={chooseWorkspace}
      onSelectEvent={setSelectedEventId}
      onSaveProfile={async (nextProfile) => {
        if (!authSession) return;
        const account = await savePersonProfile(authSession.access_token, nextProfile.name);
        const organization = authSession.account.role === "organizer"
          ? await saveOrganizationProfile(authSession.access_token, { name: nextProfile.organization, website: nextProfile.website, description: nextProfile.description })
          : null;
        setIdentityEmail(account.email);
        setProfile({ ...nextProfile, email: account.email });
        setAuthSession({ ...authSession, account, organization });
      }}
      onSubmitProject={createProjectSubmission}
      onUpdateProject={updateProject}
      onSaveRubric={saveRubric}
      onSaveScore={saveJudgeScore}
      onToggleResults={toggleResults}
      onTeamChanged={updateTeamRegistration}
      onNormalizeScores={normalizeEventScores}
      onArchiveEvent={archiveHackathon}
      onIssueCertificates={issueEventCertificates}
      onVote={castVote}
      onAssignJudge={addEventJudge}
      onSaveAssignedReview={submitJudgeReview}
      onRefreshWorkspace={refreshWorkspace}
      onEditEvent={(eventId) => setEditingEvent(workspace.events.find((event) => event.id === eventId) ?? null)}
    />{editingEvent && <HostEventDialog
      defaultHost={profile.organization || profile.name}
      event={editingEvent}
      onClose={() => setEditingEvent(null)}
      onSubmit={updateHackathon}
    />}</>;
  }

  return <HackathonDirectory
    viewerRole={entryRole}
    profile={profile}
    events={events}
    accessToken={authSession.access_token}
    selectedEvent={events.find((event) => event.id === selectedEventId) ?? null}
    registrations={registrations}
    isHostFormOpen={isHostFormOpen}
    onSelectEvent={setSelectedEventId}
    onBackToDirectory={() => setSelectedEventId(null)}
    onRegister={registerForEvent}
    onOpenHostForm={() => setIsHostFormOpen(true)}
    onCloseHostForm={() => setIsHostFormOpen(false)}
    onCreateHackathon={createHackathon}
    onOpenWorkspace={() => setActiveRole(entryRole)}
    onVote={castVote}
  />;
}

type HackathonDirectoryProps = {
  viewerRole: AccessRole;
  profile: RoleProfile;
  accessToken: string;
  events: Hackathon[]; selectedEvent: Hackathon | null; registrations: Registration[]; isHostFormOpen: boolean;
  onSelectEvent: (eventId: string) => void; onBackToDirectory: () => void;
  onRegister: (event: Hackathon, registration: Registration) => void; onOpenHostForm: () => void;
  onCloseHostForm: () => void; onCreateHackathon: (event: FormEvent<HTMLFormElement>) => void;
  onOpenWorkspace: () => void;
  onVote: (eventId: string, submissionId: number) => Promise<void>;
};

function HackathonDirectory(props: HackathonDirectoryProps) {
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<"All formats" | EventFormat>("All formats");
  const [sort, setSort] = useState("Closing soon");
  const visibleEvents = props.events
    .filter((event) => props.viewerRole === "organizer" || !isCutoffPassed(event.registrationDeadline || event.deadline))
    .filter((event) => format === "All formats" || event.format === format)
    .filter((event) => `${event.title} ${event.host} ${event.category} ${event.tracks.join(" ")}`.toLowerCase().includes(search.toLowerCase().trim()))
    .sort((left, right) => sort === "Most participants" ? right.participants - left.participants : 0);

  if (props.selectedEvent) return <><EventDetails viewerRole={props.viewerRole} event={props.selectedEvent} registrations={props.registrations} onBack={props.onBackToDirectory} onRegister={props.onRegister} onOpenHostForm={props.onOpenHostForm} onOpenWorkspace={props.onOpenWorkspace} /><CommunitySubmissionGallery event={props.selectedEvent} viewerRole={props.viewerRole} accessToken={props.accessToken} onVote={props.onVote} />{props.isHostFormOpen && <HostEventDialog defaultHost={props.profile.organization || props.profile.name} onClose={props.onCloseHostForm} onSubmit={props.onCreateHackathon} />}</>;

  return <div className="public-shell"><PublicHeader viewerRole={props.viewerRole} onOpenHostForm={props.onOpenHostForm} onOpenWorkspace={props.onOpenWorkspace} /><main className="directory-main" id="events">
    <section className="directory-intro"><div className="directory-copy"><span className="eyebrow"><span className="eyebrow-line" /> SAMPLE LISTINGS <span className="eyebrow-dot">·</span> SPARKS DIRECTORY</span><h1>Find your next<br className="directory-break" /> big idea.</h1><p>Meet your people, pick a challenge, and make something that matters. Your next weekend project is out there.</p></div><div className="directory-stats"><div><strong>{props.events.length}</strong><span>LISTED HACKATHONS</span></div><div><strong>{new Set(props.events.map((event) => event.format)).size}</strong><span>WAYS TO JOIN</span></div><div><strong>01</strong><span>GOOD IDEA NEEDED</span></div></div></section>
    <section className="directory-toolbar" aria-label="Find an event"><label className="event-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events, topics, hosts" aria-label="Search hackathons" />{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")}>×</button>}</label><label className="sort-select"><span>Sort</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option>Closing soon</option><option>Most participants</option></select></label></section>
    <section className="directory-filter-group" aria-label="Event formats"><div className="directory-filter-label">FORMAT</div><div className="filter-pills">{(["All formats", "Online", "In person", "Hybrid"] as const).map((item) => <button className={format === item ? "filter-pill selected" : "filter-pill"} type="button" key={item} aria-pressed={format === item} onClick={() => setFormat(item)}>{item}</button>)}</div></section>
    <section className="listing-heading"><div><h2>Explore open hackathons</h2><p>{visibleEvents.length} sample event{visibleEvents.length === 1 ? "" : "s"} to explore</p></div><span className="listing-open"><i /> REGISTRATION OPEN</span></section>
    {visibleEvents.length ? <div className="hackathon-grid">{visibleEvents.map((event) => <HackathonCard key={event.id} event={event} registrationCount={props.registrations.filter((item) => item.eventId === event.id).length} onOpen={() => props.onSelectEvent(event.id)} />)}</div> : <div className="empty-list"><span>⌕</span><h2>No matching hackathons</h2><p>Try another format or clear your search.</p><button type="button" onClick={() => { setSearch(""); setFormat("All formats"); }}>Clear filters</button></div>}
    <footer className="directory-footer"><span>SPARKS <i>·</i> OPEN-SOURCE HACKATHON PLATFORM</span><span>BUILD SOMETHING GOOD</span></footer>
  </main>{props.isHostFormOpen && <HostEventDialog defaultHost={props.profile.organization || props.profile.name} onClose={props.onCloseHostForm} onSubmit={props.onCreateHackathon} />}</div>;
}

function PublicHeader({ viewerRole, onOpenHostForm, onOpenWorkspace: onOpenWorkspace }: { viewerRole: AccessRole; onOpenHostForm: () => void; onOpenWorkspace: () => void }) {
  return <header className="public-header"><a className="public-brand" href="#events" aria-label="Sparks event directory"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /><i /></span><span><strong>sparks</strong><small>HACKATHON DIRECTORY</small></span></a><nav aria-label="Public navigation"><a className="public-nav-current" href="#events">Explore events</a><button className="public-access-button" type="button" onClick={onOpenWorkspace}>{viewerRole === "organizer" ? "Workspace" : "Log in"}</button>{viewerRole === "organizer" && <button className="public-ghost-button" type="button" onClick={onOpenHostForm}>Create event</button>}</nav></header>;
}

function HostEventDialog({ defaultHost, event, onClose, onSubmit }: { defaultHost: string; event?: Hackathon; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void> }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
    setSaving(true);
    setError("");
    try {
      await onSubmit(formEvent);
      if (!event) onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The event could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  const localDateTime = (value: string | undefined) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
    return local.toISOString().slice(0, 16);
  };
  const fields = event;
  return <div className="dialog-backdrop host-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form className="create-dialog host-dialog" onSubmit={(formEvent) => void submit(formEvent)} aria-label={event ? "Edit hackathon" : "Create a hackathon listing"}>
      <button className="dialog-close" type="button" aria-label="Close" onClick={onClose}>×</button>
      <span className="eyebrow"><span className="eyebrow-line" /> {event ? "EDIT EVENT" : "HOST AN EVENT"}</span>
      <h2>{event ? "Update event details." : "Bring builders together."}</h2>
      <p>Publish an event for participants to discover, register for, and submit projects to.</p>
      <div className="host-form-grid">
        <label>Hackathon name<input name="title" required defaultValue={fields?.title} placeholder="e.g. Future Cities Jam" /></label>
        <label>Organizer or host<input name="host" required defaultValue={fields?.host || defaultHost} placeholder="Your organization" /></label>
        <label>Topic<select name="category" defaultValue={fields?.category ?? "Climate & sustainability"}><option>Climate & sustainability</option><option>AI & accessibility</option><option>Civic tech</option><option>Open source</option><option>Student hackathon</option><option>Health & wellbeing</option></select></label>
        <label>Format<select name="format" defaultValue={fields?.format ?? "Online"}><option>Online</option><option>In person</option><option>Hybrid</option></select></label>
        <label>Event dates<input name="dates" required defaultValue={fields?.dates} placeholder="Nov 13–15, 2026" /></label>
        <label>Registration closes<input name="deadline" type="datetime-local" required defaultValue={localDateTime(fields?.registrationDeadline || fields?.deadline)} /></label>
        <label>Project submissions close<input name="submissionDeadline" type="datetime-local" required defaultValue={localDateTime(fields?.submissionDeadline)} /></label>
        <label>Community voting closes<input name="votingDeadline" type="datetime-local" required defaultValue={localDateTime(fields?.votingDeadline || fields?.submissionDeadline)} /></label>
        <label>Location<input name="location" defaultValue={fields?.location} placeholder="Online or city, country" /></label>
        <label>Prize pool<input name="prize" defaultValue={fields?.prize} placeholder="$5,000 or no prize" /></label>
        <label>Participant spots<input name="spots" type="number" min={1} required defaultValue={fields?.spots ?? 100} /></label>
        <label className="host-field-full">Challenge tracks<input name="tracks" required defaultValue={fields?.tracks.join(", ")} placeholder="Climate tech, Mobility, Food systems" /></label>
        <label className="host-field-full">Eligibility<textarea name="eligibility" rows={2} defaultValue={fields?.eligibility ?? "Open to builders and curious problem-solvers."} /></label>
        <label className="host-field-full">What will participants build?<textarea name="description" required rows={3} defaultValue={fields?.description} placeholder="Describe the challenge and who should join." /></label>
      </div>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className="dialog-actions"><button className="quiet-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : event ? "Save changes" : "Create listing"} <span>→</span></button></div>
    </form>
  </div>;
}

function HackathonCard({ event, registrationCount, onOpen }: { event: Hackathon; registrationCount: number; onOpen: () => void }) {
  const isSample = sampleHackathons.some((sample) => sample.id === event.id);
  return <article className="hackathon-card"><button className={`event-cover art-${event.color}`} type="button" onClick={onOpen} aria-label={`Explore ${event.title}`}><span className="cover-orbit orbit-a" /><span className="cover-orbit orbit-b" /><span className="cover-host">{event.host}</span><strong className="cover-symbol">{event.symbol}</strong><span className="cover-format">{event.format}</span></button><div className="hackathon-card-body"><div className="event-card-kicker"><span>{event.category}</span><span className={isSample ? "sample-tag" : "open-tag"}>{isSample ? "SAMPLE" : <><i /> OPEN</>}</span></div><button className="event-card-title" type="button" onClick={onOpen}>{event.title}<span>↗</span></button><p className="event-card-date">{event.dates}<span>·</span>{event.location}</p><p className="event-card-description">{event.description}</p><div className="event-card-tracks">{event.tracks.slice(0, 2).map((track) => <span key={track}>{track}</span>)}{event.tracks.length > 2 && <span>+{event.tracks.length - 2}</span>}</div><div className="event-card-footer"><span><strong>{isSample ? "DEMO" : event.participants + registrationCount}</strong>{isSample ? " listing" : " registered"}</span><span><strong>{event.prize}</strong> in prizes</span><button type="button" onClick={onOpen}>View event <span>→</span></button></div></div></article>;
}

function EventDetails({ viewerRole, event, registrations, onBack, onRegister, onOpenHostForm, onOpenWorkspace: onOpenWorkspace }: { viewerRole: AccessRole; event: Hackathon; registrations: Registration[]; onBack: () => void; onRegister: (event: Hackathon, registration: Registration) => void; onOpenHostForm: () => void; onOpenWorkspace: () => void }) {
  const isRegistered = registrations.some((registration) => registration.eventId === event.id);
  const registeredHere = registrations.filter((registration) => registration.eventId === event.id).length;
  const registrationClosed = isCutoffPassed(event.registrationDeadline || event.deadline);
  const placesLeft = registrationClosed ? 0 : Math.max(0, event.spots - event.participants - registeredHere);
  const submitRegistration = (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (registrationClosed || placesLeft === 0) return;
    const values = new FormData(formEvent.currentTarget);
    onRegister(event, { eventId: event.id, name: String(values.get("name") ?? "").trim(), email: String(values.get("email") ?? "").trim(), track: String(values.get("track") ?? event.tracks[0]), teamPreference: String(values.get("teamPreference") ?? "Looking for a team"), teamName: String(values.get("teamName") ?? "").trim() });
  };

  return <div className="public-shell"><PublicHeader viewerRole={viewerRole} onOpenHostForm={onOpenHostForm} onOpenWorkspace={onOpenWorkspace} /><main className="event-detail-main"><button className="back-to-list" type="button" onClick={onBack}><span>←</span> All hackathons</button><section className="event-detail-layout"><div className="event-detail-content"><div className={`event-detail-art art-${event.color}`}><span className="detail-art-host">{event.host}</span><span className="detail-art-shape shape-one" /><span className="detail-art-shape shape-two" /><strong>{event.symbol}</strong><span className="detail-art-index">SPARKS EVENT <i>·</i> {event.dates.match(/\d{4}/)?.[0] ?? "2026"}</span></div><div className="detail-tags"><span>{event.category}</span><span>{event.format}</span><span className="detail-open"><i /> Registration open</span></div><h1>{event.title}</h1><p className="detail-description">{event.description}</p><div className="event-fact-grid"><div><span>WHEN</span><strong>{event.dates}</strong></div><div><span>WHERE</span><strong>{event.location}</strong></div><div><span>REGISTRATION CLOSES</span><strong>{event.deadline}</strong></div><div><span>PRIZE POOL</span><strong>{event.prize}</strong></div></div><section className="detail-section"><div className="detail-section-heading"><span className="eyebrow"><span className="eyebrow-line" /> PICK YOUR CHALLENGE</span><h2>Build in a direction that matters.</h2></div><div className="detail-track-grid">{event.tracks.map((track, index) => <div className="detail-track" key={track}><span>{String(index + 1).padStart(2, "0")}</span><strong>{track}</strong><i>↗</i></div>)}</div></section><section className="detail-section schedule-section"><div className="detail-section-heading"><span className="eyebrow"><span className="eyebrow-line" /> THE WEEKEND</span><h2>What to expect</h2></div><div className="event-schedule">{event.schedule.map((item, index) => <div className="schedule-row" key={item.title}><span className="schedule-number">0{index + 1}</span><div><time>{item.date}</time><strong>{item.title}</strong><p>{item.detail}</p></div></div>)}</div></section><section className="eligibility-note"><span>i</span><div><strong>Who can join</strong><p>{event.eligibility}</p></div></section></div><aside className="registration-panel"><div className="registration-panel-top"><span className="eyebrow">YOUR NEXT BUILD STARTS HERE</span><span className="spots-left">{placesLeft} spots left</span></div><h2>{viewerRole === "organizer" ? <>Event<br />preview.</> : <>Save your<br />place.</>}</h2><p className="registration-intro">Join {event.participants + registeredHere} builders already signed up.</p><div className="registration-prize"><span>PRIZE POOL</span><strong>{event.prize}</strong></div>{viewerRole === "organizer" ? <div className="organizer-event-note"><strong>Organizer preview</strong><p>You can explore this event, but participant registration is disabled in your organizer workspace.</p><button type="button" onClick={onOpenWorkspace}>Return to organizer workspace</button></div> : isRegistered ? <div className="registration-success" role="status"><span>✓</span><strong>You’re on the list.</strong><p>Your place is saved for {event.title}. This preview does not send email confirmations yet.</p><button type="button" onClick={onBack}>Explore more hackathons</button></div> : <form className="registration-form" onSubmit={submitRegistration}><label>Your name<input name="name" autoComplete="name" required placeholder="Alex Morgan" /></label><label>Email address<input name="email" type="email" autoComplete="email" required placeholder="alex@example.com" /></label><label>Challenge track<select name="track" defaultValue={event.tracks[0]}>{event.tracks.map((track) => <option key={track}>{track}</option>)}</select></label><label>Team status<select name="teamPreference" defaultValue="Looking for a team"><option>Looking for a team</option><option>I have a team</option><option>Going solo</option></select></label><label>Team name <span className="optional-label">OPTIONAL</span><input name="teamName" placeholder="Leave blank if you need a team" /></label><button className="register-button" type="submit" disabled={placesLeft === 0}>Register for free <span>→</span></button><small className="registration-terms">This preview saves your registration locally; email is not connected yet.</small></form>}</aside></section><footer className="directory-footer"><span>SPARKS <i>·</i> OPEN-SOURCE HACKATHON PLATFORM</span><span>YOUR NEXT IDEA STARTS HERE</span></footer></main></div>;
}

function CommunitySubmissionGallery({ event, viewerRole, accessToken, onVote }: { event: Hackathon; viewerRole: AccessRole; accessToken: string; onVote: (eventId: string, submissionId: number) => Promise<void> }) {
  const [submissions, setSubmissions] = useState<ProjectSubmission[]>([]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [track, setTrack] = useState("All tracks");
  const [openCommentsFor, setOpenCommentsFor] = useState<number | null>(null);
  const [comments, setComments] = useState<Record<number, ProjectComment[]>>({});
  const [commentDraft, setCommentDraft] = useState("");
  const [commentError, setCommentError] = useState("");
  const refresh = () => fetchPublicSubmissions(event.id).then(setSubmissions).catch(() => setSubmissions([]));
  useEffect(() => { void refresh(); }, [event.id]);
  const visibleSubmissions = submissions
    .filter((submission) => track === "All tracks" || submission.track === track)
    .filter((submission) => `${submission.title} ${submission.description} ${submission.team}`.toLowerCase().includes(search.trim().toLowerCase()));
  const vote = async (submissionId: number) => {
    setBusyId(submissionId);
    setMessage("");
    try {
      await onVote(event.id, submissionId);
      await refresh();
      setMessage("Your vote has been counted.");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Vote could not be saved.");
    } finally {
      setBusyId(null);
    }
  };
  const toggleComments = async (submissionId: number) => {
    setCommentError("");
    if (openCommentsFor === submissionId) {
      setOpenCommentsFor(null);
      return;
    }
    setOpenCommentsFor(submissionId);
    if (comments[submissionId]) return;
    try {
      const loadedComments = await fetchProjectComments(event.id, submissionId);
      setComments((current) => ({ ...current, [submissionId]: loadedComments }));
    } catch (reason) {
      setCommentError(reason instanceof Error ? reason.message : "Comments could not be loaded.");
    }
  };
  const postComment = async (submissionId: number) => {
    if (!commentDraft.trim()) return;
    setCommentError("");
    try {
      const comment = await addProjectComment(accessToken, event.id, submissionId, commentDraft.trim());
      setComments((current) => ({ ...current, [submissionId]: [...(current[submissionId] ?? []), comment] }));
      setCommentDraft("");
    } catch (reason) {
      setCommentError(reason instanceof Error ? reason.message : "Comment could not be posted.");
    }
  };
  if (!submissions.length) return null;
  return <section className="public-project-gallery"><span className="eyebrow"><span className="eyebrow-line" /> COMMUNITY SHOWCASE</span><h2>Projects to explore</h2><div className="public-project-toolbar"><label><span>Search projects</span><input type="search" value={search} onChange={(change) => setSearch(change.target.value)} placeholder="Title, summary, or team" /></label><label><span>Track</span><select value={track} onChange={(change) => setTrack(change.target.value)}><option>All tracks</option>{[...new Set(submissions.map((submission) => submission.track))].sort().map((item) => <option key={item}>{item}</option>)}</select></label></div>{visibleSubmissions.length ? <div className="public-project-list">{visibleSubmissions.map((submission) => <article key={submission.id}><div><span>{submission.track} · {submission.team}</span><h3>{submission.title}</h3><p>{submission.description}</p><button className="role-secondary" type="button" onClick={() => void toggleComments(submission.id)}>Comments ({comments[submission.id]?.length ?? "view"})</button>{openCommentsFor === submission.id && <div className="project-comments">{(comments[submission.id] ?? []).map((comment) => <p key={comment.id}><strong>{comment.author}</strong> {comment.body}</p>)}{viewerRole === "participant" && <form onSubmit={(formEvent) => { formEvent.preventDefault(); void postComment(submission.id); }}><label><span>Add a comment</span><textarea value={commentDraft} onChange={(change) => setCommentDraft(change.target.value)} maxLength={2000} required rows={2} /></label><button className="role-secondary" type="submit">Post comment</button></form>}</div>}</div><div className="public-project-actions"><span>{submission.votes} votes</span>{viewerRole === "participant" && <button className="role-secondary" type="button" disabled={busyId !== null} onClick={() => void vote(submission.id)}>{busyId === submission.id ? "Saving…" : "Vote"}</button>}</div></article>)}</div> : <p className="role-empty">No projects match those filters.</p>}{commentError && <p className="auth-error" role="alert">{commentError}</p>}{message && <p className="auth-security-note" role="status">{message}</p>}</section>;
}

export default App;