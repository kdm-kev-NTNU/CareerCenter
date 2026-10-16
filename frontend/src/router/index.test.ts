import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import router from "./index.js";
import { useAuthStore } from "../stores/auth.js";

vi.mock("../api/auth.js", () => ({
  authApi: {
    me: vi.fn()
  }
}));

import { authApi } from "../api/auth.js";

const mockedMe = vi.mocked(authApi.me);

describe("router guards", () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    mockedMe.mockRejectedValue(new Error("unauthorized"));
    await router.replace("/login");
  });

  it("redirects unauthenticated users to login", async () => {
    await router.push("/soknader");
    expect(router.currentRoute.value.name).toBe("login");
    expect(router.currentRoute.value.query.redirect).toBe("/soknader");
  });

  it("redirects authenticated users away from login", async () => {
    mockedMe.mockResolvedValue({ id: "u1", name: "Kevin" });
    const auth = useAuthStore();
    await auth.fetchMe();
    await router.push("/soknader");
    expect(router.currentRoute.value.name).toBe("applications");
    await router.push("/internships");
    expect(router.currentRoute.value.name).toBe("applications");
    expect(router.currentRoute.value.query.type).toBe("internship");
    await router.push("/graduate");
    expect(router.currentRoute.value.query.type).toBe("graduate");
    await router.push("/login");
    expect(router.currentRoute.value.name).toBe("dashboard");
  });

  it("opens AON ability folder and redirects unknown providers", async () => {
    mockedMe.mockResolvedValue({ id: "u1", name: "Kevin" });
    const auth = useAuthStore();
    await auth.fetchMe();
    await router.push("/interview/evnetester/aon");
    expect(router.currentRoute.value.name).toBe("interview-ability-provider");
    expect(router.currentRoute.value.params.provider).toBe("aon");
    await router.push("/interview/evnetester/ukjent");
    expect(router.currentRoute.value.name).toBe("interview-ability");
  });
});
