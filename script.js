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
const modalOverlay = document.getElementById("modal-overlay");
const modalImageContainer = document.getElementById("modal-image-container");
const modalCancelBtn = document.getElementById("modal-cancel-btn");
const modalDownloadBtn = document.getElementById("modal-download-btn");
const moduleSizePresetInput = document.getElementById("module-size-preset");
const exportModeSelect = document.getElementById("export-mode");
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
let infinityMarkers = { left: false, right: false };
let cornerEditSnapshot = null;
let infinityEditSnapshot = null;
let activeGiroCancel = null;

// --- FUNÇÕES DE LÓGICA DO GRID ---
function getX(col) { return columnWidths.slice(0, col).reduce((a, b) => a + b, 0); }
function getY(row) { return rowHeights.slice(0, row).reduce((a, b) => a + b, 0); }
function cmToGridSize(value) { return value + borderWidth; }
function gridSizeToCm(value) { return Math.max(0, value - borderWidth); }
function formatCm(value) { return `${gridSizeToCm(value)}cm`; }

function resetGridState(newRows, newCols) {
  numRows = newRows;
  numCols = newCols;
  colsInput.value = newCols;
  rowsInput.value = newRows;
  gridState = Array(numRows).fill(null).map(() => Array(numCols).fill(null));
  cornerBoundaries.clear();
  infinityMarkers = { left: false, right: false };
  columnWidths = Array(numCols).fill(cmToGridSize(defaultModuleSizeCm));
  rowHeights = Array(numRows).fill(cmToGridSize(defaultModuleSizeCm));
  updateGrid();
}

function updateGrid() {
  const newRows = parseInt(rowsInput.value);
  const newCols = parseInt(colsInput.value);
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
      if (cell && cell.master && cell.type.startsWith('giro') && cell.spanY === 2 && r > 0) {
        gridState[r - 1][c] = { occupiedBy: [r, c] };
      }
    }
  }
}

