import { useEffect, useState, type FormEvent } from "react";
import { formatCutoff, isCutoffPassed, type HackathonRecord, type JudgeScore, type ProjectSubmission, type Registration, type RubricCriterion } from "./api/workspace";
import { createTeam, fetchOrganizationMembers, joinTeam, listEventJudges, listTeams, type Certificate, type EventJudge, type JudgeReview, type TeamView } from "./api/lifecycle";
import { inviteOrganizationMember, type AppRole, type OrganizationMember } from "./api/auth";

export type AccessRole = "participant" | "organizer" | "judge" | "admin";
export type RoleProfile = { name: string; email: string; organization: string; website: string; description: string };

type RoleWorkspaceProps = {
  role: AccessRole;
  email: string;
  profile: RoleProfile;
  events: HackathonRecord[];
  managedEvents: HackathonRecord[];
  accessToken: string;
  availableRoles: AppRole[];
  registrations: Registration[];
  submissions: ProjectSubmission[];
  rubric: RubricCriterion[];
  judgeScores: JudgeScore[];
  publishedEventIds: string[];
  judgeReviews: JudgeReview[];
  certificates: Certificate[];
  onBack: () => void;
  onLogout: () => void;
  onSelectEvent: (eventId: string) => void;
  onSaveProfile: (profile: RoleProfile) => Promise<void>;
  onRefreshWorkspace: () => Promise<void>;
  onEditEvent: (eventId: string) => void;
  onChooseWorkspace: () => void;
  onSubmitProject: (event: HackathonRecord, submission: Omit<ProjectSubmission, "id" | "eventId" | "score" | "votes">) => void;
  onUpdateProject: (eventId: string, submissionId: number, update: Pick<ProjectSubmission, "title" | "description" | "repositoryUrl" | "demoUrl" | "track" | "status">) => Promise<void>;
  onSaveRubric: (rubric: RubricCriterion[]) => void;
  onSaveScore: (submissionId: number, judgeEmail: string, scores: Record<string, number>, comment: string) => void;
  onToggleResults: (eventId: string) => void;
  onTeamChanged: (eventId: string, email: string, teamName: string) => void;
  onNormalizeScores: (eventId: string) => Promise<void>;
  onArchiveEvent: (eventId: string) => Promise<void>;
  onIssueCertificates: (eventId: string) => Promise<void>;
  onVote: (eventId: string, submissionId: number) => Promise<void>;
  onAssignJudge: (eventId: string, email: string) => Promise<void>;
  onSaveAssignedReview: (review: JudgeReview, scores: Record<string, number>, comment: string) => Promise<void>;
};

const roleTitle: Record<AccessRole, string> = {
  participant: "Participant space",
  organizer: "Organizer control room",
  judge: "Judge workspace",
  admin: "Platform overview",
};

