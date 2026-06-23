"""GestureStateMachine 单元测试（自适应、左右独立版本）。

yaw 约定：正=右转→'RIGHT'(ArrowRight)，负=左转→'LEFT'(ArrowLeft)，None=无人脸。
状态机信号无关，换传感轴(roll/yaw)不改变行为；判定基于 dev = yaw - neutral，
以注入的 `now`(秒) 作时钟，便于假时间测试。
"""

import pytest

from state_machine import GestureStateMachine


def make_sm(**kw):
    """确定性默认：关 hold/cooldown/refractory、预置 neutral=0（跳过种子），便于隔离测各机制。"""
    defaults = dict(
        trig_frac=0.55,
        rearm_frac=0.40,
        graze_frac=0.20,
        grow_frac=0.80,
        learn_step=0.12,
        neutral_ema=0.05,
        still_jitter=0.05,
        still_hold_sec=0.5,
        hold_sec=0.0,
        cooldown_sec=0.0,
        refractory_sec=0.0,
        bootstrap_amp=0.30,
        amp_min=0.15,
        amp_max=0.60,
        trig_min_abs=0.10,
        trig_max_abs=0.40,
        seed_frames=1,
        neutral=0.0,
    )
    defaults.update(kw)
    return GestureStateMachine(**defaults)


# ── 基础 ───────────────────────────────────────────────────────────

def test_no_face_returns_none():
    sm = make_sm()
    assert sm.update(None, now=0.0) is None


def test_centered_does_not_fire():
    sm = make_sm()
    assert sm.update(0.0, now=0.0) is None
    assert sm.update(0.05, now=0.1) is None  # 阈值内


def test_turn_right_fires_right_once():
    sm = make_sm()
    assert sm.update(0.30, now=0.0) == "RIGHT"
    assert sm.update(0.30, now=0.1) is None  # FIRED 锁定，不重发


def test_turn_left_fires_left_once():
    sm = make_sm()
    assert sm.update(-0.30, now=0.0) == "LEFT"


def test_held_turn_fires_only_once():
    sm = make_sm()
    assert sm.update(0.45, now=0.0) == "RIGHT"
    assert sm.update(0.45, now=0.5) is None
    assert sm.update(0.50, now=1.0) is None
    assert sm.update(0.45, now=2.0) is None  # 始终 FIRED，从未回退到 rearm 门槛


# ── 回归：失效① 回正不足仍能再次同向触发 ───────────────────────────

def test_regression_partial_recenter_allows_refire():
    sm = make_sm()  # amp 默认 0.30
    assert sm.update(0.45, now=0.0) == "RIGHT"   # peak=0.45
    assert sm.update(0.20, now=0.3) is None      # 0.20 > 0.4*0.45=0.18 → 仍 FIRED
    assert sm.update(0.17, now=0.4) is None      # 0.17 ≤ 0.18 → re-arm（本帧不发）
    # 用户从未回到绝对零点（最低仅 0.17rad≈10°），旧绝对死区会卡死，新逻辑成功二次触发
    assert sm.update(0.45, now=0.8) == "RIGHT"


# ── 回归：失效② 甩头回正过冲不误触对侧 ─────────────────────────────

def test_regression_overshoot_does_not_trigger_opposite():
    sm = make_sm(refractory_sec=0.35)
    assert sm.update(0.45, now=0.0) == "RIGHT"      # 进 FIRED + 不应期到 0.35
    assert sm.update(-0.25, now=0.1) is None        # 过冲到左：FIRED 中不判触发（本帧 re-arm）
    assert sm.update(-0.20, now=0.2) is None        # ARMED 但在不应期，对侧被锁
    assert sm.update(0.0, now=0.5) is None          # 回正，过冲已过去
    # 全程无 LEFT


def test_overshoot_would_misfire_without_refractory():
    """对照：去掉不应期则过冲会误触 LEFT，证明不应期是有效防线。"""
    sm = make_sm(refractory_sec=0.0)
    assert sm.update(0.45, now=0.0) == "RIGHT"
    assert sm.update(-0.25, now=0.1) is None        # FIRED 中 re-arm
    assert sm.update(-0.20, now=0.2) == "LEFT"      # 无不应期 → 过冲误触


# ── 左右独立门槛 ───────────────────────────────────────────────────

def test_independent_direction_thresholds():
    # 右门槛低(amp 0.20)、左门槛高(amp 0.50)，同样 0.15 偏移右触发、左不触发
    sm_r = make_sm(amp_right=0.20)
    assert sm_r.trigger_threshold("RIGHT") == pytest.approx(0.11)
    assert sm_r.update(0.15, now=0.0) == "RIGHT"

    sm_l = make_sm(amp_left=0.50)
    assert sm_l.trigger_threshold("LEFT") == pytest.approx(0.275)
    assert sm_l.update(-0.15, now=0.0) is None       # 0.15 < 0.275
    assert sm_l.update(-0.30, now=0.1) == "LEFT"     # 越过左门槛


