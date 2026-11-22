(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.ChineseApp ||= {}).dialoguePlayer = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  function create({ content, audio, getMaterialAudio, stopMaterialAudio, escapeHtml, renderSpeakerIcon }) {
  const dialogueQueues = new Map();
  const dialoguePlayback = { key: null, lines: [], index: 0, loadedIndex: -1, playing: false, token: 0, error: '' };
  const dialogueAudio = audio;

  function renderDialoguePlayer(lines, key) {
    dialogueQueues.set(key, lines);
    const complete = lines.every((line) => getMaterialAudio(line));
    return `<div class="dialogue-player" data-dialogue-player="${escapeHtml(key)}" role="group" aria-label="Full dialogue playback"><span class="dialogue-player-title">${renderSpeakerIcon()} Full dialogue · 1×</span><div class="dialogue-player-actions"><button type="button" class="toggle" data-dialogue-action="play" aria-pressed="false" ${complete ? '' : 'disabled'}>▶ Play</button><button type="button" class="toggle" data-dialogue-action="reset" aria-label="Reset dialogue to the beginning">↺ Reset</button></div><span class="dialogue-player-status" data-dialogue-status role="status">${complete ? `${lines.length} lines · Ready` : 'Some recordings are not available yet.'}</span></div>`;
  }

  function updateDialoguePlayer(scrollToLine = false) {
    const state = dialoguePlayback;
    const panel = content.querySelector('[data-dialogue-player]');
    if (state.playing && (!panel || panel.dataset.dialoguePlayer !== state.key)) {
      stopDialogueAudio();
      return;
    }
    content.querySelectorAll('[data-dialogue-line]').forEach((row) => {
      const active = state.playing && row.dataset.dialogueKey === state.key && Number(row.dataset.dialogueLine) === state.index;
      row.classList.toggle('dialogue-line-playing', active);
      if (active) {
        row.setAttribute('aria-current', 'true');
        if (scrollToLine) row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else row.removeAttribute('aria-current');
    });
    if (!panel || panel.dataset.dialoguePlayer !== state.key) return;
    const play = panel.querySelector('[data-dialogue-action="play"]');
    play.textContent = state.playing ? '■ Stop' : '▶ Play';
    play.setAttribute('aria-pressed', String(state.playing));
    const finished = state.index >= state.lines.length;
    panel.querySelector('[data-dialogue-status]').textContent = state.error || (finished
      ? `Finished · ${state.lines.length} / ${state.lines.length}`
      : `${state.playing ? 'Playing' : state.loadedIndex >= 0 ? 'Stopped' : 'Ready'} · ${state.index + 1} / ${state.lines.length}`);
  }

  function stopDialogueAudio(reset = false) {
    const state = dialoguePlayback;
    state.token++;
    state.playing = false;
    dialogueAudio.onended = null;
    dialogueAudio.onerror = null;
    dialogueAudio.pause();
    if (reset) {
      dialogueAudio.currentTime = 0;
      state.index = 0;
      state.loadedIndex = -1;
      state.error = '';
    }
    updateDialoguePlayer();
  }

  function playDialogueLine() {
    const state = dialoguePlayback;
    const token = ++state.token;
    state.playing = true;
    state.error = '';
    if (state.loadedIndex !== state.index) {
      dialogueAudio.src = getMaterialAudio(state.lines[state.index]);
      dialogueAudio.currentTime = 0;
      state.loadedIndex = state.index;
    }
    dialogueAudio.defaultPlaybackRate = 1;
    dialogueAudio.playbackRate = 1;
    const fail = () => {
      if (state.token !== token) return;
      stopDialogueAudio();
      state.loadedIndex = -1;
      state.error = 'Recording could not be played. Press Play to retry.';
      updateDialoguePlayer();
    };
    dialogueAudio.onerror = fail;
    dialogueAudio.onended = () => {
      if (state.token !== token || !state.playing) return;
      state.index++;
      if (state.index < state.lines.length) playDialogueLine();
      else stopDialogueAudio();
    };
    updateDialoguePlayer(true);
    dialogueAudio.play().catch(fail);
  }

  function handleDialogueAction(button) {
    const key = button.closest('[data-dialogue-player]')?.dataset.dialoguePlayer;
    const lines = dialogueQueues.get(key);
    if (!lines?.length) return;
    const state = dialoguePlayback;
    if (state.key !== key) {
      stopDialogueAudio(true);
      state.key = key;
      state.lines = lines;
    }
    if (button.dataset.dialogueAction === 'reset') {
      stopDialogueAudio(true);
      return;
    }
    if (state.playing) {
      stopDialogueAudio();
      return;
    }
    if (!lines.every((line) => getMaterialAudio(line))) return;
    stopMaterialAudio();
    content.querySelectorAll('[data-word-audio-player]').forEach((audio) => audio.pause());
    if (state.index >= lines.length) stopDialogueAudio(true);
    playDialogueLine();
  }

    return { dialoguePlayback, renderDialoguePlayer, updateDialoguePlayer, stopDialogueAudio, handleDialogueAction };
  }
  return { create };
});
