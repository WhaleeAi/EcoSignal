;(() => {
  const token = localStorage.getItem('token')

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileName = document.getElementById('sidebarProfileName')
  const sidebarProfileLevel = document.getElementById('sidebarProfileLevel')
  const organizationMeta = document.getElementById('organizationMeta')
  const workspace = document.querySelector('.admin-workspace')
  const appealsSection = document.getElementById('appealsSection')
  const appealsGrid = document.getElementById('appealsGrid')

  const modal = document.getElementById('appealModal')
  const modalClose = document.getElementById('appealModalClose')
  const modalCancel = document.getElementById('appealModalCancel')
  const modalSave = document.getElementById('appealModalSave')
  const modalTitle = document.getElementById('appealModalTitle')
  const modalCategory = document.getElementById('appealModalCategory')
  const modalSubcategory = document.getElementById('appealModalSubcategory')
  const modalUser = document.getElementById('appealModalUser')
  const modalDescription = document.getElementById('appealModalDescription')
  const modalImages = document.getElementById('appealModalImages')
  const modalCarousel = document.getElementById('appealModalCarousel')
  const modalCarouselPrev = document.getElementById('appealModalCarouselPrev')
  const modalCarouselNext = document.getElementById('appealModalCarouselNext')
  const modalPriorityRadios = document.querySelectorAll('input[name="appealModalPriority"]')
  const modalOrganization = document.getElementById('appealModalOrganization')
  const modalOrganizationTrigger = document.getElementById('appealModalOrganizationTrigger')
  const modalOrganizationDisplay = document.getElementById('appealModalOrganizationDisplay')
  const modalFilial = document.getElementById('appealModalFilial')
  const modalFilialTrigger = document.getElementById('appealModalFilialTrigger')
  const modalFilialDisplay = document.getElementById('appealModalFilialDisplay')
  const modalNote = document.getElementById('appealModalNote')
  const modalMessage = document.getElementById('appealModalMessage')
  const agentStatusCurrent = document.getElementById('agentStatusCurrent')
  const agentStatusRadios = document.querySelectorAll('input[name="agentStatusOption"]')
  const agentFeedbackInput = document.getElementById('agentFeedbackInput')

  const chatDrawer = document.getElementById('appealChat')
  const chatClose = document.getElementById('appealChatClose')
  const chatTitle = document.getElementById('appealChatTitle')
  const chatEmpty = document.getElementById('appealChatEmpty')
  const chatList = document.getElementById('appealChatList')
  const chatComposer = document.getElementById('appealChatComposer')
  const chatInput = document.getElementById('appealChatInput')
  const chatSend = document.getElementById('appealChatSend')

  const photoLightbox = document.getElementById('photoLightbox')
  const photoLightboxBackdrop = document.getElementById('photoLightboxBackdrop')
  const photoLightboxClose = document.getElementById('photoLightboxClose')
  const photoLightboxPrev = document.getElementById('photoLightboxPrev')
  const photoLightboxNext = document.getElementById('photoLightboxNext')
  const photoLightboxImg = document.getElementById('photoLightboxImg')
  const photoLightboxCounter = document.getElementById('photoLightboxCounter')
  const photoLightboxStage = document.querySelector('.photo-lightbox__stage')

  const APPEAL_CARD_MIN_PX = 330
  const APPEAL_CARD_BASE_CAP_PX = 400
  const APPEAL_CARD_BASE_VW_RATIO = 0.25
  const MODAL_PHOTO_SIZE = 180

  const PHOTO_PALETTE = [
    ['#f4dca1', '#d3bd8a'],
    ['#bfd7bf', '#97b798'],
    ['#b6d4dd', '#8db5c0'],
    ['#e5d0bc', '#c9aa90'],
    ['#d3c8f1', '#b0a0df'],
    ['#f1c8cd', '#e3a8b1'],
  ]

  const STATUS_LABELS = {
    confirmed: 'Подтверждена',
    in_progress: 'В работе',
    resolved: 'Решена',
    rejected: 'Отклонена',
    pending: 'Новая',
  }

  const state = {
    user: null,
    appeals: [],
    appealsById: new Map(),
    currentAppealId: null,
    detailRequestId: 0,
  }

  const lightboxState = {
    urls: [],
    index: 0,
  }

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

  function getUserDisplayName(user) {
    if (!user || typeof user !== 'object') return 'Агент'
    if (user.name) return String(user.name)
    if (user.login) return String(user.login)
    return 'Агент'
  }

  function formatOrgLabel(user) {
    if (!user) return 'Организация: —'
    const orgName = user.organization_name || '—'
    const filial = user.filial_name
      ? ` • ${user.filial_name}${user.filial_region ? `, ${user.filial_region}` : ''}`
      : ''
    return `Организация: ${orgName}${filial}`
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

  function setReadOnlySelect(select, trigger, display, value, label, placeholder) {
    if (select) {
      select.innerHTML = ''
      const option = document.createElement('option')
      option.value = value ? String(value) : ''
      option.textContent = label || placeholder
      option.selected = true
      select.append(option)
      select.disabled = true
    }

    if (display) display.textContent = label || placeholder
    if (trigger) {
      trigger.disabled = true
      trigger.setAttribute('aria-expanded', 'false')
    }
  }

  function setSelectedPriorityValue(value) {
    const target = String(Number.isFinite(value) ? value : 1)
    let applied = false
    modalPriorityRadios.forEach(input => {
      const checked = input.value === target
      input.checked = checked
      if (checked) applied = true
      input.disabled = true
    })
    if (!applied && modalPriorityRadios[0]) {
      modalPriorityRadios[0].checked = true
    }
  }

  function getSelectedStatusValue() {
    const selected = Array.from(agentStatusRadios).find(input => input.checked)
    return selected ? String(selected.value || '') : ''
  }

  function setSelectedStatusValue(value) {
    const target = String(value || '')
    agentStatusRadios.forEach(input => {
      input.checked = target !== '' && input.value === target
    })
  }

  function appealCardBaseWidthPx() {
    return Math.min(APPEAL_CARD_BASE_CAP_PX, window.innerWidth * APPEAL_CARD_BASE_VW_RATIO)
  }

  function computeAppealsGridTemplateColumns(containerWidth) {
    if (workspace?.classList.contains('admin-workspace--agent-panels-open')) {
      return 'repeat(1, minmax(0, 1fr))'
    }

    const width = Math.floor(containerWidth)
    const base = appealCardBaseWidthPx()
    const tripleBase = 3 * base
    const tripleMin = 3 * APPEAL_CARD_MIN_PX
    const doubleMin = 2 * APPEAL_CARD_MIN_PX

    if (width >= tripleBase) return `repeat(3, minmax(${base}px, 1fr))`
    if (width >= tripleMin) return `repeat(3, minmax(${APPEAL_CARD_MIN_PX}px, 1fr))`
    if (width >= doubleMin) return `repeat(2, minmax(${APPEAL_CARD_MIN_PX}px, 1fr))`
    return 'repeat(1, minmax(0, 1fr))'
  }

  function layoutAppealsGrid() {
    if (!appealsGrid || !appealsSection) return
    appealsGrid.style.gridTemplateColumns = computeAppealsGridTemplateColumns(appealsSection.clientWidth)
  }

  function setupAppealsGridLayout() {
    layoutAppealsGrid()

    if (typeof ResizeObserver !== 'undefined' && appealsSection) {
      const observer = new ResizeObserver(() => layoutAppealsGrid())
      observer.observe(appealsSection)
    }

    window.addEventListener('resize', layoutAppealsGrid)
  }

  function createAppealCard(appeal) {
    const card = document.createElement('article')
    card.className = 'appeal-card'
    card.dataset.appealId = String(appeal.id)

    const statusClass = {
      confirmed: 'appeal-card--status-confirmed',
      in_progress: 'appeal-card--status-in-progress',
      resolved: 'appeal-card--status-resolved',
      rejected: 'appeal-card--status-rejected',
    }[String(appeal.status || '')]

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

    const rawImages = Array.isArray(appeal.images) ? appeal.images.slice(0, 3) : []
    while (rawImages.length < 3) rawImages.push({ label: String(rawImages.length + 1) })

    const photoUrls = rawImages.map((image, index) => image.url || createMiniPhotoUrl(image.label || index + 1, index))

    rawImages.forEach((image, index) => {
      const photo = document.createElement('img')
      photo.className = 'appeal-card__photo'
      photo.width = 44
      photo.height = 44
      photo.alt = `Фото заявки ${index + 1}`
      photo.src = photoUrls[index]
      photo.addEventListener('click', event => {
        event.stopPropagation()
        openPhotoLightbox(photoUrls, index)
      })
      photosRow.append(photo)
    })

    const category = document.createElement('p')
    category.className = 'appeal-card__category'
    category.textContent = `${String(appeal.category || 'Категория')}, ${String(
      appeal.subcategory || 'Без подкатегории'
    )}`

    const description = document.createElement('p')
    description.className = 'appeal-card__description'
    description.textContent = String(appeal.description || '')

    topRow.append(userRow, photosRow)
    card.append(topRow, category, description)
    return card
  }

  function renderAppeals(appeals) {
    if (!appealsGrid) return

    appealsGrid.textContent = ''
    state.appealsById.clear()
    state.appeals = Array.isArray(appeals) ? appeals : []

    if (!state.appeals.length) {
      const emptyState = document.createElement('p')
      emptyState.className = 'appeals-empty'
      emptyState.textContent = 'У вас пока нет назначенных заявок со статусом кроме pending.'
      appealsGrid.append(emptyState)
      layoutAppealsGrid()
      return
    }

    state.appeals.forEach(appeal => {
      state.appealsById.set(String(appeal.id), appeal)
      appealsGrid.append(createAppealCard(appeal))
    })

    layoutAppealsGrid()
  }

  function renderErrorState(message) {
    if (!appealsGrid) return
    appealsGrid.textContent = ''
    const errorText = document.createElement('p')
    errorText.className = 'appeals-empty'
    errorText.textContent = message
    appealsGrid.append(errorText)
    layoutAppealsGrid()
  }

  function updateLightboxView() {
    if (!photoLightboxImg || !lightboxState.urls.length) return

    photoLightboxImg.src = lightboxState.urls[lightboxState.index]
    photoLightboxImg.alt = `Фото ${lightboxState.index + 1} из ${lightboxState.urls.length}`

    if (photoLightboxCounter) {
      photoLightboxCounter.textContent =
        lightboxState.urls.length > 1 ? `${lightboxState.index + 1} / ${lightboxState.urls.length}` : ''
    }

    const hasMultiple = lightboxState.urls.length > 1
    if (photoLightboxPrev) photoLightboxPrev.hidden = !hasMultiple
    if (photoLightboxNext) photoLightboxNext.hidden = !hasMultiple
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
    photoLightboxImg?.removeAttribute('src')
  }

  function lightboxStep(delta) {
    const count = lightboxState.urls.length
    if (count <= 1) return
    lightboxState.index = (lightboxState.index + delta + count) % count
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
        if (!lightboxTouchStartX || event.changedTouches.length !== 1) return
        const delta = event.changedTouches[0].clientX - lightboxTouchStartX
        if (Math.abs(delta) >= 35) {
          lightboxStep(delta < 0 ? 1 : -1)
        }
        lightboxTouchStartX = 0
      },
      { passive: true }
    )
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

    const atStart = modalCarousel.scrollLeft <= 2
    const atEnd = modalCarousel.scrollLeft >= maxScroll - 2

    if (modalCarouselPrev) {
      modalCarouselPrev.hidden = atStart
      modalCarouselPrev.disabled = atStart
    }
    if (modalCarouselNext) {
      modalCarouselNext.hidden = atEnd
      modalCarouselNext.disabled = atEnd
    }
  }

  function normalizeCarouselWheelDelta(event) {
    let x = event.deltaX
    let y = event.deltaY

    if (event.deltaMode === 1) {
      x *= 16
      y *= 16
    } else if (event.deltaMode === 2 && modalCarousel) {
      x *= modalCarousel.clientWidth
      y *= modalCarousel.clientHeight
    }

    return Math.abs(x) > Math.abs(y) ? x : y
  }

  function setupAppealCarousel() {
    if (!modalCarousel) return

    modalCarousel.addEventListener(
      'wheel',
      event => {
        if (event.ctrlKey || modalCarousel.scrollWidth <= modalCarousel.clientWidth) return
        const delta = normalizeCarouselWheelDelta(event)
        if (!delta) return
        event.preventDefault()
        modalCarousel.scrollLeft += delta
        updateCarouselArrowState()
      },
      { passive: false }
    )

    modalCarousel.addEventListener('scroll', updateCarouselArrowState, { passive: true })

    const step = () => Math.min(220, MODAL_PHOTO_SIZE + 40)

    modalCarouselPrev?.addEventListener('click', () => {
      modalCarousel.scrollBy({ left: -step(), behavior: 'smooth' })
      window.setTimeout(updateCarouselArrowState, 350)
    })

    modalCarouselNext?.addEventListener('click', () => {
      modalCarousel.scrollBy({ left: step(), behavior: 'smooth' })
      window.setTimeout(updateCarouselArrowState, 350)
    })

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateCarouselArrowState())
      observer.observe(modalCarousel)
    }
  }

  function setPanelsOpen(open) {
    workspace?.classList.toggle('admin-workspace--agent-panels-open', open)
    modal?.classList.toggle('appeal-drawer--open', open)
    chatDrawer?.classList.toggle('agent-chat-drawer--open', open)
    modal?.setAttribute('aria-hidden', String(!open))
    chatDrawer?.setAttribute('aria-hidden', String(!open))
    layoutAppealsGrid()
  }

  function closeAppealWorkspace() {
    state.detailRequestId += 1
    state.currentAppealId = null
    setPanelsOpen(false)
    setModalMessage('')
    renderChat([])
    if (chatInput) {
      chatInput.value = ''
      resizeChatInput()
    }
    if (agentFeedbackInput) agentFeedbackInput.value = ''
  }

  function formatAssignmentNote(appeal) {
    const assignment = appeal?.assignment || null
    const chunks = [`Статус: ${STATUS_LABELS[String(appeal?.status || '')] || '—'}.`]

    if (assignment?.organization_name) {
      chunks.push(`Орган: ${assignment.organization_name}.`)
    }

    if (assignment?.filial_name) {
      const filialLabel = assignment.filial_region
        ? `${assignment.filial_name} (${assignment.filial_region})`
        : assignment.filial_name
      chunks.push(`Филиал: ${filialLabel}.`)
    }

    if (assignment?.responsible_org_admin_login) {
      chunks.push(`Ответственный агент: ${assignment.responsible_org_admin_login}.`)
    }

    if (appeal?.assigned_at) {
      chunks.push(`Назначена: ${formatDateTime(appeal.assigned_at)}.`)
    }

    return chunks.join(' ')
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

      const head = document.createElement('div')
      head.className = 'agent-chat__message-head'

      const author = document.createElement('p')
      author.className = 'agent-chat__message-author'
      author.textContent = String(message.sender_name || (message.sender_type === 'agent' ? 'Агент' : 'Житель'))

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

  function populateModal(appeal) {
    if (!appeal) return

    if (modalTitle) modalTitle.textContent = `Заявка #${appeal.id}`
    if (chatTitle) chatTitle.textContent = `Чат по заявке #${appeal.id}`
    if (modalCategory) modalCategory.textContent = String(appeal.category || 'Категория')
    if (modalSubcategory) modalSubcategory.textContent = String(appeal.subcategory || 'Без подкатегории')
    if (modalUser) modalUser.textContent = `Заявитель: ${appeal.user?.name || 'Не указан'}`
    if (modalDescription) modalDescription.textContent = String(appeal.description || '')
    if (agentStatusCurrent) {
      agentStatusCurrent.textContent = `Текущий статус: ${STATUS_LABELS[String(appeal.status || '')] || '—'}`
    }
    setSelectedStatusValue(appeal.status)
    if (agentFeedbackInput) agentFeedbackInput.value = ''

    setSelectedPriorityValue(Number(appeal.priority || 1))

    const assignment = appeal.assignment || null
    setReadOnlySelect(
      modalOrganization,
      modalOrganizationTrigger,
      modalOrganizationDisplay,
      assignment?.organization_id || '',
      assignment?.organization_name || '',
      'Орган не назначен'
    )

    setReadOnlySelect(
      modalFilial,
      modalFilialTrigger,
      modalFilialDisplay,
      assignment?.filial_id || '',
      assignment
        ? assignment.filial_region
          ? `${assignment.filial_name} (${assignment.filial_region})`
          : String(assignment.filial_name || '')
        : '',
      'Филиал не назначен'
    )

    if (modalNote) {
      modalNote.textContent = formatAssignmentNote(appeal)
    }

    if (modalImages) {
      modalImages.textContent = ''
      const rawImages = Array.isArray(appeal.images) ? appeal.images.slice(0, 3) : []
      while (rawImages.length < 3) rawImages.push({ label: String(rawImages.length + 1) })

      const photoUrls = rawImages.map((image, index) => {
        return image.url || createMiniPhotoUrl(image.label || index + 1, index, MODAL_PHOTO_SIZE)
      })

      rawImages.forEach((image, index) => {
        const photo = document.createElement('img')
        photo.className = 'appeal-modal__image'
        photo.width = MODAL_PHOTO_SIZE
        photo.height = MODAL_PHOTO_SIZE
        photo.loading = 'lazy'
        photo.alt = `Фото заявки ${index + 1}`
        photo.src = photoUrls[index]
        photo.addEventListener('click', () => openPhotoLightbox(photoUrls, index))
        modalImages.append(photo)
      })

      if (modalCarousel) modalCarousel.scrollLeft = 0
      window.requestAnimationFrame(() => updateCarouselArrowState())
    }

    setModalMessage('')
  }

  async function ensureAgent() {
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

    if (data.user.role === 'admin' && data.user.auth_source !== 'org_admins') {
      window.location.replace('admin.html')
      throw new Error('__redirect_admin__')
    }

    if (data.user.role !== 'admin' || data.user.auth_source !== 'org_admins') {
      window.location.replace('map.html')
      throw new Error('__redirect_non_agent__')
    }

    return data.user
  }

  async function fetchMyAppeals() {
    const response = await fetch('backend/agent_my_appeals.php', {
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
        window.location.replace('admin.html')
        throw new Error('__redirect_admin__')
      }

      throw new Error(data.message || 'Не удалось загрузить обращения агента')
    }

    return data
  }

  async function fetchAppealDetails(appealId) {
    const response = await fetch(`backend/agent_appeal_details.php?appeal_id=${encodeURIComponent(appealId)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось загрузить детали заявки')
    }

    return data
  }

  async function updateAppeal(appealId, status, feedback) {
    const response = await fetch('backend/agent_update_appeal.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        appeal_id: appealId,
        status,
        feedback,
      }),
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось сохранить изменения')
    }

    return data
  }

  function renderHeader(user) {
    const displayName = getUserDisplayName(user)
    if (sidebarAvatar) sidebarAvatar.textContent = getInitials(displayName)
    if (sidebarProfileName) sidebarProfileName.textContent = displayName
    if (sidebarProfileLevel) sidebarProfileLevel.textContent = 'Агент'
    if (organizationMeta) organizationMeta.textContent = formatOrgLabel(user)
  }

  async function refreshAppeals(keepAppealId = null) {
    const data = await fetchMyAppeals()
    state.user = data.user || state.user
    renderHeader(state.user)
    renderAppeals(data.appeals || [])

    if (keepAppealId && state.appealsById.has(String(keepAppealId))) {
      await openAppealWorkspace(keepAppealId)
      return
    }

    if (keepAppealId) {
      closeAppealWorkspace()
    }
  }

  async function openAppealWorkspace(appealId) {
    if (chatInput) {
      chatInput.value = ''
      resizeChatInput()
    }

    const requestId = ++state.detailRequestId
    state.currentAppealId = Number(appealId)
    setPanelsOpen(true)
    setModalMessage('Загрузка...')
    renderChat([])

    try {
      const payload = await fetchAppealDetails(appealId)
      if (requestId !== state.detailRequestId) return

      const appeal = payload.appeal || null
      if (!appeal) {
        throw new Error('Заявка не найдена')
      }

      state.appealsById.set(String(appeal.id), appeal)
      populateModal(appeal)
      renderChat(payload.chat || [])
    } catch (error) {
      if (requestId !== state.detailRequestId) return
      setModalMessage(error.message || 'Не удалось загрузить детали заявки', true)
    }
  }

  async function saveAppealChanges() {
    const appealId = state.currentAppealId
    if (!appealId) return

    const nextStatus = getSelectedStatusValue()
    const feedback = String(agentFeedbackInput?.value || '').trim()

    if (!nextStatus && !feedback) {
      setModalMessage('Укажите новый статус или добавьте сообщение в чат.', true)
      return
    }

    if (modalSave) modalSave.disabled = true
    setModalMessage('Сохранение...')

    try {
      await updateAppeal(appealId, nextStatus, feedback)
      if (agentFeedbackInput) agentFeedbackInput.value = ''
      await refreshAppeals(appealId)
      setModalMessage('Изменения сохранены.')
    } catch (error) {
      setModalMessage(error.message || 'Не удалось сохранить изменения.', true)
    } finally {
      if (modalSave) modalSave.disabled = false
    }
  }

  async function sendChatMessage() {
    const appealId = state.currentAppealId
    const message = String(chatInput?.value || '').trim()

    if (!appealId || !message) {
      chatInput?.focus()
      return
    }

    setChatComposerDisabled(true)

    try {
      await updateAppeal(appealId, '', message)
      if (chatInput) {
        chatInput.value = ''
        resizeChatInput()
      }

      const payload = await fetchAppealDetails(appealId)
      if (state.currentAppealId !== appealId) return

      if (payload.appeal) {
        state.appealsById.set(String(payload.appeal.id), payload.appeal)
        populateModal(payload.appeal)
      }
      renderChat(payload.chat || [])
      setModalMessage('')
    } catch (error) {
      setModalMessage(error.message || 'РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ.', true)
    } finally {
      setChatComposerDisabled(false)
      chatInput?.focus()
    }
  }

  function setupAppealCardsHandler() {
    appealsGrid?.addEventListener('click', event => {
      const target = event.target
      if (!(target instanceof Element)) return

      const card = target.closest('.appeal-card')
      if (!card) return

      const appealId = card.getAttribute('data-appeal-id')
      if (!appealId) return
      openAppealWorkspace(appealId)
    })
  }

  function setupSidebarActions() {
    const logout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('index.html')
    }

    document.querySelectorAll('.sidebar-nav-item[data-href], .sidebar-nav-item[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action')
        if (action === 'logout') {
          logout()
          return
        }

        const href = button.getAttribute('data-href')
        if (href) window.location.href = href
      })
    })
  }

  function setupSidebarToggle() {
    if (!sidebar || !sidebarToggle) return

    const setSidebarExpanded = expanded => {
      sidebar.classList.toggle('sidebar--expanded', expanded)
      sidebarToggle.setAttribute('aria-expanded', String(expanded))
      sidebarToggle.setAttribute('aria-label', expanded ? 'Свернуть панель' : 'Развернуть панель')
    }

    setSidebarExpanded(sidebar.classList.contains('sidebar--expanded'))

    const toggleSidebar = () => setSidebarExpanded(!sidebar.classList.contains('sidebar--expanded'))

    sidebarToggle.addEventListener('click', toggleSidebar)
    sidebar.addEventListener('click', event => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('button, a, input, select, textarea, label, [role="button"]')) return
      toggleSidebar()
    })
  }

  function setupModalHandlers() {
    modalClose?.addEventListener('click', closeAppealWorkspace)
    modalCancel?.addEventListener('click', closeAppealWorkspace)
    chatClose?.addEventListener('click', closeAppealWorkspace)
    modalSave?.addEventListener('click', saveAppealChanges)
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
      if (event.key === 'Escape') {
        if (photoLightbox && !photoLightbox.hidden) {
          closePhotoLightbox()
          return
        }

        if (state.currentAppealId !== null) {
          closeAppealWorkspace()
        }
        return
      }

      if (photoLightbox?.hidden) return
      if (event.key === 'ArrowLeft') lightboxStep(-1)
      if (event.key === 'ArrowRight') lightboxStep(1)
    })
  }

  async function init() {
    setupSidebarActions()
    setupSidebarToggle()
    setupAppealsGridLayout()
    setupAppealCardsHandler()
    setupAppealCarousel()
    setupPhotoLightbox()
    setupModalHandlers()

    try {
      const authUser = await ensureAgent()
      state.user = authUser
      renderHeader(authUser)
      await refreshAppeals()
    } catch (error) {
      if (
        error?.message === '__redirect_login__' ||
        error?.message === '__redirect_superadmin__' ||
        error?.message === '__redirect_admin__' ||
        error?.message === '__redirect_non_agent__'
      ) {
        return
      }

      renderHeader({})
      renderErrorState(error?.message || 'Не удалось загрузить данные агента.')
    }
  }

  init()
})()
