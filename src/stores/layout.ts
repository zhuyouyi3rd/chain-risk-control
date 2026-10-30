import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

export type ViewMode = '2d' | '3d'
export type RelationLayer = 'material' | 'capital' | 'tech' | 'guarantee'

export const DEFAULT_LAYER_VISIBILITY: Record<RelationLayer, boolean> = {
  material: true,
  capital: true,
  tech: true,
  guarantee: true,
}

export const useLayoutStore = defineStore('layout', () => {
  const leftOpen = ref(true)
  const rightOpen = ref(true)
  const viewMode = ref<ViewMode>('2d')
  const layerVisibility = ref<Record<RelationLayer, boolean>>({
    ...DEFAULT_LAYER_VISIBILITY,
  })
  const enterpriseCollapsed = ref(false)
  const resultCollapsed = ref(false)
  const riskSourceCollapsed = ref(false)

  const allOpen = computed(() => leftOpen.value && rightOpen.value)

  function toggleLeft() {
    leftOpen.value = !leftOpen.value
  }

  function toggleRight() {
    rightOpen.value = !rightOpen.value
  }

  function toggleAll() {
    const next = !allOpen.value
    leftOpen.value = next
    rightOpen.value = next
  }

  function openLeft() {
    leftOpen.value = true
  }

  function closeLeft() {
    leftOpen.value = false
  }

  function openRight() {
    rightOpen.value = true
  }

  function closeRight() {
    rightOpen.value = false
  }

  function toggleEnterpriseSection() {
    enterpriseCollapsed.value = !enterpriseCollapsed.value
  }

  function toggleResultSection() {
    resultCollapsed.value = !resultCollapsed.value
  }

  function toggleRiskSourceSection() {
    riskSourceCollapsed.value = !riskSourceCollapsed.value
  }

  function setViewMode(mode: ViewMode) {
    viewMode.value = mode
  }

  function toggleLayer(layer: RelationLayer) {
    layerVisibility.value = {
      ...layerVisibility.value,
      [layer]: !layerVisibility.value[layer],
    }
  }

  function setLayerVisible(layer: RelationLayer, visible: boolean) {
    layerVisibility.value = {
      ...layerVisibility.value,
      [layer]: visible,
    }
  }

  return {
    leftOpen,
    rightOpen,
    viewMode,
    layerVisibility,
    enterpriseCollapsed,
    resultCollapsed,
    riskSourceCollapsed,
    allOpen,
    toggleLeft,
    toggleRight,
    toggleAll,
    openLeft,
    closeLeft,
    openRight,
    closeRight,
    toggleEnterpriseSection,
    toggleResultSection,
    toggleRiskSourceSection,
    setViewMode,
    toggleLayer,
    setLayerVisible,
  }
})
