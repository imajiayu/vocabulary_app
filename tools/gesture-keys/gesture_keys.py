"""gesture-keys —— 头部左右转头（偏转 yaw）→ 方向键。

摄像头看你转头，向系统当前焦点窗口发 ArrowLeft / ArrowRight，
免手控制词汇 App 的复习 / 错题模式（浏览器开着复习页即可）。

  头向左转（脸朝左）→ ArrowLeft（记住了）
  头向右转（脸朝右）→ ArrowRight（没记住）
  正视前方 → 不触发

运行:
  pip install -r requirements.txt
  python gesture_keys.py

首次需在「系统设置 → 隐私与安全性」授权：摄像头 + 辅助功能（Accessibility）。
预览窗里：q 退出，p 暂停/恢复。无预览窗时 Ctrl+C 退出。
"""

import os

# 抑制 MediaPipe(native glog) 噪音——必须在 import mediapipe 之前设置才生效。
# "2"=压掉刷屏的 INFO/WARNING；想连 ERROR(如无害的 clearcut 遥测上传失败)也静默就改 "3"。
os.environ.setdefault("GLOG_minloglevel", "2")

import time
import urllib.request
from typing import Optional

import cv2
import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision
from pynput.keyboard import Controller, Key

from head_pose import head_yaw
from state_machine import GestureStateMachine

# 人脸关键点模型（首次运行自动下载，~3.7MB）
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/"
    "face_landmarker/float16/1/face_landmarker.task"
)
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "face_landmarker.task")

# ── 配置（按需调整；指标为鼻尖-脸缘不对称度 yaw，量程 [-1,1]）──────
# 自适应判定：门槛按你每次转头的实际峰值自学习、左右完全独立，中性点自校准（无需配平）。
TRIG_FRAC = 0.55           # 触发门槛 = 该方向自适应幅度的比例（越小越灵敏）
REARM_FRAC = 0.40          # re-arm 门槛 = 本次峰值的比例（须 < TRIG_FRAC）
GRAZE_FRAC = 0.35          # 擦边带：峰值 ≤ 门槛×(1+此值) → 门槛回退（变灵敏）。↑ 此值=更易回退
GROW_FRAC = 0.80           # 大幅带：峰值 ≥ 门槛×(1+此值) → 门槛增长（更抗误触）
LEARN_STEP = 0.16          # 门槛每次升/降的乘法步长（中间为舒适区，门槛不变）。↑ 此值=回退更快
HOLD_SEC = 0.12            # 转头确认时长，过滤"瞥一眼"
COOLDOWN_SEC = 0.40        # 两次触发最短间隔，抗抖动
REFRACTORY_SEC = 0.35      # 抗过冲不应期（禁对侧 + 冻结中性点）
BOOTSTRAP_AMP = 0.30       # 冷启动默认幅度，几次转头后自学习收敛
# 中性点动态配平（"摄像头正前 + 显示器偏右"这类大偏置也能自动学到位）
STILL_HOLD_SEC = 0.5       # 姿态稳定保持这么久 → 认定常驻、开始把它学成中性
STILL_JITTER = 0.05        # 静止抖动容差（超过=判定"在动"，不配平）
NEUTRAL_EMA = 0.05         # 配平速度（越大越快漂到常驻姿态）
INVERT_YAW = False         # 左右反了就改成 True
SHOW_PREVIEW = True        # 预览/标定窗
CAMERA_INDEX = 0           # 摄像头序号

# FaceLandmarker 关键点：鼻尖 + 左右脸颊轮廓（用鼻尖在两缘间的不对称度判断转头）
NOSE_TIP, FACE_LEFT, FACE_RIGHT = 1, 234, 454


def _ensure_model() -> str:
    """模型不存在则下载，返回本地路径。"""
    if not os.path.exists(MODEL_PATH):
        print(f"首次运行：下载人脸模型 (~3.7MB) → {MODEL_PATH}")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
        print("模型下载完成。")
    return MODEL_PATH


