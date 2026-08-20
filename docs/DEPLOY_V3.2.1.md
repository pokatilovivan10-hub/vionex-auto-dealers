# Обновление VIONEX LEADS до v3.2.1

Используйте архив `vionex-leads-update-v3.2.1.zip`. Он исправляет смешивание динамической планеты с фоном в светлой теме и сохраняет `.env`, CMS, пользователей, материалы, изображения и заявки.

## Установка

Выполняйте команды по одной:

```bash
cd /var/www/bitrix2/data/www/vionex.ru
ls -lh vionex-leads-update-v3.2.1.zip
rm -rf /root/vionex-leads-update-v3.2.1
unzip -q vionex-leads-update-v3.2.1.zip -d /root
cd /root/vionex-leads-update-v3.2.1
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

Health-check должен вернуть:

```json
{"ok":true,"service":"vionex-leads-site","version":"3.2.1","mode":"demo","cms":true}
```

Значение `mode` зависит от существующего `.env`.

Откройте `https://vionex.ru`, включите светлую тему и выполните `Ctrl + F5`. Между текстовой частью Hero и динамической планетой не должно быть вертикальной или прямоугольной границы.

## Откат

```bash
cd /root/vionex-leads-update-v3.2.1
bash ROLLBACK.sh
```

Путь последней резервной копии хранится в `/var/backups/vionex-leads/LAST_BACKUP`.
