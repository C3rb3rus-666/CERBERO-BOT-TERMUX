import argparse
import csv
import json
from collections import Counter
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATASET_LOG = ROOT / "comandos_cerbero" / "sticker_dataset" / "sticker_records.json"


def load_records():
    if not DATASET_LOG.exists():
        return []
    with DATASET_LOG.open("r", encoding="utf-8") as source:
        return json.load(source)


def to_short(record):
    timestamp = record.get("timestamp") or "n/a"
    try:
        timestamp = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        pass
    return {
        "timestamp": timestamp,
        "user": (record.get("userId") or "unknown").split("@")[0],
        "group": (record.get("groupId") or "unknown").split("@")[0],
        "label": record.get("friendlyLabel") or record.get("label") or "-",
        "score": record.get("score", 0),
        "nsfw": bool(record.get("isNSFW")),
        "file": record.get("savedFile", ""),
        "hash": record.get("stickerHash", ""),
    }


def print_summary(records):
    summary = Counter()
    by_user = Counter()
    for record in records:
        short = to_short(record)
        summary[(short["label"], short["nsfw"])] += 1
        by_user[short["user"]] += 1
    total = len(records)
    print(f"Total de stickers: {total}")
    print("Clasificación por etiqueta:")
    for (label, nsfw), count in sorted(summary.items(), key=lambda item: (-item[1], item[0][0])):
        flag = "NSFW" if nsfw else "SAFE"
        print(f"  · {label} [{flag}]: {count}")
    print("Usuarios con más registros:")
    for user, cnt in by_user.most_common(5):
        print(f"  · @{user}: {cnt}")


def export_csv(records, destination):
    fieldnames = ["timestamp", "user", "group", "label", "score", "nsfw", "file", "hash"]
    with destination.open("w", encoding="utf-8", newline="") as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        for record in records:
            writer.writerow(to_short(record))


def print_records(records, limit=10, label_filter=None, nsfw_only=None):
    shown = 0
    for record in records:
        short = to_short(record)
        if label_filter and label_filter.lower() not in short["label"].lower():
            continue
        if nsfw_only is True and not short["nsfw"]:
            continue
        if nsfw_only is False and short["nsfw"]:
            continue
        print("=" * 60)
        print(f"{short['timestamp']} | @{short['user']} en {short['group']}")
        print(f"Etiqueta: {short['label']} | Score: {short['score']:.3f} | NSFW: {short['nsfw']}")
        print(f"Archivo: {short['file']}")
        shown += 1
        if shown >= limit:
            break
    if shown == 0:
        print("No se encontraron stickers que cumplan los filtros.")


def main():
    parser = argparse.ArgumentParser(description="Resumen rápido del dataset de stickers para revisión manual.")
    parser.add_argument("--csv", type=Path, help="Exporta un CSV con todas las entradas para etiquetar a mano.")
    parser.add_argument("--limit", type=int, default=12, help="Cuántas entradas mostrar en pantalla (por defecto 12).")
    parser.add_argument("--label", type=str, help="Filtra solo etiquetas que contengan este texto.")
    parser.add_argument("--nsfw", choices=["only", "safe", "all"], default="all", help="Filtra según el marcador NSFW.")
    args = parser.parse_args()

    records = load_records()
    if not records:
        print("No hay registros de stickers aún.")
        return

    print_summary(records)
    if args.csv:
        export_csv(records, args.csv)
        print(f"CSV exportado a: {args.csv}")

    nsfw_filter = {
        "only": True,
        "safe": False,
        "all": None,
    }[args.nsfw]
    print_records(records, limit=args.limit, label_filter=args.label, nsfw_only=nsfw_filter)
    print("\nPara detener el entrenamiento automático, comenta la llamada a `analyzeStickerContent` en index.js y reinicia el bot.")


if __name__ == "__main__":
    main()
