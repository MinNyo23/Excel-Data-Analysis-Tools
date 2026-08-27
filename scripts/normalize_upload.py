import base64
import io
import json
import os
import sys

import pandas as pd


def read_csv_bytes(data: bytes):
    for encoding in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return pd.read_csv(io.BytesIO(data), encoding=encoding)
        except UnicodeDecodeError:
            continue
    return pd.read_csv(io.BytesIO(data))


def normalize_file(file):
    name = file["name"]
    if not name.lower().endswith(".csv"):
        return file
    source = base64.b64decode(file["data"])
    dataframe = read_csv_bytes(source)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        dataframe.to_excel(writer, sheet_name="Sheet1", index=False)
    base_name = os.path.splitext(name)[0]
    return {"name": f"{base_name}.xlsx", "data": base64.b64encode(output.getvalue()).decode("ascii")}


payload = json.load(sys.stdin)
json.dump({"files": [normalize_file(file) for file in payload["files"]]}, sys.stdout)
