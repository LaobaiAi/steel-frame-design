"""Upload project to Hugging Face Spaces via API."""
import os
import sys
from huggingface_hub import upload_folder

token = os.environ.get("HF_TOKEN", "")
print(f"Token exists: {bool(token)}")
if not token:
    sys.exit("HF_TOKEN not set")

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
