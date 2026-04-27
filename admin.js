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
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileButton = document.getElementById('sidebarProfileButton')
  const sidebarProfileName = document.querySelector('.sidebar-profile-name')
  const sidebarProfileLevel = document.querySelector('.sidebar-profile-level')
  const profileModal = document.getElementById('profileModal')
  const profileModalBackdrop = document.getElementById('profileModalBackdrop')
  const profileModalClose = document.getElementById('profileModalClose')
  const profileModalCancel = document.getElementById('profileModalCancel')
  const profileModalForm = document.getElementById('profileModalForm')
  const profileModalMessage = document.getElementById('profileModalMessage')
  const profileFullName = document.getElementById('profileFullName')
  const profileEmailLabel = document.getElementById('profileEmailLabel')
  const profileEmail = document.getElementById('profileEmail')
  const profilePassword = document.getElementById('profilePassword')
  const profileAbout = document.getElementById('profileAbout')
  const profileRole = document.getElementById('profileRole')
  const profileCreatedAt = document.getElementById('profileCreatedAt')
  const profileModalSave = document.getElementById('profileModalSave')

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
  const modalMap = document.getElementById('appealModalMap')
  const modalMapHint = document.getElementById('appealModalMapHint')
  const modalPriorityRadios = document.querySelectorAll('input[name="appealModalPriority"]')
  const modalOrganization = document.getElementById('appealModalOrganization')
  const modalOrganizationTrigger = document.getElementById('appealModalOrganizationTrigger')
  const modalOrganizationList = document.getElementById('appealModalOrganizationList')
  const modalOrganizationDisplay = document.getElementById('appealModalOrganizationDisplay')
  const modalOrganizationWrap = document.getElementById('appealModalOrganizationWrap')
  const modalFilial = document.getElementById('appealModalFilial')
  const modalFilialTrigger = document.getElementById('appealModalFilialTrigger')
  const modalFilialList = document.getElementById('appealModalFilialList')
  const modalFilialDisplay = document.getElementById('appealModalFilialDisplay')
  const modalFilialWrap = document.getElementById('appealModalFilialWrap')

  const photoLightbox = document.getElementById('photoLightbox')
  const photoLightboxBackdrop = document.getElementById('photoLightboxBackdrop')
  const photoLightboxClose = document.getElementById('photoLightboxClose')
  const photoLightboxPrev = document.getElementById('photoLightboxPrev')
  const photoLightboxNext = document.getElementById('photoLightboxNext')
  const photoLightboxImg = document.getElementById('photoLightboxImg')
  const photoLightboxCounter = document.getElementById('photoLightboxCounter')
  const photoLightboxStage = document.querySelector('.photo-lightbox__stage')

  const modalMessage = document.getElementById('appealModalMessage')

  const MODAL_PHOTO_SIZE = 180

  /** Базовая ширина карточки: min(400px, 25vw); минимум колонки 330px */
  const APPEAL_CARD_MIN_PX = 330
  const APPEAL_CARD_BASE_CAP_PX = 400
  const APPEAL_CARD_BASE_VW_RATIO = 0.25
  const NEAREST_FILIALS_LIMIT = 5
  const ORGANIZATION_TYPE_LABELS = {
    federal: 'федеральный',
    regional: 'региональный',
    municipal: 'муниципальный',
  }

  const PHOTO_PALETTE = [
    ['#f4dca1', '#d3bd8a'],
    ['#bfd7bf', '#97b798'],
    ['#b6d4dd', '#8db5c0'],
    ['#e5d0bc', '#c9aa90'],
    ['#d3c8f1', '#b0a0df'],
    ['#f1c8cd', '#e3a8b1'],
  ]

  const state = {
    appealsById: new Map(),
    currentAppealId: null,
    dashboardAppeals: [],
    dashboardStats: {},
    organizations: [],
    filials: [],
    filialCoords: new Map(),
    pendingGeocodes: new Map(),
    mapRenderToken: 0,
  }

  const lightboxState = {
    urls: [],
    index: 0,
  }

  const customSelects = new Map()
  const assignmentMapState = {
    map: null,
    readyPromise: null,
    geoObjects: [],
  }

  let lightboxTouchStartX = 0
  let currentUser = null
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
    if (!user || typeof user !== 'object') return 'Администратор'
    const combined = `${user.first_name || ''} ${user.last_name || ''}`.trim()
    if (combined) return combined
    if (user.name) return String(user.name)
    if (user.email) return String(user.email)
    return 'Администратор'
  }

  function formatDate(value) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return date.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  function setProfileModalMessage(text, isError = false) {
    if (!profileModalMessage) return
    profileModalMessage.textContent = text
    profileModalMessage.classList.toggle('error', isError)
  }

  function fillProfileModal(user) {
    const profile = user && typeof user === 'object' ? user : {}
    const displayName = getUserDisplayName(profile)
    const usesOrgAdminAuth = String(profile.auth_source || '') === 'org_admins'
    if (profileFullName) {
      profileFullName.value = displayName === 'Администратор' ? '' : displayName
      profileFullName.readOnly = usesOrgAdminAuth
    }
    if (profileEmailLabel) profileEmailLabel.textContent = usesOrgAdminAuth ? 'Логин' : 'Email'
    if (profileEmail) {
      profileEmail.type = usesOrgAdminAuth ? 'text' : 'email'
      profileEmail.value = String((usesOrgAdminAuth ? profile.login : profile.email) || profile.email || profile.login || '').trim()
    }
    if (profilePassword) profilePassword.value = ''
    if (profileAbout) {
      profileAbout.value = String(profile.about || '').trim()
      profileAbout.readOnly = usesOrgAdminAuth
    }
    if (profileRole) profileRole.textContent = 'Администратор'
    if (profileCreatedAt) profileCreatedAt.textContent = formatDate(profile.created_at)
  }

  function finalizeProfileModalClose() {
    if (!profileModal) return
    profileModal.hidden = true
    setProfileModalMessage('')
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

  function setupProfileModal() {
    if (!profileModal) return

    sidebarProfileButton?.addEventListener('click', openProfileModal)
    profileModalBackdrop?.addEventListener('click', closeProfileModal)
    profileModalClose?.addEventListener('click', closeProfileModal)
    profileModalCancel?.addEventListener('click', closeProfileModal)
    profileModalForm?.addEventListener('submit', event => {
      event.preventDefault()
      saveProfile()
    })

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && profileModal && !profileModal.hidden) {
        event.preventDefault()
        closeProfileModal()
      }
    })
  }

  async function saveProfile() {
    const payload = {
      fullname: String(profileFullName?.value || '').trim(),
      email: String(profileEmail?.value || '').trim(),
      login: String(profileEmail?.value || '').trim(),
      password: String(profilePassword?.value || '').trim(),
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
      setProfileModalMessage('Профиль сохранён')
    } catch (error) {
      setProfileModalMessage(error?.message || 'Не удалось сохранить профиль', true)
    } finally {
      if (profileModalSave) profileModalSave.disabled = false
    }
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

  function createMiniPhotoUrl(label, index, size = 44) {
    const palette = PHOTO_PALETTE[index % PHOTO_PALETTE.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="100%" stop-color="${palette[1]}"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="8" fill="url(#g)"/>
      <circle cx="${Math.round(size * 0.32)}" cy="${Math.round(size * 0.34)}" r="${Math.round(size * 0.09)}" fill="rgba(20,20,19,0.18)"/>
      <path d="M${Math.round(size * 0.14)} ${Math.round(size * 0.82)}L${Math.round(size * 0.36)} ${Math.round(size * 0.55)}L${Math.round(size * 0.5)} ${Math.round(size * 0.68)}L${Math.round(size * 0.68)} ${Math.round(size * 0.45)}L${Math.round(size * 0.86)} ${Math.round(size * 0.82)}Z" fill="rgba(20,20,19,0.22)"/>
      <text x="${Math.round(size / 2)}" y="${Math.round(size * 0.92)}" text-anchor="middle" font-size="${Math.max(10, Math.round(size * 0.16))}" font-family="Roboto Flex, sans-serif" fill="rgba(20,20,19,0.45)">${label}</text>
    </svg>`
    return toDataUrl(svg)
  }

  function getOrganizationTypeLabel(type) {
    return ORGANIZATION_TYPE_LABELS[String(type || '')] || String(type || '')
  }

  function formatOrganizationOptionLabel(organization) {
    if (!organization) return 'Выберите орган'
    const typeLabel = getOrganizationTypeLabel(organization.org_type)
    return typeLabel ? `${organization.name} (${typeLabel})` : String(organization.name || '')
  }

  function formatFilialOptionLabel(filial) {
    if (!filial) return 'Выберите филиал'
    return filial.region ? `${filial.name} (${filial.region})` : String(filial.name || '')
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

  function closeAllCustomSelects(exceptSelectId = '') {
    customSelects.forEach((config, selectId) => {
      const isOpen = Boolean(exceptSelectId) && selectId === exceptSelectId && !config.select.disabled
      config.list.hidden = !isOpen
      config.trigger.setAttribute('aria-expanded', String(isOpen))
      config.wrap.classList.toggle('appeal-modal__select-wrap--open', isOpen)
    })
  }

  function syncCustomSelectDisplay(selectId) {
    const config = customSelects.get(selectId)
    if (!config) return

    const placeholder = String(config.select.dataset.placeholder || 'Выберите значение')
    const opt = config.select.selectedOptions[0]
    config.display.textContent = opt ? opt.textContent : placeholder
    config.trigger.disabled = config.select.disabled
  }

  function rebuildCustomSelectOptions(selectId) {
    const config = customSelects.get(selectId)
    if (!config) return

    config.list.textContent = ''

    Array.from(config.select.options).forEach((option, index) => {
      const item = document.createElement('li')
      item.className = 'appeal-modal__select-option'
      item.setAttribute('role', 'option')
      item.dataset.value = option.value
      item.id = `${selectId}Opt_${index}`
      item.textContent = option.textContent
      item.setAttribute('aria-selected', option.selected ? 'true' : 'false')
      item.setAttribute('aria-disabled', option.disabled ? 'true' : 'false')
      item.addEventListener('click', () => {
        if (option.disabled) return
        config.select.selectedIndex = index
        config.select.dispatchEvent(new Event('change', { bubbles: true }))
        closeAllCustomSelects()
      })
      config.list.append(item)
    })

    syncCustomSelectDisplay(selectId)
  }

  function registerCustomSelect({ select, wrap, trigger, list, display }) {
    if (!select || !wrap || !trigger || !list || !display) return

    customSelects.set(select.id, { select, wrap, trigger, list, display })

    trigger.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      const isOpen = !list.hidden
      closeAllCustomSelects(isOpen ? '' : select.id)
    })

    wrap.addEventListener('click', event => event.stopPropagation())
    select.addEventListener('change', () => syncCustomSelectDisplay(select.id))

    rebuildCustomSelectOptions(select.id)
  }

  function setupCustomSelects() {
    registerCustomSelect({
      select: modalOrganization,
      wrap: modalOrganizationWrap,
      trigger: modalOrganizationTrigger,
      list: modalOrganizationList,
      display: modalOrganizationDisplay,
    })

    registerCustomSelect({
      select: modalFilial,
      wrap: modalFilialWrap,
      trigger: modalFilialTrigger,
      list: modalFilialList,
      display: modalFilialDisplay,
    })

    document.addEventListener('click', () => closeAllCustomSelects())
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeAllCustomSelects()
    })
  }

  function updateLightboxView() {
    const urls = lightboxState.urls
    const index = lightboxState.index
    if (!photoLightboxImg || !urls.length) return
    photoLightboxImg.src = urls[index]
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
    card.dataset.assignedAdminId = String(appeal.assigned_admin_id || '')

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

    const avatar = document.createElement('img')
    avatar.className = 'appeal-card__avatar'
    avatar.width = 44
    avatar.height = 44
    avatar.alt = `Пользователь: ${appeal.user?.name || 'Неизвестно'}`
    avatar.src = createAvatarUrl(appeal.user?.name || 'Пользователь', appeal.user?.id)

    const userMeta = document.createElement('div')
    const userName = document.createElement('p')
    userName.className = 'appeal-card__name'
    userName.textContent = String(appeal.user?.name || 'Без имени')

    const userLevel = document.createElement('p')
    userLevel.className = 'appeal-card__level'
    userLevel.textContent = `${Number(appeal.user?.level || 0)} уровень`

    userMeta.append(userName, userLevel)
    userRow.append(avatar, userMeta)

    const photosRow = document.createElement('div')
    photosRow.className = 'appeal-card__images'

    const inputImages = Array.isArray(appeal.images) ? appeal.images.slice(0, 3) : []
    while (inputImages.length < 3) {
      inputImages.push({ label: String(inputImages.length + 1) })
    }

    const cardPhotoUrls = inputImages.map((photo, index) => photo.url || createMiniPhotoUrl(photo.label || index + 1, index))

    inputImages.forEach((photo, index) => {
      const image = document.createElement('img')
      image.className = 'appeal-card__photo'
      image.width = 44
      image.height = 44
      image.alt = `Фото заявки ${index + 1}`
      image.src = cardPhotoUrls[index]
      image.addEventListener('click', event => {
        event.stopPropagation()
        openPhotoLightbox(cardPhotoUrls, index)
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
    appealsGrid.style.gridTemplateColumns = computeAppealsGridTemplateColumns(appealsSection.clientWidth)
  }

  function setupAppealsGridLayout() {
    layoutAppealsGrid()
    if (typeof ResizeObserver !== 'undefined' && appealsSection) {
      const ro = new ResizeObserver(() => layoutAppealsGrid())
      ro.observe(appealsSection)
    }
    window.addEventListener('resize', layoutAppealsGrid)
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

  function setMapHint(text) {
    if (modalMapHint) {
      modalMapHint.textContent = text
    }
  }

  function getSelectedOrganizationId() {
    return Number(modalOrganization?.value || 0) || 0
  }

  function getSelectedFilialId() {
    return Number(modalFilial?.value || 0) || 0
  }

  function getAppealCoords(appeal) {
    const latitude = Number(appeal?.latitude)
    const longitude = Number(appeal?.longitude)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return null
    }

    return [latitude, longitude]
  }

  function clearAssignmentMapObjects() {
    if (!assignmentMapState.map) return

    assignmentMapState.geoObjects.forEach(geoObject => {
      assignmentMapState.map.geoObjects.remove(geoObject)
    })
    assignmentMapState.geoObjects = []
  }

  async function ensureAssignmentMapReady() {
    if (!modalMap) return null
    if (assignmentMapState.map) return assignmentMapState.map
    if (assignmentMapState.readyPromise) return assignmentMapState.readyPromise

    if (!window.ymaps) {
      setMapHint('Карта недоступна: API Яндекс Карт не загрузился.')
      return null
    }

    assignmentMapState.readyPromise = new Promise(resolve => {
      ymaps.ready(() => {
        if (assignmentMapState.map) {
          resolve(assignmentMapState.map)
          return
        }

        const map = new ymaps.Map(
          'appealModalMap',
          {
            center: [55.751244, 37.618423],
            zoom: 10,
            controls: ['zoomControl'],
          },
          {
            suppressMapOpenBlock: true,
          }
        )

        map.behaviors.disable('scrollZoom')
        assignmentMapState.map = map
        resolve(map)
      })
    })

    return assignmentMapState.readyPromise
  }

  function buildFilialGeocodeQuery(filial) {
    return [filial?.address, filial?.region, 'Россия'].filter(Boolean).join(', ')
  }

  async function getFilialCoords(filial) {
    const filialId = String(filial?.id || '')
    if (!filialId) return null

    if (state.filialCoords.has(filialId)) {
      return state.filialCoords.get(filialId)
    }

    const pending = state.pendingGeocodes.get(filialId)
    if (pending) {
      return pending
    }

    if (!window.ymaps?.geocode) {
      return null
    }

    const geocodeRequest = ymaps
      .geocode(buildFilialGeocodeQuery(filial), { results: 1 })
      .then(result => {
        const first = result.geoObjects.get(0)
        if (!first) return null

        const coords = first.geometry.getCoordinates()
        if (!Array.isArray(coords) || coords.length !== 2) {
          return null
        }

        return [Number(coords[0]), Number(coords[1])]
      })
      .catch(() => null)
      .then(coords => {
        state.pendingGeocodes.delete(filialId)
        state.filialCoords.set(filialId, coords)
        return coords
      })

    state.pendingGeocodes.set(filialId, geocodeRequest)
    return geocodeRequest
  }

  function haversineDistanceKm(fromCoords, toCoords) {
    const [fromLat, fromLon] = fromCoords
    const [toLat, toLon] = toCoords
    const toRadians = value => (value * Math.PI) / 180
    const earthRadiusKm = 6371
    const deltaLat = toRadians(toLat - fromLat)
    const deltaLon = toRadians(toLon - fromLon)
    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLon / 2) ** 2

    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  function renderOrganizationSelect(selectedOrganizationId = 0) {
    if (!modalOrganization) return

    modalOrganization.dataset.placeholder = 'Выберите орган'
    modalOrganization.textContent = ''

    const firstOption = document.createElement('option')
    firstOption.value = ''
    firstOption.textContent = 'Выберите орган'
    modalOrganization.append(firstOption)

    state.organizations.forEach(organization => {
      const option = document.createElement('option')
      option.value = String(organization.id)
      option.textContent = formatOrganizationOptionLabel(organization)
      modalOrganization.append(option)
    })

    modalOrganization.value = selectedOrganizationId > 0 ? String(selectedOrganizationId) : ''
    rebuildCustomSelectOptions(modalOrganization.id)
  }

  function renderFilialSelect(selectedOrganizationId = getSelectedOrganizationId(), selectedFilialId = 0) {
    if (!modalFilial) return

    modalFilial.textContent = ''

    const firstOption = document.createElement('option')
    firstOption.value = ''

    if (selectedOrganizationId > 0) {
      firstOption.textContent = 'Выберите филиал'
      modalFilial.dataset.placeholder = 'Выберите филиал'
      modalFilial.disabled = false
    } else {
      firstOption.textContent = 'Сначала выберите орган'
      modalFilial.dataset.placeholder = 'Сначала выберите орган'
      modalFilial.disabled = true
    }

    modalFilial.append(firstOption)

    if (selectedOrganizationId > 0) {
      state.filials
        .filter(filial => Number(filial.organization_id) === selectedOrganizationId && Boolean(filial.is_active))
        .forEach(filial => {
          const option = document.createElement('option')
          option.value = String(filial.id)
          option.textContent = formatFilialOptionLabel(filial)
          modalFilial.append(option)
        })
    }

    modalFilial.value = selectedFilialId > 0 ? String(selectedFilialId) : ''
    if (modalFilial.value !== String(selectedFilialId)) {
      modalFilial.value = ''
    }

    rebuildCustomSelectOptions(modalFilial.id)
  }

  function applyAssignmentSelection(organizationId = 0, filialId = 0) {
    if (modalOrganization) {
      modalOrganization.value = organizationId > 0 ? String(organizationId) : ''
    }

    renderFilialSelect(organizationId, filialId)

    if (modalFilial) {
      modalFilial.value = filialId > 0 ? String(filialId) : ''
    }

    if (modalOrganization) {
      syncCustomSelectDisplay(modalOrganization.id)
    }
    if (modalFilial) {
      syncCustomSelectDisplay(modalFilial.id)
    }
  }

  async function getRenderableFilials(appealCoords, organizationId) {
    const candidateFilials = state.filials.filter(filial => {
      if (!filial?.is_active) return false
      if (organizationId > 0) {
        return Number(filial.organization_id) === organizationId
      }
      return true
    })

    const resolvedFilials = await Promise.all(
      candidateFilials.map(async filial => ({
        ...filial,
        coords: await getFilialCoords(filial),
      }))
    )

    const filialsWithCoords = resolvedFilials.filter(filial => {
      return Array.isArray(filial.coords) && filial.coords.length === 2
    })

    if (organizationId > 0) {
      return filialsWithCoords.sort((left, right) => {
        return String(left.name || '').localeCompare(String(right.name || ''), 'ru')
      })
    }

    return filialsWithCoords
      .map(filial => ({
        ...filial,
        distanceKm: haversineDistanceKm(appealCoords, filial.coords),
      }))
      .filter(filial => Number.isFinite(filial.distanceKm))
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, NEAREST_FILIALS_LIMIT)
  }

  async function renderAppealAssignmentMap() {
    const appeal = state.appealsById.get(String(state.currentAppealId))
    if (!appeal) return

    const appealCoords = getAppealCoords(appeal)
    if (!appealCoords) {
      clearAssignmentMapObjects()
      setMapHint('У заявки нет координат, поэтому карта недоступна.')
      return
    }

    const map = await ensureAssignmentMapReady()
    if (!map) return

    const renderToken = ++state.mapRenderToken
    const selectedOrganizationId = getSelectedOrganizationId()
    const selectedFilialId = getSelectedFilialId()
    const selectedOrganization = state.organizations.find(
      organization => Number(organization.id) === selectedOrganizationId
    )

    clearAssignmentMapObjects()

    const appealPlacemark = new ymaps.Placemark(
      appealCoords,
      {
        hintContent: `Заявка #${appeal.id}`,
        balloonContent: `Заявка #${appeal.id}`,
      },
      {
        preset: 'islands#redIcon',
      }
    )

    assignmentMapState.geoObjects.push(appealPlacemark)
    map.geoObjects.add(appealPlacemark)

    setMapHint(
      selectedOrganizationId > 0
        ? 'Загружаем филиалы выбранного надзорного органа...'
        : 'Подбираем ближайшие филиалы к заявке...'
    )

    const filialMarkers = await getRenderableFilials(appealCoords, selectedOrganizationId)
    if (renderToken !== state.mapRenderToken) return

    const boundsPoints = [appealCoords]
    filialMarkers.forEach(filial => {
      const placemark = new ymaps.Placemark(
        filial.coords,
        {
          hintContent: `${filial.name}${filial.region ? `, ${filial.region}` : ''}`,
          balloonContent: [
            `<strong>${filial.name}</strong>`,
            filial.region ? `<div>${filial.region}</div>` : '',
            filial.address ? `<div>${filial.address}</div>` : '',
          ].join(''),
        },
        {
          preset:
            Number(filial.id) === selectedFilialId
              ? 'islands#blueCircleDotIcon'
              : 'islands#greenCircleDotIcon',
        }
      )

      placemark.events.add('click', () => {
        applyAssignmentSelection(Number(filial.organization_id), Number(filial.id))
        renderAppealAssignmentMap().catch(() => {
          setMapHint('Не удалось обновить карту после выбора филиала.')
        })
      })

      assignmentMapState.geoObjects.push(placemark)
      map.geoObjects.add(placemark)
      boundsPoints.push(filial.coords)
    })

    if (boundsPoints.length > 1) {
      map.setBounds(ymaps.util.bounds.fromPoints(boundsPoints), {
        checkZoomRange: true,
        zoomMargin: [28, 28, 28, 28],
      })
    } else {
      map.setCenter(appealCoords, 14, { duration: 200 })
    }

    if (!filialMarkers.length) {
      setMapHint(
        selectedOrganizationId > 0
          ? 'У выбранного органа не удалось показать филиалы на карте.'
          : 'Не удалось найти ближайшие филиалы для этой заявки.'
      )
      return
    }

    if (selectedOrganizationId > 0) {
      setMapHint(
        `Показываем филиалы организации «${selectedOrganization?.name || 'Выбранный орган'}».`
      )
      return
    }

    setMapHint(`Показываем ${filialMarkers.length} ближайших филиалов к заявке.`)
  }

  function openAppealModal(appealId) {
    if (!modal) return
    const appeal = state.appealsById.get(String(appealId))
    if (!appeal) return

    state.currentAppealId = Number(appeal.id)

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
      modalUser.textContent = `Заявитель: ${appeal.user?.name || 'Не указан'}`
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

      modalPhotos.forEach((photo, index) => {
        const image = document.createElement('img')
        image.className = 'appeal-modal__image'
        image.width = MODAL_PHOTO_SIZE
        image.height = MODAL_PHOTO_SIZE
        image.loading = 'lazy'
        image.alt = `Фото заявки ${index + 1}`
        image.src = modalPhotoUrls[index]
        image.addEventListener('click', () => openPhotoLightbox(modalPhotoUrls, index))
        modalImages.append(image)
      })
      modalCarousel.scrollLeft = 0
      window.requestAnimationFrame(() => updateCarouselArrowState())
    }

    const assignment = appeal.assignment || null
    const selectedOrganizationId = Number(assignment?.organization_id || 0)
    const selectedFilialId = Number(assignment?.filial_id || 0)

    setSelectedPriorityValue(Number(appeal.priority || 1))
    renderOrganizationSelect(selectedOrganizationId)
    renderFilialSelect(selectedOrganizationId, selectedFilialId)
    closeAllCustomSelects()

    setModalMessage('')
    modal.classList.add('appeal-drawer--open')
    modal.setAttribute('aria-hidden', 'false')

    if (window.ymaps) {
      setMapHint('Подготавливаем карту...')
      renderAppealAssignmentMap().catch(() => {
        setMapHint('Не удалось отрисовать карту заявки.')
      })
    } else {
      setMapHint('Карта недоступна: API Яндекс Карт не загрузился.')
    }
  }

  function closeAppealModal() {
    if (!modal) return
    closeAllCustomSelects()
    modal.classList.remove('appeal-drawer--open')
    modal.setAttribute('aria-hidden', 'true')
    state.currentAppealId = null
    state.mapRenderToken += 1
    setModalMessage('')
  }

  function syncDashboardAfterAppealUpdate(appealId, updatedAppeal) {
    if (!Number.isFinite(Number(appealId)) || !updatedAppeal || typeof updatedAppeal !== 'object') {
      return
    }

    const targetId = Number(appealId)
    const nextStatus = String(updatedAppeal.status || '')
    let statusChangedFromPending = false

    state.dashboardAppeals = state.dashboardAppeals.map(appeal => {
      if (Number(appeal?.id || 0) !== targetId) {
        return appeal
      }

      const previousStatus = String(appeal?.status || 'pending')
      if (previousStatus === 'pending' && nextStatus && nextStatus !== 'pending') {
        statusChangedFromPending = true
      }

      return {
        ...appeal,
        ...updatedAppeal,
        assignment:
          updatedAppeal.assignment !== undefined ? updatedAppeal.assignment : appeal.assignment || null,
        priority: Number(updatedAppeal.priority ?? appeal.priority ?? 0),
        status: nextStatus || previousStatus,
      }
    })

    if (statusChangedFromPending) {
      state.dashboardStats = {
        ...state.dashboardStats,
        new: Math.max(0, Number(state.dashboardStats?.new || 0) - 1),
        assigned: Math.max(0, Number(state.dashboardStats?.assigned || 0) - 1),
      }
    }

    renderStats(state.dashboardStats)
    renderAppeals(state.dashboardAppeals)
  }

  async function saveAppealModal() {
    const appealId = state.currentAppealId
    if (!appealId) return

    const priority = getSelectedPriorityValue()
    const organizationId = getSelectedOrganizationId()
    const filialId = getSelectedFilialId()

    if (!Number.isInteger(priority) || priority < 1 || priority > 5) {
      setModalMessage('Приоритет должен быть числом от 1 до 5.', true)
      return
    }

    if ((organizationId > 0 && filialId <= 0) || (organizationId <= 0 && filialId > 0)) {
      setModalMessage('Для назначения нужно выбрать и орган, и филиал.', true)
      return
    }

    if (modalSave) {
      modalSave.disabled = true
    }

    setModalMessage('Сохранение...')

    try {
      const updated = await updateAppeal(appealId, priority, organizationId || null, filialId || null)
      syncDashboardAfterAppealUpdate(appealId, updated)

      setModalMessage('Изменения сохранены.')
      window.setTimeout(() => closeAppealModal(), 450)
    } catch (error) {
      setModalMessage(error.message || 'Не удалось сохранить изменения.', true)
    } finally {
      if (modalSave) {
        modalSave.disabled = false
      }
    }
  }

  function setupModalHandlers() {
    modalClose?.addEventListener('click', closeAppealModal)
    modalCancel?.addEventListener('click', closeAppealModal)
    modalSave?.addEventListener('click', saveAppealModal)

    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return
      if (photoLightbox && !photoLightbox.hidden) return
      closeAllCustomSelects()
    })
  }

  function setupAssignmentFormHandlers() {
    modalOrganization?.addEventListener('change', () => {
      renderFilialSelect(getSelectedOrganizationId())
      renderAppealAssignmentMap().catch(() => {
        setMapHint('Не удалось обновить карту после выбора органа.')
      })
    })

    modalFilial?.addEventListener('change', () => {
      renderAppealAssignmentMap().catch(() => {
        setMapHint('Не удалось обновить карту после выбора филиала.')
      })
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

  async function ensureAdmin() {
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

    if (data.user.role === 'superadmin') {
      window.location.replace('superadmin.html')
      throw new Error('__redirect_superadmin__')
    }

    if (data.user.role === 'admin' && data.user.auth_source === 'org_admins') {
      window.location.replace('agent.html')
      throw new Error('__redirect_agent__')
    }

    if (data.user.role !== 'admin') {
      window.location.replace('map.html')
      throw new Error('__redirect_non_admin__')
    }

    return data.user
  }

  async function loadDashboardData() {
    const response = await fetch('backend/admin_dashboard.php', {
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
        window.location.replace('agent.html')
        throw new Error('__redirect_non_admin__')
      }
      throw new Error(data.message || 'Не удалось загрузить данные панели')
    }

    return data
  }

  async function updateAppeal(appealId, priority, organizationId, filialId) {
    const response = await fetch('backend/admin_update_appeal.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        appeal_id: appealId,
        priority,
        organization_id: organizationId,
        filial_id: filialId,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'Ошибка обновления заявки')
    }

    return data.appeal || { priority }
  }

  function setupSidebarActions() {
    const sidebarBrand = document.querySelector('.sidebar-brand')
    const logout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('index.html')
    }

    const navButtons = document.querySelectorAll('.sidebar-nav-item[data-href], .sidebar-nav-item[data-action]')
    if (sidebarBrand) {
      sidebarBrand.addEventListener('click', () => {
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
          window.location.href = href
        }
      })
    })
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

    sidebarToggle.addEventListener('click', toggleSidebar)
  }

  function setupProfileBadge(user) {
    const displayName = getUserDisplayName(user)
    if (sidebarAvatar) sidebarAvatar.textContent = getInitials(displayName)
    if (sidebarProfileName) sidebarProfileName.textContent = displayName
    if (sidebarProfileLevel) sidebarProfileLevel.textContent = 'Администратор'
  }

  async function init() {
    setupSidebarActions()
    setupSidebarToggle()
    setupProfileModal()
    setupAppealsGridLayout()
    setupCustomSelects()
    setupAppealCarousel()
    setupPhotoLightbox()
    setupModalHandlers()
    setupAssignmentFormHandlers()
    setupAppealCardsHandler()

    try {
      const authUser = await ensureAdmin()
      const dashboard = await loadDashboardData()
      const dashboardUser = dashboard?.user || authUser
      currentUser = dashboardUser

      state.organizations = Array.isArray(dashboard?.organizations) ? dashboard.organizations : []
      state.filials = Array.isArray(dashboard?.filials) ? dashboard.filials : []
      state.dashboardStats = dashboard?.stats && typeof dashboard.stats === 'object' ? dashboard.stats : {}
      state.dashboardAppeals = Array.isArray(dashboard?.appeals) ? dashboard.appeals : []

      renderOrganizationSelect()
      renderFilialSelect()

      setupProfileBadge(dashboardUser)
      renderStats(state.dashboardStats)
      renderAppeals(state.dashboardAppeals)
    } catch (error) {
      if (
        error?.message === '__redirect_login__' ||
        error?.message === '__redirect_non_admin__' ||
        error?.message === '__redirect_superadmin__' ||
        error?.message === '__redirect_agent__'
      ) {
        return
      }

      currentUser = null
      setupProfileBadge({})
      renderStats({})
      renderErrorState(error?.message || 'Не удалось загрузить данные.')
    }
  }

  init()
})()
