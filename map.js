;(() => {
  const token = localStorage.getItem('token')

  if (!token) {
    window.location.replace('login.html')
    return
  }

  const closeBtn = document.getElementById('mapCloseBtn')
  const addPinBtn = document.getElementById('mapAddPinBtn')
  const reportBtn = document.querySelector('.report-btn')
  const searchCard = document.querySelector('.search-card')
  const formWrap = document.getElementById('appealFormWrap')
  const form = document.getElementById('appealForm')
  const categorySelect = document.getElementById('appealCategory')
  const subcategorySelect = document.getElementById('appealSubcategory')
  const descriptionInput = document.getElementById('appealDescription')
  const priorityInput = document.getElementById('appealPriority')
  const imagesInput = document.getElementById('appealImages')
  const coordsLabel = document.getElementById('appealCoords')
  const formMessage = document.getElementById('appealFormMessage')

  if (
    !closeBtn ||
    !addPinBtn ||
    !reportBtn ||
    !searchCard ||
    !formWrap ||
    !form ||
    !categorySelect ||
    !subcategorySelect ||
    !descriptionInput ||
    !priorityInput ||
    !imagesInput ||
    !coordsLabel ||
    !formMessage
  ) {
    return
  }

  let map = null
  let selectedPlacemark = null
  let selectedCoords = null
  let categories = []

  function setFormMessage(text, isError = false) {
    formMessage.textContent = text
    formMessage.classList.toggle('error', isError)
  }

  function formatCoords(coords) {
    return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`
  }

  function updateCoordsLabel() {
    coordsLabel.textContent = selectedCoords ? formatCoords(selectedCoords) : 'не выбрана'
  }

  function setSelectionControlsVisible(isVisible) {
    closeBtn.hidden = !isVisible
    addPinBtn.hidden = !isVisible
  }

  function setFormVisible(isVisible) {
    formWrap.hidden = !isVisible
    searchCard.classList.toggle('form-open', isVisible)
    if (isVisible) {
      setFormMessage('')
    }
  }

  function resetSubcategories() {
    subcategorySelect.innerHTML = '<option value="">Без подкатегории</option>'
  }

  function fillCategories() {
    categorySelect.innerHTML = '<option value="">Выберите категорию</option>'

    for (const category of categories) {
      const option = document.createElement('option')
      option.value = String(category.id)
      option.textContent = category.name
      categorySelect.append(option)
    }

    resetSubcategories()
  }

  function fillSubcategories(categoryId) {
    resetSubcategories()

    if (!categoryId) return

    const category = categories.find(item => String(item.id) === String(categoryId))
    if (!category || !Array.isArray(category.subcategories)) return

    for (const subcategory of category.subcategories) {
      const option = document.createElement('option')
      option.value = String(subcategory.id)
      option.textContent = subcategory.name
      subcategorySelect.append(option)
    }
  }

  function clearSelectedPoint() {
    if (map && selectedPlacemark) {
      map.geoObjects.remove(selectedPlacemark)
    }

    selectedPlacemark = null
    selectedCoords = null
    updateCoordsLabel()
    setSelectionControlsVisible(false)
    setFormVisible(false)
  }

  function setSelectedPoint(coords) {
    selectedCoords = coords

    if (map && selectedPlacemark) {
      map.geoObjects.remove(selectedPlacemark)
    }

    selectedPlacemark = new ymaps.Placemark(
      coords,
      {},
      {
        iconLayout: 'default#image',
        iconImageHref: './icons/pin.svg',
        iconImageSize: [40, 55],
        iconImageOffset: [-20, -55],
        draggable: true,
      }
    )

    selectedPlacemark.events.add('dragend', () => {
      selectedCoords = selectedPlacemark.geometry.getCoordinates()
      updateCoordsLabel()
    })

    if (map) {
      map.geoObjects.add(selectedPlacemark)
    }

    updateCoordsLabel()
    setSelectionControlsVisible(true)
  }

  async function ensureAuthorized() {
    const response = await fetch('backend/me.php', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      window.location.replace('login.html')
      throw new Error('Требуется авторизация')
    }

    if (data?.user?.role === 'admin') {
      window.location.replace('admin.html')
      throw new Error('__redirect_admin__')
    }
  }

  async function loadCategories() {
    const response = await fetch('backend/categories.php', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.message || 'Не удалось загрузить категории')
    }

    categories = Array.isArray(data.categories) ? data.categories : []
    fillCategories()
  }

  async function submitAppeal(event) {
    event.preventDefault()

    if (!selectedCoords) {
      setFormMessage('Сначала выберите точку на карте', true)
      return
    }

    const categoryId = Number(categorySelect.value)
    const subcategoryId = subcategorySelect.value ? Number(subcategorySelect.value) : null
    const description = descriptionInput.value.trim()
    const priority = Number(priorityInput.value || 0)
    const imageFiles = Array.from(imagesInput.files || [])

    if (!categoryId || !description) {
      setFormMessage('Заполните обязательные поля: категория и описание', true)
      return
    }

    const submitButton = form.querySelector('button[type="submit"]')
    if (submitButton) {
      submitButton.disabled = true
    }

    setFormMessage('Отправка...')

    try {
      const formData = new FormData()
      formData.append('category_id', String(categoryId))
      if (subcategoryId !== null) {
        formData.append('subcategory_id', String(subcategoryId))
      }
      formData.append('description', description)
      formData.append('latitude', String(selectedCoords[0]))
      formData.append('longitude', String(selectedCoords[1]))
      formData.append('priority', String(priority))

      for (const file of imageFiles) {
        formData.append('images[]', file, file.name)
      }

      const response = await fetch('backend/create_appeal.php', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        setFormMessage(data.message || 'Не удалось отправить заявку', true)
        return
      }

      form.reset()
      priorityInput.value = '0'
      fillSubcategories('')
      clearSelectedPoint()
      setFormMessage('Заявка успешно отправлена')
    } catch (error) {
      setFormMessage('Ошибка соединения с сервером', true)
    } finally {
      if (submitButton) {
        submitButton.disabled = false
      }
    }
  }

  closeBtn.addEventListener('click', clearSelectedPoint)

  addPinBtn.addEventListener('click', () => {
    if (!selectedCoords) return
    setFormVisible(true)
    descriptionInput.focus()
  })

  reportBtn.addEventListener('click', () => {
    setFormVisible(true)

    if (!selectedCoords) {
      setFormMessage('Сначала выберите точку на карте', true)
      return
    }

    setFormMessage('')
    descriptionInput.focus()
  })

  categorySelect.addEventListener('change', () => {
    fillSubcategories(categorySelect.value)
  })

  form.addEventListener('submit', submitAppeal)

  setSelectionControlsVisible(false)
  setFormVisible(false)
  updateCoordsLabel()

  Promise.resolve()
    .then(() => ensureAuthorized())
    .then(() => loadCategories())
    .catch(error => {
      if (error?.message === '__redirect_admin__') return
      setFormVisible(true)
      setFormMessage(error.message || 'Ошибка загрузки данных', true)
    })

  if (!window.ymaps) {
    setFormVisible(true)
    setFormMessage('API Яндекс Карт не загрузился', true)
    return
  }

  ymaps.ready(() => {
    map = new ymaps.Map(
      'yandexMap',
      {
        center: [55.751244, 37.618423],
        zoom: 10,
        controls: ['zoomControl', 'geolocationControl'],
      },
      {
        suppressMapOpenBlock: true,
      }
    )

    map.events.add('click', event => {
      const coords = event.get('coords')
      if (!Array.isArray(coords) || coords.length !== 2) return
      setSelectedPoint(coords)
    })
  })
})()
