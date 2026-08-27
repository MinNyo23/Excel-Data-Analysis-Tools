import sys
from openpyxl import Workbook

workbook = Workbook()
sheet = workbook.active
sheet.title = "Deletion Data"
sheet.append(["Employee Full Name", "NRC No", "Status"])
sheet.append(["Aung Aung", "NRC-1", "First"])
sheet.append(["Aung Aung", "NRC-1", "Repeat"])
sheet.append(["Mya Mya", "NRC-2", "Unique"])
sheet.append(["Aung Aung", "NRC-1", "Third"])
workbook.save(sys.argv[1])
