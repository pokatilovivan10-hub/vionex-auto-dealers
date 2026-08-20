# Test report — VIONEX LEADS v3.9.2

## Автоматическая проверка
- `npm run check`: PASS
- Node test suite: 16/16 PASS
- Health endpoint: version `3.9.2`, `cms=true`
- Публичный маршрут `/services/auto-dealers`: PASS
- Default hero image: `/assets/img/auto-dealers-hero-v392.webp`
- Secret scan: PASS

## Проверки изменения
- Hero visual: border 0, background transparent, box-shadow none.
- Hero image uses `object-fit: contain` and alpha-fade; жесткий crop не используется.
- Локальные v3.9.2 dark/light WebP присутствуют в пакете.
- CMS migration v3.9.2 меняет только стандартный v3.9.1 hero asset и не заменяет кастомный media path.
- Отдельный migration test подтверждает замену default asset и сохранение custom media.

## Ограничение локальной среды
Chromium в среде сборки не завершает headless screenshot из-за системного DBus/zygote окружения. Поэтому финальная визуальная проверка на боевом домене выполняется после установки через Ctrl+F5. Автоматические структурные и серверные проверки пройдены полностью.
