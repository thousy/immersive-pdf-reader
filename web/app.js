const state = {
    pdfDoc: null,
    pageNum: 1,
    pageRendering: false,
    pageNumPending: null,
    scale: 1.0,
    currentFile: null
};

const elements = {
    canvas: document.getElementById('pdf-canvas'),
    ctx: document.getElementById('pdf-canvas').getContext('2d'),
    pdfList: document.getElementById('pdf-list'),
    documentTitle: document.getElementById('document-title'),
    overlay: document.getElementById('pdf-viewer-overlay'),
    prevBtn: document.getElementById('prev-page'),
    nextBtn: document.getElementById('next-page'),
    pageNumInput: document.getElementById('page-num'),
    pageCountSpan: document.getElementById('page-count'),
    zoomInBtn: document.getElementById('zoom-in'),
    zoomOutBtn: document.getElementById('zoom-out'),
    zoomLevel: document.getElementById('zoom-level'),
    themeToggle: document.getElementById('theme-toggle')
};

// Theme management
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light-mode';
    document.body.className = savedTheme;
    updateThemeIcon();

    elements.themeToggle.addEventListener('click', () => {
        if (document.body.classList.contains('light-mode')) {
            document.body.classList.replace('light-mode', 'dark-mode');
            localStorage.setItem('theme', 'dark-mode');
        } else {
            document.body.classList.replace('dark-mode', 'light-mode');
            localStorage.setItem('theme', 'light-mode');
        }
        updateThemeIcon();
    });
}

function updateThemeIcon() {
    const icon = elements.themeToggle.querySelector('i');
    if (document.body.classList.contains('dark-mode')) {
        icon.className = 'ph ph-sun';
    } else {
        icon.className = 'ph ph-moon';
    }
}

// PDF Rendering
async function renderPage(num) {
    state.pageRendering = true;
    
    // Fetch page
    try {
        const page = await state.pdfDoc.getPage(num);
        
        // Calculate scale to fit container width, clamped between 0.5 and 3.0
        const containerWidth = document.getElementById('pdf-viewer-container').clientWidth - 48; // padding
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        let baseScale = containerWidth / unscaledViewport.width;
        if (baseScale > 1.5) baseScale = 1.5; // Max default scale
        
        const finalScale = baseScale * state.scale;
        const viewport = page.getViewport({ scale: finalScale });

        // Display zoom level
        elements.zoomLevel.textContent = Math.round(state.scale * 100) + '%';
        
        elements.canvas.height = viewport.height;
        elements.canvas.width = viewport.width;

        const renderContext = {
            canvasContext: elements.ctx,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;
        state.pageRendering = false;
        
        if (state.pageNumPending !== null) {
            renderPage(state.pageNumPending);
            state.pageNumPending = null;
        }

        // Update UI
        elements.pageNumInput.value = num;
        saveLastRead(state.currentFile, num);
        updateButtons();
        
    } catch (e) {
        console.error("Error rendering page:", e);
        state.pageRendering = false;
    }
}

function queueRenderPage(num) {
    if (state.pageRendering) {
        state.pageNumPending = num;
    } else {
        renderPage(num);
    }
}

function onPrevPage() {
    if (state.pageNum <= 1) return;
    state.pageNum--;
    queueRenderPage(state.pageNum);
}

function onNextPage() {
    if (state.pageNum >= state.pdfDoc.numPages) return;
    state.pageNum++;
    queueRenderPage(state.pageNum);
}

function onZoomIn() {
    if (state.scale >= 3.0) return;
    state.scale += 0.2;
    queueRenderPage(state.pageNum);
}

function onZoomOut() {
    if (state.scale <= 0.4) return;
    state.scale -= 0.2;
    queueRenderPage(state.pageNum);
}

// Load a specific PDF document
async function loadPDF(filename) {
    elements.overlay.classList.remove('hidden');
    state.currentFile = filename;
    state.scale = 1.0;
    
    // Reset UI
    const allItems = document.querySelectorAll('#pdf-list li');
    allItems.forEach(i => i.classList.remove('active'));
    
    const activeItem = Array.from(allItems).find(i => i.textContent.includes(filename));
    if (activeItem) activeItem.classList.add('active');
    
    elements.documentTitle.textContent = filename;
    
    try {
        const loadingTask = pdfjsLib.getDocument(`/${encodeURIComponent(filename)}`);
        state.pdfDoc = await loadingTask.promise;
        
        // Update page counts
        elements.pageCountSpan.textContent = state.pdfDoc.numPages;
        elements.pageNumInput.max = state.pdfDoc.numPages;
        elements.pageNumInput.disabled = false;
        
        // Restore last read page
        state.pageNum = getLastRead(filename) || 1;
        if (state.pageNum > state.pdfDoc.numPages) state.pageNum = state.pdfDoc.numPages;
        
        await renderPage(state.pageNum);
        
    } catch (e) {
        console.error("Could not load PDF:", e);
        alert("无法加载文档: " + filename);
    } finally {
        elements.overlay.classList.add('hidden');
    }
}

// Local Storage for reading progress
function saveLastRead(filename, page) {
    if (!filename) return;
    const key = `pdf_progress_${filename}`;
    localStorage.setItem(key, page);
}

function getLastRead(filename) {
    const key = `pdf_progress_${filename}`;
    const val = localStorage.getItem(key);
    return val ? parseInt(val) : 1;
}

// Fetch available PDFs from server
async function fetchPDFList() {
    try {
        const res = await fetch('/api/pdfs');
        if (!res.ok) throw new Error('Network response was not ok');
        const pdfs = await res.json();
        
        elements.pdfList.innerHTML = '';
        if (pdfs.length === 0) {
            elements.pdfList.innerHTML = '<li>没有找到PDF文档</li>';
            return;
        }
        
        pdfs.forEach(pdf => {
            const li = document.createElement('li');
            li.textContent = pdf;
            li.addEventListener('click', () => {
                if(state.currentFile !== pdf) loadPDF(pdf);
            });
            elements.pdfList.appendChild(li);
        });
        
        // Auto-load first PDF
        if (pdfs.length > 0) {
            loadPDF(pdfs[0]);
        }
        
    } catch (e) {
        elements.pdfList.innerHTML = `<li style="color:red">无法获取文档列表. 请确保运行了服务器.</li>`;
        console.error(e);
    }
}

function updateButtons() {
    elements.prevBtn.disabled = state.pageNum <= 1;
    elements.nextBtn.disabled = state.pageNum >= state.pdfDoc.numPages;
}

// Event Listeners setup
function initEvents() {
    elements.prevBtn.addEventListener('click', onPrevPage);
    elements.nextBtn.addEventListener('click', onNextPage);
    elements.zoomInBtn.addEventListener('click', onZoomIn);
    elements.zoomOutBtn.addEventListener('click', onZoomOut);
    
    elements.pageNumInput.addEventListener('change', (e) => {
        let num = parseInt(e.target.value);
        if (num >= 1 && num <= state.pdfDoc.numPages) {
            state.pageNum = num;
            queueRenderPage(state.pageNum);
        } else {
            e.target.value = state.pageNum;
        }
    });
    
    // Add keyboard shortcuts
    window.addEventListener('keydown', (e) => {
        if (!state.pdfDoc) return;
        if (e.key === 'ArrowRight' || e.key === 'PageDown') {
            onNextPage();
        } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
            onPrevPage();
        }
    });

    // Simple scroll handling inside the viewer can also trigger page change
    // when hitting bottom, but we'll stick to discrete pages for now to match exactly the "exam dictation" context
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEvents();
    fetchPDFList();
});
