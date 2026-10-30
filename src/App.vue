<script setup lang="ts">
import { ChevronLeft, ChevronRight } from '@lucide/vue'
import AppTopBar from './components/AppTopBar.vue'
import EnterpriseDetailDrawer from './components/detail/EnterpriseDetailDrawer.vue'
import LeftSidebar from './components/LeftSidebar.vue'
import ModelCanvas from './components/ModelCanvas.vue'
import RightSidebar from './components/RightSidebar.vue'
import { useLayoutStore } from './stores/layout'

const layout = useLayoutStore()
</script>

<template>
  <div
    class="app-shell"
    :class="{
      'is-left-collapsed': !layout.leftOpen,
      'is-right-collapsed': !layout.rightOpen,
    }"
  >
    <AppTopBar />

    <main class="stage">
      <aside class="side side--left" aria-label="左侧功能区">
        <LeftSidebar v-if="layout.leftOpen" />
        <button
          v-else
          class="edge-rail edge-rail--left"
          type="button"
          title="展开左侧功能区"
          aria-label="展开左侧功能区：企业列表与结果展示"
          @click="layout.openLeft()"
        >
          <span class="edge-rail__accent" aria-hidden="true"></span>
          <ChevronRight :size="14" aria-hidden="true" />
          <span class="edge-rail__text" aria-hidden="true">企业列表</span>
        </button>
      </aside>

      <ModelCanvas />

      <aside class="side side--right" aria-label="右侧功能区">
        <RightSidebar v-if="layout.rightOpen" />
        <button
          v-else
          class="edge-rail edge-rail--right"
          type="button"
          title="展开右侧功能区"
          aria-label="展开右侧功能区：文档输入、手动输入与风险源控制"
          @click="layout.openRight()"
        >
          <span class="edge-rail__accent" aria-hidden="true"></span>
          <ChevronLeft :size="14" aria-hidden="true" />
          <span class="edge-rail__text" aria-hidden="true">数据输入</span>
        </button>
      </aside>
    </main>

    <EnterpriseDetailDrawer />
  </div>
</template>

<style scoped>
.app-shell {
  --left-col: var(--left-open-width);
  --right-col: var(--right-open-width);

  display: grid;
  grid-template-rows: var(--topbar-height) minmax(0, 1fr);
  width: 100%;
  height: 100dvh;
  overflow: hidden;
  background: #000000;
}

.app-shell.is-left-collapsed {
  --left-col: var(--rail-width);
}

.app-shell.is-right-collapsed {
  --right-col: var(--rail-width);
}

.stage {
  display: grid;
  grid-template-columns: var(--left-col) minmax(0, 1fr) var(--right-col);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #000000;
  transition: grid-template-columns 280ms cubic-bezier(0.22, 0.72, 0.24, 1);
}

.side {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: #000000;
}

.side--left {
  border-right: 1px solid transparent;
}

.side--right {
  border-left: 1px solid transparent;
}

.edge-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: 0;
  gap: 10px;
  color: #788085;
  background: #000000;
  border: 0;
  cursor: pointer;
  transition:
    color 160ms ease,
    background 160ms ease;
}

.side--left .edge-rail {
  border-right: 1px solid #252525;
}

.side--right .edge-rail {
  border-left: 1px solid #252525;
}

.edge-rail:hover {
  color: var(--accent);
  background: #000000;
}

.edge-rail__accent {
  width: 2px;
  height: 28px;
  background: var(--accent);
  border-radius: 999px;
  box-shadow: 0 0 10px rgba(130, 201, 224, 0.36);
}

.edge-rail__text {
  color: #646c70;
  font-size: 9px;
  letter-spacing: 0.14em;
  writing-mode: vertical-rl;
  transition: color 160ms ease;
}

.edge-rail:hover .edge-rail__text {
  color: #9ab8c1;
}

@media (prefers-reduced-motion: reduce) {
  .stage {
    transition: none;
  }
}
</style>
