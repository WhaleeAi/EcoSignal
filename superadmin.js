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

  const createAdminForm = document.getElementById('createAdminForm')
  const createAdminFullName = document.getElementById('createAdminFullName')
  const createAdminEmail = document.getElementById('createAdminEmail')
  const createAdminPassword = document.getElementById('createAdminPassword')
  const createAdminFeedback = document.getElementById('createAdminFeedback')

  const pendingRequestsGrid = document.getElementById('pendingRequestsGrid')
  const adminsGrid = document.getElementById('adminsGrid')
  const statsContainer = document.getElementById('superStats')

  const state = {
    pendingRequests: [],
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

  function getUserName(user) {
    if (!user || typeof user !== 'object') return 'Superadmin'

    const combined = `${user.first_name || ''} ${user.last_name || ''}`.trim()
    if (combined) return combined
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
    if (!createAdminFeedback) return
    createAdminFeedback.textContent = text
    createAdminFeedback.classList.toggle('error', isError)
  }

  function setupSidebar() {
    if (!sidebar || !sidebarToggle) return

    const toggle = () => {
      const expanded = sidebar.classList.toggle('super-sidebar--expanded')
      sidebarToggle.setAttribute('aria-expanded', String(expanded))
      sidebarToggle.setAttribute(
        'aria-label',
        expanded ? 'Свернуть панель' : 'Развернуть панель'
      )
    }

    sidebarToggle.addEventListener('click', toggle)
    sidebarSpacer?.addEventListener('click', toggle)
    sidebar.addEventListener('click', event => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('button, a, input, select, textarea, label, [role="button"]')) {
        return
      }
      toggle()
    })

    document.querySelectorAll('.super-sidebar__item[data-href]').forEach(button => {
      button.addEventListener('click', () => {
        const href = button.getAttribute('data-href')
        if (href) window.location.href = href
      })
    })
  }

  function renderStats() {
    if (!statsContainer) return

    const items = [
      { label: 'Pending-заявки', value: state.pendingRequests.length },
      { label: 'Администраторы', value: state.admins.length },
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

  function renderPendingRequests() {
    if (!pendingRequestsGrid) return

    pendingRequestsGrid.textContent = ''

    if (state.pendingRequests.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'super-empty'
      empty.textContent = 'Новых заявок на роль admin нет.'
      pendingRequestsGrid.append(empty)
      return
    }

    state.pendingRequests.forEach(request => {
      const card = document.createElement('article')
      card.className = 'super-request'
      card.dataset.requestId = String(request.id)

      const title = document.createElement('h3')
      title.className = 'super-request__title'
      title.textContent = `${request.first_name || ''} ${request.last_name || ''}`.trim() || request.email

      const email = document.createElement('p')
      email.className = 'super-request__meta'
      email.textContent = request.email

      const requestedAt = document.createElement('p')
      requestedAt.className = 'super-request__meta'
      requestedAt.textContent = `Дата заявки: ${formatDate(request.requested_at)}`

      const actions = document.createElement('div')
      actions.className = 'super-request__actions'

      const approve = document.createElement('button')
      approve.className = 'super-request__action'
      approve.type = 'button'
      approve.dataset.action = 'approve'
      approve.textContent = 'Одобрить'

      const reject = document.createElement('button')
      reject.className = 'super-request__action--ghost'
      reject.type = 'button'
      reject.dataset.action = 'reject'
      reject.textContent = 'Отклонить'

      actions.append(approve, reject)
      card.append(title, email, requestedAt, actions)
      pendingRequestsGrid.append(card)
    })
  }

  function renderAdmins() {
    if (!adminsGrid) return

    adminsGrid.textContent = ''

    if (state.admins.length === 0) {
      const empty = document.createElement('p')
      empty.className = 'super-empty'
      empty.textContent = 'Администраторы пока не добавлены.'
      adminsGrid.append(empty)
      return
    }

    state.admins.forEach(admin => {
      const card = document.createElement('article')
      card.className = 'super-admin'

      const title = document.createElement('h3')
      title.className = 'super-admin__title'
      title.textContent = `${admin.first_name || ''} ${admin.last_name || ''}`.trim() || admin.email

      const email = document.createElement('p')
      email.className = 'super-admin__meta'
      email.textContent = admin.email

      const createdAt = document.createElement('p')
      createdAt.className = 'super-admin__meta'
      createdAt.textContent = `Создан: ${formatDate(admin.created_at)}`

      card.append(title, email, createdAt)
      adminsGrid.append(card)
    })
  }

  function renderAll() {
    renderStats()
    renderPendingRequests()
    renderAdmins()
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options)
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      throw new Error(data.message || 'Ошибка запроса')
    }

    return data
  }

  async function ensureSuperadmin() {
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

    const role = data.user.role

    if (role === 'admin') {
      window.location.replace('admin.html')
      throw new Error('__redirect_admin__')
    }

    if (role !== 'superadmin') {
      window.location.replace('map.html')
      throw new Error('__redirect_non_superadmin__')
    }

    const displayName = getUserName(data.user)
    if (sidebarName) sidebarName.textContent = displayName
    if (sidebarAvatar) sidebarAvatar.textContent = getInitials(displayName)

    return data.user
  }

  async function loadDashboard() {
    const data = await fetchJson('backend/superadmin_dashboard.php', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    state.pendingRequests = Array.isArray(data.pending_requests) ? data.pending_requests : []
    state.admins = Array.isArray(data.admins) ? data.admins : []
    renderAll()
  }

  async function processRequest(requestId, action) {
    await fetchJson('backend/superadmin_process_request.php', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        request_id: Number(requestId),
        action,
      }),
    })

    await loadDashboard()
    setFeedback(action === 'approve' ? 'Заявка одобрена.' : 'Заявка отклонена.', false)
  }

  function setupPendingActions() {
    if (!pendingRequestsGrid) return

    pendingRequestsGrid.addEventListener('click', async event => {
      const target = event.target
      if (!(target instanceof HTMLElement)) return

      const button = target.closest('button[data-action]')
      if (!button) return

      const card = target.closest('.super-request')
      const requestId = card?.getAttribute('data-request-id')
      const action = button.getAttribute('data-action')

      if (!requestId || (action !== 'approve' && action !== 'reject')) {
        return
      }

      button.disabled = true
      setFeedback('Обработка заявки...')

      try {
        await processRequest(requestId, action)
      } catch (error) {
        setFeedback(error.message || 'Не удалось обработать заявку', true)
      } finally {
        button.disabled = false
      }
    })
  }

  function setupCreateAdminForm() {
    if (!createAdminForm) return

    createAdminForm.addEventListener('submit', async event => {
      event.preventDefault()

      const fullname = createAdminFullName?.value.trim() || ''
      const email = createAdminEmail?.value.trim() || ''
      const password = createAdminPassword?.value.trim() || ''

      if (!fullname || !email || !password) {
        setFeedback('Заполните все поля формы', true)
        return
      }

      const submitButton = createAdminForm.querySelector('button[type="submit"]')
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true
      }

      setFeedback('Добавление администратора...')

      try {
        await fetchJson('backend/superadmin_create_admin.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            fullname,
            email,
            password,
          }),
        })

        createAdminForm.reset()
        setFeedback('Администратор добавлен')
        await loadDashboard()
      } catch (error) {
        setFeedback(error.message || 'Не удалось добавить администратора', true)
      } finally {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false
        }
      }
    })
  }

  async function init() {
    setupSidebar()
    setupPendingActions()
    setupCreateAdminForm()

    try {
      await ensureSuperadmin()
      await loadDashboard()
    } catch (error) {
      if (
        error?.message === '__redirect_login__' ||
        error?.message === '__redirect_admin__' ||
        error?.message === '__redirect_non_superadmin__'
      ) {
        return
      }

      setFeedback(error.message || 'Не удалось загрузить панель superadmin', true)
    }
  }

  init()
})()
