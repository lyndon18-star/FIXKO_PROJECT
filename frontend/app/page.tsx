"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import {
  addReportComment,
  submitReportFeedback,
  updateProfile,
  assignReport,
  ApiError,
  ApiNotification,
  ApiRoom,
  ApiReport,
  ApiUser,
  ApiAccountStatus,
  Paginated,
  clearToken,
  createReport,
  deleteAccount,
  getArchivedNotifications,
  getMe,
  getNotifications,
  getRooms,
  getReports,
  getUsers,
  login,
  archiveNotification,
  deleteNotification,
  deleteNotifications,
  markNotificationRead,
  requestEmailOtp,
  resetPassword,
  resetPasswordOtp,
  signup,
  verifyEmailOtp,
  loginVerified,
  updateAccountStatus,
  warnMaintenanceUser,
  flagReport,
  unflagReport,
  updateReportStatus,
  getRecycleBin,
  restoreRecycleBinItem,
  purgeRecycleBinItem,
  ApiRecycleBin,
  ApiRecycleBinAccount,
  ApiRecycleBinReport,
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
import { StaggeredText } from "../lib/staggered-text";
import { initSoundFeedback } from "../lib/sounds";
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
  resolved: string;
  resolvedAt: number;
  tech: string;
  description: string;
  reporterSchoolId: string;
  reporterEmail: string;
  photoUrl: string | null;
  comments: Array<{ id: number; message: string; created_at: string; author?: ApiUser }>;
  feedback: { rating: number; comment: string | null; created_at: string } | null;
  flagged: boolean;
  flagReason: string | null;
};

const collegeDepartments = ["CITE", "CAS", "CAHS", "CELA", "CEA", "CMA", "CHTM", "CCJE", "SHS"] as const;
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

/** Weak password list shared by signup and change-password forms. */
const WEAK_PASSWORDS = [
  "password", "12345678", "qwerty123", "password1", "123456789", "admin123",
  "admin1234", "admin12345", "letmein123", "welcome123", "iloveyou1",
  "qwertyuiop", "12341234", "password123", "password1234",
];

// ============================================================
// PASSWORD POLICY CHECK — the rulebook a new password must pass
// (length, upper/lowercase, number, symbol, not too common)
// ============================================================
/** Security rules for a new password — identical to the sign-up form:
 *  8–25 chars, upper + lower case, number, symbol, not weak/common,
 *  must not contain the account's own name/email, no repeated or
 *  sequential runs (1234, aaaa, abcd). */
function passwordPolicyError(
  value: string,
  identity: string[] = []
): string {
  if (!value) return "Password is required.";
  if (value.length < 8) return "At least 8 characters required.";
  if (value.length > 25) return "Maximum of 25 characters.";
  if (!/[A-Z]/.test(value)) return "Add at least one uppercase letter.";
  if (!/[a-z]/.test(value)) return "Add at least one lowercase letter.";
  if (!/\d/.test(value)) return "Add at least one number.";
  if (!/[^A-Za-z0-9]/.test(value)) return "Add at least one symbol (e.g. !, ?, #).";
  if (WEAK_PASSWORDS.includes(value.toLowerCase()))
    return "This password is too common. Choose a stronger one.";
  const tokens = identity
    .filter((token) => token && token.length >= 3)
    .map((token) => token.replace(/[^a-z0-9]/gi, "").toLowerCase())
    .filter(Boolean);
  if (tokens.some((token) => value.toLowerCase().includes(token)))
    return "Password must not contain your name or email.";
  if (/(.)\1{3,}/.test(value) || /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(value))
    return "Avoid repeated or sequential characters (1234, aaaa, abcd).";
  return "";
}

/** Parse a timestamp, falling back when it is missing or unparseable (NaN). */
function safeTime(value: unknown, fallbackIso: string): number {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  if (Number.isFinite(parsed)) return parsed;
  const fallback = Date.parse(fallbackIso);
  return Number.isFinite(fallback) ? fallback : 0;
}

/** Format a timestamp for display, falling back to the created date. */
function safeLocaleDate(time: number, fallbackIso: string): string {
  const valid = Number.isFinite(time) ? time : safeTime(null, fallbackIso);
  return new Date(valid).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// ============================================================
// MAP API REPORT — translates a report from the backend's format
// into the simpler shape the rest of this page uses
// ============================================================
function mapApiReport(report: ApiReport): Report {
  const status: Status =
    report.status === "under_review"
      ? "review"
      : report.status === "in_progress"
        ? "progress"
        : report.status === "under_maintenance"
          ? "maint"
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
    // when the work was actually solved (falls back to created time if missing
    // or unparseable — never allow NaN, which renders as "Invalid Date")
    resolved: safeLocaleDate(
      report.resolved_at ? Date.parse(report.resolved_at) : NaN,
      report.created_at
    ),
    resolvedAt: safeTime(report.resolved_at, report.created_at),
    tech: report.handler?.name
      ? `${report.handler.name} · Maintenance`
      : "Waiting for admin assignment",
    description: report.description,
    comments: report.comments ?? [],
    feedback: report.feedback ?? null,
    flagged: Boolean(report.is_flagged ?? false),
    flagReason: report.flag_reason ?? null,
  };
}

