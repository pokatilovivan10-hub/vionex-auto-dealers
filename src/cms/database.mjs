import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BLOCK_DEFINITIONS, sanitizeDocument } from './block-definitions.mjs';
import { seedContentItems, seedPages, seedSettings } from './seed.mjs';

function nowIso() {
  return new Date().toISOString();
}

function parseJson(value, fallback = null) {
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function stringify(value) {
  return JSON.stringify(value ?? null);
}

function normalizeRoute(value) {
  let route = String(value || '/').trim();
  if (!route.startsWith('/')) route = `/${route}`;
  route = route.replace(/\/+/g, '/');
  if (route.length > 1) route = route.replace(/\/+$/, '');
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(route)) throw new Error('Адрес страницы содержит недопустимые символы.');
  return route;
}

function normalizeSlug(value) {
  const slug = String(value || '').trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-');
  if (!slug) throw new Error('Slug не заполнен.');
  return slug.slice(0, 120);
}

function mapPage(row) {
  if (!row) return null;
  return {
    id: row.id,
    route: row.route,
    title: row.title,
    pageType: row.page_type,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    status: row.status,
    draft: parseJson(row.draft_json, { schemaVersion: 1, blocks: [] }),
    published: parseJson(row.published_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

function mapContent(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    cover: row.cover,
    tags: parseJson(row.tags_json, []),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    status: row.status,
    draft: parseJson(row.draft_json, { schemaVersion: 1, blocks: [] }),
    published: parseJson(row.published_json, null),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    publishedAt: row.published_at,
  };
}

function mapMedia(row) {
  if (!row) return null;
  return {
    id: row.id,
    originalName: row.original_name,
    storedName: row.stored_name,
    url: `/uploads/${row.stored_name}`,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    title: row.title || '',
    altText: row.alt_text || '',
    createdAt: row.created_at,
  };
}

export class CmsDatabase {
  constructor(dataDir, databasePath = '') {
    this.dataDir = dataDir;
    const configuredPath = String(databasePath || '').trim();
    this.filePath = configuredPath
      ? (path.isAbsolute(configuredPath) ? configuredPath : path.resolve(dataDir, configuredPath))
      : path.join(dataDir, 'cms.sqlite');
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o750 });
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true, mode: 0o750 });
    fs.mkdirSync(path.join(dataDir, 'uploads'), { recursive: true, mode: 0o750 });
    fs.mkdirSync(path.join(dataDir, 'backups'), { recursive: true, mode: 0o750 });
    this.db = new DatabaseSync(this.filePath, {
      timeout: 5000,
      enableForeignKeyConstraints: true,
      allowExtension: false,
      readBigInts: false,
    });
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA busy_timeout = 5000;
      PRAGMA temp_store = MEMORY;
    `);
    this.initializeSchema();
    this.seedIfEmpty();
    this.runMigrations();
  }

  initializeSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cms_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cms_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'owner',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_login_at TEXT
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cms_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token_hash TEXT NOT NULL UNIQUE,
        user_id INTEGER NOT NULL REFERENCES cms_users(id) ON DELETE CASCADE,
        csrf_token TEXT NOT NULL,
        ip_hash TEXT NOT NULL,
        user_agent TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS cms_sessions_expires_idx ON cms_sessions(expires_at);

      CREATE TABLE IF NOT EXISTS cms_pages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        route TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        page_type TEXT NOT NULL DEFAULT 'page',
        seo_title TEXT NOT NULL DEFAULT '',
        seo_description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        draft_json TEXT NOT NULL,
        published_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cms_content_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        kind TEXT NOT NULL CHECK(kind IN ('service','case','post')),
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        excerpt TEXT NOT NULL DEFAULT '',
        cover TEXT NOT NULL DEFAULT '',
        tags_json TEXT NOT NULL DEFAULT '[]',
        seo_title TEXT NOT NULL DEFAULT '',
        seo_description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        draft_json TEXT NOT NULL,
        published_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT,
        UNIQUE(kind, slug)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS cms_content_kind_status_idx ON cms_content_items(kind, status, published_at);

      CREATE TABLE IF NOT EXISTS cms_revisions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT NOT NULL CHECK(entity_type IN ('page','content','settings')),
        entity_id TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        note TEXT NOT NULL DEFAULT '',
        created_by INTEGER REFERENCES cms_users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS cms_revisions_entity_idx ON cms_revisions(entity_type, entity_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS cms_media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_name TEXT NOT NULL,
        stored_name TEXT NOT NULL UNIQUE,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        alt_text TEXT NOT NULL DEFAULT '',
        created_by INTEGER REFERENCES cms_users(id) ON DELETE SET NULL,
        created_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cms_settings (
        key TEXT PRIMARY KEY,
        draft_json TEXT NOT NULL,
        published_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS cms_audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES cms_users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL DEFAULT '',
        details_json TEXT NOT NULL DEFAULT '{}',
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS cms_audit_created_idx ON cms_audit_log(created_at DESC);
    `);
    this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING').run('schema_version', '1');
  }

  schemaVersion() {
    const row = this.db.prepare('SELECT value FROM cms_meta WHERE key = ?').get('schema_version');
    const version = Number(row?.value || 1);
    return Number.isInteger(version) && version > 0 ? version : 1;
  }

  setSchemaVersion(version) {
    this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('schema_version', String(version));
  }

  migrateHomepageShowcase() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_pages WHERE route = ?').get('/');
    if (!row) return;

    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      const block = document.blocks.find((item) => item?.type === 'capabilities');
      if (!block) return { raw, changed: false };

      let changed = false;
      if (block.variant !== 'homepage-showcase') {
        block.variant = 'homepage-showcase';
        changed = true;
      }
      block.data ||= {};
      const isLegacyHeading = block.data.title === 'Создаём систему, которая' && block.data.accent === 'двигает бизнес вперёд';
      if (isLegacyHeading) {
        block.data.kicker = '';
        block.data.title = 'Наши возможности';
        block.data.accent = '';
        changed = true;
      }

      const legacyIntro = 'Полный цикл лидогенерации: стратегия, данные, коммуникации, квалификация, CRM и улучшение результата.';
      if (block.data.intro === legacyIntro) {
        block.data.intro = 'Полный цикл лидогенерации с использованием AI-агентов и экспертизы.';
        changed = true;
      }

      const approvedCards = [
        {
          legacyTitle: 'Стратегия и ICP',
          legacyText: 'Изучаем продукт, рынок и воронку. Определяем профиль клиента и точки роста.',
          title: 'Стратегия и ICP',
          text: 'Изучаем ваш бизнес, продукт и воронку. Определяем идеальный профиль клиента и точки роста.',
        },
        {
          legacyTitle: 'Поиск ЛПР',
          legacyText: 'Собираем, обогащаем и проверяем контакты лиц, принимающих решения.',
          title: 'Поиск ЛПР',
          text: 'AI-агенты собирают базы лиц, принимающих решения, по вашим критериям.',
        },
        {
          legacyTitle: 'Контакт-центр',
          legacyText: 'Создаём персонализированные касания и развиваем диалог.',
          title: 'Контакт-центр',
          text: 'Автоматизированные касания по e-mail, LinkedIn, мессенджерам и телефону.',
        },
        {
          legacyTitle: 'Квалификация',
          legacyText: 'Уточняем задачу, роль, сроки и следующий шаг.',
          title: 'Квалификация лидов',
          text: 'AI квалифицирует потребность и бюджет, назначает встречу или консультацию.',
        },
        {
          legacyTitle: 'CRM-интеграция',
          legacyText: 'Передаём карточку лида, контекст, историю и задачу ответственному.',
          title: 'CRM-интеграция',
          text: 'Передаём только тёплых лидов в вашу CRM с полной историей взаимодействий.',
        },
        {
          legacyTitle: 'Аналитика',
          legacyText: 'Сопоставляем данные CRM с качеством диалогов и улучшаем процесс.',
          title: 'Аналитика и оптимизация',
          text: 'Анализируем результаты и постоянно улучшаем кампании и конверсию.',
        },
      ];
      if (Array.isArray(block.data.items)) {
        block.data.items.forEach((item, index) => {
          const approved = approvedCards[index];
          if (!item || !approved) return;
          if (item.title === approved.legacyTitle && item.text === approved.legacyText) {
            item.title = approved.title;
            item.text = approved.text;
            changed = true;
          }
        });
      }
      return { raw: changed ? stringify(sanitizeDocument(document)) : raw, changed };
    };

    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (!draft.changed && !published.changed) return;

    this.db.prepare('UPDATE cms_pages SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
      .run(draft.raw, published.raw, nowIso(), row.id);
  }

  migratePremiumCasesCarousel() {
    const now = nowIso();
    const pageRow = this.db.prepare('SELECT id, draft_json, published_json FROM cms_pages WHERE route = ?').get('/');
    if (pageRow) {
      const migrateDocument = (raw) => {
        if (!raw) return { raw, changed: false };
        const document = parseJson(raw, null);
        if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
        const block = document.blocks.find((item) => item?.type === 'cases-slider');
        if (!block) return { raw, changed: false };
        block.data ||= {};
        let changed = false;

        if (block.variant !== 'premium-carousel') {
          block.variant = 'premium-carousel';
          changed = true;
        }
        const legacyHeading = block.data.kicker === 'Реализованные проекты'
          && block.data.title === 'Проекты, которые приносят'
          && block.data.accent === 'бизнесу результат';
        if (legacyHeading) {
          block.data.kicker = 'Кейсы';
          block.data.title = 'Реализованные проекты';
          block.data.accent = '';
          changed = true;
        }
        const legacyIntro = 'Показываем логику проекта, использованные механики и подтверждённые результаты.';
        if (block.data.intro === legacyIntro) {
          block.data.intro = 'Показываем архитектуру проекта, механику квалификации и то, как результат передаётся в отдел продаж.';
          changed = true;
        }
        if (typeof block.data.autoplay !== 'boolean') {
          block.data.autoplay = true;
          changed = true;
        }
        if (!Number.isFinite(Number(block.data.autoplayDelay))) {
          block.data.autoplayDelay = 6500;
          changed = true;
        }
        if (!Number.isFinite(Number(block.data.limit)) || Number(block.data.limit) < 5) {
          block.data.limit = 6;
          changed = true;
        }
        return { raw: changed ? stringify(sanitizeDocument(document)) : raw, changed };
      };

      const draft = migrateDocument(pageRow.draft_json);
      const published = migrateDocument(pageRow.published_json);
      if (draft.changed || published.changed) {
        this.db.prepare('UPDATE cms_pages SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
          .run(draft.raw, published.raw, now, pageRow.id);
      }
    }

    const modularRow = this.db.prepare('SELECT id, tags_json, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('case', 'modular-buildings');
    if (modularRow) {
      const legacyValues = ['ЛПР', 'SQL', 'CRM', 'ROMI'];
      const approvedItems = [
        { value: '4', label: 'сегмента ICP' },
        { value: '7', label: 'этапов контроля' },
        { value: '1 CRM', label: 'единый контур передачи' },
        { value: 'Human QA', label: 'контроль критических решений' },
      ];
      const migrateCaseDocument = (raw) => {
        if (!raw) return { raw, changed: false };
        const document = parseJson(raw, null);
        const stats = document?.blocks?.find((item) => item?.type === 'stats');
        if (!stats || !Array.isArray(stats.data?.items)) return { raw, changed: false };
        const values = stats.data.items.slice(0, 4).map((item) => String(item?.value || ''));
        if (values.join('|') !== legacyValues.join('|')) return { raw, changed: false };
        stats.data.kicker = 'Архитектура сценария';
        stats.data.title = 'Что контролируется в проекте';
        stats.data.intro = 'Показатели описывают структуру процесса, а не заявленный коммерческий результат.';
        stats.data.items = approvedItems;
        return { raw: stringify(sanitizeDocument(document)), changed: true };
      };
      const draft = migrateCaseDocument(modularRow.draft_json);
      const published = migrateCaseDocument(modularRow.published_json);
      const tags = parseJson(modularRow.tags_json, []);
      const legacyTags = Array.isArray(tags) && tags.join('|') === ['Производство', 'Строительство', 'B2B'].join('|');
      if (draft.changed || published.changed || legacyTags) {
        this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, tags_json = ?, updated_at = ? WHERE id = ?')
          .run(draft.raw, published.raw, legacyTags ? stringify(['Типовой сценарий', 'Строительство', 'B2B']) : modularRow.tags_json, now, modularRow.id);
      }
    }

    let currentCount = Number(this.db.prepare("SELECT COUNT(*) AS count FROM cms_content_items WHERE kind = 'case' AND published_json IS NOT NULL").get()?.count || 0);
    if (currentCount >= 5) return;
    const candidates = seedContentItems().filter((item) => item.kind === 'case' && item.slug !== 'modular-buildings');
    const insertContent = this.db.prepare(`
      INSERT INTO cms_content_items(kind, slug, title, excerpt, cover, tags_json, seo_title, seo_description, status, draft_json, published_json, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)
    `);
    for (const item of candidates) {
      if (currentCount >= 5) break;
      const slug = normalizeSlug(item.slug);
      const exists = this.db.prepare('SELECT id FROM cms_content_items WHERE kind = ? AND slug = ?').get('case', slug);
      if (exists) continue;
      const safe = sanitizeDocument(item.document);
      const json = stringify(safe);
      const publishedAt = item.publishedAt || now;
      insertContent.run('case', slug, item.title, item.excerpt || '', item.cover || '', stringify(item.tags || []), item.seoTitle || item.title, item.seoDescription || item.excerpt || '', json, json, now, now, publishedAt);
      currentCount += 1;
    }
  }

  migrateCaseShowcaseV34() {
    const now = nowIso();
    const pageRow = this.db.prepare('SELECT id, draft_json, published_json FROM cms_pages WHERE route = ?').get('/');
    if (pageRow) {
      const migrateDocument = (raw) => {
        if (!raw) return { raw, changed: false };
        const document = parseJson(raw, null);
        if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
        const block = document.blocks.find((item) => item?.type === 'cases-slider');
        if (!block) return { raw, changed: false };
        block.data ||= {};
        let changed = false;
        if (block.variant === 'premium-carousel' || !block.variant) {
          block.variant = 'premium-3d-carousel';
          changed = true;
        }
        const defaultIntros = new Set([
          'Показываем архитектуру проекта, механику квалификации и то, как результат передаётся в отдел продаж.',
          'Показываем логику проекта, использованные механики и подтверждённые результаты.',
        ]);
        if (defaultIntros.has(String(block.data.intro || ''))) {
          block.data.intro = '';
          changed = true;
        }
        if (!block.data.allLabel) { block.data.allLabel = 'Смотреть все проекты'; changed = true; }
        if (!block.data.allHref) { block.data.allHref = '/cases'; changed = true; }
        if (!Number.isFinite(Number(block.data.limit)) || Number(block.data.limit) < 8) {
          block.data.limit = 8;
          changed = true;
        }
        return { raw: changed ? stringify(sanitizeDocument(document)) : raw, changed };
      };
      const draft = migrateDocument(pageRow.draft_json);
      const published = migrateDocument(pageRow.published_json);
      if (draft.changed || published.changed) {
        this.db.prepare('UPDATE cms_pages SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
          .run(draft.raw, published.raw, now, pageRow.id);
      }
    }

    const legacyCoverMap = new Map([
      ['auto-new-cars', ['/assets/img/case-showcase/auto-new.webp', '/assets/img/cases3d/dealer-new.webp']],
      ['auto-used-cars', ['/assets/img/case-showcase/auto-used.webp', '/assets/img/cases3d/dealer-new-used.webp']],
      ['equipment-leasing', ['/assets/img/case-showcase/equipment-leasing.webp', '/assets/img/cases3d/equipment-leasing.webp']],
      ['modular-buildings', ['/assets/img/visual/case-building.webp', '/assets/img/cases/modular-buildings.svg', '/assets/img/case-showcase/modular-buildings.webp', '/assets/img/cases3d/modular-buildings.webp']],
      ['industrial-equipment', ['/assets/img/visual/case-industrial.webp', '/assets/img/cases/industrial-equipment.svg', '/assets/img/case-showcase/industrial-equipment.webp', '/assets/img/cases3d/industrial-equipment.webp']],
      ['cloud-infrastructure', ['/assets/img/visual/case-cloudware.webp', '/assets/img/cases/it-integrator.svg', '/assets/img/case-showcase/cloud-infrastructure.webp', '/assets/img/cases3d/cloud-infrastructure.webp']],
      ['logistics-company', ['/assets/img/visual/article-logistics.webp', '/assets/img/cases/logistics.svg', '/assets/img/case-showcase/logistics-company.webp', '/assets/img/cases3d/logistics.webp']],
      ['fintech-platform', ['/assets/img/visual/case-fintech.webp', '/assets/img/cases/fintech.svg', '/assets/img/case-showcase/fintech-platform.webp', '/assets/img/cases3d/fintech.webp']],
    ]);
    const targetCover = {
      'auto-new-cars': '/assets/img/cases3d/dealer-new.webp',
      'auto-used-cars': '/assets/img/cases3d/dealer-new-used.webp',
      'equipment-leasing': '/assets/img/cases3d/equipment-leasing.webp',
      'modular-buildings': '/assets/img/cases3d/modular-buildings.webp',
      'industrial-equipment': '/assets/img/cases3d/industrial-equipment.webp',
      'cloud-infrastructure': '/assets/img/cases3d/cloud-infrastructure.webp',
      'logistics-company': '/assets/img/cases3d/logistics.webp',
      'fintech-platform': '/assets/img/cases3d/fintech.webp',
    };
    for (const [slug, legacyValues] of legacyCoverMap.entries()) {
      const row = this.db.prepare('SELECT id, cover, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('case', slug);
      if (!row) continue;
      const target = targetCover[slug];
      const shouldUpdateCover = legacyValues.includes(row.cover) && row.cover !== target;
      const replaceDocument = (raw) => {
        if (!raw) return { raw, changed: false };
        let next = raw;
        for (const legacy of legacyValues) next = next.replaceAll(legacy, target);
        return { raw: next, changed: next !== raw };
      };
      const draft = replaceDocument(row.draft_json);
      const published = replaceDocument(row.published_json);
      if (shouldUpdateCover || draft.changed || published.changed) {
        this.db.prepare('UPDATE cms_content_items SET cover = ?, draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
          .run(shouldUpdateCover ? target : row.cover, draft.raw, published.raw, now, row.id);
      }
    }

    const requiredSlugs = new Set(['auto-new-cars', 'auto-used-cars', 'equipment-leasing', 'modular-buildings', 'industrial-equipment', 'cloud-infrastructure', 'logistics-company', 'fintech-platform']);
    const candidates = seedContentItems().filter((item) => item.kind === 'case' && requiredSlugs.has(item.slug));
    const insertContent = this.db.prepare(`
      INSERT INTO cms_content_items(kind, slug, title, excerpt, cover, tags_json, seo_title, seo_description, status, draft_json, published_json, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)
    `);
    for (const item of candidates) {
      const slug = normalizeSlug(item.slug);
      if (this.db.prepare('SELECT id FROM cms_content_items WHERE kind = ? AND slug = ?').get('case', slug)) continue;
      const safe = sanitizeDocument(item.document);
      const json = stringify(safe);
      insertContent.run('case', slug, item.title, item.excerpt || '', item.cover || '', stringify(item.tags || []), item.seoTitle || item.title, item.seoDescription || item.excerpt || '', json, json, now, now, item.publishedAt || now);
    }
  }

  migrateIntegratedCasesAndPricingV35() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_pages WHERE route = ?').get('/');
    if (!row) return;
    const now = nowIso();
    const approvedPricing = structuredClone(BLOCK_DEFINITIONS.pricing.defaults);
    const legacyPlans = [
      { name: 'Старт', monthly: 'от 120 000 ₽', quarterly: 'по расчёту', caption: 'Пилот и проверка гипотезы', popular: false, button: 'Обсудить старт' },
      { name: 'Рост', monthly: 'от 220 000 ₽', quarterly: 'по расчёту', caption: 'Системный поток квалифицированных диалогов', popular: true, button: 'Обсудить рост' },
      { name: 'Масштаб', monthly: 'от 350 000 ₽', quarterly: 'по расчёту', caption: 'Несколько сегментов и глубокая CRM-автоматизация', popular: false, button: 'Обсудить масштаб' },
    ];
    const legacyFeatures = [
      { label: 'Исследование рынка и ICP', start: '✓', growth: '✓', scale: '✓' },
      { label: 'Сбор и обогащение базы ЛПР', start: '✓', growth: '✓', scale: '✓' },
      { label: 'Персонализированные касания', start: 'Базово', growth: 'Расширенно', scale: 'Несколько сегментов' },
      { label: 'Квалификация и передача в CRM', start: '✓', growth: '✓', scale: '✓' },
      { label: 'Аналитика и оптимизация', start: 'Отчёт', growth: 'Регулярно', scale: 'Расширенно' },
    ];
    const sameJson = (left, right) => stringify(left) === stringify(right);

    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      let changed = false;

      const cases = document.blocks.find((item) => item?.type === 'cases-slider');
      if (cases && cases.variant !== 'integrated-carousel-v35') {
        cases.variant = 'integrated-carousel-v35';
        changed = true;
      }

      const pricing = document.blocks.find((item) => item?.type === 'pricing');
      if (pricing) {
        pricing.data ||= {};
        if (pricing.variant !== 'formats-v35') {
          pricing.variant = 'formats-v35';
          changed = true;
        }
        if (pricing.data.title === 'Выберите модель под задачу и зрелость отдела продаж') {
          pricing.data.title = approvedPricing.title;
          changed = true;
        }
        if (pricing.data.intro === 'Финальный состав и стоимость фиксируются после диагностики продукта, рынка и воронки.') {
          pricing.data.intro = approvedPricing.intro;
          changed = true;
        }
        if (pricing.data.periodMonthly === 'Ежемесячно' && pricing.data.periodQuarterly === 'Ежеквартально') {
          pricing.data.periodMonthly = approvedPricing.periodMonthly;
          pricing.data.periodQuarterly = approvedPricing.periodQuarterly;
          changed = true;
        }
        if (sameJson(pricing.data.plans, legacyPlans)) {
          pricing.data.plans = structuredClone(approvedPricing.plans);
          changed = true;
        }
        if (sameJson(pricing.data.features, legacyFeatures)) {
          pricing.data.features = structuredClone(approvedPricing.features);
          changed = true;
        }
      }

      return { raw: changed ? stringify(sanitizeDocument(document)) : raw, changed };
    };

    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_pages SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, now, row.id);
    }
  }

  migrateCompactTrustStackV36() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_pages WHERE route = ?').get('/');
    if (!row) return;
    const now = nowIso();
    const approvedIntegrations = structuredClone(BLOCK_DEFINITIONS.integrations.defaults);
    const approvedFaq = structuredClone(BLOCK_DEFINITIONS.faq.defaults);
    const approvedCta = structuredClone(BLOCK_DEFINITIONS.cta.defaults);
    const oldFaqItems = [
      { question: 'Что считается тёплым лидом?', answer: 'Определение фиксируется до запуска: релевантная компания и роль, подтверждённая задача или интерес, согласие на следующий шаг и контекст для менеджера.' },
      { question: 'Вы гарантируете количество продаж?', answer: 'Нет. Продажа зависит от продукта, цены, репутации и работы отдела продаж. Мы фиксируем операционные KPI и критерии качества передаваемого потока.' },
      { question: 'Можно ли подключить нашу CRM?', answer: 'Да, если доступны необходимые права и API. Сначала согласуем поля, этапы, ответственных и сценарии ошибок.' },
    ];
    const logoMap = new Map(approvedIntegrations.items.map((item) => [String(item.name).toLowerCase(), item.logo]));
    const sameJson = (left, right) => stringify(left) === stringify(right);

    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      let changed = false;

      const integrations = document.blocks.find((item) => item?.type === 'integrations');
      if (integrations) {
        integrations.data ||= {};
        if (integrations.variant !== 'compact-v36') { integrations.variant = 'compact-v36'; changed = true; }
        if (integrations.data.title === 'Встраиваемся в вашу CRM и бизнес-процессы') { integrations.data.title = approvedIntegrations.title; changed = true; }
        if (integrations.data.text === 'Согласуем поля, этапы, ответственных и обработку ошибок. Изменения в боевой CRM выполняются только после подтверждения.') { integrations.data.text = approvedIntegrations.text; changed = true; }
        if (integrations.data.note === 'Фактический способ подключения зависит от API, прав доступа и тарифа выбранной системы.') { integrations.data.note = approvedIntegrations.note; changed = true; }
        if (!Array.isArray(integrations.data.benefits) || integrations.data.benefits.length === 0) { integrations.data.benefits = structuredClone(approvedIntegrations.benefits); changed = true; }
        if (Array.isArray(integrations.data.items)) {
          integrations.data.items = integrations.data.items.map((item) => {
            if (item.logo) return item;
            const logo = logoMap.get(String(item.name || '').toLowerCase());
            if (!logo) return item;
            changed = true;
            return { ...item, logo };
          });
        }
      }

      const agents = document.blocks.find((item) => item?.type === 'agents');
      if (agents && agents.variant !== 'compact-v36') { agents.variant = 'compact-v36'; changed = true; }

      const faq = document.blocks.find((item) => item?.type === 'faq');
      if (faq) {
        faq.data ||= {};
        if (faq.variant !== 'compact-v36') { faq.variant = 'compact-v36'; changed = true; }
        if (faq.data.title === 'Что важно знать до старта') { faq.data.title = approvedFaq.title; changed = true; }
        if (faq.data.kicker === 'Вопросы') { faq.data.kicker = ''; changed = true; }
        if (faq.data.intro === 'Фиксируем зоны ответственности, критерии квалификации и правила передачи до запуска.') { faq.data.intro = ''; changed = true; }
        if (sameJson(faq.data.items, oldFaqItems)) { faq.data.items = structuredClone(approvedFaq.items); changed = true; }
      }

      const cta = document.blocks.find((item) => item?.type === 'cta');
      if (cta) {
        cta.data ||= {};
        if (cta.variant !== 'contact-v36') { cta.variant = 'contact-v36'; changed = true; }
        if (cta.data.title === 'Нужен стабильный поток подготовленных B2B-клиентов?') { cta.data.title = approvedCta.title; changed = true; }
        if (cta.data.text === 'Начнём с короткой диагностики продукта, рынка, среднего чека, цикла сделки и текущей CRM.') { cta.data.text = approvedCta.text; changed = true; }
        if (cta.data.buttonLabel === 'Обсудить проект') { cta.data.buttonLabel = approvedCta.buttonLabel; changed = true; }
        if (!cta.data.responseText) { cta.data.responseText = approvedCta.responseText; changed = true; }
        if (!Array.isArray(cta.data.messengers) || cta.data.messengers.length === 0) { cta.data.messengers = structuredClone(approvedCta.messengers); changed = true; }
      }

      return { raw: changed ? stringify(sanitizeDocument(document)) : raw, changed };
    };

    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_pages SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, now, row.id);
    }
  }

  migrateAutoDealersLandingV37() {
    const now = nowIso();
    const wanted = new Set(['auto-dealers', 'auto-commercial-vehicles', 'auto-motorcycles', 'auto-service']);
    const items = seedContentItems().filter((item) => wanted.has(item.slug));
    const insertContent = this.db.prepare(`
      INSERT INTO cms_content_items(kind, slug, title, excerpt, cover, tags_json, seo_title, seo_description, status, draft_json, published_json, created_at, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)
    `);
    for (const item of items) {
      const slug = normalizeSlug(item.slug);
      const exists = this.db.prepare('SELECT id FROM cms_content_items WHERE kind = ? AND slug = ?').get(item.kind, slug);
      if (exists) continue;
      const safe = sanitizeDocument(item.document);
      const json = stringify(safe);
      insertContent.run(item.kind, slug, item.title, item.excerpt || '', item.cover || '', stringify(item.tags || []), item.seoTitle || item.title, item.seoDescription || item.excerpt || '', json, json, now, now, item.publishedAt || now);
    }

    const settingsRow = this.db.prepare('SELECT draft_json, published_json FROM cms_settings WHERE key = ?').get('site');
    if (!settingsRow) return;
    const appendLink = (raw) => {
      const settings = parseJson(raw, {});
      if (!settings || typeof settings !== 'object') return raw;
      const columns = Array.isArray(settings.footerColumns) ? settings.footerColumns : [];
      let services = columns.find((column) => String(column?.title || '').toLowerCase() === 'услуги');
      if (!services) {
        services = { title: 'Услуги', links: [] };
        columns.unshift(services);
      }
      services.links = Array.isArray(services.links) ? services.links : [];
      if (!services.links.some((link) => link?.href === '/services/auto-dealers')) {
        services.links.push({ label: 'Лидогенерация для автодилеров', href: '/services/auto-dealers' });
      }
      settings.footerColumns = columns;
      return stringify(settings);
    };
    const draft = appendLink(settingsRow.draft_json);
    const published = appendLink(settingsRow.published_json);
    this.db.prepare('UPDATE cms_settings SET draft_json = ?, published_json = ?, updated_at = ? WHERE key = ?').run(draft, published, now, 'site');
  }

  migrateAutoDealersAuditV38() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const approvedItem = seedContentItems().find((item) => item.kind === 'service' && item.slug === 'auto-dealers');
    if (!approvedItem) return;
    const approvedByType = new Map((approvedItem.document?.blocks || []).map((block) => [block.type, block]));
    const oldHeroBadges = [
      { title: 'AI-агенты 24/7', text: 'собирают и обогащают данные', icon: 'ai' },
      { title: 'CRM за 1–3 дня', text: 'передача заявок в контур дилера', icon: 'crm' },
      { title: 'Без мёртвых лидов', text: 'фиксируем критерии квалификации', icon: 'shield' },
    ];
    const oldFlow = [
      { title: 'Рынок', text: 'Модели, спрос, география', icon: 'market' },
      { title: 'Покупатель', text: 'Бюджет, срок, трейд-ин', icon: 'person' },
      { title: 'Диалог', text: 'Тест-драйв, кредит, сервис', icon: 'chat' },
      { title: 'CRM дилера', text: 'Карточка, история, задача', icon: 'crm' },
    ];
    const sameJson = (left, right) => stringify(left) === stringify(right);
    const approvedData = (type) => structuredClone(approvedByType.get(type)?.data || {});
    const updateIf = (target, key, oldValue, newValue) => {
      if (target[key] === oldValue) { target[key] = newValue; return true; }
      return false;
    };
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      let changed = false;
      for (const block of document.blocks) {
        block.data ||= {};
        const d = block.data;
        const approved = approvedData(block.type);
        if (block.type === 'hero-auto-dealers') {
          changed = updateIf(d, 'kicker', 'B2B lead generation для автобизнеса', approved.kicker) || changed;
          changed = updateIf(d, 'titleLine1', 'Тёплые лиды для дилерского центра.', approved.titleLine1) || changed;
          changed = updateIf(d, 'lead', 'Берём на себя маркетинговый процесс — от поиска покупателей и корпоративных клиентов до квалификации заявок на тест-драйв, трейд-ин, кредит, лизинг и сервис с передачей в вашу CRM.', approved.lead) || changed;
          changed = updateIf(d, 'primaryLabel', 'Получить лиды', approved.primaryLabel) || changed;
          if (sameJson(d.badges, oldHeroBadges)) { d.badges = approved.badges; changed = true; }
          if (sameJson(d.flow, oldFlow)) { d.flow = approved.flow; changed = true; }
        }
        if (block.type === 'auto-proof') {
          changed = updateIf(d, 'kicker', 'Контур для автодилера', approved.kicker) || changed;
          changed = updateIf(d, 'title', 'Показываем результат в метриках, которые видит дилер', approved.title) || changed;
          changed = updateIf(d, 'intro', 'Не публикуем вымышленные продажи. До появления подтверждённых данных используем измеримые параметры системы и заменяем их в админке после согласования.', approved.intro) || changed;
          if (!d.note) { d.note = approved.note; changed = true; }
          const oldMetrics = [
            { value: '1–3 дня', label: 'подключение к CRM при доступном API' },
            { value: '24/7', label: 'сбор и обогащение данных AI-агентами' },
            { value: '4 направления', label: 'новые авто, пробег, трейд-ин, сервис' },
            { value: 'UTM + CRM', label: 'источник, интерес и история в карточке' },
          ];
          const oldTeasers = [
            { title: 'Новые автомобили', result: 'Квалификация спроса по модели, бюджету и сроку покупки', href: '/cases/auto-new-cars' },
            { title: 'Авто с пробегом', result: 'Разделяем покупку, обмен, кредит и срочный выкуп', href: '/cases/auto-used-cars' },
            { title: 'Сервис и удержание', result: 'Маршрутизируем запись по услуге, автомобилю и дилерскому центру', href: '/cases/auto-service' },
          ];
          if (sameJson(d.metrics, oldMetrics)) { d.metrics = approved.metrics; changed = true; }
          if (sameJson(d.teasers, oldTeasers)) { d.teasers = approved.teasers; changed = true; }
        }
        if (block.type === 'cases-slider') {
          changed = updateIf(d, 'title', 'Реализованные проекты для дилерских центров', approved.title) || changed;
          changed = updateIf(d, 'intro', 'Показываем типовые контуры для новых автомобилей, пробега, коммерческого транспорта, мототехники и сервиса. Фактические показатели публикуются только после подтверждения.', approved.intro) || changed;
        }
        if (block.type === 'auto-case-video') {
          changed = updateIf(d, 'kicker', 'Ключевой сценарий', approved.kicker) || changed;
          changed = updateIf(d, 'title', 'Дилерская сеть: единый контур заявок до CRM', approved.title) || changed;
          changed = updateIf(d, 'segment', 'Типовой сценарий — заменить на подтверждённый кейс после согласования', approved.segment) || changed;
          changed = updateIf(d, 'challenge', 'Заявки приходят из нескольких источников, менеджеры видят мало контекста, а маркетинг не получает обратную связь по визитам и продажам.', approved.challenge) || changed;
          changed = updateIf(d, 'solution', 'Объединяем источники, квалифицируем интерес к модели, бюджету, трейд-ин и сроку покупки, затем создаём карточку в CRM с задачей ответственному.', approved.solution) || changed;
          changed = updateIf(d, 'buttonLabel', 'Смотреть сценарий полностью', approved.buttonLabel) || changed;
          changed = updateIf(d, 'videoLabel', 'Видеокейс появится после предоставления подтверждённого материала', approved.videoLabel) || changed;
        }
        if (block.type === 'human-control') {
          changed = updateIf(d, 'title', 'Автоматизируем рутину, но не отдаём качество на самотёк', approved.title) || changed;
          changed = updateIf(d, 'intro', 'AI ускоряет повторяемые операции. Критерии лида, спорные диалоги и изменения в боевой CRM остаются под контролем специалистов VIONEX и команды дилера.', approved.intro) || changed;
        }
        if (block.type === 'pricing') {
          changed = updateIf(d, 'title', 'Три модели под размер дилерской сети и задачу', approved.title) || changed;
          changed = updateIf(d, 'intro', 'Начните с одного направления или соберите контур для нескольких дилерских центров. Финальный состав и цена фиксируются после аудита трафика, CRM и отдела продаж.', approved.intro) || changed;
        }
        if (block.type === 'agents') {
          changed = updateIf(d, 'title', 'Пять агентов сопровождают путь покупателя', approved.title) || changed;
          changed = updateIf(d, 'intro', 'Автоматизация ускоряет обработку данных и первые касания, а команда контролирует критерии и качество.', approved.intro) || changed;
        }
        if (block.type === 'faq') {
          changed = updateIf(d, 'title', 'Вопросы автомобильных дилеров', approved.title) || changed;
        }
        if (block.type === 'cta') {
          changed = updateIf(d, 'title', 'Готовы получать квалифицированные заявки для дилерского центра?', approved.title) || changed;
          changed = updateIf(d, 'text', 'Оставьте заявку — разберём источники, модельный ряд, CRM и обработку лидов, затем предложим минимальную рабочую конфигурацию.', approved.text) || changed;
          changed = updateIf(d, 'responseText', 'Свяжемся после проверки задачи и согласуем удобное время.', approved.responseText) || changed;
          changed = updateIf(d, 'buttonLabel', 'Обсудить автопроект', approved.buttonLabel) || changed;
        }
      }
      return { raw: changed ? stringify(sanitizeDocument(document)) : raw, changed };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }


  migrateAutoDealersHeroRefineV381() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const approvedItem = seedContentItems().find((item) => item.kind === 'service' && item.slug === 'auto-dealers');
    if (!approvedItem) return;
    const approvedByType = new Map((approvedItem.document?.blocks || []).map((block) => [block.type, block]));
    const approvedData = (type) => structuredClone(approvedByType.get(type)?.data || {});
    const sameJson = (left, right) => stringify(left) === stringify(right);
    const oldHeroBadges = [
      { title: 'AI-агенты 24/7', text: 'собирают и обогащают данные', icon: 'ai' },
      { title: 'Интеграция за 1–3 дня*', text: 'при доступном API и необходимых правах', icon: 'crm' },
      { title: 'Квалификация до CRM', text: 'бюджет, срок и следующий шаг', icon: 'shield' },
    ];
    const oldFlow = [
      { title: 'Рынок', text: 'Модель, бюджет, география', icon: 'market' },
      { title: 'Покупатель', text: 'Срок, трейд-ин, формат покупки', icon: 'person' },
      { title: 'Квалификация', text: 'Интерес, визит, тест-драйв', icon: 'chat' },
      { title: 'CRM дилера', text: 'Контекст, задача, ответственный', icon: 'crm' },
    ];
    const oldMetrics = [
      { value: '1–3 дня*', label: 'интеграция при доступном API и необходимых правах' },
      { value: '24/7', label: 'сбор данных и первичная обработка обращений' },
      { value: '4 сценария', label: 'новые авто, пробег, трейд-ин и сервис' },
      { value: 'UTM → CRM', label: 'источник, интерес и история в одной карточке' },
    ];
    const oldTeasers = [
      { title: 'Новые автомобили', result: 'Сегментация по модели, бюджету и сроку покупки', href: '/cases/auto-new-cars' },
      { title: 'Авто с пробегом', result: 'Покупка, обмен, кредит и срочный выкуп — в разных сценариях', href: '/cases/auto-used-cars' },
      { title: 'Сервис и удержание', result: 'Запись по услуге, автомобилю и дилерскому центру', href: '/cases/auto-service' },
    ];
    const updateIf = (target, key, oldValue, newValue) => {
      if (target[key] === oldValue) {
        target[key] = newValue;
        return true;
      }
      return false;
    };
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      let changed = false;
      for (const block of document.blocks) {
        block.data ||= {};
        const d = block.data;
        const approved = approvedData(block.type);
        if (block.type === 'hero-auto-dealers') {
          changed = updateIf(d, 'titleLine1', 'Тёплые лиды для автодилеров.', approved.titleLine1) || changed;
          changed = updateIf(d, 'titleLine2', 'Больше тест-драйвов и продаж.', approved.titleLine2) || changed;
          changed = updateIf(d, 'lead', 'Приводим и квалифицируем покупателей новых автомобилей, авто с пробегом, трейд-ин и сервиса. Передаём в CRM дилера интерес, бюджет, срок покупки и следующий шаг — без потери контекста.', approved.lead) || changed;
          changed = updateIf(d, 'primaryLabel', 'Получить план запуска', approved.primaryLabel) || changed;
          changed = updateIf(d, 'secondaryLabel', 'Смотреть автокейсы', approved.secondaryLabel) || changed;
          changed = updateIf(d, 'secondaryHref', '#auto-cases', approved.secondaryHref) || changed;
          if (sameJson(d.badges, oldHeroBadges)) {
            d.badges = approved.badges;
            changed = true;
          }
          if (sameJson(d.flow, oldFlow)) {
            d.flow = approved.flow;
            changed = true;
          }
        }
        if (block.type === 'auto-proof') {
          changed = updateIf(d, 'kicker', 'Контур результата', approved.kicker) || changed;
          changed = updateIf(d, 'title', 'Что получает дилер в рабочем контуре', approved.title) || changed;
          changed = updateIf(d, 'intro', 'Фиксируем измеримые параметры: скорость интеграции, полноту карточки, направления спроса и статусы обработки. Результаты по визитам и продажам добавляем после подтверждения в CRM.', approved.intro) || changed;
          if (sameJson(d.metrics, oldMetrics)) {
            d.metrics = approved.metrics;
            changed = true;
          }
          if (sameJson(d.teasers, oldTeasers)) {
            d.teasers = approved.teasers;
            changed = true;
          }
        }
      }
      return changed ? { raw: stringify(document), changed: true } : { raw, changed: false };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }


  migrateAutoDealersDesignV390() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const approvedItem = seedContentItems().find((item) => item.kind === 'service' && item.slug === 'auto-dealers');
    if (!approvedItem) return;
    const approvedBlocks = approvedItem.document?.blocks || [];
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      const existingByType = new Map(document.blocks.map((block) => [block.type, block]));
      const blocks = approvedBlocks.map((approved) => {
        const existing = existingByType.get(approved.type);
        const next = structuredClone(approved);
        if (existing?.id) next.id = existing.id;
        if (approved.type === 'hero-auto-dealers' && existing?.data) {
          next.data = {
            ...structuredClone(approved.data),
            kicker: existing.data.kicker || approved.data.kicker,
            titleLine1: approved.data.titleLine1,
            titleLine2: approved.data.titleLine2,
            lead: approved.data.lead,
            primaryGoal: existing.data.primaryGoal || approved.data.primaryGoal,
            image: existing.data.image || approved.data.image,
            imageAlt: existing.data.imageAlt || approved.data.imageAlt,
            animation: existing.data.animation ?? approved.data.animation,
            flow: [],
          };
        }
        if (approved.type === 'auto-proof' && existing?.data) {
          next.data = { ...structuredClone(approved.data), note: approved.data.note };
        }
        return next;
      });
      document.blocks = blocks;
      return { raw: stringify(document), changed: true };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }


  migrateAutoDealersHeroConformanceV391() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const approvedItem = seedContentItems().find((item) => item.kind === 'service' && item.slug === 'auto-dealers');
    const approvedHero = approvedItem?.document?.blocks?.find((block) => block.type === 'hero-auto-dealers');
    if (!approvedHero) return;
    const oldLead = 'Приводим покупателей новых авто, пробега и сервиса. Квалифицируем интерес и передаём в CRM уже понятный следующий шаг.';
    const oldBadges = [
      { title: '+50% лидов', text: 'за 14 дней', icon: 'growth' },
      { title: '+200% визитов', text: 'в салон', icon: 'check' },
      { title: '1–3 дня', text: 'CRM и маршрутизация', icon: 'crm' },
    ];
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      const hero = document.blocks.find((block) => block.type === 'hero-auto-dealers');
      if (!hero) return { raw, changed: false };
      hero.data ||= {};
      let changed = false;
      if (hero.data.lead === oldLead) {
        hero.data.lead = approvedHero.data.lead;
        changed = true;
      }
      if (hero.data.primaryLabel === 'Получить план') {
        hero.data.primaryLabel = approvedHero.data.primaryLabel;
        changed = true;
      }
      if (hero.data.image === '/assets/img/cases3d/dealer-new-used.webp') {
        hero.data.image = approvedHero.data.image;
        changed = true;
      }
      if (stringify(hero.data.badges) === stringify(oldBadges)) {
        hero.data.badges = structuredClone(approvedHero.data.badges);
        changed = true;
      }
      return changed ? { raw: stringify(document), changed: true } : { raw, changed: false };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }

  migrateAutoDealersHeroSeamlessV392() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      const hero = document.blocks.find((block) => block.type === 'hero-auto-dealers');
      if (!hero?.data) return { raw, changed: false };
      if (hero.data.image !== '/assets/img/auto-dealers-hero-v391.webp') return { raw, changed: false };
      hero.data.image = '/assets/img/auto-dealers-hero-v392.webp';
      return { raw: stringify(document), changed: true };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }


  migrateAutoDealersLayeredHeroV393() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const layout = [
      { x: 22, y: 16, width: 174, iconSize: 36, accent: 'violet' },
      { x: 79, y: 18, width: 174, iconSize: 36, accent: 'violet' },
      { x: 21, y: 78, width: 184, iconSize: 36, accent: 'violet' },
      { x: 79, y: 78, width: 188, iconSize: 36, accent: 'violet' },
    ];
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      const hero = document.blocks.find((block) => block.type === 'hero-auto-dealers');
      if (!hero?.data) return { raw, changed: false };
      const d = hero.data;
      let changed = false;
      if (!d.image || ['/assets/img/auto-dealers-hero-v391.webp', '/assets/img/auto-dealers-hero-v392.webp'].includes(d.image)) {
        d.image = '/assets/img/auto-dealers-car-v393.webp';
        changed = true;
      }
      const defaults = { carX: 0, carY: 5, carScale: 90, sceneHeight: 520, dataScene: true };
      for (const [key, value] of Object.entries(defaults)) {
        if (d[key] === undefined || d[key] === null || d[key] === '') {
          d[key] = value;
          changed = true;
        }
      }
      if (Array.isArray(d.badges)) {
        d.badges = d.badges.slice(0, 6).map((badge, index) => {
          const item = { ...badge };
          const preset = layout[index] || { x: 50, y: 50, width: 176, iconSize: 36, accent: 'violet' };
          for (const [key, value] of Object.entries(preset)) {
            if (item[key] === undefined || item[key] === null || item[key] === '') {
              item[key] = value;
              changed = true;
            }
          }
          if (item.graphic === undefined) {
            item.graphic = '';
            changed = true;
          }
          return item;
        });
      }
      return changed ? { raw: stringify(document), changed: true } : { raw, changed: false };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }


  migrateAutoDealersReferenceHeroV310() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const oldLayout = [
      { x: 22, y: 16, width: 174, iconSize: 36 },
      { x: 79, y: 18, width: 174, iconSize: 36 },
      { x: 21, y: 78, width: 184, iconSize: 36 },
      { x: 79, y: 78, width: 188, iconSize: 36 },
    ];
    const newLayout = [
      { x: 22, y: 17, width: 184, iconSize: 40, visualType: 'chart' },
      { x: 82, y: 18, width: 176, iconSize: 40, visualType: 'standard' },
      { x: 27, y: 78, width: 194, iconSize: 40, visualType: 'chart' },
      { x: 82, y: 79, width: 194, iconSize: 40, visualType: 'standard' },
    ];
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      const hero = document.blocks.find((block) => block.type === 'hero-auto-dealers');
      if (!hero?.data) return { raw, changed: false };
      const d = hero.data;
      let changed = false;
      if (!d.image || d.image === '/assets/img/auto-dealers-car-v393.webp') {
        d.image = '/assets/img/hero-auto/car-blue-v310.webp';
        changed = true;
      }
      const oldDefaults = { carX: 0, carY: 5, carScale: 90, sceneHeight: 520 };
      const newDefaults = { carX: 4, carY: 9, carScale: 108, sceneHeight: 560 };
      for (const key of Object.keys(oldDefaults)) {
        if (d[key] === undefined || d[key] === null || d[key] === '' || Number(d[key]) === oldDefaults[key]) {
          d[key] = newDefaults[key];
          changed = true;
        }
      }
      if (Array.isArray(d.badges)) {
        d.badges = d.badges.slice(0, 6).map((badge, index) => {
          const item = { ...badge };
          const oldPreset = oldLayout[index];
          const nextPreset = newLayout[index];
          if (nextPreset) {
            for (const key of ['x','y','width','iconSize']) {
              if (item[key] === undefined || item[key] === null || item[key] === '' || (oldPreset && Number(item[key]) === oldPreset[key])) {
                item[key] = nextPreset[key];
                changed = true;
              }
            }
            if (!item.visualType) {
              item.visualType = nextPreset.visualType;
              changed = true;
            }
          }
          return item;
        });
      }
      return changed ? { raw: stringify(document), changed: true } : { raw, changed: false };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }

  migrateAutoDealersClarityV311() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const approvedItem = seedContentItems().find((item) => item.kind === 'service' && item.slug === 'auto-dealers');
    const approvedBlocks = new Map((approvedItem?.document?.blocks || []).map((block) => [block.type, block]));
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      let changed = false;
      for (const block of document.blocks) {
        const approved = approvedBlocks.get(block.type);
        if (!approved) continue;
        if (block.type === 'hero-auto-dealers' && block.data) {
          for (const key of ['kicker', 'titleLine1', 'titleLine2', 'lead', 'primaryLabel', 'primaryGoal', 'secondaryLabel', 'secondaryHref']) {
            if (block.data[key] !== approved.data[key]) {
              block.data[key] = approved.data[key];
              changed = true;
            }
          }
          block.data.badges = structuredClone(approved.data.badges);
          changed = true;
        }
        if (block.type === 'auto-proof' && block.enabled !== false) {
          block.enabled = false;
          changed = true;
        }
        if (block.type === 'agents' && block.data) {
          block.data.items = structuredClone(approved.data.items);
          changed = true;
        }
        if (block.type === 'pricing' && block.data) {
          block.data.features = structuredClone(approved.data.features);
          changed = true;
        }
        if (block.type === 'faq' && block.data) {
          block.data.items = structuredClone(approved.data.items);
          changed = true;
        }
      }
      return changed ? { raw: stringify(document), changed: true } : { raw, changed: false };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }

  migrateAutoDealersHeroImageV3111() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const migrateDocument = (raw) => {
      if (!raw) return { raw, changed: false };
      const document = parseJson(raw, null);
      if (!document || !Array.isArray(document.blocks)) return { raw, changed: false };
      const hero = document.blocks.find((block) => block.type === 'hero-auto-dealers');
      if (!hero?.data) return { raw, changed: false };
      if (hero.data.image !== '/assets/img/hero-auto/car-blue-v310.webp') return { raw, changed: false };
      hero.data.image = '/assets/img/hero-auto/car-blue-v311.webp';
      hero.data.imageAlt = 'Премиальный автомобиль для визуализации лидогенерации автодилеров';
      return { raw: stringify(document), changed: true };
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    if (draft.changed || published.changed) {
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
        .run(draft.raw, published.raw, nowIso(), row.id);
    }
  }

  migrateAutoDealersPayPerLeadV3112() {
    const row = this.db.prepare('SELECT id, draft_json, published_json FROM cms_content_items WHERE kind = ? AND slug = ?').get('service', 'auto-dealers');
    if (!row) return;
    const approvedItem = seedContentItems().find((item) => item.kind === 'service' && item.slug === 'auto-dealers');
    const approvedDocument = approvedItem?.document;
    const approvedHero = approvedDocument?.blocks?.find((block) => block.type === 'hero-auto-dealers');
    const approvedPayPerLead = approvedDocument?.blocks?.find((block) => block.type === 'pay-per-lead');
    if (!approvedHero || !approvedPayPerLead) return;
    const defaultImages = new Set(['/assets/img/auto-dealers-hero-v391.webp', '/assets/img/auto-dealers-hero-v392.webp', '/assets/img/hero-auto/car-blue-v311.webp']);
    const migrateDocument = (raw) => {
      const document = parseJson(raw, { schemaVersion: 1, blocks: [] });
      const hero = document.blocks?.find((block) => block.type === 'hero-auto-dealers');
      if (hero) {
        hero.data = { ...hero.data, titleLine1: approvedHero.data.titleLine1, titleLine2: approvedHero.data.titleLine2 };
        if (defaultImages.has(hero.data.image)) hero.data.image = approvedHero.data.image;
        if (Array.isArray(hero.data.badges) && hero.data.badges[0]) hero.data.badges[0] = { ...hero.data.badges[0], title: approvedHero.data.badges[0].title, text: '' };
      }
      const pricingIndex = document.blocks?.findIndex((block) => block.type === 'pricing');
      if (pricingIndex >= 0) document.blocks[pricingIndex] = structuredClone(approvedPayPerLead);
      const cases = document.blocks?.find((block) => block.type === 'auto-case-video');
      if (cases) cases.data = { ...cases.data, casesTitle: 'Кейсы: направления, с которыми мы работали' };
      return document;
    };
    const draft = migrateDocument(row.draft_json);
    const published = migrateDocument(row.published_json);
    this.db.prepare('UPDATE cms_content_items SET draft_json = ?, published_json = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(draft), JSON.stringify(published), nowIso(), row.id);
  }

  runMigrations() {
    let version = this.schemaVersion();
    if (version < 2) {
      this.transaction(() => {
        this.migrateHomepageShowcase();
        this.setSchemaVersion(2);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.1.0');
      });
      version = 2;
    }
    if (version < 3) {
      this.transaction(() => {
        this.setSchemaVersion(3);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.2.0');
      });
      version = 3;
    }
    if (version < 4) {
      this.transaction(() => {
        this.migratePremiumCasesCarousel();
        this.setSchemaVersion(4);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.3.0');
      });
      version = 4;
    }
    if (version < 5) {
      this.transaction(() => {
        this.migrateCaseShowcaseV34();
        this.setSchemaVersion(5);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.4.0');
      });
      version = 5;
    }
    if (version < 6) {
      this.transaction(() => {
        this.migrateIntegratedCasesAndPricingV35();
        this.setSchemaVersion(6);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.5.0');
      });
      version = 6;
    }
    if (version < 7) {
      this.transaction(() => {
        this.migrateCompactTrustStackV36();
        this.setSchemaVersion(7);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.6.0');
      });
      version = 7;
    }
    if (version < 8) {
      this.transaction(() => {
        this.migrateAutoDealersLandingV37();
        this.setSchemaVersion(8);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.7.0');
      });
      version = 8;
    }
    if (version < 9) {
      this.transaction(() => {
        this.migrateAutoDealersAuditV38();
        this.setSchemaVersion(9);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.8.0');
      });
      version = 9;
    }
    if (version < 10) {
      this.transaction(() => {
        this.migrateAutoDealersHeroRefineV381();
        this.setSchemaVersion(10);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.8.1');
      });
      version = 10;
    }
    if (version < 11) {
      this.transaction(() => {
        this.migrateAutoDealersDesignV390();
        this.setSchemaVersion(11);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.9.0');
      });
      version = 11;
    }
    if (version < 12) {
      this.transaction(() => {
        this.migrateAutoDealersHeroConformanceV391();
        this.setSchemaVersion(12);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.9.1');
      });
      version = 12;
    }
    if (version < 13) {
      this.transaction(() => {
        this.migrateAutoDealersHeroSeamlessV392();
        this.setSchemaVersion(13);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.9.2');
      });
      version = 13;
    }
    if (version < 14) {
      this.transaction(() => {
        this.migrateAutoDealersLayeredHeroV393();
        this.setSchemaVersion(14);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.9.3');
      });
      version = 14;
    }
    if (version < 15) {
      this.transaction(() => {
        this.migrateAutoDealersReferenceHeroV310();
        this.setSchemaVersion(15);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.10.0');
      });
      version = 15;
    }
    if (version < 16) {
      this.transaction(() => {
        this.migrateAutoDealersClarityV311();
        this.setSchemaVersion(16);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.11.0');
      });
      version = 16;
    }
    if (version < 17) {
      this.transaction(() => {
        this.migrateAutoDealersHeroImageV3111();
        this.setSchemaVersion(17);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.11.1');
      });
      version = 17;
    }
    if (version < 18) {
      this.transaction(() => {
        this.migrateAutoDealersPayPerLeadV3112();
        this.setSchemaVersion(18);
        this.db.prepare('INSERT INTO cms_meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run('design_version', '3.11.2');
      });
      version = 18;
    }
    return version;
  }

  transaction(callback) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = callback();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      try { this.db.exec('ROLLBACK'); } catch {}
      throw error;
    }
  }

  seedIfEmpty() {
    const count = this.db.prepare('SELECT COUNT(*) AS count FROM cms_pages').get().count;
    if (count > 0) return;
    const created = nowIso();
    this.transaction(() => {
      const insertPage = this.db.prepare(`
        INSERT INTO cms_pages(route, title, page_type, seo_title, seo_description, status, draft_json, published_json, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)
      `);
      for (const page of seedPages()) {
        const safe = sanitizeDocument(page.document);
        const json = stringify(safe);
        insertPage.run(normalizeRoute(page.route), page.title, page.pageType, page.seoTitle, page.seoDescription, json, json, created, created, created);
      }

      const insertContent = this.db.prepare(`
        INSERT INTO cms_content_items(kind, slug, title, excerpt, cover, tags_json, seo_title, seo_description, status, draft_json, published_json, created_at, updated_at, published_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?, ?, ?, ?)
      `);
      for (const item of seedContentItems()) {
        const safe = sanitizeDocument(item.document);
        const json = stringify(safe);
        const publishedAt = item.publishedAt || created;
        insertContent.run(item.kind, normalizeSlug(item.slug), item.title, item.excerpt || '', item.cover || '', stringify(item.tags || []), item.seoTitle || item.title, item.seoDescription || item.excerpt || '', json, json, created, created, publishedAt);
      }

      const settings = seedSettings();
      const json = stringify(settings.site);
      this.db.prepare('INSERT INTO cms_settings(key, draft_json, published_json, updated_at, published_at) VALUES (?, ?, ?, ?, ?)').run('site', json, json, created, created);
    });
  }

  close() {
    this.db.close();
  }

  hasUsers() {
    return this.db.prepare('SELECT EXISTS(SELECT 1 FROM cms_users WHERE is_active = 1) AS value').get().value === 1;
  }

  createUser({ username, passwordHash, role = 'owner' }) {
    const clean = String(username || '').trim().slice(0, 80);
    if (!/^[a-zA-Z0-9_.@-]{3,80}$/.test(clean)) throw new Error('Логин: 3–80 символов, латиница, цифры и знаки . _ @ -.');
    const now = nowIso();
    const result = this.db.prepare('INSERT INTO cms_users(username, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)').run(clean, passwordHash, role, now, now);
    return this.getUserById(Number(result.lastInsertRowid));
  }

  updateUserPassword(userId, passwordHash) {
    this.transaction(() => {
      this.db.prepare('UPDATE cms_users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash, nowIso(), userId);
      this.db.prepare('DELETE FROM cms_sessions WHERE user_id = ?').run(userId);
    });
  }

  getUserById(id) {
    return this.db.prepare('SELECT id, username, password_hash, role, is_active, created_at, updated_at, last_login_at FROM cms_users WHERE id = ?').get(id) || null;
  }

  getUserByUsername(username) {
    return this.db.prepare('SELECT id, username, password_hash, role, is_active, created_at, updated_at, last_login_at FROM cms_users WHERE username = ? COLLATE NOCASE').get(String(username || '').trim()) || null;
  }

  touchUserLogin(id) {
    this.db.prepare('UPDATE cms_users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(nowIso(), nowIso(), id);
  }

  createSession({ tokenHash, userId, csrfToken, ipHash, userAgent, expiresAt }) {
    const now = nowIso();
    this.db.prepare('INSERT INTO cms_sessions(token_hash, user_id, csrf_token, ip_hash, user_agent, created_at, last_seen_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(tokenHash, userId, csrfToken, ipHash, String(userAgent || '').slice(0, 500), now, now, expiresAt);
  }

  getSession(tokenHash) {
    const row = this.db.prepare(`
      SELECT s.id AS session_id, s.token_hash, s.user_id, s.csrf_token, s.ip_hash, s.user_agent, s.created_at, s.last_seen_at, s.expires_at,
             u.username, u.role, u.is_active
      FROM cms_sessions s JOIN cms_users u ON u.id = s.user_id
      WHERE s.token_hash = ?
    `).get(tokenHash);
    if (!row) return null;
    if (!row.is_active || Date.parse(row.expires_at) <= Date.now()) {
      this.db.prepare('DELETE FROM cms_sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }
    return row;
  }

  touchSession(id) {
    this.db.prepare('UPDATE cms_sessions SET last_seen_at = ? WHERE id = ?').run(nowIso(), id);
  }

  deleteSession(tokenHash) {
    this.db.prepare('DELETE FROM cms_sessions WHERE token_hash = ?').run(tokenHash);
  }

  pruneSessions() {
    this.db.prepare('DELETE FROM cms_sessions WHERE expires_at <= ?').run(nowIso());
  }

  listPages() {
    return this.db.prepare("SELECT * FROM cms_pages ORDER BY CASE WHEN route = '/' THEN 0 ELSE 1 END, route").all().map(mapPage);
  }

  getPageById(id) {
    return mapPage(this.db.prepare('SELECT * FROM cms_pages WHERE id = ?').get(Number(id)));
  }

  getPageByRoute(route, { publishedOnly = false } = {}) {
    const normalized = normalizeRoute(route);
    const row = publishedOnly
      ? this.db.prepare('SELECT * FROM cms_pages WHERE route = ? AND published_json IS NOT NULL').get(normalized)
      : this.db.prepare('SELECT * FROM cms_pages WHERE route = ?').get(normalized);
    return mapPage(row);
  }

  createPage(input, userId) {
    const route = normalizeRoute(input.route);
    const title = String(input.title || '').trim().slice(0, 200);
    if (!title) throw new Error('Название страницы не заполнено.');
    const draft = sanitizeDocument(input.draft || { blocks: [] });
    const now = nowIso();
    const result = this.db.prepare(`
      INSERT INTO cms_pages(route, title, page_type, seo_title, seo_description, status, draft_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?)
    `).run(route, title, String(input.pageType || 'page').slice(0, 40), String(input.seoTitle || title).slice(0, 300), String(input.seoDescription || '').slice(0, 500), stringify(draft), now, now);
    const page = this.getPageById(Number(result.lastInsertRowid));
    this.audit(userId, 'create', 'page', String(page.id), { route });
    return page;
  }

  savePageDraft(id, input, userId) {
    const current = this.getPageById(id);
    if (!current) throw new Error('Страница не найдена.');
    const route = normalizeRoute(input.route ?? current.route);
    const title = String(input.title ?? current.title).trim().slice(0, 200);
    if (!title) throw new Error('Название страницы не заполнено.');
    const draft = sanitizeDocument(input.draft ?? current.draft);
    this.db.prepare(`
      UPDATE cms_pages SET route = ?, title = ?, page_type = ?, seo_title = ?, seo_description = ?, draft_json = ?, updated_at = ? WHERE id = ?
    `).run(route, title, String(input.pageType ?? current.pageType).slice(0, 40), String(input.seoTitle ?? current.seoTitle).slice(0, 300), String(input.seoDescription ?? current.seoDescription).slice(0, 500), stringify(draft), nowIso(), Number(id));
    this.audit(userId, 'save_draft', 'page', String(id), { route });
    return this.getPageById(id);
  }

  publishPage(id, userId) {
    const current = this.getPageById(id);
    if (!current) throw new Error('Страница не найдена.');
    const now = nowIso();
    return this.transaction(() => {
      if (current.published) this.addRevision('page', String(id), { ...current, draft: undefined }, userId, 'Автоматическая копия перед публикацией');
      this.db.prepare("UPDATE cms_pages SET published_json = draft_json, status = 'published', published_at = ?, updated_at = ? WHERE id = ?").run(now, now, Number(id));
      this.audit(userId, 'publish', 'page', String(id), { route: current.route });
      return this.getPageById(id);
    });
  }

  unpublishPage(id, userId) {
    const current = this.getPageById(id);
    if (!current) throw new Error('Страница не найдена.');
    if (current.route === '/') throw new Error('Главную страницу нельзя снять с публикации.');
    this.db.prepare("UPDATE cms_pages SET status = 'draft', published_json = NULL, published_at = NULL, updated_at = ? WHERE id = ?").run(nowIso(), Number(id));
    this.audit(userId, 'unpublish', 'page', String(id), { route: current.route });
    return this.getPageById(id);
  }

  deletePage(id, userId) {
    const current = this.getPageById(id);
    if (!current) return false;
    if (current.route === '/') throw new Error('Главную страницу удалить нельзя.');
    this.transaction(() => {
      this.addRevision('page', String(id), current, userId, 'Копия перед удалением');
      this.db.prepare('DELETE FROM cms_pages WHERE id = ?').run(Number(id));
      this.audit(userId, 'delete', 'page', String(id), { route: current.route });
    });
    return true;
  }

  listContent(kind = '') {
    const rows = kind
      ? this.db.prepare('SELECT * FROM cms_content_items WHERE kind = ? ORDER BY updated_at DESC').all(kind)
      : this.db.prepare('SELECT * FROM cms_content_items ORDER BY kind, updated_at DESC').all();
    return rows.map(mapContent);
  }

  listPublishedContent(kind, limit = 50) {
    return this.db.prepare('SELECT * FROM cms_content_items WHERE kind = ? AND published_json IS NOT NULL ORDER BY COALESCE(published_at, updated_at) DESC LIMIT ?').all(kind, Number(limit)).map(mapContent);
  }

  getContentById(id) {
    return mapContent(this.db.prepare('SELECT * FROM cms_content_items WHERE id = ?').get(Number(id)));
  }

  getContentBySlug(kind, slug, { publishedOnly = false } = {}) {
    const clean = normalizeSlug(slug);
    const row = publishedOnly
      ? this.db.prepare('SELECT * FROM cms_content_items WHERE kind = ? AND slug = ? AND published_json IS NOT NULL').get(kind, clean)
      : this.db.prepare('SELECT * FROM cms_content_items WHERE kind = ? AND slug = ?').get(kind, clean);
    return mapContent(row);
  }

  createContent(input, userId) {
    const kind = ['service', 'case', 'post'].includes(input.kind) ? input.kind : 'post';
    const slug = normalizeSlug(input.slug || input.title);
    const title = String(input.title || '').trim().slice(0, 200);
    if (!title) throw new Error('Название материала не заполнено.');
    const draft = sanitizeDocument(input.draft || { blocks: [] });
    const now = nowIso();
    const result = this.db.prepare(`
      INSERT INTO cms_content_items(kind, slug, title, excerpt, cover, tags_json, seo_title, seo_description, status, draft_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
    `).run(kind, slug, title, String(input.excerpt || '').slice(0, 1000), String(input.cover || '').slice(0, 500), stringify(Array.isArray(input.tags) ? input.tags.slice(0, 20).map((v) => String(v).slice(0, 80)) : []), String(input.seoTitle || title).slice(0, 300), String(input.seoDescription || input.excerpt || '').slice(0, 500), stringify(draft), now, now);
    const item = this.getContentById(Number(result.lastInsertRowid));
    this.audit(userId, 'create', 'content', String(item.id), { kind, slug });
    return item;
  }

  saveContentDraft(id, input, userId) {
    const current = this.getContentById(id);
    if (!current) throw new Error('Материал не найден.');
    const kind = ['service', 'case', 'post'].includes(input.kind) ? input.kind : current.kind;
    const slug = normalizeSlug(input.slug ?? current.slug);
    const title = String(input.title ?? current.title).trim().slice(0, 200);
    if (!title) throw new Error('Название материала не заполнено.');
    const draft = sanitizeDocument(input.draft ?? current.draft);
    const tags = Array.isArray(input.tags) ? input.tags.slice(0, 20).map((v) => String(v).slice(0, 80)) : current.tags;
    this.db.prepare(`
      UPDATE cms_content_items SET kind = ?, slug = ?, title = ?, excerpt = ?, cover = ?, tags_json = ?, seo_title = ?, seo_description = ?, draft_json = ?, updated_at = ? WHERE id = ?
    `).run(kind, slug, title, String(input.excerpt ?? current.excerpt).slice(0, 1000), String(input.cover ?? current.cover).slice(0, 500), stringify(tags), String(input.seoTitle ?? current.seoTitle).slice(0, 300), String(input.seoDescription ?? current.seoDescription).slice(0, 500), stringify(draft), nowIso(), Number(id));
    this.audit(userId, 'save_draft', 'content', String(id), { kind, slug });
    return this.getContentById(id);
  }

  publishContent(id, userId) {
    const current = this.getContentById(id);
    if (!current) throw new Error('Материал не найден.');
    const now = nowIso();
    return this.transaction(() => {
      if (current.published) this.addRevision('content', String(id), { ...current, draft: undefined }, userId, 'Автоматическая копия перед публикацией');
      this.db.prepare("UPDATE cms_content_items SET published_json = draft_json, status = 'published', published_at = ?, updated_at = ? WHERE id = ?").run(now, now, Number(id));
      this.audit(userId, 'publish', 'content', String(id), { kind: current.kind, slug: current.slug });
      return this.getContentById(id);
    });
  }

  unpublishContent(id, userId) {
    const current = this.getContentById(id);
    if (!current) throw new Error('Материал не найден.');
    this.db.prepare("UPDATE cms_content_items SET status = 'draft', published_json = NULL, published_at = NULL, updated_at = ? WHERE id = ?").run(nowIso(), Number(id));
    this.audit(userId, 'unpublish', 'content', String(id), { kind: current.kind, slug: current.slug });
    return this.getContentById(id);
  }

  deleteContent(id, userId) {
    const current = this.getContentById(id);
    if (!current) return false;
    this.transaction(() => {
      this.addRevision('content', String(id), current, userId, 'Копия перед удалением');
      this.db.prepare('DELETE FROM cms_content_items WHERE id = ?').run(Number(id));
      this.audit(userId, 'delete', 'content', String(id), { kind: current.kind, slug: current.slug });
    });
    return true;
  }

  addRevision(entityType, entityId, snapshot, userId, note = '') {
    this.db.prepare('INSERT INTO cms_revisions(entity_type, entity_id, snapshot_json, note, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(entityType, String(entityId), stringify(snapshot), String(note).slice(0, 300), userId || null, nowIso());
  }

  listRevisions(entityType, entityId, limit = 30) {
    return this.db.prepare(`
      SELECT r.id, r.entity_type, r.entity_id, r.note, r.created_at, u.username
      FROM cms_revisions r LEFT JOIN cms_users u ON u.id = r.created_by
      WHERE r.entity_type = ? AND r.entity_id = ? ORDER BY r.id DESC LIMIT ?
    `).all(entityType, String(entityId), Number(limit));
  }

  getRevision(id) {
    const row = this.db.prepare('SELECT * FROM cms_revisions WHERE id = ?').get(Number(id));
    if (!row) return null;
    return { ...row, snapshot: parseJson(row.snapshot_json, null) };
  }

  restoreRevision(revisionId, userId) {
    const revision = this.getRevision(revisionId);
    if (!revision?.snapshot) throw new Error('Версия не найдена.');
    if (revision.entity_type === 'page') {
      const snapshot = revision.snapshot;
      const page = this.getPageById(Number(revision.entity_id));
      if (!page) throw new Error('Страница для восстановления не найдена.');
      const restored = snapshot.published || snapshot.draft || snapshot;
      this.db.prepare('UPDATE cms_pages SET draft_json = ?, updated_at = ? WHERE id = ?').run(stringify(sanitizeDocument(restored)), nowIso(), page.id);
      this.audit(userId, 'restore_revision', 'page', String(page.id), { revisionId });
      return this.getPageById(page.id);
    }
    if (revision.entity_type === 'content') {
      const snapshot = revision.snapshot;
      const item = this.getContentById(Number(revision.entity_id));
      if (!item) throw new Error('Материал для восстановления не найден.');
      const restored = snapshot.published || snapshot.draft || snapshot;
      this.db.prepare('UPDATE cms_content_items SET draft_json = ?, updated_at = ? WHERE id = ?').run(stringify(sanitizeDocument(restored)), nowIso(), item.id);
      this.audit(userId, 'restore_revision', 'content', String(item.id), { revisionId });
      return this.getContentById(item.id);
    }
    throw new Error('Этот тип версии пока не поддерживает восстановление.');
  }

  getSettings(key = 'site', { published = true } = {}) {
    const row = this.db.prepare('SELECT * FROM cms_settings WHERE key = ?').get(key);
    if (!row) return null;
    return parseJson(published ? row.published_json : row.draft_json, {});
  }

  saveSettingsDraft(key, value, userId) {
    const cleanKey = String(key).slice(0, 80);
    const json = stringify(value);
    const now = nowIso();
    this.db.prepare(`
      INSERT INTO cms_settings(key, draft_json, published_json, updated_at, published_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET draft_json = excluded.draft_json, updated_at = excluded.updated_at
    `).run(cleanKey, json, json, now, now);
    this.audit(userId, 'save_draft', 'settings', cleanKey, {});
    return this.getSettings(cleanKey, { published: false });
  }

  publishSettings(key, userId) {
    const currentDraft = this.getSettings(key, { published: false });
    const currentPublished = this.getSettings(key, { published: true });
    if (currentPublished) this.addRevision('settings', key, currentPublished, userId, 'Автоматическая копия перед публикацией');
    const now = nowIso();
    this.db.prepare('UPDATE cms_settings SET published_json = draft_json, published_at = ?, updated_at = ? WHERE key = ?').run(now, now, key);
    this.audit(userId, 'publish', 'settings', key, {});
    return currentDraft;
  }

  listMedia() {
    return this.db.prepare('SELECT * FROM cms_media ORDER BY id DESC').all().map(mapMedia);
  }

  getMediaById(id) {
    return mapMedia(this.db.prepare('SELECT * FROM cms_media WHERE id = ?').get(Number(id)));
  }

  getMediaByStoredName(storedName) {
    return mapMedia(this.db.prepare('SELECT * FROM cms_media WHERE stored_name = ?').get(String(storedName)));
  }

  createMedia(input, userId) {
    const now = nowIso();
    const result = this.db.prepare('INSERT INTO cms_media(original_name, stored_name, mime_type, size_bytes, title, alt_text, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(String(input.originalName).slice(0, 300), String(input.storedName).slice(0, 300), input.mimeType, Number(input.sizeBytes), String(input.title || '').slice(0, 300), String(input.altText || '').slice(0, 500), userId || null, now);
    const media = this.getMediaById(Number(result.lastInsertRowid));
    this.audit(userId, 'upload', 'media', String(media.id), { storedName: media.storedName });
    return media;
  }

  updateMedia(id, input, userId) {
    this.db.prepare('UPDATE cms_media SET title = ?, alt_text = ? WHERE id = ?').run(String(input.title || '').slice(0, 300), String(input.altText || '').slice(0, 500), Number(id));
    this.audit(userId, 'update', 'media', String(id), {});
    return this.getMediaById(id);
  }

  mediaUsage(url) {
    const pattern = `%${String(url)}%`;
    const pageCount = this.db.prepare('SELECT COUNT(*) AS count FROM cms_pages WHERE draft_json LIKE ? OR published_json LIKE ?').get(pattern, pattern).count;
    const contentCount = this.db.prepare('SELECT COUNT(*) AS count FROM cms_content_items WHERE cover = ? OR draft_json LIKE ? OR published_json LIKE ?').get(url, pattern, pattern).count;
    return Number(pageCount) + Number(contentCount);
  }

  deleteMedia(id, userId, { force = false } = {}) {
    const media = this.getMediaById(id);
    if (!media) return null;
    const usage = this.mediaUsage(media.url);
    if (usage > 0 && !force) {
      const error = new Error(`Файл используется в ${usage} материалах. Сначала замените его или подтвердите принудительное удаление.`);
      error.statusCode = 409;
      throw error;
    }
    this.db.prepare('DELETE FROM cms_media WHERE id = ?').run(Number(id));
    this.audit(userId, 'delete', 'media', String(id), { storedName: media.storedName, usage });
    return media;
  }

  audit(userId, action, entityType, entityId = '', details = {}) {
    this.db.prepare('INSERT INTO cms_audit_log(user_id, action, entity_type, entity_id, details_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(userId || null, action, entityType, String(entityId), stringify(details), nowIso());
  }

  listAudit(limit = 100) {
    return this.db.prepare(`
      SELECT a.id, a.action, a.entity_type, a.entity_id, a.details_json, a.created_at, u.username
      FROM cms_audit_log a LEFT JOIN cms_users u ON u.id = a.user_id
      ORDER BY a.id DESC LIMIT ?
    `).all(Number(limit)).map((row) => ({ ...row, details: parseJson(row.details_json, {}) }));
  }

  dashboard() {
    const scalar = (sql, ...params) => Number(this.db.prepare(sql).get(...params).count || 0);
    return {
      pages: scalar('SELECT COUNT(*) AS count FROM cms_pages'),
      publishedPages: scalar('SELECT COUNT(*) AS count FROM cms_pages WHERE published_json IS NOT NULL'),
      services: scalar("SELECT COUNT(*) AS count FROM cms_content_items WHERE kind = 'service'"),
      cases: scalar("SELECT COUNT(*) AS count FROM cms_content_items WHERE kind = 'case'"),
      posts: scalar("SELECT COUNT(*) AS count FROM cms_content_items WHERE kind = 'post'"),
      media: scalar('SELECT COUNT(*) AS count FROM cms_media'),
      users: scalar('SELECT COUNT(*) AS count FROM cms_users WHERE is_active = 1'),
    };
  }

  backup(label = 'manual') {
    this.db.exec('PRAGMA wal_checkpoint(FULL)');
    const safeLabel = String(label).replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 40) || 'backup';
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destination = path.join(this.dataDir, 'backups', `cms-${stamp}-${safeLabel}.sqlite`);
    fs.copyFileSync(this.filePath, destination);
    return destination;
  }
}

export function openCmsDatabase(dataDir, databasePath = '') {
  return new CmsDatabase(dataDir, databasePath);
}
