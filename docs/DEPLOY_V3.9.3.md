# Установка VIONEX LEADS v3.9.3

Загрузить `vionex-leads-update-v3.9.3.zip` в:

`/var/www/bitrix2/data/www/vionex.ru`

После этого выполнять по SSH каждую команду отдельно:

```bash
cd /var/www/bitrix2/data/www/vionex.ru
```

```bash
ls -lh vionex-leads-update-v3.9.3.zip
```

```bash
unzip -t vionex-leads-update-v3.9.3.zip
```

```bash
rm -rf /root/vionex-leads-update-v3.9.3
```

```bash
unzip -q vionex-leads-update-v3.9.3.zip -d /root
```

```bash
cd /root/vionex-leads-update-v3.9.3
```

```bash
bash APPLY_UPDATE.sh
```

Проверка:

```bash
curl -fsS http://127.0.0.1:3101/health
```

```bash
curl -fsS https://vionex.ru/health
```

```bash
systemctl status vionex-leads --no-pager -l
```

Откат:

```bash
cd /root/vionex-leads-update-v3.9.3
```

```bash
bash ROLLBACK.sh
```
