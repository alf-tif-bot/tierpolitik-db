import re
from pypdf import PdfReader
p=r"C:\Users\yokim\.openclaw\workspace\tmp\tif-styleguide.pdf"
r=PdfReader(p)
text='\n'.join(page.extract_text() or '' for page in r.pages)
print('pages',len(r.pages),'chars',len(text))
for pat in [r'#[0-9A-Fa-f]{6}', r'\b(?:RGB|CMYK|Pantone)\b[^\n]{0,60}', r'rot[^\n]{0,80}', r'red[^\n]{0,80}']:
    m=re.findall(pat,text,flags=re.I)
    print('\nPAT',pat,'count',len(m))
    for x in m[:20]:
        print('-',x)
open(r"C:\Users\yokim\.openclaw\workspace\tmp\tif-styleguide.txt",'w',encoding='utf-8').write(text)