# ── 左右独立：触发一侧不动对侧 ─────────────────────────────────────

def test_trigger_does_not_touch_opposite_amp():
    sm = make_sm(amp_right=0.30, amp_left=0.50)        # 两侧各自已学到的值
    assert sm.update(0.45, now=0.0) == "RIGHT"         # 有力右触发 peak=0.45
    assert sm.update(0.10, now=0.1) is None            # re-arm（更新 RIGHT）
    # 触发/学习只作用于本侧，左侧原封不动
    assert sm.amp["LEFT"] == pytest.approx(0.50)


# ── 死区三段式学习：擦边↓ / 大幅↑ / 舒适不变 ──────────────────────

def test_grazing_trigger_rolls_back_amp():
    sm = make_sm(amp_right=0.30)                       # thr=0.55*0.30=0.165
    assert sm.update(0.18, now=0.0) == "RIGHT"         # 仅勉强越过门槛，ratio=0.18/0.165≈1.09≤1.20
    assert sm.update(0.05, now=0.1) is None            # 回退 re-arm，触发死区学习
    assert sm.amp["RIGHT"] == pytest.approx(0.30 * 0.88)   # 擦边 → 回退至 0.264
    assert sm.trigger_threshold("RIGHT") == pytest.approx(0.55 * 0.264)  # 门槛随之下降


def test_strong_trigger_grows_amp():
    sm = make_sm(amp_right=0.30)                       # thr=0.165
    assert sm.update(0.45, now=0.0) == "RIGHT"         # 大幅，ratio=0.45/0.165≈2.73≥1.80
    assert sm.update(0.10, now=0.1) is None            # re-arm
    assert sm.amp["RIGHT"] == pytest.approx(0.30 * 1.12)   # 大幅 → 升至 0.336


def test_comfortable_trigger_keeps_amp_stable():
    sm = make_sm(amp_right=0.30)                       # thr=0.165
    assert sm.update(0.27, now=0.0) == "RIGHT"         # 舒适区，ratio=0.27/0.165≈1.64∈(1.2,1.8)
    assert sm.update(0.05, now=0.1) is None            # re-arm
    assert sm.amp["RIGHT"] == pytest.approx(0.30)      # 门槛稳定，不变


# ── 中性点自校准（吸收双屏偏置，删配平）────────────────────────────

def test_neutral_seed_absorbs_fixed_offset():
    sm = make_sm(neutral=None, seed_frames=1)          # 启用种子
    assert sm.update(0.23, now=0.0) is None            # 首帧种子 neutral=0.23
    assert sm.neutral == pytest.approx(0.23)
    assert sm.update(0.25, now=0.1) is None            # 相对 neutral 仅 0.02，不触发
    assert sm.update(0.68, now=0.5) == "RIGHT"         # 相对 neutral 歪 ~0.45 才触发（绝对 0.68）


def test_neutral_not_polluted_by_brief_gesture():
    # 短暂手势：偏移→回正，全程"在动"（达不到 still_hold），neutral 不被学走
    sm = make_sm(neutral=0.0, neutral_ema=0.5)          # 夸张速度也证明确实没漂
    for yaw, t in [(0.20, 0.0), (0.45, 0.05), (0.45, 0.10), (0.10, 0.15), (0.0, 0.20)]:
        sm.update(yaw, now=t)
    assert abs(sm.neutral) < 1e-9


def test_neutral_tracks_sustained_offset():
    # 摄像头正前、显示器偏右：稳定保持 yaw=0.30 超过 still_hold → neutral 漂过去（动态配平）
    sm = make_sm(neutral=0.0, neutral_ema=0.3, still_hold_sec=0.5, still_jitter=0.05)
    for i in range(40):
        sm.update(0.30, now=i * 0.1)                    # 保持不动，每 0.1s 一帧
    assert sm.neutral == pytest.approx(0.30, abs=0.02)


def test_settled_offset_stops_triggering_after_calibration():
    # 大偏置常驻：最多首发一次，配平后不再持续误触发
    sm = make_sm(neutral=0.0, neutral_ema=0.5, still_hold_sec=0.5, still_jitter=0.05)
    fires = [e for e in (sm.update(0.30, now=i * 0.1) for i in range(40)) if e]
    assert len(fires) <= 1
    assert sm.neutral == pytest.approx(0.30, abs=0.03)


