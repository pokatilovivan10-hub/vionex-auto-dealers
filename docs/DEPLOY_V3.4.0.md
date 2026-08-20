# Обновление VIONEX LEADS до v3.4.0

## Для какого сервера подготовлено обновление

Текущая рабочая схема:

```text
Nginx / HTTPS → Node.js 127.0.0.1:3101 → vionex-leads.service
```

Каталог приложения:

```text
/var/www/bitrix2/data/www/vionex.ru
```

Обновление не меняет Nginx, SSL, systemd-службу и `.env`.

## Что сохраняется

Установщик сохраняет:

- `.env`;
- `data/cms.sqlite` и служебные WAL-файлы;
- администраторов и сессии CMS;
- страницы, материалы и настройки;
- `data/uploads/`;
- `data/leads.ndjson`;
- `data/events.ndjson`;
- остальные пользовательские данные в `data/`.

Перед заменой файлов создаётся резервная копия приложения и отдельный снимок CMS-базы.

## Установка

Загрузите архив:

```text
vionex-leads-update-v3.4.0.zip
```

в каталог:

```text
/var/www/bitrix2/data/www/vionex.ru
```

В SSH выполняйте команды по одной.

```bash
cd /var/www/bitrix2/data/www/vionex.ru
```

```bash
ls -lh vionex-leads-update-v3.4.0.zip
```

```bash
rm -rf /root/vionex-leads-update-v3.4.0
```

```bash
unzip -q vionex-leads-update-v3.4.0.zip -d /root
```

```bash
cd /root/vionex-leads-update-v3.4.0
```

```bash
bash APPLY_UPDATE.sh
```

Успешный финал:

```text
[vionex-update] Update completed successfully
```

Устанавливать npm-пакеты не требуется.

## Проверка

Локальный сервис:

```bash
curl -fsS http://127.0.0.1:3101/health
```

Ожидается:

```json
{"ok":true,"service":"vionex-leads-site","version":"3.4.0","mode":"demo","cms":true}
```

Значение `mode` будет соответствовать существующему `.env`.

Служба:

```bash
systemctl status vionex-leads --no-pager -l
```

Домен:

```bash
curl -fsS https://vionex.ru/health
```

После этого откройте сайт и выполните жёсткое обновление:

```text
Ctrl + F5
```

Проверьте:

1. центральный активный кейс `MOTORAENA`;
2. `AURA AUTO` слева;
3. `LEASEFORGE` справа;
4. переключение стрелками и точками;
5. автопрокрутку;
6. мобильную версию;
7. вход в `https://vionex.ru/admin`.

## Откат

Установщик записывает путь к последней резервной копии в:

```text
/var/backups/vionex-leads/LAST_BACKUP
```

Ручной откат:

```bash
cd /root/vionex-leads-update-v3.4.0
```

```bash
bash ROLLBACK.sh
```

После отката:

```bash
curl -fsS http://127.0.0.1:3101/health
```

## Очистка установочных файлов

Только после успешной проверки:

```bash
rm -f /var/www/bitrix2/data/www/vionex.ru/vionex-leads-update-v3.4.0.zip
```

```bash
rm -rf /root/vionex-leads-update-v3.4.0
```

Последнюю резервную копию сразу не удаляйте.
