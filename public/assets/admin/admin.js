const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const state = {
  csrf: '',
  user: null,
  blockTypes: [],
  blockMap: new Map(),
  pages: [],
  content: [],
  media: [],
  settings: null,
  currentPage: null,
  currentContent: null,
  selectedBlockId: null,
  dirty: false,
  currentView: 'dashboard',
  dragBlockId: null,
};

const refs = {
  loading: $('[data-loading]'),
  auth: $('[data-auth-screen]'),
  app: $('[data-admin-app]'),
  loginForm: $('[data-login-form]'),
  loginMessage: $('[data-login-message]'),
  setupNotice: $('[data-setup-notice]'),
  viewTitle: $('[data-view-title]'),
  currentSection: $('[data-current-section]'),
  saveState: $('[data-save-state]'),
  pagesList: $('[data-pages-list]'),
  pageBuilder: $('[data-page-builder]'),
  pagesPlaceholder: $('[data-pages-placeholder]'),
  contentList: $('[data-content-list]'),
  contentBuilder: $('[data-content-builder]'),
  contentPlaceholder: $('[data-content-placeholder]'),
  mediaGrid: $('[data-media-grid]'),
  settingsForm: $('[data-settings-form]'),
  modal: $('[data-admin-modal]'),
  modalTitle: $('[data-modal-title]'),
  modalBody: $('[data-modal-body]'),
  toastStack: $('[data-toast-stack]'),
};

function escapeHtml(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

function formatDate(value) {
  if (!value) return '—';
  try { return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)); } catch { return value; }
}

function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} Б`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} КБ`;
  return `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

function slugify(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9а-яё]+/gi, '-').replace(/[а-яё]/gi, (char) => ({
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  })[char.toLowerCase()] ?? '').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined && !headers.has('content-type')) headers.set('content-type', 'application/json');
  if (state.csrf && ['POST', 'PATCH', 'PUT', 'DELETE'].includes(options.method || 'GET')) headers.set('x-csrf-token', state.csrf);
  const response = await fetch(path, { credentials: 'same-origin', ...options, headers, body: options.body !== undefined && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body });
  const type = response.headers.get('content-type') || '';
  const payload = type.includes('application/json') ? await response.json() : { ok: response.ok, message: await response.text() };
  if (response.status === 401) {
    state.user = null;
    showAuth(false);
  }
  if (!response.ok || payload.ok === false) {
    const error = new Error(payload.message || `Ошибка ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function toast(message, type = 'success') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  refs.toastStack.append(node);
  setTimeout(() => node.remove(), 4200);
}

function setSaving(text = '', type = '') {
  refs.saveState.textContent = text;
  refs.saveState.className = `save-state ${type}`;
}

function markDirty() {
  state.dirty = true;
  setSaving('Есть изменения', 'is-saving');
}

function markClean(message = 'Черновик сохранён') {
  state.dirty = false;
  setSaving(message, 'is-saved');
  setTimeout(() => { if (!state.dirty) setSaving(''); }, 2200);
}

function showAuth(setupRequired) {
  refs.loading.hidden = true;
  refs.app.hidden = true;
  refs.auth.hidden = false;
  refs.setupNotice.hidden = !setupRequired;
  refs.loginForm.hidden = Boolean(setupRequired);
}

function showApp() {
  refs.loading.hidden = true;
  refs.auth.hidden = true;
  refs.app.hidden = false;
  $('[data-user-name]').textContent = state.user.username;
  $('[data-user-initial]').textContent = state.user.username.slice(0, 1).toUpperCase();
}

function openModal(title, html) {
  refs.modalTitle.textContent = title;
  refs.modalBody.innerHTML = html;
  refs.modal.classList.add('is-open');
  refs.modal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  refs.modal.classList.remove('is-open');
  refs.modal.setAttribute('aria-hidden', 'true');
  refs.modalBody.innerHTML = '';
}

function confirmDialog({ title = 'Подтверждение', message, confirmLabel = 'Продолжить', danger = false }) {
  return new Promise((resolve) => {
    openModal(title, `<p style="color:var(--muted);line-height:1.6">${escapeHtml(message)}</p><div style="display:flex;gap:10px;justify-content:flex-end;margin-top:22px"><button class="admin-button secondary" type="button" data-confirm-cancel>Отмена</button><button class="admin-button ${danger ? 'danger' : 'primary'}" type="button" data-confirm-ok>${escapeHtml(confirmLabel)}</button></div>`);
    $('[data-confirm-cancel]', refs.modalBody).addEventListener('click', () => { closeModal(); resolve(false); });
    $('[data-confirm-ok]', refs.modalBody).addEventListener('click', () => { closeModal(); resolve(true); });
  });
}

function sectionNames(view) {
  return {
    dashboard: ['Обзор', 'Панель управления'],
    pages: ['Конструктор', 'Страницы сайта'],
    content: ['Материалы', 'Услуги, кейсы и блог'],
    media: ['Файлы', 'Медиатека'],
    leads: ['Формы', 'Заявки'],
    settings: ['Настройки', 'Меню и подвал'],
    audit: ['Контроль', 'История действий'],
  }[view] || ['CMS', 'Панель управления'];
}

async function switchView(view) {
  if (state.dirty) {
    const proceed = await confirmDialog({ title: 'Есть несохранённые изменения', message: 'Перейти в другой раздел без сохранения черновика?', confirmLabel: 'Перейти', danger: true });
    if (!proceed) return;
    state.dirty = false;
  }
  state.currentView = view;
  $$('.admin-nav button').forEach((button) => button.classList.toggle('is-active', button.dataset.view === view));
  $$('.admin-view').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.viewPanel === view));
  const [kicker, title] = sectionNames(view);
  refs.currentSection.textContent = kicker;
  refs.viewTitle.textContent = title;
  $('[data-sidebar]').classList.remove('is-open');
  if (view === 'dashboard') await loadDashboard();
  if (view === 'pages') await loadPages();
  if (view === 'content') await loadContent();
  if (view === 'media') await loadMedia();
  if (view === 'leads') await loadLeads();
  if (view === 'settings') await loadSettings();
  if (view === 'audit') await loadAudit();
}

function renderAudit(entries, root) {
  root.innerHTML = entries.length ? entries.map((entry) => `<div class="audit-entry"><time>${escapeHtml(formatDate(entry.created_at))}</time><strong>${escapeHtml(entry.username || 'Система')}</strong><span>${escapeHtml(entry.action)} · ${escapeHtml(entry.entity_type)} ${escapeHtml(entry.entity_id || '')}</span><small>${escapeHtml(JSON.stringify(entry.details || {})).slice(0, 160)}</small></div>`).join('') : '<div class="entity-placeholder"><strong>История пока пуста</strong></div>';
}

