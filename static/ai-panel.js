/* Local-only event explanation and portable model deployment. */
(function () {
  'use strict';
  let voiceEnabled = true;
  let request;
  const api = async (url, options = {}) => {
    const response = await fetch(url, {...options, headers: {'Content-Type':'application/json'}});
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || '本地 AI 请求失败');
    return body;
  };
  const stop = () => window.speechSynthesis?.cancel();
  const speak = text => {
    stop();
    if (!voiceEnabled || !window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    window.speechSynthesis.speak(utterance);
  };
  const describe = s => s.reachable ? `已连接本地模型：${s.model}` : (s.deployment?.message || '尚未识别到本地模型');
  const panel = document.querySelector('#test-panel');
  const open = document.querySelector('#open-test-panel');
  let timer;
  if (panel && open) {
    const status = panel.querySelector('#test-status');
    const refresh = async () => {
      try {
        const result = await api('/api/ai/status');
        status.textContent = describe(result);
        const progress = panel.querySelector('#ai-progress');
        progress.value = result.reachable ? 100 : (result.deployment?.percent || 0);
        progress.hidden = !result.deployment || result.deployment.phase === 'idle';
        status.classList.toggle('is-error', result.deployment?.phase === 'error');
      } catch (e) { status.textContent = e.message; }
    };
    const close = () => {panel.classList.add('hidden'); panel.setAttribute('aria-hidden','true'); open.setAttribute('aria-expanded','false'); clearInterval(timer); open.focus();};
    open.addEventListener('click', () => {panel.classList.remove('hidden'); panel.setAttribute('aria-hidden','false'); open.setAttribute('aria-expanded','true'); refresh(); clearInterval(timer); timer = setInterval(refresh, 2500); panel.querySelector('#test-connection').focus();});
    panel.querySelector('#close-test-panel').addEventListener('click',close);
    panel.querySelector('#test-cancel').addEventListener('click',close);
    panel.querySelector('#test-connection').addEventListener('click', async e => {
      e.target.disabled = true;
      status.textContent = '正在识别并启动本地模型…';
      try { await api('/api/ai/local-start',{method:'POST'}); await refresh(); }
      catch (err) {status.textContent = err.message;}
      finally {e.target.disabled = false;}
    });
    document.addEventListener('keydown', e => {if(e.key === 'Escape' && !panel.classList.contains('hidden')) close();});
    panel.addEventListener('click',e => {if(e.target === panel) close();});
  }
  window.redMapAiMount = (event, container) => {
    if (!event || !container) return;
    request?.abort();
    let history = [];
    const speech = [event.title,event.summary,event.story].filter(Boolean).join('。');
    speak(speech);
    const root = document.createElement('section');
    root.className = 'event-ai';
    root.innerHTML = `<div class="section-label">事件 AI 讲解</div><div class="ai-speech-controls"><button class="ai-button" data-action="replay">▶ 重播</button><button class="ai-button secondary" data-action="stop">■ 停止</button><label class="ai-toggle"><input type="checkbox" data-action="voice">自动朗读</label><button class="ai-button" data-action="local">识别并启动本地模型</button></div><div class="ai-chat"><textarea rows="2" maxlength="1200" aria-label="围绕当前事件提问" placeholder="询问当前事件的背景、经过、人物或影响"></textarea><button class="ai-button primary" data-action="ask">发送提问</button></div><p class="ai-status" role="status"></p><div class="ai-answer" hidden></div>`;
    container.append(root);
    root.querySelector('input').checked = voiceEnabled;
    const status = root.querySelector('.ai-status');
    api('/api/ai/status').then(s => status.textContent = describe(s)).catch(e => status.textContent=e.message);
    root.addEventListener('click',async e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'stop') stop();
      if (action === 'replay') speak(speech);
      if (action === 'voice') {voiceEnabled=e.target.checked; voiceEnabled?speak(speech):stop();}
      if (action === 'local') {open.click(); panel.querySelector('#test-connection').click();}
      if (action !== 'ask') return;
      const question = root.querySelector('textarea').value.trim();
      if (!question) {status.textContent='请输入当前事件的问题'; return;}
      const button=e.target.closest('button');
      button.disabled=true;
      request?.abort(); request=new AbortController();
      status.textContent='正在询问本地模型…';
      try {
        const result=await api('/api/ai/event-chat',{method:'POST',signal:request.signal,body:JSON.stringify({event_id:event.id,question,history})});
        history.push({role:'user',content:question},{role:'assistant',content:result.answer});
        history=history.slice(-6);
        const answer=root.querySelector('.ai-answer'); answer.hidden=false; answer.textContent=result.answer;
        status.textContent=result.refused?'问题超出当前事件范围':`本地模型已回答 · ${(result.sources||[]).map(s=>s.id).join('、')}`;
      } catch(err) {if(err.name!=='AbortError')status.textContent=err.message;}
      finally {button.disabled=false;}
    });
  };
  window.redMapAiStopSpeech=stop;
})();
