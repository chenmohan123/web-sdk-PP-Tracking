"""将固定 ReID 模型分发到用户的双源；默认只准备，本次明确指定 --publish 才写远程。"""
import argparse, datetime, hashlib, json, pathlib, re, shutil, subprocess
import requests
from huggingface_hub import HfApi
from modelscope.hub.api import HubApi

ROOT = pathlib.Path(__file__).resolve().parents[1]
META = ROOT / 'models/pplcnet-reid/0.1.0'
WORK = ROOT / '.tmp/reid-distribution'
REPO = 'chenmohan/web-sdk-pp-tracking'
REPORT = ROOT / 'reports/2026-09-21-reid-distribution'

def identity(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}

def run():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', type=pathlib.Path, required=True)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    model = json.loads((META / 'model.json').read_text(encoding='utf-8'))
    expected = {k:model[k] for k in ('bytes','sha256')}
    if identity(args.model) != expected: raise ValueError('模型大小或SHA不符，停止')
    stage = WORK / 'upload'
    nested = stage / 'pplcnet-reid/0.1.0'
    nested.mkdir(parents=True, exist_ok=True)
    for name in ('README.md','README.en.md','LICENSE','NOTICE','model.json'):
        shutil.copyfile(META/name,nested/name)
        if name != 'model.json': shutil.copyfile(META/name,stage/name)
    shutil.copyfile(args.model,nested/'pplcnet-reid-fp32.onnx')
    (stage/'configuration.json').write_text('{}\n', encoding='utf-8')
    paths = sorted(p for p in stage.rglob('*') if p.is_file())
    allowed = {'README.md','README.en.md','LICENSE','NOTICE','configuration.json'} | {
        'pplcnet-reid/0.1.0/'+n for n in ('README.md','README.en.md','LICENSE','NOTICE','model.json','pplcnet-reid-fp32.onnx')}
    if {p.relative_to(stage).as_posix() for p in paths} != allowed: raise ValueError('上传目录不满足白名单')
    REPORT.mkdir(parents=True, exist_ok=True)
    inventory=[{'path':p.relative_to(stage).as_posix(),**identity(p)} for p in paths]
    (REPORT/'upload-inventory.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'preparedFiles':len(paths),'model':expected,'publishRequested':args.publish}),flush=True)
    if not args.publish: return

    # 使用既有宿主认证；不读出、打印或保存token，禁止覆盖已有模型版本。
    hf=HfApi()
    if hf.whoami().get('name') != 'chenmohan': raise ValueError('HF账户与目标不一致')
    for path in ('README.md',model['path']):
        response=requests.get(f'https://huggingface.co/{REPO}/resolve/main/{path}',timeout=30,stream=True)
        code=response.status_code; response.close()
        if code == 200: raise ValueError('目标HF仓库已含文件，请先核验已有提交，禁止盲目覆盖')
        if code not in (401,404): raise ValueError(f'HF目标预检异常状态{code}')
    hf.create_repo(REPO,repo_type='model',private=False,exist_ok=True)
    hf_commit=hf.upload_folder(repo_id=REPO,folder_path=str(stage),repo_type='model',commit_message='发布 PPLCNet ReID FP32 固定转换与来源说明').oid
    (WORK/'hf-commit.txt').write_text(hf_commit,encoding='utf-8')
    print(json.dumps({'huggingfaceRevision':hf_commit}),flush=True)

    ms=HubApi()
    try:
        ms.get_model(REPO)
        exists=True
    except Exception as error:
        if type(error).__name__ != 'NotExistError': raise
        exists=False
    if exists: raise ValueError('目标MS仓库已存在，先核验既有提交，禁止盲目覆盖')
    ms.create_model(REPO,visibility='public',license='Apache License 2.0',description='Tracking SDK 可选人体 ReID FP32 ONNX，来源和转换范围见模型卡')
    ms.upload_folder(repo_id=REPO,folder_path=str(stage),commit_message='发布 PPLCNet ReID FP32 固定转换与来源说明',allow_patterns=sorted(allowed),disable_tqdm=True,use_cache=False)
    remote=subprocess.run(['git','ls-remote',f'https://modelscope.cn/{REPO}.git','refs/heads/master'],capture_output=True,text=True,check=True).stdout
    ms_commit=remote.split()[0]
    if not re.fullmatch('[a-f0-9]{40}',ms_commit): raise ValueError('MS revision无效')
    (WORK/'ms-commit.txt').write_text(ms_commit,encoding='utf-8')
    print(json.dumps({'modelscopeRevision':ms_commit}),flush=True)
    sources=[]
    for kind, revision, url in [
        ('modelscope',ms_commit,f'https://modelscope.cn/models/{REPO}/resolve/{ms_commit}/{model["path"]}'),
        ('huggingface',hf_commit,f'https://huggingface.co/{REPO}/resolve/{hf_commit}/{model["path"]}')]:
        # 匿名读取固定revision，哈希流验证，不保存带签名重定向地址。
        with requests.get(url,timeout=(20,180),stream=True) as response:
            response.raise_for_status(); digest=hashlib.sha256(); size=0
            for chunk in response.iter_content(1024*1024): size+=len(chunk); digest.update(chunk)
        if {'bytes':size,'sha256':digest.hexdigest()} != expected: raise ValueError(f'{kind}远程身份错误')
        sources.append({'kind':kind,'repository':REPO,'revision':revision,'path':model['path'],'downloadUrl':url,**expected})
        print(json.dumps({'verified':kind,**expected}),flush=True)
    (META/'sources.json').write_text(json.dumps(sources,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (REPORT/'distribution.json').write_text(json.dumps({'verifiedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'account':'chenmohan','anonymousDownload':True,'sources':sources,'uploadFiles':inventory},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__': run()
