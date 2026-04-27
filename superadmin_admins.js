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
  const sidebarProfileButton = document.getElementById('superSidebarProfileButton')
  const profileModal = document.getElementById('profileModal')
  const profileModalBackdrop = document.getElementById('profileModalBackdrop')
  const profileModalClose = document.getElementById('profileModalClose')
  const profileModalCancel = document.getElementById('profileModalCancel')
  const profileModalForm = document.getElementById('profileModalForm')
  const profileModalMessage = document.getElementById('profileModalMessage')
  const profileFullName = document.getElementById('profileFullName')
  const profileEmailLabel = document.getElementById('profileEmailLabel')
  const profileEmail = document.getElementById('profileEmail')
  const profilePassword = document.getElementById('profilePassword')
  const profileAbout = document.getElementById('profileAbout')
  const profileRole = document.getElementById('profileRole')
  const profileCreatedAt = document.getElementById('profileCreatedAt')
  const profileModalSave = document.getElementById('profileModalSave')

  const organizationMeta = document.getElementById('organizationMeta')
  const statsContainer = document.getElementById('superStats')
  const listFeedback = document.getElementById('listFeedback')
  const assignedAdminsGrid = document.getElementById('assignedAdminsGrid')

  const state = {
    user: null,
    stats: null,
    admins: [],
  }
  let profileModalCloseTimer = 0
  const PROFILE_MODAL_CLOSE_DELAY = 95

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

  function formatProfileDate(value) {
    if (!value) return '—'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return String(value)
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date)
  }

  function setFeedback(text, isError = false) {
    if (!listFeedback) return
    listFeedback.textContent = text
    listFeedback.classList.toggle('error', isError)
  }

  function setProfileModalMessage(text, isError = false) {
    if (!profileModalMessage) return
    profileModalMessage.textContent = text
    profileModalMessage.classList.toggle('error', isError)
  }

  function fillProfileModal() {
    const user = state.user || {}
    const displayName = getDisplayName(user)
    const usesOrgAdminAuth = String(user.auth_source || '') === 'org_admins'
    if (profileFullName) {
      profileFullName.value = displayName
      profileFullName.readOnly = usesOrgAdminAuth
    }
    if (profileEmailLabel) profileEmailLabel.textContent = usesOrgAdminAuth ? 'Логин' : 'Email'
    if (profileEmail) {
      profileEmail.type = usesOrgAdminAuth ? 'text' : 'email'
      profileEmail.value = String((usesOrgAdminAuth ? user.login : user.email) || user.email || user.login || '')
    }
    if (profilePassword) profilePassword.value = ''
    if (profileAbout) {
      const orgName = user.organization_name || 'не определена'
      const orgType = user.organization_type || ''
      profileAbout.value = orgType ? `Организация: ${orgName} (${orgType})` : `Организация: ${orgName}`
      profileAbout.readOnly = true
    }
    if (profileRole) profileRole.textContent = 'superadmin'
    if (profileCreatedAt) profileCreatedAt.textContent = formatProfileDate(user.created_at)
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
    fillProfileModal()
    setProfileModalMessage('')
    profileModal.hidden = false
    document.body.style.overflow = 'hidden'
    window.requestAnimationFrame(() => {
      profileModal.classList.add('profile-modal--open')
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
    sidebarProfileButton?.addEventListener('click', openProfileModal)
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
    const payload = {
      fullname: String(profileFullName?.value || '').trim(),
      email: String(profileEmail?.value || '').trim(),
      login: String(profileEmail?.value || '').trim(),
      password: String(profilePassword?.value || '').trim(),
      about: String(profileAbout?.value || '').trim(),
    }

    setProfileModalMessage('')
    if (profileModalSave) profileModalSave.disabled = true

    try {
      const data = await fetchJson('backend/update_profile.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      state.user = data.user || state.user
      try {
        localStorage.setItem('user', JSON.stringify(state.user))
      } catch (_error) {
        // no-op
      }

      renderAll()
      fillProfileModal()
      setProfileModalMessage('Профиль сохранён')
    } catch (error) {
      if (error?.message === '__redirect_login__' || error?.message === '__redirect_admin__' || error?.message === '__redirect_non_superadmin__') {
        return
      }
      setProfileModalMessage(error?.message || 'Не удалось сохранить профиль', true)
    } finally {
      if (profileModalSave) profileModalSave.disabled = false
    }
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

  function renderStats() {
    if (!statsContainer) return

    const stats = state.stats || {}
    const items = [
      { label: 'Назначено всего', value: Number(stats.appointed_total || 0) },
      { label: 'Активных', value: Number(stats.appointed_active || 0) },
      { label: 'Удаленных', value: Number(stats.appointed_inactive || 0) },
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

  function createAdminMetaChip(text) {
    const chip = document.createElement('span')
    chip.className = 'super-admin__meta'
    chip.textContent = text
    chip.title = text
    return chip
  }

  function renderAdmins() {
    if (!assignedAdminsGrid) return

    assignedAdminsGrid.textContent = ''
    if (!state.admins.length) {
      const empty = document.createElement('p')
      empty.className = 'super-empty'
      empty.textContent = 'Вы пока никого не назначили.'
      assignedAdminsGrid.append(empty)
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
      status.textContent = admin.is_active ? 'Активен' : 'Неактивен'

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
        createAdminMetaChip(`Назначен: ${formatDate(admin.appointed_at)}`),
        createAdminMetaChip(`Последнее действие: ${admin.last_action || '—'}`)
      )

      top.append(left, metaWrap)
      card.append(top)

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
    if (!state.user) return

    if (organizationMeta) {
      const orgName = state.user.organization_name || 'не определена'
      const orgType = state.user.organization_type || ''
      organizationMeta.textContent = orgType ? `Организация: ${orgName} (${orgType})` : `Организация: ${orgName}`
    }

    const displayName = getDisplayName(state.user)
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
      window.location.replace(user.auth_source === 'org_admins' ? 'agent.html' : 'admin.html')
      throw new Error('__redirect_admin__')
    }

    if (user.role !== 'superadmin') {
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
    setupProfileModal()
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
