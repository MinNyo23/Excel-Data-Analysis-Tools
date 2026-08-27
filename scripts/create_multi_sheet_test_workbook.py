import sys
from openpyxl import Workbook

wb = Workbook()
first = wb.active
first.title = "Clean Data"
first.append(["Entity Name", "Value"])
first.append(["Alpha", 1])
first.append(["Beta", 2])
second = wb.create_sheet("Duplicates Moved")
second.append(["Entity Name", "Value"])
second.append(["Alpha", 3])
wb.save(sys.argv[1])
