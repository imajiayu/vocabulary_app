#!/bin/bash

# 隐藏 PID 文件
BACKEND_PID_FILE=".backend_pid"
FRONTEND_PID_FILE=".frontend_pid"
BACKEND_LOG=".backend.log"
FRONTEND_LOG=".frontend.log"

start() {
    echo "Activating Python virtual environment..."
    source .venv/bin/activate

    echo "Starting Python backend in background..."
    # 后台启动并写 PID
    nohup python -m web_app.app &> "$BACKEND_LOG" &
    echo $! > "$BACKEND_PID_FILE"
    echo "Backend PID: $(cat $BACKEND_PID_FILE)"

    echo "Starting Vue frontend in background..."
    cd vue_project || exit
    nohup npm run dev &> "../$FRONTEND_LOG" &
    echo $! > "../$FRONTEND_PID_FILE"
    cd ..
    echo "Frontend PID: $(cat $FRONTEND_PID_FILE)"

    echo ""
    echo "=== Service Information ==="
    echo "Backend (Flask):  http://127.0.0.1:5001"
    echo "Frontend (Vue):   https://0.0.0.0:443"
    echo "                  https://localhost:443"
    echo "                  https://$(hostname -f):443"
    echo ""
    echo "=== Log Files ==="
    echo "Backend logs:     $BACKEND_LOG"
    echo "Frontend logs:    $FRONTEND_LOG"
    echo ""
    echo "Use './start.sh stop' to stop all services"
}

stop() {
    echo "Stopping backend..."
    if [ -f "$BACKEND_PID_FILE" ]; then
        kill $(cat "$BACKEND_PID_FILE") && rm "$BACKEND_PID_FILE"
        echo "Backend stopped."
    else
        echo "No backend PID file found."
    fi

    echo "Stopping frontend..."
    if [ -f "$FRONTEND_PID_FILE" ]; then
        kill $(cat "$FRONTEND_PID_FILE") && rm "$FRONTEND_PID_FILE"
        echo "Frontend stopped."
    else
        echo "No frontend PID file found."
    fi
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
        start
        ;;
    stop)
        stop
        ;;
    restart)
        restart
        ;;
    *)
        echo "Usage: $0 {start|stop|restart}"
        ;;
esac
