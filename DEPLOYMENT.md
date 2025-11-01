# Vocabulary App 生产环境部署文档

## 📋 架构概述

### 技术栈
- **前端**: Vue 3 + TypeScript + Vite
- **后端**: Flask + Socket.io (Python)
- **Web 服务器**: Nginx (HTTPS + 反向代理)
- **数据库**: SQLite
- **音频处理**: Whisper.cpp

### 生产环境架构
```
用户浏览器 (HTTPS)
    ↓
Nginx :443 (HTTPS)
    ├─→ 静态文件: /var/www/vocabulary_app (前端构建文件)
    ├─→ API 代理: http://localhost:5001/api (后端 Flask)
    └─→ WebSocket: http://localhost:5001/socket.io
```

### 端口说明
- `443` - Nginx HTTPS 入口
- `80` - HTTP 自动重定向到 HTTPS
- `5001` - 后端 Flask API (仅 localhost 访问)

---

## 🚀 初次部署步骤

### 1. 生成 SSL 证书

#### 方式一：自签名证书（测试用）
```bash
ssh root@47.96.4.107

sudo mkdir -p /etc/ssl/private
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/vocabulary_app.key \
  -out /etc/ssl/certs/vocabulary_app.crt \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=47.96.4.107"

sudo chmod 600 /etc/ssl/private/vocabulary_app.key
sudo chmod 644 /etc/ssl/certs/vocabulary_app.crt
```

#### 方式二：Let's Encrypt 免费证书（推荐，需要域名）
```bash
# 安装 certbot
sudo apt update
sudo apt install certbot python3-certbot-nginx -y

# 申请证书（需要先将域名解析到服务器 IP）
sudo certbot --nginx -d yourdomain.com

# 修改 nginx-vocabulary-app.conf 中的证书路径为：
# ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
# ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

---

### 2. 生成 GitHub Actions 部署密钥

```bash
# 在服务器上生成 SSH 密钥对
ssh-keygen -t ed25519 -C "github-actions-vocabulary-app" \
  -f ~/.ssh/vocabulary_app_deploy -N ""

# 添加公钥到 authorized_keys
cat ~/.ssh/vocabulary_app_deploy.pub >> ~/.ssh/authorized_keys

# 设置权限
chmod 600 ~/.ssh/vocabulary_app_deploy
chmod 644 ~/.ssh/vocabulary_app_deploy.pub
chmod 600 ~/.ssh/authorized_keys

# 显示私钥（复制到 GitHub Secrets）
echo "========================================"
echo "复制以下私钥内容到 GitHub Secrets"
echo "========================================"
cat ~/.ssh/vocabulary_app_deploy
```

---

### 3. 在 GitHub 上配置 Secrets

访问：`https://github.com/YOUR_USERNAME/vocabulary_app/settings/secrets/actions`

点击 **"New repository secret"**，添加以下 4 个 secrets：

| Secret Name | Value | 说明 |
|------------|-------|------|
| `VPS_HOST` | `47.96.4.107` | 服务器 IP 地址 |
| `VPS_USER` | `root` | SSH 登录用户名 |
| `VPS_PORT` | `22` | SSH 端口 |
| `VPS_SSH_KEY` | `<私钥内容>` | 步骤 2 生成的私钥完整内容 |

**重要**: `VPS_SSH_KEY` 需要复制从 `-----BEGIN OPENSSH PRIVATE KEY-----` 到 `-----END OPENSSH PRIVATE KEY-----` 的完整内容（包括这两行）

---

### 4. 在服务器上克隆项目

```bash
# 克隆项目到服务器
cd /root
git clone https://github.com/YOUR_USERNAME/vocabulary_app.git
cd vocabulary_app

# 创建 Python 虚拟环境
python3 -m venv .venv
source .venv/bin/activate
pip install -r web_app/requirements.txt

# 安装前端依赖
cd vue_project
npm install
cd ..

# 给启动脚本添加执行权限
chmod +x start-production.sh
```

---

### 5. 配置 Nginx

