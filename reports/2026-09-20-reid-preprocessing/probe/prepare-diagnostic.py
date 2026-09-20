"""生成带隐藏颜色、半透明及低alpha彩色像素的独立PNG诊断。"""
import argparse
import json
from pathlib import Path
import cv2
import numpy as np
from data import identity

parser=argparse.ArgumentParser()
parser.add_argument("--work",type=Path,required=True)
work=parser.parse_args().work
rgba=np.array([[[19,110,247,0],[0,0,0,128],[1,2,3,128],[255,128,1,1]]],dtype=np.uint8)
path=work/'assets/alpha-diagnostic.png'
assert cv2.imwrite(str(path),cv2.cvtColor(rgba,cv2.COLOR_RGBA2BGRA))
source={"rawRgba":rgba.reshape(-1).tolist(),"width":4,"height":1,"png":{"path":path.name,**identity(path)}}
(work/'assets/alpha-diagnostic.json').write_text(json.dumps(source,indent=2)+'\n',encoding='utf-8')
