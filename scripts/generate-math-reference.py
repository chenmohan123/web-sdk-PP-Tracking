"""独立 NumPy 公式参考；不导入任何跟踪实现。"""
import json
from pathlib import Path
import numpy as np

x = np.array([40., 60., 40., 80., 0., 0., 0., 0.])
P = np.diag([100.] * 4 + [10000.] * 4)
H = np.eye(4, 8)
R = np.eye(4) * 4
steps = []
for dt, z in [(0.1, None), (0.2, [43., 61., 41., 79.]), (0.05, [44., 62., 40., 78.]), (1.5, [55., 67., 42., 79.])]:
    F = np.eye(8)
    F[:4, 4:] = np.eye(4) * dt
    G = np.vstack([np.eye(4) * dt**2 / 2, np.eye(4) * dt])
    x = F @ x
    P = F @ P @ F.T + G @ G.T * 25
    predicted = {"mean": x.tolist(), "covariance": P.tolist()}
    if z is not None:
        K = np.linalg.solve(H @ P @ H.T + R, H @ P).T
        x = x + K @ (np.array(z) - H @ x)
        A = np.eye(8) - K @ H
        P = A @ P @ A.T + K @ R @ K.T
    steps.append({"dt": dt, "measurement": z, "predicted": predicted, "corrected": {"mean": x.tolist(), "covariance": P.tolist()}})
path = Path(__file__).resolve().parent.parent / "tests/fixtures/math-reference.json"
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text(json.dumps({"source": "独立 NumPy 标准线性 Kalman/Joseph 公式", "numpy": np.__version__, "steps": steps}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