function insertColumnAt(index) {
  const columnIndex = Math.max(0, Math.min(index, numCols));
  cornerBoundaries = new Set([...cornerBoundaries].map((boundary) => boundary >= columnIndex ? boundary + 1 : boundary));
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

  if (cell.master) {
    if (cell.type.startsWith('giro') && cell.spanY === 2 && row > 0) {
      gridState[row - 1][col] = null;
    }
    gridState[row][col] = null;
    return;
  }

  if (cell.occupiedBy) {
    const [masterRow, masterCol] = cell.occupiedBy;
    if (gridState[masterRow]?.[masterCol]) {
      gridState[masterRow][masterCol] = null;
    }
    gridState[row][col] = null;
  }
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

  cornerBoundaries = new Set([...cornerBoundaries]
    .filter((boundary) => boundary !== index && boundary !== index + 1)
    .map((boundary) => boundary > index + 1 ? boundary - 1 : boundary));

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

async function editColumnWidth(index) {
  const labelText = String.fromCharCode(65 + index);
  const result = await showCustomModal({
    title: 'Alterar Largura da Coluna',
    text: `Digite a nova largura para a coluna ${labelText} (${minModuleSizeCm}-${maxModuleSizeCm} cm):`,
    inputType: 'number',
    initialValue: gridSizeToCm(columnWidths[index]),
    confirmText: 'Alterar',
    cancelText: 'Cancelar'
  });

  if (result !== false && result !== null && result !== '') {
    const newSize = parseInt(result);
    if (!isNaN(newSize) && newSize >= minModuleSizeCm && newSize <= maxModuleSizeCm) {
      columnWidths[index] = cmToGridSize(newSize);
      updateGrid();
    } else {
      showCustomModal({ title: 'Erro', text: `Por favor, insira um valor válido entre ${minModuleSizeCm} e ${maxModuleSizeCm} cm.`, confirmText: 'OK' });
    }
  }
}

async function editRowHeight(index) {
  const result = await showCustomModal({
    title: 'Alterar Altura da Linha',
    text: `Digite a nova altura para a linha ${index + 1} (${minModuleSizeCm}-${maxModuleSizeCm} cm):`,
    inputType: 'number',
    initialValue: gridSizeToCm(rowHeights[index]),
    confirmText: 'Alterar',
    cancelText: 'Cancelar'
  });

  if (result !== false && result !== null && result !== '') {
    const newSize = parseInt(result);
    if (!isNaN(newSize) && newSize >= minModuleSizeCm && newSize <= maxModuleSizeCm) {
      rowHeights[index] = cmToGridSize(newSize);
      updateGrid();
    } else {
      showCustomModal({ title: 'Erro', text: `Por favor, insira um valor válido entre ${minModuleSizeCm} e ${maxModuleSizeCm} cm.`, confirmText: 'OK' });
    }
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
    const line = document.createElement("div");
    line.className = "line v-line";
    line.style.left = `${x}px`;
    if (cornerBoundaries.has(c)) line.classList.add("corner-boundary");
    if (cornerModeActive && c > 0 && c < numCols) {
      line.classList.add("corner-target");
      line.title = `Marcar canto entre ${String.fromCharCode(64 + c)} e ${String.fromCharCode(65 + c)}`;
      line.addEventListener("click", (event) => {
        event.stopPropagation();
        if (cornerBoundaries.has(c)) cornerBoundaries.delete(c);
        else cornerBoundaries.add(c);
        redrawAll();
      });
    }
    grid.appendChild(line);
    x += columnWidths[c] || 0;
  }
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

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("infinity-markers");
  svg.setAttribute("width", width);
  svg.setAttribute("height", height);
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  if (fillPaths.length) {
    const mask = document.createElementNS("http://www.w3.org/2000/svg", "path");
    mask.setAttribute("d", fillPaths.join(" "));
    mask.classList.add("infinity-mask");
    svg.appendChild(mask);
  }
  if (paths.length) {
    const cut = document.createElementNS("http://www.w3.org/2000/svg", "path");
    cut.setAttribute("d", paths.join(" "));
    svg.appendChild(cut);
  }
  overlay.appendChild(svg);
}

function renderInfinitySelectionTargets(width, height) {
  if (!infinityModeActive) return;
  ['left', 'right'].forEach((side) => {
    const column = side === 'left' ? 0 : numCols - 1;
    const target = document.createElement("button");
    target.type = "button";
    target.className = `infinity-column-target infinity-${side}`;
    target.title = `Inserir ou remover infinidade na coluna ${side === 'left' ? 'esquerda' : 'direita'}`;
    target.setAttribute("aria-label", target.title);
    target.style.left = `${getX(column)}px`;
    target.style.width = `${columnWidths[column]}px`;
    target.style.height = `${height}px`;
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
    const x = layout.paddingLeft + getX(boundary);
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
  if (!infinityMarkers.left && !infinityMarkers.right) return;
  const totalDimensionOffset = mode === 'detailed' ? 86 : 22;
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
  ctx.restore();
}

function getComponentName(type) {
  const names = {
    'maxim-ar': 'Maxim-ar',
    veneziana: 'Veneziana',
    giro: 'Porta de Giro',
    acm: 'ACM'
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
  document.body.classList.toggle('editing-mode', isEditing);
  if (!isEditing) {
    insertModeStatus.classList.remove('visible');
    insertModeStatus.innerHTML = '';
    return;
  }

  const title = cornerModeActive ? 'Canto' : infinityModeActive ? 'Infinidade' : getComponentName(activeInsertMode.type);
  const scopeText = cornerModeActive
    ? 'Clique em um montante para adicionar ou remover um canto.'
    : infinityModeActive
      ? 'Clique em um quadro da coluna esquerda ou direita para cortar a fachada.'
      : activeInsertMode.scope === 'row' ? 'Clique em uma linha para preencher.' : 'Clique em um quadro vazio.';
  insertModeStatus.innerHTML = `
    <strong>${title}</strong><br>
    ${scopeText}
    <div class="edit-mode-actions">
      ${cornerModeActive || infinityModeActive ? '<button type="button" class="edit-mode-confirm" aria-label="Finalizar" title="Finalizar">&#10003;</button>' : ''}
      <button type="button" class="edit-mode-cancel" aria-label="Cancelar" title="Cancelar">&times;</button>
    </div>
  `;
  insertModeStatus.classList.add('visible');
  insertModeStatus.querySelector('.edit-mode-cancel').addEventListener('click', cancelEditingMode);
  insertModeStatus.querySelector('.edit-mode-confirm')?.addEventListener('click', () => {
    if (cornerModeActive) finishCornerEditing();
    else finishInfinityEditing();
  });
}

function cancelEditingMode() {
  if (activeGiroCancel) {
    activeGiroCancel();
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

function setInsertMode(type, scope) {
  if (cornerModeActive) finishCornerEditing();
  if (infinityModeActive) finishInfinityEditing();
  activeInsertMode = { type, scope };
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

  const { type, scope } = activeInsertMode;
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
  
  if (activeInsertMode) {
    addBtn.classList.add('insert-target');
  }

  addBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
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

  if (state.type.startsWith('giro') && state.spanY === 2) {
    top = getY(r - 1); 
    totalHeight = height + rowHeights[r-1]; 
  }
  
  const comp = document.createElement("div");
  comp.className = "component-placed";
  if (type === 'acm') comp.classList.add('component-acm');
  comp.style.left = `${left + borderWidth}px`; 
  comp.style.top = `${top + borderWidth}px`;
  comp.style.width = `${width - borderWidth}px`;
  comp.style.height = `${totalHeight - borderWidth}px`;

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
    gridState[r][c] = null;
    if (state.type.startsWith('giro') && state.spanY === 2) {
        gridState[r-1][c] = null;
    }
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
            gridState[r][c] = null; // Limpa o estado atual
            if (type.startsWith('giro')) { gridState[r-1][c] = null; }
            redrawAll();
            showComponentMenu(e, r, c, true);
        } else {
            gridState[r][c] = { type: newType, master: true };
            if (type.startsWith('giro')) { gridState[r-1][c] = null; }
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
  const menuOptionsHTML = `
      <div class="option" data-select="maxim-ar" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgMaximAr)}');"></div>
      <div class="option" data-select="veneziana" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgVeneziana)}');"></div>
      <div class="option" data-select="giro" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgGiroIcon)}');"></div>
      <div class="option" data-select="acm" style="background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svgAcmIcon)}');" aria-label="ACM" title="ACM"></div>
  `;

  menuPopup.innerHTML = menuOptionsHTML;
  menuPopup.style.display = "flex";
  menuPopup.style.left = `${e.clientX}px`;
  menuPopup.style.top = `${e.clientY}px`;
  
  menuPopup.querySelectorAll(".option").forEach((opt) => {
    opt.onclick = async (event) => { // Adicionamos async aqui
      event.stopPropagation();
      const selectedType = opt.dataset.select;

      if (selectedType === 'giro') {
        menuPopup.style.display = "none"; // Esconde o menu pequeno imediatamente
        setInsertMode('giro', 'cell');
        await insertFromActiveMode(r, c);
      } else {
        if (c === 0 && (selectedType === 'maxim-ar' || selectedType === 'veneziana' || selectedType === 'acm')) {
          showPlacementScopeMenu(event, selectedType, r, c);
        } else {
          menuPopup.style.display = "none";
          gridState[r][c] = { type: selectedType, master: true };
          redrawAll();
        }
      }
    };
  });
}

function showPlacementScopeMenu(e, type, r, c) {
  menuPopup.classList.add('insert-mode-menu');
  menuPopup.innerHTML = `
    <button type="button" class="insert-mode-option" data-scope="cell">Inserir somente neste quadro</button>
    <button type="button" class="insert-mode-option" data-scope="row">Inserir na linha inteira</button>
  `;
  menuPopup.style.display = "flex";
  menuPopup.style.left = `${e.clientX}px`;
  menuPopup.style.top = `${e.clientY}px`;

  menuPopup.querySelectorAll(".insert-mode-option").forEach((option) => {
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      menuPopup.style.display = "none";
      menuPopup.classList.remove('insert-mode-menu');

      if (option.dataset.scope === 'row') {
        fillRowWithComponent(r, type);
      } else {
        gridState[r][c] = { type, master: true };
      }

      redrawAll();
    });
  });
}

function showInsertModeMenu(e, type) {
  e.stopPropagation();
  menuPopup.classList.add('insert-mode-menu');
  menuPopup.innerHTML = `
    <button type="button" class="insert-mode-option" data-scope="cell">Selecionar quadro a ser inserido</button>
    <button type="button" class="insert-mode-option" data-scope="row">Selecionar linha a ser inserida</button>
  `;
  menuPopup.style.display = "flex";
  menuPopup.style.left = `${e.clientX}px`;
  menuPopup.style.top = `${e.clientY}px`;

  menuPopup.querySelectorAll(".insert-mode-option").forEach((option) => {
    option.addEventListener('click', (event) => {
      event.stopPropagation();
      setInsertMode(type, option.dataset.scope);
    });
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

function drawSimpleDimensions(ctx, baseCanvas, layout) {
  ctx.font = 'bold 18px sans-serif';
  const hX = layout.paddingLeft + baseCanvas.width + layout.cotaOffset;
  const hYStart = layout.paddingTop - layout.espacoExtra;
  const hYEnd = layout.paddingTop + baseCanvas.height + layout.espacoExtra;
  drawDimensionLine(ctx, hX, hYStart, hX, hYEnd, 'H', 'vertical', { bracketSize: 20, labelOffset: 15 });

  const lY = layout.paddingTop + baseCanvas.height + layout.cotaOffset;
  const lXStart = layout.paddingLeft - layout.espacoExtra;
  const lXEnd = layout.paddingLeft + baseCanvas.width + layout.espacoExtra;
  drawDimensionLine(ctx, lXStart, lY, lXEnd, lY, 'L', 'horizontal', { bracketSize: 20, labelOffset: 20 });
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
  drawDimensionLine(
    ctx,
    layout.paddingLeft - layout.espacoExtra,
    layout.paddingTop + baseCanvas.height + totalOffset,
    layout.paddingLeft + baseCanvas.width + layout.espacoExtra,
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

function createExportCanvas(baseCanvas, mode) {
  const finalCanvas = document.createElement('canvas');
  const ctx = finalCanvas.getContext('2d');
  const marcoRespiro = 1;
  const marcoEspessura = 3;
  const espacoExtra = marcoRespiro + marcoEspessura;
  const isDetailed = mode === 'detailed';
  const layout = {
    espacoExtra,
    paddingTop: 50 + espacoExtra,
    paddingLeft: 50 + espacoExtra,
    paddingBottom: (isDetailed ? 130 : 70) + espacoExtra,
    paddingRight: (isDetailed ? 210 : 70) + espacoExtra,
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
  ctx.drawImage(baseCanvas, layout.paddingLeft, layout.paddingTop);

  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'black';
  ctx.lineWidth = 2;
  ctx.textBaseline = 'middle';

  if (isDetailed) {
    drawDetailedDimensions(ctx, baseCanvas, layout);
  } else {
    drawSimpleDimensions(ctx, baseCanvas, layout);
  }
  drawCornersOnExport(ctx, layout);
  drawInfinityOnExport(ctx, layout, baseCanvas, mode);

  return finalCanvas;
}

let currentPreviewBaseCanvas = null;

function renderExportPreview(mode) {
  if (!currentPreviewBaseCanvas) return;
  const finalCanvas = createExportCanvas(currentPreviewBaseCanvas, mode);
  const finalImage = new Image();
  finalImage.src = finalCanvas.toDataURL('image/png');
  modalImageContainer.innerHTML = '';
  modalImageContainer.appendChild(finalImage);

  const filenameInput = document.getElementById('filename-input');
  const suffix = mode === 'detailed' ? 'COTADO' : 'APRESENTACAO';
  filenameInput.value = `ELEVFAC-${numCols}X${numRows}-${suffix}.png`;
}

generateBtn.addEventListener("click", () => {
  const gridElement = document.getElementById("grid-container");
  const mode = exportModeSelect.value;
  html2canvas(gridElement).then(baseCanvas => {
    currentPreviewBaseCanvas = baseCanvas;
    renderExportPreview(mode);
    modalOverlay.style.display = 'flex';
  });
});
modalCancelBtn.addEventListener('click', () => {
  modalOverlay.style.display = 'none';
  currentPreviewBaseCanvas = null;
});
modalDownloadBtn.addEventListener('click', () => {
  const finalImage = modalImageContainer.querySelector('img');
  const filenameInput = document.getElementById('filename-input');
  if (finalImage && filenameInput) {
    let filename = filenameInput.value.trim(); 
    if (filename === '') {
      filename = `ELEVFAC-${numCols}X${numRows}.png`;
    }
    if (!filename.toLowerCase().endsWith('.png')) {
      filename += '.png';
    }
    const link = document.createElement('a');
    link.href = finalImage.src;
    link.download = filename;
    link.click();
  }
  modalOverlay.style.display = 'none';
  currentPreviewBaseCanvas = null;
});

exportModeSelect.addEventListener('change', () => {
  renderExportPreview(exportModeSelect.value);
});

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

document.addEventListener("click", (e) => {
  if (!menuPopup.contains(e.target) && !e.target.classList.contains('add-btn')) {
    menuPopup.style.display = "none";
    menuPopup.classList.remove('insert-mode-menu');
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === 'Escape' && (activeInsertMode || cornerModeActive || infinityModeActive)) {
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
  infinityModeActive = true;
  updateInsertModeStatus();
  infinityModeBtn.blur();
  redrawAll();
});

function initializeSidebarComponents() {
  const components = document.querySelectorAll("#sidebar .component[data-type]");
  components.forEach(component => {
    component.addEventListener("click", (e) => {
      const type = component.dataset.type;
      if (type === 'maxim-ar' || type === 'veneziana' || type === 'acm') {
        showInsertModeMenu(e, type);
      } else {
        setInsertMode(type, 'cell');
      }
    });
  });
}

// --- INICIALIZAÇÃO ---
resetGridState(numRows, numCols);
initializeSidebarComponents();
