;(() => {
  const workspace = document.querySelector('.admin-workspace')
  const mainContent = workspace?.querySelector('main')

  if (!workspace || !mainContent || document.getElementById('appealChat')) {
    return
  }

  mainContent.insertAdjacentHTML(
    'afterend',
    `
      <aside class="agent-chat-drawer" id="appealChat" aria-hidden="true">
        <div class="agent-chat-drawer__surface">
          <header class="agent-chat__header">
            <div class="agent-chat__header-copy">
              <h3 class="agent-chat__title" id="appealChatTitle">Чат по заявке</h3>
              <p class="agent-chat__subtitle">История сообщений по выбранному обращению.</p>
            </div>
          </header>

          <div class="agent-chat__body" id="appealChatBody">
            <p class="agent-chat__empty" id="appealChatEmpty">Сообщений по этой заявке пока нет.</p>
            <div class="agent-chat__messages" id="appealChatList"></div>
          </div>

          <form class="agent-chat__composer" id="appealChatComposer">
            <textarea
              class="agent-chat__input"
              id="appealChatInput"
              rows="1"
              placeholder="Введите сообщение"
              aria-label="Введите сообщение"
            ></textarea>
            <button class="agent-chat__send" id="appealChatSend" type="submit" aria-label="Отправить">
              <span aria-hidden="true">➤</span>
            </button>
          </form>
        </div>
      </aside>

      <aside class="appeal-drawer appeal-drawer--agent" id="appealModal" aria-hidden="true">
        <div class="appeal-drawer__surface">
          <section class="appeal-modal__dialog" role="region" aria-labelledby="appealModalTitle">
            <header class="appeal-modal__header">
              <h3 class="appeal-modal__title" id="appealModalTitle">Заявка</h3>
              <button class="appeal-modal__btn appeal-modal__btn--primary" id="appealModalSave" type="button">Сохранить</button>
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
                      disabled
                    >
                      <span class="appeal-modal__select-value" id="appealModalOrganizationDisplay">Орган не назначен</span>
                      <span class="appeal-modal__select-chevron" aria-hidden="true"></span>
                    </button>
                    <ul class="appeal-modal__select-dropdown" id="appealModalOrganizationList" role="listbox" hidden></ul>
                    <select class="appeal-modal__select-native" id="appealModalOrganization" tabindex="-1" aria-hidden="true" disabled>
                      <option value="">Орган не назначен</option>
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
                      disabled
                    >
                      <span class="appeal-modal__select-value" id="appealModalFilialDisplay">Филиал не назначен</span>
                      <span class="appeal-modal__select-chevron" aria-hidden="true"></span>
                    </button>
                    <ul class="appeal-modal__select-dropdown" id="appealModalFilialList" role="listbox" hidden></ul>
                    <select class="appeal-modal__select-native" id="appealModalFilial" tabindex="-1" aria-hidden="true" disabled>
                      <option value="">Филиал не назначен</option>
                    </select>
                  </div>
                </label>

                <fieldset class="appeal-modal__field">
                  <legend>Статус обращения</legend>
                  <p class="agent-status__current" id="agentStatusCurrent">Текущий статус: —</p>
                  <div class="agent-status__radios" id="agentStatusRadios">
                    <label class="agent-status__option agent-status__option--in-progress">
                      <input type="radio" name="agentStatusOption" value="in_progress" />
                      <span>В работе</span>
                    </label>
                    <label class="agent-status__option agent-status__option--resolved">
                      <input type="radio" name="agentStatusOption" value="resolved" />
                      <span>Решена</span>
                    </label>
                    <label class="agent-status__option agent-status__option--rejected">
                      <input type="radio" name="agentStatusOption" value="rejected" />
                      <span>Отклонена</span>
                    </label>
                  </div>
                </fieldset>

                <p class="appeal-modal__note" id="appealModalNote">
                  История переписки отображается в чате слева.
                </p>
                <p class="appeal-modal__message" id="appealModalMessage"></p>
              </div>
            </div>
          </section>
        </div>
      </aside>
    `
  )
})()
