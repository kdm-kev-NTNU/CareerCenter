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
  AiResourceSyncAction,
  AiResourceTargetTool
} from "@careercenter/shared";
import { ref } from "vue";
import { useAppStore } from "../../stores/app.js";
import { useEducationAiResourcesStore } from "../../stores/educationAiResources.js";
import type { AiResourcePayload } from "../../types/index.js";

const appStore = useAppStore();
const store = useEducationAiResourcesStore();
const copiedId = ref("");
const folderInput = ref<HTMLInputElement | null>(null);

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
  cursor: "Cursor",
  codex: "Codex",
  all: "Begge"
};

const syncActionLabels: Record<AiResourceSyncAction, string> = {
  create: "Opprettet",
  update: "Oppdatert",
  noop: "Uendret",
  conflict: "Konflikt"
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

async function pickProjectFolder() {
  const picked = await store.pickProjectFolder();
  if (!picked) folderInput.value?.click();
}

function folderInputChanged(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files?.length) {
    store.setProjectFolderFromFileList(input.files);
  }
  input.value = "";
}

async function copyResource(resource: AiResource) {
  await navigator.clipboard?.writeText(resource.content);
  copiedId.value = resource.id;
  window.setTimeout(() => {
    if (copiedId.value === resource.id) copiedId.value = "";
  }, 1400);
}
</script>