export default function RoleWorkspace(props: RoleWorkspaceProps) {
  const selectableEvents = props.role === "organizer" ? props.managedEvents : props.events;
  const [eventId, setEventId] = useState(selectableEvents[0]?.id ?? "");
  const [profileOpen, setProfileOpen] = useState(false);
  const selectedEvent = selectableEvents.find((event) => event.id === eventId) ?? selectableEvents[0];

  useEffect(() => {
    if (!selectableEvents.some((event) => event.id === eventId) && selectableEvents[0]) setEventId(selectableEvents[0].id);
  }, [selectableEvents, eventId]);

  return <div className="role-shell">
    <header className="role-header"><button className="auth-back" type="button" onClick={props.onBack}>← Back to directory</button><a className="public-brand" href="#events" aria-label="Browse hackathons" onClick={(event) => { event.preventDefault(); props.onBack(); }}><span className="brand-symbol" aria-hidden="true"><i /><i /><i /><i /></span><span><strong>sparks</strong><small>HACKATHON PLATFORM</small></span></a><div className="role-identity"><span className={`role-chip role-${props.role}`}>{props.role}</span><span className="role-profile-summary"><strong>{props.profile.name || props.profile.email}</strong><small>{props.role === "organizer" ? props.profile.organization || "Organizer" : props.profile.email}</small></span><button type="button" onClick={() => setProfileOpen(true)}>Profile</button>{props.availableRoles.length > 1 && <button type="button" onClick={props.onChooseWorkspace}>Switch mode</button>}<button type="button" onClick={props.onLogout}>Log out</button></div></header>
    <main className="role-main">
      <div className="role-page-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> YOUR HACKATHON ACCOUNT</span><h1>{roleTitle[props.role]}</h1><p>{props.profile.email}. Your account and workspace are saved securely.</p></div>{props.role === "organizer" && selectableEvents.length > 0 && <label className="role-event-select">EVENT<select value={selectedEvent?.id ?? ""} onChange={(event) => { setEventId(event.target.value); props.onSelectEvent(event.target.value); }}>{selectableEvents.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}</div>
        {!selectedEvent ? props.role === "organizer" ? <EmptyOrganizer onBack={props.onBack} /> : props.role === "admin" ? <AdminWorkspace {...props} events={props.events} /> : props.role === "judge" ? <JudgeWorkspace {...props} email={props.profile.email} events={props.events} /> : <EmptyWorkspace onBack={props.onBack} /> : props.role === "participant" || props.role === "judge" ? <ParticipantWorkspace {...props} email={props.profile.email} events={props.events} /> : props.role === "admin" ? <AdminWorkspace {...props} events={props.events} /> : <OrganizerWorkspace {...props} email={props.profile.email} event={selectedEvent} />}
        {props.judgeReviews.length > 0 && <AssignedJudgeReviews reviews={props.judgeReviews} onSave={props.onSaveAssignedReview} />}
    </main>
      {profileOpen && <RoleProfileDialog profile={props.profile} role={props.role} accessToken={props.accessToken} onClose={() => setProfileOpen(false)} onSave={props.onSaveProfile} />}
  </div>;
}

function RoleProfileDialog({ profile, role, accessToken, onClose, onSave }: { profile: RoleProfile; role: AccessRole; accessToken: string; onClose: () => void; onSave: (profile: RoleProfile) => Promise<void> }) {
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await onSave({ name: String(values.get("name") ?? "").trim(), email: profile.email, organization: String(values.get("organization") ?? "").trim(), website: String(values.get("website") ?? "").trim(), description: String(values.get("description") ?? "").trim() });
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="create-dialog role-access-dialog" onSubmit={save} aria-label="Edit profile"><button className="dialog-close" type="button" aria-label="Close" onClick={onClose}>×</button><span className="eyebrow"><span className="eyebrow-line" /> {role.toUpperCase()} PROFILE</span><h2>Your profile</h2><label>Display name<input name="name" required defaultValue={profile.name} /></label><p className="role-access-note">Signed in as {profile.email}</p>{role === "organizer" && <><label>Organization name<input name="organization" required defaultValue={profile.organization} placeholder="Your organization" /></label><label>Organization website<input name="website" type="url" defaultValue={profile.website} placeholder="https://example.org" /></label><label>About the organization<textarea name="description" rows={3} defaultValue={profile.description} placeholder="What does your organization do?" /></label><OrganizationMembers accessToken={accessToken} /></>}{error && <p className="auth-error" role="alert">{error}</p>}<div className="dialog-actions"><button className="quiet-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? "Saving…" : "Save profile"} <span>→</span></button></div></form></div>;
}

function OrganizationMembers({ accessToken }: { accessToken: string }) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const refresh = () => fetchOrganizationMembers(accessToken).then(setMembers).catch(() => undefined);
  useEffect(() => { void refresh(); }, [accessToken]);
  const invite = async () => {
    setError("");
    try {
      await inviteOrganizationMember(accessToken, email);
      setEmail("");
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not add this organization member.");
    }
  };
  return <section className="organization-members"><h3>Organization members</h3><ul>{members.map((member) => <li key={member.id}><span>{member.full_name}</span><small>{member.email} · {member.role}</small></li>)}</ul><label>Add existing account<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" /></label><button className="role-secondary" type="button" disabled={!email} onClick={() => void invite()}>Add member</button>{error && <p className="auth-error" role="alert">{error}</p>}</section>;
}

