# Обновление VIONEX LEADS до v3.6.0

Используйте архив `vionex-leads-update-v3.6.0.zip`.

## Установка

Выполняйте команды по одной:

```bash
cd /var/www/bitrix2/data/www/vionex.ru
ls -lh vionex-leads-update-v3.6.0.zip
rm -rf /root/vionex-leads-update-v3.6.0
unzip -q vionex-leads-update-v3.6.0.zip -d /root
cd /root/vionex-leads-update-v3.6.0
bash APPLY_UPDATE.sh
```

Успешный результат:

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
{"ok":true,"service":"vionex-leads-site","version":"3.6.0","mode":"demo","cms":true}
```

После установки откройте `https://vionex.ru` и выполните `Ctrl + F5`.

## Откат

```bash
cd /root/vionex-leads-update-v3.6.0
bash ROLLBACK.sh
```

`.env`, `data/cms.sqlite`, заявки и `data/uploads` при обновлении сохраняются.