<template>
  <section class="stack ai-resources">
    <p v-if="appStore.isInitializing" class="listing-loading" role="status" aria-live="polite" data-test="ai-resources-loading">
      Laster AI-ressurser…
    </p>

    <p v-if="store.successMessage" class="success-text" role="status" aria-live="polite" data-test="success-message">
      {{ store.successMessage }}
    </p>

    <!-- ===== SYNC PANEL ===== -->
    <article class="panel ai-sync-panel">
      <h2>Skann og synk</h2>
      <p class="muted-hint">Pek til en prosjektmappe. <strong>Skann</strong> leser Cursor/Codex-filer derfra inn i CareerCenter, inkludert skills fra <code>.agent-inventory/skills/</code> etter <code>powershell -File ./scripts/sync-agent-inventory.ps1</code>. <strong>Synk</strong> skriver dem tilbake etter redigering. På hostet app: bruk <strong>Velg mappe</strong> — serveren kan ikke lese stier på din PC. Full sti i feltet fungerer kun når API kjører lokalt (server-scan).</p>

      <div class="sync-simple-grid">
        <label class="sync-folder-field">
          Prosjektmappe
          <div class="sync-folder-row">
            <input v-model="store.syncCwd" placeholder="C:\Users\kevin\Documents\GitHub\MittProsjekt" data-test="sync-cwd" />
            <button type="button" class="secondary" data-test="pick-folder" @click="pickProjectFolder()">
              Velg mappe
            </button>
          </div>
          <input
            ref="folderInput"
            type="file"
            webkitdirectory
            multiple
            hidden
            data-test="folder-input"
            @change="folderInputChanged"
          />
          <small v-if="store.syncFolderLabel" class="field-hint" data-test="sync-folder-label">
            Valgt: {{ store.syncFolderLabel }}
          </small>
        </label>
        <label>
          Target
          <select v-model="store.exportTarget">
            <option v-for="target in aiResourceExportTargets" :key="target" :value="target">{{ exportLabels[target] }}</option>
          </select>
        </label>
      </div>

      <div class="sync-actions-row">
        <button
          type="button"
          class="secondary"
          :class="{ 'is-loading': store.isScanning }"
          :disabled="store.isScanning || store.isSyncing || !store.hasProjectFolder"
          data-test="run-scan"
          @click="store.runScan()"
        >
          {{ store.isScanning ? "Skanner…" : "Skann prosjekt" }}
        </button>
        <button
          type="button"
          class="primary"
          :class="{ 'is-loading': store.isSyncing }"
          :disabled="store.isSyncing || store.isScanning || !store.hasProjectFolder"
          data-test="run-sync"
          @click="store.runSync()"
        >
          {{ store.isSyncing ? "Synkroniserer…" : "Synk til prosjekt" }}
        </button>
        <label class="checkbox-field sync-force-field">
          <input v-model="store.syncForce" type="checkbox" :disabled="store.isSyncing" />
          Force (overskriv konflikter)
        </label>
      </div>

      <p v-if="store.scanError" class="error-text" data-test="scan-error">{{ store.scanError }}</p>
      <p v-if="store.syncError" class="error-text" data-test="sync-error">{{ store.syncError }}</p>

      <div v-if="store.scanResult" class="scan-result" data-test="scan-result">
        <small>Skannet {{ store.scanResult.scanned }} filer — {{ store.scanResult.created.length }} nye · {{ store.scanResult.updated.length }} oppdatert · {{ store.scanResult.rejected.length }} avvist</small>
        <ul v-if="store.scanResult.rejected.length" class="scan-rejected">
          <li v-for="item in store.scanResult.rejected" :key="item.fileName">{{ item.fileName }}: {{ item.message }}</li>
        </ul>
      </div>

      <div v-if="store.syncResult" class="sync-result-list" data-test="sync-result">
        <small>{{ store.syncResult.files.length }} filer → <code>{{ store.syncResult.cwd }}</code></small>
        <ul>
          <li v-for="file in store.syncResult.files" :key="file.path" class="sync-result-item" :class="`sync-action-${file.action}`">
            <span class="sync-action-badge">{{ syncActionLabels[file.action] }}</span>
            <code>{{ file.path }}</code>
            <small v-if="file.message">{{ file.message }}</small>
          </li>
        </ul>
      </div>
    </article>

    <!-- ===== TOOLBAR ===== -->
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

    <!-- ===== RESOURCE LIST ===== -->
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
          <button type="button" class="ghost mini-link" data-test="edit-resource" :disabled="store.isSaving || store.deletingId === resource.id" @click="store.startEdit(resource)">Rediger</button>
          <button type="button" class="ghost mini-link" @click="copyResource(resource)">{{ copiedId === resource.id ? "Kopiert" : "Kopier" }}</button>
          <button type="button" class="ghost mini-link danger" :class="{ 'is-loading': store.deletingId === resource.id }" :disabled="store.deletingId === resource.id || store.isSaving" @click="store.removeResource(resource.id)">
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
              <input :value="frontmatterValue(store.editingResource, 'description')" :disabled="store.isSaving" @input="setFrontmatter(store.editingResource, 'description', ($event.target as HTMLInputElement).value)" />
            </label>
            <label>Globs
              <input :value="frontmatterValue(store.editingResource, 'globs')" :disabled="store.isSaving" @input="setFrontmatter(store.editingResource, 'globs', ($event.target as HTMLInputElement).value)" />
            </label>
            <label class="checkbox-field">
              <input type="checkbox" :checked="frontmatterBoolean(store.editingResource, 'alwaysApply')" :disabled="store.isSaving" @change="setAlwaysApply(store.editingResource, ($event.target as HTMLInputElement).checked)" />
              Always apply
            </label>
          </div>
          <label class="wide-field">Innhold<textarea v-model="store.editingResource.content" :disabled="store.isSaving" /></label>
          <label class="wide-field">Notater<textarea v-model="store.editingResource.notes" :disabled="store.isSaving" /></label>
          <p v-if="store.editError" class="error-text wide-field">{{ store.editError }}</p>
          <div class="actions">
            <button class="primary" type="submit" :class="{ 'is-loading': store.isSaving }" :disabled="store.isSaving">{{ store.isSaving ? "Lagrer…" : "Lagre" }}</button>
            <button class="ghost" type="button" :disabled="store.isSaving" @click="store.cancelEdit()">Avbryt</button>
          </div>
        </form>
      </div>
      <p v-if="!store.filteredResources.length && !appStore.isInitializing">Ingen AI-ressurser funnet. Bruk <strong>Skann prosjekt</strong> for å importere Cursor/Codex-filer.</p>
    </article>

    <!-- ===== ADD MANUALLY (collapsed) ===== -->
    <details class="panel">
      <summary><strong>Legg til manuelt</strong></summary>
      <div class="grid two ai-resource-workbench">
        <form class="form-grid ai-resource-form" @submit.prevent="store.addResource()">
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
          <label class="wide-field">Innhold<textarea v-model="store.newResource.content" placeholder="# Regler eller konfigurasjon" required :disabled="store.isSaving" /></label>
          <p v-if="store.saveError" class="error-text wide-field">{{ store.saveError }}</p>
          <button class="primary wide-field" type="submit" :class="{ 'is-loading': store.isSaving }" :disabled="store.isSaving">
            {{ store.isSaving ? "Legger til…" : "Legg til ressurs" }}
          </button>
        </form>

        <div class="stack">
          <div>
            <h3>Import fra fil</h3>
            <label>Filnavn<input v-model="store.importFileName" placeholder="AGENTS.md" :disabled="store.isImporting" /></label>
            <label>Innhold<textarea v-model="store.importContent" placeholder="Lim inn filinnhold" :disabled="store.isImporting" /></label>
            <div class="actions">
              <button class="primary" type="button" :class="{ 'is-loading': store.isImporting }" :disabled="!store.importContent.trim() || store.isImporting" @click="store.importFromText()">
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
            </div>
          </div>
        </div>
      </div>
    </details>
  </section>
</template>