function AdminWorkspace({ events, profile }: RoleWorkspaceProps & { events: HackathonRecord[] }) {
  const [search, setSearch] = useState("");
  const visibleEvents = events.filter((event) => `${event.title} ${event.host} ${event.category}`.toLowerCase().includes(search.toLowerCase().trim()));
  return <>
    <div className="role-summary"><div><span>PLATFORM EVENTS</span><strong>{events.length}</strong></div><div><span>ACTIVE REGISTRATIONS</span><strong>{events.reduce((total, event) => total + event.participants, 0)}</strong></div><div><span>MANAGED BY</span><strong>{profile.organization || "Platform admin"}</strong></div></div>
    <section className="role-section"><div className="role-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> GLOBAL EVENT VIEW</span><h2>Platform directory</h2></div></div>
      <label className="event-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events or organizers" aria-label="Search platform events" /></label>
      <div className="participant-event-list">{visibleEvents.length ? visibleEvents.map((event) => <article className="participant-event" key={event.id}><div className="participant-event-heading"><span className={`event-mini-art art-${event.color}`}>{event.symbol}</span><div><strong>{event.title}</strong><span>{event.host} · {event.dates}</span></div><span className="role-status">{event.isArchived ? "ARCHIVED" : "ACTIVE"}</span></div><div className="project-receipt"><div><span>FORMAT</span><strong>{event.format}</strong></div><div><span>TRACKS</span><strong>{event.tracks.length}</strong></div><div><span>PARTICIPANTS</span><strong>{event.participants}</strong></div></div></article>) : <p className="role-empty">No events match that search.</p>}</div>
    </section>
  </>;
}

function JudgeWorkspace({ email, events, registrations, submissions, judgeScores, publishedEventIds, certificates, accessToken, onBack, onSubmitProject, onUpdateProject }: RoleWorkspaceProps & { events: HackathonRecord[]; email: string }) {
  return <ParticipantWorkspace email={email} events={events} registrations={registrations} submissions={submissions} judgeScores={judgeScores} publishedEventIds={publishedEventIds} certificates={certificates} accessToken={accessToken} onTeamChanged={() => undefined} onBack={onBack} onSubmitProject={onSubmitProject} onUpdateProject={onUpdateProject} onLogout={function (): void {}} onChooseWorkspace={function (): void {}} onSaveProfile={async function (): Promise<void> {}} onRefreshWorkspace={async function (): Promise<void> {}} onEditEvent={function (): void {}} onSelectEvent={function (): void {}} onSaveRubric={function (): void {}} onSaveScore={function (): void {}} onToggleResults={function (): void {}} onNormalizeScores={async function (): Promise<void> {}} onArchiveEvent={async function (): Promise<void> {}} onIssueCertificates={async function (): Promise<void> {}} onVote={async function (): Promise<void> {}} onAssignJudge={async function (): Promise<void> {}} onSaveAssignedReview={async function (): Promise<void> {}} role={"judge"} profile={{ name: "", email, organization: "", website: "", description: "" }} availableRoles={[]} judgeReviews={[]} />;
}

