"""NumPy 向量化参考，只与 JS 共享文字契约，不复用 JS 像素实现。"""
import numpy as np


def prepare_rgba(rgba, box, bgr=False):
    height, width, channels = rgba.shape
    assert channels == 4 and rgba.dtype == np.uint8
    x, y, w, h = [float(box[key]) for key in ["x", "y", "width", "height"]]
    assert np.isfinite([x, y, w, h, x+w, y+h]).all() and w > 0 and h > 0
    left, top, right, bottom = max(0, x), max(0, y), min(width, x+w), min(height, y+h)
    assert right > left and bottom > top
    left, top, right, bottom = int(np.floor(left)), int(np.floor(top)), int(np.ceil(right)), int(np.ceil(bottom))
    pixels = rgba[top:bottom, left:right].astype(np.float64)
    pixels = (pixels[:, :, :3] * pixels[:, :, 3:] + 255 * (255 - pixels[:, :, 3:])) / 255
    ys = np.clip((np.arange(192, dtype=np.float64) + .5) * (bottom-top) / 192 - .5, 0, bottom-top-1)
    xs = np.clip((np.arange(64, dtype=np.float64) + .5) * (right-left) / 64 - .5, 0, right-left-1)
    ya, xa = np.floor(ys).astype(int), np.floor(xs).astype(int)
    yb, xb = np.minimum(ya+1, bottom-top-1), np.minimum(xa+1, right-left-1)
    fy, fx = (ys-ya)[:, None, None], (xs-xa)[None, :, None]
    upper = pixels[ya[:, None], xa[None, :]] * (1-fx) + pixels[ya[:, None], xb[None, :]] * fx
    lower = pixels[yb[:, None], xa[None, :]] * (1-fx) + pixels[yb[:, None], xb[None, :]] * fx
    resized = upper * (1-fy) + lower * fy
    if bgr:
        resized = resized[:, :, ::-1]
    normalized = (resized / 255 - np.array([.485, .456, .406])) / np.array([.229, .224, .225])
    return np.ascontiguousarray(normalized.transpose(2, 0, 1)[None].astype(np.float32))
