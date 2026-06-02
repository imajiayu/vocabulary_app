#!/usr/bin/env bash
# 在服务器上轮换 AI_API_KEY 并重启后端
# 用法: ./scripts/rotate-ai-key.sh sk-新的key
set -euo pipefail

SERVER="root@8.152.193.35"
ENV_FILE="/opt/vocabulary_app/backend/.env"
SERVICE="vocabulary-backend"

NEW_KEY="${1:-}"
if [[ -z "$NEW_KEY" ]]; then
  echo "用法: $0 <新的 AI_API_KEY>" >&2
  exit 1
fi
if [[ "$NEW_KEY" != sk-* ]]; then
  echo "警告: key 不以 sk- 开头，确认无误？(Ctrl-C 取消，回车继续)" >&2
  read -r _
fi

echo "==> 连接 ${SERVER}，更新 ${ENV_FILE}"
ssh "$SERVER" NEW_KEY="$NEW_KEY" ENV_FILE="$ENV_FILE" SERVICE="$SERVICE" 'bash -s' <<'REMOTE'
set -euo pipefail

# 1) 备份
TS=$(date +%Y%m%d-%H%M%S)
cp -a "$ENV_FILE" "${ENV_FILE}.bak.${TS}"
echo "    已备份 -> ${ENV_FILE}.bak.${TS}"

# 2) 校验存在 AI_API_KEY 行
if ! grep -q '^AI_API_KEY=' "$ENV_FILE"; then
  echo "错误: $ENV_FILE 中未找到 AI_API_KEY= 行" >&2
  exit 1
fi

OLD_KEY=$(grep '^AI_API_KEY=' "$ENV_FILE" | head -n1 | cut -d= -f2-)
echo "    旧 key: ${OLD_KEY:0:6}...(${#OLD_KEY} 字符)"

# 3) 原地替换（用 | 作分隔符避免 key 中特殊字符；只改第一处匹配）
python3 - "$ENV_FILE" "$NEW_KEY" <<'PY'
import sys
path, new_key = sys.argv[1], sys.argv[2]
lines = open(path).read().splitlines(keepends=True)
done = False
for i, ln in enumerate(lines):
    if ln.startswith('AI_API_KEY=') and not done:
        nl = '\n' if ln.endswith('\n') else ''
        lines[i] = f'AI_API_KEY={new_key}{nl}'
        done = True
open(path, 'w').write(''.join(lines))
PY
echo "    新 key: ${NEW_KEY:0:6}...(${#NEW_KEY} 字符)"

# 4) 重启后端
systemctl restart "$SERVICE"
sleep 2
systemctl is-active "$SERVICE" >/dev/null && echo "    $SERVICE 已重启 (active)" || {
  echo "错误: $SERVICE 未能启动，回滚 .env" >&2
  cp -a "${ENV_FILE}.bak.${TS}" "$ENV_FILE"
  systemctl restart "$SERVICE"
  exit 1
}
REMOTE

echo "==> 完成。验证后端健康:"
curl -fsS https://mieltsm.top/api/health && echo "" || echo "(健康检查未通过，请手动确认)"
echo "==> 记得在上游网关吊销旧 key"
