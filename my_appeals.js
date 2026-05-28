;(() => {
  const token = localStorage.getItem('token')
  const SIDEBAR_STORAGE_KEY = 'ecosignalSidebarExpanded'

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const statsGrid = document.getElementById('statsGrid')
  const appealsGrid = document.getElementById('appealsGrid')
  const appealsSection = document.getElementById('appealsSection')
  const workspace = document.querySelector('.admin-workspace')
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileButton = document.getElementById('sidebarProfileButton')
  const sidebarProfileName = document.querySelector('.sidebar-profile-name')
  const sidebarProfileLevel = document.querySelector('.sidebar-profile-level')

  const modal = document.getElementById('appealModal')
  const modalClose = document.getElementById('appealModalClose')
  const modalCancel = document.getElementById('appealModalCancel')
  const modalSave = document.getElementById('appealModalSave')
  const modalTitle = document.getElementById('appealModalTitle')
  const modalCategory = document.getElementById('appealModalCategory')
  const modalSubcategory = document.getElementById('appealModalSubcategory')
  const modalUser = document.getElementById('appealModalUser')
  const modalImages = document.getElementById('appealModalImages')
  const modalCarousel = document.getElementById('appealModalCarousel')
  const modalCarouselWrap = document.getElementById('appealModalCarouselWrap')
  const modalCarouselPrev = document.getElementById('appealModalCarouselPrev')
  const modalCarouselNext = document.getElementById('appealModalCarouselNext')
  const modalDescription = document.getElementById('appealModalDescription')
  const modalStatus = document.getElementById('appealModalStatus')
  const modalOrganization = document.getElementById('appealModalOrganization')
  const modalFilial = document.getElementById('appealModalFilial')
  const modalResponsible = document.getElementById('appealModalResponsible')
  const modalAssignmentNote = document.getElementById('appealModalAssignmentNote')
  const modalPriorityRadios = document.querySelectorAll('input[name="appealModalPriority"]')
  const modalAgency = document.getElementById('appealModalAgency')
  const modalAgencyTrigger = document.getElementById('appealModalAgencyTrigger')
  const modalAgencyList = document.getElementById('appealModalAgencyList')
  const modalAgencyDisplay = document.getElementById('appealModalAgencyDisplay')
  const modalAgencyWrap = document.getElementById('appealModalAgencyWrap')

  const photoLightbox = document.getElementById('photoLightbox')
  const photoLightboxBackdrop = document.getElementById('photoLightboxBackdrop')
  const photoLightboxClose = document.getElementById('photoLightboxClose')
  const photoLightboxPrev = document.getElementById('photoLightboxPrev')
  const photoLightboxNext = document.getElementById('photoLightboxNext')
  const photoLightboxImg = document.getElementById('photoLightboxImg')
  const photoLightboxCounter = document.getElementById('photoLightboxCounter')
  const photoLightboxStage = document.querySelector('.photo-lightbox__stage')
  const profileModal = document.getElementById('profileModal')
  const profileModalBackdrop = document.getElementById('profileModalBackdrop')
  const profileModalClose = document.getElementById('profileModalClose')
  const profileModalCancel = document.getElementById('profileModalCancel')
  const profileModalForm = document.getElementById('profileModalForm')
  const profileModalAvatar = document.getElementById('profileModalAvatar')
  const profileModalMessage = document.getElementById('profileModalMessage')
  const profileFullName = document.getElementById('profileFullName')
  const profileEmail = document.getElementById('profileEmail')
  const profileAbout = document.getElementById('profileAbout')
  const profileRole = document.getElementById('profileRole')
  const profileCreatedAt = document.getElementById('profileCreatedAt')
  const profileModalSave = document.getElementById('profileModalSave')

  const modalMessage = document.getElementById('appealModalMessage')
  const chatDrawer = document.getElementById('appealChat')
  const chatTitle = document.getElementById('appealChatTitle')
  const chatEmpty = document.getElementById('appealChatEmpty')
  const chatList = document.getElementById('appealChatList')
  const chatComposer = document.getElementById('appealChatComposer')
  const chatInput = document.getElementById('appealChatInput')
  const chatSend = document.getElementById('appealChatSend')
  const chatState = {
    busy: false,
    unavailable: false,
  }

  const MODAL_PHOTO_SIZE = 180
  const LIGHTBOX_PLACEHOLDER_SIZE = 960

  /** Базовая ширина карточки: min(400px, 25vw); минимум колонки 330px */
  const APPEAL_CARD_MIN_PX = 330
  const APPEAL_CARD_BASE_CAP_PX = 400
  const APPEAL_CARD_BASE_VW_RATIO = 0.25
  let appealsGridLayoutFrame = 0
  let appealsGridTemplate = ''

  const PHOTO_PALETTE = [
    ['#f4dca1', '#d3bd8a'],
    ['#bfd7bf', '#97b798'],
    ['#b6d4dd', '#8db5c0'],
    ['#e5d0bc', '#c9aa90'],
    ['#d3c8f1', '#b0a0df'],
    ['#f1c8cd', '#e3a8b1'],
  ]

  const STATUS_LABELS = {
    pending: 'Ожидает',
    confirmed: 'Принята',
    in_progress: 'В работе',
    resolved: 'Закрыта',
    rejected: 'Отклонена',
  }

  const state = {
    appealsById: new Map(),
    currentAppealId: null,
    detailRequestId: 0,
  }

  const lightboxState = {
    urls: [],
    index: 0,
  }

  let currentUser = null
  let agencyDropdownOpen = false
  let lightboxTouchStartX = 0
  let profileModalCloseTimer = 0
  const PROFILE_MODAL_CLOSE_DELAY = 95
  function toDataUrl(svgMarkup) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`
  }

  function getInitials(fullName) {
    const parts = String(fullName || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
    return parts.map(part => part[0]).join('').toUpperCase() || 'A'
  }

  function getUserDisplayName(user) {
    if (!user || typeof user !== 'object') return 'Пользователь'
    const combined = `${user.first_name || ''} ${user.last_name || ''}`.trim()
    if (combined) return combined
    if (user.name) return String(user.name)
    if (user.email) return String(user.email)
    return 'Пользователь'
  }

  function getUserRoleLabel(role) {
    const normalized = String(role || '').toLowerCase()
    if (normalized === 'citizen' || normalized === 'user') return 'Пользователь'
    if (normalized === 'agency') return 'Агент'
    return 'Пользователь'
  }

  function getToneBySeed(seedValue) {
    const seed = Math.abs(Number(seedValue) || 0)
    const pair = PHOTO_PALETTE[seed % PHOTO_PALETTE.length]
    return pair[1]
  }

  function createAvatarUrl(name, seedValue) {
    const initials = getInitials(name)
    const tone = getToneBySeed(seedValue)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44">
      <rect width="44" height="44" rx="8" fill="${tone}"/>
      <text x="22" y="27" text-anchor="middle" font-size="14" font-family="Roboto Flex, sans-serif" fill="#1c1c1b">${initials}</text>
    </svg>`
    return toDataUrl(svg)
  }

  function createMiniPhotoUrl(label, index, size = 44, radius = 8) {
    const palette = PHOTO_PALETTE[index % PHOTO_PALETTE.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="100%" stop-color="${palette[1]}"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
      <circle cx="${Math.round(size * 0.32)}" cy="${Math.round(size * 0.34)}" r="${Math.round(size * 0.09)}" fill="rgba(20,20,19,0.18)"/>
      <path d="M${Math.round(size * 0.14)} ${Math.round(size * 0.82)}L${Math.round(size * 0.36)} ${Math.round(size * 0.55)}L${Math.round(size * 0.5)} ${Math.round(size * 0.68)}L${Math.round(size * 0.68)} ${Math.round(size * 0.45)}L${Math.round(size * 0.86)} ${Math.round(size * 0.82)}Z" fill="rgba(20,20,19,0.22)"/>
      <text x="${Math.round(size / 2)}" y="${Math.round(size * 0.92)}" text-anchor="middle" font-size="${Math.max(10, Math.round(size * 0.16))}" font-family="Roboto Flex, sans-serif" fill="rgba(20,20,19,0.45)">${label}</text>
    </svg>`
    return toDataUrl(svg)
  }

  function getSelectedPriorityValue() {
    const selected = Array.from(modalPriorityRadios).find(input => input.checked)
    if (!selected) return NaN
    return Number(selected.value)
  }

  function setSelectedPriorityValue(value) {
    const targetValue = String(Number.isFinite(value) ? value : 0)
    let wasSet = false
    modalPriorityRadios.forEach(input => {
      const checked = input.value === targetValue
      input.checked = checked
      if (checked) wasSet = true
    })

    if (!wasSet && modalPriorityRadios[0]) {
      modalPriorityRadios[0].checked = true
    }
  }

  function setAgencyDropdownOpen(open) {
    agencyDropdownOpen = open
    if (modalAgencyList) modalAgencyList.hidden = !open
    if (modalAgencyTrigger) modalAgencyTrigger.setAttribute('aria-expanded', String(open))
    if (modalAgencyWrap) modalAgencyWrap.classList.toggle('appeal-modal__select-wrap--open', open)
  }

  function syncAgencyDisplayFromSelect() {
    if (!modalAgency || !modalAgencyDisplay) return
    const opt = modalAgency.selectedOptions[0]
    modalAgencyDisplay.textContent = opt ? opt.textContent : 'Выберите орган'
  }

  function closeAgencyDropdown() {
    setAgencyDropdownOpen(false)
  }

  function toggleAgencyDropdown() {
    setAgencyDropdownOpen(!agencyDropdownOpen)
  }

  function setupAgencyCustomSelect() {
    if (!modalAgency || !modalAgencyList || !modalAgencyTrigger) return

    modalAgencyList.textContent = ''
    Array.from(modalAgency.options).forEach((option, index) => {
      const item = document.createElement('li')
      item.className = 'appeal-modal__select-option'
      item.setAttribute('role', 'option')
      item.dataset.value = option.value
      item.id = `appealModalAgencyOpt_${index}`
      item.textContent = option.textContent
      item.addEventListener('click', () => {
        modalAgency.selectedIndex = index
        modalAgency.dispatchEvent(new Event('change', { bubbles: true }))
        syncAgencyDisplayFromSelect()
        closeAgencyDropdown()
      })
      modalAgencyList.append(item)
    })

    modalAgencyTrigger.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      toggleAgencyDropdown()
    })

    document.addEventListener('click', () => closeAgencyDropdown())

    modalAgencyWrap?.addEventListener('click', event => event.stopPropagation())

    syncAgencyDisplayFromSelect()
  }

  function updateLightboxView() {
    const urls = lightboxState.urls
    const index = lightboxState.index
    if (!photoLightboxImg || !urls.length) return
    const currentUrl = urls[index]
    const isPlaceholder = currentUrl.startsWith('data:image/svg+xml')
    photoLightboxStage?.classList.toggle('photo-lightbox__stage--placeholder', isPlaceholder)
    if (photoLightboxStage) {
      photoLightboxStage.style.backgroundImage = isPlaceholder ? `url("${currentUrl}")` : 'none'
    }
    photoLightboxImg.hidden = isPlaceholder
    if (!isPlaceholder) {
      photoLightboxImg.src = currentUrl
    } else {
      photoLightboxImg.removeAttribute('src')
    }
    photoLightboxImg.alt = `Фото ${index + 1} из ${urls.length}`
    if (photoLightboxCounter) {
      photoLightboxCounter.textContent = urls.length > 1 ? `${index + 1} / ${urls.length}` : ''
    }
    const multi = urls.length > 1
    if (photoLightboxPrev) photoLightboxPrev.hidden = !multi
    if (photoLightboxNext) photoLightboxNext.hidden = !multi
  }

  function openPhotoLightbox(urls, startIndex = 0) {
    const list = (Array.isArray(urls) ? urls : []).filter(Boolean)
    if (!list.length || !photoLightbox) return
    lightboxState.urls = list
    lightboxState.index = Math.max(0, Math.min(Number(startIndex) || 0, list.length - 1))
    photoLightbox.hidden = false
    updateLightboxView()
  }

  function closePhotoLightbox() {
    if (!photoLightbox) return
    photoLightbox.hidden = true
    lightboxState.urls = []
    lightboxState.index = 0
    if (photoLightboxImg) photoLightboxImg.removeAttribute('src')
    if (photoLightboxImg) photoLightboxImg.hidden = false
    photoLightboxStage?.classList.remove('photo-lightbox__stage--placeholder')
    if (photoLightboxStage) {
      photoLightboxStage.style.backgroundImage = 'none'
    }
  }

  function setProfileModalMessage(text, isError = false) {
    if (!profileModalMessage) return
    profileModalMessage.textContent = text
    profileModalMessage.classList.toggle('error', isError)
  }

  function fillProfileModal(user) {
    const profile = user && typeof user === 'object' ? user : {}
    const displayName = getUserDisplayName(profile)
    if (profileModalAvatar) profileModalAvatar.textContent = getInitials(displayName)
    if (profileFullName) profileFullName.value = displayName === 'Пользователь' ? '' : displayName
    if (profileEmail) profileEmail.value = String(profile.email || '').trim()
    if (profileAbout) profileAbout.value = String(profile.about || '').trim()
    if (profileRole) profileRole.textContent = getUserRoleLabel(profile.role)
    if (profileCreatedAt) profileCreatedAt.textContent = formatDate(profile.created_at)
  }

  function openProfileModal() {
    if (!profileModal) return
    if (profileModalCloseTimer) {
      window.clearTimeout(profileModalCloseTimer)
      profileModalCloseTimer = 0
    }
    fillProfileModal(currentUser)
    setProfileModalMessage('')
    profileModal.hidden = false
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      profileModal.classList.add('profile-modal--open')
      profileFullName?.focus()
    })
  }

  function closeProfileModal() {
    if (!profileModal) return
    profileModal.classList.remove('profile-modal--open')
    document.body.style.overflow = ''
    if (profileModalCloseTimer) {
      window.clearTimeout(profileModalCloseTimer)
    }
    profileModalCloseTimer = window.setTimeout(() => {
      finalizeProfileModalClose()
      profileModalCloseTimer = 0
    }, PROFILE_MODAL_CLOSE_DELAY)
  }

  function finalizeProfileModalClose() {
    if (!profileModal) return
    if (!profileModal.classList.contains('profile-modal--open')) {
      profileModal.hidden = true
      setProfileModalMessage('')
    }
  }

  async function saveProfile() {
    const payload = {
      fullname: String(profileFullName?.value || '').trim(),
      email: String(profileEmail?.value || '').trim(),
      about: String(profileAbout?.value || '').trim(),
    }

    setProfileModalMessage('')
    if (profileModalSave) profileModalSave.disabled = true

    try {
      const response = await fetch('backend/update_profile.php', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.message || 'Не удалось сохранить профиль')
      }

      currentUser = data?.user || currentUser
      try {
        localStorage.setItem('user', JSON.stringify(currentUser))
      } catch (_error) {
        // no-op
      }
      setupProfileBadge(currentUser)
      fillProfileModal(currentUser)
      setProfileModalMessage(data?.message || 'Профиль обновлен')
    } catch (error) {
      setProfileModalMessage(error?.message || 'Не удалось сохранить профиль', true)
    } finally {
      if (profileModalSave) profileModalSave.disabled = false
    }
  }

  function lightboxStep(delta) {
    const n = lightboxState.urls.length
    if (n <= 1) return
    lightboxState.index = (lightboxState.index + delta + n) % n
    updateLightboxView()
  }

  function setupPhotoLightbox() {
    photoLightboxClose?.addEventListener('click', closePhotoLightbox)
    photoLightboxBackdrop?.addEventListener('click', closePhotoLightbox)
    photoLightboxPrev?.addEventListener('click', () => lightboxStep(-1))
    photoLightboxNext?.addEventListener('click', () => lightboxStep(1))

    photoLightboxStage?.addEventListener(
      'touchstart',
      event => {
        if (event.touches.length !== 1) return
        lightboxTouchStartX = event.touches[0].clientX
      },
      { passive: true }
    )

    photoLightboxStage?.addEventListener(
      'touchend',
      event => {
        if (!event.changedTouches.length) return
        const dx = event.changedTouches[0].clientX - lightboxTouchStartX
        if (dx > 50) lightboxStep(-1)
        else if (dx < -50) lightboxStep(1)
      },
      { passive: true }
    )

    document.addEventListener('keydown', event => {
      if (!photoLightbox || photoLightbox.hidden) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        closePhotoLightbox()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        lightboxStep(-1)
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        lightboxStep(1)
      }
    })
  }

  function setupProfileModal() {
    sidebarProfileButton?.addEventListener('click', openProfileModal)
    profileModalBackdrop?.addEventListener('click', closeProfileModal)
    profileModalClose?.addEventListener('click', closeProfileModal)
    profileModalCancel?.addEventListener('click', closeProfileModal)
    profileModalForm?.addEventListener('submit', event => {
      event.preventDefault()
      saveProfile()
    })
  }

  function createStatCard(stat) {
    const card = document.createElement('article')
    card.className = 'stat-card'
    card.dataset.metric = stat.key

    const fieldset = document.createElement('fieldset')
    fieldset.className = 'stat-card__field'

    const legend = document.createElement('legend')
    legend.className = 'stat-card__legend'
    legend.textContent = stat.label

    const value = document.createElement('p')
    value.className = 'stat-card__value'
    value.textContent = String(stat.value)

    fieldset.append(legend, value)
    card.append(fieldset)
    return card
  }

  function createAppealCard(appeal) {
    const card = document.createElement('article')
    card.className = 'appeal-card'
    card.dataset.appealId = String(appeal.id)
    const appealStatus = String(appeal.status || 'pending')
    card.dataset.status = appealStatus
    const statusBorderMap = {
      confirmed: 'appeal-card--status-confirmed',
      in_progress: 'appeal-card--status-in-progress',
      resolved: 'appeal-card--status-resolved',
      rejected: 'appeal-card--status-rejected',
    }
    const statusClass = statusBorderMap[appealStatus]
    if (statusClass) card.classList.add(statusClass)

    const topRow = document.createElement('div')
    topRow.className = 'appeal-card__top'

    const userRow = document.createElement('div')
    userRow.className = 'appeal-card__user'

    const fallbackUserName = getUserDisplayName(currentUser)
    const userNameText = String(appeal.user?.name || fallbackUserName)
    const userLevelValue = Number(appeal.user?.level ?? currentUser?.score ?? 0)
    const userIdValue = Number(appeal.user?.id ?? currentUser?.id ?? 0)

    const avatar = document.createElement('img')
    avatar.className = 'appeal-card__avatar'
    avatar.width = 44
    avatar.height = 44
    avatar.alt = 'Пользователь: ' + userNameText
    avatar.src = createAvatarUrl(userNameText, userIdValue)

    const userMeta = document.createElement('div')
    const userName = document.createElement('p')
    userName.className = 'appeal-card__name'
    userName.textContent = userNameText

    const userLevel = document.createElement('p')
    userLevel.className = 'appeal-card__level'
    userLevel.textContent = String(userLevelValue) + ' уровень'

    userMeta.append(userName, userLevel)
    userRow.append(avatar, userMeta)

    const photosRow = document.createElement('div')
    photosRow.className = 'appeal-card__images'

    const inputImages = Array.isArray(appeal.images) ? appeal.images.slice(0, 3) : []
    while (inputImages.length < 3) {
      inputImages.push({ label: String(inputImages.length + 1) })
    }

    const cardPhotoUrls = inputImages.map((photo, index) => photo.url || createMiniPhotoUrl(photo.label || index + 1, index))
    const cardLightboxUrls = inputImages.map((photo, index) => {
      return photo.url || createMiniPhotoUrl(photo.label || index + 1, index, LIGHTBOX_PLACEHOLDER_SIZE, 36)
    })

    inputImages.forEach((photo, index) => {
      const image = document.createElement('img')
      image.className = 'appeal-card__photo'
      image.width = 44
      image.height = 44
      image.alt = `Фото заявки ${index + 1}`
      image.src = cardPhotoUrls[index]
      image.addEventListener('click', event => {
        event.stopPropagation()
        openPhotoLightbox(cardLightboxUrls, index)
      })
      photosRow.append(image)
    })

    topRow.append(userRow, photosRow)

    const category = document.createElement('p')
    category.className = 'appeal-card__category'
    category.textContent = `${String(appeal.category || 'Категория')}, ${String(
      appeal.subcategory || 'Без подкатегории'
    )}`

    const description = document.createElement('p')
    description.className = 'appeal-card__description'
    description.textContent = String(appeal.description || '')

    card.append(topRow, category, description)
    return card
  }

  function renderStats(stats) {
    if (!statsGrid) return
    statsGrid.textContent = ''

    const statItems = [
      { key: 'new', label: 'Новые обращения', value: Number(stats?.new || 0) },
      { key: 'assigned', label: 'Назначено мне', value: Number(stats?.assigned || 0) },
      {
        key: 'reviewed',
        label: 'Рассмотрено (24ч / 7д)',
        value: `${Number(stats?.reviewed_24h || 0)} / ${Number(stats?.reviewed_7d || 0)}`,
      },
    ]

    statItems.forEach(stat => statsGrid.append(createStatCard(stat)))
  }

  function renderAppeals(appeals) {
    if (!appealsGrid) return
    appealsGrid.textContent = ''
    state.appealsById.clear()

    const pendingAppeals = (Array.isArray(appeals) ? appeals : []).filter(
      appeal => String(appeal.status || '') === 'pending'
    )

    if (pendingAppeals.length === 0) {
      const emptyState = document.createElement('p')
      emptyState.className = 'appeals-empty'
      emptyState.textContent = 'У вас пока нет заявок в статусе pending.'
      appealsGrid.append(emptyState)
      layoutAppealsGrid()
      return
    }

    pendingAppeals.forEach(appeal => {
      state.appealsById.set(String(appeal.id), appeal)
      appealsGrid.append(createAppealCard(appeal))
    })
    layoutAppealsGrid()
  }

  function renderUserAppeals(appeals) {
    if (!appealsGrid) return
    appealsGrid.textContent = ''
    state.appealsById.clear()

    const list = Array.isArray(appeals) ? appeals : []

    if (list.length === 0) {
      const emptyState = document.createElement('p')
      emptyState.className = 'appeals-empty'
      emptyState.textContent = 'У вас пока нет отправленных обращений.'
      appealsGrid.append(emptyState)
      layoutAppealsGrid()
      return
    }

    list.forEach(appeal => {
      state.appealsById.set(String(appeal.id), appeal)
      appealsGrid.append(createAppealCard(appeal))
    })
    layoutAppealsGrid()
  }

  function renderErrorState(message) {
    if (!appealsGrid) return
    appealsGrid.textContent = ''
    const stateMessage = document.createElement('p')
    stateMessage.className = 'appeals-empty'
    stateMessage.textContent = message
    appealsGrid.append(stateMessage)
    layoutAppealsGrid()
  }

  function setModalMessage(text, isError = false) {
    if (!modalMessage) return
    modalMessage.textContent = text
    modalMessage.classList.toggle('error', isError)
  }

  function setChatComposerDisabled(disabled) {
    if (chatInput) chatInput.disabled = disabled
    if (chatSend) chatSend.disabled = disabled
  }

  function resizeChatInput() {
    if (!chatInput) return
    chatInput.style.height = 'auto'
    chatInput.style.height = `${Math.min(chatInput.scrollHeight, 118)}px`
  }

  function formatDateTime(value) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  function formatDate(value) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(date)
  }

  function renderChat(messages) {
    if (!chatList || !chatEmpty) return

    chatList.textContent = ''
    const list = Array.isArray(messages) ? messages : []
    chatEmpty.hidden = list.length > 0

    list.forEach(message => {
      const item = document.createElement('article')
      item.className = 'agent-chat__message'
      if (message.is_own) item.classList.add('agent-chat__message--own')
      if (message.sender_type === 'system') {
        item.classList.add('agent-chat__message--system')
        const systemText = String(message.message || '').toLowerCase()
        if (systemText.includes('отклон')) {
          item.classList.add('agent-chat__message--system-rejected')
        } else if (systemText.includes('принят') || systemText.includes('направлен')) {
          item.classList.add('agent-chat__message--system-confirmed')
        } else {
          item.classList.add('agent-chat__message--system-pending')
        }
      }

      const head = document.createElement('div')
      head.className = 'agent-chat__message-head'

      const author = document.createElement('p')
      author.className = 'agent-chat__message-author'
      author.textContent = String(
        message.sender_name || (message.sender_type === 'system' ? 'EcoSignal AI' : message.sender_type === 'agent' ? 'Агент' : 'Вы')
      )

      const time = document.createElement('p')
      time.className = 'agent-chat__message-time'
      time.textContent = formatDateTime(message.created_at)

      const text = document.createElement('p')
      text.className = 'agent-chat__message-text'
      text.textContent = String(message.message || '')

      head.append(author, time)
      item.append(head, text)
      chatList.append(item)
    })

    chatList.parentElement?.scrollTo({
      top: chatList.parentElement.scrollHeight,
      behavior: 'auto',
    })
  }

  function updateChatComposerState() {
    if (chatInput) chatInput.disabled = chatState.busy || chatState.unavailable
    if (chatSend) {
      chatSend.disabled = chatState.busy
      chatSend.classList.toggle('agent-chat__send--inactive', chatState.unavailable)
      chatSend.setAttribute('aria-disabled', String(chatState.busy || chatState.unavailable))
    }
    if (chatComposer) {
      chatComposer.classList.toggle('agent-chat__composer--disabled', chatState.unavailable)
    }
  }

  function setChatComposerDisabled(disabled) {
    chatState.busy = disabled
    updateChatComposerState()
  }

  function setChatUnavailable(disabled) {
    chatState.unavailable = disabled
    updateChatComposerState()
  }

  function setChatDisabledReason(reason = '') {
    if (chatComposer) {
      if (reason) {
        chatComposer.dataset.disabledReason = reason
      } else {
        delete chatComposer.dataset.disabledReason
      }
    }
    if (!chatSend) return
    if (reason) {
      chatSend.dataset.disabledReason = reason
      chatSend.title = reason
      return
    }
    delete chatSend.dataset.disabledReason
    chatSend.removeAttribute('title')
  }

  function canUseAppealChat(appeal) {
    return Boolean(appeal?.assignment?.responsible_org_admin_id || appeal?.assignment?.responsible_org_admin_login)
  }

  function setPanelsOpen(open) {
    workspace?.classList.toggle('admin-workspace--agent-panels-open', open)
    modal?.classList.toggle('appeal-drawer--open', open)
    chatDrawer?.classList.toggle('agent-chat-drawer--open', open)
    modal?.setAttribute('aria-hidden', String(!open))
    chatDrawer?.setAttribute('aria-hidden', String(!open))
    layoutAppealsGrid()
    window.requestAnimationFrame(() => layoutAppealsGrid())
    window.setTimeout(() => layoutAppealsGrid(), 320)
  }

  function setAssignmentInfo(appeal) {
    const status = String(appeal?.status || '')
    const statusText = STATUS_LABELS[status] || '—'
    if (modalStatus) {
      modalStatus.textContent = statusText
      modalStatus.classList.add('appeal-modal__note--status')
      modalStatus.classList.remove(
        'appeal-modal__note--status-pending',
        'appeal-modal__note--status-confirmed',
        'appeal-modal__note--status-rejected'
      )
      const acceptedStatuses = new Set(['confirmed', 'in_progress', 'resolved'])
      const tone = status === 'rejected' ? 'rejected' : acceptedStatuses.has(status) ? 'confirmed' : 'pending'
      modalStatus.classList.add(`appeal-modal__note--status-${tone}`)
    }

    const assignment = appeal?.assignment || null
    if (!assignment) {
      if (modalOrganization) modalOrganization.textContent = 'Орган не назначен'
      if (modalFilial) modalFilial.textContent = 'Филиал не назначен'
      if (modalResponsible) modalResponsible.textContent = 'Ответственный не назначен'
      if (modalAssignmentNote) modalAssignmentNote.textContent = 'Назначение по этой заявке пока не выполнено.'
      return
    }

    if (modalOrganization) {
      modalOrganization.textContent = assignment.organization_name || 'Орган не назначен'
    }
    if (modalFilial) {
      modalFilial.textContent = assignment.filial_name
        ? `${assignment.filial_name}${assignment.filial_region ? ` (${assignment.filial_region})` : ''}`
        : 'Филиал не назначен'
    }
    if (modalResponsible) {
      modalResponsible.textContent = assignment.responsible_org_admin_login || 'Ответственный не назначен'
    }
    if (modalAssignmentNote) {
      modalAssignmentNote.textContent = assignment.assigned_at
        ? `Назначена: ${formatDateTime(assignment.assigned_at)}.`
        : ''
    }
  }

  function syncChatAvailability(appeal) {
    const enabled = canUseAppealChat(appeal)
    const unavailableReason = 'Чат не доступен: ответственный по вашей заявке ещё не назначен'
    setChatUnavailable(!enabled)
    if (enabled) {
      setChatDisabledReason('')
      if (chatInput) chatInput.placeholder = 'Введите сообщение'
      return
    }

    setChatDisabledReason(unavailableReason)
    if (chatInput) {
      chatInput.placeholder = 'Чат недоступен'
    }
  }

  function updateCarouselArrowState() {
    if (!modalCarousel) return
    const maxScroll = modalCarousel.scrollWidth - modalCarousel.clientWidth
    if (maxScroll <= 1) {
      if (modalCarouselPrev) {
        modalCarouselPrev.hidden = true
        modalCarouselPrev.disabled = true
      }
      if (modalCarouselNext) {
        modalCarouselNext.hidden = true
        modalCarouselNext.disabled = true
      }
      return
    }
    const left = modalCarousel.scrollLeft
    const atStart = left <= 2
    const atEnd = left >= maxScroll - 2
    if (modalCarouselPrev) {
      modalCarouselPrev.hidden = atStart
      modalCarouselPrev.disabled = atStart
    }
    if (modalCarouselNext) {
      modalCarouselNext.hidden = atEnd
      modalCarouselNext.disabled = atEnd
    }
  }

  function appealCardBaseWidthPx() {
    return Math.min(APPEAL_CARD_BASE_CAP_PX, window.innerWidth * APPEAL_CARD_BASE_VW_RATIO)
  }

  function computeAppealsGridTemplateColumns(containerWidth) {
    if (workspace?.classList.contains('admin-workspace--agent-panels-open')) {
      return 'repeat(1, minmax(0, 1fr))'
    }

    const w = Math.floor(containerWidth)
    const base = appealCardBaseWidthPx()
    const tripleBase = 3 * base
    const tripleMin = 3 * APPEAL_CARD_MIN_PX
    const doubleMin = 2 * APPEAL_CARD_MIN_PX

    if (w >= tripleBase) {
      return `repeat(3, minmax(${base}px, 1fr))`
    }
    if (w >= tripleMin) {
      return `repeat(3, minmax(${APPEAL_CARD_MIN_PX}px, 1fr))`
    }
    if (w >= doubleMin) {
      return `repeat(2, minmax(${APPEAL_CARD_MIN_PX}px, 1fr))`
    }
    return `repeat(1, minmax(0, 1fr))`
  }

  function layoutAppealsGrid() {
    if (!appealsGrid || !appealsSection) return
    const template = computeAppealsGridTemplateColumns(appealsSection.clientWidth)
    if (template === appealsGridTemplate) return
    appealsGridTemplate = template
    appealsGrid.style.gridTemplateColumns = template
  }

  function scheduleAppealsGridLayout() {
    if (appealsGridLayoutFrame) return
    appealsGridLayoutFrame = window.requestAnimationFrame(() => {
      appealsGridLayoutFrame = 0
      layoutAppealsGrid()
    })
  }

  function setupAppealsGridLayout() {
    layoutAppealsGrid()
    if (typeof ResizeObserver !== 'undefined' && appealsSection) {
      const ro = new ResizeObserver(() => scheduleAppealsGridLayout())
      ro.observe(appealsSection)
    }
    window.addEventListener('resize', scheduleAppealsGridLayout)
  }

  function normalizeCarouselWheelDelta(event) {
    let x = event.deltaX
    let y = event.deltaY
    if (event.deltaMode === 1) {
      const line = 16
      x *= line
      y *= line
    } else if (event.deltaMode === 2 && modalCarousel) {
      x *= modalCarousel.clientWidth
      y *= modalCarousel.clientHeight
    }
    return { x, y }
  }

  function setupAppealCarousel() {
    if (!modalCarousel) return

    const onWheel = event => {
      if (event.ctrlKey) return
      if (modalCarousel.scrollWidth <= modalCarousel.clientWidth) return

      const { x, y } = normalizeCarouselWheelDelta(event)
      const delta = Math.abs(x) > Math.abs(y) ? x : y
      if (delta === 0) return

      event.preventDefault()
      modalCarousel.scrollLeft += delta
      updateCarouselArrowState()
    }

    modalCarousel.addEventListener('wheel', onWheel, { passive: false })

    modalCarousel.addEventListener('scroll', updateCarouselArrowState, { passive: true })

    const stepClick = () => Math.min(220, MODAL_PHOTO_SIZE + 40)

    modalCarouselPrev?.addEventListener('click', () => {
      modalCarousel.scrollBy({ left: -stepClick(), behavior: 'smooth' })
      window.setTimeout(updateCarouselArrowState, 400)
    })

    modalCarouselNext?.addEventListener('click', () => {
      modalCarousel.scrollBy({ left: stepClick(), behavior: 'smooth' })
      window.setTimeout(updateCarouselArrowState, 400)
    })

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateCarouselArrowState())
      ro.observe(modalCarousel)
    }

    updateCarouselArrowState()
  }

  function renderAppealModalData(appeal) {
    if (!modal || !appeal) return

    if (modalTitle) {
      modalTitle.textContent = `Заявка #${appeal.id}`
    }

    if (modalCategory) {
      modalCategory.textContent = String(appeal.category || 'Категория')
    }
    if (modalSubcategory) {
      modalSubcategory.textContent = String(appeal.subcategory || 'Без подкатегории')
    }
    if (modalUser) {
      modalUser.textContent = 'Заявитель: ' + (appeal.user?.name || getUserDisplayName(currentUser))
    }

    if (modalDescription) {
      modalDescription.textContent = String(appeal.description || '')
    }

    if (modalImages) {
      modalImages.textContent = ''
      const modalPhotos = Array.isArray(appeal.images) ? appeal.images.slice() : []
      while (modalPhotos.length < 3) {
        modalPhotos.push({ label: String(modalPhotos.length + 1) })
      }

      const modalPhotoUrls = modalPhotos.map((photo, index) => {
        return photo.url || createMiniPhotoUrl(photo.label || index + 1, index, MODAL_PHOTO_SIZE)
      })
      const modalLightboxUrls = modalPhotos.map((photo, index) => {
        return photo.url || createMiniPhotoUrl(photo.label || index + 1, index, LIGHTBOX_PLACEHOLDER_SIZE, 36)
      })

      modalPhotos.forEach((photo, index) => {
        const image = document.createElement('img')
        image.className = 'appeal-modal__image'
        image.width = MODAL_PHOTO_SIZE
        image.height = MODAL_PHOTO_SIZE
        image.loading = 'lazy'
        image.alt = `Фото заявки ${index + 1}`
        image.src = modalPhotoUrls[index]
        image.addEventListener('click', () => openPhotoLightbox(modalLightboxUrls, index))
        modalImages.append(image)
      })
      modalCarousel.scrollLeft = 0
      window.requestAnimationFrame(() => updateCarouselArrowState())
    }

    setSelectedPriorityValue(Number(appeal.priority || 0))

    if (modalAgency) {
      modalAgency.value = ''
    }
    syncAgencyDisplayFromSelect()
    closeAgencyDropdown()

    setAssignmentInfo(appeal)
    setModalMessage('')
  }

  async function fetchAppealDetails(appealId) {
    const response = await fetch(`backend/user_appeal_details.php?appeal_id=${encodeURIComponent(appealId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось загрузить заявку')
    }

    return data
  }

  async function sendAppealMessage(appealId, message) {
    const response = await fetch('backend/user_appeal_message.php', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ appeal_id: appealId, message }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось отправить сообщение')
    }

    return data
  }

  async function openAppealModal(appealId) {
    if (!modal) return

    const numericAppealId = Number(appealId)
    const requestId = ++state.detailRequestId
    const cachedAppeal = state.appealsById.get(String(appealId))

    state.currentAppealId = numericAppealId
    setPanelsOpen(true)
    setModalMessage('')
    setChatUnavailable(true)
    setChatDisabledReason('Чат не доступен: ответственный по вашей заявке ещё не назначен')
    setChatComposerDisabled(true)
    renderChat([])
    if (chatTitle) chatTitle.textContent = `Чат по заявке #${numericAppealId}`

    if (cachedAppeal) {
      renderAppealModalData(cachedAppeal)
    }

    try {
      const data = await fetchAppealDetails(numericAppealId)
      if (requestId !== state.detailRequestId || state.currentAppealId !== numericAppealId) return

      const appeal = data?.appeal
      if (!appeal) {
        throw new Error('Заявка не найдена')
      }

      const mergedAppeal = {
        ...(cachedAppeal || {}),
        ...appeal,
      }
      state.appealsById.set(String(mergedAppeal.id), mergedAppeal)

      renderAppealModalData(mergedAppeal)
      renderChat(data?.chat || [])
      if (chatTitle) chatTitle.textContent = `Чат по заявке #${mergedAppeal.id}`
      if (chatInput) chatInput.value = ''
      resizeChatInput()
      setChatComposerDisabled(false)
      syncChatAvailability(mergedAppeal)
    } catch (error) {
      if (requestId !== state.detailRequestId) return
      setModalMessage(error?.message || 'Не удалось загрузить заявку')
      setChatDisabledReason('Чат не доступен: ответственный по вашей заявке ещё не назначен')
      setChatUnavailable(true)
      setChatComposerDisabled(false)
    }
  }

  function closeAppealModal() {
    if (!modal) return
    closeAgencyDropdown()
    state.detailRequestId += 1
    setPanelsOpen(false)
    state.currentAppealId = null
    setModalMessage('')
    renderChat([])
    if (chatInput) chatInput.value = ''
    setChatUnavailable(false)
    setChatComposerDisabled(false)
    setChatDisabledReason('')
    resizeChatInput()
  }

  async function saveAppealModal() {
    closeAppealModal()
  }

  async function sendChatMessage() {
    const appealId = state.currentAppealId
    const message = String(chatInput?.value || '').trim()
    if (!appealId || !message || chatState.busy || chatState.unavailable) return

    setChatComposerDisabled(true)
    try {
      await sendAppealMessage(appealId, message)
      if (chatInput) chatInput.value = ''
      resizeChatInput()

      const data = await fetchAppealDetails(appealId)
      if (state.currentAppealId !== appealId) return
      renderChat(data?.chat || [])
      if (data?.appeal) {
        const cachedAppeal = state.appealsById.get(String(appealId)) || {}
        const mergedAppeal = { ...cachedAppeal, ...data.appeal }
        state.appealsById.set(String(appealId), mergedAppeal)
        renderAppealModalData(mergedAppeal)
      }
      setModalMessage('')
    } catch (error) {
      if (String(error?.message || '').toLowerCase().includes('ответственный')) {
        setChatUnavailable(true)
        setChatDisabledReason(error.message)
      }
      setModalMessage(error?.message || 'Не удалось отправить сообщение')
    } finally {
      if (state.currentAppealId === appealId) {
        setChatComposerDisabled(false)
      }
    }
  }

  function setupModalHandlers() {
    modalClose?.addEventListener('click', closeAppealModal)
    modalCancel?.addEventListener('click', closeAppealModal)
    modalSave?.addEventListener('click', saveAppealModal)
    chatComposer?.addEventListener('submit', event => {
      event.preventDefault()
      sendChatMessage()
    })
    chatInput?.addEventListener('input', resizeChatInput)
    chatInput?.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.shiftKey) return
      event.preventDefault()
      sendChatMessage()
    })

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return
      if (photoLightbox && !photoLightbox.hidden) return
      if (profileModal && !profileModal.hidden) {
        closeProfileModal()
        return
      }
      if (agencyDropdownOpen) {
        closeAgencyDropdown()
      }
    })
  }

  function setupAppealCardsHandler() {
    if (!appealsGrid) return

    appealsGrid.addEventListener('click', event => {
      const target = event.target
      if (!(target instanceof Element)) return

      const card = target.closest('.appeal-card')
      if (!card) return

      const appealId = card.getAttribute('data-appeal-id')
      if (!appealId) return

      openAppealModal(appealId)
    })
  }

  async function ensureUser() {
    const response = await fetch('backend/me.php', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.user) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('login.html')
      throw new Error('__redirect_login__')
    }

    if (data.user.role === 'admin' && data.user.auth_source === 'org_admins') {
      window.location.replace('agent.html')
      throw new Error('__redirect_agent__')
    }

    return data.user
  }

  async function loadMyAppealsPageData() {
    const response = await fetch('backend/my_appeals.php', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.replace('login.html')
        throw new Error('__redirect_login__')
      }
      if (response.status === 403) {
        throw new Error('__redirect_role__')
      }
      throw new Error(data.message || 'Не удалось загрузить обращения')
    }

    return data
  }

  function setupSidebarActions() {
    const sidebarBrand = document.querySelector('.sidebar-brand')
    const resetSidebarState = () => {
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false')
      } catch (_error) {
        // no-op
      }
    }
    const logout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('index.html')
    }

    const navButtons = document.querySelectorAll('.sidebar-nav-item[data-href], .sidebar-nav-item[data-action]')
    if (sidebarBrand) {
      sidebarBrand.addEventListener('click', () => {
        resetSidebarState()
        window.location.href = 'index.html'
      })
    }
    navButtons.forEach(button => {
      button.addEventListener('click', () => {
        const action = button.dataset.action
        if (action === 'logout') {
          logout()
          return
        }

        const href = button.dataset.href
        if (href) {
          resetSidebarState()
          window.location.href = href
        }
      })
    })
  }

  function isSidebarInteractiveTarget(target) {
    return (
      target instanceof Element &&
      Boolean(
        target.closest(
          '.sidebar-nav-item, .sidebar-nav-item1, .sidebar-profile, .sidebar-brand'
        )
      )
    )
  }

  function setupSidebarToggle() {
    if (!sidebar || !sidebarToggle) return

    const getSavedSidebarExpanded = () => {
      try {
        return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
      } catch (_error) {
        return false
      }
    }

    const persistSidebarExpanded = expanded => {
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded))
      } catch (_error) {
        // no-op
      }
    }

    const setSidebarExpanded = expanded => {
      sidebar.classList.toggle('sidebar--expanded', expanded)
      sidebarToggle.setAttribute('aria-expanded', String(expanded))
      sidebarToggle.setAttribute(
        'aria-label',
        expanded ? 'Свернуть панель' : 'Развернуть панель'
      )
      persistSidebarExpanded(expanded)
    }

    setSidebarExpanded(getSavedSidebarExpanded())
    window.requestAnimationFrame(() => {
      sidebar.classList.add('sidebar--ready')
    })

    const toggleSidebar = () => {
      setSidebarExpanded(!sidebar.classList.contains('sidebar--expanded'))
    }

    sidebarToggle.addEventListener('click', event => {
      event.stopPropagation()
      toggleSidebar()
    })

    sidebar.addEventListener('click', event => {
      if (isSidebarInteractiveTarget(event.target)) return
      toggleSidebar()
    })
  }

  function setupProfileBadge(user) {
    const displayName = getUserDisplayName(user)
    if (sidebarAvatar) sidebarAvatar.textContent = getInitials(displayName)
    if (sidebarProfileName) sidebarProfileName.textContent = displayName
    if (sidebarProfileLevel) sidebarProfileLevel.textContent = getUserRoleLabel(user?.role)
  }

  async function init() {
    setupSidebarActions()
    setupSidebarToggle()
    setupAppealsGridLayout()
    setupAgencyCustomSelect()
    setupAppealCarousel()
    setupPhotoLightbox()
    setupProfileModal()
    setupModalHandlers()
    setupAppealCardsHandler()
    modalPriorityRadios.forEach(input => {
      input.disabled = true
    })
    if (modalAgencyTrigger) modalAgencyTrigger.disabled = true
    if (modalAgency) modalAgency.disabled = true
    if (modalSave) modalSave.textContent = 'Закрыть'

    try {
      const authUser = await ensureUser()
      const pageData = await loadMyAppealsPageData()
      const pageUser = {
        ...(authUser || {}),
        ...((pageData?.user && typeof pageData.user === 'object') ? pageData.user : {}),
      }
      currentUser = pageUser

      setupProfileBadge(pageUser)
      renderUserAppeals(pageData?.appeals || [])
    } catch (error) {
      if (
        error?.message === '__redirect_login__' ||
        error?.message === '__redirect_agent__' ||
        error?.message === '__redirect_role__'
      ) {
        return
      }

      setupProfileBadge({})
      renderErrorState(error?.message || 'Не удалось загрузить данные.')
    }
  }

  init()
})()
