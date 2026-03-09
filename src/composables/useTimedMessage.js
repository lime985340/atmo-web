import { ref } from 'vue'

export const useTimedMessage = (timeoutMs = 4000) => {
  const message = ref('')

  const setMessage = (nextMessage) => {
    message.value = nextMessage
    if (!nextMessage) return

    setTimeout(() => {
      if (message.value === nextMessage) {
        message.value = ''
      }
    }, timeoutMs)
  }

  return {
    message,
    setMessage
  }
}
