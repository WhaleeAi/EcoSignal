;(() => {
  const token = localStorage.getItem('token')

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const statsGrid = document.getElementById('statsGrid')
  const appealsGrid = document.getElementById('appealsGrid')
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarSpacer = document.querySelector('.sidebar-spacer')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileName = document.querySelector('.sidebar-profile-name')
  const sidebarProfileLevel = document.querySelector('.sidebar-profile-level')

  const PHOTO_PALETTE = [
    ['#f4dca1', '#d3bd8a'],
    ['#bfd7bf', '#97b798'],
    ['#b6d4dd', '#8db5c0'],
    ['#e5d0bc', '#c9aa90'],
    ['#d3c8f1', '#b0a0df'],
    ['#f1c8cd', '#e3a8b1'],
  ]

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

  function createMiniPhotoUrl(label, index) {
    const palette = PHOTO_PALETTE[index % PHOTO_PALETTE.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="100%" stop-color="${palette[1]}"/>
        </linearGradient>
      </defs>
      <rect width="44" height="44" rx="8" fill="url(#g)"/>
      <circle cx="14" cy="15" r="4" fill="rgba(20,20,19,0.18)"/>
      <path d="M6 36L16 24L22 30L30 20L38 36Z" fill="rgba(20,20,19,0.22)"/>
      <text x="22" y="40" text-anchor="middle" font-size="7" font-family="Roboto Flex, sans-serif" fill="rgba(20,20,19,0.45)">${label}</text>
    </svg>`

    return toDataUrl(svg)
  }

  function createStatCard(stat) {
    const card = document.createElement('article')
    card.className = 'stat-card'
    card.dataset.metric = stat.key

    const value = document.createElement('p')
    value.className = 'stat-card__value'
    value.textContent = String(stat.value)

    const label = document.createElement('p')
    label.className = 'stat-card__label'
    label.textContent = stat.label

    card.append(value, label)
    return card
  }

  function createAppealCard(appeal) {
    const card = document.createElement('article')
    card.className = 'appeal-card'
    card.dataset.appealId = String(appeal.id)
    card.dataset.status = String(appeal.status || 'pending')
    card.dataset.assignedAdminId = String(appeal.assigned_admin_id || '')

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

    inputImages.forEach((photo, index) => {
      const image = document.createElement('img')
      image.className = 'appeal-card__photo'
      image.width = 44
      image.height = 44
      image.alt = `Фото заявки ${index + 1}`
      image.src = photo.url || createMiniPhotoUrl(photo.label || index + 1, index)
      photosRow.append(image)
    })

    topRow.append(userRow, photosRow)

    const category = document.createElement('p')
    category.className = 'appeal-card__category'
    const categoryName = String(appeal.category || 'Категория')
    const subcategoryName = String(appeal.subcategory || 'Без подкатегории')
    category.textContent = `${categoryName}, ${subcategoryName}`

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

    if (!Array.isArray(appeals) || appeals.length === 0) {
      const emptyState = document.createElement('p')
      emptyState.className = 'appeals-empty'
      emptyState.textContent = 'У вас пока нет назначенных заявок.'
      appealsGrid.append(emptyState)
      return
    }

    appeals.forEach(appeal => appealsGrid.append(createAppealCard(appeal)))
  }

  function renderErrorState(message) {
    if (!appealsGrid) return
    appealsGrid.textContent = ''

    const state = document.createElement('p')
    state.className = 'appeals-empty'
    state.textContent = message
    appealsGrid.append(state)
  }

  async function ensureAdmin() {
    const response = await fetch('backend/me.php', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.user) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('login.html')
      throw new Error('__redirect_login__')
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
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

  function setupSidebarActions() {
    const navButtons = document.querySelectorAll('.sidebar-nav-item[data-href]')
    navButtons.forEach(button => {
      button.addEventListener('click', () => {
        const href = button.dataset.href
        if (href) {
          window.location.href = href
        }
      })
    })
  }

  function setupSidebarToggle() {
    if (!sidebar || !sidebarToggle) return

    const toggleSidebar = () => {
      const expanded = sidebar.classList.toggle('sidebar--expanded')
      sidebarToggle.setAttribute('aria-expanded', String(expanded))
      sidebarToggle.setAttribute(
        'aria-label',
        expanded ? 'Свернуть панель' : 'Развернуть панель'
      )
    }

    sidebarToggle.addEventListener('click', toggleSidebar)
    if (sidebarSpacer) {
      sidebarSpacer.addEventListener('click', toggleSidebar)
    }
  }

  function setupProfileBadge(user) {
    const displayName = getUserDisplayName(user)

    if (sidebarAvatar) {
      sidebarAvatar.textContent = getInitials(displayName)
    }

    if (sidebarProfileName) {
      sidebarProfileName.textContent = displayName
    }

    if (sidebarProfileLevel) {
      sidebarProfileLevel.textContent = 'Администратор'
    }
  }

  async function init() {
    setupSidebarActions()
    setupSidebarToggle()

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
        error?.message === '__redirect_non_admin__'
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

