;(() => {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.replace('login.html')
    return
  }

  const sidebar = document.getElementById('superSidebar')
  const sidebarToggle = document.getElementById('superSidebarToggle')
  const sidebarAvatar = document.getElementById('superSidebarAvatar')
  const sidebarName = document.getElementById('superSidebarName')
  const sidebarRole = document.getElementById('superSidebarRole')

  const organizationMeta = document.getElementById('organizationMeta')
  const headerStatsContainer = document.getElementById('superHeaderStats')

  const createAdminForm = document.getElementById('createAdminForm')
  const createAdminLogin = document.getElementById('createAdminLogin')
  const createAdminPassword = document.getElementById('createAdminPassword')
  const createAdminRole = document.getElementById('createAdminRole')
  const createAdminRoleWrap = document.getElementById('createAdminRoleWrap')
  const createAdminRoleTrigger = document.getElementById('createAdminRoleTrigger')
  const createAdminRoleList = document.getElementById('createAdminRoleList')
  const createAdminRoleDisplay = document.getElementById('createAdminRoleDisplay')
  const createAdminOrganization = document.getElementById('createAdminOrganization')
  const createAdminOrganizationWrap = document.getElementById('createAdminOrganizationWrap')
  const createAdminOrganizationTrigger = document.getElementById('createAdminOrganizationTrigger')
  const createAdminOrganizationList = document.getElementById('createAdminOrganizationList')
  const createAdminOrganizationDisplay = document.getElementById('createAdminOrganizationDisplay')
  const createAdminFilial = document.getElementById('createAdminFilial')
  const createAdminFilialWrap = document.getElementById('createAdminFilialWrap')
  const createAdminFilialTrigger = document.getElementById('createAdminFilialTrigger')
  const createAdminFilialList = document.getElementById('createAdminFilialList')
  const createAdminFilialDisplay = document.getElementById('createAdminFilialDisplay')
  const createAdminComment = document.getElementById('createAdminComment')
  const createAdminFeedback = document.getElementById('createAdminFeedback')

  const adminsGrid = document.getElementById('adminsGrid')
  const actionsGrid = document.getElementById('actionsGrid')

  const state = {
    user: null,
    stats: null,
    organizations: [],
    filials: [],
    admins: [],
    recentRefs: [],
  }

  const customSelects = new Map()

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

  function mapRole(role) {
    return role === 'superadmin' ? 'superadmin' : 'admin'
  }

  function mapActionType(value) {
    if (value === 'appointed') return 'Назначение'
    if (value === 'revoked') return 'Удаление'
    if (value === 'role_changed') return 'Изменение роли'
    return String(value || 'Действие')
  }

  function setFeedback(text, isError = false) {
    if (!createAdminFeedback) return
    createAdminFeedback.textContent = text
    createAdminFeedback.classList.toggle('error', isError)
  }

  function closeAllCustomSelects(exceptId = '') {
    customSelects.forEach((config, id) => {
      const shouldOpen = id === exceptId
      config.wrap?.classList.toggle('super-select--open', shouldOpen)
      if (config.trigger) {
        config.trigger.setAttribute('aria-expanded', String(shouldOpen))
      }
      if (config.list) {
        config.list.hidden = !shouldOpen
      }
    })
  }

  function syncCustomSelectDisplay(selectId) {
    const config = customSelects.get(selectId)
    if (!config) return

    const selectedOption = config.select.selectedOptions[0]
    const fallbackText = config.select.options[0]?.textContent || ''
    if (config.display) {
      config.display.textContent = selectedOption?.textContent || fallbackText
    }

    Array.from(config.list?.children || []).forEach((node, index) => {
      const option = config.select.options[index]
      const isSelected = Boolean(option?.selected)
      node.classList.toggle('is-selected', isSelected)
      node.setAttribute('aria-selected', String(isSelected))
    })
  }

  function rebuildCustomSelectOptions(selectId) {
    const config = customSelects.get(selectId)
    if (!config || !config.list) return

    config.list.textContent = ''
    Array.from(config.select.options).forEach((option, index) => {
      const item = document.createElement('li')
      item.className = 'super-select__option'
      item.id = `${config.select.id}Opt_${index}`
      item.setAttribute('role', 'option')
      item.textContent = option.textContent
      item.dataset.value = option.value

      if (option.disabled) {
        item.classList.add('is-disabled')
      } else {
        item.addEventListener('click', () => {
          config.select.selectedIndex = index
          config.select.dispatchEvent(new Event('change', { bubbles: true }))
          closeAllCustomSelects()
        })
      }

      config.list.append(item)
    })

    syncCustomSelectDisplay(selectId)
  }

  function registerCustomSelect({ select, wrap, trigger, list, display }) {
    if (!select || !wrap || !trigger || !list || !display) return

    customSelects.set(select.id, { select, wrap, trigger, list, display })

    trigger.addEventListener('click', event => {
      event.preventDefault()
      event.stopPropagation()
      const isOpen = !list.hidden
      closeAllCustomSelects(isOpen ? '' : select.id)
    })

    wrap.addEventListener('click', event => event.stopPropagation())

    select.addEventListener('change', () => {
      syncCustomSelectDisplay(select.id)
    })

    rebuildCustomSelectOptions(select.id)
  }

  function setupCustomSelects() {
    registerCustomSelect({
      select: createAdminRole,
      wrap: createAdminRoleWrap,
      trigger: createAdminRoleTrigger,
      list: createAdminRoleList,
      display: createAdminRoleDisplay,
    })

    registerCustomSelect({
      select: createAdminOrganization,
      wrap: createAdminOrganizationWrap,
      trigger: createAdminOrganizationTrigger,
      list: createAdminOrganizationList,
      display: createAdminOrganizationDisplay,
    })

    registerCustomSelect({
      select: createAdminFilial,
      wrap: createAdminFilialWrap,
      trigger: createAdminFilialTrigger,
      list: createAdminFilialList,
      display: createAdminFilialDisplay,
    })

    document.addEventListener('click', () => closeAllCustomSelects())
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') closeAllCustomSelects()
    })
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

  function createStatCard(label, value) {
    const card = document.createElement('article')
    card.className = 'super-stat'

    const valueEl = document.createElement('p')
    valueEl.className = 'super-stat__value'
    valueEl.textContent = String(value)

    const labelEl = document.createElement('p')
    labelEl.className = 'super-stat__label'
    labelEl.textContent = label

    card.append(valueEl, labelEl)
    return card
  }

  function renderStats() {
    if (!headerStatsContainer) return

    const stats = state.stats || {}
    headerStatsContainer.textContent = ''

    headerStatsContainer.append(
      createStatCard('Админы', Number(stats.admins_total || 0)),
      createStatCard('Суперадмины', Number(stats.superadmins_total || 0))
    )
  }

  function renderOrganizationSelect() {
    if (!createAdminOrganization) return

    createAdminOrganization.textContent = ''

    const firstOption = document.createElement('option')
    firstOption.value = ''
    firstOption.textContent = 'Выберите организацию'
    createAdminOrganization.append(firstOption)

    state.organizations.forEach(org => {
      const option = document.createElement('option')
      option.value = String(org.id)
      option.textContent = `${org.name} (${org.org_type})`
      createAdminOrganization.append(option)
    })

    if (state.user?.organization_id) {
      createAdminOrganization.value = String(state.user.organization_id)
    }

    rebuildCustomSelectOptions(createAdminOrganization.id)
  }

  function renderFilialSelect() {
    if (!createAdminFilial || !createAdminOrganization) return

    const selectedOrgId = Number(createAdminOrganization.value || 0)

    createAdminFilial.textContent = ''
    const firstOption = document.createElement('option')
    firstOption.value = ''
    firstOption.textContent = 'Без привязки к филиалу'
    createAdminFilial.append(firstOption)

    state.filials
      .filter(filial => Number(filial.organization_id) === selectedOrgId && Boolean(filial.is_active))
      .forEach(filial => {
        const option = document.createElement('option')
        option.value = String(filial.id)
        option.textContent = filial.region ? `${filial.name} (${filial.region})` : filial.name
        createAdminFilial.append(option)
      })

    rebuildCustomSelectOptions(createAdminFilial.id)
  }

  function createAdminMetaChip(text) {
    const chip = document.createElement('span')
    chip.className = 'super-admin__meta'
    chip.textContent = text
    chip.title = text
    return chip
  }

  function renderAdmins() {
    if (!adminsGrid) return

    adminsGrid.textContent = ''
    if (!state.admins.length) {
      const empty = document.createElement('p')
      empty.className = 'super-empty'
      empty.textContent = 'Администраторы пока не добавлены.'
      adminsGrid.append(empty)
      return
    }

    state.admins.forEach(admin => {
      const card = document.createElement('article')
      card.className = 'super-admin'

      const top = document.createElement('div')
      top.className = 'super-admin__top'

      const left = document.createElement('div')
      left.className = 'super-admin__left'

      const title = document.createElement('h3')
      title.className = 'super-admin__title'
      title.textContent = admin.login || 'Без логина'

      const status = document.createElement('span')
      status.className = `super-admin__status${admin.is_active ? ' is-active' : ''}`
      status.textContent = admin.is_active ? 'active' : 'inactive'

      left.append(title, status)

      const metaWrap = document.createElement('div')
      metaWrap.className = 'super-admin__meta-wrap'
      metaWrap.append(
        createAdminMetaChip(`Роль: ${mapRole(admin.role)}`),
        createAdminMetaChip(`Организация: ${admin.organization_name || '—'}`),
        createAdminMetaChip(
          admin.filial_name
            ? `Филиал: ${admin.filial_name}${admin.filial_region ? `, ${admin.filial_region}` : ''}`
            : 'Филиал: без привязки'
        ),
        createAdminMetaChip(`Создан: ${formatDate(admin.created_at)}`)
      )

      top.append(left, metaWrap)
      card.append(top)
      adminsGrid.append(card)
    })
  }

  function renderActions() {
    if (!actionsGrid) return

    actionsGrid.textContent = ''
    if (!state.recentRefs.length) {
      const empty = document.createElement('p')
      empty.className = 'super-empty'
      empty.textContent = 'Последних действий пока нет.'
      actionsGrid.append(empty)
      return
    }

    state.recentRefs.forEach(action => {
      const card = document.createElement('article')
      card.className = 'super-action'

      const title = document.createElement('h3')
      title.className = 'super-action__title'
      title.textContent = `${mapActionType(action.action_type)}: ${action.target_login || '—'}`

      const role = document.createElement('p')
      role.className = 'super-action__meta'
      role.textContent = `Роль: ${mapRole(action.target_role)}`

      const organization = document.createElement('p')
      organization.className = 'super-action__meta'
      organization.textContent = `Организация: ${action.target_organization_name || '—'}`

      const filial = document.createElement('p')
      filial.className = 'super-action__meta'
      filial.textContent = action.filial_name
        ? `Филиал: ${action.filial_name}${action.filial_region ? `, ${action.filial_region}` : ''}`
        : 'Филиал: без привязки'

      const createdAt = document.createElement('p')
      createdAt.className = 'super-action__meta'
      createdAt.textContent = `Когда: ${formatDate(action.created_at)}`

      const comment = document.createElement('p')
      comment.className = 'super-action__meta'
      comment.textContent = action.comment ? `Комментарий: ${action.comment}` : 'Комментарий: —'

      card.append(title, role, organization, filial, createdAt, comment)
      actionsGrid.append(card)
    })
  }

  function applyHeader() {
    if (!state.user) return

    if (organizationMeta) {
      organizationMeta.textContent = `Организация: ${state.user.organization_name} (${state.user.organization_type})`
    }

    const displayName = getDisplayName(state.user)
    if (sidebarName) sidebarName.textContent = displayName
    if (sidebarAvatar) sidebarAvatar.textContent = getInitials(displayName)
    if (sidebarRole) sidebarRole.textContent = 'superadmin'
  }

  function renderAll() {
    applyHeader()
    renderStats()
    renderOrganizationSelect()
    renderFilialSelect()
    renderAdmins()
    renderActions()
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
      window.location.replace(user.auth_source === 'org_admins' ? 'agent.html' : 'admin.html')
      throw new Error('__redirect_admin__')
    }

    if (user.role !== 'superadmin' || user.auth_source !== 'org_admins') {
      window.location.replace('map.html')
      throw new Error('__redirect_non_superadmin__')
    }

    state.user = user
  }

  async function loadDashboard() {
    const data = await fetchJson('backend/superadmin_dashboard.php')

    state.stats = data.stats || null
    state.organizations = Array.isArray(data.organizations) ? data.organizations : []
    state.filials = Array.isArray(data.filials) ? data.filials : []
    state.admins = Array.isArray(data.admins) ? data.admins : []
    state.recentRefs = Array.isArray(data.recent_refs) ? data.recent_refs : []

    renderAll()
  }

  function setupCreateAdminForm() {
    if (!createAdminForm) return

    createAdminOrganization?.addEventListener('change', () => {
      renderFilialSelect()
    })

    createAdminForm.addEventListener('submit', async event => {
      event.preventDefault()

      const login = createAdminLogin?.value.trim() || ''
      const password = createAdminPassword?.value.trim() || ''
      const role = createAdminRole?.value || 'admin'
      const organizationId = Number(createAdminOrganization?.value || 0)
      const filialRaw = createAdminFilial?.value || ''
      const comment = createAdminComment?.value.trim() || ''

      if (!login || !password || !organizationId) {
        setFeedback('Заполните логин, пароль и организацию', true)
        return
      }

      const submitButton = createAdminForm.querySelector('button[type="submit"]')
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true
      }

      setFeedback('Создание администратора...')

      try {
        const payload = {
          login,
          password,
          role,
          organization_id: organizationId,
          comment,
        }

        if (filialRaw) {
          payload.filial_id = Number(filialRaw)
        }

        await fetchJson('backend/superadmin_create_admin.php', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        })

        createAdminForm.reset()
        syncCustomSelectDisplay(createAdminRole.id)
        renderOrganizationSelect()
        renderFilialSelect()
        setFeedback('Администратор создан')
        await loadDashboard()
      } catch (error) {
        if (
          error?.message === '__redirect_login__' ||
          error?.message === '__redirect_admin__' ||
          error?.message === '__redirect_non_superadmin__'
        ) {
          return
        }
        setFeedback(error.message || 'Не удалось создать администратора', true)
      } finally {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false
        }
      }
    })
  }

  async function init() {
    setupSidebar()
    setupCustomSelects()
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
