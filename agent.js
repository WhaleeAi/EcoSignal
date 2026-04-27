;(() => {
  const token = localStorage.getItem('token')
  const SIDEBAR_STORAGE_KEY = 'ecosignalSidebarExpanded'

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const appealsGrid = document.getElementById('appealsGrid')
  const appealsSection = document.getElementById('appealsSection')
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileButton = document.getElementById('sidebarProfileButton')
  const sidebarProfileName = document.getElementById('sidebarProfileName')
  const sidebarProfileLevel = document.getElementById('sidebarProfileLevel')
  const organizationMeta = document.getElementById('organizationMeta')
  const chartSummary = document.getElementById('chartSummary')
  const agentChart = document.getElementById('agentChart')
  const mapSummary = document.getElementById('mapSummary')
  const agentMap = document.getElementById('agentMap')
  const agentMapEmpty = document.getElementById('agentMapEmpty')

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
  const profileModalMessage = document.getElementById('profileModalMessage')
  const profileFullName = document.getElementById('profileFullName')
  const profileEmailLabel = document.getElementById('profileEmailLabel')
  const profileEmail = document.getElementById('profileEmail')
  const profilePassword = document.getElementById('profilePassword')
  const profileAbout = document.getElementById('profileAbout')
  const profileRole = document.getElementById('profileRole')
  const profileCreatedAt = document.getElementById('profileCreatedAt')
  const profileModalSave = document.getElementById('profileModalSave')

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
    user: null,
    chart: [],
    appeals: [],
    placemarks: [],
  }

  const lightboxState = {
    urls: [],
    index: 0,
  }

  let map = null
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

  function getUserDisplayName(user) {
    if (!user || typeof user !== 'object') return 'Агент'
    if (user.name) return String(user.name)
    if (user.login) return String(user.login)
    if (user.email) return String(user.email)
    return 'Агент'
  }

  function formatOrgLabel(user) {
    if (!user) return 'Организация: —'

    const orgName = user.organization_name || '—'
    const orgType = user.organization_type ? ` (${user.organization_type})` : ''
    const filial = user.filial_name
      ? ` • ${user.filial_name}${user.filial_region ? `, ${user.filial_region}` : ''}`
      : ''
    return `Организация: ${orgName}${orgType}${filial}`
  }

  function formatChartDayLabel(value) {
    const date = new Date(`${value}T00:00:00`)
    if (Number.isNaN(date.getTime())) return value

    return new Intl.DateTimeFormat('ru-RU', {
      day: '2-digit',
      month: '2-digit',
    }).format(date)
  }

  function computeNiceChartMax(maxValue) {
    if (!Number.isFinite(maxValue) || maxValue <= 0) return 5

    const magnitude = 10 ** Math.floor(Math.log10(maxValue))
    const normalized = maxValue / magnitude

    if (normalized <= 1) return 1 * magnitude
    if (normalized <= 2) return 2 * magnitude
    if (normalized <= 5) return 5 * magnitude
    return 10 * magnitude
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

    document.addEventListener('keydown', event => {
      if (photoLightbox?.hidden) return
      if (event.key === 'Escape') closePhotoLightbox()
      if (event.key === 'ArrowLeft') lightboxStep(-1)
      if (event.key === 'ArrowRight') lightboxStep(1)
    })
  }

  function appealCardBaseWidthPx() {
    return Math.min(APPEAL_CARD_BASE_CAP_PX, window.innerWidth * APPEAL_CARD_BASE_VW_RATIO)
  }

  function computeAppealsGridTemplateColumns(containerWidth) {
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

    const appealStatus = String(appeal.status || 'pending')
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

    const sourceImages = Array.isArray(appeal.images) ? appeal.images.slice(0, 3) : []
    while (sourceImages.length < 3) {
      sourceImages.push({ label: String(sourceImages.length + 1) })
    }

    const photoUrls = sourceImages.map((image, index) => image.url || createMiniPhotoUrl(image.label || index + 1, index))

    sourceImages.forEach((image, index) => {
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

  function renderAppeals(appeals) {
    if (!appealsGrid) return

    appealsGrid.textContent = ''
    if (!appeals.length) {
      const emptyState = document.createElement('p')
      emptyState.className = 'appeals-empty'
      emptyState.textContent = 'За последние 7 дней у вас нет назначенных заявок.'
      appealsGrid.append(emptyState)
      layoutAppealsGrid()
      return
    }

    appeals.forEach(appeal => appealsGrid.append(createAppealCard(appeal)))
    layoutAppealsGrid()
  }

  function renderChart(series) {
    if (!agentChart) return

    agentChart.textContent = ''
    if (!series.length) {
      const empty = document.createElement('p')
      empty.className = 'agent-chart__empty'
      empty.textContent = 'Нет данных для графика.'
      agentChart.append(empty)
      return
    }

    const totalAppeals = series.reduce((sum, item) => sum + Number(item.total || 0), 0)
    if (chartSummary) {
      chartSummary.textContent = `${totalAppeals} заявок за 7 дней`
    }

    const rawMax = Math.max(...series.map(item => Number(item.total || 0)), 1)
    const yMax = computeNiceChartMax(rawMax)
    const ySteps = 5

    const figure = document.createElement('figure')
    figure.className = 'agent-chart__figure'

    const title = document.createElement('p')
    title.className = 'agent-chart__title'
    title.textContent = 'Заявки за 7 дней'

    const width = 620
    const height = 220
    const padding = { top: 16, right: 14, bottom: 30, left: 42 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
    svg.setAttribute('class', 'agent-chart__svg')
    svg.setAttribute('role', 'img')
    svg.setAttribute('aria-label', 'Линейный график количества заявок за последние 7 дней')

    for (let step = 0; step <= ySteps; step += 1) {
      const value = Math.round((yMax / ySteps) * step)
      const y = padding.top + plotHeight - (value / yMax) * plotHeight

      const grid = document.createElementNS('http://www.w3.org/2000/svg', 'line')
      grid.setAttribute('class', 'agent-chart__grid-line')
      grid.setAttribute('x1', String(padding.left))
      grid.setAttribute('x2', String(width - padding.right))
      grid.setAttribute('y1', String(y))
      grid.setAttribute('y2', String(y))
      svg.append(grid)

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('class', 'agent-chart__tick')
      label.setAttribute('x', String(padding.left - 10))
      label.setAttribute('y', String(y + 4))
      label.setAttribute('text-anchor', 'end')
      label.textContent = String(value)
      svg.append(label)
    }

    const yTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    yTitle.setAttribute('class', 'agent-chart__y-title')
    yTitle.setAttribute('transform', `translate(12 ${height / 2}) rotate(-90)`)
    yTitle.setAttribute('text-anchor', 'middle')
    yTitle.textContent = 'Заявки'
    svg.append(yTitle)

    const axisX = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    axisX.setAttribute('class', 'agent-chart__axis')
    axisX.setAttribute('x1', String(padding.left))
    axisX.setAttribute('x2', String(width - padding.right))
    axisX.setAttribute('y1', String(height - padding.bottom))
    axisX.setAttribute('y2', String(height - padding.bottom))
    svg.append(axisX)

    const axisY = document.createElementNS('http://www.w3.org/2000/svg', 'line')
    axisY.setAttribute('class', 'agent-chart__axis')
    axisY.setAttribute('x1', String(padding.left))
    axisY.setAttribute('x2', String(padding.left))
    axisY.setAttribute('y1', String(padding.top))
    axisY.setAttribute('y2', String(height - padding.bottom))
    svg.append(axisY)

    const points = series.map((item, index) => {
      const x =
        series.length === 1
          ? padding.left + plotWidth / 2
          : padding.left + (index / (series.length - 1)) * plotWidth
      const y = padding.top + plotHeight - (Number(item.total || 0) / yMax) * plotHeight
      return { x, y, label: formatChartDayLabel(item.date), total: Number(item.total || 0) }
    })

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute(
      'd',
      points
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
        .join(' ')
    )
    path.setAttribute('class', 'agent-chart__line')
    svg.append(path)

    points.forEach(point => {
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
      dot.setAttribute('class', 'agent-chart__point')
      dot.setAttribute('cx', String(point.x))
      dot.setAttribute('cy', String(point.y))
      dot.setAttribute('r', '4')
      svg.append(dot)

      const label = document.createElementNS('http://www.w3.org/2000/svg', 'text')
      label.setAttribute('class', 'agent-chart__tick')
      label.setAttribute('x', String(point.x))
      label.setAttribute('y', String(height - padding.bottom + 16))
      label.setAttribute('text-anchor', 'middle')
      label.textContent = point.label
      svg.append(label)
    })

    const legend = document.createElement('figcaption')
    legend.className = 'agent-chart__legend'

    const legendIcon = document.createElement('span')
    legendIcon.className = 'agent-chart__legend-line'

    const legendText = document.createElement('span')
    legendText.textContent = 'Заявки'

    legend.append(legendIcon, legendText)
    figure.append(title, svg, legend)
    agentChart.append(figure)
  }

  function highlightAppealCard(appealId) {
    const card = appealsGrid?.querySelector(`[data-appeal-id="${appealId}"]`)
    if (!(card instanceof HTMLElement)) return

    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    card.classList.add('is-active')
    window.setTimeout(() => card.classList.remove('is-active'), 900)
  }

  function clearMapPlacemarks() {
    if (!map) return
    state.placemarks.forEach(placemark => map.geoObjects.remove(placemark))
    state.placemarks = []
  }

  function computeBounds(points) {
    if (!points.length) return null

    let minLat = points[0][0]
    let maxLat = points[0][0]
    let minLng = points[0][1]
    let maxLng = points[0][1]

    points.forEach(([lat, lng]) => {
      minLat = Math.min(minLat, lat)
      maxLat = Math.max(maxLat, lat)
      minLng = Math.min(minLng, lng)
      maxLng = Math.max(maxLng, lng)
    })

    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ]
  }

  async function ensureMap() {
    if (map) return map
    if (!agentMap || !window.ymaps) return null

    await new Promise(resolve => window.ymaps.ready(resolve))

    map = new window.ymaps.Map(
      agentMap,
      {
        center: [55.751244, 37.618423],
        zoom: 5,
        controls: ['zoomControl'],
      },
      {
        suppressMapOpenBlock: true,
      }
    )

    return map
  }

  async function renderMap(appeals) {
    const mapPoints = appeals
      .filter(appeal => Number.isFinite(Number(appeal.latitude)) && Number.isFinite(Number(appeal.longitude)))
      .map(appeal => ({
        id: String(appeal.id),
        coords: [Number(appeal.latitude), Number(appeal.longitude)],
        data: appeal,
      }))

    if (mapSummary) {
      mapSummary.textContent = mapPoints.length
        ? `${mapPoints.length} точек на карте`
        : 'Нет координат для отображения'
    }

    if (agentMapEmpty) {
      agentMapEmpty.hidden = mapPoints.length > 0
    }

    const currentMap = await ensureMap()
    if (!currentMap) return

    clearMapPlacemarks()

    if (!mapPoints.length) {
      currentMap.setCenter([55.751244, 37.618423], 5)
      return
    }

    mapPoints.forEach(point => {
      const placemark = new window.ymaps.Placemark(
        point.coords,
        {},
        {
          preset: 'islands#greenCircleDotIcon',
          hasBalloon: false,
          hideIconOnBalloonOpen: false,
        }
      )

      placemark.events.add('click', () => highlightAppealCard(point.id))
      currentMap.geoObjects.add(placemark)
      state.placemarks.push(placemark)
    })

    if (mapPoints.length === 1) {
      currentMap.setCenter(mapPoints[0].coords, 14, { duration: 200 })
      return
    }

    const bounds = computeBounds(mapPoints.map(point => point.coords))
    if (!bounds) return

    currentMap.setBounds(bounds, {
      checkZoomRange: true,
      zoomMargin: [28, 28, 28, 28],
      duration: 200,
    })

    if (currentMap.container) {
      window.setTimeout(() => currentMap.container.fitToViewport(), 0)
    }
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
      profileFullName.value = displayName === 'Агент' ? '' : displayName
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
    if (profileRole) profileRole.textContent = 'Агент'
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
    fillProfileModal(state.user)
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

      state.user = data?.user || state.user
      try {
        localStorage.setItem('user', JSON.stringify(state.user))
      } catch (_error) {
        // no-op
      }

      applyHeader(state.user)
      fillProfileModal(state.user)
      setProfileModalMessage('Профиль сохранён')
    } catch (error) {
      setProfileModalMessage(error?.message || 'Не удалось сохранить профиль', true)
    } finally {
      if (profileModalSave) profileModalSave.disabled = false
    }
  }

  function setupSidebarActions() {
    const sidebarBrand = document.querySelector('.sidebar-brand')
    const logout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('index.html')
    }
    const resetSidebarState = () => {
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, 'false')
      } catch (_error) {
        // no-op
      }
    }

    if (sidebarBrand) {
      sidebarBrand.addEventListener('click', () => {
        resetSidebarState()
        window.location.href = 'index.html'
      })
    }

    document.querySelectorAll('.sidebar-nav-item[data-href], .sidebar-nav-item[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action')
        if (action === 'logout') {
          logout()
          return
        }

        const href = button.getAttribute('data-href')
        if (href) {
          resetSidebarState()
          window.location.href = href
        }
      })
    })

    document.querySelectorAll('.sidebar-nav-item[data-scroll-target]').forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-scroll-target')
        const target = targetId ? document.getElementById(targetId) : null
        target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  function applyHeader(user) {
    const displayName = getUserDisplayName(user)
    if (sidebarAvatar) sidebarAvatar.textContent = getInitials(displayName)
    if (sidebarProfileName) sidebarProfileName.textContent = displayName
    if (sidebarProfileLevel) sidebarProfileLevel.textContent = 'Агент'
    if (organizationMeta) organizationMeta.textContent = formatOrgLabel(user)
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

    const user = data.user
    if (user.role === 'superadmin') {
      window.location.replace('superadmin.html')
      throw new Error('__redirect_superadmin__')
    }

    if (user.role === 'admin' && user.auth_source !== 'org_admins') {
      window.location.replace('admin.html')
      throw new Error('__redirect_admin__')
    }

    if (user.role !== 'admin' || user.auth_source !== 'org_admins') {
      window.location.replace('map.html')
      throw new Error('__redirect_non_agent__')
    }

    return user
  }

  async function loadDashboard() {
    const response = await fetch('backend/agent_dashboard.php', {
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

      throw new Error(data.message || 'Не удалось загрузить панель агента')
    }

    return data
  }

  function renderErrorState(message) {
    renderChart([])
    renderAppeals([])
    if (chartSummary) chartSummary.textContent = 'Ошибка загрузки'
    if (mapSummary) mapSummary.textContent = 'Ошибка загрузки'
    if (organizationMeta) organizationMeta.textContent = message || 'Не удалось загрузить данные'
  }

  async function init() {
    setupSidebarActions()
    setupSidebarToggle()
    setupProfileModal()
    setupAppealsGridLayout()
    setupPhotoLightbox()

    try {
      const authUser = await ensureAgent()
      const dashboard = await loadDashboard()

      state.user = dashboard.user || authUser
      state.chart = Array.isArray(dashboard.chart) ? dashboard.chart : []
      state.appeals = Array.isArray(dashboard.appeals) ? dashboard.appeals : []

      applyHeader(state.user)
      renderChart(state.chart)
      renderAppeals(state.appeals)
      await renderMap(state.appeals)
    } catch (error) {
      if (
        error?.message === '__redirect_login__' ||
        error?.message === '__redirect_superadmin__' ||
        error?.message === '__redirect_admin__' ||
        error?.message === '__redirect_non_agent__'
      ) {
        return
      }

      applyHeader({})
      renderErrorState(error?.message || 'Не удалось загрузить панель агента.')
    }
  }

  init()
})()
