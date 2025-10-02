<template>
  <svg class="icon" :class="className" viewBox="0 0 24 24">
    <path :d="iconPaths[name]" />
  </svg>
</template>

<script setup lang="ts">
interface Props {
  name: 'menu' | 'plus' | 'expand' | 'close' | 'delete' | 'check' | 'edit'
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  className: ''
})

const iconPaths = {
  menu: "M3 6h18v2H3V6m0 5h18v2H3v-2m0 5h18v2H3v-2z",
  plus: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  expand: "M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z",
  close: "M15.41 16.59 L10.83 12 15.41 7.41 14 6 l-6 6 6 6 1.41-1.41z",
  delete: "M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z",
  check: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z",
  edit: "M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
}
</script>

<style scoped>
.icon {
  width: 16px;
  height: 16px;
  fill: currentColor;
  transition: transform 0.2s ease;
}

.icon.expand {
  transform: rotate(0deg);
}

.icon.expand.expanded {
  transform: rotate(90deg);
}
</style>