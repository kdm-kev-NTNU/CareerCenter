import type { BachelorFolderTreeNode } from "@careercenter/shared";
import type { FastifyInstance } from "fastify";
import { Readable } from "node:stream";
import { rename } from "node:fs/promises";
import { buffer } from "node:stream/consumers";
import { nanoid } from "nanoid";
import {
  buildStoragePath,
  deleteStoredFile,
  ensureDirForFile,
  readStoredFile,
  resolveStoredPath,
  writeUploadedFile
} from "../bachelorFileStorage.js";
import {
  BachelorFileUploadError,
  validateBachelorFileUpload
} from "../bachelorFileValidation.js";
import type { Repository } from "../repository.js";
import { InvalidReferenceError } from "../repository.js";
import { bachelorFileUpdateSchema, bachelorFolderSchema } from "../schemas.js";

function folderExistsInTree(nodes: BachelorFolderTreeNode[], folderId: string): boolean {
  for (const node of nodes) {
    if (node.id === folderId) return true;
    if (folderExistsInTree(node.children, folderId)) return true;
  }
  return false;
}

async function deleteFolderFilesFromDisk(repository: Repository, userId: string, folderId: string) {
  const files = await repository.listBachelorFilesInFolderRecursive(userId, folderId);
  for (const file of files) {
    const record = await repository.getBachelorFileWithStorage(userId, file.id);
    if (record) await deleteStoredFile(record.storagePath);
  }
}

