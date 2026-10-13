"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  addReportComment,
  ApiError,
  ApiNotification,
  ApiRoom,
  ApiReport,
  ApiUser,
  clearToken,
  createReport,
  forgotPassword,
  getNotifications,
  getRooms,
  getReports,
  getUsers,
  login,
  markNotificationRead,
  resetPassword,
  signup,
  updateReportStatus,
} from "../lib/api";
import {
  AuthMode,
  Badge,
  BrandMark,
  CountUp,
  Icon,
  IconName,
  LiveProgress,
  ModernSelect,
  Reveal,
  Role,
  Status,
  statusLabel,
} from "../lib/ui-helpers";
gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Report = {
  id: string;
  title: string;
  room: string;
  reporter: string;
  dept: string;
  createdDate: string;
  building: string;
  priority: "low" | "medium" | "high" | "critical";
  status: Status;
  created: string;
  createdAt: number;
  tech: string;
  description: string;
  reporterSchoolId: string;
  reporterEmail: string;
  photoUrl: string | null;
  comments: Array<{ id: number; message: string; created_at: string; author?: ApiUser }>;
  feedback: { rating: number; comment: string | null; created_at: string } | null;
};

const collegeDepartments = ["CITE", "CAS", "CAHS", "CELA", "CEA", "CMA", "CHTM", "CCJE", "SHS"] as const;
const reportBuildings = [
  "CMA BUILDING",
  "PTC BUILDING",
  "RIVER SIDE BUILDING",
  "MDA HALL BUILDING",
  "BASIC ED BUILDING",
  "CHS BUILDING",
  "NORTH HALL BUILDING",
  "ITS CSDL BUILDING",
  "GYM",
] as const;
const buildingFloors: Record<string, number> = {
  "CMA BUILDING": 4,
  "BASIC ED BUILDING": 4,
  "PTC BUILDING": 4,
  "MDA HALL BUILDING": 5,
  "MBA HALL BUILDING": 5,
  "CHS BUILDING": 4,
  "NORTH HALL BUILDING": 4,
  "RIVER SIDE BUILDING": 8,
  "ITS CSDL BUILDING": 2,
  GYM: 1,
};

function getBuildingFloorCount(building: string) {
  if (building === "RIVER SIDE BUILDING") return 8;
  if (building === "MDA HALL BUILDING" || building === "MBA HALL BUILDING") return 5;
  if (building === "ITS CSDL BUILDING") return 2;
  if (building === "GYM") return 1;
  return 4;
}

function mapApiReport(report: ApiReport): Report {
  const status: Status =
    report.status === "under_review"
      ? "review"
      : report.status === "in_progress"
        ? "progress"
        : report.status;
  return {
    id: `FX-${String(report.id).padStart(4, "0")}`,
    title: report.item_name || report.category || "Facility issue",
    room: report.room?.name || "Unknown room",
    building: report.room?.building || "Unknown building",
    reporter: report.reporter?.name || report.reporter_email_snapshot,
    reporterSchoolId: report.reporter_school_id_snapshot,
    reporterEmail: report.reporter?.email || report.reporter_email_snapshot,
    photoUrl: report.photo_url ?? null,
    dept: report.room?.department || "General",
    createdDate: report.created_at.slice(0, 10),
    priority: report.priority,
    status,
    created: new Date(report.created_at).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }),
    createdAt: new Date(report.created_at).getTime(),
    tech: "Reports waiting for action",
    description: report.description,
    comments: report.comments ?? [],
    feedback: report.feedback ?? null,
  };
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function ThemeToggle({ dark, setDark }: { dark: boolean; setDark: (value: boolean) => void }) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const dragging = useRef(false);
  const finishDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragY > 16) setDark(true);
    if (dragY < -16) setDark(false);
    setDragY(0);
    startY.current = null;
  };
  return (
    <div
      className={`theme-float ${dark ? "is-dark" : ""}`}
      style={{ "--drag-y": `${dragY}px` } as React.CSSProperties}
    >
      <span className="theme-float-label">{dark ? "Dark mood" : "Light mood"}</span>
      <button
        className="theme-orbit"
        type="button"
        aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
        onClick={() => setDark(!dark)}
        onPointerDown={(event) => {
          dragging.current = true;
          startY.current = event.clientY;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging.current && startY.current !== null) {
            setDragY(Math.max(-42, Math.min(42, event.clientY - startY.current)));
          }
        }}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <span className="theme-orbit-ring" />
        <span className="theme-object">
          <span className="theme-crater crater-one" />
          <span className="theme-crater crater-two" />
        </span>
        <span className="theme-rays" />
      </button>
      <span className="theme-float-hint">
        drag {dark ? "up for light" : "down for dark"}
      </span>
    </div>
  );
}

function SignInLoader({ role }: { role: Role }) {
  const loaderRef = useRef<HTMLDivElement>(null);
  useIsomorphicLayoutEffect(() => {
    const root = loaderRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduceMotion) {
        gsap.set(".signin-loader-logo", { autoAlpha: 1, scale: 1 });
        gsap.set(".signin-loader-copy", { autoAlpha: 1, y: 0 });
        return;
      }
      const timeline = gsap.timeline();
      timeline
        .fromTo(
          ".signin-loader-logo",
          { autoAlpha: 0, scale: 0.55, rotationY: -45, rotationX: 20 },
          { autoAlpha: 1, scale: 1, rotationY: 0, rotationX: 0, duration: 0.8, ease: "back.out(1.7)" }
        )
        .to(".signin-loader-logo", { rotationY: 360, rotationX: 8, duration: 1.35, ease: "power2.inOut" }, "-=0.2")
        .fromTo(
          ".signin-loader-copy",
          { autoAlpha: 0, y: 12 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" },
          "-=0.65"
        )
        .to(".signin-loader-ring", { rotation: 360, duration: 1.8, repeat: -1, ease: "none" }, 0);
    }, root);
    return () => ctx.revert();
  }, []);
  return (
    <div ref={loaderRef} className="signin-loader" role="status" aria-live="polite">
      <div className="signin-loader-backdrop" />
      <div className="signin-loader-content">
        <div className="signin-loader-logo" aria-hidden="true">
          <span className="signin-loader-ring" />
          <span className="signin-loader-face signin-loader-face-back">
            <BrandMark size={68} />
          </span>
          <span className="signin-loader-face signin-loader-face-front">
            <BrandMark size={68} />
          </span>
        </div>
        <div className="signin-loader-copy">
          <strong>Welcome to Fixko</strong>
          <span>Preparing your {role === "admin" ? "admin" : "user"} account...</span>
          <i><b /></i>
        </div>
      </div>
    </div>
  );
}

