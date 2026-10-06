"""GitHub-only OpenAI worker. Facts/results travel directly to private VPS endpoint."""
import json, os, time, urllib.request, urllib.error, hmac, hashlib

BASE='https://dash.genglas.ru/_audit-bridge'
JOB=os.getenv('AUDIT_JOB_ID','')
KEY=os.getenv('OPENAI_API_KEY','').strip()
BRIDGE=os.getenv('GG_AUDIT_BRIDGE_TOKEN','').strip() or hmac.new(KEY.encode(),b'gg-private-audit-bridge-v1',hashlib.sha256).hexdigest()

def request(url, token, data=None, timeout=30):
    raw=None if data is None else json.dumps(data,ensure_ascii=False,allow_nan=False).encode()
    req=urllib.request.Request(url,data=raw,headers={'Authorization':'Bearer '+token,'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=timeout) as response:
            return response.status,json.load(response)
    except urllib.error.HTTPError as error:
        try: body=json.load(error)
        except Exception: body={}
        return error.code,body

def run():
    if not KEY or len(BRIDGE)<40: raise SystemExit('Required GitHub Actions secrets are missing')
    if JOB=='health-check':
        status,response=request(BASE+'/health',BRIDGE)
        print('Private VPS bridge HTTP:',status)
        if status!=200 or response.get('ok') is not True: raise SystemExit(1)
        return
    if not JOB or not all(c.isdigit() or c.islower() or c=='-' for c in JOB): raise SystemExit('Invalid job ID')
    status,job=request(BASE+'/jobs/'+JOB,BRIDGE)
    if status==409:
        print('Job already finished; no OpenAI request'); return
    if status!=200 or job.get('job_id')!=JOB: raise SystemExit('VPS job retrieval failed: HTTP '+str(status))
    status,claim=request(BASE+'/jobs/'+JOB+'/claim',BRIDGE,{'run_id':os.environ['GITHUB_RUN_ID']})
    if status==409:
        print('Job already claimed; no OpenAI request'); return
    if status!=200: raise SystemExit('VPS refused claim: HTTP '+str(status)+'; no OpenAI request')
    result={'job_id':JOB,'claim_id':claim['claim_id'],'status':'network_uncertain','usage':{},'model':job['model']}
    try:
        # Exactly one generation request per durable VPS claim. Never automatically retry.
        status,response=request('https://api.openai.com/v1/responses',KEY,job['request'],timeout=240)
        result.update(usage=response.get('usage') or {}, response_id=response.get('id'))
        if status!=200 or response.get('error'):
            error=response.get('error') or {}
            result.update(status='api_error',http_status=status,error_type=error.get('type'),error_code=error.get('code'),error_param=error.get('param'),error_message=str(error.get('message',''))[:1200])
        else:
            text='\n'.join(part.get('text','') for item in response.get('output',[]) if item.get('type')=='message' for part in item.get('content',[]) if part.get('type')=='output_text')
            try:
                analysis=json.loads(text)
                valid=(response.get('status')=='completed' and analysis.get('job_id')==JOB and analysis.get('period_start')==job['period_start'] and analysis.get('period_end_exclusive')==job['period_end_exclusive'] and isinstance(analysis.get('report'),str) and len(analysis['report'].strip())>300)
            except Exception:
                valid=False; analysis=None
            result.update(status='completed' if valid else 'invalid_output',analysis=analysis,provider_status=response.get('status'))
    except Exception:
        result.update(status='network_uncertain')
    # Retrying this callback cannot repeat an OpenAI call; the VPS accepts identical results once.
    for attempt in range(3):
        try:
            status,stored=request(BASE+'/jobs/'+JOB+'/result',BRIDGE,result)
            if status==200 and stored.get('stored'):
                print('VPS result stored; status:',result['status'])
                if result['status']!='completed':
                    print('API status:',result.get('http_status'),result.get('error_type'),result.get('error_code'))
                    raise SystemExit(1)
                return
        except SystemExit: raise
        except Exception: pass
        if attempt<2: time.sleep(3)
    raise SystemExit('VPS result delivery uncertain; no automatic generation retry')

if __name__=='__main__': run()

