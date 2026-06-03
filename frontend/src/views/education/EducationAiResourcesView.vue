<script setup lang="ts">
import {
  aiResourceConfigFormats,
  aiResourceExportTargets,
  aiResourceKinds,
  aiResourceStatuses,
  aiResourceTargetTools
} from "@careercenter/shared";
import type {
  AiResource,
  AiResourceConfigFormat,
  AiResourceExportTarget,
  AiResourceKind,
  AiResourceStatus,
  AiResourceTargetTool,
  AiResourceWriteStrategy
} from "@careercenter/shared";
import { ref } from "vue";
import { useEducationAiResourcesStore } from "../../stores/educationAiResources.js";
import type { AiResourcePayload } from "../../types/index.js";

const store = useEducationAiResourcesStore();
const copiedId = ref("");
const copiedCommand = ref(false);

const kindLabels: Record<AiResourceKind, string> = {
  cursor_rule: "Cursor rule",
  cursor_skill: "Cursor skill",
  codex_instruction: "Codex instructions",
  codex_skill: "Codex skill",
  mcp_server: "MCP server",
  prompt_snippet: "Prompt",
  workflow_checklist: "Workflow"
};

const statusLabels: Record<AiResourceStatus, string> = {
  draft: "Utkast",
  active: "Aktiv",
  needs_review: "Må sjekkes",
  archived: "Arkivert"
};

const targetLabels: Record<AiResourceTargetTool, string> = {
  cursor: "Cursor",
  codex: "Codex"
};

const formatLabels: Record<AiResourceConfigFormat, string> = {
  markdown: "Markdown",
  mdc: "MDC",
  json: "JSON",
  toml: "TOML",
  plain: "Plain text"
};

const exportLabels: Record<AiResourceExportTarget, string> = {
  cursor: "Cursor bundle",
  codex: "Codex bundle",
  all: "Begge"
};

const writeStrategyLabels: Record<AiResourceWriteStrategy, string> = {
  replace: "Replace",
  managed_markdown_block: "Managed Markdown",
  json_mcp_merge: "MCP JSON merge",
  toml_managed_block: "Managed TOML"
};

function setFrontmatter(payload: AiResourcePayload, key: "description" | "globs", value: string) {
  payload.frontmatter = { ...payload.frontmatter, [key]: value };
}

function setAlwaysApply(payload: AiResourcePayload, value: boolean) {
  payload.frontmatter = { ...payload.frontmatter, alwaysApply: value };
}

function frontmatterValue(payload: AiResourcePayload, key: "description" | "globs") {
  const value = payload.frontmatter[key];
  return typeof value === "string" ? value : "";
}

function frontmatterBoolean(payload: AiResourcePayload, key: "alwaysApply") {
  return payload.frontmatter[key] === true;
}

function fileInputChanged(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) void store.importFiles(input.files);
  input.value = "";
}

async function copyResource(resource: AiResource) {
  await navigator.clipboard?.writeText(resource.content);
  copiedId.value = resource.id;
  window.setTimeout(() => {
    if (copiedId.value === resource.id) copiedId.value = "";
  }, 1400);
}

async function copySyncCommand() {
  await navigator.clipboard?.writeText(store.syncCommand);
  copiedCommand.value = true;
  window.setTimeout(() => {
    copiedCommand.value = false;
  }, 1400);
}
</script>

