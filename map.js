;(() => {
  const token = localStorage.getItem('token')
  const SIDEBAR_STORAGE_KEY = 'ecosignalSidebarExpanded'

  const isAuthenticated = Boolean(token)

  const mapPage = document.querySelector('.map-page')
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileButton = document.getElementById('sidebarProfileButton')
  const sidebarProfileName = document.querySelector('.sidebar-profile-name')
  const sidebarProfileLevel = document.querySelector('.sidebar-profile-level')
  const closeBtn = document.getElementById('mapCloseBtn')
  const addPinBtn = document.getElementById('mapAddPinBtn')
  const reportBtn = document.querySelector('.report-btn')
  const searchCard = document.querySelector('.search-card')
  const searchInput = document.getElementById('mapSearchInput')
  const searchClearBtn = document.getElementById('mapSearchClear')
  const mapTitle = document.querySelector('.map-title')
  const appealsList = document.getElementById('appealsList')
  const formWrap = document.getElementById('appealFormWrap')
  const form = document.getElementById('appealForm')
  const categorySelect = document.getElementById('appealCategory')
  const subcategorySelect = document.getElementById('appealSubcategory')
  const descriptionInput = document.getElementById('appealDescription')
  const priorityOptions = Array.from(document.querySelectorAll("input[name='appealPriority']"))
  const imagesInput = document.getElementById('appealImages')
  const coordsLabel = document.getElementById('appealCoords')
  const formMessage = document.getElementById('appealFormMessage')
  const appealDetailsModal = document.getElementById('appealDetailsModal')
  const appealDetailsClose = document.getElementById('appealDetailsClose')
  const appealDetailsBadge = document.getElementById('appealDetailsBadge')
  const appealDetailsTitle = document.getElementById('appealDetailsTitle')
  const appealDetailsUser = document.getElementById('appealDetailsUser')
  const appealDetailsCategory = document.getElementById('appealDetailsCategory')
  const appealDetailsStatus = document.getElementById('appealDetailsStatus')
  const appealDetailsDate = document.getElementById('appealDetailsDate')
  const appealDetailsCoords = document.getElementById('appealDetailsCoords')
  const appealDetailsDescription = document.getElementById('appealDetailsDescription')
  const appealDetailsCarousel = document.getElementById('appealDetailsCarousel')
  const appealDetailsCarouselPrev = document.getElementById('appealDetailsCarouselPrev')
  const appealDetailsCarouselNext = document.getElementById('appealDetailsCarouselNext')
  const appealDetailsImages = document.getElementById('appealDetailsImages')
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
  const profileEmail = document.getElementById('profileEmail')
  const profilePassword = document.getElementById('profilePassword')
  const profileAbout = document.getElementById('profileAbout')
  const profileRole = document.getElementById('profileRole')
  const profileCreatedAt = document.getElementById('profileCreatedAt')
  const profileModalSave = document.getElementById('profileModalSave')
  const customSelects = new Map()

  let map = null
  let currentUser = null
  let profileModalCloseTimer = 0
  const PROFILE_MODAL_CLOSE_DELAY = 95

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.replace('index.html')
  }

  setupSidebarActions()
  setupSidebarToggle()
  setupProfileModal()
  setupAppealDetailsCarousel()

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
    !priorityOptions.length ||
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

  function closeAllCustomSelects(exceptSelectId = '') {
    customSelects.forEach((config, selectId) => {
      const isOpen = Boolean(exceptSelectId) && selectId === exceptSelectId && !config.select.disabled
      config.wrap.classList.toggle('custom-select--open', isOpen)
      config.trigger.setAttribute('aria-expanded', String(isOpen))
      config.menu.hidden = !isOpen
    })
  }

  function syncCustomSelectDisplay(selectId) {
    const config = customSelects.get(selectId)
    if (!config) return

    const placeholder = String(config.select.dataset.placeholder || 'Выберите значение')
    const opt = config.select.selectedOptions[0]
    const hasValue = Boolean(config.select.value) && Boolean(opt)

    config.trigger.textContent = hasValue ? opt.textContent : placeholder
    config.trigger.classList.toggle('custom-select__trigger--placeholder', !hasValue)
    config.trigger.disabled = config.select.disabled
  }

  function rebuildCustomSelectOptions(selectId) {
    const config = customSelects.get(selectId)
    if (!config) return

    config.menu.textContent = ''

    Array.from(config.select.options).forEach((option, index) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'custom-select__option'
      item.textContent = option.textContent
      item.setAttribute('role', 'option')
      item.setAttribute('aria-selected', option.selected ? 'true' : 'false')

      if (option.selected) {
        item.classList.add('custom-select__option--selected')
      }

      item.addEventListener('click', () => {
        if (option.disabled) return
        config.select.selectedIndex = index
        config.select.dispatchEvent(new Event('change', { bubbles: true }))
        closeAllCustomSelects()
        config.trigger.focus()
      })

      config.menu.append(item)
    })

    syncCustomSelectDisplay(selectId)
  }

  function registerCustomSelect(select) {
    if (!select || customSelects.has(select.id)) return

    const wrap = document.createElement('div')
    wrap.className = 'custom-select'

    const trigger = document.createElement('button')
    trigger.type = 'button'
    trigger.className = 'custom-select__trigger custom-select__trigger--placeholder'
    trigger.setAttribute('aria-haspopup', 'listbox')
    trigger.setAttribute('aria-expanded', 'false')
    trigger.setAttribute('aria-controls', `${select.id}Menu`)

    const menu = document.createElement('div')
    menu.id = `${select.id}Menu`
    menu.className = 'custom-select__menu'
    menu.setAttribute('role', 'listbox')
    menu.hidden = true

    select.classList.add('custom-select-native')
    select.after(wrap)
    wrap.append(select, trigger, menu)

    customSelects.set(select.id, { select, wrap, trigger, menu })

    trigger.addEventListener('click', () => {
      if (select.disabled) return
      const isOpen = wrap.classList.contains('custom-select--open')
      closeAllCustomSelects(isOpen ? '' : select.id)
    })

    select.addEventListener('change', () => {
      rebuildCustomSelectOptions(select.id)
    })

    rebuildCustomSelectOptions(select.id)
  }

  function formatCoords(coords) {
    return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file)
      const image = new Image()
      image.onload = () => {
        URL.revokeObjectURL(url)
        resolve(image)
      }
      image.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Не удалось обработать изображение'))
      }
      image.src = url
    })
  }

  async function compressAppealImage(file) {
    const maxSide = 1600
    const image = await loadImageFromFile(file)
    const sourceWidth = image.naturalWidth || image.width
    const sourceHeight = image.naturalHeight || image.height
    const scale = Math.min(1, maxSide / Math.max(sourceWidth, sourceHeight))
    const width = Math.max(1, Math.round(sourceWidth * scale))
    const height = Math.max(1, Math.round(sourceHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')

    if (!context) return file

    context.drawImage(image, 0, 0, width, height)

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file

    const baseName = String(file.name || 'appeal-photo').replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() })
  }

  function normalizeText(value) {
    return String(value || '').trim().toLowerCase()
  }

  function getSelectedPriorityValue() {
    const selected = priorityOptions.find(input => input.checked)
    return selected ? Number(selected.value || 0) : 0
  }

  function resetPriorityValue() {
    priorityOptions.forEach(input => {
      input.checked = input.value === '1'
    })
  }

  function resetAppealForm() {
    form.reset()
    resetPriorityValue()
    resetSubcategories()
    rebuildCustomSelectOptions(categorySelect.id)
    rebuildCustomSelectOptions(subcategorySelect.id)
    setFormMessage('')
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

  function getUserRoleLabel(role) {
    const normalized = String(role || '').toLowerCase()
    if (normalized === 'citizen' || normalized === 'user') return 'Пользователь'
    if (normalized === 'agency') return 'Агент'
    if (normalized === 'admin') return 'Администратор'
    return 'Пользователь'
  }

  function formatDate(rawDate) {
    if (!rawDate) return '—'
    const parsed = new Date(rawDate)
    if (Number.isNaN(parsed.getTime())) return String(rawDate)
    return parsed.toLocaleDateString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
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
    const sidebarBrand = document.querySelector('.sidebar-brand')
    const navButtons = document.querySelectorAll('.sidebar-nav-item[data-href], .sidebar-nav-item[data-action]')
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

    if (!isAuthenticated) {
      const privateNavButton = document.querySelector('.sidebar-nav-item[data-href="my_appeals.html"]')
      const loginButton = document.querySelector('.sidebar-nav-item[data-action="logout"]')

      if (privateNavButton) {
        privateNavButton.dataset.href = 'login.html'
      }
      if (loginButton) {
        loginButton.dataset.action = ''
        loginButton.dataset.href = 'login.html'
        loginButton.setAttribute('aria-label', 'Войти')
        const icon = loginButton.querySelector('img')
        if (icon) icon.src = './icons/login.svg'
        const label = loginButton.querySelector('.sidebar-nav-label')
        if (label) label.textContent = 'Войти'
      }
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

  function getSavedSidebarExpanded() {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
    } catch (_error) {
      return false
    }
  }

  function persistSidebarExpanded(expanded) {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded))
    } catch (_error) {
      // no-op
    }
  }

  function rerenderMapAfterLayoutShift() {
    if (!map?.container) return

    window.requestAnimationFrame(() => {
      try {
        map.container.fitToViewport()
      } catch (_error) {
        // no-op
      }
    })
  }

  function setSidebarExpanded(expanded) {
    if (!sidebar || !sidebarToggle || !mapPage) return
    sidebar.classList.toggle('sidebar--expanded', expanded)
    const shouldShiftLayout = window.matchMedia('(max-width: 720px)').matches
    mapPage.classList.toggle('map-page--sidebar-expanded', expanded && shouldShiftLayout)
    sidebarToggle.setAttribute('aria-expanded', String(expanded))
    sidebarToggle.setAttribute('aria-label', expanded ? 'Свернуть панель' : 'Развернуть панель')
    persistSidebarExpanded(expanded)
    rerenderMapAfterLayoutShift()
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

    sidebar.classList.add('sidebar--no-animate')
    setSidebarExpanded(getSavedSidebarExpanded())
    window.requestAnimationFrame(() => {
      sidebar.classList.remove('sidebar--no-animate')
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

  function setProfileModalMessage(text, isError = false) {
    if (!profileModalMessage) return
    profileModalMessage.textContent = text
    profileModalMessage.classList.toggle('error', isError)
  }

  function fillProfileModal(user) {
    const profile = user && typeof user === 'object' ? user : {}
    const displayName = getUserDisplayName(profile)
    if (profileFullName) profileFullName.value = displayName === 'Пользователь' ? '' : displayName
    if (profileEmail) profileEmail.value = String(profile.email || '').trim()
    if (profilePassword) profilePassword.value = ''
    if (profileAbout) profileAbout.value = String(profile.about || '').trim()
    if (profileRole) profileRole.textContent = getUserRoleLabel(profile.role)
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

    sidebarProfileButton?.addEventListener('click', () => {
      if (!token) {
        window.location.href = 'login.html'
        return
      }

      openProfileModal()
    })
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
    if (!token) {
      setProfileModalMessage('Для редактирования профиля войдите в систему', true)
      return
    }

    const payload = {
      fullname: String(profileFullName?.value || '').trim(),
      email: String(profileEmail?.value || '').trim(),
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
      setProfileModalMessage(data?.message || 'Профиль обновлен')
    } catch (error) {
      setProfileModalMessage(error?.message || 'Не удалось сохранить профиль', true)
    } finally {
      if (profileModalSave) profileModalSave.disabled = false
    }
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
    reportBtn.classList.toggle('report-btn--cancel', isVisible)
    reportBtn.textContent = isVisible ? 'Отмена' : 'Сообщить о проблеме'
    if (!isVisible) {
      closeAllCustomSelects()
    }
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
    rebuildCustomSelectOptions(categorySelect.id)
  }

  function fillSubcategories(categoryId) {
    resetSubcategories()

    if (!categoryId) {
      rebuildCustomSelectOptions(subcategorySelect.id)
      return
    }

    const category = categories.find(item => String(item.id) === String(categoryId))
    if (!category || !Array.isArray(category.subcategories)) {
      rebuildCustomSelectOptions(subcategorySelect.id)
      return
    }

    for (const subcategory of category.subcategories) {
      const option = document.createElement('option')
      option.value = String(subcategory.id)
      option.textContent = subcategory.name
      subcategorySelect.append(option)
    }

    rebuildCustomSelectOptions(subcategorySelect.id)
  }

  function clearSelectedPoint() {
    if (map && selectedPlacemark) {
      map.geoObjects.remove(selectedPlacemark)
    }

    selectedPlacemark = null
    selectedCoords = null
    resetAppealForm()
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

  function getAppealStatusText(appeal) {
    const status = String(appeal.status || '')
    if (status === 'pending') return 'Ожидает проверки'
    if (status === 'confirmed') return 'Принята'
    if (status === 'rejected') return 'Отклонена'
    return formatAppealStatus(status)
  }

  function getAppealStatusTone(appeal) {
    const status = String(appeal.status || '')
    const message = String(appeal.ai_status_message || '').toLowerCase()

    if (status === 'rejected' || message.includes('отклон')) return 'rejected'
    if (
      status === 'confirmed' ||
      status === 'in_progress' ||
      status === 'resolved' ||
      message.includes('принят') ||
      message.includes('направлен')
    ) return 'confirmed'
    return 'pending'
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
    if (appealDetailsCarousel) {
      appealDetailsCarousel.scrollLeft = 0
    }
    appealDetailsModal.hidden = true
    document.body.style.overflow = ''
  }

  function updateAppealDetailsCarouselState() {
    if (!appealDetailsCarousel) return

    const carouselStyle = window.getComputedStyle(appealDetailsCarousel)
    const sliderEnabled =
      (carouselStyle.overflowX === 'auto' || carouselStyle.overflowX === 'scroll') &&
      appealDetailsCarousel.scrollWidth - appealDetailsCarousel.clientWidth > 1

    if (!sliderEnabled) {
      if (appealDetailsCarouselPrev) {
        appealDetailsCarouselPrev.hidden = true
        appealDetailsCarouselPrev.disabled = true
      }
      if (appealDetailsCarouselNext) {
        appealDetailsCarouselNext.hidden = true
        appealDetailsCarouselNext.disabled = true
      }
      return
    }

    const maxScroll = appealDetailsCarousel.scrollWidth - appealDetailsCarousel.clientWidth
    if (maxScroll <= 1) {
      if (appealDetailsCarouselPrev) {
        appealDetailsCarouselPrev.hidden = true
        appealDetailsCarouselPrev.disabled = true
      }
      if (appealDetailsCarouselNext) {
        appealDetailsCarouselNext.hidden = true
        appealDetailsCarouselNext.disabled = true
      }
      return
    }

    const left = appealDetailsCarousel.scrollLeft
    const atStart = left <= 2
    const atEnd = left >= maxScroll - 2

    if (appealDetailsCarouselPrev) {
      appealDetailsCarouselPrev.hidden = atStart
      appealDetailsCarouselPrev.disabled = atStart
    }
    if (appealDetailsCarouselNext) {
      appealDetailsCarouselNext.hidden = atEnd
      appealDetailsCarouselNext.disabled = atEnd
    }
  }

  function setupAppealDetailsCarousel() {
    if (!appealDetailsCarousel) return

    const onWheel = event => {
      if (event.ctrlKey) return
      if (appealDetailsCarousel.scrollWidth <= appealDetailsCarousel.clientWidth) return

      let x = event.deltaX
      let y = event.deltaY
      if (event.deltaMode === 1) {
        const line = 16
        x *= line
        y *= line
      } else if (event.deltaMode === 2) {
        x *= appealDetailsCarousel.clientWidth
        y *= appealDetailsCarousel.clientHeight
      }

      const delta = Math.abs(x) > Math.abs(y) ? x : y
      if (delta === 0) return

      event.preventDefault()
      appealDetailsCarousel.scrollLeft += delta
      updateAppealDetailsCarouselState()
    }

    appealDetailsCarousel.addEventListener('wheel', onWheel, { passive: false })
    appealDetailsCarousel.addEventListener('scroll', updateAppealDetailsCarouselState, { passive: true })

    const stepClick = () => Math.min(260, Math.max(appealDetailsCarousel.clientWidth - 80, 180))

    appealDetailsCarouselPrev?.addEventListener('click', () => {
      appealDetailsCarousel.scrollBy({ left: -stepClick(), behavior: 'smooth' })
      window.setTimeout(updateAppealDetailsCarouselState, 400)
    })

    appealDetailsCarouselNext?.addEventListener('click', () => {
      appealDetailsCarousel.scrollBy({ left: stepClick(), behavior: 'smooth' })
      window.setTimeout(updateAppealDetailsCarouselState, 400)
    })

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => updateAppealDetailsCarouselState())
      ro.observe(appealDetailsCarousel)
    }

    updateAppealDetailsCarouselState()
  }

  function openAppealDetailsModal(appeal) {
    const userName = appeal.user?.name || 'Без имени'
    const userLevel = Number(appeal.user?.level || 0)
    const category = appeal.category || '-'
    const subcategory = appeal.subcategory || 'Без подкатегории'

    appealDetailsTitle.textContent = `Заявка #${appeal.id}`
    if (appealDetailsBadge) {
      appealDetailsBadge.textContent = `#${appeal.id}`
    }
    appealDetailsUser.textContent = `${userName} (${userLevel} уровень)`
    appealDetailsCategory.textContent = `${category} / ${subcategory}`
    appealDetailsStatus.textContent = getAppealStatusText(appeal)
    appealDetailsStatus.classList.remove(
      'appeal-details-modal__meta-value--pending',
      'appeal-details-modal__meta-value--confirmed',
      'appeal-details-modal__meta-value--rejected'
    )
    appealDetailsStatus.classList.add(`appeal-details-modal__meta-value--${getAppealStatusTone(appeal)}`)
    appealDetailsDate.textContent = formatAppealDate(appeal.created_at)
    appealDetailsCoords.textContent = `${Number(appeal.latitude).toFixed(6)}, ${Number(appeal.longitude).toFixed(6)}`
    appealDetailsDescription.textContent = String(appeal.description || 'Описание не указано')

    appealDetailsImages.textContent = ''
    const sourceImages = Array.isArray(appeal.images) ? appeal.images.slice(0, 9) : []
    const imageUrls = sourceImages.length
      ? sourceImages.map((imageData, index) => imageData.url || createMiniPhotoUrl(index, 360))
      : [createMiniPhotoUrl(0, 360), createMiniPhotoUrl(1, 360), createMiniPhotoUrl(2, 360)]

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
    if (appealDetailsCarousel) {
      appealDetailsCarousel.scrollLeft = 0
      window.requestAnimationFrame(() => updateAppealDetailsCarouselState())
    }
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
    if (!token) {
      return null
    }

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
      throw new Error('Требуется авторизация')
    }

    return data?.user || null
  }

  async function loadCategories() {
    if (!token) {
      categories = []
      fillCategories()
      return
    }

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
    const headers = token ? { Authorization: `Bearer ${token}` } : {}
    const response = await fetch('backend/map_appeals.php', {
      method: 'GET',
      headers,
    })

    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось загрузить заявки карты')
    }

    const mapStatuses = new Set(['confirmed', 'in_progress', 'resolved'])
    allAppeals = (Array.isArray(data.appeals) ? data.appeals : []).filter(appeal =>
      mapStatuses.has(String(appeal.status || ''))
    )
    refreshVisibleAppeals()
  }

  async function submitAppeal(event) {
    event.preventDefault()

    if (!token) {
      setFormMessage('Для отправки заявки войдите в систему', true)
      return
    }

    if (!selectedCoords) {
      setFormMessage('Сначала выберите точку на карте', true)
      return
    }

    const categoryId = Number(categorySelect.value)
    const subcategoryId = subcategorySelect.value ? Number(subcategorySelect.value) : null
    const description = descriptionInput.value.trim()
    const priority = getSelectedPriorityValue()
    const imageFiles = Array.from(imagesInput.files || [])
    const allowedImageTypes = new Set(['image/png', 'image/jpeg'])
    const allowedImageExtensions = new Set(['png', 'jpg', 'jpeg'])
    const maxImageSize = 5 * 1024 * 1024

    if (!categoryId || !description) {
      setFormMessage('Заполните обязательные поля: категория и описание', true)
      return
    }

    for (const file of imageFiles) {
      const extension = String(file.name || '').split('.').pop()?.toLowerCase() || ''
      if (!allowedImageTypes.has(file.type) || !allowedImageExtensions.has(extension)) {
        setFormMessage('Можно прикреплять только PNG, JPG и JPEG', true)
        return
      }

      if (file.size > maxImageSize) {
        setFormMessage('Размер каждого фото не должен превышать 5 МБ', true)
        return
      }
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

      const filesForUpload = []
      for (const file of imageFiles) {
        const compressed = await compressAppealImage(file)
        if (compressed.size > maxImageSize) {
          setFormMessage('Размер каждого фото после сжатия не должен превышать 5 МБ', true)
          return
        }
        filesForUpload.push(compressed)
      }

      for (const file of filesForUpload) {
        formData.append('images[]', file, file.name)
      }

      const response = await fetch('backend/create_appeal.php', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setFormMessage(data.message || 'Не удалось отправить заявку. Попробуйте ещё раз.', true)
        return
      }

      const appealId = Number(data.appeal?.id || 0)
      resetAppealForm()
      clearSelectedPoint()
      await loadAppeals()
      setFormMessage('Заявка отправлена. Идет проверка...')

      if (data.ai_processing_required && appealId > 0) {
        try {
          const aiResponse = await fetch('backend/process_appeal_ai.php', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ appeal_id: appealId }),
          })
          const aiData = await aiResponse.json().catch(() => ({}))

          await loadAppeals()
          if (!aiResponse.ok) {
            setFormMessage(aiData.message || 'Заявка создана и ожидает проверки.', true)
            return
          }

          setFormMessage(aiData.message || 'Проверка завершена')
        } catch (_error) {
          await loadAppeals()
          setFormMessage('Заявка создана и ожидает проверки.', true)
        }
      } else {
        setFormMessage('Заявка успешно отправлена')
      }
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
    if (!token) {
      window.location.href = 'login.html'
      return
    }

    if (!selectedCoords) return
    setFormVisible(true)
    descriptionInput.focus()
  })

  reportBtn.addEventListener('click', () => {
    if (!token) {
      window.location.href = 'login.html'
      return
    }

    if (!formWrap.hidden) {
      clearSelectedPoint()
      setFormMessage('')
      return
    }

    setFormVisible(true)

    setFormMessage('')
    descriptionInput.focus()
  })

  searchInput.addEventListener('input', refreshVisibleAppeals)

  categorySelect.addEventListener('change', () => {
    fillSubcategories(categorySelect.value)
  })

  form.addEventListener('submit', submitAppeal)
  registerCustomSelect(categorySelect)
  registerCustomSelect(subcategorySelect)
  document.addEventListener('click', event => {
    const target = event.target
    if (!(target instanceof Element)) return
    if (target.closest('.custom-select')) return
    closeAllCustomSelects()
  })
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      closeAllCustomSelects()
    }
  })
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
      currentUser = user
      setupProfileBadge(user)
      return loadCategories()
    })
    .then(() => loadAppeals())
    .catch(error => {
      setupProfileBadge({})
      setFormVisible(false)
      return loadAppeals().catch(loadError => {
        renderAppealsError(loadError?.message || error?.message || 'Ошибка загрузки данных')
      })
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