async function loadDashboard() {
  const payload = await api('/admin/api/dashboard');
  const d = payload.dashboard;
  const cards = [
    ['Страницы', d.pages, `${d.publishedPages} опубликовано`],
    ['Услуги', d.services, 'динамических материалов'],
    ['Кейсы', d.cases, 'динамических материалов'],
    ['Статьи', d.posts, 'в блоге'],
    ['Медиафайлы', d.media, 'в медиатеке'],
    ['Пользователи', d.users, 'активных администраторов'],
  ];
  $('[data-dashboard-cards]').innerHTML = cards.map(([label, value, note]) => `<div class="dashboard-card"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(note)}</small></div>`).join('');
  renderAudit(payload.recentAudit, $('[data-dashboard-audit]'));
}

async function loadPages(selectId = null) {
  const payload = await api('/admin/api/pages');
  state.pages = payload.pages;
  renderPagesList();
  if (selectId) await openPage(selectId);
}

function renderPagesList() {
  refs.pagesList.innerHTML = state.pages.map((page) => `<button class="entity-item ${state.currentPage?.id === page.id ? 'is-active' : ''}" type="button" data-page-id="${page.id}"><span class="status-badge ${page.published ? 'published' : ''}">${page.published ? 'Опубликовано' : 'Черновик'}</span><strong>${escapeHtml(page.title)}</strong><small>${escapeHtml(page.route)}</small></button>`).join('');
  $$('[data-page-id]', refs.pagesList).forEach((button) => button.addEventListener('click', () => openPage(Number(button.dataset.pageId))));
}

async function openPage(id) {
  if (state.dirty && state.currentPage?.id !== id) {
    const proceed = await confirmDialog({ title: 'Не сохранено', message: 'Открыть другую страницу и потерять текущие изменения?', confirmLabel: 'Открыть', danger: true });
    if (!proceed) return;
  }
  const payload = await api(`/admin/api/pages/${id}`);
  state.currentPage = structuredClone(payload.page);
  state.currentPage.revisions = payload.revisions || [];
  state.currentContent = null;
  state.selectedBlockId = state.currentPage.draft.blocks[0]?.id || null;
  state.dirty = false;
  refs.pagesPlaceholder.hidden = true;
  refs.pageBuilder.hidden = false;
  renderPagesList();
  renderBuilder('page');
}

async function loadContent(selectId = null) {
  const kind = $('[data-content-kind]').value;
  const payload = await api(`/admin/api/content${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`);
  state.content = payload.items;
  renderContentList();
  if (selectId) await openContent(selectId);
}

function kindLabel(kind) {
  return kind === 'service' ? 'Услуга' : kind === 'case' ? 'Кейс' : 'Статья';
}

function renderContentList() {
  refs.contentList.innerHTML = state.content.map((item) => `<button class="entity-item ${state.currentContent?.id === item.id ? 'is-active' : ''}" type="button" data-content-id="${item.id}"><span class="status-badge ${item.published ? 'published' : ''}">${item.published ? 'Опубликовано' : 'Черновик'} · ${kindLabel(item.kind)}</span><strong>${escapeHtml(item.title)}</strong><small>/${escapeHtml(item.slug)}</small></button>`).join('');
  $$('[data-content-id]', refs.contentList).forEach((button) => button.addEventListener('click', () => openContent(Number(button.dataset.contentId))));
}

async function openContent(id) {
  if (state.dirty && state.currentContent?.id !== id) {
    const proceed = await confirmDialog({ title: 'Не сохранено', message: 'Открыть другой материал и потерять текущие изменения?', confirmLabel: 'Открыть', danger: true });
    if (!proceed) return;
  }
  const payload = await api(`/admin/api/content/${id}`);
  state.currentContent = structuredClone(payload.item);
  state.currentContent.revisions = payload.revisions || [];
  state.currentPage = null;
  state.selectedBlockId = state.currentContent.draft.blocks[0]?.id || null;
  state.dirty = false;
  refs.contentPlaceholder.hidden = true;
  refs.contentBuilder.hidden = false;
  renderContentList();
  renderBuilder('content');
}

function currentEntity(type) {
  return type === 'page' ? state.currentPage : state.currentContent;
}

function renderBuilder(type) {
  const entity = currentEntity(type);
  const root = type === 'page' ? refs.pageBuilder : refs.contentBuilder;
  if (!entity) return;
  const previewUrl = `/admin/preview/${type}/${entity.id}`;
  root.innerHTML = `<div class="builder-head"><div><span class="status-badge ${entity.published ? 'published' : ''}">${entity.published ? 'Опубликовано' : 'Черновик'}</span><h2>${escapeHtml(entity.title)}</h2></div><div class="builder-actions"><button class="admin-button secondary" type="button" data-builder-preview>Предпросмотр ↗</button><button class="admin-button secondary" type="button" data-builder-save>Сохранить черновик</button>${entity.published ? '<button class="admin-button secondary" type="button" data-builder-unpublish>Снять с публикации</button>' : ''}<button class="admin-button primary" type="button" data-builder-publish>Опубликовать</button><button class="admin-button danger" type="button" data-builder-delete>Удалить</button></div></div>
    ${renderMeta(type, entity)}
    <div class="block-workspace"><section class="block-stack"><div class="block-stack-head"><strong>Блоки страницы</strong><button class="admin-button small primary" type="button" data-add-block>+ Добавить</button></div><div class="block-list" data-block-list></div></section><aside class="block-inspector"><div class="inspector-head"><strong>Настройки блока</strong><span class="save-state">${entity.draft.blocks.length} блоков</span></div><div data-inspector></div></aside></div>
    ${renderRevisions(entity.revisions || [])}`;

  renderBlockList(type);
  renderInspector(type);
  bindBuilder(type, previewUrl);
}

