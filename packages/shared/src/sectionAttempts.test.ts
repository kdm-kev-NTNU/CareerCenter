import { describe, expect, it } from "vitest";
import type { InterviewSessionDto, InterviewSessionFeedbackDto } from "./interviewPrepDtos.js";
import { buildSectionAttemptHistory, latestSectionAttempt } from "./sectionAttempts.js";

function feedback(sum: number): InterviewSessionFeedbackDto {
  return {
    scores: {
      openingAndStructure: 1,
      situationAndTask: 1,
      action: 1,
      result: 1,
      learning: 1,
      ownership: 1,
      tempoAndLength: 1,
      relevance: sum - 7
    },
    sum,
    improvement: "Øv mer"
  };
}

function session(
  overrides: Partial<InterviewSessionDto> & Pick<InterviewSessionDto, "id">
): InterviewSessionDto {
  return {
    mode: "behavioral_mock",
    title: "Øving",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

describe("buildSectionAttemptHistory", () => {
  it("numbers finished attempts per section, treating full interview as its own key", () => {
    const history = buildSectionAttemptHistory([
      session({
        id: "case-1",
        planSection: "case",
        finishedAt: "2026-01-01T10:00:00.000Z",
        feedback: feedback(8)
      }),
      session({
        id: "full-1",
        finishedAt: "2026-01-01T11:00:00.000Z",
        feedback: feedback(10)
      }),
      session({
        id: "case-2",
        planSection: "case",
        finishedAt: "2026-01-02T10:00:00.000Z",
        feedback: feedback(11)
      })
    ]);

    const caseAttempts = history.get("case");
    expect(caseAttempts).toHaveLength(2);
    expect(caseAttempts?.[0]).toMatchObject({ version: 1, sum: 8, deltaFromPrevious: undefined });
    expect(caseAttempts?.[1]).toMatchObject({ version: 2, sum: 11, deltaFromPrevious: 3 });

    const fullAttempts = history.get("full");
    expect(fullAttempts).toHaveLength(1);
    expect(fullAttempts?.[0]).toMatchObject({ version: 1, sum: 10 });
  });

  it("skips unfinished sessions", () => {
    const history = buildSectionAttemptHistory([
      session({ id: "open", planSection: "motivation" }),
      session({
        id: "done",
        planSection: "motivation",
        finishedAt: "2026-01-01T12:00:00.000Z",
        feedback: feedback(9)
      })
    ]);

    expect(history.get("motivation")).toHaveLength(1);
    expect(history.get("motivation")?.[0]?.session.id).toBe("done");
  });

  it("uses id as tie-breaker when finishedAt is equal", () => {
    const history = buildSectionAttemptHistory([
      session({
        id: "b",
        planSection: "personal",
        finishedAt: "2026-01-01T10:00:00.000Z",
        feedback: feedback(7)
      }),
      session({
        id: "a",
        planSection: "personal",
        finishedAt: "2026-01-01T10:00:00.000Z",
        feedback: feedback(5)
      })
    ]);

    expect(history.get("personal")?.map((a) => a.session.id)).toEqual(["a", "b"]);
    expect(history.get("personal")?.[0]?.version).toBe(1);
    expect(history.get("personal")?.[1]?.version).toBe(2);
  });

  it("leaves delta undefined for v1 and when a score is missing", () => {
    const history = buildSectionAttemptHistory([
      session({
        id: "v1",
        planSection: "behavioral",
        finishedAt: "2026-01-01T10:00:00.000Z",
        feedback: feedback(6)
      }),
      session({
        id: "v2-no-feedback",
        planSection: "behavioral",
        finishedAt: "2026-01-02T10:00:00.000Z"
      }),
      session({
        id: "v3",
        planSection: "behavioral",
        finishedAt: "2026-01-03T10:00:00.000Z",
        feedback: feedback(9)
      })
    ]);

    const attempts = history.get("behavioral");
    expect(attempts?.[0]?.deltaFromPrevious).toBeUndefined();
    expect(attempts?.[1]?.deltaFromPrevious).toBeUndefined();
    expect(attempts?.[2]?.deltaFromPrevious).toBeUndefined();
  });

  it("assigns the same versions regardless of input order", () => {
    const sessions = [
      session({
        id: "later",
        planSection: "case",
        finishedAt: "2026-01-03T00:00:00.000Z",
        feedback: feedback(12)
      }),
      session({
        id: "earlier",
        planSection: "case",
        finishedAt: "2026-01-01T00:00:00.000Z",
        feedback: feedback(8)
      }),
      session({
        id: "middle",
        planSection: "case",
        finishedAt: "2026-01-02T00:00:00.000Z",
        feedback: feedback(10)
      })
    ];

    const forward = buildSectionAttemptHistory(sessions);
    const reverse = buildSectionAttemptHistory([...sessions].reverse());

    expect(forward.get("case")?.map((a) => ({ id: a.session.id, version: a.version }))).toEqual([
      { id: "earlier", version: 1 },
      { id: "middle", version: 2 },
      { id: "later", version: 3 }
    ]);
    expect(reverse.get("case")?.map((a) => ({ id: a.session.id, version: a.version }))).toEqual(
      forward.get("case")?.map((a) => ({ id: a.session.id, version: a.version }))
    );
    expect(latestSectionAttempt(forward, "case")?.session.id).toBe("later");
    expect(latestSectionAttempt(forward, "motivation")).toBeUndefined();
  });
});
