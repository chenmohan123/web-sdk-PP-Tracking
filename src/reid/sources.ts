import registeredSources from '../../models/pplcnet-reid/0.1.0/sources.json';
import { ReIdError } from './errors';
import type { ReIdSource } from './types';

/** 返回独立冻结快照，调用者不能改写内置来源注册。 */
export function getReIdModelSource(kind: ReIdSource['kind'] = 'modelscope'): ReIdSource {
  if (kind !== 'modelscope' && kind !== 'huggingface') throw new ReIdError('INVALID_MANIFEST', '模型来源不受支持');
  const source = registeredSources.find(item => item.kind === kind);
  if (!source) throw new ReIdError('INVALID_MANIFEST', '模型来源尚未注册');
  return Object.freeze({ ...source, kind });
}