function ParticipantWorkspace({ email, events, registrations, submissions, judgeScores, publishedEventIds, certificates, accessToken, onTeamChanged, onBack, onSubmitProject, onUpdateProject }: RoleWorkspaceProps & { events: HackathonRecord[] }) {
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const myRegistrations = registrations.filter((registration) => registration.email.toLowerCase() === email.toLowerCase());
  return <>
    <div className="role-summary"><div><span>YOUR REGISTRATIONS</span><strong>{myRegistrations.length}</strong></div><div><span>PROJECT SUBMISSIONS</span><strong>{submissions.filter((item) => item.submitterEmail.toLowerCase() === email.toLowerCase()).length}</strong></div><div><span>RESULTS AVAILABLE</span><strong>{myRegistrations.filter((item) => publishedEventIds.includes(item.eventId)).length}</strong></div></div>
    {!myRegistrations.length ? <EmptyWorkspace onBack={onBack} /> : <section className="role-section"><div className="role-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> YOUR EVENTS</span><h2>Keep building.</h2></div></div><div className="participant-event-list">{myRegistrations.map((registration) => {
      const event = events.find((item) => item.id === registration.eventId);
      if (!event) return null;
      const submission = submissions.find((item) => item.eventId === event.id && item.submitterEmail.toLowerCase() === email.toLowerCase());
      const submissionClosed = isCutoffPassed(event.submissionDeadline);
      const isPublished = publishedEventIds.includes(event.id);
      const feedback = submission && isPublished ? judgeScores.filter((score) => score.submissionId === submission.id && score.comment.trim()).map((score) => score.comment) : [];
      return <article className="participant-event" key={`${registration.eventId}-${registration.email}`}><div className="participant-event-heading"><span className={`event-mini-art art-${event.color}`}>{event.symbol}</span><div><strong>{event.title}</strong><span>{event.dates} · {registration.track}</span></div><span className={`role-status ${isPublished ? "status-published" : ""}`}>{isPublished ? "RESULTS PUBLISHED" : submission ? "IN JUDGING" : "REGISTERED"}</span></div><TeamFormation event={event} email={email} token={accessToken} registration={registration} onTeamChanged={onTeamChanged} />{submission ? editingSubmissionId === submission.id ? <ProjectSubmissionForm event={event} email={email} registration={registration} submission={submission} onSubmit={onSubmitProject} onUpdate={onUpdateProject} onCancel={() => setEditingSubmissionId(null)} /> : <div className="project-receipt"><div><span>YOUR PROJECT</span><strong>{submission.title}</strong></div><div><span>STATUS</span><strong>{submission.status}</strong></div>{isPublished && <div><span>FINAL SCORE</span><strong>{submission.score} / 100</strong></div>}{!submissionClosed && <button className="role-secondary" type="button" onClick={() => setEditingSubmissionId(submission.id)}>Edit project</button>}</div> : submissionClosed ? <div className="role-deadline-closed"><strong>Submissions are closed</strong><span>Deadline: {formatCutoff(event.submissionDeadline)}</span></div> : <ProjectSubmissionForm event={event} email={email} registration={registration} onSubmit={onSubmitProject} />}{feedback.length > 0 && <div className="released-feedback"><strong>Judge feedback</strong>{feedback.map((comment, index) => <p key={`${index}-${comment}`}>{comment}</p>)}</div>}</article>;
    })}</div></section>}
    {certificates.length > 0 && <CertificateList certificates={certificates} />}
  </>;
}

function TeamFormation({ event, email, token, registration, onTeamChanged }: { event: HackathonRecord; email: string; token: string; registration: Registration; onTeamChanged: RoleWorkspaceProps["onTeamChanged"] }) {
  const [teams, setTeams] = useState<TeamView[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [copiedInvite, setCopiedInvite] = useState(false);
  const refresh = () => listTeams(token, event.id).then(setTeams).catch(() => undefined);
  useEffect(() => { void refresh(); }, [token, event.id]);
  const create = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setError("");
    try {
      const team = await createTeam(token, event.id, name, registration.track);
      setName("");
      onTeamChanged(event.id, email, team.name);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a team.");
    }
  };
  const join = async (team: TeamView) => {
    try {
      const joined = await joinTeam(token, team.id);
      onTeamChanged(event.id, email, joined.name);
      await refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not join this team.");
    }
  };
  const copyInvite = async (team: TeamView) => {
    try {
      const inviteUrl = new URL(window.location.href);
      inviteUrl.search = "";
      inviteUrl.hash = "";
      inviteUrl.searchParams.set("teamInvite", team.inviteCode);
      await navigator.clipboard.writeText(inviteUrl.toString());
      setCopiedInvite(true);
    } catch {
      setError("Could not copy the invite link from this browser.");
    }
  };
  return <section className="team-formation"><h3>Team formation</h3>{registration.teamName && <p>You’re with <strong>{registration.teamName}</strong>.</p>}<div className="team-choices">{teams.map((team) => <article key={team.id}><strong>{team.name}</strong><span>{team.track} · {team.members} member{team.members === 1 ? "" : "s"}</span>{!team.joined && <button className="role-secondary" type="button" onClick={() => void join(team)}>Join team</button>}{team.joined && team.inviteCode && <button className="role-secondary" type="button" onClick={() => void copyInvite(team)}>{copiedInvite ? "Invite link copied" : "Copy invite link"}</button>}</article>)}</div><form onSubmit={create}><label>Create a team<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={120} required placeholder="Give your team a name" /></label><button className="role-secondary" type="submit">Create team</button></form>{error && <p className="auth-error" role="alert">{error}</p>}</section>;
}

