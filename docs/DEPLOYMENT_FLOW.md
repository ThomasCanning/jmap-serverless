# Deployment guide

1. Configure deployment settings:
```bash
cp config.mk.example config.mk
# Edit config.mk: set REGION, ROOT_DOMAIN, ALLOWED_ORIGINS

cp .env.example .env
# Edit .env: set ADMIN_USERNAME, ADMIN_PASSWORD
```

2. Configure AWS credentials:
```bash
aws configure sso
```

3. Run initial deployment:
```bash
source .env
make deploy
```

4. Create the 2 validation DNS records at your DNS provider. Records are in `dns-records.txt`.
   Note: Record names are shown without the zone suffix (most providers add it automatically).

5. Wait until DNS records propagate, you can verify with:
```bash
make validate-dns
```

6. Once both certificates show `ISSUED`, complete deployment:
```bash
make deploy
```

7. Create the 3 permanent DNS records at your DNS provider. Records are in `dns-records.txt`:
   - `jmap` CNAME
   - `@` CNAME (root domain)
   - `_jmap._tcp` SRV
   Note: Record names are shown without the zone suffix (most providers add it automatically).

8. Wait for DNS propagation, you can verify with:
```bash
make validate-dns
```