function renderMeta(type, entity) {
  if (type === 'page') return `<div class="meta-grid"><label class="admin-field"><span>Название в админке</span><input data-meta="title" value="${escapeHtml(entity.title)}"></label><label class="admin-field"><span>Адрес страницы</span><input data-meta="route" value="${escapeHtml(entity.route)}"></label><label class="admin-field full"><span>SEO title</span><input data-meta="seoTitle" value="${escapeHtml(entity.seoTitle)}"></label><label class="admin-field full"><span>SEO description</span><textarea data-meta="seoDescription">${escapeHtml(entity.seoDescription)}</textarea></label></div>`;
  return `<div class="meta-grid"><label class="admin-field"><span>Тип материала</span><select data-meta="kind"><option value="service" ${entity.kind === 'service' ? 'selected' : ''}>Услуга</option><option value="case" ${entity.kind === 'case' ? 'selected' : ''}>Кейс</option><option value="post" ${entity.kind === 'post' ? 'selected' : ''}>Статья</option></select></label><label class="admin-field"><span>Slug</span><input data-meta="slug" value="${escapeHtml(entity.slug)}"></label><label class="admin-field full"><span>Название</span><input data-meta="title" value="${escapeHtml(entity.title)}"></label><label class="admin-field full"><span>Краткое описание для карточки</span><textarea data-meta="excerpt">${escapeHtml(entity.excerpt)}</textarea></label><label class="admin-field full"><span>Обложка</span><div class="media-picker-row"><input data-meta="cover" value="${escapeHtml(entity.cover)}" placeholder="/uploads/..."><button class="admin-button secondary" type="button" data-pick-cover>Выбрать</button></div></label><label class="admin-field full"><span>Теги через запятую</span><input data-meta="tags" value="${escapeHtml((entity.tags || []).join(', '))}"></label><label class="admin-field full"><span>SEO title</span><input data-meta="seoTitle" value="${escapeHtml(entity.seoTitle)}"></label><label class="admin-field full"><span>SEO description</span><textarea data-meta="seoDescription">${escapeHtml(entity.seoDescription)}</textarea></label></div>`;
}

function renderRevisions(revisions) {
  if (!revisions.length) return '';
  return `<div class="admin-panel" style="margin-top:14px"><div class="panel-head"><div><span class="admin-kicker">Версии</span><h2 style="font-size:1.35rem">История публикаций</h2></div></div><div class="revision-list">${revisions.map((revision) => `<div class="revision-item"><span>${escapeHtml(formatDate(revision.created_at))} · ${escapeHtml(revision.username || 'Система')}<br>${escapeHtml(revision.note || '')}</span><button class="admin-button small secondary" type="button" data-restore-revision="${revision.id}">Восстановить в черновик</button></div>`).join('')}</div></div>`;
}

function renderBlockList(type) {
  const entity = currentEntity(type);
  const root = $('[data-block-list]', type === 'page' ? refs.pageBuilder : refs.contentBuilder);
  root.innerHTML = entity.draft.blocks.map((block, index) => {
    const definition = state.blockMap.get(block.type);
    return `<article class="block-item ${state.selectedBlockId === block.id ? 'is-active' : ''} ${block.enabled === false ? 'is-disabled' : ''}" draggable="true" data-block-id="${escapeHtml(block.id)}"><span class="block-drag" title="Перетащить">⋮⋮</span><div><strong>${escapeHtml(definition?.label || block.type)}</strong><small>${escapeHtml(block.data?.title || block.data?.titleLine1 || `Блок ${index + 1}`)}</small></div><div class="block-actions"><button type="button" title="Выше" data-block-up>↑</button><button type="button" title="Ниже" data-block-down>↓</button><button type="button" title="${block.enabled === false ? 'Показать' : 'Скрыть'}" data-block-toggle>${block.enabled === false ? '○' : '●'}</button><button type="button" title="Дублировать" data-block-copy>⧉</button><button type="button" title="Удалить" data-block-remove>×</button></div></article>`;
  }).join('') || '<div class="inspector-empty">На странице пока нет блоков.</div>';

  $$('[data-block-id]', root).forEach((node) => {
    node.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      state.selectedBlockId = node.dataset.blockId;
      renderBlockList(type);
      renderInspector(type);
    });
    node.addEventListener('dragstart', () => { state.dragBlockId = node.dataset.blockId; node.style.opacity = '.45'; });
    node.addEventListener('dragend', () => { state.dragBlockId = null; node.style.opacity = ''; });
    node.addEventListener('dragover', (event) => event.preventDefault());
    node.addEventListener('drop', (event) => {
      event.preventDefault();
      const from = entity.draft.blocks.findIndex((block) => block.id === state.dragBlockId);
      const to = entity.draft.blocks.findIndex((block) => block.id === node.dataset.blockId);
      if (from < 0 || to < 0 || from === to) return;
      const [moved] = entity.draft.blocks.splice(from, 1);
      entity.draft.blocks.splice(to, 0, moved);
      markDirty();
      renderBlockList(type);
    });
    $('[data-block-up]', node)?.addEventListener('click', () => moveBlock(type, node.dataset.blockId, -1));
    $('[data-block-down]', node)?.addEventListener('click', () => moveBlock(type, node.dataset.blockId, 1));
    $('[data-block-toggle]', node)?.addEventListener('click', () => { const block = entity.draft.blocks.find((value) => value.id === node.dataset.blockId); block.enabled = block.enabled === false; markDirty(); renderBlockList(type); });
    $('[data-block-copy]', node)?.addEventListener('click', () => duplicateBlock(type, node.dataset.blockId));
    $('[data-block-remove]', node)?.addEventListener('click', () => removeBlock(type, node.dataset.blockId));
  });
}

function moveBlock(type, id, direction) {
  const entity = currentEntity(type);
  const index = entity.draft.blocks.findIndex((block) => block.id === id);
  const next = index + direction;
  if (index < 0 || next < 0 || next >= entity.draft.blocks.length) return;
  [entity.draft.blocks[index], entity.draft.blocks[next]] = [entity.draft.blocks[next], entity.draft.blocks[index]];
  markDirty();
  renderBlockList(type);
}

function duplicateBlock(type, id) {
  const entity = currentEntity(type);
  const index = entity.draft.blocks.findIndex((block) => block.id === id);
  if (index < 0) return;
  const copy = structuredClone(entity.draft.blocks[index]);
  copy.id = crypto.randomUUID();
  entity.draft.blocks.splice(index + 1, 0, copy);
  state.selectedBlockId = copy.id;
  markDirty();
  renderBlockList(type);
  renderInspector(type);
}

async function removeBlock(type, id) {
  const entity = currentEntity(type);
  const block = entity.draft.blocks.find((value) => value.id === id);
  const definition = state.blockMap.get(block?.type);
  const okay = await confirmDialog({ title: 'Удалить блок?', message: `Блок «${definition?.label || block?.type}» будет удалён только из черновика.`, confirmLabel: 'Удалить', danger: true });
  if (!okay) return;
  entity.draft.blocks = entity.draft.blocks.filter((value) => value.id !== id);
  state.selectedBlockId = entity.draft.blocks[0]?.id || null;
  markDirty();
  renderBlockList(type);
  renderInspector(type);
}

function selectedBlock(type) {
  return currentEntity(type)?.draft.blocks.find((block) => block.id === state.selectedBlockId) || null;
}