class HeadPoseEstimator:
    """MediaPipe Tasks FaceLandmarker 估算转头 yaw（正=右转，负=左转，0≈正视）。"""

    def __init__(self):
        options = vision.FaceLandmarkerOptions(
            base_options=mp_python.BaseOptions(model_asset_path=_ensure_model()),
            running_mode=vision.RunningMode.VIDEO,
            num_faces=1,
        )
        self._landmarker = vision.FaceLandmarker.create_from_options(options)

    def estimate(self, bgr_frame, timestamp_ms: int):
        """返回 (yaw, points)；无人脸 / 退化时 yaw 为 None。yaw 为鼻尖-脸缘不对称度 [-1,1]。"""
        rgb = cv2.cvtColor(bgr_frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = self._landmarker.detect_for_video(mp_image, timestamp_ms)
        if not result.face_landmarks:
            return None, None

        lm = result.face_landmarks[0]
        nose, edge_l, edge_r = lm[NOSE_TIP], lm[FACE_LEFT], lm[FACE_RIGHT]
        yaw = head_yaw(nose.x, edge_l.x, edge_r.x)  # [-1,1]，正视≈0；退化返回 None
        if yaw is None:
            return None, None
        if INVERT_YAW:
            yaw = -yaw

        h, w = bgr_frame.shape[:2]
        points = {
            "nose": (int(nose.x * w), int(nose.y * h)),
            "edge_left": (int(edge_l.x * w), int(edge_l.y * h)),
            "edge_right": (int(edge_r.x * w), int(edge_r.y * h)),
        }
        return yaw, points

    def close(self):
        self._landmarker.close()


class KeyEmitter:
    """事件 → 系统按键。"""

    def __init__(self):
        self._kb = Controller()
        self._keys = {"LEFT": Key.left, "RIGHT": Key.right}

    def emit(self, event: str):
        key = self._keys[event]
        self._kb.press(key)
        self._kb.release(key)


# 进度条把偏移映射到 [-1,1]：yaw 量程 ±1，常规转头落在中段
YAW_BAR_SCALE = 0.6


def _put(frame, text, org, scale, color, thick=2):
    """带黑色描边的文字，任何背景上都清晰。"""
    cv2.putText(frame, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, (0, 0, 0), thick + 3, cv2.LINE_AA)
    cv2.putText(frame, text, org, cv2.FONT_HERSHEY_SIMPLEX, scale, color, thick, cv2.LINE_AA)


def draw_preview(frame, yaw: Optional[float], points, sm, state: str, last_event: str):
    """叠加 dev 进度条 + 触发线(绿) + re-arm 线(黄) + 中性点/幅度/状态，便于观察自适应。"""
    h, w = frame.shape[:2]

    if points:
        # 左右脸缘连线 + 鼻尖（鼻尖在两缘间越偏，yaw 越大）
        cv2.line(frame, points["edge_left"], points["edge_right"], (0, 165, 255), 2)
        cv2.circle(frame, points["edge_left"], 4, (200, 200, 200), -1)
        cv2.circle(frame, points["edge_right"], 4, (200, 200, 200), -1)
        cv2.circle(frame, points["nose"], 6, (0, 165, 255), -1)

    # 底部进度条：加高 + 半透明暗底，提升对比度；画 dev=yaw-neutral
    bar_h = 32
    bar_y = h - 72
    cx = w // 2
    half = w // 2 - 40
    cy = bar_y + bar_h // 2

    def to_px(value):
        norm = max(-1.0, min(1.0, value / YAW_BAR_SCALE))
        return int(cx + norm * half)

    overlay = frame.copy()
    cv2.rectangle(overlay, (cx - half, bar_y), (cx + half, bar_y + bar_h), (20, 20, 20), -1)
    cv2.addWeighted(overlay, 0.5, frame, 0.5, 0, frame)
    cv2.rectangle(frame, (cx - half, bar_y), (cx + half, bar_y + bar_h), (210, 210, 210), 2)

    # 中性点参考线（细灰）
    cv2.line(frame, (cx, bar_y - 6), (cx, bar_y + bar_h + 6), (130, 130, 130), 1)

    # 左右触发线（绿，加粗）——越过即触发
    for px in (to_px(sm.trigger_threshold("RIGHT")), to_px(-sm.trigger_threshold("LEFT"))):
        cv2.line(frame, (px, bar_y - 5), (px, bar_y + bar_h + 5), (0, 220, 0), 3)

    # FIRED 时 re-arm 线（黄，加粗）——dev 回到这条线以内才"重新上膛"
    if sm.state == "FIRED" and sm.fired_dir:
        sign = 1.0 if sm.fired_dir == "RIGHT" else -1.0
        rpx = to_px(sign * sm.rearm_threshold())
        cv2.line(frame, (rpx, bar_y - 5), (rpx, bar_y + bar_h + 5), (0, 255, 255), 3)

    # dev 指示器（大圆点 + 白边，醒目）
    dev = None if yaw is None else yaw - sm.neutral
    if dev is not None:
        px = to_px(dev)
        cv2.circle(frame, (px, cy), 13, (255, 255, 255), -1)
        cv2.circle(frame, (px, cy), 10, (0, 165, 255), -1)

    # 图例 + 状态文字（均带描边）
    _put(frame, "green=trigger   yellow=re-arm", (cx - half, bar_y - 14), 0.46, (190, 190, 190), 1)
    dev_txt = "--" if dev is None else f"{dev:+.2f}"
    _put(frame, f"dev {dev_txt} [{state}]  n{sm.neutral:+.2f}  L{sm.amp['LEFT']:.2f} R{sm.amp['RIGHT']:.2f}",
         (12, 32), 0.64, (0, 200, 255), 2)
    if last_event:
        _put(frame, f"-> {last_event}", (12, 64), 0.74, (0, 230, 0), 2)
    _put(frame, "q quit | p pause", (12, h - 16), 0.5, (200, 200, 200), 1)


def main():
    cap = cv2.VideoCapture(CAMERA_INDEX)
    if not cap.isOpened():
        raise SystemExit(
            f"无法打开摄像头 {CAMERA_INDEX}。检查是否被占用，或在系统设置授权终端访问摄像头。"
        )

    estimator = HeadPoseEstimator()
    emitter = KeyEmitter()
    sm = GestureStateMachine(
        trig_frac=TRIG_FRAC,
        rearm_frac=REARM_FRAC,
        graze_frac=GRAZE_FRAC,
        grow_frac=GROW_FRAC,
        learn_step=LEARN_STEP,
        neutral_ema=NEUTRAL_EMA,
        still_jitter=STILL_JITTER,
        still_hold_sec=STILL_HOLD_SEC,
        hold_sec=HOLD_SEC,
        cooldown_sec=COOLDOWN_SEC,
        refractory_sec=REFRACTORY_SEC,
        bootstrap_amp=BOOTSTRAP_AMP,
    )

    paused = False
    last_event = ""
    last_ts_ms = -1
    print("gesture-keys 运行中：头向左转=←，向右转=→。先正视前方片刻让中性点自校准。",
          "预览窗 q 退出 / p 暂停。" if SHOW_PREVIEW else "Ctrl+C 退出。")

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                continue
            frame = cv2.flip(frame, 1)  # 镜像，自拍视角更直观

            ts_ms = int(time.monotonic() * 1000)
            if ts_ms <= last_ts_ms:  # detect_for_video 要求时间戳严格递增
                ts_ms = last_ts_ms + 1
            last_ts_ms = ts_ms
            yaw, points = estimator.estimate(frame, ts_ms)  # 原始偏转，中性点在状态机内部减

            if not paused:
                event = sm.update(yaw, now=time.monotonic())
                if event:
                    emitter.emit(event)
                    last_event = event
                    print(f"  {event}")

            if SHOW_PREVIEW:
                state = "PAUSED" if paused else sm.state
                draw_preview(frame, yaw, points, sm, state, last_event)
                cv2.imshow("gesture-keys", frame)
                key = cv2.waitKey(1) & 0xFF
                if key == ord("q"):
                    break
                if key == ord("p"):
                    paused = not paused
                    print("  已暂停" if paused else "  已恢复")
    except KeyboardInterrupt:
        pass
    finally:
        cap.release()
        estimator.close()
        if SHOW_PREVIEW:
            cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
