"""Lightweight admin API server for Hermes Dashboard."""

import http.server
import json
import subprocess
import os
import sys
import re
from pathlib import Path
from datetime import datetime, timedelta

# Resolve paths: WSL bash can't see ~/.hermes directly on Windows.
# Hermes stores config under AppData\Local\hermes (no dot prefix)
_WINDOWS_HERMES = Path(r"C:\Users\kcrex\AppData\Local\hermes")
_WIN_CONFIG = _WINDOWS_HERMES / "config.yaml"
_WIN_MEMORY_DIR = _WINDOWS_HERMES / "memories"

FALLBACK_CONFIG = Path.home() / ".hermes" / "config.yaml"
FALLBACK_MEM = Path.home() / ".hermes" / "memories"

CONFIG_FILE = _WIN_CONFIG if _WIN_CONFIG.exists() else FALLBACK_CONFIG
MEMORY_DIR = _WIN_MEMORY_DIR if _WIN_MEMORY_DIR.exists() else FALLBACK_MEM
PORT = 9101

# Simple shared-secret token for dangerous endpoints (/terminal/run, /news-site/rebuild)
# Set DASHBOARD_API_TOKEN env var before starting the server.
# Without a token set, these endpoints return 403.
API_TOKEN = os.environ.get("DASHBOARD_API_TOKEN", "")


