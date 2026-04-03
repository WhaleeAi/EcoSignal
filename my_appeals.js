;(() => {
  const token = localStorage.getItem('token')

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const title = document.getElementById('myAppealsTitle')
  const userCaption = document.getElementById('myAppealsUser')
  const grid = document.getElementById('myAppealsGrid')
  const mapBtn = document.getElementById('myAppealsMapBtn')
  const logoutBtn = document.getElementById('myAppealsLogoutBtn')

  if (!title || !userCaption || !grid || !mapBtn || !logoutBtn) {
    return
  }

  mapBtn.addEventListener('click', () => {
    window.location.href = 'map.html'
  })

  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.replace('index.html')
  })

  function statusLabel(status) {
    const labels = {
      pending: 'Ожидает',
      confirmed: 'Подтверждена',
      in_progress: 'В работе',
      resolved: 'Решена',
      rejected: 'Отклонена',
    }
    return labels[String(status || '')] || String(status || 'Неизвестно')
  }

  function toDataUrl(svgMarkup) {
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`
  }

  function createPlaceholder(index, size = 180) {
    const palettes = [
      ['#f4dca1', '#d3bd8a'],
      ['#bfd7bf', '#97b798'],
      ['#b6d4dd', '#8db5c0'],
      ['#e5d0bc', '#c9aa90'],
    ]
    const palette = palettes[index % palettes.length]
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${palette[0]}"/>
          <stop offset="100%" stop-color="${palette[1]}"/>
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="12" fill="url(#g)"/>
    </svg>`
    return toDataUrl(svg)
  }

  function formatDate(raw) {
    const dt = new Date(raw)
    if (Number.isNaN(dt.getTime())) return String(raw || '-')
    return dt.toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function createCard(appeal) {
    const card = document.createElement('article')
    card.className = 'card'

    const top = document.createElement('div')
    top.className = 'card__row'

    const id = document.createElement('p')
    id.className = 'card__id'
    id.textContent = `Заявка #${appeal.id}`

    const status = document.createElement('p')
    status.className = 'card__status'
    status.textContent = `${statusLabel(appeal.status)} | приоритет ${Number(appeal.priority || 0)}`

    top.append(id, status)

    const desc = document.createElement('p')
    desc.className = 'card__desc'
    desc.textContent = String(appeal.description || 'Без описания')

    const meta = document.createElement('p')
    meta.className = 'card__meta'
    meta.innerHTML = [
      `Категория: ${appeal.category || '-'} / ${appeal.subcategory || 'Без подкатегории'}`,
      `Создано: ${formatDate(appeal.created_at)}`,
      `Координаты: ${Number(appeal.latitude).toFixed(6)}, ${Number(appeal.longitude).toFixed(6)}`,
    ].join('<br/>')

    const imagesWrap = document.createElement('div')
    imagesWrap.className = 'card__images'
    const images = Array.isArray(appeal.images) ? appeal.images.slice(0, 6) : []

    if (!images.length) {
      const image = document.createElement('img')
      image.className = 'card__image'
      image.alt = 'Фото отсутствует'
      image.src = createPlaceholder(0)
      imagesWrap.append(image)
    } else {
      images.forEach((entry, index) => {
        const image = document.createElement('img')
        image.className = 'card__image'
        image.alt = `Фото ${index + 1}`
        image.src = entry.url || createPlaceholder(index)
        imagesWrap.append(image)
      })
    }

    card.append(top, desc, meta, imagesWrap)
    return card
  }

  function renderEmpty(message) {
    grid.textContent = ''
    const empty = document.createElement('p')
    empty.className = 'empty'
    empty.textContent = message
    grid.append(empty)
  }

  async function ensureAuthorized() {
    const response = await fetch('backend/me.php', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => null)

    if (!response.ok || !data?.user) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('login.html')
      throw new Error('__redirect__')
    }

    if (data.user.role === 'admin') {
      window.location.replace('admin.html')
      throw new Error('__redirect__')
    }

    if (data.user.role === 'superadmin') {
      window.location.replace('superadmin.html')
      throw new Error('__redirect__')
    }

    return data.user
  }

  async function loadAppeals() {
    const response = await fetch('backend/my_appeals.php', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось загрузить обращения')
    }

    return data
  }

  Promise.resolve()
    .then(() => ensureAuthorized())
    .then(user => {
      userCaption.textContent = `Пользователь: ${[user.first_name, user.last_name].filter(Boolean).join(' ') || user.email || ''}`
      return loadAppeals()
    })
    .then(data => {
      const appeals = Array.isArray(data.appeals) ? data.appeals : []
      title.textContent = `Мои обращения: ${appeals.length}`
      if (!appeals.length) {
        renderEmpty('У вас пока нет обращений.')
        return
      }

      grid.textContent = ''
      appeals.forEach(appeal => grid.append(createCard(appeal)))
    })
    .catch(error => {
      if (error?.message === '__redirect__') return
      renderEmpty(error?.message || 'Ошибка загрузки обращений')
    })
})()

