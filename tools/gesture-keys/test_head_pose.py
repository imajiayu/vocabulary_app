"""head_yaw 纯几何单元测试。

yaw = 鼻尖在左右脸缘之间的归一化不对称度：正视≈0、偏右为正、偏左为负，钳到 [-1,1]。
"""

import pytest

from head_pose import head_yaw


def test_centered_is_zero():
    assert head_yaw(0.5, 0.3, 0.7) == pytest.approx(0.0)


def test_nose_toward_right_is_positive():
    # pos=(0.6-0.3)/0.4=0.75 → (0.75-0.5)*2 = +0.5
    assert head_yaw(0.6, 0.3, 0.7) == pytest.approx(0.5)


def test_nose_toward_left_is_negative():
    assert head_yaw(0.4, 0.3, 0.7) == pytest.approx(-0.5)


def test_at_right_edge_is_plus_one():
    assert head_yaw(0.7, 0.3, 0.7) == pytest.approx(1.0)


def test_at_left_edge_is_minus_one():
    assert head_yaw(0.3, 0.3, 0.7) == pytest.approx(-1.0)


def test_beyond_edge_clamped():
    assert head_yaw(0.9, 0.3, 0.7) == pytest.approx(1.0)   # 越过右缘 → 钳 +1
    assert head_yaw(0.1, 0.3, 0.7) == pytest.approx(-1.0)  # 越过左缘 → 钳 -1


def test_edge_order_invariant():
    # 镜像/顺序颠倒不影响结果（内部 sorted）
    assert head_yaw(0.6, 0.7, 0.3) == pytest.approx(head_yaw(0.6, 0.3, 0.7))


def test_degenerate_span_is_none():
    assert head_yaw(0.5, 0.5, 0.5) is None        # 两缘重合 → 退化
