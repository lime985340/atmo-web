<script setup>
const props = defineProps({
  user: {
    type: Object,
    default: null
  },
  providers: {
    type: Array,
    default: () => []
  },
  authLoading: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['login', 'logout'])

const onLogin = (provider) => {
  emit('login', provider)
}

const onLogout = () => {
  emit('logout')
}

const userProviderLabel = (user) => {
  const provider = user?.providerLabel || user?.provider || ''
  if (!provider) return '연동 계정'
  return `${provider} 연동`
}
</script>

<template>
  <header class="topbar">
    <div class="brand">
      <span class="brand__title">ATMO.SCOPE</span>
      <span class="brand__tag">대기 + 날씨 통합 모니터링</span>
    </div>
    <div class="auth">
      <div v-if="props.authLoading" class="auth__pending">
        <span>로그인 상태 확인 중...</span>
      </div>
      <div v-else-if="props.user" class="auth__user">
        <span class="auth__provider">{{ userProviderLabel(props.user) }}</span>
        <span class="auth__name">{{ props.user.displayName || props.user.name || props.user.email || '사용자' }}</span>
        <button class="ghost" @click="onLogout">로그아웃</button>
      </div>
      <div v-else-if="!props.authLoading" class="auth__buttons">
        <button
          v-for="p in props.providers"
          :key="p.key"
          class="pill auth__button"
          :class="`auth__button--${p.theme || p.key}`"
          @click="onLogin(p.key)"
        >
          <span
            class="auth__logo"
            :class="`auth__logo--${p.theme || p.key}`"
            aria-hidden="true"
          ></span>
          <span>{{ p.label }} 로그인</span>
        </button>
      </div>
    </div>
  </header>
</template>
