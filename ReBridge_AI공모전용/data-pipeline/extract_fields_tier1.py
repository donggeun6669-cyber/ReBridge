import json
from pathlib import Path


ROOT = Path(__file__).resolve().parent
PATCH_DIR = ROOT / "patches"


def main():
    PATCH_DIR.mkdir(parents=True, exist_ok=True)
    out_path = PATCH_DIR / "tier1_field_patches.json"
    if not out_path.exists():
        out_path.write_text("[]\n", encoding="utf-8")
    print("Tier 1 numeric extraction is intentionally left as a manual/LLM-assisted step.")
    print(f"Created placeholder: {out_path}")


if __name__ == "__main__":
    main()
