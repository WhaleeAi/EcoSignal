;(() => {
  if (document.getElementById('appealModal')) return

  const workspace = document.querySelector('.admin-workspace')
  if (!workspace) return

  workspace.insertAdjacentHTML(
    'beforeend',
    `
      <aside class="appeal-drawer" id="appealModal" aria-hidden="true">
        <div class="appeal-drawer__surface">
          <section class="appeal-modal__dialog" role="region" aria-labelledby="appealModalTitle">
            <header class="appeal-modal__header">
              <h3 class="appeal-modal__title" id="appealModalTitle">Заявка</h3>
              <button class="appeal-modal__close" id="appealModalClose" type="button" aria-label="Закрыть">&times;</button>
            </header>

            <div class="appeal-modal__body">
              <div class="appeal-modal__carousel-wrap" id="appealModalCarouselWrap">
                <div class="appeal-modal__carousel" id="appealModalCarousel" aria-label="Фотографии заявки">
                  <div class="appeal-modal__images" id="appealModalImages"></div>
                </div>
                <button
                  type="button"
                  class="appeal-modal__carousel-arrow appeal-modal__carousel-arrow--prev"
                  id="appealModalCarouselPrev"
                  aria-label="Прокрутить фотографии влево"
                >
                  <span class="appeal-modal__carousel-arrow-icon appeal-modal__carousel-arrow-icon--prev" aria-hidden="true"></span>
                </button>
                <button
                  type="button"
                  class="appeal-modal__carousel-arrow appeal-modal__carousel-arrow--next"
                  id="appealModalCarouselNext"
                  aria-label="Прокрутить фотографии вправо"
                >
                  <span class="appeal-modal__carousel-arrow-icon appeal-modal__carousel-arrow-icon--next" aria-hidden="true"></span>
                </button>
              </div>

              <div class="appeal-modal__details">
                <p class="appeal-modal__category" id="appealModalCategory"></p>
                <p class="appeal-modal__subcategory" id="appealModalSubcategory"></p>
                <p class="appeal-modal__user" id="appealModalUser"></p>
                <p class="appeal-modal__description" id="appealModalDescription"></p>

                <section class="appeal-modal__map-block" id="appealModalMapBlock" aria-label="Карта заявки и филиалов">
                  <div class="appeal-modal__map-head">
                    <p class="appeal-modal__map-title">Заявка и филиалы</p>
                    <p class="appeal-modal__map-hint" id="appealModalMapHint">
                      Кликните по метке филиала, чтобы подставить орган и филиал в форму.
                    </p>
                  </div>
                  <div class="appeal-modal__map" id="appealModalMap" aria-label="Карта заявки"></div>
                </section>

                <fieldset class="appeal-modal__field">
                  <legend>Приоритет</legend>
                  <div class="appeal-modal__priority" id="appealModalPriority">
                    <label class="appeal-modal__priority-option"><input type="radio" name="appealModalPriority" value="1" checked />1</label>
                    <label class="appeal-modal__priority-option"><input type="radio" name="appealModalPriority" value="2" />2</label>
                    <label class="appeal-modal__priority-option"><input type="radio" name="appealModalPriority" value="3" />3</label>
                    <label class="appeal-modal__priority-option"><input type="radio" name="appealModalPriority" value="4" />4</label>
                    <label class="appeal-modal__priority-option"><input type="radio" name="appealModalPriority" value="5" />5</label>
                  </div>
                </fieldset>

                <label class="appeal-modal__field appeal-modal__field--organization">
                  <span>Надзорный орган</span>
                  <div class="appeal-modal__select-wrap" id="appealModalOrganizationWrap">
                    <button
                      type="button"
                      class="appeal-modal__select-trigger"
                      id="appealModalOrganizationTrigger"
                      aria-haspopup="listbox"
                      aria-expanded="false"
                      aria-controls="appealModalOrganizationList"
                    >
                      <span class="appeal-modal__select-value" id="appealModalOrganizationDisplay">Выберите орган</span>
                      <span class="appeal-modal__select-chevron" aria-hidden="true"></span>
                    </button>
                    <ul class="appeal-modal__select-dropdown" id="appealModalOrganizationList" role="listbox" hidden></ul>
                    <select class="appeal-modal__select-native" id="appealModalOrganization" tabindex="-1" aria-hidden="true">
                      <option value="">Выберите орган</option>
                    </select>
                  </div>
                </label>

                <label class="appeal-modal__field appeal-modal__field--filial">
                  <span>Филиал</span>
                  <div class="appeal-modal__select-wrap" id="appealModalFilialWrap">
                    <button
                      type="button"
                      class="appeal-modal__select-trigger"
                      id="appealModalFilialTrigger"
                      aria-haspopup="listbox"
                      aria-expanded="false"
                      aria-controls="appealModalFilialList"
                    >
                      <span class="appeal-modal__select-value" id="appealModalFilialDisplay">Сначала выберите орган</span>
                      <span class="appeal-modal__select-chevron" aria-hidden="true"></span>
                    </button>
                    <ul class="appeal-modal__select-dropdown" id="appealModalFilialList" role="listbox" hidden></ul>
                    <select class="appeal-modal__select-native" id="appealModalFilial" tabindex="-1" aria-hidden="true" disabled>
                      <option value="">Сначала выберите орган</option>
                    </select>
                  </div>
                </label>

                <p class="appeal-modal__note" id="appealModalNote">
                  Если выбрать орган вручную, на карте останутся только его филиалы.
                </p>
                <p class="appeal-modal__message" id="appealModalMessage"></p>
              </div>
            </div>

            <footer class="appeal-modal__footer" id="appealModalFooter">
              <button class="appeal-modal__btn appeal-modal__btn--ghost" id="appealModalCancel" type="button">Отмена</button>
              <button class="appeal-modal__btn appeal-modal__btn--primary" id="appealModalSave" type="button">Сохранить</button>
            </footer>
          </section>
        </div>
      </aside>
    `
  )
})()
