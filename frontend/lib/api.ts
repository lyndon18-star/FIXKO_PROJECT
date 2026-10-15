const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  school_id: string;
  role: "user" | "admin";
  department?: string | null;
};

export type ApiRoom = {
  id: number;
  building: string;
  floor: string | null;
  name: string;
  code: string | null;
  department: string | null;
  open_reports_count?: number;
};

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
  status: "pending" | "under_review" | "in_progress" | "resolved";
  photo_url?: string | null;
  created_at: string;
  comments?: Array<{ id: number; message: string; created_at: string; author?: ApiUser }>;
  feedback?: { rating: number; comment: string | null; created_at: string } | null;
};

export type ApiNotification = {
  id: number;
  message: string;
  is_read: boolean;
  related_report_id: number | null;
  created_at: string;
  report?: ApiReport;
};

export type ApiEquipment = {
  id: number;
  room_id: number;
  name: string;
  category: string | null;
  asset_tag: string | null;
  condition: "new" | "good" | "fair" | "poor" | "broken";
  quantity: number;
  description: string | null;
  room?: ApiRoom;
};

export type ApiAnalyticsSummary = {
  counts: Record<string, number>;
  by_priority: Record<string, number>;
  by_building: Record<string, number>;
  most_reported: Array<{ item_name: string | null; total: number }>;
  average_resolution_hours: number | null;
};

type ApiResponse<T> = {
  user?: ApiUser;
  token?: string;
  message?: string;
} & T;

export type ApiErrorPayload = {
  message?: string;
  code?: string;
  request_id?: string;
  errors?: Record<string, string[]>;
};

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

function createRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

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

export function login(email: string, password: string) {
  return request<ApiResponse<{ user: ApiUser; token: string }>>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function signup(input: {
  last_name: string;
  first_name: string;
  middle_name?: string;
  email: string;
  school_id: string;
  password: string;
  password_confirmation: string;
  role: "user";
}) {
  return request<ApiResponse<{ user: ApiUser; token: string }>>("/auth/signup", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function forgotPassword(email: string) {
  return request<ApiResponse<{}>>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(input: {
  token: string;
  email: string;
  password: string;
  password_confirmation: string;
}) {
  return request<ApiResponse<{}>>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function clearToken() {
  if (typeof window !== "undefined") window.localStorage.removeItem("fixko-token");
}

export function getRooms() {
  return request<ApiRoom[]>("/rooms");
}

export function getReports() {
  return request<{ data: ApiReport[] }>("/reports");
}

export function getEquipment() {
  return request<{ data: ApiEquipment[] }>("/equipment");
}

export function getAnalyticsSummary() {
  return request<ApiAnalyticsSummary>("/analytics/summary");
}

export function getNotifications() {
  return request<{ data: ApiNotification[] }>("/notifications");
}

export function markNotificationRead(notificationId: number) {
  return request<ApiNotification>(`/notifications/${notificationId}/read`, {
    method: "PATCH",
  });
}

export function getUsers() {
  return request<Array<ApiUser & { reports_count?: number; created_at?: string }>>("/users");
}

export function updateReportStatus(reportId: string, status: "pending" | "under_review" | "in_progress" | "resolved") {
  return request<ApiReport>(`/reports/${reportId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function addReportComment(reportId: string, message: string) {
  return request<{ id: number; report_id: number; message: string; created_at: string; author?: ApiUser }>(`/reports/${reportId}/comments`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

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
