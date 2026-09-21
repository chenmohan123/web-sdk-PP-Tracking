# 最终审查限定修复报告

日期：2026-09-21。仅执行最终审查新增P3的文档修复，未修改历史媒体准备脚本、正式评测工具、运行时、数据、模型、门户或实测identity。

SDK本地中文提交：`c3542d433eb63a66d81f3b072c6b65bb09679bd6`，说明“补充真实评测复跑时固定媒体锁恢复说明”。限定复审diff：`f02c9ca..c3542d4`。5个文件，38行增加、10行删除，提交后SDK工作树干净。

## 修复范围

仅修改SDK本轮报告中的`README.md`、`README.en.md`、`protocol.md`、`protocol.en.md`与`evidence.lock.json`；锁只更新四份文档的字节数/SHA。

四份文档均明确：准备图片完成后、执行run前，从SDK根目录执行以下命令恢复归档固定锁，再执行原工具说明中的新输出评测流程：

```powershell
Copy-Item -LiteralPath 'reports/2026-09-21-mot-reid/media.lock.json' -Destination '.tmp/mot17-reid-media/media.lock.json' -Force
```

历史`transferredBytesThisRun=876659951`为已归档下载观测，不代表复跑本次实际传输量。完整缓存重跑可能变0并改变整文件hash；恢复固定锁后，run仍逐张验证图片字节数、SHA256、CRC，不允许修改归档锁绕过身份校验。统计与身份分离保留为非阻塞工具待办，不影响本轮固定实测。

## 恢复步骤验证

只在新建忽略目录`.tmp/mot-reid-lock-restore-check-05d578bb89794b0abf084049a631ce65/`模拟，没有操作现有正式工作锁。测试步骤：

1. 读取归档锁文本，只将`"transferredBytesThisRun": 876659951`替换为0，写入新目录的`media.lock.json`。
2. 断言解析值为0，且整文件SHA与归档不同。
3. `Copy-Item -LiteralPath $archivePath -Destination $testLock -Force`，将归档字节复制到模拟工作锁。
4. 断言恢复后SHA与归档相同；测试前后读取现有`.tmp/mot17-reid-media/media.lock.json`哈希，断言未变。

实际输出（PowerShell测试退出0）：

```text
archivedTransferredBytes: 876659951
simulatedTransferredBytes: 0
simulatedHash: 5d91c504e3cefafdc56eb8cd3c0e0479c38e836cda5817dcedbb7c409b770238
restoredHash: 906491d5d02912f38cea5014b2b687fd8b5ae4a3ec55499439ad7c049b328cb5
existingWorkingLockUnchanged: true
```

没有重新执行媒体下载；此测试验证缓存统计变化→整文件hash变化→复制归档恢复固定字节的文档操作，不冒称完整图片下载/正式GPU重跑。

## 其他限定验证

`node reports/2026-09-21-mot-reid/verify.mjs --current`退出0，实际输出：

```text
通过：32份归档SHA256、5316帧计时/cold/warm/分位数、三算法逐段与官方合计公式、当前实现/构建身份。未重新运行TrackEval、模型或跟踪器。
```

四份文档相对链接逐项检查：`四份文档本地链接通过：30`，退出0。

`git diff --check`与`git diff --cached --check`均退出0，无输出。暂存后逐项读取`git show :reports/2026-09-21-mot-reid/<path>`并对照证据锁SHA：`32份Git暂存证据字节与锁一致`，退出0。

未重跑173项测试、正式GPU/Node/官方评分或门户build；该修复没有改变任何算法、评测行为或实测数据，不需要重复重型验证。媒体准备统计字段与固定身份混写仍是工具已知待办，本轮仅提供准确可执行的复跑说明，没有事后改写历史证据。
