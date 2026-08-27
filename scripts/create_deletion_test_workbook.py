import sys
from openpyxl import Workbook

workbook = Workbook()
sheet = workbook.active
sheet.title = "Del Aug"
sheet.append(["Entity Name", "Reason"])
sheet.append(["North", "Closed"])
sheet.append(["North", "Moved"])
sheet.append(["South", "Closed"])
sheet.append([None, "Ignored"])
workbook.save(sys.argv[1])
