"""一次性研究：只导入有 Apache 文件头的 PPLCNet 模型，不加载 ppdet 包。"""
import argparse
import importlib.util
import json
from pathlib import Path
import sys
import numpy as np
import onnx
import paddle
import paddle2onnx
from fetch import identity


def load_model(work):
    source = work / "sources/ppdet/modeling/reid/pplcnet_embedding.py"
    code = source.read_text(encoding="utf-8")
    assert "Licensed under the Apache License, Version 2.0" in code
    assert code.count("from ppdet.core.workspace import register") == 1
    assert code.count("@register") == 1
    code = code.replace("from ppdet.core.workspace import register", "# 研究适配：省略 ppdet 注册依赖，模型计算保持原样。").replace("@register\n", "")
    target = work / "pplcnet_model.py"
    target.write_text(code, encoding="utf-8")
    spec = importlib.util.spec_from_file_location("pplcnet_probe_model", target)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    model = module.PPLCNetEmbedding(scale=2.5, input_ch=1280, output_ch=512)
    checkpoint = paddle.load(str(work / "assets/readme.pdparams"))
    expected = model.state_dict()
    assert not (set(expected) - set(checkpoint)), "模型参数缺失"
    extras = set(checkpoint) - set(expected)
    assert extras == {"head.weight"}, f"未核对的多余参数 {extras}"
    for key, value in expected.items():
        assert list(value.shape) == list(checkpoint[key].shape), key
    missing, unexpected = model.set_state_dict({key: checkpoint[key] for key in expected})
    assert not missing and not unexpected
    model.eval()
    return model, {"loadedTensors": len(expected), "loadedElements": sum(int(np.prod(v.shape)) for v in expected.values()),
                   "unusedTrainingHead": {key: list(checkpoint[key].shape) for key in sorted(extras)},
                   "source": identity(source), "adaptedSource": identity(target)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", type=Path, required=True)
    args = parser.parse_args()
    model, details = load_model(args.work)
    prefix = str(args.work / "assets/pplcnet")
    spec = paddle.static.InputSpec([1, 3, 192, 64], "float32", "crops")
    paddle.jit.save(paddle.jit.to_static(model, input_spec=[spec]), prefix)
    target = args.work / "assets/pplcnet-fp32.onnx"
    data = paddle2onnx.export(prefix + ".pdmodel", prefix + ".pdiparams", opset_version=17, enable_onnx_checker=True)
    target.write_bytes(data)
    graph = onnx.load(target)
    onnx.checker.check_model(graph, full_check=True)
    details.update({"date": "2026-09-19", "python": sys.version, "paddle": paddle.__version__, "paddle2onnx": paddle2onnx.__version__,
                    "onnx": onnx.__version__, "opset": [{"domain": x.domain, "version": x.version} for x in graph.opset_import],
                    "nodes": len(graph.graph.node), "operators": sorted(set(x.op_type for x in graph.graph.node)),
                    "inputs": [{"name": x.name, "shape": [d.dim_value for d in x.type.tensor_type.shape.dim]} for x in graph.graph.input],
                    "outputs": [{"name": x.name, "shape": [d.dim_value for d in x.type.tensor_type.shape.dim]} for x in graph.graph.output],
                    "assets": {p.name: identity(p) for p in (args.work / "assets").iterdir() if p.is_file()}})
    (args.work / "conversion.json").write_text(json.dumps(details, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: v for k, v in details.items() if k != "assets"}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
