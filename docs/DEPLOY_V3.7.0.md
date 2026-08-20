# Установка VIONEX LEADS v3.7.0

Для действующего сервера используется `vionex-leads-update-v3.7.0.zip`.

## Обновление

```bash
cd /var/www/bitrix2/data/www/vionex.ru
rm -rf /root/vionex-leads-update-v3.7.0
unzip -q vionex-leads-update-v3.7.0.zip -d /root
cd /root/vionex-leads-update-v3.7.0
bash APPLY_UPDATE.sh
```

Установщик сохраняет `.env`, `data/`, `cms.sqlite`, загруженные изображения и заявки; создаёт резервную копию, запускает тесты, перезапускает `vionex-leads.service` и проверяет health endpoint.

## Проверка

```bash
curl -fsS http://127.0.0.1:3101/health
curl -fsS https://vionex.ru/health
systemctl status vionex-leads --no-pager -l
```

Ожидаемая версия: `3.7.0`.

Откройте:

`https://vionex.ru/services/auto-dealers`

После установки выполните `Ctrl + F5`.

## Откат

```bash
cd /root/vionex-leads-update-v3.7.0
bash ROLLBACK.sh
```

## После публикации

1. В админке заменить типовые параметры на подтверждённые показатели, если они будут предоставлены.
2. Указать реальный видеокейс или оставить согласованную заглушку.
3. Проверить webhook/CRM на тестовой заявке.
4. Проверить цели Яндекс.Метрики и Google Analytics в подключённых счётчиках.
5. Запустить PageSpeed Insights на боевом URL.
