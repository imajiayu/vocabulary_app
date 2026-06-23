"""头部姿态几何 → yaw 标量（纯函数，无 cv2/mediapipe 依赖，便于单测）。

yaw 用鼻尖相对左右脸缘的归一化不对称度作代理：平移/距离不变，正视≈0。
正=向右转、负=向左转，钳到 [-1, 1]。符号最终由调用方的 INVERT_YAW 决定。
"""


def _clamp(value, lo, hi):
    return max(lo, min(hi, value))


def head_yaw(nose_x, edge_a_x, edge_b_x):
    """鼻尖在左右脸缘之间的归一化位置 → yaw。三个参数为归一化 x 坐标(0..1)。

    返回 [-1,1]（0.5 居中→0，贴右缘→+1，贴左缘→-1）；两缘重合等退化情形返回 None。
    """
    left_x, right_x = sorted((edge_a_x, edge_b_x))   # 兼容镜像 / 传参顺序
    span = right_x - left_x
    if span <= 1e-6:
        return None
    pos = (nose_x - left_x) / span                   # 0=贴左缘 .. 1=贴右缘
    return _clamp((pos - 0.5) * 2.0, -1.0, 1.0)