<template>
  <section class="stack ai-resources">
    <article class="panel ai-resource-toolbar">
      <label>Søk<input v-model="store.search" placeholder="Tailwind, AGENTS, mcp..." /></label>
      <label>Verktøy
        <select v-model="store.filterTarget">
          <option value="all">Alle</option>
          <option v-for="target in aiResourceTargetTools" :key="target" :value="target">{{ targetLabels[target] }}</option>
        </select>
      </label>
      <label>Type
        <select v-model="store.filterKind">
          <option value="all">Alle</option>
          <option v-for="kind in aiResourceKinds" :key="kind" :value="kind">{{ kindLabels[kind] }}</option>
        </select>
      </label>
      <label>Status
        <select v-model="store.filterStatus">
          <option value="all">Alle</option>
          <option v-for="status in aiResourceStatuses" :key="status" :value="status">{{ statusLabels[status] }}</option>
        </select>
      </label>
    </article>

    <article class="panel ai-sync-panel">
      <div class="panel-header-row">
        <div>
          <h2>Auto-load / Sync</h2>
          <p class="muted-hint">CareerCenter DB er master. CLI-et henter eksporten og skriver Cursor/Codex-filene i prosjektet du peker på.</p>
        </div>
        <button type="button" class="secondary" @click="copySyncCommand">{{ copiedCommand ? "Kopiert" : "Kopier sync-kommando" }}</button>
      </div>
      <div class="ai-sync-grid">
        <label>Target
          <select v-model="store.exportTarget">
            <option v-for="target in aiResourceExportTargets" :key="target" :value="target">{{ exportLabels[target] }}</option>
          </select>
        </label>
        <label>CLI script<input v-model="store.syncScriptPath" placeholder="scripts/ai-resource-sync.mjs" /></label>
        <label>API URL<input v-model="store.syncApiUrl" placeholder="http://127.0.0.1:3000" /></label>
        <label>Prosjektmappe<input v-model="store.syncCwd" placeholder="." /></label>
      </div>
      <pre class="sync-command" data-test="sync-command">{{ store.syncCommand }}</pre>
      <p class="muted-hint">Uten <code>--yes</code> kjører scriptet dry-run. Med <code>--yes</code> skriver det filer, tar backup og oppdaterer <code>.careercenter/ai-sync.json</code>.</p>
    </article>

    <div class="grid two ai-resource-workbench">
      <form class="panel form-grid ai-resource-form" @submit.prevent="store.addResource()">
        <h2 class="wide-field">Ny AI-ressurs</h2>
        <label>Navn<input v-model="store.newResource.name" placeholder="Tailwind component rules" required /></label>
        <label>Type
          <select v-model="store.newResource.kind">
            <option v-for="kind in aiResourceKinds" :key="kind" :value="kind">{{ kindLabels[kind] }}</option>
          </select>
        </label>
        <label>Status
          <select v-model="store.newResource.status">
            <option v-for="status in aiResourceStatuses" :key="status" :value="status">{{ statusLabels[status] }}</option>
          </select>
        </label>
        <label>Format
          <select v-model="store.newResource.configFormat">
            <option v-for="format in aiResourceConfigFormats" :key="format" :value="format">{{ formatLabels[format] }}</option>
          </select>
        </label>
        <fieldset class="target-field wide-field">
          <legend>Verktøy</legend>
          <label v-for="target in aiResourceTargetTools" :key="target" class="checkbox-inline">
            <input v-model="store.newResource.targetTools" type="checkbox" :value="target" />
            {{ targetLabels[target] }}
          </label>
        </fieldset>
        <label>Install path<input v-model="store.newResource.installPath" placeholder=".cursor/rules/tailwind.mdc" /></label>
        <label>Tags<input v-model="store.tagInput" placeholder="cursor, rules, tailwind" /></label>
        <div v-if="store.newResource.kind === 'cursor_rule' && store.newResource.configFormat === 'mdc'" class="frontmatter-grid wide-field">
          <label>Description
            <input
              :value="frontmatterValue(store.newResource, 'description')"
              @input="setFrontmatter(store.newResource, 'description', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label>Globs
            <input
              :value="frontmatterValue(store.newResource, 'globs')"
              @input="setFrontmatter(store.newResource, 'globs', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="checkbox-field">
            <input
              type="checkbox"
              :checked="frontmatterBoolean(store.newResource, 'alwaysApply')"
              @change="setAlwaysApply(store.newResource, ($event.target as HTMLInputElement).checked)"
            />
            Always apply
          </label>
        </div>
        <label class="wide-field">Innhold<textarea v-model="store.newResource.content" placeholder="# Regler eller konfigurasjon" required /></label>
        <label class="wide-field">Notater<textarea v-model="store.newResource.notes" placeholder="Hvor den brukes, sync-notater, begrensninger" /></label>
        <button class="primary" type="submit">Legg til ressurs</button>
      </form>

      <div class="stack">
        <article class="panel ai-import-panel">
          <h2>Import</h2>
          <label>Filnavn<input v-model="store.importFileName" placeholder="AGENTS.md" /></label>
          <label>Innhold<textarea v-model="store.importContent" placeholder="Lim inn filinnhold" /></label>
          <div class="actions">
            <button class="primary" type="button" :disabled="!store.importContent.trim()" @click="store.importFromText()">Importer tekst</button>
            <label class="secondary file-picker">
              Velg filer
              <input type="file" multiple hidden @change="fileInputChanged" />
            </label>
          </div>
          <p v-if="store.importError" class="error-text">{{ store.importError }}</p>
          <div v-if="store.importResult" class="import-result">
            <small>{{ store.importResult.created.length }} opprettet · {{ store.importResult.updated.length }} oppdatert · {{ store.importResult.rejected.length }} avvist</small>
            <ul v-if="store.importResult.rejected.length">
              <li v-for="item in store.importResult.rejected" :key="item.fileName">{{ item.fileName }}: {{ item.message }}</li>
            </ul>
          </div>
        </article>

        <article class="panel ai-export-panel">
          <h2>Eksport</h2>
          <div class="export-row">
            <label>Bundle
              <select v-model="store.exportTarget">
                <option v-for="target in aiResourceExportTargets" :key="target" :value="target">{{ exportLabels[target] }}</option>
              </select>
            </label>
            <button class="primary" type="button" @click="store.exportResources()">Bygg eksport</button>
          </div>
          <p v-if="store.exportError" class="error-text">{{ store.exportError }}</p>
          <div v-if="store.exportBundle" class="export-files">
            <div v-for="file in store.exportBundle.files" :key="file.path" class="export-file">
              <div class="export-file-heading">
                <strong>{{ file.path }}</strong>
                <span class="status-badge">{{ writeStrategyLabels[file.writeStrategy] }}</span>
              </div>
              <small>{{ file.resourceNames.join(", ") }}</small>
              <pre>{{ file.content }}</pre>
            </div>
            <p v-if="!store.exportBundle.files.length">Ingen filer i eksporten.</p>
          </div>
        </article>
      </div>
    </div>

    <article class="panel">
      <div class="panel-header-row">
        <h2>AI-ressurser</h2>
        <small>{{ store.filteredResources.length }} av {{ store.resources.length }}</small>
      </div>
      <div v-for="resource in store.filteredResources" :key="resource.id" class="ai-resource-card">
        <div class="ai-resource-main">
          <div class="ai-resource-title-row">
            <strong>{{ resource.name }}</strong>
            <span class="status-badge accent">{{ statusLabels[resource.status] }}</span>
          </div>
          <small>{{ kindLabels[resource.kind] }} · {{ resource.targetTools.map((target) => targetLabels[target]).join(" + ") }}</small>
          <p v-if="resource.installPath" class="mono-line">{{ resource.installPath }}</p>
          <div class="chip-group" v-if="resource.tags.length">
            <span v-for="tag in resource.tags" :key="tag" class="chip readonly">{{ tag }}</span>
          </div>
          <p v-if="resource.notes">{{ resource.notes }}</p>
        </div>
        <div class="actions column">
          <button type="button" class="ghost mini-link" @click="store.startEdit(resource)">Rediger</button>
          <button type="button" class="ghost mini-link" @click="copyResource(resource)">{{ copiedId === resource.id ? "Kopiert" : "Kopier" }}</button>
          <button type="button" class="ghost mini-link danger" @click="store.removeResource(resource.id)">Slett</button>
        </div>

        <form v-if="store.editingId === resource.id && store.editingResource" class="ai-edit-form" @submit.prevent="store.saveEdit()">
          <label>Navn<input v-model="store.editingResource.name" required /></label>
          <label>Type
            <select v-model="store.editingResource.kind">
              <option v-for="kind in aiResourceKinds" :key="kind" :value="kind">{{ kindLabels[kind] }}</option>
            </select>
          </label>
          <label>Status
            <select v-model="store.editingResource.status">
              <option v-for="status in aiResourceStatuses" :key="status" :value="status">{{ statusLabels[status] }}</option>
            </select>
          </label>
          <label>Format
            <select v-model="store.editingResource.configFormat">
              <option v-for="format in aiResourceConfigFormats" :key="format" :value="format">{{ formatLabels[format] }}</option>
            </select>
          </label>
          <fieldset class="target-field wide-field">
            <legend>Verktøy</legend>
            <label v-for="target in aiResourceTargetTools" :key="target" class="checkbox-inline">
              <input v-model="store.editingResource.targetTools" type="checkbox" :value="target" />
              {{ targetLabels[target] }}
            </label>
          </fieldset>
          <label>Install path<input v-model="store.editingResource.installPath" /></label>
          <label>Tags<input v-model="store.editingTagInput" placeholder="legg til tags" /></label>
          <div v-if="store.editingResource.kind === 'cursor_rule' && store.editingResource.configFormat === 'mdc'" class="frontmatter-grid wide-field">
            <label>Description
              <input
                :value="frontmatterValue(store.editingResource, 'description')"
                @input="setFrontmatter(store.editingResource, 'description', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label>Globs
              <input
                :value="frontmatterValue(store.editingResource, 'globs')"
                @input="setFrontmatter(store.editingResource, 'globs', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="checkbox-field">
              <input
                type="checkbox"
                :checked="frontmatterBoolean(store.editingResource, 'alwaysApply')"
                @change="setAlwaysApply(store.editingResource, ($event.target as HTMLInputElement).checked)"
              />
              Always apply
            </label>
          </div>
          <label class="wide-field">Innhold<textarea v-model="store.editingResource.content" /></label>
          <label class="wide-field">Notater<textarea v-model="store.editingResource.notes" /></label>
          <div class="actions">
            <button class="primary" type="submit">Lagre</button>
            <button class="ghost" type="button" @click="store.cancelEdit()">Avbryt</button>
          </div>
        </form>
      </div>
      <p v-if="!store.filteredResources.length">Ingen AI-ressurser funnet.</p>
    </article>
  </section>
</template>