def test_sustained_hold_in_fired_forces_rearm():
    # FIRED 中稳定保持 → settled 强制 re-arm，且不学习（amp 不变）
    sm = make_sm(neutral=0.0, neutral_ema=0.0, still_hold_sec=0.5, still_jitter=0.05)
    assert sm.update(0.45, now=0.0) == "RIGHT"
    assert sm.state == "FIRED"
    amp0 = sm.amp["RIGHT"]
    for i in range(1, 8):
        sm.update(0.45, now=i * 0.1)                    # 保持不动至 settled
    assert sm.state == "ARMED"
    assert sm.amp["RIGHT"] == pytest.approx(amp0)


# ── amp 自适应：大幅升到上限、擦边降到下限 ────────────────────────

def test_amp_grows_then_caps():
    sm = make_sm(amp_right=0.30)
    prev = sm.amp["RIGHT"]
    t = 0.0
    for _ in range(20):                                 # 连做大幅手势（峰值 0.60，上限处 ratio 仍≥1.80）
        assert sm.update(0.60, now=t) == "RIGHT"
        sm.update(0.10, now=t + 0.1)                    # re-arm
        assert sm.amp["RIGHT"] >= prev - 1e-9           # 单调不降
        prev = sm.amp["RIGHT"]
        t += 1.0
    assert sm.amp["RIGHT"] == pytest.approx(0.60)       # 被 amp_max 钳住


def test_amp_grazing_shrinks_to_floor():
    sm = make_sm(amp_right=0.30)
    prev = sm.amp["RIGHT"]
    t = 0.0
    for _ in range(20):                                 # 连做擦边手势（峰值=门槛*1.05）
        thr = sm.trigger_threshold("RIGHT")
        assert sm.update(thr * 1.05, now=t) == "RIGHT"  # ratio≈1.05≤1.20 → 回退
        sm.update(0.02, now=t + 0.1)                     # re-arm
        assert sm.amp["RIGHT"] <= prev + 1e-9            # 单调不升
        prev = sm.amp["RIGHT"]
        t += 1.0
    assert sm.amp["RIGHT"] == pytest.approx(0.15)        # 被 amp_min 钳住


# ── 计时闸门 ───────────────────────────────────────────────────────

def test_cooldown_blocks_rapid_refire():
    sm = make_sm(cooldown_sec=0.40)
    assert sm.update(0.45, now=0.0) == "RIGHT"
    assert sm.update(0.10, now=0.1) is None             # re-arm
    assert sm.update(0.45, now=0.2) is None             # 距上次 0.2 < 0.4 冷却
    assert sm.update(0.45, now=0.45) == "RIGHT"         # 冷却已过


def test_hold_requires_sustained_turn():
    sm = make_sm(hold_sec=0.12)
    assert sm.update(0.45, now=0.0) is None             # 刚越阈值，未满 hold
    assert sm.update(0.45, now=0.05) is None
    assert sm.update(0.45, now=0.15) == "RIGHT"


def test_direction_change_resets_hold_timer():
    sm = make_sm(hold_sec=0.12)
    assert sm.update(0.45, now=0.0) is None             # 向右计时
    assert sm.update(0.45, now=0.08) is None
    assert sm.update(-0.45, now=0.10) is None           # 切向左，重新计时
    assert sm.update(-0.45, now=0.18) is None           # 距切左仅 0.08
    assert sm.update(-0.45, now=0.23) == "LEFT"         # 距切左 0.13 ≥ 0.12


# ── 无人脸 / 状态保护 ──────────────────────────────────────────────

def test_no_face_clears_pending_and_preserves_state():
    sm = make_sm(hold_sec=0.12)
    assert sm.update(0.45, now=0.0) is None             # 未满 hold
    assert sm.update(None, now=0.08) is None            # 丢脸，清 pending
    assert sm.update(0.45, now=0.13) is None            # 重新计 hold
    assert sm.update(0.45, now=0.26) == "RIGHT"


def test_no_face_during_fired_preserves_fired():
    sm = make_sm()
    assert sm.update(0.45, now=0.0) == "RIGHT"
    assert sm.update(None, now=0.1) is None             # FIRED 中丢脸，不改状态
    assert sm.state == "FIRED"
    assert sm.update(0.0, now=0.2) is None              # 回正 → re-arm
    assert sm.state == "ARMED"


# ── 门槛钳制（纯函数级）───────────────────────────────────────────

def test_trigger_threshold_clamped():
    sm = make_sm(amp_left=0.02, amp_right=2.0)
    assert sm.trigger_threshold("LEFT") == pytest.approx(0.10)   # 0.55*0.02→钳到 trig_min_abs
    assert sm.trigger_threshold("RIGHT") == pytest.approx(0.40)  # 0.55*2.0→钳到 trig_max_abs
