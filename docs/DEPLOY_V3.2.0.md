# Обновление VIONEX LEADS до v3.2.0

Используйте архив `vionex-leads-update-v3.2.0.zip`. Он сохраняет `.env`, каталог `data`, базу CMS, загруженные изображения, заявки и журналы.

## Установка

```bash
cd /var/www/bitrix2/data/www/vionex.ru
ls -lh vionex-leads-update-v3.2.0.zip
rm -rf /root/vionex-leads-update-v3.2.0
unzip -q vionex-leads-update-v3.2.0.zip -d /root
cd /root/vionex-leads-update-v3.2.0
bash APPLY_UPDATE.sh
```

Ожидаемый финал:

```text
[vionex-update] Update completed successfully
```

## Проверка

```bash
curl -fsS http://127.0.0.1:3101/health
curl -fsS https://vionex.ru/health
systemctl status vionex-leads --no-pager -l
```

Health-check должен вернуть `version: 3.2.0` и `cms: true`.

Откройте `https://vionex.ru`, нажмите `Ctrl+F5` и проверьте блок «Наши возможности» в темной и светлой теме.

## Откат

```bash
cd /root/vionex-leads-update-v3.2.0
bash ROLLBACK.sh
```

Последняя резервная копия хранится по пути, указанному в `/var/backups/vionex-leads/LAST_BACKUP`.