// ============================================================
// TIME GREETING — says "Good morning/afternoon/evening" based on
// the user's clock
// ============================================================
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ============================================================
// THEME TOGGLE — the floating sun/moon switch that flips the
// site between light and dark mode (click it, or drag it)
// ============================================================
function ThemeToggle({ dark, setDark }: { dark: boolean; setDark: (value: boolean) => void }) {
  const [dragY, setDragY] = useState(0);
  const startY = useRef<number | null>(null);
  const lastY = useRef<number>(0);
  const dragging = useRef(false);
  const dragged = useRef(false);
  const finishDrag = () => {
    if (!dragging.current) return;
    dragging.current = false;
    // direction = overall delta from where the drag started (ref-based, no stale closure)
    const totalDelta = startY.current === null ? 0 : lastY.current - startY.current;
    if (totalDelta > 16) setDark(true);
    if (totalDelta < -16) setDark(false);
    setDragY(0);
    startY.current = null;
  };
  return (
    <div
      className={`theme-float ${dark ? "is-dark" : ""}`}
      style={{ "--drag-y": `${dragY}px` } as React.CSSProperties}
    >
      <span className="theme-float-label">{dark ? "Dark mood" : "Light mood"}</span>
      {/* Theme toggle button — click to switch mode, or drag up/down for light/dark */}
      <button
        className="theme-orbit"
        type="button"
        aria-label={`Switch to ${dark ? "light" : "dark"} mode`}
        onClick={() => {
          if (dragged.current) { // ignore the click that follows a drag
            dragged.current = false;
            return;
          }
          setDark(!dark);
        }}
        onPointerDown={(event) => {
          dragging.current = true;
          dragged.current = false;
          startY.current = event.clientY;
          lastY.current = event.clientY;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (dragging.current && startY.current !== null) {
            const delta = event.clientY - startY.current;
            if (Math.abs(delta) > 6) dragged.current = true;
            lastY.current = event.clientY;
            setDragY(Math.max(-42, Math.min(42, delta)));
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

// ============================================================
// SIGN-IN LOADER — the spinning logo animation shown while the
// app signs the user in and prepares their account
// ============================================================
function SignInLoader({ role }: { role: Role }) {
  const loaderRef = useRef<HTMLDivElement>(null);
  // Plays the intro animation (logo spin + welcome text) once the loader mounts
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
          <span>Preparing your {role === "admin" ? "admin" : role === "maintenance" ? "maintenance" : "user"} account...</span>
          <i><b /></i>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// AUTH MODAL — the pop-up form behind the Sign In / Sign Up
// buttons. Handles logging in, creating an account (with email
// code check), forgot password, and password reset
// ============================================================
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
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [email, setEmail] = useState(role === "admin" ? "admin@fixko.test" : "");
  const [schoolId, setSchoolId] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirmation, setShowPasswordConfirmation] = useState(false);
  // Privacy consent is required before the account can be accessed.
  // The checkbox is NEVER pre-ticked: it can only become ticked after the
  // policy has actually been read in the PrivacyGate modal.
  const [agreePolicy, setAgreePolicy] = useState(false);
  const [policyReadConfirmed, setPolicyReadConfirmed] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [otpStage, setOtpStage] = useState<"idle" | "awaiting" | "verified">("idle");
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  // Forgot-password-by-code flow: idle → awaiting (code sent) → verified (ask next step) → newpass (set new password)
  const [forgotStage, setForgotStage] = useState<"idle" | "awaiting" | "verified" | "newpass">("idle");
  const [forgotToken, setForgotToken] = useState("");
  const forgotEditing = mode === "forgot" && (forgotStage === "newpass" || forgotStage === "verified");
  const authTabs: AuthMode[] = role === "admin" ? ["signin"] : ["signin", "signup"];

  useEffect(() => {
    // Countdown timer for the "Resend code" button — ticks down once per second
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn > 0]);

  /** Name sanitizer + validator. Guards the input while typing:
   *  letters only (accents allowed), one leading space max, collapsed spacing. */
  const NAME_BAD_CHARS = /[^A-Za-z\u00C0-\u024F ]/g;
  const sanitizeName = (value: string) =>
    value
      .replace(NAME_BAD_CHARS, "")
      .replace(/ {2,}/g, " ")
      .replace(/^ +/, "");

  /** Defensively strips control/zero-width/homoglyph-injection chars before validation. */
  const stripInvisible = (value: string) =>
    value.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, "");

  const COMMON_WEAK_PASSWORDS = ["password", "12345678", "qwerty123", "password1", "123456789", "admin123", "letmein123", "welcome123", "iloveyou1", "qwertyuiop", "12341234"];

  const validateField = (field: string, rawValue: string): string => {
    const value = stripInvisible(rawValue);
    switch (field) {
      case "lastName":
      case "firstName":
        if (!value) return field === "lastName" ? "Last name is required." : "First name is required.";
        if (value.length < 2) return "Must be at least 2 letters.";
        if (/\d/.test(value)) return "Numbers are not allowed in a name.";
        if (/[^\u00C0-\u024Fa-zA-Z ]/.test(value)) return "Special characters ( -, ., @, ') are not allowed.";
        if (/ {2,}/.test(value)) return "Double spaces are not allowed.";
        return "";
      case "middleName":
        if (value && value.length < 2) return "Must be at least 2 letters.";
        if (/\d/.test(value)) return "Numbers are not allowed in a name.";
        if (/[^\u00C0-\u024Fa-zA-Z ]/.test(value)) return "Special characters are not allowed.";
        return "";
      case "email": {
        const trimmed = value.trim();
        if (role === "admin") return trimmed ? "" : "Admin username or email is required.";
        const normalized = trimmed.toLowerCase();
        if (!normalized) return "School email is required.";
        if (/\s/.test(normalized)) return "No spaces allowed in an email.";
        // The seeded administrator account is not a PHINMA address; allow it at sign-in.
        if (mode === "signin" && normalized === "admin@fixko.test") return "";
        // The seeded maintenance personnel accounts are also allowed at sign-in.
        if (
          mode === "signin" &&
          ["maintenance1@phinmaed.com", "maintenance2@phinmaed.com", "maintenance3@phinmaed.com", "maintenance4@phinmaed.com"].includes(normalized)
        ) return "";
        if (/[.]{2,}/.test(normalized)) return "Consecutive dots are not allowed.";
        if (!/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*\.up@phinmaed\.com$/.test(normalized))
          return "Must be a valid PHINMA email, e.g. juan.delacruz.up@phinmaed.com";
        return "";
      }
      case "schoolId":
        if (role === "admin" || mode !== "signup") return "";
        if (!value) return "School ID is required.";
        if (!/^\d{2}-\d{4}-\d{6}$|^\d{2}-\d{2}-\d{4}-\d{6}$/.test(value)) return "Format must be 03-2324-031903 or 03-01-2526-048634.";
        return "";
      case "password": {
        if (mode === "signin") return value ? "" : "Password is required.";
        if (!value) return "Password is required.";
        if (value.length < 8) return "At least 8 characters required.";
        if (value.length > 25) return "Maximum of 25 characters.";
        if (!/[A-Z]/.test(value)) return "Add at least one uppercase letter.";
        if (!/[a-z]/.test(value)) return "Add at least one lowercase letter.";
        if (!/\d/.test(value)) return "Add at least one number.";
        if (!/[^A-Za-z0-9]/.test(value)) return "Add at least one symbol (e.g. !, ?, #).";
        if (COMMON_WEAK_PASSWORDS.includes(value.toLowerCase())) return "This password is too common. Choose a stronger one.";
        // Must not contain pieces of the user's own identity (Lydon!1 fails).
        const identity = [firstName, lastName, middleName, role === "admin" ? email : email.split("@")[0]]
          .filter((token) => token && token.length >= 3)
          .map((token) => token.replace(/[^a-z0-9]/gi, "").toLowerCase())
          .filter(Boolean);
        if (identity.some((token) => value.toLowerCase().includes(token)))
          return "Password must not contain your name or email.";
        // Weak patterns: 4+ of the same character (aaaa) or 4+ sequential chars (1234, abcd, dcba).
        if (/(.)\1{3,}/.test(value) || /(?:0123|1234|2345|3456|4567|5678|6789|abcd|bcde|cdef|qwer|asdf|zxcv)/i.test(value))
          return "Avoid repeated or sequential characters (1234, aaaa, abcd).";
        return "";
      }
      case "passwordConfirmation":
        if (mode === "reset") return value ? "" : "Confirmation is required.";
        if (password !== value) return "Passwords do not match.";
        return "";
      default:
        return "";
    }
  };

  const setFieldError = (field: string, value: string) => {
    setFieldErrors((current) => {
      const next = { ...current };
      if (value) next[field] = value;
      else delete next[field];
      return next;
    });
  };

  const touchField = (field: string, rawValue: string) => setFieldError(field, validateField(field, rawValue));

  const fieldClass = (field: string) =>
    `mt-1.5 w-full rounded-lg px-3 py-2 outline-none transition duration-200 ${
      fieldErrors[field]
        ? "border border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-4 focus:ring-rose-400/25"
        : "border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
    } dark:border-slate-600 dark:bg-slate-800`;

  const FieldError = ({ name }: { name: string }) => {
    const message = fieldErrors[name];
    if (!message) return null;
    return (
      <p className="field-error mt-1.5 flex items-start gap-1 text-xs font-semibold text-rose-600" role="alert">
        <span aria-hidden="true">⚠</span>
        <span>{message}</span>
      </p>
    );
  };

  useEffect(() => {
    // Lock scroll without layout shift: compensate for the scrollbar width
    // that disappears when overflow is hidden, or the whole page reflows.
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    const previousBodyPadding = document.body.style.paddingRight;
    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    if (scrollbarGap > 0) document.body.style.paddingRight = `${scrollbarGap}px`;
    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
      document.body.style.paddingRight = previousBodyPadding;
    };
  }, []);

  useEffect(() => {
    // When the page was opened as a password-reset email link,
    // grab the token + email from the URL so the form can use them
    if (initialMode !== "reset") return;
    const params = new URLSearchParams(window.location.search);
    setResetToken(params.get("token") ?? "");
    setEmail(params.get("email") ?? "");
  }, [initialMode]);

  // Sends the verification code to the user's email address
  const sendOtp = async () => {
    setOtpError("");
    setOtpStage("awaiting");
    setResendIn(60);
    setNotice("");

    if (otpStage !== "idle") setSubmitting(true);
    try {
      const response = await requestEmailOtp(email.trim().toLowerCase());
      setOtpStage("awaiting");
      setResendIn(60);
      setNotice(response.message ?? `We sent a 6-digit verification code to ${email}. Check your inbox.`);
      setOtpStage("awaiting");
    } catch (otpError) {
      setOtpStage("idle");
      setResendIn(0);
      const message = otpError instanceof ApiError ? otpError.message : "Could not send the verification email. Try again.";
      setNotice("");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  // Checks the emailed code and, if it's correct, creates the account
  const verifyOtpAndSignup = async () => {
    const code = otpCode.replace(/\D/g, "");
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    setOtpError("");
    setSubmitting(true);
    try {
      const verification = await verifyEmailOtp(email.trim().toLowerCase(), code);
      const response = await signup({
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName || undefined,
        email: email.trim().toLowerCase(),
        school_id: schoolId,
        password,
        password_confirmation: passwordConfirmation,
        role: "user",
        email_verification_token: verification.email_verification_token,
      });
      setOtpStage("idle");
      setOtpCode("");
      setPassword("");
      setPasswordConfirmation("");
      setShowPassword(false);
      setShowPasswordConfirmation(false);
      setFieldErrors({});
      setMode("signin");
      setNotice(
        response.message ??
          "Your school email is verified and the account is created. Please sign in with your school email to continue.",
      );
    } catch (requestError) {
      if (requestError instanceof ApiError && requestError.status === 422 && requestError.code === "OTP_INVALID" || requestError instanceof ApiError && requestError.fieldErrors.code) {
        setOtpError(requestError.message);
        return;
      }
      const message = requestError instanceof Error ? requestError.message : "Account creation failed.";
      setError(message);
      // Keep the OTP state so the user doesn't need to re-verify for a retry.
    } finally {
      setSubmitting(false);
    }
  };

  // ── Forgot-password-by-code flow ──────────────────────────────────────────
  const resetForgotFlow = () => {
    setForgotStage("idle");
    setForgotToken("");
    setOtpCode("");
    setOtpError("");
  };

  // Emails a 6-digit reset code to the address typed in
  const forgotSendCode = async () => {
    setError("");
    setNotice("");
    setOtpError("");
    setOtpCode("");
    const message = validateField("email", email);
    if (message) {
      setFieldErrors({ email: message });
      return;
    }
    setSubmitting(true);
    try {
      const response = await requestEmailOtp(email.trim().toLowerCase());
      setForgotStage("awaiting");
      setResendIn(60);
      setNotice(response.message ?? `We sent a 6-digit code to ${email.trim().toLowerCase()}. It expires in 10 minutes.`);
    } catch (requestError) {
      const msg = requestError instanceof ApiError ? requestError.message : "Could not send the code. Try again.";
      setNotice("");
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Checks the 6-digit code the user typed in
  const forgotVerifyCode = async () => {
    const code = otpCode.replace(/\D/g, "");
    if (code.length !== 6) {
      setOtpError("Enter the 6-digit code from your email.");
      return;
    }
    setOtpError("");
    setSubmitting(true);
    try {
      const verification = await verifyEmailOtp(email.trim().toLowerCase(), code);
      setForgotToken(verification.email_verification_token);
      setOtpCode("");
      setResendIn(0);
      setNotice("");
      setForgotStage("verified");
    } catch (requestError) {
      setOtpError(requestError instanceof ApiError ? requestError.message : "Verification failed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Skips the password step and logs the user straight in —
  // proving they own the email with the code was enough
  const forgotContinueIntoSystem = async () => {
    setSubmitting(true);
    setError("");
    try {
      const response = await loginVerified(
        email.trim().toLowerCase(),
        forgotToken
      );
      resetForgotFlow();
      setPassword("");
      setPasswordConfirmation("");
      setShowPassword(false);
      setShowPasswordConfirmation(false);
      setFieldErrors({});
      setError("");
      setNotice("");
      if (response.token) {
        window.localStorage.setItem("fixko-token", response.token);
        if (response.user)
          window.localStorage.setItem("fixko-user", JSON.stringify(response.user));
      }
      await onEnter(
        response.user?.role === "admin"
          ? "admin"
          : response.user?.role === "maintenance"
            ? "maintenance"
            : "user"
      );
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Could not continue. Please sign in with your password.";
      setError(message);
      if (requestError instanceof ApiError && requestError.code) resetForgotFlow();
    } finally {
      setSubmitting(false);
    }
  };

  // Saves the new password the user chose
  const forgotSubmitNewPassword = async () => {
    setSubmitting(true);
    try {
      await resetPasswordOtp({
        email: email.trim().toLowerCase(),
        email_verification_token: forgotToken,
        password,
        password_confirmation: passwordConfirmation,
      });
      setForgotStage("idle");
      setForgotToken("");
      setPassword("");
      setPasswordConfirmation("");
      setShowPassword(false);
      setShowPasswordConfirmation(false);
      setFieldErrors({});
      setMode("signin");
      setNotice("Your password has been reset. You can now sign in.");
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Password reset failed.";
      setError(message);
      if (requestError instanceof ApiError && requestError.code === "VERIFICATION_INVALID") resetForgotFlow();
    } finally {
      setSubmitting(false);
    }
  };

  // Main submit for the whole modal — runs whichever flow matches the current tab
  const submit = async () => {
    setError("");
    setNotice("");
    // Privacy gate: sign-in is not possible without consenting to the policy.
    if (mode === "signin" && !agreePolicy) {
      setShowPrivacy(true);
      return;
    }
    // Client-side security gate — validate every visible field; block on any error.
    const fieldsToCheck =
      mode === "signup"
        ? ["lastName", "firstName", "middleName", "email", "schoolId", "password", "passwordConfirmation"]
        : mode === "forgot"
          ? (forgotStage === "idle" ? ["email"] : forgotStage === "newpass" ? ["password", "passwordConfirmation"] : [])
          : ["email", ...(mode === "reset" ? ["password", "passwordConfirmation"] : ["password"])];
    const found: Record<string, string> = {};
    for (const field of fieldsToCheck) {
      const raw =
        field === "lastName" ? lastName
        : field === "firstName" ? firstName
        : field === "middleName" ? middleName
        : field === "email" ? email
        : field === "schoolId" ? schoolId
        : field === "password" ? password
        : passwordConfirmation;
      const message = validateField(field, raw);
      if (message) found[field] = message;
    }
    if (Object.keys(found).length > 0) {
      setFieldErrors(found);
      setError("Please fix the highlighted fields before continuing.");
      return;
    }
    // Sign-up step 1: everything checks out → email the OTP before creating anything.
    if (mode === "signup" && otpStage !== "verified") {
      await sendOtp();
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "forgot") {
        if (forgotStage === "idle") {
          await forgotSendCode();
          return;
        }
        if (forgotStage === "newpass") {
          await forgotSubmitNewPassword();
          return;
        }
        return; // verified stage is handled by its own choice buttons
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
      if (mode === "signup") {
        // Unreachable in practice: sign-ups go through verifyOtpAndSignup()
        // after the email OTP succeeds; this only exists as a safe fallback.
        setError("Please verify your school email with the sent code first.");
        setSubmitting(false);
        return;
      }
      const response = await login(email, password);
      if (!response.token) throw new Error("No access token was returned.");
      window.localStorage.setItem("fixko-token", response.token);
      if (response.user) window.localStorage.setItem("fixko-user", JSON.stringify(response.user));
      await onEnter(
        response.user.role === "admin"
          ? "admin"
          : response.user.role === "maintenance"
            ? "maintenance"
            : "user"
      );
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

  // Live password-requirement checklist (checks turn green as each rule is met).
  const pwdRequirements = [
    { label: "At least 8 characters", test: password.length >= 8 },
    { label: "One uppercase letter", test: /[A-Z]/.test(password) },
    { label: "One lowercase letter", test: /[a-z]/.test(password) },
    { label: "One number", test: /\d/.test(password) },
    { label: "One special character (!@#$%)", test: /[^A-Za-z0-9]/.test(password) },
  ];

  // 6 separate digit boxes for the forgot-code screen.
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);
  const otpDigitsArray = Array.from({ length: 6 }, (_, index) => otpCode[index] ?? "");
  const setOtpDigit = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = otpDigitsArray.slice();
    next[index] = digit;
    setOtpCode(next.join("").slice(0, 6));
    if (digit && index < 5) digitRefs.current[index + 1]?.focus();
  };
  const handleOtpKeyDown = (index: number, key: string) => {
    if (key !== "Backspace") return;
    if (otpDigitsArray[index]) return; // let the input clear itself first
    if (index > 0) {
      const prev = otpDigitsArray.slice();
      prev[index - 1] = "";
      setOtpCode(prev.join(""));
      digitRefs.current[index - 1]?.focus();
    }
  };
  const handleOtpPaste = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, 6);
    if (!digits) return;
    setOtpCode(digits);
    digitRefs.current[Math.min(digits.length, 5)]?.focus();
  };

  return (
    <div className="auth-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/40 p-4 backdrop-blur-sm">
      <div
        className={`card auth-panel auth-modal w-full p-4 sm:p-5 ${
          mode === "signup" && otpStage === "awaiting" ? "max-w-sm" : mode === "signup" ? "max-w-lg" : "max-w-sm"
        } ${mode === "forgot" || mode === "reset" ? "auth-panel-compact" : ""}`}
      >
        <div className="auth-panel-head mb-3 flex items-start justify-between">
          {mode === "forgot" ? (
            <div className={`w-full ${forgotStage === "awaiting" || forgotStage === "verified" ? "text-center" : ""}`}>
              {forgotStage === "awaiting" && (
                <span className="auth-mail-chip"><Icon name="mail" size={24} /></span>
              )}
              <h2 key={`forgot-${forgotStage}`} className={`auth-title text-[1.35rem] font-extrabold ${forgotStage === "awaiting" || forgotStage === "verified" ? "mt-2.5 text-[1.55rem]" : "mt-1.5 text-[1.15rem]"}`}>
                {forgotStage === "awaiting"
                  ? "Enter your code"
                  : forgotStage === "verified"
                    ? "Code verified"
                    : forgotStage === "newpass"
                      ? "Choose a new password"
                      : "Reset your password"}
              </h2>
              {forgotStage === "awaiting" && (
                <p className="mt-1 text-[13px] text-slate-500">
                  We sent a code to<br /><b className="font-bold text-slate-700 dark:text-slate-200">{email.trim().toLowerCase()}</b>
                </p>
              )}
              {forgotStage === "idle" && (
                <p className="mt-1 text-[13px] text-slate-500">Enter your school email and we&apos;ll send a 6-digit code.</p>
              )}
              {forgotStage === "verified" && (
                <p className="mt-1 text-[13px] text-slate-500">Choose a new password for <b className="font-bold text-slate-700 dark:text-slate-200">{email.trim().toLowerCase()}</b> to sign back in.</p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2.5">
                <span className="auth-panel-logo"><BrandMark size={26} /></span>
                <span className="eyebrow auth-eyebrow">
                {mode === "signup"
                  ? otpStage === "awaiting"
                    ? "STEP 2 OF 2 — EMAIL CHECK"
                    : role === "admin"
                      ? "STAFF & ADMIN PORTAL"
                      : "GET STARTED"
                  : role === "admin"
                    ? "STAFF & ADMIN PORTAL"
                    : "FIXKO ACCOUNT"}
              </span>
              </div>
              <h2 key={`${mode}-${otpStage}`} className="auth-title mt-1.5 text-[1.15rem] font-extrabold">
                {mode === "signup" && otpStage === "awaiting"
                  ? "Verify your school email"
                  : mode === "signin"
                    ? "Welcome back"
                    : "Create your account"}
              </h2>
            </div>
          )}
          {/* Close (×) button — closes the modal without signing in */}
          <button className="auth-close text-xl text-slate-400" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {(mode === "signin" || mode === "signup") && otpStage !== "awaiting" && (
          <div
            className={`mb-3 grid border-b border-slate-200 ${
              role === "admin" ? "grid-cols-1" : "grid-cols-2"
            }`}
          >
            {/* Sign In / Sign Up tabs — switches between the two forms and clears the inputs */}
            {authTabs.map((item) => (
              <button
                key={item}
                onClick={() => {
                  if (item === mode) return;
                  setMode(item);
                  setError("");
                  setNotice("");
                  setFieldErrors({});
                  setOtpStage("idle");
                  setOtpCode("");
                  setOtpError("");
                  setResendIn(0);
                  resetForgotFlow();
                  // Sign in and Sign up have different fields — don't carry over typed values.
                  setEmail("");
                  setPassword("");
                  setPasswordConfirmation("");
                  setLastName("");
                  setFirstName("");
                  setMiddleName("");
                  setSchoolId("");
                }}
                className={`auth-tab border-b-2 border-transparent py-2 text-sm font-bold transition-colors duration-200 ${
                  mode === item ? "active text-indigo-600" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {item === "signin" ? "Sign in" : "Sign up"}
              </button>
            ))}
          </div>
        )}
        <motion.div
          key={mode}
          layout
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.42, ease: [0.22, 0.9, 0.28, 1.02] }}
          className={`auth-form space-y-2 ${otpStage === "awaiting" || (mode === "forgot" && forgotStage === "awaiting") ? "hidden" : ""}`}
        >
          {mode === "signup" && (
            <div className="grid gap-2.5 sm:grid-cols-3">
              <label className="block text-sm font-bold">
                Last name
                <input
                  value={lastName}
                  onChange={(event) => {
                    const clean = sanitizeName(event.target.value);
                    setLastName(clean);
                    if (fieldErrors.lastName) touchField("lastName", clean);
                  }}
                  onBlur={() => touchField("lastName", lastName)}
                  aria-invalid={Boolean(fieldErrors.lastName)}
                  className={fieldClass("lastName")}
                  placeholder="Dela Cruz"
                  title="Letters and single spaces only"
                  maxLength={20}
                  required
                />
                <FieldError name="lastName" />
              </label>
              <label className="block text-sm font-bold">
                First name
                <input
                  value={firstName}
                  onChange={(event) => {
                    const clean = sanitizeName(event.target.value);
                    setFirstName(clean);
                    if (fieldErrors.firstName) touchField("firstName", clean);
                  }}
                  onBlur={() => touchField("firstName", firstName)}
                  aria-invalid={Boolean(fieldErrors.firstName)}
                  className={fieldClass("firstName")}
                  placeholder="Juan"
                  title="Letters and single spaces only"
                  maxLength={20}
                  required
                />
                <FieldError name="firstName" />
              </label>
              <label className="block text-sm font-bold">
                Middle name
                <input
                  value={middleName}
                  onChange={(event) => {
                    const clean = sanitizeName(event.target.value);
                    setMiddleName(clean);
                    if (fieldErrors.middleName) touchField("middleName", clean);
                  }}
                  onBlur={() => touchField("middleName", middleName)}
                  aria-invalid={Boolean(fieldErrors.middleName)}
                  className={fieldClass("middleName")}
                  placeholder="Santos"
                  title="Letters and single spaces only"
                  maxLength={20}
                />
                <FieldError name="middleName" />
              </label>
            </div>
          )}
          {!(mode === "forgot" && forgotStage !== "idle") && (
          <div className={`grid gap-2.5 ${mode === "signup" && role !== "admin" ? "sm:grid-cols-2" : ""}`}>
            <label className="block text-sm font-bold">
              {role === "admin" ? "Admin username or email" : "School email"}
              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value.replace(/[\u200B-\u200F\u2060-\u206F\uFEFF]/g, ""));
                  // The verification code is bound to the email — any edit resets the flow.
                  if (otpStage !== "idle") {
                    setOtpStage("idle");
                    setOtpCode("");
                    setOtpError("");
                  }
                  if (fieldErrors.email) touchField("email", event.target.value);
                }}
                onBlur={() => touchField("email", email)}
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(fieldErrors.email)}
                className={fieldClass("email")}
                placeholder={role === "admin" ? "admin@up.phinmaed.com" : "name.up@phinmaed.com"}
                title="Use your PHINMA Education email, e.g. juan.delacruz.up@phinmaed.com"
                required
              />
              <FieldError name="email" />
            </label>
            {mode === "signup" && role !== "admin" && (
              <label className="block text-sm font-bold">
                School ID
                <input
                  value={schoolId}
                  onChange={(event) => {
                    const masked = formatSchoolId(event.target.value);
                    setSchoolId(masked);
                    if (fieldErrors.schoolId) touchField("schoolId", masked);
                  }}
                  onBlur={() => touchField("schoolId", schoolId)}
                  inputMode="numeric"
                  maxLength={17}
                  aria-invalid={Boolean(fieldErrors.schoolId)}
                  className={fieldClass("schoolId")}
                  placeholder="03-2324-031903"
                  required
                />
                <FieldError name="schoolId" />
              </label>
            )}
          </div>
          )}
          {(mode !== "forgot" || forgotStage === "newpass") && (
            <div className={`grid gap-2.5 ${(mode === "signup" || mode === "reset" || forgotStage === "newpass") ? "sm:grid-cols-2" : ""}`}>
            <label className="block text-sm font-bold">
              <span>Password</span>
              <div className="relative mt-2">
                <input
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value.slice(0, 25));
                    if (fieldErrors.password) touchField("password", event.target.value.slice(0, 25));
                  }}
                  onBlur={() => touchField("password", password)}
                  type={showPassword ? "text" : "password"}
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  aria-invalid={Boolean(fieldErrors.password)}
                  className={`${fieldClass("password")} pr-11`}
                  placeholder="••••••••"
                  required
                />
                {/* Eye icon — show or hide the password while typing */}
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition hover:text-slate-600"
                >
                  <Icon name={showPassword ? "eyeOff" : "eye"} size={17} />
                </button>
              </div>
              {(mode === "signup" || mode === "reset" || forgotStage === "newpass") && (
                <ul className="pwd-checklist" aria-live="polite">
                  {pwdRequirements.map((req) => (
                    <li key={req.label} className={req.test ? "met" : ""}>
                      <i aria-hidden="true">{req.test ? "✓" : "✕"}</i>
                      <span>{req.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <FieldError name="password" />
              {mode === "signin" && (
                <div className={`privacy-consent-row ${agreePolicy ? "is-agreed" : ""} ${policyReadConfirmed ? "" : "is-locked"}`}>
                  <label className="privacy-consent-check">
                    <input
                      type="checkbox"
                      checked={agreePolicy}
                      onChange={(event) => {
                        if (!policyReadConfirmed) {
                          // The checkbox cannot be ticked until the policy is read.
                          setShowPrivacy(true);
                          return;
                        }
                        setAgreePolicy(event.target.checked);
                      }}
                      title={policyReadConfirmed ? "" : "Read the policy first — tick to open it"}
                    />
                    <span>
                      I've read the <b>Privacy Policy</b> and I understand how Fixko uses my data.
                    </span>
                  </label>
                  {/* Read policy button — opens the privacy policy pop-up */}
                  <button
                    type="button"
                    className="privacy-consent-read"
                    onClick={() => setShowPrivacy(true)}
                  >
                    Read policy
                  </button>
                </div>
              )}
            </label>
          {(mode === "signup" || mode === "reset" || forgotStage === "newpass") && (
            <label className="block text-sm font-bold">
              <span>Confirm password</span>
              <div className="relative mt-2">
                <input
                  value={passwordConfirmation}
                  onChange={(event) => {
                    setPasswordConfirmation(event.target.value.slice(0, 25));
                    if (fieldErrors.passwordConfirmation) touchField("passwordConfirmation", event.target.value.slice(0, 25));
                  }}
                  onBlur={() => touchField("passwordConfirmation", passwordConfirmation)}
                  type={showPasswordConfirmation ? "text" : "password"}
                  maxLength={25}
                  autoComplete="new-password"
                  aria-invalid={Boolean(fieldErrors.passwordConfirmation)}
                  className={`${fieldClass("passwordConfirmation")} pr-11`}
                  required
                />
                {/* Eye icon — show or hide the confirm-password field */}
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
              <FieldError name="passwordConfirmation" />
            </label>
            )}
            </div>
          )}
        </motion.div>
        {notice && otpStage !== "awaiting" && !(mode === "forgot" && forgotStage === "awaiting") && (
            <p key={notice} className="auth-notice mb-3 mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {notice}
            </p>
          )}
          {error && (
            <p key={error} className="auth-notice auth-notice-error mb-3 mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
              {error}
            </p>
          )}
          {((otpStage === "awaiting" || otpError) && mode === "signup") && (
            <div className="email-otp-block">
              <div className="email-otp-head">
                <p>
                  Enter the 6-digit code sent to <b>{email.trim().toLowerCase()}</b> — it expires in 10 minutes.
                </p>
              </div>
              <label className="block text-sm font-bold">
                <div className="relative">
                  <input
                    value={otpCode}
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
                      setOtpCode(digits);
                      if (otpError) setOtpError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && otpCode.length === 6) void verifyOtpAndSignup();
                    }}
                    inputMode="numeric"
                    autoFocus
                    placeholder="• • • • • •"
                    className={`otp-input mt-2 w-full rounded-lg border px-3 py-3 text-center text-lg font-black tracking-[0.5em] outline-none transition ${
                      otpError
                        ? "border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-4 focus:ring-rose-400/25"
                        : "border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/15"
                    } dark:border-slate-600 dark:bg-slate-800`}
                    aria-label="6 digit verification code"
                  />
                </div>
              </label>
              {otpError && (
                <p className="field-error mt-1.5 text-xs font-semibold text-rose-600" role="alert">⚠ {otpError}</p>
              )}
              <div className="mt-2 flex items-center justify-between gap-2">
                {/* Resend code — emails a new verification code (waits 60s between tries) */}
                <button
                  type="button"
                  disabled={resendIn > 0 || submitting}
                  onClick={() => void sendOtp()}
                  className="text-xs font-bold text-indigo-600 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:text-slate-400"
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </button>
                {/* Change email / back — cancels the code step so the email can be edited */}
                <button
                  type="button"
                  onClick={() => {
                    setOtpStage("idle");
                    setOtpCode("");
                    setOtpError("");
                    setNotice("");
                  }}
                  className="text-xs font-bold text-slate-400 transition hover:text-slate-600"
                >
                  Change email / back
                </button>
              </div>
            </div>
          )}
          {mode === "forgot" && forgotStage === "awaiting" && (
            <div className="forgot-code-section mt-1">
              <div className="otp-digits" onPaste={(event) => handleOtpPaste(event.clipboardData.getData("text"))}>
                {otpDigitsArray.map((digit, index) => (
                  <input
                    key={index}
                    ref={(element) => { digitRefs.current[index] = element; }}
                    value={digit}
                    onChange={(event) => setOtpDigit(index, event.target.value)}
                    onKeyDown={(event) => {
                      handleOtpKeyDown(index, event.key);
                      if (event.key === "Enter") void forgotVerifyCode();
                    }}
                    inputMode="numeric"
                    autoFocus={index === 0}
                    maxLength={2}
                    aria-label={`Digit ${index + 1} of the verification code`}
                    className={`otp-digit ${digit ? "filled" : ""} ${
                      otpError ? "border-rose-400 bg-rose-50/40" : ""
                    } dark:bg-slate-800`}
                  />
                ))}
              </div>
              {otpError && (
                <p className="field-error text-center text-xs font-semibold text-rose-600" role="alert">⚠ {otpError}</p>
              )}
              <p className="mt-2 text-center text-[13px] text-slate-500">
                Didn&apos;t receive the email?{" "}
                {/* Resend — emails another forgot-password code */}
                <button
                  type="button"
                  disabled={resendIn > 0 || submitting}
                  onClick={() => void forgotSendCode()}
                  className="font-semibold text-indigo-600 underline underline-offset-2 transition hover:text-indigo-700 disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
                >
                  {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend"}
                </button>
              </p>
            </div>
          )}
          {mode === "forgot" && forgotStage === "verified" && (
            <div className="forgot-choices">
              {/* Create a new password — moves to the "type a new password" step */}
              <button
                type="button"
                className="btn-primary w-full justify-center py-3 text-[15px]"
                onClick={() => {
                  setForgotStage("newpass");
                  setError("");
                  setNotice("");
                  setFieldErrors({});
                }}
              >
                Create a new password →
              </button>
              {/* Continue — logs the user straight in without needing the old password */}
              <button
                type="button"
                className="btn-secondary w-full justify-center py-3 text-[15px]"
                disabled={submitting}
                onClick={() => void forgotContinueIntoSystem()}
              >
                Continue →
              </button>
            </div>
          )}
          {/* Main action button — signs in, signs up, verifies the code, or saves a new password,
              depending on which form and step is showing */}
          {!(mode === "forgot" && forgotStage === "verified") && (
          <button
            className="auth-submit btn-primary mt-3 w-full"
            type="button"
            disabled={submitting}
            onClick={() => {
              if (mode === "signup" && otpStage === "awaiting") void verifyOtpAndSignup();
              else if (mode === "forgot" && forgotStage === "awaiting") void forgotVerifyCode();
              else void submit();
            }}
          >
            {submitting
              ? "Please wait..."
              : mode === "signup" && otpStage === "awaiting"
                ? "Verify code & create account"
                : mode === "forgot" && forgotStage === "awaiting"
                  ? "Continue"
                  : forgotStage === "newpass"
                    ? "Save new password"
                    : mode === "signin"
                      ? "Sign in"
                      : mode === "signup"
                        ? "Continue — verify school email"
                        : mode === "forgot"
                          ? "Send code"
                          : "Reset password"}{" "}
            →
          </button>
          )}
          {/* Forgot password link — swaps between the sign-in form and the forgot-password form */}
          {(mode === "signin" || mode === "forgot") && (
            <button
              type="button"
              className="w-full text-sm font-bold text-indigo-600"
              onClick={() => {
                setMode(mode === "signin" ? "forgot" : "signin");
                setError("");
                setNotice("");
                setFieldErrors({});
                resetForgotFlow();
              }}
            >
              {mode === "signin" ? "Forgot your password?" : "Back to sign in"}
            </button>
          )}
      </div>
      {showPrivacy && (
        <PrivacyGate
          mode="view"
          onClose={() => setShowPrivacy(false)}
          onAccept={() => {
            try {
              window.localStorage.setItem("fixko-privacy-accepted", "true");
            } catch {
              // storage unavailable — consent for this session only
            }
            setPolicyReadConfirmed(true);
            setAgreePolicy(true);
            setShowPrivacy(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================
// LANDING — the public marketing/home page visitors see first.
// Shows what Fixko does, with Sign In / Sign Up buttons that
// open the AuthModal (only after the privacy policy is accepted)
// ============================================================
function Landing({ onAuth }: { onAuth: (role: Role, mode?: AuthMode) => void }) {
  const [step, setStep] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("pulse");
  const [privacyAccepted, setPrivacyAccepted] = useState(() => {
    try {
      return window.localStorage.getItem("fixko-privacy-accepted") === "true";
    } catch {
      return false;
    }
  });
  const [privacyMenuOpen, setPrivacyMenuOpen] = useState(false);
  const access = ((role: Role, mode?: AuthMode) => {
    // The website stays locked until the visitor reads and accepts the privacy policy.
    if (!privacyAccepted) {
      setPrivacyMenuOpen(true);
      return;
    }
    onAuth(role, mode);
  }) as typeof onAuth;

  // Saves "accepted" in the browser when the visitor agrees to the privacy policy
  const acceptPrivacyPolicy = () => {
    try {
      window.localStorage.setItem("fixko-privacy-accepted", "true");
    } catch {
      // storage unavailable — accept for this session only
    }
    setPrivacyAccepted(true);
    setPrivacyMenuOpen(false);
  };
  const statusBoardRef = useRef<HTMLDivElement>(null);
  const landingRef = useRef<HTMLElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const steps = ["Report the issue", "It reaches the right people", "Track it in real time", "Resolve & rate it"];
  // Gently floats the status-board card up and down (skipped for reduced motion)
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
  // Big GSAP animation setup: parallax orbs, glowing text, a nav shadow that
  // appears on scroll, and highlights the menu item for the section on screen
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
  // Cycles the "How it works" steps every 4.5 seconds so the demo plays itself
  useEffect(() => {
    const timer = window.setInterval(() => setStep((current) => (current + 1) % steps.length), 4500);
    return () => window.clearInterval(timer);
  }, [steps.length]);
  return <main ref={landingRef}>
    <nav ref={navRef} className="site-nav sticky top-0 z-30 border-b border-slate-200/80 bg-white/85 backdrop-blur">
      <div className="mx-auto flex h-[66px] max-w-[1500px] items-center gap-6 px-5 lg:px-10">
        <a href="#pulse" className="nav-brand flex items-center gap-2"><span className="brand-shell"><span className="brand-mark-modern"><BrandMark /></span><span className="nav-live-orb" /></span><strong className="text-lg">Fixko</strong></a>
        <div className={`nav-links-modern ${mobileMenuOpen ? "open" : ""}`}>{[["pulse", "School updates"], ["features", "Features"], ["how", "How it works"], ["roles", "For your school"], ["verification", "Account safety"], ["faq", "FAQ"]].map(([id, label]) => <a className={`nav-link-modern ${activeNav === id ? "active" : ""}`} onClick={() => setMobileMenuOpen(false)} key={id} href={`#${id}`}>{label}<span className="nav-link-glow" /></a>)}</div>
        {/* Sign in button (top nav) — opens the sign-in modal */}
        <div className="ml-auto flex items-center gap-2"><button className="btn-secondary" onClick={() => access("user", "signin")}>Sign in</button><button className="btn-primary" onClick={() => access("user", "signup")}>Get started <Icon name="arrow" size={15} /></button><button className="nav-menu-button" aria-label="Toggle navigation" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenuOpen((open) => !open)}><span /><span /><span /></button></div>
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
        <h1 className="mt-5 max-w-[760px] text-5xl font-black leading-[1.03] tracking-tight sm:text-[4rem]">
          <StaggeredText
            segments={[
              { text: "Report mo, Fixko!", className: "animated-gradient-text" },
            ]}
          />
        </h1>
        <p className="mt-6 max-w-[560px] text-[17px] leading-7 text-slate-600">Fixko routes every report straight to the people who fix it, and keeps everyone posted from “seen it” to “fixed it.” No more sticky notes on the maintenance office door.</p>
        {/* Get started button (hero) — opens the sign-up modal */}
        <div className="mt-8 flex flex-wrap gap-3"><button className="btn-primary" onClick={() => access("user", "signup")}>Get started</button><a className="btn-secondary" href="#how">See how it works</a></div>
      </motion.div>
      <motion.div ref={statusBoardRef} className="status-board card relative p-7 lg:min-h-[404px]">
        <div className="mb-5 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-400"><span className="live-pulse" />Campus status board</div>
        {[["Open reports", 42, "text-amber-600", "bg-amber-50"], ["In progress", 18, "text-indigo-600", "bg-indigo-50"], ["Critical, unresolved", 3, "text-rose-600", "bg-rose-50"], ["Resolved this term", 231, "text-emerald-600", "bg-emerald-50"]].map(([label, value, color, bg]) => <div className="hero-stat-item status-row flex items-center justify-between border-b border-slate-100 py-2.5 last:border-0" key={label as string}><span className="flex items-center gap-3 text-sm text-slate-500"><span className={`status-dot ${bg}`} />{label}</span><strong className={`text-3xl ${color}`}><CountUp value={value as number} /></strong></div>)}
        <div className="flex items-center justify-between border-b border-slate-100 py-2.5"><span className="text-sm text-slate-500">Avg. time to resolve</span><strong className="text-3xl text-slate-900">2.4d</strong></div>
        <p className="mt-3 text-center text-[11px] text-slate-400">Sample data shown for illustration — your board reflects your campus.</p>
      </motion.div>
    </section>
    <div className="feature-rail"><div className="feature-rail-inner">{[["Built for school email domains","indigo"],["Mobile-friendly reporting","teal"],["Role-based access","amber"],["Exportable report & inventory data","rose"]].map(([label, tone], index) => <span className={`feature-rail-item rail-${tone}`} key={label}><i>✓</i><b>{label}</b>{index < 3 && <em />}</span>)}</div></div>
    <Reveal><section className="mx-auto max-w-[1440px] px-8 pb-8 pt-14" id="pulse">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-black">Your campus, at a glance</h2><p className="mt-2 text-sm text-slate-600">Live signals help facilities teams decide what needs attention first.</p></div>
        {/* Preview the dashboard button — opens the sign-in modal */}
        <button className="text-sm font-bold text-indigo-600" onClick={() => access("user", "signin")}>Preview the dashboard →</button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "REPORTS THIS WEEK", value: 64, status: "+18%", text: "Most reports are being resolved before they become repeat issues.", fill: "live-fill-indigo", progress: 76, caption: "Trending upward" },
          { label: "RESOLVED ON TIME", value: 87, status: "On track", text: "Teams can see overdue work early and keep users in the loop.", fill: "live-fill-emerald", progress: 87, caption: "On-time fixes" },
          { label: "BUSIEST LOCATION", value: null, displayValue: "Room 204", status: "Watch", text: "3 open reports are grouped together so admins can spot patterns.", fill: "live-fill-amber", progress: 72, caption: "Needs attention" }
        ].map(({ label, value, displayValue, status, text, fill, progress, caption }) => <motion.article whileHover={{ y: -6 }} className="pulse-card card p-5" key={label}><div className="flex items-center justify-between"><span className="text-xs font-black tracking-wider text-slate-400">{label}</span><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-600">{status}</span></div><strong className="mt-4 block text-3xl font-black">{value === null ? displayValue : <><CountUp value={value} />{label === "RESOLVED ON TIME" ? "%" : ""}</>}</strong><p className="mt-2 text-sm leading-5 text-slate-500">{text}</p><LiveProgress value={progress} fill={fill} /><small className="mt-3 block text-xs font-semibold text-slate-400">{caption}</small></motion.article>)}
      </div>
    </section></Reveal>
    <Reveal><section className="mx-auto max-w-6xl px-6 py-20" id="features"><div className="mx-auto mb-10 max-w-2xl text-center"><span className="eyebrow"><Icon name="spark" size={13} /> Features</span><h2 className="mt-4 text-3xl font-black">Everything the school team needs</h2><p className="mt-3 text-slate-600">Fixko covers the whole process — from the first report to the repair history and the information that shows what keeps breaking.</p></div><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{[["clipboard","Issue reporting","Report damage or missing items in seconds, with an optional photo attached."],["activity","Report progress","Every report moves through Pending, Review, Progress, and Resolved."],["chart","Report summary","See repeated issues, departments, and fixing time at a glance."],["alert","Priority & duplicate warnings","Mark how serious an issue is and warn when a similar report is already open."],["box","Room directory","Browse campus buildings and rooms so reports go to the right place."]].map(([icon, title, text], index) => <motion.div whileHover={{ y: -5, scale: 1.01 }} transition={{ type: "spring", stiffness: 300 }} className="feature-card-modern card p-6" key={title}><div className={`feature-icon-modern ${index % 2 ? "sky" : index === 4 ? "rose" : "indigo"}`}><Icon name={icon as IconName} size={20} /></div><h3 className="font-extrabold">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{text}</p><span className="feature-link">Explore feature <Icon name="arrow" size={14} /></span></motion.div>)}</div></section></Reveal>
    <Reveal><section className="how-modern relative mx-auto grid max-w-7xl gap-10 overflow-hidden px-6 py-20 lg:grid-cols-[.82fr_1.18fr] lg:px-10" id="how">
      <div className="how-orb how-orb-one" /><div className="how-orb how-orb-two" /><div className="how-ring" />
      <div className="relative z-10">
        <span className="eyebrow how-eyebrow">A calmer way to get things fixed</span>
        <h2 className="mt-4 max-w-xl text-4xl font-black leading-tight sm:text-5xl">One clear path from <span className="how-gradient-text">“something’s broken”</span> to “all fixed.”</h2>
        <p className="mt-5 max-w-lg text-base leading-7 text-slate-500">Every report follows a clear process, so users know what happens next and admins can act before small issues become expensive ones.</p>
        {/* Step buttons — click one to show that stage of the demo walkthrough */}
        {/* Step buttons — tap one to show that stage of the demo walkthrough */}
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
          <div className="preview-surface">{step === 0 && <><div className="preview-form-icon"><span className="css-icon css-camera" /></div><label className="preview-label">What&apos;s the issue?</label><div className="preview-input">Aircon leaking onto floor <span className="preview-caret" /></div><label className="preview-label">Priority</label>          <div className="preview-priority-options"><Badge value="low" /><Badge value="medium" /><Badge value="critical" /></div><div className="upload-preview mt-5"><span className="css-icon css-camera" /> photo_attached.jpg <Icon name="check" size={14} /></div></>}{step === 1 && <><div className="preview-report-row"><span className="preview-avatar">RA</span><span><strong>Aircon leaking onto floor</strong><small>Room 204 · just now</small></span><Badge value="critical" /></div><div className="preview-alert"><span className="css-icon css-alert" /> 2 similar reports already open for Room 204.</div><div className="preview-assignee"><span className="preview-avatar teal">RA</span><span><strong>R. Aquino</strong><small>Assigned admin</small></span><Icon name="check" size={16} /></div></>}{step === 2 && <><div className="preview-progress-label"><span>Repair progress</span><strong>75%</strong></div><div className="preview-progress"><span /></div><div className="preview-timeline"><span className="timeline-pulse" /><div><strong>Admin is handling the report</strong><small>R. Aquino · checking the unit this afternoon</small></div></div><div className="preview-message">“On it — checking the unit this afternoon.”</div></>}{step === 3 && <><div className="resolved-burst"><span className="resolved-check"><Icon name="check" size={24} /></span><strong>Issue resolved</strong><small>Closed in 4h 12m</small></div><div className="rating-stars" aria-label="5 out of 5 stars"><span>★</span><span>★</span><span>★</span><span>★</span><span>★</span></div><div className="preview-message">“Fixed same day, thank you!”</div></>}</div>
        </div>
        <div className="preview-float-card preview-float-bottom"><span className="preview-icon"><Icon name="activity" size={16} /></span><span><strong>Campus pulse</strong><small>12 reports moving today</small></span><span className="mini-bars"><i /><i /><i /><i /></span></div>
      </motion.div>
    </section></Reveal>
    <Reveal><section className="mx-auto max-w-6xl px-6 py-16" id="roles"><div className="mb-9 text-center"><span className="eyebrow">Built for every role</span><h2 className="mt-4 text-3xl font-black">One system for reporting and campus operations</h2><p className="mt-3 text-slate-600">Each account sees exactly what is relevant to them — nothing more.</p></div><div className="grid gap-4 md:grid-cols-2">{[["Users","Report and track your own reports",["Submit a report with photo and priority in under a minute","See the status of everything you’ve reported","Message the admin on your report","Rate the repair once it’s resolved"]],["Admins","Full visibility and control across campus",["See every report campus-wide with live progress","Update reports and report status","Track building conditions from every report","Export reports and view analytics"]]].map(([title, sub, items], i) => <motion.div whileHover={{ y: -5 }} className={`card role-card border-t-4 p-7 ${i === 1 ? "border-t-slate-900" : "border-t-indigo-600"}`} key={title as string}><h3 className="text-xl font-black">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-400">{sub}</p><ul className="mt-5 space-y-3">{(items as string[]).map(item => <li className="flex gap-2 text-sm leading-5 text-slate-600" key={item}><span className="font-black text-emerald-500">✓</span>{item}</li>)}</ul></motion.div>)}</div></section></Reveal>
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
    <Reveal><section className="faq-modern mx-auto max-w-6xl px-6 py-12 lg:px-10 lg:py-14" id="faq"><div className="mb-8 text-center"><span className="eyebrow">FAQ</span><h2 className="mt-4 text-3xl font-black sm:text-4xl">Good to know</h2><p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">Quick answers for users and the admins keeping campus moving.</p></div><div className="faq-grid">{["Who can sign up?","What do users need to sign up?","Why does the report form ask for my ID again?","Can I report anonymously?","What happens after I submit a report?","Can admins export the data?"].map((question, index) => <div className="faq-card" key={question}><button className="flex w-full items-center justify-between gap-4 p-4 text-left text-sm font-bold sm:p-5" onClick={() => setOpenFaq(openFaq === index ? null : index)}><span>{question}</span><span className={`faq-plus ${openFaq === index ? "open" : ""}`}>+</span></button><div className={`faq-answer ${openFaq === index ? "open" : ""}`}><div className="faq-answer-inner"><p>{["Users sign up with their school email. Admin accounts are pre-built by the school.","Just your school email and School ID.","It is a verification step on every report. The field is pre-filled but remains editable.","No. Every report is tied to a verified account so admins can follow up.","It is checked for duplicates and moves through Pending, Review, In progress, and Resolved.","Yes — admins can export reports to CSV."][index]}</p></div></div></div>)}</div></section></Reveal>
    <section className="cta-band cta-wide mx-4 mb-12 mt-8 rounded-2xl px-6 py-8 text-white lg:mx-auto lg:max-w-[1700px] lg:px-14 lg:py-10">
      <div className="cta-orbit cta-orbit-one" />
      <div className="cta-orbit cta-orbit-two" />
      <div className="relative z-10 grid items-center gap-7 lg:grid-cols-[1.2fr_.8fr]">
        <div className="text-left">
          <span className="cta-kicker"><Icon name="spark" size={14} /> Make every campus issue easier to fix</span>
          <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight sm:text-4xl lg:text-[2.65rem]">Turn “someone should report this” into <span className="text-indigo-200">“it’s already being fixed.”</span></h2>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-indigo-100 sm:text-base">Give your campus one trusted place to speak up, while your facilities team gets the context, priority, and visibility to act faster.</p>
          {/* Bottom call-to-action buttons — open the sign-up / sign-in modals */}
        <div className="mt-5 flex flex-wrap gap-3"><button className="cta-primary-button" onClick={() => access("user", "signup")}>Start reporting smarter <Icon name="arrow" size={16} /></button><button className="cta-secondary-button" onClick={() => access("user", "signin")}>Sign in to Fixko</button></div>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs font-semibold text-indigo-200"><span><Icon name="check" size={14} /> School-ready setup</span><span><Icon name="check" size={14} /> Verified accounts</span><span><Icon name="check" size={14} /> No setup fee</span></div>
        </div>
        <div className="cta-proof-panel">
          <div className="flex items-center justify-between"><span className="text-xs font-black uppercase tracking-widest text-indigo-200">Why schools choose Fixko</span><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-200">Built for campus</span></div>
          <div className="mt-4 space-y-3"><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="activity" size={17} /></span><div><strong>Faster response</strong><p>Every issue reaches the right people with clear next steps.</p></div></div><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="users" size={17} /></span><div><strong>More trust</strong><p>Keep reporters informed from submission to resolution.</p></div></div><div className="cta-proof-row"><span className="cta-proof-icon"><Icon name="chart" size={17} /></span><div><strong>Better decisions</strong><p>Use real patterns to prevent repeat facility problems.</p></div></div></div>
        </div>
      </div>
    </section>
    <footer className="site-footer"><div className="footer-glow footer-glow-one" /><div className="footer-glow footer-glow-two" /><div className="footer-topline"><span><i /> Fixing the small things that keep campus moving</span>    <span className="footer-status"><Icon name="shield" size={14} /> Built for trusted school communities</span></div><div className="footer-grid"><div className="footer-brand"><div className="flex items-center gap-2"><div className="brand-mark-modern"><BrandMark /></div><strong className="text-lg text-white">Fixko</strong></div><p className="mt-4 max-w-xs text-sm leading-6 text-slate-400">Facility reporting and report management built for schools — from the first report to the repair log.</p><div className="footer-brand-meta"><span><Icon name="activity" size={14} /> Clear status</span><span><Icon name="users" size={14} /> One campus view</span></div><div className="mt-5 flex gap-2"><a className="social social-mail" href="#faq" aria-label="Email Fixko"><Icon name="mail" size={16} /></a><a className="social" href="#roles" aria-label="Fixko on Facebook">f</a><a className="social" href="#features" aria-label="Fixko on X">𝕏</a></div></div>{[["Product","Features","How it works","For users","For admins"],["Resources","FAQ","Report an issue","Contact support"],["Company","About Fixko","Contact us","Feedback"],["Legal","Privacy policy","Terms of use","Data handling"]].map(([heading, ...links]) => <div className="footer-column" key={heading}><h4 className="text-xs font-black uppercase tracking-wider text-white">{heading}</h4><ul className="mt-5 space-y-3">{links.map(link => <li key={link}>{link === "Privacy policy" ? <button className="footer-link privacy-policy-link" onClick={() => setPrivacyMenuOpen(true)}>{link}<span className="footer-link-arrow">→</span></button> : <a className="footer-link" href={`#${link === "Features" ? "features" : link === "How it works" ? "how" : link === "FAQ" ? "faq" : "roles"}`}>{link}<span className="footer-link-arrow">→</span></a>}</li>)}</ul></div>)}</div></footer>
      {privacyMenuOpen && (
        <PrivacyGate
          mode={privacyAccepted ? "view" : "forced"}
          onClose={() => setPrivacyMenuOpen(false)}
          onAccept={acceptPrivacyPolicy}
        />
      )}
    </main>;
}

// ============================================================
// PRIVACY GATE — the full-screen Privacy Policy pop-up. New
// visitors must read it and tick the box before entering the site
// ============================================================
/** Full-screen privacy-policy gate: must read + accept before entering the site. */
function PrivacyGate({ mode, onClose, onAccept }: { mode: "forced" | "view"; onClose: () => void; onAccept: () => void }) {
  const [checked, setChecked] = useState(false);
  const [scrolledEnd, setScrolledEnd] = useState(false);

  useEffect(() => {
    // Stops the page behind the pop-up from scrolling while it's open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const forced = mode === "forced";

  return createPortal(
    <div className="privacy-gate-overlay" role="dialog" aria-modal="true" aria-label="Privacy policy">
      <div className="privacy-gate-panel">
        <div className="privacy-gate-head">
          <span className="privacy-gate-icon"><Icon name="shield" size={20} /></span>
          <div>
            <span className="admin-panel-kicker">Fixko · Legal</span>
            <h2>Privacy Policy &amp; Data Consent</h2>
            <small>Last updated: October 2026 · Please read before using Fixko</small>
          </div>
          {!forced && (
            <button type="button" className="report-modal-close" aria-label="Close privacy policy" onClick={onClose}>
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
        {/* Scrollable policy text — notes when the reader reaches the bottom */}
        <div
          className="privacy-gate-body"
          onScroll={(event) => {
            const el = event.currentTarget;
            setScrolledEnd(el.scrollTop + el.clientHeight >= el.scrollHeight - 24);
          }}
        >
          <section>
            <h3>1. Information we collect</h3>
            <p>
              Fixko collects the details you provide when creating an account and reporting a facility issue:
              your <b>full name</b>, <b>school email address</b>, <b>School ID</b>, role and department; and, for each
              report you submit, the <b>room and building</b>, issue description, priority, and any <b>photo</b> you attach.
              We also store the messages you exchange on a report and your feedback rating after resolution.
            </p>
          </section>
          <section>
            <h3>2. How we use your information</h3>
            <p>
              Your data is used to verify that you belong to the school, to connect every report to the person who
              submitted it, to let admins and maintenance personnel follow up on issues, to notify you about status
              changes, and to produce summary analytics (counts, trends by building/room) that help the school
              prioritize repairs. Personal data is <b>never sold</b> or used for advertising.
            </p>
          </section>
          <section>
            <h3>3. Who can see your data</h3>
            <p>
              Reports and your identity are visible to <b>school administrators</b> and the <b>maintenance personnel</b>
              assigned to a report, and to you. Other users never see who reported an issue they are not part of.
              Suspended or locked accounts can still see their dashboard but cannot submit anything.
            </p>
          </section>
          <section>
            <h3>4. Moderation &amp; account integrity</h3>
            <p>
              Photos must be genuine. Submissions are checked for <b>AI-generated or edited images</b>, and reports may
              be flagged by admins for inappropriate content or misinformation. A first detected attempt produces a
              warning; a second attempt locks the account automatically. Staff who neglect assigned reports are warned
              twice before suspension or lock. You will always receive a notification explaining any warning.
            </p>
          </section>
          <section>
            <h3>5. Your choices and rights</h3>
            <p>
              You can view and edit your own reports and notifications at any time. To correct or delete your account
              and its data, contact your school administrator. Resolved reports are kept as an operational record unless
              removed by an administrator. You can sign out at any time, and you may withdraw this consent by having
              your account removed — subject to the school's record-keeping rules.
            </p>
          </section>
          <section>
            <h3>6. Security &amp; retention</h3>
            <p>
              Sessions use secure tokens, and passwords are stored encrypted; they can never be read. Photos may be
              resized and stored with your report. Data is retained while your account is active and for a reasonable
              period afterwards for audit purposes.
            </p>
          </section>
          <section>
            <h3>7. Changes &amp; contact</h3>
            <p>
              This policy may be updated as features evolve; significant changes will be announced in your
              notifications. Questions about your data can be sent to the school administrator or your Fixko support
              contact.
            </p>
          </section>
          <p className="privacy-gate-meta">By continuing to use Fixko you agree to this policy. Future changes
            will be collected in your notifications.</p>
        </div>
        <div className="privacy-gate-foot">
          {/* Agree checkbox — the Continue button stays disabled until this is ticked */}
          <label className="privacy-gate-agree">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => setChecked(event.target.checked)}
            />
            <span>
              I have <b>read the Privacy Policy</b> and agree to how Fixko collects and uses my data.
            </span>
          </label>
          {/* Continue button — unlocks the site once the policy is read and agreed to */}
          <button
            type="button"
            className="privacy-gate-continue"
            disabled={!checked}
            onClick={onAccept}
            title={checked ? "" : "Read the policy and tick the box to continue"}
          >
            Continue to Fixko <Icon name="arrow" size={14} />
          </button>
          {!forced && <small>You can close this window — you have already accepted the policy.</small>}
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================================
// PROFILE SETTINGS — the pop-up showing the signed-in person's
// account details; students fill in required info and anyone can
// change their password here
// ============================================================
/** Small modal showing the signed-in account's email, name and student ID.
 *  Students can edit their contact details; every role can change password. */
function ProfileSettings({
  user,
  role,
  onClose,
  onSaved,
}: {
  user: ApiUser | null;
  role: Role;
  onClose: () => void;
  onSaved?: (user: ApiUser) => void;
}) {
  const isStudent = role === "user";
  const [address, setAddress] = useState(user?.address ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [blockSection, setBlockSection] = useState(user?.block_section ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [saved, setSaved] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  // Each password field gets its own show/hide toggle.
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // Per-field validation messages — same handling as sign in / sign up.
  const [passwordFieldErrors, setPasswordFieldErrors] = useState<{
    current: string;
    next: string;
    confirm: string;
  }>({ current: "", next: "", confirm: "" });

  /** Identity pieces that a new password must not contain. */
  const passwordIdentity = [
    user?.first_name, user?.last_name, user?.middle_name,
    user?.email?.split("@")[0],
  ].filter(Boolean) as string[];

  const checkPasswordField = (
    field: "current" | "next" | "confirm",
    value: string
  ) => {
    let message = "";
    if (field === "current") {
      if (!value) message = "Current password is required.";
    } else if (field === "next") {
      message = passwordPolicyError(value, passwordIdentity);
    } else {
      if (!value) message = "Confirmation is required.";
      else if (newPassword !== value) message = "Passwords do not match.";
    }
    setPasswordFieldErrors((current) => ({ ...current, [field]: message }));
    return message;
  };

  useEffect(() => {
    // Locks background scrolling and closes the pop-up when Esc is pressed
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const fullName = user?.name || [user?.last_name, user?.first_name].filter(Boolean).join(", ") || "Not provided";

  return createPortal(
    <div className="privacy-gate-overlay" role="dialog" aria-modal="true" aria-label="Profile settings" onClick={onClose}>
      <div className="privacy-gate-panel profile-settings-panel" onClick={(event) => event.stopPropagation()}>
        <div className="privacy-gate-head">
          <span className="privacy-gate-icon"><Icon name="users" size={20} /></span>
          <div>
            <span className="admin-panel-kicker">Fixko · Account</span>
            <h2>Profile settings</h2>
            <small>Your account details as stored by the school</small>
          </div>
          {/* Close (×) button for profile settings */}
          <button type="button" className="report-modal-close" aria-label="Close profile settings" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="privacy-gate-body profile-settings-body">
          <div className="app-dropdown-profile profile-settings-avatar-row">
            <div className="app-profile-avatar">
              {user?.first_name ? user.first_name.slice(0, 1).toUpperCase() : "U"}
              {user?.last_name ? user.last_name.slice(0, 1).toUpperCase() : "S"}
              <span className="app-profile-status" />
            </div>
            <div>
              <strong>{fullName}</strong>
              <small>{role === "admin" ? "Admin" : role === "maintenance" ? "Maintenance" : "User"}</small>
            </div>
          </div>
          <dl className="profile-settings-list">
            <div className="profile-settings-row">
              <dt><Icon name="mail" size={15} /> Email</dt>
              <dd>{user?.email || "Not provided"}</dd>
            </div>
            <div className="profile-settings-row">
              <dt><Icon name="users" size={15} /> Name</dt>
              <dd>{fullName}</dd>
            </div>
            {isStudent && (
              <div className="profile-settings-row">
                <dt><Icon name="clipboard" size={15} /> Student ID</dt>
                <dd>{user?.school_id || "Not provided"}</dd>
              </div>
            )}
          </dl>
          {/* Details form — saves address, gender and block/section, which students must
              fill in before they can submit reports */}
          {isStudent && (
            <form
              className="profile-settings-details"
              onSubmit={async (event) => {
                event.preventDefault();
                if (saving) return;
                // Same security checks as sign up before touching the server.
                const errors = {
                  current: checkPasswordField("current", currentPassword),
                  next: checkPasswordField("next", newPassword),
                  confirm: checkPasswordField("confirm", confirmPassword),
                };
                if (errors.current || errors.next || errors.confirm) return;
                setSaving(true);
                setFormError("");
                setSaved(false);
                try {
                  const updated = await updateProfile({
                    address: address.trim(),
                    gender: gender as "male" | "female" | "other",
                    block_section: blockSection.trim(),
                  });
                  onSaved?.(updated);
                  setSaved(true);
                } catch (requestError) {
                  setFormError(
                    requestError instanceof Error
                      ? requestError.message
                      : "Could not save your changes."
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              <b>Required details</b>
              <p>Complete these to unlock report submission.</p>
              <label>
                <span><Icon name="building" size={13} /> Address</span>
                <input
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="House no. / street / barangay, city"
                  maxLength={255}
                  required
                />
              </label>
              <label>
                <span><Icon name="users" size={13} /> Gender</span>
                <select value={gender} onChange={(event) => setGender(event.target.value)} required>
                  <option value="">Select gender…</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label>
                <span><Icon name="grid" size={13} /> Block / Section</span>
                <input
                  value={blockSection}
                  onChange={(event) => setBlockSection(event.target.value)}
                  placeholder="e.g. Block 2 – BSIT 3-A"
                  maxLength={120}
                  required
                />
              </label>
              {formError && <p className="auth-error">{formError}</p>}
              {saved && <p className="profile-settings-saved">Saved ✓ Details updated.</p>}
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save details"}
              </button>
            </form>
          )}
          <div className="profile-settings-passcard">
            {/* Change password toggle — opens/closes the password form */}
            <button
              type="button"
              className="profile-settings-toggle"
              aria-expanded={passwordOpen}
              onClick={() => setPasswordOpen((open) => !open)}
            >
              <Icon name="lock" size={14} /> Change password
              <span className={`profile-settings-toggle-arrow ${passwordOpen ? "is-open" : ""}`} />
            </button>
            {/* Change password form — checks the current password with the backend,
                then saves the new one */}
            {passwordOpen && (
              <form
                className="profile-settings-details"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (saving) return;
                  setSaving(true);
                  setFormError("");
                  setSaved(false);
                  try {
                    const updated = await updateProfile({
                      current_password: currentPassword,
                      password: newPassword,
                      password_confirmation: confirmPassword,
                    });
                    onSaved?.(updated);
                    setCurrentPassword("");
                    setNewPassword("");
                    setConfirmPassword("");
                    setPasswordFieldErrors({ current: "", next: "", confirm: "" });
                    setSaved(true);
                  } catch (requestError) {
                    setFormError(
                      requestError instanceof Error
                        ? requestError.message
                        : "Could not change your password."
                    );
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                <div className="profile-password-field">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(event) => {
                      setCurrentPassword(event.target.value.slice(0, 25));
                      if (passwordFieldErrors.current) checkPasswordField("current", event.target.value.slice(0, 25));
                    }}
                    onBlur={() => checkPasswordField("current", currentPassword)}
                    placeholder="Current password"
                    autoComplete="current-password"
                    aria-invalid={Boolean(passwordFieldErrors.current)}
                    aria-errormessage={passwordFieldErrors.current || undefined}
                    required
                    className={
                      passwordFieldErrors.current ? "is-invalid" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="profile-password-eye"
                    aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                    onClick={() => setShowCurrentPassword((visible) => !visible)}
                  >
                    <Icon name={showCurrentPassword ? "eye" : "eyeOff"} size={15} />
                  </button>
                </div>
                {passwordFieldErrors.current && (
                  <p className="profile-password-error" role="alert">⚠ {passwordFieldErrors.current}</p>
                )}
                <div className="profile-password-field">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(event) => {
                      const next = event.target.value.slice(0, 25);
                      setNewPassword(next);
                      if (passwordFieldErrors.next) checkPasswordField("next", next);
                      if (passwordFieldErrors.confirm) checkPasswordField("confirm", confirmPassword);
                    }}
                    onBlur={() => checkPasswordField("next", newPassword)}
                    placeholder="New password (min. 8 characters)"
                    autoComplete="new-password"
                    aria-invalid={Boolean(passwordFieldErrors.next)}
                    aria-errormessage={passwordFieldErrors.next || undefined}
                    className={
                      passwordFieldErrors.next ? "is-invalid" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="profile-password-eye"
                    aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                    onClick={() => setShowNewPassword((visible) => !visible)}
                  >
                    <Icon name={showNewPassword ? "eye" : "eyeOff"} size={15} />
                  </button>
                </div>
                {passwordFieldErrors.next && (
                  <p className="profile-password-error" role="alert">⚠ {passwordFieldErrors.next}</p>
                )}
                <div className="profile-password-field">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => {
                      setConfirmPassword(event.target.value.slice(0, 25));
                      if (passwordFieldErrors.confirm) checkPasswordField("confirm", event.target.value.slice(0, 25));
                    }}
                    onBlur={() => checkPasswordField("confirm", confirmPassword)}
                    placeholder="Confirm new password"
                    autoComplete="new-password"
                    aria-invalid={Boolean(passwordFieldErrors.confirm)}
                    aria-errormessage={passwordFieldErrors.confirm || undefined}
                    className={
                      passwordFieldErrors.confirm ? "is-invalid" : undefined
                    }
                  />
                  <button
                    type="button"
                    className="profile-password-eye"
                    aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                  >
                    <Icon name={showConfirmPassword ? "eye" : "eyeOff"} size={15} />
                  </button>
                </div>
                {passwordFieldErrors.confirm && (
                  <p className="profile-password-error" role="alert">⚠ {passwordFieldErrors.confirm}</p>
                )}
                {formError && <p className="auth-error">{formError}</p>}
                {saved && <p className="profile-settings-saved">Password updated ✓</p>}
                {/* Update password button — sends the new password to the backend */}
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? "Updating…" : "Update password"}
                </button>
              </form>
            )}
          </div>
        </div>
        <div className="privacy-gate-foot">
          {/* Done button — closes profile settings */}
          <button type="button" className="privacy-gate-continue" onClick={onClose}>
            Done <Icon name="check" size={14} />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ============================================================
// APP SHELL — the main app frame used after signing in: sidebar
// menu, top bar with search + notifications + profile, and the
// page content that swaps based on the chosen menu item
// ============================================================
function AppShell({ role, onSignOut }: { role: Role; onSignOut: () => void }) {
  const [page, setPage] = useState(role === "admin" ? "All reports" : role === "maintenance" ? "Assigned reports" : "Dashboard");
  const [query, setQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  // Signed-in account details, cached in localStorage at login time.
  const [me, setMe] = useState<ApiUser | null>(null);
  useEffect(() => {
    // Loads the signed-in account's details saved at login
    try {
      setMe(JSON.parse(window.localStorage.getItem("fixko-user") || "null") as ApiUser | null);
    } catch {
      setMe(null);
    }
  }, []);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  // Students must complete address, gender, and block/section before reporting.
  const profileComplete =
    !me || me.role !== "user" || Boolean(me.address && me.gender && me.block_section);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [liveReports, setLiveReports] = useState<Report[]>([]);
  const [focusReportId, setFocusReportId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [rooms, setRooms] = useState<ApiRoom[]>([]);
  const [dataError, setDataError] = useState("");
  // Accessibility text-size control inside the profile menu (volume-slider style).
  const [textScale, setTextScale] = useState(100);
  // Text size is saved per account: leaving returns to 100%, and the boost
  // only re-appears after signing in to the account that adjusted it.
  const scaleKey = me?.email ? `fixko-text-scale:${me.email}` : "fixko-text-scale";
  useEffect(() => {
    let stored = "";
    const key = me?.email ? `fixko-text-scale:${me.email}` : "fixko-text-scale";
    try {
      stored = window.localStorage.getItem(key) ?? "";
    } catch {
      stored = "";
    }
    const scale = Math.min(140, Math.max(100, Number(stored) || 100));
    document.documentElement.style.setProperty("--fixko-text-zoom", String(scale / 100));
    setTextScale(scale);
  }, [me?.email]);
  const headerRef = useRef<HTMLElement>(null);
  const nav = useMemo(
    () =>
      role === "admin"
        ? ["All reports", "Report summary", "Done works", "Users", "Notifications", "Recycle Bin"]
        : role === "maintenance"
          ? ["Assigned reports", "Done works", "Notifications"]
          : ["Dashboard", "New report", "My reports", "Notifications"],
    [role]
  );

  const searchResults = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return [
      ...nav
        .filter((item) => item.toLowerCase().includes(term))
        .map((item) => ({ type: "Workspace", id: item, label: item, detail: "Open workspace" })),
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
          id: report.id,
          label: `${report.id} · ${report.title}`,
          detail: `${report.building} · ${report.room} · ${statusLabel[report.status]}`,
        })),
    ].slice(0, 6);
  }, [liveReports, nav, query]);

  const open = liveReports.filter((t) => t.status !== "resolved").length;
  const activeNotifications = notifications.filter((n) => !n.archived_at);
  const unreadCount = activeNotifications.filter((n) => !n.is_read).length;

  const loadNotifications = useCallback(
    (scope: "active" | "archived", targetPage: number) =>
      scope === "archived" ? getArchivedNotifications(targetPage) : getNotifications(targetPage),
    []
  );

  const refreshNotificationBadges = useCallback(() => {
    return getNotifications()
      .then((response) => setNotifications(response.data))
      .catch(() => {});
  }, []);

  // Re-sync badge counts whenever the window regains focus, so they can
  // never stay stale after actions in another tab or a failed earlier sync.
  useEffect(() => {
    const onFocus = () => refreshNotificationBadges();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshNotificationBadges]);

  useEffect(() => {
    // Loads all the app's live data once when the shell opens:
    // reports, rooms, and notifications from the API
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
    // Restores recent searches saved in the browser from last time
    const savedHistory = window.localStorage.getItem("fixko-search-history");
    if (savedHistory) setSearchHistory(JSON.parse(savedHistory));
  }, []);

  useEffect(() => {
    // Re-fetches notifications whenever the user opens the Notifications page
    if (page !== "Notifications") return;
    getNotifications()
      .then((response) => setNotifications(response.data))
      .catch(() => {});
  }, [page]);

  // Marks a notification as read in the backend when it's clicked/opened
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

  // Moves a notification to (or out of) the archived section
  const archiveNotificationSeen = (notification: ApiNotification, archived: boolean) => {
    archiveNotification(notification.id, archived)
      .then((updated) =>
        setNotifications((current) =>
          archived
            ? current.filter((item) => item.id !== updated.id)
            : current.map((item) => (item.id === updated.id ? updated : item))
        )
      )
      .catch(() => refreshNotificationBadges());
  };

  // Deletes the selected notifications for good
  const deleteNotificationsByIds = (ids: number[]) => {
    if (!ids.length) return;
    setNotifications((current) => current.filter((item) => !ids.includes(item.id)));
    Promise.allSettled(ids.map((id) => deleteNotification(id)))
      .then(() => refreshNotificationBadges());
  };

  // Clears every notification at once (active list or archive)
  const deleteAllNotifications = (scope: "archived" | "all") => {
    setNotifications((current) =>
      scope === "all"
        ? []
        : current.filter((item) => !!item.archived_at)
    );
    deleteNotifications(scope)
      .then(refreshNotificationBadges)
      .catch(refreshNotificationBadges);
  };

  useEffect(() => {
    // Closes the search / profile / notification pop-ups when the user
    // clicks outside them or presses Escape
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

  // Remembers the current search term in the recent-searches list
  const saveSearch = (value: string) => {
    const term = value.trim();
    if (!term) return;
    const nextHistory = [term, ...searchHistory.filter((item) => item.toLowerCase() !== term.toLowerCase())]
      .slice(0, 6);
    setSearchHistory(nextHistory);
    window.localStorage.setItem("fixko-search-history", JSON.stringify(nextHistory));
  };

  // Switches the main content to a different page and closes any open menus
  const choosePage = (item: string) => {
    setPage(item);
    setMobileMenuOpen(false);
    setSearchOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  };

  /** Open an exact report: jump to the page that lists it and expand it. */
  const openReport = (reportId: string) => {
    setFocusReportId(reportId);
    choosePage(
      role === "admin"
        ? "Report summary"
        : role === "maintenance"
          ? "Assigned reports"
          : "My reports"
    );
  };

  // Updates a report's status (Pending/Review/Progress/etc.) on the backend
  const handleStatusUpdated = async (report: Report, status: Status) => {
    try {
      const backendStatus =
        status === "review" ? "under_review" : status === "progress" ? "in_progress" : status === "maint" ? "under_maintenance" : status;
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

  /** A flagged report is deleted on the backend: drop it from the live list. */
  const handleFlaggedDeleted = (apiId: number) => {
    setLiveReports((current) =>
      current.filter((item) => item.id !== `FX-${String(apiId).padStart(4, "0")}`)
    );
  };

  // Assigns (or unassigns) maintenance staff to a report
  const handleAssignUpdated = async (report: Report, staffId: string) => {
    try {
      const numericId = report.id.replace(/^FX-0*/, "");
      const response = await assignReport(numericId, staffId ? Number(staffId) : null);
      const nextReport = mapApiReport(response);
      setLiveReports((current) =>
        current.map((item) => (item.id === report.id ? nextReport : item))
      );
      setDataError("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "The report could not be assigned.";
      const requestId =
        error instanceof ApiError && error.requestId ? ` Reference: ${error.requestId}` : "";
      setDataError(`${message}${requestId}`);
    }
  };

  /** Sign out restores the normal 100% text size right away. */
  const handleSignOut = () => {
    document.documentElement.style.setProperty("--fixko-text-zoom", "1");
    setTextScale(100);
    try {
      window.localStorage.removeItem(scaleKey);
    } catch {
      // storage unavailable — nothing to clear
    }
    onSignOut();
  };

  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  const displayRole = role === "admin" ? "Admin" : role === "maintenance" ? "Maintenance" : "User";
  // Show the signed-in person's real name; keep the generic account labels
  // only as a fallback while the cached account details are loading.
  const fallbackLabel = role === "admin" ? "Admin account" : role === "maintenance" ? "Maintenance account" : "User account";
  const accountLabel = me?.name?.trim() ? me.name.trim() : fallbackLabel;
  const accountInitials = (() => {
    const fallback = role === "admin" ? "AD" : role === "maintenance" ? "MT" : "US";
    const name = me?.name?.trim();
    if (!name) return fallback;
    const initials = name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
    return initials || fallback;
  })();

  return (
    <div className={`app-shell workspace-${role} min-h-screen`}>
      <header
        ref={headerRef}
        className="app-header site-nav sticky top-0 z-[70] border-b border-slate-200/80 bg-white/85 backdrop-blur"
      >
        <div className="mx-auto flex min-h-[70px] w-full max-w-[1700px] items-center gap-4 px-5 lg:px-10">
          <a
            className="nav-brand flex items-center gap-2"
            href="#"
            onClick={() =>
              choosePage(
                role === "admin"
                  ? "All reports"
                  : role === "maintenance"
                    ? "Assigned reports"
                    : "Dashboard"
              )
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
                            if (result.type === "Workspace") {
                              choosePage(result.label);
                            } else {
                              openReport(result.id);
                            }
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
              {/* Bell button — opens the notifications dropdown */}
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
                  <span className="app-notification-count" aria-hidden="true">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
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
                    {notifications.filter((n) => !n.archived_at).slice(0, 8).map((notification, index) => {
                      const kind = notificationKind(notification.message);
                      const meta = notificationKindMeta[kind];
                      return (
                        <button
                          key={notification.id}
                          type="button"
                          className={`notification-item app-dropdown-notification ${
                            notification.is_read ? "" : "is-unread"
                          }`}
                          style={{ animationDelay: `${Math.min(index, 4) * 70}ms` }}
                          onClick={() => {
                            markNotificationSeen(notification);
                            if (notification.related_report_id) {
                              openReport(
                                `FX-${String(notification.related_report_id).padStart(4, "0")}`
                              );
                            } else {
                              choosePage("Notifications");
                            }
                          }}
                        >
                          <span className={`notification-item-icon ${meta.tone}`}>
                            <Icon name={meta.icon} size={16} />
                          </span>
                          <div className="notification-item-content">
                            <strong>{notification.message}</strong>
                            <small>
                              {!notification.is_read && <span className="app-dropdown-unread-dot" />}
                              {relativeTime(notification.created_at)}
                            </small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="app-dropdown-empty">
                    <span>
                      <Icon name="check" size={17} />
                    </span>
                    <strong>You&apos;re all caught up</strong>
                    <small>New updates will appear here.</small>
                  </div>
                )}
                {/* View all notifications — jumps to the full Notifications page */}
                <button
                  className="app-dropdown-link"
                  onClick={() => choosePage("Notifications")}
                >
                  <span className="app-dropdown-link-pill">
                    <Icon name="bell" size={13} />
                    View all notifications
                  </span>
                  <span className="app-dropdown-link-arrow">
                    <Icon name="arrow" size={14} />
                  </span>
                </button>
              </div>
            </div>
            <div className="app-header-menu hidden sm:block">
              {/* Profile button — opens the account menu (settings, log out, text size) */}
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
                {/* Text size slider — makes all text bigger for easier reading */}
                <label
                  className="app-textscale"
                  title={`Text size: ${textScale}%`}
                >
                  <Icon name="eye" size={16} />
                  <input
                    type="range"
                    className="app-textscale-slider"
                    min={100}
                    max={140}
                    step={5}
                    value={textScale}
                    aria-label="Bigger text"
                    onChange={(event) => {
                      const scale = Number(event.target.value);
                      setTextScale(scale);
                      // Apply at most once per animation frame so dragging stays smooth.
                      const root = document.documentElement;
                      const win = window as Window & {
                        __textScaleRaf?: number;
                      };
                      if (win.__textScaleRaf) cancelAnimationFrame(win.__textScaleRaf);
                      win.__textScaleRaf = requestAnimationFrame(() => {
                        win.__textScaleRaf = undefined;
                        root.style.setProperty("--fixko-text-zoom", String(scale / 100));
                      });
                      try {
                        window.localStorage.setItem(scaleKey, String(scale));
                      } catch {
                        // storage unavailable — setting for this session only
                      }
                    }}
                  />
                  <span className="app-textscale-value">{textScale}%</span>
                </label>
                <div className="app-dropdown-divider" />
                {/* Profile settings — opens the account details pop-up */}
                <button
                  type="button"
                  className="app-dropdown-settings"
                  onClick={() => {
                    setProfileOpen(false);
                    setProfileSettingsOpen(true);
                  }}
                >
                  <Icon name="users" size={16} />
                  Profile settings
                </button>
                {role !== "admin" && (
                  <>
                    <div className="app-dropdown-divider" />
                    {/* Log out — asks for confirmation before signing out */}
                    <button
                      type="button"
                      className="app-dropdown-action app-dropdown-signout"
                      onClick={() => {
                        setProfileOpen(false);
                        setSignOutConfirmOpen(true);
                      }}
                    >
                      <Icon name="logout" size={16} />
                      Log out
                    </button>
                  </>
                )}
              </div>
              {profileSettingsOpen && (
                <ProfileSettings
                  user={me}
                  role={role}
                  onSaved={(updated) => {
                    setMe(updated);
                    try {
                      window.localStorage.setItem("fixko-user", JSON.stringify(updated));
                    } catch {}
                  }}
                  onClose={() => setProfileSettingsOpen(false)}
                />
              )}
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
                      : item === "Done works"
                        ? "check"
                        : item === "Users"
                          ? "users"
                          : item === "Recycle Bin"
                            ? "trash"
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
                    {item === "Notifications" && unreadCount > 0 ? (
                      <em
                        className={`admin-sidebar-badge ${unreadCount > 99 ? "is-long" : ""} ${
                          sidebarCollapsed ? "is-dot" : ""
                        }`}
                      >
                        {unreadCount > 99 ? "99+" : unreadCount}
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
                  onClick={() => setSignOutConfirmOpen(true)}
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
              {page === "New report" && !profileComplete ? (
                <section className="card profile-gate">
                  <span className="profile-gate-icon">
                    <Icon name="lock" size={22} />
                  </span>
                  <strong>Complete your details to report</strong>
                  <p>
                    Before submitting a report, your profile needs an address,
                    gender, and block/section. This helps maintenance reach you
                    quickly.
                  </p>
                  <ul>
                    <li className={me?.address ? "is-done" : ""}>Address {me?.address ? "✓" : ""}</li>
                    <li className={me?.gender ? "is-done" : ""}>Gender {me?.gender ? "✓" : ""}</li>
                    <li className={me?.block_section ? "is-done" : ""}>Block / Section {me?.block_section ? "✓" : ""}</li>
                  </ul>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => setProfileSettingsOpen(true)}
                  >
                    Open profile settings
                    <Icon name="arrow" size={15} />
                  </button>
                </section>
              ) : page === "New report" ? (
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
                  focusId={focusReportId}
                  onFocused={() => setFocusReportId(null)}
                  onStatusUpdated={handleStatusUpdated}
                  onAssigned={handleAssignUpdated}
                  onFlaggedDeleted={handleFlaggedDeleted}
                />
              ) : page === "Done works" && (role === "admin" || role === "maintenance") ? (
                <DoneWorks reports={liveReports} isAdmin={role === "admin"} onFlaggedDeleted={handleFlaggedDeleted} />
              ) : page === "Assigned reports" && role === "maintenance" ? (
                <MaintenanceBoard
                  reports={liveReports}
                  focusId={focusReportId}
                  onFocused={() => setFocusReportId(null)}
                  onStatusUpdated={handleStatusUpdated}
                />
              ) : page === "My reports" ? (
                <MyReports
                  reportData={liveReports}
                  focusId={focusReportId}
                  onFocused={() => setFocusReportId(null)}
                  onCommentAdded={(reportId, comment) =>
                    setLiveReports((current) =>
                      current.map((item) =>
                        item.id === reportId
                          ? { ...item, comments: [...item.comments, comment] }
                          : item
                      )
                    )
                  }
                  onFeedbackStored={(reportId, feedback) =>
                    setLiveReports((current) =>
                      current.map((item) =>
                        item.id === reportId
                          ? {
                              ...item,
                              feedback: {
                                rating: feedback.rating,
                                comment: feedback.comment ?? "",
                                created_at: feedback.created_at,
                              },
                            }
                          : item
                      )
                    )
                  }
                />
              ) : page === "Users" ? (
                <Users />
              ) : page === "Recycle Bin" && role === "admin" ? (
                <RecycleBin />
              ) : page === "Notifications" ? (
                <Notifications
                  loader={loadNotifications}
                  onOpenPage={(page) =>
                    choosePage(
                      role === "maintenance" ? "Assigned reports" : role === "user" ? "My reports" : page
                    )
                  }
                  onOpenReport={openReport}
                  onMarkRead={markNotificationSeen}
                  onArchive={archiveNotificationSeen}
                  onDelete={deleteNotificationsByIds}
                  onDeleteAll={deleteAllNotifications}
                  onChanged={refreshNotificationBadges}
                  serverUnreadCount={unreadCount}
                />
              ) : (
                <StudentDashboard
                  reportData={liveReports}
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
                {role !== "maintenance" && (
                  <button onClick={() => choosePage("New report")}>
                    Report an issue <span>→</span>
                  </button>
                )}
                <a href="mailto:support@fixko.school">
                  Support <span>→</span>
                </a>
              </div>
              <div className="app-footer-bottom">
                <span>
                  {role === "admin" ? "School operations" : role === "maintenance" ? "Maintenance workspace" : "Your school reports"}
                </span>
                <span>© 2026 Fixko · Trusted school communities</span>
              </div>
            </footer>
          </div>
        </main>
      </div>
      {signOutConfirmOpen && (
        <ConfirmModal
          title="Log out"
          message="Are you sure you want to log out? You will need to sign in again to access your account."
          cancelLabel="No"
          confirmLabel="Yes, log out"
          onCancel={() => setSignOutConfirmOpen(false)}
          onConfirm={handleSignOut}
        />
      )}
    </div>
  );
}

type ReportDraft = {
  department: string;
  building: string;
  floor: string;
  room: string;
  priority: string;
  item: string;
  condition: string;
  description: string;
};

const emptyReportDraft: ReportDraft = {
  department: "",
  building: "",
  floor: "",
  room: "",
  priority: "medium",
  item: "",
  condition: "",
  description: "",
};

const REPORT_DRAFT_KEY = "fixko-report-draft";

/** Loads the half-finished New Report the student left unsaved, if any. */
function loadReportDraft(): ReportDraft {
  if (typeof window === "undefined") return emptyReportDraft;
  try {
    const raw = window.localStorage.getItem(REPORT_DRAFT_KEY);
    if (!raw) return emptyReportDraft;
    return { ...emptyReportDraft, ...JSON.parse(raw) };
  } catch {
    return emptyReportDraft;
  }
}

/** Saves the New Report form's current values so a refresh doesn't lose them. */
function saveReportDraft(draft: ReportDraft) {
  try {
    window.localStorage.setItem(REPORT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Ignore storage errors (quota, private mode).
  }
}

/** Erases the saved New Report draft (called after a report is submitted). */
function clearReportDraft() {
  try {
    window.localStorage.removeItem(REPORT_DRAFT_KEY);
  } catch {
    // Ignore storage errors (quota, private mode).
  }
}

const PHOTO_DB_NAME = "fixko-report-photo";
const PHOTO_STORE = "photos";

/** Opens the browser's photo storage (IndexedDB) where the draft photo waits until submitted. */
function openPhotoDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(PHOTO_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTO_STORE)) {
        db.createObjectStore(PHOTO_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function savePhotoFile(file: File) {
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      tx.objectStore(PHOTO_STORE).put(file, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore storage errors.
  }
}

async function loadPhotoFile(): Promise<File | null> {
  try {
    const db = await openPhotoDb();
    const result = await new Promise<File | null>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readonly");
      const request = tx.objectStore(PHOTO_STORE).get("current");
      request.onsuccess = () => resolve((request.result as File | undefined) ?? null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

async function clearPhotoFile() {
  try {
    const db = await openPhotoDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, "readwrite");
      tx.objectStore(PHOTO_STORE).delete("current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore storage errors.
  }
}

// ============================================================
// NEW REPORT FORM — the “Report an issue” form students fill in:
// room, category, item, description, priority and a real photo.
// ============================================================
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
  const draft = useMemo(() => loadReportDraft(), []);
  const [department, setDepartment] = useState(draft.department);
  const [building, setBuilding] = useState(draft.building);
  const [floor, setFloor] = useState(draft.floor);
  const [room, setRoom] = useState(draft.room);
  const [priority, setPriority] = useState(draft.priority);
  const [item, setItem] = useState(draft.item);
  const [condition, setCondition] = useState(draft.condition);
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState(draft.description);
  const [photo, setPhoto] = useState<File | null>(null);
  const [formNotice, setFormNotice] = useState<{ title: string; message: string } | null>(null);

  useEffect(() => {
    saveReportDraft({ department, building, floor, room, priority, item, condition, description });
  }, [department, building, floor, room, priority, item, condition, description]);

  useEffect(() => {
    if (submitted) {
      clearReportDraft();
      clearPhotoFile();
    }
  }, [submitted]);

  useEffect(() => {
    loadPhotoFile().then((restored) => {
      if (restored) setPhoto(restored);
    });
  }, []);

  const clearReport = () => {
    clearReportDraft();
    clearPhotoFile();
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
            // Block submission until every required field and a photo are provided.
            if (!selectedRoom || !department || !item || !condition || !description.trim()) {
              setFormNotice({
                title: "Report not ready",
                message: "Please complete the location, item, condition, and description before submitting.",
              });
              return;
            }
            if (!photo) {
              setFormNotice({
                title: "Photo required",
                message: "Please attach a real photo of the issue before submitting your report.",
              });
              return;
            }
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
              // The report was accepted: erase the draft and its photo right
              // now, synchronously, so no later unmount/remount or re-login
              // can bring them back.
              clearReportDraft();
              clearPhotoFile();
              setSubmitted(true);
              onSubmitted(createdReport);
            } catch (error) {
              setFormNotice({
                title: "Report not submitted",
                message: error instanceof Error ? error.message : "Report submission failed.",
              });
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
                    Add a photo <small>(required)</small>
                  </h3>
                  <p>A real photo helps the maintenance team bring the right tools.</p>
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
                      setFormNotice({
                        title: "Photo not selected",
                        message: "Please choose a JPG or PNG image up to 5 MB.",
                      });
                      event.currentTarget.value = "";
                      setPhoto(null);
                      void clearPhotoFile();
                      return;
                    }
                    setPhoto(selected);
                    if (selected) void savePhotoFile(selected);
                  }}
                />
              </label>
              {photo ? (
                <button
                  type="button"
                  className="report-upload-cancel"
                  onClick={(event) => {
                    const input = event.currentTarget
                      .closest(".report-photo-section")
                      ?.querySelector<HTMLInputElement>(
                        'input[type="file"]',
                      );
                    if (input) input.value = "";
                    setPhoto(null);
                    void clearPhotoFile();
                  }}
                >
                  Cancel photo
                </button>
              ) : null}
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
      {formNotice && (
        <NoticeModal
          title={formNotice.title}
          message={formNotice.message}
          onClose={() => setFormNotice(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// ADMIN OVERVIEW — the admin's main dashboard: stat cards,
// reports needing attention, and quick links to manage things.
// ============================================================
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
  const recentReports = [...reportData]
    .filter((report) => report.status !== "resolved")
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 5);
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

const CLEARED_RESOLVED_KEY = "fixko:cleared-resolved-reports";

/** Loads the list of resolved reports the user chose to hide from view. */
function loadClearedResolved(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CLEARED_RESOLVED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Saves the list of resolved reports the user chose to hide. */
function saveClearedResolved(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLEARED_RESOLVED_KEY, JSON.stringify(ids));
  } catch {
    // Storage may be unavailable (private mode, quota) — clearing stays session-only then.
  }
}

// ============================================================
// ADMIN ANALYTICS — the charts & numbers page for admins:
// counts by status/priority/building, most-reported items,
// and average fix times.
// ============================================================
function OperationsInsights({
  reports,
  rooms,
  onStatusUpdated,
  onAssigned,
  onFlaggedDeleted,
  focusId,
  onFocused,
}: {
  reports: Report[];
  rooms: ApiRoom[];
  onStatusUpdated: (report: Report, status: Status) => Promise<void>;
  onAssigned: (report: Report, staffId: string) => Promise<void>;
  onFlaggedDeleted?: (apiId: number) => void;
  focusId?: string | null;
  onFocused?: () => void;
}) {
  const [building, setBuilding] = useState("all");
  const [search, setSearch] = useState("");
  const [repeatedOnly, setRepeatedOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [exportType, setExportType] = useState<"all" | "unresolved" | "resolved">("all");
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [maintenanceStaff, setMaintenanceStaff] = useState<ApiUser[]>([]);
  const [attentionPage, setAttentionPage] = useState(1);
  const buildings = Array.from(new Set(rooms.map((room) => room.building))).sort();
  const repeatCounts = useMemo(() => {
    const counts = new Map<string, number>();
    reports.forEach((report) => {
      const key = `${report.title}::${report.room}::${report.building}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [reports]);
  const repeatTotal = useMemo(
    () => Array.from(repeatCounts.values()).reduce((sum, count) => (count > 1 ? sum + count : sum), 0),
    [repeatCounts]
  );

  useEffect(() => {
    // Assignment list is maintenance personnel only — the admin is the only one who assigns.
    getUsers()
      .then((users) =>
        setMaintenanceStaff(users.filter((user) => user.role === "maintenance"))
      )
      .catch(() => setMaintenanceStaff([]));
  }, []);

  // A report was focused from outside (notification/search): reset filters,
  // jump to the right attention page, auto-open its details, and scroll to it.
  useEffect(() => {
    if (!focusId) return;
    setBuilding("all");
    setRepeatedOnly(false);
    setSearch("");
    setSortOrder("newest");
    const index = reports
      .filter((report) => report.status !== "resolved")
      .sort((first, second) => second.createdAt - first.createdAt)
      .findIndex((report) => report.id === focusId);
    if (index >= 0) setAttentionPage(Math.floor(index / ATTENTION_PAGE_SIZE) + 1);
    const timer = window.setTimeout(() => {
      document
        .getElementById(`operations-report-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      onFocused?.();
    }, 420);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  const filteredReports = useMemo(
    () =>
      reports
        .filter(
          (report) =>
            (building === "all" || report.building === building) &&
            (!repeatedOnly || (repeatCounts.get(`${report.title}::${report.room}::${report.building}`) ?? 0) > 1) &&
            `${report.id} ${report.title} ${report.room} ${report.reporter} ${report.description}`
              .toLowerCase()
              .includes(search.toLowerCase())
        )
        .sort((first, second) =>
          sortOrder === "newest"
            ? second.createdAt - first.createdAt
            : first.createdAt - second.createdAt
        ),
    [building, repeatedOnly, repeatCounts, search, sortOrder, reports]
  );
  const activeFilterCount = [
    building !== "all",
    repeatedOnly,
    Boolean(search.trim()),
  ].filter(Boolean).length;

  const [clearedResolved, setClearedResolvedState] = useState<string[]>(
    loadClearedResolved
  );
  const updateClearedResolved = (ids: string[]) => {
    setClearedResolvedState(ids);
    saveClearedResolved(ids);
  };
  const allResolvedReports = filteredReports.filter(
    (report) => report.status === "resolved"
  );
  const resolvedReports = allResolvedReports.filter(
    (report) => !clearedResolved.includes(report.id)
  );
  const unresolvedReports = filteredReports.filter(
    (report) => report.status !== "resolved"
  );
  const ATTENTION_PAGE_SIZE = 4;
  const attentionLastPage = Math.max(
    1,
    Math.ceil(unresolvedReports.length / ATTENTION_PAGE_SIZE)
  );
  const attentionCurrentPage = Math.min(attentionPage, attentionLastPage);
  const selectedRooms =
    building === "all" ? rooms : rooms.filter((room) => room.building === building);
  const selectedBuildings = building === "all" ? "All buildings" : building;
  const exportReports =
    exportType === "all"
      ? filteredReports
      : exportType === "resolved"
        ? allResolvedReports
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

  const exportReportRows = () =>
    exportReports.map((report) => [
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
    ]);

  const exportPdf = () => {
    const escape = (value: string) =>
      String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const rowsHtml = exportReportRows()
      .map(
        (row) =>
          `<tr>${row
            .map((value, index) => `<td class="${index === 0 ? "id-col" : ""}">${escape(String(value))}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const printedOn = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    const windowRef = window.open("", "_blank", "width=1000,height=700");
    if (!windowRef) return;
    windowRef.document.write(`<!doctype html><html><head><title>Fixko — Reports (${exportType})</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: "Segoe UI", Arial, sans-serif; margin: 36px; color: #1e293b; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .kicker { color: #6366f1; font-weight: 800; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        th { background: #4f46e5; color: #fff; text-align: left; padding: 7px 8px; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .id-col { font-weight: 700; white-space: nowrap; }
      </style></head><body>
      <span class="kicker">Fixko · Report records</span>
      <h1>Report records (${exportType})</h1>
      <p class="meta">${exportReports.length} records · Printed ${printedOn}</p>
      <table><thead><tr>
        <th>Report ID</th><th>Reporter ID</th><th>Reporter email</th><th>Reporter name</th><th>Building</th><th>Room</th><th>Department</th><th>Issue</th><th>Description</th><th>Priority</th><th>Critical</th><th>Status</th><th>Issued date</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      </body></html>`);
    windowRef.document.close();
    windowRef.focus();
    windowRef.print();
  };

  const exportReportData = useCallback(
    (format: "csv" | "pdf") => (format === "pdf" ? exportPdf() : exportCsv()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exportReports, exportType]
  );

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
          <div className="operations-search">
            <Icon name="search" size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search reports, rooms, or reporters..."
              aria-label="Search reports, rooms, or reporters"
            />
            {search && (
              <button
                type="button"
                className="operations-search-clear"
                aria-label="Clear search"
                onClick={() => setSearch("")}
              >
                <Icon name="close" size={11} />
              </button>
            )}
          </div>
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
          <button
            type="button"
            className={`operations-repeat-toggle${repeatedOnly ? " is-active" : ""}`}
            onClick={() => setRepeatedOnly((open) => !open)}
            title="Same issue reported in the same room"
          >
            <Icon name="alert" size={12} /> Repeated issues
            {repeatTotal > 0 && <span>{repeatTotal}</span>}
          </button>
          <div className="operations-filters-divider" aria-hidden="true" />
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="operations-clear-filters"
              onClick={() => {
                setBuilding("all");
                setRepeatedOnly(false);
                setSearch("");
              }}
            >
              <Icon name="close" size={11} /> Clear ({activeFilterCount})
            </button>
          )}
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
          <DoneWorksExportDropdown
            format={exportFormat}
            disabled={!exportReports.length}
            title={
              exportReports.length
                ? `Download ${exportReports.length} reports as ${exportFormat.toUpperCase()}`
                : "No reports to export"
            }
            onSelect={(format) => {
              exportReportData(format);
            }}
            onFormatChange={(format) => {
              setExportFormat(format);
            }}
          />
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
            unresolvedReports
              .slice(
                (attentionCurrentPage - 1) * ATTENTION_PAGE_SIZE,
                attentionCurrentPage * ATTENTION_PAGE_SIZE
              )
              .map((report) => (
              <OperationsReportCard
                key={report.id}
                report={report}
                isAdmin
                onStatusUpdated={onStatusUpdated}
                maintenanceStaff={maintenanceStaff}
                onAssigned={onAssigned}
                canAssign
                canUpdateStatus={false}
                onFlaggedDeleted={onFlaggedDeleted}
                autoOpen={report.id === focusId}
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
          {attentionLastPage > 1 && (
            <div className="notifications-pagination done-works-pagination" aria-label="Needs attention pagination">
              <button
                type="button"
                className="notifications-page-btn"
                disabled={attentionCurrentPage <= 1}
                onClick={() => setAttentionPage(attentionCurrentPage - 1)}
              >
                Prev
                <Icon name="arrow" size={13} />
              </button>
              <div className="notifications-page-dots">
                {Array.from({ length: attentionLastPage }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    type="button"
                    className={`notifications-page-dot ${n === attentionCurrentPage ? "is-current" : ""}`}
                    aria-current={n === attentionCurrentPage ? "page" : undefined}
                    onClick={() => setAttentionPage(n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="notifications-page-btn"
                disabled={attentionCurrentPage >= attentionLastPage}
                onClick={() => setAttentionPage(attentionCurrentPage + 1)}
              >
                Next
                <Icon name="arrow" size={13} />
              </button>
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
            <div className="operations-section-actions">
              {resolvedReports.length > 0 && (
                <button
                  type="button"
                  className="operations-clear-button"
                  onClick={() =>
                    setClearedResolvedState((current) => {
                      const next = [
                        ...current,
                        ...filteredReports
                          .filter((report) => report.status === "resolved")
                          .map((report) => report.id)
                          .filter((id) => !current.includes(id)),
                      ];
                      saveClearedResolved(next);
                      return next;
                    })
                  }
                  title="Hide resolved reports on this panel"
                >
                  <Icon name="trash" size={13} /> Clear
                </button>
              )}
              <span className="admin-count-pill">
                {resolvedReports.length}
              </span>
            </div>
          </div>
          {resolvedReports.length ? (
            resolvedReports.map((report) => (
              <OperationsReportCard
                key={report.id}
                report={report}
                isAdmin
                onStatusUpdated={onStatusUpdated}
                maintenanceStaff={maintenanceStaff}
                canUpdateStatus={false}
                onFlaggedDeleted={onFlaggedDeleted}
                autoOpen={report.id === focusId}
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

/** Workspace for Maintenance Personnel: reports assigned to them by the admin. */
function MaintenanceBoard({
  reports,
  onStatusUpdated,
  focusId,
  onFocused,
}: {
  reports: Report[];
  onStatusUpdated: (report: Report, status: Status) => Promise<void>;
  focusId?: string | null;
  onFocused?: () => void;
}) {
  const openReports = reports.filter((report) => report.status !== "resolved");
  const resolvedReports = reports.filter((report) => report.status === "resolved");

  // A report was focused from outside (notification/search): auto-open its
  // details and scroll to it.
  useEffect(() => {
    if (!focusId) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(`operations-report-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      onFocused?.();
    }, 420);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

  return (
    <div className="operations-insights">
      <div className="operations-hero card panel-enter">
        <div>
          <span className="admin-panel-kicker">Maintenance workspace</span>
          <h1>Reports assigned to you</h1>
          <p>
            The admin assigns reports to you here. Set a report in progress or
            under maintenance while working on it, and mark it resolved when the
            job is done — it then appears on the Done works page.
          </p>
        </div>
      </div>
      <div className="operations-metric-grid">
        {[
          ["Reports to resolve", openReports.length, `${reports.length - openReports.length} resolved`],
          ["Resolved", resolvedReports.length, "See Done works"],
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
      <section className="card operations-panel">
        <div className="operations-section-heading">
          <div>
            <span className="admin-panel-kicker">Open assignments</span>
            <h2>Needs action</h2>
            <p>Reports the admin assigned to you that are not yet resolved.</p>
          </div>
          <span className="admin-count-pill">{openReports.length}</span>
        </div>
        {openReports.length ? (
          openReports.map((report) => (
            <OperationsReportCard
              key={report.id}
              report={report}
              onStatusUpdated={onStatusUpdated}
              statusOptions={maintenanceStatusOptions}
              autoOpen={report.id === focusId}
            />
          ))
        ) : (
          <div className="admin-empty-state">
            <strong>No assigned reports</strong>
            <p>
              New assignments will appear here when the admin assigns them to
              you.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

const doneRangeOptions: Array<{ value: string; label: string }> = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "month", label: "Last 30 days" },
];

function doneDayLabel(value: number, startOfToday: number, startOfYesterday: number): string {
  if (!Number.isFinite(value)) return "Earlier";
  if (value >= startOfToday) return "Today";
  if (value >= startOfYesterday) return "Yesterday";
  return new Date(value).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ============================================================
// DONE WORKS — maintenance personnel's list of completed
// reports, with export (CSV/PDF) and a notes view per job.
// ============================================================
function DoneWorks({
  reports,
  isAdmin = false,
  onFlaggedDeleted,
}: {
  reports: Report[];
  isAdmin?: boolean;
  onFlaggedDeleted?: (apiId: number) => void;
}) {
  const [range, setRange] = useState("all");
  const [detailsReport, setDetailsReport] = useState<Report | null>(null);
  const [exportFormat, setExportFormat] = useState<"csv" | "pdf">("csv");
  const [page, setPage] = useState(1);
  const DONE_WORKS_PAGE_SIZE = 10;
  const resolvedReports = reports.filter((report) => report.status === "resolved");
  const filtered = useMemo(() => {
    if (range === "all") return resolvedReports;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    let cutoff = startOfToday.getTime();
    if (range === "week")
      cutoff = new Date(cutoff - 6 * 86400000).getTime();
    if (range === "month")
      cutoff = new Date(cutoff - 29 * 86400000).getTime();
    return resolvedReports.filter((report) => report.resolvedAt >= cutoff);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, range]);

  const lastPage = Math.max(1, Math.ceil(filtered.length / DONE_WORKS_PAGE_SIZE));
  const currentPage = Math.min(page, lastPage);
  const paged = filtered.slice(
    (currentPage - 1) * DONE_WORKS_PAGE_SIZE,
    currentPage * DONE_WORKS_PAGE_SIZE
  );

  const groups = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfYesterday = startOfToday.getTime() - 86400000;
    const map = new Map<string, { key: string; label: string; items: Report[] }>();
    [...paged]
      .sort((a, b) => b.resolvedAt - a.resolvedAt)
      .forEach((report) => {
        const label = doneDayLabel(
          report.resolvedAt,
          startOfToday.getTime(),
          startOfYesterday
        );
        if (!map.has(label)) map.set(label, { key: label, label, items: [] });
        map.get(label)!.items.push(report);
      });
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paged, currentPage]);

  /** Shared data for CSV / PDF exports using the current date filter. */
  const toArrayRows = () =>
    [...filtered].map((report) => [
      report.id,
      report.reporter,
      report.building,
      report.room,
      report.dept,
      report.title,
      report.description.slice(0, 160),
      report.priority,
      report.tech.replace(" · Maintenance", ""),
      report.resolved,
    ]);

  const exportCsv = () => {
    const headers = [
      "Report ID",
      "Reporter",
      "Building",
      "Room",
      "Department",
      "Issue",
      "Description",
      "Priority",
      "Technician",
      "Completed on",
    ];
    const csvValue = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
    const rows = toArrayRows().map((row) => row.map(csvValue).join(","));
    const blob = new Blob(
      [[headers.map(csvValue).join(","), ...rows].join("\r\n")],
      { type: "text/csv;charset=utf-8;" }
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fixko-done-works-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const rowsHtml = toArrayRows()
      .map(
        (row) =>
          `<tr>${row
            .map(
              (value, index) =>
                `<td class="${index === 0 ? "id-col" : ""}">${String(value)
                  .replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")}</td>`
            )
            .join("")}</tr>`
      )
      .join("");
    const printedOn = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    const windowRef = window.open("", "_blank", "width=1000,height=700");
    if (!windowRef) return;
    windowRef.document.write(`<!doctype html><html><head><title>Fixko — Done works (${range})</title>
      <style>
        * { box-sizing: border-box; }
        body { font-family: "Segoe UI", Arial, sans-serif; margin: 36px; color: #1e293b; }
        h1 { font-size: 20px; margin: 0 0 4px; }
        .kicker { color: #6366f1; font-weight: 800; font-size: 11px; letter-spacing: .12em; text-transform: uppercase; }
        .meta { color: #64748b; font-size: 11px; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
        th { background: #4f46e5; color: #fff; text-align: left; padding: 7px 8px; }
        td { padding: 6px 8px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .id-col { font-weight: 700; white-space: nowrap; }
      </style></head><body>
      <span class="kicker">Fixko · Completed work</span>
      <h1>Done works</h1>
      <p class="meta">Range: ${range} · ${filtered.length} records · Printed ${printedOn}</p>
      <table><thead><tr>
        <th>Report ID</th><th>Reporter</th><th>Building</th><th>Room</th><th>Department</th><th>Issue</th><th>Description</th><th>Priority</th><th>Technician</th><th>Completed on</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>
      </body></html>`);
    windowRef.document.close();
    windowRef.focus();
    windowRef.print();
  };

  const exportDoneWorks = useCallback(
    (format: "csv" | "pdf") => (format === "pdf" ? exportPdf() : exportCsv()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [reports, range]
  );

  return (
    <section className="card admin-panel done-works">
      <div className="admin-panel-heading">
        <div>
          <span className="admin-panel-kicker">Completed</span>
          <h2>Done works</h2>
          <p>Resolved reports, grouped by the day they were completed.</p>
        </div>
        <div className="done-works-controls">
          <span className="admin-count-pill">
            {resolvedReports.length} completed
          </span>
          <ModernSelect
            value={range}
            onChange={(next) => {
              setRange(next);
              setPage(1);
            }}
            placeholder="Filter by date"
            options={doneRangeOptions}
          />
          {!isAdmin && (
            <DoneWorksExportDropdown
            format={exportFormat}
            disabled={!filtered.length}
            title={
              filtered.length
                ? `Download ${filtered.length} completed works as ${exportFormat.toUpperCase()}`
                : "No completed works in this range to export"
            }
            onSelect={(format) => {
              exportDoneWorks(format);
            }}
            onFormatChange={(format) => {
              setExportFormat(format);
            }}
            />
          )}
        </div>
      </div>
      {groups.length ? (
        groups.map((group) => (
          <div className="done-works-group" key={group.key}>
            <div className="done-works-group-head">
              <h3>{group.label}</h3>
              <span className="done-works-group-count">
                {group.label === "Today"
                  ? `${group.items.length} marked done today`
                  : `${group.items.length} done`}
              </span>
            </div>
            <div className="done-works-list">
              {group.items.map((report) => (
                <div className="done-works-item" key={report.id}>
                  <button
                    type="button"
                    className="done-works-row"
                    onClick={() => setDetailsReport(report)}
                  >
                    <span className="done-works-icon">
                      <Icon name="check" size={15} />
                    </span>
                    <div className="done-works-info">
                      <strong>{report.title}</strong>
                      <small>
                        {report.id} · {report.building} · {report.room}
                      </small>
                    </div>
                    <div className="done-works-who">
                      <b>Resolved by</b>
                      {report.tech.replace(" · Maintenance", "")}
                    </div>
                    <span className="done-works-date">{report.resolved}</span>
                    <span className="done-works-view">View details</span>
                    <Badge value={report.priority} />
                  </button>
                  {report.feedback && (
                    <div className={`done-works-feedback ${report.feedback.rating <= 2 ? "is-low" : "is-good"}`}>
                      <span className="done-works-feedback-stars" aria-label={`${report.feedback.rating} out of 5 stars`}>
                        {"★".repeat(report.feedback.rating)}
                        {"☆".repeat(5 - report.feedback.rating)}
                      </span>
                      <div className="done-works-feedback-copy">
                        <b>Rated by {report.reporter} · {report.feedback.rating}/5</b>
                        {report.feedback.comment && <p>“{report.feedback.comment}”</p>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="admin-empty-state">
          <span>
            <Icon name="check" size={22} />
          </span>
          <strong>No completed works in this range</strong>
          <p>Works appear here as soon as maintenance marks them resolved.</p>
        </div>
      )}
      {lastPage > 1 && (
        <div className="notifications-pagination done-works-pagination" aria-label="Done works pagination">
          <button
            type="button"
            className="notifications-page-btn"
            disabled={currentPage <= 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Prev
            <Icon name="arrow" size={13} />
          </button>
          <div className="notifications-page-dots">
            {Array.from({ length: lastPage }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`notifications-page-dot ${n === currentPage ? "is-current" : ""}`}
                aria-current={n === currentPage ? "page" : undefined}
                onClick={() => setPage(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="notifications-page-btn"
            disabled={currentPage >= lastPage}
            onClick={() => setPage(currentPage + 1)}
          >
            Next
            <Icon name="arrow" size={13} />
          </button>
        </div>
      )}
      {detailsReport && (
        <ReportDetailsModal
          report={detailsReport}
          isAdmin={isAdmin}
          onClose={() => setDetailsReport(null)}
          onFlaggedDeleted={onFlaggedDeleted}
        />
      )}
    </section>
  );
}

const adminStatusOptions: Array<{ value: string; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "review", label: "Under review" },
  { value: "progress", label: "In progress" },
  { value: "maint", label: "Under maintenance" },
  { value: "resolved", label: "Resolved" },
];

/** Maintenance personnel may only set these. */
const maintenanceStatusOptions: Array<{ value: string; label: string }> = [
  { value: "progress", label: "In progress" },
  { value: "maint", label: "Under maintenance" },
  { value: "resolved", label: "Resolved" },
];

/** A small summary card used by the admin pages to show one report at a glance. */
function OperationsReportCard({
  report,
  onStatusUpdated,
  maintenanceStaff = [],
  onAssigned,
  statusOptions = adminStatusOptions,
  canAssign = false,
  canUpdateStatus = true,
  isAdmin = false,
  onFlaggedDeleted,
  autoOpen = false,
}: {
  report: Report;
  onStatusUpdated: (report: Report, status: Status) => Promise<void>;
  maintenanceStaff?: ApiUser[];
  onAssigned?: (report: Report, staffId: string) => Promise<void>;
  statusOptions?: Array<{ value: string; label: string }>;
  canAssign?: boolean;
  canUpdateStatus?: boolean;
  isAdmin?: boolean;
  onFlaggedDeleted?: (apiId: number) => void;
  autoOpen?: boolean;
}) {
  const currentAssignee = maintenanceStaff.find(
    (staff) => report.tech.startsWith(`${staff.name} ·`)
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Opened from outside (notification/search): show the details modal right away.
  useEffect(() => {
    if (autoOpen) setDetailsOpen(true);
  }, [autoOpen]);
  const hasDetails = Boolean(
    report.description || report.photoUrl || report.comments.length || report.feedback?.comment
  );
  return (
    <article
      id={`operations-report-${report.id}`}
      className={`operations-report-card${detailsOpen ? " is-open" : ""}`}
    >
      <div className="operations-report-heading">
        <button
          type="button"
          className="operations-report-summary"
          disabled={!hasDetails}
          aria-haspopup="dialog"
          onClick={() => setDetailsOpen(true)}
        >
          <strong>{report.title}</strong>
          <small>
            {report.id} · {report.building} · {report.room}
          </small>
          {hasDetails && <span className="operations-report-hint">View details</span>}
        </button>
        <div>
          <Badge value={report.priority} />
          <Badge value={report.status} type="status" />
          {canUpdateStatus && (
            <ModernSelect
              value={report.status}
              onChange={(value) => onStatusUpdated(report, value as Status)}
              placeholder="Update status"
              options={statusOptions}
              className="operations-status-select"
            />
          )}
          {canAssign && onAssigned && (
            <ModernSelect
              value={currentAssignee ? String(currentAssignee.id) : ""}
              onChange={(value) => onAssigned(report, value)}
              placeholder="Assign to..."
              options={[
                { value: "", label: "Unassigned" },
                ...maintenanceStaff.map((staff) => ({
                  value: String(staff.id),
                  label: staff.name,
                })),
              ]}
              className="operations-status-select"
            />
          )}
        </div>
      </div>
      {hasDetails && detailsOpen && (
        <ReportDetailsModal
          report={report}
          isAdmin={isAdmin}
          onClose={() => setDetailsOpen(false)}
          onFlaggedDeleted={onFlaggedDeleted}
        />
      )}
    </article>
  );
}

// ============================================================
// REPORT DETAILS MODAL — the pop-up with a report's full info:
// message chat, status-change buttons for admins/maintenance,
// and feedback/rating once resolved.
// ============================================================
function ReportDetailsModal({
  report,
  onClose,
  isAdmin = false,
  onModerationChange,
  onFlaggedDeleted,
}: {
  report: Report;
  onClose: () => void;
  isAdmin?: boolean;
  onModerationChange?: (flagged: boolean, reason: string | null) => void;
  onFlaggedDeleted?: (apiId: number) => void;
}) {
  const [flagBusy, setFlagBusy] = useState(false);
  const [flagError, setFlagError] = useState("");
  const [localFlag, setLocalFlag] = useState<{ flagged: boolean; reason: string | null }>({
    flagged: report.flagged,
    reason: report.flagReason,
  });
  const [flagPanelOpen, setFlagPanelOpen] = useState(false);
  const [flagReason, setFlagReason] = useState<"inappropriate" | "misinformation" | "ai_generated" | null>(null);
  const [flagNote, setFlagNote] = useState("");

  useEffect(() => {
    setLocalFlag({ flagged: report.flagged, reason: report.flagReason });
  }, [report.flagged, report.flagReason]);

  const submitFlag = async () => {
    if (!flagReason || !report.id) return;
    const apiId = Number(report.id.replace(/\D/g, ""));
    setFlagBusy(true);
    setFlagError("");
    try {
      await flagReport(apiId, flagReason, flagNote.trim() || undefined);
      setFlagPanelOpen(false);
      setFlagNote("");
      setFlagReason(null);
      onModerationChange?.(true, flagReason);
      // The backend deletes a flagged report: remove it from the list and close.
      onFlaggedDeleted?.(apiId);
      onClose();
    } catch (error) {
      setFlagError(error instanceof Error ? error.message : "Could not flag the report.");
    } finally {
      setFlagBusy(false);
    }
  };

  const removeFlag = async () => {
    setFlagBusy(true);
    setFlagError("");
    try {
      await unflagReport(Number(report.id.replace(/\D/g, "")));
      setLocalFlag({ flagged: false, reason: null });
      onModerationChange?.(false, null);
    } catch (error) {
      setFlagError(error instanceof Error ? error.message : "Could not remove the flag.");
    } finally {
      setFlagBusy(false);
    }
  };
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);
  return createPortal(
    <div
      className="report-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="report-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${report.title} details`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="report-modal-heading">
          <div>
            <strong>{report.title}</strong>
            <small>
              {report.id} · {report.building} · {report.room}
            </small>
          </div>
          <button
            type="button"
            className="report-modal-close"
            aria-label="Close details"
            onClick={onClose}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
        <div className="report-modal-body">
          <p className="operations-report-description">{report.description}</p>
          {report.photoUrl && (
            <a
              href={report.photoUrl}
              target="_blank"
              rel="noreferrer"
              className="mb-4 block"
            >
              <Image
                unoptimized
                src={report.photoUrl}
                alt={`Photo attached to ${report.title}`}
                width={1200}
                height={800}
                sizes="100vw"
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
            <span>
              <b>Assigned to</b>
              {report.tech.replace(" · Maintenance", "")}
            </span>
          </div>
          {localFlag.flagged && (
            <div className="report-flag-banner">
              <Icon name="alert" size={16} />
              <span>
                Flagged by the admin —{" "}
                {localFlag.reason === "inappropriate" && "inappropriate content."}
                {localFlag.reason === "misinformation" && "misinformation."}
                {localFlag.reason === "ai_generated" && "suspected AI-generated photo."}
              </span>
            </div>
          )}
          {isAdmin && (
            <div className="report-moderation">
              {localFlag.flagged ? (
                <button
                  type="button"
                  className="report-mod-btn report-mod-remove"
                  disabled={flagBusy}
                  onClick={() => void removeFlag()}
                >
                  {flagBusy ? "Removing…" : "Remove flag"}
                </button>
              ) : (
                <button
                  type="button"
                  className="report-mod-btn report-mod-flag"
                  disabled={flagBusy}
                  onClick={() => setFlagPanelOpen((open) => !open)}
                >
                  {flagPanelOpen ? "Close" : "⚠ Flag / warn"}
                </button>
              )}
              {flagPanelOpen && !localFlag.flagged && (
                <div className="report-mod-panel">
                  <p className="report-mod-title">Why is this report being flagged? The user receives a warning notification.</p>
                  <div className="report-mod-choices">
                    {([
                      ["inappropriate", "Inappropriate content"],
                      ["misinformation", "Misinformation"],
                      ["ai_generated", "AI-generated photo"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        className={`report-mod-choice ${flagReason === value ? "is-active" : ""}`}
                        onClick={() => setFlagReason(value)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="mod-select-input report-mod-note"
                    placeholder="Optional note to explain the warning…"
                    value={flagNote}
                    maxLength={500}
                    rows={3}
                    onChange={(event) => setFlagNote(event.target.value)}
                  />
                  {flagError && <p className="auth-error">{flagError}</p>}
                  <button
                    type="button"
                    className="report-mod-btn report-mod-confirm"
                    disabled={flagBusy || !flagReason}
                    onClick={() => void submitFlag()}
                  >
                    {flagBusy ? "Flagging…" : "Send warning & flag"}
                  </button>
                </div>
              )}
            </div>
          )}
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
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Centered pop-up that just shows a short message with an OK button. */
function NoticeModal({
  title,
  message,
  onClose,
}: {
  title: string;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  return createPortal(
    <div
      className="report-modal-overlay"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="report-modal notice-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="notice-modal-icon">
          <Icon name="alert" size={24} />
        </div>
        <div className="report-modal-heading notice-modal-heading">
          <div>
            <strong>{title}</strong>
            <p className="notice-modal-message">{message}</p>
          </div>
        </div>
        <div className="notice-modal-actions">
          <button
            type="button"
            className="notice-modal-ok"
            onClick={onClose}
            autoFocus
          >
            OK
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Pop-up asking to confirm or cancel (used for delete/suspend — dangerous actions). */
function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (busy) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
      if (event.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, onConfirm, busy]);
  return createPortal(
    <div
      className="report-modal-overlay"
      onClick={busy ? undefined : onCancel}
      role="presentation"
    >
      <div
        className="report-modal notice-modal confirm-modal"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="notice-modal-icon confirm-modal-icon">
          <Icon name="alert" size={24} />
        </div>
        <div className="report-modal-heading notice-modal-heading">
          <div>
            <strong>{title}</strong>
            <p className="notice-modal-message">{message}</p>
          </div>
        </div>
        <div className="notice-modal-actions confirm-modal-actions">
          <button
            type="button"
            className="notice-modal-ok confirm-modal-cancel"
            onClick={onCancel}
            disabled={busy}
          >
            {cancelLabel || "Cancel"}
          </button>
          <button
            type="button"
            className="notice-modal-ok confirm-modal-ok"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
          >
            {busy ? "Working…" : confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Shared pagination bar used by the recycle-bin panels and other lists. */
function PaginationBar({
  page,
  lastPage,
  onChange,
  ariaLabel,
}: {
  page: number;
  lastPage: number;
  onChange: (page: number) => void;
  ariaLabel: string;
}) {
  if (lastPage <= 1) return null;
  return (
    <div className="notifications-pagination done-works-pagination" aria-label={ariaLabel}>
      <button
        type="button"
        className="notifications-page-btn"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Prev
        <Icon name="arrow" size={13} />
      </button>
      <div className="notifications-page-dots">
        {Array.from({ length: lastPage }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            className={`notifications-page-dot ${n === page ? "is-current" : ""}`}
            aria-current={n === page ? "page" : undefined}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="notifications-page-btn"
        disabled={page >= lastPage}
        onClick={() => onChange(page + 1)}
      >
        Next
        <Icon name="arrow" size={13} />
      </button>
    </div>
  );
}

// ============================================================
// RECYCLE BIN — the admin's safety net: everything recently
// deleted (accounts & reports) can be restored or removed
// forever from here.
// ============================================================
function RecycleBin() {
  const [bin, setBin] = useState<ApiRecycleBin>({ accounts: [], reports: [] });
  const [raising, setRaising] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [accountsPage, setAccountsPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const RECYCLE_PAGE_SIZE = 8;
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    action: () => void;
  } | null>(null);

  const load = useCallback(
    () =>
      getRecycleBin()
        .then((result) => setBin({ accounts: result.accounts, reports: result.reports }))
        .catch(() => setRaising(true)),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 4000);
  };

  const askConfirm = (
    title: string,
    message: string,
    action: () => void,
    confirmLabel?: string
  ) => setConfirmState({ title, message, action, confirmLabel });

  const removeItem = (key: string, type: "account" | "report", id: number) =>
    setBin((current) =>
      type === "account"
        ? { ...current, accounts: current.accounts.filter((item) => item.id !== id) }
        : { ...current, reports: current.reports.filter((item) => item.id !== id) }
    );

  const restore = (type: "account" | "report", id: number, name: string) => {
    const key = `${type}-${id}`;
    setBusyKey(key);
    restoreRecycleBinItem(type, id)
      .then(() => {
        removeItem(key, type, id);
        flash(`${name} was restored.`);
      })
      .catch((error) => flash(error instanceof Error ? error.message : "The item could not be restored."))
      .finally(() => {
        setBusyKey(null);
        load();
      });
  };

  const purge = (type: "account" | "report", id: number, name: string) => {
    const key = `${type}-${id}`;
    setBusyKey(key);
    purgeRecycleBinItem(type, id)
      .then(() => {
        removeItem(key, type, id);
        flash(`${name} was permanently deleted.`);
      })
      .catch((error) => flash(error instanceof Error ? error.message : "The item could not be deleted."))
      .finally(() => {
        setBusyKey(null);
        load();
      });
  };

  const accounts = bin.accounts;
  const reports = bin.reports;
  const accountsLastPage = Math.max(1, Math.ceil(accounts.length / RECYCLE_PAGE_SIZE));
  const accountsCurrentPage = Math.min(accountsPage, accountsLastPage);
  const pagedAccounts = accounts.slice(
    (accountsCurrentPage - 1) * RECYCLE_PAGE_SIZE,
    accountsCurrentPage * RECYCLE_PAGE_SIZE
  );
  const reportsLastPage = Math.max(1, Math.ceil(reports.length / RECYCLE_PAGE_SIZE));
  const reportsCurrentPage = Math.min(reportsPage, reportsLastPage);
  const pagedReports = reports.slice(
    (reportsCurrentPage - 1) * RECYCLE_PAGE_SIZE,
    reportsCurrentPage * RECYCLE_PAGE_SIZE
  );

  return (
    <section className="recycle-bin-page">
      <div className="notifications-page-heading recycle-bin-heading">
        <div>
          <span className="eyebrow">
            <Icon name="trash" size={13} />{" "}
            Recycle bin
          </span>
          <h1 className="notification-title-gradient">Recycle Bin</h1>
          <p>Deleted accounts and reports wait here until they are restored or erased for good.</p>
        </div>
        <div className="done-works-controls">
          <span className="admin-count-pill">{accounts.length + reports.length} items</span>
        </div>
      </div>
      {notice && (
        <div className="users-action-notice" role="status">
          {notice}
        </div>
      )}
      {raising ? (
        <div className="admin-empty-state">
          <strong>The recycle bin could not be loaded</strong>
          <p>Check your connection and try again.</p>
        </div>
      ) : (
        <div className="recycle-bin-columns">
          {/* Deleted accounts */}
          <section className="card admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-panel-kicker">Exited accounts</span>
                <h2>Deleted accounts</h2>
                <p>Restore to bring the account and its access back.</p>
              </div>
              <span className="admin-count-pill">{accounts.length}</span>
            </div>
            {accounts.length ? (
              <ul className="recycle-bin-list">
                {pagedAccounts.map((account) => (
                  <li className="recycle-bin-row" key={account.id}>
                    <span className="app-profile-avatar recycle-bin-avatar">
                      {(account.name || "?")
                        .split(/\s+/)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </span>
                    <div className="recycle-bin-info">
                      <strong>{account.name}</strong>
                      <small>
                        {account.email}
                        {account.school_id ? ` · ${account.school_id}` : ""} ·{" "}
                        {account.role === "maintenance" ? "Maintenance" : "User"}
                      </small>
                    </div>
                    <span className="recycle-bin-date">
                      Deleted {new Date(account.deleted_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </span>
                    <div className="recycle-bin-actions">
                      <button
                        type="button"
                        className="recycle-bin-restore"
                        disabled={busyKey === `account-${account.id}`}
                        onClick={() => restore("account", account.id, account.name)}
                      >
                        <Icon name="check" size={13} /> Restore
                      </button>
                      <button
                        type="button"
                        className="recycle-bin-purge"
                        disabled={busyKey === `account-${account.id}`}
                        onClick={() =>
                          askConfirm(
                            "Erase account",
                            `Permanently delete ${account.name}? This cannot be undone and removes their reports as well.`,
                            () => purge("account", account.id, account.name),
                            "Delete forever"
                          )
                        }
                      >
                        <Icon name="trash" size={13} /> Delete forever
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty-state">
                <span>
                  <Icon name="users" size={20} />
                </span>
                <strong>No deleted accounts</strong>
                <p>Accounts appear here when an admin deletes one.</p>
              </div>
            )}
            <PaginationBar
              page={accountsCurrentPage}
              lastPage={accountsLastPage}
              onChange={setAccountsPage}
              ariaLabel="Deleted accounts pagination"
            />
          </section>

          {/* Deleted / flagged reports */}
          <section className="card admin-panel">
            <div className="admin-panel-heading">
              <div>
                <span className="admin-panel-kicker">Removed reports</span>
                <h2>Deleted reports</h2>
                <p>Flagged or removed reports stay recoverable here.</p>
              </div>
              <span className="admin-count-pill">{reports.length}</span>
            </div>
            {reports.length ? (
              <ul className="recycle-bin-list">
                {pagedReports.map((report) => (
                  <li className="recycle-bin-row" key={report.id}>
                    <span className={`recycle-bin-mark ${report.priority}`}>
                      <Icon name={report.is_flagged ? "alert" : "clipboard"} size={15} />
                    </span>
                    <div className="recycle-bin-info">
                      <strong>
                        {report.item_name || report.category || "Report"}{" "}
                        <Badge value={report.priority} />
                      </strong>
                      <small>
                        FX-{String(report.id).padStart(4, "0")} ·{" "}
                        {report.room ? `${report.room.building} · ${report.room.name}` : "Unknown room"} ·{" "}
                        by {report.reporter?.name ?? report.reporter_email_snapshot}
                      </small>
                    </div>
                    <span className="recycle-bin-date">
                      {report.deleted_reason === "removed" ? "Flagged" : "Withdrawn"} ·{" "}
                      {new Date(report.deleted_at).toLocaleDateString("en-US", { dateStyle: "medium" })}
                    </span>
                    <div className="recycle-bin-actions">
                      <button
                        type="button"
                        className="recycle-bin-restore"
                        disabled={busyKey === `report-${report.id}`}
                        onClick={() =>
                          restore("report", report.id, report.item_name || "Report")
                        }
                      >
                        <Icon name="check" size={13} /> Restore
                      </button>
                      <button
                        type="button"
                        className="recycle-bin-purge"
                        disabled={busyKey === `report-${report.id}`}
                        onClick={() =>
                          askConfirm(
                            "Erase report",
                            `Permanently delete this report? This cannot be undone.`,
                            () =>
                              purge("report", report.id, report.item_name || "The report"),
                            "Delete forever"
                          )
                        }
                      >
                        <Icon name="trash" size={13} /> Delete forever
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="admin-empty-state">
                <span>
                  <Icon name="clipboard" size={20} />
                </span>
                <strong>No deleted reports</strong>
                <p>Removed or flagged-deleted reports appear here.</p>
              </div>
            )}
            <PaginationBar
              page={reportsCurrentPage}
              lastPage={reportsLastPage}
              onChange={setReportsPage}
              ariaLabel="Deleted reports pagination"
            />
          </section>
        </div>
      )}
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const action = confirmState.action;
            setConfirmState(null);
            action();
          }}
        />
      )}
    </section>
  );
}

// ============================================================
// MANAGE USERS — the admin page listing every account with
// suspend / lock / warn / delete actions.
// ============================================================
function Users() {
  const [users, setUsers] = useState<
    Array<ApiUser & {
      reports_count?: number;
      created_at?: string;
      account_status?: ApiAccountStatus;
      status_until?: string | null;
      warnings_count?: number;
    }>
  >([]);
  const [usersError, setUsersError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState("");
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [usersPage, setUsersPage] = useState(1);
  const USERS_PAGE_SIZE = 8;
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    action: () => void;
  } | null>(null);

  const askConfirm = (
    title: string,
    message: string,
    action: () => void,
    confirmLabel?: string
  ) =>
    setConfirmState({ title, message, action, confirmLabel });

  useEffect(() => {
    if (openMenuId === null) return;
    const close = (event: MouseEvent) => {
      if (!(event.target as HTMLElement).closest(".users-action-menu")) {
        setOpenMenuId(null);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openMenuId]);

  useEffect(() => {
    // Hold the list for a moment so entries fade in instead of popping instantly.
    const openedAt = Date.now();
    getUsers()
      .then((list) =>
        window.setTimeout(() => {
          setUsers(list);
          setLoading(false);
        }, Math.max(0, 900 - (Date.now() - openedAt)))
      )
      .catch((error) => {
        const message =
          error instanceof ApiError && error.requestId
            ? `${error.message} Reference: ${error.requestId}`
            : error instanceof Error
              ? error.message
              : "The user list could not be loaded.";
        setUsersError(message);
        setLoading(false);
      });
  }, []);

  /** Warn a maintenance worker: 1st = warning, 2nd = 1-week suspension, 3rd = auto-lock. */
  const warnMaintenance = async (user: ApiUser & { account_status?: ApiAccountStatus; warnings_count?: number }) => {
    setBusyId(user.id);
    setActionError("");
    try {
      const nextCount = (user.warnings_count ?? 0) + 1;
      const result = await warnMaintenanceUser(user.id);
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id
            ? {
                ...item,
                warnings_count: result.warnings_count,
                account_status: result.account_status,
                status_until: result.account_status === "suspended"
                  ? new Date(Date.now() + 7 * 86_400_000).toISOString()
                  : null,
              }
            : item
        )
      );
      setActionError(
        nextCount === 3
          ? `${user.name} was locked (warning 3 of 3). They are signed out until you restore their account.`
          : nextCount === 2
            ? `${user.name} was suspended for 1 week (warning 2 of 3). They are signed out until it expires or you restore them.`
            : `${user.name} received warning 1 of 3. A second warning suspends them, a third locks their account.`
      );
    } catch (error) {
      handleAccountActionError(error);
    } finally {
      setBusyId(null);
      window.setTimeout(() => setActionError(""), 6000);
    }
  };

  const setAccountStatus = async (
    user: ApiUser & { account_status?: ApiAccountStatus },
    status: ApiAccountStatus
  ) => {
    setBusyId(user.id);
    setActionError("");
    try {
      await updateAccountStatus(user.id, status);
      setUsers((current) =>
        current.map((item) =>
          item.id === user.id ? { ...item, account_status: status } : item
        )
      );
      setActionError(
        status === "active"
          ? `${user.name} can sign in again.`
          : `${user.name}'s account was ${status}. They are signed out until restored.`
      );
    } catch (error) {
      handleAccountActionError(error);
    } finally {
      setBusyId(null);
      window.setTimeout(() => setActionError(""), 4500);
    }
  };

  const removeAccount = async (user: ApiUser) => {
    setBusyId(user.id);
    setActionError("");
    try {
      await deleteAccount(user.id);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      setActionError(`The account of ${user.name} was deleted.`);
    } catch (error) {
      handleAccountActionError(error);
    } finally {
      setBusyId(null);
      window.setTimeout(() => setActionError(""), 4500);
    }
  };

  const handleAccountActionError = (error: unknown) => {
    setActionError(
      error instanceof ApiError && error.requestId
        ? `${error.message} Reference: ${error.requestId}`
        : error instanceof Error
          ? error.message
          : "The account action could not be completed."
    );
  };

  const usersLastPage = Math.max(1, Math.ceil(users.length / USERS_PAGE_SIZE));
  const usersCurrentPage = Math.min(usersPage, usersLastPage);
  const pagedUsers = users.slice(
    (usersCurrentPage - 1) * USERS_PAGE_SIZE,
    usersCurrentPage * USERS_PAGE_SIZE
  );

  if (usersError)
    return (
      <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        {usersError}
      </div>
    );

  if (loading)
    return (
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 p-5">
          <h2 className="font-extrabold">Registered users</h2>
        </div>
        <div className="flex items-center justify-center gap-3 py-12 text-sm font-semibold text-slate-400">
          <span className="live-pulse" aria-hidden="true" />
          Loading users...
        </div>
      </div>
    );

  if (!users.length)
    return (      <div className="card overflow-hidden">
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
    <section className="card users-card">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <h2 className="font-extrabold">Registered users</h2>
        <span className="badge">{users.length}</span>
      </div>
      {actionError && (
        <div className="users-action-notice" role="status">
          {actionError}
        </div>
      )}
      <ul className="users-table">
          <li className="users-head" aria-hidden="true">
          <span className="users-head-user">User</span>
          <div className="users-row-meta">
            <span>School ID</span>
            <span>Role</span>
            <span>Department</span>
            <span>Reports</span>
            <span>Joined</span>
            <span className="users-head-actions">Actions</span>
          </div>
        </li>
        {pagedUsers.map((user, index) => (
          <li key={user.id} className="users-row users-row-appear" style={{ animationDelay: `${Math.min(index, 12) * 70}ms` }}>
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
                  className={`badge badge-${user.role === "admin" ? "progress" : user.role === "maintenance" ? "progress" : "review"}`}
                >
                  {user.role}
                </span>
                {user.role === "maintenance" && user.warnings_count
                  ? user.warnings_count > 0 && (
                      <span className={`users-status users-status-warn ${user.warnings_count >= 2 ? "is-critical" : ""}`}>
                        {`⚠ ${user.warnings_count}/3 warnings`}
                      </span>
                    )
                  : null}
                {user.role !== "admin" && user.account_status && user.account_status !== "active" && (
                  <span className={`users-status users-status-${user.account_status}`}>
                    {user.account_status}
                    {user.account_status === "suspended" && user.status_until && (
                      <>
                        {" · "}
                        {(() => {
                          const until = new Date(user.status_until).getTime();
                          const days = Math.max(
                            0,
                            Math.ceil((until - Date.now()) / 86_400_000)
                          );
                          return days > 0
                            ? `${days}d left`
                            : "expiring";
                        })()}
                      </>
                    )}
                  </span>
                )}
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
              {user.role !== "admin" && (
                <span className="users-row-actions">
                  <div
                    className={`users-action-menu ${busyId === user.id ? "is-busy" : ""}`}
                    data-open={openMenuId === user.id || undefined}
                  >
                    <button
                      type="button"
                      className="users-action-trigger"
                      aria-haspopup="menu"
                      aria-expanded={openMenuId === user.id}
                      aria-label={`Account actions for ${user.name}`}
                      disabled={busyId === user.id}
                      onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                    >
                      <Icon name="alert" size={14} />
                    </button>
                    {openMenuId === user.id && (
                      <div className="users-action-menu-list" role="menu">
                        {user.account_status === "suspended" || user.account_status === "locked" ? (
                          <button
                            type="button"
                            role="menuitem"
                            className="users-menu-item users-menu-restore"
                            onClick={() => {
                              setOpenMenuId(null);
                              setAccountStatus(user, "active");
                            }}
                          >
                            <Icon name="check" size={13} /> Restore account
                          </button>
                        ) : (
                          <>
                            {user.role === "maintenance" && (
                              <button
                                type="button"
                                role="menuitem"
                                className="users-menu-item users-menu-warn"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  askConfirm(
                                    "Send warning",
                                    `${user.name} has ${(user.warnings_count ?? 0)} of 3 warnings.${(user.warnings_count ?? 0) >= 2 ? " A third warning LOCKS the account permanently until restored." : " A second warning suspends the account for 1 week."} Send warning ${(user.warnings_count ?? 0) + 1} of 3?`,
                                    () => void warnMaintenance(user),
                                    "Send warning"
                                  );
                                }}
                              >
                                <Icon name="alert" size={13} />
                                {` Send warning ${(user.warnings_count ?? 0) + 1} of 3`}
                              </button>
                            )}
                            <button
                              type="button"
                              role="menuitem"
                              className="users-menu-item users-menu-suspend"
                              onClick={() => {
                                setOpenMenuId(null);
                                setAccountStatus(user, "suspended");
                              }}
                            >
                              <Icon name="alert" size={13} /> Suspend account
                            </button>
                            <button
                              type="button"
                              role="menuitem"
                              className="users-menu-item users-menu-lock"
                              onClick={() => {
                                setOpenMenuId(null);
                                setAccountStatus(user, "locked");
                              }}
                            >
                              <Icon name="lock" size={13} /> Lock account
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          role="menuitem"
                          className="users-menu-item users-menu-delete"
                          onClick={() => {
                            setOpenMenuId(null);
                            askConfirm(
                              "Delete account",
                              `Delete the account of ${user.name}? It will be moved to the Recycle Bin, where it can be restored.`,
                              () => removeAccount(user),
                              "Delete"
                            );
                          }}
                        >
                          <Icon name="trash" size={13} /> Delete account
                        </button>
                      </div>
                    )}
                  </div>
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
      {usersLastPage > 1 && (
        <div className="notifications-pagination done-works-pagination" aria-label="Registered users pagination">
          <button
            type="button"
            className="notifications-page-btn"
            disabled={usersCurrentPage <= 1}
            onClick={() => setUsersPage(usersCurrentPage - 1)}
          >
            Prev
            <Icon name="arrow" size={13} />
          </button>
          <div className="notifications-page-dots">
            {Array.from({ length: usersLastPage }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`notifications-page-dot ${n === usersCurrentPage ? "is-current" : ""}`}
                aria-current={n === usersCurrentPage ? "page" : undefined}
                onClick={() => setUsersPage(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="notifications-page-btn"
            disabled={usersCurrentPage >= usersLastPage}
            onClick={() => setUsersPage(usersCurrentPage + 1)}
          >
            Next
            <Icon name="arrow" size={13} />
          </button>
        </div>
      )}
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const action = confirmState.action;
            setConfirmState(null);
            action();
          }}
        />
      )}
    </section>
  );
}

/** One export button: click exports with the chosen format; the chevron opens the CSV/PDF choice. */
function DoneWorksExportDropdown({
  format,
  disabled,
  title,
  onSelect,
  onFormatChange,
}: {
  format: "csv" | "pdf";
  disabled?: boolean;
  title?: string;
  /** main button click: actually export with the current format */
  onSelect: (format: "csv" | "pdf") => void;
  /** menu option click: only change the chosen format */
  onFormatChange: (format: "csv" | "pdf") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // hide the floating theme widget while a menu is open, so it never overlaps
    document.body.classList.add("select-open");
    const close = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("pointerdown", close as unknown as EventListener);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("pointerdown", close as unknown as EventListener);
      document.body.classList.remove("select-open");
    };
  }, [open]);

  return (
    <div ref={ref} className="done-works-export-combo" data-open={open || undefined}>
      <div className={`done-works-export ${disabled ? "is-disabled" : ""}`}>
        <button
          type="button"
          className="done-works-export-main"
          disabled={disabled}
          title={title}
          onClick={() => onSelect(format)}
        >
          <Icon name="arrow" size={13} /> Export as {format.toUpperCase()}
        </button>
        <button
          type="button"
          className="done-works-export-chevron"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Choose export format"
          disabled={disabled}
          onClick={(event) => {
            event.stopPropagation();
            open ? setOpen(false) : setOpen(true);
          }}
        >
          <span className={`modern-select-chevron ${open ? "done-works-chevron-up" : ""}`} />
        </button>
      </div>
      {open && (
        <div className="done-works-export-menu" role="menu">
          {([
            ["csv", "Export as CSV", "Spreadsheet"],
            ["pdf", "Export as PDF", "Printable document"],
          ] as const).map(([value, label, hint]) => (
            <button
              key={value}
              type="button"
              role="menuitem"
              className={`done-works-export-option ${format === value ? "is-selected" : ""}`}
              onClick={() => {
                setOpen(false);
                onFormatChange(value);
              }}
            >
              <span>
                <b>{label}</b>
                <small>{hint}</small>
              </span>
              {format === value && <Icon name="check" size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Turns a timestamp into a friendly "3 minutes ago" value. */
function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);
  if (Number.isNaN(minutes)) return "";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: days > 330 ? "numeric" : undefined,
  });
}

type NotificationKind =
  | "resolved"
  | "status"
  | "assigned"
  | "message"
  | "warning"
  | "new-report"
  | "alert";

/** Decides which icon/color to use for a notification based on its text. */
function notificationKind(message: string): NotificationKind {
  const lowered = message.toLowerCase();
  if (lowered.includes("resolved")) return "resolved";
  if (lowered.startsWith("warning") || lowered.includes("flagged") || lowered.includes("suspended") || lowered.includes("locked")) return "warning";
  if (lowered.includes("you were assigned") || lowered.includes("assigned to report")) return "assigned";
  if (lowered.startsWith("new message")) return "message";
  if (lowered.startsWith("new report")) return "new-report";
  // Reporter/admin status pings: "Report FX-… is now …"
  if (lowered.includes("in progress") || lowered.includes("under maintenance") || lowered.includes("under review")) return "status";
  if (lowered.includes("review") || lowered.includes("progress")) return "status";
  return "alert";
}

const notificationKindMeta: Record<
  NotificationKind,
  { icon: IconName; label: string; tone: string }
> = {
  resolved: { icon: "check", label: "Resolved", tone: "tone-resolved" },
  status: { icon: "activity", label: "Status update", tone: "tone-review" },
  assigned: { icon: "clipboard", label: "Assigned to you", tone: "tone-review" },
  message: { icon: "message", label: "Message", tone: "tone-message" },
  warning: { icon: "alert", label: "Warning", tone: "tone-warning" },
  "new-report": { icon: "clipboard", label: "New report", tone: "tone-resolved" },
  alert: { icon: "alert", label: "Needs attention", tone: "tone-alert" },
};


// ============================================================
// NOTIFICATIONS PAGE — the full bell-icon feed: read, archive,
// clear, and badge-count display, with grouped sections.
// ============================================================
function Notifications({
  loader,
  onOpenPage,
  onOpenReport,
  onMarkRead,
  onArchive,
  onDelete,
  onDeleteAll,
  onChanged,
  serverUnreadCount,
}: {
  loader: (scope: "active" | "archived", page: number) => Promise<Paginated<ApiNotification>>;
  onOpenPage: (page: string) => void;
  onOpenReport: (reportId: string) => void;
  onMarkRead: (notification: ApiNotification) => void;
  onArchive: (notification: ApiNotification, archived: boolean) => void;
  onDelete: (ids: number[]) => void;
  onDeleteAll: (scope: "archived" | "all") => void;
  onChanged: () => void;
  serverUnreadCount: number;
}) {
  const [filter, setFilter] = useState<"active" | "archived">("active");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [items, setItems] = useState<ApiNotification[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [isFetching, setIsFetching] = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    action: () => void;
  } | null>(null);

  const askConfirm = (
    title: string,
    message: string,
    action: () => void,
    confirmLabel?: string
  ) =>
    setConfirmState({ title, message, action, confirmLabel });

  const fetchPage = useCallback((scope: "active" | "archived", targetPage: number, unreadOnly: boolean) => {
    setIsFetching(true);
    return loader(scope, targetPage)
      .then((result) => {
        setItems(unreadOnly ? result.data.filter((item) => !item.is_read) : result.data);
        setLastPage(result.last_page);
        setPage(result.current_page);
        setLoadError(false);
      })
      .catch(() => {
        setItems([]);
        setLastPage(1);
        setLoadError(true);
      })
      .finally(() => setIsFetching(false));
  }, [loader]);

  useEffect(() => {
    fetchPage(onlyUnread ? "active" : filter, reloadTick === 0 ? 1 : page, onlyUnread);
  }, [filter, onlyUnread, reloadTick, fetchPage]);

  const goToPage = (target: number) => fetchPage(onlyUnread ? "active" : filter, target, onlyUnread);

  const visible = items;

  const withRefresh = (action: () => void) => {
    action();
    onChanged();
    setSelected([]);
    if (selectMode) setSelectMode(false);
    setReloadTick((tick) => tick + 1);
  };
  const toggleSelected = (id: number) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
    );

  const runDelete = (ids: number[], confirmText: string) => {
    if (!ids.length) return;
    askConfirm("Delete notifications", confirmText, () =>
      withRefresh(() => onDelete(ids))
    );
  };

  if (isFetching && !items.length) {
    return (
      <section className="notifications-page">
        <div className="notifications-page-heading">
          <div>
            <span className="eyebrow"><Icon name="bell" size={13} /> Activity center</span>
            <h1 className="notification-title-gradient">Notifications</h1>
            <p>Stay updated on reports, reviews, and changes across your campus.</p>
          </div>
        </div>
        <div className="notification-list">
          {[0, 1, 2, 3].map((index) => (
            <div className="notification-item notification-skeleton" key={index} style={{ animationDelay: `${index * 90}ms` }}>
              <span className="notification-item-icon notification-skeleton-tile" />
              <div className="notification-item-content">
                <span className="notification-skeleton-line w32" />
                <span className="notification-skeleton-line w72" />
                <span className="notification-skeleton-line w48" />
              </div>
            </div>
          ))}
        </div>
      </section>
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
          <h1 className="notification-title-gradient">
            {filter === "archived" ? "Archived" : onlyUnread ? "Unread" : "Notifications"}
          </h1>
          <p>
            Stay updated on reports, reviews, and changes across your campus.
          </p>
        </div>
        {filter === "active" && (
          <span className="notifications-count">
            <span className={`${serverUnreadCount > 0 ? "" : "is-idle"} live-pulse`} aria-hidden="true" />
            <strong className="notifications-count-num" key={serverUnreadCount}>{serverUnreadCount}</strong>{" "}
            unread
          </span>
        )}
      </div>
      <div className="notifications-filters" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={filter === "active" && !onlyUnread}
          className={`notifications-chip ${filter === "active" && !onlyUnread ? "is-active" : ""}`}
          onClick={() => { setFilter("active"); setOnlyUnread(false); }}
        >
          All updates
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onlyUnread}
          className={`notifications-chip ${onlyUnread ? "is-active" : ""}`}
          onClick={() => { setFilter("active"); setOnlyUnread(true); }}
        >
          New
          <span>{serverUnreadCount}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={filter === "archived"}
          className={`notifications-chip ${filter === "archived" ? "is-active" : ""}`}
          onClick={() => { setFilter("archived"); setOnlyUnread(false); }}
        >
          <Icon name="archive" size={12} /> Archived
        </button>

        <div className="notifications-more" data-open={menuOpen || selectMode || undefined}>
          <button
            type="button"
            className="notifications-more-toggle"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => {
              if (selectMode) {
                setSelectMode(false);
                setSelected([]);
                setMenuOpen(false);
                return;
              }
              setMenuOpen((open) => !open);
            }}
          >
            <Icon name={selectMode ? "close" : "grid"} size={15} />
            {selectMode ? "Cancel select" : "Options"}
          </button>
          {menuOpen && !selectMode && (
            <div className="notifications-menu" role="menu" onMouseLeave={() => setMenuOpen(false)}>
              {filter === "archived" ? (
                <>
                  <button type="button" role="menuitem" className="notifications-menu-item"
                    onClick={() => { setMenuOpen(false); setSelectMode(true); }}>
                    <Icon name="check" size={13} /> Select all
                  </button>
                  <button type="button" role="menuitem" className="notifications-menu-item danger"
                    onClick={() => {
                      setMenuOpen(false);
                      askConfirm(
                        "Clear archived",
                        "Delete ALL archived notifications? This cannot be undone.",
                        () => withRefresh(() => onDeleteAll("archived")),
                        "Delete all"
                      );
                    }}>
                    <Icon name="trash" size={13} /> Delete all archived
                  </button>
                </>
              ) : (
                <>
                  <button type="button" role="menuitem" className="notifications-menu-item"
                    onClick={() => { setMenuOpen(false); setSelectMode(true); setSelected(visible.map((item) => item.id)); }}>
                    <Icon name="check" size={13} /> Select all
                  </button>
                  <button type="button" role="menuitem" className="notifications-menu-item"
                    onClick={() => { setMenuOpen(false); visible.filter((item) => !item.is_read).forEach((item) => onMarkRead(item)); onChanged(); }}>
                    <Icon name="bell" size={13} /> Mark all as read
                  </button>
                  <button type="button" role="menuitem" className="notifications-menu-item danger"
                    onClick={() => {
                      setMenuOpen(false);
                      askConfirm(
                        "Clear notifications",
                        "Delete ALL active notifications? This cannot be undone.",
                        () => withRefresh(() => onDeleteAll("all")),
                        "Delete all"
                      );
                    }}>
                    <Icon name="trash" size={13} /> Delete all
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {selectMode && selected.length > 0 && (
          <div className="notifications-bulk-actions">
            {filter === "archived" ? (
              <>
                <button
                  type="button"
                  className="notifications-bulk-btn"
                  onClick={() => withRefresh(() => visible.filter((item) => selected.includes(item.id)).forEach((item) => onArchive(item, false)))}
                >
                  <Icon name="check" size={13} /> Restore ({selected.length})
                </button>
                <button
                  type="button"
                  className="notifications-bulk-btn danger"
                  onClick={() => runDelete([...selected], `Delete ${selected.length} selected notification${selected.length === 1 ? "" : "s"}? This cannot be undone.`)}
                >
                  <Icon name="trash" size={13} /> Delete ({selected.length})
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="notifications-bulk-btn"
                  onClick={() => withRefresh(() => visible.filter((item) => selected.includes(item.id)).forEach((item) => onArchive(item, true)))}
                >
                  <Icon name="archive" size={13} /> Archive ({selected.length})
                </button>
                <button
                  type="button"
                  className="notifications-bulk-btn danger"
                  onClick={() => runDelete([...selected], `Delete ${selected.length} selected notification${selected.length === 1 ? "" : "s"}? This cannot be undone.`)}
                >
                  <Icon name="trash" size={13} /> Delete ({selected.length})
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {selectMode && visible.length > 0 && (
        <label className="notifications-select-all card">
          <input
            type="checkbox"
            checked={visible.every((item) => selected.includes(item.id))}
            onChange={(event) => setSelected(event.target.checked ? visible.map((item) => item.id) : [])}
          />
          <span>Select all in this view ({visible.length})</span>
        </label>
      )}

      <div className={`notification-list ${isFetching ? "is-fading" : ""}`}>
        {visible.map((notification, index) => {
          const kind = notificationKind(notification.message);
          const meta = notificationKindMeta[kind];
          return (
            <div
              className={`notification-item w-full text-left ${
                notification.is_read ? "" : "is-unread"
              } ${selectMode && selected.includes(notification.id) ? "is-selected" : ""}`}
              key={`${page}-${notification.id}`}
              style={{ animationDelay: `${Math.min(index, 10) * 60}ms` }}
            >
              {selectMode && (
                <label className="notification-check" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(notification.id)}
                    onChange={() => toggleSelected(notification.id)}
                    aria-label="Select notification"
                  />
                </label>
              )}
              <button
                type="button"
                className="notification-item-main"
                onClick={() => {
                  onMarkRead(notification);
                  if (notification.related_report_id) {
                    onOpenReport(
                      `FX-${String(notification.related_report_id).padStart(4, "0")}`
                    );
                  }
                }}
                aria-label={`Open report: ${notification.message}`}
              >
                <span className={`notification-item-icon ${meta.tone}`}>
                  <Icon name={meta.icon} size={17} />
                </span>
                <div className="notification-item-content">
                  <div className="notification-item-topline">
                    <span className={`notification-kind ${meta.tone}`}>
                      {meta.label}
                    </span>
                    {notification.archived_at && (
                      <span className="notification-kind tone-archived">Archived</span>
                    )}
                    {!notification.is_read && !notification.archived_at && (
                      <span className="notification-unread-dot" />
                    )}
                  </div>
                  <strong>{notification.message}</strong>
                  <small>
                    <Icon name="activity" size={12} />{" "}
                    {relativeTime(notification.created_at)}
                  </small>
                </div>
                <span className="notification-item-arrow">
                  <Icon name="arrow" size={15} />
                </span>
              </button>
              <div className="notification-item-actions">
                {!notification.is_read && !notification.archived_at && (
                  <button
                    type="button"
                    className="notification-mark-read notification-action-pop"
                    aria-label="Mark as read"
                    title="Mark as read"
                    onClick={() => withRefresh(() => onMarkRead(notification))}
                  >
                    <Icon name="check" size={14} />
                  </button>
                )}
                <button
                  type="button"
                  className="notification-archive-btn notification-action-pop"
                  aria-label={notification.archived_at ? "Restore" : "Archive"}
                  title={notification.archived_at ? "Restore from archive" : "Archive"}
                  onClick={() => withRefresh(() => onArchive(notification, !notification.archived_at))}
                >
                  <Icon name="archive" size={14} />
                </button>
                <button
                  type="button"
                  className="notification-delete-btn notification-action-pop"
                  aria-label="Delete"
                  title="Delete"
                  onClick={() => runDelete([notification.id], "Delete this notification? This cannot be undone.")}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            </div>
          );
        })}
        {visible.length === 0 && !isFetching && (
          loadError ? (
            <div className="card notification-empty-page">
              <div className="notification-empty-icon is-warning">
                <Icon name="alert" size={22} />
              </div>
              <h2>Couldn't load notifications</h2>
              <p>There was a problem reaching the server. Check your connection and try again.</p>
              <button
                type="button"
                className="btn-primary mt-3"
                onClick={() => setReloadTick((tick) => tick + 1)}
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="card notification-empty-page">
              <div className="notification-empty-icon">
                <Icon name={filter === "archived" ? "archive" : "check"} size={22} />
              </div>
              <h2>{filter === "archived" ? "No archived notifications" : onlyUnread ? "No unread updates" : "No notifications"}</h2>
              <p>
                {filter === "archived"
                  ? "Archived notifications will be kept here until you delete them."
                  : onlyUnread
                    ? "Everything has been reviewed. New activity will show up here."
                    : "New updates about your reports will land here."}
              </p>
            </div>
          )
        )}
      </div>

      {lastPage > 1 && !isFetching && (
        <div className="notifications-pagination" aria-label="Notifications pagination">
          <button
            type="button"
            className="notifications-page-btn"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            Prev
            <Icon name="arrow" size={13} />
          </button>
          <div className="notifications-page-dots">
            {Array.from({ length: lastPage }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`notifications-page-dot ${n === page ? "is-current" : ""}`}
                aria-current={n === page ? "page" : undefined}
                onClick={() => goToPage(n)}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="notifications-page-btn"
            disabled={page >= lastPage}
            onClick={() => goToPage(page + 1)}
          >
            Next
            <Icon name="arrow" size={13} />
          </button>
        </div>
      )}
      {isFetching && items.length > 0 && (
        <p className="notifications-loading-more"><span className="live-pulse" /> Loading page {page}...</p>
      )}
      {confirmState && (
        <ConfirmModal
          title={confirmState.title}
          message={confirmState.message}
          confirmLabel={confirmState.confirmLabel}
          onCancel={() => setConfirmState(null)}
          onConfirm={() => {
            const action = confirmState.action;
            setConfirmState(null);
            action();
          }}
        />
      )}
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

/** The visual campus map: click a room tile to jump to the New Report form for it. */
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

  const resolveBuildingKey = (value: string) => {
    const normalized = normalizeBuilding(value);
    if (!normalized) return null;
    const direct = campusBuildings.find(
      (building) => normalizeBuilding(building.name) === normalized
    );
    if (direct) return normalizeBuilding(direct.name);
    const partial = campusBuildings.find((building) => {
      const name = normalizeBuilding(building.name);
      const short = normalizeBuilding(building.shortName);
      return (
        normalized.includes(name) ||
        name.includes(normalized) ||
        normalized.includes(short)
      );
    });
    return partial ? normalizeBuilding(partial.name) : null;
  };

  const reportCounts = new Map<string, number>();
  const criticalBuildings = new Set<string>();

  reports.forEach((report) => {
    if (report.status === "resolved") return;
    const buildingKey = resolveBuildingKey(report.building ?? "")
      ?? resolveBuildingKey(report.room ?? "");
    if (!buildingKey) return;
    reportCounts.set(buildingKey, (reportCounts.get(buildingKey) ?? 0) + 1);
    if (report.priority === "critical") {
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
          <Image
            unoptimized
            className="campus-route-map-image"
            src="/campus-route-map.png"
            alt="Campus route map showing the school buildings and walkways"
            width={1200}
            height={800}
            sizes="100vw"
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

/** Small panel of report totals shown on the map page. */
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

// ============================================================
// MY REPORTS — the student's own report list: statuses,
// withdraw/delete, and open details.
// ============================================================
function MyReports({
  reportData,
  focusId,
  onFocused,
  onCommentAdded,
  onFeedbackStored,
}: {
  reportData: Report[];
  focusId?: string | null;
  onFocused?: () => void;
  onCommentAdded: (
    reportId: string,
    comment: { id: number; message: string; created_at: string; author?: ApiUser }
  ) => void;
  onFeedbackStored?: (
    reportId: string,
    feedback: { rating: number; comment: string | null; created_at: string }
  ) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDay, setFilterDay] = useState("");

  // A report was focused from outside (notification/search): clear any
  // active filters, expand it, and scroll it into view.
  useEffect(() => {
    if (!focusId) return;
    setFilterYear("");
    setFilterMonth("");
    setFilterDay("");
    setSortOrder("newest");
    setExpandedId(focusId);
    const timer = window.setTimeout(() => {
      document
        .getElementById(`my-report-${focusId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      onFocused?.();
    }, 380);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId]);

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
    maint: 88,
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
                  id={`my-report-${report.id}`}
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
                    onFeedbackStored={onFeedbackStored}
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

/** The student's view of one report: chat, status timeline, rate the fix. */
function MyReportDetails({
  report,
  statusSteps,
  onCommentAdded,
  onFeedbackStored,
}: {
  report: Report;
  statusSteps: Array<{ value: Status; label: string }>;
  onCommentAdded: (
    reportId: string,
    comment: { id: number; message: string; created_at: string; author?: ApiUser }
  ) => void;
  onFeedbackStored?: (
    reportId: string,
    feedback: { rating: number; comment: string | null; created_at: string }
  ) => void;
}) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [rating, setRating] = useState(0);
  const [ratingHover, setRatingHover] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const commentLocked = report.flagged || report.status === "resolved";

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
        {report.flagged ? (
          <div className="my-report-flag-banner">
            <Icon name="alert" size={15} />
            <span>
              <strong>Flagged by the admin</strong>
              {report.flagReason === "inappropriate" && " · Inappropriate content"}
              {report.flagReason === "misinformation" && " · Misinformation"}
              {report.flagReason === "ai_generated" && " · Suspected AI-generated photo"}
              {" — commenting is disabled. You can still rate the work when it is resolved."}
            </span>
          </div>
        ) : null}
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
              <Image
                unoptimized
                src={report.photoUrl}
                alt={`Photo attached to ${report.title}`}
                width={1200}
                height={800}
                sizes="100vw"
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
          {report.flagged ? (
            <p className="my-report-comment-locked">
              <Icon name="lock" size={13} /> Commenting is disabled because this
              report was flagged by the admin.
            </p>
          ) : report.status === "resolved" ? (
            <p className="my-report-comment-locked">
              <Icon name="lock" size={13} /> This issue has been solved, so
              commenting is closed. Share your rating below.
            </p>
          ) : (
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
          )}
          {error && (
            <p className="mt-2 text-sm font-semibold text-rose-600">
              {error}
            </p>
          )}
        </div>
        {report.status === "resolved" && (
          <div className="my-report-description">
            <span>Rate this report</span>
            {report.feedback ? (
              <p className="mt-2">
                {Array.from({ length: report.feedback.rating }).map((_, i) => (
                  <span className="my-report-star is-given" key={i}>★</span>
                ))}
                {Array.from({ length: 5 - report.feedback.rating }).map((_, i) => (
                  <span className="my-report-star" key={`e${i}`}>★</span>
                ))}
                <span className="ml-2 text-sm font-semibold">
                  {report.feedback.rating}/5
                </span>
                {report.feedback.comment && (
                  <p className="mt-2">“{report.feedback.comment}”</p>
                )}
              </p>
            ) : (
              <div className="my-report-rate-block">
                <div className="rating-stars my-report-rate-stars">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      className={`my-report-star-btn ${
                        value <= (ratingHover || rating) ? "is-active" : ""
                      }`}
                      onMouseEnter={() => setRatingHover(value)}
                      onMouseLeave={() => setRatingHover(0)}
                      onClick={() => setRating(value)}
                      aria-label={`Rate ${value} of 5`}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <input
                  value={reviewText}
                  onChange={(event) => setReviewText(event.target.value)}
                  maxLength={1000}
                  placeholder="Optional feedback (how was the fix?)"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                />
                <button
                  type="button"
                  className="btn-primary"
                  disabled={feedbackBusy || !rating}
                  onClick={async () => {
                    setFeedbackBusy(true);
                    setFeedbackError("");
                    try {
                      const feedback = await submitReportFeedback(
                        report.id.replace(/^FX-0*/, ""),
                        rating,
                        reviewText.trim()
                      );
                      onFeedbackStored?.(report.id, feedback);
                    } catch (requestError) {
                      setFeedbackError(
                        requestError instanceof Error
                          ? requestError.message
                          : "Feedback could not be submitted."
                      );
                    } finally {
                      setFeedbackBusy(false);
                    }
                  }}
                >
                  {feedbackBusy ? "Sending..." : `Send ${rating || ""} ★ rating`}
                </button>
                {feedbackError && (
                  <p className="text-sm font-semibold text-rose-600">{feedbackError}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The student's home screen: stat cards, quick actions and activity tips. */
function StudentDashboard({
  reportData,
  onNewReport,
  onViewReports,
}: {
  reportData: Report[];
  onNewReport: () => void;
  onViewReports: () => void;
}) {
  return (
    <div className="student-dashboard space-y-5">
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
            <span className="admin-wiggle">Your campus impact</span>
          </span>
          <h1>
            Keep your campus moving, one{" "}
            <span className="animated-gradient-text">report</span>{" "}
            at a time.{" "}
            <span aria-hidden="true">✨</span>
          </h1>
          <p>
            You help the right people notice problems sooner. Track your
            requests, stay updated, and make shared spaces better for everyone.
          </p>
          <div className="flex flex-wrap gap-3">
            <button onClick={onNewReport} className="welcome-cta">
              <Icon name="edit" size={15} /> Report an issue
            </button>
            <button onClick={onViewReports} className="welcome-cta welcome-cta-ghost">
              View my reports <Icon name="arrow" size={14} />
            </button>
          </div>
        </div>
        <div className="welcome-hero-stats">
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

type CookieChoice = "all" | "custom" | "none";

/** PHINMA-UP School ID mask: 03-2324-031903 (12 digits: 2-4-6) or 03-01-2526-048634 (14 digits: 2-2-4-6). Digits with auto hyphens. */
const formatSchoolId = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`;
};
interface CookieConsentState {
  choice: CookieChoice;
  analytics: boolean;
  preferences: boolean;
}

const COOKIE_CONSENT_KEY = "fixko-cookie-consent";

function loadCookieConsent(): CookieConsentState | null {
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_KEY);
    return raw ? (JSON.parse(raw) as CookieConsentState) : null;
  } catch {
    return null;
  }
}

/** The small cookie-consent banner at the bottom of the screen (accept/decline). */
function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [preferences, setPreferences] = useState(false);

  useEffect(() => {
    if (!loadCookieConsent()) {
      setVisible(true);
      document.documentElement.classList.add("consent-open");
      return () => document.documentElement.classList.remove("consent-open");
    }
  }, []);

  const persist = (state: CookieConsentState) => {
    window.localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(state));
    setCustomizing(false);
    setClosing(true);
    window.setTimeout(() => setVisible(false), 420);
  };

  if (!visible) return null;

  return (
    <div
      className={`cookie-consent${closing ? " cookie-consent--leaving" : ""}`}
      role="dialog"
      aria-live="polite"
      aria-label="Privacy and cookies"
    >
      <div className="cookie-consent-copy">
        <strong>
          <span className="cookie-icon" aria-hidden="true">🍪</span> We value your privacy
        </strong>
        <p>
          Fixko uses essential cookies to keep you signed in and keep reports secure. Optional cookies
          help us improve the campus dashboard and remember your preferences. You choose which ones to
          allow.
        </p>
        {customizing && (
          <div className="cookie-options">
            <label>
              <input type="checkbox" checked readOnly /> Essential <small>Always on — sign-in and security</small>
            </label>
            <label>
              <input type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} />{" "}
              Analytics <small>Anonymous usage stats</small>
            </label>
            <label>
              <input
                type="checkbox"
                checked={preferences}
                onChange={(event) => setPreferences(event.target.checked)}
              />{" "}
              Preferences <small>Remember theme and form details</small>
            </label>
          </div>
        )}
      </div>
      <div className="cookie-consent-actions">
        {customizing ? (
          <>
            <button className="cookie-btn cookie-btn-ghost" onClick={() => setCustomizing(false)}>
              Back
            </button>
            <button
              className="cookie-btn cookie-btn-primary"
              onClick={() => persist({ choice: "custom", analytics, preferences })}
            >
              Save my choices
            </button>
          </>
        ) : (
          <>
            <button
              className="cookie-btn cookie-btn-ghost"
              onClick={() => persist({ choice: "none", analytics: false, preferences: false })}
            >
              Reject all
            </button>
            <button className="cookie-btn cookie-btn-ghost" onClick={() => setCustomizing(true)}>
              Reject some
            </button>
            <button
              className="cookie-btn cookie-btn-primary"
              onClick={() => persist({ choice: "all", analytics: true, preferences: true })}
            >
              Accept all
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// HOME — the app's entry point. It decides what to show: the
// Landing page for visitors, the AuthModal when signing in/up,
// or the AppShell (dashboard) once a user is signed in.
// ============================================================
export default function Home() {
  const [role, setRole] = useState<Role | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [authRole, setAuthRole] = useState<Role | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [signInLoading, setSignInLoading] = useState<Role | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("fixko-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(saved ? saved === "dark" : prefersDark);
  }, []);

  // Re-open the workspace after a refresh: the API token survives in
  // localStorage, so validate it against /auth/me and restore the role.
  // An invalid/expired token signs the user out cleanly instead.
  useEffect(() => {
    const cachedUser = window.localStorage.getItem("fixko-user");
    if (!cachedUser || !window.localStorage.getItem("fixko-token")) {
      setRestoring(false);
      return;
    }
    getMe()
      .then((user) => {
        window.localStorage.setItem("fixko-user", JSON.stringify(user));
        setRole(user.role as Role);
      })
      .catch(() => {
        window.localStorage.removeItem("fixko-token");
        window.localStorage.removeItem("fixko-user");
      })
      .finally(() => setRestoring(false));
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

  useEffect(() => initSoundFeedback(), []);

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
      <CookieConsent />
      {!authRole && !signInLoading && <ThemeToggle dark={darkMode} setDark={setDarkMode} />}
      {signInLoading ? (
        <SignInLoader role={signInLoading} />
      ) : restoring ? null : role ? (
        <AppShell
          role={role}
          onSignOut={() => {
            // Leaving the account also abandons any unsent draft and photo,
            // so the next sign-in starts with a clean report form.
            clearReportDraft();
            clearPhotoFile();
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
