import { useState, type FormEvent } from "react";
import { loginAccount, registerAccount, type AppRole, type AuthSession } from "./api/auth";

type RoleEntryProps = { onAuthenticated: (session: AuthSession) => void; onBack?: () => void };

export default function RoleEntry({ onAuthenticated, onBack }: RoleEntryProps) {
  const [role, setRole] = useState<AppRole>("participant");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const session = mode === "register"
        ? await registerAccount({ full_name: fullName, email, password, role, organization_name: organizationName })
        : await loginAccount({ email, password, role, organization_name: organizationName });
      onAuthenticated(session);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="role-welcome auth-welcome">
    <header className="role-welcome-header"><button className="auth-back" type="button" onClick={onBack ?? (() => undefined)}>← Back to directory</button><a className="public-brand" href="#welcome" aria-label="Sparks home"><span className="brand-symbol" aria-hidden="true"><i /><i /><i /><i /></span><span><strong>sparks</strong><small>HACKATHON PLATFORM</small></span></a><span>ACCOUNT ACCESS</span></header>
    <main className="auth-layout"><section className="auth-panel compact-auth-panel"><div className="auth-tabs" role="tablist" aria-label="Account access"><button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); }}>Sign in</button><button type="button" role="tab" aria-selected={mode === "register"} className={mode === "register" ? "selected" : ""} onClick={() => { setMode("register"); setError(""); }}>Create account</button></div>
        <label className="auth-role-picker">Role<select value={role} onChange={(event) => setRole(event.target.value as AppRole)}><option value="participant">Participant</option><option value="organizer">Organizer</option><option value="judge">Judge</option><option value="admin">Admin</option></select></label>
        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && <label>Your name<input autoComplete="name" required value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Alex Morgan" /></label>}
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
          <label>Password<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 10 : 1} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "register" ? "At least 10 characters" : "Your password"} /></label>
          {role === "organizer" && <label>Organization name{mode === "login" && <small>Only needed the first time you add organizer access.</small>}<input autoComplete="organization" required={mode === "register"} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Your organization" /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}<span>→</span></button>
        </form>
      </section>
    </main>
  </div>;
}
