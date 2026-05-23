// src/App.js
import { useState, useRef, useEffect } from "react";
import { AuthProvider, useAuth } from "./AuthContext";
import { fetchResumes, fetchResume, createResume, saveResume, renameResume, deleteResume } from "./api";
import LandingPage from "./LandingPage";
import "./App.css";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id: "modern",       label: "Modern",       accent: "#c8622a", bg: "#1a1a1a" },
  { id: "professional", label: "Professional", accent: "#2a6bc8", bg: "#1a1a2e" },
  { id: "minimal",      label: "Minimal",      accent: "#222",    bg: "#f5f5f5" },
  { id: "creative",     label: "Creative",     accent: "#2d1b69", bg: "#2d1b69" },
];

const DEFAULT_RESUME = {
  personal: { name: "", title: "", email: "", phone: "", address: "", linkedin: "", github: "" },
  summary: "",
  skills: [],
  education: [],
  experience: [],
  projects: [],
  certifications: [],
  achievements: [],
  languages: [],
  photo: null,
};

const SECTION_ORDER_DEFAULT = ["summary","experience","education","projects","certifications","achievements","languages"];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function uid() { return Math.random().toString(36).slice(2, 9); }

function parseDesc(desc) {
  if (!desc) return null;
  const lines = desc.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length <= 1) return <p style={{ fontSize: "inherit", lineHeight: "inherit" }}>{desc}</p>;
  return <ul>{lines.map((l, i) => <li key={i}>{l.replace(/^[-•*]\s*/, "")}</li>)}</ul>;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ─── AUTH SCREEN ──────────────────────────────────────────────────────────────
