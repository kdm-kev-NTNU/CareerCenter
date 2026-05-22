<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import BoardPalette from "../components/board/BoardPalette.vue";
import CareerBoardCanvas from "../components/board/CareerBoardCanvas.vue";
import { useBoardStore } from "../stores/board.js";

const boardStore = useBoardStore();
const newBoardName = ref("Plan B");
const activeBoardName = ref("");

onMounted(() => {
  void boardStore.loadBoards();
});

watch(
  () => boardStore.activeBoard?.name,
  (name) => {
    activeBoardName.value = name ?? "";
  },
  { immediate: true }
);

async function handleCreateBoard() {
  const name = newBoardName.value.trim();
  if (!name) return;
  await boardStore.createBoard(name);
  newBoardName.value = "Plan B";
}

function commitBoardRename() {
  void boardStore.renameActiveBoard(activeBoardName.value);
}
</script>

<template>
  <section class="board-shell">
    <header class="board-toolbar panel">
      <div class="board-toolbar-left">
        <label>
          Brett
          <select
            :value="boardStore.activeBoard?.id ?? ''"
            :disabled="boardStore.summaries.length === 0"
            @change="boardStore.selectBoard(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="board in boardStore.summaries" :key="board.id" :value="board.id">
              {{ board.name }}{{ board.isDefault ? " (standard)" : "" }}
            </option>
          </select>
        </label>
        <label v-if="boardStore.activeBoard">
          Navn
          <input
            v-model="activeBoardName"
            class="board-name-input"
            placeholder="Brettnavn"
            @keydown.enter="commitBoardRename"
            @blur="commitBoardRename"
          />
        </label>
        <input v-model="newBoardName" placeholder="Nytt brett" />
        <button type="button" class="secondary" @click="handleCreateBoard">+ Brett</button>
        <button type="button" class="secondary" :disabled="!boardStore.activeBoard" @click="boardStore.duplicateActiveBoard()">
          Dupliser
        </button>
        <button
          type="button"
          class="primary"
          :disabled="!boardStore.activeBoard || boardStore.saveState === 'saving'"
          @click="boardStore.saveNow(activeBoardName)"
        >
          Lagre brett
        </button>
        <button type="button" class="ghost" :disabled="!boardStore.activeBoard || boardStore.summaries.length <= 1" @click="boardStore.deleteActiveBoard()">
          Slett brett
        </button>
      </div>
      <div class="board-toolbar-right">
        <small v-if="boardStore.saveState === 'saving'">Lagrer …</small>
        <small v-else-if="boardStore.saveState === 'saved'">Lagret</small>
        <small v-else>Klar</small>
      </div>
    </header>

    <div class="board-layout">
      <BoardPalette />
      <CareerBoardCanvas v-if="boardStore.activeBoard" />
      <div v-else class="board-empty panel">Laster karrierebrett …</div>
    </div>
  </section>
</template>