function CertificateList({ certificates }: { certificates: Certificate[] }) {
  const print = (certificate: Certificate) => {
    const safe = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
    const windowRef = window.open("", "_blank", "width=900,height=650");
    if (!windowRef) return;
    windowRef.document.write(`<title>${safe(certificate.eventTitle)} certificate</title><main><small>SPARKS HACKATHON PLATFORM</small><h1>Certificate of Participation</h1><p>This recognizes</p><h2>${safe(certificate.recipientName)}</h2><p>for participating in</p><h3>${safe(certificate.eventTitle)}</h3><p>Verification code: ${safe(certificate.verificationCode)}</p><button onclick="window.print()">Print certificate</button></main><style>body{font-family:Georgia,serif;color:#263c34;text-align:center;padding:10vh 8vw}main{border:8px double #80ab99;padding:60px 24px}h1{font-size:38px}h2{font-size:32px;color:#227867}h3{font-size:24px}button{margin-top:32px;padding:10px 18px}@media print{button{display:none}}</style>`);
    windowRef.document.close();
  };
  return <section className="role-section"><div className="role-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> YOUR AWARDS</span><h2>Certificates</h2></div></div><div className="certificate-list">{certificates.map((certificate) => <article key={certificate.verificationCode}><div><strong>{certificate.eventTitle}</strong><span>{certificate.verificationCode}</span></div><button className="role-secondary" type="button" onClick={() => print(certificate)}>Print certificate</button></article>)}</div></section>;
}

