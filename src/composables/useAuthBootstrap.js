const readTokenFromHash = () => {
  const hasAccessTokenInHash = window.location.hash.includes('access_token=')
  if (!hasAccessTokenInHash) return ''

  const hash = new URLSearchParams(window.location.hash.replace('#', ''))
  const token = hash.get('access_token')
  if (!token) return ''

  window.history.replaceState({}, document.title, window.location.pathname)
  return token
}

const loadUserFromCurrentToken = async ({ loadMe, user }) => {
  await loadMe()
  return Boolean(user.value)
}

export const runAuthBootstrap = async ({
  accessToken,
  user,
  setAuthLoading,
  isJwtExpiredOrNearExpiry,
  refreshAccessToken,
  loadMe,
  loadFavorites,
  openAuthCheckingModal,
  closeAuthModal,
  setGlobalMessage
}) => {
  try {
    const tokenFromHash = readTokenFromHash()
    if (tokenFromHash) {
      accessToken.value = tokenFromHash
      try {
        localStorage.setItem('accessToken', tokenFromHash)
      } catch {
        // Keep in-memory token when storage is unavailable.
      }
      openAuthCheckingModal()
    }

    if (!accessToken.value || isJwtExpiredOrNearExpiry(accessToken.value)) {
      await refreshAccessToken()
    }

    if (!accessToken.value) {
      user.value = null
      return
    }

    const hasUser = await loadUserFromCurrentToken({
      loadMe,
      user
    })

    if (!hasUser) {
      user.value = null
      return
    }

    await loadFavorites()
  } catch (err) {
    const message = err instanceof Error ? err.message : '로그인 정보를 확인하는 중 오류가 발생했습니다.'
    setGlobalMessage(message)
  } finally {
    setAuthLoading(false)
    closeAuthModal()
  }
}
