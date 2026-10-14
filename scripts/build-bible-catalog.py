"""One-off extractor: user bible notes and data mini-cases -> JSON seeds."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
UTDRAG = ROOT / "stoff" / "intervju" / "utdrag" / "Intervjubibel"
OUT = ROOT / "backend" / "src" / "interview"

DOCS = [
    ("kjerne", "core", "Kjerne: spørsmål, historier og teknisk profil", "Intervjubibel-kjerne.txt", "Intervjubibel-kjerne.docx"),
    ("star", "star", "STAR: levering, historier og vurdering", "Intervjubibel-STAR-trening.txt", "Intervjubibel-STAR-trening.docx"),
    ("case-trening", "case", "Casetrening: repertoar og gjennomføring", "Intervjubibel-case-trening.txt", "Intervjubibel-case-trening.docx"),
    ("bedrift", "company", "Bedriftsspesifikk forberedelse", "Intervjubibel-bedriftsspesifikt.txt", "Intervjubibel-bedriftsspesifikt.docx"),
    ("finans", "finance", "Finans 101 for en teknolog", "Intervjubibel-finans-101.txt", "Intervjubibel-finans-101.docx"),
    ("ki", "ki", "KI-bruk i intervju og arbeid", "Intervjubibel-KI-bruk.txt", "Intervjubibel-KI-bruk.docx"),
    ("brainteasers", "brainteasers", "Brainteasers, estimering og hoderegning", "Intervjubibel-brainteasers-og-estimering.txt", "Intervjubibel-brainteasers-og-estimering.docx"),
    ("partner", "partner", "Partnerintervju", "Intervjubibel-partnerintervju.txt", "Intervjubibel-partnerintervju.docx"),
    ("oving", "practice", "Øving og rutine", "Intervjubibel-oving.txt", "Intervjubibel-oving.docx"),
    ("situasjon", "star", "Situasjonsspørsmål og profesjonsetikk", "Intervjubibel-situasjon-og-etikk.txt", "Intervjubibel-situasjon-og-etikk.docx"),
    ("svakheter", "strengths_weaknesses", "Svakheter og utviklingshistorier", "Intervjubibel-svakheter.txt", "Intervjubibel-svakheter.docx"),
    (
        "rest-api",
        "tech_topics",
        "Spørsmålsbank: REST API og programvareutvikling",
        "Spørsmålsbank - rest api og software development intervju spørsmål.txt",
        "Sporsmalsbank-rest-api.docx",
    ),
    ("ovingspartner", "practice", "Instruks til øvingspartner", "Intervju-ovingspartner-instruks.txt", "Intervju-ovingspartner-instruks.pdf"),
]


def grab(rest: str, label: str, following: list[str]) -> str:
    if following:
        tail = "|".join(re.escape(name) for name in following)
        end = rf"(?=\n(?:{tail}):|\Z)"
    else:
        end = r"\Z"
    match = re.search(rf"{re.escape(label)}:[ \t]*(.*?){end}", rest, re.S)
    return match.group(1).strip() if match else ""


def main() -> None:
    docs = []
    for slug, kind, title, fname, source in DOCS:
        text = (UTDRAG / fname).read_text(encoding="utf-8").strip()
        docs.append(
            {
                "slug": slug,
                "kind": kind,
                "title": title,
                "sourceFilename": source,
                "content": text,
            }
        )

    mini = (ROOT / "stoff" / "intervju" / "utdrag" / "Data-engineering-mini-cases.txt").read_text(encoding="utf-8")
    framework_end = mini.find("3. Mini-cases A: Når noe er feil\nCase 1:")
    rapid = mini.find("7. Raske situasjonsspørsmål (svar på 30 sekunder)")
    if framework_end < 0 or rapid < 0:
        raise SystemExit(f"markers missing {framework_end} {rapid}")
    framework = (mini[:framework_end] + "\n" + mini[rapid:]).strip()
    docs.append(
        {
            "slug": "data-rammeverk",
            "kind": "tech_topics",
            "title": "Data engineering: rammeverk og huskeliste",
            "sourceFilename": "Data-engineering-mini-cases.docx",
            "content": framework,
        }
    )

    body = mini[framework_end:rapid]
    chunks = re.split(r"\n(?=Case \d+:)", body)
    cases = []
    for chunk in chunks:
        chunk = chunk.strip()
        match = re.match(r"Case (\d+): (.+)", chunk)
        if not match:
            continue
        num, title = match.group(1), match.group(2).strip()
        rest = chunk[match.end() :].strip()
        tests = grab(
            rest,
            "Hva de tester",
            [
                "Avklaringsspørsmål du bør stille først",
                "Momenter i et godt svar",
                "Oppfølging intervjueren kan stille",
                "Fallgruve",
            ],
        )
        clarify = grab(
            rest,
            "Avklaringsspørsmål du bør stille først",
            ["Momenter i et godt svar", "Oppfølging intervjueren kan stille", "Fallgruve"],
        )
        good = grab(rest, "Momenter i et godt svar", ["Oppfølging intervjueren kan stille", "Fallgruve"])
        follow = grab(rest, "Oppfølging intervjueren kan stille", ["Fallgruve"])
        trap = grab(rest, "Fallgruve", [])
        prompt = (
            f"{title}\n\n"
            "Dette er en muntlig mini-case. Du får lite informasjon med vilje. "
            "Still spørsmål, si antakelsene høyt, og avslutt med hva du ville gjort og hvordan du forebygger neste gang."
        )
        interviewer_parts = []
        if tests:
            interviewer_parts.append(f"Hva de tester:\n{tests}")
        if clarify:
            interviewer_parts.append(f"Avklaringsspørsmål kandidaten bør stille:\n{clarify}")
        if follow:
            interviewer_parts.append(f"Oppfølging du kan stille:\n{follow}")
        if trap:
            interviewer_parts.append(f"Fallgruve:\n{trap}")
        cases.append(
            {
                "slug": f"data-{int(num):02d}",
                "title": title,
                "prompt": prompt,
                "interviewerInfo": "\n\n".join(interviewer_parts),
                "solution": good,
                "sourceKind": "mini_cases",
                "caseStyle": "interviewer_led",
                "companyTags": ["data", "bank"],
                "docSlug": "data-rammeverk",
            }
        )

    if len(cases) != 20:
        raise SystemExit(f"expected 20 data cases, got {len(cases)}")

    OUT.mkdir(parents=True, exist_ok=True)
    write_ts(OUT / "bibleUserDocs.ts", "bibleUserDocs", "BibleDocSeed", docs)
    write_ts(OUT / "dataEngineeringCases.ts", "dataEngineeringCases", "BibleCaseSeed", cases)
    for stale in ("bibleUserDocs.json", "dataEngineeringCases.json"):
        path = OUT / stale
        if path.exists():
            path.unlink()
    print(f"docs {len(docs)} cases {len(cases)}")


def write_ts(path: Path, export_name: str, type_name: str, data: list[dict]) -> None:
    body = json.dumps(data, ensure_ascii=False, indent=2)
    path.write_text(
        "\n".join(
            [
                f'import type {{ {type_name} }} from "./bibleTypes.js";',
                "",
                f"export const {export_name} = {body} as {type_name}[];",
                "",
            ]
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
