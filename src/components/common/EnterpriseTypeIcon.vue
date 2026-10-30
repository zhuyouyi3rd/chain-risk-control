<script setup lang="ts">
import { computed } from 'vue'
import {
  Diamond,
  Hexagon,
  Octagon,
  RectangleHorizontal,
  Square,
  Triangle,
} from '@lucide/vue'
import type { EnterpriseType } from '../../core/types'

const props = withDefaults(
  defineProps<{
    type: EnterpriseType
    size?: number
  }>(),
  { size: 14 },
)

const icons = {
  raw_material: Hexagon,
  warehouse: Square,
  workshop: Triangle,
  trading: Diamond,
  service: RectangleHorizontal,
  finance: Octagon,
}

const icon = computed(() => icons[props.type])
</script>

<template>
  <component
    :is="icon"
    :size="size"
    :stroke-width="1.6"
    aria-hidden="true"
  />
</template>
