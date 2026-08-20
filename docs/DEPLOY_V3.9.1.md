# Установка VIONEX LEADS v3.9.1

Загрузите `vionex-leads-update-v3.9.1.zip` в:

```text
/var/www/bitrix2/data/www/vionex.ru
```

Выполните по SSH:

```bash
cd /var/www/bitrix2/data/www/vionex.ru
ls -lh vionex-leads-update-v3.9.1.zip
rm -rf /root/vionex-leads-update-v3.9.1
unzip -q vionex-leads-update-v3.9.1.zip -d /root
cd /root/vionex-leads-update-v3.9.1
bash APPLY_UPDATE.sh
```

Проверка:

```bash
curl -fsS http://127.0.0.1:3101/health
curl -fsS https://vionex.ru/health
systemctl status vionex-leads --no-pager -l
```

Ожидаемая версия: `3.9.1`.

Откат:

```bash
cd /root/vionex-leads-update-v3.9.1
bash ROLLBACK.sh
```
