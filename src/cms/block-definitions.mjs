import { randomUUID } from 'node:crypto';

const text = (key, label, options = {}) => ({ key, label, type: 'text', ...options });
const textarea = (key, label, options = {}) => ({ key, label, type: 'textarea', ...options });
const toggle = (key, label, options = {}) => ({ key, label, type: 'boolean', ...options });
const select = (key, label, choices, options = {}) => ({ key, label, type: 'select', choices, ...options });
const media = (key, label, options = {}) => ({ key, label, type: 'media', ...options });
const number = (key, label, options = {}) => ({ key, label, type: 'number', ...options });
const repeater = (key, label, fields, options = {}) => ({ key, label, type: 'repeater', fields, ...options });

export const BLOCK_DEFINITIONS = Object.freeze({
  'hero-premium': {
    label: 'Первый экран — динамическая планета',
    category: 'Основные',
    description: 'Премиальный первый экран с динамической Canvas-планетой, оффером и маршрутом лида.',
    singleton: true,
    defaults: {
      eyebrow: 'B2B-лидогенерация под ключ',
      titleLine1: 'Покупайте тёплых лидов.',
      titleLine2: 'Продавайте больше.',
      lead: 'Выстраиваем маркетинговый процесс на своей стороне — от поиска ЛПР и первого касания до квалификации и передачи подготовленного клиента в вашу CRM.',
      primaryLabel: 'Получить лиды',
      primaryGoal: 'warm_leads',
      secondaryLabel: 'Смотреть кейсы',
      secondaryHref: '/cases',
      assurances: [
        { text: 'Только целевые и проверенные лиды', icon: 'check' },
        { text: 'Интеграция с вашей CRM', icon: 'crm' },
        { text: 'Прозрачный процесс и контроль качества', icon: 'growth' },
      ],
      callouts: [
        { position: 'ai', title: 'AI-агенты 24/7', text: 'собирают и обогащают данные', icon: 'ai' },
        { position: 'data', title: 'Контекст + данные', text: 'персонализированное касание', icon: 'data' },
        { position: 'crm', title: 'Готовый лид в CRM', text: 'контекст, история и следующий шаг', icon: 'crm' },
      ],
      liveBadge: 'Система работает в реальном времени',
      flow: [
        { title: 'Рынок', text: 'Сегменты, спрос и сигналы', icon: 'market' },
        { title: 'ЛПР', text: 'Роль, компания и контакт', icon: 'person' },
        { title: 'Диалог', text: 'Потребность и готовность', icon: 'chat' },
        { title: 'CRM', text: 'Карточка, история и задача', icon: 'crm' },
      ],
      animation: true,
    },
    fields: [
      text('eyebrow', 'Надзаголовок'),
      text('titleLine1', 'Первая строка заголовка', { required: true }),
      text('titleLine2', 'Акцентная строка заголовка', { required: true }),
      textarea('lead', 'Описание', { rows: 4, required: true }),
      text('primaryLabel', 'Основная кнопка'),
      text('primaryGoal', 'Цель формы'),
      text('secondaryLabel', 'Вторая кнопка'),
      text('secondaryHref', 'Ссылка второй кнопки'),
      repeater('assurances', 'Короткие преимущества', [
        text('text', 'Текст', { required: true }),
        select('icon', 'Иконка', ['check', 'crm', 'growth', 'shield', 'clock']),
      ], { min: 1, max: 5 }),
      repeater('callouts', 'Подписи вокруг планеты', [
        select('position', 'Позиция', ['ai', 'data', 'crm']),
        text('title', 'Заголовок', { required: true }),
        text('text', 'Подпись'),
        select('icon', 'Иконка', ['ai', 'data', 'crm', 'chat']),
      ], { min: 0, max: 3 }),
      text('liveBadge', 'Подпись статуса'),
      repeater('flow', 'Маршрут лида', [
        text('title', 'Этап', { required: true }),
        text('text', 'Пояснение'),
        select('icon', 'Иконка', ['market', 'person', 'chat', 'crm', 'target', 'chart']),
      ], { min: 0, max: 6 }),
      toggle('animation', 'Включить плавную анимацию планеты'),
    ],
  },
  'hero-auto-dealers': {
    label: 'Первый экран — автодилеры',
    category: 'Нишевые лендинги',
    description: 'Премиальный Hero: автомобиль отдельным прозрачным слоем, динамический фон и полностью управляемые бейджи.',
    singleton: true,
    defaults: {
      kicker: 'Лидогенерация для автодилеров',
      titleLine1: 'Приводим целевых тёплых лидов',
      titleLine2: 'в ваш автосалон.',
      lead: 'Запускаем рекламу, квалифицируем обращения и передаём готовые заявки в вашу CRM.',
      primaryLabel: 'Получить план лидогенерации',
      primaryGoal: 'warm_leads',
      secondaryLabel: '',
      secondaryHref: '',
      image: '/assets/img/hero-auto/car-blue-v310.webp',
      imageAlt: 'Автомобиль для визуализации лидогенерации автодилеров',
      carX: 4,
      carY: 9,
      carScale: 108,
      sceneHeight: 560,
      badges: [
        { title: '+200%', text: 'визитов в салон', icon: 'person', graphic: '', x: 27, y: 78, width: 194, iconSize: 40, accent: 'violet', visualType: 'chart' },
        { title: '+50%', text: 'лидов за 14 дней', icon: 'growth', graphic: '', x: 22, y: 17, width: 184, iconSize: 40, accent: 'violet', visualType: 'chart' },
        { title: '1–3 дня', text: 'запуск системы', icon: 'clock', graphic: '', x: 82, y: 18, width: 176, iconSize: 40, accent: 'violet', visualType: 'standard' },
      ],
      animation: true,
      dataScene: true,
    },
    fields: [
      text('kicker', 'Надзаголовок'),
      text('titleLine1', 'Первая строка заголовка', { required: true }),
      text('titleLine2', 'Акцентная строка заголовка', { required: true }),
      textarea('lead', 'Описание', { rows: 4, required: true }),
      text('primaryLabel', 'Основная кнопка'), text('primaryGoal', 'Цель формы'),
      text('secondaryLabel', 'Вторая кнопка'), text('secondaryHref', 'Ссылка второй кнопки'),
      media('image', 'Автомобиль без фона (PNG/WebP)'), text('imageAlt', 'Alt автомобиля'),
      number('carX', 'Смещение автомобиля по X, %', { min: -25, max: 25 }),
      number('carY', 'Смещение автомобиля по Y, %', { min: -25, max: 25 }),
      number('carScale', 'Размер автомобиля, %', { min: 70, max: 145 }),
      number('sceneHeight', 'Высота визуальной сцены, px', { min: 380, max: 680 }),
      repeater('badges', 'Плавающие показатели', [
        text('title', 'Крупный текст', { required: true }), text('text', 'Подпись'),
        select('icon', 'Встроенная иконка', ['ai', 'crm', 'shield', 'check', 'clock', 'growth', 'person', 'data', 'chart']),
        media('graphic', 'Своя иконка / изображение'),
        number('x', 'Положение X, %', { min: 0, max: 100 }),
        number('y', 'Положение Y, %', { min: 0, max: 100 }),
        number('width', 'Ширина карточки, px', { min: 120, max: 320 }),
        number('iconSize', 'Размер графики, px', { min: 24, max: 72 }),
        select('accent', 'Акцент', ['violet', 'blue', 'green']),
        select('visualType', 'Вид карточки', ['standard', 'chart']),
      ], { min: 0, max: 6 }),
      toggle('dataScene', 'Показывать динамическую data-сцену'),
      toggle('animation', 'Включить плавную анимацию визуала'),
    ],
  },
  'auto-proof': {
    label: 'Автодилеры — цифры и тизеры',
    category: 'Нишевые лендинги',
    description: 'Четыре крупные метрики сразу после Hero без лишнего текста и повторяющихся тизеров.',
    defaults: {
      kicker: 'Результат',
      title: 'Результат в цифрах',
      intro: 'Показываем ключевые метрики контура: скорость запуска, рост лидов, визитов и полноту данных в CRM.',
      metrics: [
        { value: '+50%', label: 'лидов за 14 дней' },
        { value: '+200%', label: 'приездов в салон' },
        { value: '1–3 дня*', label: 'запуск CRM-интеграции' },
        { value: 'UTM → CRM', label: 'источник, интерес и задача' },
      ],
      teasers: [
        { title: 'Новые автомобили', result: 'Фиксируем интерес к модели, бюджету и сроку покупки', href: '/cases/auto-new-cars' },
        { title: 'Авто с пробегом', result: 'Отделяем покупку, обмен и кредит по разным сценариям', href: '/cases/auto-used-cars' },
        { title: 'Сервис', result: 'Маршрутизируем запись по услуге и дилерскому центру', href: '/cases/auto-service' },
      ],
      note: '* Срок зависит от доступности API, прав доступа и готовности схемы полей CRM.',
    },
    fields: [
      text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('intro', 'Описание'), text('note', 'Примечание под метриками'),
      repeater('metrics', 'Метрики', [text('value', 'Значение', { required: true }), text('label', 'Подпись', { required: true })], { min: 2, max: 8 }),
      repeater('teasers', 'Тизеры кейсов', [text('title', 'Название', { required: true }), textarea('result', 'Результат/суть'), text('href', 'Ссылка')], { min: 0, max: 6 }),
    ],
  },
  'auto-case-video': {
    label: 'Автодилеры — контур заявки и кейсы',
    category: 'Нишевые лендинги',
    description: 'Два выразительных блока: круговой контур заявки и три отраслевых сценария.',
    defaults: {
      kicker: 'Как работает система',
      title: 'Единый контур заявки для дилерской сети',
      segment: 'Один поток — от источника до визита, CRM и обратной связи по продажам.',
      loopItems: [
        { title: 'Трафик', icon: 'target' },
        { title: 'Квалификация AI', icon: 'ai' },
        { title: 'Тест-драйв', icon: 'clock' },
        { title: 'CRM и менеджер', icon: 'crm' },
        { title: 'Аналитика и рост', icon: 'chart' },
      ],
      casesTitle: 'Проекты и сценарии для дилерских центров',
      cases: [
        { kicker: 'Кейс', title: 'Коммерческий транспорт', text: 'Корпоративные продажи', metric: 'B2B • автопарк', image: '/assets/img/cases3d/logistics.webp', imageAlt: 'Коммерческий транспорт', href: '/cases/auto-commercial-vehicles' },
        { kicker: 'Кейс', title: 'Мототехника', text: 'Сезонный спрос', metric: 'Сезон • визит', image: '/assets/img/cases3d/dealer-new.webp', imageAlt: 'Мототехника и сезонный спрос', href: '/cases/auto-motorcycles' },
        { kicker: 'Кейс', title: 'Премиум авто', text: 'Тест-драйв по записи', metric: 'Премиум • CRM', image: '/assets/img/auto-dealers-hero-v392.webp', imageAlt: 'Премиальный автомобиль в дилерском центре', href: '/cases/auto-new-cars' },
      ],
      buttonLabel: 'Смотреть все кейсы',
      buttonHref: '/cases',
    },
    fields: [
      text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('segment', 'Короткое описание'),
      repeater('loopItems', 'Этапы контура', [text('title', 'Название', { required: true }), select('icon', 'Иконка', ['target', 'ai', 'clock', 'crm', 'chart', 'person', 'growth'])], { min: 4, max: 6 }),
      text('casesTitle', 'Заголовок кейсов'),
      repeater('cases', 'Карточки кейсов', [text('kicker', 'Метка'), text('title', 'Название', { required: true }), text('text', 'Подпись'), text('metric', 'Краткий показатель'), media('image', 'Изображение'), text('imageAlt', 'Alt изображения'), text('href', 'Ссылка')], { min: 3, max: 6 }),
      text('buttonLabel', 'Текст ссылки на все кейсы'), text('buttonHref', 'Ссылка на все кейсы'),
    ],
  },
  'human-control': {
    label: 'Автоматизация с человеческим контролем',
    category: 'Нишевые лендинги',
    description: 'Снимает возражение про роботов: что автоматизируется, что контролируют специалисты и как проверяется качество.',
    defaults: {
      kicker: 'Контроль качества',
      title: 'AI ускоряет обработку. Качество контролируют люди',
      intro: 'AI выполняет повторяемые операции. Критерии лида, спорные диалоги и изменения в боевой CRM остаются под контролем специалистов VIONEX и команды дилера.',
      items: [
        { title: 'Что делают AI-агенты', text: 'Собирают и обогащают данные, готовят первое касание, классифицируют ответы и фиксируют контекст.', icon: 'ai' },
        { title: 'Что контролируют люди', text: 'Офферы, скрипты, критерии квалификации, чувствительные ответы и правила передачи менеджерам.', icon: 'person' },
        { title: 'Как проверяем качество', text: 'Выборочно проверяем диалоги, разбираем причины отказа и сопоставляем лиды со статусами CRM.', icon: 'shield' },
      ],
    },
    fields: [
      text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('intro', 'Описание'),
      repeater('items', 'Пункты', [text('title', 'Название', { required: true }), textarea('text', 'Описание'), select('icon', 'Иконка', ['ai', 'person', 'shield', 'check', 'crm', 'chart'])], { min: 3, max: 6 }),
    ],
  },
  capabilities: {
    label: 'Наши возможности',
    category: 'Основные',
    description: 'Кликабельная сетка услуг с крупными 3D-подобными иконками.',
    defaults: {
      kicker: '',
      title: 'Наши возможности',
      accent: '',
      intro: 'Полный цикл лидогенерации с использованием AI-агентов и экспертизы.',
      items: [
        { number: '01', title: 'Стратегия и ICP', text: 'Изучаем ваш бизнес, продукт и воронку. Определяем идеальный профиль клиента и точки роста.', icon: 'target', href: '/services/lead-generation' },
        { number: '02', title: 'Поиск ЛПР', text: 'AI-агенты собирают базы лиц, принимающих решения, по вашим критериям.', icon: 'search', href: '/services/lead-generation' },
        { number: '03', title: 'Контакт-центр', text: 'Автоматизированные касания по e-mail, LinkedIn, мессенджерам и телефону.', icon: 'chat', href: '/services/lead-generation' },
        { number: '04', title: 'Квалификация лидов', text: 'AI квалифицирует потребность и бюджет, назначает встречу или консультацию.', icon: 'funnel', href: '/services/lead-generation' },
        { number: '05', title: 'CRM-интеграция', text: 'Передаём только тёплых лидов в вашу CRM с полной историей взаимодействий.', icon: 'crm', href: '/services/lead-generation#crm' },
        { number: '06', title: 'Аналитика и оптимизация', text: 'Анализируем результаты и постоянно улучшаем кампании и конверсию.', icon: 'chart', href: '/services/lead-generation' },
      ],
    },
    fields: [
      text('kicker', 'Надзаголовок'),
      text('title', 'Заголовок'),
      text('accent', 'Акцентная часть заголовка'),
      textarea('intro', 'Описание', { rows: 3 }),
      repeater('items', 'Карточки', [
        text('number', 'Номер'),
        text('title', 'Название', { required: true }),
        textarea('text', 'Описание', { rows: 3 }),
        select('icon', 'Иконка', ['target', 'search', 'chat', 'funnel', 'crm', 'chart', 'shield', 'clock']),
        text('href', 'Ссылка'),
      ], { min: 1, max: 12 }),
    ],
  },
  'collection-list': {
    label: 'Список материалов',
    category: 'Динамические',
    description: 'Автоматически выводит опубликованные услуги, кейсы или статьи.',
    defaults: { kind: 'case', kicker: 'Материалы', title: 'Опубликованные материалы', intro: '', layout: 'grid', limit: 12, showFilters: false },
    fields: [
      select('kind', 'Тип материалов', ['service', 'case', 'post']),
      text('kicker', 'Надзаголовок'),
      text('title', 'Заголовок'),
      textarea('intro', 'Описание', { rows: 3 }),
      select('layout', 'Вид', ['grid', 'slider']),
      number('limit', 'Максимум карточек', { min: 1, max: 50 }),
      toggle('showFilters', 'Показывать фильтры'),
    ],
  },
  'cases-slider': {
    label: 'Слайдер кейсов',
    category: 'Продажи',
    description: 'Интегрированная в фон страницы динамическая галерея: активный кейс выделяется, соседние карточки остаются видимыми.',
    defaults: {
      kicker: 'Кейсы',
      title: 'Реализованные проекты',
      accent: '',
      intro: '',
      allLabel: 'Смотреть все проекты',
      allHref: '/cases',
      kind: 'case',
      limit: 8,
      autoplay: true,
      autoplayDelay: 6500,
      filterTag: '',
    },
    fields: [
      text('kicker', 'Надзаголовок'),
      text('title', 'Заголовок'),
      text('accent', 'Акцент'),
      textarea('intro', 'Описание'),
      text('allLabel', 'Текст ссылки на все проекты'),
      text('allHref', 'Адрес ссылки'),
      select('kind', 'Источник', ['case']),
      number('limit', 'Количество', { min: 1, max: 12 }),
      toggle('autoplay', 'Автоматически переключать'),
      number('autoplayDelay', 'Интервал автопрокрутки, мс', { min: 3500, max: 15000 }),
      text('filterTag', 'Фильтр по тегу (необязательно)'),
    ],
  },
  pricing: {
    label: 'Форматы работы и сравнение',
    category: 'Продажи',
    description: 'Три модели сотрудничества, состав каждого формата и подробная таблица различий.',
    defaults: {
      kicker: 'Форматы работы',
      title: 'Три модели под разные задачи и темп роста',
      intro: 'Выберите глубину работы: от пилотной проверки сегмента до масштабируемой системы с несколькими каналами, CRM-автоматизацией и регулярной оптимизацией.',
      periodMonthly: 'Ежемесячно',
      periodQuarterly: 'Ежеквартально −10%',
      plans: [
        { name: 'Старт', monthly: 'от 120 000 ₽ / мес', quarterly: 'от 324 000 ₽ / квартал', caption: 'Пилот: проверка гипотезы и одного приоритетного сегмента.', popular: false, button: 'Обсудить старт' },
        { name: 'Рост', monthly: 'от 220 000 ₽ / мес', quarterly: 'от 594 000 ₽ / квартал', caption: 'Системный процесс: несколько сегментов, каналов и регулярная оптимизация.', popular: true, button: 'Обсудить рост' },
        { name: 'Масштаб', monthly: 'от 350 000 ₽ / мес', quarterly: 'от 945 000 ₽ / квартал', caption: 'Расширенный контур: несколько направлений, глубокая CRM-автоматизация и SLA.', popular: false, button: 'Обсудить масштаб' },
      ],
      features: [
        { label: 'Исследование рынка и ICP', start: '✓', growth: '✓', scale: '✓' },
        { label: 'Сегменты целевой аудитории', start: '1 сегмент', growth: 'до 3 сегментов', scale: '4+ сегмента' },
        { label: 'Сбор и обогащение базы ЛПР', start: 'до 500 контактов / мес', growth: 'до 1 500 контактов / мес', scale: 'по согласованному объёму' },
        { label: 'Каналы коммуникации', start: '1–2 канала', growth: 'до 4 каналов', scale: 'омниканальный контур' },
        { label: 'Персонализированные сценарии', start: '1 сценарий', growth: 'до 3 сценариев', scale: 'по каждому сегменту' },
        { label: 'Квалификация и прогрев', start: 'базовая', growth: 'расширенная', scale: 'индивидуальная логика' },
        { label: 'Передача и автоматизация в CRM', start: 'готовая интеграция', growth: 'этапы и задачи', scale: 'кастомные сценарии' },
        { label: 'Аналитика и оптимизация', start: 'отчёт по итогам периода', growth: 'еженедельная оптимизация', scale: 'дашборд, SLA и рекомендации' },
        { label: 'Сопровождение', start: 'координатор проекта', growth: 'выделенный аккаунт', scale: 'выделенная команда' },
        { label: 'Минимальный период', start: '1 месяц', growth: '3 месяца', scale: 'от 3 месяцев' },
      ],
    },
    fields: [
      text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('intro', 'Описание'),
      text('periodMonthly', 'Подпись ежемесячно'), text('periodQuarterly', 'Подпись второго периода'),
      repeater('plans', 'Форматы', [text('name', 'Название', { required: true }), text('monthly', 'Цена за месяц'), text('quarterly', 'Цена для второго периода'), text('caption', 'Описание'), toggle('popular', 'Рекомендуемый'), text('button', 'Кнопка')], { min: 1, max: 4 }),
      repeater('features', 'Сравнение', [text('label', 'Функция', { required: true }), text('start', 'План 1'), text('growth', 'План 2'), text('scale', 'План 3')], { min: 0, max: 30 }),
    ],
  },
  integrations: {
    label: 'Интеграции с CRM',
    category: 'Доверие',
    description: 'Пояснение интеграции и список совместимых систем.',
    defaults: {
      kicker: 'Интеграции',
      title: 'Почему VIONEX интегрируется с любой CRM',
      text: 'Работаем с вашей инфраструктурой и процессами. Гибкая архитектура, готовые коннекторы и API помогают передавать подготовленных лидов в привычном для команды формате.',
      items: [
        { name: 'amoCRM', logo: '/assets/img/crm-logos/amocrm.svg' },
        { name: 'Битрикс24', logo: '/assets/img/crm-logos/bitrix24.svg' },
        { name: 'RetailCRM', logo: '/assets/img/crm-logos/retailcrm.svg' },
        { name: 'HubSpot', logo: '/assets/img/crm-logos/hubspot.svg' },
        { name: 'Pipedrive', logo: '/assets/img/crm-logos/pipedrive.svg' },
        { name: 'Salesforce', logo: '/assets/img/crm-logos/salesforce.svg' },
        { name: 'Zoho CRM', logo: '/assets/img/crm-logos/zoho.svg' },
        { name: 'API / Webhooks', logo: '/assets/img/crm-logos/api.svg' },
      ],
      benefits: [
        { text: 'Готовые коннекторы к популярным CRM', icon: 'crm' },
        { text: 'REST API и Webhooks для любых сценариев', icon: 'growth' },
        { text: 'Безопасная передача данных и контроль ошибок', icon: 'shield' },
      ],
      note: 'Если вашей CRM нет в списке — подключаем через API.',
      buttonLabel: 'Обсудить интеграцию',
    },
    fields: [
      text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('text', 'Описание'),
      repeater('items', 'Системы', [text('name', 'Название', { required: true }), media('logo', 'Логотип')], { max: 20 }),
      repeater('benefits', 'Преимущества', [text('text', 'Текст', { required: true }), select('icon', 'Иконка', ['crm', 'growth', 'shield', 'check', 'data', 'ai'])], { min: 0, max: 6 }),
      textarea('note', 'Примечание'), text('buttonLabel', 'Кнопка'),
    ],
  },
  agents: {
    label: 'AI-агенты',
    category: 'Доверие',
    description: 'Горизонтальный процесс автоматизации.',
    defaults: {
      kicker: 'AI-агенты',
      title: 'Автоматизация на каждом этапе, контроль — у команды',
      intro: 'AI помогает структурировать данные и ускорять рутинные действия. Критические решения и критерии качества контролируются людьми.',
      items: [
        { title: 'Data Agent', text: 'Собирает и обогащает данные по компаниям и ролям.', icon: 'data' },
        { title: 'Outreach Agent', text: 'Готовит персонализированные первые касания.', icon: 'send' },
        { title: 'Dialog Agent', text: 'Классифицирует ответы и помогает вести сценарий.', icon: 'chat' },
        { title: 'Qualification Agent', text: 'Сопоставляет диалог с критериями лида.', icon: 'funnel' },
        { title: 'CRM Agent', text: 'Передаёт данные и запускает согласованные действия.', icon: 'crm' },
      ],
    },
    fields: [text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('intro', 'Описание'), repeater('items', 'Агенты', [text('title', 'Название', { required: true }), textarea('text', 'Описание'), select('icon', 'Иконка', ['data', 'send', 'chat', 'funnel', 'crm', 'chart'])], { min: 1, max: 8 })],
  },
  faq: {
    label: 'Часто задаваемые вопросы',
    category: 'Доверие',
    description: 'Аккордеон вопросов и ответов.',
    defaults: {
      kicker: '',
      title: 'Часто задаваемые вопросы',
      intro: '',
      items: [
        { question: 'Что входит в услугу лидогенерации?', answer: 'Исследование рынка и ICP, сбор и обогащение базы ЛПР, сценарии первого контакта, квалификация, передача в CRM и регулярная оптимизация.' },
        { question: 'Работаете ли вы с нашими сценариями и скриптами?', answer: 'Да. Сохраняем сильные части действующих материалов, адаптируем их под выбранные сегменты и согласовываем изменения до запуска.' },
        { question: 'Как вы гарантируете качество лидов?', answer: 'До запуска фиксируем критерии квалификации, обязательные поля и следующий шаг. Спорные диалоги разбираются по истории контакта и данным CRM.' },
        { question: 'Какие каналы используете для контакта?', answer: 'Набор каналов зависит от аудитории и ограничений: email, мессенджеры, телефон, профессиональные сети и другие согласованные точки контакта.' },
        { question: 'Сколько времени занимает запуск?', answer: 'Базовый пилот обычно готовится за 2–5 рабочих дней после получения вводных, доступов и согласования критериев квалификации.' },
        { question: 'Можно ли начать с тестового периода?', answer: 'Да. Для пилота выбираем один приоритетный сегмент, фиксируем объём, метрики и условия перехода к масштабированию.' },
      ],
    },
    fields: [text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('intro', 'Описание'), repeater('items', 'Вопросы', [text('question', 'Вопрос', { required: true }), textarea('answer', 'Ответ', { required: true, rows: 4 })], { min: 1, max: 30 })],
  },
  cta: {
    label: 'Призыв к действию',
    category: 'Продажи',
    description: 'Финальный конверсионный баннер.',
    defaults: {
      title: 'Готовы получать тёплых лидов стабильно каждый месяц?',
      text: 'Оставьте заявку — разберём продукт, воронку и предложим минимальную рабочую конфигурацию под вашу задачу.',
      responseText: 'Свяжемся после проверки задачи и согласуем удобный формат общения.',
      buttonLabel: 'Оставить заявку',
      goal: 'audit',
      messengers: [
        { label: 'Telegram', href: '', icon: 'telegram' },
        { label: 'WhatsApp', href: '', icon: 'whatsapp' },
        { label: 'Email', href: '', icon: 'email' },
      ],
    },
    fields: [
      text('title', 'Заголовок', { required: true }), textarea('text', 'Описание'), textarea('responseText', 'Подпись под кнопками'),
      text('buttonLabel', 'Кнопка'), text('goal', 'Цель формы'),
      repeater('messengers', 'Мессенджеры', [text('label', 'Название', { required: true }), text('href', 'Ссылка'), select('icon', 'Иконка', ['telegram', 'whatsapp', 'email'])], { min: 0, max: 5 }),
    ],
  },
  'rich-text': {
    label: 'Текстовый блок',
    category: 'Контент',
    description: 'Заголовок и безопасный текст без произвольного HTML.',
    defaults: { kicker: '', title: 'Новый текстовый блок', text: 'Добавьте содержание блока в админке.', align: 'left', narrow: true },
    fields: [text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('text', 'Текст', { rows: 10 }), select('align', 'Выравнивание', ['left', 'center']), toggle('narrow', 'Узкая колонка')],
  },
  'text-image': {
    label: 'Текст и изображение',
    category: 'Контент',
    description: 'Двухколоночный блок с текстом, изображением и кнопкой.',
    defaults: { kicker: '', title: 'Заголовок блока', text: 'Описание блока.', image: '', imageAlt: '', imageSide: 'right', buttonLabel: '', buttonHref: '' },
    fields: [text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('text', 'Текст', { rows: 8 }), media('image', 'Изображение'), text('imageAlt', 'Alt изображения'), select('imageSide', 'Сторона изображения', ['right', 'left']), text('buttonLabel', 'Текст кнопки'), text('buttonHref', 'Ссылка кнопки')],
  },
  stats: {
    label: 'Показатели',
    category: 'Контент',
    description: 'Сетка числовых показателей.',
    defaults: { kicker: '', title: 'Ключевые показатели', intro: '', items: [{ value: '24', label: 'встречи с ЛПР' }, { value: '57%', label: 'квалифицированных лидов' }, { value: '3,2 мес.', label: 'цикл сделки' }] },
    fields: [text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('intro', 'Описание'), repeater('items', 'Показатели', [text('value', 'Значение', { required: true }), text('label', 'Подпись', { required: true })], { min: 1, max: 12 })],
  },
  gallery: {
    label: 'Галерея',
    category: 'Контент',
    description: 'Галерея изображений из медиатеки.',
    defaults: { kicker: '', title: 'Галерея', intro: '', items: [] },
    fields: [text('kicker', 'Надзаголовок'), text('title', 'Заголовок'), textarea('intro', 'Описание'), repeater('items', 'Изображения', [media('image', 'Файл'), text('alt', 'Alt'), text('caption', 'Подпись')], { max: 24 })],
  },
  spacer: {
    label: 'Отступ',
    category: 'Служебные',
    description: 'Управляемый вертикальный отступ.',
    defaults: { size: 'medium' },
    fields: [select('size', 'Размер', ['small', 'medium', 'large'])],
  },
});

