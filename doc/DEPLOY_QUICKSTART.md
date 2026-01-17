# 🚀 部署快速入门

## 一、服务器端操作（首次部署）

### 1. 生成 SSL 证书
```bash
ssh root@47.96.4.107

# 自签名证书（测试用）
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/vocabulary_app.key \
  -out /etc/ssl/certs/vocabulary_app.crt \
  -subj "/C=CN/ST=State/L=City/O=Organization/CN=47.96.4.107"

sudo chmod 600 /etc/ssl/private/vocabulary_app.key
sudo chmod 644 /etc/ssl/certs/vocabulary_app.crt
```

### 2. 生成 GitHub Actions 密钥
```bash
ssh-keygen -t ed25519 -C "github-actions" -f ~/.ssh/vocabulary_app_deploy -N ""
cat ~/.ssh/vocabulary_app_deploy.pub >> ~/.ssh/authorized_keys

# 显示私钥（复制到 GitHub Secrets）
cat ~/.ssh/vocabulary_app_deploy
```

### 3. 克隆并初始化项目
```bash
cd /root
git clone https://github.com/YOUR_USERNAME/vocabulary_app.git
cd vocabulary_app

# Python 环境
python3 -m venv .venv
source .venv/bin/activate
pip install -r web_app/requirements.txt

# 前端依赖
cd vue_project && npm install && cd ..
chmod +x start-production.sh
```

### 4. 配置 Nginx
```bash
sudo cp nginx-vocabulary-app.conf /etc/nginx/sites-available/vocabulary_app
sudo ln -s /etc/nginx/sites-available/vocabulary_app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 5. 启动服务
```bash
./start-production.sh deploy
```

---

## 二、GitHub 配置

访问：`https://github.com/YOUR_USERNAME/vocabulary_app/settings/secrets/actions`

添加以下 Secrets：

| Name | Value |
|------|-------|
| VPS_HOST | 47.96.4.107 |
| VPS_USER | root |
| VPS_PORT | 22 |
| VPS_SSH_KEY | 步骤 2 的私钥内容 |

---

## 三、本地推送触发部署

```bash
git add .
git commit -m "Your changes"
git push origin main
```

推送后自动部署！查看进度：`https://github.com/YOUR_USERNAME/vocabulary_app/actions`

---

## 四、常用命令

### 服务管理
```bash
./start-production.sh deploy    # 完整部署
./start-production.sh build     # 只构建前端
./start-production.sh restart   # 重启后端
./start-production.sh status    # 查看状态
```

### 日志查看
```bash
tail -f logs/backend.log                              # 后端日志
sudo tail -f /var/log/nginx/vocabulary_app_error.log  # Nginx 日志
```

### 验证
```bash
curl http://localhost:5001/api/health   # 检查后端
sudo nginx -t                           # 检查 Nginx 配置
```

---

## 五、故障排查

```bash
# 后端无法启动
ps aux | grep python
./start-production.sh restart

# 前端无法访问
ls -la /var/www/vocabulary_app/
./start-production.sh build

# Nginx 错误
sudo nginx -t
sudo systemctl status nginx
```

---

完整文档请查看 [DEPLOYMENT.md](DEPLOYMENT.md)
