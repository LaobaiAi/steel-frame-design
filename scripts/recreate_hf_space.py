"""Delete and recreate Hugging Face Space from scratch."""
import os
import sys
from huggingface_hub import HfApi, upload_folder

token = os.environ.get("HF_TOKEN", "")
if not token:
    sys.exit("HF_TOKEN not set")

api = HfApi(token=token)

# Step 1: Delete existing Space
try:
    api.delete_repo(repo_id="LaobaiAi/steel-frame-design", repo_type="space")
    print("Deleted existing Space")
except Exception as e:
    print(f"Delete skipped (might not exist): {e}")

# Step 2: Create new Space
api.create_repo(
    repo_id="LaobaiAi/steel-frame-design",
    repo_type="space",
    title="XuanwuAI Steel Frame Design",
    space_sdk="docker",
    license="mit",
)
print("Created new Space")

# Step 3: Upload project files
upload_folder(
    repo_id="LaobaiAi/steel-frame-design",
    repo_type="space",
    folder_path=".",
    ignore_patterns=[
        ".git*", "__pycache__", "*.pyc",
        "output", "projects", ".venv", "venv",
        "node_modules", "frontend/node_modules",
    ],
    commit_message="Initial deploy from GitHub",
)
print("Upload complete!")

# Step 4: Wait for build
print("\nWaiting for build...")
for i in range(60):
    try:
        info = api.space_info("LaobaiAi/steel-frame-design")
        stage = info.runtime.stage if info.runtime else "UNKNOWN"
        err = info.runtime.errorMessage if info.runtime and info.runtime.errorMessage else ""
        print(f"[{i+1}] stage={stage} error={err}")
        if stage == "RUNNING":
            print("Space is running!")
            break
        if stage in ("ERROR", "STOPPED"):
            print(f"Build failed: {err}")
            sys.exit(1)
    except Exception as e:
        print(f"[{i+1}] check failed: {e}")
    import time
    time.sleep(15)
else:
    print("Timeout waiting for build")
    sys.exit(1)
