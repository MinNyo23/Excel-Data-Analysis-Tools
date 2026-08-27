import base64, io, json, re, sys
import pandas as pd
def safe(name,used):
 base=re.sub(r'[\[\]:*?/\\]','',str(name)).strip()[:31] or 'Unnamed Facility';candidate=base;i=2
 while candidate in used:candidate=(base[:28]+f' {i}')[:31];i+=1
 used.add(candidate);return candidate
def prev(d):return {'columns':[str(c) for c in d.columns],'rows':[[None if pd.isna(v) else v for v in r] for r in d.head(50).itertuples(index=False,name=None)]}
def go(p):
 d=pd.read_excel(io.BytesIO(base64.b64decode(p['file']['data'])));
 if 'Entity Name' not in d:raise ValueError('Required column missing: Entity Name')
 d['Entity Name']=d['Entity Name'].astype(str).str.strip();counts=d['Entity Name'].value_counts().reset_index();counts.columns=['Entity Name','Total Count'];total=int(counts['Total Count'].sum());summary=pd.concat([counts,pd.DataFrame([['GRAND TOTAL',total]],columns=counts.columns)],ignore_index=True);o=io.BytesIO();used={'Summary','All Data'};tabs=[]
 with pd.ExcelWriter(o,engine='openpyxl') as w:
  summary.to_excel(w,sheet_name='Summary',index=False);d.to_excel(w,sheet_name='All Data',index=False)
  for entity in d['Entity Name'].unique():
   tab=safe(entity,used);tabs.append(tab);d[d['Entity Name']==entity].to_excel(w,sheet_name=tab,index=False)
 return {'outputFilename':'Final_Entity_Report.xlsx','facilityCount':len(tabs),'recordCount':total,'summary':prev(summary),'facilitySheets':tabs,'workbookBase64':base64.b64encode(o.getvalue()).decode()}
json.dump(go(json.load(sys.stdin)),sys.stdout,ensure_ascii=False,allow_nan=False)
