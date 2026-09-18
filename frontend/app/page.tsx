"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ApiNotification, ApiRoom, ApiTicket, ApiUser, clearToken, createTicket, getNotifications, getRooms, getTickets, login, signup, updateTicketStatus } from "../lib/api";

gsap.registerPlugin(ScrollTrigger);

const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Role = "student" | "admin";
type Status = "pending" | "review" | "progress" | "resolved";
const collegeDepartments = ["CITE", "CAS", "CAHS", "CELA", "CEA", "CMA", "CHTM", "CCJE", "SHS"] as const;
const reportBuildings = ["CMA BUILDING", "PTC BUILDING", "RIVER SIDE BUILDING", "MDA HALL BUILDING", "BASIC ED BUILDING", "CHS BUILDING", "NORTH HALL BUILDING", "ITS CSDL BUILDING", "GYM"] as const;
function getBuildingFloorCount(building: string) {
  if (building === "RIVER SIDE BUILDING") return 8;
  if (building === "MDA HALL BUILDING" || building === "MBA HALL BUILDING") return 5;
  if (building === "ITS CSDL BUILDING") return 2;
  if (building === "GYM") return 1;
  return 4;
}
type Ticket = {
  id: string; title: string; room: string; reporter: string; dept: string; createdDate: string;
  priority: "low" | "medium" | "high" | "critical"; status: Status; created: string; createdAt: number; tech: string; description: string;
  reporterSchoolId: string; reporterEmail: string;
  comments: Array<{ id: number; message: string; created_at: string; author?: ApiUser }>;
  feedback: { rating: number; comment: string | null; created_at: string } | null;
};

function mapApiTicket(ticket: ApiTicket): Ticket {
  const status: Status = ticket.status === "under_review" ? "review" : ticket.status === "in_progress" ? "progress" : ticket.status;
  return {
    id: `FX-${String(ticket.id).padStart(4, "0")}`,
    title: ticket.item_name || ticket.category || "Facility issue",
    room: ticket.room?.name || "Unknown room",
    reporter: ticket.reporter?.name || ticket.reporter_email_snapshot,
    reporterSchoolId: ticket.reporter_school_id_snapshot,
    reporterEmail: ticket.reporter?.email || ticket.reporter_email_snapshot,
    dept: ticket.room?.department || "General",
    createdDate: ticket.created_at.slice(0, 10),
    priority: ticket.priority,
    status,
    created: new Date(ticket.created_at).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    createdAt: new Date(ticket.created_at).getTime(),
    tech: "Maintenance queue",
    description: ticket.description,
      comments: ticket.comments ?? [],
      feedback: ticket.feedback ?? null,
    };
}

function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

type IconName = "spark" | "clipboard" | "activity" | "chart" | "alert" | "box" | "mail" | "hash" | "search" | "id" | "shield" | "arrow" | "check" | "bell" | "grid" | "layers" | "users" | "building" | "edit" | "logout";

function Icon({ name, size = 18, stroke = 1.8 }: { name: IconName; size?: number; stroke?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    spark: <><path d="m12 3 1.1 5.9L19 10l-5.9 1.1L12 17l-1.1-5.9L5 10l5.9-1.1L12 3Z" /><path d="m19 16 .5 2.5L22 19l-2.5.5L19 22l-.5-2.5L16 19l2.5-.5L19 16Z" /></>,
    clipboard: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M8 10h8M8 14h6M8 18h4" /></>,
    activity: <><path d="M3 12h4l2-7 4 14 2-7h6" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 3-4 3 2 5-7" /></>,
    alert: <><path d="m12 3 9 16H3L12 3Z" /><path d="M12 9v4M12 16h.01" /></>,
    box: <><path d="m4 7 8-4 8 4-8 4-8-4Z" /><path d="M4 7v10l8 4 8-4V7M12 11v10" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>,
    hash: <><path d="M10 3 8 21M16 3l-2 18M4 9h17M3 15h17" /></>,
    search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    id: <><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="8" cy="12" r="2" /><path d="M13 10h5M13 14h4" /></>,
    shield: <><path d="M12 3 19 6v5c0 4.5-2.8 8.1-7 10-4.2-1.9-7-5.5-7-10V6l7-3Z" /><path d="m9 12 2 2 4-4" /></>,
    arrow: <><path d="M5 12h13M13 6l6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><rect x="14" y="14" width="6" height="6" rx="1" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-3.5 2.5-5 6-5s5.5 1.5 6 5M16 5.5a3 3 0 0 1 0 5.8M17 15c2.5.3 3.8 1.8 4 4" /></>,
    building: <><path d="M4 21V5l8-3 8 3v16M2 21h20M8 9h2M14 9h2M8 13h2M14 13h2M8 17h2M14 17h2" /></>,
    edit: <><path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z" /><path d="m14 7 3 3" /></>,
    logout: <><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></>
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
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
  return <div className={`theme-float ${dark ? "is-dark" : ""}`} style={{ "--drag-y": `${dragY}px` } as React.CSSProperties}>
    <span className="theme-float-label">{dark ? "Dark mood" : "Light mood"}</span>
    <button className="theme-orbit" type="button" aria-label={`Switch to ${dark ? "light" : "dark"} mode`} onClick={() => setDark(!dark)}
      onPointerDown={(event) => { dragging.current = true; startY.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => { if (dragging.current && startY.current !== null) setDragY(Math.max(-42, Math.min(42, event.clientY - startY.current))); }}
      onPointerUp={finishDrag} onPointerCancel={finishDrag}>
      <span className="theme-orbit-ring" /><span className="theme-object"><span className="theme-crater crater-one" /><span className="theme-crater crater-two" /></span><span className="theme-rays" />
    </button>
    <span className="theme-float-hint">drag {dark ? "up for light" : "down for dark"}</span>
  </div>;
}

function CountUp({ value }: { value: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / 900);
        setCount(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [value]);
  return <span ref={ref}>{count}</span>;
}

function LiveProgress({ value, fill }: { value: number; fill: string }) {
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setActive(true);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="live-progress-track"><div className={`live-progress-fill ${fill} ${active ? "is-active" : ""}`} style={{ "--progress": `${value}%` } as React.CSSProperties} /></div>;
}

function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`gsap-reveal ${className}`}>{children}</div>;
}

const statusLabel: Record<Status, string> = { pending: "Pending", review: "Under review", progress: "In progress", resolved: "Resolved" };

function Badge({ value, type = "priority" }: { value: string; type?: "priority" | "status" }) {
  return <span className={`badge badge-${value}`}>{type === "status" ? statusLabel[value as Status] : value}</span>;
}

