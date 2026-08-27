import base64, io, json, re, sys
import pandas as pd

def key(s): return s.fillna('').astype(str).str.replace(r'[^a-zA-Z0-9]', '', regex=True).str.lower().str.strip()
def preview(df): return {"columns":[str(c) for c in df.columns],"rows":[[None if pd.isna(v) else v for v in r] for r in df.head(50).itertuples(index=False,name=None)]} if not df.empty else {"columns":[],"rows":[]}
def process(p):
  original=pd.read_excel(io.BytesIO(base64.b64decode(p['original']['data'])),dtype=str); exit=pd.read_excel(io.BytesIO(base64.b64decode(p['exit']['data'])),dtype=str)
  for col in ['mobile_number','identity_number','hospital_registration_number','corporate_name','fullname','date_of_birth']:
    if col not in original: original[col]=''
  for col in ['Mobile No','NRC No']:
    if col not in exit: raise ValueError(f"Required exit-file column missing: {col}")
  original['_m']=key(original['mobile_number']); original['_n']=key(original['identity_number']); exit['_m']=key(exit['Mobile No']); exit['_n']=key(exit['NRC No'])
  mob=original[original._m!=''].drop_duplicates('_m').set_index('_m'); nrc=original[original._n!=''].drop_duplicates('_n').set_index('_n'); cols=['hospital_registration_number','corporate_name','fullname','date_of_birth']
  for c in cols: exit['Matched_'+c]=exit.apply(lambda r: (mob.loc[r._m][c] if r._m in mob.index else (nrc.loc[r._n][c] if r._n in nrc.index else '')),axis=1)
  both=exit._m.isin(set(mob.index))&exit._n.isin(set(nrc.index)); mo=exit._m.isin(set(mob.index))&~exit._n.isin(set(nrc.index)); no=~exit._m.isin(set(mob.index))&exit._n.isin(set(nrc.index)); nm=~exit._m.isin(set(mob.index))&~exit._n.isin(set(nrc.index))
  groups={'Both Mobile & NRC Matched':exit[both],'Only Mobile Matched':exit[mo],'Only NRC Matched':exit[no],'New Records (No Match)':exit[nm]}; groups={n:d.drop(columns=['_m','_n']) for n,d in groups.items()}
  summary=pd.DataFrame([{'Category':n,'Total Records':len(d)} for n,d in groups.items()]+[{'Category':'GRAND TOTAL (File 2 Size)','Total Records':len(exit)}]); out=io.BytesIO()
  with pd.ExcelWriter(out,engine='openpyxl') as w:
    summary.to_excel(w,sheet_name='Summary Report',index=False)
    for n,d in groups.items(): d.to_excel(w,sheet_name=n,index=False)
  out.seek(0); return {'outputFilename':'Data_Validation_Match_Report.xlsx','summary':preview(summary),'groups':{n:preview(d) for n,d in groups.items()},'workbookBase64':base64.b64encode(out.read()).decode('ascii')}
json.dump(process(json.load(sys.stdin)),sys.stdout,ensure_ascii=False,allow_nan=False)
