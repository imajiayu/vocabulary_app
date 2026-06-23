"""头部转头(偏转 yaw) → 方向键事件的自适应纯逻辑状态机。

无任何 IO / 硬件依赖，时钟由调用方通过 `now`(秒) 注入，便于单测。
信号无关：只消费一个有符号标量，换传感轴（roll/yaw）不改变本逻辑。

yaw 约定：正=右转 → 'RIGHT'(ArrowRight)，负=左转 → 'LEFT'(ArrowLeft)，None=无人脸。
所有判定基于 dev = yaw - neutral（去自校准中性点后的偏移）。

相比固定阈值版本的自适应：
- 动态配平中性点 neutral：用"稳定保持时长"而非偏移幅度区分手势与常驻姿态——
  保持某姿态超过 still_hold_sec 即认定为常驻、慢 EMA 把它学成中性（吸收任意大偏置，
  如"摄像头正前 + 显示器偏右"）；短暂手势(变化中)不学；稳定保持时还抑制触发、
  FIRED 中强制 re-arm，避免常驻偏置持续误发。
- 每方向自适应幅度 amp[d]：触发门槛 = trig_frac*amp[d]，左右完全独立、互不影响。
- 相对峰值 re-arm：FIRED 后回退到本次峰值的 rearm_frac 即再武装，不必回绝对零点。
- 死区三段式学习（仅作用本侧）：re-arm 时按本次峰值/门槛比值，擦边则回退(门槛↓)、
  大幅则增长(门槛↑)、舒适区不变(门槛稳定) → 门槛可升可降、真正自学习。
- 抗过冲不应期：防甩头回正过冲误触对侧。
"""

from typing import Optional

LEFT, RIGHT = "LEFT", "RIGHT"
ARMED, FIRED = "ARMED", "FIRED"
_OPP = {LEFT: RIGHT, RIGHT: LEFT}
_SIGN = {LEFT: -1.0, RIGHT: 1.0}


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


