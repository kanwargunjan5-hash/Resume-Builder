// src/LandingPage.js
import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "./AuthContext";
import "./LandingPage.css";

// ─── PARTICLE SYSTEM ──────────────────────────────────────────────────────────
function useParticles(canvasRef) {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let animId;
    let particles = [];
    const isMobile = window.innerWidth < 768;
    const PARTICLE_COUNT = isMobile ? 25 : 70;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    class Particle {
      constructor() { this.reset(); }
      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.vx = (Math.random() - 0.5) * 0.3;
        this.vy = -Math.random() * 0.4 - 0.1;
        this.radius = Math.random() * 1.8 + 0.5;
        this.opacity = Math.random() * 0.5 + 0.2;
        this.hue = Math.random() > 0.5 ? 190 : 270; // blue or purple
      }
      update() {
        this.x += this.vx;
        this.y += this.vy;
        if (this.y < -10 || this.x < -10 || this.x > canvas.width + 10) this.reset();
        if (this.y < -10) { this.y = canvas.height + 10; }
      }
      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 65%, ${this.opacity})`;
        ctx.fill();
      }
    }

    for (let i = 0; i < PARTICLE_COUNT; i++) particles.push(new Particle());

    function drawConnections(ctx, particles) {
      const maxDist = isMobile ? 100 : 140;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(0, 212, 255, ${0.08 * (1 - dist / maxDist)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    }

    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => { p.update(); p.draw(ctx); });
      if (!isMobile) drawConnections(ctx, particles);
      animId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [canvasRef]);
}

// ─── TYPEWRITER HOOK ──────────────────────────────────────────────────────────
function useTypewriter(text, speed = 55, startDelay = 800) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let timeout;
    let i = 0;
    setDisplayed("");
    setDone(false);

    timeout = setTimeout(() => {
      const interval = setInterval(() => {
        i++;
        setDisplayed(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(interval);
          setDone(true);
        }
      }, speed);
      return () => clearInterval(interval);
    }, startDelay);

    return () => clearTimeout(timeout);
  }, [text, speed, startDelay]);

  return { displayed, done };
}

// ─── SCROLL REVEAL HOOK ──────────────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

// ─── HERO SECTION ─────────────────────────────────────────────────────────────
function HeroSection({ onGetStarted }) {
  const canvasRef = useRef(null);
  const [mousePos, setMousePos] = useState({ x: -500, y: -500 });
  const [cursorVisible, setCursorVisible] = useState(false);
  const [cardsIdle, setCardsIdle] = useState(false);
  const { displayed, done } = useTypewriter("Build Resumes That Get You Hired", 50, 600);

  useParticles(canvasRef);

  // Start idle floating after cards animate in
  useEffect(() => {
    const timer = setTimeout(() => setCardsIdle(true), 3200);
    return () => clearTimeout(timer);
  }, []);

  // Mouse tracking
  const handleMouseMove = useCallback((e) => {
    setMousePos({ x: e.clientX, y: e.clientY });
    if (!cursorVisible) setCursorVisible(true);
  }, [cursorVisible]);

  const handleMouseLeave = useCallback(() => {
    setCursorVisible(false);
  }, []);

  // CTA ripple
  const handleCtaClick = useCallback((e) => {
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.left = `${e.clientX - rect.left}px`;
    ripple.style.top = `${e.clientY - rect.top}px`;
    ripple.style.width = ripple.style.height = `${Math.max(rect.width, rect.height) * 0.5}px`;
    btn.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
    onGetStarted();
  }, [onGetStarted]);

  return (
    <section
      className="hero-section"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Particle canvas */}
      <canvas ref={canvasRef} className="particle-canvas" />

      {/* Gradient mesh */}
      <div className="hero-gradient-mesh" />
      <div className="hero-orb" />

      {/* Grid lines */}
      <div className="grid-lines" />

      {/* Mouse follow light */}
      <div
        className="mouse-light"
        style={{ left: mousePos.x, top: mousePos.y }}
      />

      {/* Custom cursor */}
      <div
        className={`cursor-glow ${cursorVisible ? "" : "hidden"}`}
        style={{ left: mousePos.x, top: mousePos.y }}
      />

      {/* Floating cards */}
      <div className="floating-cards">
        {[
          { icon: "📄", label: "Templates" },
          { icon: "✨", label: "AI Writing" },
          { icon: "🎨", label: "Customizable" },
          { icon: "⚡", label: "Export PDF" },
        ].map((card, i) => (
          <div
            key={i}
            className={`float-card ${cardsIdle ? `idle-${i + 1}` : ""}`}
          >
            <span className="fc-icon">{card.icon}</span>
            <span className="fc-label">{card.label}</span>
          </div>
        ))}
      </div>

      {/* Hero content */}
      <div className="hero-content">
        <div className="hero-logo">
          <span className="logo-text">Resume</span>
          <span className="logo-dot">·</span>
          <span className="logo-text">Craft</span>
        </div>

        <h1 className="hero-headline">
          <span className="typed-text">{displayed}</span>
          {!done && <span className="cursor-blink" />}
        </h1>

        <p className="hero-subheading">
          Craft stunning, professional resumes in minutes — powered by AI,
          designed to impress recruiters and land interviews.
        </p>

        <button className="hero-cta" onClick={handleCtaClick}>
          Get Started <span className="cta-arrow">→</span>
        </button>
      </div>

      {/* Scroll indicator */}
      <div className="scroll-indicator">
        <span>Scroll</span>
        <div className="scroll-chevron" />
      </div>
    </section>
  );
}

// ─── AUTH SECTION ─────────────────────────────────────────────────────────────
function AuthSectionComponent() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Scroll reveals
  const leftReveal = useScrollReveal();
  const rightReveal = useScrollReveal();

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (mode === "register") await register(name, email, pass);
      else await login(email, pass);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
  };

  return (
    <section className="auth-section" id="auth-section">
      {/* Grid lines background */}
      <div className="grid-lines" />

      {/* Left side — illustration */}
      <div
        className={`auth-left scroll-reveal ${leftReveal.visible ? "visible" : ""}`}
        ref={leftReveal.ref}
      >
        <div className="blob-glow" />
        <div className="gradient-blob" />
        <div className="auth-left-content">
          <h3>Your Career Starts Here</h3>
          <p>
            Join thousands of professionals building resumes that stand out. AI-powered, beautifully designed, and ready in minutes.
          </p>
          <div className="feature-pills">
            <div className="feature-pill">
              <span className="pill-icon">🤖</span> AI Assistant
            </div>
            <div className="feature-pill">
              <span className="pill-icon">🎯</span> ATS Optimized
            </div>
            <div className="feature-pill">
              <span className="pill-icon">📱</span> Responsive
            </div>
            <div className="feature-pill">
              <span className="pill-icon">🔒</span> Secure
            </div>
          </div>
        </div>
      </div>

      {/* Right side — auth form */}
      <div
        className={`auth-right scroll-reveal delay-2 ${rightReveal.visible ? "visible" : ""}`}
        ref={rightReveal.ref}
      >
        <div className="lp-auth-card">
          <div className="card-title">
            {mode === "login" ? "Welcome Back" : "Create Account"}
          </div>
          <div className="card-subtitle">
            {mode === "login"
              ? "Sign in to continue building your resume"
              : "Start building your professional resume today"}
          </div>

          {/* Toggle */}
          <div className="auth-toggle">
            <div
              className={`auth-toggle-slider ${mode === "login" ? "left" : "right"}`}
            />
            <button
              className={`auth-toggle-btn ${mode === "login" ? "active" : ""}`}
              onClick={() => switchMode("login")}
              type="button"
            >
              Sign In
            </button>
            <button
              className={`auth-toggle-btn ${mode === "register" ? "active" : ""}`}
              onClick={() => switchMode("register")}
              type="button"
            >
              Sign Up
            </button>
          </div>

          <form className="lp-form" onSubmit={submit}>
            {mode === "register" && (
              <div className="lp-field" key="name-field">
                <input
                  id="lp-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder=" "
                  required
                  autoFocus
                />
                <label htmlFor="lp-name">Full Name</label>
              </div>
            )}

            <div className="lp-field" key="email-field">
              <input
                id="lp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder=" "
                required
                autoFocus={mode === "login"}
              />
              <label htmlFor="lp-email">Email Address</label>
            </div>

            <div className="lp-field" key="pass-field">
              <input
                id="lp-pass"
                type="password"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder=" "
                required
              />
              <label htmlFor="lp-pass">Password</label>
            </div>

            {error && (
              <div className="lp-error">
                <span>⚠</span> {error}
              </div>
            )}

            <button className="lp-submit" type="submit" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "login"
                ? "Sign In"
                : "Create Account"}
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}

// ─── LANDING PAGE (main export) ───────────────────────────────────────────────
export default function LandingPage() {
  const handleGetStarted = useCallback(() => {
    const section = document.getElementById("auth-section");
    if (section) {
      section.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <div className="landing-page">
      <HeroSection onGetStarted={handleGetStarted} />
      <AuthSectionComponent />
    </div>
  );
}
