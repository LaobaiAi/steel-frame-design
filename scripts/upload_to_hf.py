"""Upload project to Hugging Face Spaces via API.
Creates the Space first if it does not already exist, then waits for the build.
"""
import os
import sys
import time
from huggingface_hub import HfApi, upload_folder

token = os.environ.get("HF_TOKEN", "")
print(f"Token exists: {bool(token)}")
if not token:
    sys.exit("HF_TOKEN not set")

api = HfApi(token=token)
REPO_ID = "LaobaiAi/steel-frame-design"

# ---- Step 1: Ensure the Space exists ----
try:
    info = api.space_info(REPO_ID)
    print(f"Space exists (stage: {info.runtime.stage if info.runtime else 'N/A'})")
except Exception:
    print("Space not found, creating...")
    try:
        api.create_repo(
            repo_id=REPO_ID,
            repo_type="space",
            space_sdk="docker",
        )
        print("Space created")
    except Exception as create_err:
        print(f"Failed to create Space: {create_err}")
        sys.exit(1)

# ---- Step 2: List files to upload ----
for d in ['frontend/dist', 'frontend/dist/assets']:
    if os.path.isdir(d):
        files = os.listdir(d)
        print(f"  {d}: {len(files)} files")
        for f in files[:5]:
            print(f"    - {f}")
    else:
        print(f"  {d}: NOT FOUND")

# ---- Step 3: Upload ----
upload_folder(
    repo_id=REPO_ID,
    repo_type="space",
    folder_path=".",
    ignore_patterns=[
        ".git*", "__pycache__", "*.pyc",
        "output", "projects", ".venv", "venv",
        "node_modules", "frontend/node_modules",
    ],
    commit_message="Auto-deploy from GitHub",
)
print("Upload complete!")

# ---- Step 4: Wait for build to finish ----
print("Waiting for HF Space build (polling up to 120 min)...")
MAX_ATTEMPTS = 360
for i in range(1, MAX_ATTEMPTS + 1):
    try:
        info = api.space_info(REPO_ID)
        if info.runtime:
            stage = info.runtime.stage
            err = info.runtime.errorMessage or ""
            print(f"  [{i}] stage={stage} error={err}")
            if stage == "RUNNING":
                print("Space is ready!")
                sys.exit(0)
            if stage == "ERROR":
                print(f"Build failed: {err}")
                # Try to restart the Space to trigger a fresh build
                print("Attempting to restart Space...")
                try:
                    api.restart_space(REPO_ID)
                    print("Restart triggered, will keep polling...")
                except Exception as restart_err:
                    print(f"Restart failed: {restart_err}")
                # Don't exit - keep polling after restart
        else:
            print(f"  [{i}] stage=N/A (no runtime yet)")
    except Exception as e:
        print(f"  [{i}] API error: {e}")
    # After many failures, try restarting to unstick the Space
    if i == 60 or i == 120 or i == 240:
        print(f"  Build taking long, attempting restart...")
        try:
            api.restart_space(REPO_ID)
            print("  Restart triggered")
        except Exception as restart_err:
            print(f"  Restart failed: {restart_err}")
    time.sleep(20)

print("Timeout waiting for build")
sys.exit(1)
