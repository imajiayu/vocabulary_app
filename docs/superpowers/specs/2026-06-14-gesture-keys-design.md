# gesture-keys 设计文档

> 2026-06-14 · 通过 Mac 摄像头识别头部左右转头（偏转 yaw），向系统当前焦点窗口发送方向键，免手控制词汇 App 的复习 / 错题模式。
>
> 注：交互动作几经迭代——曾用"左右歪头(roll/tilt，两眼连线倾角)"，最终改回"**左右转头(yaw)**"。指标改用鼻尖在左右脸缘间的归一化不对称度（[-1,1]，正视≈0）。

## 目标

复习 / 错题模式已内置键盘快捷键（监听 `document` 的 `keydown`，按 `event.key` 匹配）：

- `ArrowLeft`（←）= 记住了 / 毕业推进
- `ArrowRight`（→）= 没记住 / 重置

因此辅助工具**不接入网站代码**，只需作为独立进程向系统焦点窗口"发"出这两个按键即可。浏览器开着复习页时，发出的方向键被网页原生捕获。

## 非目标（YAGNI）

- 不做拼写模式（`Enter` / 其它键）——先只覆盖左右两键。
- 不打包成 `.app`、不做签名分发——终端 `python` 直接跑。
- 不接入网站、不改前端任何代码。
- 不做多手势 / 多用户 / 配置 UI——配置为脚本顶部常量。

## 交互模型

- 头**向左转**（脸朝左，yaw 偏转）→ 发 `ArrowLeft`
- 头**向右转**（脸朝右）→ 发 `ArrowRight`
- **正视前方** = 中立，不触发

「一次转头 = 一次按键」，**自适应、左右独立**（取代早期"固定阈值 + 绝对死区"，详见下文「状态机行为」）：

1. **动态配平中性点**：用「姿态**稳定保持时长**」而非偏移幅度区分手势与常驻姿态——保持某姿态超过 `STILL_HOLD_SEC`（抖动在 `STILL_JITTER` 内）即认定常驻、慢 EMA 学成零点 `neutral`，**吸收任意大偏置**（如"摄像头正前、显示器偏右"）；短暂手势(变化中)不学；配平期间抑制触发、FIRED 中强制 re-arm，故常驻偏置最多首发一次即归位。**因此删除了手动配平**。判定基于 `dev = yaw − neutral`。
2. **每方向自适应触发门槛**：门槛 = `TRIG_FRAC × amp[d]`，`amp[d]` 是该方向学到的手势幅度，**左右完全独立、互不影响**。
3. **相对峰值再武装**：触发后回退到本次峰值的 `REARM_FRAC` 即再武装，**不必回绝对零点**（修"回正卡死"）。
4. **死区三段式学习（仅本侧）**：re-arm 时按本次峰值/门槛比值更新 `amp[d]`——擦边（比值 ≤ `1+GRAZE_FRAC`）则回退（门槛↓变灵敏）、大幅（比值 ≥ `1+GROW_FRAC`）则增长（门槛↑抗误触）、舒适区门槛不变。门槛**可升可降**，且**绝不动对侧**已学到的值。取代了早期的"对侧按比例重置"。
5. **抗过冲不应期**：触发后 `REFRACTORY_SEC` 内禁对侧触发并冻结中性点（修"甩头回正过冲误触"）。
6. **冷却 + 确认时长**：两次触发间隔 ≥ `COOLDOWN_SEC`；方向需持续 ≥ `HOLD_SEC`。

## 架构

```
摄像头帧 → 人脸关键点 → 估算 yaw → 状态机判定 → 发按键
(OpenCV)  (MediaPipe)   (不对称度)  (左/中/右)   (pynput)
```

模块（职责单一、可独立测试）：

