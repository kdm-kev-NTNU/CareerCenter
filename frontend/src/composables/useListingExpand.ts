import { ref } from "vue";

export function useListingExpand() {
  const expandedId = ref<string | null>(null);

  function toggleExpand(id: string) {
    expandedId.value = expandedId.value === id ? null : id;
  }

  function isExpanded(id: string) {
    return expandedId.value === id;
  }

  function collapse() {
    expandedId.value = null;
  }

  return { expandedId, toggleExpand, isExpanded, collapse };
}