function renderInspector(type) {
  const root = $('[data-inspector]', type === 'page' ? refs.pageBuilder : refs.contentBuilder);
  const block = selectedBlock(type);
  if (!block) { root.innerHTML = '<div class="inspector-empty">Выберите блок слева или добавьте новый.</div>'; return; }
  const definition = state.blockMap.get(block.type);
  root.innerHTML = `<div class="inspector-form"><div><span class="admin-kicker">${escapeHtml(definition?.category || 'Блок')}</span><h3 style="margin:7px 0 0">${escapeHtml(definition?.label || block.type)}</h3><p class="field-help">${escapeHtml(definition?.description || '')}</p></div>${(definition?.fields || []).map((field) => renderField(field, block.data[field.key], field.key)).join('')}</div>`;
  bindInspector(type, block, definition);
}

function renderField(field, value, path) {
  if (field.type === 'boolean') return `<label class="checkbox-field"><input type="checkbox" data-field-path="${escapeHtml(path)}" ${value ? 'checked' : ''}><span>${escapeHtml(field.label)}</span></label>`;
  if (field.type === 'textarea') return `<label class="field-group"><span class="field-label">${escapeHtml(field.label)}</span><textarea rows="${field.rows || 4}" data-field-path="${escapeHtml(path)}">${escapeHtml(value)}</textarea></label>`;
  if (field.type === 'select') return `<label class="field-group"><span class="field-label">${escapeHtml(field.label)}</span><select data-field-path="${escapeHtml(path)}">${field.choices.map((choice) => `<option value="${escapeHtml(choice)}" ${choice === value ? 'selected' : ''}>${escapeHtml(choice)}</option>`).join('')}</select></label>`;
  if (field.type === 'number') return `<label class="field-group"><span class="field-label">${escapeHtml(field.label)}</span><input type="number" min="${field.min ?? ''}" max="${field.max ?? ''}" data-field-path="${escapeHtml(path)}" value="${escapeHtml(value)}"></label>`;
  if (field.type === 'media') return `<label class="field-group"><span class="field-label">${escapeHtml(field.label)}</span><div class="media-picker-row"><input data-field-path="${escapeHtml(path)}" value="${escapeHtml(value)}" placeholder="/uploads/..."><button class="admin-button secondary" type="button" data-pick-media="${escapeHtml(path)}">Выбрать</button></div>${value ? `<img class="media-preview-small" src="${escapeHtml(value)}" alt="">` : ''}</label>`;
  if (field.type === 'repeater') {
    const items = Array.isArray(value) ? value : [];
    return `<div class="field-group"><span class="field-label">${escapeHtml(field.label)}</span><div class="repeater" data-repeater-path="${escapeHtml(path)}"><div class="repeater-head"><span>${items.length} элементов</span><button class="admin-button small secondary" type="button" data-repeater-add>+ Добавить</button></div><div class="repeater-list">${items.map((item, index) => `<div class="repeater-item" data-repeater-index="${index}"><div class="repeater-item-head"><span>Элемент ${index + 1}</span><div class="repeater-controls"><button type="button" data-repeater-up title="Выше">↑</button><button type="button" data-repeater-down title="Ниже">↓</button><button type="button" data-repeater-copy title="Копировать">⧉</button><button type="button" data-repeater-remove title="Удалить">×</button></div></div><div class="repeater-item-fields">${field.fields.map((child) => renderField(child, item[child.key], `${path}.${index}.${child.key}`)).join('')}</div></div>`).join('')}</div></div></div>`;
  }
  return `<label class="field-group"><span class="field-label">${escapeHtml(field.label)}</span><input data-field-path="${escapeHtml(path)}" value="${escapeHtml(value)}"></label>`;
}

function getPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[Number.isInteger(Number(key)) && String(Number(key)) === key ? Number(key) : key], object);
}

function setPath(object, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  let cursor = object;
  for (const key of keys) cursor = cursor[Number.isInteger(Number(key)) && String(Number(key)) === key ? Number(key) : key];
  cursor[Number.isInteger(Number(last)) && String(Number(last)) === last ? Number(last) : last] = value;
}

