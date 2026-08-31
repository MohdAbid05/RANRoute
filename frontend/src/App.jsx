import { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import {
  getCustomers, createCustomer, updateCustomer, deleteCustomer,
  importPreview, importConfirm, extractCustomers, normalizeAddresses,
  getSetRoutes, createSetRoute, updateSetRoute, deleteSetRoute,
  personalizeRoute, optimizeRoute, getRouteStats,
} from "./api";

// ── Profile helpers ─────────────────────────────────────────────────────────

const PROFILE_KEY = "ranroute_profile";

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || null; }
  catch { return null; }
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

// ── App ─────────────────────────────────────────────────────────────────────

// ── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);
  return <div className="toast">{message}</div>;
}

// ── App ─────────────────────────────────────────────────────────────────────

function App() {
  const [session, setSession]               = useState(null);
  const [authLoading, setAuthLoading]       = useState(true);
  const [page, setPage]                     = useState("home");
  const [customers, setCustomers]           = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [profile, setProfile]               = useState(null);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [toast, setToast]                   = useState(null);
  const [planPreload, setPlanPreload]       = useState(null);
  const [routeStats, setRouteStats]         = useState(null); // { total_runs, total_time_saved_s, total_dist_saved_m }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
      if (session) {
        const stored = loadProfile();
        if (!stored) {
          setShowProfileSetup(true);
        } else {
          setProfile(stored);
        }
        getCustomers()
          .then(setCustomers)
          .catch(() => {})
          .finally(() => setCustomersLoading(false));
        getRouteStats()
          .then(setRouteStats)
          .catch(() => {});
      } else {
        setCustomersLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        const stored = loadProfile();
        if (!stored) setShowProfileSetup(true);
        else setProfile(stored);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setPage("home");
  }

  function handleProfileSave(p) {
    saveProfile(p);
    setProfile(p);
    setShowProfileSetup(false);
  }

  function loadRouteIntoPlan(customerIds, lastConstraints) {
    setPlanPreload({ customerIds, lastConstraints });
    setPage("plan");
  }

  if (authLoading) {
    return (
      <div className="auth-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <div className="app-shell">
      {showProfileSetup && (
        <ProfileSetupModal
          email={session.user.email}
          onSave={handleProfileSave}
        />
      )}

      <TopBar
        page={page}
        profile={profile}
        onHome={() => setPage("home")}
        onLogout={logout}
        onEditProfile={() => setShowProfileSetup(true)}
      />

      <main className="page-wrap">
        {page === "home" && (
          <HomePage
            onGo={setPage}
            customerCount={customers.length}
            profile={profile}
            session={session}
            routeStats={routeStats}
          />
        )}

        {page === "customers" && (
          <CustomersPage
            customers={customers}
            setCustomers={setCustomers}
            customersLoading={customersLoading}
            setToast={setToast}
          />
        )}
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}

        {page === "plan" && (
          <PlanRoutesPage
            customers={customers}
            preload={planPreload}
            onPreloadConsumed={() => setPlanPreload(null)}
            setToast={setToast}
            onGoToSet={() => setPage("set")}
            onRouteOptimized={() => getRouteStats().then(setRouteStats).catch(() => {})}
          />
        )}

        {page === "set" && (
          <SetRoutesPage
            setToast={setToast}
            onLoadIntoRouting={loadRouteIntoPlan}
          />
        )}
      </main>
    </div>
  );
}

// ── Profile setup modal ─────────────────────────────────────────────────────

function ProfileSetupModal({ email, onSave }) {
  const defaultName = email ? email.split("@")[0] : "";
  const [displayName, setDisplayName]   = useState(defaultName);
  const [companyName, setCompanyName]   = useState("");
  const [logoPreview, setLogoPreview]   = useState(null);
  const [logoDataUrl, setLogoDataUrl]   = useState(null);
  const fileRef = useRef();

  function handleLogo(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setLogoPreview(ev.target.result);
      setLogoDataUrl(ev.target.result);
    };
    reader.readAsDataURL(file);
  }

  function handleSave(e) {
    e.preventDefault();
    if (!displayName.trim()) return;
    onSave({
      displayName: displayName.trim(),
      companyName: companyName.trim(),
      logo: logoDataUrl,
    });
  }

  return (
    <div className="modal-overlay">
      <form className="modal-card" onSubmit={handleSave}>
        <div className="login-logo-mark" style={{ marginBottom: 20 }}>R</div>
        <h2>Set up your profile</h2>
        <p className="muted">Tell us a bit about you and your business.</p>

        <label className="input-group">
          Your name
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. Rishi Patel"
            required
          />
        </label>

        <label className="input-group">
          Company / business name
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="e.g. Patel Deliveries"
          />
        </label>

        <label className="input-group" style={{ marginTop: 20 }}>
          Company logo <span style={{ fontWeight: 400, opacity: 0.5, textTransform: "none", letterSpacing: 0 }}>(optional)</span>
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10 }}>
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="logo preview"
              style={{ width: 52, height: 52, borderRadius: 10, objectFit: "contain", border: "1px solid rgba(255,255,255,0.12)", background: "#1a1a1a" }}
            />
          ) : (
            <div style={{ width: 52, height: 52, borderRadius: 10, background: "#1a1a1a", border: "1px dashed rgba(255,255,255,0.15)", display: "grid", placeItems: "center", color: "rgba(255,255,255,0.3)", fontSize: 22 }}>
              ⊕
            </div>
          )}
          <label className="upload-button" style={{ fontSize: 13, padding: "9px 14px" }}>
            {logoPreview ? "Change logo" : "Upload logo"}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogo} />
          </label>
        </div>

        <div className="modal-actions">
          <button type="submit" className="primary-button">Save profile →</button>
        </div>
      </form>
    </div>
  );
}

// ── Login screen ────────────────────────────────────────────────────────────

