import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { authApi } from "../api/auth.js";
import { useAuthStore } from "./auth.js";

vi.mock("../api/auth.js", () => ({
  authApi: {
    me: vi.fn(),
    register: vi.fn(),
    login: vi.fn(),
    logout: vi.fn()
  }
}));

const mockedAuth = vi.mocked(authApi);

describe("useAuthStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it("fetchMe sets user on success", async () => {
    mockedAuth.me.mockResolvedValue({ id: "u1", name: "Kevin" });
    const store = useAuthStore();
    await store.fetchMe();
    expect(store.user?.name).toBe("Kevin");
    expect(store.loading).toBe(false);
  });

  it("fetchMe clears user on failure", async () => {
    mockedAuth.me.mockRejectedValue(new Error("unauthorized"));
    const store = useAuthStore();
    await store.fetchMe();
    expect(store.user).toBeNull();
  });

  it("login and logout update user state", async () => {
    mockedAuth.login.mockResolvedValue({ id: "u1", name: "Kevin" });
    mockedAuth.logout.mockResolvedValue(undefined);
    const store = useAuthStore();
    await store.login("Kevin", "1234");
    expect(store.isAuthenticated).toBe(true);
    await store.logout();
    expect(store.user).toBeNull();
  });
});
