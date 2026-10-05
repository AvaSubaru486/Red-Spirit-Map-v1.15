"""Portable project-local model discovery and deployment."""
import json
import subprocess
import threading
from pathlib import Path
from urllib.request import ProxyHandler, build_opener

ROOT = Path(__file__).resolve().parent.parent
OPENER = build_opener(ProxyHandler({}))
LOCK = threading.Lock()
PROCESS = None

def discover():
    try:
        saved = json.loads((ROOT / "local-ai/server.json").read_text(encoding="utf-8-sig"))
        saved_port = int(saved["port"])
    except (OSError, ValueError, KeyError, TypeError):
        saved_port = 18090
    for port in dict.fromkeys((saved_port, 18090, 1235, 1234)):
        try:
            with OPENER.open(f"http://127.0.0.1:{port}/v1/models", timeout=2) as response:
                models = json.load(response).get("data", [])
            if models:
                return {"reachable": True, "base_url": f"http://127.0.0.1:{port}/v1", "model": models[0]["id"], "provider": "local"}
        except (OSError, ValueError):
            pass
    try:
        deployment = json.loads((ROOT / "自动部署/logs/ai-state.json").read_text(encoding="utf-8-sig"))
    except (OSError, ValueError):
        deployment = {"phase": "idle", "message": "尚未部署本地模型"}
    return {"reachable": False, "provider": "local", "model": "", "deployment": deployment}

def start():
    global PROCESS
    with LOCK:
        status = discover()
        if status["reachable"]:
            return status
        if PROCESS is None or PROCESS.poll() is not None:
            PROCESS = subprocess.Popen(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(ROOT / "自动部署/setup_ai.ps1")], cwd=ROOT, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        return {**status, "starting": True}
