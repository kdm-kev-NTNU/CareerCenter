import type { UserProfile } from "@careercenter/shared";
import { request } from "./client.js";

export const authApi = {
  register: (name: string, pin: string) =>
    request<UserProfile>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, pin })
    }),
  login: (name: string, pin: string) =>
    request<UserProfile>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ name, pin })
    }),
  logout: () =>
    request<void>("/api/auth/logout", {
      method: "POST"
    }),
  me: () => request<UserProfile>("/api/auth/me")
};