```bash
# 复制 Nginx 配置文件
sudo cp /root/vocabulary_app/nginx-vocabulary-app.conf \
  /etc/nginx/sites-available/vocabulary_app

# 创建软链接启用站点
sudo ln -s /etc/nginx/sites-available/vocabulary_app \
  /etc/nginx/sites-enabled/vocabulary_app

# 测试配置是否正确
sudo nginx -t

# 如果测试通过，重载 Nginx
sudo systemctl reload nginx

# 检查 Nginx 状态
sudo systemctl status nginx
```

---

### 6. 初次部署

```bash
cd /root/vocabulary_app

# 执行完整部署（构建前端 + 启动后端 + 重载 Nginx）
./start-production.sh deploy

# 查看服务状态
./start-production.sh status
```

---

### 7. 验证部署

```bash
# 检查后端 API
curl http://localhost:5001/api/health

# 检查前端静态文件
ls -la /var/www/vocabulary_app/

# 检查进程
ps aux | grep "python -m web_app.app"

# 查看日志
tail -f logs/backend.log

# 浏览器访问
# https://47.96.4.107
```

---

## 🔄 日常更新部署

### 自动部署（推荐）

```bash
# 本地开发完成后，提交并推送到 main 分支
git add .
git commit -m "Your commit message"
git push origin main
```

推送后，GitHub Actions 会自动：
1. SSH 连接到服务器
2. 拉取最新代码
3. 更新依赖
4. 构建前端
5. 重启后端
6. 重载 Nginx

查看部署进度：`https://github.com/YOUR_USERNAME/vocabulary_app/actions`

---

### 手动部署

如果需要在服务器上手动部署：

```bash
cd /root/vocabulary_app

# 拉取最新代码
git pull origin main

# 更新 Python 依赖
source .venv/bin/activate
pip install -r web_app/requirements.txt

# 更新前端依赖
cd vue_project
npm install
cd ..

# 执行完整部署
./start-production.sh deploy
```

---

## 📝 启动脚本使用指南

### start-production.sh 命令

```bash
# 完整部署（构建前端 + 重启后端 + 重载 Nginx）
./start-production.sh deploy

# 只构建并部署前端
./start-production.sh build

# 只启动后端
./start-production.sh start

# 只停止后端
./start-production.sh stop

# 重启后端
./start-production.sh restart

# 查看服务状态
./start-production.sh status

# 查看帮助
./start-production.sh help
```

### 服务状态说明

运行 `./start-production.sh status` 会显示：

```
==========================================
生产环境服务状态
==========================================

后端 API: 运行中 (PID: 12345)
  地址: http://localhost:5001
  日志: /root/vocabulary_app/logs/backend.log

前端: 由 Nginx 提供静态文件
  构建文件: ✓ 存在
  Nginx 目录: ✓ 已部署

Nginx: 运行中
  HTTPS 访问: https://47.96.4.107

==========================================
```

---

## 🔍 日志和监控

### 查看日志

```bash
# 后端日志
tail -f /root/vocabulary_app/logs/backend.log

# Nginx 访问日志
sudo tail -f /var/log/nginx/vocabulary_app_access.log

# Nginx 错误日志
sudo tail -f /var/log/nginx/vocabulary_app_error.log

# 查看最近 100 行后端日志
tail -n 100 /root/vocabulary_app/logs/backend.log
```

### 检查进程

```bash
# 检查后端进程
ps aux | grep "python -m web_app.app"

# 检查 Nginx 进程
ps aux | grep nginx

# 检查端口占用
lsof -i :5001    # 后端端口
lsof -i :443     # HTTPS 端口
lsof -i :80      # HTTP 端口
```

---

## ❗ 常见问题排查

### 1. 前端无法访问

```bash
# 检查 Nginx 状态
sudo systemctl status nginx

# 检查静态文件是否存在
ls -la /var/www/vocabulary_app/

# 重新构建并部署前端
cd /root/vocabulary_app
./start-production.sh build
```

### 2. 后端 API 报错

```bash
# 查看后端日志
tail -f /root/vocabulary_app/logs/backend.log

# 检查后端进程
ps aux | grep "python -m web_app.app"

# 重启后端
cd /root/vocabulary_app
./start-production.sh restart
```

