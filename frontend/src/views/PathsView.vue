<script setup lang="ts">
import { ref } from "vue";
import type { CareerPath } from "@careercenter/shared";
import CompanyExplorer from "../components/companies/CompanyExplorer.vue";
import { usePathsStore } from "../stores/paths.js";

const pathsStore = usePathsStore();
const editingPathId = ref<string | null>(null);
const editingPathName = ref("");

function startRename(path: CareerPath) {
  editingPathId.value = path.id;
  editingPathName.value = path.name;
}

function cancelRename() {
  editingPathId.value = null;
  editingPathName.value = "";
}

async function saveRename(pathId: string) {
  await pathsStore.renamePath(pathId, editingPathName.value);
  cancelRename();
}
</script>

<template>
  <section class="stack">
    <CompanyExplorer />
    <section class="stack">
      <article class="panel" v-for="path in pathsStore.paths" :key="path.id">
        <div class="path-header">
          <div>
            <template v-if="editingPathId === path.id">
              <input v-model="editingPathName" class="inline-title" @keydown.enter="saveRename(path.id)" />
              <div class="actions">
                <button type="button" class="primary" @click="saveRename(path.id)">Lagre</button>
                <button type="button" class="ghost" @click="cancelRename">Avbryt</button>
              </div>
            </template>
            <template v-else>
              <h2>{{ path.name }}</h2>
              <p>{{ path.description }}</p>
              <small>{{ path.targetRole }} - {{ path.horizon }}</small>
            </template>
          </div>
          <div v-if="editingPathId !== path.id" class="actions">
            <button type="button" class="secondary" @click="startRename(path)">Rediger navn</button>
            <button type="button" class="secondary" @click="pathsStore.duplicatePath(path)">Dupliser</button>
            <button type="button" class="ghost danger" @click="pathsStore.removePath(path.id)">Slett</button>
          </div>
        </div>
        <div class="path-line saved">
          <span>NTNU KI</span>
          <span v-for="step in path.steps" :key="step.id">{{ step.company?.name ?? step.companyId }}</span>
        </div>
      </article>
    </section>
  </section>
</template>
