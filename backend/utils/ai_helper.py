"""
AI 助手工具模块
统一管理所有 AI API 调用
"""

import os
from openai import OpenAI
from typing import List, Dict, Optional


# 初始化 OpenAI 客户端（使用 DeepSeek API）
# 从环境变量读取 API Key，支持 Vercel 部署
API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")
BASE_URL = "https://api.deepseek.com"
MODEL = "deepseek-chat"

# 创建全局客户端实例（延迟初始化以支持环境变量）
_client = None


def _get_client():
    """获取 OpenAI 客户端（延迟初始化）"""
    global _client
    if _client is None:
        if not API_KEY:
            raise ValueError("DEEPSEEK_API_KEY environment variable is not set")
        _client = OpenAI(api_key=API_KEY, base_url=BASE_URL)
    return _client


def call_ai(
    system_prompt: str,
    user_message: str,
    history: Optional[List[Dict[str, str]]] = None,
    temperature: float = 1.0,
    max_tokens: Optional[int] = None
) -> str:
    """
    通用 AI 调用函数

    Args:
        system_prompt: 系统提示词
        user_message: 用户消息
        history: 对话历史，格式为 [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]
        temperature: 温度参数，控制随机性 (0-2)
        max_tokens: 最大生成 token 数

    Returns:
        AI 的响应文本

    Raises:
        Exception: API 调用失败时抛出异常
    """
    # 构建消息列表
    messages = [{"role": "system", "content": system_prompt}]

    # 添加历史对话
    if history:
        messages.extend(history)

    # 添加当前用户消息
    messages.append({"role": "user", "content": user_message})

    # 调用 API
    kwargs = {
        "model": MODEL,
        "messages": messages,
        "temperature": temperature,
        "stream": False
    }

    if max_tokens:
        kwargs["max_tokens"] = max_tokens

    response = _get_client().chat.completions.create(**kwargs)

    return response.choices[0].message.content


def call_ai_simple(prompt: str, temperature: float = 1.0) -> str:
    """
    简化版 AI 调用，只需要一个完整的 prompt

    Args:
        prompt: 完整的提示词（包含系统指令和用户问题）
        temperature: 温度参数

    Returns:
        AI 的响应文本
    """
    messages = [{"role": "user", "content": prompt}]

    response = _get_client().chat.completions.create(
        model=MODEL,
        messages=messages,
        temperature=temperature,
        stream=False
    )

    return response.choices[0].message.content
