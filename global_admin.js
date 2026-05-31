;(() => {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.replace('login.html')
    return
  }

  const headers = { Authorization: `Bearer ${token}` }
  const state = {
    dashboard: null,
    appeals: [],
    audit: null,
  }

  const els = {
    message: document.getElementById('message'),
    metricsGrid: document.getElementById('metricsGrid'),
    aiMetricsGrid: document.getElementById('aiMetricsGrid'),
    statusBars: document.getElementById('statusBars'),
    dynamicBars: document.getElementById('dynamicBars'),
    categoriesBody: document.getElementById('categoriesBody'),
    zonesBody: document.getElementById('zonesBody'),
    appealsBody: document.getElementById('appealsBody'),
    organizationsBody: document.getElementById('organizationsBody'),
    agentsBody: document.getElementById('agentsBody'),
    rolesBody: document.getElementById('rolesBody'),
    systemAdminsBody: document.getElementById('systemAdminsBody'),
    usersBody: document.getElementById('usersBody'),
    aiRunsBody: document.getElementById('aiRunsBody'),
    auditBody: document.getElementById('auditBody'),
    statusFilter: document.getElementById('statusFilter'),
    organizationFilter: document.getElementById('organizationFilter'),
    appealSearch: document.getElementById('appealSearch'),
    systemAdminModal: document.getElementById('systemAdminModal'),
    systemAdminForm: document.getElementById('systemAdminForm'),
    exportModal: document.getElementById('exportModal'),
    exportForm: document.getElementById('exportForm'),
    exportBlockSelect: document.getElementById('exportBlockSelect'),
    exportModalHint: document.getElementById('exportModalHint'),
  }

  const metricText = {
    total_appeals: ['Всего заявок', 'За все время'],
    today_appeals: ['Новые сегодня', 'Созданы с начала дня'],
    pending_ai: ['Ожидают AI', 'Требуют автоматической проверки'],
    in_progress: ['В работе', 'Назначены ответственным'],
    stale: ['Просрочены', 'Не решены более 7 дней'],
    resolved_7d: ['Решены за 7 дней', 'Недавние закрытия'],
    users: ['Пользователи', 'Граждане и заявители'],
    active_agents: ['Активные агенты', 'Сотрудники органов'],
    organizations: ['Организации', 'Надзорные органы'],
    filials: ['Филиалы', 'Точки обработки'],
    ai_runs: ['AI-проверок', 'Все запуски'],
    ai_failed: ['Ошибок AI', 'Требуют внимания'],
    ai_confirmed: ['Подтверждено AI', 'Приняты автоматически'],
    ai_rejected: ['Отклонено AI', 'Отклонены автоматически'],
  }

  const statusText = {
    pending: 'Ожидает AI',
    confirmed: 'Подтверждена',
    in_progress: 'В работе',
    resolved: 'Решена',
    rejected: 'Отклонена',
    failed: 'Ошибка',
    queued: 'В очереди',
    processing: 'Обработка',
    overridden: 'Переопределено',
    assigned: 'Назначена',
  }

  const roleText = {
    citizen: 'Гражданин',
    agency: 'Гражданин',
    admin: 'Агент органа',
    superadmin: 'Супер-админ',
    global_admin: 'Глобальный админ',
    ai_admin: 'AI-админ',
  }

  const sourceText = {
    users: 'Пользователи',
    org_admins: 'Органы',
    system_admins: 'Система',
    system: 'Система',
  }

  function empty(value, fallback = '—') {
    return value === null || value === undefined || value === '' ? fallback : String(value)
  }

  function number(value) {
    return Number(value || 0).toLocaleString('ru-RU')
  }

  function date(value) {
    if (!value) return '—'
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU')
  }

  function shortDate(value) {
    if (!value) return '—'
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleDateString('ru-RU')
  }

  function setMessage(message = '', isError = false) {
    if (!els.message) return
    els.message.textContent = message
    els.message.classList.toggle('is-error', isError)
  }

  function row(cells) {
    const tr = document.createElement('tr')
    cells.forEach(value => {
      const td = document.createElement('td')
      td.textContent = empty(value)
      tr.append(td)
    })
    return tr
  }

  function fillEmpty(tbody, colspan, text = 'Нет данных') {
    tbody.textContent = ''
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    td.colSpan = colspan
    td.className = 'system-admin-empty'
    td.textContent = text
    tr.append(td)
    tbody.append(tr)
  }

  async function fetchJson(url) {
    const response = await fetch(url, { headers })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.clear()
        window.location.replace('login.html')
      }
      if (response.status === 403) window.location.replace('map.html')
      throw new Error(data.message || 'Не удалось загрузить данные')
    }
    return data
  }

  function metricCard(item) {
    const [label, hint] = metricText[item.key] || [item.label || item.key, item.hint || '']
    const card = document.createElement('article')
    card.className = 'system-admin-card'
    card.innerHTML = `<span></span><strong></strong><small></small>`
    card.querySelector('span').textContent = label
    card.querySelector('strong').textContent = number(item.value)
    card.querySelector('small').textContent = hint
    return card
  }

  function renderMetrics(container, metrics) {
    container.textContent = ''
    ;(metrics || []).forEach(item => container.append(metricCard(item)))
  }

  function renderBars(container, rows, labelKey, valueKey, labelFormatter = value => value) {
    container.textContent = ''
    const max = Math.max(1, ...rows.map(item => Number(item[valueKey] || 0)))
    rows.forEach(item => {
      const value = Number(item[valueKey] || 0)
      const bar = document.createElement('div')
      bar.className = 'system-admin-bar'
      bar.innerHTML = `
        <div class="system-admin-bar__label"><span></span><strong></strong></div>
        <div class="system-admin-bar__track"><i></i></div>
      `
      bar.querySelector('span').textContent = labelFormatter(item[labelKey])
      bar.querySelector('strong').textContent = number(value)
      bar.querySelector('i').style.width = `${Math.max(4, (value / max) * 100)}%`
      container.append(bar)
    })
    if (!rows.length) {
      container.textContent = 'Нет данных'
    }
  }

  function renderDashboard(data) {
    renderMetrics(els.metricsGrid, data.metrics || [])
    renderBars(els.statusBars, data.statuses || [], 'status', 'total', value => statusText[value] || value)
    renderBars(els.dynamicBars, data.dynamics || [], 'day', 'total', shortDate)

    els.categoriesBody.textContent = ''
    ;(data.categories || []).forEach(item => {
      els.categoriesBody.append(row([item.name === 'Uncategorized' ? 'Без категории' : item.name, number(item.total)]))
    })
    if (!(data.categories || []).length) fillEmpty(els.categoriesBody, 2)

    els.zonesBody.textContent = ''
    ;(data.problem_zones || []).forEach(item => {
      els.zonesBody.append(row([
        `${item.latitude}, ${item.longitude}`,
        number(item.total),
        date(item.last_created_at),
      ]))
    })
    if (!(data.problem_zones || []).length) fillEmpty(els.zonesBody, 3, 'Повторяющихся зон пока нет')

    renderOrganizations(data.organizations || [])
    renderAgents(data.agents || [])
    renderRoles(data.roles || [])
    renderSystemAdmins(data.system_admins || [])
    renderUsers(data.users || [])
    renderAi(data.ai || {})
  }

  function renderOrganizations(items) {
    els.organizationsBody.textContent = ''
    items.forEach(item => {
      els.organizationsBody.append(row([
        item.organization_name,
        item.filial_name,
        number(item.agents_total),
        number(item.assigned_total),
        number(item.in_progress_total),
        number(item.resolved_total),
        number(item.rejected_total),
      ]))
    })
    if (!items.length) fillEmpty(els.organizationsBody, 7)
  }

  function renderAgents(items) {
    els.agentsBody.textContent = ''
    items.forEach(item => {
      els.agentsBody.append(row([
        item.login,
        item.organization_name,
        item.filial_name,
        item.is_active ? 'Да' : 'Нет',
        number(item.assigned_total),
        number(item.in_progress_total),
        number(item.resolved_total),
        date(item.last_assigned_at),
      ]))
    })
    if (!items.length) fillEmpty(els.agentsBody, 8)
  }

  function renderRoles(items) {
    els.rolesBody.textContent = ''
    items.forEach(item => {
      els.rolesBody.append(row([
        sourceText[item.source] || item.source,
        roleText[item.role] || item.role,
        number(item.active_total),
        number(item.total),
      ]))
    })
    if (!items.length) fillEmpty(els.rolesBody, 4)
  }

  function renderSystemAdmins(items) {
    els.systemAdminsBody.textContent = ''
    items.forEach(item => {
      const tr = row([
        item.login,
        roleText[item.role] || item.role,
        item.is_active ? 'Да' : 'Нет',
        date(item.last_login_at),
      ])
      const actions = document.createElement('td')
      const button = document.createElement('button')
      button.className = 'system-admin-table-action'
      button.type = 'button'
      button.textContent = 'Удалить'
      button.addEventListener('click', () => deleteSystemAdmin(item))
      actions.append(button)
      tr.append(actions)
      els.systemAdminsBody.append(tr)
    })
    if (!items.length) fillEmpty(els.systemAdminsBody, 5)
  }

  function renderUsers(items) {
    els.usersBody.textContent = ''
    items.forEach(item => {
      const tr = row([
        item.id,
        item.name,
        item.email,
        roleText[item.role] || item.role,
        number(item.appeals_total),
        date(item.last_appeal_at),
      ])
      const actions = document.createElement('td')
      const button = document.createElement('button')
      button.className = 'system-admin-table-action'
      button.type = 'button'
      button.textContent = 'Удалить'
      button.addEventListener('click', () => deleteUser(item))
      actions.append(button)
      tr.append(actions)
      els.usersBody.append(tr)
    })
    if (!items.length) fillEmpty(els.usersBody, 7)
  }

  function renderAi(ai) {
    renderMetrics(els.aiMetricsGrid, ai.metrics || [])
    els.aiRunsBody.textContent = ''
    ;(ai.recent_runs || []).forEach(item => {
      els.aiRunsBody.append(row([
        `#${item.appeal_id}`,
        statusText[item.status] || item.status,
        item.model,
        item.confidence === null || item.confidence === undefined ? '—' : Number(item.confidence).toFixed(2),
        item.decision_reason || item.error_message,
        date(item.finished_at || item.started_at),
      ]))
    })
    if (!(ai.recent_runs || []).length) fillEmpty(els.aiRunsBody, 6)
  }

  function populateFilters(appeals) {
    const currentStatus = els.statusFilter.value
    const currentOrg = els.organizationFilter.value
    const statuses = [...new Set(appeals.map(item => item.status).filter(Boolean))].sort()
    const organizations = [...new Set(appeals.map(item => item.organization_name).filter(Boolean))].sort()

    els.statusFilter.innerHTML = '<option value="">Все статусы</option>'
    statuses.forEach(status => {
      const option = document.createElement('option')
      option.value = status
      option.textContent = statusText[status] || status
      els.statusFilter.append(option)
    })
    els.statusFilter.value = currentStatus

    els.organizationFilter.innerHTML = '<option value="">Все организации</option>'
    organizations.forEach(name => {
      const option = document.createElement('option')
      option.value = name
      option.textContent = name
      els.organizationFilter.append(option)
    })
    els.organizationFilter.value = currentOrg
  }

  function filteredAppeals() {
    const query = (els.appealSearch.value || '').trim().toLowerCase()
    const status = els.statusFilter.value
    const organization = els.organizationFilter.value

    return state.appeals.filter(item => {
      if (status && item.status !== status) return false
      if (organization && item.organization_name !== organization) return false
      if (!query) return true
      return [
        item.id,
        item.citizen_email,
        item.citizen_name,
        item.responsible_login,
        item.category_name,
        item.organization_name,
      ].some(value => String(value || '').toLowerCase().includes(query))
    })
  }

  function renderAppeals() {
    const filtered = filteredAppeals()

    els.appealsBody.textContent = ''
    filtered.forEach(item => {
      els.appealsBody.append(row([
        item.id,
        statusText[item.status] || item.status,
        item.priority,
        item.category_name || item.subcategory_name,
        item.citizen_name || item.citizen_email,
        item.organization_name || item.filial_name,
        item.responsible_login,
        date(item.created_at),
      ]))
    })
    if (!filtered.length) fillEmpty(els.appealsBody, 8, 'По выбранным фильтрам заявок нет')
  }

  function renderAudit(data) {
    els.auditBody.textContent = ''
    ;(data.events || []).forEach(item => {
      els.auditBody.append(row([
        date(item.created_at),
        `${sourceText[item.actor_source] || item.actor_source || 'Система'} #${item.actor_id || ''}`,
        item.action,
        `${item.entity_type || ''} #${item.entity_id || ''}`,
        typeof item.details === 'string' ? item.details : JSON.stringify(item.details || {}),
      ]))
    })
    ;(data.assignments || []).forEach(item => {
      els.auditBody.append(row([
        date(item.assigned_at),
        item.assigned_by_email || 'Система',
        `Назначение: ${statusText[item.status] || item.status}`,
        `Заявка #${item.appeal_id}`,
        [item.organization_name, item.filial_name, item.responsible_login].filter(Boolean).join(', '),
      ]))
    })
    if (!(data.events || []).length && !(data.assignments || []).length) fillEmpty(els.auditBody, 5)
  }

  async function loadAll() {
    setMessage('Загружаю сводку...')
    const [dashboard, appeals, audit] = await Promise.all([
      fetchJson('api/global-admin/dashboard'),
      fetchJson('api/global-admin/appeals'),
      fetchJson('api/global-admin/audit'),
    ])
    state.dashboard = dashboard
    state.appeals = appeals.appeals || []
    state.audit = audit
    renderDashboard(dashboard)
    populateFilters(state.appeals)
    renderAppeals()
    renderAudit(audit)
    setMessage(`Обновлено: ${new Date().toLocaleTimeString('ru-RU')}`)
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const error = new Error(data.message || 'Не удалось выполнить действие')
      error.status = response.status
      throw error
    }
    return data
  }

  function openModal(modal) {
    modal.hidden = false
    document.body.classList.add('system-admin-modal-open')
  }

  function closeModal(modal) {
    modal.hidden = true
    document.body.classList.remove('system-admin-modal-open')
  }

  function applyDashboardPayload(data) {
    state.dashboard = data
    renderDashboard(data)
    populateFilters(state.appeals)
    renderAppeals()
  }

  async function deleteSystemAdmin(item) {
    if (!confirm(`Удалить системного администратора ${item.login}?`)) return

    try {
      const data = await postJson('api/global-admin/system-admins/delete', { id: item.id })
      applyDashboardPayload(data)
      setMessage(data.message || 'Системный администратор удален')
    } catch (error) {
      setMessage(error.message, true)
    }
  }

  async function deleteUser(item, confirmed = false) {
    const suffix = Number(item.appeals_total || 0) > 0
      ? `\n\nУ пользователя ${item.appeals_total} заявок. Они будут удалены вместе с историей.`
      : ''
    if (!confirmed && !confirm(`Удалить пользователя ${item.email}?${suffix}`)) return

    try {
      const data = await postJson('api/global-admin/users/delete', {
        id: item.id,
        confirm_cascade: confirmed || Number(item.appeals_total || 0) > 0,
      })
      applyDashboardPayload(data)
      state.appeals = state.appeals.filter(appeal => String(appeal.citizen_email || '') !== String(item.email || ''))
      renderAppeals()
      setMessage(data.message || 'Пользователь удален')
    } catch (error) {
      if (error.status === 409 && !confirmed && confirm(`${error.message}\n\nУдалить пользователя и связанную историю?`)) {
        return deleteUser(item, true)
      }
      setMessage(error.message, true)
    }
  }

  function activeSection() {
    return document.querySelector('[data-section].is-active')?.dataset.section || 'overview'
  }

  function exportBlocks() {
    const dashboard = state.dashboard || {}
    const audit = state.audit || {}
    const ai = dashboard.ai || {}

    return {
      overview: [
        {
          id: 'overview_metrics',
          label: 'KPI',
          filename: 'overview-kpi',
          columns: ['Показатель', 'Значение', 'Описание'],
          rows: (dashboard.metrics || []).map(item => {
            const [label, hint] = metricText[item.key] || [item.key, '']
            return [label, item.value, hint]
          }),
        },
        {
          id: 'overview_statuses',
          label: 'Статусы заявок',
          filename: 'appeal-statuses',
          columns: ['Статус', 'Количество'],
          rows: (dashboard.statuses || []).map(item => [statusText[item.status] || item.status, item.total]),
        },
        {
          id: 'overview_dynamics',
          label: 'Динамика за 14 дней',
          filename: 'appeal-dynamics',
          columns: ['Дата', 'Количество'],
          rows: (dashboard.dynamics || []).map(item => [shortDate(item.day), item.total]),
        },
        {
          id: 'overview_categories',
          label: 'Категории',
          filename: 'categories',
          columns: ['Категория', 'Заявок'],
          rows: (dashboard.categories || []).map(item => [item.name === 'Uncategorized' ? 'Без категории' : item.name, item.total]),
        },
        {
          id: 'overview_zones',
          label: 'Проблемные зоны',
          filename: 'problem-zones',
          columns: ['Широта', 'Долгота', 'Заявок', 'Последняя заявка'],
          rows: (dashboard.problem_zones || []).map(item => [item.latitude, item.longitude, item.total, date(item.last_created_at)]),
        },
      ],
      appeals: [
        {
          id: 'appeals_filtered',
          label: 'Заявки с текущими фильтрами',
          filename: 'appeals',
          columns: ['ID', 'Статус', 'Приоритет', 'Категория', 'Пользователь', 'Email', 'Орган', 'Филиал', 'Ответственный', 'Создана'],
          rows: filteredAppeals().map(item => [
            item.id,
            statusText[item.status] || item.status,
            item.priority,
            item.category_name || item.subcategory_name,
            item.citizen_name,
            item.citizen_email,
            item.organization_name,
            item.filial_name,
            item.responsible_login,
            date(item.created_at),
          ]),
        },
      ],
      organizations: [
        {
          id: 'organization_load',
          label: 'Нагрузка органов и филиалов',
          filename: 'organization-load',
          columns: ['Орган', 'Филиал', 'Агенты', 'Назначено', 'В работе', 'Решено', 'Отклонено'],
          rows: (dashboard.organizations || []).map(item => [item.organization_name, item.filial_name, item.agents_total, item.assigned_total, item.in_progress_total, item.resolved_total, item.rejected_total]),
        },
        {
          id: 'agent_load',
          label: 'Агенты с наибольшей нагрузкой',
          filename: 'agent-load',
          columns: ['Агент', 'Орган', 'Филиал', 'Активен', 'Назначено', 'В работе', 'Решено', 'Последнее назначение'],
          rows: (dashboard.agents || []).map(item => [item.login, item.organization_name, item.filial_name, item.is_active ? 'Да' : 'Нет', item.assigned_total, item.in_progress_total, item.resolved_total, date(item.last_assigned_at)]),
        },
      ],
      roles: [
        {
          id: 'role_summary',
          label: 'Пользователи по ролям',
          filename: 'role-summary',
          columns: ['Источник', 'Роль', 'Активные', 'Всего'],
          rows: (dashboard.roles || []).map(item => [sourceText[item.source] || item.source, roleText[item.role] || item.role, item.active_total, item.total]),
        },
        {
          id: 'system_admins',
          label: 'Системные администраторы',
          filename: 'system-admins',
          columns: ['Логин', 'Email', 'Имя', 'Роль', 'Активен', 'Создан', 'Последний вход'],
          rows: (dashboard.system_admins || []).map(item => [item.login, item.email, item.full_name, roleText[item.role] || item.role, item.is_active ? 'Да' : 'Нет', date(item.created_at), date(item.last_login_at)]),
        },
        {
          id: 'users',
          label: 'Обычные пользователи',
          filename: 'users',
          columns: ['ID', 'Пользователь', 'Email', 'Роль', 'Заявок', 'Создан', 'Последняя заявка'],
          rows: (dashboard.users || []).map(item => [item.id, item.name, item.email, roleText[item.role] || item.role, item.appeals_total, date(item.created_at), date(item.last_appeal_at)]),
        },
      ],
      ai: [
        {
          id: 'ai_metrics',
          label: 'AI KPI',
          filename: 'ai-kpi',
          columns: ['Показатель', 'Значение', 'Описание'],
          rows: (ai.metrics || []).map(item => {
            const [label, hint] = metricText[item.key] || [item.key, '']
            return [label, item.value, hint]
          }),
        },
        {
          id: 'ai_runs',
          label: 'Последние AI-проверки',
          filename: 'ai-runs',
          columns: ['Заявка', 'Статус', 'Модель', 'Уверенность', 'Причина', 'Завершено'],
          rows: (ai.recent_runs || []).map(item => [`#${item.appeal_id}`, statusText[item.status] || item.status, item.model, item.confidence, item.decision_reason || item.error_message, date(item.finished_at || item.started_at)]),
        },
      ],
      audit: [
        {
          id: 'audit_events',
          label: 'Журнал действий',
          filename: 'audit-events',
          columns: ['Дата', 'Кто', 'Действие', 'Сущность', 'Детали'],
          rows: (audit.events || []).map(item => [date(item.created_at), `${sourceText[item.actor_source] || item.actor_source || 'Система'} #${item.actor_id || ''}`, item.action, `${item.entity_type || ''} #${item.entity_id || ''}`, typeof item.details === 'string' ? item.details : JSON.stringify(item.details || {})]),
        },
        {
          id: 'audit_assignments',
          label: 'История назначений',
          filename: 'audit-assignments',
          columns: ['Дата', 'Кто', 'Статус', 'Заявка', 'Орган', 'Филиал', 'Ответственный'],
          rows: (audit.assignments || []).map(item => [date(item.assigned_at), item.assigned_by_email || 'Система', statusText[item.status] || item.status, `#${item.appeal_id}`, item.organization_name, item.filial_name, item.responsible_login]),
        },
      ],
    }
  }

  function escapeHtml(value) {
    return empty(value, '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char])
  }

  function downloadExcel(block) {
    const html = `
      <html>
        <head><meta charset="UTF-8" /></head>
        <body>
          <table border="1">
            <thead><tr>${block.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
            <tbody>
              ${block.rows.map(rowData => `<tr>${rowData.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `
    const blob = new Blob(['\ufeff', html], { type: 'application/vnd.ms-excel;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ecosignal-${block.filename}-${new Date().toISOString().slice(0, 10)}.xls`
    link.click()
    URL.revokeObjectURL(link.href)
  }

  function prepareExportModal() {
    const section = activeSection()
    const blocks = exportBlocks()[section] || []
    els.exportBlockSelect.textContent = ''
    blocks.forEach(block => {
      const option = document.createElement('option')
      option.value = block.id
      option.textContent = block.label
      els.exportBlockSelect.append(option)
    })
    els.exportModalHint.textContent = `Выберите один блок текущей вкладки: ${document.querySelector('[data-section].is-active')?.textContent || ''}.`
    return blocks
  }

  document.querySelectorAll('[data-section]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-section]').forEach(item => item.classList.remove('is-active'))
      document.querySelectorAll('.system-admin-section').forEach(item => item.classList.remove('is-active'))
      button.classList.add('is-active')
      document.getElementById(`section-${button.dataset.section}`)?.classList.add('is-active')
    })
  })

  ;[els.statusFilter, els.organizationFilter, els.appealSearch].forEach(control => {
    control?.addEventListener('input', renderAppeals)
  })

  document.getElementById('refreshButton')?.addEventListener('click', () => {
    loadAll().catch(error => setMessage(error.message, true))
  })

  document.getElementById('addSystemAdminButton')?.addEventListener('click', () => {
    els.systemAdminForm?.reset()
    openModal(els.systemAdminModal)
  })

  document.querySelectorAll('[data-close-modal]').forEach(item => {
    item.addEventListener('click', () => closeModal(els.systemAdminModal))
  })

  document.querySelectorAll('[data-close-export]').forEach(item => {
    item.addEventListener('click', () => closeModal(els.exportModal))
  })

  els.systemAdminForm?.addEventListener('submit', async event => {
    event.preventDefault()
    const formData = new FormData(els.systemAdminForm)
    try {
      const data = await postJson('api/global-admin/system-admins', Object.fromEntries(formData.entries()))
      closeModal(els.systemAdminModal)
      applyDashboardPayload(data)
      setMessage(data.message || 'Системный администратор добавлен')
    } catch (error) {
      setMessage(error.message, true)
    }
  })

  document.getElementById('logoutButton')?.addEventListener('click', () => {
    localStorage.clear()
    window.location.replace('index.html')
  })

  document.getElementById('exportButton')?.addEventListener('click', async () => {
    prepareExportModal()
    openModal(els.exportModal)
  })

  els.exportForm?.addEventListener('submit', event => {
    event.preventDefault()
    const blocks = exportBlocks()[activeSection()] || []
    const block = blocks.find(item => item.id === els.exportBlockSelect.value)
    if (!block) {
      setMessage('Выберите блок отчета', true)
      return
    }
    downloadExcel(block)
    closeModal(els.exportModal)
    setMessage('Excel-отчет экспортирован')
  })

  loadAll().catch(error => setMessage(error.message, true))
})()
