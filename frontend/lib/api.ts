// This file has all the functions for talking to the backend API
// (sign in, sign up, fetch rooms/reports/notifications, admin actions, etc.).
// Every function below just sends a request to the server and returns its response.

// The base address of the backend. It can be changed with an environment
// variable, otherwise it falls back to the local server.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

// Shape of a user account as it comes back from the backend.
export type ApiUser = {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  email: string;
  school_id: string;
  role: "user" | "admin" | "maintenance";
  department?: string | null;
  address?: string | null;
  gender?: "male" | "female" | "other" | null;
  block_section?: string | null;
};

// Shape of a room (where a broken facility item is located).
export type ApiRoom = {
  id: number;
  building: string;
  floor: string | null;
  name: string;
  code: string | null;
  department: string | null;
  open_reports_count?: number;
};

// Shape of a facility report, including its room, reporter, photos, comments and feedback.
export type ApiReport = {
  id: number;
  reporter_school_id_snapshot: string;
  reporter_email_snapshot: string;
  room: ApiRoom;
  reporter?: ApiUser;
  category: string | null;
  item_name: string | null;
  condition: string | null;
  quantity: number | null;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: "pending" | "under_review" | "in_progress" | "under_maintenance" | "resolved";
  handled_by?: number | null;
  handler?: ApiUser | null;
  photo_url?: string | null;
  created_at: string;
  resolved_at?: string | null;
  comments?: Array<{ id: number; message: string; created_at: string; author?: ApiUser }>;
  feedback?: { rating: number; comment: string | null; created_at: string } | null;
  is_flagged?: boolean;
  flag_reason?: string | null;
  flag_note?: string | null;
  flagged_at?: string | null;
};

/** Admin warns a maintenance worker (auto-escalates: 2nd = 1-week suspension, 3rd = lock). */
export function warnMaintenanceUser(userId: number, note?: string) {
  return request<{ warnings_count: number; account_status: ApiAccountStatus }>(`/users/${userId}/warn`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}

/** Admin flags a report as inappropriate / misinformation / AI-generated. */
export function flagReport(reportId: number, reason: "inappropriate" | "misinformation" | "ai_generated", note?: string) {
  return request<ApiReport>(`/reports/${reportId}/flag`, {
    method: "POST",
    body: JSON.stringify({ reason, note }),
  });
}

/** Admin removes a flag. */
export function unflagReport(reportId: number) {
  return request<ApiReport>(`/reports/${reportId}/unflag`, { method: "POST" });
}

// Shape of a notification the user receives (e.g. when their report gets an update).
export type ApiNotification = {
  id: number;
  message: string;
  is_read: boolean;
  archived_at?: string | null;
  related_report_id: number | null;
  created_at: string;
  report?: ApiReport;
};

// Used when the backend returns a list split into pages (page number, total, etc.).
export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  to: number | null;
  from: number | null;
};

// Numbers shown on the dashboard: report counts by priority/building, averages, etc.
export type ApiAnalyticsSummary = {
  counts: Record<string, number>;
  by_priority: Record<string, number>;
  by_building: Record<string, number>;
  most_reported: Array<{ item_name: string | null; total: number }>;
  average_resolution_hours: number | null;
};

// A normal API response: the requested data (T) plus the user and login token when relevant.
type ApiResponse<T> = {
  user?: ApiUser;
  token?: string;
  message?: string;
} & T;

// The extra info the backend sends along with an error (message, field errors, etc.).
export type ApiErrorPayload = {
  message?: string;
  code?: string;
  request_id?: string;
  errors?: Record<string, string[]>;
};

// A nicer error object we throw when the API answers with a problem.
// It carries the HTTP status, error code, request id, and per-field errors for forms.
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, status: number, payload: ApiErrorPayload = {}, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = payload.code ?? "REQUEST_FAILED";
    this.requestId = payload.request_id ?? requestId;
    this.fieldErrors = payload.errors ?? {};
  }
}

// Turns raw backend errors into short, friendly sentences shown to the user.
function commonErrorMessage(status: number, code: string, message?: string, fieldErrors: Record<string, string[]> = {}) {
  if (message === "Incorrect username or password.") {
    return message;
  }

  if (code === "NETWORK_ERROR") {
    return "Network error. Please check your connection and try again.";
  }

  const firstFieldError = Object.values(fieldErrors).flat()[0];
  if (code === "VALIDATION_ERROR") {
    return firstFieldError ?? "Please check the highlighted information and try again.";
  }

  return message ?? ({
    401: "Your session has expired. Please sign in again.",
    403: "You do not have permission to perform this action.",
    404: "The requested item could not be found.",
    405: "This action is not available.",
    409: "This request conflicts with existing information.",
    422: "The submitted information could not be processed.",
    429: "Too many requests. Please wait and try again.",
    500: "Server error. Please try again later.",
  }[status] ?? "Something went wrong. Please try again.");
}