function bindInspector(type, block, definition) {
  const root = $('[data-inspector]', type === 'page' ? refs.pageBuilder : refs.contentBuilder);
  $$('[data-field-path]', root).forEach((input) => {
    const fieldPath = input.dataset.fieldPath;
    const update = () => {
      let value = input.type === 'checkbox' ? input.checked : input.type === 'number' ? Number(input.value) : input.value;
      setPath(block.data, fieldPath, value);
      markDirty();
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });
  $$('[data-pick-media]', root).forEach((button) => button.addEventListener('click', async () => {
    const url = await chooseMedia();
    if (!url) return;
    setPath(block.data, button.dataset.pickMedia, url);
    markDirty();
    renderInspector(type);
  }));
  $$('[data-repeater-path]', root).forEach((repeaterNode) => {
    const path = repeaterNode.dataset.repeaterPath;
    const field = definition.fields.find((candidate) => candidate.key === path);
    $('[data-repeater-add]', repeaterNode)?.addEventListener('click', () => {
      const list = getPath(block.data, path);
      const item = {};
      for (const child of field.fields) item[child.key] = child.type === 'boolean' ? false : child.type === 'number' ? (child.min || 0) : child.type === 'repeater' ? [] : child.type === 'select' ? child.choices[0] : '';
      list.push(item);
      markDirty();
      renderInspector(type);
    });
    $$('[data-repeater-index]', repeaterNode).forEach((itemNode) => {
      const index = Number(itemNode.dataset.repeaterIndex);
      $('[data-repeater-up]', itemNode)?.addEventListener('click', () => moveRepeater(block, path, index, -1, type));
      $('[data-repeater-down]', itemNode)?.addEventListener('click', () => moveRepeater(block, path, index, 1, type));
      $('[data-repeater-copy]', itemNode)?.addEventListener('click', () => { const list = getPath(block.data, path); list.splice(index + 1, 0, structuredClone(list[index])); markDirty(); renderInspector(type); });
      $('[data-repeater-remove]', itemNode)?.addEventListener('click', () => { const list = getPath(block.data, path); list.splice(index, 1); markDirty(); renderInspector(type); });
    });
  });
}

function moveRepeater(block, path, index, direction, type) {
  const list = getPath(block.data, path);
  const next = index + direction;
  if (next < 0 || next >= list.length) return;
  [list[index], list[next]] = [list[next], list[index]];
  markDirty();
  renderInspector(type);
}

function bindBuilder(type, previewUrl) {
  const entity = currentEntity(type);
  const root = type === 'page' ? refs.pageBuilder : refs.contentBuilder;
  $$('[data-meta]', root).forEach((input) => {
    const key = input.dataset.meta;
    const update = () => {
      if (key === 'tags') entity.tags = input.value.split(',').map((value) => value.trim()).filter(Boolean);
      else entity[key] = input.value;
      markDirty();
    };
    input.addEventListener('input', update);
    input.addEventListener('change', update);
  });
  $('[data-pick-cover]', root)?.addEventListener('click', async () => {
    const url = await chooseMedia();
    if (!url) return;
    entity.cover = url;
    $('[data-meta="cover"]', root).value = url;
    markDirty();
  });
  $('[data-builder-preview]', root).addEventListener('click', () => window.open(previewUrl, '_blank', 'noopener'));
  $('[data-builder-save]', root).addEventListener('click', () => saveEntity(type));
  $('[data-builder-publish]', root).addEventListener('click', () => publishEntity(type));
  $('[data-builder-unpublish]', root)?.addEventListener('click', () => unpublishEntity(type));
  $('[data-builder-delete]', root).addEventListener('click', () => deleteEntity(type));
  $('[data-add-block]', root).addEventListener('click', () => openBlockPalette(type));
  $$('[data-restore-revision]', root).forEach((button) => button.addEventListener('click', () => restoreRevision(type, Number(button.dataset.restoreRevision))));
}

async function saveEntity(type, { quiet = false } = {}) {
  const entity = currentEntity(type);
  if (!entity) return;
  setSaving('Сохранение…', 'is-saving');
  const path = type === 'page' ? `/admin/api/pages/${entity.id}` : `/admin/api/content/${entity.id}`;
  const body = type === 'page' ? { route: entity.route, title: entity.title, pageType: entity.pageType, seoTitle: entity.seoTitle, seoDescription: entity.seoDescription, draft: entity.draft } : { kind: entity.kind, slug: entity.slug, title: entity.title, excerpt: entity.excerpt, cover: entity.cover, tags: entity.tags, seoTitle: entity.seoTitle, seoDescription: entity.seoDescription, draft: entity.draft };
  const payload = await api(path, { method: 'PATCH', body });
  const saved = type === 'page' ? payload.page : payload.item;
  if (type === 'page') state.currentPage = { ...state.currentPage, ...saved, revisions: state.currentPage.revisions };
  else state.currentContent = { ...state.currentContent, ...saved, revisions: state.currentContent.revisions };
  markClean();
  if (!quiet) toast('Черновик сохранён');
  if (type === 'page') { await loadPages(); await openPage(saved.id); } else { await loadContent(); await openContent(saved.id); }
}

async function publishEntity(type) {
  const entity = currentEntity(type);
  if (!entity) return;
  if (state.dirty) await saveEntity(type, { quiet: true });
  const okay = await confirmDialog({ title: 'Опубликовать изменения?', message: 'Перед публикацией автоматически создаётся резервная копия базы и предыдущая версия материала.', confirmLabel: 'Опубликовать' });
  if (!okay) return;
  const path = type === 'page' ? `/admin/api/pages/${entity.id}/publish` : `/admin/api/content/${entity.id}/publish`;
  await api(path, { method: 'POST', body: {} });
  toast('Изменения опубликованы');
  if (type === 'page') await loadPages(entity.id); else await loadContent(entity.id);
}

async function unpublishEntity(type) {
  const entity = currentEntity(type);
  const okay = await confirmDialog({ title: 'Снять с публикации?', message: 'Публичная страница или материал перестанет открываться на сайте. Черновик сохранится.', confirmLabel: 'Снять', danger: true });
  if (!okay) return;
  const path = type === 'page' ? `/admin/api/pages/${entity.id}/unpublish` : `/admin/api/content/${entity.id}/unpublish`;
  await api(path, { method: 'POST', body: {} });
  toast('Снято с публикации');
  if (type === 'page') await loadPages(entity.id); else await loadContent(entity.id);
}

async function deleteEntity(type) {
  const entity = currentEntity(type);
  const okay = await confirmDialog({ title: 'Удалить безвозвратно?', message: `«${entity.title}» будет удалён. Перед удалением система сохранит версию в журнале.`, confirmLabel: 'Удалить', danger: true });
  if (!okay) return;
  const path = type === 'page' ? `/admin/api/pages/${entity.id}` : `/admin/api/content/${entity.id}`;
  await api(path, { method: 'DELETE' });
  toast('Удалено');
  state.dirty = false;
  if (type === 'page') { state.currentPage = null; refs.pageBuilder.hidden = true; refs.pagesPlaceholder.hidden = false; await loadPages(); } else { state.currentContent = null; refs.contentBuilder.hidden = true; refs.contentPlaceholder.hidden = false; await loadContent(); }
}

async function restoreRevision(type, revisionId) {
  const okay = await confirmDialog({ title: 'Восстановить версию?', message: 'Содержимое выбранной версии будет помещено в текущий черновик. Публикация останется без изменений.', confirmLabel: 'Восстановить' });
  if (!okay) return;
  await api(`/admin/api/revisions/${revisionId}/restore`, { method: 'POST', body: {} });
  toast('Версия восстановлена в черновик');
  const id = currentEntity(type).id;
  if (type === 'page') await openPage(id); else await openContent(id);
}

function openBlockPalette(type) {
  const grouped = new Map();
  for (const definition of state.blockTypes) {
    if (!grouped.has(definition.category)) grouped.set(definition.category, []);
    grouped.get(definition.category).push(definition);
  }
  openModal('Добавить блок', [...grouped.entries()].map(([category, items]) => `<h3 style="margin:18px 0 10px">${escapeHtml(category)}</h3><div class="block-palette">${items.map((definition) => `<button class="palette-item" type="button" data-new-block="${escapeHtml(definition.type)}"><strong>${escapeHtml(definition.label)}</strong><p>${escapeHtml(definition.description)}</p></button>`).join('')}</div>`).join(''));
  $$('[data-new-block]', refs.modalBody).forEach((button) => button.addEventListener('click', () => {
    const definition = state.blockMap.get(button.dataset.newBlock);
    const entity = currentEntity(type);
    const block = { id: crypto.randomUUID(), type: definition.type, enabled: true, variant: 'default', data: structuredClone(definition.defaults) };
    const currentIndex = entity.draft.blocks.findIndex((value) => value.id === state.selectedBlockId);
    entity.draft.blocks.splice(currentIndex >= 0 ? currentIndex + 1 : entity.draft.blocks.length, 0, block);
    state.selectedBlockId = block.id;
    markDirty();
    closeModal();
    renderBlockList(type);
    renderInspector(type);
  }));
}

async function createPageDialog() {
  openModal('Новая страница', `<form data-create-page-form class="inspector-form"><label class="field-group"><span class="field-label">Название</span><input name="title" required placeholder="Новая страница"></label><label class="field-group"><span class="field-label">Адрес</span><input name="route" required placeholder="/new-page"></label><div style="display:flex;justify-content:flex-end"><button class="admin-button primary" type="submit">Создать</button></div></form>`);
  $('[data-create-page-form]', refs.modalBody).addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const page = (await api('/admin/api/pages', { method: 'POST', body: { title: data.get('title'), route: data.get('route'), pageType: 'page', seoTitle: data.get('title'), seoDescription: '', draft: { schemaVersion: 1, blocks: [] } } })).page;
    closeModal(); toast('Страница создана'); await loadPages(page.id);
  });
}

