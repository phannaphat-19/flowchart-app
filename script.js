/* ==========================================================================
   Advanced Flowchart Studio - Main JavaScript Engine (Ultra-Large Editable Modal & Draggable Issue Cards)
   ========================================================================== */

(function () {
    'use strict';

    // --- State Management ---
    const state = {
        title: "ผังกระบวนการทำงาน & แปะการ์ดปัญหาลากวาง (Draggable Issue Cards)",
        activePageIndex: 0,
        pages: [
            {
                id: "page-1",
                name: "กระบวนการหลัก (Main Flow)",
                departments: [
                    { id: 'dept-1', name: 'แผนกขาย (Sales)', height: 160 },
                    { id: 'dept-2', name: 'แผนกจัดซื้อ (Purchasing)', height: 160 },
                    { id: 'dept-3', name: 'แผนกคลังสินค้า (Warehouse)', height: 160 },
                    { id: 'dept-4', name: 'แผนกขนส่ง (Transport)', height: 160 },
                    { id: 'dept-5', name: 'แผนกบัญชี (Accounting)', height: 160 }
                ],
                nodes: [],
                connections: []
            }
        ],
        selectedItem: null, // { type: 'node'|'connection', id: string }
        currentTool: 'select', // 'select' | 'connect' | 'pan'
        gridSnap: true,
        showGrid: true,
        zoom: 1.0,
        pan: { x: 0, y: 0 },
        isPanning: false,
        panStart: { x: 0, y: 0 },
        connecting: {
            active: false,
            fromNodeId: null,
            fromAnchor: null,
            startX: 0,
            startY: 0
        },
        undoStack: [],
        redoStack: [],
        maxHistory: 40
    };

    // --- Safe Dynamic DOM Element Access ---
    function getElem(id) {
        return document.getElementById(id);
    }

    function getCurrentPage() {
        return state.pages[state.activePageIndex] || state.pages[0];
    }

    let tempDepartments = [];
    let selectedSubNodeId = null;
    let showCanvasGrid = localStorage.getItem('flowstudio_show_grid') !== 'false';
    let isLineFlowAnimated = localStorage.getItem('flowstudio_animate_lines') !== 'false';

    function updateLineFlowDisplay() {
        const headerFlowBtn = getElem('btn-toggle-flow-header');
        const headerFlowText = getElem('flow-header-text');
        const modalFlowBtn = getElem('btn-toggle-flow-modal');
        const modalFlowText = getElem('flow-modal-text');

        const labelText = isLineFlowAnimated ? 'เส้นไหล: เปิด' : 'เส้นไหล: ปิด';

        if (headerFlowText) headerFlowText.textContent = labelText;
        if (modalFlowText) modalFlowText.textContent = labelText;

        if (headerFlowBtn) {
            headerFlowBtn.style.background = isLineFlowAnimated ? 'linear-gradient(135deg, #06b6d4, #0891b2)' : 'linear-gradient(135deg, #64748b, #475569)';
        }
        if (modalFlowBtn) {
            modalFlowBtn.style.borderColor = isLineFlowAnimated ? '#06b6d4' : '#94a3b8';
            modalFlowBtn.style.color = isLineFlowAnimated ? '#0891b2' : '#64748b';
        }

        renderCanvas();
        if (activeSubflowCurrentNode) {
            renderLargeSubFlowchartSVG(activeSubflowCurrentNode);
        }
    }

    function toggleLineFlowAnimation() {
        isLineFlowAnimated = !isLineFlowAnimated;
        localStorage.setItem('flowstudio_animate_lines', isLineFlowAnimated);
        updateLineFlowDisplay();
    }

    function updateGridDisplay() {
        const svgGrid = getElem('svg-grid');
        let gridBtn = getElem('btn-toggle-grid');
        const headerGridBtn = getElem('btn-toggle-grid-header');
        const headerGridText = getElem('grid-header-text');

        const zoomControls = document.querySelector('.zoom-controls');

        // Dynamic Injection Safeguard for Main Canvas Grid Button
        if (!gridBtn && zoomControls) {
            const divider = document.createElement('div');
            divider.style.cssText = 'width:1px; height:18px; background:#cbd5e1; margin:0 2px;';
            zoomControls.appendChild(divider);

            gridBtn = document.createElement('button');
            gridBtn.id = 'btn-toggle-grid';
            gridBtn.className = 'icon-btn-sm active';
            gridBtn.title = 'ปิด/เปิด ตารางกริดพื้นหลัง (Toggle Canvas Grid)';
            gridBtn.innerHTML = '🔲';
            gridBtn.addEventListener('click', () => {
                showCanvasGrid = !showCanvasGrid;
                localStorage.setItem('flowstudio_show_grid', showCanvasGrid);
                updateGridDisplay();
            });
            zoomControls.appendChild(gridBtn);
        }

        if (svgGrid) {
            svgGrid.style.display = showCanvasGrid ? 'block' : 'none';
        }
        if (headerGridBtn && headerGridText) {
            if (showCanvasGrid) {
                headerGridBtn.style.background = 'linear-gradient(135deg, #0ea5e9, #0284c7)';
                headerGridText.textContent = 'ตารางกริด: เปิด';
            } else {
                headerGridBtn.style.background = '#64748b';
                headerGridText.textContent = 'ตารางกริด: ปิด';
            }
        }
        if (gridBtn) {
            if (showCanvasGrid) {
                gridBtn.classList.add('active');
                gridBtn.style.color = '#0284c7';
                gridBtn.title = 'คลิกเพื่อซ่อนตารางกริดพื้นหลัง (Hide Background Grid)';
                gridBtn.textContent = '🔲';
            } else {
                gridBtn.classList.remove('active');
                gridBtn.style.color = '#94a3b8';
                gridBtn.title = 'คลิกเพื่อแสดงตารางกริดพื้นหลัง (Show Background Grid)';
                gridBtn.textContent = '◻️';
            }
        }
    }

    const AUTOSAVE_KEY = 'flowstudio_pro_autosave_data_v3';
    let autoSaveTimer = null;

    function saveAutoSaveDataNow() {
        try {
            const now = new Date();
            const data = {
                title: state.title,
                activePageIndex: state.activePageIndex,
                pages: state.pages,
                issues: state.issues || [],
                updatedAt: now.toISOString()
            };
            localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            const timeStr = `${hours}:${minutes}:${seconds}`;
            flashAutoSaveBadge(timeStr);
        } catch (e) {
            console.error('AutoSave failed:', e);
        }
    }

    function triggerAutoSave() {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            saveAutoSaveDataNow();
        }, 200);
    }

    function flashAutoSaveBadge(timeStr) {
        const badge = getElem('autosave-status-badge');
        if (badge) {
            if (timeStr) {
                badge.innerHTML = `<i class="fa-solid fa-cloud-check" style="font-size:12px; color:#10b981;"></i> ⚡ บันทึกแล้ว ${timeStr} น.`;
            }
            badge.style.transform = 'scale(1.08)';
            badge.style.background = 'rgba(16,185,129,0.3)';
            badge.style.borderColor = 'rgba(16,185,129,0.6)';
            setTimeout(() => {
                badge.style.transform = 'scale(1)';
                badge.style.background = 'rgba(16,185,129,0.12)';
                badge.style.borderColor = 'rgba(16,185,129,0.3)';
            }, 350);
        }
    }

    function loadAutoSaveData() {
        try {
            const raw = localStorage.getItem(AUTOSAVE_KEY) || localStorage.getItem('flowstudio_pro_autosave_data_v2');
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.pages) && data.pages.length > 0) {
                state.title = data.title || state.title;
                state.pages = data.pages;
                state.activePageIndex = Math.min(data.activePageIndex || 0, state.pages.length - 1);
                state.issues = data.issues || [];

                const titleElem = getElem('project-title');
                if (titleElem) titleElem.textContent = state.title;

                if (data.updatedAt) {
                    const d = new Date(data.updatedAt);
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    const seconds = String(d.getSeconds()).padStart(2, '0');
                    const timeStr = `${hours}:${minutes}:${seconds}`;
                    const badge = getElem('autosave-status-badge');
                    if (badge) {
                        badge.innerHTML = `<i class="fa-solid fa-cloud-check" style="font-size:12px; color:#10b981;"></i> ⚡ บันทึกแล้ว ${timeStr} น.`;
                    }
                }
                return true;
            }
        } catch (e) {
            console.error('Failed to load autosave data:', e);
        }
        return false;
    }

    // --- INITIALIZATION ---
    function init() {
        // Dynamic DOM Purge for Right Inspector Subflow and Modal elements
        ['btn-open-drawer', 'btn-open-inspector-subflow', 'node-link-page-group', 'modal-shared-flow-group', 'btn-modal-toggle-grid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.remove();
        });
        document.querySelectorAll('.highlight-box, div, select, label, button').forEach(el => {
            if (el.textContent && (el.textContent.includes('Shared Sub-Flow') || el.textContent.includes('แชร์ผังย่อย') || el.textContent.includes('Open Large Editable Modal') || el.textContent.includes('เปิดดู/แก้ไขผังย่อย'))) {
                el.remove();
            }
        });

        const loaded = loadAutoSaveData();
        if (!loaded) {
            createStarterNodes();
        }
        
        renderPagesTabs();
        renderCanvas();
        updateUndoRedoUI();
        updateGridDisplay();
        updateLineFlowDisplay();
        
        setupSidebarDragAndDrop();
        setupCanvasEvents();
        setupHeaderEvents();
        setupInspectorEvents();
        setupSubflowModalEvents();
        setupSubNodeCustomizerEvents();
        setupDeptModalEvents();
        setupIssueEvents();
        setupKeyboardShortcuts();
        window.addEventListener('beforeunload', saveAutoSaveDataNow);

        saveHistoryState();
    }

    function createStarterNodes() {
        const page = state.pages[0];
        page.name = "ผังกระบวนการสั่งซื้อถึงจัดส่ง (Order-to-Delivery)";

        page.deptFontSize = 13;
        page.departments = [
            { id: 'dept-sales', name: 'แผนกขาย (Sales)', height: 170, color: '#e0f2fe' },
            { id: 'dept-purchasing', name: 'แผนกจัดซื้อ (Purchasing)', height: 160, color: '#dcfce7' },
            { id: 'dept-warehouse', name: 'แผนกคลังสินค้า (Warehouse)', height: 160, color: '#fef3c7' },
            { id: 'dept-transport', name: 'แผนกขนส่ง (Transport)', height: 160, color: '#f3e8ff' },
            { id: 'dept-accounting', name: 'แผนกบัญชี (Accounting)', height: 160, color: '#ffe4e6' }
        ];

        page.nodes = [
            // --- LANE 1: แผนกขาย (Sales) ---
            {
                id: 'n1',
                type: 'startend',
                text: 'เริ่มต้น: รับออเดอร์',
                x: 80,
                y: 35,
                width: 220,
                height: 65,
                bgColor: '#22d3ee',
                borderColor: '#0891b2',
                textColor: '#0f172a',
                fontSize: 13,
                details: { desc: 'ลูกค้าสั่งซื้อผ่านช่องทางออนไลน์', owner: 'แผนกขาย (Sales)' }
            },
            {
                id: 'n2',
                type: 'process',
                text: 'ตรวจสอบสต็อกสินค้า',
                x: 340,
                y: 35,
                width: 190,
                height: 65,
                bgColor: '#38bdf8',
                borderColor: '#0284c7',
                textColor: '#0f172a',
                fontSize: 13,
                details: { desc: 'เช็คสต็อกในระบบ WMS', owner: 'แผนกขาย (Sales)' }
            },
            {
                id: 'n3',
                type: 'decision',
                text: 'สินค้าพร้อมส่ง?',
                x: 570,
                y: 30,
                width: 130,
                height: 75,
                bgColor: '#67e8f9',
                borderColor: '#0891b2',
                textColor: '#0f172a',
                fontSize: 12
            },
            {
                id: 'n4',
                type: 'process',
                text: 'ไม่มีสินค้าใน Stock',
                x: 440,
                y: 120,
                width: 170,
                height: 55,
                bgColor: '#38bdf8',
                borderColor: '#0284c7',
                textColor: '#0f172a',
                fontSize: 13,
                details: { desc: 'แจ้ง ออกใบ PR สั่งซื้อสินค้า', owner: 'แผนกขาย (Sales)' }
            },
            {
                id: 'n5',
                type: 'process',
                text: 'มีสินค้าใน Stock',
                x: 650,
                y: 120,
                width: 170,
                height: 55,
                bgColor: '#38bdf8',
                borderColor: '#0284c7',
                textColor: '#0f172a',
                fontSize: 13,
                details: { desc: 'เปิดใบสั่งขาย ส่งให้แผนกคลังเตรียมสินค้า', owner: 'แผนกขาย (Sales)' }
            },

            // --- LANE 2: แผนกจัดซื้อ (Purchasing) ---
            {
                id: 'n6',
                type: 'process',
                text: 'สั่งซื้อสินค้า',
                x: 230,
                y: 205,
                width: 170,
                height: 65,
                bgColor: '#e879f9',
                borderColor: '#c026d3',
                textColor: '#0f172a',
                fontSize: 13,
                details: { desc: 'จัดทำใบสั่งซื้อสินค้า PO', owner: 'แผนกจัดซื้อ (Purchasing)' }
            },

            // --- LANE 3: แผนกคลังสินค้า (Warehouse) ---
            {
                id: 'n7',
                type: 'process',
                text: 'รับเข้าสินค้า',
                x: 440,
                y: 360,
                width: 170,
                height: 65,
                bgColor: '#eab308',
                borderColor: '#ca8a04',
                textColor: '#0f172a',
                fontSize: 13,
                details: { desc: 'จัดเก็บสินค้าเข้าคลังที่จัดซื้อเข้ามา', owner: 'แผนกคลังสินค้า (Warehouse)' }
            },
            {
                id: 'n8',
                type: 'process',
                text: 'จัดสินค้าเตรียมส่ง',
                x: 650,
                y: 360,
                width: 170,
                height: 65,
                bgColor: '#eab308',
                borderColor: '#ca8a04',
                textColor: '#0f172a',
                fontSize: 13,
                details: { desc: 'ตัดสต็อกในระบบ', owner: 'แผนกคลังสินค้า (Warehouse)' }
            },

            // --- LANE 4: แผนกขนส่ง (Transport) ---
            {
                id: 'n9',
                type: 'process',
                text: 'วางแผนการขนส่ง',
                x: 880,
                y: 520,
                width: 180,
                height: 65,
                bgColor: '#ef4444',
                borderColor: '#dc2626',
                textColor: '#ffffff',
                fontSize: 13,
                details: { owner: 'แผนกขนส่ง (Transport)' }
            },
            {
                id: 'n10',
                type: 'startend',
                text: 'ส่งสินค้า',
                x: 1110,
                y: 520,
                width: 150,
                height: 60,
                bgColor: '#f87171',
                borderColor: '#b91c1c',
                textColor: '#ffffff',
                fontSize: 13,
                details: { owner: 'แผนกขนส่ง (Transport)' }
            },

            // --- LANE 5: แผนกบัญชี (Accounting) ---
            {
                id: 'n11',
                type: 'startend',
                text: 'บันทึกเข้าระบบบัญชี',
                x: 440,
                y: 675,
                width: 170,
                height: 65,
                bgColor: '#f97316',
                borderColor: '#ea580c',
                textColor: '#ffffff',
                fontSize: 13,
                details: { owner: 'แผนกบัญชี (Accounting)' }
            },
            {
                id: 'n12',
                type: 'process',
                text: 'ออกใบแจ้งหนี้',
                x: 650,
                y: 675,
                width: 170,
                height: 65,
                bgColor: '#fb923c',
                borderColor: '#c2410c',
                textColor: '#0f172a',
                fontSize: 13,
                details: { desc: 'บันทึกค่าใช้จ่ายในระบบ และออกบิล', owner: 'แผนกบัญชี (Accounting)' }
            }
        ];

        page.connections = [
            { id: 'c1', fromNodeId: 'n1', fromAnchor: 'right', toNodeId: 'n2', toAnchor: 'left', text: '', style: 'straight', color: '#0284c7', width: 2 },
            { id: 'c2', fromNodeId: 'n2', fromAnchor: 'right', toNodeId: 'n3', toAnchor: 'left', text: '', style: 'straight', color: '#0284c7', width: 2 },
            { id: 'c3', fromNodeId: 'n3', fromAnchor: 'bottom', toNodeId: 'n4', toAnchor: 'top', text: 'ไม่มี', style: 'orthogonal', color: '#ef4444', width: 2 },
            { id: 'c4', fromNodeId: 'n3', fromAnchor: 'bottom', toNodeId: 'n5', toAnchor: 'top', text: 'มี', style: 'orthogonal', color: '#0284c7', width: 2 },
            { id: 'c5', fromNodeId: 'n4', fromAnchor: 'left', toNodeId: 'n6', toAnchor: 'right', text: 'เอกสาร', style: 'bezier', color: '#0284c7', width: 2 },
            { id: 'c6', fromNodeId: 'n5', fromAnchor: 'bottom', toNodeId: 'n8', toAnchor: 'top', text: 'เอกสาร', style: 'orthogonal', color: '#0284c7', width: 2 },
            { id: 'c7', fromNodeId: 'n6', fromAnchor: 'bottom', toNodeId: 'n7', toAnchor: 'left', text: 'สั่งซื้อสินค้า/PO', style: 'bezier', color: '#0284c7', width: 2 },
            { id: 'c8', fromNodeId: 'n7', fromAnchor: 'right', toNodeId: 'n8', toAnchor: 'left', text: 'สินค้า', style: 'straight', color: '#0284c7', width: 2 },
            { id: 'c9', fromNodeId: 'n7', fromAnchor: 'bottom', toNodeId: 'n11', toAnchor: 'top', text: 'เอกสาร', style: 'orthogonal', color: '#0284c7', width: 2 },
            { id: 'c10', fromNodeId: 'n8', fromAnchor: 'bottom', toNodeId: 'n12', toAnchor: 'top', text: 'เอกสาร', style: 'orthogonal', color: '#0284c7', width: 2 },
            { id: 'c11', fromNodeId: 'n12', fromAnchor: 'right', toNodeId: 'n9', toAnchor: 'left', text: 'เอกสาร', style: 'bezier', color: '#0284c7', width: 2 },
            { id: 'c12', fromNodeId: 'n9', fromAnchor: 'right', toNodeId: 'n10', toAnchor: 'left', text: 'เอกสาร+สินค้า', style: 'straight', color: '#0284c7', width: 2 }
        ];
    }

    // --- UNDO / REDO ENGINE ---
    function saveHistoryState() {
        const snapshot = JSON.parse(JSON.stringify(state.pages));
        state.undoStack.push({
            title: state.title,
            activePageIndex: state.activePageIndex,
            pages: snapshot
        });

        if (state.undoStack.length > state.maxHistory) {
            state.undoStack.shift();
        }

        state.redoStack = [];
        updateUndoRedoUI();
        triggerAutoSave();
    }

    function undo() {
        if (state.undoStack.length <= 1) return;
        
        const currentState = state.undoStack.pop();
        state.redoStack.push(currentState);

        const prevState = state.undoStack[state.undoStack.length - 1];
        state.title = prevState.title;
        state.activePageIndex = Math.min(prevState.activePageIndex, prevState.pages.length - 1);
        state.pages = JSON.parse(JSON.stringify(prevState.pages));

        getElem('project-title').textContent = state.title;
        state.selectedItem = null;

        renderPagesTabs();
        renderCanvas();
        renderInspector();
        updateUndoRedoUI();
    }

    function redo() {
        if (state.redoStack.length === 0) return;

        const nextState = state.redoStack.pop();
        state.undoStack.push(nextState);

        state.title = nextState.title;
        state.activePageIndex = Math.min(nextState.activePageIndex, nextState.pages.length - 1);
        state.pages = JSON.parse(JSON.stringify(nextState.pages));

        getElem('project-title').textContent = state.title;
        state.selectedItem = null;

        renderPagesTabs();
        renderCanvas();
        renderInspector();
        updateUndoRedoUI();
    }

    function updateUndoRedoUI() {
        const btnUndo = getElem('btn-undo');
        const btnRedo = getElem('btn-redo');
        if (btnUndo) btnUndo.disabled = state.undoStack.length <= 1;
        if (btnRedo) btnRedo.disabled = state.redoStack.length === 0;
    }

    // --- MULTI-PAGE MANAGEMENT ---
    function renderPagesTabs() {
        const container = getElem('pages-tabs');
        if (!container) return;
        container.innerHTML = '';

        state.pages.forEach((page, index) => {
            const tab = document.createElement('div');
            tab.className = `page-tab ${index === state.activePageIndex ? 'active' : ''}`;
            
            const titleSpan = document.createElement('span');
            titleSpan.textContent = page.name;
            tab.appendChild(titleSpan);

            tab.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const newName = prompt("ตั้งชื่อหน้าใหม่ / Rename Page:", page.name);
                if (newName && newName.trim()) {
                    page.name = newName.trim();
                    renderPagesTabs();
                    saveHistoryState();
                }
            });

            if (state.pages.length > 1) {
                const closeBtn = document.createElement('i');
                closeBtn.className = 'fa-solid fa-xmark tab-close';
                closeBtn.title = "ลบหน้านี้ (Delete Page)";
                closeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (confirm(`คุณต้องการลบหน้า "${page.name}" ใช่หรือไม่?`)) {
                        deletePage(index);
                    }
                });
                tab.appendChild(closeBtn);
            }

            tab.addEventListener('click', () => {
                if (state.activePageIndex !== index) {
                    state.activePageIndex = index;
                    state.selectedItem = null;
                    renderPagesTabs();
                    renderCanvas();
                    renderInspector();
                }
            });

            container.appendChild(tab);
        });

        updatePageLinkOptions();
    }

    function addNewPage() {
        const pageCount = state.pages.length + 1;
        const newPage = {
            id: `page-${Date.now()}`,
            name: `กระบวนการย่อย ${pageCount} (Sub-Flow ${pageCount})`,
            deptFontSize: 13,
            departments: [
                { id: `d1-${Date.now()}`, name: 'ขั้นตอนการดำเนินงาน (Operation)', height: 200, color: '#e0f2fe' },
                { id: `d2-${Date.now()}`, name: 'ขั้นตอนสนับสนุน (Support)', height: 200, color: '#dcfce7' }
            ],
            nodes: [],
            connections: []
        };
        state.pages.push(newPage);
        state.activePageIndex = state.pages.length - 1;
        state.selectedItem = null;

        renderPagesTabs();
        renderCanvas();
        renderInspector();
        saveHistoryState();
    }

    function deletePage(index) {
        state.pages.splice(index, 1);
        if (state.activePageIndex >= state.pages.length) {
            state.activePageIndex = state.pages.length - 1;
        }
        state.selectedItem = null;
        renderPagesTabs();
        renderCanvas();
        renderInspector();
        saveHistoryState();
    }

    function updatePageLinkOptions() {
        const select = getElem('node-link-page-select');
        if (!select) return;
        select.innerHTML = '<option value="">-- ไม่ได้เชื่อมโยง (None) --</option>';
        state.pages.forEach((page, idx) => {
            const opt = document.createElement('option');
            opt.value = page.id;
            opt.textContent = `${idx + 1}. ${page.name}`;
            select.appendChild(opt);
        });
    }

    // --- ISSUE & FLAG MANAGEMENT LOGIC ---
    function setupIssueEvents() {
        const btnDashboard = getElem('btn-issue-dashboard');
        const btnCloseDashboard = getElem('btn-close-issue-dashboard');
        const btnExportCsv = getElem('btn-export-issues-csv');
        const btnAddIssue = getElem('btn-add-issue');

        if (btnDashboard) btnDashboard.addEventListener('click', openIssueDashboardModal);
        if (btnCloseDashboard) btnCloseDashboard.addEventListener('click', closeIssueDashboardModal);
        if (btnExportCsv) btnExportCsv.addEventListener('click', exportIssuesToCSV);

        if (btnAddIssue) {
            btnAddIssue.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (!node) return;
                    if (!node.details) node.details = {};
                    if (!node.details.issues) node.details.issues = [];

                    const issueTextElem = getElem('modal-issue-input');
                    const issueOwnerElem = getElem('modal-issue-owner-input');
                    const text = issueTextElem ? issueTextElem.value.trim() : '';
                    const owner = issueOwnerElem ? issueOwnerElem.value.trim() : '';
                    if (!text) {
                        alert("กรุณาระบุรายละเอียดปัญหาที่พบ");
                        return;
                    }

                    const flagRadio = document.querySelector('input[name="modal-flag"]:checked');
                    const flagValue = flagRadio ? flagRadio.value : 'red';

                    const newIssue = {
                        id: `iss-${Date.now()}`,
                        flag: flagValue,
                        text: text,
                        owner: owner
                    };

                    node.details.issues.push(newIssue);

                    // ALSO push visual Issue Card to Sub-Flowchart SVG canvas!
                    if (!node.details.subNodes) node.details.subNodes = [];
                    const issueSubNodeType = flagValue === 'red' ? 'issue-red' : flagValue === 'yellow' ? 'issue-yellow' : 'issue-green';
                    node.details.subNodes.push({
                        id: `sub-iss-${Date.now()}`,
                        type: issueSubNodeType,
                        text: text,
                        owner: owner,
                        x: 230 + Math.random() * 80,
                        y: 160 + Math.random() * 40,
                        w: 210,
                        h: 60,
                        bg: flagValue === 'red' ? '#fef2f2' : flagValue === 'yellow' ? '#fffbeb' : '#ecfdf5',
                        border: flagValue === 'red' ? '#ef4444' : flagValue === 'yellow' ? '#f59e0b' : '#10b981'
                    });

                    if (issueTextElem) issueTextElem.value = '';
                    if (issueOwnerElem) issueOwnerElem.value = '';
                    renderNodeIssueList(node);
                    renderLargeSubFlowchartSVG(node);
                    renderCanvas();
                    saveHistoryState();
                }
            });
        }

        const flagRadios = document.querySelectorAll('.flag-radio');
        flagRadios.forEach(radio => {
            radio.addEventListener('click', () => {
                flagRadios.forEach(r => r.classList.remove('active'));
                radio.classList.add('active');
                const input = radio.querySelector('input');
                if (input) input.checked = true;
            });
        });
    }

    function renderNodeIssueList(node) {
        const container = getElem('modal-issue-list');
        if (!container) return;
        container.innerHTML = '';

        if (!node.details?.issues || node.details.issues.length === 0) {
            container.innerHTML = '<p style="font-size:0.75rem; color: var(--text-muted); text-align:center; padding: 10px;">ยังไม่มีปัญหาที่แปะไว้ในกล่องนี้</p>';
            return;
        }

        node.details.issues.forEach((issue, idx) => {
            const card = document.createElement('div');
            card.className = `issue-item-card flag-${issue.flag}`;

            const flagIcon = issue.flag === 'red' ? '🚩 Red Flag' : issue.flag === 'yellow' ? '🚩 Yellow Flag' : '🟩 Green Flag';
            const ownerText = issue.owner ? `<div style="font-size:0.65rem; color:#64748b; margin-top:3px;"><i class="fa-solid fa-user"></i> ${issue.owner}</div>` : '';
            
            card.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:0.72rem; opacity:0.9;">${flagIcon}</div>
                    <div style="margin-top:2px;">${issue.text}</div>
                    ${ownerText}
                </div>
            `;

            const delBtn = document.createElement('button');
            delBtn.className = 'btn-del-issue';
            delBtn.title = 'ลบปัญหานี้';
            delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            delBtn.addEventListener('click', () => {
                node.details.issues.splice(idx, 1);
                renderNodeIssueList(node);
                renderCanvas();
                saveHistoryState();
            });

            card.appendChild(delBtn);
            container.appendChild(card);
        });
    }

    function openIssueDashboardModal() {
        const modal = getElem('issue-dashboard-modal');
        if (!modal) return;

        let redCount = 0, yellowCount = 0, greenCount = 0, totalCount = 0;
        const tbody = getElem('issue-table-body');
        if (tbody) tbody.innerHTML = '';

        let rowNum = 1;
        const seenKeys = new Set();

        state.pages.forEach(page => {
            page.nodes.forEach(node => {
                // 1. Handle Standalone Draggable Issue Cards on Main Canvas
                if (node.type === 'issue-red' || node.type === 'issue-yellow' || node.type === 'issue-green') {
                    const flagType = node.type === 'issue-red' ? 'red' : node.type === 'issue-yellow' ? 'yellow' : 'green';
                    const issueText = node.text || 'การ์ดปัญหา';
                    const issueKey = `${page.id || 'p0'}:::${flagType}:::${issueText.trim().toLowerCase()}`;
                    if (!seenKeys.has(issueKey)) {
                        seenKeys.add(issueKey);
                        totalCount++;
                        if (flagType === 'red') redCount++;
                        else if (flagType === 'yellow') yellowCount++;
                        else if (flagType === 'green') greenCount++;

                        if (tbody) {
                            const tr = document.createElement('tr');
                            const flagBadgeClass = flagType;
                            const flagBadgeText = flagType === 'red' ? '🚩 Red Flag (วิกฤต)' : flagType === 'yellow' ? '🚩 Yellow Flag (เฝ้าระวัง)' : '🟩 Green Flag (ผ่าน)';

                            tr.innerHTML = `
                                <td>${rowNum++}</td>
                                <td><span class="flag-badge-pill ${flagBadgeClass}">${flagBadgeText}</span></td>
                                <td><strong>📌 การ์ดปัญหาบนผัง</strong><br><small style="color:var(--text-muted);">${page.name} (X:${Math.round(node.x)}, Y:${Math.round(node.y)})</small></td>
                                <td>${node.details?.owner || 'ไม่ระบุ'}</td>
                                <td>${issueText.replace(/\n/g, ' ')}</td>
                            `;
                            tbody.appendChild(tr);
                        }
                    }
                }

                // 2. Handle Issues Attached to Nodes
                const issues = node.details?.issues || [];
                issues.forEach(issue => {
                    const flagType = issue.flag || 'red';
                    const issueText = issue.text || '';
                    const issueKey = `${page.id || 'p0'}:::${flagType}:::${issueText.trim().toLowerCase()}`;
                    if (!seenKeys.has(issueKey)) {
                        seenKeys.add(issueKey);
                        totalCount++;
                        if (flagType === 'red') redCount++;
                        else if (flagType === 'yellow') yellowCount++;
                        else if (flagType === 'green') greenCount++;

                        if (tbody) {
                            const tr = document.createElement('tr');
                            const flagBadgeClass = flagType === 'red' ? 'red' : flagType === 'yellow' ? 'yellow' : 'green';
                            const flagBadgeText = flagType === 'red' ? '🚩 Red Flag (วิกฤต)' : flagType === 'yellow' ? '🚩 Yellow Flag (เฝ้าระวัง)' : '🟩 Green Flag (ผ่าน)';

                            tr.innerHTML = `
                                <td>${rowNum++}</td>
                                <td><span class="flag-badge-pill ${flagBadgeClass}">${flagBadgeText}</span></td>
                                <td><strong>${node.text ? node.text.replace(/\n/g, ' ') : 'กล่องกระบวนการ'}</strong><br><small style="color:var(--text-muted);">${page.name}</small></td>
                                <td>${issue.owner || node.details?.owner || 'ไม่ระบุแผนก'}</td>
                                <td>${issueText}</td>
                            `;
                            tbody.appendChild(tr);
                        }
                    }
                });

                // 3. Handle Subflow Sub-node Issue Cards (Skip if linked/duplicate)
                const subNodes = node.details?.subNodes || [];
                subNodes.forEach(sn => {
                    if (sn.type === 'issue-red' || sn.type === 'issue-yellow' || sn.type === 'issue-green') {
                        const flagType = sn.type === 'issue-red' ? 'red' : sn.type === 'issue-yellow' ? 'yellow' : 'green';
                        const issueText = sn.text || '';
                        const issueKey = `${page.id || 'p0'}:::${flagType}:::${issueText.trim().toLowerCase()}`;
                        if (!seenKeys.has(issueKey)) {
                            seenKeys.add(issueKey);
                            totalCount++;
                            if (flagType === 'red') redCount++;
                            else if (flagType === 'yellow') yellowCount++;
                            else if (flagType === 'green') greenCount++;

                            if (tbody) {
                                const tr = document.createElement('tr');
                                const flagBadgeClass = flagType;
                                const flagBadgeText = flagType === 'red' ? '🚩 Red Flag (วิกฤต)' : flagType === 'yellow' ? '🚩 Yellow Flag (เฝ้าระวัง)' : '🟩 Green Flag (ผ่าน)';

                                tr.innerHTML = `
                                    <td>${rowNum++}</td>
                                    <td><span class="flag-badge-pill ${flagBadgeClass}">${flagBadgeText}</span></td>
                                    <td><strong>ผังย่อยของ [${node.text ? node.text.replace(/\n/g, ' ') : 'กระบวนการ'}]</strong><br><small style="color:var(--text-muted);">${page.name}</small></td>
                                    <td>${sn.owner || node.details?.owner || 'ไม่ระบุแผนก'}</td>
                                    <td>${issueText}</td>
                                `;
                                tbody.appendChild(tr);
                            }
                        }
                    }
                });
            });
        });

        if (totalCount === 0 && tbody) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--text-muted); padding: 30px;">ไม่พบรายการปัญหาที่แปะไว้ในผังงาน สามารถลาก 🚩 การ์ดปัญหาจากซ้ายไปวางบนผังได้</td></tr>';
        }

        const redElem = getElem('metric-red-count');
        const yellowElem = getElem('metric-yellow-count');
        const greenElem = getElem('metric-green-count');
        const totalElem = getElem('metric-total-count');

        if (redElem) redElem.textContent = redCount;
        if (yellowElem) yellowElem.textContent = yellowCount;
        if (greenElem) greenElem.textContent = greenCount;
        if (totalElem) totalElem.textContent = totalCount;

        modal.style.display = 'flex';
    }

    function closeIssueDashboardModal() {
        const modal = getElem('issue-dashboard-modal');
        if (modal) modal.style.display = 'none';
    }

    function exportIssuesToCSV() {
        const rows = [];
        rows.push(["#", "ระดับปัญหา (Flag)", "หน้าผังงาน", "กระบวนการ/ตำแหน่ง", "ผู้รับผิดชอบ", "รายละเอียดปัญหา"]);

        let rowNum = 1;
        const seenKeys = new Set();

        state.pages.forEach(page => {
            page.nodes.forEach(node => {
                // 1. Main Canvas Issue Cards
                if (node.type === 'issue-red' || node.type === 'issue-yellow' || node.type === 'issue-green') {
                    const flagType = node.type === 'issue-red' ? 'red' : node.type === 'issue-yellow' ? 'yellow' : 'green';
                    const issueText = node.text || 'การ์ดปัญหา';
                    const issueKey = `${page.id || 'p0'}:::${flagType}:::${issueText.trim().toLowerCase()}`;
                    if (!seenKeys.has(issueKey)) {
                        seenKeys.add(issueKey);
                        const flagName = node.type === 'issue-red' ? 'Red Flag (วิกฤต)' : node.type === 'issue-yellow' ? 'Yellow Flag (เฝ้าระวัง)' : 'Green Flag (ผ่าน)';
                        const pageName = page.name || 'กระบวนการหลัก';
                        const nodeName = `การ์ดปัญหาบนผัง (X:${Math.round(node.x)}, Y:${Math.round(node.y)})`;
                        const owner = node.details?.owner || 'ระบุผู้รับผิดชอบ';
                        rows.push([rowNum++, flagName, pageName, nodeName, owner, issueText]);
                    }
                }

                // 2. Main Node Issues List
                const issues = node.details?.issues || [];
                issues.forEach(issue => {
                    const flagType = issue.flag || 'red';
                    const issueText = issue.text || '';
                    const issueKey = `${page.id || 'p0'}:::${flagType}:::${issueText.trim().toLowerCase()}`;
                    if (!seenKeys.has(issueKey)) {
                        seenKeys.add(issueKey);
                        const flagName = flagType === 'red' ? 'Red Flag (วิกฤต)' : flagType === 'yellow' ? 'Yellow Flag (เฝ้าระวัง)' : 'Green Flag (ผ่าน)';
                        const pageName = page.name || 'กระบวนการหลัก';
                        const nodeName = (node.text || 'กระบวนการ').replace(/\n/g, ' ');
                        const owner = issue.owner || node.details?.owner || 'ระบุผู้รับผิดชอบ';
                        rows.push([rowNum++, flagName, pageName, nodeName, owner, issueText]);
                    }
                });

                // 3. Subflow Sub-node Issue Cards (Skip if linked/duplicate)
                const subNodes = node.details?.subNodes || [];
                subNodes.forEach(sn => {
                    if (sn.type === 'issue-red' || sn.type === 'issue-yellow' || sn.type === 'issue-green') {
                        const flagType = sn.type === 'issue-red' ? 'red' : sn.type === 'issue-yellow' ? 'yellow' : 'green';
                        const issueText = sn.text || '';
                        const issueKey = `${page.id || 'p0'}:::${flagType}:::${issueText.trim().toLowerCase()}`;
                        if (!seenKeys.has(issueKey)) {
                            seenKeys.add(issueKey);
                            const flagName = flagType === 'red' ? 'Red Flag (วิกฤต)' : flagType === 'yellow' ? 'Yellow Flag (เฝ้าระวัง)' : 'Green Flag (ผ่าน)';
                            const pageName = page.name || 'กระบวนการหลัก';
                            const nodeName = `ผังย่อยของ [${(node.text || 'กระบวนการ').replace(/\n/g, ' ')}]`;
                            const owner = sn.owner || node.details?.owner || 'ระบุผู้รับผิดชอบ';
                            rows.push([rowNum++, flagName, pageName, nodeName, owner, issueText]);
                        }
                    }
                });
            });
        });

        if (rows.length <= 1) {
            alert('⚠️ ไม่พบรายการปัญหาในผังสำหรับส่งออกครับ');
            return;
        }

        // Build UTF-8 CSV with BOM (\uFEFF) for Microsoft Excel compatibility
        const csvString = rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\r\n');
        const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `สรุปรายการปัญหา_${(state.title || 'ผังงาน').replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // --- CUSTOM DEPARTMENT MANAGER MODAL LOGIC ---
    function openDeptModal() {
        const page = getCurrentPage();
        if (!page.departments) page.departments = [];
        tempDepartments = JSON.parse(JSON.stringify(page.departments));
        
        const fontSizeInput = getElem('dept-fontsize-input');
        if (fontSizeInput) {
            fontSizeInput.value = page.deptFontSize || 13;
        }

        renderDeptModalList();
        const modal = getElem('dept-modal');
        if (modal) modal.style.display = 'flex';
    }

    function closeDeptModal() {
        const modal = getElem('dept-modal');
        if (modal) modal.style.display = 'none';
    }

    function renderDeptModalList() {
        const container = getElem('dept-list-container');
        if (!container) return;
        container.innerHTML = '';

        if (tempDepartments.length === 0) {
            container.innerHTML = '<p class="empty-msg">ยังไม่มีชั้นแผนก กดปุ่มด้านบนเพื่อเพิ่มแผนกแรก</p>';
            return;
        }

        tempDepartments.forEach((dept, index) => {
            const row = document.createElement('div');
            row.className = 'dept-item-row';
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.gap = '8px';
            row.style.marginBottom = '8px';

            const numSpan = document.createElement('span');
            numSpan.style.fontWeight = 'bold';
            numSpan.style.color = '#4f46e5';
            numSpan.textContent = `${index + 1}.`;
            row.appendChild(numSpan);

            // PREDEFINED COLOR PALETTE
            const paletteContainer = document.createElement('div');
            paletteContainer.style.display = 'flex';
            paletteContainer.style.alignItems = 'center';
            paletteContainer.style.gap = '4px';
            paletteContainer.style.marginRight = '8px';

            const paletteColors = [
                '#e0f2fe', // blue
                '#dcfce7', // green
                '#fef3c7', // amber
                '#f3e8ff', // purple
                '#ffe4e6', // pink
                '#ffedd5', // orange
                '#ccfbf1', // teal
                '#e2e8f0'  // gray
            ];

            const currentVal = (dept.color || '#e2e8f0').toLowerCase();

            paletteColors.forEach(col => {
                const circle = document.createElement('button');
                circle.type = 'button';
                circle.style.width = '18px';
                circle.style.height = '18px';
                circle.style.borderRadius = '50%';
                circle.style.background = col;
                circle.style.border = col.toLowerCase() === currentVal ? '2px solid #4f46e5' : '1px solid rgba(0,0,0,0.18)';
                circle.style.boxShadow = col.toLowerCase() === currentVal ? '0 0 5px rgba(79,70,229,0.5)' : 'none';
                circle.style.cursor = 'pointer';
                circle.style.padding = '0';
                circle.title = `เลือกสีนี้`;
                circle.addEventListener('click', (e) => {
                    e.preventDefault();
                    dept.color = col;
                    renderDeptModalList();
                });
                paletteContainer.appendChild(circle);
            });
            row.appendChild(paletteContainer);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = dept.name;
            input.style.flex = '1';
            input.addEventListener('input', (e) => {
                dept.name = e.target.value;
            });
            row.appendChild(input);

            if (index > 0) {
                const btnUp = document.createElement('button');
                btnUp.className = 'btn-move';
                btnUp.title = 'เลื่อนขึ้น';
                btnUp.innerHTML = '<i class="fa-solid fa-arrow-up"></i>';
                btnUp.addEventListener('click', () => {
                    const temp = tempDepartments[index];
                    tempDepartments[index] = tempDepartments[index - 1];
                    tempDepartments[index - 1] = temp;
                    renderDeptModalList();
                });
                row.appendChild(btnUp);
            }

            if (index < tempDepartments.length - 1) {
                const btnDown = document.createElement('button');
                btnDown.className = 'btn-move';
                btnDown.title = 'เลื่อนลง';
                btnDown.innerHTML = '<i class="fa-solid fa-arrow-down"></i>';
                btnDown.addEventListener('click', () => {
                    const temp = tempDepartments[index];
                    tempDepartments[index] = tempDepartments[index + 1];
                    tempDepartments[index + 1] = temp;
                    renderDeptModalList();
                });
                row.appendChild(btnDown);
            }

            const btnDel = document.createElement('button');
            btnDel.className = 'btn-del';
            btnDel.title = 'ลบแผนกนี้';
            btnDel.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
            btnDel.addEventListener('click', () => {
                tempDepartments.splice(index, 1);
                renderDeptModalList();
            });
            row.appendChild(btnDel);

            container.appendChild(row);
        });
    }

    function setupDeptModalEvents() {
        const btnManage = getElem('btn-manage-depts');
        const btnClose = getElem('btn-close-dept-modal');
        const btnSubmit = getElem('btn-submit-new-dept');
        const btnSave = getElem('btn-save-dept-modal');

        if (btnManage) btnManage.addEventListener('click', openDeptModal);
        if (btnClose) btnClose.addEventListener('click', closeDeptModal);

        if (btnSubmit) {
            btnSubmit.addEventListener('click', () => {
                const input = getElem('new-dept-name-input');
                const val = input ? input.value.trim() : '';
                if (val) {
                    tempDepartments.push({
                        id: `dept-${Date.now()}`,
                        name: val,
                        height: 160,
                        color: '#e2e8f0'
                    });
                    if (input) input.value = '';
                    renderDeptModalList();
                }
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const page = getCurrentPage();
                
                const fontSizeInput = getElem('dept-fontsize-input');
                if (fontSizeInput) {
                    page.deptFontSize = parseInt(fontSizeInput.value) || 13;
                }

                page.departments = JSON.parse(JSON.stringify(tempDepartments));
                closeDeptModal();
                renderCanvas();
                saveHistoryState();
            });
        }
    }

    // --- 3-COLUMN ULTRA-LARGE EDITABLE SUB-FLOWCHART MODAL ---
    let subflowModalStack = [];
    let subflowModalZoom = 1.0;
    let subflowPan = { x: 0, y: 0 };
    let isSubflowPanning = false;
    let subflowPanStart = { x: 0, y: 0 };
    let activeSubflowCurrentNode = null;

    function openSubflowModal(node, isPushStack = true) {
        if (!node) return;

        const modal = getElem('subflow-modal');
        if (!modal) return;

        const mainOverlay = getElem('main-presentation-overlay');
        if (mainOverlay) mainOverlay.style.display = 'none';

        if (isPushStack) {
            if (subflowModalStack.length === 0 || subflowModalStack[subflowModalStack.length - 1] !== node) {
                subflowModalStack.push(node);
                subflowPan = { x: 0, y: 0 }; // Reset pan
            }
        } else if (subflowModalStack.length === 0) {
            subflowPan = { x: 0, y: 0 };
        }

        activeSubflowCurrentNode = node;

        if (!node.details) {
            node.details = { desc: '', steps: '', owner: '', docs: '', issues: [], subNodes: [], subConns: [] };
        }

        const btnBack = getElem('btn-modal-back');
        const breadcrumbText = getElem('modal-breadcrumb-text');
        const fsBreadcrumbText = getElem('fullscreen-breadcrumb-text');
        const fsBtnBack = getElem('btn-fullscreen-back');

        if (subflowModalStack.length > 1) {
            const trail = subflowModalStack.map(n => n.text ? n.text.replace(/\n/g, ' ') : 'ขั้นตอนย่อย').join(' › ');
            if (btnBack) btnBack.style.display = 'inline-flex';
            if (breadcrumbText) breadcrumbText.textContent = `🔍 เส้นทางผังย่อย: ${trail}`;
            if (fsBreadcrumbText) fsBreadcrumbText.textContent = `${trail}`;
            if (fsBtnBack) fsBtnBack.style.display = 'inline-flex';
        } else {
            if (btnBack) btnBack.style.display = 'none';
            if (breadcrumbText) breadcrumbText.textContent = '🔍 ผังกระบวนการย่อยภายใน (ลากขยับรูปทรง & แปะป้าย RED/GREEN FLAG ปัญหาได้ทันที)';
            if (fsBreadcrumbText) fsBreadcrumbText.textContent = node.text ? node.text.replace(/\n/g, ' ') : 'ขั้นตอนย่อย';
            if (fsBtnBack) fsBtnBack.style.display = 'none';
        }

        const cleanTitle = (node.details?.subflowTitle || node.text) ? (node.details?.subflowTitle || node.text).replace(/\n/g, ' ') : 'กล่องกระบวนการ';
        const titleElem = getElem('modal-node-title');
        if (titleElem) titleElem.textContent = cleanTitle;

        renderOriginalBoxPreview(node);
        const leftText = getElem('modal-left-text');
        if (leftText) leftText.value = node.details?.subflowTitle || node.text || '';

        const descText = getElem('modal-desc');
        if (descText) descText.value = node.details.desc || '';

        renderLargeSubFlowchartSVG(node);
        renderNodeIssueList(node);

        const ownerInput = getElem('modal-owner');
        if (ownerInput) ownerInput.value = node.details.owner || '';

        const stepsText = getElem('modal-steps');
        if (stepsText) stepsText.value = node.details.steps || '';

        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.visibility = 'visible';
    }

    function popSubflowModalBack() {
        if (subflowModalStack.length > 1) {
            subflowModalStack.pop();
            const parentNode = subflowModalStack[subflowModalStack.length - 1];
            openSubflowModal(parentNode, false);
        } else {
            subflowModalStack = [];
            closeSubflowModal();
        }
    }

    function closeSubflowModal() {
        subflowModalStack = [];
        activeSubflowCurrentNode = null;
        const modal = getElem('subflow-modal');
        if (modal) modal.style.display = 'none';

        const mainOverlay = getElem('main-presentation-overlay');
        if (mainOverlay && document.fullscreenElement) {
            mainOverlay.style.display = 'flex';
        }
    }

    function renderOriginalBoxPreview(node) {
        const container = getElem('modal-left-shape-preview');
        if (!container) return;
        container.innerHTML = '';

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '240');
        svg.setAttribute('height', '75');
        svg.setAttribute('viewBox', '0 0 240 75');

        const w = 220;
        const h = 55;
        const x = 10;
        const y = 10;
        const bg = node.bgColor || '#ffffff';
        const border = node.borderColor || '#4f46e5';
        const textCol = node.textColor || '#0f172a';

        let shape;
        if (node.type === 'startend') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', x); shape.setAttribute('y', y);
            shape.setAttribute('width', w); shape.setAttribute('height', h);
            shape.setAttribute('rx', h / 2); shape.setAttribute('ry', h / 2);
        } else if (node.type === 'decision') {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            shape.setAttribute('points', `${x + w/2},${y} ${x + w},${y + h/2} ${x + w/2},${y + h} ${x},${y + h/2}`);
        } else {
            shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            shape.setAttribute('x', x); shape.setAttribute('y', y);
            shape.setAttribute('width', w); shape.setAttribute('height', h);
            shape.setAttribute('rx', 6);
        }

        shape.setAttribute('fill', bg);
        shape.setAttribute('stroke', border);
        shape.setAttribute('stroke-width', '2');
        svg.appendChild(shape);

        const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        txt.setAttribute('x', x + w / 2);
        txt.setAttribute('y', y + h / 2);
        txt.setAttribute('font-size', '12px');
        txt.setAttribute('font-weight', '600');
        txt.setAttribute('font-family', "'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif");
        txt.setAttribute('fill', textCol);
        txt.setAttribute('text-anchor', 'middle');
        txt.setAttribute('dominant-baseline', 'central');
        txt.textContent = node.text ? node.text.replace(/\n/g, ' ').substring(0, 22) : 'กล่องข้อความ';
        svg.appendChild(txt);

        container.appendChild(svg);
    }

    function renderSubNodeCustomizer(node, subNode) {
        const shapeSelect = getElem('subnode-shape-select');
        const bgColor = getElem('subnode-bg-color');
        const borderColor = getElem('subnode-border-color');
        const textInput = getElem('subnode-text-input');
        const fontSizeInput = getElem('subnode-fontsize-input');
        const connectSelect = getElem('subnode-connect-select');
        const deleteConnSelect = getElem('subnode-delete-conn-select');

        if (shapeSelect) shapeSelect.value = subNode.type || 'process';
        if (bgColor) bgColor.value = subNode.bg || '#ffffff';
        if (borderColor) borderColor.value = subNode.border || '#4f46e5';
        if (textInput) textInput.value = subNode.text || '';
        if (fontSizeInput) fontSizeInput.value = subNode.fontSize || 11;

        // Populate Connect-To Dropdown
        if (connectSelect) {
            connectSelect.innerHTML = '<option value="">-- เลือกกล่องปลายทาง --</option>';
            if (node.details && Array.isArray(node.details.subNodes)) {
                node.details.subNodes.forEach(otherSN => {
                    if (otherSN.id !== subNode.id) {
                        const opt = document.createElement('option');
                        opt.value = otherSN.id;
                        opt.textContent = `➡️ ${otherSN.text || otherSN.id}`;
                        connectSelect.appendChild(opt);
                    }
                });
            }
        }

        // Populate Delete Connection Dropdown
        if (deleteConnSelect) {
            deleteConnSelect.innerHTML = '<option value="">-- เลือกเส้นที่จะลบ --</option>';
            if (node.details && Array.isArray(node.details.subConns)) {
                node.details.subConns.forEach((c, idx) => {
                    const fromSN = node.details.subNodes.find(sn => sn.id === c.from);
                    const toSN = node.details.subNodes.find(sn => sn.id === c.to);
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = `✂️ (${fromSN ? fromSN.text : 'กล่อง'} ➔ ${toSN ? toSN.text : 'กล่อง'})`;
                    deleteConnSelect.appendChild(opt);
                });
            }
        }
    }

    function setupSubNodeCustomizerEvents() {
        const shapeSelect = getElem('subnode-shape-select');
        const bgColor = getElem('subnode-bg-color');
        const borderColor = getElem('subnode-border-color');
        const textInput = getElem('subnode-text-input');
        const connectSelect = getElem('subnode-connect-select');
        const deleteConnSelect = getElem('subnode-delete-conn-select');
        const btnDeleteThis = getElem('btn-subnode-delete-this');

        if (btnDeleteThis) {
            btnDeleteThis.addEventListener('click', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (node && node.details?.subNodes) {
                    if (selectedSubNodeId) {
                        node.details.subNodes = node.details.subNodes.filter(sn => sn.id !== selectedSubNodeId);
                        node.details.subConns = (node.details.subConns || []).filter(sc => sc.from !== selectedSubNodeId && sc.to !== selectedSubNodeId);
                        selectedSubNodeId = null;
                        renderLargeSubFlowchartSVG(node);
                    } else {
                        alert('⚠️ กรุณาคลิกเลือกกล่องย่อยที่ต้องการลบก่อนครับ');
                    }
                }
            });
        }

        if (deleteConnSelect) {
            deleteConnSelect.addEventListener('change', () => {
                const connIdxStr = deleteConnSelect.value;
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (connIdxStr !== '' && node && node.details?.subConns) {
                    const idx = parseInt(connIdxStr, 10);
                    if (!isNaN(idx) && idx >= 0 && idx < node.details.subConns.length) {
                        node.details.subConns.splice(idx, 1);
                        selectedSubConnIdx = -1;
                        deleteConnSelect.value = '';
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }

        if (connectSelect) {
            connectSelect.addEventListener('change', () => {
                const targetId = connectSelect.value;
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (targetId && node && selectedSubNodeId) {
                    if (!node.details) node.details = { desc: '', steps: '', owner: '', docs: '', issues: [], subNodes: [], subConns: [] };
                    if (!node.details.subConns) node.details.subConns = [];
                    node.details.subConns.push({ from: selectedSubNodeId, to: targetId, text: '' });
                    saveHistoryState();
                    connectSelect.value = '';
                    renderLargeSubFlowchartSVG(node);
                }
            });
        }

        if (shapeSelect) {
            shapeSelect.addEventListener('change', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (node && selectedSubNodeId && node.details?.subNodes) {
                    const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                    if (sn) {
                        sn.type = shapeSelect.value;
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }

        if (bgColor) {
            bgColor.addEventListener('input', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (node && selectedSubNodeId && node.details?.subNodes) {
                    const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                    if (sn) {
                        sn.bg = bgColor.value;
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }

        if (borderColor) {
            borderColor.addEventListener('input', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (node && selectedSubNodeId && node.details?.subNodes) {
                    const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                    if (sn) {
                        sn.border = borderColor.value;
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }

        if (textInput) {
            textInput.addEventListener('input', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (node && selectedSubNodeId && node.details?.subNodes) {
                    const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                    if (sn) {
                        sn.text = textInput.value;
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }

        const fontSizeInput = getElem('subnode-fontsize-input');
        if (fontSizeInput) {
            fontSizeInput.addEventListener('input', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (node && selectedSubNodeId && node.details?.subNodes) {
                    const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                    if (sn) {
                        sn.fontSize = Math.max(8, Math.min(36, parseInt(fontSizeInput.value) || 11));
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }
    }

    let subConnectMode = false;   // true = รอคลิกจากกล่อง → กล่อง
    let subConnFromId = null;      // id ของกล่องต้นทาง
    let subConnFromAnchor = null;  // anchor ทิศทางกล่องต้นทาง (top, right, bottom, left)
    let selectedSubConnIdx = -1;   // index ของเส้นที่เลือกอยู่

    function calculateSubPathD(fromSN, toSN, connIndexInPair = 0, totalConnsInPair = 1, customFromAnchor = null, customToAnchor = null) {
        const fw = fromSN.w || 130;
        const fh = fromSN.h || 50;
        const tw = toSN.w || 130;
        const th = toSN.h || 50;

        const anchorPosMap = (sn, w, h) => ({
            top: { x: sn.x + w / 2, y: sn.y },
            right: { x: sn.x + w, y: sn.y + h / 2 },
            bottom: { x: sn.x + w / 2, y: sn.y + h },
            left: { x: sn.x, y: sn.y + h / 2 }
        });

        const fromAnchors = anchorPosMap(fromSN, fw, fh);
        const toAnchors = anchorPosMap(toSN, tw, th);

        const dx = (toSN.x + tw / 2) - (fromSN.x + fw / 2);
        const dy = (toSN.y + th / 2) - (fromSN.y + fh / 2);

        let fromAnchor = customFromAnchor;
        let toAnchor = customToAnchor;

        if (!fromAnchor) {
            fromAnchor = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'bottom' : 'top');
        }
        if (!toAnchor) {
            toAnchor = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'left' : 'right') : (dy > 0 ? 'top' : 'bottom');
        }

        const step = 40;
        const offsetPx = (connIndexInPair - (totalConnsInPair - 1) / 2) * step;

        let startPt = { ...fromAnchors[fromAnchor] };
        let endPt = { ...toAnchors[toAnchor] };

        if (fromAnchor === 'top' || fromAnchor === 'bottom') startPt.x += offsetPx;
        else startPt.y += offsetPx;

        if (toAnchor === 'top' || toAnchor === 'bottom') endPt.x += offsetPx;
        else endPt.y += offsetPx;

        const dPath = generateSmartOrthogonalPath(startPt, endPt, fromAnchor, toAnchor);
        return { d: dPath, startPt, endPt };
    }

    function renderLargeSubFlowchartSVG(node) {
        const svg = getElem('large-subflow-svg');
        if (!svg) return;
        svg.innerHTML = '';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.removeAttribute('width');
        svg.removeAttribute('height');
        svg.removeAttribute('viewBox');

        const zoomText = getElem('subflow-zoom-text');
        if (zoomText) zoomText.textContent = `${Math.round(subflowModalZoom * 100)}%`;

        if (node.details.subNodes === null || node.details.subNodes === undefined || !Array.isArray(node.details.subNodes)) {
            const rawSteps = node.details?.steps ? node.details.steps.split('\n').filter(s => s.trim()) : [];
            node.details.subNodes = [
                { id: 'sub-1', type: 'startend', text: 'เริ่มขั้นตอนย่อย', x: 30, y: 50, w: 140, h: 50, bg: '#ecfeff', border: '#06b6d4' },
                { id: 'sub-2', type: 'process', text: rawSteps[0] ? rawSteps[0].replace(/^\d+\.\s*/, '') : 'เบิกสินค้าจากชั้นวางตามใบแพ็ค', x: 210, y: 48, w: 180, h: 54, bg: '#eef2ff', border: '#4f46e5' },
                { id: 'sub-3', type: 'decision', text: 'ตรวจสอบ OK?', x: 430, y: 40, w: 140, h: 70, bg: '#fffbeb', border: '#f59e0b' },
                { id: 'sub-4', type: 'startend', text: 'เสร็จสิ้นสมบูรณ์', x: 430, y: 180, w: 140, h: 50, bg: '#ecfdf5', border: '#10b981' }
            ];
            node.details.subConns = [
                { from: 'sub-1', to: 'sub-2', text: '' },
                { from: 'sub-2', to: 'sub-3', text: '' },
                { from: 'sub-3', to: 'sub-4', text: 'ผ่าน (Yes)' },
                { from: 'sub-3', to: 'sub-2', text: 'ไม่ผ่าน: แก้ไขใหม่', isLoopback: true }
            ];
        }

        // Inner group that holds all content and applies pan & zoom transform (matches main canvas architecture)
        const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        contentGroup.setAttribute('id', 'subflow-content-group');
        contentGroup.setAttribute('transform', `translate(${subflowPan.x}, ${subflowPan.y}) scale(${subflowModalZoom})`);

        // Marker Defs
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'large-sub-arrow');
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '8'); marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '7'); marker.setAttribute('markerHeight', '7');
        marker.setAttribute('orient', 'auto-start-reverse');
        const mPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        mPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
        mPath.setAttribute('fill', '#4f46e5');
        marker.appendChild(mPath);
        if (showCanvasGrid) {
            const gridPattern = document.createElementNS('http://www.w3.org/2000/svg', 'pattern');
            gridPattern.setAttribute('id', 'subflow-grid-pattern');
            gridPattern.setAttribute('width', '20');
            gridPattern.setAttribute('height', '20');
            gridPattern.setAttribute('patternUnits', 'userSpaceOnUse');

            const gridDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            gridDot.setAttribute('cx', '2');
            gridDot.setAttribute('cy', '2');
            gridDot.setAttribute('r', '1.2');
            gridDot.setAttribute('class', 'grid-dot');
            gridPattern.appendChild(gridDot);
            defs.appendChild(gridPattern);
        }

        defs.appendChild(marker);
        svg.appendChild(defs);

        if (showCanvasGrid) {
            const gridRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            gridRect.setAttribute('x', '-50000');
            gridRect.setAttribute('y', '-50000');
            gridRect.setAttribute('width', '100000');
            gridRect.setAttribute('height', '100000');
            gridRect.setAttribute('fill', 'url(#subflow-grid-pattern)');
            contentGroup.appendChild(gridRect);
        }

        // Count parallel connections between pairs for offset calculation
        const subConnsList = node.details.subConns || [];
        const pairCounts = {};
        const pairIndexes = {};

        subConnsList.forEach(c => {
            if (c.isLoopback) return;
            const pairKey = [c.from, c.to].sort().join('::');
            pairCounts[pairKey] = (pairCounts[pairKey] || 0) + 1;
        });

        // Render Connections
        subConnsList.forEach((conn, connIdx) => {
            const fromSN = node.details.subNodes.find(sn => sn.id === conn.from);
            const toSN = node.details.subNodes.find(sn => sn.id === conn.to);
            if (!fromSN || !toSN) return;

            const isConnSel = selectedSubConnIdx === connIdx;

            const fw = fromSN.w || 130;
            const fh = fromSN.h || 50;
            const tw = toSN.w || 130;
            const th = toSN.h || 50;

            if (conn.isLoopback) {
                const pathNo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathNo.setAttribute('d', `M ${fromSN.x + fw/2},${fromSN.y + fh} L ${fromSN.x + fw/2},${fromSN.y + fh + 40} L ${toSN.x + tw/2},${fromSN.y + fh + 40} L ${toSN.x + tw/2},${toSN.y + th}`);
                pathNo.setAttribute('fill', 'none');
                pathNo.setAttribute('stroke', isConnSel ? '#06b6d4' : '#ef4444');
                pathNo.setAttribute('stroke-width', isConnSel ? '3.5' : '2');
                pathNo.setAttribute('stroke-dasharray', '5,4');
                pathNo.setAttribute('marker-end', 'url(#large-sub-arrow)');
                pathNo.style.cursor = 'pointer';
                pathNo.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedSubConnIdx = connIdx;
                    selectedSubNodeId = null;
                    renderLargeSubFlowchartSVG(node);
                });
                contentGroup.appendChild(pathNo);

                if (conn.text) {
                    const txtNo = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    txtNo.setAttribute('x', (fromSN.x + toSN.x) / 2); txtNo.setAttribute('y', fromSN.y + fh + 24);
                    txtNo.setAttribute('font-size', '11px'); txtNo.setAttribute('fill', '#ef4444'); txtNo.setAttribute('font-weight', 'bold');
                    txtNo.textContent = conn.text;
                    contentGroup.appendChild(txtNo);
                }
            } else {
                const pairKey = [conn.from, conn.to].sort().join('::');
                const totalInPair = pairCounts[pairKey] || 1;
                const idxInPair = pairIndexes[pairKey] || 0;
                pairIndexes[pairKey] = idxInPair + 1;

                const route = calculateSubPathD(fromSN, toSN, idxInPair, totalInPair, conn.fromAnchor, conn.toAnchor);

                // Thick invisible hit-box path for easy clicking/selecting
                const hitPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                hitPath.setAttribute('d', route.d);
                hitPath.setAttribute('fill', 'none');
                hitPath.setAttribute('stroke', 'transparent');
                hitPath.setAttribute('stroke-width', '24');
                hitPath.style.cursor = 'pointer';
                hitPath.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedSubConnIdx = connIdx;
                    selectedSubNodeId = null;
                    renderLargeSubFlowchartSVG(node);
                });
                contentGroup.appendChild(hitPath);

                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', route.d);
                path.setAttribute('fill', 'none');
                path.setAttribute('class', `subflow-conn-path ${isLineFlowAnimated ? 'flowing-line' : ''}`);
                path.setAttribute('stroke', isConnSel ? '#06b6d4' : '#4f46e5');
                path.setAttribute('stroke-width', isConnSel ? '3.5' : '2.2');
                path.setAttribute('marker-end', 'url(#large-sub-arrow)');
                path.style.cursor = 'pointer';
                path.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedSubConnIdx = connIdx;
                    selectedSubNodeId = null;
                    renderLargeSubFlowchartSVG(node);
                });
                contentGroup.appendChild(path);

                if (conn.text) {
                    let ratio = 0.5;
                    if (totalInPair > 1) {
                        if (idxInPair === 0) ratio = 0.32;
                        else if (idxInPair === 1) ratio = 0.68;
                        else if (idxInPair === 2) ratio = 0.50;
                        else ratio = 0.25 + ((idxInPair * 0.2) % 0.6);
                    }
                    const textX = route.startPt.x + (route.endPt.x - route.startPt.x) * ratio;
                    const textY = route.startPt.y + (route.endPt.y - route.startPt.y) * ratio;

                    const txtYes = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    txtYes.setAttribute('x', textX);
                    txtYes.setAttribute('y', textY);
                    txtYes.setAttribute('font-size', '11px');
                    txtYes.setAttribute('fill', '#10b981');
                    txtYes.setAttribute('font-weight', 'bold');
                    txtYes.setAttribute('text-anchor', 'middle');
                    txtYes.textContent = conn.text;
                    contentGroup.appendChild(txtYes);
                }
            }
        });

        // Render Sub-Nodes (Draggable & Editable)
        (node.details.subNodes || []).forEach(sn => {
            const isSel = selectedSubNodeId === sn.id;
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', `sub-node-elem ${isSel ? 'selected' : ''}`);
            g.setAttribute('transform', `translate(${sn.x}, ${sn.y})`);

            let shape;
            if (sn.type === 'issue-red' || sn.type === 'issue-yellow' || sn.type === 'issue-green') {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                
                const cardBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                cardBg.setAttribute('width', sn.w || 180);
                cardBg.setAttribute('height', sn.h || 60);
                cardBg.setAttribute('rx', 6);
                cardBg.setAttribute('fill', sn.type === 'issue-red' ? '#fef2f2' : sn.type === 'issue-yellow' ? '#fffbeb' : '#ecfdf5');
                cardBg.setAttribute('stroke', isSel ? '#4f46e5' : (sn.type === 'issue-red' ? '#ef4444' : sn.type === 'issue-yellow' ? '#f59e0b' : '#10b981'));
                cardBg.setAttribute('stroke-width', isSel ? '3' : '2');
                shape.appendChild(cardBg);

                const flagPill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                flagPill.setAttribute('x', 0);
                flagPill.setAttribute('y', 0);
                flagPill.setAttribute('width', sn.w || 180);
                flagPill.setAttribute('height', 20);
                flagPill.setAttribute('rx', 6);
                flagPill.setAttribute('fill', sn.type === 'issue-red' ? '#ef4444' : sn.type === 'issue-yellow' ? '#f59e0b' : '#10b981');
                shape.appendChild(flagPill);

                const flagTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                flagTitle.setAttribute('x', (sn.w || 180) / 2);
                flagTitle.setAttribute('y', 10);
                flagTitle.setAttribute('fill', '#ffffff');
                flagTitle.setAttribute('font-size', '10px');
                flagTitle.setAttribute('font-weight', 'bold');
                flagTitle.setAttribute('font-family', "'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif");
                flagTitle.setAttribute('text-anchor', 'middle');
                flagTitle.setAttribute('dominant-baseline', 'central');
                flagTitle.textContent = sn.type === 'issue-red' ? '🚩 RED FLAG ISSUE' : sn.type === 'issue-yellow' ? '🚩 YELLOW FLAG' : '🟩 GREEN FLAG';
                shape.appendChild(flagTitle);
            } else if (sn.type === 'startend') {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shape.setAttribute('width', sn.w); shape.setAttribute('height', sn.h);
                shape.setAttribute('rx', sn.h / 2); shape.setAttribute('ry', sn.h / 2);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.borderColor || sn.border || '#0284c7'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            } else if (sn.type === 'decision') {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', `${sn.w/2},0 ${sn.w},${sn.h/2} ${sn.w/2},${sn.h} 0,${sn.h/2}`);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.borderColor || sn.border || '#0284c7'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            } else if (sn.type === 'inputoutput') {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const off = sn.w * 0.15;
                shape.setAttribute('points', `${off},0 ${sn.w},0 ${sn.w - off},${sn.h} 0,${sn.h}`);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.borderColor || sn.border || '#0284c7'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            } else if (sn.type === 'document') {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const wH = sn.h * 0.85;
                shape.setAttribute('d', `M 0,0 L ${sn.w},0 L ${sn.w},${wH} Q ${sn.w * 0.75},${sn.h * 1.1} ${sn.w * 0.5},${wH} T 0,${wH} Z`);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.borderColor || sn.border || '#0284c7'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            } else {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shape.setAttribute('width', sn.w); shape.setAttribute('height', sn.h);
                shape.setAttribute('rx', 6);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.borderColor || sn.border || '#0284c7'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            }

            g.appendChild(shape);

            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const txtY = sn.type.startsWith('issue-') ? 38 : sn.h / 2;
            txt.setAttribute('x', sn.w / 2);
            txt.setAttribute('y', txtY);
            txt.setAttribute('font-size', `${sn.fontSize || 11}px`);
            txt.setAttribute('font-weight', '600');
            txt.setAttribute('font-family', "'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif");
            txt.setAttribute('fill', sn.type === 'issue-red' ? '#dc2626' : sn.type === 'issue-yellow' ? '#b45309' : sn.type === 'issue-green' ? '#047857' : '#0f172a');
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'central');
            txt.textContent = sn.text || 'ขั้นตอนย่อย';
            g.appendChild(txt);

            // Highlight if this node is selected as connection source inside subflow modal
            const isSubFirstConnect = subConnFromId === sn.id;
            if (isSubFirstConnect) {
                if (shape.tagName === 'rect' || shape.tagName === 'polygon' || shape.tagName === 'path') {
                    shape.setAttribute('stroke', '#0284c7');
                    shape.setAttribute('stroke-width', '3.5');
                    shape.setAttribute('stroke-dasharray', '4,3');
                } else if (shape.tagName === 'g') {
                    const bgRect = shape.querySelector('rect');
                    if (bgRect) {
                        bgRect.setAttribute('stroke', '#0284c7');
                        bgRect.setAttribute('stroke-width', '3.5');
                        bgRect.setAttribute('stroke-dasharray', '4,3');
                    }
                }
            }

            // Render Anchor Ports for connecting inside subflow modal
            const snW = sn.w || 130;
            const snH = sn.h || 50;
            const anchorCoords = [
                { x: snW / 2, y: 0, pos: 'top' },
                { x: snW, y: snH / 2, pos: 'right' },
                { x: snW / 2, y: snH, pos: 'bottom' },
                { x: 0, y: snH / 2, pos: 'left' }
            ];

            anchorCoords.forEach(pt => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('class', 'subnode-anchor');
                circle.setAttribute('cx', pt.x);
                circle.setAttribute('cy', pt.y);
                circle.setAttribute('r', '8');
                circle.setAttribute('fill', '#ffffff');
                circle.setAttribute('stroke', '#0284c7');
                circle.setAttribute('stroke-width', '2.5');
                circle.style.cursor = 'crosshair';
                circle.style.transition = 'all 0.15s ease';
                circle.setAttribute('title', `คลิกจุดนี้เพื่อเชื่อมสายจากฝั่ง ${pt.pos}`);

                circle.addEventListener('mouseenter', () => {
                    circle.setAttribute('r', '11');
                    circle.setAttribute('fill', '#0ea5e9');
                    circle.setAttribute('stroke', '#ffffff');
                });
                circle.addEventListener('mouseleave', () => {
                    circle.setAttribute('r', '8');
                    circle.setAttribute('fill', '#ffffff');
                    circle.setAttribute('stroke', '#0284c7');
                });

                circle.addEventListener('mousedown', (anchorEvt) => {
                    anchorEvt.stopPropagation();
                    if (!subConnFromId) {
                        subConnFromId = sn.id;
                        subConnFromAnchor = pt.pos;
                        subConnectMode = true;
                        const btnConnect = getElem('btn-connect-subnode');
                        if (btnConnect) {
                            btnConnect.style.background = '#0284c7';
                            btnConnect.style.color = '#ffffff';
                        }
                        renderLargeSubFlowchartSVG(node);
                    } else if (subConnFromId !== sn.id) {
                        if (!node.details.subConns) node.details.subConns = [];
                        node.details.subConns.push({
                            from: subConnFromId,
                            fromAnchor: subConnFromAnchor || 'right',
                            to: sn.id,
                            toAnchor: pt.pos || 'left',
                            text: ''
                        });
                        subConnFromId = null;
                        subConnFromAnchor = null;
                        subConnectMode = false;
                        const btnConnect = getElem('btn-connect-subnode');
                        if (btnConnect) {
                            btnConnect.style.background = '';
                            btnConnect.style.color = '#0284c7';
                        }
                        renderLargeSubFlowchartSVG(node);
                    }
                });

                g.appendChild(circle);
            });

            // Render Corner Resize Handle if Selected
            if (isSel) {
                const wInput = getElem('subnode-width-input');
                const hInput = getElem('subnode-height-input');
                if (wInput) wInput.value = Math.round(sn.w || 130);
                if (hInput) hInput.value = Math.round(sn.h || 50);

                const resizeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                resizeHandle.setAttribute('transform', `translate(${sn.w || 130}, ${sn.h || 50})`);
                resizeHandle.style.cursor = 'nwse-resize';
                
                const handleCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                handleCircle.setAttribute('r', '8');
                handleCircle.setAttribute('fill', '#4f46e5');
                handleCircle.setAttribute('stroke', '#ffffff');
                handleCircle.setAttribute('stroke-width', '2');
                handleCircle.setAttribute('title', 'ลากจุดนี้เพื่อปรับขนาดกล่อง (Drag to Resize Node)');

                const handleIcon = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                handleIcon.setAttribute('d', 'M -2,2 L 2,2 L 2,-2 M -4,4 L 4,-4');
                handleIcon.setAttribute('stroke', '#ffffff');
                handleIcon.setAttribute('stroke-width', '1.5');
                handleIcon.setAttribute('fill', 'none');

                resizeHandle.appendChild(handleCircle);
                resizeHandle.appendChild(handleIcon);

                resizeHandle.addEventListener('mousedown', (resizeEvt) => {
                    resizeEvt.stopPropagation();
                    let isResizing = true;
                    const startX = resizeEvt.clientX;
                    const startY = resizeEvt.clientY;
                    const origW = sn.w || 130;
                    const origH = sn.h || 50;

                    const onResizeMove = (moveEvt) => {
                        if (!isResizing) return;
                        const dw = moveEvt.clientX - startX;
                        const dh = moveEvt.clientY - startY;

                        let newW = origW + dw / subflowModalZoom;
                        let newH = origH + dh / subflowModalZoom;

                        if (state.gridSnap) {
                            newW = Math.round(newW / 20) * 20;
                            newH = Math.round(newH / 20) * 20;
                        } else {
                            newW = Math.round(newW);
                            newH = Math.round(newH);
                        }

                        sn.w = Math.max(80, newW);
                        sn.h = Math.max(40, newH);
                        renderLargeSubFlowchartSVG(node);
                    };

                    const onResizeUp = () => {
                        if (isResizing) {
                            isResizing = false;
                            window.removeEventListener('mousemove', onResizeMove);
                            window.removeEventListener('mouseup', onResizeUp);
                            saveHistoryState();
                        }
                    };

                    window.addEventListener('mousemove', onResizeMove);
                    window.addEventListener('mouseup', onResizeUp);
                });

                g.appendChild(resizeHandle);
            }

            // Sub-Node Mouse Dragging Engine & Selection & Double-Click Nested Flow
            g.addEventListener('mousedown', (e) => {
                e.stopPropagation();

                // If in Connect Mode
                if (subConnectMode) {
                    if (!subConnFromId) {
                        subConnFromId = sn.id;
                        selectedSubConnIdx = -1;
                        renderLargeSubFlowchartSVG(node);
                    } else if (subConnFromId !== sn.id) {
                        if (!node.details.subConns) node.details.subConns = [];
                        node.details.subConns.push({ from: subConnFromId, to: sn.id, text: '' });
                        subConnFromId = null;
                        subConnectMode = false;
                        const btnConnect = getElem('btn-connect-subnode');
                        if (btnConnect) {
                            btnConnect.style.background = '';
                            btnConnect.style.color = '#0284c7';
                        }
                        renderLargeSubFlowchartSVG(node);
                    }
                    return;
                }

                selectedSubNodeId = sn.id;
                selectedSubConnIdx = -1;
                renderSubNodeCustomizer(node, sn);

                let isSubDragging = true;
                const startClientX = e.clientX;
                const startClientY = e.clientY;
                const origX = sn.x;
                const origY = sn.y;
                
                const onSubMouseMove = (moveEvent) => {
                    if (!isSubDragging) return;
                    
                    const dx = (moveEvent.clientX - startClientX) / subflowModalZoom;
                    const dy = (moveEvent.clientY - startClientY) / subflowModalZoom;

                    let newX = origX + dx;
                    let newY = origY + dy;

                    if (state.gridSnap) {
                        const gridSize = 20;
                        const w = sn.w || 130;
                        const h = sn.h || 50;
                        const centerX = newX + w / 2;
                        const centerY = newY + h / 2;
                        newX = Math.round(centerX / gridSize) * gridSize - w / 2;
                        newY = Math.round(centerY / gridSize) * gridSize - h / 2;
                    }

                    sn.x = newX;
                    sn.y = newY;
                    
                    g.setAttribute('transform', `translate(${sn.x}, ${sn.y})`);
                };

                const onSubMouseUp = () => {
                    if (isSubDragging) {
                        isSubDragging = false;
                        window.removeEventListener('mousemove', onSubMouseMove);
                        window.removeEventListener('mouseup', onSubMouseUp);
                        renderLargeSubFlowchartSVG(node);
                    }
                };

                window.addEventListener('mousemove', onSubMouseMove);
                window.addEventListener('mouseup', onSubMouseUp);
            });

            // DOUBLE CLICK ON SUB-NODE TO DRILL DOWN INTO INFINITE POP-UP SUB-FLOWCHART!
            g.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                if (sn.type.startsWith('issue-')) return;
                if (!sn.details) sn.details = { desc: '', steps: '', owner: '', docs: '', issues: [], subNodes: null, subConns: null };
                openSubflowModal(sn, true);
            });

            contentGroup.appendChild(g);
        });

        svg.appendChild(contentGroup);
    }

    function drillDownSubNodeToNestedFlow(parentNode, subNode) {
        if (!subNode || subNode.type.startsWith('issue-')) return;
        openSubflowModal(subNode, true);
    }

    function addSubNodeShape(shapeType) {
        const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
        if (!node) return;
        if (!node.details) node.details = { desc: '', steps: '', owner: '', docs: '', issues: [], subNodes: [], subConns: [] };
        if (!node.details.subNodes) node.details.subNodes = [];

        const newId = `sub-${Date.now()}`;
        const count = node.details.subNodes.length + 1;
        const defaultText = shapeType === 'startend' ? 'เริ่มต้น / สิ้นสุด' :
                            shapeType === 'process' ? `ขั้นตอนย่อยที่ ${count}` :
                            shapeType === 'decision' ? 'เงื่อนไขตรวจสอบ?' :
                            shapeType === 'inputoutput' ? 'รับ/แสดงข้อมูล' :
                            shapeType === 'document' ? 'เอกสารอ้างอิง' :
                            shapeType === 'connector' ? 'A1' :
                            shapeType === 'issue-red' ? '🚩 ระบุปัญหา Red Flag' :
                            shapeType === 'issue-yellow' ? '🟡 เฝ้าระวัง Yellow Flag' :
                            '🟩 ผ่าน Green Flag';

        const bgCol = shapeType === 'issue-red' ? '#fef2f2' : shapeType === 'issue-yellow' ? '#fffbeb' : shapeType === 'issue-green' ? '#ecfdf5' : '#ffffff';
        const borderCol = shapeType === 'issue-red' ? '#ef4444' : shapeType === 'issue-yellow' ? '#f59e0b' : shapeType === 'issue-green' ? '#10b981' : (shapeType === 'decision' ? '#f59e0b' : '#0284c7');

        const newSubNode = {
            id: newId,
            type: shapeType,
            text: defaultText,
            x: 80 + (node.details.subNodes.length % 5) * 40,
            y: 80 + Math.floor(node.details.subNodes.length / 5) * 30,
            w: shapeType === 'connector' ? 45 : (shapeType.startsWith('issue-') ? 180 : 130),
            h: shapeType === 'connector' ? 45 : (shapeType === 'decision' ? 55 : 50),
            bg: bgCol,
            borderColor: borderCol
        };

        node.details.subNodes.push(newSubNode);
        selectedSubNodeId = newId;
        renderLargeSubFlowchartSVG(node);
        saveHistoryState();
    }

    function setupSubflowModalEvents() {
        const btnOpenDrawer = getElem('btn-open-drawer');
        const btnClose = getElem('btn-close-subflow-modal');
        const modalLeftText = getElem('modal-left-text');
        const btnAddProc = getElem('btn-add-subnode-process');
        const btnAddDec = getElem('btn-add-subnode-decision');
        const btnAddIssueRed = getElem('btn-add-subnode-issue-red');
        const btnConnectSub = getElem('btn-connect-subnode');
        const btnDelConn = getElem('btn-del-subconn');
        const btnDelSub = getElem('btn-del-subnode');
        const btnSave = getElem('btn-save-subflow-modal');
        const btnJumpPage = getElem('btn-modal-jump-page');
        const btnFullscreen = getElem('btn-modal-fullscreen');

        const modalSharedSelect = getElem('modal-shared-flow-select');
        if (modalSharedSelect) {
            modalSharedSelect.addEventListener('change', () => {
                const node = subflowModalStack[0];
                if (node) {
                    node.linkTargetNodeId = modalSharedSelect.value;
                    openSubflowModal(node, false);
                    renderCanvas();
                    saveHistoryState();
                }
            });
        }

        const btnBack = getElem('btn-modal-back');
        if (btnBack) btnBack.addEventListener('click', popSubflowModalBack);

        const btnFsBack = getElem('btn-fullscreen-back');
        if (btnFsBack) btnFsBack.addEventListener('click', (e) => {
            e.stopPropagation();
            popSubflowModalBack();
        });

        document.querySelectorAll('.btn-add-shape').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const shapeType = btn.getAttribute('data-shape');
                if (shapeType) addSubNodeShape(shapeType);
            };
        });

        const subflowAddShapeSelect = getElem('subflow-add-shape-select');
        if (subflowAddShapeSelect) {
            subflowAddShapeSelect.onchange = () => {
                const shapeType = subflowAddShapeSelect.value;
                if (shapeType) {
                    addSubNodeShape(shapeType);
                    subflowAddShapeSelect.value = '';
                }
            };
        }

        if (btnDelSub) {
            btnDelSub.onclick = (e) => {
                e.stopPropagation();
                deleteSelectedSubItem();
            };
        }

        if (btnDelConn) {
            btnDelConn.onclick = (e) => {
                e.stopPropagation();
                deleteSelectedSubConnItem();
            };
        }

        const btnToggleFlowModal = getElem('btn-toggle-flow-modal');
        if (btnToggleFlowModal) {
            btnToggleFlowModal.addEventListener('click', toggleLineFlowAnimation);
        }

        document.querySelectorAll('.subflow-swatch-btn').forEach(btn => {
            btn.onclick = (e) => {
                e.stopPropagation();
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (!node || !selectedSubNodeId) {
                    alert('⚠️ กรุณาคลิกเลือกกล่องย่อยในผังก่อนคลิกเปลี่ยนสีครับ');
                    return;
                }
                const subNode = node.details?.subNodes?.find(s => s.id === selectedSubNodeId);
                if (subNode) {
                    subNode.bg = btn.getAttribute('data-bg');
                    subNode.borderColor = btn.getAttribute('data-border');
                    renderLargeSubFlowchartSVG(node);
                    saveHistoryState();
                }
            };
        });

        const widthInput = getElem('subnode-width-input');
        const heightInput = getElem('subnode-height-input');
        if (widthInput) {
            widthInput.addEventListener('input', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (!node || !selectedSubNodeId) return;
                const subNode = node.details?.subNodes?.find(s => s.id === selectedSubNodeId);
                if (subNode) {
                    subNode.w = Math.max(60, parseInt(widthInput.value) || 130);
                    renderLargeSubFlowchartSVG(node);
                }
            });
            widthInput.addEventListener('change', () => saveHistoryState());
        }
        if (heightInput) {
            heightInput.addEventListener('input', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (!node || !selectedSubNodeId) return;
                const subNode = node.details?.subNodes?.find(s => s.id === selectedSubNodeId);
                if (subNode) {
                    subNode.h = Math.max(35, parseInt(heightInput.value) || 50);
                    renderLargeSubFlowchartSVG(node);
                }
            });
            heightInput.addEventListener('change', () => saveHistoryState());
        }

        if (btnConnectSub) {
            btnConnectSub.addEventListener('click', () => {
                const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                subConnectMode = !subConnectMode;
                subConnFromId = null;
                if (subConnectMode) {
                    btnConnectSub.style.background = '#0284c7';
                    btnConnectSub.style.color = '#ffffff';
                } else {
                    btnConnectSub.style.background = '';
                    btnConnectSub.style.color = '#0284c7';
                }
                if (node) renderLargeSubFlowchartSVG(node);
            });
        }

        const btnZoomIn = getElem('btn-subflow-zoom-in');
        const btnZoomOut = getElem('btn-subflow-zoom-out');
        const btnZoomReset = getElem('btn-subflow-zoom-reset');
        const btnModalToggleGrid = getElem('btn-modal-toggle-grid');
        const largeSvg = getElem('large-subflow-svg');

        if (btnModalToggleGrid) {
            btnModalToggleGrid.addEventListener('click', () => {
                showCanvasGrid = !showCanvasGrid;
                localStorage.setItem('flowstudio_show_grid', showCanvasGrid);
                updateGridDisplay();
            });
        }

        function updateSubflowZoomUI() {
            const zoomTxt = getElem('subflow-zoom-text');
            if (zoomTxt) zoomTxt.textContent = `${Math.round(subflowModalZoom * 100)}%`;
            if (activeSubflowCurrentNode) renderLargeSubFlowchartSVG(activeSubflowCurrentNode);
        }

        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => {
                subflowModalZoom = Math.min(5.0, subflowModalZoom + 0.15);
                updateSubflowZoomUI();
            });
        }
        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => {
                subflowModalZoom = Math.max(0.3, subflowModalZoom - 0.15);
                updateSubflowZoomUI();
            });
        }
        if (btnZoomReset) {
            btnZoomReset.addEventListener('click', () => {
                subflowModalZoom = 1.0;
                subflowPan = { x: 0, y: 0 };
                updateSubflowZoomUI();
            });
        }
        if (largeSvg) {
            const svgContainer = document.querySelector('.ultra-svg-container');
            if (svgContainer) {
                svgContainer.style.cursor = 'grab';
                svgContainer.addEventListener('mousedown', (e) => {
                    // Start panning only if clicking on the background, not nodes (they stop propagation)
                    isSubflowPanning = true;
                    subflowPanStart = { x: e.clientX - subflowPan.x, y: e.clientY - subflowPan.y };
                    svgContainer.style.cursor = 'grabbing';
                });
                window.addEventListener('mousemove', (e) => {
                    if (isSubflowPanning) {
                        subflowPan.x = e.clientX - subflowPanStart.x;
                        subflowPan.y = e.clientY - subflowPanStart.y;
                        if (activeSubflowCurrentNode) renderLargeSubFlowchartSVG(activeSubflowCurrentNode);
                    }
                });
                window.addEventListener('mouseup', () => {
                    if (isSubflowPanning) {
                        isSubflowPanning = false;
                        if (svgContainer) svgContainer.style.cursor = 'grab';
                    }
                });
            }

            largeSvg.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY < 0) {
                    subflowModalZoom = Math.min(5.0, subflowModalZoom + 0.1);
                } else {
                    subflowModalZoom = Math.max(0.3, subflowModalZoom - 0.1);
                }
                updateSubflowZoomUI();
            });
        }

        const btnNestFlow = getElem('btn-subnode-nest-flow');
        if (btnNestFlow) {
            btnNestFlow.addEventListener('click', () => {
                if (activeSubflowCurrentNode && selectedSubNodeId) {
                    const sn = activeSubflowCurrentNode.details?.subNodes?.find(s => s.id === selectedSubNodeId);
                    if (sn) {
                        if (!sn.details) sn.details = { desc: '', steps: '', owner: '', docs: '', issues: [], subNodes: [], subConns: [] };
                        openSubflowModal(sn, true);
                    }
                } else {
                    alert('⚠️ กรุณาคลิกเลือกกล่องย่อยที่ต้องการเจาะลึกผังย่อยซ้อนย่อยก่อนครับ');
                }
            });
        }

        if (btnOpenDrawer) {
            btnOpenDrawer.addEventListener('click', (e) => {
                e.preventDefault();
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) openSubflowModal(node);
                }
            });
        }

        if (btnClose) btnClose.addEventListener('click', closeSubflowModal);

        if (btnFullscreen) {
            btnFullscreen.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen();
                    } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
                        document.documentElement.webkitRequestFullscreen();
                    } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
                        document.documentElement.msRequestFullscreen();
                    }
                } else {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) { /* Safari */
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) { /* IE11 */
                        document.msExitFullscreen();
                    }
                }
            });
        }

        const btnMainPres = getElem('btn-main-presentation');
        if (btnMainPres) {
            btnMainPres.addEventListener('click', () => {
                if (!document.fullscreenElement) {
                    if (document.documentElement.requestFullscreen) {
                        document.documentElement.requestFullscreen();
                    } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
                        document.documentElement.webkitRequestFullscreen();
                    } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
                        document.documentElement.msRequestFullscreen();
                    }
                }
            });
        }

        const btnMainExit = getElem('btn-main-fullscreen-exit');
        if (btnMainExit) {
            btnMainExit.addEventListener('click', () => {
                if (document.fullscreenElement) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) { /* Safari */
                        document.webkitExitFullscreen();
                    } else if (document.msExitFullscreen) { /* IE11 */
                        document.msExitFullscreen();
                    }
                }
            });
        }

        // Global Fullscreen Change Event
        document.addEventListener('fullscreenchange', () => {
            const isFs = !!document.fullscreenElement;
            document.body.classList.toggle('presentation-mode', isFs);

            // Toggle background colors for presentation mode in subflow
            const svgContainer = document.querySelector('.ultra-svg-container');
            if (svgContainer) {
                svgContainer.style.backgroundColor = isFs ? (document.body.classList.contains('dark-theme') ? '#090d16' : '#f8fafc') : '';
            }

            // Toggle display of overlays
            const mainOverlay = getElem('main-presentation-overlay');
            if (mainOverlay) {
                const modal = getElem('subflow-modal');
                const isModalOpen = modal && modal.style.display === 'block';
                mainOverlay.style.display = (isFs && !isModalOpen) ? 'flex' : 'none';
            }
        });

        if (modalLeftText) {
            modalLeftText.addEventListener('input', () => {
                const node = subflowModalStack[0];
                if (node) {
                    if (!node.details) node.details = {};
                    node.details.subflowTitle = modalLeftText.value;
                    const titleElem = getElem('modal-node-title');
                    if (titleElem) titleElem.textContent = (node.details.subflowTitle || node.text || '').replace(/\n/g, ' ') || 'กล่องกระบวนการ';
                }
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const targetNode = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                if (targetNode) {
                    if (!targetNode.details) targetNode.details = {};
                    const modalLeftText = getElem('modal-left-text');
                    if (modalLeftText) {
                        const newTitle = modalLeftText.value.trim();
                        targetNode.details.subflowTitle = newTitle;
                    }

                    const modalDesc = getElem('modal-desc');
                    const modalSteps = getElem('modal-steps');
                    const modalOwner = getElem('modal-owner');

                    if (modalDesc) targetNode.details.desc = modalDesc.value.trim();
                    if (modalSteps) targetNode.details.steps = modalSteps.value.trim();
                    if (modalOwner) targetNode.details.owner = modalOwner.value.trim();
                }
                closeSubflowModal();
                renderCanvas();
                saveHistoryState();
            });
        }

        if (btnJumpPage) {
            btnJumpPage.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (!node) return;

                    if (!node.linkPageId) {
                        const subPageName = `ผังย่อย: ${node.text.replace(/\n/g, ' ').substring(0, 15)}`;
                        const newPage = {
                            id: `page-${Date.now()}`,
                            name: subPageName,
                            departments: [
                                { id: `d1-${Date.now()}`, name: 'ขั้นตอนการดำเนินงาน (Execution)', height: 180 },
                                { id: `d2-${Date.now()}`, name: 'ขั้นตอนตรวจสอบ (Inspection)', height: 180 }
                            ],
                            nodes: [
                                { id: `ns1-${Date.now()}`, type: 'startend', text: 'เริ่มต้นขั้นตอนย่อย', x: 100, y: 60, width: 160, height: 50, bgColor: '#ecfeff', borderColor: '#06b6d4', textColor: '#0e7490', fontSize: 13 },
                                { id: `ns2-${Date.now()}`, type: 'process', text: 'ดำเนินการตรวจสอบข้อมูล', x: 320, y: 60, width: 180, height: 55, bgColor: '#ffffff', borderColor: '#4f46e5', textColor: '#0f172a', fontSize: 13 },
                                { id: `ns3-${Date.now()}`, type: 'startend', text: 'เสร็จสิ้นขั้นตอนย่อย', x: 560, y: 60, width: 160, height: 50, bgColor: '#ecfdf5', borderColor: '#10b981', textColor: '#047857', fontSize: 13 }
                            ],
                            connections: [
                                { id: `cs1-${Date.now()}`, fromNodeId: `ns1-${Date.now()}`, fromAnchor: 'right', toNodeId: `ns2-${Date.now()}`, toAnchor: 'left', style: 'orthogonal', color: '#475569', width: 2 },
                                { id: `cs2-${Date.now()}`, fromNodeId: `ns2-${Date.now()}`, fromAnchor: 'right', toNodeId: `ns3-${Date.now()}`, toAnchor: 'left', style: 'orthogonal', color: '#475569', width: 2 }
                            ]
                        };
                        state.pages.push(newPage);
                        node.linkPageId = newPage.id;
                    }

                    const targetIdx = state.pages.findIndex(p => p.id === node.linkPageId);
                    if (targetIdx !== -1) {
                        state.activePageIndex = targetIdx;
                        closeSubflowModal();
                        renderPagesTabs();
                        renderCanvas();
                        renderInspector();
                        saveHistoryState();
                    }
                }
            });
        }

        const btnSubnodeNestFlow = getElem('btn-subnode-nest-flow');
        if (btnSubnodeNestFlow) {
            btnSubnodeNestFlow.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node' && selectedSubNodeId) {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                        if (sn) drillDownSubNodeToNestedFlow(node, sn);
                    }
                } else {
                    alert("กรุณาคลิกเลือกกล่องข้อความย่อยที่ต้องการสร้างผังซ้อนก่อนครับ");
                }
            });
        }
    }

    // --- RENDER DEPARTMENT SWIMLANE TIERS ---
    function renderDepartmentLanes() {
        const groupDeptLanes = getElem('group-dept-lanes');
        if (!groupDeptLanes) return;
        groupDeptLanes.innerHTML = '';

        const page = getCurrentPage();
        if (!page.departments || !Array.isArray(page.departments)) {
            page.departments = [];
        }

        let currentY = 0;
        const canvasWidth = 5000;

        page.departments.forEach((dept, index) => {
            const laneH = dept.height || 160;

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('class', 'dept-tier-group');
            g.setAttribute('data-id', dept.id);

            const rowBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rowBg.setAttribute('x', 0);
            rowBg.setAttribute('y', currentY);
            rowBg.setAttribute('width', canvasWidth);
            rowBg.setAttribute('height', laneH);
            
            const isDark = document.body.classList.contains('dark-theme');
            if (dept.color) {
                rowBg.setAttribute('fill', dept.color);
                rowBg.setAttribute('fill-opacity', isDark ? '0.12' : '0.35');
            } else {
                rowBg.setAttribute('fill', index % 2 === 0 ? (isDark ? '#1e293b' : '#f8fafc') : (isDark ? '#0f172a' : '#f1f5f9'));
                rowBg.setAttribute('fill-opacity', isDark ? '0.2' : '0.4');
            }
            g.appendChild(rowBg);

            // Background Watermark Name Text
            const watermarkText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            watermarkText.setAttribute('x', 1000); // Centered around the main workspace width
            watermarkText.setAttribute('y', currentY + laneH / 2);
            watermarkText.setAttribute('text-anchor', 'middle');
            watermarkText.setAttribute('dominant-baseline', 'central');
            watermarkText.setAttribute('font-size', '110px');
            watermarkText.setAttribute('font-weight', '800');
            watermarkText.setAttribute('font-family', "'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif");
            watermarkText.setAttribute('fill', isDark ? '#ffffff' : '#0ea5e9'); // Sky blue for light, white for dark
            watermarkText.setAttribute('fill-opacity', isDark ? '0.04' : '0.065'); // Slightly more visible opacity
            watermarkText.setAttribute('style', 'pointer-events: none; user-select: none; letter-spacing: 2px;');
            watermarkText.textContent = dept.name;
            g.appendChild(watermarkText);

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', 0);
            line.setAttribute('y1', currentY + laneH);
            line.setAttribute('x2', canvasWidth);
            line.setAttribute('y2', currentY + laneH);
            line.setAttribute('class', 'dept-separator-line');
            g.appendChild(line);

            // INTERACTIVE HEIGHT RESIZER HANDLE (↕️ Bar at bottom of lane)
            const resizerBar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            resizerBar.setAttribute('x', 0);
            resizerBar.setAttribute('y', currentY + laneH - 6);
            resizerBar.setAttribute('width', canvasWidth);
            resizerBar.setAttribute('height', 12);
            resizerBar.setAttribute('class', 'dept-lane-resizer');
            resizerBar.setAttribute('title', 'คลิกลากเพื่อยืด/หดความสูงของชั้นแผนกนี้ (Drag to resize department height)');

            resizerBar.addEventListener('mousedown', (e) => {
                const isPresentation = document.body.classList.contains('presentation-mode');
                if (isPresentation) return;

                e.stopPropagation();
                let isResizingDept = true;
                const startY = e.clientY;
                const origH = dept.height || 160;
                resizerBar.classList.add('active');

                const onMouseMove = (moveEvent) => {
                    if (!isResizingDept) return;
                    const dy = (moveEvent.clientY - startY) / state.zoom;
                    dept.height = Math.max(90, Math.round(origH + dy));
                    renderCanvas();
                };

                const onMouseUp = () => {
                    if (isResizingDept) {
                        isResizingDept = false;
                        resizerBar.classList.remove('active');
                        window.removeEventListener('mousemove', onMouseMove);
                        window.removeEventListener('mouseup', onMouseUp);
                        renderCanvas();
                        saveHistoryState();
                    }
                };

                window.addEventListener('mousemove', onMouseMove);
                window.addEventListener('mouseup', onMouseUp);
            });
            g.appendChild(resizerBar);

            // HEADER PILL & DRAG TO REORDER DEPARTMENTS
            const headerPillGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            headerPillGroup.setAttribute('class', 'dept-header-pill');
            headerPillGroup.setAttribute('transform', `translate(20, ${currentY + 12})`);

            const deptFS = page.deptFontSize || 13;
            const textLen = (dept.name || 'แผนก').length;
            const pillW = Math.max(160, textLen * (deptFS * 0.72) + 48);
            const pillH = 34;

            const pillRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            pillRect.setAttribute('width', pillW);
            pillRect.setAttribute('height', pillH);
            pillRect.setAttribute('rx', 8);
            pillRect.setAttribute('fill', '#0f172a');
            headerPillGroup.appendChild(pillRect);

            const pillText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            pillText.setAttribute('x', 14);
            pillText.setAttribute('y', 21);
            pillText.setAttribute('fill', '#ffffff');
            pillText.setAttribute('font-size', `${deptFS}px`);
            pillText.setAttribute('font-weight', '600');
            pillText.setAttribute('font-family', "'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif");
            pillText.textContent = dept.name;
            headerPillGroup.appendChild(pillText);

            const deleteBtn = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            deleteBtn.setAttribute('class', 'dept-delete-btn');
            deleteBtn.setAttribute('x', pillW - 18);
            deleteBtn.setAttribute('y', 21);
            deleteBtn.setAttribute('font-size', '14px');
            deleteBtn.setAttribute('font-weight', 'bold');
            deleteBtn.setAttribute('text-anchor', 'middle');
            deleteBtn.setAttribute('dominant-baseline', 'central');
            deleteBtn.textContent = '✖';
            deleteBtn.setAttribute('title', 'ลบแผนกนี้');

            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`คุณต้องการลบชั้น "${dept.name}" ใช่หรือไม่?`)) {
                    page.departments.splice(index, 1);
                    renderCanvas();
                    saveHistoryState();
                }
            });

            headerPillGroup.appendChild(deleteBtn);

            headerPillGroup.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const newDeptName = prompt("แก้ไขชื่อแผนก / Rename Department:", dept.name);
                if (newDeptName && newDeptName.trim()) {
                    dept.name = newDeptName.trim();
                    renderCanvas();
                    saveHistoryState();
                }
            });

            g.appendChild(headerPillGroup);
            groupDeptLanes.appendChild(g);

            currentY += laneH;
        });
    }

    function renderIssueLinkLines() {
        const groupConnections = getElem('group-connections');
        if (!groupConnections) return;

        const page = getCurrentPage();
        page.nodes.filter(n => n.type.startsWith('issue-')).forEach(issueNode => {
            if (issueNode.targetNodeId) {
                const targetNode = page.nodes.find(n => n.id === issueNode.targetNodeId);
                if (targetNode) {
                    const issueW = issueNode.width || 320;
                    const issueH = issueNode.height || 80;
                    const targetW = targetNode.width || 140;
                    const targetH = targetNode.height || 60;

                    const x1 = issueNode.x + issueW / 2;
                    const y1 = issueNode.y + issueH / 2;
                    const x2 = targetNode.x + targetW / 2;
                    const y2 = targetNode.y + targetH / 2;

                    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    g.setAttribute('class', 'issue-link-group');

                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    const lineColor = issueNode.type === 'issue-red' ? '#ef4444' : issueNode.type === 'issue-yellow' ? '#f59e0b' : '#10b981';
                    const markerId = issueNode.type === 'issue-red' ? 'url(#arrow-red)' : issueNode.type === 'issue-yellow' ? 'url(#arrow-yellow)' : 'url(#arrow-green)';

                    path.setAttribute('d', `M ${x1} ${y1} L ${x2} ${y2}`);
                    path.setAttribute('stroke', lineColor);
                    path.setAttribute('stroke-width', '2.5');
                    path.setAttribute('stroke-dasharray', '6,4');
                    path.setAttribute('marker-end', markerId);

                    g.appendChild(path);
                    groupConnections.appendChild(g);
                }
            }
        });
    }

    // --- CANVAS RENDERING ENGINE ---
    function renderCanvas() {
        const groupDeptLanes = getElem('group-dept-lanes');
        const groupNodes = getElem('group-nodes');
        const groupConnections = getElem('group-connections');
        const groupSwimlanes = getElem('group-swimlanes');
        const svgContent = getElem('canvas-content');

        if (!groupNodes || !groupConnections) return;

        if (groupDeptLanes) groupDeptLanes.innerHTML = '';
        groupNodes.innerHTML = '';
        groupConnections.innerHTML = '';
        if (groupSwimlanes) groupSwimlanes.innerHTML = '';

        const page = getCurrentPage();

        renderDepartmentLanes();

        page.nodes.filter(n => n.type === 'swimlane' || n.type === 'department').forEach(node => {
            renderNodeSVG(node, groupSwimlanes || groupNodes);
        });

        const pairCounts = {};
        const pairIndexes = {};

        page.connections.forEach(c => {
            const key = [c.fromNodeId, c.toNodeId].sort().join('::');
            pairCounts[key] = (pairCounts[key] || 0) + 1;
        });

        page.connections.forEach(conn => {
            const key = [conn.fromNodeId, conn.toNodeId].sort().join('::');
            const totalInPair = pairCounts[key] || 1;
            const idxInPair = pairIndexes[key] || 0;
            pairIndexes[key] = idxInPair + 1;

            renderConnectionSVG(conn, idxInPair, totalInPair);
        });

        renderIssueLinkLines();

        page.nodes.filter(n => n.type !== 'swimlane' && n.type !== 'department').forEach(node => {
            renderNodeSVG(node, groupNodes);
        });

        if (svgContent) {
            svgContent.setAttribute('transform', `translate(${state.pan.x}, ${state.pan.y}) scale(${state.zoom})`);
        }
    }

    function renderNodeSVG(node, containerGroup) {
        const isSelected = state.selectedItem && state.selectedItem.type === 'node' && state.selectedItem.id === node.id;
        
        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `flow-node ${isSelected ? 'selected' : ''}`);
        g.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        g.setAttribute('data-id', node.id);

        const w = node.width || 140;
        const h = node.height || 60;
        const bg = node.bgColor || '#ffffff';
        const border = node.borderColor || '#4f46e5';
        const textCol = node.textColor || '#0f172a';
        const fSize = node.fontSize || 13;

        let shapeElem;

        switch (node.type) {
            case 'issue-red':
            case 'issue-yellow':
            case 'issue-green':
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                
                const cardBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                cardBg.setAttribute('width', w);
                cardBg.setAttribute('height', h);
                cardBg.setAttribute('rx', 6);
                cardBg.setAttribute('fill', node.type === 'issue-red' ? '#fef2f2' : node.type === 'issue-yellow' ? '#fffbeb' : '#ecfdf5');
                cardBg.setAttribute('stroke', node.type === 'issue-red' ? '#ef4444' : node.type === 'issue-yellow' ? '#f59e0b' : '#10b981');
                cardBg.setAttribute('stroke-width', isSelected ? '3' : '2');
                shapeElem.appendChild(cardBg);

                const flagPill = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                flagPill.setAttribute('x', 0);
                flagPill.setAttribute('y', 0);
                flagPill.setAttribute('width', w);
                flagPill.setAttribute('height', 24);
                flagPill.setAttribute('rx', 6);
                flagPill.setAttribute('fill', node.type === 'issue-red' ? '#ef4444' : node.type === 'issue-yellow' ? '#f59e0b' : '#10b981');
                shapeElem.appendChild(flagPill);

                const flagTitle = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                flagTitle.setAttribute('x', w / 2);
                flagTitle.setAttribute('y', 13);
                flagTitle.setAttribute('fill', '#ffffff');
                flagTitle.setAttribute('font-size', '11px');
                flagTitle.setAttribute('font-weight', 'bold');
                flagTitle.setAttribute('font-family', "'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif");
                flagTitle.setAttribute('text-anchor', 'middle');
                flagTitle.setAttribute('dominant-baseline', 'central');
                flagTitle.textContent = node.type === 'issue-red' ? '🚩 RED FLAG ISSUE' : node.type === 'issue-yellow' ? '🚩 YELLOW FLAG' : '🟩 GREEN FLAG (PASS)';
                shapeElem.appendChild(flagTitle);
                break;

            case 'startend':
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shapeElem.setAttribute('width', w);
                shapeElem.setAttribute('height', h);
                shapeElem.setAttribute('rx', h / 2);
                shapeElem.setAttribute('ry', h / 2);
                break;

            case 'decision':
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shapeElem.setAttribute('points', `${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`);
                break;

            case 'inputoutput':
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const offset = w * 0.15;
                shapeElem.setAttribute('points', `${offset},0 ${w},0 ${w - offset},${h} 0,${h}`);
                break;

            case 'document':
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const waveH = h * 0.85;
                shapeElem.setAttribute('d', `M 0,0 L ${w},0 L ${w},${waveH} Q ${w * 0.75},${h * 1.1} ${w * 0.5},${waveH} T 0,${waveH} Z`);
                break;

            case 'connector':
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                shapeElem.setAttribute('cx', w / 2);
                shapeElem.setAttribute('cy', h / 2);
                shapeElem.setAttribute('rx', w / 2);
                shapeElem.setAttribute('ry', h / 2);
                break;

            case 'subprocess':
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const rectBase = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                rectBase.setAttribute('width', w);
                rectBase.setAttribute('height', h);
                rectBase.setAttribute('rx', 4);
                shapeElem.appendChild(rectBase);

                const lineL = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lineL.setAttribute('x1', 12); lineL.setAttribute('y1', 0);
                lineL.setAttribute('x2', 12); lineL.setAttribute('y2', h);
                lineL.setAttribute('stroke', border); lineL.setAttribute('stroke-width', '1.5');
                shapeElem.appendChild(lineL);

                const lineR = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                lineR.setAttribute('x1', w - 12); lineR.setAttribute('y1', 0);
                lineR.setAttribute('x2', w - 12); lineR.setAttribute('y2', h);
                lineR.setAttribute('stroke', border); lineR.setAttribute('stroke-width', '1.5');
                shapeElem.appendChild(lineR);
                break;

            case 'swimlane':
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                const laneBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                laneBg.setAttribute('width', w);
                laneBg.setAttribute('height', h);
                laneBg.setAttribute('rx', 6);
                laneBg.setAttribute('fill', bg);
                laneBg.setAttribute('stroke', border);
                laneBg.setAttribute('stroke-dasharray', '5,5');
                shapeElem.appendChild(laneBg);

                const headerBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                headerBg.setAttribute('width', w);
                headerBg.setAttribute('height', 34);
                headerBg.setAttribute('rx', 6);
                headerBg.setAttribute('fill', border);
                headerBg.setAttribute('opacity', '0.15');
                shapeElem.appendChild(headerBg);
                break;

            default:
                shapeElem = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shapeElem.setAttribute('width', w);
                shapeElem.setAttribute('height', h);
                shapeElem.setAttribute('rx', 6);
                break;
        }

        const isFirstConnect = state.firstConnectNodeId === node.id;
        if (node.type !== 'subprocess' && node.type !== 'swimlane' && !node.type.startsWith('issue-')) {
            shapeElem.setAttribute('fill', bg);
            shapeElem.setAttribute('stroke', isFirstConnect ? '#0284c7' : border);
            shapeElem.setAttribute('stroke-width', (isSelected || isFirstConnect) ? '3' : '1.5');
            if (isFirstConnect) shapeElem.setAttribute('stroke-dasharray', '4,3');
        }

        g.appendChild(shapeElem);

        if (node.text) {
            const textElem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const textY = node.type.startsWith('issue-') ? 44 : (node.type === 'swimlane' ? 22 : h / 2);
            textElem.setAttribute('x', w / 2);
            textElem.setAttribute('y', textY);
            textElem.setAttribute('fill', textCol);
            textElem.setAttribute('font-size', `${fSize}px`);
            textElem.setAttribute('font-family', "'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif");
            textElem.setAttribute('font-weight', node.type.startsWith('issue-') ? '600' : '500');
            textElem.setAttribute('text-anchor', 'middle');
            textElem.setAttribute('dominant-baseline', 'central');
            
            // Smart Auto-Wrap Text based on box width
            const maxCharsPerLine = Math.max(10, Math.floor((w - 20) / (fSize * 0.65)));
            const rawLines = node.text.split('\n');
            const wrappedLines = [];

            rawLines.forEach(rLine => {
                if (rLine.length > maxCharsPerLine) {
                    for (let i = 0; i < rLine.length; i += maxCharsPerLine) {
                        wrappedLines.push(rLine.substring(i, i + maxCharsPerLine));
                    }
                } else {
                    wrappedLines.push(rLine);
                }
            });

            if (wrappedLines.length > 1) {
                const startY = textY - ((wrappedLines.length - 1) * fSize * 0.6);
                textElem.setAttribute('y', startY);
                wrappedLines.forEach((line, i) => {
                    const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                    tspan.setAttribute('x', w / 2);
                    tspan.setAttribute('dy', i === 0 ? '0' : `${fSize * 1.25}`);
                    tspan.textContent = line;
                    textElem.appendChild(tspan);
                });
            } else {
                textElem.textContent = node.text;
            }

            g.appendChild(textElem);
        }

        // Interactive Resize Handle at Bottom-Right Corner (↘️)
        const resizeHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        resizeHandle.setAttribute('class', 'node-resize-handle');
        resizeHandle.setAttribute('cx', w - 4);
        resizeHandle.setAttribute('cy', h - 4);
        resizeHandle.setAttribute('r', 5);
        resizeHandle.setAttribute('title', 'ดึงเพื่อย่อ-ขยายขนาดกล่อง (Drag to Resize Box)');
        g.appendChild(resizeHandle);

        // RED / YELLOW / GREEN FLAG BADGES ON CANVAS NODE (Multi-level cluster)
        if (!node.type.startsWith('issue-')) {
            const issues = node.details?.issues || [];
            if (issues.length > 0) {
                const redCount = issues.filter(i => i.flag === 'red').length;
                const yellowCount = issues.filter(i => i.flag === 'yellow').length;
                const greenCount = issues.filter(i => i.flag === 'green').length;

                const badgeItems = [];
                if (redCount > 0) badgeItems.push({ count: redCount, color: '#ef4444', title: `Red Flag (วิกฤต): ${redCount} รายการ` });
                if (yellowCount > 0) badgeItems.push({ count: yellowCount, color: '#f59e0b', title: `Yellow Flag (เฝ้าระวัง): ${yellowCount} รายการ` });
                if (greenCount > 0) badgeItems.push({ count: greenCount, color: '#10b981', title: `Green Flag (ผ่าน): ${greenCount} รายการ` });

                const badgeRadius = 9.5;
                const badgeSpacing = 21;

                badgeItems.forEach((bItem, bIdx) => {
                    const posX = w - 12 - (badgeItems.length - 1 - bIdx) * badgeSpacing;

                    const flagBadgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                    flagBadgeGroup.setAttribute('transform', `translate(${posX}, 12)`);
                    flagBadgeGroup.setAttribute('style', 'cursor: pointer;');
                    flagBadgeGroup.setAttribute('title', bItem.title);

                    const flagBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                    flagBg.setAttribute('r', badgeRadius);
                    flagBg.setAttribute('fill', bItem.color);
                    flagBg.setAttribute('stroke', '#ffffff');
                    flagBg.setAttribute('stroke-width', '1.5');
                    flagBadgeGroup.appendChild(flagBg);

                    const flagTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    flagTxt.setAttribute('font-size', '9px');
                    flagTxt.setAttribute('fill', '#ffffff');
                    flagTxt.setAttribute('font-weight', 'bold');
                    flagTxt.setAttribute('text-anchor', 'middle');
                    flagTxt.setAttribute('dominant-baseline', 'central');
                    flagTxt.textContent = `${bItem.count}`;
                    flagBadgeGroup.appendChild(flagTxt);

                    flagBadgeGroup.addEventListener('click', (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        selectItem('node', node.id);
                        openSubflowModal(node);
                    });

                    g.appendChild(flagBadgeGroup);
                });
            }

            // Info Badge
            const infoBadge = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            infoBadge.setAttribute('transform', `translate(12, 12)`);
            infoBadge.setAttribute('style', 'cursor: pointer;');
            
            const infoCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            infoCircle.setAttribute('r', 9);
            infoCircle.setAttribute('fill', node.details?.desc ? '#06b6d4' : '#4f46e5');
            infoBadge.appendChild(infoCircle);

            const infoText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            infoText.setAttribute('font-size', '10px');
            infoText.setAttribute('fill', '#ffffff');
            infoText.setAttribute('font-weight', 'bold');
            infoText.setAttribute('text-anchor', 'middle');
            infoText.setAttribute('dominant-baseline', 'central');
            infoText.textContent = 'i';
            infoBadge.appendChild(infoText);

            infoBadge.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            infoBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                selectItem('node', node.id);
                openSubflowModal(node);
            });

            g.appendChild(infoBadge);
        }

        const anchors = getAnchorPositions(node);
        ['top', 'right', 'bottom', 'left'].forEach(pos => {
            const anchorCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            anchorCircle.setAttribute('class', 'node-anchor');
            anchorCircle.setAttribute('cx', anchors[pos].x - node.x);
            anchorCircle.setAttribute('cy', anchors[pos].y - node.y);
            anchorCircle.setAttribute('r', 8);
            anchorCircle.setAttribute('data-node-id', node.id);
            anchorCircle.setAttribute('data-anchor', pos);
            anchorCircle.setAttribute('title', 'คลิกหรือลากจุดนี้เพื่อเชื่อมสาย (Click/Drag to Connect)');

            g.appendChild(anchorCircle);
        });

        // Single click selects node (allows editing colors/details in Inspector)
        g.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem('node', node.id);
        });

        // Double click opens Sub-Flowchart Modal
        g.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            selectItem('node', node.id);
            if (node.type !== 'swimlane' && node.type !== 'department' && !node.type.startsWith('issue-')) {
                openSubflowModal(node);
            }
        });

        attachNodeEvents(g, node);
        containerGroup.appendChild(g);
    }

    function getAnchorPositions(node) {
        const w = node.width || 140;
        const h = node.height || 60;
        return {
            top: { x: node.x + w / 2, y: node.y },
            right: { x: node.x + w, y: node.y + h / 2 },
            bottom: { x: node.x + w / 2, y: node.y + h },
            left: { x: node.x, y: node.y + h / 2 }
        };
    }

    function renderConnectionSVG(conn, idxInPair = 0, totalInPair = 1) {
        const page = getCurrentPage();
        const fromNode = page.nodes.find(n => n.id === conn.fromNodeId);
        const toNode = page.nodes.find(n => n.id === conn.toNodeId);

        if (!fromNode || !toNode) return;

        let fromPos = { ...getAnchorPositions(fromNode)[conn.fromAnchor || 'right'] };
        let toPos = { ...getAnchorPositions(toNode)[conn.toAnchor || 'left'] };

        if (totalInPair > 1) {
            const step = 40;
            const offsetPx = (idxInPair - (totalInPair - 1) / 2) * step;
            const fromAnchor = conn.fromAnchor || 'right';
            const toAnchor = conn.toAnchor || 'left';

            if (fromAnchor === 'top' || fromAnchor === 'bottom') {
                fromPos.x += offsetPx;
            } else {
                fromPos.y += offsetPx;
            }

            if (toAnchor === 'top' || toAnchor === 'bottom') {
                toPos.x += offsetPx;
            } else {
                toPos.y += offsetPx;
            }
        }

        const isSelected = state.selectedItem && state.selectedItem.type === 'connection' && state.selectedItem.id === conn.id;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `flow-connection-group ${isSelected ? 'selected' : ''}`);
        g.setAttribute('data-id', conn.id);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = calculatePathD(fromPos, toPos, conn.style || 'orthogonal', conn.fromAnchor, conn.toAnchor);
        
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('class', `flow-connection ${isSelected ? 'selected' : ''} ${isLineFlowAnimated ? 'flowing-line' : ''}`);
        path.setAttribute('stroke', isSelected ? '#4f46e5' : (conn.color || '#475569'));
        path.setAttribute('stroke-width', conn.width || 2);
        if (conn.dash && conn.dash !== 'none') {
            path.setAttribute('stroke-dasharray', conn.dash);
        }
        path.setAttribute('marker-end', isSelected ? 'url(#arrow-selected)' : 'url(#arrow)');

        g.appendChild(path);

        if (conn.text) {
            let ratio = 0.5;
            if (totalInPair > 1) {
                if (idxInPair === 0) ratio = 0.32;
                else if (idxInPair === 1) ratio = 0.68;
                else if (idxInPair === 2) ratio = 0.50;
                else ratio = 0.25 + ((idxInPair * 0.2) % 0.6);
            }
            const midPoint = getPathMidPoint(fromPos, toPos, ratio);

            const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            bgRect.setAttribute('class', 'connection-label-bg');
            const paddingX = 8;
            const approxWidth = conn.text.length * 8 + paddingX * 2;
            bgRect.setAttribute('x', midPoint.x - approxWidth / 2);
            bgRect.setAttribute('y', midPoint.y - 10);
            bgRect.setAttribute('width', approxWidth);
            bgRect.setAttribute('height', 20);

            const textElem = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            textElem.setAttribute('class', 'connection-label-text');
            textElem.setAttribute('x', midPoint.x);
            textElem.setAttribute('y', midPoint.y);
            textElem.textContent = conn.text;

            g.appendChild(bgRect);
            g.appendChild(textElem);
        }

        g.addEventListener('click', (e) => {
            e.stopPropagation();
            selectItem('connection', conn.id);
        });

        const groupConnections = getElem('group-connections');
        if (groupConnections) groupConnections.appendChild(g);
    }

    function generateSmartOrthogonalPath(start, end, fromAnchor = 'right', toAnchor = 'left') {
        const fromIsH = (fromAnchor === 'left' || fromAnchor === 'right');
        const toIsH = (toAnchor === 'left' || toAnchor === 'right');

        if (fromIsH && toIsH) {
            if (fromAnchor !== toAnchor) {
                const midX = (start.x + end.x) / 2;
                return `M ${start.x},${start.y} H ${midX} V ${end.y} H ${end.x}`;
            } else {
                const extraX = fromAnchor === 'right' ? Math.max(start.x, end.x) + 40 : Math.min(start.x, end.x) - 40;
                return `M ${start.x},${start.y} H ${extraX} V ${end.y} H ${end.x}`;
            }
        } else if (!fromIsH && !toIsH) {
            if (fromAnchor !== toAnchor) {
                const midY = (start.y + end.y) / 2;
                return `M ${start.x},${start.y} V ${midY} H ${end.x} V ${end.y}`;
            } else {
                const extraY = fromAnchor === 'bottom' ? Math.max(start.y, end.y) + 40 : Math.min(start.y, end.y) - 40;
                return `M ${start.x},${start.y} V ${extraY} H ${end.x} V ${end.y}`;
            }
        } else if (fromIsH && !toIsH) {
            return `M ${start.x},${start.y} H ${end.x} V ${end.y}`;
        } else {
            return `M ${start.x},${start.y} V ${end.y} H ${end.x}`;
        }
    }

    function calculatePathD(start, end, style, fromAnchor, toAnchor) {
        if (style === 'straight') {
            return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        }

        if (style === 'bezier') {
            let dx = Math.abs(end.x - start.x) / 2 || 40;
            let dy = Math.abs(end.y - start.y) / 2 || 40;
            let cx1 = start.x + (fromAnchor === 'right' ? dx : fromAnchor === 'left' ? -dx : 0);
            let cy1 = start.y + (fromAnchor === 'bottom' ? dy : fromAnchor === 'top' ? -dy : 0);
            let cx2 = end.x + (toAnchor === 'left' ? -dx : toAnchor === 'right' ? dx : 0);
            let cy2 = end.y + (toAnchor === 'top' ? -dy : toAnchor === 'bottom' ? dy : 0);
            return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
        }

        return generateSmartOrthogonalPath(start, end, fromAnchor || 'right', toAnchor || 'left');
    }

    function getPathMidPoint(p1, p2, ratio = 0.5) {
        return {
            x: p1.x + (p2.x - p1.x) * ratio,
            y: p1.y + (p2.y - p1.y) * ratio
        };
    }

    function selectItem(type, id, triggerModal = false) {
        state.selectedItem = { type, id };
        updateSelectionUI();
        renderInspector();

        if (triggerModal && type === 'node') {
            const page = getCurrentPage();
            const node = page.nodes.find(n => n.id === id);
            if (node && node.type !== 'swimlane' && node.type !== 'department' && !node.type.startsWith('issue-')) {
                openSubflowModal(node);
            }
        }
    }

    function updateSelectionUI() {
        document.querySelectorAll('.flow-node-group').forEach(g => {
            const nodeId = g.getAttribute('data-id');
            const isSel = state.selectedItem && state.selectedItem.type === 'node' && state.selectedItem.id === nodeId;
            g.classList.toggle('selected', isSel);
        });
        document.querySelectorAll('.flow-connection-group').forEach(g => {
            const connId = g.getAttribute('data-id');
            const isSel = state.selectedItem && state.selectedItem.type === 'connection' && state.selectedItem.id === connId;
            g.classList.toggle('selected', isSel);
        });
    }

    function deselectAll() {
        state.selectedItem = null;
        renderCanvas();
        renderInspector();
    }

    function attachNodeEvents(gElem, node) {
        let isDragging = false;
        let startClientX = 0, startClientY = 0;
        let originalNodeX = 0, originalNodeY = 0;
        let movedPx = 0;

        gElem.addEventListener('mousedown', (e) => {
            const isPresentation = document.body.classList.contains('presentation-mode');
            if (isPresentation) {
                // Let the event bubble up to canvas-viewport so it starts panning!
                return;
            }

            if (e.target.classList.contains('node-anchor') || state.currentTool === 'connect') {
                const anchorPos = e.target.getAttribute('data-anchor') || 'right';
                startConnectionDrag(node.id, anchorPos, e);
                return;
            }

            if (state.currentTool === 'pan') return;

            e.stopPropagation();

            isDragging = true;
            movedPx = 0;
            startClientX = e.clientX;
            startClientY = e.clientY;
            originalNodeX = node.x;
            originalNodeY = node.y;

            const onMouseMove = (moveEvent) => {
                if (!isDragging) return;
                
                const dx = (moveEvent.clientX - startClientX) / state.zoom;
                const dy = (moveEvent.clientY - startClientY) / state.zoom;
                movedPx = Math.hypot(moveEvent.clientX - startClientX, moveEvent.clientY - startClientY);

                if (movedPx > 15) {
                    let newX = originalNodeX + dx;
                    let newY = originalNodeY + dy;

                    if (state.gridSnap) {
                        const gridSize = 20;
                        const w = node.width || 140;
                        const h = node.height || 60;
                        const centerX = newX + w / 2;
                        const centerY = newY + h / 2;
                        newX = Math.round(centerX / gridSize) * gridSize - w / 2;
                        newY = Math.round(centerY / gridSize) * gridSize - h / 2;
                    }

                    node.x = newX;
                    node.y = newY;

                    gElem.setAttribute('transform', `translate(${node.x}, ${node.y})`);
                }
            };

            const onMouseUp = () => {
                if (isDragging) {
                    isDragging = false;
                    window.removeEventListener('mousemove', onMouseMove);
                    window.removeEventListener('mouseup', onMouseUp);
                    
                    if (movedPx > 15) {
                        selectItem('node', node.id, false);
                        renderCanvas();
                        saveHistoryState();
                    } else {
                        selectItem('node', node.id, false);
                        // Double Click Timestamp Check
                        const now = Date.now();
                        if (node._lastClickTime && (now - node._lastClickTime < 450)) {
                            node._lastClickTime = 0;
                            if (node.type !== 'swimlane' && node.type !== 'department' && !node.type.startsWith('issue-')) {
                                openSubflowModal(node);
                            }
                        } else {
                            node._lastClickTime = now;
                        }
                    }
                }
            };

            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
        });

        // INTERACTIVE RESIZE HANDLE ENGINE (↘️)
        const resizeHandle = gElem.querySelector('.node-resize-handle');
        if (resizeHandle) {
            resizeHandle.addEventListener('mousedown', (e) => {
                e.stopPropagation();
                let isResizing = true;
                const startClientX = e.clientX;
                const startClientY = e.clientY;
                const origW = node.width || 140;
                const origH = node.height || 60;

                const onResizeMove = (moveEvent) => {
                    if (!isResizing) return;
                    const dw = (moveEvent.clientX - startClientX) / state.zoom;
                    const dh = (moveEvent.clientY - startClientY) / state.zoom;

                    let newW = origW + dw;
                    let newH = origH + dh;

                    if (state.gridSnap) {
                        newW = Math.round(newW / 20) * 20;
                        newH = Math.round(newH / 20) * 20;
                    } else {
                        newW = Math.round(newW);
                        newH = Math.round(newH);
                    }

                    node.width = Math.max(80, newW);
                    node.height = Math.max(40, newH);

                    renderCanvas();
                    renderInspector();
                };

                const onResizeUp = () => {
                    isResizing = false;
                    window.removeEventListener('mousemove', onResizeMove);
                    window.removeEventListener('mouseup', onResizeUp);
                    saveHistoryState();
                };

                window.addEventListener('mousemove', onResizeMove);
                window.addEventListener('mouseup', onResizeUp);
            });
        }

        gElem.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            if (node.type !== 'swimlane' && node.type !== 'department' && !node.type.startsWith('issue-')) {
                openSubflowModal(node, true);
            }
        });
    }

    function startConnectionDrag(nodeId, anchorPos, e) {
        e.stopPropagation();
        const page = getCurrentPage();
        const node = page.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const startClientX = e.clientX;
        const startClientY = e.clientY;

        const anchorCoord = getAnchorPositions(node)[anchorPos];

        state.connecting = {
            active: true,
            fromNodeId: nodeId,
            fromAnchor: anchorPos,
            startX: anchorCoord.x,
            startY: anchorCoord.y
        };

        const tempConn = getElem('temp-connection');

        const onMouseMove = (moveEvent) => {
            if (!state.connecting.active) return;

            const totalMove = Math.hypot(moveEvent.clientX - startClientX, moveEvent.clientY - startClientY);
            if (totalMove > 6 && tempConn) {
                tempConn.style.display = 'block';

                const svg = getElem('flow-svg');
                if (!svg) return;
                const rect = svg.getBoundingClientRect();
                const mouseCanvasX = (moveEvent.clientX - rect.left - state.pan.x) / state.zoom;
                const mouseCanvasY = (moveEvent.clientY - rect.top - state.pan.y) / state.zoom;

                const d = calculatePathD(
                    { x: state.connecting.startX, y: state.connecting.startY },
                    { x: mouseCanvasX, y: mouseCanvasY },
                    'orthogonal',
                    state.connecting.fromAnchor,
                    'left'
                );
                tempConn.setAttribute('d', d);
            }
        };

        const onMouseUp = (upEvent) => {
            if (tempConn) tempConn.style.display = 'none';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            if (!state.connecting.active) return;
            state.connecting.active = false;

            const totalDragDist = Math.hypot(upEvent.clientX - startClientX, upEvent.clientY - startClientY);

            // Handle Click-to-Connect (movement < 8px)
            if (totalDragDist < 8) {
                if (!state.firstConnectNodeId) {
                    state.firstConnectNodeId = nodeId;
                    selectItem('node', nodeId, false);
                    renderCanvas();
                } else if (state.firstConnectNodeId !== nodeId) {
                    const newConn = {
                        id: `conn-${Date.now()}`,
                        fromNodeId: state.firstConnectNodeId,
                        fromAnchor: anchorPos || 'right',
                        toNodeId: nodeId,
                        toAnchor: 'left',
                        text: '',
                        style: 'orthogonal',
                        color: '#475569',
                        width: 2,
                        dash: 'none'
                    };
                    page.connections.push(newConn);
                    selectItem('connection', newConn.id);
                    state.firstConnectNodeId = null;
                    renderCanvas();
                    saveHistoryState();
                } else {
                    state.firstConnectNodeId = null;
                    renderCanvas();
                }
                return;
            }

            // Handle Drag-to-Connect (movement >= 8px)
            let hitElem = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
            let toNodeId = null;
            let toAnchorPos = 'top';

            if (hitElem) {
                const anchorElem = hitElem.closest ? hitElem.closest('.node-anchor') : null;
                if (anchorElem) {
                    toNodeId = anchorElem.getAttribute('data-node-id');
                    toAnchorPos = anchorElem.getAttribute('data-anchor');
                } else {
                    const nodeElem = hitElem.closest ? hitElem.closest('.flow-node') : null;
                    if (nodeElem) {
                        toNodeId = nodeElem.getAttribute('data-id');
                        toAnchorPos = 'top';
                    }
                }
            }

            if (toNodeId && toNodeId !== nodeId) {
                const newConn = {
                    id: `conn-${Date.now()}`,
                    fromNodeId: nodeId,
                    fromAnchor: anchorPos,
                    toNodeId: toNodeId,
                    toAnchor: toAnchorPos,
                    text: '',
                    style: 'orthogonal',
                    color: '#475569',
                    width: 2,
                    dash: 'none'
                };
                page.connections.push(newConn);
                selectItem('connection', newConn.id);
                renderCanvas();
                saveHistoryState();
            }
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    }

    function renderInspector() {
        const propEmpty = getElem('prop-empty');
        const propNode = getElem('prop-node');
        const propConnection = getElem('prop-connection');

        if (propEmpty) propEmpty.style.display = 'none';
        if (propNode) propNode.style.display = 'none';
        if (propConnection) propConnection.style.display = 'none';

        if (!state.selectedItem) {
            if (propEmpty) propEmpty.style.display = 'block';
            return;
        }

        const page = getCurrentPage();

        if (state.selectedItem.type === 'node') {
            const node = page.nodes.find(n => n.id === state.selectedItem.id);
            if (!node) return;

            if (propNode) propNode.style.display = 'block';
            const nodeTextInput = getElem('node-text-input');
            const nodeWidthInput = getElem('node-width-input');
            const nodeHeightInput = getElem('node-height-input');
            const nodeShapeSelect = getElem('node-shape-select');
            const nodeLinkPageSelect = getElem('node-link-page-select');
            const nodeBgColor = getElem('node-bg-color');
            const nodeBorderColor = getElem('node-border-color');
            const nodeTextColor = getElem('node-text-color');
            const nodeFontSize = getElem('node-font-size');
            const issueTargetGroup = getElem('issue-target-group');
            const issueTargetSelect = getElem('issue-target-node-select');

            if (node.type.startsWith('issue-')) {
                if (issueTargetGroup) issueTargetGroup.style.display = 'block';
                if (issueTargetSelect) {
                    issueTargetSelect.innerHTML = '<option value="">-- ไม่ได้ชี้ระบุกระบวนการ (Unlinked) --</option>';
                    page.nodes.filter(n => !n.type.startsWith('issue-') && n.type !== 'swimlane' && n.type !== 'department').forEach(proc => {
                        const opt = document.createElement('option');
                        opt.value = proc.id;
                        opt.textContent = proc.text ? proc.text.replace(/\n/g, ' ') : 'กล่องกระบวนการ';
                        if (node.targetNodeId === proc.id) opt.selected = true;
                        issueTargetSelect.appendChild(opt);
                    });
                }
            } else {
                if (issueTargetGroup) issueTargetGroup.style.display = 'none';
            }

            if (nodeTextInput) nodeTextInput.value = node.text || '';
            if (nodeWidthInput) nodeWidthInput.value = node.width || 140;
            if (nodeHeightInput) nodeHeightInput.value = node.height || 60;
            if (nodeShapeSelect) nodeShapeSelect.value = node.type || 'process';
            if (nodeLinkPageSelect) {
                nodeLinkPageSelect.innerHTML = '<option value="">-- ใช้ผังย่อยของกล่องตัวเอง (Default) --</option>';
                state.pages.forEach(pg => {
                    pg.nodes.filter(n => n.id !== node.id && !n.type.startsWith('issue-') && n.type !== 'swimlane' && n.type !== 'department').forEach(otherNode => {
                        const opt = document.createElement('option');
                        opt.value = otherNode.id;
                        opt.textContent = `${pg.name ? pg.name.substring(0, 10) + '... ▸ ' : ''}${otherNode.text ? otherNode.text.replace(/\n/g, ' ') : 'กล่องกระบวนการ'}`;
                        if (node.linkTargetNodeId === otherNode.id) opt.selected = true;
                        nodeLinkPageSelect.appendChild(opt);
                    });
                });
            }
            if (nodeBgColor) nodeBgColor.value = node.bgColor || '#ffffff';
            if (nodeBorderColor) nodeBorderColor.value = node.borderColor || '#4f46e5';
            if (nodeTextColor) nodeTextColor.value = node.textColor || '#0f172a';
            if (nodeFontSize) nodeFontSize.value = node.fontSize || 13;
        } else if (state.selectedItem.type === 'connection') {
            const conn = page.connections.find(c => c.id === state.selectedItem.id);
            if (!conn) return;

            if (propConnection) propConnection.style.display = 'block';
            const connTextInput = getElem('conn-text-input');
            const connStyleSelect = getElem('conn-style-select');
            const connFromAnchorSelect = getElem('conn-from-anchor-select');
            const connToAnchorSelect = getElem('conn-to-anchor-select');
            const connColor = getElem('conn-color');
            const connWidth = getElem('conn-width');

            if (connTextInput) connTextInput.value = conn.text || '';
            if (connStyleSelect) connStyleSelect.value = conn.style || 'orthogonal';
            if (connFromAnchorSelect) connFromAnchorSelect.value = conn.fromAnchor || 'right';
            if (connToAnchorSelect) connToAnchorSelect.value = conn.toAnchor || 'left';
            if (connColor) connColor.value = conn.color || '#475569';
            if (connWidth) connWidth.value = conn.width || 2;
        }
    }

    function setupInspectorEvents() {
        const nodeTextInput = getElem('node-text-input');
        const nodeWidthInput = getElem('node-width-input');
        const nodeHeightInput = getElem('node-height-input');
        const nodeShapeSelect = getElem('node-shape-select');
        const nodeLinkPageSelect = getElem('node-link-page-select');
        const nodeBgColor = getElem('node-bg-color');
        const nodeBorderColor = getElem('node-border-color');
        const nodeTextColor = getElem('node-text-color');
        const nodeFontSize = getElem('node-font-size');
        const issueTargetSelect = getElem('issue-target-node-select');

        if (issueTargetSelect) {
            issueTargetSelect.addEventListener('change', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.targetNodeId = issueTargetSelect.value;
                        renderCanvas();
                        saveHistoryState();
                    }
                }
            });
        }

        if (nodeTextInput) {
            nodeTextInput.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.text = nodeTextInput.value;
                        renderCanvas();
                    }
                }
            });
        }

        if (nodeWidthInput) {
            nodeWidthInput.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.width = parseInt(nodeWidthInput.value, 10) || 140;
                        renderCanvas();
                    }
                }
            });
        }

        if (nodeHeightInput) {
            nodeHeightInput.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.height = parseInt(nodeHeightInput.value, 10) || 60;
                        renderCanvas();
                    }
                }
            });
        }

        if (nodeShapeSelect) {
            nodeShapeSelect.addEventListener('change', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.type = nodeShapeSelect.value;
                        renderCanvas();
                        saveHistoryState();
                    }
                }
            });
        }

        if (nodeLinkPageSelect) {
            nodeLinkPageSelect.addEventListener('change', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.linkTargetNodeId = nodeLinkPageSelect.value || null;
                        saveHistoryState();
                    }
                }
            });
        }

        const btnOpenInspectorSubflow = getElem('btn-open-inspector-subflow');
        if (btnOpenInspectorSubflow) {
            btnOpenInspectorSubflow.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.type !== 'swimlane' && node.type !== 'department' && !node.type.startsWith('issue-')) {
                        openSubflowModal(node, true);
                    }
                }
            });
        }

        if (nodeBgColor) {
            nodeBgColor.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.bgColor = nodeBgColor.value;
                        renderCanvas();
                    }
                }
            });
        }

        if (nodeBorderColor) {
            nodeBorderColor.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.borderColor = nodeBorderColor.value;
                        renderCanvas();
                    }
                }
            });
        }

        if (nodeTextColor) {
            nodeTextColor.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.textColor = nodeTextColor.value;
                        renderCanvas();
                    }
                }
            });
        }

        if (nodeFontSize) {
            nodeFontSize.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        node.fontSize = parseInt(nodeFontSize.value, 10) || 13;
                        renderCanvas();
                    }
                }
            });
        }

        const colorSwatchesContainer = getElem('node-color-swatches');
        if (colorSwatchesContainer) {
            colorSwatchesContainer.querySelectorAll('.color-swatch-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    if (state.selectedItem?.type === 'node') {
                        const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                        if (node) {
                            const bg = btn.getAttribute('data-bg');
                            const border = btn.getAttribute('data-border');
                            const textCol = btn.getAttribute('data-text');

                            if (bg) node.bgColor = bg;
                            if (border) node.borderColor = border;
                            if (textCol) node.textColor = textCol;

                            const bgInput = getElem('node-bg-color');
                            const borderInput = getElem('node-border-color');
                            const textInput = getElem('node-text-color');
                            if (bgInput && bg) bgInput.value = bg;
                            if (borderInput && border) borderInput.value = border;
                            if (textInput && textCol) textInput.value = textCol;

                            renderCanvas();
                            saveHistoryState();
                        }
                    }
                });
            });
        }

        const connTextInput = getElem('conn-text-input');
        const connStyleSelect = getElem('conn-style-select');
        const connColor = getElem('conn-color');
        const connWidth = getElem('conn-width');

        if (connTextInput) {
            connTextInput.addEventListener('input', () => {
                if (state.selectedItem?.type === 'connection') {
                    const conn = getCurrentPage().connections.find(c => c.id === state.selectedItem.id);
                    if (conn) {
                        conn.text = connTextInput.value;
                        renderCanvas();
                    }
                }
            });
        }

        if (connStyleSelect) {
            connStyleSelect.addEventListener('change', () => {
                if (state.selectedItem?.type === 'connection') {
                    const conn = getCurrentPage().connections.find(c => c.id === state.selectedItem.id);
                    if (conn) {
                        conn.style = connStyleSelect.value;
                        renderCanvas();
                        saveHistoryState();
                    }
                }
            });
        }

        if (connColor) {
            connColor.addEventListener('input', () => {
                if (state.selectedItem?.type === 'connection') {
                    const conn = getCurrentPage().connections.find(c => c.id === state.selectedItem.id);
                    if (conn) {
                        conn.color = connColor.value;
                        renderCanvas();
                    }
                }
            });
        }

        if (connWidth) {
            connWidth.addEventListener('input', () => {
                if (state.selectedItem?.type === 'connection') {
                    const conn = getCurrentPage().connections.find(c => c.id === state.selectedItem.id);
                    if (conn) {
                        conn.width = parseInt(connWidth.value, 10) || 2;
                        renderCanvas();
                    }
                }
            });
        }
    }

    function openInlineTextEditor(node) {
        const popup = getElem('text-editor-popup');
        const textarea = getElem('inline-text-textarea');
        const svg = getElem('flow-svg');

        if (!popup || !textarea || !svg) return;

        const rect = svg.getBoundingClientRect();
        const screenX = rect.left + state.pan.x + (node.x * state.zoom);
        const screenY = rect.top + state.pan.y + (node.y * state.zoom);

        popup.style.left = `${screenX}px`;
        popup.style.top = `${screenY}px`;
        popup.style.display = 'block';

        textarea.value = node.text || '';
        textarea.focus();
        textarea.select();

        const closeEditor = () => {
            node.text = textarea.value;
            popup.style.display = 'none';
            renderCanvas();
            renderInspector();
            saveHistoryState();
            textarea.removeEventListener('blur', closeEditor);
        };

        textarea.addEventListener('blur', closeEditor);
    }

    function setupSidebarDragAndDrop() {
        const shapeItems = document.querySelectorAll('.shape-item');
        shapeItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                const shapeType = item.getAttribute('data-type');
                e.dataTransfer.setData('text/plain', shapeType);
            });

            item.addEventListener('click', () => {
                const shapeType = item.getAttribute('data-type');
                if (!shapeType) return;

                const svg = getElem('flow-svg');
                let dropX = 180 + (Math.random() * 40);
                let dropY = 120 + (Math.random() * 40);

                if (svg) {
                    const rect = svg.getBoundingClientRect();
                    dropX = (rect.width / 2 - state.pan.x) / state.zoom - 70;
                    dropY = (rect.height / 2 - state.pan.y) / state.zoom - 30;
                }

                addShapeToCanvas(shapeType, dropX, dropY);
            });
        });

        const canvasViewport = getElem('canvas-viewport');
        if (!canvasViewport) return;

        canvasViewport.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        });

        canvasViewport.addEventListener('drop', (e) => {
            e.preventDefault();
            const shapeType = e.dataTransfer.getData('text/plain');
            if (!shapeType) return;

            const svg = getElem('flow-svg');
            if (!svg) return;

            const rect = svg.getBoundingClientRect();
            let dropX = (e.clientX - rect.left - state.pan.x) / state.zoom;
            let dropY = (e.clientY - rect.top - state.pan.y) / state.zoom;

            addShapeToCanvas(shapeType, dropX, dropY);
        });
    }

    function addShapeToCanvas(shapeType, dropX, dropY) {
        if (!shapeType) return;

        if (state.gridSnap) {
            dropX = Math.round(dropX / 20) * 20;
            dropY = Math.round(dropY / 20) * 20;
        }

        const defaultWidths = { swimlane: 400, department: 300, startend: 140, decision: 140, 'issue-red': 210, 'issue-yellow': 210, 'issue-green': 210 };
        const defaultHeights = { swimlane: 250, department: 200, startend: 55, decision: 100, 'issue-red': 65, 'issue-yellow': 65, 'issue-green': 65 };

        const defaultLabels = {
            'issue-red': '🚩 ระบุรายละเอียดปัญหาคอขวด (Red Flag)...',
            'issue-yellow': '🚩 ระบุรายละเอียดข้อควรเฝ้าระวัง (Yellow Flag)...',
            'issue-green': '🟩 ระบุข้อความผ่าน/แก้ไขเรียบร้อย (Green Flag)...',
            startend: 'เริ่ม / จบ\n(Start / End)',
            process: 'กระบวนการ\n(Process)',
            decision: 'เงื่อนไข?\n(Decision?)',
            inputoutput: 'รับ/แสดงผล\n(Input / Output)',
            document: 'เอกสาร\n(Document)',
            connector: 'จุดเชื่อม\n(Connector)',
            subprocess: 'ขั้นตอนย่อย\n(Sub-Process)',
            swimlane: 'ขอบเขตสายงาน (Swimlane)',
            department: 'แผนก / Department',
            text: 'ข้อความอิสระ\n(Text Label)'
        };

        const defaultColors = {
            'issue-red': { bg: '#fef2f2', border: '#ef4444' },
            'issue-yellow': { bg: '#fffbeb', border: '#f59e0b' },
            'issue-green': { bg: '#ecfdf5', border: '#10b981' },
            startend: { bg: '#ecfdf5', border: '#10b981' },
            process: { bg: '#ffffff', border: '#4f46e5' },
            decision: { bg: '#fffbeb', border: '#f59e0b' },
            inputoutput: { bg: '#f5f3ff', border: '#8b5cf6' },
            document: { bg: '#fdf2f8', border: '#ec4899' },
            connector: { bg: '#ecfeff', border: '#06b6d4' },
            subprocess: { bg: '#e0e7ff', border: '#6366f1' },
            swimlane: { bg: '#f8fafc', border: '#94a3b8' },
            department: { bg: '#f0f9ff', border: '#0ea5e9' },
            text: { bg: 'transparent', border: 'transparent' }
        };

        const colors = defaultColors[shapeType] || { bg: '#ffffff', border: '#4f46e5' };

        const newNode = {
            id: `node-${Date.now()}`,
            type: shapeType,
            text: defaultLabels[shapeType] || 'ข้อความ',
            x: dropX,
            y: dropY,
            width: defaultWidths[shapeType] || 140,
            height: defaultHeights[shapeType] || 60,
            bgColor: colors.bg,
            borderColor: colors.border,
            textColor: shapeType === 'issue-red' ? '#dc2626' : shapeType === 'issue-yellow' ? '#b45309' : shapeType === 'issue-green' ? '#047857' : '#0f172a',
            fontSize: 12,
            linkPageId: '',
            details: {
                desc: 'ระบุหลักการทำงานของกล่องนี้...',
                steps: '1. ขั้นตอนที่หนึ่ง\n2. ขั้นตอนที่สอง\n3. ขั้นตอนที่สาม',
                owner: 'ระบุผู้รับผิดชอบ',
                docs: 'ระบุเอกสารอ้างอิง',
                issues: []
            }
        };

        const page = getCurrentPage();
        page.nodes.push(newNode);
        selectItem('node', newNode.id, false);

        renderCanvas();
        renderInspector();
        saveHistoryState();
    }

    function setupCanvasEvents() {
        const svg = getElem('flow-svg');
        const svgGrid = getElem('svg-grid');
        const canvasViewport = getElem('canvas-viewport');

        if (svg) {
            svg.addEventListener('click', (e) => {
                if (e.target === svg || e.target === svgGrid) {
                    deselectAll();
                }
            });
        }

        const btnAddPage = getElem('btn-add-page');
        if (btnAddPage) btnAddPage.addEventListener('click', addNewPage);

        const toolSelect = getElem('tool-select');
        const toolConnect = getElem('tool-connect');
        const toolPan = getElem('tool-pan');

        if (toolSelect) toolSelect.addEventListener('click', () => setTool('select'));
        if (toolConnect) toolConnect.addEventListener('click', () => setTool('connect'));
        if (toolPan) toolPan.addEventListener('click', () => setTool('pan'));

        const btnDelSel = getElem('btn-delete-selected');
        if (btnDelSel) btnDelSel.addEventListener('click', deleteSelectedItem);

        if (canvasViewport) {
            canvasViewport.addEventListener('mousedown', (e) => {
                const isPresentation = document.body.classList.contains('presentation-mode');
                if (state.currentTool === 'pan' || e.button === 1 || isPresentation) {
                    state.isPanning = true;
                    state.panStart = { x: e.clientX - state.pan.x, y: e.clientY - state.pan.y };
                    canvasViewport.classList.add('panning');
                }
            });

            canvasViewport.addEventListener('wheel', (e) => {
                e.preventDefault();
                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                setZoom(state.zoom * zoomFactor);
            });
        }

        window.addEventListener('mousemove', (e) => {
            if (state.isPanning) {
                state.pan.x = e.clientX - state.panStart.x;
                state.pan.y = e.clientY - state.panStart.y;
                renderCanvas();
            }
        });

        window.addEventListener('mouseup', () => {
            if (state.isPanning) {
                state.isPanning = false;
                if (canvasViewport) canvasViewport.classList.remove('panning');
            }
        });
    }

    function setTool(toolName) {
        state.currentTool = toolName;
        state.firstConnectNodeId = null;
        const toolSelect = getElem('tool-select');
        const toolConnect = getElem('tool-connect');
        const toolPan = getElem('tool-pan');
        const canvasViewport = getElem('canvas-viewport');

        if (toolSelect) toolSelect.classList.toggle('active', toolName === 'select');
        if (toolConnect) toolConnect.classList.toggle('active', toolName === 'connect');
        if (toolPan) toolPan.classList.toggle('active', toolName === 'pan');
        if (canvasViewport) canvasViewport.style.cursor = toolName === 'pan' ? 'grab' : (toolName === 'connect' ? 'crosshair' : 'default');
    }

    function setZoom(newZoom) {
        state.zoom = Math.max(0.2, Math.min(3.0, newZoom));
        const zoomText = getElem('zoom-level');
        if (zoomText) zoomText.textContent = `${Math.round(state.zoom * 100)}%`;
        renderCanvas();
    }

    function deleteSelectedItem() {
        const modal = getElem('subflow-modal');
        if (modal && (modal.style.display === 'flex' || modal.style.display === 'block')) {
            deleteSelectedSubItem();
            return;
        }

        if (!state.selectedItem) return;
        const page = getCurrentPage();

        if (state.selectedItem.type === 'node') {
            const nodeId = state.selectedItem.id;
            page.nodes = page.nodes.filter(n => n.id !== nodeId);
            page.connections = page.connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId);
        } else if (state.selectedItem.type === 'connection') {
            page.connections = page.connections.filter(c => c.id !== state.selectedItem.id);
        }

        deselectAll();
        saveHistoryState();
    }

    function deleteSelectedSubItem() {
        const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
        if (!node) return;

        if (selectedSubNodeId) {
            const targetId = selectedSubNodeId;
            if (node.details?.subNodes) {
                node.details.subNodes = node.details.subNodes.filter(s => s.id !== targetId);
            }
            if (node.details?.subConns) {
                node.details.subConns = node.details.subConns.filter(c => c.from !== targetId && c.to !== targetId);
            }
            selectedSubNodeId = null;
            renderLargeSubFlowchartSVG(node);
            saveHistoryState();
        } else if (selectedSubConnIdx >= 0) {
            deleteSelectedSubConnItem();
        } else {
            alert('⚠️ กรุณาคลิกเลือกกล่องย่อย หรือเส้นเชื่อมที่ต้องการลบก่อนครับ');
        }
    }

    function deleteSelectedSubConnItem() {
        const node = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
        if (!node) return;

        if (selectedSubConnIdx >= 0 && node.details?.subConns && selectedSubConnIdx < node.details.subConns.length) {
            node.details.subConns.splice(selectedSubConnIdx, 1);
            selectedSubConnIdx = -1;
            renderLargeSubFlowchartSVG(node);
            saveHistoryState();
        } else {
            alert('⚠️ กรุณาคลิกเลือกเส้นเชื่อมในผังย่อยที่ต้องการลบก่อนครับ');
        }
    }

    function setupHeaderEvents() {
        const titleElem = getElem('project-title');
        if (titleElem) {
            titleElem.addEventListener('blur', () => {
                state.title = titleElem.textContent.trim() || 'ผังกระบวนการทำงานแบบกำหนดแผนกเอง / Custom Swimlane Flow';
                saveHistoryState();
            });
        }

        const btnNew = getElem('btn-new');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
                if (confirm("ต้องการสร้างผังใหม่หรือไม่? / Create new project?")) {
                    state.title = "ผังกระบวนการทำงานแบบกำหนดแผนกเอง / Custom Swimlane Flow";
                    state.pages = [{
                        id: 'page-1',
                        name: 'กระบวนการหลัก (Main Flow)',
                        departments: [
                            { id: 'dept-1', name: 'แผนกขาย (Sales)', height: 160 },
                            { id: 'dept-2', name: 'แผนกจัดซื้อ (Purchasing)', height: 160 },
                            { id: 'dept-3', name: 'แผนกคลังสินค้า (Warehouse)', height: 160 },
                            { id: 'dept-4', name: 'แผนกขนส่ง (Transport)', height: 160 },
                            { id: 'dept-5', name: 'แผนกบัญชี (Accounting)', height: 160 }
                        ],
                        nodes: [],
                        connections: []
                    }];
                    state.activePageIndex = 0;
                    state.selectedItem = null;
                    if (titleElem) titleElem.textContent = state.title;
                    renderPagesTabs();
                    renderCanvas();
                    renderInspector();
                    saveHistoryState();
                }
            });
        }

        const btnSave = getElem('btn-save');
        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                    version: "1.0",
                    title: state.title,
                    pages: state.pages,
                    issues: state.issues || []
                }, null, 2));
                const dlAnchor = document.createElement('a');
                dlAnchor.setAttribute("href", dataStr);
                dlAnchor.setAttribute("download", `${state.title.replace(/\s+/g, '_')}.json`);
                document.body.appendChild(dlAnchor);
                dlAnchor.click();
                dlAnchor.remove();
            });
        }

        const btnOpen = getElem('btn-open');
        const fileInput = getElem('file-input');
        if (btnOpen && fileInput) {
            btnOpen.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = (event) => {
                    try {
                        const parsed = JSON.parse(event.target.result);
                        if (parsed.pages && Array.isArray(parsed.pages)) {
                            state.title = parsed.title || "ผังกระบวนการทำงาน";
                            state.pages = parsed.pages;
                            state.activePageIndex = 0;
                            state.selectedItem = null;

                            // โหลด issues ถ้ามี
                            if (parsed.issues && Array.isArray(parsed.issues)) {
                                state.issues = parsed.issues;
                            } else {
                                state.issues = [];
                            }

                            // Reset zoom & pan ให้มองเห็นโหนดทันที
                            state.zoom = 1;
                            state.pan = { x: 0, y: 0 };

                            if (titleElem) titleElem.textContent = state.title;
                            renderPagesTabs();
                            renderCanvas();
                            renderInspector();
                            saveHistoryState();

                            // แสดงข้อความสำเร็จ
                            const pageCount = parsed.pages.length;
                            const nodeCount = parsed.pages.reduce((sum, p) => sum + (p.nodes || []).length, 0);
                            alert(`✅ โหลดไฟล์สำเร็จ!\n📄 ${pageCount} หน้า | 🔷 ${nodeCount} กล่อง`);
                        } else {
                            alert("ไฟล์ JSON ไม่ถูกต้องตามรูปแบบ / Invalid FlowStudio JSON file");
                        }
                    } catch (err) {
                        alert("ไม่สามารถอ่านไฟล์ JSON ได้ / Cannot read JSON file\n" + err.message);
                    }
                };
                reader.readAsText(file);
                e.target.value = '';
            });
        }

        const btnUndo = getElem('btn-undo');
        const btnRedo = getElem('btn-redo');
        if (btnUndo) btnUndo.addEventListener('click', undo);
        if (btnRedo) btnRedo.addEventListener('click', redo);

        // ปุ่มลบข้อมูลทั้งหน้า (Clear Current Page)
        const btnClearPage = getElem('btn-clear-page');
        if (btnClearPage) {
            btnClearPage.addEventListener('click', () => {
                const page = getCurrentPage();
                const nodeCount = (page.nodes || []).length;
                const connCount = (page.connections || []).length;

                if (nodeCount === 0 && connCount === 0) {
                    alert('⚠️ หน้านี้ไม่มีข้อมูลอยู่แล้วครับ!');
                    return;
                }

                const confirmed = confirm(
                    `🗑️ ลบข้อมูลทั้งหน้า "${page.name}" ใช่ไหม?\n\n` +
                    `จะลบ: ${nodeCount} กล่อง, ${connCount} เส้นเชื่อม\n\n` +
                    `⚠️ การกระทำนี้สามารถ Undo ได้ครับ`
                );

                if (confirmed) {
                    page.nodes = [];
                    page.connections = [];
                    state.selectedItem = null;
                    deselectAll();
                    renderCanvas();
                    renderInspector();
                    saveHistoryState();
                }
            });
        }

        const btnToggleGridHeader = getElem('btn-toggle-grid-header');
        if (btnToggleGridHeader) {
            btnToggleGridHeader.addEventListener('click', () => {
                showCanvasGrid = !showCanvasGrid;
                localStorage.setItem('flowstudio_show_grid', showCanvasGrid);
                updateGridDisplay();
            });
        }

        const btnToggleFlowHeader = getElem('btn-toggle-flow-header');
        if (btnToggleFlowHeader) {
            btnToggleFlowHeader.addEventListener('click', toggleLineFlowAnimation);
        }

        const btnToggleGrid = getElem('btn-toggle-grid');
        if (btnToggleGrid) {
            btnToggleGrid.addEventListener('click', () => {
                showCanvasGrid = !showCanvasGrid;
                localStorage.setItem('flowstudio_show_grid', showCanvasGrid);
                updateGridDisplay();
            });
        }

        const btnToggleSnap = getElem('btn-toggle-snap');
        if (btnToggleSnap) {
            btnToggleSnap.addEventListener('click', () => {
                state.gridSnap = !state.gridSnap;
                btnToggleSnap.classList.toggle('active', state.gridSnap);
            });
        }

        const btnThemeToggle = getElem('btn-theme-toggle');
        if (btnThemeToggle) {
            btnThemeToggle.addEventListener('click', () => {
                document.body.classList.toggle('dark-theme');
                document.body.classList.toggle('light-theme');
                const isDark = document.body.classList.contains('dark-theme');
                const icon = btnThemeToggle.querySelector('i');
                if (icon) icon.className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
            });
        }

        function exportSVGToPNG(svg, filename, sourceText) {
            try {
                const clonedSvg = svg.cloneNode(true);
                const isDark = document.body.classList.contains('dark-theme');
                
                // Remove pan/zoom transform from both main content group and subflow content group in cloned SVG
                const clonedCanvasContent = clonedSvg.querySelector('#canvas-content');
                if (clonedCanvasContent) {
                    clonedCanvasContent.removeAttribute('transform');
                }
                const clonedSubflowGroup = clonedSvg.querySelector('#subflow-content-group');
                if (clonedSubflowGroup) {
                    clonedSubflowGroup.removeAttribute('transform');
                }

                // Remove background grid rects
                const gridRects = clonedSvg.querySelectorAll('rect[fill^="url(#"]');
                gridRects.forEach(r => r.remove());

                const isSubflow = (svg.id === 'large-subflow-svg');
                let x = 0, y = 0, width = 800, height = 600;
                
                if (isSubflow) {
                    // For subflow modal: crop tightly around active subnodes
                    const nodes = svg.querySelectorAll('.sub-node-elem');
                    if (nodes.length > 0) {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        nodes.forEach(node => {
                            const bbox = node.getBBox();
                            const transform = node.getAttribute('transform');
                            let tx = 0, ty = 0;
                            if (transform) {
                                const match = transform.match(/translate\(([^,)]+)[, ]+([^)]+)\)/);
                                if (match) {
                                    tx = parseFloat(match[1]);
                                    ty = parseFloat(match[2]);
                                }
                            }
                            const nx = tx + bbox.x;
                            const ny = ty + bbox.y;
                            const nw = bbox.width;
                            const nh = bbox.height;
                            if (nx < minX) minX = nx;
                            if (ny < minY) minY = ny;
                            if (nx + nw > maxX) maxX = nx + nw;
                            if (ny + nh > maxY) maxY = ny + nh;
                        });
                        
                        // Add an elegant source header badge at the top of the exported subflow image
                        let headerHeightOffset = 0;
                        if (sourceText) {
                            headerHeightOffset = 70; // Reserve 70px above the topmost node for the source title badge
                            
                            const headerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                            headerGroup.setAttribute('class', 'exported-source-header');
                            
                            // Center coordinates for the title badge
                            const badgeW = Math.min(600, (maxX - minX) * 0.9 + 100);
                            const badgeH = 36;
                            const badgeX = minX + (maxX - minX) / 2 - badgeW / 2;
                            const badgeY = minY - 60;
                            
                            // Badge Background
                            const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                            badgeBg.setAttribute('x', badgeX);
                            badgeBg.setAttribute('y', badgeY);
                            badgeBg.setAttribute('width', badgeW);
                            badgeBg.setAttribute('height', badgeH);
                            badgeBg.setAttribute('rx', badgeH / 2);
                            badgeBg.setAttribute('fill', isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(79, 70, 229, 0.06)');
                            badgeBg.setAttribute('stroke', isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(79, 70, 229, 0.18)');
                            badgeBg.setAttribute('stroke-width', '1.5');
                            headerGroup.appendChild(badgeBg);
                            
                            // Badge Text
                            const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                            badgeText.setAttribute('x', minX + (maxX - minX) / 2);
                            badgeText.setAttribute('y', badgeY + badgeH / 2);
                            badgeText.setAttribute('text-anchor', 'middle');
                            badgeText.setAttribute('dominant-baseline', 'central');
                            badgeText.setAttribute('font-size', '12px');
                            badgeText.setAttribute('font-weight', 'bold');
                            badgeText.setAttribute('fill', isDark ? '#38bdf8' : '#4f46e5');
                            badgeText.textContent = `📌 ผังกระบวนการย่อยของกล่อง: ${sourceText}`;
                            headerGroup.appendChild(badgeText);
                            
                            // Append header inside cloned content group to ensure proper alignment
                            const targetGroup = clonedSvg.querySelector('#subflow-content-group') || clonedSvg;
                            targetGroup.appendChild(headerGroup);
                            
                            minY = minY - headerHeightOffset;
                        }
                        
                        const padding = 50;
                        x = minX - padding;
                        y = minY - padding;
                        width = (maxX - minX) + padding * 2;
                        height = (maxY - minY) + padding * 2;
                    }
                } else {
                    // For main page flowchart: 
                    const nodes = svg.querySelectorAll('.flow-node');
                    let maxX = 1200; 
                    nodes.forEach(node => {
                        const bbox = node.getBBox();
                        const transform = node.getAttribute('transform');
                        let tx = 0;
                        if (transform) {
                            const match = transform.match(/translate\(([^,)]+)[, ]+([^)]+)\)/);
                            if (match) tx = parseFloat(match[1]);
                        }
                        const nx = tx + bbox.x + bbox.width;
                        if (nx > maxX) maxX = nx;
                    });
                    
                    const page = getCurrentPage();
                    let totalHeight = 600;
                    if (page && page.departments) {
                        totalHeight = page.departments.reduce((acc, dept) => acc + (dept.height || 160), 0);
                    }
                    
                    x = 0;
                    y = 0;
                    width = maxX + 100;
                    height = totalHeight;
                }

                clonedSvg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
                clonedSvg.setAttribute('width', width);
                clonedSvg.setAttribute('height', height);

                const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                bgRect.setAttribute('x', x);
                bgRect.setAttribute('y', y);
                bgRect.setAttribute('width', width);
                bgRect.setAttribute('height', height);
                bgRect.setAttribute('fill', isDark ? '#0b0f19' : '#f8fafc');
                
                const defs = clonedSvg.querySelector('defs');
                if (defs) {
                    defs.after(bgRect);
                } else {
                    clonedSvg.insertBefore(bgRect, clonedSvg.firstChild);
                }

                const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
                styleElement.textContent = `
                    text { font-family: 'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif !important; }
                    .node-title, .node-text, .dept-header-text, .connection-text, .subflow-text { font-family: 'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif !important; }
                `;
                clonedSvg.appendChild(styleElement);

                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(clonedSvg);
                const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);

                const image = new Image();
                
                // Asynchronous onload error catching
                image.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        const scale = 2; // HD Crisp Quality
                        canvas.width = width * scale;
                        canvas.height = height * scale;

                        const ctx = canvas.getContext('2d');
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.scale(scale, scale);

                        ctx.drawImage(image, 0, 0, width, height);

                        // Asynchronous toBlob error catching and null checking
                        canvas.toBlob((blob) => {
                            try {
                                if (!blob) {
                                    throw new Error('Canvas render output is empty (toBlob returned null)');
                                }
                                const pngUrl = URL.createObjectURL(blob);
                                const link = document.createElement('a');
                                link.download = filename;
                                link.href = pngUrl;
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                                
                                setTimeout(() => URL.revokeObjectURL(pngUrl), 100);
                            } catch (err) {
                                console.error('PNG download generation failed:', err);
                                alert('⚠️ เบราว์เซอร์บล็อกการเซฟไฟล์รูปภาพ: ' + err.message + '\n\nระบบจะทำการดาวน์โหลดเป็นไฟล์เวกเตอร์ (.svg) ให้แทนเพื่อความปลอดภัยครับ');
                                downloadSVGDirect(svg, filename.replace('.png', '.svg'), sourceText);
                            }
                        }, 'image/png');
                    } catch (err) {
                        console.error('Canvas image onload drawing failed:', err);
                        alert('⚠️ การวาดภาพผังงานขัดข้อง: ' + err.message + '\n\nระบบจะทำการดาวน์โหลดเป็นไฟล์เวกเตอร์ (.svg) ให้แทนเพื่อความปลอดภัยครับ');
                        downloadSVGDirect(svg, filename.replace('.png', '.svg'), sourceText);
                    }
                };

                image.onerror = (err) => {
                    console.error('Image loading failed, falling back to raw SVG', err);
                    alert('⚠️ เกิดข้อผิดพลาดในการโหลดรูปภาพผังงาน ระบบจะทำการดาวน์โหลดเป็นไฟล์เวกเตอร์ (.svg) ให้แทนครับ');
                    downloadSVGDirect(svg, filename.replace('.png', '.svg'), sourceText);
                };

                image.src = url;
            } catch (e) {
                console.error(e);
                alert('⚠️ ระบบแปลงรูปภาพขัดข้อง: ' + e.message + '\n\nระบบจะทำการดาวน์โหลดเป็นไฟล์เวกเตอร์ (.svg) แทนเพื่อความปลอดภัยครับ');
                downloadSVGDirect(svg, filename.replace('.png', '.svg'), sourceText);
            }
        }

        function downloadSVGDirect(svg, filename, sourceText) {
            try {
                const clonedSvg = svg.cloneNode(true);
                const isDark = document.body.classList.contains('dark-theme');
                
                // Remove pan/zoom transform from both main content group and subflow content group in cloned SVG
                const clonedCanvasContent = clonedSvg.querySelector('#canvas-content');
                if (clonedCanvasContent) {
                    clonedCanvasContent.removeAttribute('transform');
                }
                const clonedGroup = clonedSvg.querySelector('#subflow-content-group');
                if (clonedGroup) {
                    clonedGroup.removeAttribute('transform');
                }

                const gridRects = clonedSvg.querySelectorAll('rect[fill^="url(#"]');
                gridRects.forEach(r => r.remove());

                const isSubflow = (svg.id === 'large-subflow-svg');
                let x = 0, y = 0, width = 800, height = 600;
                
                if (isSubflow) {
                    // For subflow modal: crop tightly around active subnodes
                    const nodes = svg.querySelectorAll('.sub-node-elem');
                    if (nodes.length > 0) {
                        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
                        nodes.forEach(node => {
                            const bbox = node.getBBox();
                            const transform = node.getAttribute('transform');
                            let tx = 0, ty = 0;
                            if (transform) {
                                const match = transform.match(/translate\(([^,)]+)[, ]+([^)]+)\)/);
                                if (match) {
                                    tx = parseFloat(match[1]);
                                    ty = parseFloat(match[2]);
                                }
                            }
                            const nx = tx + bbox.x;
                            const ny = ty + bbox.y;
                            const nw = bbox.width;
                            const nh = bbox.height;
                            if (nx < minX) minX = nx;
                            if (ny < minY) minY = ny;
                            if (nx + nw > maxX) maxX = nx + nw;
                            if (ny + nh > maxY) maxY = ny + nh;
                        });
                        
                        // Add an elegant source header badge at the top of the exported subflow SVG
                        let headerHeightOffset = 0;
                        if (sourceText) {
                            headerHeightOffset = 70; // Reserve 70px above the topmost node for the source title badge
                            
                            const headerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                            headerGroup.setAttribute('class', 'exported-source-header');
                            
                            // Center coordinates for the title badge
                            const badgeW = Math.min(600, (maxX - minX) * 0.9 + 100);
                            const badgeH = 36;
                            const badgeX = minX + (maxX - minX) / 2 - badgeW / 2;
                            const badgeY = minY - 60;
                            
                            // Badge Background
                            const badgeBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                            badgeBg.setAttribute('x', badgeX);
                            badgeBg.setAttribute('y', badgeY);
                            badgeBg.setAttribute('width', badgeW);
                            badgeBg.setAttribute('height', badgeH);
                            badgeBg.setAttribute('rx', badgeH / 2);
                            badgeBg.setAttribute('fill', isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(79, 70, 229, 0.06)');
                            badgeBg.setAttribute('stroke', isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(79, 70, 229, 0.18)');
                            badgeBg.setAttribute('stroke-width', '1.5');
                            headerGroup.appendChild(badgeBg);
                            
                            // Badge Text
                            const badgeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                            badgeText.setAttribute('x', minX + (maxX - minX) / 2);
                            badgeText.setAttribute('y', badgeY + badgeH / 2);
                            badgeText.setAttribute('text-anchor', 'middle');
                            badgeText.setAttribute('dominant-baseline', 'central');
                            badgeText.setAttribute('font-size', '12px');
                            badgeText.setAttribute('font-weight', 'bold');
                            badgeText.setAttribute('fill', isDark ? '#38bdf8' : '#4f46e5');
                            badgeText.textContent = `📌 ผังกระบวนการย่อยของกล่อง: ${sourceText}`;
                            headerGroup.appendChild(badgeText);
                            
                            // Append header inside cloned content group
                            const targetGroup = clonedSvg.querySelector('#subflow-content-group') || clonedSvg;
                            targetGroup.appendChild(headerGroup);
                            
                            minY = minY - headerHeightOffset;
                        }
                        
                        const padding = 50;
                        x = minX - padding;
                        y = minY - padding;
                        width = (maxX - minX) + padding * 2;
                        height = (maxY - minY) + padding * 2;
                    }
                } else {
                    // For main page flowchart: 
                    const nodes = svg.querySelectorAll('.flow-node');
                    let maxX = 1200; // Default min width
                    nodes.forEach(node => {
                        const bbox = node.getBBox();
                        const transform = node.getAttribute('transform');
                        let tx = 0;
                        if (transform) {
                            const match = transform.match(/translate\(([^,)]+)[, ]+([^)]+)\)/);
                            if (match) tx = parseFloat(match[1]);
                        }
                        const nx = tx + bbox.x + bbox.width;
                        if (nx > maxX) maxX = nx;
                    });
                    
                    // Determine total height of all lanes on the active page
                    const page = getCurrentPage();
                    let totalHeight = 600;
                    if (page && page.departments) {
                        totalHeight = page.departments.reduce((acc, dept) => acc + (dept.height || 160), 0);
                    }
                    
                    x = 0;
                    y = 0;
                    width = maxX + 100; // Extra right-padding
                    height = totalHeight;
                }

                clonedSvg.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
                clonedSvg.setAttribute('width', width);
                clonedSvg.setAttribute('height', height);

                const serializer = new XMLSerializer();
                const svgString = serializer.serializeToString(clonedSvg);
                const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);

                const link = document.createElement('a');
                link.download = filename;
                link.href = url;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                setTimeout(() => URL.revokeObjectURL(url), 100);
            } catch (e) {
                console.error(e);
                alert('⚠️ การดาวน์โหลดไฟล์ SVG ขัดข้อง: ' + e.message);
            }
        }

        const exportPng = getElem('export-png');
        if (exportPng) {
            exportPng.addEventListener('click', (e) => {
                e.preventDefault();
                const svg = getElem('flow-svg');
                if (svg) {
                    exportSVGToPNG(svg, `${(state.title || 'flowchart').replace(/\s+/g, '_')}.png`);
                }
            });
        }

        const exportSvg = getElem('export-svg');
        if (exportSvg) {
            exportSvg.addEventListener('click', (e) => {
                e.preventDefault();
                const svg = getElem('flow-svg');
                if (svg) {
                    downloadSVGDirect(svg, `${(state.title || 'flowchart').replace(/\s+/g, '_')}.svg`);
                }
            });
        }

        const exportPrint = getElem('export-print');
        if (exportPrint) {
            exportPrint.addEventListener('click', (e) => {
                e.preventDefault();
                window.print();
            });
        }

        const btnExportSubPng = getElem('btn-export-sub-png');
        if (btnExportSubPng) {
            btnExportSubPng.addEventListener('click', (e) => {
                e.preventDefault();
                const subSvg = getElem('large-subflow-svg');
                const targetNode = activeSubflowCurrentNode || (subflowModalStack.length > 0 ? subflowModalStack[subflowModalStack.length - 1] : null);
                const subflowTitle = targetNode ? (targetNode.details?.subflowTitle || targetNode.text || 'subflow') : 'subflow';
                if (subSvg) {
                    exportSVGToPNG(subSvg, `ผังย่อย_${subflowTitle.replace(/\s+/g, '_')}.png`, subflowTitle);
                } else {
                    alert('⚠️ ไม่พบเนื้อหาผังงานย่อยที่จะทำการส่งออกรูปภาพครับ');
                }
            });
        }


        const btnZoomIn = getElem('btn-zoom-in');
        const btnZoomOut = getElem('btn-zoom-out');
        const btnZoomFit = getElem('btn-zoom-fit');

        if (btnZoomIn) btnZoomIn.addEventListener('click', () => setZoom(state.zoom + 0.15));
        if (btnZoomOut) btnZoomOut.addEventListener('click', () => setZoom(state.zoom - 0.15));
        if (btnZoomFit) {
            btnZoomFit.addEventListener('click', () => {
                state.zoom = 1.0;
                state.pan = { x: 0, y: 0 };
                setZoom(1.0);
            });
        }
    }

    function setupKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
                return;
            }

            if (e.key === 'Escape') {
                closeSubflowModal();
                closeDeptModal();
                closeIssueDashboardModal();
            }

            if (e.key === 'Delete' || e.key === 'Backspace') {
                deleteSelectedItem();
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (e.shiftKey) { redo(); } else { undo(); }
            }

            if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                e.preventDefault();
                redo();
            }

            if (e.key === 'v' || e.key === 'V') setTool('select');
            if (e.key === 'c' || e.key === 'C') setTool('connect');
            if (e.key === 'h' || e.key === 'H') setTool('pan');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
