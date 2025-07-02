# -*- coding: utf-8 -*-
import re, requests
from bs4 import BeautifulSoup


def bold_word_in_sentence(sentence, word):
    # 忽略大小写，单词边界匹配
    pattern = re.compile(rf'\b({re.escape(word)})\b', re.IGNORECASE)
    # 用 <strong> 标签包裹匹配的单词
    return pattern.sub(r'<strong>\1</strong>', sentence)

def fetch_definition_from_web(word):
    url = f'https://dict.youdao.com/w/eng/{word}/'
    headers = {'User-Agent': 'Mozilla/5.0'}
    try:
        response = requests.get(url, headers=headers)
        response.encoding = response.apparent_encoding
        soup = BeautifulSoup(response.text, 'html.parser')

        # 音标
        phonetic_us = ''
        phonetic_uk = ''
        pronounces = soup.select('h2.wordbook-js .baav .pronounce')
        for p in pronounces:
            phon = p.select_one('span.phonetic')
            if phon:
                text = phon.text.strip()
                if '英' in p.text:
                    phonetic_uk = text
                elif '美' in p.text:
                    phonetic_us = text

        # 释义：过滤掉含有来源、数字开头、或英文百科等内容
        explains = []
        explain_lis = soup.select('#phrsListTab div.trans-container ul li')
        explains = [li.get_text(strip=True) for li in explain_lis]
        if not explains:
            explains.append('暂无释义')

        # 例句：保持单词间空格，防止粘连
        sentences = []
        example_items = soup.select('#bilingual ul.ol li')
        for li in example_items[:3]:
            ps = li.find_all('p')
            if len(ps) >= 2:
                p_eng = ps[0]
                p_chn = ps[1]
                eng = p_eng.get_text().rstrip('\n')
                chn = p_chn.get_text().rstrip('\n')
                if eng and chn:
                    sentences.append(f"{bold_word_in_sentence(eng,word)}\n{chn}\n")

        # 组合结果
        parts = []
        if phonetic_us:
            parts.append(f"美式音标: {phonetic_us}")
        if phonetic_uk:
            parts.append(f"英式音标: {phonetic_uk}")

        parts.append("\n释义:")
        for ex in explains:
            parts.append(f"- {ex}")

        if sentences:
            parts.append("\n例句:")
            parts.extend(sentences)

        return '\n'.join(parts)

    except Exception as e:
        return f"查询失败: {e}"
    

def extract_definition(text):
    """
    提取 '释义:' 到 '例句:' 之间的内容（不包含标题）。
    """
    start_tag = "释义:"
    end_tag = "例句:"
    
    start_idx = text.find(start_tag)
    end_idx = text.find(end_tag)
    
    if start_idx == -1:
        return ""  # 没有释义部分
    # 如果找不到例句，就提取到文本末尾
    if end_idx == -1:
        end_idx = len(text)
    
    # 提取中间内容并去掉首尾空白
    return text[start_idx + len(start_tag):end_idx].strip()