#!/bin/bash

# 隐藏 PID 文件
BACKEND_PID_FILE=".backend_pid"
FRONTEND_PID_FILE=".frontend_pid"
BACKEND_LOG=".backend.log"
FRONTEND_LOG=".frontend.log"

start_backend() {
    echo "Activating Python virtual environment..."
    source .venv/bin/activate

    echo "Starting Python backend in background..."
    # 后台启动并写 PID
    nohup python -m web_app.app &> "$BACKEND_LOG" &
    echo $! > "$BACKEND_PID_FILE"
    echo "Backend PID: $(cat $BACKEND_PID_FILE)"
    echo "Backend (Flask):  http://127.0.0.1:5001"
    echo "Backend logs:     $BACKEND_LOG"
}

start_frontend() {
    echo "Starting Vue frontend in background..."
    cd vue_project || exit

    # 使用 sudo 运行在 80 端口
    nohup sudo npm run dev &> "../$FRONTEND_LOG" &
    echo $! > "../$FRONTEND_PID_FILE"
    cd ..
    echo "Frontend PID: $(cat $FRONTEND_PID_FILE)"
    echo "Frontend (Vue):   http://0.0.0.0:80"
    echo "                  http://localhost:80"
    echo "                  http://$(hostname -f):80"
    echo "Frontend logs:    ../$FRONTEND_LOG"
}

start() {
    start_backend
    echo ""
    start_frontend
    echo ""
    echo "Use './start.sh stop' to stop all services"
}

stop_backend() {
    echo "Stopping backend..."

    # Kill process from PID file
    if [ -f "$BACKEND_PID_FILE" ]; then
        kill $(cat "$BACKEND_PID_FILE") 2>/dev/null && rm "$BACKEND_PID_FILE"
    fi

    # Kill all web_app.app processes
    pkill -f "python -m web_app.app" 2>/dev/null
    pkill -f "web_app.app" 2>/dev/null

    echo "Backend stopped."
}

stop_frontend() {
    echo "Stopping frontend..."

    # Kill process from PID file
    if [ -f "$FRONTEND_PID_FILE" ]; then
        kill $(cat "$FRONTEND_PID_FILE") 2>/dev/null && rm "$FRONTEND_PID_FILE"
    fi

    # Kill all npm run dev processes in vue_project
    pkill -f "npm run dev" 2>/dev/null
    pkill -f "vite" 2>/dev/null

    echo "Frontend stopped."
}

stop() {
    stop_backend
    stop_frontend
}

restart() {
    echo "Restarting services..."
    stop
    echo "Waiting for services to shutdown..."
    sleep 2
    start
}

case "$1" in
    start)
        if [ "$2" = "backend" ]; then
            start_backend
        elif [ "$2" = "frontend" ]; then
            start_frontend
        else
            start
        fi
        ;;
    stop)
        if [ "$2" = "backend" ]; then
            stop_backend
        elif [ "$2" = "frontend" ]; then
            stop_frontend
        else
            stop
        fi
        ;;
    restart)
        if [ "$2" = "backend" ]; then
            stop_backend
            sleep 1
            start_backend
        elif [ "$2" = "frontend" ]; then
            stop_frontend
            sleep 1
            start_frontend
        else
            restart
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart} [backend|frontend]"
        echo ""
        echo "Examples:"
        echo "  $0 start              - Start both services"
        echo "  $0 start backend      - Start backend only"
        echo "  $0 start frontend     - Start frontend only"
        echo "  $0 stop               - Stop both services"
        echo "  $0 stop backend       - Stop backend only"
        echo "  $0 stop frontend      - Stop frontend only"
        echo "  $0 restart            - Restart both services"
        echo "  $0 restart backend    - Restart backend only"
        echo "  $0 restart frontend   - Restart frontend only"
        ;;
esac
