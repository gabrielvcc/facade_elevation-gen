(() => {
  const byId = (id) => document.getElementById(id);
  const editor = byId('editor-page');
  const page = byId('preview-page');
  const viewport = byId('preview-viewport');
  const stage = byId('preview-stage');
  const paper = byId('preview-paper');
  const canvas = byId('preview-canvas');
  const filename = byId('filename-input');
  const zoomInput = byId('preview-zoom');
  const download = byId('preview-download');
  const state = byId('preview-state');
  const fixedWidth = byId('export-width');
  const fixedHeight = byId('export-height');
  const modes = { none: 'Sem cotas', simple: 'Apresentação', detailed: 'Com medidas' };
  let isOpen = false;
  let baseCanvas = null;
  let pngBlob = null;
  let exportMode = 'simple';
  let sizingMode = 'auto';
  let zoom = 1;
  let fitActive = false;
  let customFilename = false;
  let generation = 0;
  let rendering = 0;
  let pan = null;

  function syncHeaderHeight() {
    // The editor stacks its controls on small screens; keep the preview navigation compact there.
    const height = window.innerWidth <= 900
      ? (window.innerWidth <= 640 ? 60 : 72)
      : byId('top-bar').getBoundingClientRect().height;
    page.style.setProperty('--preview-header-height', `${height}px`);
  }
  new ResizeObserver(syncHeaderHeight).observe(byId('top-bar'));
  syncHeaderHeight();

  function fixedImageSize() {
    const error = byId('export-size-error');
    const validWidth = fixedWidth.checkValidity();
    const validHeight = fixedHeight.checkValidity();
    const width = Number(fixedWidth.value);
    const height = Number(fixedHeight.value);
    const valid = validWidth && validHeight && width * height <= 32000000;
    error.hidden = valid;
    error.textContent = !validWidth || !validHeight
      ? 'Use medidas inteiras entre 1 e 8192px.'
      : 'A imagem deve ter no máximo 32 milhões de pixels.';
    fixedWidth.setAttribute('aria-invalid', String(!validWidth));
    fixedHeight.setAttribute('aria-invalid', String(!validHeight));
    return valid ? { width, height } : null;
  }

  function defaultFilename() {
    return `ELEVFAC-${numCols}X${numRows}`;
  }

  function outputFilename() {
    const stem = filename.value.trim().replace(/\.png$/i, '').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/, '');
    return `${stem || defaultFilename()}.png`;
  }

  function updateDocumentName() {
    byId('preview-document-name').textContent = outputFilename();
  }

  function updateComponentSummary() {
    const counts = new Map([['maxim-ar', 0], ['veneziana', 0], ['giro', 0], ['acm', 0]]);
    gridState.forEach((row) => row.forEach((cell) => {
      if (!cell?.master) return;
      const type = cell.type === 'giro-esquerda' || cell.type === 'giro-direita' ? 'giro' : cell.type;
      if (counts.has(type)) counts.set(type, counts.get(type) + 1);
    }));
    const labels = {
      'maxim-ar': ['Maxim-ar', 'Maxim-ar'],
      veneziana: ['Veneziana', 'Venezianas'],
      giro: ['Porta de giro', 'Portas de giro'],
      acm: ['ACM', 'ACM']
    };
    const list = byId('preview-component-counts');
    list.replaceChildren();
    counts.forEach((count, type) => {
      if (!count) return;
      const row = document.createElement('div');
      const label = document.createElement('dt');
      const value = document.createElement('dd');
      label.textContent = labels[type][count === 1 ? 0 : 1];
      value.textContent = count.toLocaleString('pt-BR');
      row.append(label, value);
      list.appendChild(row);
    });
    byId('preview-components').hidden = list.childElementCount === 0;
  }

  function setToolsEnabled(enabled) {
    page.querySelectorAll('[data-preview-tool]').forEach((button) => { button.disabled = !enabled; });
    zoomInput.disabled = !enabled;
  }

  function showState(kind, title, message = '') {
    page.dataset.state = kind;
    state.hidden = false;
    state.classList.toggle('is-loading', kind === 'loading');
    byId('preview-state-icon').src = `assets/icons/${kind === 'loading' ? 'loader-circle' : 'image'}.svg`;
    byId('preview-state-title').textContent = title;
    byId('preview-state-message').textContent = message;
    byId('preview-retry').hidden = kind !== 'error';
    byId('preview-render-status').textContent = kind === 'loading' ? 'Preparando imagem' : 'Não foi possível gerar';
    download.disabled = true;
    setToolsEnabled(false);
  }

  function showError(error) {
    console.error('Falha ao gerar o croqui:', error);
    pngBlob = null;
    byId('preview-image-size').textContent = 'Imagem indisponível';
    byId('preview-file-size').textContent = '—';
    showState('error', 'Não foi possível gerar o croqui', 'Tente novamente. Se o problema continuar, volte ao editor e confira a fachada.');
  }

  function layoutPaper() {
    const padding = viewport.clientWidth < 500 ? 20 : 44;
    paper.style.width = `${canvas.width * zoom}px`;
    paper.style.height = `${canvas.height * zoom}px`;
    stage.style.width = `${Math.max(viewport.clientWidth, Math.ceil(canvas.width * zoom) + padding * 2)}px`;
    stage.style.height = `${Math.max(viewport.clientHeight, Math.ceil(canvas.height * zoom) + padding * 2)}px`;
    zoomInput.value = Math.round(zoom * 100);
    byId('preview-zoom-out').disabled = zoom <= 0.01001;
    byId('preview-zoom-in').disabled = zoom >= 4;
    byId('preview-fit').classList.toggle('active', fitActive);
    byId('preview-fit').setAttribute('aria-pressed', String(fitActive));
    byId('preview-actual-size').classList.toggle('active', Math.abs(zoom - 1) < 0.001);
  }

  function setZoom(value, anchor = null) {
    if (!baseCanvas || paper.hidden) return;
    const next = Math.max(0.01, Math.min(4, value));
    if (!Number.isFinite(next)) return;
    const x = anchor?.x ?? viewport.clientWidth / 2;
    const y = anchor?.y ?? viewport.clientHeight / 2;
    const documentX = (viewport.scrollLeft + x - paper.offsetLeft) / zoom;
    const documentY = (viewport.scrollTop + y - paper.offsetTop) / zoom;
    fitActive = false;
    zoom = next;
    layoutPaper();
    viewport.scrollLeft = paper.offsetLeft + documentX * zoom - x;
    viewport.scrollTop = paper.offsetTop + documentY * zoom - y;
  }

  function fitToViewport() {
    if (!baseCanvas || paper.hidden) return;
    stage.style.width = '100%';
    stage.style.height = '100%';
    const padding = viewport.clientWidth < 500 ? 40 : 88;
    zoom = Math.max(0.01, Math.min(2, (viewport.clientWidth - padding) / canvas.width, (viewport.clientHeight - padding) / canvas.height));
    fitActive = true;
    layoutPaper();
    viewport.scrollLeft = (stage.offsetWidth - viewport.clientWidth) / 2;
    viewport.scrollTop = (stage.offsetHeight - viewport.clientHeight) / 2;
  }

  function renderPreview() {
    if (!baseCanvas || !isOpen) return;
    const request = ++rendering;
    pngBlob = null;
    download.disabled = true;
    const fixedSize = sizingMode === 'fixed' ? fixedImageSize() : null;
    if (sizingMode === 'fixed' && !fixedSize) {
      if (paper.hidden) {
        showState('error', 'Confira o tamanho da imagem', 'Informe uma largura e uma altura válidas no painel de exportação.');
        byId('preview-retry').hidden = true;
      }
      return;
    }
    byId('preview-file-size').textContent = 'Preparando PNG';
    try {
      const image = createExportCanvas(baseCanvas, exportMode);
      canvas.width = fixedSize ? fixedSize.width : image.width;
      canvas.height = fixedSize ? fixedSize.height : image.height;
      const context = canvas.getContext('2d');
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(1, canvas.width / image.width, canvas.height / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      const x = (canvas.width - width) / 2;
      const y = (canvas.height - height) / 2;
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(image, scale === 1 ? Math.floor(x) : x, scale === 1 ? Math.floor(y) : y, width, height);
      image.width = 0;
      canvas.setAttribute('aria-label', `Croqui da fachada: ${numCols} colunas e ${numRows} linhas. ${modes[exportMode]}.`);
      paper.hidden = false;
      state.hidden = true;
      page.dataset.state = 'encoding';
      setToolsEnabled(true);
      if (fitActive) fitToViewport();
      else {
        layoutPaper();
        viewport.scrollLeft = (stage.offsetWidth - viewport.clientWidth) / 2;
        viewport.scrollTop = (stage.offsetHeight - viewport.clientHeight) / 2;
      }
      byId('preview-image-size').textContent = `${canvas.width.toLocaleString('pt-BR')} × ${canvas.height.toLocaleString('pt-BR')}px`;
      byId('preview-mode-label').textContent = modes[exportMode];
      canvas.toBlob((blob) => {
        if (request !== rendering || !isOpen) return;
        if (!blob) {
          showError(new Error('A imagem PNG não pôde ser codificada.'));
          return;
        }
        pngBlob = blob;
        page.dataset.state = 'ready';
        download.disabled = false;
        byId('preview-file-size').textContent = blob.size < 1024 * 1024
          ? `${(blob.size / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
          : `${(blob.size / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`;
        byId('preview-render-status').textContent = 'Imagem pronta';
      }, 'image/png');
    } catch (error) {
      showError(error);
    }
  }

  async function generatePreview() {
    const request = ++generation;
    ++rendering;
    if (activeInsertMode || cornerModeActive || infinityModeActive || activeMeasureCancel) cancelEditingMode();
    menuPopup.style.display = 'none';
    isOpen = true;
    baseCanvas = null;
    pngBlob = null;
    fitActive = false;
    zoom = 1;
    paper.hidden = true;
    editor.inert = true;
    editor.setAttribute('aria-hidden', 'true');
    page.inert = false;
    page.setAttribute('aria-hidden', 'false');
    document.body.classList.add('preview-open');
    byId('preview-back').focus({ preventScroll: true });
    if (!customFilename) filename.value = defaultFilename();
    updateDocumentName();
    byId('preview-total-width').textContent = `${columnWidths.reduce((sum, value) => sum + gridSizeToCm(value), 0).toLocaleString('pt-BR')}cm`;
    byId('preview-total-height').textContent = `${rowHeights.reduce((sum, value) => sum + gridSizeToCm(value), 0).toLocaleString('pt-BR')}cm`;
    byId('preview-module-count').textContent = `${numCols} × ${numRows}`;
    updateComponentSummary();
    byId('preview-image-size').textContent = 'Preparando imagem';
    byId('preview-file-size').textContent = '—';
    showState('loading', 'Preparando seu croqui');
    try {
      if (typeof html2canvas !== 'function') throw new Error('O renderizador da imagem não está disponível.');
      const source = await html2canvas(gridContainer, {
        scale: 1,
        backgroundColor: '#ffffff',
        logging: false,
        onclone(clone) {
          // Capture the editor at rest, without the page transition or editing controls.
          clone.body.classList.remove('preview-open');
          const clonedEditor = clone.getElementById('editor-page');
          clonedEditor.style.transform = 'none';
          clonedEditor.style.transition = 'none';
          clone.querySelectorAll('.add-btn, .trash-btn, .infinity-selection-target').forEach((element) => element.remove());
          clone.querySelectorAll('.component-placed.hovering').forEach((element) => element.classList.remove('hovering'));
        }
      });
      if (request !== generation || !isOpen) return;
      if (!source.width || !source.height) throw new Error('A fachada não gerou uma imagem válida.');
      baseCanvas = source;
      renderPreview();
    } catch (error) {
      if (request === generation && isOpen) showError(error);
    }
  }

  function returnToEditor() {
    if (!isOpen) return;
    isOpen = false;
    baseCanvas = null;
    pngBlob = null;
    ++generation;
    ++rendering;
    pan = null;
    viewport.classList.remove('is-panning');
    editor.inert = false;
    editor.removeAttribute('aria-hidden');
    page.inert = true;
    page.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('preview-open');
    generateBtn.focus({ preventScroll: true });
  }

  generateBtn.addEventListener('click', generatePreview);
  byId('preview-back').addEventListener('click', returnToEditor);
  byId('preview-retry').addEventListener('click', generatePreview);
  filename.addEventListener('input', () => { customFilename = true; updateDocumentName(); });
  filename.addEventListener('blur', () => { filename.value = filename.value.replace(/\.png$/i, ''); updateDocumentName(); });

  page.querySelectorAll('[data-export-mode]').forEach((button) => {
    button.addEventListener('click', () => {
      exportMode = button.dataset.exportMode;
      page.querySelectorAll('[data-export-mode]').forEach((option) => {
        option.classList.toggle('selected', option === button);
        option.setAttribute('aria-pressed', String(option === button));
      });
      byId('preview-mode-label').textContent = modes[exportMode];
      renderPreview();
    });
  });

  page.querySelectorAll('[data-export-sizing]').forEach((button) => {
    button.addEventListener('click', () => {
      sizingMode = button.dataset.exportSizing;
      page.querySelectorAll('[data-export-sizing]').forEach((option) => {
        option.classList.toggle('selected', option === button);
        option.setAttribute('aria-pressed', String(option === button));
      });
      byId('export-fixed-size').hidden = sizingMode !== 'fixed';
      renderPreview();
    });
  });
  [fixedWidth, fixedHeight].forEach((input) => {
    input.addEventListener('change', () => { if (sizingMode === 'fixed') renderPreview(); });
  });

  byId('preview-zoom-in').addEventListener('click', () => setZoom(zoom * 1.25));
  byId('preview-zoom-out').addEventListener('click', () => setZoom(zoom / 1.25));
  byId('preview-fit').addEventListener('click', fitToViewport);
  byId('preview-actual-size').addEventListener('click', () => setZoom(1));
  zoomInput.addEventListener('change', () => {
    const value = Number(zoomInput.value);
    if (Number.isFinite(value) && value > 0) setZoom(value / 100);
    else zoomInput.value = Math.round(zoom * 100);
  });
  viewport.addEventListener('wheel', (event) => {
    if ((!event.ctrlKey && !event.metaKey) || !baseCanvas) return;
    event.preventDefault();
    const bounds = viewport.getBoundingClientRect();
    setZoom(zoom * Math.exp(-event.deltaY * 0.002), { x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }, { passive: false });
  viewport.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'mouse' || event.button !== 0 || !baseCanvas || paper.hidden) return;
    pan = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
    viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('is-panning');
    event.preventDefault();
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!pan) return;
    viewport.scrollLeft = pan.left - (event.clientX - pan.x);
    viewport.scrollTop = pan.top - (event.clientY - pan.y);
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => {
    viewport.addEventListener(name, () => { pan = null; viewport.classList.remove('is-panning'); });
  });
  viewport.addEventListener('dblclick', () => { if (fitActive) setZoom(1); else fitToViewport(); });

  new ResizeObserver(() => {
    if (!isOpen || !baseCanvas || paper.hidden) return;
    if (fitActive) fitToViewport();
    else layoutPaper();
  }).observe(viewport);

  document.addEventListener('keydown', (event) => {
    if (!isOpen) return;
    if (event.key === 'Escape') { returnToEditor(); return; }
    if (event.target.closest('input, textarea, select') || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); setZoom(zoom * 1.25); }
    if (event.key === '-') { event.preventDefault(); setZoom(zoom / 1.25); }
    if (event.key === '0') { event.preventDefault(); fitToViewport(); }
  });

  download.addEventListener('click', () => {
    if (!pngBlob) return;
    const url = URL.createObjectURL(pngBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = outputFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