### 3. SSL 证书问题

```bash
# 检查证书文件是否存在
ls -la /etc/ssl/certs/vocabulary_app.crt
ls -la /etc/ssl/private/vocabulary_app.key

# 检查证书权限
sudo chmod 644 /etc/ssl/certs/vocabulary_app.crt
sudo chmod 600 /etc/ssl/private/vocabulary_app.key

# 测试 Nginx 配置
sudo nginx -t
```

### 4. GitHub Actions 部署失败

```bash
# 在服务器上检查 SSH 密钥权限
chmod 600 ~/.ssh/vocabulary_app_deploy
chmod 644 ~/.ssh/vocabulary_app_deploy.pub
chmod 600 ~/.ssh/authorized_keys
chmod 700 ~/.ssh

# 测试 SSH 连接
ssh -i ~/.ssh/vocabulary_app_deploy root@47.96.4.107

# 查看 GitHub Actions 日志
# 访问：https://github.com/YOUR_USERNAME/vocabulary_app/actions
```

### 5. 端口被占用

```bash
# 查看 5001 端口占用
lsof -i :5001

# 强制停止后端
pkill -f "python -m web_app.app"

# 重新启动
./start-production.sh start
```

### 6. 数据库问题

```bash
# 检查数据库文件
ls -la /root/vocabulary_app/vocabulary.db

# 如果数据库损坏，从备份恢复
# (建议定期备份 vocabulary.db)
```

---

## 🔐 安全建议

### 1. 防火墙配置

```bash
# 只开放必要端口
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (重定向到 HTTPS)
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
sudo ufw status
```

### 2. 定期更新

```bash
# 更新系统包
sudo apt update
sudo apt upgrade -y

# 更新 Python 依赖
cd /root/vocabulary_app
source .venv/bin/activate
pip install --upgrade pip
pip list --outdated
```

### 3. 备份数据库

```bash
# 创建备份目录
mkdir -p /root/backups

# 备份数据库
cp /root/vocabulary_app/vocabulary.db \
   /root/backups/vocabulary_$(date +%Y%m%d_%H%M%S).db

# 设置定时备份（可选）
crontab -e
# 添加：0 2 * * * cp /root/vocabulary_app/vocabulary.db /root/backups/vocabulary_$(date +\%Y\%m\%d).db
```

---

## 📊 性能优化

### 1. Nginx 优化（已包含在配置中）

- ✅ Gzip 压缩
- ✅ 静态资源缓存（7天）
- ✅ HTTP/2 支持

### 2. 后端优化建议

```bash
# 使用 Gunicorn 替代 Flask 开发服务器（可选）
pip install gunicorn
gunicorn -w 4 -b 127.0.0.1:5001 web_app.app:app
```

---

## 📞 联系和支持

- **GitHub Issues**: 报告 bug 或功能请求
- **项目文档**: 查看 `CLAUDE.md` 了解开发说明

---

## 📄 文件说明

### 关键配置文件

| 文件 | 说明 |
|------|------|
| `start-production.sh` | 生产环境启动脚本 |
| `nginx-vocabulary-app.conf` | Nginx 配置文件 |
| `.github/workflows/deploy.yml` | GitHub Actions 自动部署配置 |
| `vue_project/vite.config.ts` | Vite 构建配置 |
| `web_app/requirements.txt` | Python 依赖 |

### 数据目录

| 目录/文件 | 说明 |
|----------|------|
| `/var/www/vocabulary_app/` | 前端静态文件部署目录 |
| `logs/backend.log` | 后端运行日志 |
| `.pids/backend.pid` | 后端进程 PID |
| `vocabulary.db` | SQLite 数据库（不在 git 中）|

---

## 🎯 快速参考

```bash
# 完整部署
./start-production.sh deploy

# 查看状态
./start-production.sh status

# 查看日志
tail -f logs/backend.log

# 重启服务
./start-production.sh restart

# 测试 API
curl http://localhost:5001/api/health

# 重载 Nginx
sudo systemctl reload nginx
```

---

**最后更新**: 2025-11-01
