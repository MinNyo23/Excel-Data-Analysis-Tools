import sys
from pathlib import Path

from openpyxl import Workbook


output = Path(sys.argv[1])
workbook = Workbook()
addition = workbook.active
addition.title = "Addition 01 Aug to 10 Aug_26"
addition.append(["Employee", "Amount"])
addition.append(["A-100", 12])
addition.append(["A-200", 8])

deletions = workbook.create_sheet("Deletion 01 Aug to 10 Aug_26")
deletions.append(["Employee", "Reason"])
deletions.append(["D-300", "Leave"])

workbook.save(output)
