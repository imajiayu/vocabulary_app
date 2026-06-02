# -*- coding: utf-8 -*-
"""用 robinhad/ukrainian-tts (Tetiana) 为 UKA 词表批量生成发音 MP3。

输出文件名 = sha256(word).hexdigest() + ".mp3"，与后端 tts_cache.py 完全一致，
可直接覆盖服务器 /opt/vocabulary_app/tts-cache/UKA/ 下的旧缓存。

用法:
    python generate.py            # 生成全部，跳过已存在的
    python generate.py --force    # 重新生成全部（覆盖本地）
    python generate.py --limit 5  # 只生成前 5 个（验证用）
"""
import argparse
import io
import json
import os
import subprocess
import sys
import wave

from ukrainian_tts.tts import TTS, Voices, Stress

HERE = os.path.dirname(os.path.abspath(__file__))
WORDS_JSON = os.path.join(HERE, "words.json")
OUT_DIR = os.path.join(HERE, "out")  # 生成的 mp3 落到这里，再整批上传


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true", help="覆盖已存在的本地文件")
    ap.add_argument("--limit", type=int, default=0, help="只生成前 N 个（0=全部）")
    args = ap.parse_args()

    with open(WORDS_JSON, encoding="utf-8") as f:
        words = json.load(f)
    if args.limit:
        words = words[: args.limit]

    os.makedirs(OUT_DIR, exist_ok=True)

    print(f"加载 TTS 模型 (CPU)…")
    tts = TTS(device="cpu")
    print(f"模型就绪，开始生成 {len(words)} 个词\n")

    ok, skip, fail = 0, 0, 0
    for i, item in enumerate(words, 1):
        word = item["word"]
        h = item["hash"]
        mp3_path = os.path.join(OUT_DIR, f"{h}.mp3")

        if os.path.exists(mp3_path) and not args.force:
            skip += 1
            continue

        try:
            wav_buf = io.BytesIO()
            tts.tts(word, Voices.Tetiana.value, Stress.Dictionary.value, wav_buf)
            wav_buf.seek(0)

            # wav -> mp3 (ffmpeg 从 stdin 读 wav)
            proc = subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", "pipe:0",
                 "-codec:a", "libmp3lame", "-qscale:a", "2", mp3_path],
                input=wav_buf.read(),
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            )
            if proc.returncode != 0 or not os.path.exists(mp3_path):
                raise RuntimeError(proc.stderr.decode("utf-8", "ignore")[:200])
            ok += 1
            print(f"[{i}/{len(words)}] {word}  ✓")
        except Exception as e:
            fail += 1
            print(f"[{i}/{len(words)}] {word}  ✗ {e}", file=sys.stderr)

    print(f"\n完成: 生成 {ok}, 跳过 {skip}, 失败 {fail}")
    print(f"输出目录: {OUT_DIR}")


if __name__ == "__main__":
    main()
