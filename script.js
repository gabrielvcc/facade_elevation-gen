// --- ELEMENTOS DO DOM ---
const grid = document.getElementById("grid");
const overlay = document.getElementById("overlay");
const colsInput = document.getElementById("cols");
const rowsInput = document.getElementById("rows");
const clearGridBtn = document.getElementById("clear-grid-btn");
const menuPopup = document.getElementById("menu-popup");
const labelsTop = document.getElementById("labels-top");
const labelsLeft = document.getElementById("labels-left");
const canvasWrapper = document.getElementById("canvas-wrapper");
const gridContainer = document.getElementById("grid-container");
const canvasContainer = document.getElementById("canvas-container");
const croquiWrapper = document.getElementById("croqui-wrapper");
const generateBtn = document.getElementById("generate-btn");
const moduleSizePresetInput = document.getElementById("module-size-preset");
const insertModeStatus = document.getElementById("insert-mode-status");
const cornerModeBtn = document.getElementById("corner-mode-btn");
const infinityModeBtn = document.getElementById("infinity-mode-btn");

// --- ESTADO DA APLICAÇÃO ---
const borderWidth = 2;
const defaultModuleSizeCm = 100;
const minModuleSizeCm = 15;
const maxModuleSizeCm = 400;
let numRows = 3;
let numCols = 5;
let columnWidths = [];
let rowHeights = [];
let gridState = [];
let activeInsertMode = null;
let cornerBoundaries = new Set();
let cornerModeActive = false;
let infinityModeActive = false;
let infinityOrientation = 'vertical';
let infinityMarkers = { left: false, right: false, top: false, bottom: false };
let cornerEditSnapshot = null;
let infinityEditSnapshot = null;
let activeGiroCancel = null;
let activeMeasureCancel = null;

// --- FUNÇÕES DE LÓGICA DO GRID ---
function getX(col) { return columnWidths.slice(0, col).reduce((a, b) => a + b, 0); }
function getY(row) { return rowHeights.slice(0, row).reduce((a, b) => a + b, 0); }
function cmToGridSize(value) { return value + borderWidth; }
function gridSizeToCm(value) { return Math.max(0, value - borderWidth); }
function formatCm(value) { return `${gridSizeToCm(value)}cm`; }

function remapCornerBoundaries(newCols, mapInterior = (boundary) => boundary) {
  if (newCols === numCols) return;
  const remap = (boundaries) => new Set([...boundaries].map((boundary) => {
    if (boundary === 0) return 0;
    if (boundary === numCols) return newCols;
    const mapped = mapInterior(boundary);
    return mapped > 0 && mapped < newCols ? mapped : null;
  }).filter((boundary) => boundary !== null));
  cornerBoundaries = remap(cornerBoundaries);
  if (cornerEditSnapshot) cornerEditSnapshot = remap(cornerEditSnapshot);
}

function getComponentBounds(row, col, cell) {
  return { top: row - (cell.spanY || 1) + 1, bottom: row + 1, left: col, right: col + (cell.spanX || 1) };
}

function canPlaceRequadro(row, col, spanX, spanY) {
  if (![1, 2, 3, 4].includes(spanX) || ![1, 2].includes(spanY)) return false;
  const bounds = getComponentBounds(row, col, { spanX, spanY });
  if (bounds.top < 0 || bounds.bottom > numRows || bounds.left < 0 || bounds.right > numCols) return false;
  for (let r = bounds.top; r < bounds.bottom; r++) {
    for (let c = bounds.left; c < bounds.right; c++) {
      if (gridState[r][c]) return false;
    }
  }
  return true;
}

function selectRequadroSize(spanX, spanY) {
  const target = activeInsertMode?.type === 'requadro' && activeInsertMode.target;
  if (!target || !canPlaceRequadro(target.row, target.col, spanX, spanY)) return false;
  Object.assign(activeInsertMode, { spanX, spanY, error: null });
  updateInsertModeStatus();
  redrawAll();
  return true;
}

function resetGridState(newRows, newCols) {
  numRows = newRows;
  numCols = newCols;
  colsInput.value = newCols;
  rowsInput.value = newRows;
  gridState = Array(numRows).fill(null).map(() => Array(numCols).fill(null));
  cornerBoundaries.clear();
  infinityMarkers = { left: false, right: false, top: false, bottom: false };
  infinityOrientation = 'vertical';
  columnWidths = Array(numCols).fill(cmToGridSize(defaultModuleSizeCm));
  rowHeights = Array(numRows).fill(cmToGridSize(defaultModuleSizeCm));
  updateGrid();
}

function updateGrid() {
  const newRows = parseInt(rowsInput.value);
  const newCols = parseInt(colsInput.value);
  remapCornerBoundaries(newCols);
  while (gridState.length < newRows) {
    gridState.push(Array(numCols).fill(null));
    rowHeights.push(cmToGridSize(defaultModuleSizeCm));
  }
  gridState.length = newRows;
  gridState.forEach(row => {
    while (row.length < newCols) { row.push(null); }
    row.length = newCols;
  });
  while (columnWidths.length < newCols) { columnWidths.push(cmToGridSize(defaultModuleSizeCm)); }
  numRows = newRows;
  numCols = newCols;
  columnWidths.length = newCols;
  rowHeights.length = newRows;
  rebuildOccupiedCells();
  redrawAll();
}

function rebuildOccupiedCells() {
  gridState.forEach((row) => {
    row.forEach((cell, index) => {
      if (cell && !cell.master) {
        row[index] = null;
      }
    });
  });

  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const cell = gridState[r][c];
      if (!cell?.master) continue;
      const bounds = getComponentBounds(r, c, cell);
      if (bounds.top < 0 || bounds.right > numCols) {
        gridState[r][c] = null;
        continue;
      }
      for (let occupiedRow = bounds.top; occupiedRow < bounds.bottom; occupiedRow++) {
        for (let occupiedCol = bounds.left; occupiedCol < bounds.right; occupiedCol++) {
          if (occupiedRow !== r || occupiedCol !== c) {
            gridState[occupiedRow][occupiedCol] = { occupiedBy: [r, c] };
          }
        }
      }
    }
  }
}

function insertColumnAt(index) {
  const columnIndex = Math.max(0, Math.min(index, numCols));
  remapCornerBoundaries(numCols + 1, (boundary) => boundary >= columnIndex ? boundary + 1 : boundary);
  gridState.forEach((row) => row.splice(columnIndex, 0, null));
  columnWidths.splice(columnIndex, 0, cmToGridSize(defaultModuleSizeCm));
  numCols++;
  colsInput.value = numCols;
  rebuildOccupiedCells();
  redrawAll();
}

function insertRowAt(index) {
  const rowIndex = Math.max(0, Math.min(index, numRows));
  gridState.splice(rowIndex, 0, Array(numCols).fill(null));
  rowHeights.splice(rowIndex, 0, cmToGridSize(defaultModuleSizeCm));
  numRows++;
  rowsInput.value = numRows;
  rebuildOccupiedCells();
  redrawAll();
}

function clearCellComponentAt(row, col) {
  const cell = gridState[row]?.[col];
  if (!cell) return;
  const [masterRow, masterCol] = cell.master ? [row, col] : cell.occupiedBy || [row, col];
  gridState.forEach((cells, r) => cells.forEach((occupied, c) => {
    if ((r === masterRow && c === masterCol) ||
      (occupied?.occupiedBy?.[0] === masterRow && occupied.occupiedBy[1] === masterCol)) cells[c] = null;
  }));
}

async function deleteColumnAt(index) {
  if (numCols <= 1) {
    showCustomModal({ title: 'Aviso', text: 'O croqui precisa ter pelo menos uma coluna.', confirmText: 'OK' });
    return;
  }

  const labelText = String.fromCharCode(65 + index);
  const confirmed = await showCustomModal({
    title: `Excluir Coluna ${labelText}`,
    text: 'Componentes posicionados nessa coluna serão removidos. Deseja continuar?',
    confirmText: 'Excluir',
    cancelText: 'Cancelar'
  });

  if (!confirmed) return;

  remapCornerBoundaries(numCols - 1, (boundary) => {
    if (boundary === index || boundary === index + 1) return null;
    return boundary > index + 1 ? boundary - 1 : boundary;
  });

  for (let r = 0; r < numRows; r++) {
    clearCellComponentAt(r, index);
  }

  gridState.forEach((row) => row.splice(index, 1));
  columnWidths.splice(index, 1);
  numCols--;
  colsInput.value = numCols;
  clearInsertMode(false);
  rebuildOccupiedCells();
  redrawAll();
}

