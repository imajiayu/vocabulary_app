#!/usr/bin/env bash
# 临时测试脚本：直接 curl llm-proxy.tapsvc.com，验证 key + 三条路径是否通
# 用法：
#   bash scripts/test-ai-gateway.sh <API_KEY>
# 环境变量覆盖（可选）：
#   AI_BASE_URL   默认 https://llm-proxy.tapsvc.com/v1
#   CHAT_MODEL    默认 gemini-3-flash-preview
#   TTS_MODEL     默认 elevenlabs/eleven_multilingual_v2
#   STT_MODEL     默认 elevenlabs/scribe_v1

KEY="${1:-}"
if [[ -z "$KEY" ]]; then
  echo "用法: bash scripts/test-ai-gateway.sh <API_KEY>" >&2
  exit 1
fi

BASE="${AI_BASE_URL:-https://llm-proxy.tapsvc.com/v1}"
CHAT_MODEL="${CHAT_MODEL:-gemini-3-flash-preview}"
TTS_MODEL="${TTS_MODEL:-elevenlabs/eleven_multilingual_v2}"
STT_MODEL="${STT_MODEL:-elevenlabs/scribe_v1}"

# 终端颜色
RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; CYAN=$'\033[36m'; DIM=$'\033[2m'; RESET=$'\033[0m'

hr() { printf "${DIM}%s${RESET}\n" "────────────────────────────────────────"; }
step() { printf "\n${CYAN}▶ %s${RESET}\n" "$*"; }
ok() { printf "${GREEN}✓ %s${RESET}\n" "$*"; }
fail() { printf "${RED}✗ %s${RESET}\n" "$*"; }
warn() { printf "${YELLOW}! %s${RESET}\n" "$*"; }

printf "${DIM}BASE = %s${RESET}\n" "$BASE"
printf "${DIM}KEY  = %s...%s (len=%d)${RESET}\n" "${KEY:0:8}" "${KEY: -4}" "${#KEY}"

# ─── 1. Chat 非流式 ─────────────────────────────────────────
step "Chat 非流式 · POST $BASE/chat/completions"
CHAT_BODY=$(cat <<EOF
{"model":"$CHAT_MODEL","messages":[{"role":"user","content":"Reply with exactly: pong"}],"temperature":0,"max_tokens":50,"stream":false}
EOF
)
CHAT_RESP=$(curl -sS -w '\nHTTP_CODE=%{http_code}\n' \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -X POST "$BASE/chat/completions" \
  -d "$CHAT_BODY")
CHAT_CODE=$(printf "%s" "$CHAT_RESP" | awk -F= '/^HTTP_CODE=/{print $2}')
CHAT_JSON=$(printf "%s" "$CHAT_RESP" | sed '/^HTTP_CODE=/d')
if [[ "$CHAT_CODE" == "200" ]]; then
  # 提取 content
  CONTENT=$(printf "%s" "$CHAT_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d["choices"][0]["message"]["content"])' 2>/dev/null || echo "(解析失败)")
  ok "HTTP 200 · content: $CONTENT"
else
  fail "HTTP $CHAT_CODE"
  printf "%s\n" "$CHAT_JSON" | head -c 500
  echo
fi

# ─── 2. Chat 流式 ───────────────────────────────────────────
step "Chat 流式 · POST $BASE/chat/completions (stream=true)"
STREAM_BODY=$(cat <<EOF
{"model":"$CHAT_MODEL","messages":[{"role":"user","content":"Count 1 2 3"}],"temperature":0,"max_tokens":50,"stream":true}
EOF
)
STREAM_OUT=$(curl -sS -N \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -X POST "$BASE/chat/completions" \
  -d "$STREAM_BODY" 2>&1)
if printf "%s" "$STREAM_OUT" | grep -q '^data: '; then
  DONE_COUNT=$(printf "%s" "$STREAM_OUT" | grep -c '\[DONE\]' || true)
  FRAME_COUNT=$(printf "%s" "$STREAM_OUT" | grep -c '^data: ' || true)
  ok "收到 $FRAME_COUNT 个 SSE 帧（含 [DONE]=$DONE_COUNT）"
  printf "${DIM}首 3 帧：${RESET}\n"
  printf "%s" "$STREAM_OUT" | grep '^data: ' | head -3 | sed 's/^/  /'
else
  fail "无 SSE 帧"
  printf "%s\n" "$STREAM_OUT" | head -c 500
  echo
fi

# ─── 3. TTS ─────────────────────────────────────────────────
step "TTS · POST $BASE/audio/speech"
TTS_BODY=$(cat <<EOF
{"model":"$TTS_MODEL","input":"hello","voice":"alloy","response_format":"mp3"}
EOF
)
TTS_TMP=$(mktemp -t ai-tts.XXXXXX)
TTS_CODE=$(curl -sS -o "$TTS_TMP" -w '%{http_code}' \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -X POST "$BASE/audio/speech" \
  -d "$TTS_BODY")
TTS_SIZE=$(stat -f%z "$TTS_TMP" 2>/dev/null || stat -c%s "$TTS_TMP" 2>/dev/null || echo 0)
if [[ "$TTS_CODE" == "200" ]] && (( TTS_SIZE > 500 )); then
  ok "HTTP 200 · 音频 ${TTS_SIZE} bytes → $TTS_TMP"
else
  fail "HTTP $TTS_CODE · size=$TTS_SIZE"
  head -c 500 "$TTS_TMP"; echo
  rm -f "$TTS_TMP"
fi

# ─── 4. STT ─────────────────────────────────────────────────
step "STT · POST $BASE/audio/transcriptions"
# 若第 3 步拿到了 mp3，直接用它做 STT 回测
if [[ -s "$TTS_TMP" ]] && (( TTS_SIZE > 500 )); then
  STT_RESP=$(curl -sS -w '\nHTTP_CODE=%{http_code}\n' \
    -H "Authorization: Bearer $KEY" \
    -X POST "$BASE/audio/transcriptions" \
    -F "file=@$TTS_TMP;type=audio/mpeg" \
    -F "model=$STT_MODEL" \
    -F "response_format=json")
  STT_CODE=$(printf "%s" "$STT_RESP" | awk -F= '/^HTTP_CODE=/{print $2}')
  STT_JSON=$(printf "%s" "$STT_RESP" | sed '/^HTTP_CODE=/d')
  if [[ "$STT_CODE" == "200" ]]; then
    TEXT=$(printf "%s" "$STT_JSON" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("text",""))' 2>/dev/null || echo "(解析失败)")
    ok "HTTP 200 · text: $TEXT"
  else
    fail "HTTP $STT_CODE"
    printf "%s\n" "$STT_JSON" | head -c 500; echo
  fi
  rm -f "$TTS_TMP"
else
  warn "跳过（上一步 TTS 未产出音频）"
fi

hr
echo "done."
