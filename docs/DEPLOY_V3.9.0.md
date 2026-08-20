# Установка VIONEX LEADS v3.9.0

Загрузите `vionex-leads-update-v3.9.0.zip` в:

```text
/var/www/bitrix2/data/www/vionex.ru
```

В SSH:

```bash
cd /var/www/bitrix2/data/www/vionex.ru
rm -rf /root/vionex-leads-update-v3.9.0
unzip -q vionex-leads-update-v3.9.0.zip -d /root
cd /root/vionex-leads-update-v3.9.0
bash APPLY_UPDATE.sh
```

Проверка:

```bash
curl -fsS http://127.0.0.1:3101/health
curl -fsS https://vionex.ru/health
systemctl status vionex-leads --no-pager -l
```

Откат:

```bash
cd /root/vionex-leads-update-v3.9.0
bash ROLLBACK.sh
```
