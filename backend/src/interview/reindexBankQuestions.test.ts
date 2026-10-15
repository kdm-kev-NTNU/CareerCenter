import { extractBankQuestions } from "@careercenter/shared";
import { describe, expect, it } from "vitest";
import { InterviewPrepMemoryRepository } from "../interviewPrepMemoryRepository.js";
import { sha256Content } from "./contentHash.js";
import { planRuleReindex, reindexAllBankQuestions, reindexBankQuestionsForDoc } from "./reindexBankQuestions.js";

const USER = "u1";

function extract(content: string) {
  return extractBankQuestions({ kind: "core", title: "Kjerne", content });
}

describe("planRuleReindex", () => {
  it("keeps rows whose source sentence is still in the document, also when rewritten or discarded", () => {
    const plan = planRuleReindex(
      "doc",
      [
        { id: "kept", origin: "rule", sourceText: "Hvorfor vil du jobbe her?" },
        { id: "discarded", origin: "rule", sourceText: "Spør alltid om en til?" },
        { id: "gone", origin: "rule", sourceText: "Et spørsmål som er fjernet?" },
        { id: "child", origin: "split", sourceText: "Et spørsmål som er fjernet?" },
        { id: "llm", origin: "llm", sourceText: "Fra LLM, ikke i teksten?" },
        { id: "manual", origin: "manual", sourceText: "Redigert av bruker?" }
      ],
      extract("Hvorfor vil du jobbe her?\nSpør alltid om en til?\nHelt nytt spørsmål her?")
    );
    expect(plan.toDeleteIds).toEqual(["gone", "child"]);
    expect(plan.toInsert.map((row) => row.text)).toEqual(["Helt nytt spørsmål her?"]);
    expect(plan.toInsert[0]).toMatchObject({ origin: "rule", audience: "candidate", sourceText: "Helt nytt spørsmål her?" });
  });
});

describe("reindexBankQuestionsForDoc", () => {
  async function seedDoc(repository: InterviewPrepMemoryRepository, title: string, content: string) {
    return repository.createKnowledgeDoc(USER, { kind: "core", title, content, contentHash: sha256Content(title) });
  }

  it("keeps cleaned rows and their ids when run twice", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await seedDoc(repository, "A", "Hvorfor vil du jobbe her?\nHva gjør du på fritiden?");
    expect(await reindexBankQuestionsForDoc(repository, USER, doc.id)).toEqual({ inserted: 2, removed: 0 });

    const [row] = await repository.listBankQuestions(USER, { q: "fritiden" });
    await repository.updateBankQuestion(USER, row!.id, {
      text: "Hva liker du å gjøre på fritiden?",
      category: "personal",
      cleanedAt: new Date().toISOString()
    });

    expect(await reindexBankQuestionsForDoc(repository, USER, doc.id)).toEqual({ inserted: 0, removed: 0 });
    const after = await repository.getBankQuestionsByIds(USER, [row!.id]);
    expect(after[0]).toMatchObject({ text: "Hva liker du å gjøre på fritiden?", category: "personal" });
  });

  it("allows the same question in two documents", async () => {
    const repository = new InterviewPrepMemoryRepository();
    await seedDoc(repository, "A", "Hva gjør du på fritiden?");
    await seedDoc(repository, "B", "Hva gjør du på fritiden?");

    expect(await reindexAllBankQuestions(repository, USER)).toEqual({ inserted: 2, removed: 0 });
    expect(await reindexAllBankQuestions(repository, USER)).toEqual({ inserted: 0, removed: 0 });
    expect(await repository.listBankQuestions(USER)).toHaveLength(2);
  });

  it("removes rule rows when their sentence leaves the document", async () => {
    const repository = new InterviewPrepMemoryRepository();
    const doc = await seedDoc(repository, "A", "Hvorfor vil du jobbe her?\nHva gjør du på fritiden?");
    await reindexBankQuestionsForDoc(repository, USER, doc.id);
    await repository.updateKnowledgeDoc(USER, doc.id, { content: "Hvorfor vil du jobbe her?" });

    expect(await reindexBankQuestionsForDoc(repository, USER, doc.id)).toEqual({ inserted: 0, removed: 1 });
    expect((await repository.listBankQuestions(USER)).map((row) => row.text)).toEqual(["Hvorfor vil du jobbe her?"]);
  });
});
