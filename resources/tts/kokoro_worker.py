"""Kokoro TTS worker for mdviewer.

Persistent JSON-lines worker: loads the Kokoro ONNX model once, then
synthesizes WAV files on request. Protocol (one JSON object per line):

  stdin  -> {"id": 1, "type": "synth", "text": "...", "voice": "af_heart",
             "speed": 1.0, "outPath": "/tmp/session/seg-1.wav",
             "outDirDev": "1", "outDirIno": "2"}
            {"type": "remove", "outDir": "/tmp/session", "names": ["seg-1.wav"],
             "outDirDev": "1", "outDirIno": "2"}
            {"type": "cleanup", "outDir": "/tmp/session", "names": ["seg-1.wav"],
             "outDirDev": "1", "outDirIno": "2"}
            {"type": "shutdown"}
  stdout <- {"type": "ready", "version": 1}
            {"id": 1, "type": "result", "wavPath": "...",
             "durationSeconds": 1.23, "sampleRate": 24000}
            {"id": 1, "type": "error", "error": "..."}
            {"type": "fatal", "error": "..."}  (then non-zero exit)

All protocol lines are flushed immediately. Diagnostics go to stderr only —
stdout is reserved for protocol JSON (the Node client ignores non-JSON
lines defensively, but we never emit them on purpose).
"""

import argparse
import json
import os
import sys


def emit(obj):
    print(json.dumps(obj), flush=True)


def open_output_dir(parent, expected_dev, expected_ino):
    """Open the session directory without following a substituted symlink."""
    if not parent or expected_dev is None or expected_ino is None:
        raise ValueError("missing output directory identity")
    dir_fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
    try:
        dir_stat = os.fstat(dir_fd)
        if str(dir_stat.st_dev) != str(expected_dev):
            raise ValueError("output directory device changed")
        if str(dir_stat.st_ino) != str(expected_ino):
            raise ValueError("output directory inode changed")
    except BaseException:
        os.close(dir_fd)
        raise
    return dir_fd


def validate_name(name):
    if not isinstance(name, str) or name in {"", ".", ".."} or os.path.basename(name) != name:
        raise ValueError("invalid output filename")


def write_wav_safely(sf, out_path, samples, sample_rate, expected_dev=None, expected_ino=None):
    """Write a WAV without following attacker-created output symlinks."""
    parent = os.path.dirname(out_path)
    name = os.path.basename(out_path)
    validate_name(name)
    dir_fd = open_output_dir(parent, expected_dev, expected_ino)
    try:
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW
        fd = os.open(name, flags, 0o600, dir_fd=dir_fd)
    finally:
        os.close(dir_fd)

    with os.fdopen(fd, "wb") as wav_file:
        sf.write(wav_file, samples, sample_rate, format="WAV")


def remove_wavs_safely(parent, names, expected_dev, expected_ino, remove_dir=False):
    """Remove only requested WAVs through a validated directory descriptor."""
    for name in names:
        validate_name(name)
    dir_fd = open_output_dir(parent, expected_dev, expected_ino)
    try:
        for name in names:
            try:
                os.unlink(name, dir_fd=dir_fd)
            except FileNotFoundError:
                pass
        if remove_dir:
            current = os.lstat(parent)
            opened = os.fstat(dir_fd)
            if (current.st_dev, current.st_ino) == (opened.st_dev, opened.st_ino):
                # Never recursively delete contents from a substituted directory.
                os.rmdir(parent)
    finally:
        os.close(dir_fd)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", required=True)
    parser.add_argument("--voices", required=True)
    args = parser.parse_args()

    try:
        from kokoro_onnx import Kokoro
        import soundfile as sf
        model = Kokoro(args.model, args.voices)
    except Exception as exc:  # import failure, missing files, bad model
        emit({"type": "fatal", "error": f"{type(exc).__name__}: {exc}"})
        sys.exit(1)

    emit({"type": "ready", "version": 1})

    for raw in sys.stdin:  # EOF (parent died) ends the loop -> clean exit
        raw = raw.strip()
        if not raw:
            continue
        try:
            req = json.loads(raw)
        except json.JSONDecodeError:
            print(f"[kokoro_worker] ignoring non-JSON line: {raw[:80]}", file=sys.stderr)
            continue

        if req.get("type") == "shutdown":
            sys.exit(0)

        if req.get("type") in {"remove", "cleanup"}:
            try:
                remove_wavs_safely(
                    req["outDir"], req["names"], req.get("outDirDev"),
                    req.get("outDirIno"), remove_dir=req["type"] == "cleanup",
                )
            except Exception as exc:
                print(f"[kokoro_worker] cleanup skipped: {exc}", file=sys.stderr)
            continue

        if req.get("type") != "synth":
            emit({"id": req.get("id"), "type": "error",
                  "error": f"unknown request type: {req.get('type')!r}"})
            continue

        req_id = req.get("id")
        try:
            samples, sample_rate = model.create(
                req["text"],
                voice=req.get("voice", "af_heart"),
                speed=float(req.get("speed", 1.0)),
            )
            out_path = req["outPath"]
            write_wav_safely(
                sf,
                out_path,
                samples,
                sample_rate,
                expected_dev=req.get("outDirDev"),
                expected_ino=req.get("outDirIno"),
            )
            emit({
                "id": req_id,
                "type": "result",
                "wavPath": out_path,
                "durationSeconds": round(len(samples) / sample_rate, 3),
                "sampleRate": sample_rate,
            })
        except Exception as exc:
            emit({"id": req_id, "type": "error",
                  "error": f"{type(exc).__name__}: {exc}"})


if __name__ == "__main__":
    main()