async function deleteRowAt(index) {
  if (numRows <= 1) {
    showCustomModal({ title: 'Aviso', text: 'O croqui precisa ter pelo menos uma linha.', confirmText: 'OK' });
    return;
  }

  const confirmed = await showCustomModal({
    title: `Excluir Linha ${index + 1}`,
    text: 'Componentes posicionados nessa linha serão removidos. Deseja continuar?',
    confirmText: 'Excluir',
    cancelText: 'Cancelar'
  });

  if (!confirmed) return;

  for (let c = 0; c < numCols; c++) {
    clearCellComponentAt(index, c);
  }

  gridState.splice(index, 1);
  rowHeights.splice(index, 1);
  numRows--;
  rowsInput.value = numRows;
  clearInsertMode(false);
  rebuildOccupiedCells();
  redrawAll();
}

function redrawAll() {
  grid.innerHTML = "";
  overlay.innerHTML = "";
  labelsTop.innerHTML = "";
  labelsLeft.innerHTML = "";
  const totalWidth = columnWidths.reduce((a, b) => a + b, 0);
  const totalHeight = rowHeights.reduce((a, b) => a + b, 0);
  const lineWidth = 2;
  const containerWidth = totalWidth + lineWidth;
  const containerHeight = totalHeight + lineWidth;

  grid.style.width = `${containerWidth}px`;
  grid.style.height = `${containerHeight}px`;
  overlay.style.width = `${containerWidth}px`;
  overlay.style.height = `${containerHeight}px`;
  canvasWrapper.style.width = `${containerWidth}px`;
  canvasWrapper.style.height = `${containerHeight}px`;
  gridContainer.style.width = `${containerWidth}px`;
  gridContainer.style.height = `${containerHeight}px`;

  generateLabels();
  generateLines(totalWidth, totalHeight);
  
  for (let r = 0; r < numRows; r++) {
    for (let c = 0; c < numCols; c++) {
      const cellState = gridState[r][c];
      if (cellState && cellState.master) {
        insertComponent(r, c, cellState, false);
      } else if (!cellState) {
        createAddButton(r, c);
      }
    }
  }
  renderInfinitySelectionTargets(containerWidth, containerHeight);
  renderInfinityMarkers(containerWidth, containerHeight);
  updateCroquiPosition();
}

function showCustomModal(options) {
  const modal = document.getElementById('custom-modal-overlay');
  const titleEl = document.getElementById('custom-modal-title');
  const textEl = document.getElementById('custom-modal-text');
  const inputWrapper = document.getElementById('custom-modal-input-wrapper');
  const inputEl = document.getElementById('custom-modal-input');
  const confirmBtn = document.getElementById('custom-modal-confirm-btn');
  const cancelBtn = document.getElementById('custom-modal-cancel-btn');

  titleEl.textContent = options.title || '';
  textEl.textContent = options.text || '';
  confirmBtn.textContent = options.confirmText || 'OK';
  cancelBtn.textContent = options.cancelText || 'Cancelar';

  if (options.inputType === 'number') {
    inputWrapper.style.display = 'block';
    inputEl.value = options.initialValue || '';
    setTimeout(() => inputEl.focus(), 50);
  } else {
    inputWrapper.style.display = 'none';
  }
  
  modal.style.display = 'flex';
  setTimeout(() => modal.classList.add('visible'), 10);

  return new Promise((resolve) => {
    const onConfirm = () => {
      closeModal();
      resolve(options.inputType ? inputEl.value : true);
    };

    const onCancel = () => {
      closeModal();
      resolve(false);
    };

    const onKeydown = (e) => {
      if (e.key === 'Enter') {
        onConfirm();
      } else if (e.key === 'Escape') {
        onCancel();
      }
    };
    
    function closeModal() {
      modal.classList.remove('visible');
      setTimeout(() => {
        modal.style.display = 'none';
        cleanup();
      }, 200);
    }
    
    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKeydown);

    function cleanup() {
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      document.removeEventListener('keydown', onKeydown);
    }
  });
}

function showGiroOptionsMenu(r, c) {
  const modal = document.getElementById('giro-options-modal-overlay');
  const size1Btn = document.querySelector('[data-size="1"]');
  const size2Btn = document.querySelector('[data-size="2"]');
  const dirLeftBtn = document.querySelector('[data-direction="esquerda"]');
  const dirRightBtn = document.querySelector('[data-direction="direita"]');
  const transomWithBtn = document.querySelector('[data-transom="true"]');
  const transomWithoutBtn = document.querySelector('[data-transom="false"]');
  const confirmBtn = document.getElementById('giro-options-confirm-btn');
  const cancelBtn = document.getElementById('giro-options-cancel-btn');

  // Estado local para as opções
  let selectedSize = 1;
  let selectedDirection = 'direita';
  let withTransom = false;

  return new Promise((resolve) => {
    function setup() {
      const hasSpaceAbove = r > 0 && gridState[r - 1][c] === null;
      size2Btn.classList.toggle('disabled', !hasSpaceAbove);
      size2Btn.disabled = !hasSpaceAbove;
      selectedSize = 1;
      selectedDirection = 'direita';
      withTransom = false;
      size1Btn.classList.add('selected');
      size2Btn.classList.remove('selected');
      dirLeftBtn.classList.remove('selected');
      dirRightBtn.classList.add('selected');
      transomWithBtn.classList.remove('selected');
      transomWithoutBtn.classList.add('selected');
    }

    // 2. Funções de clique
    const onSizeClick = (e) => {
      const btn = e.target;
      if (btn.disabled) return;
      selectedSize = parseInt(btn.dataset.size);
      size1Btn.classList.toggle('selected', selectedSize === 1);
      size2Btn.classList.toggle('selected', selectedSize === 2);
    };

    const onDirectionClick = (e) => {
      selectedDirection = e.target.dataset.direction;
      dirLeftBtn.classList.toggle('selected', selectedDirection === 'esquerda');
      dirRightBtn.classList.toggle('selected', selectedDirection === 'direita');
    };

    const onTransomClick = (e) => {
      withTransom = e.target.dataset.transom === 'true';
      transomWithBtn.classList.toggle('selected', withTransom);
      transomWithoutBtn.classList.toggle('selected', !withTransom);
    };

    // 3. Funções de fechar o modal
    const onConfirm = () => {
      closeModal();
      resolve({
        size: selectedSize,
        direction: selectedDirection,
        transom: withTransom,
      });
    };
    
    const onCancel = () => {
      closeModal();
      resolve(null); // Retorna nulo em caso de cancelamento
    };

    function closeModal() {
      modal.style.display = 'none';
      document.body.classList.remove('giro-options-open');
      activeGiroCancel = null;
      // Limpa os event listeners para evitar memory leaks
      size1Btn.removeEventListener('click', onSizeClick);
      size2Btn.removeEventListener('click', onSizeClick);
      dirLeftBtn.removeEventListener('click', onDirectionClick);
      dirRightBtn.removeEventListener('click', onDirectionClick);
      transomWithBtn.removeEventListener('click', onTransomClick);
      transomWithoutBtn.removeEventListener('click', onTransomClick);
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
    }
    
    // 4. Adiciona os event listeners
    size1Btn.addEventListener('click', onSizeClick);
    size2Btn.addEventListener('click', onSizeClick);
    dirLeftBtn.addEventListener('click', onDirectionClick);
    dirRightBtn.addEventListener('click', onDirectionClick);
    transomWithBtn.addEventListener('click', onTransomClick);
    transomWithoutBtn.addEventListener('click', onTransomClick);
    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    
    // 5. Roda o setup inicial e mostra o modal
    setup();
    activeGiroCancel = onCancel;
    document.body.classList.add('giro-options-open');
    modal.style.display = 'flex';
    size1Btn.focus();
  });
}

// --- LABELS / TAMANHOS ---
function createLabelInsertButton(className, title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `label-insert-btn ${className}`;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.textContent = "+";
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return button;
}

function createLabelDeleteButton(title, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "label-delete-btn";
  button.title = title;
  button.setAttribute('aria-label', title);
  button.textContent = "×";
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return button;
}

function createLabelEditButton(className, title, text, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `label-edit-btn ${className}`;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.textContent = text;
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    onClick();
  });
  return button;
}