function ModernSelect({ value, onChange, options, placeholder, disabled = false, className = "" }: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const selected = options.find(option => option.value === value);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  return <div ref={selectRef} className={`modern-select ${open ? "is-open" : ""} ${disabled ? "is-disabled" : ""} ${className}`}>
    <button type="button" className="modern-select-trigger" aria-haspopup="listbox" aria-expanded={open} disabled={disabled} onClick={() => setOpen(current => !current)}>
      <span className={selected ? "" : "is-placeholder"}>{selected?.label ?? placeholder}</span><span className="modern-select-chevron" />
    </button>
    {open && <div className="modern-select-menu" role="listbox">
      {options.map(option => <button type="button" role="option" aria-selected={option.value === value} className={`modern-select-option ${option.value === value ? "is-selected" : ""}`} key={option.value} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}
    </div>}
  </div>;
}

function AuthModal({ role, onClose, onEnter }: { role: Role; onClose: () => void; onEnter: (role: Role) => Promise<void> }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [authRole, setAuthRole] = useState<Role>(role === "admin" ? "student" : role);
  const [name, setName] = useState("");
  const [email, setEmail] = useState(role === "admin" ? "admin@fixko.test" : "");
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const authTabs: Array<"signin" | "signup"> = role === "admin" ? ["signin"] : ["signin", "signup"];
  const submit = async () => {
    setError("");
    setSubmitting(true);
    try {
      const response = mode === "signin"
        ? await login(email, password)
        : await signup({ name, email, school_id: schoolId, password, password_confirmation: passwordConfirmation, role: "student" });
      if (!response.token) throw new Error("No access token was returned.");
      window.localStorage.setItem("fixko-token", response.token);
      if (response.user) window.localStorage.setItem("fixko-user", JSON.stringify(response.user));
      await onEnter(response.user.role === "technician" || response.user.role === "admin" ? "admin" : "student");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-7">
        <div className="mb-6 flex items-start justify-between">
          <div><span className="eyebrow">{role === "admin" ? "STAFF & ADMIN PORTAL" : "GET STARTED"}</span><h2 className="mt-3 text-2xl font-extrabold">{mode === "signin" ? "Welcome back" : "Create your account"}</h2></div>
          <button className="text-xl text-slate-400" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className={`mb-5 grid border-b border-slate-200 ${role === "admin" ? "grid-cols-1" : "grid-cols-2"}`}>
          {authTabs.map((item) => <button key={item} onClick={() => setMode(item)} className={`border-b-2 py-3 text-sm font-bold ${mode === item ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-400"}`}>{item === "signin" ? "Sign in" : "Sign up"}</button>)}
        </div>
        <div className="space-y-4">
          {mode === "signup" && <label className="block text-sm font-bold">Full name<input value={name} onChange={event => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3" required /></label>}
          <label className="block text-sm font-bold">{role === "admin" ? "Admin username or email" : "School email"}<input value={email} onChange={event => setEmail(event.target.value)} type="email" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3 outline-none focus:border-indigo-500" placeholder={role === "admin" ? "admin@school.edu.ph" : "you@school.edu.ph"} required /></label>
          {mode === "signup" && role !== "admin" && <label className="block text-sm font-bold">Student ID<input value={schoolId} onChange={event => setSchoolId(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3" placeholder="2026-00001" required /></label>}
          <label className="block text-sm font-bold">Password<input value={password} onChange={event => setPassword(event.target.value)} type="password" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3" placeholder="••••••••" required /></label>
          {mode === "signup" && <label className="block text-sm font-bold">Confirm password<input value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} type="password" className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-3" required /></label>}
          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">{error}</p>}
          <button className="btn-primary w-full" type="button" disabled={submitting} onClick={submit}>{submitting ? "Connecting..." : mode === "signin" ? "Sign in" : "Create account"} →</button>
        </div>
        <p className="mt-5 text-center text-xs text-slate-400">{role === "admin" ? "Admin accounts are pre-built by the school." : "School email and ID are checked before access is granted."}</p>
      </div>
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
        .fromTo(".signin-loader-logo", { autoAlpha: 0, scale: .55, rotationY: -45, rotationX: 20 }, { autoAlpha: 1, scale: 1, rotationY: 0, rotationX: 0, duration: .8, ease: "back.out(1.7)" })
        .to(".signin-loader-logo", { rotationY: 360, rotationX: 8, duration: 1.35, ease: "power2.inOut" }, "-=.2")
        .fromTo(".signin-loader-copy", { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: .45, ease: "power2.out" }, "-=.65")
        .to(".signin-loader-ring", { rotation: 360, duration: 1.8, repeat: -1, ease: "none" }, 0);
    }, root);
    return () => ctx.revert();
  }, []);
  return <div ref={loaderRef} className="signin-loader" role="status" aria-live="polite">
    <div className="signin-loader-backdrop" />
    <div className="signin-loader-content">
      <div className="signin-loader-logo" aria-hidden="true">
        <span className="signin-loader-ring" />
        <span className="signin-loader-face signin-loader-face-back">FX</span>
        <span className="signin-loader-face signin-loader-face-front">FX</span>
      </div>
      <div className="signin-loader-copy"><strong>Welcome to Fixko</strong><span>Preparing your {role === "admin" ? "admin" : "student"} workspace...</span><i><b /></i></div>
    </div>
  </div>;
}

function Landing({ onAuth }: { onAuth: (role: Role) => void }) {
  const [step, setStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
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
        <a href="#pulse" className="nav-brand flex items-center gap-2"><span className="brand-shell"><span className="brand-mark-modern">FX</span><span className="nav-live-orb" /></span><strong className="text-lg">Fixko</strong></a>
        <div className={`nav-links-modern ${mobileMenuOpen ? "open" : ""}`}>{[["pulse", "Campus pulse"], ["features", "Features"], ["how", "How it works"], ["roles", "For your school"], ["verification", "Verification"], ["faq", "FAQ"]].map(([id, label]) => <a className={`nav-link-modern ${activeNav === id ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)} key={id} href={`#${id}`}>{label}<span className="nav-link-glow" /></a>)}</div>
        <div className="ml-auto flex items-center gap-2"><button className="btn-secondary hidden sm:block" onClick={() => onAuth("student")}>Sign in</button><button className="btn-primary" onClick={() => onAuth("student")}>Get started <Icon name="arrow" size={15} /></button><button className="nav-menu-button" aria-label="Toggle navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /><span /></button></div>
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
        <div className="mt-8 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => onAuth("student")}>Get started</button><a className="btn-secondary" href="#how">See how it works</a></div>
      </motion.div>
      <motion.div ref={statusBoardRef} className="status-board card relative p-7 lg:min-h-[404px]">
        <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><span className="live-pulse" />Campus status board <span className="ml-auto rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-600">LIVE</span></div>
        {[["Open tickets", 42, "text-amber-600", "bg-amber-50"], ["In progress", 18, "text-indigo-600", "bg-indigo-50"], ["Critical, unresolved", 3, "text-rose-600", "bg-rose-50"], ["Resolved this term", 231, "text-emerald-600", "bg-emerald-50"]].map(([label, value, color, bg]) => <div className="hero-stat-item status-row flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0" key={label as string}><span className="flex items-center gap-3 text-sm text-slate-500"><span className={`status-dot ${bg}`} />{label}</span><strong className={`text-3xl ${color}`}><CountUp value={value as number} /></strong></div>)}
        <div className="flex items-center justify-between border-b border-slate-100 py-2.5"><span className="text-sm text-slate-500">Avg. time to resolve</span><strong className="text-3xl text-slate-900">2.4d</strong></div>
        <p className="mt-3 text-center text-[11px] text-slate-400">Sample data shown for illustration — your board reflects your campus.</p>
      </motion.div>
    </section>
    <div className="feature-rail"><div className="feature-rail-inner">{[["Built for school email domains","indigo"],["Mobile-friendly reporting","teal"],["Role-based access","amber"],["Exportable ticket & inventory data","rose"]].map(([label, tone], index) => <span className={`feature-rail-item rail-${tone}`} key={label}><i>✓</i><b>{label}</b>{index < 3 && <em />}</span>)}</div></div>
    <Reveal><section className="mx-auto max-w-[1440px] px-8 pb-8 pt-14" id="pulse">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black">Your campus, at a glance</h2><p className="mt-2 text-sm text-slate-600">Live signals help facilities teams decide what needs attention first.</p></div>
        <button className="text-sm font-bold text-indigo-600" onClick={() => onAuth("student")}>Preview the dashboard →</button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "REPORTS THIS WEEK", value: 64, status: "+18%", text: "Most reports are being resolved before they become repeat issues.", fill: "live-fill-indigo", progress: 76, caption: "Trending upward" },
          { label: "RESOLVED ON TIME", value: 87, status: "On track", text: "Teams can see overdue work early and keep students in the loop.", fill: "live-fill-emerald", progress: 87, caption: "SLA performance" },
          { label: "BUSIEST LOCATION", value: null, displayValue: "Room 204", status: "Watch", text: "3 open tickets are grouped together so admins can spot patterns.", fill: "live-fill-amber", progress: 72, caption: "Needs attention" }
        ].map(({ label, value, displayValue, status, text, fill, progress, caption }) => <motion.article whileHover={{ y: -6 }} className="pulse-card card p-5" key={label}><div className="flex items-center justify-between"><span className="text-xs font-black tracking-wider text-slate-400">{label}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">{status}</span></div><strong className="mt-4 block text-3xl font-black">{value === null ? displayValue : <><CountUp value={value} />{label === "RESOLVED ON TIME" ? "%" : ""}</>}</strong><p className="mt-2 text-sm leading-5 text-slate-500">{text}</p><LiveProgress value={progress} fill={fill} /><small className="mt-3 block text-xs font-semibold text-slate-400">{caption}</small></motion.article>)}
      </div>
    </section></Reveal>
    <Reveal><section className="mx-auto max-w-6xl px-6 py-20" id="features"><div className="mx-auto mb-10 max-w-2xl text-center"><span className="eyebrow"><Icon name="spark" size={13} /> Features</span><h2 className="mt-4 text-3xl font-black">Everything a facilities team actually needs</h2><p className="mt-3 text-slate-600">Fixko is the full loop — from the first report to the repair log and the numbers that show what keeps breaking.</p></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[["clipboard","Facility reporting","Report damage or missing items in seconds, with an optional photo attached."],["activity","Ticket tracking","Every report moves through Pending, Review, Progress, and Resolved."],["chart","Analytics dashboard","See recurring issues, departments, and resolution time at a glance."],["alert","Priority & duplicate alerts","Flag severity and warn when similar tickets are already open."],["box","Inventory & repair log","Track equipment condition and keep a history of repairs."]].map(([icon, title, text], index) => <motion.div whileHover={{ y: -5, scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }} className="feature-card-modern card p-6" key={title}><div className={`feature-icon-modern ${index % 2 ? "sky" : index === 4 ? "rose" : "indigo"}`}><Icon name={icon as IconName} size={20} /></div><h3 className="font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p><span className="feature-link">Explore feature <Icon name="arrow" size={14} /></span></motion.div>)}</div></section></Reveal>
    <Reveal><section className="how-modern relative mx-auto grid max-w-7xl gap-10 overflow-hidden px-6 py-20 lg:grid-cols-[.82fr_1.18fr] lg:px-10" id="how">
      <div className="how-orb how-orb-one" /><div className="how-orb how-orb-two" /><div className="how-ring" />
      <div className="relative z-10">
        <span className="eyebrow how-eyebrow">A calmer way to get things fixed</span>
        <h2 className="mt-4 max-w-xl text-4xl font-black leading-tight sm:text-5xl">One clear path from <span className="how-gradient-text">“something’s broken”</span> to “all fixed.”</h2>
        <p className="mt-5 max-w-lg text-base leading-7 text-slate-500">Every report moves through a visible workflow, so students know what happens next and staff can act before small issues become expensive ones.</p>
        <div className="how-steps mt-9">{steps.map((item, index) => <button key={item} onClick={() => setStep(index)} className={`guide-tab how-step ${step === index ? "active" : ""}`}>
          <span className={`how-step-number step-tone-${index} ${step === index ? "selected" : ""}`}>{String(index + 1).padStart(2, "0")}</span>
          <span className="how-step-copy"><strong>{item}</strong><small>{["Scan a QR code or pick a room, describe the issue, and set a priority.","Admins see it instantly, check duplicates, and assign a technician.","Follow status updates and message the technician on the ticket.","Rate the repair once it is fixed, feeding the analytics dashboard."][index]}</small><span className="guide-progress-track"><span className={`guide-progress step-progress-${index} ${step === index ? "running" : ""}`} /></span></span>
          <span className="how-step-arrow"><Icon name="arrow" size={16} /></span>
        </button>)}</div>
      </div>
      <motion.div key={step} className="how-preview-wrap relative z-10">
        <div className="preview-float-card preview-float-top"><span className="preview-dot dot-green" /> Live update <strong>2m ago</strong></div>
        <div className="how-preview card">
          <div className="how-preview-head"><div><p className="text-xs font-black uppercase tracking-[.18em] text-slate-400">Ticket FX-1042</p><h3 className="mt-2 text-xl font-black">{steps[step]}</h3></div><span className={`preview-status status-${step}`}>{step === 3 ? "Resolved" : step === 2 ? "In progress" : step === 1 ? "Reviewing" : "New report"}</span></div>
          <div className="preview-surface">{step === 0 && <><div className="preview-form-icon"><span className="css-icon css-camera" /></div><label className="preview-label">What's the issue?</label><div className="preview-input">Aircon leaking onto floor <span className="preview-caret" /></div><label className="preview-label">Priority</label>          <div className="preview-priority-options"><Badge value="low" /><Badge value="medium" /><Badge value="critical" /></div><div className="upload-preview mt-5"><span className="css-icon css-camera" /> photo_attached.jpg <Icon name="check" size={14} /></div></>}{step === 1 && <><div className="preview-ticket-row"><span className="preview-avatar">RA</span><span><strong>Aircon leaking onto floor</strong><small>Room 204 · just now</small></span><Badge value="critical" /></div><div className="preview-alert"><span className="css-icon css-alert" /> 2 similar reports already open for Room 204.</div><div className="preview-assignee"><span className="preview-avatar teal">RA</span><span><strong>R. Aquino</strong><small>Assigned technician</small></span><Icon name="check" size={16} /></div></>}{step === 2 && <><div className="preview-progress-label"><span>Repair progress</span><strong>75%</strong></div><div className="preview-progress"><span /></div><div className="preview-timeline"><span className="timeline-pulse" /><div><strong>Technician is on the way</strong><small>R. Aquino · checking the unit this afternoon</small></div></div><div className="preview-message">“On it — checking the unit this afternoon.”</div></>}{step === 3 && <><div className="resolved-burst"><span className="resolved-check"><Icon name="check" size={24} /></span><strong>Issue resolved</strong><small>Closed in 4h 12m</small></div><div className="rating-stars" aria-label="5 out of 5 stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div><div className="preview-message">“Fixed same day, thank you!”</div></>}</div>
        </div>
        <div className="preview-float-card preview-float-bottom"><span className="preview-icon"><Icon name="activity" size={16} /></span><span><strong>Campus pulse</strong><small>12 reports moving today</small></span><span className="mini-bars"><i /><i /><i /><i /></span></div>
      </motion.div>
    </section></Reveal>
    <Reveal><section className="mx-auto max-w-6xl px-6 py-16" id="roles"><div className="mb-9 text-center"><span className="eyebrow">Built for every role</span><h2 className="mt-4 text-3xl font-black">One system for reporting and campus operations</h2><p className="mt-3 text-slate-600">Each account sees exactly what is relevant to them — nothing more.</p></div><div className="grid gap-4 md:grid-cols-2">{[["Students","Report and track your own tickets",["Submit a report with photo and priority in under a minute","See the status of everything you've reported","Message the technician on your ticket","Rate the repair once it's resolved"]],["Admins","Full visibility and control across campus",["See every report campus-wide with live progress","Assign technicians and update ticket status","Track building conditions and repair history","Export tickets and view analytics"]]].map(([title, sub, items], i) => <motion.div whileHover={{ y: -5 }} className={`card role-card border-t-4 p-7 ${i === 1 ? "border-t-slate-900" : "border-t-indigo-600"}`} key={title as string}><h3 className="text-xl font-black">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-400">{sub}</p><ul className="mt-5 space-y-3">{(items as string[]).map(item => <li className="flex gap-2 text-sm leading-5 text-slate-600" key={item}><span className="font-black text-emerald-500">✓</span>{item}</li>)}</ul></motion.div>)}</div></section></Reveal>
    <Reveal><section className="verification-modern relative mx-auto max-w-7xl overflow-hidden px-6 py-20 lg:px-10" id="verification">
      <div className="verification-glow verification-glow-one" /><div className="verification-glow verification-glow-two" />
      <div className="relative z-10 mx-auto mb-12 max-w-3xl text-center"><span className="eyebrow verification-eyebrow"><Icon name="shield" size={14} /> Trust & verification</span><h2 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">Access stays trusted, so every report stays useful.</h2><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-500">Fixko verifies every account before access is granted, keeping campus reporting clear and secure.</p></div>
      <div className="verification-grid relative z-10">
        <div className="verification-card verification-requirements">
          <div className="verification-card-head"><span className="verification-card-icon"><Icon name="id" size={20} /></span><div><p className="verification-kicker">Account verification</p><h3>What we check before access</h3></div><span className="verification-lock"><Icon name="shield" size={16} /></span></div>
          <div className="verification-items">{[["mail","School email","Matches your school’s verified domain automatically."],["hash","Student ID","Confirms the identifier held by the school."],["id","Verified account","Keeps reports connected to a trusted reporter."]].map(([icon, title, text], index) => <div className="verification-item" key={title}><span className={`verification-item-icon verification-tone-${index}`}><Icon name={icon as IconName} size={17} /></span><div><strong>{title}</strong><p>{text}</p></div><Icon name="check" size={16} /></div>)}</div>
          <div className="verification-note"><span className="note-pulse" /> Verified details help the right people see the right reports.</div>
        </div>
        <div className="verification-card verification-process">
          <div className="verification-card-head"><span className="verification-card-icon process-icon"><Icon name="activity" size={20} /></span><div><p className="verification-kicker">A clear review path</p><h3>What happens after sign-up</h3></div><span className="process-live"><i /> Live</span></div>
          <div className="verification-track"><span className="track-line" /><div className="verification-stage stage-done"><span><Icon name="check" size={14} /></span><strong>Submitted</strong><small>Details received</small></div><div className="verification-stage stage-review"><span><Icon name="activity" size={14} /></span><strong>Under review</strong><small>Admin checks records</small></div><div className="verification-stage stage-next"><span><Icon name="shield" size={14} /></span><strong>Verified</strong><small>Access granted</small></div></div>
          <div className="verification-message"><span className="verification-message-icon"><Icon name="bell" size={17} /></span><p>Your account starts in a <b>pending</b> state. Once approved, you can safely view and manage the reports assigned to your department.</p></div>
          <div className="verification-proof"><span><Icon name="users" size={15} /> Department-limited visibility</span><span><Icon name="check" size={15} /> Human-reviewed access</span></div>
        </div>
      </div>
    </section></Reveal>
    <Reveal><section className="faq-modern mx-auto max-w-6xl px-6 py-12 lg:px-10 lg:py-14" id="faq"><div className="mb-8 text-center"><span className="eyebrow">FAQ</span><h2 className="mt-4 text-3xl font-black sm:text-4xl">Good to know</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Quick answers for reporters and the teams keeping campus moving.</p></div><div className="faq-grid">{["Who can sign up?","What do students need to sign up?","Why does the report form ask for my ID again?","Can I report anonymously?","What happens after I submit a report?","Can admins export the data?"].map((question, index) => <div className="faq-card" key={question}><button className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-bold sm:p-5" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><span className={`faq-plus ${openFaq === index ? "open" : ""}`}>+</span></button><div className={`faq-answer ${openFaq === index ? "open" : ""}`}><p>{["Students sign up with their school email. Admin accounts are pre-built by the school.","Just your school email and Student Number.","It is a verification step on every ticket. The field is pre-filled but remains editable.","No. Every report is tied to a verified account so admins can follow up.","It is checked for duplicates and moves through Pending, Review, In progress, and Resolved.","Yes — admins can export tickets to CSV."][index]}</p></div></div>)}</div></section></Reveal>
    <section className="cta-band cta-wide mx-4 mb-12 mt-8 rounded-2xl px-6 py-8 text-white lg:mx-auto lg:max-w-[1700px] lg:px-14 lg:py-10">
      <div className="cta-orbit cta-orbit-one" />
      <div className="cta-orbit cta-orbit-two" />
      <div className="relative z-10 grid items-center gap-7 lg:grid-cols-[1.2fr_.8fr]">
        <div className="text-left">
          <span className="cta-kicker"><Icon name="spark" size={14} /> Make every campus issue easier to fix</span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl lg:text-[2.65rem]">Turn “someone should report this” into <span className="text-indigo-200">“it’s already being fixed.”</span></h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">Give your campus one trusted place to speak up, while your facilities team gets the context, priority, and visibility to act faster.</p>
          <div className="mt-5 flex flex-wrap gap-3"><button className="cta-primary-button" onClick={() => onAuth("student")}>Start reporting smarter <Icon name="arrow" size={16} /></button><button className="cta-secondary-button" onClick={() => onAuth("student")}>Sign in to Fixko</button></div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-indigo-200"><span><Icon name="check" size={14} /> School-ready setup</span><span><Icon name="check" size={14} /> Verified accounts</span><span><Icon name="check" size={14} /> No setup fee</span></div>
        </div>
        <div className="cta-proof-panel">
          <div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-indigo-200">Why schools choose Fixko</span><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Built for campus</span></div>
          <div className="mt-4 space-y-3"><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="activity" size={17} /></span><div><strong>Faster response</strong><p>Every issue reaches the right people with clear next steps.</p></div></div><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="users" size={17} /></span><div><strong>More trust</strong><p>Keep reporters informed from submission to resolution.</p></div></div><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="chart" size={17} /></span><div><strong>Better decisions</strong><p>Use real patterns to prevent repeat facility problems.</p></div></div></div>
        </div>
      </div>
    </section>
    <footer className="site-footer"><div className="footer-glow footer-glow-one" /><div className="footer-glow footer-glow-two" /><div className="footer-topline"><span><i /> Fixing the small things that keep campus moving</span><span className="footer-status"><Icon name="shield" size={14} /> Built for trusted school communities</span></div><div className="footer-grid"><div className="footer-brand"><div className="flex items-center gap-2"><div className="brand-mark-modern">FX</div><strong className="text-lg text-white">Fixko</strong></div><p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Facility reporting and ticket management built for schools — from the first report to the repair log.</p><div className="footer-brand-meta"><span><Icon name="activity" size={14} /> Clear status</span><span><Icon name="users" size={14} /> One campus view</span></div><div className="mt-5 flex gap-2"><a className="social social-mail" href="#faq" aria-label="Email Fixko"><Icon name="mail" size={16} /></a><a className="social" href="#roles" aria-label="Fixko on Facebook">f</a><a className="social" href="#features" aria-label="Fixko on X">𝕏</a></div></div>{[["Product","Features","How it works","For students","For admins"],["Resources","FAQ","Report an issue","Contact support"],["Company","About Fixko","Contact us","Feedback"],["Legal","Privacy policy","Terms of use","Data handling"]].map(([heading, ...links]) => <div className="footer-column" key={heading}><h4 className="text-xs font-black uppercase tracking-wider text-white">{heading}</h4><ul className="mt-5 space-y-3">{links.map(link => <li key={link}><a className="text-sm text-slate-400 transition hover:text-white" href={`#${link === "Features" ? "features" : link === "How it works" ? "how" : link === "FAQ" ? "faq" : "roles"}`}>{link}<span>→</span></a></li>)}</ul></div>)}</div><div className="footer-note"><span>Prototype environment</span><p>This page uses illustrative sample data and is not connected to a live database.</p></div><div className="footer-bottom"><span>© 2026 Fixko. Built for schools.</span><span>Have access questions? <button onClick={() => onAuth("admin")}>Open staff & admin portal <Icon name="arrow" size={13} /></button></span></div></footer>
  </main>;
}

function AppShell({ role, onSignOut }: { role: Role; onSignOut: () => void }) {
  const [page, setPage] = useState(role === "admin" ? "All reports" : "Dashboard");
  const [statusFilter, setStatusFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [liveTickets, setLiveTickets] = useState<Ticket[]>([]);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [dataError, setDataError] = useState("");
  const headerRef = useRef<HTMLElement>(null);
  const nav = role === "admin" ? ["All reports", "Operations insights", "Users", "Notifications"] : ["Dashboard", "New report", "My tickets", "Notifications"];
  const visible = useMemo(() => liveTickets.filter((t) => (statusFilter === "all" || t.status === statusFilter) && `${t.id} ${t.title} ${t.room} ${t.reporter}`.toLowerCase().includes(query.toLowerCase())), [liveTickets, query, statusFilter]);
  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return [
      ...nav.filter(item => item.toLowerCase().includes(term)).map(item => ({ type: "Workspace", label: item, detail: "Open workspace" })),
      ...liveTickets.filter(ticket => `${ticket.id} ${ticket.title} ${ticket.room} ${ticket.reporter}`.toLowerCase().includes(term)).slice(0, 4).map(ticket => ({ type: "Ticket", label: `${ticket.id} · ${ticket.title}`, detail: `${ticket.room} · ${statusLabel[ticket.status]}` }))
    ].slice(0, 6);
  }, [liveTickets, nav, query]);
  const open = liveTickets.filter(t => t.status !== "resolved").length;
  useEffect(() => {
    Promise.all([getTickets(), getRooms(), getNotifications()])
      .then(([ticketResponse, roomResponse, notificationResponse]) => {
        setLiveTickets(ticketResponse.data.map(mapApiTicket));
        setRooms(roomResponse);
        setNotifications(notificationResponse.data);
      })
      .catch(error => setDataError(error instanceof Error ? error.message : "Live data could not be loaded."));
  }, []);
  useEffect(() => {
    const savedHistory = window.localStorage.getItem("fixko-search-history");
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
  }, []);
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
    const nextHistory = [term, ...searchHistory.filter(item => item.toLowerCase() !== term.toLowerCase())].slice(0, 6);
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
  const handleStatusUpdated = async (ticket: Ticket, status: Status) => {
    const backendStatus = status === "review" ? "under_review" : status === "progress" ? "in_progress" : status;
    const numericId = ticket.id.replace(/^FX-0*/, "");
    const response = await updateTicketStatus(numericId, backendStatus);
    const nextTicket = mapApiTicket(response);
    setLiveTickets(current => current.map(item => item.id === ticket.id ? nextTicket : item));
  };
  const displayRole = role === "admin" ? "Admin" : "Student";
  const accountLabel = role === "admin" ? "Admin account" : "Student account";
  const accountInitials = role === "admin" ? "AD" : "ST";
  return <div className="app-shell min-h-screen">
    <header ref={headerRef} className="app-header site-nav sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex min-h-[70px] w-full max-w-[1700px] items-center gap-4 px-5 lg:px-10">
        <a className="nav-brand flex items-center gap-2" href="#" onClick={() => choosePage(role === "admin" ? "All reports" : "Dashboard")}><span className="brand-shell"><span className="brand-mark-modern">FX</span><span className="nav-live-orb" /></span><strong className="text-lg">Fixko</strong></a>
        <div className={`app-nav-links nav-links-modern ${mobileMenuOpen ? "open" : ""}`}>{nav.map(item => <button key={item} onClick={() => choosePage(item)} className={`nav-link-modern ${page === item ? "active" : ""}`}>{item}<span className="nav-link-glow" /></button>)}</div>
        <div className="app-search-wrap">
          <div className={`app-search ${searchOpen ? "is-open" : ""}`}><Icon name="search" size={17} /><input value={query} onFocus={() => setSearchOpen(true)} onChange={event => { setQuery(event.target.value); setSearchOpen(true); }} onKeyDown={event => { if (event.key === "Enter") saveSearch(query); if (event.key === "Escape") { setSearchOpen(false); event.currentTarget.blur(); } }} placeholder="Search tickets and workspaces" aria-label="Search tickets and workspaces" /></div>
          <div className={`app-search-panel ${searchOpen ? "is-open" : ""}`}>{query.trim() ? searchResults.length ? <><p className="app-search-heading">Search results</p>{searchResults.map(result => <button className="app-search-result" key={`${result.type}-${result.label}`} onClick={() => { saveSearch(query); if (result.type === "Workspace") choosePage(result.label); setSearchOpen(false); }}><span className="app-search-result-icon">{result.type === "Ticket" ? <Icon name="clipboard" size={15} /> : <Icon name="grid" size={15} />}</span><span><strong>{result.label}</strong><small>{result.detail}</small></span><em>{result.type}</em></button>)}</> : <p className="app-search-empty">No tickets or workspaces found.</p> : searchHistory.length ? <><p className="app-search-heading">Recent searches</p>{searchHistory.map(item => <button className="app-search-result" key={item} onClick={() => setQuery(item)}><span className="app-search-result-icon"><Icon name="activity" size={15} /></span><span><strong>{item}</strong><small>Previous search</small></span><em>History</em></button>)}</> : <p className="app-search-empty">Your recent searches will appear here.</p>}</div>
        </div>
        <div className="app-header-actions ml-auto flex items-center gap-2">
        <div className="app-header-menu">
          <button onClick={() => { setNotificationsOpen(open => !open); setProfileOpen(false); setSearchOpen(false); }} className={`app-notification relative text-slate-500 ${notificationsOpen ? "is-open" : ""}`} aria-label="Open notifications" aria-expanded={notificationsOpen}><Icon name="bell" size={18} /></button>
          <div className={`app-dropdown app-notification-dropdown ${notificationsOpen ? "is-open" : ""}`}><div className="app-dropdown-heading"><span><strong>Notifications</strong><small>Stay up to date with your campus</small></span></div><div className="app-dropdown-empty"><span><Icon name="bell" size={17} /></span><strong>You're all caught up</strong><small>New updates will appear here.</small></div><button className="app-dropdown-link" onClick={() => choosePage("Notifications")}>View all notifications <Icon name="arrow" size={14} /></button></div>
        </div>
        <div className="app-header-menu hidden sm:block">
        <button onClick={() => { setProfileOpen(open => !open); setNotificationsOpen(false); setSearchOpen(false); }} className={`app-profile items-center gap-2 ${profileOpen ? "is-open" : ""}`} aria-label="Open profile menu" aria-expanded={profileOpen}>
          <div className="app-profile-avatar">{accountInitials}<span className="app-profile-status" /></div>
          <div className="app-profile-copy hidden text-left xl:block"><span className="app-profile-kicker">SIGNED IN AS</span><strong>{accountLabel}</strong><small>{displayRole} <i>|</i> Active now</small></div>
          <span className="app-profile-chevron hidden xl:block" aria-hidden="true" />
        </button>
        <div className={`app-dropdown app-profile-dropdown ${profileOpen ? "is-open" : ""}`}><div className="app-dropdown-profile"><div className="app-profile-avatar">{accountInitials}</div><div><strong>{accountLabel}</strong><small>{displayRole}</small></div></div><div className="app-dropdown-divider" /><button className="app-dropdown-action" onClick={onSignOut}><Icon name="logout" size={16} /> Sign out</button></div>
        </div>
          <button className="nav-menu-button" aria-label="Toggle navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /><span /></button>
        </div>
      </div>
    </header>
    <main className="app-main w-full p-5 lg:p-9"><div className="mx-auto max-w-[1500px]">{dataError && <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">{dataError}</div>}<motion.div key={page} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .38, ease: [.2, .8, .2, 1] }}>{page === "New report" ? <ReportForm rooms={rooms} ticketData={liveTickets} onSubmitted={(ticket) => { setLiveTickets(current => [mapApiTicket(ticket), ...current.filter(item => item.id !== `FX-${String(ticket.id).padStart(4, "0")}`)]); choosePage("My tickets"); }} /> : page === "All reports" && role === "admin" ? <AdminOverview tickets={liveTickets} rooms={rooms} onViewReports={() => choosePage("Operations insights")} onOpenPage={choosePage} /> : page === "Operations insights" && role === "admin" ? <OperationsInsights tickets={liveTickets} rooms={rooms} onStatusUpdated={handleStatusUpdated} /> : page === "My tickets" ? <MyTickets ticketData={liveTickets} /> : page === "Users" ? <Users /> : page === "Notifications" ? <Notifications notifications={notifications} /> : <StudentDashboard ticketData={liveTickets} rooms={rooms} onNewReport={() => choosePage("New report")} onViewTickets={() => choosePage("My tickets")} />}{/* end workspace */}</motion.div><footer className="app-footer"><div className="app-footer-brand"><span className="brand-mark-modern">FX</span><div><strong>Fixko</strong><p>Small reports. Faster fixes. Better campus spaces.</p></div></div><div className="app-footer-links"><button onClick={() => choosePage("Notifications")}>Updates <span>→</span></button><button onClick={() => choosePage("New report")}>Report an issue <span>→</span></button><a href="mailto:support@fixko.school">Support <span>→</span></a></div><div className="app-footer-bottom"><span>{role === "admin" ? "Campus operations workspace" : "Your campus reporting workspace"}</span><span>© 2026 Fixko · Trusted school communities</span></div></footer></div></main>
  </div>;
}

function ReportForm({ rooms, ticketData, onSubmitted }: { rooms: ApiRoom[]; ticketData: Ticket[]; onSubmitted: (ticket: ApiTicket) => void }) {
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
    formRef.current?.reset();
  };
  const buildingOptions = Array.from(new Set(rooms.map(item => item.building))).map(item => ({ value: item, label: item }));
  const floorOptions = Array.from(new Set(rooms.filter(item => item.building === building).map(item => item.floor).filter(Boolean))).map(item => ({ value: item as string, label: `Floor ${item}` }));
  const roomChoices = rooms.filter(item => item.building === building && (!floor || item.floor === floor));
  const locationComplete = Boolean(department && building && floor && room);
  const issueComplete = Boolean(item && condition && description.trim());
  const completedSteps = Number(locationComplete) + Number(issueComplete);
  const completionPercent = Math.round((completedSteps / 2) * 100);
  const currentStep = locationComplete ? (issueComplete ? 3 : 2) : 1;
  return <div className="report-form-page">
    <CampusMap compact tickets={ticketData} rooms={rooms} />
    <div className="report-progress-card"><div className="report-progress-copy"><div><span className="report-progress-kicker">NEW REPORT</span><strong>{completionPercent}% ready to submit</strong><small>{currentStep === 3 ? "Review your report preview, then submit." : `Complete step ${currentStep} to keep moving.`}</small></div><span className="report-progress-count">{completedSteps}/2</span></div><div className="report-progress-track"><span style={{ width: `${completionPercent}%` }} /></div><div className="report-progress-steps"><span className={locationComplete ? "is-complete" : currentStep === 1 ? "is-current" : ""}><i>{locationComplete ? "✓" : "1"}</i>Location</span><span className={issueComplete ? "is-complete" : currentStep === 2 ? "is-current" : ""}><i>{issueComplete ? "✓" : "2"}</i>Issue details</span><span className={currentStep === 3 ? "is-current" : ""}><i>3</i>Review</span></div></div>
    {submitted ? <div className="card report-success-card"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-600">✓</div><h2 className="mt-5 text-2xl font-black">Report submitted</h2><p className="mt-2 text-slate-500">Your report was saved and routed to the maintenance queue.</p></div> : <form ref={formRef} className="report-form-layout" onSubmit={async event => { event.preventDefault(); const user = JSON.parse(window.localStorage.getItem("fixko-user") || "null") as ApiUser | null; const selectedRoom = rooms.find(item => String(item.id) === room); if (!user || !selectedRoom) return; try { const createdTicket = await createTicket({ school_id: user.school_id, email: user.email, room_id: selectedRoom.id, category: department, item_name: item, condition, quantity: Number(quantity), description, priority: priority as "low" | "medium" | "high" | "critical" }); setSubmitted(true); onSubmitted(createdTicket); } catch (error) { window.alert(error instanceof Error ? error.message : "Report submission failed."); } }}>
      <div className="report-form-main">
        <section className={`report-form-section ${locationComplete ? "is-complete" : ""}`}><div className="report-form-section-heading"><div><h3>Where is it?</h3><p>Pick the department and exact location.</p></div><span className="report-form-step">{locationComplete ? "✓" : "01"}</span></div><div className="report-form-fields">        <label>College department<ModernSelect value={department} onChange={setDepartment} placeholder="Select your department" options={collegeDepartments.map(item => ({ value: item, label: item }))} /></label><label>Building<ModernSelect value={building} onChange={value => { setBuilding(value); setFloor(""); setRoom(""); }} placeholder="Select a building" options={buildingOptions} /></label><label>Level / floor<ModernSelect value={floor} disabled={!building} onChange={value => { setFloor(value); setRoom(""); }} placeholder={building ? "Select a floor" : "Select a building first"} options={floorOptions} /></label><label>Room<ModernSelect value={room} disabled={!floor} onChange={setRoom} placeholder={floor ? "Select a room" : "Select a floor first"} options={roomChoices.map(roomItem => ({ value: String(roomItem.id), label: roomItem.name }))} /></label></div></section>
        <section className={`report-form-section ${issueComplete ? "is-complete" : ""}`}><div className="report-form-section-heading"><div><h3>What is the problem?</h3><p>Be as specific as you can so it gets fixed faster.</p></div><span className="report-form-step">{issueComplete ? "✓" : "02"}</span></div><div className="report-form-fields">                <label>Item<ModernSelect value={item} onChange={setItem} placeholder="Select an item" options={["Air conditioning", "Chair or desk", "Projector or screen", "Lighting", "Window or door", "Other"].map(item => ({ value: item, label: item }))} /></label><label>Condition<ModernSelect value={condition} onChange={setCondition} placeholder="Select condition" options={["Broken", "Damaged", "Missing", "Needs maintenance"].map(item => ({ value: item, label: item }))} /></label><label className="report-quantity">How many items?<input type="number" min="1" value={quantity} onChange={event => setQuantity(event.target.value)} /></label><label className="report-description">Description<textarea required value={description} onChange={event => setDescription(event.target.value)} placeholder="Example: The aircon runs but only blows warm air during afternoon classes." /></label></div><fieldset className="report-urgency"><legend>Urgency</legend><div>{["low", "medium", "high"].map(level => <label key={level} className={priority === level ? "is-selected" : ""}><input type="radio" name="urgency" value={level} checked={priority === level} onChange={() => setPriority(level)} />{level}</label>)}</div></fieldset></section>
        <section className="report-form-section report-photo-section"><div className="report-form-section-heading"><div><h3>Add a photo <small>(optional)</small></h3><p>A photo helps the maintenance team bring the right tools.</p></div><span className="report-form-step">03</span></div><label className="report-upload"><Icon name="box" size={24} /><strong>Take a photo or upload</strong><small>JPG or PNG, up to 5 MB</small><input type="file" accept="image/png,image/jpeg" /></label></section>
      </div>
      <aside className="report-form-aside"><div className="report-tip-card"><span className="report-aside-icon"><Icon name="spark" size={16} /></span><h3>Tips for a good report</h3><ul><li>Include the room and item number if there is one.</li><li>Say when the problem started.</li><li>Mark it high only if it is unsafe or stops a class.</li></ul></div><div className="report-popular-card"><h3><Icon name="activity" size={15} /> Most reported this month</h3>{[["CMA BUILDING · Room 204", "9 reports"], ["PTC BUILDING · Room 112", "8 reports"], ["CHS BUILDING · Lab 2", "7 reports"]].map(([place, count]) => <div key={place}><span>{place}</span><small>{count}</small></div>)}</div><div className="report-output-card"><div className="report-output-heading"><span className="report-aside-icon"><Icon name="clipboard" size={16} /></span><div><h3>Report preview</h3><p>Review before submitting</p></div></div><div className="report-output-list"><div><span>Location</span><strong>{building ? `${building}${floor ? ` · Floor ${floor}` : ""}${room && room !== "none" ? ` · Room ${room}` : ""}` : "Not selected"}</strong></div><div><span>Issue</span><strong>{item || "Not selected"}{condition ? ` · ${condition}` : ""}</strong></div><div><span>Quantity</span><strong>{quantity || "—"}</strong></div><div><span>Priority</span><span className={`badge badge-${priority}`}>{priority}</span></div></div>{description && <p className="report-output-description">{description}</p>}</div><div className="report-form-actions"><button type="button" className="btn-secondary" onClick={clearReport}>Cancel</button><button type="submit" className="btn-primary">Submit report <Icon name="arrow" size={14} /></button></div></aside>
    </form>}
  </div>;
}

function AdminOverview({ tickets: ticketData, rooms, onViewReports, onOpenPage }: { tickets: Ticket[]; rooms: ApiRoom[]; onViewReports: () => void; onOpenPage: (page: string) => void }) {
  const openTickets = ticketData.filter(ticket => ticket.status !== "resolved");
  const criticalTickets = openTickets.filter(ticket => ticket.priority === "critical");
  const inProgress = ticketData.filter(ticket => ticket.status === "progress");
  const recentTickets = [...ticketData].sort((a, b) => b.createdAt - a.createdAt).slice(0, 5);
  const attentionTickets = [...criticalTickets, ...openTickets.filter(ticket => ticket.priority !== "critical")].slice(0, 4);
  const statCards = [
    { label: "Open reports", value: openTickets.length, note: "Need a next action", icon: "clipboard", tone: "indigo" },
    { label: "Critical attention", value: criticalTickets.length, note: criticalTickets.length ? "Review these first" : "No urgent issues", icon: "alert", tone: "rose" },
    { label: "In progress", value: inProgress.length, note: "Currently being handled", icon: "activity", tone: "teal" },
    { label: "Buildings monitored", value: new Set(rooms.map(room => room.building)).size, note: "Connected buildings", icon: "building", tone: "amber" }
  ] as const;
  return <div className="admin-overview">
    <section className="admin-welcome-card">
      <div><span className="eyebrow"><Icon name="shield" size={13} /> Campus operations</span><h1>{getTimeGreeting()}, admin.</h1><p>Here is the clearest view of what needs attention across campus today.</p></div>
    </section>
    <div className="admin-stat-grid">{statCards.map(card => <article className={`admin-stat-card admin-stat-${card.tone}`} key={card.label}><span className="admin-stat-icon"><Icon name={card.icon} size={18} /></span><div><small>{card.label}</small><strong>{card.value}</strong><p>{card.note}</p></div></article>)}</div>
    <div className="admin-overview-grid">
      <section className="card admin-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-kicker">Priority queue</span><h2>Needs attention</h2><p>Start with the reports most likely to affect classes or safety.</p></div><button className="admin-text-action" onClick={onViewReports}>View analytics <Icon name="arrow" size={14} /></button></div>
        {attentionTickets.length ? <div className="admin-attention-list">{attentionTickets.map(ticket => <div className="admin-attention-row" key={ticket.id}><span className={`admin-attention-mark ${ticket.priority}`}><Icon name={ticket.priority === "critical" ? "alert" : "clipboard"} size={15} /></span><div><strong>{ticket.title}</strong><small>{ticket.id} · {ticket.room} · {ticket.created}</small></div><Badge value={ticket.priority} /><Badge value={ticket.status} type="status" /></div>)}</div> : <div className="admin-empty-state"><span><Icon name="check" size={20} /></span><strong>Nothing urgent right now</strong><p>New reports will appear here as soon as they are submitted.</p></div>}
      </section>
      <section className="card admin-panel admin-quick-panel">
        <div className="admin-panel-heading"><div><span className="admin-panel-kicker">Workspace shortcuts</span><h2>Move faster</h2><p>Common admin actions in one place.</p></div></div>
        <div className="admin-quick-actions"><button onClick={onViewReports}><span><Icon name="chart" size={17} /></span><div><strong>Review analytics</strong><small>Spot recurring issues</small></div><Icon name="arrow" size={14} /></button><button onClick={() => onOpenPage("All reports")}><span><Icon name="building" size={17} /></span><div><strong>Manage buildings</strong><small>View the campus report map</small></div><Icon name="arrow" size={14} /></button><button onClick={() => onOpenPage("Users")}><span><Icon name="users" size={17} /></span><div><strong>Review users</strong><small>Manage campus access</small></div><Icon name="arrow" size={14} /></button></div>
      </section>
    </div>
    <section className="card admin-panel">
      <div className="admin-panel-heading"><div><span className="admin-panel-kicker">Latest activity</span><h2>Recent reports</h2><p>Keep an eye on the newest requests entering the queue.</p></div><span className="admin-count-pill">{ticketData.length} total reports</span></div>
      {recentTickets.length ? <div className="admin-recent-list">{recentTickets.map(ticket => <div className="admin-recent-row" key={ticket.id}><span className={`admin-recent-status ${ticket.status}`} /><div><strong>{ticket.title}</strong><small>{ticket.id} · {ticket.room} · {ticket.reporter}</small></div><span className="admin-recent-date">{ticket.created}</span><Badge value={ticket.status} type="status" /></div>)}</div> : <div className="admin-empty-state"><span><Icon name="clipboard" size={20} /></span><strong>No reports yet</strong><p>The dashboard will update when the first ticket is submitted.</p></div>}
    </section>
  </div>;
}

function OperationsInsights({ tickets, rooms, onStatusUpdated }: { tickets: Ticket[]; rooms: ApiRoom[]; onStatusUpdated: (ticket: Ticket, status: Status) => Promise<void> }) {
  const [building, setBuilding] = useState("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [exportType, setExportType] = useState<"all" | "unresolved" | "resolved">("all");
  const buildings = Array.from(new Set(rooms.map(room => room.building))).sort();
  const filteredTickets = useMemo(() => tickets
    .filter(ticket => {
      const room = rooms.find(item => item.name === ticket.room);
      return (building === "all" || room?.building === building)
        && `${ticket.id} ${ticket.title} ${ticket.room} ${ticket.reporter} ${ticket.description}`.toLowerCase().includes(search.toLowerCase());
    })
    .sort((first, second) => sortOrder === "newest" ? second.createdAt - first.createdAt : first.createdAt - second.createdAt),
  [building, rooms, search, sortOrder, tickets]);
  const resolvedTickets = filteredTickets.filter(ticket => ticket.status === "resolved");
  const unresolvedTickets = filteredTickets.filter(ticket => ticket.status !== "resolved");
  const selectedRooms = building === "all" ? rooms : rooms.filter(room => room.building === building);
  const selectedBuildings = building === "all" ? "All buildings" : building;
  const exportTickets = exportType === "all" ? filteredTickets : exportType === "resolved" ? resolvedTickets : unresolvedTickets;
  const exportCsv = () => {
    const headers = ["Ticket ID", "Reporter ID", "Reporter name", "Reporter email", "Building", "Room", "Department", "Issue", "Description", "Priority", "Critical", "Status", "Issued date"];
    const csvValue = (value: string | number) => `"${String(value).replace(/"/g, "\"\"")}"`;
    const rows = exportTickets.map(ticket => {
      const room = rooms.find(item => item.name === ticket.room);
      return [
        ticket.id,
        ticket.reporterSchoolId,
        ticket.reporterEmail,
        ticket.reporter,
        room?.building ?? "Unknown building",
        ticket.room,
        ticket.dept,
        ticket.title,
        ticket.description,
        ticket.priority,
        ticket.priority === "critical" ? "Yes" : "No",
        statusLabel[ticket.status],
        ticket.created,
      ].map(csvValue).join(",");
    });
    const blob = new Blob([[headers.map(csvValue).join(","), ...rows].join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fixko-${exportType}-tickets-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return <div className="operations-insights">
    <div className="operations-hero card"><div><span className="admin-panel-kicker">All tickets</span><h1>Tickets by building and room</h1><p>Review every ticket, room location, status, and user comment in one place. Choose a building to focus the map and ticket details.</p></div></div>
    <CampusMap tickets={tickets} rooms={rooms} />
    <div className="operations-toolbar card"><div className="operations-filters"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search tickets, rooms, or reporters..." aria-label="Search tickets, rooms, or reporters" /><ModernSelect value={building} onChange={setBuilding} placeholder="All buildings" options={[{ value: "all", label: "All buildings" }, ...buildings.map(item => ({ value: item, label: item }))]} /><ModernSelect value={sortOrder} onChange={value => setSortOrder(value as "newest" | "oldest")} placeholder="Sort by date" options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} /></div></div>
    <div className="operations-export-panel card"><div className="operations-export-copy"><span className="operations-export-icon"><Icon name="clipboard" size={17} /></span><div><span className="admin-panel-kicker">Data export</span><strong>Download ticket records</strong><small>Export a clean CSV using the selected ticket type and current filters.</small></div></div><div className="operations-export-controls"><span className="operations-export-count"><strong>{exportTickets.length}</strong><small>tickets ready</small></span><ModernSelect value={exportType} onChange={value => setExportType(value as "all" | "unresolved" | "resolved")} placeholder="Choose tickets" options={[{ value: "all", label: "All tickets" }, { value: "unresolved", label: "Unresolved tickets" }, { value: "resolved", label: "Resolved tickets" }]} /><button type="button" className="operations-export-button" onClick={exportCsv}><Icon name="arrow" size={14} /> Export CSV</button></div></div>
    <div className="operations-metric-grid"><div className="card operations-metric"><span>Reports shown</span><strong>{filteredTickets.length}</strong><small>{selectedBuildings}</small></div><div className="card operations-metric"><span>Unresolved</span><strong>{unresolvedTickets.length}</strong><small>Needs follow-up</small></div><div className="card operations-metric"><span>Resolved</span><strong>{resolvedTickets.length}</strong><small>Completed reports</small></div><div className="card operations-metric"><span>Rooms affected</span><strong>{new Set(filteredTickets.map(ticket => ticket.room)).size}</strong><small>{selectedRooms.length} monitored rooms</small></div></div>
    <div className="operations-report-columns">
      <section className="card operations-panel"><div className="operations-section-heading"><div><span className="admin-panel-kicker">Unresolved tickets</span><h2>Needs attention</h2><p>Open tickets grouped by the room users selected.</p></div><span className="admin-count-pill">{unresolvedTickets.length}</span></div>{unresolvedTickets.length ? unresolvedTickets.map(ticket => <OperationsReportCard key={ticket.id} ticket={ticket} rooms={rooms} onStatusUpdated={onStatusUpdated} />) : <div className="admin-empty-state"><strong>No unresolved tickets</strong><p>New tickets will appear here when submitted.</p></div>}</section>
      <section className="card operations-panel"><div className="operations-section-heading"><div><span className="admin-panel-kicker">Resolved tickets</span><h2>Completed work</h2><p>Resolved tickets and feedback from reporters.</p></div><span className="admin-count-pill">{resolvedTickets.length}</span></div>{resolvedTickets.length ? resolvedTickets.map(ticket => <OperationsReportCard key={ticket.id} ticket={ticket} rooms={rooms} onStatusUpdated={onStatusUpdated} />) : <div className="admin-empty-state"><strong>No resolved tickets</strong><p>Resolved tickets will appear here after work is completed.</p></div>}</section>
    </div>
  </div>;
}

function OperationsReportCard({ ticket, rooms, onStatusUpdated }: { ticket: Ticket; rooms: ApiRoom[]; onStatusUpdated: (ticket: Ticket, status: Status) => Promise<void> }) {
  const room = rooms.find(item => item.name === ticket.room);
  return <article className="operations-report-card">
    <div className="operations-report-heading"><div><strong>{ticket.title}</strong><small>{ticket.id} · {room?.building ?? "Unknown building"} · {ticket.room}</small></div><div><Badge value={ticket.priority} /><Badge value={ticket.status} type="status" /><ModernSelect value={ticket.status} onChange={value => onStatusUpdated(ticket, value as Status)} placeholder="Update status" options={[{ value: "pending", label: "Pending" }, { value: "review", label: "Under review" }, { value: "progress", label: "In progress" }, { value: "resolved", label: "Resolved" }]} className="operations-status-select" /></div></div>
    <p className="operations-report-description">{ticket.description}</p>
    <div className="operations-report-meta"><span><b>Reported by</b>{ticket.reporter}</span><span><b>Date</b>{ticket.created}</span><span><b>Department</b>{ticket.dept}</span></div>
    <div className="operations-report-comments"><b>User comments</b>{ticket.feedback?.comment ? <p>“{ticket.feedback.comment}” <small>· {ticket.feedback.rating}/5 rating</small></p> : ticket.comments.length ? ticket.comments.map(comment => <p key={comment.id}>“{comment.message}” <small>· {comment.author?.name ?? "User"}</small></p>) : <p className="is-empty">No comments submitted.</p>}</div>
  </article>;
}
function Users() { return <div className="card overflow-hidden"><div className="border-b border-slate-100 p-5"><h2 className="font-extrabold">Registered users</h2></div><div className="empty-ticket-state"><span><Icon name="users" size={22} /></span><h3>No registered users yet</h3><p>Users will appear here after they create an account.</p></div></div>; }
function Notifications({ notifications }: { notifications: ApiNotification[] }) {
  return <div className="card notification-empty-page">{notifications.length ? <div className="notification-list">{notifications.map(notification => <article className={`notification-item ${notification.is_read ? "" : "is-unread"}`} key={notification.id}><span className="notification-item-icon"><Icon name="bell" size={16} /></span><div><strong>{notification.message}</strong><small>{new Date(notification.created_at).toLocaleString()}</small></div></article>)}</div> : <><div className="notification-empty-icon"><Icon name="bell" size={24} /></div><h2>You're all caught up</h2><p>There are no new notifications right now. We will let you know when something needs your attention.</p></>}</div>;
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
  { name: "Gym", shortName: "GYM", alert: "normal", reports: 1 }
];

function CampusMap({ compact = false, tickets = [], rooms = [] }: { compact?: boolean; tickets?: Ticket[]; rooms?: ApiRoom[] }) {
  const normalizeBuilding = (value: string) => value.toUpperCase().replace(/\s+/g, " ").trim();
  const reportCounts = new Map<string, number>();
  const criticalBuildings = new Set<string>();
  tickets.forEach(ticket => {
    const room = rooms.find(item => item.name === ticket.room);
    if (!room) return;
    const buildingKey = normalizeBuilding(room.building);
    reportCounts.set(buildingKey, (reportCounts.get(buildingKey) ?? 0) + 1);
    if (ticket.priority === "critical" && ticket.status !== "resolved") criticalBuildings.add(buildingKey);
  });
  const mappedBuildings = campusBuildings.map(building => {
    const buildingKey = normalizeBuilding(building.name);
    const reports = reportCounts.get(buildingKey) ?? 0;
    return {
      ...building,
      reports,
      alert: criticalBuildings.has(buildingKey) ? "critical" : reports ? "slight" : "normal" as BuildingAlert
    };
  });
  return <section className={`campus-map-card ${compact ? "campus-map-card-compact" : ""}`} aria-label="Campus report activity map">
    <div className="campus-map-heading"><div><span className="eyebrow"><Icon name="building" size={13} /> Campus map</span><h2>See where help is needed</h2><p>Buildings pulse according to recent reports.</p></div></div>
    <div className="campus-map-body"><div className="campus-map-canvas">
      <img className="campus-route-map-image" src="/campus-route-map.png" alt="Campus route map showing the school buildings and walkways" />
      {mappedBuildings.map((building, index) => <div className={`campus-map-marker campus-map-marker-${building.alert} campus-map-marker-position-${index + 1}`} key={building.name} title={`${building.name}: ${building.reports} reported ticket${building.reports === 1 ? "" : "s"}`}><span>{building.shortName}</span><b>{building.reports}</b></div>)}
    </div>
    <aside className="campus-map-info">
      <div className="campus-map-info-card campus-map-status-card"><span className="campus-info-label">CAMPUS STATUS</span><strong>Monitoring activity</strong><p>Report concentration updates the building indicators automatically.</p><div className="campus-status-counts"><span><b>{mappedBuildings.filter(building => building.alert === "critical").length}</b>Critical</span><span><b>{mappedBuildings.filter(building => building.alert === "slight").length}</b>Warning</span><span><b>{mappedBuildings.filter(building => building.alert === "normal").length}</b>Clear</span></div></div>
      <div className="campus-map-info-card"><span className="campus-info-label">MOST REPORTED</span><div className="campus-top-building-list">{mappedBuildings.slice().sort((a, b) => b.reports - a.reports).slice(0, 3).map((building, index) => <div key={building.name}><span><b>{index + 1}</b>{building.name}</span><strong>{building.reports}</strong></div>)}</div></div>
      <div className="campus-map-info-card campus-map-help-card"><span className="campus-info-label">HOW TO READ THE MAP</span><p><i className="campus-status-dot campus-status-critical" /> Red buildings need attention first.</p><p><i className="campus-status-dot campus-status-slight" /> Yellow buildings have some activity.</p><p><i className="campus-status-dot campus-status-normal" /> Green buildings are within normal activity.</p></div>
    </aside></div>
    <div className="campus-map-footer"><span><i className="campus-status-dot campus-status-critical" /> Critical</span><span><i className="campus-status-dot campus-status-slight" /> Slight activity</span><span><i className="campus-status-dot campus-status-normal" /> Normal</span><small>Updated just now</small></div>
  </section>;
}

function ReportSummary({ ticketData }: { ticketData: Ticket[] }) {
  const totalReports = ticketData.length;
  const resolvedReports = ticketData.filter(ticket => ticket.status === "resolved").length;
  const inProgressReports = ticketData.filter(ticket => ticket.status === "review" || ticket.status === "progress").length;
  const summary = [
    ["Total reports", totalReports, "Everything you have reported", "clipboard", "indigo"],
    ["Resolved", resolvedReports, "Issues successfully closed", "check", "emerald"],
    ["In progress", inProgressReports, "Reports being reviewed or fixed", "activity", "teal"]
  ] as const;
  return <section className="report-summary-grid" aria-label="Report summary">{summary.map(([label, value, text, icon, tone]) => <motion.div whileHover={{ y: -4 }} className={`report-summary-card card report-summary-${tone}`} key={label}><div className="report-summary-top"><span className="report-summary-icon"><Icon name={icon} size={17} /></span><span>{label}</span></div><strong>{value}</strong><p>{text}</p></motion.div>)}</section>;
}

function MyTickets({ ticketData }: { ticketData: Ticket[] }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const years = Array.from(new Set(ticketData.map(ticket => ticket.createdDate.slice(0, 4)))).sort().reverse();
  const months = Array.from({ length: 12 }, (_, index) => ({ value: String(index + 1).padStart(2, "0"), label: new Date(2026, index, 1).toLocaleString("en-US", { month: "long" }) }));
  const days = Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1).padStart(2, "0"), label: String(index + 1) }));
  const filteredTickets = ticketData.filter(ticket => {
    const [year, month, day] = ticket.createdDate.split("-");
    return (!filterYear || year === filterYear) && (!filterMonth || month === filterMonth) && (!filterDay || day === filterDay);
  });
  const sortedTickets = [...filteredTickets].sort((a, b) => {
    const difference = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
    return sortOrder === "newest" ? -difference : difference;
  });
  const hasFilters = Boolean(filterYear || filterMonth || filterDay);
  const clearFilters = () => { setFilterYear(""); setFilterMonth(""); setFilterDay(""); };
  const statusProgress: Record<Status, number> = { pending: 22, review: 48, progress: 74, resolved: 100 };
  const statusSteps: Array<{ value: Status; label: string }> = [
    { value: "pending", label: "Submitted" },
    { value: "review", label: "Under review" },
    { value: "progress", label: "In progress" },
    { value: "resolved", label: "Resolved" }
  ];
  return <div className="my-tickets-page"><section className="my-tickets card">
    <div className="my-tickets-heading"><div><span className="eyebrow"><Icon name="clipboard" size={13} /> Your reports</span><h2>My tickets</h2><p>Click a report to view its full details.</p></div><div className="my-tickets-tools"><button type="button" className={`my-tickets-tool ${filterOpen || hasFilters ? "is-active" : ""}`} onClick={() => setFilterOpen(open => !open)}><Icon name="layers" size={14} /> Filter {hasFilters && <span className="my-tickets-tool-count">1</span>}</button><ModernSelect value={sortOrder} onChange={value => setSortOrder(value as "newest" | "oldest")} placeholder="Sort by date" options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} className="my-tickets-sort" /><span className="my-tickets-count">{sortedTickets.length} reports</span></div></div>
    {filterOpen && <div className="my-tickets-filter-panel"><div><span>Year</span><ModernSelect value={filterYear} onChange={setFilterYear} placeholder="Any year" options={years.map(year => ({ value: year, label: year }))} /></div><div><span>Month</span><ModernSelect value={filterMonth} onChange={setFilterMonth} placeholder="Any month" options={months} /></div><div><span>Date</span><ModernSelect value={filterDay} onChange={setFilterDay} placeholder="Any date" options={days} /></div><button type="button" className="my-tickets-clear" onClick={clearFilters}>Clear filters</button></div>}
    {sortedTickets.length ? <div className="my-tickets-list">{sortedTickets.map(ticket => {
      const expanded = expandedId === ticket.id;
      return <article className={`my-ticket ${expanded ? "is-expanded" : ""}`} key={ticket.id}>
        <button className="my-ticket-trigger" onClick={() => setExpandedId(expanded ? null : ticket.id)} aria-expanded={expanded}>
          <span className={`my-ticket-icon my-ticket-icon-${ticket.status}`}><Icon name="clipboard" size={17} /></span>
          <span className="my-ticket-main"><strong>{ticket.title}</strong><small>{ticket.id} <i>|</i> {ticket.room} <i>|</i> {ticket.created}</small><span className="my-ticket-progress"><span style={{ width: `${statusProgress[ticket.status]}%` }} /></span></span>
          <span className="my-ticket-meta"><Badge value={ticket.priority} /><Badge value={ticket.status} type="status" /></span>
          <span className="my-ticket-view-label">{expanded ? "Hide" : "View"}</span>
          <span className={`my-ticket-chevron ${expanded ? "is-open" : ""}`} />
        </button>
        <div className="my-ticket-details"><div className="my-ticket-details-inner"><div className="my-ticket-details-grid"><div><span>Reported</span><strong>{ticket.created}</strong></div><div><span>Location</span><strong>{ticket.room} · {ticket.dept}</strong></div><div><span>Priority</span><Badge value={ticket.priority} /></div><div><span>Assigned to</span><strong>{ticket.tech}</strong></div></div><div className="my-ticket-timeline">{statusSteps.map((step, index) => <div className={`my-ticket-timeline-step ${statusSteps.findIndex(item => item.value === ticket.status) >= index ? "is-complete" : ""}`} key={step.value}><span>{statusSteps.findIndex(item => item.value === ticket.status) >= index ? "✓" : index + 1}</span><strong>{step.label}</strong>{index < statusSteps.length - 1 && <i />}</div>)}</div><div className="my-ticket-description"><span>Description</span><p>{ticket.description}</p></div></div></div>
      </article>;
    })}</div> : <div className="empty-ticket-state"><span><Icon name="clipboard" size={22} /></span><h3>No tickets yet</h3><p>Your submitted reports will appear here.</p></div>}
  </section></div>;
}

function StudentDashboard({ ticketData, rooms, onNewReport, onViewTickets }: { ticketData: Ticket[]; rooms: ApiRoom[]; onNewReport: () => void; onViewTickets: () => void }) {
  return <div className="student-dashboard space-y-5">
    <section className="student-welcome relative overflow-hidden rounded-[26px] p-6 text-white lg:p-8">
      <div className="student-welcome-orb student-welcome-orb-one" /><div className="student-welcome-orb student-welcome-orb-two" />
      <div className="relative z-10 max-w-2xl"><span className="student-kicker">YOUR CAMPUS IMPACT</span><h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Keep your campus moving, one report at a time.</h2><p className="mt-3 max-w-xl text-sm leading-6 text-indigo-100">You help the right people notice problems sooner. Track your requests, stay updated, and make shared spaces better for everyone.</p><div className="mt-6 flex flex-wrap gap-3"><button onClick={onNewReport} className="student-welcome-primary"><Icon name="edit" size={16} /> Report an issue</button><button onClick={onViewTickets} className="student-welcome-secondary">View my reports <Icon name="arrow" size={15} /></button></div></div>
      <div className="student-welcome-stats relative z-10 mt-7 grid max-w-xl grid-cols-3 gap-3 sm:absolute sm:right-8 sm:top-8 sm:mt-0 sm:w-[310px]"><div><strong>30s</strong><span>to report</span></div><div><strong>24/7</strong><span>status updates</span></div><div><strong>1</strong><span>shared campus</span></div></div>
    </section>
    <ReportSummary ticketData={ticketData} />
    <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
      <section className="card p-6"><div className="flex items-start justify-between gap-4"><div><span className="eyebrow"><Icon name="activity" size={13} /> Your activity</span><h2 className="mt-4 text-xl font-black">Make your next report count</h2><p className="mt-2 max-w-lg text-sm leading-6 text-slate-500">Clear details help maintenance teams respond faster and reduce repeat issues.</p></div><span className="student-score-badge">Good citizen <Icon name="check" size={13} /></span></div><div className="student-progress-card mt-6"><div className="flex items-center justify-between"><div><strong className="block text-sm">Reporting profile</strong><small className="text-xs text-slate-400">2 of 3 helpful habits completed</small></div><strong className="text-2xl text-indigo-600">67%</strong></div><div className="student-progress-track mt-4"><span style={{ width: "67%" }} /></div><div className="mt-5 grid gap-3 sm:grid-cols-3">{[["check", "Add a photo", true], ["check", "Choose a room", true], ["shield", "Rate a repair", false]].map(([icon, label, done]) => <div className={`student-habit ${done ? "done" : ""}`} key={label as string}><span><Icon name={icon as IconName} size={14} /></span><small>{label}</small></div>)}</div></div></section>
      <section className="student-tip-card"><div className="student-tip-icon"><Icon name="spark" size={20} /></div><span className="student-kicker student-tip-kicker">QUICK TIP</span><h2 className="mt-3 text-xl font-black">Help us fix it faster</h2><p className="mt-2 text-sm leading-6 text-slate-500">Include the exact room, what happened, and when you first noticed it. A photo makes recurring issues easier to spot.</p><button onClick={onNewReport} className="student-tip-link">Start a detailed report <Icon name="arrow" size={14} /></button></section>
    </div>
    <section className="student-journey card p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><span className="eyebrow">How Fixko works for you</span><h2 className="mt-3 text-xl font-black">Stay in the loop from report to resolution</h2></div><button onClick={onViewTickets} className="text-sm font-bold text-indigo-600">See all updates <Icon name="arrow" size={14} /></button></div><div className="mt-7 grid gap-4 md:grid-cols-4">{[["01", "Report", "Tell us what needs attention.", "edit"], ["02", "Reviewed", "The team checks the details.", "shield"], ["03", "In progress", "A technician works on it.", "activity"], ["04", "Resolved", "Rate the repair and close the loop.", "check"]].map(([number, title, text, icon], index) => <div className="student-journey-step" key={title}><span className={`student-journey-number ${index < 2 ? "complete" : ""}`}>{number}</span><Icon name={icon as IconName} size={18} /><strong>{title}</strong><p>{text}</p>{index < 3 && <i />}</div>)}</div></section>
  </div>;
}

export default function Home() {
  const [role, setRole] = useState<Role | null>(null);
  const [authRole, setAuthRole] = useState<Role | null>(null);
  const [signInLoading, setSignInLoading] = useState<Role | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  useEffect(() => {
    const saved = window.localStorage.getItem("fixko-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(saved ? saved === "dark" : prefersDark);
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
    await new Promise(resolve => window.setTimeout(resolve, 900));
    setRole(nextRole);
    setSignInLoading(null);
  };
  return <div className={`theme-root ${darkMode ? "theme-dark" : ""}`}><div className="global-depth-scene" aria-hidden="true"><div className="global-depth-grid" /><div className="global-depth-orbit" /><div className="global-depth-orb global-depth-orb-one" /><div className="global-depth-orb global-depth-orb-two" /><div className="global-depth-glow global-depth-glow-one" /><div className="global-depth-glow global-depth-glow-two" /></div><ThemeToggle dark={darkMode} setDark={setDarkMode} />{signInLoading ? <SignInLoader role={signInLoading} /> : role ? <AppShell role={role} onSignOut={() => { clearToken(); setRole(null); }} /> : <><Landing onAuth={(r) => setAuthRole(r)} />{authRole && <AuthModal role={authRole} onClose={() => setAuthRole(null)} onEnter={enterWorkspace} />}</>}</div>;
}