// Creates a random id for each request so the backend can trace it in its logs.
function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// The single "fetch" helper every other function in this file uses.
// It adds the saved login token, sets up headers, and turns failed responses into ApiError.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("fixko-token") : null;
  const headers = new Headers(options.headers);
  const requestId = createRequestId();
  headers.set("Accept", "application/json");
  headers.set("X-Request-ID", requestId);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new ApiError("Unable to reach the Fixko server. Check your connection and try again.", 0, {
      code: "NETWORK_ERROR",
    }, requestId);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload;
    const validationMessage = commonErrorMessage(
      response.status,
      errorPayload.code ?? "REQUEST_FAILED",
      errorPayload.message,
      errorPayload.errors ?? {},
    );
    if (response.status === 401 && typeof window !== "undefined") clearToken();
    throw new ApiError(
      validationMessage,
      response.status,
      errorPayload,
      response.headers.get("X-Request-ID") ?? requestId,
    );
  }
  return payload as T;
}

// Sign in with email and password.
export function login(email: string, password: string) {
  return request<ApiResponse<{ user: ApiUser; token: string }>>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

/** Signs a user straight into the system after a verified password-reset OTP (no password needed). */
export function loginVerified(email: string, emailVerificationToken: string) {
  return request<ApiResponse<{ user: ApiUser; token: string }>>("/auth/login-verified", {
    method: "POST",
    body: JSON.stringify({ email, email_verification_token: emailVerificationToken }),
  });
}

// Create a new account (after the email was verified with an OTP).
export function signup(input: {
  last_name: string;
  first_name: string;
  middle_name?: string;
  email: string;
  school_id: string;
  password: string;
  password_confirmation: string;
  role: "user";
  email_verification_token: string;
}) {
  return request<ApiResponse<{ user: ApiUser; token: string }>>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Sends a 6-digit OTP to the given school email to prove it exists. */
export function requestEmailOtp(email: string) {
  return request<ApiResponse<{ message: string; expires_in: number; debug?: { otp_code: string } }>>("/auth/email-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/** Verifies the OTP and returns a short-lived signup verification token. */
export function verifyEmailOtp(email: string, code: string) {
  return request<ApiResponse<{ verified: boolean; email_verification_token: string }>>("/auth/email-otp/verify", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

// Ask the backend to email the user a password-reset link.
export function forgotPassword(email: string) {
  return request<ApiResponse<{ message: string }>>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// Set a new password using the token from the emailed reset link.
export function resetPassword(input: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}) {
  return request<ApiResponse<{ message: string }>>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Password reset proven by an OTP code instead of an emailed link. */
export function resetPasswordOtp(input: {
  email: string;
  email_verification_token: string;
  password: string;
  password_confirmation: string;
}) {
  return request<ApiResponse<{ message: string }>>("/auth/reset-password-otp", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

// Logs the user out on the frontend: deletes the saved token and user info.
export function clearToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("fixko-token");
    window.localStorage.removeItem("fixko-user");
  }
}

/** Fetch the signed-in user with the stored token (used to restore the session on refresh). */
export function getMe() {
  return request<ApiUser>("/auth/me");
}

// Get all rooms (used to fill the room dropdown when creating a report).
export function getRooms() {
  return request<ApiRoom[]>("/rooms");
}

// Get the list of facility reports.
export function getReports() {
  return request<{ data: ApiReport[] }>("/reports");
}

// Get the dashboard numbers (counts, averages, most-reported items).
export function getAnalyticsSummary() {
  return request<ApiAnalyticsSummary>("/analytics/summary");
}

// Get the user's active notifications, one page at a time.
export function getNotifications(page = 1) {
  return request<Paginated<ApiNotification>>(`/notifications?scope=active&page=${page}`);
}

// Get the archived notifications, one page at a time.
export function getArchivedNotifications(page = 1) {
  return request<Paginated<ApiNotification>>(`/notifications?scope=archived&page=${page}`);
}

// Mark a single notification as read.
export function markNotificationRead(notificationId: number) {
  return request<ApiNotification>(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

/** archived=false un-archives (restores). */
export function archiveNotification(notificationId: number, archived = true) {
  return request<ApiNotification>(`/notifications/${notificationId}/archive`, {
    method: "PATCH",
    body: JSON.stringify({ archived }),
  });
}

// Delete one notification for good.
export function deleteNotification(notificationId: number) {
  return request<{ deleted: boolean }>(`/notifications/${notificationId}`, {
    method: "DELETE",
  });
}

/** scope=archived (default) | all */
export function deleteNotifications(scope: "archived" | "all" = "archived") {
  return request<{ deleted: number }>(`/notifications?scope=${scope}`, {
    method: "DELETE",
  });
}

// Get all user accounts (for the admin's manage-users screen).
export function getUsers() {
  return request<Array<ApiUser & { reports_count?: number; created_at?: string; account_status?: ApiAccountStatus; status_until?: string | null; warnings_count?: number }>>("/users");
}

// Admin sets an account's status: active, suspended, or locked.
export type ApiAccountStatus = "active" | "suspended" | "locked";

export function updateAccountStatus(userId: number, status: ApiAccountStatus) {
  return request<null>(`/users/${userId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// Admin permanently deletes a user account.
export function deleteAccount(userId: number) {
  return request<null>(`/users/${userId}`, { method: "DELETE" });
}

/** Admin-only recycle bin: soft-deleted accounts and reports. */
export type ApiRecycleBinAccount = {
  id: number;
  name: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  school_id?: string | null;
  role: "user" | "maintenance";
  department?: string | null;
  deleted_at: string;
};

export type ApiRecycleBinReport = {
  id: number;
  item_name?: string | null;
  category?: string | null;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  status: string;
  reporter_email_snapshot: string;
  deleted_reason?: string | null;
  deleted_at: string;
  is_flagged?: boolean;
  room?: { name: string; building: string } | null;
  reporter?: { name?: string | null; email?: string | null; deleted_at?: string | null } | null;
};

export type ApiRecycleBin = {
  accounts: ApiRecycleBinAccount[];
  reports: ApiRecycleBinReport[];
};

// Get everything currently in the admin's recycle bin (deleted accounts + reports).
export function getRecycleBin() {
  return request<ApiRecycleBin>("/recycle-bin");
}

// Put a deleted account or report back (undo the delete).
export function restoreRecycleBinItem(type: "account" | "report", id: number) {
  return request<{ restored: "account" | "report"; id: number }>("/recycle-bin/restore", {
    method: "POST",
    body: JSON.stringify({ type, id }),
  });
}

/** Permanently removes the item (report photo file is deleted too). */
export function purgeRecycleBinItem(type: "account" | "report", id: number) {
  return request<null>("/recycle-bin/purge", {
    method: "POST",
    body: JSON.stringify({ type, id }),
  });
}

/** Reporter rates a resolved report: 1-5 stars plus an optional review. */
export function submitReportFeedback(reportId: string, rating: number, comment: string) {
  return request<{
    rating: number;
    comment: string | null;
    created_at: string;
  }>(`/reports/${reportId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ rating, comment }),
  });
}

// Update the signed-in user's own profile (address, gender, password change, etc.).
export function updateProfile(payload: {
  address?: string;
  gender?: "male" | "female" | "other";
  block_section?: string;
  current_password?: string;
  password?: string;
  password_confirmation?: string;
}) {
  return request<ApiUser>("/auth/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Move a report to a new status (e.g. pending → in progress → resolved).
export function updateReportStatus(
  reportId: string,
  status: "pending" | "under_review" | "in_progress" | "under_maintenance" | "resolved"
) {
  return request<ApiReport>(`/reports/${reportId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

/** Admin-only: assign a report to (or unassign from) a maintenance personnel. */
export function assignReport(reportId: string, handledBy: number | null) {
  return request<ApiReport>(`/reports/${reportId}`, {
    method: "PATCH",
    body: JSON.stringify({ handled_by: handledBy }),
  });
}

// Post a comment/message on a report.
export function addReportComment(reportId: string, message: string) {
  return request<{ id: number; report_id: number; message: string; created_at: string; author?: ApiUser }>(`/reports/${reportId}/comments`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

// Submit a new facility report. The optional photo is sent as multipart form data.
export function createReport(input: {
  school_id: string;
  email: string;
  room_id: number;
  category?: string;
  item_name?: string;
  condition?: string;
  quantity?: number;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
  photo?: File | null;
}) {
  const body = new FormData();
  Object.entries(input).forEach(([key, value]) => {
    if (value instanceof File) {
      body.append(key, value);
    } else if (value !== undefined && value !== null) {
      body.append(key, String(value));
    }
  });

  return request<ApiReport>("/reports", {
    method: "POST",
    body,
  });
}