function ProjectSubmissionForm({ event, email, registration, submission, onSubmit, onUpdate, onCancel }: { event: HackathonRecord; email: string; registration: Registration; submission?: ProjectSubmission; onSubmit: RoleWorkspaceProps["onSubmitProject"]; onUpdate?: RoleWorkspaceProps["onUpdateProject"]; onCancel?: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submitProject = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (isCutoffPassed(event.submissionDeadline)) return;
    const submitter = (formEvent.nativeEvent as SubmitEvent).submitter;
    const values = submitter
      ? new FormData(formEvent.currentTarget, submitter)
      : new FormData(formEvent.currentTarget);
    const project = {
      title: String(values.get("title") ?? "").trim(),
      team: registration.teamName || registration.teamPreference,
      track: String(values.get("track") ?? registration.track),
      submitterEmail: email,
      description: String(values.get("description") ?? "").trim(),
      repositoryUrl: String(values.get("repositoryUrl") ?? "").trim(),
      demoUrl: String(values.get("demoUrl") ?? "").trim(),
      status: values.get("submissionStatus") === "Draft" ? "Draft" as const : "Submitted" as const,
    };
    setSaving(true);
    setError("");
    try {
      if (submission && onUpdate) {
        await onUpdate(event.id, submission.id, project);
        onCancel?.();
      } else {
        onSubmit(event, project);
        formEvent.currentTarget.reset();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Project could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  return <details className="project-submit" open={Boolean(submission)}><summary>{submission ? "Edit your project" : "Submit your project"}</summary><form onSubmit={(formEvent) => void submitProject(formEvent)}><label>Project name<input name="title" required defaultValue={submission?.title} placeholder="What did you build?" /></label><label>Challenge track<select name="track" defaultValue={submission?.track ?? registration.track}>{event.tracks.map((track) => <option key={track}>{track}</option>)}</select></label><label className="role-form-wide">Project description<textarea name="description" required rows={3} defaultValue={submission?.description} placeholder="What does it do and who does it help?" /></label><label>Repository URL<input name="repositoryUrl" type="url" defaultValue={submission?.repositoryUrl} placeholder="https://github.com/..." /></label><label>Demo URL<input name="demoUrl" type="url" defaultValue={submission?.demoUrl} placeholder="https://..." /></label>{error && <p className="auth-error" role="alert">{error}</p>}<button className="role-secondary" name="submissionStatus" value="Draft" type="submit" disabled={saving}>{saving ? "Saving…" : "Save draft"}</button><button className="role-primary" name="submissionStatus" value="Submitted" type="submit" disabled={saving}>{saving ? "Saving…" : submission ? "Submit changes" : "Submit project"}<span>→</span></button>{submission && onCancel && <button className="role-secondary role-form-wide" type="button" onClick={onCancel}>Cancel edit</button>}</form></details>;
}

function OrganizerWorkspace({ email, event, accessToken, registrations, submissions, rubric, judgeScores, publishedEventIds, onEditEvent, onSaveRubric, onSaveScore, onToggleResults, onNormalizeScores, onArchiveEvent, onIssueCertificates, onAssignJudge, onRefreshWorkspace }: RoleWorkspaceProps & { event: HackathonRecord }) {
  const [judges, setJudges] = useState<EventJudge[]>([]);
  const [judgeEmail, setJudgeEmail] = useState("");
  const [lifecycleMessage, setLifecycleMessage] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const eventRegistrations = registrations.filter((item) => item.eventId === event.id);
  const eventSubmissions = submissions.filter((item) => item.eventId === event.id);
  const submittedProjects = eventSubmissions.filter((item) => item.status !== "Draft");
  const draftCount = eventSubmissions.length - submittedProjects.length;
  const published = publishedEventIds.includes(event.id);
  useEffect(() => {
    void listEventJudges(accessToken, event.id).then(setJudges).catch(() => setJudges([]));
  }, [accessToken, event.id]);
  const assign = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    setLifecycleMessage("");
    setLifecycleError("");
    try {
      await onAssignJudge(event.id, judgeEmail);
      setJudgeEmail("");
      setJudges(await listEventJudges(accessToken, event.id));
      setLifecycleMessage("Judge assigned.");
    } catch (reason) {
      setLifecycleError(reason instanceof Error ? reason.message : "Could not assign this judge.");
    }
  };
  const runEventAction = async (action: () => Promise<void>, message: string) => {
    setLifecycleMessage("");
    setLifecycleError("");
    try {
      await action();
      await onRefreshWorkspace();
      setLifecycleMessage(message);
    } catch (reason) {
      setLifecycleError(reason instanceof Error ? reason.message : "This event action failed.");
    }
  };
  return <>
    <div className="role-summary"><div><span>SPOTS LEFT</span><strong>{Math.max(event.spots - event.participants - eventRegistrations.length, 0)}</strong></div><div><span>PROJECTS SUBMITTED</span><strong>{submittedProjects.length}{draftCount ? ` · ${draftCount} draft${draftCount === 1 ? "" : "s"}` : ""}</strong></div><div><span>PROJECTS SCORED</span><strong>{submittedProjects.filter((item) => item.status === "Scored").length}/{submittedProjects.length}</strong></div></div>
    <section className="role-section"><div className="role-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> EVENT LIFECYCLE</span><h2>Results and event status</h2></div><button className="role-secondary" type="button" disabled={event.isArchived} onClick={() => onEditEvent(event.id)}>Edit event</button></div><p className="role-helper">{published ? "Participants can see final scores and published feedback." : !isCutoffPassed(event.votingDeadline || event.submissionDeadline) ? `Voting closes ${formatCutoff(event.votingDeadline || event.submissionDeadline)}; results stay hidden until then.` : "Scores and judge comments remain private until results are published."}</p><div className="event-lifecycle-actions"><button className="role-primary" type="button" disabled={!submittedProjects.length || judgeScores.filter((score) => score.eventId === event.id).length === 0} onClick={() => void runEventAction(() => onNormalizeScores(event.id), "Scores normalized across judges.")}>Normalize scores</button><button className={published ? "role-secondary" : "role-primary"} type="button" disabled={!published && !isCutoffPassed(event.votingDeadline || event.submissionDeadline)} onClick={() => onToggleResults(event.id)}>{published ? "Unpublish results" : "Publish results"}</button><button className="role-secondary" type="button" disabled={!published || !eventRegistrations.length} onClick={() => void runEventAction(() => onIssueCertificates(event.id), "Participation certificates issued.")}>Issue certificates</button><button className="role-secondary" type="button" onClick={() => void runEventAction(() => onArchiveEvent(event.id), "Event archived.")}>Archive event</button></div>{lifecycleMessage && <p className="auth-security-note" role="status">{lifecycleMessage}</p>}{lifecycleError && <p className="auth-error" role="alert">{lifecycleError}</p>}</section>
    <section className="role-section"><div className="role-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> REGISTRATION</span><h2>Participants</h2></div><span className="role-count">{eventRegistrations.length} REGISTERED</span></div>{eventRegistrations.length ? <div className="role-table-wrap"><table className="role-table"><thead><tr><th>PARTICIPANT</th><th>EMAIL</th><th>TRACK</th><th>TEAM</th></tr></thead><tbody>{eventRegistrations.map((item) => <tr key={`${item.eventId}-${item.email}`}><td>{item.name}</td><td>{item.email}</td><td>{item.track}</td><td>{item.teamName || item.teamPreference}</td></tr>)}</tbody></table></div> : <p className="role-empty">No registrations yet.</p>}</section>
    <section className="role-section"><div className="role-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> ORGANIZER JUDGING</span><h2>Review and score projects</h2></div></div><p className="role-helper">Scoring stays private to your organization until you publish results.</p>{submittedProjects.length ? <div className="judge-project-list">{submittedProjects.map((submission) => <JudgeProject key={submission.id} email={email} submission={submission} rubric={rubric} judgeScores={judgeScores} onSave={onSaveScore} />)}</div> : <p className="role-empty">No submitted projects yet.</p>}</section>
    <section className="role-section"><div className="role-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> JUDGING SETUP</span><h2>Scoring rubric</h2></div></div><RubricEditor rubric={rubric} onSave={onSaveRubric} /><div className="judge-assignment"><h3>Assigned judges</h3>{judges.length ? <ul>{judges.map((judge) => <li key={judge.accountId}>{judge.fullName} <span>{judge.email}</span></li>)}</ul> : <p className="role-empty">No judges assigned.</p>}<form onSubmit={assign}><label>Assign an existing account<input type="email" required value={judgeEmail} onChange={(event) => setJudgeEmail(event.target.value)} placeholder="judge@example.com" /></label><button className="role-secondary" type="submit">Assign judge</button></form></div></section>
  </>;
}

function RubricEditor({ rubric, onSave }: { rubric: RubricCriterion[]; onSave: RoleWorkspaceProps["onSaveRubric"] }) {
  const [draft, setDraft] = useState(rubric);
  const totalWeight = draft.reduce((total, criterion) => total + criterion.weight, 0);
  useEffect(() => setDraft(rubric), [rubric]);
  const update = (id: string, change: Partial<RubricCriterion>) => setDraft((current) => current.map((criterion) => criterion.id === id ? { ...criterion, ...change } : criterion));
  const addCriterion = () => setDraft((current) => [...current, { id: `criterion-${Date.now()}`, label: "New criterion", weight: 0 }]);
  return <div className="rubric-editor"><p className="role-helper">Set criterion weights to total 100%. Judges score each criterion from 1 to 5.</p><div className="rubric-list">{draft.map((criterion) => <div className="rubric-row" key={criterion.id}><input aria-label="Criterion name" value={criterion.label} onChange={(event) => update(criterion.id, { label: event.target.value })} /><label>WEIGHT %<input aria-label={`${criterion.label} weight`} type="number" min="0" max="100" value={criterion.weight} onChange={(event) => update(criterion.id, { weight: Number(event.target.value) })} /></label></div>)}</div><div className="rubric-footer"><button type="button" className="role-secondary" onClick={addCriterion}>Add criterion</button><span className={totalWeight === 100 ? "rubric-total valid" : "rubric-total"}>TOTAL {totalWeight}%</span><button type="button" className="role-primary" disabled={totalWeight !== 100} onClick={() => onSave(draft)}>Save rubric</button></div></div>;
}

function JudgeProject({ email, submission, rubric, judgeScores, onSave }: { email: string; submission: ProjectSubmission; rubric: RubricCriterion[]; judgeScores: JudgeScore[]; onSave: RoleWorkspaceProps["onSaveScore"] }) {
  const existing = judgeScores.find((score) => score.submissionId === submission.id && score.judgeEmail.toLowerCase() === email.toLowerCase());
  const [scores, setScores] = useState<Record<string, number>>(existing?.criterionScores ?? {});
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setScores(existing?.criterionScores ?? {});
    setComment(existing?.comment ?? "");
  }, [existing]);
  const complete = rubric.length > 0 && rubric.every((criterion) => (scores[criterion.id] ?? 0) > 0);
  return <article className="judge-project"><div className="judge-project-heading"><div><span>{submission.track} · {submission.team}</span><h3>{submission.title}</h3><p>{submission.description}</p></div><span className="role-status">{existing ? "REVIEW SAVED" : "NEEDS REVIEW"}</span></div><div className="judge-score-grid">{rubric.map((criterion) => <label key={criterion.id}>{criterion.label}<span>{criterion.weight}%</span><select aria-label={`Score ${criterion.label}`} value={scores[criterion.id] ?? ""} onChange={(event) => setScores((current) => ({ ...current, [criterion.id]: Number(event.target.value) }))}><option value="">Choose score</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>)}</div><label className="judge-comment">Private feedback<textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Notes for organizers and participant feedback after publishing" /></label><div className="judge-project-footer">{saved && <span role="status">Score saved</span>}<button className="role-primary" type="button" disabled={!complete} onClick={() => { onSave(submission.id, email, scores, comment); setSaved(true); }}>Save score</button></div></article>;
}