| 模块 | 职责 | 依赖 |
|------|------|------|
| `CameraCapture` | OpenCV 打开摄像头，逐帧产出 BGR 帧 | opencv |
| `HeadPoseEstimator` | MediaPipe Tasks FaceLandmarker 取关键点，调 `head_yaw` 算转头 yaw；无人脸/退化返回 `None` | mediapipe, opencv, head_pose |
| `head_pose.head_yaw` | **纯函数**：鼻尖-脸缘不对称度 → yaw 标量 `[-1,1]`。无 IO，单测覆盖 | 无 |
| `GestureStateMachine` | **纯逻辑**：输入 yaw + now，输出事件 `LEFT` / `RIGHT` / `None`；自适应、自校准、信号无关。无任何 IO，单测覆盖 | 无 |
| `KeyEmitter` | 事件 → pynput 发 `Key.left` / `Key.right` | pynput |
| `main` + 预览窗 | 串联循环；小窗显示 `dev`/中性点/左右动态阈值/状态；`q` 退出、`p` 暂停 | opencv |

`GestureStateMachine` 与 `head_yaw` 不依赖任何硬件 / 第三方库，是需要 TDD 单测的纯逻辑核心。

### yaw（转头偏转）估算

> 实现注记：mediapipe 0.10.35 已移除 legacy `solutions.face_mesh`，改用 **Tasks `FaceLandmarker`**（`RunningMode.VIDEO` + `detect_for_video`），首次运行自动下载 `face_landmarker.task`（~3.7MB）。

FaceLandmarker 输出归一化关键点。用鼻尖在左右脸缘之间的归一化不对称度作 yaw 代理（平移/距离不变、正视≈0）：

```
left, right = 按 x 排序(face_left, face_right)   # 兼容镜像 / 顺序
pos = (nose.x − left) / (right − left)           # 0=贴左缘 .. 1=贴右缘，0.5=居中
yaw = clamp((pos − 0.5) × 2, −1, 1)              # [-1,1]，正视≈0
```

- 关键点：鼻尖 `1`、左右脸颊轮廓 `234` / `454`。
- 选型：相比 `cv2.solvePnP` 真角度，不对称代理更轻、无需相机内参；状态机本就自适应幅度，足够（实测抖动再升级）。
- 量纲 `[-1,1]` 与旧 roll 弧度尺度相近，自适应/钳制常量先沿用，预览实测再微调。
- 左右符号若反，置 `INVERT_YAW=True`（或预览窗实测后调）。

## 配置（脚本顶部常量）

| 常量 | 默认 | 说明 |
|------|------|------|
| `TRIG_FRAC` | 0.55 | 触发门槛 = 该方向自适应幅度的比例（小=灵敏）|
| `REARM_FRAC` | 0.40 | 再武装门槛 = 本次峰值的比例（须 < `TRIG_FRAC`）|
| `GRAZE_FRAC` | 0.35 | 擦边带：峰值 ≤ 门槛×(1+此值) → 门槛回退（变灵敏）|
| `GROW_FRAC` | 0.80 | 大幅带：峰值 ≥ 门槛×(1+此值) → 门槛增长（更抗误触）|
| `LEARN_STEP` | 0.16 | 门槛每次升/降的乘法步长（中间为舒适区，门槛不变）|
| `HOLD_SEC` | 0.12 | 转头确认时长，过滤瞥一眼 |
| `COOLDOWN_SEC` | 0.40 | 两次触发最短间隔 |
| `REFRACTORY_SEC` | 0.35 | 抗过冲不应期（禁对侧 + 冻结中性点）|
| `BOOTSTRAP_AMP` | 0.30 | 冷启动默认幅度，几次转头后自学习收敛 |
| `STILL_HOLD_SEC` | 0.5 | 姿态稳定保持这么久 → 认定常驻、开始配平 |
| `STILL_JITTER` | 0.05 | 静止抖动容差（超过=判定"在动"，暂不配平）|
| `NEUTRAL_EMA` | 0.05 | 配平速度（越大越快漂到常驻姿态）|
| `YAW_BAR_SCALE` | 0.6 | 预览进度条量程（仅显示用，不影响判定）|
| `INVERT_YAW` | False | 左右反了就置 True |
| `SHOW_PREVIEW` | True | 是否显示预览窗 |

