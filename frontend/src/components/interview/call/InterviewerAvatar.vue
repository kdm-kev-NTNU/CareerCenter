<script setup lang="ts">
withDefaults(
  defineProps<{
    speaking?: boolean;
    listening?: boolean;
    name?: string;
  }>(),
  {
    speaking: false,
    listening: false,
    name: "Intervjuer"
  }
);
</script>

<template>
  <div
    class="interviewer-avatar"
    :class="{
      'interviewer-avatar--speaking': speaking,
      'interviewer-avatar--listening': listening && !speaking
    }"
    role="img"
    :aria-label="speaking ? `${name} snakker` : listening ? `${name} lytter` : name"
  >
    <svg
      class="interviewer-avatar__svg"
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <!-- Shoulders / jacket -->
      <path d="M28 240 C28 184 72 160 120 160 C168 160 212 184 212 240 Z" fill="#2b4a6f" />
      <!-- Shirt collar -->
      <path d="M98 161 L120 204 L142 161 Z" fill="#f3f4f6" />
      <!-- Tie -->
      <path d="M114 172 L120 204 L126 172 L120 166 Z" fill="#1f7a5c" />
      <!-- Neck -->
      <rect x="107" y="126" width="26" height="40" rx="10" fill="#d39f78" />
      <!-- Ears -->
      <ellipse cx="78" cy="104" rx="7" ry="11" fill="#e0ad83" />
      <ellipse cx="162" cy="104" rx="7" ry="11" fill="#e0ad83" />
      <!-- Head -->
      <ellipse cx="120" cy="100" rx="42" ry="48" fill="#e8b98f" />
      <!-- Hair -->
      <path
        d="M77 96 C72 54 102 38 124 40 C152 42 170 60 164 98 C158 78 142 66 120 68 C98 70 84 80 77 96 Z"
        fill="#3b2a20"
      />
      <!-- Brows (lifted when listening) -->
      <path
        class="brow brow--left"
        d="M96 91 Q104 88 112 91"
        stroke="#3b2a20"
        stroke-width="3"
        stroke-linecap="round"
      />
      <path
        class="brow brow--right"
        d="M128 91 Q136 88 144 91"
        stroke="#3b2a20"
        stroke-width="3"
        stroke-linecap="round"
      />
      <!-- Eyes -->
      <circle cx="104" cy="102" r="4" fill="#1f2937" />
      <circle cx="136" cy="102" r="4" fill="#1f2937" />
      <!-- Nose -->
      <path
        d="M120 106 Q115 117 122 119"
        stroke="#c48c66"
        stroke-width="2.5"
        stroke-linecap="round"
      />
      <!-- Mouth: idle / listening smile -->
      <path
        v-if="!speaking"
        class="mouth mouth--closed"
        :d="listening ? 'M105 127 Q120 140 135 127' : 'M108 129 Q120 135 132 129'"
        stroke="#9b4a3c"
        stroke-width="3"
        stroke-linecap="round"
        fill="none"
      />
      <!-- Mouth: speaking (animated) -->
      <g v-else class="mouth mouth--open">
        <ellipse class="mouth__oval" cx="120" cy="131" rx="10" ry="7" fill="#7a2e28" />
        <path
          d="M112 128 Q120 126 128 128"
          stroke="#f3f4f6"
          stroke-width="2"
          stroke-linecap="round"
        />
      </g>
    </svg>
  </div>
</template>

<style scoped>
.interviewer-avatar {
  display: flex;
  align-items: flex-end;
  justify-content: center;
  width: min(100%, 420px);
  aspect-ratio: 1;
}

.interviewer-avatar__svg {
  width: 100%;
  height: 100%;
}

.interviewer-avatar--listening .brow--left {
  transform: translateY(-3px) rotate(-4deg);
  transform-origin: 104px 90px;
}

.interviewer-avatar--listening .brow--right {
  transform: translateY(-3px) rotate(4deg);
  transform-origin: 136px 90px;
}

.interviewer-avatar--speaking .mouth__oval {
  animation: mouth-talk 0.45s ease-in-out infinite alternate;
  transform-origin: 120px 131px;
}

@keyframes mouth-talk {
  from {
    transform: scaleY(0.55);
  }
  to {
    transform: scaleY(1.15);
  }
}

@media (prefers-reduced-motion: reduce) {
  .interviewer-avatar--speaking .mouth__oval {
    animation: none;
  }
}
</style>
