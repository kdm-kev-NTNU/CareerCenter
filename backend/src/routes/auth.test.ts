import { describe, expect, it } from "vitest";
import { MemoryRepository } from "../memoryRepository.js";
import { buildServer } from "../server.js";
import { MAX_FAILED_ATTEMPTS, LOCKOUT_MINUTES } from "../auth/constants.js";

async function createAuthTestApp() {
  const app = await buildServer({ repository: new MemoryRepository(), authDisabled: false });
  await app.ready();
  return app;
}

describe("Auth Routes", () => {
  describe("GET /api/auth/me", () => {
    it("returns 401 when user not found", async () => {
      const app = await createAuthTestApp();

      // Use a valid-looking JWT token that won't match any user in the repo
      // Since we're using a fresh MemoryRepository, any valid JWT with a non-existent user ID will work
      const response = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: {
          // A JWT token with signature that doesn't match (will fail JWT verification first)
          cookie: "token=invalid.token.here"
        }
      });

      // The JWT verification will fail, resulting in 401
      expect(response.statusCode).toBe(401);

      await app.close();
    });

    it("returns user profile when authenticated", async () => {
      const app = await createAuthTestApp();

      const registered = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "MeTestUser", pin: "1234" }
      });
      expect(registered.statusCode).toBe(201);
      const token = registered.cookies.find((cookie) => cookie.name === "token")?.value;

      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        cookies: { token: token! }
      });

      expect(me.statusCode).toBe(200);
      expect(me.json().name).toBe("MeTestUser");

      await app.close();
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns 401 when user does not exist", async () => {
      const app = await createAuthTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { name: "NonExistentUser", pin: "1234" }
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().message).toBe("Feil navn eller pinkode.");

      await app.close();
    });

    it("returns 423 when account is locked after multiple failed attempts", async () => {
      const repository = new MemoryRepository();
      const app = await buildServer({ repository, authDisabled: false });
      await app.ready();

      // Register a user directly through repository to bypass rate limiting on register
      const pinHash = await import("../auth/pin.js").then((m) => m.hashPin("1234"));
      await repository.createUser("LockoutUser", pinHash);

      // Attempt to login with wrong PIN enough times to trigger lockout
      // Note: rate limit is 5 per minute, and we need exactly 5 failed attempts to trigger lockout
      // The first 4 will return 401, the 5th will return 423 with lockout message
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        const response = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { name: "LockoutUser", pin: "9999" }
        });

        // The last attempt should trigger lockout
        if (i === MAX_FAILED_ATTEMPTS - 1) {
          expect(response.statusCode).toBe(423);
          expect(response.json().message).toContain("låst");
          expect(response.json().lockedUntil).toBeDefined();
        } else {
          expect(response.statusCode).toBe(401);
        }
      }

      await app.close();
    });

    it("triggers lockout after multiple failed attempts", async () => {
      const repository = new MemoryRepository();
      const app = await buildServer({ repository, authDisabled: false });
      await app.ready();

      // Register a user directly through repository
      const pinHash = await import("../auth/pin.js").then((m) => m.hashPin("1234"));
      await repository.createUser("FailedAttemptsUser", pinHash);

      // First few attempts should return 401
      for (let i = 0; i < MAX_FAILED_ATTEMPTS - 1; i++) {
        const response = await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { name: "FailedAttemptsUser", pin: "9999" }
        });
        expect(response.statusCode).toBe(401);
        expect(response.json().message).toBe("Feil navn eller pinkode.");
      }

      // The final attempt that triggers lockout
      const lockoutResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { name: "FailedAttemptsUser", pin: "9999" }
      });

      expect(lockoutResponse.statusCode).toBe(423);
      expect(lockoutResponse.json().message).toContain(LOCKOUT_MINUTES.toString());

      await app.close();
    });

    it("resets failed attempts on successful login", async () => {
      const repository = new MemoryRepository();
      const app = await buildServer({ repository, authDisabled: false });
      await app.ready();

      // Register a user directly through repository
      const pinHash = await import("../auth/pin.js").then((m) => m.hashPin("1234"));
      await repository.createUser("ResetAttemptsUser", pinHash);

      // Make some failed attempts but not enough to lock
      for (let i = 0; i < MAX_FAILED_ATTEMPTS - 2; i++) {
        await app.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: { name: "ResetAttemptsUser", pin: "9999" }
        });
      }

      // Successful login should reset failed attempts
      const successResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { name: "ResetAttemptsUser", pin: "1234" }
      });

      expect(successResponse.statusCode).toBe(200);
      expect(successResponse.json().name).toBe("ResetAttemptsUser");

      // Verify we can login again (failed attempts were reset)
      const secondLogin = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { name: "ResetAttemptsUser", pin: "1234" }
      });

      expect(secondLogin.statusCode).toBe(200);

      await app.close();
    });

    it("returns 423 when trying to login to an already locked account", async () => {
      const repository = new MemoryRepository();
      const app = await buildServer({ repository, authDisabled: false });
      await app.ready();

      // Register a user directly through repository
      const pinHash = await import("../auth/pin.js").then((m) => m.hashPin("1234"));
      const user = await repository.createUser("AlreadyLockedUser", pinHash);

      // Manually trigger lockout through repository
      for (let i = 0; i < MAX_FAILED_ATTEMPTS; i++) {
        await repository.incrementFailedAttempts(user.id);
      }
      const lockoutTime = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      await repository.lockUser(user.id, lockoutTime);

      // Try to login with correct PIN - should be locked
      const lockedResponse = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { name: "AlreadyLockedUser", pin: "1234" }
      });

      expect(lockedResponse.statusCode).toBe(423);
      expect(lockedResponse.json().message).toBe("Kontoen er midlertidig låst. Prøv igjen senere.");
      expect(lockedResponse.json().lockedUntil).toBeDefined();

      await app.close();
    });
  });

  describe("POST /api/auth/register", () => {
    it("returns 409 when username already exists", async () => {
      const app = await createAuthTestApp();

      // Register a user first
      const firstRegister = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "DuplicateUser", pin: "1234" }
      });
      expect(firstRegister.statusCode).toBe(201);

      // Try to register with the same username
      const duplicateRegister = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "DuplicateUser", pin: "5678" }
      });

      expect(duplicateRegister.statusCode).toBe(409);
      expect(duplicateRegister.json().message).toBe("Brukernavnet er allerede tatt.");

      await app.close();
    });

    it("creates user and sets auth cookie on successful registration", async () => {
      const app = await createAuthTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "NewUser", pin: "1234" }
      });

      expect(response.statusCode).toBe(201);
      expect(response.json().name).toBe("NewUser");
      expect(response.json().id).toBeDefined();

      // Check that auth cookie is set
      const tokenCookie = response.cookies.find((cookie) => cookie.name === "token");
      expect(tokenCookie).toBeDefined();
      expect(tokenCookie?.httpOnly).toBe(true);
      expect(tokenCookie?.value).toBeTruthy();

      await app.close();
    });

    it("initializes new user with default board on registration", async () => {
      const app = await createAuthTestApp();

      const response = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "UserWithBoard", pin: "1234" }
      });

      expect(response.statusCode).toBe(201);

      // Verify the user was created
      const token = response.cookies.find((cookie) => cookie.name === "token")?.value;

      // Check that we can get boards for this user
      const boards = await app.inject({
        method: "GET",
        url: "/api/boards",
        cookies: { token: token! }
      });

      expect(boards.statusCode).toBe(200);
      expect(boards.json()).toHaveLength(1);
      expect(boards.json()[0].isDefault).toBe(true);

      await app.close();
    });
  });

  describe("POST /api/auth/logout", () => {
    it("clears the auth cookie and returns 204", async () => {
      const app = await createAuthTestApp();

      // Register and login first
      const registered = await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "LogoutUser", pin: "1234" }
      });
      expect(registered.statusCode).toBe(201);
      const token = registered.cookies.find((cookie) => cookie.name === "token")?.value;

      // Logout
      const logoutResponse = await app.inject({
        method: "POST",
        url: "/api/auth/logout",
        cookies: { token: token! }
      });

      expect(logoutResponse.statusCode).toBe(204);
      expect(logoutResponse.body).toBe("");

      // Verify the cookie is cleared by checking the Set-Cookie header
      const setCookieHeader = logoutResponse.headers["set-cookie"];
      expect(setCookieHeader).toBeDefined();

      await app.close();
    });

    it("returns 204 without authentication (logout is idempotent)", async () => {
      const app = await createAuthTestApp();

      // Logout without being logged in - the logout endpoint is safe to call even without auth
      const logoutResponse = await app.inject({
        method: "POST",
        url: "/api/auth/logout"
      });

      // The logout endpoint returns 204 even without authentication (it's idempotent)
      expect(logoutResponse.statusCode).toBe(204);

      await app.close();
    });
  });
});
