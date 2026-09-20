"""保存此次读取到的来源身份和状态，避免把仓库许可扩写为未证明的结论。"""
import argparse
import hashlib
import json
from pathlib import Path
import urllib.request
import urllib.error

REVISION = "b25522a0f4bde8c80603f3ba5e3472059972e3b5"
SOURCES = [
    ("paddle-readme", f"https://raw.githubusercontent.com/PaddlePaddle/PaddleDetection/{REVISION}/README_en.md"),
    ("paddle-license", f"https://raw.githubusercontent.com/PaddlePaddle/PaddleDetection/{REVISION}/LICENSE"),
    ("paddle-reid-readme", f"https://raw.githubusercontent.com/PaddlePaddle/PaddleDetection/{REVISION}/configs/mot/deepsort/README_cn.md"),
    ("weight-directory-readme", "https://paddledet.bj.bcebos.com/models/mot/deepsort/README.md"),
    ("market1501-author-page", "https://zheng-lab-anu.github.io/Project/project_reid.html"),
    ("mot17-archive", "https://motchallenge.net/data/MOT17/"),
]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--work", required=True, type=Path)
    args = parser.parse_args()
    sources=args.work / "sources"
    sources.mkdir(parents=True, exist_ok=True)
    records=[]
    for name,url in SOURCES:
        try:
            with urllib.request.urlopen(url,timeout=45) as response:
                data=response.read()
                (sources/name).write_bytes(data)
                records.append({"name":name,"url":url,"finalUrl":response.url,"status":response.status,"bytes":len(data),"sha256":hashlib.sha256(data).hexdigest()})
        except urllib.error.HTTPError as error:
            records.append({"name":name,"url":url,"status":error.code})
    report={"date":"2026-09-20","upstreamRevision":REVISION,"sources":records,
            "licenseEvidence":"固定根README的License章节写明 PaddlePaddle is provided under the Apache 2.0 license；LICENSE和模型/预处理文件头相符。具体checkpoint独立许可/模型卡未在所读取资料中找到。检查权重目录README的404仅证明该URL不存在，不能证明其他位置没有条款。",
            "trainingEvidence":"官方ReID README记载PaddleClas提供、Market1501 751类、训练细节待公布。作者数据页面描述1501身份/32668框/6摄像头并要求研究使用时引用论文；本轮未在该页面找到完整权重再分发许可声明，不能把数据集说明当作checkpoint许可。",
            "redistribution":"本阶段完成本地模型卡草案及来源链说明；不声称已取得checkpoint专属授权，不分发权重、原图和完整GT。未来发布前应明确记录所采用许可依据与尚未披露信息；不预填虚构ModelScope/Hugging Face revision。"}
    (args.work/'sources.lock.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(records,ensure_ascii=False,indent=2))


if __name__=='__main__':
    main()
