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
import { computed, ref } from "vue";
import { useAppStore } from "../../stores/app.js";
import { useEducationAiResourcesStore } from "../../stores/educationAiResources.js";
import type { AiResourcePayload } from "../../types/index.js";

const appStore = useAppStore();
const store = useEducationAiResourcesStore();
const copiedId = ref("");
const copiedCommand = ref(false);
const copiedDryRun = ref(false);

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

const connectionStatusClass = computed(() => {
  if (store.syncConnectionStatus === "ok") return "connection-ok";
  if (store.syncConnectionStatus === "error") return "connection-error";
  return "";
});

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

async function copyText(text: string, which: "apply" | "dry-run") {
  await navigator.clipboard?.writeText(text);
  if (which === "apply") {
    copiedCommand.value = true;
    window.setTimeout(() => {
      copiedCommand.value = false;
    }, 1400);
  } else {
    copiedDryRun.value = true;
    window.setTimeout(() => {
      copiedDryRun.value = false;
    }, 1400);
  }
}
</script>

<template>
  <section class="stack ai-resources">
    <p
      v-if="appStore.isInitializing"
      class="listing-loading"
      role="status"
      aria-live="polite"
      data-test="ai-resources-loading"
    >
      Laster AI-ressurser…
    </p>

    <p v-if="store.successMessage" class="success-text" role="status" aria-live="polite" data-test="success-message">
      {{ store.successMessage }}
    </p>

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
          <p class="muted-hint">
            CareerCenter-databasen er master. Du lagrer ressurser her, og CLI-et henter en eksport og skriver filer i prosjektet du peker på.
          </p>
        </div>
      </div>

      <ol class="sync-steps" aria-label="Slik synkroniserer du">
        <li>
          <strong>1. Konfigurer</strong>
          <span>Velg target, API-URL og prosjektmappe under.</span>
        </li>
        <li>
          <strong>2. Test og forhåndsvis</strong>
          <span>Test at API-et svarer. Kjør dry-run i terminal (uten <code>--yes</code>) for å se hva som endres.</span>
        </li>
        <li>
          <strong>3. Skriv til disk</strong>
          <span>Kjør med <code>--yes</code> for å skrive filer, ta backup og oppdatere <code>.careercenter/ai-sync.json</code>.</span>
        </li>
      </ol>

      <div class="ai-sync-grid">
        <label>
          Target
          <select v-model="store.exportTarget">
            <option v-for="target in aiResourceExportTargets" :key="target" :value="target">{{ exportLabels[target] }}</option>
          </select>
          <span class="field-hint">Hvilke verktøy som får filer i eksporten (Cursor, Codex eller begge).</span>
        </label>
        <label>
          CLI script
          <input v-model="store.syncScriptPath" placeholder="scripts/ai-resource-sync.mjs" />
          <span class="field-hint">Sti til sync-scriptet fra repo-roten der du kjører kommandoen.</span>
        </label>
        <label>
          API URL
          <input v-model="store.syncApiUrl" placeholder="http://127.0.0.1:3000" />
          <span class="field-hint">Adressen til CareerCenter-backend (samme som du bruker i nettleseren).</span>
        </label>
        <label>
          Prosjektmappe
          <input v-model="store.syncCwd" placeholder="." />
          <span class="field-hint">Mappen CLI-et skriver i (<code>--cwd</code>). Bruk <code>.</code> for nåværende mappe.</span>
        </label>
      </div>

      <div class="sync-connection-row">
        <button
          type="button"
          class="secondary"
          :class="{ 'is-loading': store.syncConnectionStatus === 'checking' }"
          :disabled="store.syncConnectionStatus === 'checking'"
          data-test="test-sync-connection"
          @click="store.testSyncConnection()"
        >
          {{ store.syncConnectionStatus === "checking" ? "Tester…" : "Test tilkobling" }}
        </button>
        <p
          v-if="store.syncConnectionMessage"
          class="sync-connection-message"
          :class="connectionStatusClass"
          role="status"
          data-test="sync-connection-message"
        >
          {{ store.syncConnectionMessage }}
        </p>
      </div>

      <div class="sync-command-block">
        <div class="sync-command-header">
          <div>
            <strong>Skriv til disk</strong>
            <span class="field-hint">Med <code>--yes</code> — overskriver kun filer CareerCenter allerede eier (med backup).</span>
          </div>
          <button
            type="button"
            class="secondary"
            data-test="copy-sync-command"
            @click="copyText(store.syncCommand, 'apply')"
          >
            {{ copiedCommand ? "Kopiert" : "Kopier" }}
          </button>
        </div>
        <pre class="sync-command" data-test="sync-command">{{ store.syncCommand }}</pre>
      </div>

      <div class="sync-command-block sync-command-block-muted">
        <div class="sync-command-header">
          <div>
            <strong>Dry-run (forhåndsvis)</strong>
            <span class="field-hint">Uten <code>--yes</code> — viser CREATE/UPDATE/CONFLICT uten å skrive filer.</span>
          </div>
          <button type="button" class="ghost" data-test="copy-dry-run-command" @click="copyText(store.syncDryRunCommand, 'dry-run')">
            {{ copiedDryRun ? "Kopiert" : "Kopier dry-run" }}
          </button>
        </div>
        <pre class="sync-command sync-command-dry" data-test="sync-dry-run-command">{{ store.syncDryRunCommand }}</pre>
      </div>

      <details class="sync-flags-help">
        <summary>Hva betyr flaggene?</summary>
        <ul>
          <li><code>--api-url</code> — hvor CLI-et henter eksporten fra</li>
          <li><code>--target</code> — <code>cursor</code>, <code>codex</code> eller <code>all</code></li>
          <li><code>--cwd</code> — prosjektmappen filer skrives i</li>
          <li><code>--yes</code> — skriv endringer (ellers kun dry-run)</li>
          <li><code>--force</code> — overskriv konflikter (valgfritt)</li>
        </ul>
      </details>
    </article>

    <div class="grid two ai-resource-workbench">
      <form class="panel form-grid ai-resource-form" @submit.prevent="store.addResource()">
        <h2 class="wide-field">Ny AI-ressurs</h2>
        <label>Navn<input v-model="store.newResource.name" placeholder="Tailwind component rules" required :disabled="store.isSaving" /></label>
        <label>Type
          <select v-model="store.newResource.kind" :disabled="store.isSaving">
            <option v-for="kind in aiResourceKinds" :key="kind" :value="kind">{{ kindLabels[kind] }}</option>
          </select>
        </label>
        <label>Status
          <select v-model="store.newResource.status" :disabled="store.isSaving">
            <option v-for="status in aiResourceStatuses" :key="status" :value="status">{{ statusLabels[status] }}</option>
          </select>
        </label>
        <label>Format
          <select v-model="store.newResource.configFormat" :disabled="store.isSaving">
            <option v-for="format in aiResourceConfigFormats" :key="format" :value="format">{{ formatLabels[format] }}</option>
          </select>
        </label>
        <fieldset class="target-field wide-field">
          <legend>Verktøy</legend>
          <label v-for="target in aiResourceTargetTools" :key="target" class="checkbox-inline">
            <input v-model="store.newResource.targetTools" type="checkbox" :value="target" :disabled="store.isSaving" />
            {{ targetLabels[target] }}
          </label>
        </fieldset>
        <label>Install path<input v-model="store.newResource.installPath" placeholder=".cursor/rules/tailwind.mdc" :disabled="store.isSaving" /></label>
        <label>Tags<input v-model="store.tagInput" placeholder="cursor, rules, tailwind" :disabled="store.isSaving" /></label>
        <div v-if="store.newResource.kind === 'cursor_rule' && store.newResource.configFormat === 'mdc'" class="frontmatter-grid wide-field">
          <label>Description
            <input
              :value="frontmatterValue(store.newResource, 'description')"
              :disabled="store.isSaving"
              @input="setFrontmatter(store.newResource, 'description', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label>Globs
            <input
              :value="frontmatterValue(store.newResource, 'globs')"
              :disabled="store.isSaving"
              @input="setFrontmatter(store.newResource, 'globs', ($event.target as HTMLInputElement).value)"
            />
          </label>
          <label class="checkbox-field">
            <input
              type="checkbox"
              :checked="frontmatterBoolean(store.newResource, 'alwaysApply')"
              :disabled="store.isSaving"
              @change="setAlwaysApply(store.newResource, ($event.target as HTMLInputElement).checked)"
            />
            Always apply
          </label>
        </div>
        <label class="wide-field">Innhold<textarea v-model="store.newResource.content" placeholder="# Regler eller konfigurasjon" required :disabled="store.isSaving" /></label>
        <label class="wide-field">Notater<textarea v-model="store.newResource.notes" placeholder="Hvor den brukes, sync-notater, begrensninger" :disabled="store.isSaving" /></label>
        <p v-if="store.saveError" class="error-text wide-field">{{ store.saveError }}</p>
        <button class="primary wide-field" type="submit" :class="{ 'is-loading': store.isSaving }" :disabled="store.isSaving">
          {{ store.isSaving ? "Legger til…" : "Legg til ressurs" }}
        </button>
      </form>

      <div class="stack">
        <article class="panel ai-import-panel">
          <h2>Import</h2>
          <p class="muted-hint">Lim inn eller last opp filer fra prosjektet — de lagres i CareerCenter (motsatt retning av sync).</p>
          <label>Filnavn<input v-model="store.importFileName" placeholder="AGENTS.md" :disabled="store.isImporting" /></label>
          <label>Innhold<textarea v-model="store.importContent" placeholder="Lim inn filinnhold" :disabled="store.isImporting" /></label>
          <div class="actions">
            <button
              class="primary"
              type="button"
              :class="{ 'is-loading': store.isImporting }"
              :disabled="!store.importContent.trim() || store.isImporting"
              @click="store.importFromText()"
            >
              {{ store.isImporting ? "Importerer…" : "Importer tekst" }}
            </button>
            <label class="secondary file-picker" :class="{ 'is-loading': store.isImporting }">
              {{ store.isImporting ? "Importerer…" : "Velg filer" }}
              <input type="file" multiple hidden :disabled="store.isImporting" @change="fileInputChanged" />
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
          <p class="muted-hint">Forhåndsvis hva CLI-et henter fra databasen (samme som sync-eksporten).</p>
          <div class="export-row">
            <label>Bundle
              <select v-model="store.exportTarget" :disabled="store.isExporting">
                <option v-for="target in aiResourceExportTargets" :key="target" :value="target">{{ exportLabels[target] }}</option>
              </select>
            </label>
            <button
              class="primary"
              type="button"
              :class="{ 'is-loading': store.isExporting }"
              :disabled="store.isExporting"
              @click="store.exportResources()"
            >
              {{ store.isExporting ? "Bygger…" : "Bygg eksport" }}
            </button>
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
      <p v-if="store.deleteError" class="error-text">{{ store.deleteError }}</p>
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
          <button
            type="button"
            class="ghost mini-link"
            data-test="edit-resource"
            :disabled="store.isSaving || store.deletingId === resource.id"
            @click="store.startEdit(resource)"
          >
            Rediger
          </button>
          <button type="button" class="ghost mini-link" @click="copyResource(resource)">{{ copiedId === resource.id ? "Kopiert" : "Kopier" }}</button>
          <button
            type="button"
            class="ghost mini-link danger"
            :class="{ 'is-loading': store.deletingId === resource.id }"
            :disabled="store.deletingId === resource.id || store.isSaving"
            @click="store.removeResource(resource.id)"
          >
            {{ store.deletingId === resource.id ? "Sletter…" : "Slett" }}
          </button>
        </div>

        <form v-if="store.editingId === resource.id && store.editingResource" class="ai-edit-form" data-test="edit-resource-form" @submit.prevent="store.saveEdit()">
          <label>Navn<input v-model="store.editingResource.name" required :disabled="store.isSaving" /></label>
          <label>Type
            <select v-model="store.editingResource.kind" :disabled="store.isSaving">
              <option v-for="kind in aiResourceKinds" :key="kind" :value="kind">{{ kindLabels[kind] }}</option>
            </select>
          </label>
          <label>Status
            <select v-model="store.editingResource.status" :disabled="store.isSaving">
              <option v-for="status in aiResourceStatuses" :key="status" :value="status">{{ statusLabels[status] }}</option>
            </select>
          </label>
          <label>Format
            <select v-model="store.editingResource.configFormat" :disabled="store.isSaving">
              <option v-for="format in aiResourceConfigFormats" :key="format" :value="format">{{ formatLabels[format] }}</option>
            </select>
          </label>
          <fieldset class="target-field wide-field">
            <legend>Verktøy</legend>
            <label v-for="target in aiResourceTargetTools" :key="target" class="checkbox-inline">
              <input v-model="store.editingResource.targetTools" type="checkbox" :value="target" :disabled="store.isSaving" />
              {{ targetLabels[target] }}
            </label>
          </fieldset>
          <label>Install path<input v-model="store.editingResource.installPath" :disabled="store.isSaving" /></label>
          <label>Tags<input v-model="store.editingTagInput" placeholder="legg til tags" :disabled="store.isSaving" /></label>
          <div v-if="store.editingResource.kind === 'cursor_rule' && store.editingResource.configFormat === 'mdc'" class="frontmatter-grid wide-field">
            <label>Description
              <input
                :value="frontmatterValue(store.editingResource, 'description')"
                :disabled="store.isSaving"
                @input="setFrontmatter(store.editingResource, 'description', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label>Globs
              <input
                :value="frontmatterValue(store.editingResource, 'globs')"
                :disabled="store.isSaving"
                @input="setFrontmatter(store.editingResource, 'globs', ($event.target as HTMLInputElement).value)"
              />
            </label>
            <label class="checkbox-field">
              <input
                type="checkbox"
                :checked="frontmatterBoolean(store.editingResource, 'alwaysApply')"
                :disabled="store.isSaving"
                @change="setAlwaysApply(store.editingResource, ($event.target as HTMLInputElement).checked)"
              />
              Always apply
            </label>
          </div>
          <label class="wide-field">Innhold<textarea v-model="store.editingResource.content" :disabled="store.isSaving" /></label>
          <label class="wide-field">Notater<textarea v-model="store.editingResource.notes" :disabled="store.isSaving" /></label>
          <p v-if="store.editError" class="error-text wide-field">{{ store.editError }}</p>
          <div class="actions">
            <button class="primary" type="submit" :class="{ 'is-loading': store.isSaving }" :disabled="store.isSaving">
              {{ store.isSaving ? "Lagrer…" : "Lagre" }}
            </button>
            <button class="ghost" type="button" :disabled="store.isSaving" @click="store.cancelEdit()">Avbryt</button>
          </div>
        </form>
      </div>
      <p v-if="!store.filteredResources.length && !appStore.isInitializing">Ingen AI-ressurser funnet.</p>
    </article>
  </section>
</template>
