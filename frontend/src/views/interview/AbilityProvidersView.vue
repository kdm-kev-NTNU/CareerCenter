<script setup lang="ts">
import { RouterLink } from "vue-router";
import PageHeader from "../../components/ui/PageHeader.vue";
import { abilityProviders } from "../../components/interview/ability/abilityProviders.js";
</script>

<template>
  <section class="stack">
    <PageHeader
      title="Evnetester"
      lead="Øvingsoppgaver gruppert per testaktør. Åpne en mappe for guide, tips og tester."
    />

    <div class="module-grid">
      <RouterLink
        v-for="provider in abilityProviders"
        :key="provider.id"
        :to="`/interview/evnetester/${provider.id}`"
        class="module-card"
      >
        <strong>{{ provider.name }}</strong>
        <span>{{ provider.shortDescription }}</span>
      </RouterLink>
    </div>
  </section>
</template>
