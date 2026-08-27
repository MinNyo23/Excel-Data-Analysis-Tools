import sys
import pandas as pd

pd.DataFrame([
    {'Entity Name':'Facility/One','Member':'A'},
    {'Entity Name':'Facility:One','Member':'B'},
    {'Entity Name':'Very Long Facility Name That Exceeds Thirty One Characters','Member':'C'},
    {'Entity Name':'Facility/One','Member':'D'},
]).to_excel(sys.argv[1],index=False)
