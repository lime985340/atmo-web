import { reactive } from 'vue'

export const createFavoriteAddState = () => {
  return reactive({
    open: false,
    busy: false,
    address: '',
    name: '',
    coords: null
  })
}

export const createFavoriteAddActions = ({
  state,
  isAuthenticated,
  pickPostcodeAddress,
  geocodeAddress,
  apiFetch,
  loadFavorites,
  setFavoritesMessage
}) => {
  const closeFavoriteAdd = () => {
    state.open = false
    state.busy = false
    state.address = ''
    state.name = ''
    state.coords = null
  }

  const openFavoriteAdd = async () => {
    if (!isAuthenticated.value) {
      setFavoritesMessage('로그인 후 이용 가능한 서비스입니다.')
      return
    }

    try {
      const picked = await pickPostcodeAddress()
      const coords = await geocodeAddress(picked.address)
      state.address = picked.address
      state.name = (picked.buildingName || picked.bname || picked.address).trim()
      state.coords = coords
      state.open = true
    } catch (err) {
      const message = err instanceof Error ? err.message : '주소 검색을 완료하지 못했습니다.'
      setFavoritesMessage(message)
    }
  }

  const submitFavoriteAdd = async () => {
    if (state.busy) return
    if (!state.coords) {
      setFavoritesMessage('주소 좌표를 확인할 수 없습니다.')
      return
    }

    const description = String(state.name || '').trim() || state.address
    if (!description) {
      setFavoritesMessage('즐겨찾기 이름을 입력해 주세요.')
      return
    }

    state.busy = true
    try {
      await apiFetch('/favorites', {
        method: 'POST',
        body: JSON.stringify({
          description,
          lat: state.coords.lat,
          lng: state.coords.lng,
          address: state.address
        })
      })
      closeFavoriteAdd()
      await loadFavorites()
    } catch (err) {
      const message = err instanceof Error ? err.message : '즐겨찾기 추가에 실패했습니다.'
      setFavoritesMessage(message)
    } finally {
      state.busy = false
    }
  }

  return {
    openFavoriteAdd,
    closeFavoriteAdd,
    submitFavoriteAdd
  }
}