function AuthScreen() {
  const { login, register } = useAuth();
  const [mode, setMode]     = useState("login");
  const [name, setName]     = useState("");
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [error, setError]   = useState("");
  const [busy, setBusy]     = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      if (mode === "register") await register(name, email, pass);
      else                     await login(email, pass);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-overlay">
      <div className="auth-card">
        <div className="auth-logo">Resume<span>·</span>Craft</div>
        <p className="auth-tagline">Build Professional resumes.</p>

        <div className="auth-tabs">
          <button className={mode === "login"    ? "active" : ""} onClick={() => { setMode("login");    setError(""); }}>Sign In</button>
          <button className={mode === "register" ? "active" : ""} onClick={() => { setMode("register"); setError(""); }}>Create Account</button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <div className="auth-field">
              <label>Full Name</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Jordan Rivera" required autoFocus />
            </div>
          )}
          <div className="auth-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@email.com" required autoFocus={mode === "login"} />
          </div>
          <div className="auth-field">
            <label>Password</label>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder={mode === "register" ? "Min. 6 characters" : "Your password"} required />
          </div>

          {error && <div className="auth-error">⚠ {error}</div>}

          <button className="btn-auth-submit" type="submit" disabled={busy}>
            {busy ? "Please wait…" : mode === "login" ? "Sign In" : "Create Account"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── RESUME DASHBOARD ─────────────────────────────────────────────────────────
function Dashboard({ onNew, onOpen }) {
  const { user, logout }          = useAuth();
  const [resumes, setResumes]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [renamingId, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");
  const [error, setError]         = useState("");

  useEffect(() => {
    fetchResumes()
      .then(setResumes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleRename = async (id) => {
    if (!renameVal.trim()) return;
    try {
      await renameResume(id, renameVal);
      setResumes(r => r.map(x => x._id === id ? { ...x, label: renameVal.trim() } : x));
    } catch (e) { setError(e.message); }
    setRenaming(null); setRenameVal("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this resume? This cannot be undone.")) return;
    try {
      await deleteResume(id);
      setResumes(r => r.filter(x => x._id !== id));
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="auth-logo" style={{ fontSize: 22 }}>Resume<span>·</span>Craft</div>
        <div className="dash-user">
          <span>👤 {user.name}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign Out</button>
        </div>
      </header>

      <div className="dash-body">
        <div className="dash-title-row">
          <h2 className="dash-title">My Resumes</h2>
          <button className="btn btn-primary" onClick={onNew}>+ New Resume</button>
        </div>

        {error && <div className="auth-error" style={{ marginBottom: 16 }}>⚠ {error}</div>}

        {loading && <div className="dash-empty">Loading your resumes…</div>}

        {!loading && resumes.length === 0 && (
          <div className="dash-empty">
            <div style={{ fontSize: 48, marginBottom: 12 }}>📄</div>
            <p>No resumes yet. Create your first one!</p>
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={onNew}>+ New Resume</button>
          </div>
        )}

        <div className="dash-grid">
          {resumes.map(r => (
            <div key={r._id} className="dash-card">
              <div className="dash-card-icon">📄</div>
              <div className="dash-card-body">
                {renamingId === r._id ? (
                  <div className="rename-row">
                    <input
                      className="rename-input"
                      value={renameVal}
                      onChange={e => setRenameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") handleRename(r._id); if (e.key === "Escape") setRenaming(null); }}
                      autoFocus
                    />
                    <button className="btn btn-primary btn-sm" onClick={() => handleRename(r._id)}>Save</button>
                    <button className="btn btn-ghost btn-sm"   onClick={() => setRenaming(null)}>✕</button>
                  </div>
                ) : (
                  <div className="dash-card-label">{r.label}</div>
                )}
                <div className="dash-card-meta">
                  <span className="dash-chip">{r.template || "modern"}</span>
                  <span className="dash-card-time">saved {timeAgo(r.updatedAt)}</span>
                </div>
              </div>
              <div className="dash-card-actions">
                <button className="btn btn-primary btn-sm"  onClick={() => onOpen(r._id)}>Open</button>
                <button className="btn btn-ghost btn-sm"    onClick={() => { setRenaming(r._id); setRenameVal(r.label); }}>Rename</button>
                <button className="btn btn-ghost btn-sm"    style={{ color: "#c0392b" }} onClick={() => handleDelete(r._id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TEMPLATE THUMBNAILS ──────────────────────────────────────────────────────
function TemplateThumbnail({ template }) {
  const { accent, bg } = template;
  const styles = {
    modern: (
      <div className="template-thumb" style={{ background: "#fff", padding: 0 }}>
        <div style={{ background: bg, height: 28, padding: "6px 8px" }}>
          <div className="thumb-line" style={{ width: "60%", height: 6, background: "#fff", opacity: .9 }} />
          <div className="thumb-line" style={{ width: "35%", height: 3, background: accent, marginTop: 3 }} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "35% 1fr", flex: 1 }}>
          <div style={{ background: "#f5f3ef", padding: "4px 5px" }}>
            {[70,55,80,45].map((w,i) => <div key={i} className="thumb-line" style={{ width:`${w}%`,height:3,background:"#ccc",marginBottom:4 }} />)}
          </div>
          <div style={{ padding: "4px 5px" }}>
            <div className="thumb-line" style={{ width:"40%",height:2,background:accent,marginBottom:4 }} />
            {[90,70,85].map((w,i) => <div key={i} className="thumb-line" style={{ width:`${w}%`,height:3,background:"#ddd",marginBottom:3 }} />)}
          </div>
        </div>
      </div>
    ),
    professional: (
      <div className="template-thumb" style={{ background: "#fff", padding: "8px" }}>
        <div className="thumb-line" style={{ width:"55%",height:7,background:"#1a1a2e",borderRadius:2,marginBottom:3 }} />
        <div className="thumb-line" style={{ width:"35%",height:3,background:accent,marginBottom:6 }} />
        <div style={{ height:2,background:accent,marginBottom:6 }} />
        {[["30%",accent],["80%","#ddd"],["65%","#ddd"],["70%","#ddd"]].map(([w,c],i) => (
          <div key={i} className="thumb-line" style={{ width:w,height:i===0?3:2.5,background:c,marginBottom:3 }} />
        ))}
      </div>
    ),
    minimal: (
      <div className="template-thumb" style={{ background:"#fff",padding:"8px 10px" }}>
        <div className="thumb-line" style={{ width:"70%",height:9,background:"#222",marginBottom:3 }} />
        <div className="thumb-line" style={{ width:"40%",height:2,background:"#bbb",marginBottom:8 }} />
        <div style={{ height:1,background:"#222",marginBottom:6 }} />
        <div className="thumb-line" style={{ width:"25%",height:2,background:"#888",marginBottom:5 }} />
        {[75,85,60].map((w,i) => <div key={i} className="thumb-line" style={{ width:`${w}%`,height:2,background:"#ddd",marginBottom:3 }} />)}
      </div>
    ),
    creative: (
      <div className="template-thumb" style={{ background:"#fff",padding:0 }}>
        <div style={{ background:`linear-gradient(135deg,${bg},#1b4d8e)`,height:30,padding:"6px 8px" }}>
          <div className="thumb-line" style={{ width:"55%",height:7,background:"#fff",opacity:.9 }} />
          <div className="thumb-line" style={{ width:"35%",height:2.5,background:"rgba(255,255,255,.6)",marginTop:3 }} />
        </div>
        <div style={{ display:"grid",gridTemplateColumns:"1fr 32%",flex:1 }}>
          <div style={{ padding:"5px" }}>
            {[80,65,75,55].map((w,i) => <div key={i} className="thumb-line" style={{ width:`${w}%`,height:2.5,background:"#ddd",marginBottom:3.5 }} />)}
          </div>
          <div style={{ background:"#f8f7ff",padding:"5px 4px",borderLeft:"1px solid #e8e5f0" }}>
            {[70,50,80].map((w,i) => <div key={i} className="thumb-line" style={{ width:`${w}%`,height:2.5,background:"#e0ddf5",marginBottom:4 }} />)}
          </div>
        </div>
      </div>
    ),
  };
  return styles[template.id] || null;
}

// ─── SECTION RENDERERS (shared across templates) ──────────────────────────────
function renderSummarySection(data, label = "About") {
  if (!data.summary) return null;
  return <div key="summary"><div className="r-section-title">{label}</div><div className="r-summary">{data.summary}</div></div>;
}
function renderExperienceSection(data) {
  if (!data.experience.length) return null;
  return (
    <div key="experience">
      <div className="r-section-title">Experience</div>
      {data.experience.map(e => (
        <div key={e.id} className="r-entry">
          <div className="r-entry-title">{e.role}</div>
          <div className="r-entry-sub">{e.company}</div>
          <div className="r-entry-date">{e.from}{e.to?` – ${e.to}`:""}</div>
          <div className="r-entry-desc">{parseDesc(e.desc)}</div>
        </div>
      ))}
    </div>
  );
}
function renderExperienceSectionPro(data) {
  if (!data.experience.length) return null;
  return (
    <div key="experience">
      <div className="r-section-title">Experience</div>
      {data.experience.map(e => (
        <div key={e.id} className="r-entry">
          <div className="r-entry-header">
            <div><div className="r-entry-title">{e.role}</div><div className="r-entry-sub">{e.company}</div></div>
            <div className="r-entry-date">{e.from}{e.to?` – ${e.to}`:""}</div>
          </div>
          <div className="r-entry-desc">{parseDesc(e.desc)}</div>
        </div>
      ))}
    </div>
  );
}
function renderEducationSection(data) {
  if (!data.education.length) return null;
  return (
    <div key="education">
      <div className="r-section-title">Education</div>
      {data.education.map(e => (
        <div key={e.id} className="r-entry">
          <div className="r-entry-title" style={{ fontSize:13 }}>{e.school}</div>
          <div className="r-entry-sub">{e.degree}</div>
          <div className="r-entry-date">{e.year}{e.gpa?` · GPA ${e.gpa}`:""}</div>
        </div>
      ))}
    </div>
  );
}
function renderEducationSectionPro(data) {
  if (!data.education.length) return null;
  return (
    <div key="education">
      <div className="r-section-title">Education</div>
      {data.education.map(e => (
        <div key={e.id} className="r-entry">
          <div className="r-entry-header">
            <div><div className="r-entry-title">{e.degree}</div><div className="r-entry-sub">{e.school}</div></div>
            <div className="r-entry-date">{e.year}{e.gpa?` · GPA ${e.gpa}`:""}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
function renderEducationSectionMinimal(data) {
  if (!data.education.length) return null;
  return (
    <div key="education">
      <div className="r-section-title">Education</div>
      {data.education.map(e => (
        <div key={e.id} className="r-entry">
          <div className="r-entry-meta">{e.year}</div>
          <div><div className="r-entry-title">{e.degree}</div><div className="r-entry-sub">{e.school}</div></div>
        </div>
      ))}
    </div>
  );
}
function renderProjectsSection(data) {
  if (!data.projects.length) return null;
  return (
    <div key="projects">
      <div className="r-section-title">Projects</div>
      {data.projects.map(p => (
        <div key={p.id} className="r-entry">
          <div className="r-entry-title">{p.name}</div>
          {p.tech && <div className="r-entry-sub">{p.tech}</div>}
          <div className="r-entry-desc">{p.desc}</div>
          {p.link && <div className="r-chip" style={{ marginTop:4,fontSize:10 }}>{p.link}</div>}
        </div>
      ))}
    </div>
  );
}
function renderProjectsSectionPro(data) {
  if (!data.projects.length) return null;
  return (
    <div key="projects">
      <div className="r-section-title">Projects</div>
      {data.projects.map(p => (
        <div key={p.id} className="r-entry">
          <div className="r-entry-header">
            <div className="r-entry-title">{p.name}</div>
            {p.tech && <div style={{ fontSize:12,color:"#888" }}>{p.tech}</div>}
          </div>
          <div className="r-entry-desc">{p.desc}</div>
        </div>
      ))}
    </div>
  );
}
function renderProjectsSectionMinimal(data) {
  if (!data.projects.length) return null;
  return (
    <div key="projects">
      <div className="r-section-title">Projects</div>
      {data.projects.map(p => (
        <div key={p.id} className="r-entry">
          <div className="r-entry-meta" style={{ fontSize:10 }}>{p.tech||""}</div>
          <div><div className="r-entry-title">{p.name}</div><div className="r-entry-desc">{p.desc}</div></div>
        </div>
      ))}
    </div>
  );
}
function renderCertificationsSection(data) {
  if (!data.certifications.length) return null;
  return (
    <div key="certifications">
      <div className="r-section-title">Certifications</div>
      {data.certifications.map(c => (
        <div key={c.id} className="r-entry">
          <div className="r-entry-title" style={{ fontSize:12 }}>{c.name}</div>
          <div className="r-entry-sub">{c.issuer} · {c.year}</div>
        </div>
      ))}
    </div>
  );
}
function renderCertificationsSectionPro(data) {
  if (!data.certifications.length) return null;
  return (
    <div key="certifications">
      <div className="r-section-title">Certifications</div>
      {data.certifications.map(c => (
        <div key={c.id} className="r-entry">
          <div className="r-entry-header">
            <div className="r-entry-title">{c.name}</div>
            <div className="r-entry-date">{c.year}</div>
          </div>
          <div style={{ fontSize:12,color:"#888" }}>{c.issuer}</div>
        </div>
      ))}
    </div>
  );
}
function renderAchievementsSection(data) {
  if (!data.achievements.length) return null;
  return (
    <div key="achievements">
      <div className="r-section-title">Achievements</div>
      {data.achievements.map((a,i) => <div key={i} className="r-entry-sub" style={{ marginBottom:4,fontSize:12 }}>✓ {a}</div>)}
    </div>
  );
}
function renderLanguagesSection(data) {
  if (!data.languages.length) return null;
  return (
    <div key="languages">
      <div className="r-section-title">Languages</div>
      {data.languages.map((l,i) => <div key={i} className="r-entry-sub" style={{ marginBottom:4,fontSize:12 }}>{l}</div>)}
    </div>
  );
}

// ─── RESUME TEMPLATES ─────────────────────────────────────────────────────────
const MODERN_LEFT  = ["skills","education","certifications","languages","achievements"];
const MODERN_RIGHT = ["summary","experience","projects"];

function ResumeModern({ data, sectionOrder }) {
  const { personal, skills, photo } = data;
  const renderLeft = (key) => {
    if (key === "skills" && skills.length > 0) return (
      <div key="skills">
        <div className="r-section-title">Skills</div>
        {skills.map((s,i) => (
          <div key={i} className="r-skill-bar">
            <div className="r-skill-name">{s}</div>
            <div className="r-skill-track"><div className="r-skill-fill" style={{ width:`${65+(i*7)%35}%` }} /></div>
          </div>
        ))}
      </div>
    );
    if (key === "education")      return renderEducationSection(data);
    if (key === "certifications") return renderCertificationsSection(data);
    if (key === "languages")      return renderLanguagesSection(data);
    if (key === "achievements")   return renderAchievementsSection(data);
    return null;
  };
  const renderRight = (key) => {
    if (key === "summary")    return renderSummarySection(data, "About");
    if (key === "experience") return renderExperienceSection(data);
    if (key === "projects")   return renderProjectsSection(data);
    return null;
  };
  return (
    <div className="resume modern">
      <div className="r-header">
        <div>
          <div className="r-name">{personal.name||"Your Name"}</div>
          {personal.title && <div className="r-title">{personal.title}</div>}
          <div className="r-contact">
            {personal.email    && <span>✉ {personal.email}</span>}
            {personal.phone    && <span>✆ {personal.phone}</span>}
            {personal.address  && <span>⊙ {personal.address}</span>}
            {personal.linkedin && <span>in {personal.linkedin}</span>}
            {personal.github   && <span>⌥ {personal.github}</span>}
          </div>
        </div>
      </div>
      <div className="r-body">
        <div className="r-left">
          {photo && <img src={photo} alt="" className="r-photo" />}
          {sectionOrder.filter(s => MODERN_LEFT.includes(s)).map(s => renderLeft(s))}
        </div>
        <div className="r-right">
          {sectionOrder.filter(s => MODERN_RIGHT.includes(s)).map(s => renderRight(s))}
        </div>
      </div>
    </div>
  );
}

function ResumeProfessional({ data, sectionOrder }) {
  const { personal, skills, photo } = data;
  const renderSection = (key) => {
    if (key === "summary")        return renderSummarySection(data, "Professional Summary");
    if (key === "experience")     return renderExperienceSectionPro(data);
    if (key === "education")      return renderEducationSectionPro(data);
    if (key === "projects")       return renderProjectsSectionPro(data);
    if (key === "certifications") return renderCertificationsSectionPro(data);
    if (key === "achievements")   return data.achievements.length > 0 ? (
      <div key="achievements">
        <div className="r-section-title">Achievements</div>
        {data.achievements.map((a,i) => <div key={i} style={{ fontSize:12.5,color:"#555",marginBottom:4 }}>• {a}</div>)}
      </div>
    ) : null;
    if (key === "languages") return data.languages.length > 0 ? (
      <div key="languages">
        <div className="r-section-title">Languages</div>
        {data.languages.map((l,i) => <div key={i} style={{ fontSize:12.5,color:"#555",marginBottom:4 }}>• {l}</div>)}
      </div>
    ) : null;
    return null;
  };
  return (
    <div className="resume professional">
      <div className="r-header">
        <div style={{ display:"flex",gap:20,alignItems:"flex-start" }}>
          {photo && <img src={photo} alt="" className="r-photo" />}
          <div>
            <div className="r-name">{personal.name||"Your Name"}</div>
            {personal.title && <div className="r-title">{personal.title}</div>}
          </div>
        </div>
        <div className="r-contact">
          {personal.email    && <div>{personal.email}</div>}
          {personal.phone    && <div>{personal.phone}</div>}
          {personal.address  && <div>{personal.address}</div>}
          {personal.linkedin && <div>in {personal.linkedin}</div>}
          {personal.github   && <div>⌥ {personal.github}</div>}
        </div>
      </div>
      <div className="r-body">
        {sectionOrder.map(s => renderSection(s))}
        {skills.length > 0 && (
          <div key="skills">
            <div className="r-section-title">Skills</div>
            <div className="r-skills">{skills.map((s,i) => <span key={i} className="r-chip">{s}</span>)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResumeMinimal({ data, sectionOrder }) {
  const { personal, skills, photo } = data;
  const renderSection = (key) => {
    if (key === "summary") return data.summary ? (
      <div key="summary">
        <div className="r-section-title">Summary</div>
        <div className="r-summary" style={{ marginBottom:16 }}>{data.summary}</div>
      </div>
    ) : null;
    if (key === "experience") return data.experience.length > 0 ? (
      <div key="experience">
        <div className="r-section-title">Experience</div>
        {data.experience.map(e => (
          <div key={e.id} className="r-entry">
            <div className="r-entry-meta">{e.from}{e.to?`–${e.to}`:""}<br /><span style={{ color:"#bbb" }}>{e.company}</span></div>
            <div><div className="r-entry-title">{e.role}</div><div className="r-entry-desc">{parseDesc(e.desc)}</div></div>
          </div>
        ))}
      </div>
    ) : null;
    if (key === "education")      return renderEducationSectionMinimal(data);
    if (key === "projects")       return renderProjectsSectionMinimal(data);
    if (key === "certifications") return data.certifications.length > 0 ? (
      <div key="certifications">
        <div className="r-section-title">Certifications</div>
        {data.certifications.map(c => (
          <div key={c.id} className="r-entry">
            <div className="r-entry-meta">{c.year}</div>
            <div><div className="r-entry-title">{c.name}</div><div className="r-entry-sub">{c.issuer}</div></div>
          </div>
        ))}
      </div>
    ) : null;
    if (key === "achievements") return data.achievements.length > 0 ? (
      <div key="achievements">
        <div className="r-section-title">Achievements</div>
        {data.achievements.map((a,i) => <div key={i} style={{ fontSize:12,color:"#555",marginBottom:4 }}>— {a}</div>)}
      </div>
    ) : null;
    if (key === "languages") return data.languages.length > 0 ? (
      <div key="languages">
        <div className="r-section-title">Languages</div>
        <div className="r-skills">{data.languages.map((l,i) => <span key={i} className="r-chip">{l}</span>)}</div>
      </div>
    ) : null;
    return null;
  };
  return (
    <div className="resume minimal">
      <div className="r-header">
        <div>
          <div className="r-name">{personal.name||"Your Name"}</div>
          {personal.title && <div className="r-title">{personal.title}</div>}
          <div className="r-divider" style={{ marginTop:12,marginBottom:0 }} />
          <div style={{ fontSize:11,color:"#888",marginTop:6,display:"flex",gap:16 }}>
            {personal.email   && <span>{personal.email}</span>}
            {personal.phone   && <span>{personal.phone}</span>}
            {personal.address && <span>{personal.address}</span>}
          </div>
        </div>
        {photo && <img src={photo} alt="" className="r-photo" />}
      </div>
      <div className="r-divider" />
      {sectionOrder.map(s => renderSection(s))}
      {skills.length > 0 && (
        <div key="skills">
          <div className="r-section-title">Skills</div>
          <div className="r-skills">{skills.map((s,i) => <span key={i} className="r-chip">{s}</span>)}</div>
        </div>
      )}
    </div>
  );
}

const CREATIVE_LEFT  = ["summary","experience","projects"];
const CREATIVE_RIGHT = ["skills","education","certifications","languages","achievements"];

function ResumeCreative({ data, sectionOrder }) {
  const { personal, skills, education, certifications, languages, achievements, photo } = data;
  const renderLeft = (key) => {
    if (key === "summary") return data.summary ? (
      <div key="summary">
        <div className="r-section-title">Profile</div>
        <div className="r-summary" style={{ marginBottom:20 }}>{data.summary}</div>
      </div>
    ) : null;
    if (key === "experience") return renderExperienceSection(data);
    if (key === "projects")   return renderProjectsSection(data);
    return null;
  };
  const renderRight = (key) => {
    if (key === "skills" && skills.length > 0) return (
      <div key="skills">
        <div className="r-section-title">Skills</div>
        {skills.map((s,i) => (
          <div key={i}>
            <div className="r-skill-name">{s}</div>
            <div className="r-skill-track"><div className="r-skill-fill" style={{ width:`${60+(i*11)%38}%` }} /></div>
          </div>
        ))}
      </div>
    );
    if (key === "education" && education.length > 0) return (
      <div key="education">
        <div className="r-section-title">Education</div>
        {education.map(e => (
          <div key={e.id} style={{ marginBottom:12 }}>
            <div className="r-entry-title" style={{ fontSize:12 }}>{e.degree}</div>
            <div className="r-entry-sub">{e.school}</div>
            <div className="r-entry-date">{e.year}</div>
          </div>
        ))}
      </div>
    );
    if (key === "certifications" && certifications.length > 0) return (
      <div key="certifications">
        <div className="r-section-title">Certifications</div>
        {certifications.map(c => (
          <div key={c.id} style={{ marginBottom:8,fontSize:12 }}>
            <strong>{c.name}</strong><br />
            <span style={{ color:"#888" }}>{c.issuer} · {c.year}</span>
          </div>
        ))}
      </div>
    );
    if (key === "languages" && languages.length > 0) return (
      <div key="languages">
        <div className="r-section-title">Languages</div>
        {languages.map((l,i) => <div key={i} style={{ fontSize:12,marginBottom:4 }}>{l}</div>)}
      </div>
    );
    if (key === "achievements" && achievements.length > 0) return (
      <div key="achievements">
        <div className="r-section-title">Achievements</div>
        {achievements.map((a,i) => <div key={i} className="r-chip" style={{ display:"block",marginBottom:4,fontSize:10 }}>{a}</div>)}
      </div>
    );
    return null;
  };
  return (
    <div className="resume creative">
      <div className="r-header">
        <div className="r-name">{personal.name||"Your Name"}</div>
        {personal.title && <div className="r-title">{personal.title}</div>}
        <div className="r-contact">
          {personal.email    && <span>✉ {personal.email}</span>}
          {personal.phone    && <span>✆ {personal.phone}</span>}
          {personal.address  && <span>⊙ {personal.address}</span>}
          {personal.linkedin && <span>in {personal.linkedin}</span>}
          {personal.github   && <span>⌥ {personal.github}</span>}
        </div>
      </div>
      <div className="r-body">
        <div className="r-left">
          {sectionOrder.filter(s => CREATIVE_LEFT.includes(s)).map(s => renderLeft(s))}
        </div>
        <div className="r-right">
          {photo && <img src={photo} alt="" className="r-photo" />}
          {sectionOrder.filter(s => CREATIVE_RIGHT.includes(s)).map(s => renderRight(s))}
        </div>
      </div>
    </div>
  );
}

// ─── RESUME PREVIEW ───────────────────────────────────────────────────────────
function ResumePreview({ data, template, sectionOrder, previewRef }) {
  const C = { modern: ResumeModern, professional: ResumeProfessional, minimal: ResumeMinimal, creative: ResumeCreative }[template] || ResumeModern;
  return <div ref={previewRef} id="resume-preview"><C data={data} sectionOrder={sectionOrder} /></div>;
}

// ─── FORM COMPONENTS ──────────────────────────────────────────────────────────
function PersonalForm({ data, onChange }) {
  const f = key => ({ value: data[key]||"", onChange: e => onChange({ ...data, [key]: e.target.value }) });
  return (
    <div className="form-section">
      <div className="form-section-title"><span className="icon">①</span> Personal Info</div>
      <div className="form-grid">
        <div><label>Full Name</label><input {...f("name")} placeholder="Jordan Rivera" /></div>
        <div><label>Job Title</label><input {...f("title")} placeholder="Software Engineer" /></div>
        <div className="form-grid form-grid-2">
          <div><label>Email</label><input {...f("email")} placeholder="you@email.com" /></div>
          <div><label>Phone</label><input {...f("phone")} placeholder="+1 (555) …" /></div>
        </div>
        <div><label>Address</label><input {...f("address")} placeholder="City, State" /></div>
        <div className="form-grid form-grid-2">
          <div><label>LinkedIn</label><input {...f("linkedin")} placeholder="linkedin.com/in/…" /></div>
          <div><label>GitHub</label><input {...f("github")} placeholder="github.com/…" /></div>
        </div>
      </div>
    </div>
  );
}

function PhotoForm({ photo, onChange }) {
  const handleFile = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => onChange(ev.target.result);
    reader.readAsDataURL(file);
  };
  return (
    <div className="form-section">
      <div className="form-section-title"><span className="icon">📷</span> Photo (optional)</div>
      <div style={{ display:"flex",gap:12,alignItems:"center" }}>
        {photo && <img src={photo} alt="" style={{ width:52,height:52,borderRadius:"50%",objectFit:"cover",border:"2px solid var(--accent)" }} />}
        <input type="file" accept="image/*" onChange={handleFile} style={{ fontSize:12 }} />
        {photo && <button className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>Remove</button>}
      </div>
    </div>
  );
}

function SummaryForm({ value, onChange }) {
  return (
    <div className="form-section">
      <div className="form-section-title"><span className="icon">②</span> Summary</div>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder="Write a short professional summary…" style={{ minHeight:100 }} />
    </div>
  );
}

function SkillsForm({ skills, onChange }) {
  const [input, setInput] = useState("");
  const add = () => { const s = input.trim(); if (s && !skills.includes(s)) { onChange([...skills,s]); setInput(""); } };
  return (
    <div className="form-section">
      <div className="form-section-title"><span className="icon">③</span> Skills</div>
      <div className="tag-input">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&add()} placeholder="Type a skill + Enter" />
        <button className="btn btn-primary btn-sm" onClick={add}>Add</button>
      </div>
      <div className="skill-tags">
        {skills.map((s,i) => <span key={i} className="skill-tag">{s}<button onClick={() => onChange(skills.filter((_,j)=>j!==i))}>×</button></span>)}
      </div>
    </div>
  );
}

function SimpleListSection({ title, icon, items, onChange, placeholder }) {
  const [input, setInput] = useState("");
  const add = () => { const s = input.trim(); if (s) { onChange([...items,s]); setInput(""); } };
  return (
    <div className="form-section">
      <div className="form-section-title"><span className="icon">{icon}</span> {title}</div>
      <div className="tag-input">
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key==="Enter"&&add()} placeholder={placeholder} />
        <button className="btn btn-primary btn-sm" onClick={add}>Add</button>
      </div>
      <div className="skill-tags">
        {items.map((s,i) => <span key={i} className="skill-tag">{s}<button onClick={() => onChange(items.filter((_,j)=>j!==i))}>×</button></span>)}
      </div>
    </div>
  );
}

function RepeatableSection({ title, icon, items, onChange, renderFields }) {
  const add    = () => onChange([...items,{ id:uid() }]);
  const update = (id,u) => onChange(items.map(it => it.id===id ? {...it,...u} : it));
  const remove = (id)   => onChange(items.filter(it => it.id!==id));
  const move   = (id,dir) => {
    const idx  = items.findIndex(it => it.id===id);
    const next = [...items];
    const [item] = next.splice(idx,1);
    next.splice(Math.max(0,Math.min(items.length-1,idx+dir)),0,item);
    onChange(next);
  };
  return (
    <div className="form-section">
      <div className="form-section-title" style={{ justifyContent:"space-between" }}>
        <span style={{ display:"flex",alignItems:"center",gap:8 }}><span className="icon">{icon}</span> {title}</span>
        <button className="btn btn-primary btn-sm" onClick={add}>+ Add</button>
      </div>
      {items.length===0 && <div style={{ fontSize:12,color:"var(--muted)",textAlign:"center",padding:"12px 0" }}>No entries yet. Click Add.</div>}
      {items.map((item,idx) => (
        <div key={item.id} className="entry-card">
          <div className="entry-header">
            <span className="entry-title">{renderFields.getLabel(item)||`Entry ${idx+1}`}</span>
            <div className="entry-actions">
              {idx>0              && <button className="btn btn-ghost btn-sm" onClick={()=>move(item.id,-1)}>↑</button>}
              {idx<items.length-1 && <button className="btn btn-ghost btn-sm" onClick={()=>move(item.id,1)}>↓</button>}
              <button className="btn btn-ghost btn-sm" style={{ color:"#c0392b" }} onClick={()=>remove(item.id)}>×</button>
            </div>
          </div>
          {renderFields.render(item,u=>update(item.id,u))}
        </div>
      ))}
    </div>
  );
}

// ─── SECTION ORDER PANEL ──────────────────────────────────────────────────────
function SectionOrderPanel({ order, onChange }) {
  const [dragging, setDragging] = useState(null);
  const [over, setOver]         = useState(null);
  const labels = { summary:"📝 Summary", experience:"💼 Experience", education:"🎓 Education", projects:"🚀 Projects", certifications:"🏅 Certifications", achievements:"⭐ Achievements", languages:"🌐 Languages" };
  const onDrop = () => {
    if (dragging===null||over===null||dragging===over) { setDragging(null); setOver(null); return; }
    const next = [...order]; const [item] = next.splice(dragging,1); next.splice(over,0,item);
    onChange(next); setDragging(null); setOver(null);
  };
  return (
    <div className="section-ordering">
      <div style={{ fontSize:12,color:"var(--muted)",marginBottom:10 }}>Drag to reorder sections</div>
      {order.map((sec,i) => (
        <div key={sec}
          className={`drag-item ${dragging===i?"dragging":""} ${over===i&&dragging!==i?"drag-over":""}`}
          draggable
          onDragStart={()=>setDragging(i)}
          onDragOver={e=>{e.preventDefault();setOver(i);}}
          onDrop={onDrop}
          onDragEnd={()=>{setDragging(null);setOver(null);}}>
          <span className="drag-handle">⠿</span> {labels[sec]||sec}
        </div>
      ))}
    </div>
  );
}

// ─── DOWNLOAD BUTTONS ─────────────────────────────────────────────────────────
function DownloadButtons({ previewRef, data, onToast }) {
  const downloadPDF = () => {
    const el = previewRef.current; if (!el) return;
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => {
      window.html2pdf().set({
        margin:0, filename:`${data.personal.name||"resume"}.pdf`,
        image:{ type:"jpeg",quality:0.98 },
        html2canvas:{ scale:2,useCORS:true },
        jsPDF:{ unit:"mm",format:"a4",orientation:"portrait" },
      }).from(el).save();
      onToast("PDF downloading…");
    };
    document.head.appendChild(script);
  };
  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(data,null,2)],{ type:"application/json" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = "resume.json"; a.click();
    onToast("JSON exported!");
  };
  return (
    <div style={{ display:"flex",gap:8,flexWrap:"wrap" }}>
      <button className="btn btn-primary" onClick={downloadPDF}>⬇ PDF</button>
      <button className="btn btn-dark"    onClick={()=>window.print()}>🖨 Print</button>
      <button className="btn btn-ghost"   onClick={downloadJSON}>{ } JSON</button>
    </div>
  );
}

// ─── AI HELPER ────────────────────────────────────────────────────────────────
const AI_ENDPOINT = process.env.REACT_APP_AI_URL || "http://localhost:5000/api/ai";

async function callAI(systemPrompt, userMessage) {
  const res  = await fetch(AI_ENDPOINT, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({systemPrompt,userMessage}) });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text || "Unable to generate response.";
}

function AIHelper({ data, onApply }) {
  const [mode, setMode]     = useState("improve");
  const [input, setInput]   = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);

  const MODES = [
    { id:"improve",  label:"✦ Improve Text",  prompt:"You are a professional resume writer. Rewrite the following text to be more impactful, professional, and ATS-friendly. Output ONLY the improved text." },
    { id:"summary",  label:"✦ Gen Summary",   prompt:`You are a resume expert. Write a 2-3 sentence professional summary. Output ONLY the summary. Data: ${JSON.stringify({name:data.personal.name,title:data.personal.title,skills:data.skills})}` },
    { id:"bullets",  label:"✦ Bullet Points", prompt:"Convert the following into 3-4 powerful bullet points using strong action verbs. Output ONLY the bullets, one per line." },
    { id:"keywords", label:"✦ Add Keywords",  prompt:"Rewrite the following resume text to include more relevant industry keywords while keeping the meaning intact. Output ONLY the improved text." },
  ];

  const run = async () => {
    const selected = MODES.find(m => m.id===mode);
    setLoading(true); setResult("");
    try {
      const text = await callAI(selected.prompt, mode==="summary" ? "Generate the summary." : input);
      setResult(text);
    } catch (err) { setResult("⚠ "+(err.message||"AI unavailable.")); }
    setLoading(false);
  };

  return (
    <div className="ai-panel">
      <div className="ai-panel-title">AI Writing Assistant</div>
      <div style={{ display:"flex",flexWrap:"wrap",gap:5,marginBottom:10 }}>
        {MODES.map(m => (
          <button key={m.id} className={`btn btn-sm ${mode===m.id?"btn-ai":""}`}
            style={mode!==m.id?{background:"rgba(255,255,255,.1)",color:"#e8e4dc",border:"1px solid rgba(255,255,255,.15)"}:{}}
            onClick={()=>setMode(m.id)}>{m.label}</button>
        ))}
      </div>
      {mode!=="summary" && (
        <textarea value={input} onChange={e=>setInput(e.target.value)}
          placeholder={mode==="improve"?"Paste text to improve…":mode==="bullets"?"Describe your role…":"Paste text to optimize…"}
          style={{ background:"rgba(255,255,255,.08)",border:"1px solid rgba(255,255,255,.15)",color:"#e8e4dc",borderRadius:6,padding:"8px 10px",width:"100%",minHeight:70,fontSize:12,resize:"vertical" }} />
      )}
      <div style={{ marginTop:8,display:"flex",gap:8 }}>
        <button className="btn btn-ai btn-sm" onClick={run} disabled={loading}>{loading?"Thinking…":"✦ Generate"}</button>
        {result && <button className="btn btn-sm" style={{ background:"rgba(255,255,255,.1)",color:"#e8e4dc" }} onClick={()=>navigator.clipboard.writeText(result)}>Copy</button>}
      </div>
      {loading && <div className="ai-loading"><div className="ai-dot"/><div className="ai-dot"/><div className="ai-dot"/><span style={{ fontSize:12,color:"rgba(255,255,255,.5)",marginLeft:4 }}>Crafting…</span></div>}
      {result && !loading && (
        <div className="ai-result">
          <div style={{ fontSize:10,color:"rgba(255,255,255,.4)",marginBottom:6,textTransform:"uppercase",letterSpacing:1 }}>AI Result</div>
          {result}
          {mode==="summary" && <button className="btn btn-sm btn-success" style={{ marginTop:8 }} onClick={()=>onApply("summary",result)}>Apply to Resume</button>}
        </div>
      )}
    </div>
  );
}

// ─── EDITOR (the main resume builder) ────────────────────────────────────────
function Editor({ resumeId, onBack, onToast }) {
  const [data, setData]             = useState(DEFAULT_RESUME);
  const [template, setTemplate]     = useState("modern");
  const [sectionOrder, setSO]       = useState(SECTION_ORDER_DEFAULT);
  const [label, setLabel]           = useState("Untitled Resume");
  const [tab, setTab]               = useState("form");
  const [dark, setDark]             = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveStatus, setSaveStatus] = useState(""); // "saved" | "error" | ""
  const previewRef                  = useRef(null);

  // Load existing resume if resumeId is set
  useEffect(() => {
    if (!resumeId) return;
    fetchResume(resumeId).then(r => {
      setData(r.data);
      setTemplate(r.template || "modern");
      setSO(r.sectionOrder?.length ? r.sectionOrder : SECTION_ORDER_DEFAULT);
      setLabel(r.label || "Untitled Resume");
    }).catch(e => onToast("Failed to load resume: " + e.message));
  }, [resumeId]);

  const setP = (k, v) => setData(d => ({ ...d, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setSaveStatus("");
    try {
      const payload = { label, data, template, sectionOrder };
      if (resumeId) await saveResume(resumeId, payload);
      else {
        const created = await createResume(payload);
        // update URL so subsequent saves go to PUT not POST
        window.history.replaceState({}, "", `?resume=${created._id}`);
      }
      setSaveStatus("saved"); onToast("Resume saved ✓");
    } catch (e) {
      setSaveStatus("error"); onToast("Save failed: " + e.message);
    } finally { setSaving(false); setTimeout(() => setSaveStatus(""), 3000); }
  };

  const expFields = {
    getLabel: it => it.role || "",
    render: (it, upd) => (
      <div className="form-grid">
        <div className="form-grid form-grid-2">
          <div><label>Role</label><input value={it.role||""} onChange={e=>upd({role:e.target.value})} placeholder="Software Engineer" /></div>
          <div><label>Company</label><input value={it.company||""} onChange={e=>upd({company:e.target.value})} placeholder="Acme Corp" /></div>
        </div>
        <div className="form-grid form-grid-2">
          <div><label>From</label><input value={it.from||""} onChange={e=>upd({from:e.target.value})} placeholder="2021" /></div>
          <div><label>To</label><input value={it.to||""} onChange={e=>upd({to:e.target.value})} placeholder="Present" /></div>
        </div>
        <div><label>Description (one bullet per line)</label><textarea value={it.desc||""} onChange={e=>upd({desc:e.target.value})} placeholder={"Built scalable APIs\nReduced latency by 40%"} style={{ minHeight:80 }} /></div>
      </div>
    ),
  };
  const eduFields = {
    getLabel: it => it.school || "",
    render: (it, upd) => (
      <div className="form-grid">
        <div className="form-grid form-grid-2">
          <div><label>School</label><input value={it.school||""} onChange={e=>upd({school:e.target.value})} /></div>
          <div><label>Degree</label><input value={it.degree||""} onChange={e=>upd({degree:e.target.value})} /></div>
        </div>
        <div className="form-grid form-grid-2">
          <div><label>Year</label><input value={it.year||""} onChange={e=>upd({year:e.target.value})} /></div>
          <div><label>GPA</label><input value={it.gpa||""} onChange={e=>upd({gpa:e.target.value})} /></div>
        </div>
      </div>
    ),
  };
  const projFields = {
    getLabel: it => it.name || "",
    render: (it, upd) => (
      <div className="form-grid">
        <div><label>Project Name</label><input value={it.name||""} onChange={e=>upd({name:e.target.value})} /></div>
        <div className="form-grid form-grid-2">
          <div><label>Tech Stack</label><input value={it.tech||""} onChange={e=>upd({tech:e.target.value})} /></div>
          <div><label>Link</label><input value={it.link||""} onChange={e=>upd({link:e.target.value})} /></div>
        </div>
        <div><label>Description</label><textarea value={it.desc||""} onChange={e=>upd({desc:e.target.value})} style={{ minHeight:60 }} /></div>
      </div>
    ),
  };
  const certFields = {
    getLabel: it => it.name || "",
    render: (it, upd) => (
      <div className="form-grid">
        <div><label>Name</label><input value={it.name||""} onChange={e=>upd({name:e.target.value})} /></div>
        <div className="form-grid form-grid-2">
          <div><label>Issuer</label><input value={it.issuer||""} onChange={e=>upd({issuer:e.target.value})} /></div>
          <div><label>Year</label><input value={it.year||""} onChange={e=>upd({year:e.target.value})} /></div>
        </div>
      </div>
    ),
  };

  return (
    <div className={`app ${dark ? "dark" : ""}`}>
      <header className="topbar">
        <div style={{ display:"flex",alignItems:"center",gap:12 }}>
          <button className="btn btn-ghost btn-sm" style={{ color:"var(--ink)",borderColor:"rgba(255,255,255,.2)" }} onClick={onBack}>← Dashboard</button>
          <div className="topbar-logo">Resume<span>·</span>Craft</div>
        </div>
        {/* Inline resume label editor */}
        <input
          className="label-input"
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="Resume name…"
        />
        <div className="topbar-actions">
          <button
            className={`btn btn-sm ${saveStatus==="saved"?"btn-success":saveStatus==="error"?"btn-danger":"btn-primary"}`}
            onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : saveStatus==="saved" ? "✓ Saved" : saveStatus==="error" ? "✕ Error" : "💾 Save"}
          </button>
          <DownloadButtons previewRef={previewRef} data={data} onToast={onToast} />
          <button className="btn btn-ghost btn-sm" style={{ color:"var(--ink)",borderColor:"rgba(255,255,255,.2)" }} onClick={() => setDark(d=>!d)}>{dark?"☀":"☾"}</button>
        </div>
      </header>

      <div className="main-layout">
        <aside className="sidebar">
          <div className="tabs">
            {[["form","✏ Edit"],["ai","✦ AI"],["templates","🎨 Style"],["order","⠿ Order"]].map(([id,lbl]) => (
              <button key={id} className={`tab ${tab===id?"active":""}`} onClick={()=>setTab(id)}>{lbl}</button>
            ))}
          </div>

          {tab==="form" && <>
            <PersonalForm data={data.personal} onChange={v=>setP("personal",v)} />
            <PhotoForm photo={data.photo} onChange={v=>setP("photo",v)} />
            <SummaryForm value={data.summary} onChange={v=>setP("summary",v)} />
            <SkillsForm skills={data.skills} onChange={v=>setP("skills",v)} />
            <RepeatableSection title="Experience"     icon="💼" items={data.experience}     onChange={v=>setP("experience",v)}     renderFields={expFields}  />
            <RepeatableSection title="Education"      icon="🎓" items={data.education}      onChange={v=>setP("education",v)}      renderFields={eduFields}  />
            <RepeatableSection title="Projects"       icon="🚀" items={data.projects}       onChange={v=>setP("projects",v)}       renderFields={projFields} />
            <RepeatableSection title="Certifications" icon="🏅" items={data.certifications} onChange={v=>setP("certifications",v)} renderFields={certFields} />
            <SimpleListSection title="Achievements" icon="⭐" items={data.achievements} onChange={v=>setP("achievements",v)} placeholder="Speaker at ReactConf 2024" />
            <SimpleListSection title="Languages"    icon="🌐" items={data.languages}    onChange={v=>setP("languages",v)}    placeholder="English (Native)" />
          </>}

          {tab==="ai" && <AIHelper data={data} onApply={(field,val)=>{setP(field,val);onToast("Applied to resume!");}} />}

          {tab==="templates" && (
            <div className="template-grid">
              {TEMPLATES.map(t => (
                <div key={t.id} className={`template-card ${template===t.id?"active":""}`}
                  onClick={()=>{setTemplate(t.id);onToast(`Template: ${t.label}`);}}>
                  <TemplateThumbnail template={t} />
                  <div className="template-name">{t.label}</div>
                </div>
              ))}
            </div>
          )}

          {tab==="order" && <SectionOrderPanel order={sectionOrder} onChange={setSO} />}
        </aside>

        <main className="preview-area">
          <div className="preview-wrapper">
            <div className="preview-controls">
              <div style={{ fontSize:13,color:"var(--muted)",fontWeight:600 }}>Live Preview · {TEMPLATES.find(t=>t.id===template)?.label}</div>
              <DownloadButtons previewRef={previewRef} data={data} onToast={onToast} />
            </div>
            <ResumePreview data={data} template={template} sectionOrder={sectionOrder} previewRef={previewRef} />
          </div>
        </main>
      </div>
    </div>
  );
}

// ─── APP SHELL ────────────────────────────────────────────────────────────────
function AppShell() {
  const { user, loading }       = useAuth();
  const [view, setView]         = useState("dashboard"); // "dashboard" | "editor"
  const [activeResumeId, setId] = useState(null);
  const [toast, setToast]       = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const openEditor = (id = null) => { setId(id); setView("editor"); };
  const goBack     = ()          => { setId(null); setView("dashboard"); };

  if (loading) return (
    <div className="auth-overlay">
      <div style={{ color:"#fff",fontSize:18,opacity:.7 }}>Loading…</div>
    </div>
  );

  if (!user) return <LandingPage />;

  return (
    <>
      {view === "dashboard" && <Dashboard onNew={() => openEditor(null)} onOpen={openEditor} />}
      {view === "editor"    && <Editor resumeId={activeResumeId} onBack={goBack} onToast={showToast} />}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}