async function createContentDialog() {
  openModal('Новый материал', `<form data-create-content-form class="inspector-form"><label class="field-group"><span class="field-label">Тип</span><select name="kind"><option value="service">Услуга</option><option value="case">Кейс</option><option value="post">Статья</option></select></label><label class="field-group"><span class="field-label">Название</span><input name="title" required placeholder="Название материала"></label><label class="field-group"><span class="field-label">Slug</span><input name="slug" placeholder="sozdaetsya-avtomaticheski"></label><div style="display:flex;justify-content:flex-end"><button class="admin-button primary" type="submit">Создать</button></div></form>`);
  const form = $('[data-create-content-form]', refs.modalBody);
  const title = $('[name="title"]', form);
  const slug = $('[name="slug"]', form);
  title.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = slugify(title.value); });
  slug.addEventListener('input', () => { slug.dataset.touched = '1'; });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const item = (await api('/admin/api/content', { method: 'POST', body: { kind: data.get('kind'), title: data.get('title'), slug: data.get('slug') || slugify(data.get('title')), excerpt: '', cover: '', tags: [], seoTitle: data.get('title'), seoDescription: '', draft: { schemaVersion: 1, blocks: [] } } })).item;
    closeModal(); toast('Материал создан'); await loadContent(item.id);
  });
}

async function loadMedia() {
  const payload = await api('/admin/api/media');
  state.media = payload.media;
  refs.mediaGrid.innerHTML = state.media.length ? state.media.map((item) => `<article class="media-card"><img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.altText)}" loading="lazy"><div class="media-card-body"><strong>${escapeHtml(item.title || item.originalName)}</strong><small>${escapeHtml(formatBytes(item.sizeBytes))} · используется: ${item.usage}</small><div class="media-card-actions"><button class="admin-button small secondary" type="button" data-copy-media="${escapeHtml(item.url)}">Ссылка</button><button class="admin-button small danger" type="button" data-delete-media="${item.id}">Удалить</button></div></div></article>`).join('') : '<div class="entity-placeholder"><strong>Медиатека пуста</strong><p>Загрузите первое изображение.</p></div>';
  $$('[data-copy-media]', refs.mediaGrid).forEach((button) => button.addEventListener('click', async () => { await navigator.clipboard.writeText(button.dataset.copyMedia); toast('Ссылка скопирована'); }));
  $$('[data-delete-media]', refs.mediaGrid).forEach((button) => button.addEventListener('click', () => deleteMedia(Number(button.dataset.deleteMedia))));
}

async function uploadMedia(files) {
  for (const file of files) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { toast(`${file.name}: неподдерживаемый формат`, 'error'); continue; }
    if (file.size > 8 * 1024 * 1024) { toast(`${file.name}: файл больше 8 МБ`, 'error'); continue; }
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(file); });
    try { await api('/admin/api/media', { method: 'POST', body: { originalName: file.name, mimeType: file.type, base64, title: file.name.replace(/\.[^.]+$/, ''), altText: '' } }); toast(`${file.name} загружен`); } catch (error) { toast(`${file.name}: ${error.message}`, 'error'); }
  }
  await loadMedia();
}

async function deleteMedia(id) {
  const item = state.media.find((value) => value.id === id);
  const okay = await confirmDialog({ title: 'Удалить изображение?', message: item.usage ? `Файл используется в ${item.usage} материалах. Удаление может оставить пустое место.` : 'Файл будет удалён безвозвратно.', confirmLabel: item.usage ? 'Удалить принудительно' : 'Удалить', danger: true });
  if (!okay) return;
  await api(`/admin/api/media/${id}${item.usage ? '?force=1' : ''}`, { method: 'DELETE' });
  toast('Изображение удалено'); await loadMedia();
}

async function chooseMedia() {
  if (!state.media.length) await loadMedia();
  return new Promise((resolve) => {
    openModal('Выберите изображение', state.media.length ? `<div class="media-picker">${state.media.map((item) => `<button type="button" data-media-choice="${escapeHtml(item.url)}"><img src="${escapeHtml(item.url)}" alt=""><span>${escapeHtml(item.title || item.originalName)}</span></button>`).join('')}</div>` : '<div class="entity-placeholder"><strong>Нет изображений</strong><p>Сначала загрузите файл в медиатеку.</p></div>');
    $$('[data-media-choice]', refs.modalBody).forEach((button) => button.addEventListener('click', () => { const value = button.dataset.mediaChoice; closeModal(); resolve(value); }));
    const observer = new MutationObserver(() => { if (!refs.modal.classList.contains('is-open')) { observer.disconnect(); resolve(''); } });
    observer.observe(refs.modal, { attributes: true, attributeFilter: ['class'] });
  });
}

async function loadLeads() {
  const payload = await api('/admin/api/leads');
  $('[data-leads-table]').innerHTML = payload.leads.length ? payload.leads.map((lead) => `<tr><td>${escapeHtml(formatDate(lead.createdAt))}</td><td><strong>${escapeHtml(lead.name || '')}</strong></td><td>${escapeHtml(lead.company || '—')}</td><td>${escapeHtml(lead.phone || '')}<br><small>${escapeHtml(lead.email || '')}</small></td><td>${escapeHtml(lead.goal || '—')}</td><td>${escapeHtml(lead.comment || '—')}</td></tr>`).join('') : '<tr><td colspan="6">Заявок пока нет.</td></tr>';
}

