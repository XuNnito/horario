"""Generate the browser schedule catalog from the official aSc PDF export."""

import json
import re
import sys
import unicodedata
from collections import OrderedDict
from pathlib import Path

import pdfplumber


DAYS = ["lunes", "martes", "miercoles", "jueves", "viernes"]
STARTS = [f"{hour}:00" for hour in range(8, 16)]
AVAILABLE_GROUPS = [
    "1A", "1B", "1C", "1D", "3A", "3B", "4A", "4B", "4C", "4D",
    "6A", "6B", "7B", "7C", "7D", "9A", "10B", "10C", "10D",
]


def clean(value):
    return re.sub(r"\s+", " ", str(value or "").replace("�", "")).strip()


def title(value):
    value = clean(value)
    return value[:1].upper() + value[1:] if value else value


def parse_cell(cell):
    lines = [clean(line) for line in str(cell or "").splitlines() if clean(line)]
    aula = ""
    if lines and re.fullmatch(r"[A-Z]?\d{2,3}", lines[0]):
        aula = lines.pop(0)
    if not lines:
        return None
    lines[0] = re.sub(r"^\d{1,2}\s+", "", lines[0])
    if len(lines) == 1:
        return {"name": title(lines[0]), "professor": "", "aula": aula}
    return {
        "name": title(" ".join(lines[:-1])),
        "professor": title(lines[-1]),
        "aula": aula,
    }


def generate(pdf_path):
    subjects = []
    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != len(AVAILABLE_GROUPS):
            raise RuntimeError(f"Se esperaban {len(AVAILABLE_GROUPS)} páginas y se encontraron {len(pdf.pages)}")
        next_id = 260001
        for page, expected_group in zip(pdf.pages, AVAILABLE_GROUPS):
            words = page.extract_words()
            group = clean(words[0]["text"] if words else "")
            if group != expected_group:
                raise RuntimeError(f"Grupo inesperado: {group!r}; se esperaba {expected_group!r}")
            table = page.extract_tables()[0]
            by_key = OrderedDict()
            active = [None] * len(DAYS)
            for slot, row in enumerate(table[2:10]):
                for day_index, cell in enumerate(row[1:6]):
                    if cell is None:
                        previous = active[day_index]
                        if previous:
                            previous["endTime"] = f"{9 + slot}:00"
                        continue
                    active[day_index] = None
                    parsed = parse_cell(cell)
                    if not parsed:
                        continue
                    key = (parsed["name"], parsed["professor"], parsed["aula"])
                    subject = by_key.get(key)
                    if not subject:
                        quarter = int(re.match(r"\d+", group).group())
                        subject = {
                            "id": next_id,
                            **parsed,
                            "group": group,
                            "quarter": quarter,
                            "careerId": "biomedica",
                            "academicPlan": "003" if quarter >= 9 else "004",
                            "isCurriculumSubject": True,
                            "sessions": [],
                        }
                        next_id += 1
                        by_key[key] = subject
                    session = {
                        "day": DAYS[day_index],
                        "startTime": STARTS[slot],
                        "endTime": f"{9 + slot}:00",
                    }
                    subject["sessions"].append(session)
                    active[day_index] = session
            subjects.extend(by_key.values())
    return subjects


def main():
    if len(sys.argv) != 2:
        raise SystemExit("Uso: extract_biomedica_schedule.py <horario.pdf>")
    subjects = generate(Path(sys.argv[1]))
    payload = json.dumps(subjects, ensure_ascii=False, indent=2)
    print("// Generado desde HORARIO POR CLASE SEP DIC 2026.pdf. No editar a mano.")
    print("window.BIOMEDICA_AVAILABLE_GROUPS = " + json.dumps(AVAILABLE_GROUPS, ensure_ascii=False) + ";")
    print("window.BIOMEDICA_SCHEDULE_SUBJECTS = " + payload + ";")


if __name__ == "__main__":
    main()
