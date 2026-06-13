"""Upload project to Hugging Face Spaces via API.
Creates the Space first if it does not already exist.
"""
import os
import sys
from huggingface_hub import HfApi, upload_folder

token = os.environ.get("HF_TOKEN", "")
print(f"Token exists: {bool(token)}")
if not token:
    sys.exit("HF_TOKEN not set")

api = HfApi(token=token)

# Ensure the Space exists before uploading
REPO_ID = "LaobaiAi/steel-frame-design"
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

# Debug: list key files being uploaded
for d in ['frontend/dist', 'frontend/dist/assets']:
    if os.path.isdir(d):
        files = os.listdir(d)
        print(f"  {d}: {len(files)} files")
        for f in files[:5]:
            print(f"    - {f}")
    else:
        print(f"  {d}: NOT FOUND")

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