function LoginScreen() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail]       = useState("");
  const [pass, setPass]         = useState("");
  const [error, setError]       = useState("");
  const [info, setInfo]         = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password: pass });
      if (error) { setError(error.message); }
      else { setInfo("Account created! Check your email to confirm, then sign in."); setIsSignUp(false); setPass(""); }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
      if (error) setError(error.message);
    }

    setLoading(false);
  }

  async function handleForgotPassword() {
    if (!email) { setError("Enter your email above first."); return; }
    setError(""); setInfo("");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setInfo("Password reset email sent — check your inbox.");
  }

  function switchMode() { setIsSignUp((p) => !p); setError(""); setInfo(""); }

  return (
    <div className="login-page">
      {/* ── Hero ── */}
      <section className="login-hero">
        <div className="hero-orb-mid" />
        <div className="brand-badge">
          <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
          Smarter small-business routing
        </div>

        <h1>RAN<br />ROUTE</h1>

        <p>
          Plan optimized delivery routes in plain English.<br />
          No fleet data. No ops team required.
        </p>

        <div className="hero-stats">
          <div className="hero-stat">
            <strong>25+</strong>
            <span>stops optimized</span>
          </div>
          <div className="hero-stat">
            <strong>AI</strong>
            <span>route planner</span>
          </div>
          <div className="hero-stat">
            <strong>Easy</strong>
            <span>to use</span>
          </div>
        </div>

        <div className="hero-lines">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </section>

      {/* ── Login form ── */}
      <section className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div className="login-logo-mark">R</div>

          <h2>{isSignUp ? "Create account" : "Welcome back"}</h2>
          <p className="muted">
            {isSignUp ? "Sign up to start managing customers and routes." : "Sign in to manage your routes."}
          </p>

          <label className="input-group">
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              style={{ marginTop: 7 }}
            />
          </label>

          <label className="input-group">
            Password
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder={isSignUp ? "Choose a strong password" : "Enter password"}
              autoComplete={isSignUp ? "new-password" : "current-password"}
              required
              style={{ marginTop: 7 }}
            />
          </label>

          {error && <p className="error-text">{error}</p>}
          {info  && <p className="info-text">{info}</p>}

          <button className="primary-button full-button" type="submit" disabled={loading}>
            {loading ? (
              <span className="btn-spinner-wrap">
                <span className="spinner spinner-sm" />
                {isSignUp ? "Creating account…" : "Signing in…"}
              </span>
            ) : (
              isSignUp ? "Create account →" : "Sign in →"
            )}
          </button>

          {!isSignUp && (
            <button type="button" className="forgot-link" onClick={handleForgotPassword}>
              Forgot password?
            </button>
          )}

          <div className="login-toggle-row">
            <span>{isSignUp ? "Already have an account?" : "Don't have an account?"}</span>
            <button type="button" className="toggle-mode-btn" onClick={switchMode}>
              {isSignUp ? "Sign in" : "Sign up"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

// ── Top bar ─────────────────────────────────────────────────────────────────

function TopBar({ page, profile, onHome, onLogout, onEditProfile }) {
  const names = { home: "Dashboard", customers: "Customers", plan: "Plan Routes", set: "Set Routes" };
  const initial = profile?.displayName?.[0]?.toUpperCase() || "R";

  return (
    <header className="top-bar">
      <button className="brand-button" onClick={onHome}>
        <span className="brand-icon">R</span>
        <span>
          <strong>RANRoute Everywhere</strong>
          <small>{names[page]}</small>
        </span>
      </button>

      <div className="top-actions">
        {page !== "home" && (
          <button className="text-button" onClick={onHome}>← Dashboard</button>
        )}
        <button className="profile-pill" type="button" onClick={onEditProfile} title="Edit profile">
          <span className="profile-avatar">
            {profile?.logo
              ? <img src={profile.logo} alt="logo" />
              : initial
            }
          </span>
          <span>{profile?.displayName || "Profile"}</span>
        </button>
        <button className="outline-button" onClick={onLogout}>Log out</button>
      </div>
    </header>
  );
}

// ── Home page ────────────────────────────────────────────────────────────────

function HomePage({ onGo, customerCount, profile, session, routeStats }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const name = profile?.displayName || session?.user?.email?.split("@")[0] || "";

  // Format helpers
  function fmtTime(s) {
    if (!s || s < 60) return null;
    const m = Math.round(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
  }
  function fmtDist(m) {
    if (!m || m < 100) return null;
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
  }

  const timeSaved = fmtTime(routeStats?.total_time_saved_s);
  const distSaved = fmtDist(routeStats?.total_dist_saved_m);
  const hasStats  = routeStats?.total_runs > 0 && (timeSaved || distSaved);

  return (
    <div>
      <section className="welcome-banner">
        <div style={{ flex: 1, minWidth: 0 }}>
          {profile?.companyName && (
            <div className="welcome-company">
              {profile.logo && (
                <img src={profile.logo} alt="logo" className="company-logo-thumb" />
              )}
              <span className="company-name-label">{profile.companyName}</span>
            </div>
          )}
          <p className="eyebrow">RANRoute Everywhere</p>
          <h2>{greeting}{name ? `, ${name}` : ""}.</h2>
          <p>Keep your customers organised, build a route, and manage saved delivery plans — all in one place.</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <div className="summary-pill">
            <strong>{customerCount}</strong>
            <span>customers ready</span>
          </div>
          {routeStats?.total_runs > 0 && (
            <div className="summary-pill">
              <strong>{routeStats.total_runs}</strong>
              <span>route{routeStats.total_runs !== 1 ? "s" : ""} optimized</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Cumulative savings banner ── */}
      {hasStats && (
        <div className="home-savings-banner">
          <span className="home-savings-icon">🚀</span>
          <div>
            <strong>RANRoute Everywhere has saved you</strong>
            <span>
              {timeSaved && <>{timeSaved} of drive time</>}
              {timeSaved && distSaved && " · "}
              {distSaved && <>{distSaved} of distance</>}
              {" "}across {routeStats.total_runs} optimized route{routeStats.total_runs !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      <section className="option-grid">
        <HomeCard number="01" title="Customers"     text="Add customers manually, import a spreadsheet, or let AI parse messy records into clean data."         button="Manage customers" onClick={() => onGo("customers")} />
        <HomeCard number="02" title="Plan Routes"   text="Select stops, add plain-English constraints, and get an AI-optimized route in seconds."                button="Plan a route"     onClick={() => onGo("plan")} />
        <HomeCard number="03" title="Set Routes"    text="Browse saved route templates, adjust included stops, and configure which days each route runs."       button="View saved routes" onClick={() => onGo("set")} />
      </section>

      <section className="info-strip">
        <div>
          <strong>Built for small teams</strong>
          <span>Simple planning without enterprise-level complexity or pricing.</span>
        </div>
        <div>
          <strong>AI-powered workflow</strong>
          <span>IBM Granite parses customer data and understands natural-language route instructions.</span>
        </div>
        <div>
          <strong>Save time and fuel</strong>
          <span>OR-Tools optimization compares hundreds of orderings to find the fastest route.</span>
        </div>
      </section>
    </div>
  );
}

function HomeCard({ number, title, text, button, onClick }) {
  return (
    <article className="home-card" onClick={onClick}>
      <div className="card-number">{number}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="card-button">{button} <span>→</span></div>
    </article>
  );
}

// ── Customers page ───────────────────────────────────────────────────────────

// ── Excel import field labels ─────────────────────────────────────────────────
const FIELD_OPTIONS = [
  { value: "name",    label: "Name" },
  { value: "address", label: "Address" },
  { value: "phone",   label: "Phone" },
  { value: "email",   label: "Email" },
  { value: "contact", label: "Contact Person" },
  { value: "",        label: "Ignore" },
];

function ExcelImport({ setCustomers, setToast }) {
  const [step, setStep]           = useState(1); // 1=upload, 2=mapping, 3=result
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Step 2 state
  const [columns, setColumns]   = useState([]);
  const [rows, setRows]         = useState([]);
  const [colMap, setColMap]     = useState({}); // { colIndex: fieldName }

  // Step 3 state
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState(null);
  const [importError, setImportError] = useState(null);

  const fileInputRef = useRef(null);

  // Convert colMap (colIndex -> field) into backend mapping shape (field -> colIndex)
  function buildMapping() {
    const m = { name: null, address: null, phone: null, email: null, contact: null };
    Object.entries(colMap).forEach(([colIdx, field]) => {
      if (field && field in m) m[field] = parseInt(colIdx, 10);
    });
    return m;
  }

  const mapping = buildMapping();
  const canImport = mapping.name !== null && mapping.address !== null;
  const rowCount = rows.filter((row) => {
    const n = mapping.name    !== null ? String(row[mapping.name]    || "").trim() : "";
    const a = mapping.address !== null ? String(row[mapping.address] || "").trim() : "";
    return n && a;
  }).length;

  async function handleFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls") && !name.endsWith(".csv")) {
      setUploadError("Please upload an Excel (.xlsx) or CSV (.csv) file");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const data = await importPreview(file);
      setColumns(data.columns);
      setRows(data.rows);
      // Build initial colMap from detected_mapping
      const initMap = {};
      Object.entries(data.detected_mapping).forEach(([field, idx]) => {
        if (idx !== null && idx !== undefined) initMap[idx] = field;
      });
      setColMap(initMap);
      setStep(2);
    } catch (err) {
      setUploadError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleConfirm() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await importConfirm(rows, mapping);
      setResult(res);
      setStep(3);
      if (res.inserted > 0) {
        // Refresh the customer list so imported rows appear immediately
        getCustomers().then(setCustomers).catch(() => {});
        setToast(`Import complete — ${res.inserted} customer${res.inserted !== 1 ? "s" : ""} added.`);
      }
    } catch (err) {
      setImportError(err.message || "Import failed. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep(1);
    setColumns([]);
    setRows([]);
    setColMap({});
    setResult(null);
    setUploadError(null);
    setImportError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ── Step 1: Drop zone ───────────────────────────────────────────────────────
  if (step === 1) return (
    <section className="content-card">
      <div className="import-steps">
        <div
          className={`drop-zone${dragOver ? " drag-over" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
        >
          {uploading ? (
            <span className="btn-spinner-wrap">
              <span className="spinner spinner-sm" />
              Uploading and analysing…
            </span>
          ) : (
            <>
              <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>↑</div>
              <strong>Drop your file here</strong>
              <div style={{ color: "var(--text-3)", marginTop: 4, fontSize: 13 }}>
                or click to browse — .xlsx, .xls, .csv supported
              </div>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => handleFile(e.target.files[0])}
          />
        </div>
        {uploadError && <div className="form-error">{uploadError}</div>}
      </div>
    </section>
  );

  // ── Step 2: Column mapping ──────────────────────────────────────────────────
  if (step === 2) return (
    <section className="content-card">
      <div className="import-steps">
        <div className="section-heading">
          <div>
            <h3>Map columns</h3>
            <p>Assign each column to the right field. Columns set to "Ignore" are skipped.</p>
          </div>
        </div>

        <div className="preview-table-wrap">
          <table className="preview-table">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th key={i}>
                    <select
                      className="col-map-select"
                      value={colMap[i] || ""}
                      onChange={(e) => setColMap((m) => ({ ...m, [i]: e.target.value }))}
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    <span style={{ color: "var(--text-3)", fontSize: 12 }}>{col}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!canImport && (
          <div className="form-error">Map at least Name and Address columns to continue</div>
        )}
        {importError && <div className="form-error">{importError}</div>}

        <div className="form-button-wrap" style={{ gap: 10 }}>
          <button className="secondary-link" onClick={reset}>← Choose different file</button>
          <button
            className="primary-button"
            disabled={!canImport || importing}
            onClick={handleConfirm}
          >
            {importing ? (
              <span className="btn-spinner-wrap">
                <span className="spinner spinner-sm" />
                Importing…
              </span>
            ) : `Import ${rowCount} row${rowCount !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </section>
  );

  // ── Step 3: Result ──────────────────────────────────────────────────────────
  if (step === 3 && result) return (
    <section className="content-card">
      <div className="import-steps">
        <div className="import-summary">
          ✓ {result.inserted} customer{result.inserted !== 1 ? "s" : ""} added instantly
          {result.skipped_duplicates > 0 && (
            <span className="summary-warn"> · {result.skipped_duplicates} duplicate{result.skipped_duplicates !== 1 ? "s" : ""} skipped</span>
          )}
          <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75, fontWeight: 400 }}>
            Address verification is running in the background — refresh the customer list in a moment to see verified badges.
          </div>
        </div>
        {result.errors?.length > 0 && (
          <div className="form-error">
            {result.errors.length} row{result.errors.length !== 1 ? "s" : ""} failed to insert.
          </div>
        )}
        <div className="form-button-wrap">
          <button className="primary-button" onClick={reset}>Import another file</button>
        </div>
      </div>
    </section>
  );

  return null;
}

// ── AI Sort ───────────────────────────────────────────────────────────────────

const CONFIDENCE_THRESHOLD = 0.7;

function AISort({ setCustomers, setToast }) {
  const [rawText, setRawText]       = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState(null);
  const [result, setResult]         = useState(null);  // { records, unreadable }

  // For "Needs review" section — editable copies of low-confidence records
  const [edited, setEdited]         = useState({});    // index → { name, address, phone, email, contact }
  const [selected, setSelected]     = useState({});    // index → bool (for ready records)
  const [committing, setCommitting] = useState(false);

  const readyRecords   = result?.records.filter((r) => r.confidence >= CONFIDENCE_THRESHOLD)  ?? [];
  const reviewRecords  = result?.records.filter((r) => r.confidence <  CONFIDENCE_THRESHOLD)  ?? [];
  const unreadable     = result?.unreadable ?? [];

  async function handleExtract() {
    if (!rawText.trim()) return;
    setExtracting(true);
    setExtractError(null);
    setResult(null);
    setEdited({});
    setSelected({});
    try {
      const data = await extractCustomers(rawText);
      setResult(data);
      // Pre-select all ready records
      const sel = {};
      (data.records || []).forEach((r, i) => { if (r.confidence >= CONFIDENCE_THRESHOLD) sel[i] = true; });
      setSelected(sel);
    } catch (err) {
      setExtractError(err.message || "Extraction failed. Try again or paste a smaller block of text.");
    } finally {
      setExtracting(false);
    }
  }

  function updateEdited(index, field, value) {
    setEdited((e) => ({ ...e, [index]: { ...(e[index] ?? reviewRecords[index - readyRecords.length] ?? {}), [field]: value } }));
  }

  // Resolve the address to commit for a ready record — respects the user's toggle choice
  function resolveReadyAddress(rec, i) {
    const useNormalized = edited[i]?._useNormalized ?? (rec.address_changed === true);
    return useNormalized ? (rec.address_normalized || rec.address) : rec.address;
  }

  async function commitRecords(resolvedRecords) {
    // resolvedRecords: [{name, address (already resolved), phone, email, contact}]
    setCommitting(true);
    let added = 0, failed = 0;
    for (const rec of resolvedRecords) {
      try {
        const created = await createCustomer({
          name:    rec.name,
          address: rec.address,
          contact: rec.contact || null,
          phone:   rec.phone   || null,
          email:   rec.email   || null,
        });
        setCustomers((c) => [created, ...c]);
        added++;
      } catch (err) {
        if (err.isDuplicate) {
          added++;
        } else {
          failed++;
        }
      }
    }
    setCommitting(false);
    if (added > 0)  setToast(`${added} customer${added !== 1 ? "s" : ""} added.`);
    if (failed > 0) setToast(`${failed} record${failed !== 1 ? "s" : ""} failed to save.`);
  }

  function commitAllReady() {
    const resolved = readyRecords.map((rec, i) => ({ ...rec, address: resolveReadyAddress(rec, i) }));
    commitRecords(resolved);
  }

  function commitSelectedReady() {
    const resolved = readyRecords
      .map((rec, i) => ({ ...rec, address: resolveReadyAddress(rec, i), _idx: i }))
      .filter((_, i) => selected[i]);
    commitRecords(resolved);
  }

  function commitReviewRecord(index) {
    const globalIdx = readyRecords.length + index;
    const base = reviewRecords[index];
    const cur  = edited[globalIdx] ?? base;
    // For review records, the address field is address_normalized (user may have edited it)
    commitRecords([{ ...cur, address: cur.address_normalized || cur.address }]);
  }

  function reset() {
    setRawText("");
    setResult(null);
    setEdited({});
    setSelected({});
    setExtractError(null);
  }

  return (
    <section className="content-card">
      {/* Attribution banner */}
      <div className="ai-attribution-banner">
        <span className="ai-tag">AI</span>
        AI extraction identifies names and contacts — addresses are separately verified against map data before routing.
        &nbsp;<strong>Powered by IBM Granite on watsonx.ai.</strong>
      </div>

      {!result ? (
        <>
          {/* Input area */}
          <div className="section-heading">
            <div>
              <h3>AI Sort</h3>
              <p>Paste any unstructured text containing customer info — forwarded emails, notes, messy spreadsheet copies.</p>
            </div>
          </div>

          <textarea
            className="ai-textarea"
            rows={10}
            placeholder="Paste customer records here — emails, notes, spreadsheet text, anything…"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            disabled={extracting}
          />

          {extractError && <div className="form-error" style={{ marginTop: 10 }}>{extractError}</div>}

          <div className="form-button-wrap" style={{ marginTop: 14 }}>
            <button
              className="primary-button"
              onClick={handleExtract}
              disabled={extracting || !rawText.trim()}
            >
              {extracting ? (
                <span className="btn-spinner-wrap">
                  <span className="spinner spinner-sm" />
                  Extracting with AI…
                </span>
              ) : "Extract with AI →"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* ── Ready to import ── */}
          {readyRecords.length > 0 && (
            <div className="ai-result-section">
              <div className="ai-result-header ai-ready-header">
                <div>
                  <strong>Ready to import</strong>
                  <span>{readyRecords.length} record{readyRecords.length !== 1 ? "s" : ""} — high confidence</span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="outline-button" onClick={commitSelectedReady} disabled={committing || !readyRecords.some((_, i) => selected[i])}>
                    Commit selected
                  </button>
                  <button className="primary-button" onClick={commitAllReady} disabled={committing}>
                    {committing ? (
                      <span className="btn-spinner-wrap"><span className="spinner spinner-sm" />Saving…</span>
                    ) : `Commit all (${readyRecords.length})`}
                  </button>
                </div>
              </div>
              <div className="customer-list">
                {readyRecords.map((rec, i) => {
                  // The address that will actually be committed — user can toggle between original and normalized
                  const useNormalized = edited[i]?._useNormalized ?? (rec.address_changed === true);
                  const displayAddress = useNormalized
                    ? (rec.address_normalized || rec.address)
                    : rec.address;
                  return (
                    <div className="customer-row ai-ready-row" key={i}>
                      <input
                        className="big-check"
                        type="checkbox"
                        checked={Boolean(selected[i])}
                        onChange={() => setSelected((s) => ({ ...s, [i]: !s[i] }))}
                      />
                      <div className="avatar">{(rec.name || "?").charAt(0)}</div>
                      <div className="customer-main">
                        <strong>{rec.name || <em style={{ opacity: 0.5 }}>No name</em>}</strong>
                        <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                          {displayAddress || <em style={{ opacity: 0.5 }}>No address</em>}
                          {rec.address_changed && (
                            <span className="address-toggle-row">
                              <span className="address-norm-badge">AI improved</span>
                              {rec.address_note && <span style={{ color: "var(--text-3)", fontSize: 11 }}>{rec.address_note}</span>}
                              <button
                                className="address-toggle-btn"
                                onClick={() => setEdited((e) => ({ ...e, [i]: { ...(e[i] || {}), _useNormalized: !useNormalized } }))}
                              >
                                {useNormalized ? `Use original: "${rec.address}"` : `Use improved: "${rec.address_normalized}"`}
                              </button>
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="customer-contact">
                        <span>{rec.phone   || "—"}</span>
                        <span>{rec.email   || "—"}</span>
                      </div>
                      <span className="ai-confidence-chip ai-confidence-high">
                        {Math.round(rec.confidence * 100)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Needs review ── */}
          {reviewRecords.length > 0 && (
            <div className="ai-result-section" style={{ marginTop: 20 }}>
              <div className="ai-result-header ai-review-header">
                <div>
                  <strong>Needs review</strong>
                  <span>{reviewRecords.length} record{reviewRecords.length !== 1 ? "s" : ""} — low confidence, edit before committing</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 10 }}>
                {reviewRecords.map((rec, i) => {
                  const globalIdx = readyRecords.length + i;
                  const cur = edited[globalIdx] ?? rec;
                  return (
                    <div className="ai-review-card" key={i}>
                      <div className="ai-review-card-header">
                        <span className="ai-confidence-chip ai-confidence-low">
                          {Math.round(rec.confidence * 100)}% confidence
                        </span>
                      </div>
                      <div className="customer-form" style={{ marginTop: 10 }}>
                        <label className="input-group">
                          Name
                          <input value={cur.name || ""} onChange={(e) => updateEdited(globalIdx, "name", e.target.value)} style={{ marginTop: 5 }} />
                        </label>
                        <label className="input-group">
                          Address
                          {/* Pre-populate with normalized address if available; user can edit freely */}
                          <input
                            value={cur.address_normalized || cur.address || ""}
                            onChange={(e) => updateEdited(globalIdx, "address_normalized", e.target.value)}
                            style={{ marginTop: 5 }}
                          />
                          {rec.address_changed && rec.address && (
                            <span style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4, display: "block" }}>
                              Original: "{rec.address}"
                              <button
                                className="address-toggle-btn"
                                style={{ marginLeft: 8 }}
                                onClick={() => updateEdited(globalIdx, "address_normalized", rec.address)}
                              >Revert</button>
                            </span>
                          )}
                        </label>
                        <label className="input-group">
                          Phone
                          <input value={cur.phone || ""} onChange={(e) => updateEdited(globalIdx, "phone", e.target.value)} style={{ marginTop: 5 }} />
                        </label>
                        <label className="input-group">
                          Email
                          <input value={cur.email || ""} onChange={(e) => updateEdited(globalIdx, "email", e.target.value)} style={{ marginTop: 5 }} />
                        </label>
                      </div>
                      <div className="form-button-wrap" style={{ marginTop: 10 }}>
                        <button
                          className="primary-button"
                          onClick={() => commitReviewRecord(i)}
                          disabled={committing || !cur.name || !cur.address}
                        >
                          Commit this record
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Could not read ── */}
          {unreadable.length > 0 && (
            <div className="ai-result-section" style={{ marginTop: 20 }}>
              <div className="ai-result-header">
                <div>
                  <strong>Could not read</strong>
                  <span>{unreadable.length} snippet{unreadable.length !== 1 ? "s" : ""} — copy manually if needed</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {unreadable.map((snippet, i) => (
                  <div className="ai-unreadable-snippet" key={i}>{snippet}</div>
                ))}
              </div>
            </div>
          )}

          {readyRecords.length === 0 && reviewRecords.length === 0 && (
            <div className="form-error" style={{ marginTop: 12 }}>
              No customer records could be extracted. Try pasting a different block of text.
            </div>
          )}

          <div className="form-button-wrap" style={{ marginTop: 20 }}>
            <button className="secondary-link" onClick={reset}>← Try different text</button>
          </div>
        </>
      )}
    </section>
  );
}

// ── Customers page ────────────────────────────────────────────────────────────

function CustomersPage({ customers, setCustomers, customersLoading, setToast }) {
  const [mode, setMode]         = useState("manual");
  const [form, setForm]         = useState({ name: "", contact: "", phone: "", address: "" });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Inline address editing for unverified rows
  const [editingAddressId, setEditingAddressId] = useState(null); // customer id being edited
  const [editingAddressValue, setEditingAddressValue] = useState("");
  const [savingAddressId, setSavingAddressId] = useState(null);

  function changeForm(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    setFormError(null);
  }

  async function addCustomer(e) {
    e.preventDefault();
    if (!form.name || !form.address) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const created = await createCustomer({
        name: form.name,
        address: form.address,
        contact: form.contact || null,
        phone: form.phone || null,
      });
      setCustomers((c) => [created, ...c]);
      setForm({ name: "", contact: "", phone: "", address: "" });
      setToast("Customer added successfully.");
    } catch (err) {
      if (err.isDuplicate) {
        const fields = err.fields?.join(", ") || "field";
        setFormError(`A customer with the same ${fields} already exists.`);
      } else {
        setFormError("Failed to add customer. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAddress(customer) {
    const newAddr = editingAddressValue.trim();
    if (!newAddr || newAddr === customer.address) { setEditingAddressId(null); return; }
    setSavingAddressId(customer.id);
    try {
      const updated = await updateCustomer(customer.id, { address: newAddr });
      setCustomers((c) => c.map((x) => x.id === customer.id ? updated : x));
      setToast("Address updated — re-verifying in background.");
    } catch {
      setToast("Failed to update address.");
    } finally {
      setSavingAddressId(null);
      setEditingAddressId(null);
    }
  }

  async function removeCustomer(id) {
    try {
      await deleteCustomer(id);
      setCustomers((c) => c.filter((x) => x.id !== id));
      setToast("Customer removed.");
    } catch {
      setToast("Failed to remove customer.");
    }
  }

  return (
    <div>
      <PageTitle eyebrow="Customer database" title="Customers" text="Keep the stops your business serves in one clean list." />

      <div className="tab-row">
        <button className={mode === "manual" ? "tab active" : "tab"} onClick={() => setMode("manual")}>Manual entry</button>
        <button className={mode === "import" ? "tab active" : "tab"} onClick={() => setMode("import")}>Excel / CSV</button>
        <button className={mode === "ai"     ? "tab active" : "tab"} onClick={() => setMode("ai")}>AI Sort</button>
      </div>

      {mode === "manual" && (
        <section className="content-card">
          <div className="section-heading">
            <div>
              <h3>Add a customer</h3>
              <p>Enter the basic information needed for a future route.</p>
            </div>
          </div>
          <form className="customer-form" onSubmit={addCustomer}>
            <Input label="Business / customer name" name="name"    value={form.name}    onChange={changeForm} />
            <Input label="Contact person"           name="contact" value={form.contact} onChange={changeForm} />
            <Input label="Phone"                    name="phone"   value={form.phone}   onChange={changeForm} />
            <Input label="Street address"           name="address" value={form.address} onChange={changeForm} />
            {formError && <div className="form-error">{formError}</div>}
            <div className="form-button-wrap">
              <button className="primary-button" type="submit" disabled={submitting}>
                {submitting ? (
                  <span className="btn-spinner-wrap">
                    <span className="spinner spinner-sm" />
                    Verifying address…
                  </span>
                ) : "+ Add customer"}
              </button>
            </div>
          </form>
        </section>
      )}

      {mode === "import" && (
        <ExcelImport setCustomers={setCustomers} setToast={setToast} />
      )}

      {mode === "ai" && (
        <AISort setCustomers={setCustomers} setToast={setToast} />
      )}

      <section className="customer-list-section">
        <div className="section-heading">
          <div>
            <h3>Saved customers</h3>
            <p>{customersLoading ? "Loading…" : `${customers.length} customer records`}</p>
          </div>
        </div>
        <div className="customer-list">
          {customersLoading && [0, 1, 2].map((i) => (
            <div key={i} className="skeleton-row" />
          ))}
          {!customersLoading && customers.map((c) => (
            <div className="customer-row" key={c.id}>
              <div className="avatar">{c.name.charAt(0)}</div>
              <div className="customer-main">
                <strong>{c.name}</strong>
                {editingAddressId === c.id ? (
                  /* ── Inline address editor ── */
                  <span className="inline-address-editor">
                    <input
                      className="inline-address-input"
                      value={editingAddressValue}
                      onChange={(e) => setEditingAddressValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveAddress(c);
                        if (e.key === "Escape") setEditingAddressId(null);
                      }}
                      autoFocus
                    />
                    <button
                      className="primary-button"
                      style={{ fontSize: 12, padding: "4px 10px" }}
                      onClick={() => saveAddress(c)}
                      disabled={savingAddressId === c.id}
                    >
                      {savingAddressId === c.id ? "Saving…" : "Save"}
                    </button>
                    <button
                      className="text-button"
                      style={{ fontSize: 12 }}
                      onClick={() => setEditingAddressId(null)}
                    >Cancel</button>
                  </span>
                ) : (
                  <span style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    {c.address}
                    {!c.verified && (
                      <>
                        <span
                          className="unverified-chip"
                          title="Address could not be confirmed — click to edit"
                          style={{ cursor: "pointer" }}
                          onClick={() => { setEditingAddressId(c.id); setEditingAddressValue(c.address); }}
                        >
                          Unverified — edit
                        </span>
                      </>
                    )}
                  </span>
                )}
              </div>
              <div className="customer-contact">
                <span>{c.contact || "No contact"}</span>
                <span>{c.phone   || "No phone"}</span>
              </div>
              <button className="danger-link" onClick={() => removeCustomer(c.id)}>Remove</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Plan routes page ─────────────────────────────────────────────────────────

// ── Plan routes page (full) ──────────────────────────────────────────────────

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY;

function PlanRoutesPage({ customers, preload, onPreloadConsumed, setToast, onGoToSet, onRouteOptimized }) {
  // ── Step state: 1=select, 2=personalize, 3=result ────────────────────────
  const [step, setStep]             = useState(1);

  // Step 1 state
  const [routeName, setRouteName]   = useState("Morning Route");
  const [depotAddress, setDepotAddress] = useState("");
  const [selected, setSelected]     = useState({});
  const [search, setSearch]         = useState("");

  // Step 2 state
  const [instruction, setInstruction] = useState("");
  const [personalizing, setPersonalizing] = useState(false);
  const [personalizeError, setPersonalizeError] = useState(null);

  // Step 3 state
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState(null);
  const [result, setResult]         = useState(null);
  const [agentReasoning, setAgentReasoning] = useState(null); // what the personalization agent parsed
  const [agentNotesDismissed, setAgentNotesDismissed] = useState(false);
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const [saving, setSaving]         = useState(false);
  const [startModalOpen, setStartModalOpen] = useState(false);

  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // Verified customers only for routing
  const verifiedCustomers = customers.filter((c) => c.verified);
  const selectedCustomers = verifiedCustomers.filter((c) => selected[c.id]);
  const filteredCustomers = verifiedCustomers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.address.toLowerCase().includes(search.toLowerCase())
  );

  // ── Consume preload from SetRoutesPage ────────────────────────────────────
  useEffect(() => {
    if (!preload) return;
    if (preload.customerIds?.length) {
      const sel = {};
      preload.customerIds.forEach((id) => { sel[id] = true; });
      setSelected(sel);
    }
    onPreloadConsumed();
  }, [preload]);

  function toggleCustomer(id) { setSelected((s) => ({ ...s, [id]: !s[id] })); }
  function selectAll()        { const a = {}; verifiedCustomers.forEach((c) => { a[c.id] = true; }); setSelected(a); }

  // ── Step 2: Personalize (optional) then optimize ─────────────────────────
  async function handleOptimize() {
    if (!depotAddress.trim()) { setPersonalizeError("Please enter a depot (starting) address."); return; }
    if (!selectedCustomers.length) { setPersonalizeError("Select at least one verified customer."); return; }

    setPersonalizing(true);
    setPersonalizeError(null);

    let constraints = { priority_stops: [], time_windows: [], agent_notes: null };

    if (instruction.trim()) {
      try {
        const personalized = await personalizeRoute({
          customers: selectedCustomers.map((c) => ({ id: c.id, name: c.name })),
          instruction: instruction.trim(),
        });
        constraints = { ...constraints, ...personalized };
        // Build human-readable reasoning summary for Feature 3 panel
        const reasoning = [];
        if (personalized.priority_stops?.length) {
          const names = personalized.priority_stops
            .map((id) => selectedCustomers.find((c) => c.id === id)?.name)
            .filter(Boolean);
          if (names.length) reasoning.push(`Priority stops identified: ${names.join(", ")}`);
        }
        if (personalized.time_windows?.length) {
          personalized.time_windows.forEach((tw) => {
            const name = selectedCustomers.find((c) => c.id === tw.customer_id)?.name;
            if (!name) return;
            const parts = [];
            if (tw.before) parts.push(`before ${tw.before}`);
            if (tw.after)  parts.push(`after ${tw.after}`);
            reasoning.push(`${name}: ${parts.join(" and ")}`);
          });
        }
        if (reasoning.length === 0 && !personalized.agent_notes) {
          reasoning.push("All constraints understood — no conflicts detected.");
        }
        setAgentReasoning(reasoning.length ? reasoning : null);
      } catch (err) {
        // Non-fatal: proceed without personalization, show warning
        setToast("AI personalization failed — optimizing without constraints.");
      }
    }

    setPersonalizing(false);
    setOptimizing(true);
    setOptimizeError(null);

    try {
      const res = await optimizeRoute({
        depot_address: depotAddress,
        customer_ids: selectedCustomers.map((c) => c.id),
        constraints: {
          priority_stops: constraints.priority_stops || [],
          time_windows:   constraints.time_windows   || [],
        },
      });
      setResult({ ...res, agent_notes: constraints.agent_notes });
      setAgentNotesDismissed(false);
      setReasoningExpanded(true);
      setStep(3);
      if (onRouteOptimized) onRouteOptimized();
    } catch (err) {
      setOptimizeError(err.message || "Optimization failed. Check your depot address and try again.");
    } finally {
      setOptimizing(false);
    }
  }

  // ── Google Maps rendering ─────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 3 || !result || !MAPS_KEY) return;

    // Build ordered customer list from result
    const ordered = result.optimized_order
      .map((id) => result.customers?.find((c) => c.id === id))
      .filter(Boolean);
    if (!ordered.length) return;

    const loadMap = () => {
      if (!mapRef.current || !window.google) return;
      const bounds = new window.google.maps.LatLngBounds();

      // We need coordinates — build from result.customers which have lat/lon from solver
      // Actually customers in result don't have lat/lon — fetch from our local customers list
      const coordMap = {};
      customers.forEach((c) => { if (c.lat && c.lon) coordMap[c.id] = { lat: c.lat, lng: c.lon }; });

      const map = new window.google.maps.Map(mapRef.current, {
        zoom: 12,
        mapTypeId: "roadmap",
        styles: [{ elementType: "geometry", stylers: [{ color: "#1a1a2e" }] },
                 { elementType: "labels.text.fill", stylers: [{ color: "#a0a0b0" }] }],
      });
      mapInstanceRef.current = map;

      const path = [];
      ordered.forEach((c, i) => {
        const coord = coordMap[c.id];
        if (!coord) return;
        path.push(coord);
        bounds.extend(coord);
        new window.google.maps.Marker({
          position: coord, map,
          label: { text: String(i + 1), color: "#fff", fontWeight: "bold", fontSize: "12px" },
          title: c.name,
        });
      });

      if (path.length > 1) {
        new window.google.maps.Polyline({
          path, map,
          strokeColor: "#22f060", strokeOpacity: 0.8, strokeWeight: 3,
        });
        map.fitBounds(bounds);
      }
    };

    if (window.google?.maps) {
      loadMap();
    } else {
      const scriptId = "gmaps-script";
      if (!document.getElementById(scriptId)) {
        const s = document.createElement("script");
        s.id = scriptId;
        s.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}`;
        s.async = true;
        s.onload = loadMap;
        document.head.appendChild(s);
      } else {
        document.getElementById(scriptId).addEventListener("load", loadMap);
      }
    }
  }, [step, result]);

  // ── Save route to DB ──────────────────────────────────────────────────────
  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      await createSetRoute({
        name: routeName,
        customer_ids: result.optimized_order,
        last_constraints: {
          priority_stops: result.priority_stops || [],
          time_windows:   result.time_windows   || [],
          agent_notes:    result.agent_notes    || null,
        },
      });
      setToast("Route saved!");
      onGoToSet();
    } catch (err) {
      setToast("Failed to save route.");
    } finally {
      setSaving(false);
    }
  }

  // ── Start route ───────────────────────────────────────────────────────────
  function handleStartRoute() {
    if (!result) return;
    const ordered = result.optimized_order
      .map((id) => result.customers?.find((c) => String(c.id) === String(id)))
      .filter(Boolean);
    const coordMap = {};
    customers.forEach((c) => { if (c.lat && c.lon) coordMap[c.id] = `${c.lat},${c.lon}`; });

    if (ordered.length <= 10) {
      const coords = ordered.map((c) => coordMap[c.id]).filter(Boolean);
      if (coords.length < 2) { setStartModalOpen(true); return; }
      const origin      = coords[0];
      const destination = coords[coords.length - 1];
      const waypoints   = coords.slice(1, -1).join("|");
      const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ""}&travelmode=driving`;
      window.open(url, "_blank");
    } else {
      setStartModalOpen(true);
    }
  }

  // ── Savings banner helpers ────────────────────────────────────────────────
  function fmtDuration(s) {
    const m = Math.round(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
  }
  function fmtDistance(m) {
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
  }

  const savedTime = result ? result.naive_duration_s - result.total_duration_s : 0;
  const savedDist = result ? result.naive_distance_m - result.total_distance_m : 0;

  const orderedResult = result
    ? result.optimized_order.map((id) => result.customers?.find((c) => String(c.id) === String(id))).filter(Boolean)
    : [];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      <PageTitle eyebrow="New route" title="Plan Routes" text="Pick your stops, add plain-English preferences, and get an AI-optimized route." />

      {/* ── Route stepper ── */}
      <div className="route-stepper">
        {["Select stops","Add preferences","Optimized route"].map((label, i) => (
          <div key={i} className={`stepper-step${step === i + 1 ? " stepper-active" : step > i + 1 ? " stepper-done" : ""}`}>
            <span className="stepper-num">{step > i + 1 ? "✓" : i + 1}</span>
            <span className="stepper-label">{label}</span>
          </div>
        ))}
      </div>

      {/* ─── Step 1: Select stops ─── */}
      {step === 1 && (
        <>
          <section className="route-toolbar content-card">
            <div style={{ flex: 1 }}>
              <label>Route name</label>
              <input value={routeName} onChange={(e) => setRouteName(e.target.value)} style={{ marginTop: 7 }} />
            </div>
            <div style={{ flex: 1 }}>
              <label>Depot / start address</label>
              <input
                value={depotAddress}
                onChange={(e) => setDepotAddress(e.target.value)}
                placeholder="e.g. 123 Main St, Toronto"
                style={{ marginTop: 7 }}
              />
            </div>
            <div className="route-counter">
              <strong>{selectedCustomers.length}</strong>
              <span>stops selected</span>
            </div>
          </section>

          <section className="content-card">
            <div className="section-heading">
              <div>
                <h3>Select customers</h3>
                <p>Only verified customers can be routed. <span style={{ color: "var(--text-3)" }}>Unverified addresses are greyed out.</span></p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 160, padding: "6px 10px", fontSize: 13 }}
                />
                <button className="outline-button" onClick={selectAll}>All</button>
              </div>
            </div>

            <div className="plan-list">
              {customers.length === 0 && (
                <div style={{ padding: "20px 0", color: "var(--text-3)", fontSize: 14 }}>
                  No customers yet — add some in the Customers tab first.
                </div>
              )}
              {filteredCustomers.map((c) => (
                <div className={selected[c.id] ? "plan-row selected" : "plan-row"} key={c.id}>
                  <input className="big-check" type="checkbox" checked={Boolean(selected[c.id])} onChange={() => toggleCustomer(c.id)} />
                  <div className="customer-main">
                    <strong>{c.name}</strong>
                    <span>{c.address}</span>
                  </div>
                </div>
              ))}
              {customers.filter((c) => !c.verified).map((c) => (
                <div className="plan-row" key={c.id} style={{ opacity: 0.4 }} title="Verify address first">
                  <input className="big-check" type="checkbox" disabled />
                  <div className="customer-main">
                    <strong>{c.name}</strong>
                    <span>{c.address} <span className="unverified-chip">Unverified</span></span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bottom-action-card">
            <div>
              <strong>{selectedCustomers.length} stop{selectedCustomers.length !== 1 ? "s" : ""} selected</strong>
              <span>Enter a depot address and select at least one customer to continue.</span>
            </div>
            <button
              className="primary-button"
              disabled={!selectedCustomers.length || !depotAddress.trim()}
              onClick={() => setStep(2)}
            >
              Next: Add preferences →
            </button>
          </section>
        </>
      )}

      {/* ─── Step 2: Personalization ─── */}
      {step === 2 && (
        <>
          <section className="content-card">
            <div className="section-heading">
              <div>
                <h3>Add routing preferences <span style={{ fontWeight: 400, fontSize: 13, opacity: 0.5 }}>(optional)</span></h3>
                <p>Describe in plain English how you'd like the route ordered. The AI will do its best and tell you clearly if something isn't possible.</p>
              </div>
            </div>
            <textarea
              className="ai-textarea"
              rows={5}
              placeholder={`e.g. "Get to ${selectedCustomers[0]?.name || 'the bakery'} first, ${selectedCustomers[1]?.name || 'the pharmacy'} needs to be before 3pm"`}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={personalizing || optimizing}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)" }}>
              Powered by IBM Granite on watsonx.ai · Leave blank to skip and optimize by distance only
            </div>
            {personalizeError && <div className="form-error" style={{ marginTop: 10 }}>{personalizeError}</div>}
            {optimizeError    && <div className="form-error" style={{ marginTop: 10 }}>{optimizeError}</div>}
          </section>

          <section className="bottom-action-card">
            <button className="secondary-link" onClick={() => setStep(1)}>← Back</button>
            <button
              className="primary-button"
              onClick={handleOptimize}
              disabled={personalizing || optimizing}
            >
              {personalizing ? (
                <span className="btn-spinner-wrap"><span className="spinner spinner-sm" />Asking AI…</span>
              ) : optimizing ? (
                <span className="btn-spinner-wrap"><span className="spinner spinner-sm" />Optimizing route…</span>
              ) : "Optimize route →"}
            </button>
          </section>
        </>
      )}

      {/* ─── Step 3: Result ─── */}
      {step === 3 && result && (
        <>
          {/* Agent notes card */}
          {result.agent_notes && !agentNotesDismissed && (
            <div className="agent-note-card">
              <div className="agent-note-label">AI Note</div>
              <p>{result.agent_notes}</p>
              <button className="text-button" onClick={() => setAgentNotesDismissed(true)}>Got it</button>
            </div>
          )}

          {/* Agent reasoning panel — Feature 3 */}
          {agentReasoning && instruction.trim() && (
            <div className="agent-reasoning-card">
              <div className="agent-reasoning-header" onClick={() => setReasoningExpanded((v) => !v)}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="agent-note-label" style={{ color: "#818cf8" }}>IBM Granite parsed your instruction</span>
                </div>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>{reasoningExpanded ? "▲ hide" : "▼ show"}</span>
              </div>
              {reasoningExpanded && (
                <ul className="agent-reasoning-list">
                  {agentReasoning.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Savings banner */}
          {savedTime > 0 && (
            <div className="savings-banner">
              🚀 This route saves <strong>~{fmtDuration(savedTime)}</strong> and <strong>{fmtDistance(savedDist)}</strong> vs. the original order
            </div>
          )}

          {/* Stop list */}
          <section className="content-card">
            <div className="section-heading">
              <div>
                <h3>Optimized stop order</h3>
                <p>{orderedResult.length} stops · {fmtDuration(result.total_duration_s)} · {fmtDistance(result.total_distance_m)}</p>
              </div>
            </div>
            <div className="optimized-stop-list">
              {orderedResult.map((c, i) => (
                <div className="optimized-stop-row" key={c.id}>
                  <span className="stop-num">{i + 1}</span>
                  <div className="customer-main">
                    <strong>{c.name}</strong>
                    <span>{c.address}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Map */}
          {MAPS_KEY && (
            <section className="content-card" style={{ padding: 0, overflow: "hidden" }}>
              <div ref={mapRef} style={{ width: "100%", height: 340 }} />
            </section>
          )}

          {/* Actions */}
          <section className="bottom-action-card">
            <div>
              <strong>{routeName}</strong>
              <span>Save this route or start navigating now.</span>
            </div>
            <div className="button-group">
              <button className="secondary-link" onClick={() => { setStep(1); setResult(null); }}>← Restart</button>
              <button className="outline-button" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : "Save route"}
              </button>
              <button className="primary-button" onClick={handleStartRoute}>Start route →</button>
            </div>
          </section>

          {/* Start route modal (>10 stops or no coords) */}
          {startModalOpen && (
            <div className="modal-overlay" onClick={() => setStartModalOpen(false)}>
              <div className="modal-card" onClick={(e) => e.stopPropagation()}>
                <h2>Your route</h2>
                <p className="muted">{orderedResult.length} stops — copy each address into your navigation app.</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16, maxHeight: 340, overflowY: "auto" }}>
                  {orderedResult.map((c, i) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span className="stop-num">{i + 1}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{c.address}</div>
                      </div>
                      <button
                        className="outline-button"
                        style={{ fontSize: 11, padding: "4px 10px" }}
                        onClick={() => navigator.clipboard.writeText(c.address)}
                      >Copy</button>
                    </div>
                  ))}
                </div>
                <div className="modal-actions">
                  <button className="primary-button" onClick={() => setStartModalOpen(false)}>Done</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Set routes page (DB-backed) ──────────────────────────────────────────────

function SetRoutesPage({ setToast, onLoadIntoRouting }) {
  const [routes, setRoutes]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [confirmDelete, setConfirmDelete] = useState(null); // route id pending delete

  useEffect(() => {
    getSetRoutes()
      .then(setRoutes)
      .catch(() => setToast("Failed to load saved routes."))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleActive(route) {
    try {
      const updated = await updateSetRoute(route.id, { active: !route.active });
      setRoutes((r) => r.map((rt) => rt.id === route.id ? updated : rt));
    } catch {
      setToast("Failed to update route.");
    }
  }

  async function handleToggleDay(route, day) {
    const current = recurrenceToDays(route.recurrence);
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day];
    const recurrence = next.length ? `weekly:${next.map((d) => d.toLowerCase()).join(",")}` : null;
    try {
      const updated = await updateSetRoute(route.id, { recurrence });
      setRoutes((r) => r.map((rt) => rt.id === route.id ? updated : rt));
    } catch {
      setToast("Failed to update days.");
    }
  }

  async function handleDelete(routeId) {
    try {
      await deleteSetRoute(routeId);
      setRoutes((r) => r.filter((rt) => rt.id !== routeId));
      setToast("Route deleted.");
    } catch {
      setToast("Failed to delete route.");
    } finally {
      setConfirmDelete(null);
    }
  }

  function recurrenceToDays(recurrence) {
    if (!recurrence) return [];
    const part = recurrence.split(":")[1] || "";
    return part.split(",").map((d) => d.charAt(0).toUpperCase() + d.slice(1)).filter(Boolean);
  }

  function constraintsSummary(lc) {
    if (!lc) return null;
    const parts = [];
    if (lc.priority_stops?.length) parts.push(`Priority: ${lc.priority_stops.length} stop${lc.priority_stops.length !== 1 ? "s" : ""}`);
    if (lc.time_windows?.length)   parts.push(`${lc.time_windows.length} time window${lc.time_windows.length !== 1 ? "s" : ""}`);
    return parts.length ? parts.join(" · ") : null;
  }

  return (
    <div>
      <PageTitle eyebrow="Saved plans" title="Set Routes" text="Review saved routes, adjust schedules, and load them straight into routing." />

      {loading && [0, 1].map((i) => <div key={i} className="skeleton-row" style={{ marginBottom: 12, height: 90 }} />)}

      {!loading && routes.length === 0 && (
        <section className="empty-card">
          <div className="empty-icon">↗</div>
          <h3>No saved routes yet</h3>
          <p>Build and save a route in Plan Routes to see it here.</p>
        </section>
      )}

      {!loading && routes.length > 0 && (
        <div className="saved-route-list">
          {routes.map((route) => {
            const days    = recurrenceToDays(route.recurrence);
            const summary = constraintsSummary(route.last_constraints);
            return (
              <article className="saved-route-card" key={route.id}>
                <div className="saved-route-header">
                  <div>
                    <span className={route.active ? "status active-status" : "status"}>
                      {route.active ? "Active" : "Paused"}
                    </span>
                    <h3>{route.name}</h3>
                    <p>
                      {route.customer_ids.length} stop{route.customer_ids.length !== 1 ? "s" : ""}
                      {summary && <> · <span style={{ color: "var(--text-3)" }}>{summary}</span></>}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button className="outline-button" onClick={() => onLoadIntoRouting(route.customer_ids, route.last_constraints)}>
                      Load into routing
                    </button>
                    <button className="outline-button" onClick={() => handleToggleActive(route)}>
                      {route.active ? "Pause" : "Activate"}
                    </button>
                    {confirmDelete === route.id ? (
                      <>
                        <button className="danger-link" onClick={() => handleDelete(route.id)}>Confirm delete</button>
                        <button className="text-button" onClick={() => setConfirmDelete(null)}>Cancel</button>
                      </>
                    ) : (
                      <button className="danger-link" onClick={() => setConfirmDelete(route.id)}>Delete</button>
                    )}
                  </div>
                </div>

                <div className="day-row">
                  {["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map((day) => (
                    <button
                      key={day}
                      className={days.includes(day) ? "day-button selected-day" : "day-button"}
                      onClick={() => handleToggleDay(route, day)}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function PageTitle({ eyebrow, title, text }) {
  return (
    <section className="page-title">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{text}</p>
    </section>
  );
}

function Input({ label, name, value, onChange }) {
  return (
    <label className="input-group">
      {label}
      <input name={name} value={value} onChange={onChange} style={{ marginTop: 7 }} />
    </label>
  );
}

export default App;