function EmptyWorkspace({ onBack }: { onBack: () => void }) {
  return <div className="role-empty-state"><span>◌</span><h2>Nothing here yet</h2><p>Register for an event first, then return here to follow your projects.</p><button className="role-primary" type="button" onClick={onBack}>Browse hackathons</button></div>;
}

function EmptyOrganizer({ onBack }: { onBack: () => void }) {
  return <div className="role-empty-state"><span>✳</span><h2>Create your first event</h2><p>Your organization profile is ready. Start a hackathon from the event directory to manage it here.</p><button className="role-primary" type="button" onClick={onBack}>Go to event directory</button></div>;
}

function AssignedJudgeReviews({ reviews, onSave }: { reviews: JudgeReview[]; onSave: RoleWorkspaceProps["onSaveAssignedReview"] }) {
  return <section className="role-section"><div className="role-section-heading"><div><span className="eyebrow"><span className="eyebrow-line" /> JUDGE ASSIGNMENTS</span><h2>Assigned project reviews</h2></div><span className="role-count">{reviews.length} TO REVIEW</span></div><div className="judge-project-list">{reviews.map((review) => <AssignedReview key={`${review.eventId}-${review.submissionId}`} review={review} onSave={onSave} />)}</div></section>;
}

function AssignedReview({ review, onSave }: { review: JudgeReview; onSave: RoleWorkspaceProps["onSaveAssignedReview"] }) {
  const [scores, setScores] = useState(review.score);
  const [comment, setComment] = useState(review.comment);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setScores(review.score); setComment(review.comment); }, [review]);
  const complete = review.rubric.length > 0 && review.rubric.every((criterion) => (scores[criterion.id] ?? 0) > 0);
  const save = async () => {
    setError("");
    try {
      await onSave(review, scores, comment);
      setSaved(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Review could not be saved.");
    }
  };
  return <article className="judge-project"><div className="judge-project-heading"><div><span>{review.eventTitle} · {review.track} · {review.submissionTeam}</span><h3>{review.submissionTitle}</h3><p>{review.description}</p></div><span className="role-status">{complete ? "REVIEW READY" : "NEEDS REVIEW"}</span></div><div className="judge-score-grid">{review.rubric.map((criterion) => <label key={criterion.id}>{criterion.label}<span>{criterion.weight}%</span><select aria-label={`Assigned score ${criterion.label}`} value={scores[criterion.id] ?? ""} onChange={(event) => setScores((current) => ({ ...current, [criterion.id]: Number(event.target.value) }))}><option value="">Choose score</option>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>)}</div><label className="judge-comment">Feedback<textarea rows={2} value={comment} onChange={(event) => setComment(event.target.value)} /></label>{error && <p className="auth-error" role="alert">{error}</p>}<div className="judge-project-footer">{saved && <span role="status">Review saved</span>}<button className="role-primary" type="button" disabled={!complete} onClick={() => void save()}>Save review</button></div></article>;
}