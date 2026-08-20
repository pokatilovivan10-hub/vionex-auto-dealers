# Обновление VIONEX LEADS до v3.8.1

Схема сервера:

```text
Nginx/HTTPS → Node.js 127.0.0.1:3101 → vionex-leads.service
```

## Что сохраняется

- `.env`;
- `data/cms.sqlite`;
- администраторы и сессии;
- `data/uploads/`;
- `data/leads.ndjson`;
- логи, Nginx и SSL.

## Установка

Загрузите `vionex-leads-update-v3.8.1.zip` в:

```text
/var/www/bitrix2/data/www/vionex.ru
```

Выполните:

```bash
cd /var/www/bitrix2/data/www/vionex.ru
rm -rf /root/vionex-leads-update-v3.8.1
unzip -q vionex-leads-update-v3.8.1.zip -d /root
cd /root/vionex-leads-update-v3.8.1
bash APPLY_UPDATE.sh
```

Ожидаемая финальная строка:

```text
[vionex-update] Update completed successfully
```

## Проверка

```bash
curl -fsS http://127.0.0.1:3101/health
curl -fsS https://vionex.ru/health
systemctl status vionex-leads --no-pager -l
```

Ожидаемая версия:

```json
{"ok":true,"service":"vionex-leads-site","version":"3.8.1","cms":true}
```

Откройте:

```text
https://vionex.ru/services/auto-dealers
```

Нажмите `Ctrl + F5`.

## Откат

```bash
cd /root/vionex-leads-update-v3.8.1
bash ROLLBACK.sh
```

Последняя резервная копия:

```text
/var/backups/vionex-leads/LAST_BACKUP
```
