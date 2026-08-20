# Обновление VIONEX LEADS до v3.5.0

## Что меняется

- секция кейсов выводится без общей рамки и подложки;
- сохраняется динамический 3D-слайдер из восьми кейсов;
- добавляется блок «Форматы работы» с тремя планами и таблицей сравнения;
- CMS и текущая серверная архитектура сохраняются.

## Что установщик не изменяет

- `.env`;
- `data/`;
- CMS-базу и пользователей;
- загруженные изображения;
- заявки и события;
- Nginx, SSL и systemd-конфигурацию.

## Установка

Загрузите `vionex-leads-update-v3.5.0.zip` в:

```text
/var/www/bitrix2/data/www/vionex.ru
```

Выполняйте команды по одной:

```bash
cd /var/www/bitrix2/data/www/vionex.ru
```

```bash
ls -lh vionex-leads-update-v3.5.0.zip
```

```bash
rm -rf /root/vionex-leads-update-v3.5.0
```

```bash
unzip -q vionex-leads-update-v3.5.0.zip -d /root
```

```bash
cd /root/vionex-leads-update-v3.5.0
```

```bash
bash APPLY_UPDATE.sh
```

Ожидаемый финал:

```text
[vionex-update] Update completed successfully
```

## Проверка

```bash
curl -fsS http://127.0.0.1:3101/health
```

Ожидается:

```json
{"ok":true,"service":"vionex-leads-site","version":"3.5.0","mode":"demo","cms":true}
```

Фактическое значение `mode` зависит от существующего `.env`.

```bash
curl -fsS https://vionex.ru/health
```

```bash
systemctl status vionex-leads --no-pager -l
```

После установки откройте `https://vionex.ru` и выполните `Ctrl + F5`.

## Откат

```bash
cd /root/vionex-leads-update-v3.5.0
```

```bash
bash ROLLBACK.sh
```

Последний путь резервной копии также сохраняется в:

```text
/var/backups/vionex-leads/LAST_BACKUP
```

## После успешной проверки

```bash
rm -f /var/www/bitrix2/data/www/vionex.ru/vionex-leads-update-v3.5.0.zip
```

```bash
rm -rf /root/vionex-leads-update-v3.5.0
```
