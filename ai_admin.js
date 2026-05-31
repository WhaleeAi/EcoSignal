;(() => {
  const token = localStorage.getItem('token')
  if (!token) {
    window.location.replace('login.html')
    return
  }

  const headers = { Authorization: `Bearer ${token}` }
  const message = document.getElementById('message')
  const metricsGrid = document.getElementById('metricsGrid')
  const runsBody = document.getElementById('runsBody')
  const pendingBody = document.getElementById('pendingBody')
  const errorLog = document.getElementById('errorLog')
  const appealId = document.getElementById('appealId')
  const decision = document.getElementById('decision')
  const reviewReason = document.getElementById('reviewReason')
  const confidenceThreshold = document.getElementById('confidenceThreshold')
  const autoAssignEnabled = document.getElementById('autoAssignEnabled')
  const pendingAlertHours = document.getElementById('pendingAlertHours')

  function setMessage(text, isError = false) {
    message.textContent = text || ''
    message.classList.toggle('is-error', isError)
  }

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

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.clear()
        window.location.replace('login.html')
      }
      if (response.status === 403) window.location.replace('map.html')
      throw new Error(data.message || 'Не удалось выполнить действие')
    }
    return data
  }

  function settingValue(settings, key, fallback) {
    const item = (settings || []).find(row => row.key === key)
    if (!item) return fallback
    return item.value
  }

  function render(data) {
    metricsGrid.textContent = ''
    Object.entries(data.metrics || {}).forEach(([key, value]) => {
      const card = document.createElement('article')
      card.className = 'system-admin-card'
      card.innerHTML = `<span>${key}</span><strong>${value}</strong>`
      metricsGrid.append(card)
    })

    runsBody.textContent = ''
    ;(data.recent_runs || []).forEach(item => {
      runsBody.append(row([
        item.id,
        item.appeal_id,
        item.status,
        item.confidence,
        item.decision_reason || item.error_message,
        date(item.started_at),
      ]))
    })

    pendingBody.textContent = ''
    ;(data.pending_appeals || []).forEach(item => {
      const tr = row([
        item.id,
        item.status,
        item.category_name || item.subcategory_name,
        item.description,
        date(item.created_at),
      ])
      tr.addEventListener('click', () => {
        appealId.value = item.id
      })
      pendingBody.append(tr)
    })

    confidenceThreshold.value = settingValue(data.settings, 'confidence_threshold', 0.7)
    autoAssignEnabled.value = String(settingValue(data.settings, 'auto_assign_enabled', true))
    pendingAlertHours.value = settingValue(data.settings, 'pending_alert_hours', 24)
    errorLog.textContent = (data.error_log || []).join('\n') || 'Лог ошибок пуст или файл недоступен.'
  }

  async function load() {
    const data = await fetchJson('api/ai-admin/dashboard')
    render(data)
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

  document.getElementById('refreshButton')?.addEventListener('click', () => load().catch(error => setMessage(error.message, true)))

  document.getElementById('reviewForm')?.addEventListener('submit', async event => {
    event.preventDefault()
    try {
      const data = await fetchJson('api/ai-admin/review', {
        method: 'POST',
        body: JSON.stringify({
          appeal_id: Number(appealId.value || 0),
          decision: decision.value,
          reason: reviewReason.value.trim(),
        }),
      })
      render(data)
      setMessage(data.message || 'Решение сохранено')
    } catch (error) {
      setMessage(error.message, true)
    }
  })

  document.getElementById('requeueButton')?.addEventListener('click', async () => {
    try {
      const data = await fetchJson('api/ai-admin/requeue', {
        method: 'POST',
        body: JSON.stringify({
          appeal_id: Number(appealId.value || 0),
          reason: reviewReason.value.trim(),
        }),
      })
      render(data)
      setMessage(data.message || 'Заявка переотправлена')
    } catch (error) {
      setMessage(error.message, true)
    }
  })

  document.getElementById('settingsForm')?.addEventListener('submit', async event => {
    event.preventDefault()
    try {
      const data = await fetchJson('api/ai-admin/settings', {
        method: 'POST',
        body: JSON.stringify({
          settings: {
            confidence_threshold: Number(confidenceThreshold.value || 0.7),
            auto_assign_enabled: autoAssignEnabled.value === 'true',
            pending_alert_hours: Number(pendingAlertHours.value || 24),
          },
        }),
      })
      render(data)
      setMessage(data.message || 'Настройки сохранены')
    } catch (error) {
      setMessage(error.message, true)
    }
  })

  load().catch(error => setMessage(error.message, true))
})()
