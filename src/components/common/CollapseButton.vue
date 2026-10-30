<script setup lang="ts">
import { ChevronDown, ChevronRight } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    collapsed: boolean
    label: string
    controls?: string
  }>(),
  {
    controls: undefined,
  },
)

const emit = defineEmits<{
  toggle: []
}>()

function toggle() {
  emit('toggle')
}
</script>

<template>
  <button
    class="collapse-button"
    :class="{ 'is-collapsed': props.collapsed }"
    type="button"
    :aria-expanded="!props.collapsed"
    :aria-controls="props.controls"
    :aria-label="`${props.collapsed ? '展开' : '收起'}${props.label}`"
    :title="`${props.collapsed ? '展开' : '收起'}${props.label}`"
    @click="toggle"
  >
    <ChevronRight v-if="props.collapsed" :size="14" />
    <ChevronDown v-else :size="14" />
  </button>
</template>

<style scoped>
.collapse-button {
  display: grid;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  padding: 0;
  place-items: center;
  color: #7f898d;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease;
}

.collapse-button:hover {
  color: #d6eef3;
  background: #2b2b2b;
  border-color: #424242;
}

.collapse-button.is-collapsed {
  color: #9fb3b8;
}

.collapse-button.is-collapsed:hover {
  color: #d6eef3;
}

@media (prefers-reduced-motion: reduce) {
  .collapse-button {
    transition: none;
  }
}
</style>
