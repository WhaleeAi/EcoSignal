;(() => {
  const token = localStorage.getItem('token')

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const mapPage = document.querySelector('.map-page')
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileName = document.querySelector('.sidebar-profile-name')
  const sidebarProfileLevel = document.querySelector('.sidebar-profile-level')
  const closeBtn = document.getElementById('mapCloseBtn')
  const addPinBtn = document.getElementById('mapAddPinBtn')
  const reportBtn = document.querySelector('.report-btn')
  const searchCard = document.querySelector('.search-card')
  const searchInput = document.getElementById('mapSearchInput')
  const mapTitle = document.querySelector('.map-title')
  const appealsList = document.getElementById('appealsList')
  const formWrap = document.getElementById('appealFormWrap')
  const form = document.getElementById('appealForm')
  const categorySelect = document.getElementById('appealCategory')
  const subcategorySelect = document.getElementById('appealSubcategory')
  const descriptionInput = document.getElementById('appealDescription')
  const priorityInput = document.getElementById('appealPriority')
  const imagesInput = document.getElementById('appealImages')
  const coordsLabel = document.getElementById('appealCoords')
  const formMessage = document.getElementById('appealFormMessage')
  const appealDetailsModal = document.getElementById('appealDetailsModal')
  const appealDetailsClose = document.getElementById('appealDetailsClose')
  const appealDetailsTitle = document.getElementById('appealDetailsTitle')
  const appealDetailsUser = document.getElementById('appealDetailsUser')
  const appealDetailsCategory = document.getElementById('appealDetailsCategory')
  const appealDetailsStatus = document.getElementById('appealDetailsStatus')
  const appealDetailsDate = document.getElementById('appealDetailsDate')
  const appealDetailsCoords = document.getElementById('appealDetailsCoords')
  const appealDetailsDescription = document.getElementById('appealDetailsDescription')
  const appealDetailsImages = document.getElementById('appealDetailsImages')
  const photoLightbox = document.getElementById('photoLightbox')
  const photoLightboxBackdrop = document.getElementById('photoLightboxBackdrop')
  const photoLightboxClose = document.getElementById('photoLightboxClose')
  const photoLightboxPrev = document.getElementById('photoLightboxPrev')
  const photoLightboxNext = document.getElementById('photoLightboxNext')
  const photoLightboxImg = document.getElementById('photoLightboxImg')
  const photoLightboxCounter = document.getElementById('photoLightboxCounter')
  const photoLightboxStage = document.querySelector('.photo-lightbox__stage')

  let map = null

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.replace('index.html')
  }

  setupSidebarActions()
  setupSidebarToggle()

  if (
    !closeBtn ||
    !addPinBtn ||
    !reportBtn ||
    !searchCard ||
    !searchInput ||
    !mapTitle ||
    !appealsList ||
    !formWrap ||
    !form ||
    !categorySelect ||
    !subcategorySelect ||
    !descriptionInput ||
    !priorityInput ||
    !imagesInput ||
    !coordsLabel ||
    !formMessage ||
    !appealDetailsModal ||
    !appealDetailsClose ||
    !appealDetailsTitle ||
    !appealDetailsUser ||
    !appealDetailsCategory ||
    !appealDetailsStatus ||
    !appealDetailsDate ||
    !appealDetailsCoords ||
    !appealDetailsDescription ||
    !appealDetailsImages
  ) {
    return
  }

  let selectedPlacemark = null
  let selectedCoords = null
  let categories = []
  let allAppeals = []
  let visibleAppeals = []
  let mapAppealPlacemarks = []
  const placemarkByAppealId = new Map()
  const lightboxState = {
    urls: [],
    index: 0,
  }
  let lightboxTouchStartX = 0

  function setFormMessage(text, isError = false) {
    formMessage.textContent = text
    formMessage.classList.toggle('error', isError)
  }

  function formatCoords(coords) {
    return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase()
  }

  function truncateText(value, maxLength = 105) {
    const text = String(value || '').trim()
    if (text.length <= maxLength) {
      return text
    }
    return `${text.slice(0, maxLength - 1)}...`
  }

  function toDataUrl(svgMarkup) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`
  }

  function getInitials(fullName) {
    const parts = String(fullName || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)

    return parts.map(part => part[0]).join('').toUpperCase() || 'U'
  }

  function getUserDisplayName(user) {
    if (!user || typeof user !== 'object') return 'Пользователь'
    const combined = `${user.first_name || ''} ${user.last_name || ''}`.trim()
    if (combined) return combined
    if (user.name) return String(user.name)
    if (user.email) return String(user.email)
    return 'Пользователь'
  }

  function createAvatarUrl(name, seedValue) {
    const tones = ['#d3bd8a', '#97b798', '#8db5c0', '#c9aa90', '#b0a0df', '#e3a8b1']
    const seed = Math.abs(Number(seedValue) || 0)
    const tone = tones[seed % tones.length]
    const initials = getInitials(name)

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44">
      <rect width="44" height="44" rx="8" fill="${tone}"/>
      <text x="22" y="27" text-anchor="middle" font-size="14" font-family="Roboto Flex, sans-serif" fill="#1c1c1b">${initials}</text>
    </svg>`

    return toDataUrl(svg)
  }

  function setupSidebarActions() {
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

  function rerenderMapAfterLayoutShift() {
    if (!map?.container) return

    const fit = () => {
      try {
        map.container.fitToViewport()
      } catch (_error) {
        // no-op
      }
    }

    window.requestAnimationFrame(fit)
    window.setTimeout(fit, 180)
    window.setTimeout(fit, 320)
  }

  function setSidebarExpanded(expanded) {
    if (!sidebar || !sidebarToggle || !mapPage) return
    sidebar.classList.toggle('sidebar--expanded', expanded)
    mapPage.classList.toggle('map-page--sidebar-expanded', expanded)
    sidebarToggle.setAttribute('aria-expanded', String(expanded))
    sidebarToggle.setAttribute('aria-label', expanded ? 'Свернуть панель' : 'Развернуть панель')
    rerenderMapAfterLayoutShift()
  }

  function setupSidebarToggle() {
    if (!sidebar || !sidebarToggle) return

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
    if (sidebarProfileLevel) sidebarProfileLevel.textContent = 'Пользователь'
  }

  function createMiniPhotoUrl(index, size = 36) {
    const palettes = [
      ['#f4dca1', '#d3bd8a'],
      ['#bfd7bf', '#97b798'],
      ['#b6d4dd', '#8db5c0'],
      ['#e5d0bc', '#c9aa90'],
      ['#d3c8f1', '#b0a0df'],
      ['#f1c8cd', '#e3a8b1'],
    ]

    const palette = palettes[index % palettes.length]
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
    </svg>`

    return toDataUrl(svg)
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
    const hasMany = urls.length > 1
    if (photoLightboxPrev) photoLightboxPrev.hidden = !hasMany
    if (photoLightboxNext) photoLightboxNext.hidden = !hasMany
  }

  function openPhotoLightbox(urls, startIndex = 0) {
    const list = (Array.isArray(urls) ? urls : []).filter(Boolean)
    if (!photoLightbox || !list.length) return

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
    const size = lightboxState.urls.length
    if (size <= 1) return
    lightboxState.index = (lightboxState.index + delta + size) % size
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
        const deltaX = event.changedTouches[0].clientX - lightboxTouchStartX
        if (deltaX > 50) lightboxStep(-1)
        else if (deltaX < -50) lightboxStep(1)
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

  function updateCoordsLabel() {
    coordsLabel.textContent = selectedCoords ? formatCoords(selectedCoords) : 'не выбрана'
  }

  function setSelectionControlsVisible(isVisible) {
    closeBtn.hidden = !isVisible
    addPinBtn.hidden = !isVisible
  }

  function setFormVisible(isVisible) {
    formWrap.hidden = !isVisible
    searchCard.classList.toggle('form-open', isVisible)
    if (isVisible) {
      setFormMessage('')
    }
  }

  function resetSubcategories() {
    subcategorySelect.innerHTML = '<option value="">Без подкатегории</option>'
  }

  function fillCategories() {
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>'

    for (const category of categories) {
      const option = document.createElement('option')
      option.value = String(category.id)
      option.textContent = category.name
      categorySelect.append(option)
    }

    resetSubcategories()
  }

  function fillSubcategories(categoryId) {
    resetSubcategories()

    if (!categoryId) return

    const category = categories.find(item => String(item.id) === String(categoryId))
    if (!category || !Array.isArray(category.subcategories)) return

    for (const subcategory of category.subcategories) {
      const option = document.createElement('option')
      option.value = String(subcategory.id)
      option.textContent = subcategory.name
      subcategorySelect.append(option)
    }
  }

  function clearSelectedPoint() {
    if (map && selectedPlacemark) {
      map.geoObjects.remove(selectedPlacemark)
    }

    selectedPlacemark = null
    selectedCoords = null
    updateCoordsLabel()
    setSelectionControlsVisible(false)
    setFormVisible(false)
  }

  function setSelectedPoint(coords) {
    selectedCoords = coords

    if (map && selectedPlacemark) {
      map.geoObjects.remove(selectedPlacemark)
    }

    selectedPlacemark = new ymaps.Placemark(
      coords,
      {},
      {
        iconLayout: 'default#image',
        iconImageHref: './icons/pin.svg',
        iconImageSize: [40, 55],
        iconImageOffset: [-20, -55],
        draggable: true,
      }
    )

    selectedPlacemark.events.add('dragend', () => {
      selectedCoords = selectedPlacemark.geometry.getCoordinates()
      updateCoordsLabel()
    })

    if (map) {
      map.geoObjects.add(selectedPlacemark)
    }

    updateCoordsLabel()
    setSelectionControlsVisible(true)
  }

  function updateMapTitle() {
    mapTitle.textContent = `Ближайшие сигналы: ${visibleAppeals.length}`
  }

  function formatAppealStatus(status) {
    const labels = {
      pending: 'Ожидает',
      confirmed: 'Подтверждена',
      in_progress: 'В работе',
      resolved: 'Решена',
      rejected: 'Отклонена',
    }
    return labels[String(status || '')] || String(status || 'Неизвестно')
  }

  function formatAppealDate(rawDate) {
    const parsed = new Date(rawDate)
    if (Number.isNaN(parsed.getTime())) {
      return String(rawDate || '-')
    }
    return parsed.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function closeAppealDetailsModal() {
    closePhotoLightbox()
    appealDetailsModal.hidden = true
    document.body.style.overflow = ''
  }

  function openAppealDetailsModal(appeal) {
    appealDetailsTitle.textContent = `Заявка #${appeal.id}`
    appealDetailsUser.textContent = `Пользователь: ${appeal.user?.name || 'Без имени'} (${Number(
      appeal.user?.level || 0
    )} уровень)`
    appealDetailsCategory.textContent = `Категория: ${appeal.category || '-'} / ${
      appeal.subcategory || 'Без подкатегории'
    }`
    appealDetailsStatus.textContent = `Статус: ${formatAppealStatus(appeal.status)} | Приоритет: ${Number(
      appeal.priority || 0
    )}`
    appealDetailsDate.textContent = `Создана: ${formatAppealDate(appeal.created_at)}`
    appealDetailsCoords.textContent = `Координаты: ${Number(appeal.latitude).toFixed(6)}, ${Number(
      appeal.longitude
    ).toFixed(6)}`
    appealDetailsDescription.textContent = String(appeal.description || 'Описание не указано')

    appealDetailsImages.textContent = ''
    const sourceImages = Array.isArray(appeal.images) ? appeal.images.slice(0, 9) : []
    const imageUrls = sourceImages.length
      ? sourceImages.map((imageData, index) => imageData.url || createMiniPhotoUrl(index, 360))
      : [createMiniPhotoUrl(0, 360)]

    imageUrls.forEach((url, index) => {
      const image = document.createElement('img')
      image.className = 'appeal-details-modal__image'
      image.alt = sourceImages.length ? `Фото заявки ${index + 1}` : 'Фото отсутствует'
      image.src = url
      image.addEventListener('click', () => openPhotoLightbox(imageUrls, index))
      appealDetailsImages.append(image)
    })

    appealDetailsModal.hidden = false
    document.body.style.overflow = 'hidden'
  }

  function isAppealInMapBounds(appeal, bounds) {
    if (!bounds || !Array.isArray(bounds) || bounds.length !== 2) {
      return true
    }

    const lat = Number(appeal?.latitude)
    const lon = Number(appeal?.longitude)

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return false
    }

    const south = Math.min(bounds[0][0], bounds[1][0])
    const north = Math.max(bounds[0][0], bounds[1][0])
    const west = bounds[0][1]
    const east = bounds[1][1]

    if (lat < south || lat > north) {
      return false
    }

    if (west <= east) {
      return lon >= west && lon <= east
    }

    return lon >= west || lon <= east
  }

  function matchesAppealSearch(appeal, query) {
    if (!query) return true

    const haystack = normalizeText([
      appeal?.description,
      appeal?.category,
      appeal?.subcategory,
      appeal?.user?.name,
      appeal?.status,
    ].join(' '))

    return haystack.includes(query)
  }

  function renderAppealMarkers() {
    if (!map) return

    for (const placemark of mapAppealPlacemarks) {
      map.geoObjects.remove(placemark)
    }

    mapAppealPlacemarks = []
    placemarkByAppealId.clear()

    for (const appeal of visibleAppeals) {
      const coords = [Number(appeal.latitude), Number(appeal.longitude)]
      if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
        continue
      }

      const placemark = new ymaps.Placemark(
        coords,
        {},
        {
          preset: 'islands#greenCircleDotIcon',
          hasBalloon: false,
          hideIconOnBalloonOpen: false,
        }
      )

      placemark.events.add('click', () => {
        const card = appealsList.querySelector(`[data-appeal-id="${appeal.id}"]`)
        if (card instanceof HTMLElement) {
          card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
          card.classList.add('is-active')
          window.setTimeout(() => card.classList.remove('is-active'), 800)
        }
        openAppealDetailsModal(appeal)
      })

      map.geoObjects.add(placemark)
      mapAppealPlacemarks.push(placemark)
      placemarkByAppealId.set(String(appeal.id), placemark)
    }
  }

  function createAppealCard(appeal) {
    const card = document.createElement('article')
    card.className = 'map-appeal-card'
    card.dataset.appealId = String(appeal.id)

    const top = document.createElement('div')
    top.className = 'map-appeal-card__top'

    const userWrap = document.createElement('div')
    userWrap.className = 'map-appeal-card__user'

    const avatar = document.createElement('img')
    avatar.className = 'map-appeal-card__avatar'
    avatar.alt = `Пользователь: ${appeal.user?.name || 'Неизвестно'}`
    avatar.src = createAvatarUrl(appeal.user?.name || 'Пользователь', appeal.user?.id)

    const userMeta = document.createElement('div')

    const name = document.createElement('p')
    name.className = 'map-appeal-card__name'
    name.textContent = String(appeal.user?.name || 'Без имени')

    const level = document.createElement('p')
    level.className = 'map-appeal-card__level'
    level.textContent = `${Number(appeal.user?.level || 0)} уровень`

    userMeta.append(name, level)
    userWrap.append(avatar, userMeta)

    const imagesWrap = document.createElement('div')
    imagesWrap.className = 'map-appeal-card__images'

    const images = Array.isArray(appeal.images) ? appeal.images.slice(0, 3) : []
    while (images.length < 3) {
      images.push({})
    }

    images.forEach((imageData, index) => {
      const image = document.createElement('img')
      image.className = 'map-appeal-card__photo'
      image.alt = `Фото заявки ${index + 1}`
      image.src = imageData.url || createMiniPhotoUrl(index)
      imagesWrap.append(image)
    })

    top.append(userWrap, imagesWrap)

    const description = document.createElement('p')
    description.className = 'map-appeal-card__desc'
    description.textContent = truncateText(appeal.description, 120)

    card.append(top, description)

    card.addEventListener('click', () => {
      openAppealDetailsModal(appeal)
    })

    return card
  }

  function renderAppealsList() {
    appealsList.textContent = ''

    if (!visibleAppeals.length) {
      const empty = document.createElement('p')
      empty.className = 'appeals-list-empty'
      empty.textContent = 'В этой области карты заявок не найдено.'
      appealsList.append(empty)
      return
    }

    for (const appeal of visibleAppeals) {
      appealsList.append(createAppealCard(appeal))
    }
  }

  function renderAppealsError(message) {
    appealsList.textContent = ''
    const error = document.createElement('p')
    error.className = 'appeals-list-empty'
    error.textContent = message || 'Не удалось загрузить заявки.'
    appealsList.append(error)
    mapTitle.textContent = 'Ближайшие сигналы: 0'
  }

  function refreshVisibleAppeals() {
    const query = normalizeText(searchInput.value)
    const bounds = map ? map.getBounds() : null

    visibleAppeals = allAppeals.filter(appeal => {
      if (!matchesAppealSearch(appeal, query)) {
        return false
      }

      return isAppealInMapBounds(appeal, bounds)
    })

    renderAppealMarkers()
    renderAppealsList()
    updateMapTitle()
  }

  async function ensureAuthorized() {
    const response = await fetch('backend/me.php', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('login.html')
      throw new Error('Требуется авторизация')
    }

    if (data?.user?.role === 'admin') {
      window.location.replace('admin.html')
      throw new Error('__redirect_admin__')
    }

    if (data?.user?.role === 'superadmin') {
      window.location.replace('superadmin.html')
      throw new Error('__redirect_admin__')
    }

    return data?.user || null
  }

  async function loadCategories() {
    const response = await fetch('backend/categories.php', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось загрузить категории')
    }

    categories = Array.isArray(data.categories) ? data.categories : []
    fillCategories()
  }

  async function loadAppeals() {
    const response = await fetch('backend/map_appeals.php', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось загрузить заявки карты')
    }

    allAppeals = Array.isArray(data.appeals) ? data.appeals : []
    refreshVisibleAppeals()
  }

  async function submitAppeal(event) {
    event.preventDefault()

    if (!selectedCoords) {
      setFormMessage('Сначала выберите точку на карте', true)
      return
    }

    const categoryId = Number(categorySelect.value)
    const subcategoryId = subcategorySelect.value ? Number(subcategorySelect.value) : null
    const description = descriptionInput.value.trim()
    const priority = Number(priorityInput.value || 0)
    const imageFiles = Array.from(imagesInput.files || [])

    if (!categoryId || !description) {
      setFormMessage('Заполните обязательные поля: категория и описание', true)
      return
    }

    const submitButton = form.querySelector('button[type="submit"]')
    if (submitButton) {
      submitButton.disabled = true
    }

    setFormMessage('Отправка...')

    try {
      const formData = new FormData()
      formData.append('category_id', String(categoryId))
      if (subcategoryId !== null) {
        formData.append('subcategory_id', String(subcategoryId))
      }
      formData.append('description', description)
      formData.append('latitude', String(selectedCoords[0]))
      formData.append('longitude', String(selectedCoords[1]))
      formData.append('priority', String(priority))

      for (const file of imageFiles) {
        formData.append('images[]', file, file.name)
      }

      const response = await fetch('backend/create_appeal.php', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setFormMessage(data.message || 'Не удалось отправить заявку', true)
        return
      }

      form.reset()
      priorityInput.value = '0'
      fillSubcategories('')
      clearSelectedPoint()
      await loadAppeals()
      setFormMessage('Заявка успешно отправлена')
    } catch (error) {
      setFormMessage('Ошибка соединения с сервером', true)
    } finally {
      if (submitButton) {
        submitButton.disabled = false
      }
    }
  }

  closeBtn.addEventListener('click', clearSelectedPoint)

  addPinBtn.addEventListener('click', () => {
    if (!selectedCoords) return
    setFormVisible(true)
    descriptionInput.focus()
  })

  reportBtn.addEventListener('click', () => {
    setFormVisible(true)

    if (!selectedCoords) {
      setFormMessage('Сначала выберите точку на карте', true)
      return
    }

    setFormMessage('')
    descriptionInput.focus()
  })

  searchInput.addEventListener('input', refreshVisibleAppeals)

  categorySelect.addEventListener('change', () => {
    fillSubcategories(categorySelect.value)
  })

  form.addEventListener('submit', submitAppeal)
  setupPhotoLightbox()
  appealDetailsClose.addEventListener('click', closeAppealDetailsModal)
  appealDetailsModal.addEventListener('click', event => {
    if (event.target === appealDetailsModal || event.target?.classList?.contains('appeal-details-modal__backdrop')) {
      closeAppealDetailsModal()
    }
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !appealDetailsModal.hidden && (photoLightbox?.hidden ?? true)) {
      closeAppealDetailsModal()
    }
  })

  setSelectionControlsVisible(false)
  setFormVisible(false)
  updateCoordsLabel()

  Promise.resolve()
    .then(() => ensureAuthorized())
    .then(user => {
      setupProfileBadge(user)
      return loadCategories()
    })
    .then(() => loadAppeals())
    .catch(error => {
      if (error?.message === '__redirect_admin__') return
      setupProfileBadge({})
      setFormVisible(false)
      renderAppealsError(error?.message || 'Ошибка загрузки данных')
    })

  if (!window.ymaps) {
    setFormVisible(false)
    renderAppealsError('API Яндекс Карт не загрузился')
    return
  }

  ymaps.ready(() => {
    map = new ymaps.Map(
      'yandexMap',
      {
        center: [55.751244, 37.618423],
        zoom: 10,
        controls: ['zoomControl', 'geolocationControl'],
      },
      {
        suppressMapOpenBlock: true,
      }
    )

    map.events.add('click', event => {
      const coords = event.get('coords')
      if (!Array.isArray(coords) || coords.length !== 2) return
      setSelectedPoint(coords)
    })

    map.events.add('boundschange', () => {
      refreshVisibleAppeals()
    })

    refreshVisibleAppeals()
  })
})()
