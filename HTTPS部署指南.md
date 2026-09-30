# 只有公网 IP 时给游戏启用 HTTPS

本文从游戏的 `tide-card` systemd 服务**已经自启**开始。假设服务器是 Ubuntu/Debian，游戏在本机 `8080` 端口运行，而且你有一个能从公网访问的固定 IPv4。全文的 `203.0.113.10` 是示例地址，**每处都要换成你的服务器公网 IP**。

现在不必购买域名：Let's Encrypt 已支持免费签发**公网 IP 证书**。这种证书有效期约 6 天，所以自动续期是本流程的必要部分。这里使用 Nginx 接收 80/443 请求，Certbot 申请和续期证书，现有 Node 服务继续运行在 8080。**不要照旧版的“把 IP 直接写进 Caddyfile”做**：Caddy 对 IP 默认可能使用本地 CA 签发证书，其他玩家的浏览器不会自动信任。

## 1. 确认游戏和端口

在服务器上运行：

```sh
sudo systemctl status tide-card --no-pager
curl http://127.0.0.1:8080/api/health
sudo ss -ltnp
```

健康检查应返回 `{"ok":true,"service":"tide-card-game"}`。确认 80 和 443 尚未被其他网站服务占用。如果游戏服务名或端口不同，后续命令中的相应值也要替换。

在云服务商安全组和服务器防火墙开放 **TCP 80、443**。80 用于证书验证和 HTTP 跳转，443 用于游戏 HTTPS；请保留 SSH 使用的端口。若启用了 UFW，可运行：

```sh
sudo ufw status
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

如果服务器没有独立公网 IP、位于无法转发 80/443 的 NAT 后面，或公网 IP 会频繁改变，本流程不能直接套用。

## 2. 安装 Nginx 并提供证书验证路径

```sh
apt update
apt install nginx snapd

mkdir -p /var/www/letsencrypt/.well-known/acme-challengenano /etc/nginx/conf.d/tide-card-ip.conf
```

填入以下**临时 HTTP 配置**，把 IP 换成自己的：

```nginx
server {
    listen 80;
    server_name 203.0.113.10;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
    }

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

检查并启动 Nginx：

```sh
sudo nginx -t
sudo systemctl enable --now nginx
sudo systemctl reload nginx
```

先验证公网可以访问挑战文件：

```sh
printf 'ok\n' | sudo tee /var/www/letsencrypt/.well-known/acme-challenge/check.txt
curl http://203.0.113.10/.well-known/acme-challenge/check.txt
```

应返回 `ok`。最好再用**另一台设备或网络**访问该 HTTP 地址，排除云防火墙只允许本机访问的情况。

## 3. 安装 Certbot 并申请 IP 证书

Certbot 的 IP `webroot` 功能需要 **5.4 或更新版本**。按官方推荐的 snap 方式安装：

```sh
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/local/bin/certbot
certbot --version
```