function AuthModal({
  role,
  initialMode,
  onClose,
  onEnter,
}: {
  role: Role;
  initialMode?: AuthMode;
  onClose: () => void;
  onEnter: (role: Role) => Promise<void>;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode ?? "signin");
  const [authRole, setAuthRole] = useState<Role>(role === "admin" ? "user" : role);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(role === "admin" ? "admin@fixko.test" : "");
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const authTabs: AuthMode[] = role === "admin" ? ["signin"] : ["signin", "signup"];

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, []);

  useEffect(() => {
    if (initialMode !== "reset") return;
    const params = new URLSearchParams(window.location.search);
    setResetToken(params.get("token") ?? "");
    setEmail(params.get("email") ?? "");
  }, [initialMode]);

  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        await forgotPassword(email);
        setNotice("If an account exists for that email, a password reset link has been sent.");
        setSubmitting(false);
        return;
      }
      if (mode === "reset") {
        await resetPassword({
          token: resetToken,
          email,
          password,
          password_confirmation: passwordConfirmation,
        });
        setMode("signin");
        setPassword("");
        setPasswordConfirmation("");
        setNotice("Your password has been reset. You can now sign in.");
        setSubmitting(false);
        return;
      }
      const response =
        mode === "signin"
          ? await login(email, password)
          : await signup({
              name,
              email,
              school_id: schoolId,
              password,
              password_confirmation: passwordConfirmation,
              role: "user",
            });
      if (!response.token) throw new Error("No access token was returned.");
      window.localStorage.setItem("fixko-token", response.token);
      if (response.user) window.localStorage.setItem("fixko-user", JSON.stringify(response.user));
      await onEnter(response.user.role === "admin" ? "admin" : "user");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Authentication failed.";
      const isInvalidLogin =
        mode === "signin" && requestError instanceof ApiError && requestError.status === 422;
      const requestId =
        !isInvalidLogin && requestError instanceof ApiError && requestError.requestId
          ? ` Reference: ${requestError.requestId}`
          : "";
      setError(`${message}${requestId}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-7">
        <div className="mb-6 flex items-start justify-between">
          <div>
            {mode === "signup" && (
              <span className="eyebrow">
                {role === "admin" ? "STAFF & ADMIN PORTAL" : "GET STARTED"}
              </span>
            )}
            <h2 className="mt-3 text-2xl font-extrabold">
              {mode === "signin"
                ? "Welcome back"
                : mode === "signup"
                  ? "Create your account"
                  : mode === "forgot"
                    ? "Reset your password"
                    : "Choose a new password"}
            </h2>
          </div>
          <button className="text-xl text-slate-400" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {(mode === "signin" || mode === "signup") && (
          <div
            className={`mb-5 grid border-b border-slate-200 ${
              role === "admin" ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {authTabs.map((item) => (
              <button
                key={item}
                onClick={() => {
                  setMode(item);
                  setError("");
                  setNotice("");
                }}
                className={`border-b-2 py-3 text-sm font-bold ${
                  mode === item ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"
                }`}
              >
                {item === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-4">
          {mode === "signup" && (
            <label className="block text-sm font-bold">
              Full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3"
                required
              />
            </label>
          )}
          <label className="block text-sm font-bold">
            {role === "admin" ? "Admin username or email" : "School email"}
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500"
              placeholder={role === "admin" ? "admin@school.edu.ph" : "you@school.edu.ph"}
              required
            />
          </label>
          {mode === "signup" && role !== "admin" && (
            <label className="block text-sm font-bold">
              School ID
              <input
                value={schoolId}
                onChange={(event) => setSchoolId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3"
                placeholder="2026-00001"
                required
              />
            </label>
          )}
          {mode !== "forgot" && (
            <label className="block text-sm font-bold">
              <span>Password</span>
              <div className="relative mt-2">
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  className="w-full rounded-lg border border-slate-200 px-3 py-3 pr-11 outline-none focus:border-indigo-500"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
              {(mode === "signup" || mode === "reset") && (
                <p className="mt-2 text-xs font-medium text-slate-500">
                  Use at least 8 characters with uppercase and lowercase letters, a number, and a
                  symbol.
                </p>
              )}
            </label>
          )}
          {(mode === "signup" || mode === "reset") && (
            <label className="block text-sm font-bold">
              <span>Confirm password</span>
              <div className="relative mt-2">
                <input
                  value={passwordConfirmation}
                  onChange={(event) => setPasswordConfirmation(event.target.value)}
                  type={showPasswordConfirmation ? "text" : "password"}
                  className="w-full rounded-lg border border-slate-200 px-3 py-3 pr-11 outline-none focus:border-indigo-500"
                  required
                />
                <button
                  type="button"
                  aria-label={
                    showPasswordConfirmation ? "Hide password confirmation" : "Show password confirmation"
                  }
                  onClick={() => setShowPasswordConfirmation((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
                >
                  <Icon name={showPasswordConfirmation ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
            </label>
          )}
          {notice && (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {notice}
            </p>
          )}
          {error && (
            <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          <button
            className="btn-primary w-full"
            type="button"
            disabled={submitting}
            onClick={submit}
          >
            {submitting
              ? "Please wait..."
              : mode === "signin"
                ? "Sign in"
                : mode === "signup"
                  ? "Create account"
                  : mode === "forgot"
                    ? "Send reset link"
                    : "Reset password"}{" "}
            →
          </button>
          {(mode === "signin" || mode === "forgot") && (
            <button
              type="button"
              className="w-full text-sm font-bold text-indigo-600"
              onClick={() => {
                setMode(mode === "signin" ? "forgot" : "signin");
                setError("");
                setNotice("");
              }}
            >
              {mode === "signin" ? "Forgot your password?" : "Back to sign in"}
            </button>
          )}
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">
          {role === "admin"
            ? "Admin accounts are pre-built by the school."
            : "School email and ID are checked before access is granted."}
        </p>
      </div>
    </div>
  );
}

function Landing({ onAuth }: { onAuth: (role: Role, mode?: AuthMode) => void }) {
  const [step, setStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("pulse");
  const statusBoardRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const steps = ["Report the issue", "It reaches the right people", "Track it in real time", "Resolve & rate it"];
  useIsomorphicLayoutEffect(() => {
    if (!statusBoardRef.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const tween = gsap.to(statusBoardRef.current, {
      y: -6,
      rotateZ: -0.25,
      duration: 4.8,
      ease: "sine.inOut",
      repeat: -1,
      yoyo: true
    });
    return () => {
      tween.kill();
    };
  }, []);
  useIsomorphicLayoutEffect(() => {
    const root = landingRef.current;
    const nav = navRef.current;
    if (!root || !nav) return;
    const reduceMotionPreference = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const media = gsap.matchMedia();
    const ctx = gsap.context(() => {
      media.add({
        desktop: "(min-width: 900px)",
        reduceMotion: "(prefers-reduced-motion: reduce)"
      }, (conditions) => {
        const { desktop, reduceMotion } = conditions.conditions as { desktop: boolean; reduceMotion: boolean };
        if (!reduceMotion) {
          gsap.to(".hero-grid-glow", { xPercent: 8, yPercent: -4, duration: 9, ease: "sine.inOut", repeat: -1, yoyo: true });
          gsap.to(".animated-gradient-text", {
            backgroundPosition: "100% 50%",
            filter: "saturate(1.25)",
            ease: "none",
            scrollTrigger: {
              trigger: ".hero-section",
              start: "top top",
              end: "bottom top",
              scrub: 1.2
            }
          });
        }
        if (desktop && !reduceMotion) {
          gsap.to(".hero-parallax", {
            yPercent: -18,
            rotationZ: -2,
            scale: 1.06,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 1 }
          });
          gsap.to(".hero-orb.orb-indigo", {
            xPercent: 16,
            yPercent: -30,
            rotation: 28,
            scale: 1.2,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top bottom", end: "bottom top", scrub: 1.2 }
          });
          gsap.to(".hero-orb.orb-teal", {
            xPercent: -26,
            yPercent: 22,
            rotation: -35,
            scale: .82,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top bottom", end: "bottom top", scrub: 1.4 }
          });
          gsap.to(".hero-copy", {
            y: -32,
            rotationX: 2,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top top", end: "bottom top", scrub: 1.15 }
          });
          gsap.to(".depth-grid", {
            yPercent: 26,
            rotationX: 58,
            rotationZ: -4,
            scale: 1.18,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top bottom", end: "bottom top", scrub: 1.4 }
          });
          gsap.to(".depth-plane-one", {
            xPercent: -12,
            yPercent: -20,
            rotation: -8,
            scale: 1.12,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top bottom", end: "bottom top", scrub: 1.1 }
          });
          gsap.to(".depth-plane-two", {
            xPercent: 14,
            yPercent: 18,
            rotation: 10,
            scale: .9,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top bottom", end: "bottom top", scrub: 1.8 }
          });
          gsap.to(".depth-orb-one", {
            xPercent: -28,
            yPercent: -34,
            scale: 1.28,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top bottom", end: "bottom top", scrub: 1.2 }
          });
          gsap.to(".depth-orb-two", {
            xPercent: 30,
            yPercent: 24,
            scale: .78,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top bottom", end: "bottom top", scrub: 1.7 }
          });
          gsap.to(".depth-orb-three", {
            xPercent: 18,
            yPercent: -26,
            rotation: 90,
            ease: "none",
            scrollTrigger: { trigger: ".hero-section", start: "top bottom", end: "bottom top", scrub: 2 }
          });
          gsap.to(".global-depth-orb-one", {
            yPercent: -34,
            xPercent: 16,
            rotation: 80,
            ease: "none",
            scrollTrigger: { trigger: root, start: "top top", end: "max", scrub: 2.4 }
          });
          gsap.to(".global-depth-orb-two", {
            yPercent: 42,
            xPercent: -20,
            rotation: -65,
            ease: "none",
            scrollTrigger: { trigger: root, start: "top top", end: "max", scrub: 3 }
          });
          gsap.to(".global-depth-orbit", {
            rotation: 120,
            yPercent: -18,
            ease: "none",
            scrollTrigger: { trigger: root, start: "top top", end: "max", scrub: 4 }
          });
        }
        return () => undefined;
      });
      ScrollTrigger.create({
        trigger: root,
        start: "top -12",
        end: "max",
        onToggle: (self) => nav.classList.toggle("nav-scrolled", self.isActive)
      });
      ["pulse", "features", "how", "roles", "verification", "faq"].forEach((sectionId) => {
        ScrollTrigger.create({
          trigger: `#${sectionId}`,
          start: "top 42%",
          end: "bottom 42%",
          onToggle: (self) => {
            if (self.isActive) setActiveNav(sectionId);
          }
        });
      });
      if (!reduceMotionPreference()) {
        gsap.to(".nav-live-orb", { y: -4, x: 3, rotation: 180, duration: 3.6, ease: "sine.inOut", repeat: -1, yoyo: true });
      }
    }, root);
    return () => {
      ctx.revert();
      media.revert();
    };
  }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => (current + 1) % steps.length), 4500);
    return () => window.clearInterval(timer);
  }, [steps.length]);
  return <main ref={landingRef}>
    <nav ref={navRef} className="site-nav sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-[66px] max-w-[1500px] items-center gap-6 px-5 lg:px-10">
        <a href="#pulse" className="nav-brand flex items-center gap-2"><span className="brand-shell"><span className="brand-mark-modern"><BrandMark /></span><span className="nav-live-orb" /></span><strong className="text-lg">Fixko</strong></a>
        <div className={`nav-links-modern ${mobileMenuOpen ? "open" : ""}`}>{[["pulse", "School updates"], ["features", "Features"], ["how", "How it works"], ["roles", "For your school"], ["verification", "Account safety"], ["faq", "FAQ"]].map(([id, label]) => <a className={`nav-link-modern ${activeNav === id ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)} key={id} href={`#${id}`}>{label}<span className="nav-link-glow" /></a>)}</div>
        <div className="ml-auto flex items-center gap-2"><button className="btn-secondary hidden sm:block" onClick={() => onAuth("user", "signin")}>Sign in</button><button className="btn-primary" onClick={() => onAuth("user", "signup")}>Get started <Icon name="arrow" size={15} /></button><button className="nav-menu-button" aria-label="Toggle navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /><span /></button></div>
      </div>
    </nav>
    <section className="hero-section relative mx-auto grid w-full max-w-[1700px] min-w-0 items-center gap-10 overflow-hidden px-6 py-[72px] sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,.95fr)] lg:px-10 lg:pb-16">
      <div className="hero-depth-scene pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="depth-grid" />
        <div className="depth-plane depth-plane-one" />
        <div className="depth-plane depth-plane-two" />
        <div className="depth-orb depth-orb-one" />
        <div className="depth-orb depth-orb-two" />
        <div className="depth-orb depth-orb-three" />
        <div className="depth-light depth-light-one" />
        <div className="depth-light depth-light-two" />
      </div>
      <div className="hero-grid-glow absolute inset-0 opacity-70" />
      <div className="hero-environment hero-parallax pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="hero-orb orb-indigo" /><div className="hero-orb orb-teal" /><div className="ambient-ring ring-one" /><div className="ambient-ring ring-two" />
        <div className="hero-line hero-line-one" /><div className="hero-line hero-line-two" /><div className="light-trail trail-one" /><div className="light-trail trail-two" />
        <div className="hero-spark spark-one"><Icon name="spark" size={20} /></div><div className="hero-spark spark-two"><Icon name="spark" size={14} /></div>
        <i className="particle particle-one" /><i className="particle particle-two" /><i className="particle particle-three" /><i className="particle particle-four" /><i className="particle particle-five" />
      </div>
      <motion.div className="hero-copy relative">
        <span className="eyebrow">● Campus facilities platform</span>
        <h1 className="mt-5 max-w-[760px] text-5xl font-black leading-[1.03] tracking-tight sm:text-[4rem]">Broken chair, dead aircon, flickering light — <span className="animated-gradient-text">report it in 30 seconds.</span></h1>
        <p className="mt-6 max-w-[560px] text-[17px] leading-7 text-slate-600">Fixko routes every report straight to the people who fix it, and keeps everyone posted from “seen it” to “fixed it.” No more sticky notes on the maintenance office door.</p>
        <div className="mt-8 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => onAuth("user", "signup")}>Get started</button><a className="btn-secondary" href="#how">See how it works</a></div>
      </motion.div>
      <motion.div ref={statusBoardRef} className="status-board card relative p-7 lg:min-h-[404px]">
        <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><span className="live-pulse" />Campus status board <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-600">LIVE</span></div>
        {[["Open reports", 42, "text-amber-600", "bg-amber-50"], ["In progress", 18, "text-indigo-600", "bg-indigo-50"], ["Critical, unresolved", 3, "text-rose-600", "bg-rose-50"], ["Resolved this term", 231, "text-emerald-600", "bg-emerald-50"]].map(([label, value, color, bg]) => <div className="hero-stat-item status-row flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0" key={label as string}><span className="flex items-center gap-3 text-sm text-slate-500"><span className={`status-dot ${bg}`} />{label}</span><strong className={`text-3xl ${color}`}><CountUp value={value as number} /></strong></div>)}
        <div className="flex items-center justify-between border-b border-slate-100 py-2.5"><span className="text-sm text-slate-500">Avg. time to resolve</span><strong className="text-3xl text-slate-900">2.4d</strong></div>
        <p className="mt-3 text-center text-[11px] text-slate-400">Sample data shown for illustration — your board reflects your campus.</p>
      </motion.div>
    </section>
    <div className="feature-rail"><div className="feature-rail-inner">{[["Built for school email domains","indigo"],["Mobile-friendly reporting","teal"],["Role-based access","amber"],["Exportable report & inventory data","rose"]].map(([label, tone], index) => <span className={`feature-rail-item rail-${tone}`} key={label}><i>✓</i><b>{label}</b>{index < 3 && <em />}</span>)}</div></div>
    <Reveal><section className="mx-auto max-w-[1440px] px-8 pb-8 pt-14" id="pulse">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black">Your campus, at a glance</h2><p className="mt-2 text-sm text-slate-600">Live signals help facilities teams decide what needs attention first.</p></div>
        <button className="text-sm font-bold text-indigo-600" onClick={() => onAuth("user", "signin")}>Preview the dashboard →</button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "REPORTS THIS WEEK", value: 64, status: "+18%", text: "Most reports are being resolved before they become repeat issues.", fill: "live-fill-indigo", progress: 76, caption: "Trending upward" },
          { label: "RESOLVED ON TIME", value: 87, status: "On track", text: "Teams can see overdue work early and keep users in the loop.", fill: "live-fill-emerald", progress: 87, caption: "On-time fixes" },
          { label: "BUSIEST LOCATION", value: null, displayValue: "Room 204", status: "Watch", text: "3 open reports are grouped together so admins can spot patterns.", fill: "live-fill-amber", progress: 72, caption: "Needs attention" }
        ].map(({ label, value, displayValue, status, text, fill, progress, caption }) => <motion.article whileHover={{ y: -6 }} className="pulse-card card p-5" key={label}><div className="flex items-center justify-between"><span className="text-xs font-black tracking-wider text-slate-400">{label}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">{status}</span></div><strong className="mt-4 block text-3xl font-black">{value === null ? displayValue : <><CountUp value={value} />{label === "RESOLVED ON TIME" ? "%" : ""}</>}</strong><p className="mt-2 text-sm leading-5 text-slate-500">{text}</p><LiveProgress value={progress} fill={fill} /><small className="mt-3 block text-xs font-semibold text-slate-400">{caption}</small></motion.article>)}
      </div>
    </section></Reveal>
    <Reveal><section className="mx-auto max-w-6xl px-6 py-20" id="features"><div className="mx-auto mb-10 max-w-2xl text-center"><span className="eyebrow"><Icon name="spark" size={13} /> Features</span><h2 className="mt-4 text-3xl font-black">Everything the school team needs</h2><p className="mt-3 text-slate-600">Fixko covers the whole process — from the first report to the repair history and the information that shows what keeps breaking.</p></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[["clipboard","Issue reporting","Report damage or missing items in seconds, with an optional photo attached."],["activity","Report progress","Every report moves through Pending, Review, Progress, and Resolved."],["chart","Report summary","See repeated issues, departments, and fixing time at a glance."],["alert","Priority & duplicate warnings","Mark how serious an issue is and warn when a similar report is already open."],["box","Equipment & repair history","Track equipment condition and keep a history of repairs."]].map(([icon, title, text], index) => <motion.div whileHover={{ y: -5, scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }} className="feature-card-modern card p-6" key={title}><div className={`feature-icon-modern ${index % 2 ? "sky" : index === 4 ? "rose" : "indigo"}`}><Icon name={icon as IconName} size={20} /></div><h3 className="font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p><span className="feature-link">Explore feature <Icon name="arrow" size={14} /></span></motion.div>)}</div></section></Reveal>
    <Reveal><section className="how-modern relative mx-auto grid max-w-7xl gap-10 overflow-hidden px-6 py-20 lg:grid-cols-[.82fr_1.18fr] lg:px-10" id="how">
      <div className="how-orb how-orb-one" /><div className="how-orb how-orb-two" /><div className="how-ring" />
      <div className="relative z-10">
        <span className="eyebrow how-eyebrow">A calmer way to get things fixed</span>
        <h2 className="mt-4 max-w-xl text-4xl font-black leading-tight sm:text-5xl">One clear path from <span className="how-gradient-text">“something’s broken”</span> to “all fixed.”</h2>
        <p className="mt-5 max-w-lg text-base leading-7 text-slate-500">Every report follows a clear process, so users know what happens next and admins can act before small issues become expensive ones.</p>
        <div className="how-steps mt-9">{steps.map((item, index) => <button key={item} onClick={() => setStep(index)} className={`guide-tab how-step ${step === index ? "active" : ""}`}>
          <span className={`how-step-number step-tone-${index} ${step === index ? "selected" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
          <span className="how-step-copy"><strong>{item}</strong><small>{["Scan a QR code or pick a room, describe the issue, and set its priority.","Admins see it right away, check for repeated reports, and send it to the right person.","Follow the status updates and message the admin about the report.","Rate the repair once it is fixed, helping the school see common problems."][index]}</small><span className="guide-progress-track"><span className={`guide-progress step-progress-${index} ${step === index ? "running" : ""}`} /></span></span>
          <span className="how-step-arrow"><Icon name="arrow" size={16} /></span>
        </button>)}</div>
      </div>
      <motion.div key={step} className="how-preview-wrap relative z-10">
        <div className="preview-float-card preview-float-top"><span className="preview-dot dot-green" /> Live update <strong>2m ago</strong></div>
        <div className="how-preview card">
          <div className="how-preview-head"><div><p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Report FX-1042</p><h3 className="mt-2 text-xl font-black">{steps[step]}</h3></div><span className={`preview-status status-${step}`}>{step === 3 ? "Resolved" : step === 2 ? "In progress" : step === 1 ? "Reviewing" : "New report"}</span></div>
          <div className="preview-surface">{step === 0 && <><div className="preview-form-icon"><span className="css-icon css-camera" /></div><label className="preview-label">What's the issue?</label><div className="preview-input">Aircon leaking onto floor <span className="preview-caret" /></div><label className="preview-label">Priority</label>          <div className="preview-priority-options"><Badge value="low" /><Badge value="medium" /><Badge value="critical" /></div><div className="upload-preview mt-5"><span className="css-icon css-camera" /> photo_attached.jpg <Icon name="check" size={14} /></div></>}{step === 1 && <><div className="preview-report-row"><span className="preview-avatar">RA</span><span><strong>Aircon leaking onto floor</strong><small>Room 204 · just now</small></span><Badge value="critical" /></div><div className="preview-alert"><span className="css-icon css-alert" /> 2 similar reports already open for Room 204.</div><div className="preview-assignee"><span className="preview-avatar teal">RA</span><span><strong>R. Aquino</strong><small>Assigned admin</small></span><Icon name="check" size={16} /></div></>}{step === 2 && <><div className="preview-progress-label"><span>Repair progress</span><strong>75%</strong></div><div className="preview-progress"><span /></div><div className="preview-timeline"><span className="timeline-pulse" /><div><strong>Admin is handling the report</strong><small>R. Aquino · checking the unit this afternoon</small></div></div><div className="preview-message">“On it — checking the unit this afternoon.”</div></>}{step === 3 && <><div className="resolved-burst"><span className="resolved-check"><Icon name="check" size={24} /></span><strong>Issue resolved</strong><small>Closed in 4h 12m</small></div><div className="rating-stars" aria-label="5 out of 5 stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div><div className="preview-message">“Fixed same day, thank you!”</div></>}</div>
        </div>
        <div className="preview-float-card preview-float-bottom"><span className="preview-icon"><Icon name="activity" size={16} /></span><span><strong>Campus pulse</strong><small>12 reports moving today</small></span><span className="mini-bars"><i /><i /><i /><i /></span></div>
      </motion.div>
    </section></Reveal>
    <Reveal><section className="mx-auto max-w-6xl px-6 py-16" id="roles"><div className="mb-9 text-center"><span className="eyebrow">Built for every role</span><h2 className="mt-4 text-3xl font-black">One system for reporting and campus operations</h2><p className="mt-3 text-slate-600">Each account sees exactly what is relevant to them — nothing more.</p></div><div className="grid gap-4 md:grid-cols-2">{[["Users","Report and track your own reports",["Submit a report with photo and priority in under a minute","See the status of everything you've reported","Message the admin on your report","Rate the repair once it's resolved"]],["Admins","Full visibility and control across campus",["See every report campus-wide with live progress","Update reports and report status","Track building conditions and repair history","Export reports and view analytics"]]].map(([title, sub, items], i) => <motion.div whileHover={{ y: -5 }} className={`card role-card border-t-4 p-7 ${i === 1 ? "border-t-slate-900" : "border-t-indigo-600"}`} key={title as string}><h3 className="text-xl font-black">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-400">{sub}</p><ul className="mt-5 space-y-3">{(items as string[]).map(item => <li className="flex gap-2 text-sm leading-5 text-slate-600" key={item}><span className="font-black text-emerald-500">✓</span>{item}</li>)}</ul></motion.div>)}</div></section></Reveal>
    <Reveal><section className="verification-modern relative mx-auto max-w-7xl overflow-hidden px-6 py-20 lg:px-10" id="verification">
      <div className="verification-glow verification-glow-one" /><div className="verification-glow verification-glow-two" />
      <div className="relative z-10 mx-auto mb-12 max-w-3xl text-center"><span className="eyebrow verification-eyebrow"><Icon name="shield" size={14} /> Account safety</span><h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">Safe accounts keep every report useful.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">Fixko checks every account before access is granted, keeping school reports clear and secure.</p></div>
      <div className="verification-grid relative z-10">
        <div className="verification-card verification-requirements">
          <div className="verification-card-head"><span className="verification-card-icon"><Icon name="id" size={20} /></span><div><p className="verification-kicker">Account check</p><h3>What we check before access</h3></div><span className="verification-lock"><Icon name="shield" size={16} /></span></div>
          <div className="verification-items">{[["mail","School email","Matches your school’s approved email address."],["hash","School ID","Confirms the ID given to you by the school."],["id","Approved account","Keeps reports connected to the person who sent them."]].map(([icon, title, text], index) => <div className="verification-item" key={title}><span className={`verification-item-icon verification-tone-${index}`}><Icon name={icon as IconName} size={17} /></span><div><strong>{title}</strong><p>{text}</p></div><Icon name="check" size={16} /></div>)}</div>
          <div className="verification-note"><span className="note-pulse" /> Verified details help the right people see the right reports.</div>
        </div>
        <div className="verification-card verification-process">
          <div className="verification-card-head"><span className="verification-card-icon process-icon"><Icon name="activity" size={20} /></span><div><p className="verification-kicker">What happens next</p><h3>What happens after sign-up</h3></div><span className="process-live"><i /> Live</span></div>
          <div className="verification-track"><span className="track-line" /><div className="verification-stage stage-done"><span><Icon name="check" size={14} /></span><strong>Submitted</strong><small>Details received</small></div><div className="verification-stage stage-review"><span><Icon name="activity" size={14} /></span><strong>Under review</strong><small>Admin checks records</small></div><div className="verification-stage stage-next"><span><Icon name="shield" size={14} /></span><strong>Verified</strong><small>Access granted</small></div></div>
          <div className="verification-message"><span className="verification-message-icon"><Icon name="bell" size={17} /></span><p>Your account starts as <b>pending</b>. Once approved, you can safely view and manage your reports.</p></div>
          <div className="verification-proof"><span><Icon name="users" size={15} /> Only the right people can see reports</span><span><Icon name="check" size={15} /> Checked by an admin</span></div>
        </div>
      </div>
    </section></Reveal>
    <Reveal><section className="faq-modern mx-auto max-w-6xl px-6 py-12 lg:px-10 lg:py-14" id="faq"><div className="mb-8 text-center"><span className="eyebrow">FAQ</span><h2 className="mt-4 text-3xl font-black sm:text-4xl">Good to know</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Quick answers for users and the admins keeping campus moving.</p></div><div className="faq-grid">{["Who can sign up?","What do users need to sign up?","Why does the report form ask for my ID again?","Can I report anonymously?","What happens after I submit a report?","Can admins export the data?"].map((question, index) => <div className="faq-card" key={question}><button className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-bold sm:p-5" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><span className={`faq-plus ${openFaq === index ? "open" : ""}`}>+</span></button><div className={`faq-answer ${openFaq === index ? "open" : ""}`}><p>{["Users sign up with their school email. Admin accounts are pre-built by the school.","Just your school email and School ID.","It is a verification step on every report. The field is pre-filled but remains editable.","No. Every report is tied to a verified account so admins can follow up.","It is checked for duplicates and moves through Pending, Review, In progress, and Resolved.","Yes — admins can export reports to CSV."][index]}</p></div></div>)}</div></section></Reveal>
    <section className="cta-band cta-wide mx-4 mb-12 mt-8 rounded-2xl px-6 py-8 text-white lg:mx-auto lg:max-w-[1700px] lg:px-14 lg:py-10">
      <div className="cta-orbit cta-orbit-one" />
      <div className="cta-orbit cta-orbit-two" />
      <div className="relative z-10 grid items-center gap-7 lg:grid-cols-[1.2fr_.8fr]">
        <div className="text-left">
          <span className="cta-kicker"><Icon name="spark" size={14} /> Make every campus issue easier to fix</span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl lg:text-[2.65rem]">Turn “someone should report this” into <span className="text-indigo-200">“it’s already being fixed.”</span></h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">Give your campus one trusted place to speak up, while your facilities team gets the context, priority, and visibility to act faster.</p>
          <div className="mt-5 flex flex-wrap gap-3"><button className="cta-primary-button" onClick={() => onAuth("user", "signup")}>Start reporting smarter <Icon name="arrow" size={16} /></button><button className="cta-secondary-button" onClick={() => onAuth("user", "signin")}>Sign in to Fixko</button></div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-indigo-200"><span><Icon name="check" size={14} /> School-ready setup</span><span><Icon name="check" size={14} /> Verified accounts</span><span><Icon name="check" size={14} /> No setup fee</span></div>
        </div>
        <div className="cta-proof-panel">
          <div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-indigo-200">Why schools choose Fixko</span><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Built for campus</span></div>
          <div className="mt-4 space-y-3"><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="activity" size={17} /></span><div><strong>Faster response</strong><p>Every issue reaches the right people with clear next steps.</p></div></div><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="users" size={17} /></span><div><strong>More trust</strong><p>Keep reporters informed from submission to resolution.</p></div></div><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="chart" size={17} /></span><div><strong>Better decisions</strong><p>Use real patterns to prevent repeat facility problems.</p></div></div></div>
        </div>
      </div>
    </section>
    <footer className="site-footer"><div className="footer-glow footer-glow-one" /><div className="footer-glow footer-glow-two" /><div className="footer-topline"><span><i /> Fixing the small things that keep campus moving</span>    <span className="footer-status"><Icon name="shield" size={14} /> Built for trusted school communities</span></div><div className="footer-grid"><div className="footer-brand"><div className="flex items-center gap-2"><div className="brand-mark-modern"><BrandMark /></div><strong className="text-lg text-white">Fixko</strong></div><p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Facility reporting and report management built for schools — from the first report to the repair log.</p><div className="footer-brand-meta"><span><Icon name="activity" size={14} /> Clear status</span><span><Icon name="users" size={14} /> One campus view</span></div><div className="mt-5 flex gap-2"><a className="social social-mail" href="#faq" aria-label="Email Fixko"><Icon name="mail" size={16} /></a><a className="social" href="#roles" aria-label="Fixko on Facebook">f</a><a className="social" href="#features" aria-label="Fixko on X">𝕏</a></div></div>{[["Product","Features","How it works","For users","For admins"],["Resources","FAQ","Report an issue","Contact support"],["Company","About Fixko","Contact us","Feedback"],["Legal","Privacy policy","Terms of use","Data handling"]].map(([heading, ...links]) => <div className="footer-column" key={heading}><h4 className="text-xs font-black uppercase tracking-wider text-white">{heading}</h4><ul className="mt-5 space-y-3">{links.map(link => <li key={link}><a className="text-sm text-slate-400 transition hover:text-white" href={`#${link === "Features" ? "features" : link === "How it works" ? "how" : link === "FAQ" ? "faq" : "roles"}`}>{link}<span>→</span></a></li>)}</ul></div>)}</div><div className="footer-note"><span>Prototype environment</span><p>This page uses illustrative sample data and is not connected to a live database.</p></div><div className="footer-bottom"><span>© 2026 Fixko. Built for schools.</span><span>Have access questions? <button onClick={() => onAuth("admin", "signin")}>Open staff & admin portal <Icon name="arrow" size={13} /></button></span></div></footer>  </main>;
}

function AppShell({ role, onSignOut }: { role: Role; onSignOut: () => void }) {
  const [page, setPage] = useState(role === "admin" ? "All reports" : "Dashboard");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [liveReports, setLiveReports] = useState<Report[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [dataError, setDataError] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const nav =
    role === "admin"
      ? ["All reports", "Report summary", "Users", "Notifications"]
      : ["Dashboard", "New report", "My reports", "Notifications"];

  const visible = useMemo(
    () =>
      liveReports.filter(
        (t) =>
          (statusFilter === "all" || t.status === statusFilter) &&
          `${t.id} ${t.title} ${t.room} ${t.reporter}`.toLowerCase().includes(query.toLowerCase())
      ),
    [liveReports, query, statusFilter]
  );

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return [
      ...nav
        .filter((item) => item.toLowerCase().includes(term))
        .map((item) => ({ type: "Workspace", label: item, detail: "Open workspace" })),
      ...liveReports
        .filter(
          (report) =>
            `${report.id} ${report.title} ${report.room} ${report.reporter}`
              .toLowerCase()
              .includes(term)
        )
        .slice(0, 4)
        .map((report) => ({
          type: "Report",
          label: `${report.id} · ${report.title}`,
          detail: `${report.building} · ${report.room} · ${statusLabel[report.status]}`,
        })),
    ].slice(0, 6);
  }, [liveReports, nav, query]);

  const open = liveReports.filter((t) => t.status !== "resolved").length;
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    Promise.all([getReports(), getRooms(), getNotifications()])
      .then(([reportResponse, roomResponse, notificationResponse]) => {
        setLiveReports(reportResponse.data.map(mapApiReport));
        setRooms(roomResponse);
        setNotifications(notificationResponse.data);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Live data could not be loaded.";
        const requestId =
          error instanceof ApiError && error.requestId ? ` Reference: ${error.requestId}` : "";
        setDataError(`${message}${requestId}`);
      });
  }, []);

  useEffect(() => {
    const savedHistory = window.localStorage.getItem("fixko-search-history");
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    if (page !== "Notifications") return;
    getNotifications()
      .then((response) => setNotifications(response.data))
      .catch(() => {});
  }, [page]);

  const markNotificationSeen = (notification: ApiNotification) => {
    if (notification.is_read) return;
    markNotificationRead(notification.id)
      .then((updated) =>
        setNotifications((current) =>
          current.map((item) => (item.id === updated.id ? updated : item))
        )
      )
      .catch(() => {});
  };

  useEffect(() => {
    const closeMenus = (event: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
        setNotificationsOpen(false);
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeMenus);
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.removeEventListener("mousedown", closeMenus);
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, []);

  const saveSearch = (value: string) => {
    const term = value.trim();
    if (!term) return;
    const nextHistory = [term, ...searchHistory.filter((item) => item.toLowerCase() !== term.toLowerCase())]
      .slice(0, 6);
    setSearchHistory(nextHistory);
    window.localStorage.setItem("fixko-search-history", JSON.stringify(nextHistory));
  };

  const choosePage = (item: string) => {
    setPage(item);
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  };

  const handleStatusUpdated = async (report: Report, status: Status) => {
    try {
      const backendStatus =
        status === "review" ? "under_review" : status === "progress" ? "in_progress" : status;
      const numericId = report.id.replace(/^FX-0*/, "");
      const response = await updateReportStatus(numericId, backendStatus);
      const nextReport = mapApiReport(response);
      setLiveReports((current) =>
        current.map((item) => (item.id === report.id ? nextReport : item))
      );
      setDataError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The report status could not be updated.";
      const requestId =
        error instanceof ApiError && error.requestId ? ` Reference: ${error.requestId}` : "";
      setDataError(`${message}${requestId}`);
    }
  };

  const displayRole = role === "admin" ? "Admin" : "User";
  const accountLabel = role === "admin" ? "Admin account" : "User account";
  const accountInitials = role === "admin" ? "AD" : "US";

  return (
    <div className={`app-shell workspace-${role} min-h-screen`}>
      <header
        ref={headerRef}
        className="app-header site-nav sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur"
      >
        <div className="mx-auto flex min-h-[70px] w-full max-w-[1700px] items-center gap-4 px-5 lg:px-10">
          <a
            className="nav-brand flex items-center gap-2"
            href="#"
            onClick={() =>
              choosePage(role === "admin" ? "All reports" : "Dashboard")
            }
          >
            <span className="brand-shell">
              <span className="brand-mark-modern">
                <BrandMark />
              </span>
              <span className="nav-live-orb" />
            </span>
            <strong className="text-lg">Fixko</strong>
          </a>
          {role !== "admin" && (
            <div
              className={`app-nav-links nav-links-modern ${
                mobileMenuOpen ? "open" : ""
              }`}
            >
              {nav.map((item) => (
                <button
                  key={item}
                  onClick={() => choosePage(item)}
                  className={`nav-link-modern ${
                    page === item ? "active" : ""
                  }`}
                >
                  {item}
                  <span className="nav-link-glow" />
                </button>
              ))}
            </div>
          )}
          <div className="app-search-wrap">
            <div className={`app-search ${searchOpen ? "is-open" : ""}`}>
              <Icon name="search" size={17} />
              <input
                value={query}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") saveSearch(query);
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                    event.currentTarget.blur();
                  }
                }}
                placeholder="Search reports and pages"
                aria-label="Search reports and pages"
              />
            </div>
            <div className={`app-search-panel ${searchOpen ? "is-open" : ""}`}>
              {query.trim()
                ? searchResults.length
                  ? (
                    <>
                      <p className="app-search-heading">Search results</p>
                      {searchResults.map((result) => (
                        <button
                          className="app-search-result"
                          key={`${result.type}-${result.label}`}
                          onClick={() => {
                            saveSearch(query);
                            choosePage(
                              result.type === "Workspace" ? result.label : "Report summary"
                            );
                          }}
                        >
                          <span className="app-search-result-icon">
                            {result.type === "Report" ? (
                              <Icon name="clipboard" size={15} />
                            ) : (
                              <Icon name="grid" size={15} />
                            )}
                          </span>
                          <span>
                            <strong>{result.label}</strong>
                            <small>{result.detail}</small>
                          </span>
                          <em>{result.type}</em>
                        </button>
                      ))}
                    </>
                  )
                  : (
                    <p className="app-search-empty">No reports or pages found.</p>
                  )
                : searchHistory.length
                  ? (
                    <>
                      <p className="app-search-heading">Recent searches</p>
                      {searchHistory.map((item) => (
                        <button
                          className="app-search-result"
                          key={item}
                          onClick={() => {
                            setQuery(item);
                            setSearchOpen(true);
                          }}
                        >
                          <span className="app-search-result-icon">
                            <Icon name="activity" size={15} />
                          </span>
                          <span>
                            <strong>{item}</strong>
                            <small>Previous search</small>
                          </span>
                          <em>History</em>
                        </button>
                      ))}
                    </>
                  )
                  : (
                    <p className="app-search-empty">
                      Your recent searches will appear here.
                    </p>
                  )}
            </div>
          </div>
          <div className="app-header-actions ml-auto flex items-center gap-2">
            <div className="app-header-menu">
              <button
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setProfileOpen(false);
                  setSearchOpen(false);
                }}
                className={`app-notification relative text-slate-500 ${
                  notificationsOpen ? "is-open" : ""
                }`}
                aria-label={
                  unreadCount > 0
                    ? `Open notifications — ${unreadCount} unread`
                    : "Open notifications"
                }
                aria-expanded={notificationsOpen}
              >
                <Icon name="bell" size={18} />
                {unreadCount > 0 && (
                  <>
                    <span className="app-notification-dot" aria-hidden="true" />
                    <span className="app-notification-count" aria-hidden="true">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  </>
                )}
              </button>
              <div
                className={`app-dropdown app-notification-dropdown ${
                  notificationsOpen ? "is-open" : ""
                }`}
              >
                <div className="app-dropdown-heading">
                  <span>
                    <strong>Notifications</strong>
                    <small>
                      {unreadCount > 0
                        ? `${unreadCount} unread update${
                            unreadCount === 1 ? "" : "s"
                          }`
                        : "Stay up to date with your campus"}
                    </small>
                  </span>
                </div>
                {notifications.length ? (
                  <div className="app-dropdown-list">
                    {notifications.slice(0, 5).map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        className={`notification-item app-dropdown-notification ${
                          notification.is_read ? "" : "is-unread"
                        }`}
                        onClick={() => {
                          markNotificationSeen(notification);
                          choosePage("Notifications");
                        }}
                      >
                        <span className="notification-item-icon">
                          <Icon
                            name={
                              notification.message.toLowerCase().includes("resolved")
                                ? "check"
                                : notification.message.toLowerCase().includes("message")
                                  ? "edit"
                                  : "bell"
                            }
                            size={16}
                          />
                        </span>
                        <div className="notification-item-content">
                          <strong>{notification.message}</strong>
                          <small>
                            <Icon name="activity" size={11} />{" "}
                            {new Date(notification.created_at).toLocaleString()}
                          </small>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="app-dropdown-empty">
                    <span>
                      <Icon name="bell" size={17} />
                    </span>
                    <strong>You're all caught up</strong>
                    <small>New updates will appear here.</small>
                  </div>
                )}
                <button
                  className="app-dropdown-link"
                  onClick={() => choosePage("Notifications")}
                >
                  View all notifications{" "}
                  <Icon name="arrow" size={14} />
                </button>
              </div>
            </div>
            <div className="app-header-menu hidden sm:block">
              <button
                onClick={() => {
                  setProfileOpen((open) => !open);
                  setNotificationsOpen(false);
                  setSearchOpen(false);
                }}
                className={`app-profile items-center gap-2 ${
                  profileOpen ? "is-open" : ""
                }`}
                aria-label="Open profile menu"
                aria-expanded={profileOpen}
              >
                <div className="app-profile-avatar">
                  {accountInitials}
                  <span className="app-profile-status" />
                </div>
                <div className="app-profile-copy hidden text-left xl:block">
                  <span className="app-profile-kicker">SIGNED IN AS</span>
                  <strong>{accountLabel}</strong>
                  <small>
                    {displayRole} <i>|</i> Active now
                  </small>
                </div>
                <span className="app-profile-chevron hidden xl:block" aria-hidden="true" />
              </button>
              <div
                className={`app-dropdown app-profile-dropdown ${
                  profileOpen ? "is-open" : ""
                }`}
              >
                <div className="app-dropdown-profile">
                  <div className="app-profile-avatar">{accountInitials}</div>
                  <div>
                    <strong>{accountLabel}</strong>
                    <small>{displayRole}</small>
                  </div>
                </div>
                <div className="app-dropdown-divider" />
                <button
                  className="app-dropdown-action"
                  onClick={onSignOut}
                >
                  <Icon name="logout" size={16} />
                  Sign out
                </button>
              </div>
            </div>
            <button
              className="nav-menu-button"
              aria-label="Toggle navigation"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>
      {role === "admin" && mobileMenuOpen ? (
        <div
          className="admin-sidebar-scrim"
          onClick={() => setMobileMenuOpen(false)}
        />
      ) : null}
      <div className="app-body">
        {role === "admin" && (
          <aside
            className={`admin-sidebar pill-sidebar ${
              mobileMenuOpen ? "is-open" : ""
            } ${sidebarCollapsed ? "is-collapsed" : ""}`}
          >
            <div className="admin-sidebar-head">
              <span className="admin-sidebar-logo">
                <BrandMark size={26} />
              </span>
              <button
                type="button"
                className="admin-sidebar-toggle"
                aria-label={
                  sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
                }
                aria-expanded={!sidebarCollapsed}
                onClick={() => setSidebarCollapsed((value) => !value)}
              >
                <span className="admin-sidebar-toggle-arrow" aria-hidden="true" />
              </button>
            </div>
            <nav className="admin-sidebar-nav" aria-label="Admin navigation">
              <span className="admin-sidebar-section">Main</span>
              {nav.map((item) => {
                const sidebarIcon: IconName =
                  item === "All reports"
                    ? "clipboard"
                    : item === "Report summary"
                      ? "chart"
                      : item === "Users"
                        ? "users"
                        : "bell";
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => choosePage(item)}
                    className={`admin-sidebar-link ${
                      page === item ? "active" : ""
                    }`}
                    aria-current={page === item ? "page" : undefined}
                    data-label={item}
                  >
                    <span className="admin-sidebar-icon">
                      <Icon name={sidebarIcon} size={17} />
                    </span>
                    <span className="admin-sidebar-label">{item}</span>
                    {item === "Notifications" && notifications.length > 0 ? (
                      <em
                        className={`admin-sidebar-badge ${
                          sidebarCollapsed ? "is-dot" : ""
                        }`}
                      >
                        {notifications.length > 99 ? "99+" : notifications.length}
                      </em>
                    ) : null}
                  </button>
                );
              })}
            </nav>
            <div className="admin-sidebar-foot">
              <div className="admin-sidebar-stat" data-label="Open issues">
                <span className="admin-sidebar-stat-dot" />
                <div className="admin-sidebar-stat-copy">
                  <strong>{open} open issues</strong>
                  <small>Reports awaiting action</small>
                </div>
                <em className="admin-sidebar-stat-bubble" aria-hidden="true">
                  {open}
                </em>
              </div>
              <div className="admin-sidebar-user" data-label="Admin account">
                <span className="admin-sidebar-avatar">{accountInitials}</span>
                <div className="admin-sidebar-user-copy">
                  <strong>{accountLabel}</strong>
                  <small>{displayRole} · Active now</small>
                </div>
                <button
                  type="button"
                  className="admin-sidebar-signout"
                  aria-label="Sign out"
                  onClick={onSignOut}
                >
                  <Icon name="logout" size={16} />
                </button>
              </div>
            </div>
          </aside>
        )}
        <main className="app-main w-full p-5 lg:p-9">
          <div className="mx-auto max-w-[1500px]">
            {dataError && (
              <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
                {dataError}
              </div>
            )}
            <motion.div
              key={page}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {page === "New report" ? (
                <ReportForm
                  rooms={rooms}
                  reportData={liveReports}
                  onSubmitted={(report) => {
                    setLiveReports((current) =>
                      [
                        mapApiReport(report),
                        ...current.filter(
                          (item) =>
                            item.id !== `FX-${String(report.id).padStart(4, "0")}`
                        ),
                      ]
                    );
                    choosePage("My reports");
                  }}
                />
              ) : page === "All reports" && role === "admin" ? (
                <AdminOverview
                  reports={liveReports}
                  rooms={rooms}
                  onViewReports={() => choosePage("Report summary")}
                  onOpenPage={choosePage}
                />
              ) : page === "Report summary" && role === "admin" ? (
                <OperationsInsights
                  reports={liveReports}
                  rooms={rooms}
                  onStatusUpdated={handleStatusUpdated}
                />
              ) : page === "My reports" ? (
                <MyReports
                  reportData={liveReports}
                  onCommentAdded={(reportId, comment) =>
                    setLiveReports((current) =>
                      current.map((item) =>
                        item.id === reportId
                          ? { ...item, comments: [...item.comments, comment] }
                          : item
                      )
                    )
                  }
                />
              ) : page === "Users" ? (
                <Users />
              ) : page === "Notifications" ? (
                <Notifications notifications={notifications} onOpenPage={choosePage} />
              ) : (
                <StudentDashboard
                  reportData={liveReports}
                  rooms={rooms}
                  onNewReport={() => choosePage("New report")}
                  onViewReports={() => choosePage("My reports")}
                />
              )}
              {/* end workspace */}
            </motion.div>
            <footer className="app-footer">
              <div className="app-footer-brand">
                <span className="brand-mark-modern">
                  <BrandMark size={30} />
                </span>
                <div>
                  <strong>Fixko</strong>
                  <p>Small reports. Faster fixes. Better campus spaces.</p>
                </div>
              </div>
              <div className="app-footer-links">
                <button onClick={() => choosePage("Notifications")}>
                  Updates <span>→</span>
                </button>
                <button onClick={() => choosePage("New report")}>
                  Report an issue <span>→</span>
                </button>
                <a href="mailto:support@fixko.school">
                  Support <span>→</span>
                </a>
              </div>
              <div className="app-footer-bottom">
                <span>
                  {role === "admin" ? "School operations" : "Your school reports"}
                </span>
                <span>© 2026 Fixko · Trusted school communities</span>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function ReportForm({
  rooms,
  reportData,
  onSubmitted,
}: {
  rooms: ApiRoom[];
  reportData: Report[];
  onSubmitted: (report: ApiReport) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [department, setDepartment] = useState("");
  const [building, setBuilding] = useState("");
  const [floor, setFloor] = useState("");
  const [room, setRoom] = useState("");
  const [priority, setPriority] = useState("medium");
  const [item, setItem] = useState("");
  const [condition, setCondition] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const clearReport = () => {
    setDepartment("");
    setBuilding("");
    setFloor("");
    setRoom("");
    setPriority("medium");
    setItem("");
    setCondition("");
    setQuantity("1");
    setDescription("");
    setPhoto(null);
    formRef.current?.reset();
  };

  const buildingOptions = Array.from(new Set(rooms.map((item) => item.building))).map(
    (item) => ({ value: item, label: item })
  );

  const floorOptions = Array.from(
    { length: buildingFloors[building] ?? 0 },
    (_, index) => {
      const value = String(index + 1);
      return { value, label: `Floor ${value}` };
    }
  );

  const roomChoices = rooms
    .filter((item) => item.building === building && (!floor || item.floor === floor))
    .sort((first, second) => {
      if (first.name === "Open Field") return 1;
      if (second.name === "Open Field") return -1;
      return first.name.localeCompare(second.name, undefined, { numeric: true });
    });

  const locationComplete = Boolean(department && building && floor && room);
  const issueComplete = Boolean(item && condition && description.trim());
  const completedSteps = Number(locationComplete) + Number(issueComplete);
  const completionPercent = Math.round((completedSteps / 2) * 100);
  const currentStep = locationComplete ? (issueComplete ? 3 : 2) : 1;

  return (
    <div className="report-form-page">
      <CampusMap compact reports={reportData} rooms={rooms} />
      <div className="report-progress-card">
        <div className="report-progress-copy">
          <div>
            <span className="report-progress-kicker">NEW REPORT</span>
            <strong>{completionPercent}% ready to submit</strong>
            <small>
              {currentStep === 3
                ? "Review your report preview, then submit."
                : `Complete step ${currentStep} to keep moving.`}
            </small>
          </div>
          <span className="report-progress-count">{completedSteps}/2</span>
        </div>
        <div className="report-progress-track">
          <span style={{ width: `${completionPercent}%` }} />
        </div>
        <div className="report-progress-steps">
          <span
            className={locationComplete ? "is-complete" : currentStep === 1 ? "is-current" : ""}
          >
            <i>{locationComplete ? "✓" : "1"}</i>
            Location
          </span>
          <span
            className={issueComplete ? "is-complete" : currentStep === 2 ? "is-current" : ""}
          >
            <i>{issueComplete ? "✓" : "2"}</i>
            Issue details
          </span>
          <span className={currentStep === 3 ? "is-current" : ""}>
            <i>3</i>
            Review
          </span>
        </div>
      </div>
      {submitted ? (
        <div className="card report-success-card">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">
            ✓
          </div>
          <h2 className="mt-5 text-2xl font-black">Report submitted</h2>
          <p className="mt-2 text-slate-500">
            Your report was saved and routed to the maintenance queue.
          </p>
        </div>
      ) : (
        <form
          ref={formRef}
          className="report-form-layout"
          onSubmit={async (event) => {
            event.preventDefault();
            const user =
              (JSON.parse(window.localStorage.getItem("fixko-user") || "null") as ApiUser) ||
              null;
            const selectedRoom = rooms.find((item) => String(item.id) === room);
            if (!user || !selectedRoom) return;
            try {
              const createdReport = await createReport({
                school_id: user.school_id,
                email: user.email,
                room_id: selectedRoom.id,
                category: department,
                item_name: item,
                condition,
                quantity: Number(quantity),
                description,
                priority: priority as "low" | "medium" | "high" | "critical",
                photo,
              });
              setSubmitted(true);
              onSubmitted(createdReport);
            } catch (error) {
              window.alert(
                error instanceof Error ? error.message : "Report submission failed."
              );
            }
          }}
        >
          <div className="report-form-main">
            <section
              className={`report-form-section ${locationComplete ? "is-complete" : ""}`}
            >
              <div className="report-form-section-heading">
                <div>
                  <h3>Where is it?</h3>
                  <p>Pick the department and exact location.</p>
                </div>
                <span className="report-form-step">
                  {locationComplete ? "✓" : "01"}
                </span>
              </div>
              <div className="report-form-fields">
                <label>
                  College department
                  <ModernSelect
                    value={department}
                    onChange={setDepartment}
                    placeholder="Select your department"
                    options={collegeDepartments.map((item) => ({
                      value: item,
                      label: item,
                    }))}
                  />
                </label>
                <label>
                  Building
                  <ModernSelect
                    value={building}
                    onChange={(value) => {
                      setBuilding(value);
                      setFloor("");
                      setRoom("");
                    }}
                    placeholder="Select a building"
                    options={buildingOptions}
                  />
                </label>
                <label>
                  Level / floor
                  <ModernSelect
                    value={floor}
                    disabled={!building}
                    onChange={(value) => {
                      setFloor(value);
                      setRoom("");
                    }}
                    placeholder={building ? "Select a floor" : "Select a building first"}
                    options={floorOptions}
                  />
                </label>
                <label>
                  Room
                  <ModernSelect
                    value={room}
                    disabled={!floor}
                    onChange={setRoom}
                    placeholder={floor ? "Select a room" : "Select a floor first"}
                    options={roomChoices.map((roomItem) => ({
                      value: String(roomItem.id),
                      label: roomItem.name,
                    }))}
                  />
                </label>
              </div>
            </section>
            <section
              className={`report-form-section ${issueComplete ? "is-complete" : ""}`}
            >
              <div className="report-form-section-heading">
                <div>
                  <h3>What is the problem?</h3>
                  <p>Be as specific as you can so it gets fixed faster.</p>
                </div>
                <span className="report-form-step">
                  {issueComplete ? "✓" : "02"}
                </span>
              </div>
              <div className="report-form-fields">
                <label>
                  Item
                  <ModernSelect
                    value={item}
                    onChange={setItem}
                    placeholder="Select an item"
                    options={[
                      "Air conditioning",
                      "Chair or desk",
                      "Projector or screen",
                      "Lighting",
                      "Window or door",
                      "Other",
                    ].map((item) => ({ value: item, label: item }))}
                  />
                </label>
                <label>
                  Condition
                  <ModernSelect
                    value={condition}
                    onChange={setCondition}
                    placeholder="Select condition"
                    options={[
                      "Broken",
                      "Damaged",
                      "Missing",
                      "Needs maintenance",
                    ].map((item) => ({ value: item, label: item }))}
                  />
                </label>
                <label className="report-quantity">
                  How many items?
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                  />
                </label>
                <label className="report-description">
                  Description
                  <textarea
                    required
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Example: The aircon runs but only blows warm air during afternoon classes."
                  />
                </label>
              </div>
              <fieldset className="report-urgency">
                <legend>Urgency</legend>
                <div>
                  {["low", "medium", "high"].map((level) => (
                    <label
                      key={level}
                      className={priority === level ? "is-selected" : ""}
                    >
                      <input
                        type="radio"
                        name="urgency"
                        value={level}
                        checked={priority === level}
                        onChange={() => setPriority(level)}
                      />
                      {level}
                    </label>
                  ))}
                </div>
              </fieldset>
            </section>
            <section className="report-form-section report-photo-section">
              <div className="report-form-section-heading">
                <div>
                  <h3>
                    Add a photo <small>(optional)</small>
                  </h3>
                  <p>A photo helps the maintenance team bring the right tools.</p>
                </div>
                <span className="report-form-step">03</span>
              </div>
              <label className="report-upload">
                <Icon name="box" size={24} />
                <strong>{photo ? photo.name : "Take a photo or upload"}</strong>
                <small>JPG or PNG, up to 5 MB</small>
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={(event) => {
                    const selected = event.target.files?.[0] ?? null;
                    if (
                      selected &&
                      (!["image/jpeg", "image/png"].includes(selected.type) ||
                        selected.size > 5 * 1024 * 1024)
                    ) {
                      window.alert(
                        "Please choose a JPG or PNG image up to 5 MB."
                      );
                      event.currentTarget.value = "";
                      setPhoto(null);
                      return;
                    }
                    setPhoto(selected);
                  }}
                />
              </label>
            </section>
          </div>
          <aside className="report-form-aside">
            <div className="report-tip-card">
              <span className="report-aside-icon">
                <Icon name="spark" size={16} />
              </span>
              <h3>Tips for a good report</h3>
              <ul>
                <li>Include the room and item number if there is one.</li>
                <li>Say when the problem started.</li>
                <li>Mark it high only if it is unsafe or stops a class.</li>
              </ul>
            </div>
            <div className="report-popular-card">
              <h3>
                <Icon name="activity" size={15} />
                Most reported this month
              </h3>
              {[
                ["CMA BUILDING · Room 204", "9 reports"],
                ["PTC BUILDING · Room 112", "8 reports"],
                ["CHS BUILDING · Lab 2", "7 reports"],
              ].map(([place, count]) => (
                <div key={place}>
                  <span>{place}</span>
                  <small>{count}</small>
                </div>
              ))}
            </div>
            <div className="report-output-card">
              <div className="report-output-heading">
                <span className="report-aside-icon">
                  <Icon name="clipboard" size={16} />
                </span>
                <div>
                  <h3>Report preview</h3>
                  <p>Review before submitting</p>
                </div>
              </div>
              <div className="report-output-list">
                <div>
                  <span>Location</span>
                  <strong>
                    {building
                      ? `${building}${
                          floor ? ` · Floor ${floor}` : ""
                        }${room && room !== "none" ? ` · Room ${room}` : ""}`
                      : "Not selected"}
                  </strong>
                </div>
                <div>
                  <span>Issue</span>
                  <strong>
                    {item || "Not selected"}
                    {condition ? ` · ${condition}` : ""}
                  </strong>
                </div>
                <div>
                  <span>Quantity</span>
                  <strong>{quantity || "—"}</strong>
                </div>
                <div>
                  <span>Priority</span>
                  <span className={`badge badge-${priority}`}>{priority}</span>
                </div>
              </div>
              {description && (
                <p className="report-output-description">{description}</p>
              )}
            </div>
            <div className="report-form-actions">
              <button type="button" className="btn-secondary" onClick={clearReport}>
                Cancel
              </button>
              <button type="submit" className="btn-primary">
                Submit report{" "}
                <Icon name="arrow" size={14} />
              </button>
            </div>
          </aside>
        </form>
      )}
    </div>
  );
}

function AdminOverview({
  reports: reportData,
  rooms,
  onViewReports,
  onOpenPage,
}: {
  reports: Report[];
  rooms: ApiRoom[];
  onViewReports: () => void;
  onOpenPage: (page: string) => void;
}) {
  const openReports = reportData.filter((report) => report.status !== "resolved");
  const criticalReports = openReports.filter(
    (report) => report.priority === "critical"
  );
  const inProgress = reportData.filter((report) => report.status === "progress");
  const recentReports = [...reportData].sort(
    (a, b) => b.createdAt - a.createdAt
  ).slice(0, 5);
  const attentionReports = [
    ...criticalReports,
    ...openReports.filter((report) => report.priority !== "critical"),
  ].slice(0, 4);

  const statCards = [
    { label: "Open reports", value: openReports.length, note: "Need a next action", icon: "clipboard", tone: "indigo" },
    { label: "Critical attention", value: criticalReports.length, note: criticalReports.length ? "Review these first" : "No urgent issues", icon: "alert", tone: "rose" },
    { label: "In progress", value: inProgress.length, note: "Currently being handled", icon: "activity", tone: "teal" },
    { label: "Buildings monitored", value: new Set(rooms.map((room) => room.building)).size, note: "Connected buildings", icon: "building", tone: "amber" },
  ] as const;

  return (
    <div className="admin-overview">
      <section className="admin-welcome-card panel-enter">
        <span className="admin-sparkle admin-sparkle-one" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="admin-sparkle admin-sparkle-two" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="admin-sparkle-big admin-sparkle-big-one" aria-hidden="true">
          <i />
        </span>
        <span className="admin-sparkle-big admin-sparkle-big-two" aria-hidden="true">
          <i />
        </span>
        <div>
          <span className="eyebrow">
            <Icon name="shield" size={13} />{" "}
            <span className="admin-wiggle">Campus operations</span>
          </span>
          <h1>
            {getTimeGreeting()},{" "}
            <span className="animated-gradient-text">admin</span>.{" "}
            <span aria-hidden="true">✨</span>
          </h1>
          <p>
            Here is the clearest view of what needs attention across campus today.
          </p>
        </div>
      </section>
      <div className="admin-stat-grid">
        {statCards.map((card, index) => (
          <article
            className={`admin-stat-card admin-stat-${card.tone} panel-enter`}
            style={{ "--fx-delay": `${index * 90}ms`, "--fx-i": index } as React.CSSProperties}
            key={card.label}
          >
            <span className="admin-stat-icon">
              <Icon name={card.icon} size={18} />
            </span>
            <div>
              <small>{card.label}</small>
              <strong>{card.value}</strong>
              <p>{card.note}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="admin-overview-grid">
        <section className="card admin-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-panel-kicker">Urgent reports</span>
              <h2>Needs attention</h2>
              <p>
                Start with the reports most likely to affect classes or safety.
              </p>
            </div>
            <button
              className="admin-text-action"
              onClick={onViewReports}
            >
              View report summary{" "}
              <Icon name="arrow" size={14} />
            </button>
          </div>
          {attentionReports.length ? (
            <div className="admin-attention-list">
              {attentionReports.map((report, index) => (
                <div
                  className="admin-attention-row"
                  style={{ "--fx-i": index } as React.CSSProperties}
                  key={report.id}
                >
                  <span className={`admin-attention-mark ${report.priority}`}>
                    <Icon
                      name={report.priority === "critical" ? "alert" : "clipboard"}
                      size={15}
                    />
                  </span>
                  <div>
                    <strong>{report.title}</strong>
                    <small>
                      {report.id} · {report.room} · {report.created}
                    </small>
                  </div>
                  <Badge value={report.priority} />
                  <Badge value={report.status} type="status" />
                </div>
              ))}
            </div>
          ) : (
            <div className="admin-empty-state">
              <span>
                <Icon name="check" size={20} />
              </span>
              <strong>Nothing urgent right now</strong>
              <p>
                New reports will appear here as soon as they are submitted.
              </p>
            </div>
          )}
        </section>
        <section className="card admin-panel admin-quick-panel">
          <div className="admin-panel-heading">
            <div>
              <span className="admin-panel-kicker">Workspace shortcuts</span>
              <h2>Move faster</h2>
              <p>Common admin actions in one place.</p>
            </div>
          </div>
          <div className="admin-quick-actions">
            <button onClick={onViewReports}>
              <span>
                <Icon name="chart" size={17} />
              </span>
              <div>
                <strong>View report summary</strong>
                <small>Spot repeated issues</small>
              </div>
              <Icon name="arrow" size={14} />
            </button>
            <button onClick={() => onOpenPage("All reports")}>
              <span>
                <Icon name="building" size={17} />
              </span>
              <div>
                <strong>Manage buildings</strong>
                <small>View reports by building</small>
              </div>
              <Icon name="arrow" size={14} />
            </button>
            <button onClick={() => onOpenPage("Users")}>
              <span>
                <Icon name="users" size={17} />
              </span>
              <div>
                <strong>Review users</strong>
                <small>Manage school access</small>
              </div>
              <Icon name="arrow" size={14} />
            </button>
          </div>
        </section>
      </div>
      <section className="card admin-panel">
        <div className="admin-panel-heading">
          <div>
            <span className="admin-panel-kicker">Latest activity</span>
            <h2>Recent reports</h2>
            <p>
              Keep an eye on the newest requests entering the queue.
            </p>
          </div>
          <span className="admin-count-pill">
            {reportData.length} total reports
          </span>
        </div>
        {recentReports.length ? (
          <div className="admin-recent-list">
            {recentReports.map((report) => (
              <button
                type="button"
                className="admin-recent-row w-full text-left"
                key={report.id}
                onClick={onViewReports}
              >
                <span
                  className={`admin-recent-status ${report.status}`}
                />
                <div>
                  <strong>{report.title}</strong>
                  <small>
                    {report.id} · {report.building} · {report.room} ·{" "}
                    {report.reporter}
                  </small>
                </div>
                <span className="admin-recent-date">{report.created}</span>
                <Badge value={report.status} type="status" />
              </button>
            ))}
          </div>
        ) : (
          <div className="admin-empty-state">
            <span>
              <Icon name="clipboard" size={20} />
            </span>
            <strong>No reports yet</strong>
            <p>
              The dashboard will update when the first report is submitted.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function OperationsInsights({
  reports,
  rooms,
  onStatusUpdated,
}: {
  reports: Report[];
  rooms: ApiRoom[];
  onStatusUpdated: (report: Report, status: Status) => Promise<void>;
}) {
  const [building, setBuilding] = useState("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [exportType, setExportType] = useState<"all" | "unresolved" | "resolved">("all");
  const buildings = Array.from(new Set(rooms.map((room) => room.building))).sort();

  const filteredReports = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            (building === "all" || report.building === building) &&
            `${report.id} ${report.title} ${report.room} ${report.reporter} ${report.description}`
              .toLowerCase()
              .includes(search.toLowerCase())
        )
        .sort((first, second) =>
          sortOrder === "newest"
            ? second.createdAt - first.createdAt
            : first.createdAt - second.createdAt
        ),
    [building, rooms, search, sortOrder, reports]
  );

  const resolvedReports = filteredReports.filter(
    (report) => report.status === "resolved"
  );
  const unresolvedReports = filteredReports.filter(
    (report) => report.status !== "resolved"
  );
  const selectedRooms =
    building === "all" ? rooms : rooms.filter((room) => room.building === building);
  const selectedBuildings = building === "all" ? "All buildings" : building;
  const exportReports =
    exportType === "all"
      ? filteredReports
      : exportType === "resolved"
        ? resolvedReports
        : unresolvedReports;

  const exportCsv = () => {
    const headers = [
      "Report ID",
      "Reporter ID",
      "Reporter name",
      "Reporter email",
      "Building",
      "Room",
      "Department",
      "Issue",
      "Description",
      "Priority",
      "Critical",
      "Status",
      "Issued date",
    ];
    const csvValue = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;
    const rows = exportReports.map((report) => {
      return [
        report.id,
        report.reporterSchoolId,
        report.reporterEmail,
        report.reporter,
        report.building,
        report.room,
        report.dept,
        report.title,
        report.description,
        report.priority,
        report.priority === "critical" ? "Yes" : "No",
        statusLabel[report.status],
        report.created,
      ].map(csvValue).join(",");
    });
    const blob = new Blob(
      [[headers.map(csvValue).join(","), ...rows].join("\r\n")],
      { type: "text/csv;charset=utf-8;" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fixko-${exportType}-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="operations-insights">
      <div className="operations-hero card panel-enter">
        <div>
          <span className="admin-panel-kicker">All reports</span>
          <h1>Reports by building and room</h1>
          <p>
            Review every report, room location, status, and user comment in one
            place. Choose a building to focus the map and report details.
          </p>
        </div>
      </div>
      <CampusMap reports={reports} rooms={rooms} />
      <div className="operations-toolbar card">
        <div className="operations-filters">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reports, rooms, or reporters..."
            aria-label="Search reports, rooms, or reporters"
          />
          <ModernSelect
            value={building}
            onChange={setBuilding}
            placeholder="All buildings"
            options={[
              { value: "all", label: "All buildings" },
              ...buildings.map((item) => ({ value: item, label: item })),
            ]}
          />
          <ModernSelect
            value={sortOrder}
            onChange={(value) => setSortOrder(value as "newest" | "oldest")}
            placeholder="Sort by date"
            options={[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ]}
          />
        </div>
      </div>
      <div className="operations-export-panel card">
        <div className="operations-export-copy">
          <span className="operations-export-icon">
            <Icon name="clipboard" size={17} />
          </span>
          <div>
            <span className="admin-panel-kicker">Data export</span>
            <strong>Download report records</strong>
            <small>
              Export a clean CSV using the selected report type and current filters.
            </small>
          </div>
        </div>
        <div className="operations-export-controls">
          <span className="operations-export-count">
            <strong>{exportReports.length}</strong>
            <small>reports ready</small>
          </span>
          <ModernSelect
            value={exportType}
            onChange={(value) =>
              setExportType(value as "all" | "unresolved" | "resolved")
            }
            placeholder="Choose reports"
            options={[
              { value: "all", label: "All reports" },
              { value: "unresolved", label: "Unresolved reports" },
              { value: "resolved", label: "Resolved reports" },
            ]}
          />
          <button
            type="button"
            className="operations-export-button"
            onClick={exportCsv}
          >
            <Icon name="arrow" size={14} />
            Export CSV
          </button>
        </div>
      </div>
      <div className="operations-metric-grid">
        {[
          ["Reports shown", filteredReports.length, selectedBuildings],
          ["Unresolved", unresolvedReports.length, "Needs follow-up"],
          ["Resolved", resolvedReports.length, "Completed reports"],
          ["Rooms affected", new Set(filteredReports.map((report) => report.room)).size, `${selectedRooms.length} monitored rooms`],
        ].map(([label, value, note], index) => (
          <div
            className="card operations-metric"
            style={{ "--fx-i": index } as React.CSSProperties}
            key={label as string}
          >
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
      <div className="operations-report-columns">
        <section className="card operations-panel">
          <div className="operations-section-heading">
            <div>
              <span className="admin-panel-kicker">Unresolved reports</span>
              <h2>Needs attention</h2>
              <p>
                Open reports grouped by the selected building.
              </p>
            </div>
            <span className="admin-count-pill">
              {unresolvedReports.length}
            </span>
          </div>
          {unresolvedReports.length ? (
            unresolvedReports.map((report) => (
              <OperationsReportCard
                key={report.id}
                report={report}
                onStatusUpdated={onStatusUpdated}
              />
            ))
          ) : (
            <div className="admin-empty-state">
              <strong>No unresolved reports</strong>
              <p>
                New reports will appear here when submitted.
              </p>
            </div>
          )}
        </section>
        <section className="card operations-panel">
          <div className="operations-section-heading">
            <div>
              <span className="admin-panel-kicker">Resolved reports</span>
              <h2>Completed work</h2>
              <p>
                Resolved reports grouped by the selected building.
              </p>
            </div>
            <span className="admin-count-pill">
              {resolvedReports.length}
            </span>
          </div>
          {resolvedReports.length ? (
            resolvedReports.map((report) => (
              <OperationsReportCard
                key={report.id}
                report={report}
                onStatusUpdated={onStatusUpdated}
              />
            ))
          ) : (
            <div className="admin-empty-state">
              <strong>No resolved reports</strong>
              <p>
                Resolved reports will appear here after work is completed.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function OperationsReportCard({
  report,
  onStatusUpdated,
}: {
  report: Report;
  onStatusUpdated: (report: Report, status: Status) => Promise<void>;
}) {
  return (
    <article className="operations-report-card">
      <div className="operations-report-heading">
        <div>
          <strong>{report.title}</strong>
          <small>
            {report.id} · {report.building} · {report.room}
          </small>
        </div>
        <div>
          <Badge value={report.priority} />
          <Badge value={report.status} type="status" />
          <ModernSelect
            value={report.status}
            onChange={(value) => onStatusUpdated(report, value as Status)}
            placeholder="Update status"
            options={[
              { value: "pending", label: "Pending" },
              { value: "review", label: "Under review" },
              { value: "progress", label: "In progress" },
              { value: "resolved", label: "Resolved" },
            ]}
            className="operations-status-select"
          />
        </div>
      </div>
      <p className="operations-report-description">{report.description}</p>
      {report.photoUrl && (
        <a
          href={report.photoUrl}
          target="_blank"
          rel="noreferrer"
          className="mb-4 block"
        >
          <img
            src={report.photoUrl}
            alt={`Photo attached to ${report.title}`}
            className="max-h-64 w-full rounded-xl object-cover"
          />
        </a>
      )}
      <div className="operations-report-meta">
        <span>
          <b>Reported by</b>
          {report.reporter}
        </span>
        <span>
          <b>Date</b>
          {report.created}
        </span>
        <span>
          <b>Department</b>
          {report.dept}
        </span>
      </div>
      <div className="operations-report-comments">
        <b>User comments</b>
        {report.feedback?.comment ? (
          <p>
            “{report.feedback.comment}”{" "}
            <small>· {report.feedback.rating}/5 rating</small>
          </p>
        ) : report.comments.length ? (
          report.comments.map((comment) => (
            <p key={comment.id}>
              “{comment.message}”{" "}
              <small>· {comment.author?.name ?? "User"}</small>
            </p>
          ))
        ) : (
          <p className="is-empty">No comments submitted.</p>
        )}
      </div>
    </article>
  );
}

function Users() {
  const [users, setUsers] = useState<
    Array<ApiUser & { reports_count?: number; created_at?: string }>
  >([]);
  const [usersError, setUsersError] = useState("");

  useEffect(() => {
    getUsers()
      .then((list) => setUsers(list))
      .catch((error) => {
        const message =
          error instanceof ApiError && error.requestId
            ? `${error.message} Reference: ${error.requestId}`
            : error instanceof Error
              ? error.message
              : "The user list could not be loaded.";
        setUsersError(message);
      });
  }, []);

  if (usersError)
    return (
      <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        {usersError}
      </div>
    );

  if (!users.length)
    return (
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-extrabold">Registered users</h2>
        </div>
        <div className="empty-report-state">
          <span>
            <Icon name="users" size={22} />
          </span>
          <h3>No registered users yet</h3>
          <p>
            Users will appear here after they create an account.
          </p>
        </div>
      </div>
    );

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <h2 className="font-extrabold">Registered users</h2>
        <span className="badge">{users.length}</span>
      </div>
      <ul className="users-table">
        {users.map((user) => (
          <li key={user.id} className="users-row">
            <div className="users-row-id">
              <span className="app-profile-avatar users-row-avatar">
                {(user.name || "?")
                  .split(/\s+/)
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </span>
              <div>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </div>
            </div>
            <div className="users-row-meta">
              <span>
                <em>School ID</em>
                {user.school_id || "—"}
              </span>
              <span>
                <em>Role</em>
                <span
                  className={`badge badge-${user.role === "admin" ? "progress" : "review"}`}
                >
                  {user.role}
                </span>
              </span>
              <span>
                <em>Department</em>
                {user.department || "General"}
              </span>
              <span>
                <em>Reports</em>
                {user.reports_count ?? 0}
              </span>
              <span>
                <em>Joined</em>
                {user.created_at
                  ? new Date(user.created_at).toLocaleDateString("en-US", {
                      dateStyle: "medium",
                    })
                  : "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Notifications({
  notifications,
  onOpenPage,
}: {
  notifications: ApiNotification[];
  onOpenPage: (page: string) => void;
}) {
  if (!notifications.length) {
    return (
      <div className="card notification-empty-page">
        <div className="notification-empty-icon">
          <Icon name="bell" size={24} />
        </div>
        <h2>You're all caught up</h2>
        <p>
          There are no new notifications right now. We will let you know when
          something needs your attention.
        </p>
      </div>
    );
  }

  return (
    <section className="notifications-page">
      <div className="notifications-page-heading">
        <div>
          <span className="eyebrow">
            <Icon name="bell" size={13} />{" "}
            Activity center
          </span>
          <h1>Notifications</h1>
          <p>
            Stay updated on reports, reviews, and changes across your campus.
          </p>
        </div>
        <span className="notifications-count">
          <strong>{notifications.length}</strong>{" "}
          updates
        </span>
      </div>
      <div className="notification-list">
        {notifications.map((notification) => (
          <button
            type="button"
            className={`notification-item w-full text-left ${
              notification.is_read ? "" : "is-unread"
            }`}
            key={notification.id}
            onClick={() => onOpenPage("Report summary")}
          >
            <span className="notification-item-icon">
              <Icon
                name={
                  notification.message.toLowerCase().includes("resolved")
                    ? "check"
                    : notification.message.toLowerCase().includes("review")
                      ? "activity"
                      : "bell"
                }
                size={17}
              />
            </span>
            <div className="notification-item-content">
              <div className="notification-item-topline">
                <span className="notification-item-label">
                  {notification.is_read ? "Earlier update" : "New update"}
                </span>
                {!notification.is_read && (
                  <span className="notification-unread-dot" />
                )}
              </div>
              <strong>{notification.message}</strong>
              <small>
                <Icon name="activity" size={12} />{" "}
                {new Date(notification.created_at).toLocaleString()}
              </small>
            </div>
            <span className="notification-item-arrow">
              <Icon name="arrow" size={15} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

type BuildingAlert = "critical" | "slight" | "normal";
const campusBuildings: { name: string; shortName: string; alert: BuildingAlert; reports: number }[] = [
  { name: "CMA Building", shortName: "CMA", alert: "critical", reports: 9 },
  { name: "PTC Building", shortName: "PTC", alert: "slight", reports: 5 },
  { name: "River Side Building", shortName: "RIVER SIDE", alert: "normal", reports: 2 },
  { name: "MDA Hall Building", shortName: "MDA HALL", alert: "normal", reports: 1 },
  { name: "Basic Ed Building", shortName: "BASIC ED", alert: "slight", reports: 4 },
  { name: "CHS Building", shortName: "CHS", alert: "normal", reports: 2 },
  { name: "North Hall Building", shortName: "NORTH HALL", alert: "critical", reports: 8 },
  { name: "ITS CSDL Building", shortName: "ITS CSDL", alert: "slight", reports: 4 },
  { name: "Gym", shortName: "GYM", alert: "normal", reports: 1 },
];

function CampusMap({
  compact = false,
  reports = [],
  rooms = [],
}: {
  compact?: boolean;
  reports?: Report[];
  rooms?: ApiRoom[];
}) {
  const normalizeBuilding = (value: string) =>
    value.toUpperCase().replace(/\s+/g, " ").trim();

  const reportCounts = new Map<string, number>();
  const criticalBuildings = new Set<string>();

  reports.forEach((report) => {
    const room = rooms.find((item) => item.name === report.room);
    if (!room) return;
    const buildingKey = normalizeBuilding(room.building);
    reportCounts.set(buildingKey, (reportCounts.get(buildingKey) ?? 0) + 1);
    if (report.priority === "critical" && report.status !== "resolved") {
      criticalBuildings.add(buildingKey);
    }
  });

  const mappedBuildings = campusBuildings.map((building) => {
    const buildingKey = normalizeBuilding(building.name);
    const reports = reportCounts.get(buildingKey) ?? 0;
    return {
      ...building,
      reports,
      alert:
        criticalBuildings.has(buildingKey)
          ? "critical"
          : reports
            ? "slight"
            : ("normal" as BuildingAlert),
    };
  });

  return (
    <section
      className={`campus-map-card ${compact ? "campus-map-card-compact" : ""}`}
      aria-label="Campus report activity map"
    >
      <div className="campus-map-heading">
        <div>
          <span className="eyebrow">
            <Icon name="building" size={13} />{" "}
            Campus map
          </span>
          <h2>See where help is needed</h2>
          <p>Buildings pulse according to recent reports.</p>
        </div>
      </div>
      <div className="campus-map-body">
        <div className="campus-map-canvas">
          <img
            className="campus-route-map-image"
            src="/campus-route-map.png"
            alt="Campus route map showing the school buildings and walkways"
          />
          {mappedBuildings.map((building, index) => (
            <div
              className={`campus-map-marker campus-map-marker-${building.alert} campus-map-marker-position-${index + 1}`}
              key={building.name}
              title={`${building.name}: ${building.reports} reported report${
                building.reports === 1 ? "" : "s"
              }`}
            >
              <span>{building.shortName}</span>
              <b>{building.reports}</b>
            </div>
          ))}
        </div>
        <aside className="campus-map-info">
          <div className="campus-map-info-card campus-map-status-card">
            <span className="campus-info-label">CAMPUS STATUS</span>
            <strong>Monitoring activity</strong>
            <p>
              Report concentration updates the building indicators automatically.
            </p>
            <div className="campus-status-counts">
              <span>
                <b>
                  {mappedBuildings.filter(
                    (building) => building.alert === "critical"
                  ).length}
                </b>
                Critical
              </span>
              <span>
                <b>
                  {mappedBuildings.filter(
                    (building) => building.alert === "slight"
                  ).length}
                </b>
                Warning
              </span>
              <span>
                <b>
                  {mappedBuildings.filter(
                    (building) => building.alert === "normal"
                  ).length}
                </b>
                Clear
              </span>
            </div>
          </div>
          <div className="campus-map-info-card">
            <span className="campus-info-label">MOST REPORTED</span>
            <div className="campus-top-building-list">
              {mappedBuildings
                .slice()
                .sort((a, b) => b.reports - a.reports)
                .slice(0, 3)
                .map((building, index) => (
                  <div key={building.name}>
                    <span>
                      <b>{index + 1}</b>
                      {building.name}
                    </span>
                    <strong>{building.reports}</strong>
                  </div>
                ))}
            </div>
          </div>
          <div className="campus-map-info-card campus-map-help-card">
            <span className="campus-info-label">HOW TO READ THE MAP</span>
            <p>
              <i className="campus-status-dot campus-status-critical" />{" "}
              Red buildings need attention first.
            </p>
            <p>
              <i className="campus-status-dot campus-status-slight" />{" "}
              Yellow buildings have some activity.
            </p>
            <p>
              <i className="campus-status-dot campus-status-normal" />{" "}
              Green buildings are within normal activity.
            </p>
          </div>
        </aside>
      </div>
      <div className="campus-map-footer">
        <span>
          <i className="campus-status-dot campus-status-critical" />{" "}
          Critical
        </span>
        <span>
          <i className="campus-status-dot campus-status-slight" />{" "}
          Slight activity
        </span>
        <span>
          <i className="campus-status-dot campus-status-normal" />{" "}
          Normal
        </span>
        <small>Updated just now</small>
      </div>
    </section>
  );
}

function ReportSummary({ reportData }: { reportData: Report[] }) {
  const totalReports = reportData.length;
  const resolvedReports = reportData.filter(
    (report) => report.status === "resolved"
  ).length;
  const inProgressReports = reportData.filter(
    (report) => report.status === "review" || report.status === "progress"
  ).length;

  const summary = [
    ["Total reports", totalReports, "Everything you have reported", "clipboard", "indigo"],
    ["Resolved", resolvedReports, "Issues successfully closed", "check", "emerald"],
    ["In progress", inProgressReports, "Reports being reviewed or fixed", "activity", "teal"],
  ] as const;

  return (
    <section className="report-summary-grid" aria-label="Report summary">
      {summary.map(([label, value, text, icon, tone]) => (
        <motion.div
          whileHover={{ y: -4 }}
          className={`report-summary-card card report-summary-${tone}`}
          key={label}
        >
          <div className="report-summary-top">
            <span className="report-summary-icon">
              <Icon name={icon} size={17} />
            </span>
            <span>{label}</span>
          </div>
          <strong>{value}</strong>
          <p>{text}</p>
        </motion.div>
      ))}
    </section>
  );
}

function MyReports({
  reportData,
  onCommentAdded,
}: {
  reportData: Report[];
  onCommentAdded: (
    reportId: string,
    comment: { id: number; message: string; created_at: string; author?: ApiUser }
  ) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDay, setFilterDay] = useState("");

  const years = Array.from(
    new Set(reportData.map((report) => report.createdDate.slice(0, 4)))
  ).sort().reverse();
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1).padStart(2, "0"),
    label: new Date(2026, index, 1).toLocaleString("en-US", { month: "long" }),
  }));
  const days = Array.from({ length: 31 }, (_, index) => ({
    value: String(index + 1).padStart(2, "0"),
    label: String(index + 1),
  }));

  const filteredReports = reportData.filter((report) => {
    const [year, month, day] = report.createdDate.split("-");
    return (
      (!filterYear || year === filterYear) &&
      (!filterMonth || month === filterMonth) &&
      (!filterDay || day === filterDay)
    );
  });

  const sortedReports = [...filteredReports].sort((a, b) => {
    const difference = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
    return sortOrder === "newest" ? -difference : difference;
  });

  const hasFilters = Boolean(filterYear || filterMonth || filterDay);
  const clearFilters = () => {
    setFilterYear("");
    setFilterMonth("");
    setFilterDay("");
  };

  const statusProgress: Record<Status, number> = {
    pending: 22,
    review: 48,
    progress: 74,
    resolved: 100,
  };
  const statusSteps: Array<{ value: Status; label: string }> = [
    { value: "pending", label: "Submitted" },
    { value: "review", label: "Under review" },
    { value: "progress", label: "In progress" },
    { value: "resolved", label: "Resolved" },
  ];

  return (
    <div className="my-reports-page">
      <section className="my-reports card">
        <div className="my-reports-heading">
          <div>
            <span className="eyebrow">
              <Icon name="clipboard" size={13} />{" "}
              Your reports
            </span>
            <h2>My reports</h2>
            <p>Click a report to view its full details.</p>
          </div>
          <div className="my-reports-tools">
            <button
              type="button"
              className={`my-reports-tool ${
                filterOpen || hasFilters ? "is-active" : ""
              }`}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <Icon name="layers" size={14} />
              Filter
              {hasFilters && <span className="my-reports-tool-count">1</span>}
            </button>
            <ModernSelect
              value={sortOrder}
              onChange={(value) => setSortOrder(value as "newest" | "oldest")}
              placeholder="Sort by date"
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
              ]}
              className="my-reports-sort"
            />
            <span className="my-reports-count">
              {sortedReports.length} reports
            </span>
          </div>
        </div>
        {filterOpen && (
          <div className="my-reports-filter-panel">
            <div>
              <span>Year</span>
              <ModernSelect
                value={filterYear}
                onChange={setFilterYear}
                placeholder="Any year"
                options={years.map((year) => ({ value: year, label: year }))}
              />
            </div>
            <div>
              <span>Month</span>
              <ModernSelect
                value={filterMonth}
                onChange={setFilterMonth}
                placeholder="Any month"
                options={months}
              />
            </div>
            <div>
              <span>Date</span>
              <ModernSelect
                value={filterDay}
                onChange={setFilterDay}
                placeholder="Any date"
                options={days}
              />
            </div>
            <button
              type="button"
              className="my-reports-clear"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        )}
        {sortedReports.length ? (
          <div className="my-reports-list">
            {sortedReports.map((report) => {
              const expanded = expandedId === report.id;
              return (
                <article
                  className={`my-report ${expanded ? "is-expanded" : ""}`}
                  key={report.id}
                >
                  <button
                    className="my-report-trigger"
                    onClick={() => setExpandedId(expanded ? null : report.id)}
                    aria-expanded={expanded}
                  >
                    <span
                      className={`my-report-icon my-report-icon-${report.status}`}
                    >
                      <Icon name="clipboard" size={17} />
                    </span>
                    <span className="my-report-main">
                      <strong>{report.title}</strong>
                      <small>
                        {report.id} <i>|</i> {report.room} <i>|</i>{" "}
                        {report.created}
                      </small>
                      <span className="my-report-progress">
                        <span
                          style={{
                            width: `${statusProgress[report.status]}%`,
                          }}
                        />
                      </span>
                    </span>
                    <span className="my-report-meta">
                      <Badge value={report.priority} />
                      <Badge value={report.status} type="status" />
                    </span>
                    <span className="my-report-view-label">
                      {expanded ? "Hide" : "View"}
                    </span>
                    <span
                      className={`my-report-chevron ${
                        expanded ? "is-open" : ""
                      }`}
                    />
                  </button>
                  <MyReportDetails
                    report={report}
                    statusSteps={statusSteps}
                    onCommentAdded={onCommentAdded}
                  />
                </article>
              );
            })}
          </div>
        ) : (
          <div className="empty-report-state">
            <span>
              <Icon name="clipboard" size={22} />
            </span>
            <h3>No reports yet</h3>
            <p>
              Your submitted reports will appear here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function MyReportDetails({
  report,
  statusSteps,
  onCommentAdded,
}: {
  report: Report;
  statusSteps: Array<{ value: Status; label: string }>;
  onCommentAdded: (
    reportId: string,
    comment: { id: number; message: string; created_at: string; author?: ApiUser }
  ) => void;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submitComment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!message.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const comment = await addReportComment(
        report.id.replace(/^FX-0*/, ""),
        message.trim()
      );
      onCommentAdded(report.id, comment);
      setMessage("");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Comment could not be added."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="my-report-details">
      <div className="my-report-details-inner">
        <div className="my-report-details-grid">
          <div>
            <span>Reported</span>
            <strong>{report.created}</strong>
          </div>
          <div>
            <span>Location</span>
            <strong>{report.room} · {report.dept}</strong>
          </div>
          <div>
            <span>Priority</span>
            <Badge value={report.priority} />
          </div>
          <div>
            <span>Assigned to</span>
            <strong>{report.tech}</strong>
          </div>
        </div>
        <div className="my-report-timeline">
          {statusSteps.map((step, index) => (
            <div
              className={`my-report-timeline-step ${
                statusSteps.findIndex((item) => item.value === report.status) >= index
                  ? "is-complete"
                  : ""
              }`}
              key={step.value}
            >
              <span>
                {statusSteps.findIndex((item) => item.value === report.status) >= index
                  ? "✓"
                  : index + 1}
              </span>
              <strong>{step.label}</strong>
              {index < statusSteps.length - 1 && <i />}
            </div>
          ))}
        </div>
        {report.photoUrl && (
          <div className="my-report-description">
            <span>Attached photo</span>
            <a
              href={report.photoUrl}
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={report.photoUrl}
                alt={`Photo attached to ${report.title}`}
                className="mt-2 max-h-64 rounded-xl object-cover"
              />
            </a>
          </div>
        )}
        <div className="my-report-description">
          <span>Description</span>
          <p>{report.description}</p>
        </div>
        <div className="my-report-description">
          <span>Comments</span>
          {report.comments.length ? (
            report.comments.map((comment) => (
              <p key={comment.id} className="mt-2">
                “{comment.message}”{" "}
                <small>· {comment.author?.name ?? "User"}</small>
              </p>
            ))
          ) : (
            <p className="mt-2">No comments yet.</p>
          )}
          <form
            onSubmit={submitComment}
            className="mt-3 flex flex-col gap-2 sm:flex-row"
          >
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={2000}
              placeholder="Write a comment for the maintenance team"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2"
            />
            <button
              type="submit"
              disabled={submitting || !message.trim()}
              className="btn-primary"
            >
              {submitting ? "Sending..." : "Add comment"}
            </button>
          </form>
          {error && (
            <p className="mt-2 text-sm font-semibold text-rose-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function StudentDashboard({
  reportData,
  rooms,
  onNewReport,
  onViewReports,
}: {
  reportData: Report[];
  rooms: ApiRoom[];
  onNewReport: () => void;
  onViewReports: () => void;
}) {
  return (
    <div className="student-dashboard space-y-5">
      <section className="student-welcome relative overflow-hidden rounded-[26px] p-6 text-white lg:p-8 panel-enter">
        <div className="student-welcome-orb student-welcome-orb-one" />
        <div className="student-welcome-orb student-welcome-orb-two" />
        <span className="student-sparkle student-sparkle-one" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="student-sparkle student-sparkle-two" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <div className="relative z-10 max-w-2xl">
          <span className="student-kicker">YOUR CAMPUS IMPACT ✨</span>
          <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">
            Keep your campus moving, one{" "}
            <span className="student-wiggle">report</span>{" "}
            at a time.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">
            You help the right people notice problems sooner. Track your
            requests, stay updated, and make shared spaces better for everyone.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={onNewReport} className="student-welcome-primary">
              <Icon name="edit" size={16} />{" "}
              <span className="student-welcome-pop">Report an issue</span>
            </button>
            <button onClick={onViewReports} className="student-welcome-secondary">
              View my reports{" "}
              <Icon name="arrow" size={15} />
            </button>
          </div>
        </div>
        <div className="student-welcome-stats relative z-10 mt-7 grid max-w-xl grid-cols-3 gap-3 sm:absolute sm:right-8 sm:top-8 sm:mt-0 sm:w-[310px]">
          <div>
            <strong>30s</strong>
            <span>to report</span>
          </div>
          <div>
            <strong>24/7</strong>
            <span>status updates</span>
          </div>
          <div>
            <strong>1</strong>
            <span>shared campus</span>
          </div>
        </div>
      </section>
      <ReportSummary reportData={reportData} />
      <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
        <section className="card p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="eyebrow">
                <Icon name="activity" size={13} />{" "}
                Your activity
              </span>
              <h2 className="mt-4 text-xl font-black">
                Make your next report count
              </h2>
              <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">
                Clear details help maintenance teams respond faster and reduce
                repeat issues.
              </p>
            </div>
            <span className="student-score-badge">
              Good citizen{" "}
              <Icon name="check" size={13} />
            </span>
          </div>
          <div className="student-progress-card mt-6">
            <div className="flex items-center justify-between">
              <div>
                <strong className="block text-sm">Reporting profile</strong>
                <small className="text-xs text-slate-400">
                  2 of 3 helpful habits completed
                </small>
              </div>
              <strong className="text-2xl text-indigo-600">67%</strong>
            </div>
            <div className="student-progress-track mt-4">
              <span style={{ width: "67%" }} />
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ["check", "Add a photo", true],
                ["check", "Choose a room", true],
                ["shield", "Rate a repair", false],
              ].map(([icon, label, done]) => (
                <div
                  className={`student-habit ${done ? "done" : ""}`}
                  key={label as string}
                >
                  <span className="inline-flex">
                    <Icon name={icon as IconName} size={14} />
                  </span>
                  <small>{label}</small>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="student-tip-card">
          <div className="student-tip-icon">
            <Icon name="spark" size={20} />
          </div>
          <span className="student-kicker student-tip-kicker">QUICK TIP</span>
          <h2 className="mt-3 text-xl font-black">Help us fix it faster</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Include the exact room, what happened, and when you first noticed
            it. A photo makes recurring issues easier to spot.
          </p>
          <button onClick={onNewReport} className="student-tip-link">
            Start a detailed report{" "}
            <Icon name="arrow" size={14} />
          </button>
        </section>
      </div>
      <section className="student-journey card p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">
              How Fixko works for you
            </span>
            <h2 className="mt-3 text-xl font-black">
              Stay in the loop from report to resolution
            </h2>
          </div>
          <button onClick={onViewReports} className="text-sm font-bold text-indigo-600">
            See all updates{" "}
            <Icon name="arrow" size={14} />
          </button>
        </div>
        <div className="mt-7 grid gap-4 md:grid-cols-4">
          {[
            ["01", "Report", "Tell us what needs attention.", "edit"],
            ["02", "Reviewed", "The admin checks the details.", "shield"],
            ["03", "In progress", "The report is being handled.", "activity"],
            ["04", "Resolved", "Rate the repair and close the loop.", "check"],
          ].map(([number, title, text, icon], index) => (
            <div className="student-journey-step" key={title}>
              <span
                className={`student-journey-number ${
                  index < 2 ? "complete" : ""
                }`}
              >
                {number}
              </span>
              <Icon name={icon as IconName} size={18} />
              <strong>{title}</strong>
              <p>{text}</p>
              {index < 3 && <i />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function Home() {
  const [role, setRole] = useState<Role | null>(null);
  const [authRole, setAuthRole] = useState<Role | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [signInLoading, setSignInLoading] = useState<Role | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("fixko-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(saved ? saved === "dark" : prefersDark);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    const email = params.get("email");
    if (token && email) {
      setAuthRole("user");
      setAuthMode("reset");
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    window.localStorage.setItem("fixko-theme", darkMode ? "dark" : "light");
    const frame = window.requestAnimationFrame(() => {
      document.documentElement.dataset.themeReady = "true";
    });
    return () => window.cancelAnimationFrame(frame);
  }, [darkMode]);

  const enterWorkspace = async (nextRole: Role) => {
    setAuthRole(null);
    setSignInLoading(nextRole);
    await new Promise((resolve) => window.setTimeout(resolve, 900));
    setRole(nextRole);
    setSignInLoading(null);
  };

  return (
    <div className={`theme-root ${darkMode ? "theme-dark" : ""}`}>
      <div className="global-depth-scene" aria-hidden="true">
        <div className="global-depth-grid" />
        <div className="global-depth-orbit" />
        <div className="global-depth-orb global-depth-orb-one" />
        <div className="global-depth-orb global-depth-orb-two" />
        <div className="global-depth-glow global-depth-glow-one" />
        <div className="global-depth-glow global-depth-glow-two" />
      </div>
      <ThemeToggle dark={darkMode} setDark={setDarkMode} />
      {signInLoading ? (
        <SignInLoader role={signInLoading} />
      ) : role ? (
        <AppShell
          role={role}
          onSignOut={() => {
            clearToken();
            setRole(null);
          }}
        />
      ) : (
        <>
          <Landing
            onAuth={(r, mode) => {
              setAuthRole(r);
              setAuthMode(mode ?? "signin");
            }}
          />
          {authRole && (
            <AuthModal
              role={authRole}
              initialMode={authMode ?? "signin"}
              onClose={() => {
                setAuthRole(null);
                setAuthMode(null);
              }}
              onEnter={enterWorkspace}
            />
          )}
        </>
      )}
    </div>
  );
}
