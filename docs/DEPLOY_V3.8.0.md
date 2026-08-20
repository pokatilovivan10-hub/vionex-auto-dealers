# Обновление VIONEX LEADS до v3.8.0

Обновление рассчитано на текущую схему:

```text
Nginx/HTTPS → Node.js 127.0.0.1:3101 → vionex-leads.service
```

## Что сохраняется

- `.env`;
- `data/cms.sqlite`;
- администраторы и сессии;
- `data/uploads/`;
- `data/leads.ndjson`;
- логи и настройки Nginx;
- SSL и systemd-служба.

## Установка

Загрузите `vionex-leads-update-v3.8.0.zip` в:

```text
/var/www/bitrix2/data/www/vionex.ru
```

Выполняйте команды по одной:

```bash
cd /var/www/bitrix2/data/www/vionex.ru
```

```bash
ls -lh vionex-leads-update-v3.8.0.zip
```

```bash
rm -rf /root/vionex-leads-update-v3.8.0
```

```bash
unzip -q vionex-leads-update-v3.8.0.zip -d /root
```

```bash
cd /root/vionex-leads-update-v3.8.0
```

```bash
bash APPLY_UPDATE.sh
```

Успешный результат:

```text
[vionex-update] Update completed successfully
```

## Проверка

```bash
curl -fsS http://127.0.0.1:3101/health
```

Ожидается:

```json
{"ok":true,"service":"vionex-leads-site","version":"3.8.0","mode":"demo","cms":true}
```

Значение `mode` соответствует существующему `.env`.

```bash
curl -fsS https://vionex.ru/health
```

```bash
systemctl status vionex-leads --no-pager -l
```

Откройте:

```text
https://vionex.ru/services/auto-dealers
```

и выполните принудительное обновление браузера `Ctrl + F5`.

## Проверка формы

После визуальной проверки отправьте одну тестовую заявку. Проверьте локальное резервное сохранение:

```bash
tail -n 3 /var/www/bitrix2/data/www/vionex.ru/data/leads.ndjson
```

Если настроен webhook/CRM, отдельно убедитесь, что тестовая заявка появилась в нужной воронке и содержит UTM, страницу, компанию и комментарий.

## Откат

```bash
cd /root/vionex-leads-update-v3.8.0
```

```bash
bash ROLLBACK.sh
```

Последняя резервная копия также фиксируется в:

```text
/var/backups/vionex-leads/LAST_BACKUP
```
