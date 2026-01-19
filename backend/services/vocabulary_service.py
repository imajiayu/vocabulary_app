# -*- coding: utf-8 -*-
from flask import json
import re, requests
from bs4 import BeautifulSoup


def get_bold_definition(word, jsonStr):
    data = json.loads(jsonStr)

    # 处理例句，将英文单词加粗
    if "examples" in data:
        for example in data["examples"]:
            if "en" in example:
                example["en"] = bold_word_in_sentence(example["en"], word)

    # 返回 JSON 字符串
    return json.dumps(data, ensure_ascii=False, indent=2)


def bold_word_in_sentence(sentence, word):
    # 忽略大小写，单词边界匹配，且单词前后不在 <strong> 标签中
    pattern = re.compile(
        rf"(?<!<strong>)\b({re.escape(word)})\b(?!</strong>)", re.IGNORECASE
    )
    return pattern.sub(r"<strong>\1</strong>", sentence)


def fetch_definition_from_web(word):
    url = f"https://dict.youdao.com/w/eng/{word}/"
    headers = {"User-Agent": "Mozilla/5.0"}

    try:
        # 添加10秒超时，避免长时间阻塞
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = response.apparent_encoding
        soup = BeautifulSoup(response.text, "html.parser")

        # 音标
        phonetic_us = ""
        phonetic_uk = ""
        pronounces = soup.select("h2.wordbook-js .baav .pronounce")
        for p in pronounces:
            phon = p.select_one("span.phonetic")
            if phon:
                text = phon.text.strip()
                if "英" in p.text:
                    phonetic_uk = text
                elif "美" in p.text:
                    phonetic_us = text

        # 释义
        explain_lis = soup.select("#phrsListTab div.trans-container ul li")
        definitions = [li.get_text(strip=True) for li in explain_lis]
        if not definitions:
            definitions.append("暂无释义")

        # 例句
        examples = []
        example_items = soup.select("#bilingual ul.ol li")
        for li in example_items[:3]:
            ps = li.find_all("p")
            if len(ps) >= 2:
                eng = ps[0].get_text().rstrip("\n")
                zh = ps[1].get_text().rstrip("\n")
                if eng and zh:
                    examples.append({"en": bold_word_in_sentence(eng, word), "zh": zh})

        # 返回 JSON 格式
        result = {
            "phonetic": {"us": phonetic_us, "uk": phonetic_uk},
            "definitions": definitions,
            "examples": examples,
        }

        return result

    except Exception:
        return None


def fill_missing_definitions():
    """
    为所有缺失释义的单词填充释义
    使用批量释义服务异步处理（自动去重）

    Returns:
        tuple: (总单词数, 新增单词数, 跳过单词数)
    """
    from backend.database.vocabulary_dao import db_fetch_words_without_definition
    from backend.services.batch_definition_service import get_batch_definition_service

    # 获取所有缺失释义的单词
    words_without_def = db_fetch_words_without_definition()

    if not words_without_def:
        return (0, 0, 0)

    # 使用批量释义服务添加任务（自动去重）
    batch_service = get_batch_definition_service()
    added_count = 0
    skipped_count = 0

    for word_data in words_without_def:
        if batch_service.add_task(word_data["id"], word_data["word"]):
            added_count += 1
        else:
            skipped_count += 1

    total_count = len(words_without_def)
    print(f"📊 Fill definitions: total={total_count}, added={added_count}, skipped={skipped_count}")

    return (total_count, added_count, skipped_count)
