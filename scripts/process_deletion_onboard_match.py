import base64, io, json, sys
import pandas as pd
def clean(series): return series.fillna('').astype(str).str.replace(r'[^a-zA-Z0-9]','',regex=True).str.lower().str.strip()
def preview(dataframe): return {'columns':[str(column) for column in dataframe.columns],'rows':[[None if pd.isna(value) else value for value in row] for row in dataframe.head(50).itertuples(index=False,name=None)]} if not dataframe.empty else {'columns':[],'rows':[]}
def selected_column(dataframe, requested, fallback, label, required=False):
 column = requested or fallback
 if column and column in dataframe.columns:return column
 if requested:raise ValueError(f"Selected {label} column was not found: {requested}")
 if required:raise ValueError(f"Required {label} column missing: {fallback}")
 return None
def go(payload):
 onboard=pd.read_excel(io.BytesIO(base64.b64decode(payload['onboard']['data'])),dtype=str); deletion=pd.read_excel(io.BytesIO(base64.b64decode(payload['deletion']['data'])),dtype=str); mapping=payload.get('mapping') or {}
 onboard_nrc=selected_column(onboard,mapping.get('originalNrc'),'identity_number','original NRC'); onboard_corporate=selected_column(onboard,mapping.get('originalCorporateName'),'corporate_name','original Corporate Name'); deletion_nrc=selected_column(deletion,mapping.get('secondNrc'),'NRC No','2nd File NRC',required=True)
 if 'hospital_registration_number' not in onboard:onboard['hospital_registration_number']=''
 onboard['_n']=clean(onboard[onboard_nrc]) if onboard_nrc else ''; deletion['_n']=clean(deletion[deletion_nrc]); matches=onboard[onboard._n!=''].drop_duplicates('_n').set_index('_n')
 deletion['Matched_hospital_registration_number']=deletion._n.map(matches.hospital_registration_number); deletion['Matched_corporate_name']=deletion._n.map(matches[onboard_corporate]) if onboard_corporate else ''
 is_match=deletion._n.isin(set(matches.index)); yes=deletion[is_match].drop(columns='_n'); no=deletion[~is_match].drop(columns='_n'); summary=pd.DataFrame([{'Category':'Matched List (NRC Found)','Total Records':len(yes)},{'Category':'No Match List (NRC Not Found)','Total Records':len(no)},{'Category':'GRAND TOTAL (File 2 Size)','Total Records':len(deletion)}]); output=io.BytesIO()
 with pd.ExcelWriter(output,engine='openpyxl') as writer:summary.to_excel(writer,sheet_name='Summary Report',index=False);yes.to_excel(writer,sheet_name='Matched List',index=False);no.to_excel(writer,sheet_name='No Match List',index=False)
 output.seek(0);return {'outputFilename':'NRC_Match_Report.xlsx','summary':preview(summary),'matched':preview(yes),'noMatch':preview(no),'workbookBase64':base64.b64encode(output.read()).decode()}
json.dump(go(json.load(sys.stdin)),sys.stdout,ensure_ascii=False,allow_nan=False)
