;(() => {
  const token = localStorage.getItem('token')

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

  const modalMessage = document.getElementById('appealModalMessage')

  const MODAL_PHOTO_SIZE = 180

  /** Базовая ширина карточки: min(400px, 25vw); минимум колонки 330px */
  const APPEAL_CARD_MIN_PX = 330
  const APPEAL_CARD_BASE_CAP_PX = 400
  const APPEAL_CARD_BASE_VW_RATIO = 0.25

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
  }

  const lightboxState = {
    urls: [],
    index: 0,
  }

  let agencyDropdownOpen = false
  let lightboxTouchStartX = 0

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

    setSelectedPriorityValue(Number(appeal.priority || 0))

    if (modalAgency) {
      modalAgency.value = ''
    }
    syncAgencyDisplayFromSelect()
    closeAgencyDropdown()

    setModalMessage('')
    modal.classList.add('appeal-drawer--open')
    modal.setAttribute('aria-hidden', 'false')
  }

  function closeAppealModal() {
    if (!modal) return
    closeAgencyDropdown()
    modal.classList.remove('appeal-drawer--open')
    modal.setAttribute('aria-hidden', 'true')
    state.currentAppealId = null
    setModalMessage('')
  }

  async function saveAppealModal() {
    const appealId = state.currentAppealId
    if (!appealId) return

    const priority = getSelectedPriorityValue()
    const agencyName = String(modalAgency?.value || '')

    if (!Number.isInteger(priority) || priority < 0 || priority > 5) {
      setModalMessage('Приоритет должен быть числом от 0 до 5.', true)
      return
    }

    if (modalSave) {
      modalSave.disabled = true
    }

    setModalMessage('Сохранение...')

    try {
      const updated = await updateAppeal(appealId, priority, agencyName)
      const current = state.appealsById.get(String(appealId))
      if (current) {
        current.priority = updated.priority
        state.appealsById.set(String(appealId), current)
      }

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
        window.location.replace('map.html')
        throw new Error('__redirect_non_admin__')
      }
      throw new Error(data.message || 'Не удалось загрузить данные панели')
    }

    return data
  }

  async function updateAppeal(appealId, priority, agencyName) {
    const response = await fetch('backend/admin_update_appeal.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        appeal_id: appealId,
        priority,
        agency_name: agencyName,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      throw new Error(data.message || 'Ошибка обновления заявки')
    }

    return data.appeal || { priority }
  }

  function setupSidebarActions() {
    const logout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('index.html')
    }

    const navButtons = document.querySelectorAll('.sidebar-nav-item[data-href], .sidebar-nav-item[data-action]')
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

    const setSidebarExpanded = expanded => {
      sidebar.classList.toggle('sidebar--expanded', expanded)
      sidebarToggle.setAttribute('aria-expanded', String(expanded))
      sidebarToggle.setAttribute(
        'aria-label',
        expanded ? 'Свернуть панель' : 'Развернуть панель'
      )
    }

    setSidebarExpanded(sidebar.classList.contains('sidebar--expanded'))

    const toggleSidebar = () => {
      setSidebarExpanded(!sidebar.classList.contains('sidebar--expanded'))
    }

    sidebarToggle.addEventListener('click', toggleSidebar)
    sidebar.addEventListener('click', event => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('button, a, input, select, textarea, label, [role="button"]')) {
        return
      }
      toggleSidebar()
    })
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
    setupAppealsGridLayout()
    setupAgencyCustomSelect()
    setupAppealCarousel()
    setupPhotoLightbox()
    setupModalHandlers()
    setupAppealCardsHandler()

    try {
      const authUser = await ensureAdmin()
      const dashboard = await loadDashboardData()
      const dashboardUser = dashboard?.user || authUser

      setupProfileBadge(dashboardUser)
      renderStats(dashboard?.stats || {})
      renderAppeals(dashboard?.appeals || [])
    } catch (error) {
      if (
        error?.message === '__redirect_login__' ||
        error?.message === '__redirect_non_admin__' ||
        error?.message === '__redirect_superadmin__'
      ) {
        return
      }

      setupProfileBadge({})
      renderStats({})
      renderErrorState(error?.message || 'Не удалось загрузить данные.')
    }
  }

  init()
})()