export function getBlockDefinitions() {
  return Object.entries(BLOCK_DEFINITIONS).map(([type, definition]) => ({ type, ...definition }));
}

export function createBlock(type) {
  const definition = BLOCK_DEFINITIONS[type];
  if (!definition) throw new Error(`Unknown block type: ${type}`);
  return {
    id: randomUUID(),
    type,
    enabled: true,
    variant: 'default',
    data: structuredClone(definition.defaults),
  };
}

function sanitizeScalar(field, value) {
  if (field.type === 'boolean') return Boolean(value);
  if (field.type === 'number') {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return field.min ?? 0;
    return Math.min(field.max ?? Number.MAX_SAFE_INTEGER, Math.max(field.min ?? Number.MIN_SAFE_INTEGER, numeric));
  }
  if (field.type === 'select') {
    const string = String(value ?? '');
    return field.choices.includes(string) ? string : (field.choices[0] ?? '');
  }
  const string = String(value ?? '').replaceAll('\u0000', '').trim();
  const maxLength = field.type === 'textarea' ? 20_000 : 1_000;
  return string.slice(0, maxLength);
}

function sanitizeFields(fields, data) {
  const result = {};
  for (const field of fields) {
    const value = data?.[field.key];
    if (field.type === 'repeater') {
      const items = Array.isArray(value) ? value : [];
      const max = Math.min(field.max ?? 50, 100);
      result[field.key] = items.slice(0, max).map((item) => sanitizeFields(field.fields, item));
    } else {
      result[field.key] = sanitizeScalar(field, value);
    }
  }
  return result;
}

export function sanitizeBlock(block) {
  const definition = BLOCK_DEFINITIONS[block?.type];
  if (!definition) throw new Error(`Unsupported block type: ${block?.type}`);
  return {
    id: /^[a-zA-Z0-9_-]{6,80}$/.test(String(block.id || '')) ? String(block.id) : randomUUID(),
    type: block.type,
    enabled: block.enabled !== false,
    variant: String(block.variant || 'default').slice(0, 40),
    data: sanitizeFields(definition.fields, { ...definition.defaults, ...(block.data || {}) }),
  };
}

export function sanitizeDocument(document) {
  const blocks = Array.isArray(document?.blocks) ? document.blocks : [];
  return {
    schemaVersion: 1,
    blocks: blocks.slice(0, 80).map(sanitizeBlock),
  };
}
