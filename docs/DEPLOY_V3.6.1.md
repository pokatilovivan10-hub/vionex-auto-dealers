# Обновление VIONEX LEADS до v3.6.1

Используйте архив `vionex-leads-update-v3.6.1.zip`.

## Установка

```bash
cd /var/www/bitrix2/data/www/vionex.ru
ls -lh vionex-leads-update-v3.6.1.zip
rm -rf /root/vionex-leads-update-v3.6.1
unzip -q vionex-leads-update-v3.6.1.zip -d /root
cd /root/vionex-leads-update-v3.6.1
bash APPLY_UPDATE.sh
```

## Проверка

```bash
curl -fsS http://127.0.0.1:3101/health
curl -fsS https://vionex.ru/health
systemctl status vionex-leads --no-pager -l
```

Ожидаемая версия:

```json
{"ok":true,"service":"vionex-leads-site","version":"3.6.1","mode":"demo","cms":true}
```

Фактическое значение `mode` берётся из существующего `.env`.

## Сохранение данных

Сценарий обновления не заменяет:

- `.env`;
- `data/cms.sqlite`;
- `data/uploads`;
- заявки и логи;
- пользователей и настройки админки.

## Откат

```bash
cd /root/vionex-leads-update-v3.6.1
bash ROLLBACK.sh
```
