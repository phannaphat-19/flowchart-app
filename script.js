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

        let modalGridBtn = getElem('btn-modal-toggle-grid');
        let modalGridText = getElem('modal-grid-status-text');
        const subflowZoomControls = document.querySelector('.subflow-zoom-controls');

        // Dynamic Injection Safeguard for Modal Grid Button
        if (!modalGridBtn && subflowZoomControls) {
            modalGridBtn = document.createElement('button');
            modalGridBtn.id = 'btn-modal-toggle-grid';
            modalGridBtn.className = 'btn-subtool-sm';
            modalGridBtn.title = 'ปิด/เปิด ตารางกริดพื้นหลัง (Toggle Grid)';
            modalGridBtn.innerHTML = '🔲 <span id="modal-grid-status-text">ตาราง: เปิด</span>';
            modalGridBtn.addEventListener('click', () => {
                showCanvasGrid = !showCanvasGrid;
                localStorage.setItem('flowstudio_show_grid', showCanvasGrid);
                updateGridDisplay();
            });
            subflowZoomControls.appendChild(modalGridBtn);
            modalGridText = getElem('modal-grid-status-text');
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
        if (modalGridBtn && modalGridText) {
            if (showCanvasGrid) {
                modalGridBtn.classList.remove('off');
                modalGridText.textContent = 'ตาราง: เปิด';
            } else {
                modalGridBtn.classList.add('off');
                modalGridText.textContent = 'ตาราง: ปิด';
            }
        }
    }

    const AUTOSAVE_KEY = 'flowstudio_pro_autosave_data_v2';
    let autoSaveTimer = null;

    function triggerAutoSave() {
        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            try {
                const data = {
                    title: state.title,
                    activePageIndex: state.activePageIndex,
                    pages: state.pages,
                    issues: state.issues || [],
                    updatedAt: new Date().toISOString()
                };
                localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(data));
                flashAutoSaveBadge();
            } catch (e) {
                console.error('AutoSave failed:', e);
            }
        }, 300);
    }

    function flashAutoSaveBadge() {
        const badge = getElem('autosave-status-badge');
        if (badge) {
            badge.style.transform = 'scale(1.08)';
            badge.style.background = 'rgba(16,185,129,0.25)';
            setTimeout(() => {
                badge.style.transform = 'scale(1)';
                badge.style.background = 'rgba(16,185,129,0.12)';
            }, 300);
        }
    }

    function loadAutoSaveData() {
        try {
            const raw = localStorage.getItem(AUTOSAVE_KEY);
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data && Array.isArray(data.pages) && data.pages.length > 0) {
                state.title = data.title || state.title;
                state.pages = data.pages;
                state.activePageIndex = Math.min(data.activePageIndex || 0, state.pages.length - 1);
                state.issues = data.issues || [];

                const titleElem = getElem('project-title');
                if (titleElem) titleElem.textContent = state.title;
                return true;
            }
        } catch (e) {
            console.error('Failed to load autosave data:', e);
        }
        return false;
    }

    // --- INITIALIZATION ---
    function init() {
        // Dynamic DOM Purge for Right Inspector Subflow elements
        ['btn-open-drawer', 'btn-open-inspector-subflow', 'node-link-page-group', 'modal-shared-flow-group'].forEach(id => {
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
        
        setupSidebarDragAndDrop();
        setupCanvasEvents();
        setupHeaderEvents();
        setupInspectorEvents();
        setupSubflowModalEvents();
        setupSubNodeCustomizerEvents();
        setupDeptModalEvents();
        setupIssueEvents();
        setupKeyboardShortcuts();

        saveHistoryState();
    }

    function createStarterNodes() {
        const page = state.pages[0];
        page.name = "ผังกระบวนการสั่งซื้อถึงจัดส่ง (Order-to-Delivery)";

        page.departments = [
            { id: 'dept-sales', name: 'แผนกขาย (Sales)', height: 170 },
            { id: 'dept-purchasing', name: 'แผนกจัดซื้อ (Purchasing)', height: 160 },
            { id: 'dept-warehouse', name: 'แผนกคลังสินค้า (Warehouse)', height: 160 },
            { id: 'dept-transport', name: 'แผนกขนส่ง (Transport)', height: 160 },
            { id: 'dept-accounting', name: 'แผนกบัญชี (Accounting)', height: 160 }
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
            departments: [
                { id: `d1-${Date.now()}`, name: 'ขั้นตอนการดำเนินงาน (Operation)', height: 200 },
                { id: `d2-${Date.now()}`, name: 'ขั้นตอนสนับสนุน (Support)', height: 200 }
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
                    const text = issueTextElem ? issueTextElem.value.trim() : '';
                    if (!text) {
                        alert("กรุณาระบุรายละเอียดปัญหาที่พบ");
                        return;
                    }

                    const flagRadio = document.querySelector('input[name="modal-flag"]:checked');
                    const flagValue = flagRadio ? flagRadio.value : 'red';

                    const newIssue = {
                        id: `iss-${Date.now()}`,
                        flag: flagValue,
                        text: text
                    };

                    node.details.issues.push(newIssue);

                    // ALSO push visual Issue Card to Sub-Flowchart SVG canvas!
                    if (!node.details.subNodes) node.details.subNodes = [];
                    const issueSubNodeType = flagValue === 'red' ? 'issue-red' : flagValue === 'yellow' ? 'issue-yellow' : 'issue-green';
                    node.details.subNodes.push({
                        id: `sub-iss-${Date.now()}`,
                        type: issueSubNodeType,
                        text: text,
                        x: 230 + Math.random() * 80,
                        y: 160 + Math.random() * 40,
                        w: 210,
                        h: 60,
                        bg: flagValue === 'red' ? '#fef2f2' : flagValue === 'yellow' ? '#fffbeb' : '#ecfdf5',
                        border: flagValue === 'red' ? '#ef4444' : flagValue === 'yellow' ? '#f59e0b' : '#10b981'
                    });

                    if (issueTextElem) issueTextElem.value = '';
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
            
            card.innerHTML = `
                <div style="flex:1;">
                    <div style="font-weight:700; font-size:0.72rem; opacity:0.9;">${flagIcon}</div>
                    <div style="margin-top:2px;">${issue.text}</div>
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

        state.pages.forEach(page => {
            page.nodes.forEach(node => {
                // Handle Standalone Draggable Issue Cards on Canvas!
                if (node.type === 'issue-red' || node.type === 'issue-yellow' || node.type === 'issue-green') {
                    totalCount++;
                    const flagType = node.type === 'issue-red' ? 'red' : node.type === 'issue-yellow' ? 'yellow' : 'green';
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
                            <td>${node.text ? node.text.replace(/\n/g, ' ') : 'การ์ดปัญหา'}</td>
                        `;
                        tbody.appendChild(tr);
                    }
                }

                // Handle Issues Attached to Nodes
                const issues = node.details?.issues || [];
                issues.forEach(issue => {
                    totalCount++;
                    if (issue.flag === 'red') redCount++;
                    else if (issue.flag === 'yellow') yellowCount++;
                    else if (issue.flag === 'green') greenCount++;

                    if (tbody) {
                        const tr = document.createElement('tr');
                        const flagBadgeClass = issue.flag === 'red' ? 'red' : issue.flag === 'yellow' ? 'yellow' : 'green';
                        const flagBadgeText = issue.flag === 'red' ? '🚩 Red Flag (วิกฤต)' : issue.flag === 'yellow' ? '🚩 Yellow Flag (เฝ้าระวัง)' : '🟩 Green Flag (ผ่าน)';

                        tr.innerHTML = `
                            <td>${rowNum++}</td>
                            <td><span class="flag-badge-pill ${flagBadgeClass}">${flagBadgeText}</span></td>
                            <td><strong>${node.text ? node.text.replace(/\n/g, ' ') : 'กล่องกระบวนการ'}</strong><br><small style="color:var(--text-muted);">${page.name}</small></td>
                            <td>${node.details?.owner || 'ไม่ระบุแผนก'}</td>
                            <td>${issue.text}</td>
                        `;
                        tbody.appendChild(tr);
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
        let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
        csvContent += "#,ระดับปัญหา (Flag),หน้าผังงาน,กระบวนการ/ตำแหน่ง,ผู้รับผิดชอบ,รายละเอียดปัญหา\n";

        let rowNum = 1;
        state.pages.forEach(page => {
            page.nodes.forEach(node => {
                if (node.type === 'issue-red' || node.type === 'issue-yellow' || node.type === 'issue-green') {
                    const flagName = node.type === 'issue-red' ? 'Red Flag (วิกฤต)' : node.type === 'issue-yellow' ? 'Yellow Flag (เฝ้าระวัง)' : 'Green Flag (ผ่าน)';
                    const pageName = `"${page.name.replace(/"/g, '""')}"`;
                    const nodeName = `"การ์ดปัญหาบนผัง (X:${Math.round(node.x)}, Y:${Math.round(node.y)})"`;
                    const owner = `"${(node.details?.owner || 'ไม่ระบุ').replace(/"/g, '""')}"`;
                    const text = `"${(node.text || 'การ์ดปัญหา').replace(/"/g, '""')}"`;
                    csvContent += `${rowNum++},${flagName},${pageName},${nodeName},${owner},${text}\n`;
                }

                const issues = node.details?.issues || [];
                issues.forEach(issue => {
                    const flagName = issue.flag === 'red' ? 'Red Flag (วิกฤต)' : issue.flag === 'yellow' ? 'Yellow Flag (เฝ้าระวัง)' : 'Green Flag (ผ่าน)';
                    const pageName = `"${page.name.replace(/"/g, '""')}"`;
                    const nodeName = `"${(node.text || 'กระบวนการ').replace(/\n/g, ' ').replace(/"/g, '""')}"`;
                    const owner = `"${(node.details?.owner || 'ไม่ระบุ').replace(/"/g, '""')}"`;
                    const text = `"${issue.text.replace(/"/g, '""')}"`;
                    csvContent += `${rowNum++},${flagName},${pageName},${nodeName},${owner},${text}\n`;
                });
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `สรุปรายงานปัญหา_${state.title.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // --- CUSTOM DEPARTMENT MANAGER MODAL LOGIC ---
    function openDeptModal() {
        const page = getCurrentPage();
        if (!page.departments) page.departments = [];
        tempDepartments = JSON.parse(JSON.stringify(page.departments));
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

            const numSpan = document.createElement('span');
            numSpan.style.fontWeight = 'bold';
            numSpan.style.color = '#4f46e5';
            numSpan.textContent = `${index + 1}.`;
            row.appendChild(numSpan);

            const input = document.createElement('input');
            input.type = 'text';
            input.value = dept.name;
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
                        height: 160
                    });
                    if (input) input.value = '';
                    renderDeptModalList();
                }
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const page = getCurrentPage();
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
    let activeSubflowCurrentNode = null;

    function openSubflowModal(node, isPushStack = true) {
        if (!node) return;

        const modal = getElem('subflow-modal');
        if (!modal) return;

        if (isPushStack) {
            if (subflowModalStack.length === 0 || subflowModalStack[subflowModalStack.length - 1] !== node) {
                subflowModalStack.push(node);
            }
        }

        activeSubflowCurrentNode = node;

        if (!node.details) {
            node.details = { desc: '', steps: '', owner: '', docs: '', issues: [], subNodes: [], subConns: [] };
        }

        const btnBack = getElem('btn-modal-back');
        const breadcrumbText = getElem('modal-breadcrumb-text');
        if (btnBack && breadcrumbText) {
            if (subflowModalStack.length > 1) {
                btnBack.style.display = 'inline-flex';
                const trail = subflowModalStack.map(n => n.text ? n.text.replace(/\n/g, ' ') : 'ขั้นตอนย่อย').join(' › ');
                breadcrumbText.textContent = `🔍 เส้นทางผังย่อย: ${trail}`;
            } else {
                btnBack.style.display = 'none';
                breadcrumbText.textContent = '🔍 ผังกระบวนการย่อยภายใน (ลากขยับรูปทรง & แปะป้าย Red/Green Flag ปัญหาได้ทันที)';
            }
        }

        const cleanTitle = node.text ? node.text.replace(/\n/g, ' ') : 'กล่องกระบวนการ';
        const titleElem = getElem('modal-node-title');
        if (titleElem) titleElem.textContent = cleanTitle;

        renderOriginalBoxPreview(node);
        const leftText = getElem('modal-left-text');
        if (leftText) leftText.value = node.text || '';

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
        const connectSelect = getElem('subnode-connect-select');
        const deleteConnSelect = getElem('subnode-delete-conn-select');

        if (shapeSelect) shapeSelect.value = subNode.type || 'process';
        if (bgColor) bgColor.value = subNode.bg || '#ffffff';
        if (borderColor) borderColor.value = subNode.border || '#4f46e5';
        if (textInput) textInput.value = subNode.text || '';

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
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
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
                }
            });
        }

        if (deleteConnSelect) {
            deleteConnSelect.addEventListener('change', () => {
                const connIdxStr = deleteConnSelect.value;
                if (connIdxStr !== '' && state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subConns) {
                        const idx = parseInt(connIdxStr, 10);
                        if (!isNaN(idx) && idx >= 0 && idx < node.details.subConns.length) {
                            node.details.subConns.splice(idx, 1);
                            selectedSubConnIdx = -1;
                            deleteConnSelect.value = '';
                            renderLargeSubFlowchartSVG(node);
                        }
                    }
                }
            });
        }

        if (connectSelect) {
            connectSelect.addEventListener('change', () => {
                const targetId = connectSelect.value;
                if (targetId && state.selectedItem?.type === 'node' && selectedSubNodeId) {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) {
                        if (!node.details.subConns) node.details.subConns = [];
                        // Check if connection already exists
                        const exists = node.details.subConns.some(c => c.from === selectedSubNodeId && c.to === targetId);
                        if (!exists) {
                            node.details.subConns.push({ from: selectedSubNodeId, to: targetId, text: '' });
                        }
                        connectSelect.value = '';
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }

        if (shapeSelect) {
            shapeSelect.addEventListener('change', () => {
                if (state.selectedItem?.type === 'node' && selectedSubNodeId) {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                        if (sn) {
                            sn.type = shapeSelect.value;
                            renderLargeSubFlowchartSVG(node);
                        }
                    }
                }
            });
        }

        if (bgColor) {
            bgColor.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node' && selectedSubNodeId) {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                        if (sn) {
                            sn.bg = bgColor.value;
                            renderLargeSubFlowchartSVG(node);
                        }
                    }
                }
            });
        }

        if (borderColor) {
            borderColor.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node' && selectedSubNodeId) {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                        if (sn) {
                            sn.border = borderColor.value;
                            renderLargeSubFlowchartSVG(node);
                        }
                    }
                }
            });
        }

        if (textInput) {
            textInput.addEventListener('input', () => {
                if (state.selectedItem?.type === 'node' && selectedSubNodeId) {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        const sn = node.details.subNodes.find(s => s.id === selectedSubNodeId);
                        if (sn) {
                            sn.text = textInput.value;
                            renderLargeSubFlowchartSVG(node);
                            renderSubNodeCustomizer(node, sn);
                        }
                    }
                }
            });
        }
    }

    let subConnectMode = false;   // true = รอคลิกจากกล่อง → กล่อง
    let subConnFromId = null;      // id ของกล่องต้นทาง
    let selectedSubConnIdx = -1;   // index ของเส้นที่เลือกอยู่

    function renderLargeSubFlowchartSVG(node) {
        const svg = getElem('large-subflow-svg');
        if (!svg) return;
        svg.innerHTML = '';

        // Calculate ViewBox with Unlimited Zoom support
        const baseW = 780;
        const baseH = 420;
        const vbW = baseW / subflowModalZoom;
        const vbH = baseH / subflowModalZoom;
        svg.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);

        const zoomText = getElem('subflow-zoom-text');
        if (zoomText) zoomText.textContent = `${Math.round(subflowModalZoom * 100)}%`;

        if (!node.details.subNodes || !Array.isArray(node.details.subNodes)) {
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
            gridRect.setAttribute('width', '100%');
            gridRect.setAttribute('height', '100%');
            gridRect.setAttribute('fill', 'url(#subflow-grid-pattern)');
            svg.appendChild(gridRect);
        }

        // Render Connections
        (node.details.subConns || []).forEach((conn, connIdx) => {
            const fromSN = node.details.subNodes.find(sn => sn.id === conn.from);
            const toSN = node.details.subNodes.find(sn => sn.id === conn.to);
            if (!fromSN || !toSN) return;

            const isConnSel = selectedSubConnIdx === connIdx;

            if (conn.isLoopback) {
                const midX = (fromSN.x + toSN.x) / 2;
                const midY = fromSN.y + fromSN.h + 40;

                const pathNo = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathNo.setAttribute('d', `M ${fromSN.x + fromSN.w/2},${fromSN.y + fromSN.h} L ${fromSN.x + fromSN.w/2},${fromSN.y + fromSN.h + 40} L ${toSN.x + toSN.w/2},${fromSN.y + fromSN.h + 40} L ${toSN.x + toSN.w/2},${toSN.y + toSN.h}`);
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
                svg.appendChild(pathNo);

                if (conn.text) {
                    const txtNo = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    txtNo.setAttribute('x', (fromSN.x + toSN.x) / 2); txtNo.setAttribute('y', fromSN.y + fromSN.h + 24);
                    txtNo.setAttribute('font-size', '11px'); txtNo.setAttribute('fill', '#ef4444'); txtNo.setAttribute('font-weight', 'bold');
                    txtNo.textContent = conn.text;
                    svg.appendChild(txtNo);
                }
            } else {
                const isVert = Math.abs(fromSN.x - toSN.x) < Math.abs(fromSN.y - toSN.y);
                const x1 = isVert ? fromSN.x + fromSN.w/2 : fromSN.x + fromSN.w;
                const y1 = isVert ? fromSN.y + fromSN.h : fromSN.y + fromSN.h/2;
                const x2 = isVert ? toSN.x + toSN.w/2 : toSN.x;
                const y2 = isVert ? toSN.y : toSN.y + toSN.h/2;

                // Thick invisible hit-box line for easy clicking/selecting
                const hitLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                hitLine.setAttribute('x1', x1); hitLine.setAttribute('y1', y1);
                hitLine.setAttribute('x2', x2); hitLine.setAttribute('y2', y2);
                hitLine.setAttribute('stroke', 'transparent');
                hitLine.setAttribute('stroke-width', '24');
                hitLine.style.cursor = 'pointer';
                hitLine.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedSubConnIdx = connIdx;
                    selectedSubNodeId = null;
                    renderLargeSubFlowchartSVG(node);
                });
                svg.appendChild(hitLine);

                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', x1); line.setAttribute('y1', y1);
                line.setAttribute('x2', x2); line.setAttribute('y2', y2);
                line.setAttribute('stroke', isConnSel ? '#06b6d4' : '#4f46e5');
                line.setAttribute('stroke-width', isConnSel ? '3.5' : '2');
                line.setAttribute('marker-end', 'url(#large-sub-arrow)');
                line.style.cursor = 'pointer';
                line.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedSubConnIdx = connIdx;
                    selectedSubNodeId = null;
                    renderLargeSubFlowchartSVG(node);
                });
                svg.appendChild(line);

                if (conn.text) {
                    const txtYes = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    txtYes.setAttribute('x', (x1 + x2) / 2 + 12); txtYes.setAttribute('y', (y1 + y2) / 2 - 12);
                    txtYes.setAttribute('font-size', '11px'); txtYes.setAttribute('fill', '#10b981'); txtYes.setAttribute('font-weight', 'bold');
                    txtYes.textContent = conn.text;
                    svg.appendChild(txtYes);
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
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.border || '#4f46e5'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            } else if (sn.type === 'decision') {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                shape.setAttribute('points', `${sn.w/2},0 ${sn.w},${sn.h/2} ${sn.w/2},${sn.h} 0,${sn.h/2}`);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.border || '#4f46e5'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            } else if (sn.type === 'inputoutput') {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
                const off = sn.w * 0.15;
                shape.setAttribute('points', `${off},0 ${sn.w},0 ${sn.w - off},${sn.h} 0,${sn.h}`);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.border || '#4f46e5'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            } else if (sn.type === 'document') {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                const wH = sn.h * 0.85;
                shape.setAttribute('d', `M 0,0 L ${sn.w},0 L ${sn.w},${wH} Q ${sn.w * 0.75},${sn.h * 1.1} ${sn.w * 0.5},${wH} T 0,${wH} Z`);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.border || '#4f46e5'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            } else {
                shape = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
                shape.setAttribute('width', sn.w); shape.setAttribute('height', sn.h);
                shape.setAttribute('rx', 6);
                shape.setAttribute('fill', sn.bg || '#ffffff');
                shape.setAttribute('stroke', isSel ? '#4f46e5' : (sn.border || '#4f46e5'));
                shape.setAttribute('stroke-width', isSel ? '3' : '2');
            }

            g.appendChild(shape);

            const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            const txtY = sn.type.startsWith('issue-') ? 38 : sn.h / 2;
            txt.setAttribute('x', sn.w / 2);
            txt.setAttribute('y', txtY);
            txt.setAttribute('font-size', '11px');
            txt.setAttribute('font-weight', '600');
            txt.setAttribute('font-family', "'Prompt', 'IBM Plex Sans Thai', 'Sarabun', sans-serif");
            txt.setAttribute('fill', sn.type === 'issue-red' ? '#dc2626' : sn.type === 'issue-yellow' ? '#b45309' : sn.type === 'issue-green' ? '#047857' : '#0f172a');
            txt.setAttribute('text-anchor', 'middle');
            txt.setAttribute('dominant-baseline', 'central');
            txt.textContent = sn.text || 'ขั้นตอนย่อย';
            g.appendChild(txt);

            // Highlight if this node is selected as connection source
            if (subConnFromId === sn.id) {
                if (shape.tagName === 'rect' || shape.tagName === 'polygon' || shape.tagName === 'path') {
                    shape.setAttribute('stroke', '#06b6d4');
                    shape.setAttribute('stroke-width', '3.5');
                }
            }

            // Render Anchor Ports for connecting
            const anchorCoords = [
                { x: sn.w / 2, y: 0 },
                { x: sn.w, y: sn.h / 2 },
                { x: sn.w / 2, y: sn.h },
                { x: 0, y: sn.h / 2 }
            ];
            anchorCoords.forEach(pt => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', pt.x);
                circle.setAttribute('cy', pt.y);
                circle.setAttribute('r', subConnectMode ? '5' : '3.5');
                circle.setAttribute('fill', subConnFromId === sn.id ? '#06b6d4' : '#4f46e5');
                circle.setAttribute('stroke', '#ffffff');
                circle.setAttribute('stroke-width', '1.5');
                circle.style.opacity = subConnectMode ? '1' : '0.4';
                circle.style.cursor = 'pointer';
                g.appendChild(circle);
            });

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
                    const dx = moveEvent.clientX - startClientX;
                    const dy = moveEvent.clientY - startClientY;
                    sn.x = Math.max(5, Math.min(640, origX + dx));
                    sn.y = Math.max(5, Math.min(340, origY + dy));

                    g.setAttribute('transform', `translate(${sn.x}, ${sn.y})`);
                    renderLargeSubFlowchartSVG(node);
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
                if (!sn.details) sn.details = { desc: '', steps: '', owner: '', docs: '', issues: [], subNodes: [], subConns: [] };
                openSubflowModal(sn, true);
            });

            svg.appendChild(g);
        });
    }

    function drillDownSubNodeToNestedFlow(parentNode, subNode) {
        if (!subNode || subNode.type.startsWith('issue-')) return;
        openSubflowModal(subNode, true);
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

        if (btnZoomIn) {
            btnZoomIn.addEventListener('click', () => {
                subflowModalZoom = Math.min(5.0, subflowModalZoom + 0.15);
                if (activeSubflowCurrentNode) renderLargeSubFlowchartSVG(activeSubflowCurrentNode);
            });
        }
        if (btnZoomOut) {
            btnZoomOut.addEventListener('click', () => {
                subflowModalZoom = Math.max(0.3, subflowModalZoom - 0.15);
                if (activeSubflowCurrentNode) renderLargeSubFlowchartSVG(activeSubflowCurrentNode);
            });
        }
        if (btnZoomReset) {
            btnZoomReset.addEventListener('click', () => {
                subflowModalZoom = 1.0;
                if (activeSubflowCurrentNode) renderLargeSubFlowchartSVG(activeSubflowCurrentNode);
            });
        }
        if (largeSvg) {
            largeSvg.addEventListener('wheel', (e) => {
                e.preventDefault();
                if (e.deltaY < 0) {
                    subflowModalZoom = Math.min(5.0, subflowModalZoom + 0.1);
                } else {
                    subflowModalZoom = Math.max(0.3, subflowModalZoom - 0.1);
                }
                if (activeSubflowCurrentNode) renderLargeSubFlowchartSVG(activeSubflowCurrentNode);
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

        if (modalLeftText) {
            modalLeftText.addEventListener('input', () => {
                const node = subflowModalStack[0];
                if (node) {
                    node.text = modalLeftText.value;
                    const titleElem = getElem('modal-node-title');
                    if (titleElem) titleElem.textContent = node.text.replace(/\n/g, ' ') || 'กล่องกระบวนการ';
                    renderOriginalBoxPreview(node);
                    renderCanvas();
                }
            });
        }

        if (btnAddProc) {
            btnAddProc.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        const newId = `sub-${Date.now()}`;
                        const count = node.details.subNodes.length + 1;
                        const prevNode = node.details.subNodes[node.details.subNodes.length - 1];
                        const newX = prevNode ? Math.min(600, prevNode.x + 160) : 200;

                        const newSubNode = {
                            id: newId,
                            type: 'process',
                            text: `ขั้นตอนย่อยที่ ${count}`,
                            x: newX,
                            y: 48,
                            w: 150,
                            h: 52,
                            bg: '#eef2ff',
                            border: '#4f46e5'
                        };
                        node.details.subNodes.push(newSubNode);
                        if (prevNode) {
                            if (!node.details.subConns) node.details.subConns = [];
                            node.details.subConns.push({ from: prevNode.id, to: newId, text: '' });
                        }
                        selectedSubNodeId = newId;
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }

        if (btnAddDec) {
            btnAddDec.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        const newId = `sub-${Date.now()}`;
                        const prevNode = node.details.subNodes[node.details.subNodes.length - 1];
                        const newX = prevNode ? Math.min(600, prevNode.x + 160) : 350;

                        const newSubNode = {
                            id: newId,
                            type: 'decision',
                            text: 'ตรวจสอบเงื่อนไข?',
                            x: newX,
                            y: 40,
                            w: 140,
                            h: 70,
                            bg: '#fffbeb',
                            border: '#f59e0b'
                        };
                        node.details.subNodes.push(newSubNode);
                        if (prevNode) {
                            if (!node.details.subConns) node.details.subConns = [];
                            node.details.subConns.push({ from: prevNode.id, to: newId, text: '' });
                        }
                        selectedSubNodeId = newId;
                        renderLargeSubFlowchartSVG(node);
                    }
                }
            });
        }

        if (btnAddIssueRed) {
            btnAddIssueRed.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        const newId = `sub-${Date.now()}`;
                        const issueText = prompt("ระบุรายละเอียดปัญหา Red Flag ที่พบในผังย่อย:", "🚩 ปัญหาคอขวดขั้นตอนย่อย");
                        if (issueText && issueText.trim()) {
                            const newSubNode = {
                                id: newId,
                                type: 'issue-red',
                                text: issueText.trim(),
                                x: 250,
                                y: 150,
                                w: 200,
                                h: 60,
                                bg: '#fef2f2',
                                border: '#ef4444'
                            };
                            node.details.subNodes.push(newSubNode);
                            selectedSubNodeId = newId;
                            renderLargeSubFlowchartSVG(node);
                        }
                    }
                }
            });
        }

        // Toggle Connection Mode
        if (btnConnectSub) {
            btnConnectSub.addEventListener('click', () => {
                subConnectMode = !subConnectMode;
                subConnFromId = null;
                if (subConnectMode) {
                    btnConnectSub.style.background = '#06b6d4';
                    btnConnectSub.style.color = '#ffffff';
                } else {
                    btnConnectSub.style.background = '';
                    btnConnectSub.style.color = '#0284c7';
                }
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node) renderLargeSubFlowchartSVG(node);
                }
            });
        }

        // Delete Selected Line
        if (btnDelConn) {
            btnDelConn.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subConns) {
                        if (selectedSubConnIdx >= 0 && selectedSubConnIdx < node.details.subConns.length) {
                            node.details.subConns.splice(selectedSubConnIdx, 1);
                            selectedSubConnIdx = -1;
                            renderLargeSubFlowchartSVG(node);
                        } else if (node.details.subConns.length > 0) {
                            node.details.subConns.pop();
                            renderLargeSubFlowchartSVG(node);
                        } else {
                            alert('⚠️ ไม่มีเส้นเชื่อมในผังย่อยนี้ให้ลบครับ');
                        }
                    }
                }
            });
        }

        // Delete Selected Box (Toolbar Button)
        if (btnDelSub) {
            btnDelSub.addEventListener('click', () => {
                if (state.selectedItem?.type === 'node') {
                    const node = getCurrentPage().nodes.find(n => n.id === state.selectedItem.id);
                    if (node && node.details?.subNodes) {
                        if (selectedSubNodeId) {
                            node.details.subNodes = node.details.subNodes.filter(sn => sn.id !== selectedSubNodeId);
                            node.details.subConns = (node.details.subConns || []).filter(sc => sc.from !== selectedSubNodeId && sc.to !== selectedSubNodeId);
                            selectedSubNodeId = null;
                            renderLargeSubFlowchartSVG(node);
                        } else if (node.details.subNodes.length > 0) {
                            const lastSN = node.details.subNodes.pop();
                            node.details.subConns = (node.details.subConns || []).filter(sc => sc.from !== lastSN.id && sc.to !== lastSN.id);
                            renderLargeSubFlowchartSVG(node);
                        }
                    }
                }
            });
        }

        if (btnSave) {
            btnSave.addEventListener('click', () => {
                const rootNode = subflowModalStack[0];
                if (rootNode) {
                    const modalLeftText = getElem('modal-left-text');
                    if (modalLeftText) rootNode.text = modalLeftText.value;
                }
                if (activeSubflowCurrentNode) {
                    const modalDesc = getElem('modal-desc');
                    const modalSteps = getElem('modal-steps');
                    const modalOwner = getElem('modal-owner');

                    if (modalDesc) activeSubflowCurrentNode.details.desc = modalDesc.value.trim();
                    if (modalSteps) activeSubflowCurrentNode.details.steps = modalSteps.value.trim();
                    if (modalOwner) activeSubflowCurrentNode.details.owner = modalOwner.value.trim();
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
            rowBg.setAttribute('fill', index % 2 === 0 ? 'rgba(248, 250, 252, 0.4)' : 'rgba(241, 245, 249, 0.4)');
            g.appendChild(rowBg);

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

            const textLen = (dept.name || 'แผนก').length;
            const pillW = Math.max(160, textLen * 9 + 45);
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
            pillText.setAttribute('font-size', '13px');
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

        page.connections.forEach(conn => {
            renderConnectionSVG(conn);
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

        if (node.type !== 'subprocess' && node.type !== 'swimlane' && !node.type.startsWith('issue-')) {
            shapeElem.setAttribute('fill', bg);
            shapeElem.setAttribute('stroke', border);
            shapeElem.setAttribute('stroke-width', isSelected ? '2.5' : '1.5');
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

        // RED / YELLOW / GREEN FLAG BADGE ON CANVAS NODE (for process boxes)
        if (!node.type.startsWith('issue-')) {
            const issues = node.details?.issues || [];
            if (issues.length > 0) {
                const hasRed = issues.some(i => i.flag === 'red');
                const hasYellow = issues.some(i => i.flag === 'yellow');
                const flagColor = hasRed ? '#ef4444' : hasYellow ? '#f59e0b' : '#10b981';

                const flagBadgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                flagBadgeGroup.setAttribute('transform', `translate(${w - 14}, 12)`);
                flagBadgeGroup.setAttribute('style', 'cursor: pointer;');

                const flagBg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                flagBg.setAttribute('r', 10);
                flagBg.setAttribute('fill', flagColor);
                flagBg.setAttribute('stroke', '#ffffff');
                flagBg.setAttribute('stroke-width', '1.5');
                flagBadgeGroup.appendChild(flagBg);

                const flagTxt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                flagTxt.setAttribute('font-size', '9px');
                flagTxt.setAttribute('fill', '#ffffff');
                flagTxt.setAttribute('font-weight', 'bold');
                flagTxt.setAttribute('text-anchor', 'middle');
                flagTxt.setAttribute('dominant-baseline', 'central');
                flagTxt.textContent = `🚩${issues.length}`;
                flagBadgeGroup.appendChild(flagTxt);

                g.appendChild(flagBadgeGroup);
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
            anchorCircle.setAttribute('r', 5);
            anchorCircle.setAttribute('data-node-id', node.id);
            anchorCircle.setAttribute('data-anchor', pos);

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

    function renderConnectionSVG(conn) {
        const page = getCurrentPage();
        const fromNode = page.nodes.find(n => n.id === conn.fromNodeId);
        const toNode = page.nodes.find(n => n.id === conn.toNodeId);

        if (!fromNode || !toNode) return;

        const fromPos = getAnchorPositions(fromNode)[conn.fromAnchor || 'right'];
        const toPos = getAnchorPositions(toNode)[conn.toAnchor || 'left'];

        const isSelected = state.selectedItem && state.selectedItem.type === 'connection' && state.selectedItem.id === conn.id;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', `flow-connection-group ${isSelected ? 'selected' : ''}`);
        g.setAttribute('data-id', conn.id);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        const d = calculatePathD(fromPos, toPos, conn.style || 'orthogonal', conn.fromAnchor, conn.toAnchor);
        
        path.setAttribute('d', d);
        path.setAttribute('fill', 'none');
        path.setAttribute('class', `flow-connection ${isSelected ? 'selected' : ''}`);
        path.setAttribute('stroke', isSelected ? '#4f46e5' : (conn.color || '#475569'));
        path.setAttribute('stroke-width', conn.width || 2);
        if (conn.dash && conn.dash !== 'none') {
            path.setAttribute('stroke-dasharray', conn.dash);
        }
        path.setAttribute('marker-end', isSelected ? 'url(#arrow-selected)' : 'url(#arrow)');

        g.appendChild(path);

        if (conn.text) {
            const midPoint = getPathMidPoint(fromPos, toPos);

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

    function calculatePathD(start, end, style, fromAnchor, toAnchor) {
        if (style === 'straight') {
            return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        }

        if (style === 'bezier') {
            let dx = (end.x - start.x) / 2;
            let dy = (end.y - start.y) / 2;
            let cx1 = start.x + (fromAnchor === 'right' ? dx : fromAnchor === 'left' ? -dx : 0);
            let cy1 = start.y + (fromAnchor === 'bottom' ? dy : fromAnchor === 'top' ? -dy : 0);
            let cx2 = end.x + (toAnchor === 'left' ? -dx : toAnchor === 'right' ? dx : 0);
            let cy2 = end.y + (toAnchor === 'top' ? -dy : toAnchor === 'bottom' ? dy : 0);
            return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
        }

        const midX = (start.x + end.x) / 2;
        if (fromAnchor === 'top' || fromAnchor === 'bottom') {
            const midY = (start.y + end.y) / 2;
            return `M ${start.x} ${start.y} L ${start.x} ${midY} L ${end.x} ${midY} L ${end.x} ${end.y}`;
        }
        return `M ${start.x} ${start.y} L ${midX} ${start.y} L ${midX} ${end.y} L ${end.x} ${end.y}`;
    }

    function getPathMidPoint(p1, p2) {
        return {
            x: (p1.x + p2.x) / 2,
            y: (p1.y + p2.y) / 2
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
                        newX = Math.round(newX / gridSize) * gridSize;
                        newY = Math.round(newY / gridSize) * gridSize;
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

                    node.width = Math.max(70, Math.round(origW + dw));
                    node.height = Math.max(40, Math.round(origH + dh));

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

        gElem.addEventListener('click', (e) => {
            if (state.currentTool === 'connect') {
                e.stopPropagation();
                if (!state.firstConnectNodeId) {
                    state.firstConnectNodeId = node.id;
                    selectItem('node', node.id, false);
                } else if (state.firstConnectNodeId !== node.id) {
                    const page = getCurrentPage();
                    const newConn = {
                        id: `conn-${Date.now()}`,
                        fromNodeId: state.firstConnectNodeId,
                        fromAnchor: 'right',
                        toNodeId: node.id,
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
                }
            }
        });
    }

    function startConnectionDrag(nodeId, anchorPos, e) {
        e.stopPropagation();
        const page = getCurrentPage();
        const node = page.nodes.find(n => n.id === nodeId);
        if (!node) return;

        const anchorCoord = getAnchorPositions(node)[anchorPos];

        state.connecting = {
            active: true,
            fromNodeId: nodeId,
            fromAnchor: anchorPos,
            startX: anchorCoord.x,
            startY: anchorCoord.y
        };

        const tempConn = getElem('temp-connection');
        if (tempConn) tempConn.style.display = 'block';

        const onMouseMove = (moveEvent) => {
            if (!state.connecting.active) return;

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
            if (tempConn) tempConn.setAttribute('d', d);
        };

        const onMouseUp = (upEvent) => {
            if (tempConn) tempConn.style.display = 'none';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            if (!state.connecting.active) return;

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

            if (toNodeId && toNodeId !== state.connecting.fromNodeId) {
                const newConn = {
                    id: `conn-${Date.now()}`,
                    fromNodeId: state.connecting.fromNodeId,
                    fromAnchor: state.connecting.fromAnchor,
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

            state.connecting.active = false;
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
            const connColor = getElem('conn-color');
            const connWidth = getElem('conn-width');

            if (connTextInput) connTextInput.value = conn.text || '';
            if (connStyleSelect) connStyleSelect.value = conn.style || 'orthogonal';
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
                        node.linkTargetNodeId = nodeLinkPageSelect.value;
                        renderCanvas();
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

            saveHistoryState();
        });
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
                if (state.currentTool === 'pan' || e.button === 1) {
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

        const exportPng = getElem('export-png');
        if (exportPng) {
            exportPng.addEventListener('click', (e) => {
                e.preventDefault();
                const viewport = getElem('canvas-viewport');
                if (viewport) {
                    html2canvas(viewport).then(canvas => {
                        const link = document.createElement('a');
                        link.download = `${state.title.replace(/\s+/g, '_')}.png`;
                        link.href = canvas.toDataURL('image/png');
                        link.click();
                    });
                }
            });
        }

        const exportSvg = getElem('export-svg');
        if (exportSvg) {
            exportSvg.addEventListener('click', (e) => {
                e.preventDefault();
                const svg = getElem('flow-svg');
                if (svg) {
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
                    const svgUrl = URL.createObjectURL(svgBlob);
                    const downloadLink = document.createElement("a");
                    downloadLink.href = svgUrl;
                    downloadLink.download = `${state.title.replace(/\s+/g, '_')}.svg`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
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
