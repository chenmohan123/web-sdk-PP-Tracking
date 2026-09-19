"""原创人工可核对的评分样例，不包含基准数据。"""
import json
import os
from pathlib import Path
import tempfile
import unittest

from evaluator import score, prepare


class ScoringTests(unittest.TestCase):
    def test_invalid_archive_is_rejected_before_extraction(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "bad.zip"
            archive.write_bytes(b"wrong dataset")
            with self.assertRaisesRegex(ValueError, "SHA256"):
                prepare(archive, root / "data")
            self.assertFalse((root / "data").exists())

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