> 状态机内部还有非暴露的钳制常量：`amp_min/max=0.15/0.60`、`trig_min/max_abs=0.10/0.40`、`seed_frames=8`。

## 状态机行为（单测规格）

状态 `ARMED`/`FIRED`，方向 `d∈{LEFT,RIGHT}`，`sign(LEFT)=-1/RIGHT=+1`。判定基于 `dev = yaw − neutral`，方向幅度 `mag = sign(d)*dev`。每方向门槛 `trig_thresh(d) = clamp(TRIG_FRAC*amp[d], trig_min_abs, trig_max_abs)`。

- **无人脸**(`yaw=None`)：清待定方向，其余状态全不动 → `None`。
- **冷启动种子**：`neutral` 未初始化时用前 `seed_frames` 帧均值种下；其间 → `None`。
- **稳定检测**：`|yaw − still_ref| > STILL_JITTER` 则重锚 `still_ref=yaw, still_since=now`；保持容差内达 `STILL_HOLD_SEC` 即 `settled=True`（常驻姿态，区别于短暂手势）。
- **动态配平**：`settled 且 非不应期` 时 `neutral += NEUTRAL_EMA*(yaw−neutral)`（吸收任意大偏置；不应期冻结防过冲污染）。
- **FIRED**：跟踪 `peak_mag=max(peak_mag, mag)`；`settled` → 强制复位转 `ARMED`（**不学习**，按常驻处理）；否则 `mag ≤ REARM_FRAC*peak_mag` → **死区三段式学习**（仅本侧）→ 转 `ARMED`。FIRED 期间从不发键。
- **settled 抑制触发**：ARMED 且 `settled` 时不做方向判定（正在配平，避免常驻偏置持续误发）→ `None`。
- **死区三段式学习** `_learn(d)`：`ratio = peak_mag / trig_thresh(d)`（≥1）。`ratio ≤ 1+GRAZE_FRAC` → `amp[d] ×= (1−LEARN_STEP)`（擦边回退）；`ratio ≥ 1+GROW_FRAC` → `amp[d] ×= (1+LEARN_STEP)`（大幅增长）；中间舒适区 `amp[d]` 不变。结果钳 `[amp_min, amp_max]`。**只动 `d`，对侧不变。**
- **ARMED 触发**：`dev ≥ +trig_thresh(RIGHT)` 发 RIGHT、`dev ≤ −trig_thresh(LEFT)` 发 LEFT；不应期内禁对侧；满足 `HOLD_SEC`/`COOLDOWN_SEC` 才发。发键 → `FIRED` + 开 `REFRACTORY_SEC` 不应期（**不再触碰对侧 amp**）。

状态机以 `now`（秒）入参（依赖注入，便于假时钟），不直接读系统时钟。单测含两个原始失效模式回归（回正不足仍能二次触发、过冲不误触对侧）+ 死区三段式学习（擦边↓/大幅↑/舒适不变）+ 左右独立不互扰 + 动态配平（短暂手势不污染 / 常驻大偏置被吸收 / 配平期不持续误发 / FIRED 强制 re-arm）等共 26 例。`head_yaw` 几何另有 8 例。

## 运行

```bash
cd tools/gesture-keys
pip install -r requirements.txt          # mediapipe opencv-python pynput
python gesture_keys.py
```

- 首次需系统授权：**摄像头** + **辅助功能（Accessibility）**（pynput 发系统键需要）。
- 浏览器开着复习页 → 转头即发方向键。
- 预览窗：`q` 退出，`p` 暂停 / 恢复（喝水、与人交谈时免误触）；无预览窗时 `Ctrl+C` 退出。

## 部署影响

放在仓库 `tools/gesture-keys/`，纯本地工具。CI（`.github/workflows/deploy.yml`）只构建 frontend + backend，**不受影响**。
