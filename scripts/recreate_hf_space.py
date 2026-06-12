"""Delete and recreate Hugging Face Space from scratch."""
import os
import sys
import time
from huggingface_hub import HfApi, upload_folder

token = os.environ.get("HF_TOKEN", "")
print(f"Token: {'set' if token else 'NOT SET'}")
if not token:
    sys.exit(1)

api = HfApi(token=token)

# Delete existing Space
try:
    info = api.space_info("LaobaiAi/steel-frame-design")
    print(f"Existing Space stage: {info.runtime.stage if info.runtime else '?'}")
    api.delete_repo(repo_id="LaobaiAi/steel-frame-design", repo_type="space")
    print("Deleted existing Space")
    time.sleep(10)
except Exception as e:
    print(f"Delete: {type(e).__name__}: {e}")

# Create new Space
print("Creating new Space...")
try:
    api.create_repo(
        repo_id="LaobaiAi/steel-frame-design",
        repo_type="space",
        space_sdk="docker",
        license="mit",
    )
    print("Created new Space")
    time.sleep(5)
except Exception as e:
    print(f"Create failed: {type(e).__name__}: {e}")
    sys.exit(1)

# Upload project files
print("Uploading files...")
try:
    upload_folder(
        repo_id="LaobaiAi/steel-frame-design",
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
except Exception as e:
    print(f"Upload failed: {type(e).__name__}: {e}")
    sys.exit(1)

# Wait for build
print("\nWaiting for build...")
for i in range(120):
    try:
        info = api.space_info("LaobaiAi/steel-frame-design")
        runtime = info.runtime
        stage = runtime.stage if runtime else "UNKNOWN"
        err = runtime.errorMessage if runtime and runtime.errorMessage else ""
        print(f"[{i+1}] stage={stage} error={err}")
        if stage == "RUNNING":
            print("Space is running!")
            print("URL: https://LaobaiAi-steel-frame-design.hf.space")
            break
        if stage in ("ERROR", "STOPPED"):
            print(f"Build failed: {err}")
            sys.exit(1)
    except Exception as e:
        print(f"[{i+1}] check error: {type(e).__name__}: {e}")
    time.sleep(15)
else:
    print("Timeout")
    sys.exit(1)