function showMeasureOptions(title, label, initialValue) {
  if (activeMeasureCancel) return Promise.resolve(null);
  const form = document.getElementById('measure-options');
  const input = document.getElementById('measure-options-input');
  const error = document.getElementById('measure-options-error');
  const cancel = document.getElementById('measure-options-cancel-btn');
  const previousFocus = document.activeElement;
  document.getElementById('measure-options-title').textContent = title;
  document.getElementById('measure-options-label').textContent = label;
  input.min = minModuleSizeCm;
  input.max = maxModuleSizeCm;
  input.value = initialValue;
  error.textContent = `Informe uma medida inteira entre ${minModuleSizeCm} e ${maxModuleSizeCm}cm.`;
  error.hidden = true;
  input.removeAttribute('aria-invalid');
  menuPopup.style.display = 'none';

  return new Promise((resolve) => {
    const onSubmit = (event) => {
      event.preventDefault();
      if (!input.checkValidity()) {
        error.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      close(Number(input.value));
    };
    const onCancel = () => close(null);
    const onInput = () => {
      error.hidden = true;
      input.removeAttribute('aria-invalid');
    };
    function close(result) {
      form.style.display = 'none';
      form.removeEventListener('submit', onSubmit);
      cancel.removeEventListener('click', onCancel);
      input.removeEventListener('input', onInput);
      activeMeasureCancel = null;
      document.body.classList.remove('measure-options-open');
      updateInsertModeStatus();
      if (previousFocus?.isConnected) previousFocus.focus();
      resolve(result);
    }
    form.addEventListener('submit', onSubmit);
    cancel.addEventListener('click', onCancel);
    input.addEventListener('input', onInput);
    activeMeasureCancel = onCancel;
    document.body.classList.add('measure-options-open');
    updateInsertModeStatus();
    form.style.display = 'block';
    input.focus();
    input.select();
  });
}

async function editColumnWidth(index) {
  const label = String.fromCharCode(65 + index);
  const result = await showMeasureOptions(`Medida da Coluna ${label}`, 'Largura', gridSizeToCm(columnWidths[index]));
  if (result !== null) {
    columnWidths[index] = cmToGridSize(result);
    updateGrid();
  }
}

async function editRowHeight(index) {
  const result = await showMeasureOptions(`Medida da Linha ${index + 1}`, 'Altura', gridSizeToCm(rowHeights[index]));
  if (result !== null) {
    rowHeights[index] = cmToGridSize(result);
    updateGrid();
  }
}

function generateLabels() {
  labelsTop.innerHTML = '';
  labelsLeft.innerHTML = '';
  columnWidths.forEach((width, index) => {
    const label = document.createElement("div");
    const labelText = String.fromCharCode(65 + index);
    label.classList.toggle('narrow-column-label', gridSizeToCm(width) < 40);
    label.title = `Coluna ${labelText}: ${formatCm(width)}`;
    label.innerHTML = `<span class="label-code">${labelText}</span><span class="label-measure">${formatCm(width)}</span>`;
    label.style.width = `${width}px`;
    if (index === 0) {
      label.appendChild(createLabelInsertButton(
        'insert-col-before',
        `Inserir coluna antes de ${labelText}`,
        () => insertColumnAt(index)
      ));
    }
    label.appendChild(createLabelInsertButton(
      'insert-col-after',
      `Inserir coluna depois de ${labelText}`,
      () => insertColumnAt(index + 1)
    ));
    label.appendChild(createLabelDeleteButton(
      `Excluir coluna ${labelText}`,
      () => deleteColumnAt(index)
    ));
    label.appendChild(createLabelEditButton(
      'edit-col-size',
      `Alterar largura da coluna ${labelText}`,
      '↔',
      () => editColumnWidth(index)
    ));
    label.addEventListener("click", () => editColumnWidth(index));
    labelsTop.appendChild(label);
  });

  rowHeights.forEach((height, index) => {
    const label = document.createElement("div");
    const labelText = index + 1;
    label.title = `Linha ${labelText}: ${formatCm(height)}`;
    label.innerHTML = `<span class="label-code">${labelText}</span><span class="label-measure">${formatCm(height)}</span>`;
    label.style.height = `${height}px`;
    if (index === 0) {
      label.appendChild(createLabelInsertButton(
        'insert-row-before',
        `Inserir linha antes de ${labelText}`,
        () => insertRowAt(index)
      ));
    }
    label.appendChild(createLabelInsertButton(
      'insert-row-after',
      `Inserir linha depois de ${labelText}`,
      () => insertRowAt(index + 1)
    ));
    label.appendChild(createLabelDeleteButton(
      `Excluir linha ${labelText}`,
      () => deleteRowAt(index)
    ));
    label.appendChild(createLabelEditButton(
      'edit-row-size',
      `Alterar altura da linha ${labelText}`,
      '↕',
      () => editRowHeight(index)
    ));
    label.addEventListener("click", () => editRowHeight(index));
    labelsLeft.appendChild(label);
  });
}

function generateLines(totalWidth, totalHeight) {
  let y = 0;
  for (let r = 0; r <= numRows; r++) {
    const line = document.createElement("div");
    line.className = "line h-line";
    line.style.top = `${y}px`;
    grid.appendChild(line);
    y += rowHeights[r] || 0;
  }
  let x = 0;
  for (let c = 0; c <= numCols; c++) {
    const line = document.createElement(cornerModeActive ? 'button' : 'div');
    const side = c === 0 ? 'left' : c === numCols ? 'right' : null;
    const marked = cornerBoundaries.has(c);
    line.className = "line v-line";
    line.style.left = `${x}px`;
    if (side) line.classList.add(`corner-edge-${side}`);
    if (marked) line.classList.add("corner-boundary");
    if (cornerModeActive) {
      line.classList.add("corner-target");
      line.type = 'button';
      line.dataset.cornerBoundary = c;
      line.title = side === 'left' ? 'Canto na extremidade esquerda' : side === 'right'
        ? 'Canto na extremidade direita' : `Canto entre ${String.fromCharCode(64 + c)} e ${String.fromCharCode(65 + c)}`;
      line.setAttribute('aria-label', line.title);
      line.setAttribute('aria-pressed', String(marked));
      line.addEventListener("click", (event) => {
        event.stopPropagation();
        if (cornerBoundaries.has(c)) cornerBoundaries.delete(c);
        else cornerBoundaries.add(c);
        redrawAll();
        if (event.detail === 0) grid.querySelector(`[data-corner-boundary="${c}"]`).focus({ preventScroll: true });
      });
    }
    grid.appendChild(line);
    x += columnWidths[c] || 0;
  }
}

function getHorizontalInfinityY(side, x, width, height) {
  const distance = 8 + (64 * x / width);
  return side === 'top' ? distance : height - distance;
}

function renderInfinityMarkers(width, height) {
  const paths = [];
  const fillPaths = [];
  if (infinityMarkers.right) {
    const xBottom = width - 72;
    const xTop = width - 8;
    fillPaths.push(`M ${xTop} 0 L ${width} 0 L ${width} ${height} L ${xBottom} ${height} Z`);
    paths.push(`M ${xBottom} ${height + 28} L ${xTop} -16`);
  }
  if (infinityMarkers.left) {
    const xBottom = 72;
    const xTop = 8;
    fillPaths.push(`M ${xTop} 0 L 0 0 L 0 ${height} L ${xBottom} ${height} Z`);
    paths.push(`M ${xBottom} ${height + 28} L ${xTop} -16`);
  }
  ['top', 'bottom'].forEach((side) => {
    if (!infinityMarkers[side]) return;
    const yLeft = getHorizontalInfinityY(side, 0, width, height);
    const yRight = getHorizontalInfinityY(side, width, width, height);
    const edgeY = side === 'top' ? 0 : height;
    fillPaths.push(`M 0 ${yLeft} L ${width} ${yRight} L ${width} ${edgeY} L 0 ${edgeY} Z`);
    paths.push(`M -16 ${getHorizontalInfinityY(side, -16, width, height)} L ${width + 28} ${getHorizontalInfinityY(side, width + 28, width, height)}`);
  });

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("infinity-markers");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  fillPaths.forEach((path) => {
    const mask = document.createElementNS("http://www.w3.org/2000/svg", "path");
    mask.setAttribute("d", path);
    mask.classList.add("infinity-mask");
    svg.appendChild(mask);
  });
  if (paths.length) {
    const cut = document.createElementNS("http://www.w3.org/2000/svg", "path");
    cut.setAttribute("d", paths.join(" "));
    svg.appendChild(cut);
  }
  overlay.appendChild(svg);
}

function renderInfinitySelectionTargets(width, height) {
  if (!infinityModeActive) return;
  const isVertical = infinityOrientation === 'vertical';
  const sides = isVertical ? ['left', 'right'] : ['top', 'bottom'];
  sides.forEach((side, index) => {
    const target = document.createElement("button");
    target.type = "button";
    target.className = `infinity-selection-target infinity-${isVertical ? 'column' : 'row'}-target infinity-${side}`;
    target.title = isVertical
      ? `Inserir ou remover infinidade na coluna ${side === 'left' ? 'esquerda' : 'direita'}`
      : `Inserir ou remover infinidade na linha ${side === 'top' ? 'superior' : 'inferior'}`;
    target.setAttribute("aria-label", target.title);
    target.setAttribute('aria-pressed', String(infinityMarkers[side]));
    if (isVertical) {
      const column = index === 0 ? 0 : numCols - 1;
      const targetWidth = numCols === 1 ? width / 2 : columnWidths[column];
      target.style.left = `${numCols === 1 ? index * targetWidth : getX(column)}px`;
      target.style.top = '0px';
      target.style.width = `${targetWidth}px`;
      target.style.height = `${height}px`;
    } else {
      const row = index === 0 ? 0 : numRows - 1;
      const targetHeight = numRows === 1 ? height / 2 : rowHeights[row];
      target.style.left = '0px';
      target.style.top = `${numRows === 1 ? index * targetHeight : getY(row)}px`;
      target.style.width = `${width}px`;
      target.style.height = `${targetHeight}px`;
    }
    target.addEventListener("click", (event) => {
      event.stopPropagation();
      infinityMarkers[side] = !infinityMarkers[side];
      redrawAll();
    });
    overlay.appendChild(target);
  });
}

function updateCroquiPosition() {
  croquiWrapper.style.width = 'auto';
  croquiWrapper.style.height = 'auto';
  const croquiWidth = croquiWrapper.offsetWidth;
  const croquiHeight = croquiWrapper.offsetHeight;
  const containerWidth = canvasContainer.clientWidth - 40;
  const containerHeight = canvasContainer.clientHeight - 40;
  croquiWrapper.style.transform = 'none';
  if (croquiWidth > containerWidth) {
    croquiWrapper.style.left = '0px';
  } else {
    croquiWrapper.style.left = `calc(50% - ${croquiWidth / 2}px)`;
  }
  if (croquiHeight > containerHeight) {
    croquiWrapper.style.top = '0px';
  } else {
    croquiWrapper.style.top = `calc(50% - ${croquiHeight / 2}px)`;
  }
}

function drawCornersOnExport(ctx, layout) {
  if (!cornerBoundaries.size) return;
  ctx.save();
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#000";
  ctx.lineWidth = 2;
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  cornerBoundaries.forEach((boundary) => {
    const x = layout.paddingLeft + getX(boundary) + (boundary === 0 ? borderWidth : 0);
    const vTipY = layout.paddingTop - 5;
    ctx.fillText("CANTO", x, vTipY - 16);
    ctx.beginPath();
    ctx.moveTo(x - 9, vTipY - 9);
    ctx.lineTo(x, vTipY);
    ctx.lineTo(x + 9, vTipY - 9);
    ctx.stroke();
  });
  ctx.restore();
}

function drawInfinityOnExport(ctx, layout, baseCanvas, mode) {
  const width = baseCanvas.width;
  const height = baseCanvas.height;
  if (!Object.values(infinityMarkers).some(Boolean)) return;
  const totalDimensionOffset = mode === 'detailed' ? 86 : mode === 'none' ? 0 : 22;
  const cutBottomY = layout.paddingTop + height + totalDimensionOffset;
  const maskBottomY = cutBottomY + 12;
  ctx.save();
  ctx.fillStyle = "white";
  ctx.strokeStyle = "#f8991e";
  ctx.lineWidth = 5;
  ctx.lineCap = "square";

  if (infinityMarkers.right) {
    const xBottom = width - 72;
    const xTop = width - 8;
    const xAtMaskBottom = xBottom - ((xTop - xBottom) / height) * (totalDimensionOffset + 12);
    const outerRight = layout.paddingLeft + width + layout.cotaOffset - 12;
    const outerTop = layout.paddingTop - layout.espacoExtra;
    ctx.beginPath();
    ctx.moveTo(layout.paddingLeft + xTop, outerTop);
    ctx.lineTo(outerRight, outerTop);
    ctx.lineTo(outerRight, maskBottomY);
    ctx.lineTo(layout.paddingLeft + xAtMaskBottom, maskBottomY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(layout.paddingLeft + xAtMaskBottom, maskBottomY + 4);
    ctx.lineTo(layout.paddingLeft + xTop, outerTop - 8);
    ctx.stroke();
  }

  if (infinityMarkers.left) {
    const xBottom = 72;
    const xTop = 8;
    const xAtMaskBottom = xBottom + ((xBottom - xTop) / height) * (totalDimensionOffset + 12);
    const outerTop = layout.paddingTop - layout.espacoExtra;
    ctx.beginPath();
    ctx.moveTo(0, outerTop);
    ctx.lineTo(layout.paddingLeft + xTop, outerTop);
    ctx.lineTo(layout.paddingLeft + xAtMaskBottom, maskBottomY);
    ctx.lineTo(0, maskBottomY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(layout.paddingLeft + xAtMaskBottom, maskBottomY + 4);
    ctx.lineTo(layout.paddingLeft + xTop, outerTop - 8);
    ctx.stroke();
  }
  ['top', 'bottom'].forEach((side) => {
    if (!infinityMarkers[side]) return;
    const leftX = -layout.espacoExtra;
    const rightX = width + totalDimensionOffset + 12;
    const edgeY = side === 'top' ? 0 : layout.paddingTop + height + layout.cotaOffset - 12;
    const yAt = (x) => layout.paddingTop + getHorizontalInfinityY(side, x, width, height);
    ctx.beginPath();
    ctx.moveTo(layout.paddingLeft + leftX, yAt(leftX));
    ctx.lineTo(layout.paddingLeft + rightX, yAt(rightX));
    ctx.lineTo(layout.paddingLeft + rightX, edgeY);
    ctx.lineTo(layout.paddingLeft + leftX, edgeY);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(layout.paddingLeft + leftX - 8, yAt(leftX - 8));
    ctx.lineTo(layout.paddingLeft + rightX + 4, yAt(rightX + 4));
    ctx.stroke();
  });
  ctx.restore();
}

function getComponentName(type) {
  const names = {
    'maxim-ar': 'Maxim-ar',
    veneziana: 'Veneziana',
    giro: 'Porta de Giro',
    acm: 'ACM',
    requadro: 'Requadro'
  };
  return names[type] || type;
}

function updateInsertModeStatus() {
  document.querySelectorAll("#sidebar .component").forEach((component) => {
    component.classList.toggle('selected', Boolean(activeInsertMode && component.dataset.type === activeInsertMode.type));
  });
  cornerModeBtn.classList.toggle('active', cornerModeActive);
  infinityModeBtn.classList.toggle('active', infinityModeActive);
  cornerModeBtn.setAttribute('aria-pressed', String(cornerModeActive));
  infinityModeBtn.setAttribute('aria-pressed', String(infinityModeActive));

  const isEditing = Boolean(activeInsertMode || cornerModeActive || infinityModeActive);
  document.body.classList.toggle('editing-mode', Boolean(isEditing || activeMeasureCancel));
  if (!isEditing) {
    insertModeStatus.classList.remove('visible');
    insertModeStatus.innerHTML = '';
    return;
  }

  const title = cornerModeActive ? 'Canto' : infinityModeActive ? 'Infinidade' : getComponentName(activeInsertMode.type);
  const canSelectScope = activeInsertMode && ['maxim-ar', 'veneziana', 'acm'].includes(activeInsertMode.type);
  const placementTarget = activeInsertMode?.target;
  const requadroTarget = activeInsertMode?.type === 'requadro' && placementTarget;
  const scopeText = cornerModeActive
    ? 'Clique em um montante interno ou em uma extremidade para marcar ou remover um canto.'
    : infinityModeActive
      ? (infinityOrientation === 'vertical'
        ? 'Clique em um quadro da coluna esquerda ou direita para adicionar ou remover o corte.'
        : 'Clique em um quadro da primeira ou da última linha para adicionar ou remover o corte.')
      : placementTarget
        ? (activeInsertMode.scope === 'row' ? `Linha ${placementTarget.row + 1} selecionada.` : `Quadro ${String.fromCharCode(65 + placementTarget.col)}${placementTarget.row + 1} selecionado.`)
        : activeInsertMode.scope === 'row' ? 'Clique em um quadro vazio da coluna A para preencher a linha.' : 'Clique em um quadro vazio.';
  insertModeStatus.innerHTML = `
    <strong>${title}</strong>
    ${infinityModeActive ? `
      <div class="infinity-orientation" role="group" aria-label="Orientação do corte">
        <button type="button" class="infinity-orientation-option ${infinityOrientation === 'vertical' ? 'selected' : ''}" data-infinity-orientation="vertical" aria-pressed="${infinityOrientation === 'vertical'}">Vertical</button>
        <button type="button" class="infinity-orientation-option ${infinityOrientation === 'horizontal' ? 'selected' : ''}" data-infinity-orientation="horizontal" aria-pressed="${infinityOrientation === 'horizontal'}">Horizontal</button>
      </div>` : requadroTarget ? `
      <div class="requadro-size-picker" role="group" aria-label="Tamanho do requadro">
        ${[[1, 2], [2, 2], [3, 2], [4, 2], [1, 1], [2, 1], [3, 1], [4, 1]].map(([spanX, spanY]) => {
          const available = canPlaceRequadro(placementTarget.row, placementTarget.col, spanX, spanY);
          const selected = spanX <= activeInsertMode.spanX && spanY <= activeInsertMode.spanY;
          const label = `${spanX} coluna${spanX > 1 ? 's' : ''} e ${spanY} linha${spanY > 1 ? 's' : ''}`;
          return `<button type="button" class="requadro-size-cell ${selected ? 'selected' : ''}" data-requadro-x="${spanX}" data-requadro-y="${spanY}" aria-label="${label}" aria-pressed="${selected}" title="${available ? label : `${label}: sem espaço livre`}" ${available ? '' : 'disabled'}></button>`;
        }).join('')}
      </div>
      <span class="requadro-size-value">${activeInsertMode.spanX} × ${activeInsertMode.spanY} módulo${activeInsertMode.spanX * activeInsertMode.spanY > 1 ? 's' : ''}</span><br>` : canSelectScope ? `
      <div class="placement-scope" role="group" aria-label="Inserir em">
        <button type="button" class="placement-scope-option ${activeInsertMode.scope === 'cell' ? 'selected' : ''}" data-placement-scope="cell" aria-pressed="${activeInsertMode.scope === 'cell'}">Quadro único</button>
        <button type="button" class="placement-scope-option ${activeInsertMode.scope === 'row' ? 'selected' : ''}" data-placement-scope="row" aria-pressed="${activeInsertMode.scope === 'row'}">Linha inteira</button>
      </div>` : '<br>'}
    ${scopeText}
    ${activeInsertMode?.error ? `<p class="insert-mode-error" role="alert">${activeInsertMode.error}</p>` : ''}
    <div class="edit-mode-actions">
      ${cornerModeActive || infinityModeActive || placementTarget ? `<button type="button" class="edit-mode-confirm" aria-label="${placementTarget ? 'Inserir componente' : 'Finalizar'}" title="${placementTarget ? 'Inserir componente' : 'Finalizar'}">&#10003;</button>` : ''}
      <button type="button" class="edit-mode-cancel" aria-label="Cancelar" title="Cancelar">&times;</button>
    </div>
  `;
  insertModeStatus.classList.add('visible');
  insertModeStatus.querySelectorAll('[data-requadro-x]').forEach((button) => {
    button.addEventListener('click', () => {
      const spanX = Number(button.dataset.requadroX);
      const spanY = Number(button.dataset.requadroY);
      if (selectRequadroSize(spanX, spanY)) {
        insertModeStatus.querySelector(`[data-requadro-x="${spanX}"][data-requadro-y="${spanY}"]`).focus({ preventScroll: true });
      }
    });
  });
  insertModeStatus.querySelectorAll('[data-placement-scope]').forEach((button) => {
    button.addEventListener('click', () => {
      activeInsertMode.scope = button.dataset.placementScope;
      updateInsertModeStatus();
      redrawAll();
      insertModeStatus.querySelector(`[data-placement-scope="${activeInsertMode.scope}"]`).focus({ preventScroll: true });
    });
  });
  insertModeStatus.querySelectorAll('[data-infinity-orientation]').forEach((button) => {
    button.addEventListener('click', () => {
      infinityOrientation = button.dataset.infinityOrientation;
      updateInsertModeStatus();
      redrawAll();
      insertModeStatus.querySelector(`[data-infinity-orientation="${infinityOrientation}"]`).focus({ preventScroll: true });
    });
  });
  insertModeStatus.querySelector('.edit-mode-cancel').addEventListener('click', cancelEditingMode);
  insertModeStatus.querySelector('.edit-mode-confirm')?.addEventListener('click', () => {
    if (activeInsertMode?.target) insertFromActiveMode(activeInsertMode.target.row, activeInsertMode.target.col);
    else if (cornerModeActive) finishCornerEditing();
    else finishInfinityEditing();
  });
}

function cancelEditingMode() {
  if (activeMeasureCancel) {
    activeMeasureCancel();
    return;
  }
  if (activeGiroCancel) {
    activeGiroCancel();
    clearInsertMode();
    return;
  }
  if (cornerModeActive) {
    if (cornerEditSnapshot) cornerBoundaries = new Set(cornerEditSnapshot);
    finishCornerEditing();
  } else if (infinityModeActive) {
    if (infinityEditSnapshot) infinityMarkers = { ...infinityEditSnapshot };
    finishInfinityEditing();
  } else {
    clearInsertMode();
  }
}

function finishCornerEditing() {
  cornerModeActive = false;
  cornerEditSnapshot = null;
  updateInsertModeStatus();
  cornerModeBtn.blur();
  redrawAll();
}

function finishInfinityEditing() {
  infinityModeActive = false;
  infinityEditSnapshot = null;
  updateInsertModeStatus();
  infinityModeBtn.blur();
  redrawAll();
}

function setInsertMode(type, scope, target = null) {
  if (cornerModeActive) finishCornerEditing();
  if (infinityModeActive) finishInfinityEditing();
  activeInsertMode = { type, scope, target };
  if (type === 'requadro') Object.assign(activeInsertMode, { spanX: 1, spanY: 1 });
  menuPopup.style.display = "none";
  menuPopup.classList.remove('insert-mode-menu');
  updateInsertModeStatus();
  redrawAll();
}

function clearInsertMode(shouldRedraw = true) {
  activeInsertMode = null;
  updateInsertModeStatus();
  if (shouldRedraw) {
    redrawAll();
  }
}

function fillRowWithComponent(row, type) {
  let insertedCount = 0;
  for (let c = 0; c < numCols; c++) {
    if (!gridState[row][c]) {
      gridState[row][c] = { type, master: true };
      insertedCount++;
    }
  }
  return insertedCount;
}

async function insertFromActiveMode(r, c) {
  if (activeGiroCancel) return true;
  if (!activeInsertMode) return false;

  const insertionMode = activeInsertMode;
  const { type, scope } = activeInsertMode;
  if (type === 'requadro') {
    if (!activeInsertMode.target) {
      activeInsertMode.target = { row: r, col: c };
      updateInsertModeStatus();
      redrawAll();
      return true;
    }
    const { spanX, spanY } = activeInsertMode;
    if (!canPlaceRequadro(r, c, spanX, spanY)) {
      activeInsertMode.error = 'O requadro precisa de quadros livres dentro da fachada.';
      updateInsertModeStatus();
      return true;
    }
    gridState[r][c] = { type: 'requadro', master: true, spanX, spanY };
    clearInsertMode(false);
    rebuildOccupiedCells();
    redrawAll();
    return true;
  }
  if (scope === 'row') {
    if (c !== 0) {
      showCustomModal({ title: 'Selecione a coluna A', text: 'Para inserir uma linha inteira, clique em um quadro vazio da coluna A.', confirmText: 'OK' });
      return true;
    }

    const insertedCount = fillRowWithComponent(r, type);
    clearInsertMode(false);
    redrawAll();
    if (insertedCount === 0) {
      showCustomModal({ title: 'Linha ocupada', text: 'Essa linha não possui quadros vazios para inserir o componente.', confirmText: 'OK' });
    }
    return true;
  }

  if (type === 'giro') {
    const giroOptions = await showGiroOptionsMenu(r, c);
    if (activeInsertMode !== insertionMode) return true;
    clearInsertMode(false);
    if (giroOptions) {
      const newState = {
        type: `giro-${giroOptions.direction}`,
        master: true,
        spanY: giroOptions.size,
        transom: giroOptions.transom,
      };
      gridState[r][c] = newState;
      if (newState.spanY === 2) {
        gridState[r - 1][c] = { occupiedBy: [r, c] };
      }
    }
    redrawAll();
    return true;
  }

  gridState[r][c] = { type, master: true };
  clearInsertMode(false);
  redrawAll();
  return true;
}

function highlightRowTargets(row, shouldHighlight) {
  document.querySelectorAll(`.add-btn[data-row="${row}"][data-col="0"]`).forEach((button) => {
    button.classList.toggle('insert-row-target', shouldHighlight);
  });
}

function createAddButton(r, c) {
  const borderWidth = 2;
  const addBtn = document.createElement("div");
  addBtn.className = "add-btn";
  addBtn.dataset.row = r;
  addBtn.dataset.col = c;
  addBtn.style.left = `${getX(c) + borderWidth}px`;
  addBtn.style.top = `${getY(r) + borderWidth}px`;
  addBtn.style.width = `${columnWidths[c] - borderWidth}px`;
  addBtn.style.height = `${rowHeights[r] - borderWidth}px`;
  addBtn.innerText = "+";
  
  const target = activeInsertMode?.target;
  const requadroTarget = activeInsertMode?.type === 'requadro' && target;
  const requadroCandidate = requadroTarget && canPlaceRequadro(target.row, target.col, c - target.col + 1, target.row - r + 1);
  if (requadroCandidate) {
    addBtn.classList.add('requadro-candidate');
    addBtn.setAttribute('role', 'button');
    addBtn.tabIndex = 0;
    addBtn.setAttribute('aria-label', `Requadro: ${c - target.col + 1} coluna(s) e ${target.row - r + 1} linha(s)`);
    addBtn.setAttribute('aria-pressed', String(c < target.col + activeInsertMode.spanX && r >= target.row - activeInsertMode.spanY + 1));
    addBtn.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (selectRequadroSize(c - target.col + 1, target.row - r + 1)) {
        overlay.querySelector(`.add-btn[data-row="${r}"][data-col="${c}"]`).focus({ preventScroll: true });
      }
    });
  } else if (requadroTarget) {
    addBtn.classList.add('requadro-unavailable');
  }
  if (activeInsertMode && (requadroTarget
    ? r >= target.row - activeInsertMode.spanY + 1 && r <= target.row && c >= target.col && c < target.col + activeInsertMode.spanX
    : target
    ? r === target.row && (activeInsertMode.scope === 'row' || c === target.col)
    : activeInsertMode.scope !== 'row' || c === 0)) {
    addBtn.classList.add('insert-target');
  }

  addBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (activeInsertMode?.target) {
      if (requadroCandidate) selectRequadroSize(c - target.col + 1, target.row - r + 1);
      return;
    }
    if (await insertFromActiveMode(r, c)) return;
    showComponentMenu(e, r, c);
  });
  addBtn.addEventListener("mouseenter", () => {
    if (activeInsertMode?.scope === 'row') {
      highlightRowTargets(r, true);
    }
  });
  addBtn.addEventListener("mouseleave", () => {
    if (activeInsertMode?.scope === 'row') {
      highlightRowTargets(r, false);
    }
  });
  overlay.appendChild(addBtn);
}

function insertComponent(r, c, state, shouldUpdateState = true) {
  if (shouldUpdateState) {
    gridState[r][c] = { ...state, master: true };
    redrawAll();
    return;
  }
  
  const type = state.type;
  let left = getX(c);
  let top = getY(r);
  let width = columnWidths[c];
  let height = rowHeights[r];
  let totalHeight = height;
  const borderWidth = 2;

  const bounds = getComponentBounds(r, c, state);
  top = getY(bounds.top);
  width = columnWidths.slice(bounds.left, bounds.right).reduce((sum, size) => sum + size, 0);
  totalHeight = rowHeights.slice(bounds.top, bounds.bottom).reduce((sum, size) => sum + size, 0);
  
  const comp = document.createElement("div");
  comp.className = "component-placed";
  if (type === 'acm') comp.classList.add('component-acm');
  if (type === 'requadro') comp.classList.add('component-requadro');
  comp.style.left = `${left + borderWidth}px`; 
  comp.style.top = `${top + borderWidth}px`;
  comp.style.width = `${width - borderWidth}px`;
  comp.style.height = `${totalHeight - borderWidth}px`;
  if (type === 'requadro') {
    const openingTop = top + (bounds.top === 0 ? 0 : borderWidth);
    const openingBottom = top + totalHeight + (bounds.bottom === numRows ? borderWidth : 0);
    comp.style.top = `${openingTop}px`;
    comp.style.height = `${openingBottom - openingTop}px`;
  }

    const internalWidth = parseFloat(comp.style.width);
    const internalHeight = parseFloat(comp.style.height);

  if (type === "maxim-ar") {
    comp.innerHTML = `<svg viewBox="0 0 ${internalWidth} ${internalHeight}">
            <path d="M0 0 L${internalWidth / 2} ${internalHeight} L${internalWidth} 0" 
                  stroke="black" stroke-width="2" fill="none"/>
        </svg>`;
}   else if (type === "veneziana") {
    const lines = [];
    const lineThickness = 1;
    const desiredLineCycleHeight = 10;
    const numLines = Math.max(1, Math.floor(internalHeight / desiredLineCycleHeight));
    const totalGapSpace = internalHeight - (numLines * lineThickness);
    const actualGap = totalGapSpace / (numLines + 1);
    let currentY = actualGap + (lineThickness / 2);
    for (let i = 0; i < numLines; i++) {
        lines.push(`<line x1="0" y1="${currentY}" x2="${internalWidth}" y2="${currentY}" stroke="black" stroke-width="${lineThickness}" />`);
        currentY += lineThickness + actualGap;
    }
    
    comp.innerHTML = `<svg viewBox="0 0 ${internalWidth} ${internalHeight}"><g>${lines.join("")}</g></svg>`;
  }  else if (type === 'giro-direita' || type === 'giro-esquerda') {
    let path;
    if (type === 'giro-direita') {
      path = `M0 0 L${internalWidth} ${internalHeight / 2} L0 ${internalHeight}`;
    } else { // giro-esquerda
      path = `M${internalWidth} 0 L0 ${internalHeight / 2} L${internalWidth} ${internalHeight}`;
    }
    comp.innerHTML = `<svg viewBox="0 0 ${internalWidth} ${internalHeight}"><path d="${path}" stroke="black" stroke-width="2" fill="none"/></svg>`;
  }

  const trash = document.createElement("button");
  trash.className = "trash-btn";
  trash.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
  trash.addEventListener("click", (e) => {
    e.stopPropagation();
    clearCellComponentAt(r, c);
    redrawAll();
  });
  comp.addEventListener("dragover", (e) => e.preventDefault());
  comp.addEventListener("dragenter", (e) => { e.preventDefault(); comp.classList.add("hovering"); });
  comp.addEventListener("dragleave", () => comp.classList.remove("hovering"));
  comp.addEventListener("drop", (e) => {
    e.preventDefault();
    comp.classList.remove("hovering");
    const newType = e.dataTransfer.getData("text/plain");
    if (newType) {
        if (newType === 'giro') {
            // Se dropar um 'giro' em cima de um componente existente
            if (r === 0 || (gridState[r-1][c] !== null && gridState[r-1][c].master !== true)) {
                showCustomModal({ title: 'Aviso', text: 'Não é possível inserir o "giro" aqui. A célula superior está ocupada.', confirmText: 'OK'});
                return;
            }
            clearCellComponentAt(r, c);
            redrawAll();
            showComponentMenu(e, r, c, true);
        } else {
            clearCellComponentAt(r, c);
            gridState[r][c] = { type: newType, master: true };
            redrawAll();
        }
    }
  });

  let hoverTimeout;
  comp.addEventListener("mouseenter", () => {
    hoverTimeout = setTimeout(() => comp.classList.add("hovering"), 100);
  });
  comp.addEventListener("mouseleave", () => {
    clearTimeout(hoverTimeout);
    comp.classList.remove("hovering");
  });

  comp.appendChild(trash);
  overlay.appendChild(comp);
  // Cenário 1: Apagar a travessa do grid em uma porta de 2 módulos
  if (state.type.startsWith('giro') && state.spanY === 2 && state.transom === false) {
    const transomRemover = document.createElement("div");
    transomRemover.style.position = 'absolute';
    transomRemover.style.backgroundColor = 'white';
    transomRemover.style.zIndex = '5';
    transomRemover.style.top = `${getY(r)}px`;
    transomRemover.style.left = `${getX(c) + borderWidth}px`;
    transomRemover.style.width = `${width - borderWidth}px`;
    transomRemover.style.height = `${borderWidth}px`;
    overlay.appendChild(transomRemover);
  }

  // Cenário 2: Desenhar uma nova travessa em uma porta de 1 módulo
  if (state.type.startsWith('giro') && state.spanY === 1 && state.transom === true) {
    const newTransom = document.createElement("div");
    newTransom.style.position = 'absolute';
    newTransom.style.backgroundColor = 'black';
    newTransom.style.zIndex = '5'; // Mesmo z-index do apagador
    // Posiciona a nova linha preta no centro vertical do componente
    newTransom.style.top = `${top + borderWidth + (internalHeight / 2) - (borderWidth / 2)}px`;
    newTransom.style.left = `${left + borderWidth}px`;
    newTransom.style.width = `${internalWidth}px`;
    newTransom.style.height = `${borderWidth}px`;
    overlay.appendChild(newTransom);
  }
}

async function showComponentMenu(e, r, c) { // Adicionamos async aqui
  e.stopPropagation();
  menuPopup.classList.remove('insert-mode-menu');
  // Esta parte do HTML do menu não muda
  const svgMaximAr = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 102 102"><path d="M1 1 L51 101 L101 1" stroke="black" stroke-width="2" fill="none"/></svg>`;
  const svgVeneziana = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g stroke="black" stroke-width="1"><line y1="5" x2="100" y2="5" x1="0"></line><line y1="15" x2="100" y2="15" x1="0"></line><line y1="25" x2="100" y2="25" x1="0"></line><line y1="35" x2="100" y2="35" x1="0"></line><line y1="45" x2="100" y2="45" x1="0"></line><line y1="55" x2="100" y2="55" x1="0"></line><line y1="65" x2="100" y2="65" x1="0"></line><line y1="75" x2="100" y2="75" x1="0"></line><line y1="85" x2="100" y2="85" x1="0"></line><line y1="95" x2="100" y2="95" x1="0"></line></g></svg>`;
  const svgGiroIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M25 2 L75 50 L25 98" stroke="black" stroke-width="2" fill="none"/></svg>`;
  const svgAcmIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="8" y="8" width="84" height="84" fill="#d3d3d3"/><text x="50" y="56" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#6c757d">ACM</text></svg>`;
  const svgRequadroIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M18 82V18H82V82" stroke="#6c757d" stroke-width="2" fill="none"/><path d="M18 82H82" stroke="#6c757d" stroke-width="1.5" stroke-dasharray="5 5" fill="none"/></svg>`;
  const menuOptionsHTML = `
      <div class="option" data-select="maxim-ar" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgMaximAr)}');"></div>
      <div class="option" data-select="veneziana" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgVeneziana)}');"></div>
      <div class="option" data-select="giro" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgGiroIcon)}');"></div>
      <div class="option" data-select="acm" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgAcmIcon)}');" aria-label="ACM" title="ACM"></div>
      <div class="option" data-select="requadro" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgRequadroIcon)}');" aria-label="Requadro" title="Requadro"></div>
  `;

  menuPopup.innerHTML = menuOptionsHTML;
  menuPopup.style.display = "flex";
  menuPopup.style.left = `${e.clientX}px`;
  menuPopup.style.top = `${e.clientY}px`;
  const popupBounds = menuPopup.getBoundingClientRect();
  menuPopup.style.left = `${Math.max(8, Math.min(e.clientX, window.innerWidth - popupBounds.width - 8))}px`;
  menuPopup.style.top = `${Math.max(8, Math.min(e.clientY, window.innerHeight - popupBounds.height - 8))}px`;
  
  menuPopup.querySelectorAll(".option").forEach((opt) => {
    opt.onclick = async (event) => { // Adicionamos async aqui
      event.stopPropagation();
      const selectedType = opt.dataset.select;

      if (selectedType === 'requadro') {
        setInsertMode('requadro', 'cell', { row: r, col: c });
      } else if (selectedType === 'giro') {
        menuPopup.style.display = "none"; // Esconde o menu pequeno imediatamente
        setInsertMode('giro', 'cell');
        await insertFromActiveMode(r, c);
      } else {
        if (c === 0 && (selectedType === 'maxim-ar' || selectedType === 'veneziana' || selectedType === 'acm')) {
          setInsertMode(selectedType, 'cell', { row: r, col: c });
        } else {
          menuPopup.style.display = "none";
          gridState[r][c] = { type: selectedType, master: true };
          redrawAll();
        }
      }
    };
  });
}

// --- LÓGICA DO MODAL E EXPORTAÇÃO ---
function drawDimensionLine(ctx, x1, y1, x2, y2, label, orientation, options = {}) {
  const bracketSize = options.bracketSize || 16;
  const labelOffset = options.labelOffset || 18;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  if (orientation === 'horizontal') {
    ctx.moveTo(x1, y1 - bracketSize / 2);
    ctx.lineTo(x1, y1 + bracketSize / 2);
    ctx.moveTo(x2, y2 - bracketSize / 2);
    ctx.lineTo(x2, y2 + bracketSize / 2);
  } else {
    ctx.moveTo(x1 - bracketSize / 2, y1);
    ctx.lineTo(x1 + bracketSize / 2, y1);
    ctx.moveTo(x2 - bracketSize / 2, y2);
    ctx.lineTo(x2 + bracketSize / 2, y2);
  }

  ctx.stroke();

  if (orientation === 'horizontal') {
    ctx.textAlign = 'center';
    ctx.fillText(label, (x1 + x2) / 2, y1 + labelOffset, options.maxTextWidth || Math.abs(x2 - x1));
  } else {
    ctx.textAlign = 'left';
    ctx.fillText(label, x1 + labelOffset, (y1 + y2) / 2, options.maxTextWidth || 76);
  }
}

function getWidthDimensionBounds(baseCanvas, layout) {
  return {
    left: layout.paddingLeft - (cornerBoundaries.has(0) ? 0 : layout.espacoExtra),
    right: layout.paddingLeft + baseCanvas.width + (cornerBoundaries.has(numCols) ? 0 : layout.espacoExtra)
  };
}

function drawSimpleDimensions(ctx, baseCanvas, layout) {
  ctx.font = 'bold 18px sans-serif';
  const hX = layout.paddingLeft + baseCanvas.width + layout.cotaOffset;
  const hYStart = layout.paddingTop - layout.espacoExtra;
  const hYEnd = layout.paddingTop + baseCanvas.height + layout.espacoExtra;
  drawDimensionLine(ctx, hX, hYStart, hX, hYEnd, 'H', 'vertical', { bracketSize: 20, labelOffset: 15 });

  const lY = layout.paddingTop + baseCanvas.height + layout.cotaOffset;
  const { left, right } = getWidthDimensionBounds(baseCanvas, layout);
  drawDimensionLine(ctx, left, lY, right, lY, 'L', 'horizontal', { bracketSize: 20, labelOffset: 20 });
}

function drawDetailedDimensions(ctx, baseCanvas, layout) {
  ctx.font = 'bold 12px sans-serif';
  const totalOffset = 86;
  const detailX = layout.paddingLeft + baseCanvas.width + layout.cotaOffset;
  const detailY = layout.paddingTop + baseCanvas.height + layout.cotaOffset;

  columnWidths.forEach((width, index) => {
    const x1 = layout.paddingLeft + getX(index);
    const x2 = x1 + width;
    drawDimensionLine(ctx, x1, detailY, x2, detailY, formatCm(width), 'horizontal', {
      bracketSize: 14,
      labelOffset: 17,
      maxTextWidth: Math.max(14, width - 4)
    });
  });

  rowHeights.forEach((height, index) => {
    const y1 = layout.paddingTop + getY(index);
    const y2 = y1 + height;
    drawDimensionLine(ctx, detailX, y1, detailX, y2, formatCm(height), 'vertical', {
      bracketSize: 14,
      labelOffset: 8,
      maxTextWidth: 72
    });
  });

  ctx.font = 'bold 14px sans-serif';
  const totalWidthCm = columnWidths.reduce((sum, width) => sum + gridSizeToCm(width), 0);
  const totalHeightCm = rowHeights.reduce((sum, height) => sum + gridSizeToCm(height), 0);
  const { left, right } = getWidthDimensionBounds(baseCanvas, layout);
  drawDimensionLine(
    ctx,
    left,
    layout.paddingTop + baseCanvas.height + totalOffset,
    right,
    layout.paddingTop + baseCanvas.height + totalOffset,
    `L: ${totalWidthCm}cm`,
    'horizontal',
    { bracketSize: 18, labelOffset: 20 }
  );
  drawDimensionLine(
    ctx,
    layout.paddingLeft + baseCanvas.width + totalOffset,
    layout.paddingTop - layout.espacoExtra,
    layout.paddingLeft + baseCanvas.width + totalOffset,
    layout.paddingTop + baseCanvas.height + layout.espacoExtra,
    `H: ${totalHeightCm}cm`,
    'vertical',
    { bracketSize: 18, labelOffset: 12 }
  );
}

function drawRequadroFrameCuts(ctx, layout, baseCanvas) {
  ctx.save();
  gridState.forEach((row, r) => row.forEach((cell, col) => {
    if (!cell?.master || cell.type !== 'requadro') return;
    const bounds = getComponentBounds(r, col, cell);
    const leftProfile = borderWidth * (bounds.left === 0 && cornerBoundaries.has(0) ? 2 : 1);
    const rightProfile = borderWidth * (bounds.right === numCols && cornerBoundaries.has(numCols) ? 2 : 1);
    const left = layout.paddingLeft + getX(bounds.left) + leftProfile;
    const right = layout.paddingLeft + getX(bounds.right) + borderWidth - rightProfile;
    const cuts = [];
    if (bounds.top === 0) cuts.push([layout.paddingTop - layout.espacoExtra, layout.paddingTop + borderWidth]);
    if (bounds.bottom === numRows) cuts.push([layout.paddingTop + getY(numRows), layout.paddingTop + baseCanvas.height + layout.espacoExtra]);
    cuts.forEach(([top, bottom]) => {
      ctx.fillStyle = 'white';
      ctx.fillRect(left, top, right - left, bottom - top);
      // Close the exposed profile ends without adding a bar across the opening.
      ctx.fillStyle = 'black';
      ctx.fillRect(left - leftProfile, top, leftProfile, bottom - top);
      ctx.fillRect(right, top, rightProfile, bottom - top);
    });
  }));
  ctx.restore();
}

function drawCornerFrameCuts(ctx, layout, baseCanvas) {
  const { paddingLeft, paddingTop, espacoExtra } = layout;
  const rightEdge = paddingLeft + baseCanvas.width;
  const bottomEdge = paddingTop + baseCanvas.height;
  const profileWidth = borderWidth * 2;

  [0, numCols].forEach((boundary) => {
    if (!cornerBoundaries.has(boundary)) return;
    const isLeft = boundary === 0;
    ctx.fillStyle = 'white';
    ctx.fillRect(isLeft ? paddingLeft - espacoExtra : rightEdge, paddingTop - espacoExtra,
      espacoExtra, baseCanvas.height + espacoExtra * 2);

    // Join the horizontal frame ends to the corner mullion across the frame gap.
    const profileX = isLeft ? paddingLeft : rightEdge - profileWidth;
    ctx.fillStyle = 'black';
    ctx.fillRect(profileX, paddingTop - espacoExtra, profileWidth, espacoExtra);
    ctx.fillRect(profileX, bottomEdge, profileWidth, espacoExtra);
  });
}

function createExportCanvas(baseCanvas, mode) {
  const finalCanvas = document.createElement('canvas');
  const ctx = finalCanvas.getContext('2d');
  const marcoRespiro = 1;
  const marcoEspessura = 3;
  const espacoExtra = marcoRespiro + marcoEspessura;
  const isDetailed = mode === 'detailed';
  const noDimensions = mode === 'none';
  const layout = {
    espacoExtra,
    paddingTop: (noDimensions ? 36 : 50) + espacoExtra,
    paddingLeft: (noDimensions ? 36 : 50) + espacoExtra,
    paddingBottom: (noDimensions ? 36 : isDetailed ? 130 : 70) + espacoExtra,
    paddingRight: (noDimensions ? 36 : isDetailed ? 210 : 70) + espacoExtra,
    cotaOffset: 22
  };

  finalCanvas.width = layout.paddingLeft + baseCanvas.width + layout.paddingRight;
  finalCanvas.height = layout.paddingTop + baseCanvas.height + layout.paddingBottom;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
  ctx.fillStyle = 'black';
  ctx.fillRect(layout.paddingLeft - espacoExtra, layout.paddingTop - espacoExtra, baseCanvas.width + (espacoExtra * 2), baseCanvas.height + (espacoExtra * 2));
  ctx.fillStyle = 'white';
  ctx.fillRect(layout.paddingLeft - marcoRespiro, layout.paddingTop - marcoRespiro, baseCanvas.width + (marcoRespiro * 2), baseCanvas.height + (marcoRespiro * 2));
  drawCornerFrameCuts(ctx, layout, baseCanvas);
  ctx.drawImage(baseCanvas, layout.paddingLeft, layout.paddingTop);

  drawRequadroFrameCuts(ctx, layout, baseCanvas);

  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'black';
  ctx.lineWidth = 2;
  ctx.textBaseline = 'middle';

  if (isDetailed) {
    drawDetailedDimensions(ctx, baseCanvas, layout);
  } else if (!noDimensions) {
    drawSimpleDimensions(ctx, baseCanvas, layout);
  }
  drawCornersOnExport(ctx, layout);
  drawInfinityOnExport(ctx, layout, baseCanvas, mode);

  return finalCanvas;
}

// --- EVENTOS GERAIS ---
function applyPresetSize(target) {
  const newSize = parseInt(moduleSizePresetInput.value);
  if (isNaN(newSize) || newSize < minModuleSizeCm || newSize > maxModuleSizeCm) {
    showCustomModal({ title: 'Erro', text: `Por favor, insira uma medida padrão entre ${minModuleSizeCm} e ${maxModuleSizeCm} cm.`, confirmText: 'OK' });
    return;
  }

  if (target === 'cols' || target === 'all') {
    columnWidths = columnWidths.map(() => cmToGridSize(newSize));
  }

  if (target === 'rows' || target === 'all') {
    rowHeights = rowHeights.map(() => cmToGridSize(newSize));
  }

  redrawAll();
}

document.getElementById('controls').addEventListener('click', (e) => {
  if (e.target.matches('.stepper-btn')) {
    const action = e.target.dataset.action;
    const targetInput = document.getElementById(e.target.dataset.target);
    if (targetInput) {
      let value = parseInt(targetInput.value);
      const min = parseInt(targetInput.min);
      if (action === 'increment') {
        value++;
      } else if (action === 'decrement' && value > min) {
        value--;
      }
      targetInput.value = value;
      targetInput.dispatchEvent(new Event('change'));
    }
  }

  if (e.target.matches('[data-apply-size]')) {
    applyPresetSize(e.target.dataset.applySize);
  }
});
colsInput.addEventListener("change", updateGrid);
rowsInput.addEventListener("change", updateGrid);
clearGridBtn.addEventListener("click", async () => {
  const confirmed = await showCustomModal({
    title: 'Limpar Fachada',
    text: 'Tem certeza que deseja limpar toda a fachada? Esta ação não pode ser desfeita.',
    confirmText: 'Sim, Limpar Tudo',
    cancelText: 'Cancelar'
  });
  if (confirmed) {
    resetGridState(parseInt(rowsInput.value), parseInt(colsInput.value));
  }
});

// Capture outside clicks before grid handlers can open another menu or remove a component.
document.addEventListener('click', (e) => {
  if (!activeInsertMode && !cornerModeActive && !infinityModeActive && !activeMeasureCancel && !activeGiroCancel) return;
  const target = e.target;
  if (target.closest('#edit-mode-notices, #menu-popup, #custom-modal-overlay, #preview-page')) return;

  const component = target.closest('#sidebar .component');
  if (!activeMeasureCancel && !activeGiroCancel && component && (
    (activeInsertMode && component.dataset.type === activeInsertMode.type) ||
    (cornerModeActive && component === cornerModeBtn) ||
    (infinityModeActive && component === infinityModeBtn)
  )) return;

  if (!activeMeasureCancel && !activeGiroCancel) {
    if (activeInsertMode?.type === 'requadro' && activeInsertMode.target && target.closest('#grid-container')) {
      if (target.closest('.requadro-candidate')) return;
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (cornerModeActive && target.closest('.corner-target')) return;
    if (infinityModeActive && target.closest('.infinity-selection-target')) return;
    if (activeInsertMode && target.closest('.add-btn.insert-target')) return;
  }

  const isCanvasClick = Boolean(target.closest('#canvas-container'));
  cancelEditingMode();
  if (isCanvasClick) {
    e.preventDefault();
    e.stopPropagation();
  }
}, true);

document.addEventListener("click", (e) => {
  if (!menuPopup.contains(e.target) && !e.target.classList.contains('add-btn')) {
    menuPopup.style.display = "none";
    menuPopup.classList.remove('insert-mode-menu');
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === 'Escape' && (activeInsertMode || cornerModeActive || infinityModeActive || activeMeasureCancel)) {
    cancelEditingMode();
  }
});

cornerModeBtn.addEventListener("click", () => {
  if (cornerModeActive) {
    finishCornerEditing();
    return;
  }
  if (infinityModeActive) finishInfinityEditing();
  clearInsertMode(false);
  cornerEditSnapshot = new Set(cornerBoundaries);
  cornerModeActive = true;
  updateInsertModeStatus();
  cornerModeBtn.blur();
  redrawAll();
});

infinityModeBtn.addEventListener("click", () => {
  if (infinityModeActive) {
    finishInfinityEditing();
    return;
  }
  if (cornerModeActive) finishCornerEditing();
  clearInsertMode(false);
  infinityEditSnapshot = { ...infinityMarkers };
  infinityOrientation = 'vertical';
  infinityModeActive = true;
  updateInsertModeStatus();
  infinityModeBtn.blur();
  redrawAll();
});

function initializeSidebarComponents() {
  const components = document.querySelectorAll("#sidebar .component[data-type]");
  components.forEach(component => {
    component.addEventListener("click", () => {
      const type = component.dataset.type;
      setInsertMode(type, 'cell');
    });
  });
}

// --- INICIALIZAÇÃO ---
resetGridState(numRows, numCols);
initializeSidebarComponents();
