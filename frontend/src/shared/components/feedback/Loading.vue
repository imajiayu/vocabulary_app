<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center">
      <div class="loading-spinner" style="width: 3rem; height: 3rem; margin: 0 auto 1rem;"></div>
      <p class="text-secondary">{{ text }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  text?: string
}

const props = withDefaults(defineProps<Props>(), {
  text: '加载中...'
})
</script>
