import base64
import io
import json
import os
import re

import pandas as pd


def clean_value(value):
    if pd.isna(value):
        return None
    if hasattr(value, "item"):
        try:
            return value.item()
        except Exception:
            pass
    return value


def preview(frame, limit=50):
    if frame.empty:
        return {"columns": [], "rows": []}
    return {
        "columns": [str(column) for column in frame.columns],
        "rows": [[clean_value(value) for value in row] for row in frame.head(limit).itertuples(index=False, name=None)],
    }


def process(payload):
    item = payload["file"]
    file_name = str(item["name"])
    content = base64.b64decode(item["data"])
    excel_file = pd.ExcelFile(io.BytesIO(content))
    sheet_names = excel_file.sheet_names

    deletion_sheet = next(
        (sheet for sheet in sheet_names if "deletion" in sheet.strip().lower() or "del" in sheet.strip().lower()),
        sheet_names[0] if sheet_names else None,
    )
    if deletion_sheet is None:
        raise ValueError("The workbook does not contain any sheets.")

    deletion_data = pd.read_excel(excel_file, sheet_name=deletion_sheet)
    entity_col = next(
        (
            column
            for column in deletion_data.columns
            if re.sub(r"[^a-zA-Z0-9]", "", str(column)).lower() == "entityname"
            or "entity" in re.sub(r"[^a-zA-Z0-9]", "", str(column)).lower()
        ),
        None,
    )
    if entity_col is None:
        raise ValueError("'Entity Name' column not found in the selected sheet.")

    counts = deletion_data[entity_col].dropna().astype(str).str.strip().value_counts()
    summary_rows = [
        {"Sr No": index, "Entity Name": entity, "Total Deletion Count": int(count)}
        for index, (entity, count) in enumerate(counts.items(), start=1)
    ]
    summary = pd.DataFrame(summary_rows, columns=["Sr No", "Entity Name", "Total Deletion Count"])
    if not summary.empty:
        summary = pd.concat(
            [
                summary,
                pd.DataFrame([{"Sr No": "", "Entity Name": "TOTAL", "Total Deletion Count": int(summary["Total Deletion Count"].sum())}]),
            ],
            ignore_index=True,
        )

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        summary.to_excel(writer, sheet_name="Deletion Entity Summary", index=False)
        deletion_data.to_excel(writer, sheet_name="Deletion Data", index=False)
    output.seek(0)

    return {
        "outputFilename": "Deletion_Entity_Summary_Report.xlsx",
        "sheetNames": ["Deletion Entity Summary", "Deletion Data"],
        "sourceFilename": file_name,
        "sourceSheet": deletion_sheet,
        "entityColumn": str(entity_col),
        "uniqueEntityCount": len(counts),
        "deletionRowCount": len(deletion_data),
        "summary": preview(summary),
        "deletionData": preview(deletion_data),
        "workbookBase64": base64.b64encode(output.read()).decode("ascii"),
    }


def main():
    json.dump(process(json.load(__import__("sys").stdin)), __import__("sys").stdout, ensure_ascii=False, allow_nan=False)


if __name__ == "__main__":
    main()
