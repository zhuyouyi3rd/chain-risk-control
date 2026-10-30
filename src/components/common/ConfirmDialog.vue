<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { AlertTriangle } from '@lucide/vue'

const props = withDefaults(
  defineProps<{
    open: boolean
    title: string
    description: string
    confirmLabel?: string
    cancelLabel?: string
  }>(),
  {
    confirmLabel: '确认',
    cancelLabel: '取消',
  },
)

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const cancelButton = ref<HTMLButtonElement | null>(null)

function handleKeydown(event: KeyboardEvent) {
  if (props.open && event.key === 'Escape') emit('cancel')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    cancelButton.value?.focus()
  },
)

onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="open"
        class="confirm-backdrop"
        @click.self="emit('cancel')"
      >
        <div
          class="confirm-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-description"
        >
          <div class="confirm-dialog__icon" aria-hidden="true">
            <AlertTriangle :size="18" />
          </div>
          <div class="confirm-dialog__copy">
            <h2 id="confirm-dialog-title">{{ title }}</h2>
            <p id="confirm-dialog-description">{{ description }}</p>
          </div>
          <div class="confirm-dialog__actions">
            <button
              ref="cancelButton"
              class="confirm-dialog__cancel"
              type="button"
              @click="emit('cancel')"
            >
              {{ cancelLabel }}
            </button>
            <button
              class="confirm-dialog__confirm"
              type="button"
              @click="emit('confirm')"
            >
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.confirm-backdrop {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  padding: 20px;
  place-items: center;
  background: rgba(0, 0, 0, 0.62);
  backdrop-filter: blur(4px);
}

.confirm-dialog {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  width: min(390px, 100%);
  padding: 16px;
  gap: 12px;
  background: #252525;
  border: 1px solid #444444;
  border-radius: 8px;
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.62);
}

.confirm-dialog__icon {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  color: #ef8b8b;
  background: rgba(183, 28, 28, 0.12);
  border: 1px solid rgba(229, 57, 53, 0.28);
  border-radius: 50%;
}

.confirm-dialog__copy h2 {
  margin: 2px 0 6px;
  color: #e4e6e7;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}

.confirm-dialog__copy p {
  margin: 0;
  color: #9ca4a7;
  font-size: 10px;
  line-height: 1.65;
}

.confirm-dialog__actions {
  display: flex;
  grid-column: 1 / -1;
  justify-content: flex-end;
  margin-top: 4px;
  gap: 7px;
}

.confirm-dialog__cancel,
.confirm-dialog__confirm {
  height: 30px;
  padding: 0 13px;
  font-size: 9.5px;
  border-radius: 4px;
  cursor: pointer;
}

.confirm-dialog__cancel {
  color: #b4bbbe;
  background: #292929;
  border: 1px solid #444444;
}

.confirm-dialog__cancel:hover {
  color: #e4e6e7;
  background: #313131;
}

.confirm-dialog__confirm {
  color: #ffe8e8;
  background: rgba(183, 28, 28, 0.28);
  border: 1px solid rgba(229, 57, 53, 0.48);
}

.confirm-dialog__confirm:hover {
  background: rgba(183, 28, 28, 0.42);
  border-color: rgba(229, 57, 53, 0.7);
}

.confirm-dialog-enter-active,
.confirm-dialog-leave-active {
  transition: opacity 160ms ease;
}

.confirm-dialog-enter-active .confirm-dialog,
.confirm-dialog-leave-active .confirm-dialog {
  transition: transform 160ms ease;
}

.confirm-dialog-enter-from,
.confirm-dialog-leave-to {
  opacity: 0;
}

.confirm-dialog-enter-from .confirm-dialog,
.confirm-dialog-leave-to .confirm-dialog {
  transform: translateY(8px) scale(0.985);
}

@media (prefers-reduced-motion: reduce) {
  .confirm-dialog-enter-active,
  .confirm-dialog-leave-active,
  .confirm-dialog-enter-active .confirm-dialog,
  .confirm-dialog-leave-active .confirm-dialog {
    transition: none;
  }
}
</style>
