import { showToast, Toast } from "@raycast/api";
import type { Task, CalendarEvent, CommandIntent, Space } from "./types";
import { getPreferences } from "../utils/preferences";

class HamFlowAPI {
  private baseUrl: string;
  private apiToken: string;

  constructor() {
    const prefs = getPreferences();
    this.baseUrl = prefs.serverUrl.replace(/\/$/, ""); // Remove trailing slash
    this.apiToken = prefs.apiToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.apiToken}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "API Error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  // Command API
  async sendCommand(command: string, space: Space): Promise<CommandIntent> {
    return this.request<CommandIntent>("/api/command", {
      method: "POST",
      body: JSON.stringify({ command, space }),
    });
  }

  async executeCommand(
    action: string,
    data: Record<string, unknown>,
    space: Space
  ): Promise<{ success: boolean; data: unknown; boardId?: string }> {
    return this.request("/api/command/execute", {
      method: "POST",
      body: JSON.stringify({ action, data, space }),
    });
  }

  // Calendar/Agenda API
  async getTodayAgenda(space: Space): Promise<CalendarEvent[]> {
    // Get today's date range in UNIX timestamps
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const start = Math.floor(today.getTime() / 1000);
    const end = Math.floor(tomorrow.getTime() / 1000);

    return this.request<CalendarEvent[]>(
      `/api/calendar/events?start=${start}&end=${end}&space=${space}&includeOverdue=true`
    );
  }

  // Tasks API
  async createTask(task: {
    title: string;
    description?: string;
    dueDate?: string;
    priority?: string;
    columnId?: string;
    labels?: string[];
    link?: string;
  }): Promise<Task> {
    return this.request<Task>("/api/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    });
  }

  async getTasks(filters?: {
    space?: Space;
    search?: string;
    priority?: string;
    sortBy?: string;
  }): Promise<Task[]> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value);
      });
    }

    const queryString = params.toString();
    const endpoint = queryString
      ? `/api/tasks?${queryString}`
      : "/api/tasks";

    return this.request<Task[]>(endpoint);
  }

  async updateTask(
    id: string,
    updates: {
      title?: string;
      description?: string;
      dueDate?: string;
      priority?: string;
      columnId?: string;
      completed?: boolean;
    }
  ): Promise<Task> {
    return this.request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(id: string): Promise<void> {
    await this.request(`/api/tasks/${id}`, {
      method: "DELETE",
    });
  }

  // Mark task as complete
  async completeTask(id: string): Promise<Task> {
    return this.updateTask(id, { completed: true });
  }

  // Mark task as incomplete
  async uncompleteTask(id: string): Promise<Task> {
    return this.updateTask(id, { completed: false });
  }
}

export const api = new HamFlowAPI();
