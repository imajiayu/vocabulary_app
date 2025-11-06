#!/bin/bash

# 字幕提取脚本
# 用法: ./extract_subtitles.sh <视频文件路径>
# 功能: 提取乌克兰语原文和英文翻译字幕

set -e

# 检查参数
if [ $# -eq 0 ]; then
    echo "用法: $0 <视频文件路径>"
    echo "示例: $0 ~/Desktop/1.mp4"
    exit 1
fi

VIDEO_PATH="$1"

# 检查文件是否存在
if [ ! -f "$VIDEO_PATH" ]; then
    echo "错误: 文件不存在: $VIDEO_PATH"
    exit 1
fi

# 获取视频文件信息
VIDEO_DIR=$(dirname "$VIDEO_PATH")
VIDEO_FILENAME=$(basename "$VIDEO_PATH")
VIDEO_NAME="${VIDEO_FILENAME%.*}"

# 创建输出目录（视频同名文件夹）
OUTPUT_DIR="${VIDEO_DIR}/${VIDEO_NAME}"
mkdir -p "$OUTPUT_DIR"

echo "================================================"
echo "视频文件: $VIDEO_FILENAME"
echo "输出目录: $OUTPUT_DIR"
echo "================================================"

# 临时音频文件路径
AUDIO_FILE="${OUTPUT_DIR}/${VIDEO_NAME}_temp_audio.wav"

# 步骤1: 提取音频
echo ""
echo "[1/3] 提取音频..."
ffmpeg -i "$VIDEO_PATH" -ar 16000 -ac 1 -c:a pcm_s16le "$AUDIO_FILE" -y 2>&1 | grep -E "(Duration|time=)" | tail -1

if [ ! -f "$AUDIO_FILE" ]; then
    echo "错误: 音频提取失败"
    exit 1
fi

echo "✓ 音频提取完成"

# 步骤2: 生成乌克兰语字幕
echo ""
echo "[2/3] 生成乌克兰语字幕..."
./whisper.cpp/build/bin/whisper-cli \
    --model ./whisper.cpp/models/ggml-small.bin \
    --language uk \
    --output-srt \
    --output-txt \
    --output-file "${OUTPUT_DIR}/${VIDEO_NAME}_uk" \
    "$AUDIO_FILE" 2>&1 | grep -E "(processing|output_|whisper_print_timings:.*total)"

if [ -f "${OUTPUT_DIR}/${VIDEO_NAME}_uk.srt" ]; then
    echo "✓ 乌克兰语字幕生成完成"
else
    echo "错误: 乌克兰语字幕生成失败"
    rm -f "$AUDIO_FILE"
    exit 1
fi

# 步骤3: 生成英文翻译字幕
echo ""
echo "[3/3] 生成英文翻译字幕..."
./whisper.cpp/build/bin/whisper-cli \
    --model ./whisper.cpp/models/ggml-small.bin \
    --language uk \
    --translate \
    --output-srt \
    --output-txt \
    --output-file "${OUTPUT_DIR}/${VIDEO_NAME}_en" \
    "$AUDIO_FILE" 2>&1 | grep -E "(processing|output_|whisper_print_timings:.*total)"

if [ -f "${OUTPUT_DIR}/${VIDEO_NAME}_en.srt" ]; then
    echo "✓ 英文字幕生成完成"
else
    echo "警告: 英文字幕生成失败"
fi

# 步骤4: 删除临时音频文件
echo ""
echo "[4/4] 清理临时文件..."
rm -f "$AUDIO_FILE"
echo "✓ 临时音频文件已删除"

# 显示生成的文件
echo ""
echo "================================================"
echo "字幕提取完成！生成的文件："
echo "================================================"
ls -lh "$OUTPUT_DIR"

echo ""
echo "文件位置: $OUTPUT_DIR"
