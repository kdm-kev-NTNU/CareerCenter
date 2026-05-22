<script setup lang="ts">
import type { BachelorFolderTreeNode } from "@careercenter/shared";
import { useEducationBachelorStore } from "../../stores/educationBachelor.js";

defineProps<{
  folder: BachelorFolderTreeNode;
  depth?: number;
}>();

const store = useEducationBachelorStore();

function onRename(folder: BachelorFolderTreeNode) {
  const name = window.prompt("Nytt mappenavn", folder.name);
  if (name?.trim()) void store.renameFolder(folder.id, name.trim());
}

function onDelete(folder: BachelorFolderTreeNode) {
  if (window.confirm(`Slette mappen «${folder.name}» og alt innhold?`)) void store.deleteFolder(folder.id);
}
</script>

<template>
  <li class="folder-tree-item" :style="{ paddingLeft: `${(depth ?? 0) * 12}px` }">
    <div class="folder-tree-row" :class="{ active: store.currentFolderId === folder.id }">
      <button
        v-if="folder.children.length"
        type="button"
        class="folder-toggle mini"
        :aria-expanded="store.expandedFolderIds.has(folder.id)"
        @click.stop="store.toggleFolderExpanded(folder.id)"
      >
        {{ store.expandedFolderIds.has(folder.id) ? "−" : "+" }}
      </button>
      <span v-else class="folder-toggle-spacer" />
      <button type="button" class="folder-label" @click="store.navigateToFolder(folder.id)">
        {{ folder.name }}
      </button>
      <div class="folder-actions">
        <button type="button" class="mini" title="Gi nytt navn" @click.stop="onRename(folder)">✎</button>
        <button type="button" class="mini danger" title="Slett mappe" @click.stop="onDelete(folder)">×</button>
      </div>
    </div>
    <ul v-if="folder.children.length && store.expandedFolderIds.has(folder.id)" class="folder-tree-children">
      <BachelorFolderTreeItem
        v-for="child in folder.children"
        :key="child.id"
        :folder="child"
        :depth="(depth ?? 0) + 1"
      />
    </ul>
  </li>
</template>
