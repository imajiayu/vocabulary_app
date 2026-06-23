# gesture-keys

通过 Mac 摄像头识别**头部左右转头（偏转 yaw）**，向系统当前焦点窗口发送方向键，免手控制词汇 App 的复习 / 错题模式。

```
头向左转（脸朝左）→ ArrowLeft（记住了）
头向右转（脸朝右）→ ArrowRight（没记住）
正视前方 → 不触发
```

复习 / 错题页监听的就是 `ArrowLeft` / `ArrowRight`，所以**不接入网站代码**，浏览器开着复习页即可。

## 安装

建议用独立 venv，避免污染后端环境：

```bash
cd tools/gesture-keys
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## 运行

```bash
python gesture_keys.py
```

首次运行会自动下载人脸关键点模型 `face_landmarker.task`（~3.7MB，MediaPipe Tasks）。

并需在**系统设置 → 隐私与安全性**授权运行它的终端（或 IDE）：

- **摄像头** —— 读取画面
- **辅助功能（Accessibility）** —— pynput 发送系统按键

授权后重启脚本。**先正视前方片刻**让中性点自校准，前 1–2 次转头算热身，之后即稳定。把浏览器复习页保持在最前并聚焦，转头即发方向键。

预览窗按键：`q` 退出，`p` 暂停 / 恢复（喝水、转头看人时免误触）。

> 启动/运行时若看到 MediaPipe 的 `clearcut` / glog 日志（`Failed to send to clearcut ...` 之类），是底层遥测上传被限流，**无害可忽略**。已用 `GLOG_minloglevel` 压掉大部分；想连这类 ERROR 也彻底静默，把 `gesture_keys.py` 顶部那行的 `"2"` 改成 `"3"`（只保留 FATAL；Python 报错不受影响）。

## 自适应判定（无需配平）

判定**按你每次转头的实际幅度自学习、左右完全独立**，并自动校准中性点，所以**不需要手动配平**——双屏场景下你正视网页屏幕的固定偏角会被中性点吸收：

- **动态配平中性点**：用"姿态**稳定保持时长**"（而非偏移大小）区分手势与常驻姿态——你保持某姿态超过 `STILL_HOLD_SEC` 就被认定为常驻、慢慢学成中性，**任意大偏置都能吸收**（如"摄像头正前、显示器在右"）；短暂转头(变化中)不会被误学，配平期间还会抑制触发，所以常驻偏置最多首发一次即自动归位。
- **相对峰值再武装**：转头触发后，只要**回退到本次峰值的一定比例**就能再次触发，**不必把头完全转正**（解决"回正不够卡死"）。
- **抗过冲**：触发后短暂不应期禁止对侧触发，挡住甩头回正时的过冲（解决"误触相对方向"）。
- **死区三段式学习（左右独立）**：每次触发只调整**该侧**门槛、绝不影响另一侧。看本次峰值相对门槛的比值——**擦边**（仅勉强越过）→ 门槛回退变灵敏；**大幅**（远超门槛）→ 门槛抬高更抗误触；中间**舒适区**门槛纹丝不动。于是每侧门槛**可升可降、真正自学习**。

预览窗：橙点=鼻尖、橙线连左右脸缘（鼻尖在两缘间越偏，转头量越大），底部进度条画 `dev`(相对中性点的偏移)，中线=中性点，两条绿线=左右**各自**的动态触发门槛（会不对称）；顶部显示 `dev / 状态 / 中性点 n / 左右幅度 L,R`。

左右反了？把 `gesture_keys.py` 顶部 `INVERT_YAW` 改 `True`。整体太灵敏/迟钝调 `TRIG_FRAC`（小=灵敏）或 `BOOTSTRAP_AMP`；容易误触调大 `HOLD_SEC` / `REFRACTORY_SEC`。

## 配置（`gesture_keys.py` 顶部常量）

| 常量 | 默认 | 说明 |
|------|------|------|
| `TRIG_FRAC` | 0.55 | 触发门槛 = 该方向自适应幅度的比例（小=灵敏）|
| `REARM_FRAC` | 0.40 | 再武装门槛 = 本次峰值的比例（须 < `TRIG_FRAC`）|
| `GRAZE_FRAC` | 0.35 | 擦边带：峰值 ≤ 门槛×(1+此值) → 门槛回退（变灵敏）。↑ 此值=更易回退 |
| `GROW_FRAC` | 0.80 | 大幅带：峰值 ≥ 门槛×(1+此值) → 门槛增长（更抗误触）|
| `LEARN_STEP` | 0.16 | 门槛每次升/降的乘法步长（中间为舒适区，门槛不变）。↑ 此值=回退更快 |
| `HOLD_SEC` | 0.12 | 转头确认时长，过滤瞥一眼 |
| `COOLDOWN_SEC` | 0.40 | 两次触发最短间隔 |
| `REFRACTORY_SEC` | 0.35 | 抗过冲不应期（禁对侧 + 冻结中性点）|
| `BOOTSTRAP_AMP` | 0.30 | 冷启动默认幅度，几次转头后自学习收敛 |
| `STILL_HOLD_SEC` | 0.5 | 姿态稳定保持这么久 → 认定常驻、开始配平 |
| `STILL_JITTER` | 0.05 | 静止抖动容差（超过=判定"在动"，暂不配平）|
| `NEUTRAL_EMA` | 0.05 | 配平速度（越大越快漂到常驻姿态）|
| `YAW_BAR_SCALE` | 0.6 | 预览进度条量程（让常规转头落在中段，不影响判定）|
| `INVERT_YAW` | False | 左右反了置 True |
| `SHOW_PREVIEW` | True | 预览窗 |
| `CAMERA_INDEX` | 0 | 摄像头序号 |

## 测试

核心状态机 + yaw 几何（纯逻辑）有单元测试：

```bash
pip install pytest
python -m pytest -q
```

## 结构

| 文件 | 职责 |
|------|------|
| `gesture_keys.py` | 摄像头采集 + MediaPipe Tasks FaceLandmarker 取关键点 + 发键 + 预览窗 |
| `head_pose.py` | 纯函数 `head_yaw`：鼻尖-脸缘不对称度 → yaw 标量（已单测） |
| `state_machine.py` | 纯逻辑状态机：yaw → 事件，防连发、自适应（已单测） |
| `test_head_pose.py` / `test_state_machine.py` | 单元测试 |

设计文档：`docs/superpowers/specs/2026-06-14-gesture-keys-design.md`
