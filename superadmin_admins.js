;(() => {
  const token = localStorage.getItem('token')

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const sidebar = document.getElementById('superSidebar')
  const sidebarToggle = document.getElementById('superSidebarToggle')
  const sidebarSpacer = document.getElementById('superSidebarSpacer')
  const sidebarAvatar = document.getElementById('superSidebarAvatar')
  const sidebarName = document.getElementById('superSidebarName')
  const sidebarRole = document.getElementById('superSidebarRole')

  const organizationMeta = document.getElementById('organizationMeta')
  const statsContainer = document.getElementById('superStats')
  const listFeedback = document.getElementById('listFeedback')
  const assignedAdminsGrid = document.getElementById('assignedAdminsGrid')

  const state = {
    user: null,
    stats: null,
    admins: [],
  }

  function getInitials(value) {
    const parts = String(value || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)

    if (parts.length === 0) return 'S'
    return parts.map(part => part[0]).join('').toUpperCase()
  }

  function getDisplayName(user) {
    if (!user || typeof user !== 'object') return 'Superadmin'
    if (user.login) return String(user.login)
    if (user.email) return String(user.email)
    return 'Superadmin'
  }

  function formatDate(value) {
    if (!value) return '—'

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)

    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date)
  }

  function setFeedback(text, isError = false) {
    if (!listFeedback) return
    listFeedback.textContent = text
    listFeedback.classList.toggle('error', isError)
  }

  function setSidebarExpanded(expanded) {
    if (!sidebar || !sidebarToggle) return

    sidebar.classList.toggle('super-sidebar--expanded', expanded)
    sidebarToggle.setAttribute('aria-expanded', String(expanded))
    sidebarToggle.setAttribute(
      'aria-label',
      expanded ? 'Свернуть панель' : 'Развернуть панель'
    )
  }

  function setupSidebar() {
    if (!sidebar || !sidebarToggle) return

    setSidebarExpanded(sidebar.classList.contains('super-sidebar--expanded'))

    const toggleSidebar = () => {
      setSidebarExpanded(!sidebar.classList.contains('super-sidebar--expanded'))
    }

    sidebarToggle.addEventListener('click', toggleSidebar)
    sidebarSpacer?.addEventListener('click', toggleSidebar)
    sidebar.addEventListener('click', event => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('button, a, input, select, textarea, label, [role="button"]')) {
        return
      }
      toggleSidebar()
    })

    document.querySelectorAll('.super-sidebar__item[data-href], .super-sidebar__item[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        const action = button.getAttribute('data-action')
        if (action === 'logout') {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          window.location.replace('index.html')
          return
        }

        const href = button.getAttribute('data-href')
        if (href) window.location.href = href
      })
    })
  }

  function renderStats() {
    if (!statsContainer) return

    const stats = state.stats || {}
    const items = [
      { label: 'Назначено всего', value: Number(stats.appointed_total || 0) },
      { label: 'Активных', value: Number(stats.appointed_active || 0) },
    ]

    statsContainer.textContent = ''
    items.forEach(item => {
      const card = document.createElement('article')
      card.className = 'super-stat'

      const value = document.createElement('p')
      value.className = 'super-stat__value'
      value.textContent = String(item.value)

      const label = document.createElement('p')
      label.className = 'super-stat__label'
      label.textContent = item.label

      card.append(value, label)
      statsContainer.append(card)
    })
  }

  function renderAdmins() {
    if (!assignedAdminsGrid) return

    assignedAdminsGrid.textContent = ''
    if (!Array.isArray(state.admins) || state.admins.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'super-empty'
      empty.textContent = 'Вы пока никого не назначили.'
      assignedAdminsGrid.append(empty)
      return
    }

    state.admins.forEach(admin => {
      const card = document.createElement('article')
      card.className = 'super-admin'

      const title = document.createElement('h3')
      title.className = 'super-admin__title'
      title.textContent = String(admin.login || 'Без логина')

      const status = document.createElement('span')
      status.className = `super-admin__status${admin.is_active ? ' is-active' : ''}`
      status.textContent = admin.is_active ? 'active' : 'inactive'

      const filial = document.createElement('p')
      filial.className = 'super-admin__meta'
      filial.textContent = admin.filial_name
        ? `Филиал: ${admin.filial_name}${admin.filial_region ? `, ${admin.filial_region}` : ''}`
        : 'Филиал: без привязки'

      const appointedAt = document.createElement('p')
      appointedAt.className = 'super-admin__meta'
      appointedAt.textContent = `Назначен: ${formatDate(admin.appointed_at)}`

      const lastAction = document.createElement('p')
      lastAction.className = 'super-admin__meta'
      lastAction.textContent = `Последнее действие: ${admin.last_action || '—'} (${formatDate(admin.last_action_at)})`

      card.append(title, status, filial, appointedAt, lastAction)

      if (admin.is_active) {
        const actions = document.createElement('div')
        actions.className = 'super-admin__actions'

        const removeButton = document.createElement('button')
        removeButton.type = 'button'
        removeButton.className = 'super-admin__remove'
        removeButton.dataset.adminId = String(admin.id)
        removeButton.textContent = 'Удалить'

        actions.append(removeButton)
        card.append(actions)
      }

      assignedAdminsGrid.append(card)
    })
  }

  function applyHeader() {
    const user = state.user
    if (!user) return

    if (organizationMeta) {
      organizationMeta.textContent = `Организация: ${user.organization_name} (${user.organization_type})`
    }

    const displayName = getDisplayName(user)
    if (sidebarName) sidebarName.textContent = displayName
    if (sidebarAvatar) sidebarAvatar.textContent = getInitials(displayName)
    if (sidebarRole) sidebarRole.textContent = 'superadmin'
  }

  function renderAll() {
    applyHeader()
    renderStats()
    renderAdmins()
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
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
      throw new Error(data.message || 'Ошибка запроса')
    }

    return data
  }

  async function ensureSuperadmin() {
    const data = await fetchJson('backend/me.php')
    const user = data?.user

    if (!user) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('login.html')
      throw new Error('__redirect_login__')
    }

    if (user.role === 'admin') {
      window.location.replace('admin.html')
      throw new Error('__redirect_admin__')
    }

    if (user.role !== 'superadmin' || user.auth_source !== 'org_admins') {
      window.location.replace('map.html')
      throw new Error('__redirect_non_superadmin__')
    }

    state.user = user
  }

  async function loadPageData() {
    const data = await fetchJson('backend/superadmin_admin_refs.php')
    state.user = data.user || state.user
    state.stats = data.stats || null
    state.admins = Array.isArray(data.admins) ? data.admins : []
    renderAll()
  }

  async function deleteAdmin(adminId) {
    await fetchJson('backend/superadmin_delete_admin.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ admin_id: Number(adminId) }),
    })
  }

  function setupDeleteActions() {
    if (!assignedAdminsGrid) return

    assignedAdminsGrid.addEventListener('click', async event => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return

      const button = target.closest('button[data-admin-id]')
      if (!button) return

      const adminId = Number(button.dataset.adminId || 0)
      if (!adminId) return

      const confirmed = window.confirm('Удалить этого администратора? Он будет деактивирован.')
      if (!confirmed) return

      button.disabled = true
      setFeedback('Удаление администратора...')

      try {
        await deleteAdmin(adminId)
        setFeedback('Администратор удален')
        await loadPageData()
      } catch (error) {
        if (
          error?.message === '__redirect_login__' ||
          error?.message === '__redirect_admin__' ||
          error?.message === '__redirect_non_superadmin__'
        ) {
          return
        }
        setFeedback(error.message || 'Не удалось удалить администратора', true)
      } finally {
        button.disabled = false
      }
    })
  }

  async function init() {
    setupSidebar()
    setupDeleteActions()

    try {
      await ensureSuperadmin()
      await loadPageData()
    } catch (error) {
      if (
        error?.message === '__redirect_login__' ||
        error?.message === '__redirect_admin__' ||
        error?.message === '__redirect_non_superadmin__'
      ) {
        return
      }

      setFeedback(error.message || 'Не удалось загрузить страницу', true)
    }
  }

  init()
})()
