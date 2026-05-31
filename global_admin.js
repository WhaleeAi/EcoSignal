;(() => {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.replace('login.html')
    return
  }

  const headers = { Authorization: `Bearer ${token}` }
  const metricsGrid = document.getElementById('metricsGrid')
  const overviewBody = document.getElementById('overviewBody')
  const zonesBody = document.getElementById('zonesBody')
  const appealsBody = document.getElementById('appealsBody')
  const auditBody = document.getElementById('auditBody')

  function text(value) {
    return value === null || value === undefined || value === '' ? '—' : String(value)
  }

  function date(value) {
    if (!value) return '—'
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString('ru-RU')
  }

  function row(cells) {
    const tr = document.createElement('tr')
    cells.forEach(value => {
      const td = document.createElement('td')
      td.textContent = text(value)
      tr.append(td)
    })
    return tr
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

  function renderDashboard(data) {
    metricsGrid.textContent = ''
    Object.entries(data.metrics || {}).forEach(([key, value]) => {
      const card = document.createElement('article')
      card.className = 'system-admin-card'
      card.innerHTML = `<span>${key}</span><strong>${value}</strong>`
      metricsGrid.append(card)
    })

    overviewBody.textContent = ''
    ;(data.statuses || []).forEach(item => overviewBody.append(row(['Статус', item.status, item.total])))
    ;(data.categories || []).forEach(item => overviewBody.append(row(['Категория', item.name, item.total])))
    ;(data.dynamics || []).forEach(item => overviewBody.append(row(['День', item.day, item.total])))

    zonesBody.textContent = ''
    ;(data.problem_zones || []).forEach(item => zonesBody.append(row([item.latitude, item.longitude, item.total])))
  }

  function renderAppeals(data) {
    appealsBody.textContent = ''
    ;(data.appeals || []).forEach(item => {
      appealsBody.append(row([
        item.id,
        item.status,
        item.category_name || item.subcategory_name,
        item.organization_name || item.filial_name,
        item.responsible_login,
        date(item.created_at),
      ]))
    })
  }

  function renderAudit(data) {
    auditBody.textContent = ''
    ;(data.events || []).forEach(item => {
      auditBody.append(row([
        date(item.created_at),
        `${item.actor_source || 'system'} #${item.actor_id || ''}`,
        item.action,
        `${item.entity_type || ''} #${item.entity_id || ''}`,
        typeof item.details === 'string' ? item.details : JSON.stringify(item.details || {}),
      ]))
    })
    ;(data.assignments || []).forEach(item => {
      auditBody.append(row([
        date(item.assigned_at),
        item.assigned_by_email || 'system',
        `assignment:${item.status}`,
        `appeal #${item.appeal_id}`,
        [item.organization_name, item.filial_name, item.responsible_login].filter(Boolean).join(', '),
      ]))
    })
  }

  async function loadAll() {
    const [dashboard, appeals, audit] = await Promise.all([
      fetchJson('api/global-admin/dashboard'),
      fetchJson('api/global-admin/appeals'),
      fetchJson('api/global-admin/audit'),
    ])
    renderDashboard(dashboard)
    renderAppeals(appeals)
    renderAudit(audit)
  }

  document.querySelectorAll('[data-section]').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelectorAll('[data-section]').forEach(item => item.classList.remove('is-active'))
      document.querySelectorAll('.system-admin-section').forEach(item => item.classList.remove('is-active'))
      button.classList.add('is-active')
      document.getElementById(`section-${button.dataset.section}`)?.classList.add('is-active')
    })
  })

  document.getElementById('logoutButton')?.addEventListener('click', () => {
    localStorage.clear()
    window.location.replace('index.html')
  })

  document.getElementById('exportButton')?.addEventListener('click', async () => {
    const data = await fetchJson('api/global-admin/export')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `ecosignal-report-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  })

  loadAll().catch(console.error)
})()
