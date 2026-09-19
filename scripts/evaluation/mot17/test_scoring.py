"""原创人工可核对的评分样例，不包含基准数据。"""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import subprocess
import sys
import hashlib
import zipfile

from evaluator import score, prepare, main

REPO = Path(__file__).resolve().parents[3]
TMP = REPO / '.tmp'


class ScoringTests(unittest.TestCase):
    def test_invalid_archive_is_rejected_before_extraction(self):
        TMP.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TMP) as temporary:
            root = Path(temporary)
            archive = root / "bad.zip"
            archive.write_bytes(b"wrong dataset")
            with self.assertRaisesRegex(ValueError, "SHA256"):
                prepare(archive, root / "data")
            self.assertFalse((root / "data").exists())

    def test_prepare_rejects_outside_before_reading_archive(self):
        with tempfile.TemporaryDirectory() as outside:
            with self.assertRaisesRegex(ValueError, r"\.tmp"):
                prepare(Path(outside) / 'missing.zip', Path(outside) / 'input')
            self.assertFalse((Path(outside) / 'input').exists())

    def test_existing_external_archive_is_readonly_and_original_fixture_extracts_inside_tmp(self):
        TMP.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TMP) as temporary, tempfile.TemporaryDirectory() as outside:
            root, archive = Path(temporary), Path(outside) / 'original.zip'
            contents = {'seqinfo.ini': b'[Sequence]\nname=original\n', 'det/det.txt': b'1,-1,1,1,10,10,1\n', 'gt/gt.txt': b'1,1,1,1,10,10,1,1,1\n'}
            with zipfile.ZipFile(archive, 'w') as fixture:
                for name, content in contents.items():
                    fixture.writestr(f'train/original/{name}', content)
            original = archive.read_bytes()
            dataset = {'bytes': len(original), 'sha256': hashlib.sha256(original).hexdigest(), 'sequences': ['original']}
            with patch.dict('evaluator.LOCK', {'dataset': dataset}), patch.object(sys, 'argv', ['evaluator.py', 'prepare', '--archive', str(archive), '--output', str(root / 'input')]):
                main()
            for name, content in contents.items():
                self.assertEqual((root / 'input/original' / name).read_bytes(), content)
            self.assertEqual(archive.read_bytes(), original)
            self.assertEqual(set(json.loads((root / 'input-hashes.json').read_text())['original']), set(contents))

    def test_cli_preflights_all_write_targets_before_network_or_scoring(self):
        TMP.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TMP) as temporary, tempfile.TemporaryDirectory() as outside:
            root, external = Path(temporary), Path(outside)
            alias = root / 'alias'
            if os.name == 'nt':
                subprocess.run(['node', '-e', "require('node:fs').symlinkSync(process.argv[1], process.argv[2], 'junction')", str(external), str(alias)], check=True, capture_output=True)
            else:
                alias.symlink_to(external, target_is_directory=True)
            existing = root / 'existing.zip'
            existing.write_bytes(b'preserve')
            existing_directory = root / 'existing-directory'
            existing_directory.mkdir()
            targets = [REPO / 'reports' / 'mot17-must-not-create', external / 'new', alias / 'new']
            with patch('urllib.request.urlopen', side_effect=AssertionError('不应联网')) as network, patch('evaluator.score', side_effect=AssertionError('不应评分')) as scoring:
                for target in targets + [existing, existing_directory]:
                    for arguments in [
                        ['prepare', '--archive', str(target), '--download', '--output', str(root / 'input')],
                        ['prepare', '--archive', str(existing), '--output', str(target)],
                    ]:
                        with self.subTest(arguments=arguments), patch.object(sys, 'argv', ['evaluator.py', *arguments]):
                            with self.assertRaises((ValueError, FileExistsError)):
                                main()
                            self.assertFalse((root / 'input').exists())
                for target in targets:
                    with self.subTest(scoring_target=target), patch.object(sys, 'argv', ['evaluator.py', 'score', '--run', str(target), '--trackeval', str(external)]):
                        with self.assertRaisesRegex(ValueError, r'\.tmp'):
                            main()
                run = root / 'existing-run'
                run.mkdir()
                (run / 'metrics.json').write_text('preserve')
                with patch.object(sys, 'argv', ['evaluator.py', 'score', '--run', str(run), '--trackeval', str(external)]):
                    with self.assertRaises(FileExistsError):
                        main()
                network.assert_not_called()
                scoring.assert_not_called()
                self.assertEqual(existing.read_bytes(), b'preserve')
                self.assertEqual(list(external.iterdir()), [])

    def test_existing_manifest_rejects_before_download(self):
        TMP.mkdir(exist_ok=True)
        with tempfile.TemporaryDirectory(dir=TMP) as temporary:
            root = Path(temporary)
            (root / 'input-hashes.json').write_text('preserve')
            with patch('urllib.request.urlopen', side_effect=AssertionError('不应联网')) as network, patch.object(sys, 'argv', ['evaluator.py', 'prepare', '--archive', str(root / 'new.zip'), '--download', '--output', str(root / 'input')]):
                with self.assertRaises(FileExistsError):
                    main()
                network.assert_not_called()
                self.assertFalse((root / 'new.zip').exists())
                self.assertFalse((root / 'input').exists())

    def test_official_metrics_and_distractor_preprocessing(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            gt = root / "gt" / "original" / "gt"
            gt.mkdir(parents=True)
            (gt / "gt.txt").write_text("".join(f"{t},1,1,1,10,10,1,1,1\n{t},2,101,1,10,10,1,8,1\n" for t in range(1, 5)))
            cases = {
                "perfect": ([1, 1, 1, 1], (1, 0, 1, 0, 0)),
                "switch": ([1, 1, 2, 2], (0.5, 1, 0.75, 0, 0)),
                "miss": ([1, 1, None, None], (2 / 3, 0, 0.5, 0, 2)),
                "distractor": ([1, 1, 1, 1], (1, 0, 1, 0, 0)),
            }
            for case, (ids, expected) in cases.items():
                output = root / "trackers" / case / "data"
                output.mkdir(parents=True)
                rows = "".join(f"{t},{identity},1,1,10,10,1,-1,-1,-1\n" for t, identity in enumerate(ids, 1) if identity is not None)
                if case == "distractor":
                    rows += "".join(f"{t},2,101,1,10,10,1,-1,-1,-1\n" for t in range(1, 5))
                (output / "original.txt").write_text(rows)
            result = score(Path(os.environ["TRACKEVAL_PATH"]), root / "gt", root / "trackers", {"original": 4}, list(cases))
            for case, (_, expected) in cases.items():
                actual = result[case]["combined"]
                for key, value in zip(["IDF1", "IDSW", "MOTA", "FP", "FN"], expected):
                    self.assertAlmostEqual(actual[key], value, msg=f"{case}: {key}")
                self.assertEqual(actual["GT"], 4)


if __name__ == "__main__":
    unittest.main()
