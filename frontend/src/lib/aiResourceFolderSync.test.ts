import { describe, expect, it, vi } from "vitest";
import { writeBundleToDirectory } from "./aiResourceFolderSync.js";

describe("aiResourceFolderSync", () => {
  it("writes new files and reports create actions", async () => {
    const writes: Array<{ path: string; content: string }> = [];

    const root = {
      name: "CareerCenter",
      getDirectoryHandle: vi.fn(async (name: string, _options?: { create?: boolean }) => {
        if (name === ".cursor") {
          return {
            getDirectoryHandle: vi.fn(async (rules: string, rulesOptions?: { create?: boolean }) => {
              expect(rules).toBe("rules");
              expect(rulesOptions?.create).toBe(true);
              return {
                getFileHandle: vi.fn(async (fileName: string, fileOptions?: { create?: boolean }) => {
                  expect(fileName).toBe("tailwind.mdc");
                  expect(fileOptions?.create).toBe(true);
                  return {
                    createWritable: vi.fn(async () => ({
                      write: vi.fn(async (content: string) => {
                        writes.push({ path: ".cursor/rules/tailwind.mdc", content });
                      }),
                      close: vi.fn(async () => undefined)
                    }))
                  };
                })
              };
            })
          };
        }
        throw new Error(`Unexpected directory: ${name}`);
      })
    } as unknown as FileSystemDirectoryHandle;

    const result = await writeBundleToDirectory(root, {
      target: "cursor",
      files: [{
        path: ".cursor/rules/tailwind.mdc",
        content: "# Tailwind\n",
        resourceIds: ["ai-2"],
        resourceNames: ["Tailwind"],
        writeStrategy: "replace"
      }]
    });

    expect(writes).toEqual([{ path: ".cursor/rules/tailwind.mdc", content: "# Tailwind\n" }]);
    expect(result.files[0].action).toBe("create");
    expect(result.cwd).toBe("CareerCenter");
  });
});
