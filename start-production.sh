#!/bin/bash

# Vocabulary App - 生产环境启动脚本
# 用法: ./start-production.sh {start|stop|restart|status}
# 说明: 生产环境使用 Nginx 提供 HTTPS 和静态文件，只需启动后端

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/web_app"

PID_DIR="$PROJECT_ROOT/.pids"
LOG_DIR="$PROJECT_ROOT/logs"
BACKEND_PID="$PID_DIR/backend.pid"

mkdir -p "$PID_DIR" "$LOG_DIR"

# 检查进程是否运行
is_running() {
    local pid_file=$1
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            rm -f "$pid_file"
        fi
    fi
    return 1
}

# 启动后端
start_backend() {
    echo "启动后端服务..."

    if is_running "$BACKEND_PID"; then
        echo "✓ 后端已在运行 (PID: $(cat $BACKEND_PID))"
        return 0
    fi

    # 检查虚拟环境
    if [ ! -d "$PROJECT_ROOT/.venv" ]; then
        echo "创建虚拟环境..."
        cd "$PROJECT_ROOT"
        python3 -m venv .venv
        .venv/bin/pip install -r web_app/requirements.txt
    fi

    cd "$PROJECT_ROOT"
    source .venv/bin/activate
    nohup python -m web_app.app > "$LOG_DIR/backend.log" 2>&1 &
    echo $! > "$BACKEND_PID"
    sleep 2

    if is_running "$BACKEND_PID"; then
        echo "✓ 后端启动成功 (PID: $(cat $BACKEND_PID))"
        echo "  API: http://localhost:5001"
        echo "  日志: $LOG_DIR/backend.log"
    else
        echo "✗ 后端启动失败，查看日志: $LOG_DIR/backend.log"
        return 1
    fi
}

# 构建前端
build_frontend() {
    echo "构建前端静态文件..."

    if [ ! -d "$PROJECT_ROOT/vue_project/node_modules" ]; then
        echo "安装前端依赖..."
        cd "$PROJECT_ROOT/vue_project"
        npm install
    fi

    echo "运行 npm run build..."
    cd "$PROJECT_ROOT/vue_project"
    npm run build

    if [ $? -eq 0 ]; then
        echo "✓ 前端构建成功"
        echo "  构建目录: $PROJECT_ROOT/vue_project/dist"

        # 复制到 Nginx 目录
        echo "复制静态文件到 Nginx 目录..."
        sudo mkdir -p /var/www/vocabulary_app
        sudo cp -r dist/* /var/www/vocabulary_app/
        sudo chown -R www-data:www-data /var/www/vocabulary_app
        echo "✓ 静态文件已部署到 /var/www/vocabulary_app"
    else
        echo "✗ 前端构建失败"
        return 1
    fi

    cd "$PROJECT_ROOT"
}

# 停止后端
stop_backend() {
    echo "停止后端服务..."

    local stopped=0

    # 首先尝试从PID文件停止
    if is_running "$BACKEND_PID"; then
        kill $(cat "$BACKEND_PID") 2>/dev/null
        sleep 2
        if ps -p $(cat "$BACKEND_PID") > /dev/null 2>&1; then
            kill -9 $(cat "$BACKEND_PID") 2>/dev/null
        fi
        rm -f "$BACKEND_PID"
        stopped=1
    fi

    # Kill所有相关的Python后端进程
    local backend_pids=$(ps aux | grep "[p]ython -m web_app.app" | awk '{print $2}')
    if [ ! -z "$backend_pids" ]; then
        echo "发现后端进程: $backend_pids"
        echo "$backend_pids" | xargs kill 2>/dev/null
        sleep 1
        echo "$backend_pids" | xargs kill -9 2>/dev/null
        stopped=1
    fi

    if [ $stopped -eq 1 ]; then
        echo "✓ 后端已停止"
    else
        echo "后端未运行"
    fi
}


# 查看状态
show_status() {
    echo ""
    echo "=========================================="
    echo "生产环境服务状态"
    echo "=========================================="
    echo ""

    # 后端
    echo -n "后端 API: "
    if is_running "$BACKEND_PID"; then
        echo "运行中 (PID: $(cat $BACKEND_PID))"
        echo "  地址: http://localhost:5001"
        echo "  日志: $LOG_DIR/backend.log"
    else
        echo "已停止"
    fi
    echo ""

    # 前端
    echo "前端: 由 Nginx 提供静态文件"
    if [ -d "$PROJECT_ROOT/vue_project/dist" ]; then
        echo "  构建文件: ✓ 存在"
        if [ -d "/var/www/vocabulary_app" ]; then
            echo "  Nginx 目录: ✓ 已部署"
        else
            echo "  Nginx 目录: ✗ 未部署"
        fi
    else
        echo "  构建文件: ✗ 不存在 (需要运行构建)"
    fi
    echo ""

    # Nginx
    if command -v systemctl &> /dev/null && systemctl is-active --quiet nginx; then
        echo "Nginx: 运行中"
        echo "  HTTPS 访问: https://47.96.4.107"
    elif command -v nginx &> /dev/null && pgrep nginx > /dev/null; then
        echo "Nginx: 运行中"
        echo "  HTTPS 访问: https://47.96.4.107"
    else
        echo "Nginx: 未运行"
    fi
    echo ""
    echo "=========================================="
}

# 主函数
case "${1:-help}" in
    start)
        start_backend
        echo ""
        show_status
        ;;
    stop)
        stop_backend
        ;;
    restart)
        stop_backend
        sleep 2
        start_backend
        echo ""
        show_status
        ;;
    build)
        build_frontend
        ;;
    deploy)
        echo "执行完整部署..."
        build_frontend
        echo ""
        stop_backend
        sleep 1
        start_backend
        echo ""
        echo "重载 Nginx..."
        sudo systemctl reload nginx
        echo ""
        show_status
        ;;
    status)
        show_status
        ;;
    help|--help|-h)
        echo "生产环境启动脚本"
        echo ""
        echo "用法: ./start-production.sh {start|stop|restart|build|deploy|status}"
        echo ""
        echo "命令:"
        echo "  start    - 启动后端服务"
        echo "  stop     - 停止后端服务"
        echo "  restart  - 重启后端服务"
        echo "  build    - 构建前端并部署到 Nginx"
        echo "  deploy   - 完整部署（构建前端 + 重启后端 + 重载 Nginx）"
        echo "  status   - 查看服务状态"
        echo ""
        echo "说明:"
        echo "  前端: 构建为静态文件，由 Nginx 提供 (/var/www/vocabulary_app)"
        echo "  后端: HTTP API 服务器 (localhost:5001)"
        echo "  Nginx: HTTPS 反向代理 (https://47.96.4.107)"
        ;;
    *)
        echo "未知命令: $1"
        echo "使用 './start-production.sh help' 查看帮助"
        exit 1
        ;;
esac