def run_cmd(cmd, timeout=30):
    """Run a shell command and return stdout/stderr."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True,
            timeout=timeout
        )
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return "", "Command timed out", 1


def parse_cron_list():
    """Parse 'hermes cron list' output into structured job data."""
    stdout, stderr, rc = run_cmd("hermes cron list")
    if rc != 0 or not stdout:
        return []

    jobs = {}
    current_job = None

    for line in stdout.split("\n"):
        stripped = line.strip()
        if not stripped:
            continue

        # Detect job ID line (hex string + [active|paused])
        id_match = re.match(r"^\s*([a-f0-9]{8,})\s+\[(active|paused)\]", stripped)
        if id_match:
            job_id = id_match.group(1)
            is_active = id_match.group(2) == "active"
            current_job = {
                "id": job_id,
                "name": None, "schedule": None, "enabled": is_active,
                "deliver": None, "model_provider": None, "model_name": None,
                "next_run": None, "last_run_status": None, "script": None,
                "repeat": None, "execution_id": None, "mode": None,
            }
            jobs[job_id] = current_job
            continue

        if not current_job:
            continue

        # Parse key-value pairs with flexible keys (including spaces)
        kv_match = re.match(r'^(.+?)\s*:\s*(.*)$', stripped)
        if kv_match and len(kv_match.group(1).strip()) < 20:
            key = kv_match.group(1).strip()
            val = kv_match.group(2).strip()

            # Strip box-drawing chars (U+2500-U+257F range)
            cleaned = []
            for ch in val:
                cp = ord(ch)
                if 0x2500 <= cp <= 0x257F:
                    continue  # skip box-drawing chars
                cleaned.append(ch)
            val = ''.join(cleaned).strip()
            if not val:
                continue

            if key == "Name":
                current_job["name"] = val
            elif key == "Schedule":
                current_job["schedule"] = val
            elif key == "Repeat":
                current_job["repeat"] = val
            elif key == "Next run":
                parts = val.split(" ")
                current_job["next_run"] = parts[0] if parts else None
            elif key == "Deliver":
                current_job["deliver"] = val
            elif key == "Script":
                current_job["script"] = val
            elif key == "Mode":
                current_job["mode"] = val
            elif key == "Last run":
                lower_val = val.lower()
                if "ok" in lower_val:
                    current_job["last_run_status"] = "ok"
                elif any(w in lower_val for w in ["fail", "error"]):
                    current_job["last_run_status"] = "fail"
            elif key == "Execution":
                exec_parts = val.split()
                if exec_parts and len(exec_parts[0]) == 32:
                    current_job["execution_id"] = exec_parts[0]

    # Enrich each job with model/provider from YAML config files
    cron_dir = _WINDOWS_HERMES / "cron"
    try:
        import yaml
        for job in jobs.values():
            yaml_path = cron_dir / "jobs" / f"{job['id']}.yaml"
            if yaml_path.exists():
                content = yaml.safe_load(yaml_path.read_text()) or {}
                model_cfg = content.get("model", {})
                if isinstance(model_cfg, dict):
                    job["model_provider"] = model_cfg.get("provider") or content.get("provider")
                    job["model_name"] = model_cfg.get("default") or model_cfg.get("name")
    except ImportError:
        pass  # yaml not available, skip enrichment

    # Also enrich from jobs.json if YAML files don't exist
    jobs_json_path = cron_dir / "jobs.json"
    if jobs_json_path.exists():
        try:
            import json as json_mod
            jobs_data = json_mod.loads(jobs_json_path.read_text())
            for job in jobs.values():
                for j in jobs_data.get("jobs", []):
                    if j.get("id") == job["id"]:
                        job["model_provider"] = j.get("provider", "")
                        job["model_name"] = j.get("model", "")
                        break
        except Exception:
            pass

    return list(jobs.values())


class AdminHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_json(self, data, status=200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = self.path.split("?")[0]

        if path == "/health":
            return self.send_json({"status": "ok", "server": "hermes-admin"})

        elif path == "/config":
            return self.get_config_endpoint()

        elif path == "/config/inference":
            return self.get_inference_endpoint()

        elif path == "/memory/user":
            entries = self.read_memory("USER.md")
            return self.send_json({"entries": entries})

        elif path == "/memory/system":
            entries = self.read_memory("MEMORY.md")
            return self.send_json({"entries": entries})

        elif path == "/memory/all":
            user_entries = self.read_memory("USER.md")
            sys_entries = self.read_memory("MEMORY.md")
            return self.send_json({
                "user": [{"id": i+1, **e} for i, e in enumerate(user_entries)],
                "system": [{"id": i+1, **e} for i, e in enumerate(sys_entries)]
            })

        elif path == "/cron/list":
            return self.send_json({"jobs": parse_cron_list()})

        elif path == "/cron/jobs/details":
            return self.send_json({"details": parse_cron_list()})

        elif path == "/sessions/current":
            return self.get_current_session_info()

        elif path == "/system/status":
            status = {
                "config_exists": CONFIG_FILE.exists(),
                "memory_dir_exists": MEMORY_DIR.exists(),
                "python_version": sys.version.split()[0],
                "timestamp": datetime.now().isoformat(),
                "hermes_home_windows": str(_WIN_CONFIG.parent),
            }
            return self.send_json(status)

        elif path == "/models/list":
            return self.get_models_list_endpoint()

        elif path == "/gateway/status":
            return self.get_gateway_status_endpoint()

        elif path.startswith("/cron/job/") and path.endswith("/model"):
            # /cron/job/<job_id>/model — get model pinning for a specific job
            job_id = path.split("/")[3]
            return self.get_cron_job_model_endpoint(job_id)

        elif path == "/admin" or path == "/admin.html":
            # Serve the admin dashboard page
            static_path = Path(__file__).parent / "out" / "admin.html"
            return self.serve_static(static_path)

        else:
            # Serve static files from out/ directory for the dashboard itself
            filename = "index.html" if (path == "/" or not path.endswith(".html")) else path.lstrip("/")
            static_path = Path(__file__).parent / "out" / filename
            return self.serve_static(static_path)

    def _check_token(self):
        """Check X-Dashboard-Token header against configured API_TOKEN.
        Returns True if auth passes (or if no token is configured — legacy mode)."""
        if not API_TOKEN:
            # No token configured — block dangerous endpoints entirely
            return False
        token = self.headers.get("X-Dashboard-Token", "")
        return token == API_TOKEN

    def do_POST(self):
        path = self.path.split("?")[0]

        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(content_length).decode()) if content_length > 0 else {}
        except Exception as e:
            return self.send_json({"error": "Invalid JSON: " + str(e)}, 400)

        if path == "/config/inference":
            provider = body.get("provider") or body.get("model_provider", "")
            model = body.get("model") or body.get("model_name", "")
            result = self.update_inference_config(provider, model)
            status_code = 200 if not result.get("error") else 500
            return self.send_json(result, status_code)

        elif path == "/memory/add":
            target_file = body.get("target", "user") + ".md" if body.get("type_name") != "system" else "MEMORY.md"
            content = body.get("content", "")
            result = self.add_memory_entry(target_file, content)
            status_code = 201 if not result.get("error") else 500
            return self.send_json(result, status_code)

        elif path == "/memory/remove":
            target_file = body.get("target", "user") + ".md" if body.get("type_name") != "system" else "MEMORY.md"
            entry_id = body.get("id")
            result = self.remove_memory_entry(target_file, entry_id)
            return self.send_json(result)

        elif path == "/cron/create":
            name = body.get("name", "")
            schedule = body.get("schedule", "")
            prompt = body.get("prompt", "")
            model_provider = body.get("model_provider") or "nous/tencent/hy3:free"
            model_name = body.get("model_name") or ""

            cmd_parts = ["hermes", "cron", "create"]
            if name:
                cmd_parts.extend(["--name", name])
            if schedule:
                cmd_parts.extend(["--schedule", schedule])
            if prompt:
                cmd_parts.append("--prompt=" + json.dumps(prompt))

            result = run_cmd(" ".join(cmd_parts))
            return self.send_json({
                "success": result[2] == 0,
                "output": result[0][:3000],
                "error_output": result[1][:1000] if result[1] else None
            })

        elif path == "/cron/update":
            job_id = body.get("id", "")
            action = body.get("action", "pause")
            cmd_parts = ["hermes", "cron", "update", job_id]
            if action == "pause":
                cmd_parts.append("--pause")
            elif action == "resume":
                cmd_parts.append("--resume")

            result = run_cmd(" ".join(cmd_parts))
            return self.send_json({
                "success": result[2] == 0,
                "output": result[0][:3000],
                "error_output": result[1][:1000] if result[1] else None
            })

        elif path == "/cron/remove":
            job_id = body.get("id", "")
            result = run_cmd(f"hermes cron remove {job_id}")
            return self.send_json({
                "success": result[2] == 0,
                "output": result[0][:3000],
                "error_output": result[1][:1000] if result[1] else None
            })

        elif path == "/model/test":
            provider = body.get("provider", "")
            model = body.get("model", "")
            if not provider or not model:
                return self.send_json({"error": "provider and model required"}, 400)
            result = self.test_model_connectivity(provider, model)
            status_code = 200 if result.get("success") else 500
            return self.send_json(result, status_code)

        elif path == "/cron/job/model":
            # Update model pinning for a cron job
            job_id = body.get("job_id", "")
            provider = body.get("provider", "")
            model = body.get("model", "")
            if not job_id or not provider or not model:
                return self.send_json({"error": "job_id, provider, and model required"}, 400)
            result = self.update_cron_job_model(job_id, provider, model)
            status_code = 200 if result.get("success") else 500
            return self.send_json(result, status_code)

        elif path == "/terminal/run":
            if not self._check_token():
                return self.send_json({"error": "Unauthorized. Set DASHBOARD_API_TOKEN and send X-Dashboard-Token header."}, 403)
            command = body.get("command", "")
            if not command:
                return self.send_json({"error": "No command provided"}, 400)
            stdout, stderr, rc = run_cmd(command)
            return self.send_json({
                "success": rc == 0,
                "output": stdout[:5000],
                "error_output": stderr[:2000] if stderr else None,
                "exit_code": rc
            })

        elif path == "/news-site/rebuild":
            if not self._check_token():
                return self.send_json({"error": "Unauthorized. Set DASHBOARD_API_TOKEN and send X-Dashboard-Token header."}, 403)
            result = run_cmd("cd /c/Users/kcrex/news-site && npm run build")
            return self.send_json({
                "success": result[2] == 0,
                "output": result[0][:5000],
                "error_output": result[1][:2000] if result[1] else None
            })

        elif path == "/watchdog/trigger":
            job_id = body.get("job_id", "")
            result = run_cmd(f"hermes cron run {job_id}")
            return self.send_json({
                "success": result[2] == 0,
                "output": result[0][:5000],
                "error_output": result[1][:2000] if result[1] else None
            })

        else:
            return self.send_json({"error": "Not found"}, 404)

    # ==================== Config endpoints ====================

    def get_config_endpoint(self):
        if not CONFIG_FILE.exists():
            return self.send_json({"exists": False, "message": "Config file not found"})
        try:
            content = CONFIG_FILE.read_text()
            lines = content.split("\n")
            sections = {}
            current_section = None
            for line in lines:
                stripped = line.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                indent = len(line) - len(line.lstrip())
                if indent == 0 and ":" in stripped:
                    key, _, _ = stripped.partition(":")
                    current_section = key.strip()
                    sections[current_section] = []
                elif current_section:
                    sections[current_section].append(stripped)

            return self.send_json({
                "exists": True,
                "sections": {k: len(v) for k, v in sections.items()},
            })
        except Exception as e:
            return self.send_json({"error": str(e)})

    def get_inference_endpoint(self):
        if not CONFIG_FILE.exists():
            return self.send_json({"exists": False})

        try:
            content = CONFIG_FILE.read_text()
            lines = content.split("\n")
            provider = None
            model = None
            base_url = None

            in_model_section = False
            for line in lines:
                stripped = line.strip()
                if not in_model_section and re.match(r'^\s*model\s*:', stripped):
                    in_model_section = True
                    continue
                elif in_model_section:
                    if stripped.startswith("provider"):
                        _, _, val = stripped.partition(":")
                        provider = val.strip().strip("'\"")
                    elif stripped.startswith("default"):
                        _, _, val = stripped.partition(":")
                        model = val.strip().strip("'\"")
                    elif stripped.startswith("base_url"):
                        _, _, val = stripped.partition(":")
                        base_url = val.strip().strip("'\"")
                    elif re.match(r'^[a-z]', stripped) and ":" in stripped:
                        break

            return self.send_json({
                "exists": True,
                "provider": provider or "",
                "model": model or "",
                "base_url": base_url or ""
            })
        except Exception as e:
            return self.send_json({"error": str(e)})

    def update_inference_config(self, provider=None, model=None):
        if not CONFIG_FILE.exists():
            return {"success": False, "message": "Config file not found."}

        commands = []
        if provider:
            commands.append(f'hermes config set model.provider "{provider}"')
        if model:
            commands.append(f'hermes config set model.default "{model}"')

        if not commands:
            return {"success": False, "message": "No changes provided."}

        full_cmd = " && ".join(commands) + " && hermes gateway restart"
        stdout, stderr, rc = run_cmd(full_cmd)

        cmd_text = "\n".join(commands)
        if rc == 0 and "error" not in stdout.lower():
            return {
                "success": True,
                "message": f"Config updated. Commands executed:\n{cmd_text}",
                "commands_executed": commands,
                "output": stdout[:1000]
            }
        else:
            return {
                "success": False,
                "manual_commands": commands + ["hermes gateway restart"],
                "message": f"Command failed. Run these manually:\n{cmd_text}\n\nThen: hermes gateway restart",
                "error_output": stderr[:500] if stderr else None,
                "output": stdout[:1000]
            }

    # ==================== Model endpoints ====================

    def get_models_list_endpoint(self):
        """Return available models and providers from config + known providers."""
        models = {
            "current": {},
            "providers": [],
            "known_models": {},
        }

        # Get current config
        if CONFIG_FILE.exists():
            try:
                content = CONFIG_FILE.read_text()
                lines = content.split("\n")
                in_model_section = False
                for line in lines:
                    stripped = line.strip()
                    if not in_model_section and re.match(r'^\s*model\s*:', stripped):
                        in_model_section = True
                        continue
                    elif in_model_section:
                        if stripped.startswith("provider"):
                            _, _, val = stripped.partition(":")
                            models["current"]["provider"] = val.strip().strip("'\"").strip()
                        elif stripped.startswith("default"):
                            _, _, val = stripped.partition(":")
                            models["current"]["model"] = val.strip().strip("'\"").strip()
                        elif stripped.startswith("base_url"):
                            _, _, val = stripped.partition(":")
                            models["current"]["base_url"] = val.strip().strip("'\"").strip()
                        elif re.match(r'^[a-z]', stripped) and ":" in stripped:
                            break
            except Exception as e:
                models["error"] = str(e)

        # Known providers and their common models
        models["providers"] = [
            {"id": "lmstudio", "name": "LM Studio (local)", "models": [
                "qwen/qwen3.6-35b-a3b",
                "qwen/qwen3.6-27b-a10b",
                "qwen/qwen3.6-27b",
                "qwen/qwen3.6-14b",
                "qwen/qwen3.6-7b",
            ]},
            {"id": "nous", "name": "Nous Portal", "models": [
                "poolside/laguna-s-2.1:free",
                "poolside/laguna-xs-2.1:free",
                "poolside/laguna-l-2.1:free",
                "qwen/qwen3.6-35b-a3b",
                "qwen/qwen3.6-27b-a10b",
                "qwen/qwen3.6-27b",
                "tencent/hy3:free",
                "inclusionai/ling-3.0-flash:free",
            ]},
            {"id": "openrouter", "name": "OpenRouter", "models": [
                "anthropic/claude-sonnet-4",
                "anthropic/claude-3-7-sonnet",
                "openai/gpt-oss-120b",
                "openai/gpt-4o",
                "google/gemini-pro-2.5",
                "google/gemini-2.5-flash",
                "qwen/qwen3.6-35b-a3b",
                "qwen/qwen3.6-27b-a10b",
            ]},
            {"id": "anthropic", "name": "Anthropic (Claude API)", "models": [
                "claude-sonnet-4",
                "claude-3-7-sonnet-20250219",
                "claude-3-5-sonnet-20241022",
                "claude-3-5-haiku-20241022",
            ]},
            {"id": "openai", "name": "OpenAI", "models": [
                "gpt-4o",
                "gpt-4o-mini",
                "gpt-4-turbo",
                "gpt-3.5-turbo",
            ]},
            {"id": "google", "name": "Google Gemini", "models": [
                "gemini-2.5-flash",
                "gemini-2.5-pro",
                "gemini-1.5-pro",
                "gemini-1.5-flash",
            ]},
        ]

        # Build known_models lookup: provider -> [models]
        models["known_models"] = {p["id"]: p["models"] for p in models["providers"]}

        # Get cron jobs with model pinning info
        cron_jobs = []
        for job in parse_cron_list():
            cron_jobs.append({
                "id": job["id"],
                "name": job.get("name", ""),
                "enabled": job.get("enabled", False),
                "provider": job.get("model_provider") or "default",
                "model": job.get("model_name") or "default",
                "schedule": job.get("schedule", ""),
                "last_run_status": job.get("last_run_status", ""),
            })
        models["cron_jobs"] = cron_jobs

        return self.send_json(models)

    def get_gateway_status_endpoint(self):
        """Return gateway process status and health."""
        stdout, stderr, rc = run_cmd("hermes gateway status")
        running = rc == 0 and "running" in stdout.lower()

        status = {
            "running": running,
            "output": stdout[:2000],
            "error_output": stderr[:500] if stderr else None,
        }

        # Try to get current config as well
        if CONFIG_FILE.exists():
            try:
                content = CONFIG_FILE.read_text()
                lines = content.split("\n")
                in_model_section = False
                for line in lines:
                    stripped = line.strip()
                    if not in_model_section and re.match(r'^\s*model\s*:', stripped):
                        in_model_section = True
                        continue
                    elif in_model_section:
                        if stripped.startswith("provider"):
                            _, _, val = stripped.partition(":")
                            status["current_provider"] = val.strip().strip("'\"").strip()
                        elif stripped.startswith("default"):
                            _, _, val = stripped.partition(":")
                            status["current_model"] = val.strip().strip("'\"").strip()
                        elif stripped.startswith("base_url"):
                            _, _, val = stripped.partition(":")
                            status["base_url"] = val.strip().strip("'\"").strip()
                        elif re.match(r'^[a-z]', stripped) and ":" in stripped:
                            break
            except Exception:
                pass

        return self.send_json(status)

    def test_model_connectivity(self, provider, model):
        """Test if a model is reachable by making a quick API call."""
        # For LM Studio, try a simple models endpoint
        if provider == "lmstudio":
            stdout, stderr, rc = run_cmd("curl -s http://localhost:1234/v1/models 2>&1")
            if rc == 0 and "error" not in stdout.lower():
                return {
                    "success": True,
                    "message": f"LM Studio is reachable. Model '{model}' is available.",
                    "provider": provider,
                    "model": model,
                    "details": stdout[:500]
                }
            else:
                return {
                    "success": False,
                    "message": f"LM Studio not reachable at localhost:1234. Start LM Studio server first.",
                    "provider": provider,
                    "model": model,
                    "error": stderr[:300] if stderr else stdout[:300]
                }

        # For other providers, check if the gateway is running and can route
        stdout, stderr, rc = run_cmd("hermes gateway status")
        gateway_running = rc == 0 and "running" in stdout.lower()

        if not gateway_running:
            return {
                "success": False,
                "message": "Hermes gateway is not running. Start it with 'hermes gateway start'.",
                "provider": provider,
                "model": model
            }

        # Try a simple health check through the gateway
        stdout, stderr, rc = run_cmd("curl -s http://localhost:9100/health 2>&1")
        if rc == 0 and "ok" in stdout.lower():
            return {
                "success": True,
                "message": f"Gateway is running. Provider '{provider}' / model '{model}' configured.",
                "provider": provider,
                "model": model,
                "gateway_running": True
            }
        else:
            return {
                "success": False,
                "message": f"Gateway is not responding properly.",
                "provider": provider,
                "model": model,
                "gateway_running": gateway_running,
                "error": stderr[:300] if stderr else stdout[:300]
            }

    def update_cron_job_model(self, job_id, provider, model):
        """Update the model/provider pinning for a cron job by editing its config.
        Tries YAML first, falls back to jobs.json."""
        cron_jobs_dir = _WINDOWS_HERMES / "cron" / "jobs"
        yaml_path = cron_jobs_dir / f"{job_id}.yaml"
        jobs_json_path = _WINDOWS_HERMES / "cron" / "jobs.json"

        # Try YAML file first
        if yaml_path.exists():
            try:
                import yaml
                content = yaml.safe_load(yaml_path.read_text()) or {}
                if "model" not in content or not isinstance(content["model"], dict):
                    content["model"] = {}
                content["model"]["provider"] = provider
                content["model"]["default"] = model
                yaml_path.write_text(yaml.dump(content, default_flow_style=False))
                return {
                    "success": True,
                    "message": f"Job '{job_id}' updated via YAML: provider={provider}, model={model}.",
                    "job_id": job_id,
                    "provider": provider,
                    "model": model,
                    "config_path": str(yaml_path)
                }
            except ImportError:
                pass
            except Exception as e:
                return {
                    "success": False,
                    "message": f"Error updating YAML config: {str(e)}"
                }

        # Fall back to jobs.json
        if jobs_json_path.exists():
            try:
                import json as json_mod
                jobs_data = json_mod.loads(jobs_json_path.read_text())
                updated = False
                for j in jobs_data.get("jobs", []):
                    if j.get("id") == job_id:
                        j["provider"] = provider
                        j["model"] = model
                        updated = True
                        break

                if updated:
                    jobs_json_path.write_text(json_mod.dumps(jobs_data, indent=2))
                    return {
                        "success": True,
                        "message": f"Job '{job_id}' updated via jobs.json: provider={provider}, model={model}.",
                        "job_id": job_id,
                        "provider": provider,
                        "model": model,
                        "config_path": str(jobs_json_path)
                    }
                else:
                    return {
                        "success": False,
                        "message": f"Job '{job_id}' not found in jobs.json."
                    }
            except Exception as e:
                return {
                    "success": False,
                    "message": f"Error updating jobs.json: {str(e)}"
                }

        return {
            "success": False,
            "message": f"No config file found for job '{job_id}'."
        }

    def get_cron_job_model_endpoint(self, job_id):
        """Get the current model/provider pinning for a specific cron job."""
        # Search through cron jobs for the matching ID
        for job in parse_cron_list():
            if job["id"] == job_id:
                return self.send_json({
                    "job_id": job_id,
                    "name": job.get("name", ""),
                    "provider": job.get("model_provider") or "default",
                    "model": job.get("model_name") or "default",
                    "enabled": job.get("enabled", False),
                    "schedule": job.get("schedule", ""),
                })
        return self.send_json({"error": "Job not found"}, 404)

    # ==================== Memory endpoints ====================

    def read_memory(self, filename="USER.md"):
        filepath = MEMORY_DIR / filename
        if not filepath.exists():
            return []

        try:
            content = filepath.read_text()
            entries = []
            current_content = []

            for line in content.split("\n"):
                stripped = line.strip()
                if stripped.startswith("§") or stripped.startswith("---"):
                    if current_content and any(l.strip() for l in current_content):
                        content_str = "\n".join(current_content).strip()
                        ts_match = re.match(r"§\s*\[([^\]]+)\]\s*(.*)", stripped)
                        entries.append({
                            "content": content_str,
                            "timestamp": ts_match.group(1) if ts_match else None,
                            "raw_line": stripped[:80]
                        })
                    current_content = []
                elif current_content is not None:
                    current_content.append(line)

            # Add last entry if any
            if current_content and any(l.strip() for l in current_content):
                content_str = "\n".join(current_content).strip()
                entries.append({"content": content_str, "timestamp": None})

            return entries

        except Exception:
            return []

    def add_memory_entry(self, filename="USER.md", content=""):
        if not content.strip():
            return {"success": False, "message": "Content cannot be empty."}

        filepath = MEMORY_DIR / filename
        try:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")
            entry_content = f"\n§ [{timestamp}] {content.strip()}\n"

            with open(filepath, "a", encoding="utf-8") as f:
                f.write(entry_content)

            return {
                "success": True,
                "message": "Entry added successfully.",
                "file_path": str(filepath),
                "timestamp": timestamp
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def remove_memory_entry(self, filename="USER.md", entry_id=None):
        if not entry_id:
            return {"success": False, "message": "Entry ID required."}

        filepath = MEMORY_DIR / filename
        try:
            entries = self.read_memory(filename)
            if entry_id < 1 or entry_id > len(entries):
                return {"success": False, "message": f"Invalid entry ID. Range: 1-{len(entries)}"}

            content = filepath.read_text()
            lines = content.split("\n")

            new_lines = []
            skip_next = False
            count = 0
            for i, line in enumerate(lines):
                if skip_next:
                    skip_next = False
                    continue
                stripped = line.strip()
                if stripped.startswith("§") or stripped == "---":
                    count += 1
                    if count == entry_id:
                        j = i + 1
                        while j < len(lines) and not (lines[j].strip().startswith("§") or lines[j].strip() == "---"):
                            skip_next = True
                            j += 1
                        continue
                new_lines.append(line)

            with open(filepath, "w", encoding="utf-8") as f:
                f.write("\n".join(new_lines))

            return {
                "success": True,
                "message": f"Entry #{entry_id} removed.",
                "remaining_entries": len(entries) - 1
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    # ==================== Session info ====================

    def get_current_session_info(self):
        stdout, stderr, rc = run_cmd("hermes status")
        if rc == 0 and "error" not in stdout.lower():
            return {"success": True, "output": stdout[:3000]}
        return self.send_json({
            "config_exists": CONFIG_FILE.exists(),
            "python_version": sys.version.split()[0],
            "timestamp": datetime.now().isoformat()
        })

    # ==================== Static file serving ====================

    def serve_static(self, filepath):
        if not filepath.exists():
            return self.send_json({"error": "File not found"}, 404)

        content_type = "text/html"
        path_lower = str(filepath).lower()
        ext = Path(path_lower).suffix.lower()
        ct_map = {".css": "text/css", ".js": "application/javascript",
                   ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
                   ".gif": "image/gif", ".svg": "image/svg+xml"}
        content_type = ct_map.get(ext, "text/html")

        try:
                with open(filepath, "rb") as f:
                    self.send_response(200)
                    self.send_header("Content-Type", content_type)
                    # Add cache-busting headers for JS/CSS files
                    if ext in [".js", ".css"]:
                        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
                        self.send_header("Pragma", "no-cache")
                        self.send_header("Expires", "0")
                    self.end_headers()
                    self.wfile.write(f.read())
        except Exception as e:
            return self.send_json({"error": str(e)}, 500)


def main():
    print("=" * 60)
    print("Hermes Admin Dashboard Server")
    print("=" * 60)
    print(f"   URL: http://0.0.0.0:{PORT}")
    print(f"   Config: {CONFIG_FILE} (exists={CONFIG_FILE.exists()})")
    print(f"   Memory: {MEMORY_DIR} (exists={MEMORY_DIR.exists()})")
    print("   API endpoints:")
    print("     GET  /health - Health check")
    print("     GET  /config - Config overview")
    print("     GET  /config/inference - Provider + model")
    print("     GET  /memory/user - User memory entries")
    print("     GET  /memory/system - System memory entries")
    print("     GET  /memory/all - Both types")
    print("     GET  /cron/list - List cron jobs (parsed)")
    print("     GET  /cron/jobs/details - Full job details")
    print("     GET  /sessions/current - Current session info")
    print("     GET  /system/status - System status")
    print("     GET  /models/list - List available models + providers + cron jobs")
    print("     GET  /gateway/status - Gateway process health")
    print("     GET  /cron/job/<id>/model - Get model pinning for a job")
    print("     POST /config/inference - Update provider/model")
    print("     POST /model/test - Test model connectivity")
    print("     POST /cron/job/model - Update model pinning for a cron job")
    print("     POST /memory/add - Add memory entry")
    print("     POST /memory/remove - Remove memory entry")
    print("     POST /cron/create - Create cron job")
    print("     POST /cron/update - Pause/resume a job")
    print("     POST /cron/remove - Delete a job")
    print("     POST /terminal/run - Execute terminal command")
    print("     POST /news-site/rebuild - Rebuild news site")
    print("     POST /watchdog/trigger - Trigger watchdog run")
    print("=" * 60)

    server = http.server.HTTPServer(("0.0.0.0", PORT), AdminHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.shutdown()


if __name__ == "__main__":
    main()
