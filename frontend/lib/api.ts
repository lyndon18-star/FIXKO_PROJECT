const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type ApiUser = {
  id: number;
  name: string;
  email: string;
  school_id: string;
  role: "student" | "technician" | "admin";
  department?: string | null;
};

export type ApiRoom = {
  id: number;
  building: string;
  floor: string | null;
  name: string;
  code: string | null;
  department: string | null;
  open_tickets_count?: number;
};

export type ApiTicket = {
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
  created_at: string;
  comments?: Array<{ id: number; message: string; created_at: string; author?: ApiUser }>;
  feedback?: { rating: number; comment: string | null; created_at: string } | null;
};

export type ApiNotification = {
  id: number;
  message: string;
  is_read: boolean;
  related_ticket_id: number | null;
  created_at: string;
  ticket?: ApiTicket;
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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("fixko-token") : null;
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const validationMessage = payload?.errors
      ? Object.values(payload.errors as Record<string, string[]>).flat()[0]
      : undefined;
    throw new Error(validationMessage ?? payload?.message ?? "The request could not be completed.");
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
  name: string;
  email: string;
  school_id: string;
  password: string;
  password_confirmation: string;
  role: "student";
}) {
  return request<ApiResponse<{ user: ApiUser; token: string }>>("/auth/signup", {
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

export function getTickets() {
  return request<{ data: ApiTicket[] }>("/tickets");
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

export function updateTicketStatus(ticketId: string, status: "pending" | "under_review" | "in_progress" | "resolved") {
  return request<ApiTicket>(`/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export function createTicket(input: {
  school_id: string;
  email: string;
  room_id: number;
  category?: string;
  item_name?: string;
  condition?: string;
  quantity?: number;
  description: string;
  priority: "low" | "medium" | "high" | "critical";
}) {
  return request<ApiTicket>("/tickets", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
