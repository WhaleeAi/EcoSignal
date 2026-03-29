;(() => {
  const statsGrid = document.getElementById('statsGrid')
  const appealsGrid = document.getElementById('appealsGrid')
  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarSpacer = document.querySelector('.sidebar-spacer')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileName = document.querySelector('.sidebar-profile-name')

  const MOCK_STATS = [
    { key: 'new', label: 'Новые обращения', value: 27 },
    { key: 'assigned', label: 'Назначено мне', value: 8 },
    { key: 'reviewed', label: 'Рассмотрено (24ч / 7д)', value: '11 / 43' },
  ]

  const MOCK_APPEALS = [
    {
      id: 'AP-1482',
      user: { name: 'Анна Волкова', tone: '#8fba8b' },
      category: 'Загрязнение',
      subcategory: 'Свалка',
      description: 'Новый навал мусора у контейнерной площадки возле школы №8.',
      images: [{ label: '1' }, { label: '2' }, { label: '3' }, { label: '4' }],
    },
    {
      id: 'AP-1481',
      user: { name: 'Олег Миронов', tone: '#8eb0c8' },
      category: 'Вода',
      subcategory: 'Сброс',
      description: 'На берегу ручья заметен стойкий запах и масляная пленка.',
      images: [{ label: 'A' }, { label: 'B' }, { label: 'C' }, { label: 'D' }],
    },
    {
      id: 'AP-1479',
      user: { name: 'Мария Фролова', tone: '#c4ae81' },
      category: 'Воздух',
      subcategory: 'Дым',
      description: 'Плотный дым от сжигания отходов в частном секторе после 20:00.',
      images: [{ label: 'I' }, { label: 'II' }, { label: 'III' }, { label: 'IV' }],
    },
    {
      id: 'AP-1478',
      user: { name: 'Дмитрий Карпов', tone: '#a7b98e' },
      category: 'Шум',
      subcategory: 'Техника',
      description: 'Ночной шум строительной техники возле парковой зоны. Ночной шум строительной техники возле парковой зоны. Ночной шум строительной техники возле парковой зоны. Ночной шум строительной техники возле парковой зоны.',
      images: [{ label: 'X' }, { label: 'Y' }, { label: 'Z' }, { label: 'W' }],
    },
    {
      id: 'AP-1477',
      user: { name: 'Елена Тихонова', tone: '#c39a8b' },
      category: 'Почва',
      subcategory: 'Химия',
      description: 'Пятна неизвестной жидкости возле дренажной канавы, нужен отбор проб.',
      images: [{ label: 'R1' }, { label: 'R2' }, { label: 'R3' }, { label: 'R4' }],
    },
    {
      id: 'AP-1476',
      user: { name: 'Сергей Лазарев', tone: '#91ad9f' },
      category: 'Насаждения',
      subcategory: 'Вырубка',
      description: 'Фиксируется вырубка молодых деревьев без информационного щита.',
      images: [{ label: 'K1' }, { label: 'K2' }, { label: 'K3' }, { label: 'K4' }],
    },
  ]

  const PHOTO_PALETTE = [
    ['#f4dca1', '#d3bd8a'],
    ['#bfd7bf', '#97b798'],
    ['#b6d4dd', '#8db5c0'],
    ['#e5d0bc', '#c9aa90'],
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

  function createAvatarUrl(name, tone) {
    const initials = getInitials(name)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34">
      <rect width="34" height="34" rx="8" fill="${tone}"/>
      <text x="17" y="21.5" text-anchor="middle" font-size="12" font-family="Roboto Flex, sans-serif" fill="#1c1c1b">${initials}</text>
    </svg>`

    return toDataUrl(svg)
  }

  function createMiniPhotoUrl(label, index) {
    const palette = PHOTO_PALETTE[index % PHOTO_PALETTE.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 34 34">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="100%" stop-color="${palette[1]}"/>
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="8" fill="url(#g)"/>
      <circle cx="11" cy="12" r="3" fill="rgba(20,20,19,0.18)"/>
      <path d="M5 28L13 19L18 24L24 16L30 28Z" fill="rgba(20,20,19,0.22)"/>
      <text x="17" y="31" text-anchor="middle" font-size="6" font-family="Roboto Flex, sans-serif" fill="rgba(20,20,19,0.45)">${label}</text>
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
    card.dataset.appealId = appeal.id
    card.dataset.status = 'new'

    const topRow = document.createElement('div')
    topRow.className = 'appeal-card__top'

    const photosRow = document.createElement('div')
    photosRow.className = 'appeal-card__images'

    const safePhotos = Array.isArray(appeal.images) ? appeal.images.slice(0, 3) : []
    while (safePhotos.length < 3) {
      safePhotos.push({ label: String(safePhotos.length + 1) })
    }

    safePhotos.forEach((photo, index) => {
      const image = document.createElement('img')
      image.className = 'appeal-card__photo'
      image.width = 44
      image.height = 44
      image.alt = `Фото заявки ${index + 1}`
      image.src = photo.url || createMiniPhotoUrl(photo.label || index + 1, index)
      photosRow.append(image)
    })

    const userRow = document.createElement('div')
    userRow.className = 'appeal-card__user'

    const avatar = document.createElement('img')
    avatar.className = 'appeal-card__avatar'
    avatar.width = 44
    avatar.height = 44
    avatar.alt = `Пользователь: ${appeal.user.name}`
    avatar.src = createAvatarUrl(appeal.user.name, appeal.user.tone)

    const userMeta = document.createElement('div')
    const userName = document.createElement('p')
    userName.className = 'appeal-card__name'
    userName.textContent = appeal.user.name

    userMeta.append(userName)
    userRow.append(avatar, userMeta)
    topRow.append(userRow, photosRow)

    const category = document.createElement('p')
    category.className = 'appeal-card__category'
    category.textContent = `${appeal.category}, ${appeal.subcategory}`

    const description = document.createElement('p')
    description.className = 'appeal-card__description'
    description.textContent = appeal.description

    card.append(topRow, category, description)
    return card
  }

  async function loadDashboardData() {
    return {
      stats: MOCK_STATS,
      appeals: MOCK_APPEALS,
    }
  }

  function renderStats(stats) {
    if (!statsGrid) return
    statsGrid.textContent = ''
    stats.forEach(stat => statsGrid.append(createStatCard(stat)))
  }

  function renderAppeals(appeals) {
    if (!appealsGrid) return
    appealsGrid.textContent = ''

    if (!appeals.length) {
      const emptyState = document.createElement('p')
      emptyState.className = 'appeals-empty'
      emptyState.textContent = 'Новых заявок пока нет.'
      appealsGrid.append(emptyState)
      return
    }

    appeals.forEach(appeal => appealsGrid.append(createAppealCard(appeal)))
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

  function resolveProfileInitials() {
    try {
      const userData = JSON.parse(localStorage.getItem('user') || '{}')
      const baseName = userData.name || userData.full_name || userData.email || ''
      return getInitials(baseName)
    } catch {
      return 'A'
    }
  }

  function setupProfileBadge() {
    if (!sidebarAvatar) return
    let userData = {}
    try {
      userData = JSON.parse(localStorage.getItem('user') || '{}')
    } catch {
      userData = {}
    }

    sidebarAvatar.textContent = resolveProfileInitials()
    if (sidebarProfileName) {
      sidebarProfileName.textContent = 'Профиль'
    }
  }

  async function init() {
    setupSidebarActions()
    setupSidebarToggle()
    setupProfileBadge()

    const data = await loadDashboardData()
    renderStats(Array.isArray(data.stats) ? data.stats : [])
    renderAppeals(Array.isArray(data.appeals) ? data.appeals : [])
  }

  init()
})()
