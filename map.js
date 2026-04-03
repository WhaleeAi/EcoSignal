;(() => {
  const token = localStorage.getItem('token')

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const logoutBtn = document.getElementById('mapLogoutBtn')
  const myAppealsBtn = document.getElementById('mapMyAppealsBtn')
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

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.replace('index.html')
  }

  logoutBtn?.addEventListener('click', logout)
  myAppealsBtn?.addEventListener('click', () => {
    window.location.href = 'my_appeals.html'
  })

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

  let map = null
  let selectedPlacemark = null
  let selectedCoords = null
  let categories = []
  let allAppeals = []
  let visibleAppeals = []
  let mapAppealPlacemarks = []
  const placemarkByAppealId = new Map()

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
    const images = Array.isArray(appeal.images) ? appeal.images.slice(0, 9) : []

    if (!images.length) {
      const placeholder = document.createElement('img')
      placeholder.className = 'appeal-details-modal__image'
      placeholder.alt = 'Фото отсутствует'
      placeholder.src = createMiniPhotoUrl(0, 360)
      appealDetailsImages.append(placeholder)
    } else {
      images.forEach((imageData, index) => {
        const image = document.createElement('img')
        image.className = 'appeal-details-modal__image'
        image.alt = `Фото заявки ${index + 1}`
        image.src = imageData.url || createMiniPhotoUrl(index, 360)
        appealDetailsImages.append(image)
      })
    }

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
  appealDetailsClose.addEventListener('click', closeAppealDetailsModal)
  appealDetailsModal.addEventListener('click', event => {
    if (event.target === appealDetailsModal || event.target?.classList?.contains('appeal-details-modal__backdrop')) {
      closeAppealDetailsModal()
    }
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !appealDetailsModal.hidden) {
      closeAppealDetailsModal()
    }
  })

  setSelectionControlsVisible(false)
  setFormVisible(false)
  updateCoordsLabel()

  Promise.resolve()
    .then(() => ensureAuthorized())
    .then(() => loadCategories())
    .then(() => loadAppeals())
    .catch(error => {
      if (error?.message === '__redirect_admin__') return
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