如果 `/usr/local/bin/certbot` 已经存在，先运行 `certbot --version`，不要重复创建链接；若版本低于 5.4，按 [Certbot 官方安装说明](https://certbot.eff.org/instructions)更新。某些 Debian 系统在首次安装 `snapd` 后需要重新登录或重启才能使用 `snap`。

把 IP 换成自己的，申请正式证书：

```sh
sudo certbot certonly \
  --preferred-profile shortlived \
  --webroot \
  --webroot-path /var/www/letsencrypt \
  --ip-address 67.216.204.198 \
  --cert-name tide-card-ip
```

按提示填写邮箱并同意服务条款。成功后，用以下命令查看证书实际路径：

```sh
sudo certbot certificates
```

下文以 `/etc/letsencrypt/live/tide-card-ip/` 为例；如果输出中的 `Certificate Path`、`Private Key Path` 不同，应使用实际路径。

## 4. 启用 HTTPS 反向代理

再次编辑 `/etc/nginx/conf.d/tide-card-ip.conf`，将内容**完整替换**为以下配置，并替换 IP 与证书路径：

```nginx
server {
    listen 80;
    server_name 203.0.113.10;

    location ^~ /.well-known/acme-challenge/ {
        root /var/www/letsencrypt;
        default_type text/plain;
        try_files $uri =404;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl default_server;
    server_name 203.0.113.10;

    ssl_certificate /etc/letsencrypt/live/tide-card-ip/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/tide-card-ip/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
```

用 IP 访问 HTTPS 时，客户端通常不会发送域名 SNI；`default_server` 让 Nginx 在没有 SNI 的连接上也送出这张 IP 证书。如果 `sudo nginx -t` 提示已有其他 `default_server`，先检查现有 443 站点配置，不能在同一监听地址上重复设置默认站点。

`proxy_buffering off` 用于让游戏的 SSE 实时状态及时传给玩家。检查并加载配置：

```sh
sudo nginx -t
sudo systemctl reload nginx
curl -i https://203.0.113.10/api/health
```

用浏览器打开 `https://203.0.113.10/`，应能正常进入游戏，且浏览器不提示证书错误。两位玩家都使用这个 HTTPS 地址，并在游戏里选“当前页面的服务端”。

## 5. 设置并测试自动续期

Nginx 需要在 Certbot 成功续期后重新加载新证书。创建一个 Certbot 部署钩子：

```sh
sudo nano /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

文件内容：

```sh
#!/bin/sh
systemctl reload nginx
```

保存后执行：

```sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
systemctl list-timers --all | grep certbot
sudo certbot renew --dry-run --run-deploy-hooks
```

确认可以看到 Certbot 续期定时任务，并且演练成功。**不要只做一次申请而跳过续期检查**：IP 证书约 6 天就会到期。Certbot 的部署钩子仅在成功签发或续期后重新加载 Nginx，不会每天重启游戏服务。

HTTPS 验证通过后，可以在云安全组和系统防火墙中取消 **8080 的公网放行**，仅保留 80、443 和 SSH 端口。Nginx 仍会通过服务器本机的 `127.0.0.1:8080` 连接游戏。

## 排查问题

```sh
sudo journalctl -u nginx -n 80 --no-pager
sudo journalctl -u tide-card -n 80 --no-pager
sudo certbot certificates
sudo nginx -t
```

- **申请失败：**确认使用的是公网 IP，80 端口能从外网访问挑战文件，Certbot 版本至少 5.4。
- **HTTPS 返回 502：**检查 `curl http://127.0.0.1:8080/api/health` 是否成功，以及 Nginx 的 `proxy_pass` 端口。
- **浏览器报证书错误：**核对访问的 IP 是否与证书里的 IP 相同、证书是否为正式签发、证书是否已过期。不要用 `curl -k` 或忽略浏览器警告来代替修复。
- **提示证书名称与 IP 不匹配：**分别运行 `sudo openssl x509 -in /etc/letsencrypt/live/tide-card-ip/fullchain.pem -noout -ext subjectAltName` 和 `echo | openssl s_client -connect 203.0.113.10:443 2>/dev/null | openssl x509 -noout -ext subjectAltName`。两处都应包含 `IP Address:203.0.113.10`；若只有前者正确，检查 443 站点的 `default_server` 和证书路径，然后 `sudo nginx -t && sudo systemctl reload nginx`。
- **续期失败：**查看 `sudo certbot renew --dry-run --run-deploy-hooks` 的输出，确认 80 端口和挑战路径持续可用。

## 官方资料

- [Let's Encrypt：IP 证书已开放、有效期约 6 天](https://letsencrypt.org/2026/01/15/6day-and-ip-general-availability)
- [Let's Encrypt：Certbot 申请 IP 证书的版本、命令与续期说明](https://letsencrypt.org/2026/03/11/shorter-certs-certbot)
- [Certbot 官方安装说明](https://certbot.eff.org/instructions)
- [Certbot 官方续期钩子说明](https://eff-certbot.readthedocs.io/en/stable/using.html)
