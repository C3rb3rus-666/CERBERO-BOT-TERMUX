import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET_LOG = ROOT / "comandos_cerbero" / "sticker_dataset" / "sticker_records.json"
PENDING_DIR = ROOT / "comandos_cerbero" / "sticker_dataset" / "pending"

def load_records():
    if not DATASET_LOG.exists():
        return []
    with DATASET_LOG.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def save_records(records):
    with DATASET_LOG.open("w", encoding="utf-8") as fh:
        json.dump(records, fh, ensure_ascii=False, indent=2)


def main():
    records = load_records()
    if not records:
        print("No hay registros.")
        return

    for idx, record in enumerate(records):
        print("=" * 40)
        print(f"[{idx+1}/{len(records)}] {record['timestamp']} ({record['userId']} @ {record['groupId']})")
        print(f"Label: {record['label']} ({record['friendlyLabel']}) score={record['score']:.2f} NSFW={record['isNSFW']}")
        print(f"File: {record.get('savedFile', '---')} Hash:{record.get('stickerHash')}")
        preds = record.get('predictions', [])
        for sub in preds:
            print(f"  - {sub['label']}: {sub['score']:.3f}")
        print("")
        decision = input("Marca como NSFW? (y/n/skip)[y]: ").strip().lower() or "y"
        if decision == "skip":
            continue
        record['confirmed'] = decision == "y"

    save_records(records)
    print("Hecho. Puedes editar sticker_records.json manualmente.")


if __name__ == "__main__":
    main()
