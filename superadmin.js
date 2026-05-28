;(() => {
  const token = localStorage.getItem('token')
  const SIDEBAR_STORAGE_KEY = 'ecosignalSidebarExpanded'

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const state = {
    user: null,
    organizations: [],
    filials: [],
    admins: [],
  }

  const sidebar = document.getElementById('sidebar')
  const sidebarToggle = document.getElementById('sidebarToggle')
  const sidebarAvatar = document.getElementById('sidebarAvatar')
  const sidebarProfileName = document.getElementById('sidebarProfileName')
  const organizationsCount = document.getElementById('organizationsCount')
  const filialsCount = document.getElementById('filialsCount')
  const activeAdminsCount = document.getElementById('activeAdminsCount')
  const adminsSummary = document.getElementById('adminsSummary')
  const adminsTableBody = document.getElementById('adminsTableBody')
  const adminForm = document.getElementById('adminForm')
  const adminId = document.getElementById('adminId')
  const adminLogin = document.getElementById('adminLogin')
  const adminPassword = document.getElementById('adminPassword')
  const organizationSelect = document.getElementById('organizationSelect')
  const filialSelect = document.getElementById('filialSelect')
  const adminActive = document.getElementById('adminActive')
  const formMessage = document.getElementById('formMessage')
  const formTitle = document.getElementById('formTitle')
  const resetFormButton = document.getElementById('resetFormButton')
  const saveAdminButton = document.getElementById('saveAdminButton')

  function getInitials(value) {
    return String(value || 'S')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0])
      .join('')
      .toUpperCase() || 'S'
  }

  function setMessage(text, isError = false) {
    if (!formMessage) return
    formMessage.textContent = text
    formMessage.classList.toggle('error', isError)
  }

  function formatCoords(latitude, longitude) {
    const lat = Number(latitude)
    const lng = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return '—'
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
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

  function applyUser(user) {
    const name = user?.name || user?.login || 'Суперадмин'
    if (sidebarAvatar) sidebarAvatar.textContent = getInitials(name)
    if (sidebarProfileName) sidebarProfileName.textContent = name
  }

  function currentOrganizationId() {
    return Number(organizationSelect?.value || 0)
  }

  function filialsForOrganization(organizationId) {
    return state.filials.filter(filial => Number(filial.organization_id) === Number(organizationId))
  }

  function renderOrganizationOptions(selectedId = 0) {
    if (!organizationSelect) return
    organizationSelect.textContent = ''

    state.organizations.forEach(organization => {
      const option = document.createElement('option')
      option.value = String(organization.id)
      option.textContent = organization.name
      organizationSelect.append(option)
    })

    if (selectedId) {
      organizationSelect.value = String(selectedId)
    }
  }

  function renderFilialOptions(selectedId = 0) {
    if (!filialSelect) return
    filialSelect.textContent = ''

    filialsForOrganization(currentOrganizationId()).forEach(filial => {
      const option = document.createElement('option')
      option.value = String(filial.id)
      option.textContent = `${filial.name}${filial.region ? `, ${filial.region}` : ''}`
      filialSelect.append(option)
    })

    if (selectedId) {
      filialSelect.value = String(selectedId)
    }
  }

  function renderStats() {
    if (organizationsCount) organizationsCount.textContent = String(state.organizations.length)
    if (filialsCount) filialsCount.textContent = String(state.filials.length)
    if (activeAdminsCount) {
      activeAdminsCount.textContent = String(state.admins.filter(admin => admin.is_active).length)
    }
    if (adminsSummary) adminsSummary.textContent = `${state.admins.length} записей`
  }

  function createTextCell(primary, secondary = '') {
    const cell = document.createElement('td')
    cell.textContent = primary || '—'
    if (secondary) {
      const muted = document.createElement('span')
      muted.className = 'superadmin-muted'
      muted.textContent = secondary
      cell.append(muted)
    }
    return cell
  }

  function renderAdmins() {
    if (!adminsTableBody) return
    adminsTableBody.textContent = ''

    if (!state.admins.length) {
      const row = document.createElement('tr')
      const cell = document.createElement('td')
      cell.colSpan = 6
      const empty = document.createElement('p')
      empty.className = 'superadmin-empty'
      empty.textContent = 'Оргадмины еще не назначены.'
      cell.append(empty)
      row.append(cell)
      adminsTableBody.append(row)
      return
    }

    state.admins.forEach(admin => {
      const row = document.createElement('tr')
      row.append(createTextCell(admin.login, `Создан: ${formatDate(admin.created_at)}`))
      row.append(createTextCell(admin.organization_name, admin.organization_type))
      row.append(createTextCell(admin.filial_name, admin.filial_region || ''))
      row.append(createTextCell(formatCoords(admin.filial_latitude, admin.filial_longitude)))

      const statusCell = document.createElement('td')
      const status = document.createElement('span')
      status.className = `superadmin-status${admin.is_active ? '' : ' superadmin-status--inactive'}`
      status.textContent = admin.is_active ? 'Активен' : 'Отключен'
      statusCell.append(status)
      row.append(statusCell)

      const actionCell = document.createElement('td')
      const editButton = document.createElement('button')
      editButton.className = 'superadmin-row-btn'
      editButton.type = 'button'
      editButton.textContent = 'Изменить'
      editButton.addEventListener('click', () => fillForm(admin))
      actionCell.append(editButton)
      row.append(actionCell)

      adminsTableBody.append(row)
    })
  }

  function resetForm() {
    if (formTitle) formTitle.textContent = 'Новый оргадмин'
    if (adminId) adminId.value = ''
    if (adminLogin) adminLogin.value = ''
    if (adminPassword) {
      adminPassword.value = ''
      adminPassword.placeholder = ''
      adminPassword.required = true
    }
    if (adminActive) adminActive.checked = true
    renderOrganizationOptions(state.organizations[0]?.id || 0)
    renderFilialOptions()
    setMessage('')
  }

  function fillForm(admin) {
    if (formTitle) formTitle.textContent = 'Редактирование оргадмина'
    if (adminId) adminId.value = String(admin.id)
    if (adminLogin) adminLogin.value = admin.login || ''
    if (adminPassword) {
      adminPassword.value = ''
      adminPassword.placeholder = 'Оставьте пустым, чтобы не менять'
      adminPassword.required = false
    }
    if (adminActive) adminActive.checked = Boolean(admin.is_active)
    renderOrganizationOptions(admin.organization_id)
    renderFilialOptions(admin.filial_id)
    setMessage('')
    adminLogin?.focus()
  }

  function applyPayload(data) {
    state.user = data.user || state.user
    state.organizations = Array.isArray(data.organizations) ? data.organizations : []
    state.filials = Array.isArray(data.filials) ? data.filials : []
    state.admins = Array.isArray(data.admins) ? data.admins : []

    applyUser(state.user)
    renderStats()
    renderOrganizationOptions(Number(organizationSelect?.value || state.organizations[0]?.id || 0))
    renderFilialOptions(Number(filialSelect?.value || 0))
    renderAdmins()
  }

  async function loadDashboard() {
    const response = await fetch('backend/superadmin_dashboard.php', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        window.location.replace('login.html')
        throw new Error('__redirect__')
      }
      if (response.status === 403) {
        window.location.replace('map.html')
        throw new Error('__redirect__')
      }
      throw new Error(data.message || 'Не удалось загрузить данные')
    }

    applyPayload(data)
    resetForm()
  }

  async function saveAdmin() {
    const payload = {
      action: 'save_admin',
      id: Number(adminId?.value || 0),
      login: String(adminLogin?.value || '').trim(),
      password: String(adminPassword?.value || '').trim(),
      organization_id: Number(organizationSelect?.value || 0),
      filial_id: Number(filialSelect?.value || 0),
      is_active: Boolean(adminActive?.checked),
    }

    setMessage('')
    if (saveAdminButton) saveAdminButton.disabled = true

    try {
      const response = await fetch('backend/superadmin_dashboard.php', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.message || 'Не удалось сохранить оргадмина')
      }

      applyPayload(data)
      resetForm()
      setMessage(data.message || 'Сохранено')
    } catch (error) {
      setMessage(error?.message || 'Не удалось сохранить оргадмина', true)
    } finally {
      if (saveAdminButton) saveAdminButton.disabled = false
    }
  }

  function setupSidebar() {
    const logout = () => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('index.html')
    }

    const setExpanded = expanded => {
      sidebar?.classList.toggle('sidebar--expanded', expanded)
      sidebarToggle?.setAttribute('aria-expanded', String(expanded))
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(expanded))
      } catch (_error) {
        void _error
      }
    }

    const savedExpanded = (() => {
      try {
        return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true'
      } catch (_error) {
        return false
      }
    })()

    setExpanded(savedExpanded)
    window.requestAnimationFrame(() => sidebar?.classList.add('sidebar--ready'))

    sidebarToggle?.addEventListener('click', event => {
      event.stopPropagation()
      setExpanded(!sidebar?.classList.contains('sidebar--expanded'))
    })

    document.querySelector('.sidebar-brand')?.addEventListener('click', () => {
      window.location.href = 'index.html'
    })

    document.querySelectorAll('.sidebar-nav-item[data-href], .sidebar-nav-item[data-action]').forEach(button => {
      button.addEventListener('click', () => {
        if (button.getAttribute('data-action') === 'logout') {
          logout()
          return
        }
        const href = button.getAttribute('data-href')
        if (href) window.location.href = href
      })
    })
  }

  function setupForm() {
    organizationSelect?.addEventListener('change', () => renderFilialOptions())
    resetFormButton?.addEventListener('click', resetForm)
    adminForm?.addEventListener('submit', event => {
      event.preventDefault()
      saveAdmin()
    })
  }

  async function init() {
    setupSidebar()
    setupForm()

    try {
      await loadDashboard()
    } catch (error) {
      if (error?.message !== '__redirect__') {
        setMessage(error?.message || 'Не удалось загрузить данные', true)
      }
    }
  }

  init()
})()