function renderSettingsForm(settings) {
  settings.contact ||= {}; settings.legal ||= {}; settings.headerButton ||= {}; settings.navigation ||= []; settings.footerColumns ||= [];
  refs.settingsForm.innerHTML = `<section class="settings-section"><h3>Бренд и тема</h3><div class="settings-grid"><label class="admin-field"><span>Название</span><input data-setting="brandName" value="${escapeHtml(settings.brandName)}"></label><label class="admin-field"><span>Акцент</span><input data-setting="brandAccent" value="${escapeHtml(settings.brandAccent)}"></label><label class="admin-field"><span>Тема по умолчанию</span><select data-setting="defaultTheme"><option value="dark" ${settings.defaultTheme !== 'light' ? 'selected' : ''}>Тёмная</option><option value="light" ${settings.defaultTheme === 'light' ? 'selected' : ''}>Светлая</option></select></label><label class="admin-field full"><span>Краткое описание сайта</span><input data-setting="tagline" value="${escapeHtml(settings.tagline || '')}"></label><label class="admin-field"><span>Кнопка в шапке</span><input data-setting="headerButton.label" value="${escapeHtml(settings.headerButton?.label)}"></label><label class="admin-field"><span>Цель формы</span><input data-setting="headerButton.goal" value="${escapeHtml(settings.headerButton?.goal)}"></label><label class="admin-field full"><span>Описание в подвале</span><textarea data-setting="footerDescription">${escapeHtml(settings.footerDescription)}</textarea></label></div></section>
    <section class="settings-section"><h3>Контакты на сайте</h3><p class="settings-hint">Заполненные значения из CMS имеют приоритет. Пустые поля используют безопасные значения из .env.</p><div class="settings-grid"><label class="admin-field"><span>Телефон</span><input data-setting="contact.phone" value="${escapeHtml(settings.contact.phone || '')}" placeholder="+7 999 000-00-00"></label><label class="admin-field"><span>Email</span><input data-setting="contact.email" value="${escapeHtml(settings.contact.email || '')}" placeholder="hello@example.ru"></label><label class="admin-field"><span>Telegram URL</span><input data-setting="contact.telegramUrl" value="${escapeHtml(settings.contact.telegramUrl || '')}" placeholder="https://t.me/..."></label><label class="admin-field"><span>Календарь / запись URL</span><input data-setting="contact.calendarUrl" value="${escapeHtml(settings.contact.calendarUrl || '')}" placeholder="https://..."></label><label class="admin-field full"><span>Срок ответа</span><input data-setting="contact.responseTime" value="${escapeHtml(settings.contact.responseTime || '')}"></label></div></section>
    <section class="settings-section"><h3>Публичные юридические данные</h3><div class="settings-grid"><label class="admin-field"><span>Юридическое лицо</span><input data-setting="legal.companyLegalName" value="${escapeHtml(settings.legal.companyLegalName || '')}"></label><label class="admin-field"><span>ИНН / УНП</span><input data-setting="legal.companyTaxId" value="${escapeHtml(settings.legal.companyTaxId || '')}"></label><label class="admin-field"><span>Регистрационный номер</span><input data-setting="legal.companyRegistrationId" value="${escapeHtml(settings.legal.companyRegistrationId || '')}"></label><label class="admin-field"><span>Email по персональным данным</span><input data-setting="legal.privacyEmail" value="${escapeHtml(settings.legal.privacyEmail || '')}"></label><label class="admin-field full"><span>Адрес</span><textarea data-setting="legal.companyAddress">${escapeHtml(settings.legal.companyAddress || '')}</textarea></label></div></section>
    <section class="settings-section"><div style="display:flex;justify-content:space-between;align-items:center"><h3>Главное меню</h3><button class="admin-button small secondary" type="button" data-add-nav>+ Пункт</button></div><div class="simple-list" data-nav-list>${(settings.navigation || []).map((item, index, list) => `<div class="simple-row" data-nav-index="${index}"><input data-nav-label value="${escapeHtml(item.label)}" placeholder="Название"><input data-nav-href value="${escapeHtml(item.href)}" placeholder="/route"><div class="simple-order-actions"><button class="icon-button" type="button" data-nav-up aria-label="Переместить вверх" title="Вверх" ${index === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" data-nav-down aria-label="Переместить вниз" title="Вниз" ${index === list.length - 1 ? 'disabled' : ''}>↓</button><button class="icon-button danger" type="button" data-nav-remove aria-label="Удалить пункт" title="Удалить">×</button></div></div>`).join('')}</div></section>
    <section class="settings-section"><div style="display:flex;justify-content:space-between;align-items:center"><h3>Колонки подвала</h3><button class="admin-button small secondary" type="button" data-add-footer-column>+ Колонка</button></div><div class="simple-list" data-footer-columns>${(settings.footerColumns || []).map((column, columnIndex, columns) => `<div class="footer-column-editor" data-footer-column="${columnIndex}"><div class="simple-row simple-row-title"><input data-footer-title value="${escapeHtml(column.title)}" placeholder="Название колонки"><div class="simple-order-actions"><button class="icon-button" type="button" data-footer-column-up aria-label="Переместить колонку вверх" title="Вверх" ${columnIndex === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" data-footer-column-down aria-label="Переместить колонку вниз" title="Вниз" ${columnIndex === columns.length - 1 ? 'disabled' : ''}>↓</button><button class="icon-button danger" type="button" data-footer-column-remove aria-label="Удалить колонку" title="Удалить">×</button></div></div><div class="simple-list" style="margin-top:10px" data-footer-links>${(column.links || []).map((link, linkIndex, links) => `<div class="simple-row" data-footer-link="${linkIndex}"><input data-footer-link-label value="${escapeHtml(link.label)}" placeholder="Название"><input data-footer-link-href value="${escapeHtml(link.href)}" placeholder="/route"><div class="simple-order-actions"><button class="icon-button" type="button" data-footer-link-up aria-label="Переместить ссылку вверх" title="Вверх" ${linkIndex === 0 ? 'disabled' : ''}>↑</button><button class="icon-button" type="button" data-footer-link-down aria-label="Переместить ссылку вниз" title="Вниз" ${linkIndex === links.length - 1 ? 'disabled' : ''}>↓</button><button class="icon-button danger" type="button" data-footer-link-remove aria-label="Удалить ссылку" title="Удалить">×</button></div></div>`).join('')}</div><button class="admin-button small secondary" style="margin-top:10px" type="button" data-footer-link-add>+ Ссылка</button></div>`).join('')}</div></section>`;
  bindSettingsForm();
}

function moveItem(list, index, direction) {
  const target = index + direction;
  if (!Array.isArray(list) || index < 0 || index >= list.length || target < 0 || target >= list.length) return false;
  [list[index], list[target]] = [list[target], list[index]];
  return true;
}

function setNested(object, path, value) {
  const parts = path.split('.'); const last = parts.pop(); let cursor = object; for (const part of parts) cursor = cursor[part] ||= {}; cursor[last] = value;
}

function bindSettingsForm() {
  $$('[data-setting]', refs.settingsForm).forEach((input) => { const update = () => { setNested(state.settings, input.dataset.setting, input.value); markDirty(); }; input.addEventListener('input', update); input.addEventListener('change', update); });
  $$('[data-nav-index]', refs.settingsForm).forEach((row) => {
    const index = Number(row.dataset.navIndex);
    $('[data-nav-label]', row).addEventListener('input', (event) => { state.settings.navigation[index].label = event.target.value; markDirty(); });
    $('[data-nav-href]', row).addEventListener('input', (event) => { state.settings.navigation[index].href = event.target.value; markDirty(); });
    $('[data-nav-up]', row).addEventListener('click', () => { if (moveItem(state.settings.navigation, index, -1)) { markDirty(); renderSettingsForm(state.settings); } });
    $('[data-nav-down]', row).addEventListener('click', () => { if (moveItem(state.settings.navigation, index, 1)) { markDirty(); renderSettingsForm(state.settings); } });
    $('[data-nav-remove]', row).addEventListener('click', () => { state.settings.navigation.splice(index, 1); markDirty(); renderSettingsForm(state.settings); });
  });
  $('[data-add-nav]', refs.settingsForm).addEventListener('click', () => { state.settings.navigation.push({ label: 'Новый пункт', href: '/' }); markDirty(); renderSettingsForm(state.settings); });
  $$('[data-footer-column]', refs.settingsForm).forEach((columnNode) => {
    const columnIndex = Number(columnNode.dataset.footerColumn);
    $('[data-footer-title]', columnNode).addEventListener('input', (event) => { state.settings.footerColumns[columnIndex].title = event.target.value; markDirty(); });
    $('[data-footer-column-up]', columnNode).addEventListener('click', () => { if (moveItem(state.settings.footerColumns, columnIndex, -1)) { markDirty(); renderSettingsForm(state.settings); } });
    $('[data-footer-column-down]', columnNode).addEventListener('click', () => { if (moveItem(state.settings.footerColumns, columnIndex, 1)) { markDirty(); renderSettingsForm(state.settings); } });
    $('[data-footer-column-remove]', columnNode).addEventListener('click', () => { state.settings.footerColumns.splice(columnIndex, 1); markDirty(); renderSettingsForm(state.settings); });
    $$('[data-footer-link]', columnNode).forEach((linkNode) => {
      const linkIndex = Number(linkNode.dataset.footerLink);
      $('[data-footer-link-label]', linkNode).addEventListener('input', (event) => { state.settings.footerColumns[columnIndex].links[linkIndex].label = event.target.value; markDirty(); });
      $('[data-footer-link-href]', linkNode).addEventListener('input', (event) => { state.settings.footerColumns[columnIndex].links[linkIndex].href = event.target.value; markDirty(); });
      $('[data-footer-link-up]', linkNode).addEventListener('click', () => { if (moveItem(state.settings.footerColumns[columnIndex].links, linkIndex, -1)) { markDirty(); renderSettingsForm(state.settings); } });
      $('[data-footer-link-down]', linkNode).addEventListener('click', () => { if (moveItem(state.settings.footerColumns[columnIndex].links, linkIndex, 1)) { markDirty(); renderSettingsForm(state.settings); } });
      $('[data-footer-link-remove]', linkNode).addEventListener('click', () => { state.settings.footerColumns[columnIndex].links.splice(linkIndex, 1); markDirty(); renderSettingsForm(state.settings); });
    });
    $('[data-footer-link-add]', columnNode).addEventListener('click', () => { state.settings.footerColumns[columnIndex].links.push({ label: 'Новая ссылка', href: '/' }); markDirty(); renderSettingsForm(state.settings); });
  });
  $('[data-add-footer-column]', refs.settingsForm).addEventListener('click', () => { state.settings.footerColumns.push({ title: 'Новая колонка', links: [] }); markDirty(); renderSettingsForm(state.settings); });
}

async function loadSettings() {
  const payload = await api('/admin/api/settings');
  state.settings = structuredClone(payload.draft || {});
  renderSettingsForm(state.settings);
  state.dirty = false;
}

async function saveSettings() {
  setSaving('Сохранение…', 'is-saving');
  const payload = await api('/admin/api/settings', { method: 'PATCH', body: state.settings });
  state.settings = structuredClone(payload.settings);
  markClean(); toast('Настройки сохранены в черновик');
}

async function publishSettings() {
  if (state.dirty) await saveSettings();
  const okay = await confirmDialog({ title: 'Опубликовать настройки?', message: 'Меню, бренд и подвал обновятся на всех страницах сайта.', confirmLabel: 'Опубликовать' });
  if (!okay) return;
  await api('/admin/api/settings/publish', { method: 'POST', body: {} });
  toast('Настройки опубликованы');
}

async function loadAudit() {
  const payload = await api('/admin/api/audit');
  renderAudit(payload.audit, $('[data-audit-list]'));
}

async function createBackup() {
  const payload = await api('/admin/api/backup', { method: 'POST', body: {} });
  toast(`Резервная копия создана: ${payload.file}`);
}

function bindGlobalEvents() {
  refs.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    refs.loginMessage.textContent = '';
    const data = new FormData(refs.loginForm);
    try {
      const payload = await api('/admin/api/login', { method: 'POST', body: { username: data.get('username'), password: data.get('password') } });
      state.user = payload.user; state.csrf = payload.csrfToken; showApp(); await loadInitialData();
    } catch (error) { refs.loginMessage.textContent = error.message; }
  });
  $$('.admin-nav [data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
  $$('[data-modal-close]').forEach((button) => button.addEventListener('click', closeModal));
  $('[data-sidebar-open]').addEventListener('click', () => $('[data-sidebar]').classList.add('is-open'));
  $('[data-sidebar-close]').addEventListener('click', () => $('[data-sidebar]').classList.remove('is-open'));
  $('[data-logout]').addEventListener('click', async () => { await api('/admin/api/logout', { method: 'POST', body: {} }); state.user = null; state.csrf = ''; showAuth(false); });
  $('[data-create-page]').addEventListener('click', createPageDialog);
  $('[data-create-content]').addEventListener('click', createContentDialog);
  $('[data-content-kind]').addEventListener('change', () => loadContent());
  $('[data-media-input]').addEventListener('change', (event) => { uploadMedia([...event.target.files]); event.target.value = ''; });
  $('[data-refresh-leads]').addEventListener('click', loadLeads);
  $('[data-save-settings]').addEventListener('click', saveSettings);
  $('[data-publish-settings]').addEventListener('click', publishSettings);
  $('[data-refresh-audit]').addEventListener('click', loadAudit);
  $$('[data-backup]').forEach((button) => button.addEventListener('click', createBackup));
  window.addEventListener('beforeunload', (event) => { if (!state.dirty) return; event.preventDefault(); event.returnValue = ''; });
}

async function loadInitialData() {
  const blocks = await api('/admin/api/block-types');
  state.blockTypes = blocks.blockTypes;
  state.blockMap = new Map(state.blockTypes.map((definition) => [definition.type, definition]));
  await switchView('dashboard');
}

async function init() {
  bindGlobalEvents();
  try {
    const session = await api('/admin/api/session');
    if (!session.authenticated) return showAuth(session.setupRequired);
    state.user = session.user; state.csrf = session.csrfToken; showApp(); await loadInitialData();
  } catch (error) {
    refs.loading.hidden = true;
    showAuth(false);
    refs.loginMessage.textContent = `Не удалось открыть CMS: ${error.message}`;
  }
}

init();
