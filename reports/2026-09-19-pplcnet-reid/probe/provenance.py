"""记录此次访问的来源页面状态与已核实/未核实的许可范围。"""
import argparse
import importlib.metadata
import json
from pathlib import Path
import urllib.error
from fetch import download


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", type=Path, required=True)
    args = parser.parse_args()
    pages = []
    for name, url in [("mot-home", "https://motchallenge.net/"), ("mot17-index", "https://motchallenge.net/data/MOT17/")]:
        try:
            record = download(url, args.work / "sources" / f"{name}.html")
            pages.append({"status": 200, **record})
        except urllib.error.HTTPError as error:
            pages.append({"url": url, "status": error.code, "message": str(error)})
    result = {"date": "2026-09-19", "pages": pages,
              "codeLicense": "固定 PaddleDetection 根 LICENSE 与模型/预处理文件头均为 Apache-2.0。未导入上游 tracker、matching 或 Kalman 实现。",
              "checkpointLicenseEvidence": "固定官方 README 与配置指向官方 BCEBOS 权重，两份权重完全相同；本轮读取文件未包含 checkpoint 独立模型卡或完整训练数据条款。根代码许可本身不补齐这些材料，亦不据此断言权重禁止商用。",
              "trainingDisclosure": "README 第176行记载 Market1501（751类），训练细节待 PaddleClas 公布。实际 checkpoint 有额外 head.weight [512,1502]，不被官方 Embedding 类使用；本轮仅移除该训练头，加载全部146个推理状态张量。不能由1502维分类头反推新的训练数据清单。",
              "datasetEvidence": "官方 MOT17 下载仍可用；2026-09-19 数据页面说明网站已归档，在线提交评估关闭；主页返回410。本轮未取得完整许可页面。只进行本地研究，不分发原图、完整GT或把其许可套给模型。",
              "preprocessing": "模型输出未经L2归一化。正常RGB/BGR与上游转置路径是明确不同的特征空间；同一512维也不能混用。正常RGB的小样本结果为探索性观察，不能确定未公开的训练预处理。",
              "exportWarning": "Paddle 2.6.2 的 to_static 默认 full_graph=False 曾提示 input_spec 在此步不生效；后续 jit.save 输出和 ONNX checker 确认固定输入[1,3,192,64]与输出[1,512]，并完成实际运行验证。"}
    (args.work / "source-review.json").write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    packages = ["paddlepaddle", "paddle2onnx", "onnx", "onnxruntime", "opencv-python", "numpy"]
    text = "# 本次 Python 3.11 环境的直接依赖版本；不包含传递依赖或 wheel 哈希锁。\n" + "\n".join(f"{p}=={importlib.metadata.version(p)}" for p in packages) + "\n"
    (args.work / "requirements.txt").write_text(text, encoding="utf-8")
    print(json.dumps(pages, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