class GestureStateMachine:
    def __init__(
        self,
        *,
        trig_frac=0.55,
        rearm_frac=0.40,
        graze_frac=0.20,
        grow_frac=0.80,
        learn_step=0.12,
        neutral_ema=0.05,
        still_jitter=0.05,
        still_hold_sec=0.5,
        hold_sec=0.12,
        cooldown_sec=0.40,
        refractory_sec=0.35,
        bootstrap_amp=0.30,
        amp_min=0.15,
        amp_max=0.60,
        trig_min_abs=0.10,
        trig_max_abs=0.40,
        seed_frames=8,
        neutral=None,
        amp_left=None,
        amp_right=None,
    ):
        assert rearm_frac < trig_frac, "rearm_frac 须 < trig_frac，否则一触发即满足 re-arm"
        assert still_jitter > 0, "still_jitter 须 > 0，作静止抖动容差"
        assert trig_min_abs <= trig_frac * bootstrap_amp <= trig_max_abs, "冷启动门槛须落在钳制区间内"
        assert graze_frac < grow_frac, "graze_frac 须 < grow_frac，擦边带须在大幅带内侧（留出舒适区）"

        self.trig_frac = trig_frac
        self.rearm_frac = rearm_frac
        self.graze_frac = graze_frac
        self.grow_frac = grow_frac
        self.learn_step = learn_step
        self.neutral_ema = neutral_ema
        self.still_jitter = still_jitter
        self.still_hold_sec = still_hold_sec
        self.hold_sec = hold_sec
        self.cooldown_sec = cooldown_sec
        self.refractory_sec = refractory_sec
        self.bootstrap_amp = bootstrap_amp
        self.amp_min = amp_min
        self.amp_max = amp_max
        self.trig_min_abs = trig_min_abs
        self.trig_max_abs = trig_max_abs
        self.seed_frames = seed_frames

        self.amp = {
            LEFT: bootstrap_amp if amp_left is None else amp_left,
            RIGHT: bootstrap_amp if amp_right is None else amp_right,
        }
        self.state = ARMED
        self.neutral = 0.0 if neutral is None else neutral
        self.neutral_inited = neutral is not None
        self._seed = []

        # 动态配平：稳定锚点 + 进入时刻（保持够久即认定常驻 → neutral 跟随）
        self.still_ref: Optional[float] = None
        self.still_since = 0.0

        self.fired_dir: Optional[str] = None
        self.peak_mag = 0.0
        self.last_fire_time = float("-inf")
        self.refractory_until = float("-inf")
        self.refractory_dir: Optional[str] = None
        self.pending_dir: Optional[str] = None
        self.pending_since = 0.0

    # ── 对外只读（供预览 + 单测）────────────────────────────────────

    def trigger_threshold(self, direction: str) -> float:
        """该方向当前触发门槛（绝对弧度，已钳制）。"""
        return _clamp(self.trig_frac * self.amp[direction], self.trig_min_abs, self.trig_max_abs)

    def rearm_threshold(self) -> float:
        """FIRED 时的 re-arm 回退门槛（相对本次峰值）。"""
        return self.rearm_frac * self.peak_mag

    # ── 死区三段式学习（仅本侧，re-arm 时调用）──────────────────────

    def _learn(self, direction: str) -> None:
        """按本次峰值/门槛比值调整该方向 amp：擦边↓ / 大幅↑ / 舒适不变。"""
        thr = self.trigger_threshold(direction)  # 触发期间 amp 不变，等于触发时门槛
        ratio = self.peak_mag / thr              # ≥1（峰值必然越过门槛）
        if ratio <= 1.0 + self.graze_frac:       # 擦边：门槛偏高 → 回退（更易触发）
            scaled = self.amp[direction] * (1.0 - self.learn_step)
        elif ratio >= 1.0 + self.grow_frac:      # 大幅：动作很大 → 升（更抗误触）
            scaled = self.amp[direction] * (1.0 + self.learn_step)
        else:                                    # 舒适区：门槛稳定
            return
        self.amp[direction] = _clamp(scaled, self.amp_min, self.amp_max)

    # ── 主逻辑 ─────────────────────────────────────────────────────

    def update(self, yaw: Optional[float], now: float) -> Optional[str]:
        # 无人脸：清待定方向，其余状态全不动。
        if yaw is None:
            self.pending_dir = None
            return None

        # 冷启动：用前 seed_frames 帧均值种中性点（避免单帧在动作中种偏）。
        if not self.neutral_inited:
            self._seed.append(yaw)
            if len(self._seed) >= self.seed_frames:
                self.neutral = sum(self._seed) / len(self._seed)
                self.neutral_inited = True
                self._seed = []
            return None

        in_refractory = now < self.refractory_until

        # 稳定检测：偏离锚点超过抖动容差即"在动"，重锚 + 重新计时；
        # 在容差内保持超过 still_hold_sec 即认定为"常驻姿态"(settled)。
        if self.still_ref is None or abs(yaw - self.still_ref) > self.still_jitter:
            self.still_ref = yaw
            self.still_since = now
        settled = (now - self.still_since) >= self.still_hold_sec

        # 动态配平：常驻姿态被慢慢学成中性（无论偏移多大；不应期内冻结防过冲污染）。
        if settled and not in_refractory:
            self.neutral += self.neutral_ema * (yaw - self.neutral)

        dev = yaw - self.neutral

        # FIRED：跟踪峰值 + 相对回退 re-arm；或稳定保持时强制复位（期间从不发键）。
        if self.state == FIRED:
            mag = _SIGN[self.fired_dir] * dev
            if mag > self.peak_mag:
                self.peak_mag = mag
            if settled:                       # 常驻姿态 → 非手势，直接复位（不学习）
                self.state = ARMED
                self.fired_dir = None
                self.peak_mag = 0.0
            elif mag <= self.rearm_frac * self.peak_mag:
                self._learn(self.fired_dir)   # 正常手势回退 → 死区学习
                self.state = ARMED
                self.fired_dir = None
                self.peak_mag = 0.0
            self.pending_dir = None
            return None

        # 稳定保持时不触发（正在配平，避免常驻偏置持续误发）。
        if settled:
            self.pending_dir = None
            return None

        # 方向判定（左右独立门槛）。
        if dev >= self.trigger_threshold(RIGHT):
            direction = RIGHT
        elif dev <= -self.trigger_threshold(LEFT):
            direction = LEFT
        else:
            self.pending_dir = None
            return None

        # 抗过冲：不应期内禁止与刚触发方向相反的方向触发。
        if in_refractory and direction == _OPP[self.refractory_dir]:
            self.pending_dir = None
            return None

        # hold（方向持续）。
        if direction != self.pending_dir:
            self.pending_dir = direction
            self.pending_since = now
        held_ok = (now - self.pending_since) >= self.hold_sec
        cooldown_ok = (now - self.last_fire_time) >= self.cooldown_sec
        if not (held_ok and cooldown_ok):
            return None

        # ── 发键 ──
        self.last_fire_time = now
        self.state = FIRED
        self.fired_dir = direction
        self.peak_mag = _SIGN[direction] * dev
        self.refractory_until = now + self.refractory_sec
        self.refractory_dir = direction
        # 仅本侧学习（在 re-arm 时进行），对侧已学到的 amp 原封不动。
        self.pending_dir = None
        return direction
