"""Filesystem regression tests; no Kokoro model or audio packages required."""

import os
import io
import json
from pathlib import Path
import stat
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'resources' / 'tts'))
from kokoro_worker import main, remove_wavs_safely, write_wav_safely


class FakeSoundFile:
    def write(self, wav_file, samples, sample_rate, format):
        wav_file.write(b"test WAV")


class SafeWavTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.session = self.root / "session"
        self.session.mkdir(mode=0o700)
        identity = self.session.stat()
        self.dev, self.ino = str(identity.st_dev), str(identity.st_ino)
        self.wav = self.session / "seg-1.wav"
        self.victim = self.root / "victim"
        self.victim.write_bytes(b"keep me")

    def write(self, **identity):
        write_wav_safely(FakeSoundFile(), str(self.wav), [], 24000,
                         **(identity or {"expected_dev": self.dev, "expected_ino": self.ino}))

    def remove(self, **kwargs):
        remove_wavs_safely(str(self.session), [self.wav.name], self.dev, self.ino, **kwargs)

    def test_writes_private_file(self):
        self.write()
        self.assertEqual(self.wav.read_bytes(), b"test WAV")
        self.assertEqual(stat.S_IMODE(self.wav.stat().st_mode), 0o600)

    def test_rejects_existing_output_symlink(self):
        self.wav.symlink_to(self.victim)
        with self.assertRaises(FileExistsError):
            self.write()
        self.assertEqual(self.victim.read_bytes(), b"keep me")

    def test_does_not_overwrite_existing_file(self):
        self.wav.write_bytes(b"existing")
        with self.assertRaises(FileExistsError):
            self.write()
        self.assertEqual(self.wav.read_bytes(), b"existing")

    def test_requires_directory_identity(self):
        with self.assertRaises(ValueError):
            self.write(expected_dev=None, expected_ino=None)
        self.assertFalse(self.wav.exists())

    def test_rejects_wrong_device_or_inode(self):
        for dev, ino in [(str(int(self.dev) + 1), self.ino), (self.dev, str(int(self.ino) + 1))]:
            with self.subTest(dev=dev, ino=ino), self.assertRaises(ValueError):
                self.write(expected_dev=dev, expected_ino=ino)
        self.assertFalse(self.wav.exists())

    def test_rejects_parent_symlink_for_write_and_cleanup(self):
        moved = self.root / "moved"
        self.session.rename(moved)
        self.session.symlink_to(moved, target_is_directory=True)
        for operation in [self.write, self.remove]:
            with self.subTest(operation=operation), self.assertRaises(OSError):
                operation()
        self.assertEqual(list(moved.iterdir()), [])

    def test_rejects_replaced_directory_for_cleanup(self):
        self.session.rename(self.root / "moved")
        self.session.mkdir()
        self.wav.write_bytes(b"replacement contents")
        with self.assertRaises(ValueError):
            self.remove(remove_dir=True)
        self.assertEqual(self.wav.read_bytes(), b"replacement contents")

    def test_cleanup_unlinks_symlink_without_touching_target(self):
        self.wav.symlink_to(self.victim)
        self.remove(remove_dir=True)
        self.assertFalse(self.session.exists())
        self.assertEqual(self.victim.read_bytes(), b"keep me")

    def test_cleanup_does_not_remove_untracked_contents(self):
        self.write()
        other = self.session / "unrelated"
        other.write_bytes(b"keep me too")
        with self.assertRaises(OSError):
            self.remove(remove_dir=True)
        self.assertFalse(self.wav.exists())
        self.assertEqual(other.read_bytes(), b"keep me too")

    def test_cleanup_rejects_path_traversal(self):
        with self.assertRaises(ValueError):
            remove_wavs_safely(str(self.session), ["../victim"], self.dev, self.ino)
        self.assertEqual(self.victim.read_bytes(), b"keep me")

    def test_cleanup_stays_in_open_directory_when_path_changes(self):
        self.write()
        replacement = self.root / "replacement"
        replacement.mkdir()
        target = replacement / self.wav.name
        target.write_bytes(b"do not delete")
        moved = self.root / "moved"
        real_unlink = os.unlink

        def swap_then_unlink(name, *, dir_fd):
            self.session.rename(moved)
            self.session.symlink_to(replacement, target_is_directory=True)
            return real_unlink(name, dir_fd=dir_fd)

        with patch("kokoro_worker.os.unlink", side_effect=swap_then_unlink):
            self.remove(remove_dir=True)
        self.assertFalse((moved / self.wav.name).exists())
        self.assertEqual(target.read_bytes(), b"do not delete")

    def test_protocol_synth_remove_cleanup_shutdown(self):
        identity = {"outDirDev": self.dev, "outDirIno": self.ino}
        requests = [
            {"type": "synth", "id": 1, "text": "hello", "outPath": str(self.wav), **identity},
            {"type": "remove", "outDir": str(self.session), "names": [self.wav.name], **identity},
            {"type": "cleanup", "outDir": str(self.session), "names": [], **identity},
            {"type": "shutdown"},
        ]
        model = SimpleNamespace(create=lambda *args, **kwargs: ([0], 24000))
        modules = {"kokoro_onnx": SimpleNamespace(Kokoro=lambda *args: model),
                   "soundfile": FakeSoundFile()}
        output = io.StringIO()
        with patch.dict(sys.modules, modules), \
                patch.object(sys, "argv", ["worker", "--model", "unused", "--voices", "unused"]), \
                patch.object(sys, "stdin", io.StringIO("\n".join(map(json.dumps, requests)))), \
                patch.object(sys, "stdout", output):
            with self.assertRaises(SystemExit) as exited:
                main()
        self.assertEqual(exited.exception.code, 0)
        responses = list(map(json.loads, output.getvalue().splitlines()))
        self.assertEqual([response["type"] for response in responses], ["ready", "result"])
        self.assertEqual(responses[1]["wavPath"], str(self.wav))
        self.assertFalse(self.session.exists())
        self.assertEqual(self.victim.read_bytes(), b"keep me")


if __name__ == "__main__":
    unittest.main()