export async function bachelorStorageRoutes(app: FastifyInstance, repository: Repository) {
  app.get("/api/education/bachelor/folders", async (request) => {
    const userId = request.user.id;
    const query = request.query as { tree?: string; parentId?: string };
    if (query.tree === "1" || query.tree === "true") {
      return repository.getBachelorFolderTree(userId);
    }
    const parentId = query.parentId === undefined ? undefined : query.parentId === "" ? null : query.parentId;
    return repository.listBachelorFolders(userId, parentId);
  });

  app.post("/api/education/bachelor/folders", async (request) => {
    const userId = request.user.id;
    const body = bachelorFolderSchema.parse(request.body);
    return repository.createBachelorFolder(userId, {
      name: body.name,
      parentId: body.parentId ?? null,
      sortOrder: body.sortOrder
    });
  });

  app.put("/api/education/bachelor/folders/:id", async (request, reply) => {
    const userId = request.user.id;
    const body = bachelorFolderSchema.parse(request.body);
    const result = await repository.updateBachelorFolder(userId, (request.params as { id: string }).id, {
      name: body.name,
      parentId: body.parentId ?? null,
      sortOrder: body.sortOrder
    });
    return result ?? reply.code(404).send({ message: "Mappe ikke funnet." });
  });

  app.delete("/api/education/bachelor/folders/:id", async (request, reply) => {
    const userId = request.user.id;
    const folderId = (request.params as { id: string }).id;
    await deleteFolderFilesFromDisk(repository, userId, folderId);
    const deleted = await repository.deleteBachelorFolder(userId, folderId);
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Mappe ikke funnet." });
  });

  app.get("/api/education/bachelor/files", async (request) => {
    const userId = request.user.id;
    const query = request.query as { folderId?: string };
    const folderId = query.folderId === undefined ? undefined : query.folderId === "" ? null : query.folderId;
    return repository.listBachelorFiles(userId, folderId);
  });

  app.post("/api/education/bachelor/files", async (request, reply) => {
    const userId = request.user.id;
    if (!request.isMultipart()) {
      return reply.code(400).send({ message: "Ingen fil mottatt." });
    }

    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let mimeType = "application/octet-stream";
    let folderIdRaw = "";
    let notes = "";

    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (!fileBuffer) {
          fileBuffer = await buffer(part.file);
          fileName = part.filename;
          mimeType = part.mimetype || mimeType;
        } else {
          part.file.resume();
        }
        continue;
      }
      if (part.type === "field") {
        const value = String(part.value);
        if (part.fieldname === "folderId") folderIdRaw = value;
        if (part.fieldname === "notes") notes = value;
      }
    }

    if (!fileBuffer) return reply.code(400).send({ message: "Ingen fil mottatt." });
    if (fileBuffer.length === 0) return reply.code(400).send({ message: "Filen er tom." });

    const folderId = folderIdRaw.length > 0 ? folderIdRaw : null;
    const originalName = fileName.trim();
    let storagePath: string | null = null;

    try {
      await validateBachelorFileUpload(
        { folderId, originalName },
        {
          folderExists: async (id) => {
            const tree = await repository.getBachelorFolderTree(userId);
            return folderExistsInTree(tree, id);
          }
        }
      );

      const fileId = nanoid();
      storagePath = buildStoragePath(userId, folderId, fileId, originalName);
      const sizeBytes = await writeUploadedFile(storagePath, Readable.from(fileBuffer));
      const created = await repository.createBachelorFile(userId, {
        folderId,
        originalName,
        storagePath,
        mimeType,
        sizeBytes,
        notes,
        sortOrder: 0
      });
      return reply.code(201).send(created);
    } catch (error) {
      if (storagePath) await deleteStoredFile(storagePath);
      if (error instanceof InvalidReferenceError) throw error;
      if (error instanceof BachelorFileUploadError) {
        return reply.code(400).send({ message: error.message });
      }
      return reply.code(400).send({ message: error instanceof Error ? error.message : "Opplasting feilet." });
    }
  });

  app.put("/api/education/bachelor/files/:id", async (request, reply) => {
    const userId = request.user.id;
    const id = (request.params as { id: string }).id;
    const body = bachelorFileUpdateSchema.parse(request.body);
    const existing = await repository.getBachelorFileWithStorage(userId, id);
    if (!existing) return reply.code(404).send({ message: "Fil ikke funnet." });

    const nextFolderId = body.folderId === undefined ? existing.folderId : body.folderId;
    const nextName = body.originalName ?? existing.originalName;
    let storagePath = existing.storagePath;

    if (nextFolderId !== existing.folderId || nextName !== existing.originalName) {
      const nextPath = buildStoragePath(userId, nextFolderId, id, nextName);
      try {
        await ensureDirForFile(nextPath);
        await rename(resolveStoredPath(existing.storagePath), resolveStoredPath(nextPath));
        storagePath = nextPath;
      } catch (error) {
        if (error instanceof InvalidReferenceError) throw error;
        return reply.code(404).send({ message: "Kunne ikke flytte fil på disk." });
      }
    }

    const updated = await repository.updateBachelorFile(userId, id, {
      originalName: body.originalName,
      folderId: body.folderId,
      notes: body.notes,
      sortOrder: body.sortOrder,
      storagePath
    });
    return updated ?? reply.code(404).send({ message: "Fil ikke funnet." });
  });

  app.delete("/api/education/bachelor/files/:id", async (request, reply) => {
    const userId = request.user.id;
    const id = (request.params as { id: string }).id;
    const existing = await repository.getBachelorFileWithStorage(userId, id);
    if (!existing) return reply.code(404).send({ message: "Fil ikke funnet." });
    await deleteStoredFile(existing.storagePath);
    const deleted = await repository.deleteBachelorFile(userId, id);
    return deleted ? reply.code(204).send() : reply.code(404).send({ message: "Fil ikke funnet." });
  });

  app.get("/api/education/bachelor/files/:id/download", async (request, reply) => {
    const userId = request.user.id;
    const id = (request.params as { id: string }).id;
    const record = await repository.getBachelorFileWithStorage(userId, id);
    if (!record) return reply.code(404).send({ message: "Fil ikke funnet." });

    try {
      const absolutePath = resolveStoredPath(record.storagePath);
      return reply
        .header("Content-Type", record.mimeType)
        .header("Content-Disposition", `attachment; filename="${encodeURIComponent(record.originalName)}"`)
        .send(readStoredFile(absolutePath));
    } catch (error) {
      if (error instanceof InvalidReferenceError) throw error;
      return reply.code(404).send({ message: "Filen er ikke tilgjengelig." });
    }
  });
}
