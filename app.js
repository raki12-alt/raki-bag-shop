/**
 * RAKI BAG SHOP MANAGEMENT SYSTEM - CORE ENTERPRISE ENGINE
 * Incorporating Live Reactive Data Layer Architecture, POS, Analytics Pipeline and Firebase Strategy
 */

// --- FIRESTORE / MOCK FALLBACK DUAL LAYER DATABASE INITIALIZATION ---
const FirebaseEngineInstance = {
    isLive: false,
    db: {
        products: JSON.parse(localStorage.getItem('raki_products')) || [],
        sales: JSON.parse(localStorage.getItem('raki_sales')) || [],
        expenses: JSON.parse(localStorage.getItem('raki_expenses')) || [],
        customers: JSON.parse(localStorage.getItem('raki_customers')) || [
            { id: "CUST-001", name: "Almaz Kebede", phone: "0911223344", count: 3, total: 4500, tier: "Gold" },
            { id: "CUST-002", name: "Bekele Yohannes", phone: "0912334455", count: 1, total: 1200, tier: "Bronze" }
        ],
        settings: JSON.parse(localStorage.getItem('raki_settings')) || { name: "RAKI BAG SHOP", currency: "ETB" }
    },
    sync(table) {
        localStorage.setItem(`raki_${table}`, JSON.stringify(this.db[table]));
        SystemApplicationPipeline.reactiveMetricsEngine();
    }
};

// --- SYSTEM STATE PROFILE MACHINE ---
const AppStateProfile = {
    activeSessionUser: null,
    activeSessionRole: null,
    currentActiveModuleView: "dashboard-section",
    activePOSCartRegistry: [],
    instantiatedChartsReferences: {}
};

// --- CORE SYSTEM PIPELINE ---
const SystemApplicationPipeline = {

    initializeCoreInfrastructure() {
        this.registerDOMEventBindings();
        this.routeModuleViewNavigation();
        this.reactiveMetricsEngine();
        this.posCatalogRenderEngine();
        this.inventoryTableRenderEngine();
        this.expenseTableRenderEngine();
        this.customerTableRenderEngine();
        this.renderSystemNotificationManager();
    },

    registerDOMEventBindings() {
        // Module Router Engine
        document.querySelectorAll('.sidebar-menu .menu-item').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.sidebar-menu .menu-item').forEach(i => i.classList.remove('active'));
                link.classList.add('active');

                const targetViewId = link.getAttribute('data-target');
                this.switchActiveModuleView(targetViewId);
            });
        });

        // Authentication Engine Handler
        const authForm = document.getElementById('auth-form');
        if (authForm) {
            authForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const email = document.getElementById('auth-email').value;
                const role = document.getElementById('auth-role').value;

                AppStateProfile.activeSessionUser = email;
                AppStateProfile.activeSessionRole = role;

                const userDisplay = document.getElementById('user-display-name');
                const roleDisplay = document.getElementById('user-display-role');
                if (userDisplay) userDisplay.innerText = email.split('@')[0].toUpperCase();
                if (roleDisplay) roleDisplay.innerText = role.toUpperCase();

                // Enforce Functional ACL Permissions
                const productModalBtn = document.getElementById('open-product-modal');
                if (role === 'employee') {
                    if (productModalBtn) productModalBtn.style.display = 'none';
                    document.querySelectorAll('.menu-item[data-target="reports-section"], .menu-item[data-target="settings-section"]').forEach(el => el.style.display = 'none');
                } else {
                    if (productModalBtn) productModalBtn.style.display = 'inline-flex';
                    document.querySelectorAll('.menu-item').forEach(el => el.style.display = 'flex');
                }

                document.getElementById('auth-container')?.classList.add('hidden');
                document.getElementById('app-container')?.classList.remove('hidden');
                this.instantiateAnalyticsReportingGraphics();
            });
        }

        // Sign Out Controller
        document.getElementById('btn-logout')?.addEventListener('click', () => {
            AppStateProfile.activeSessionUser = null;
            AppStateProfile.activeSessionRole = null;
            document.getElementById('app-container')?.classList.add('hidden');
            document.getElementById('auth-container')?.classList.remove('hidden');
        });

        // Dark/Light Presentation Theme Toggle
        document.getElementById('theme-toggle')?.addEventListener('click', () => {
            const documentElement = document.documentElement;
            const currentThemeMode = documentElement.getAttribute('data-theme');
            const targetThemeMode = currentThemeMode === 'light' ? 'dark' : 'light';
            documentElement.setAttribute('data-theme', targetThemeMode);
            const toggleBtn = document.getElementById('theme-toggle');
            if (toggleBtn) {
                toggleBtn.innerHTML = targetThemeMode === 'light'
                    ? '<i class="fa-solid fa-moon"></i>'
                    : '<i class="fa-solid fa-sun"></i>';
            }
        });

        // Modal Controls Engine Bindings
        this.setupModalTriggerBind("open-product-modal", "product-modal", () => document.getElementById('product-form')?.reset());
        this.setupModalTriggerBind("open-expense-modal", "expense-modal", () => document.getElementById('expense-form')?.reset());
        this.setupModalTriggerBind("open-customer-modal", "customer-modal", () => document.getElementById('customer-form')?.reset());

        // Modal Close Bindings across all elements
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.modal-overlay').forEach(mo => mo.classList.add('hidden'));
            });
        });

        // Product Form Submit Pipeline
        document.getElementById('product-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const targetIdField = document.getElementById('prod-id').value;

            const productPayload = {
                id: targetIdField || "PROD-" + Date.now(),
                barcode: document.getElementById('prod-barcode').value,
                name: document.getElementById('prod-name').value,
                category: document.getElementById('prod-category').value,
                brand: document.getElementById('prod-brand').value,
                color: document.getElementById('prod-color').value,
                size: document.getElementById('prod-size').value,
                qty: parseInt(document.getElementById('prod-qty').value) || 0,
                buyPrice: parseFloat(document.getElementById('prod-buy-price').value) || 0,
                sellPrice: parseFloat(document.getElementById('prod-sell-price').value) || 0,
                image: document.getElementById('prod-image').value || "https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=200&auto=format&fit=crop"
            };

            if (targetIdField) {
                const index = FirebaseEngineInstance.db.products.findIndex(p => p.id === targetIdField);
                if (index !== -1) FirebaseEngineInstance.db.products[index] = productPayload;
            } else {
                FirebaseEngineInstance.db.products.push(productPayload);
            }

            FirebaseEngineInstance.sync('products');
            this.inventoryTableRenderEngine();
            this.posCatalogRenderEngine();
            document.getElementById('product-modal')?.classList.add('hidden');
        });

        // Expense Form Log Processing Pipeline
        document.getElementById('expense-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const expensePayload = {
                date: new Date().toLocaleDateString(),
                category: document.getElementById('exp-category').value,
                desc: document.getElementById('exp-desc').value,
                amount: parseFloat(document.getElementById('exp-amount').value) || 0
            };
            FirebaseEngineInstance.db.expenses.push(expensePayload);
            FirebaseEngineInstance.sync('expenses');
            this.expenseTableRenderEngine();
            document.getElementById('expense-modal')?.classList.add('hidden');
        });

        // Customer Form Management Setup
        document.getElementById('customer-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            const customerPayload = {
                id: "CUST-" + Date.now().toString().slice(-4),
                name: document.getElementById('cust-name').value,
                phone: document.getElementById('cust-phone').value,
                count: 0,
                total: 0,
                tier: "Bronze"
            };
            FirebaseEngineInstance.db.customers.push(customerPayload);
            FirebaseEngineInstance.sync('customers');
            this.customerTableRenderEngine();
            this.posCatalogRenderEngine();
            document.getElementById('customer-modal')?.classList.add('hidden');
        });

        // POS Search and Filter Mechanics Live Bindings
        document.getElementById('pos-search-input')?.addEventListener('input', () => this.posCatalogRenderEngine());
        document.getElementById('pos-category-filter')?.addEventListener('change', () => this.posCatalogRenderEngine());

        // POS Checkout Variable Processing Engine
        document.getElementById('pos-discount')?.addEventListener('input', () => this.calculatePOSCartFinancialBreakdownTotals());
        document.getElementById('pos-tax')?.addEventListener('input', () => this.calculatePOSCartFinancialBreakdownTotals());

        // Checkout Button Execution Event
        document.getElementById('pos-complete-order')?.addEventListener('click', () => this.executePOSCartTransactionFinalization());

        // Notification Menu Interface Trigger Anchor
        document.getElementById('alert-trigger')?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.getElementById('notification-menu')?.classList.toggle('hidden');
        });
        document.addEventListener('click', () => document.getElementById('notification-menu')?.classList.add('hidden'));

        // Corporate Setting Sync Form Pipeline
        document.getElementById('save-shop-settings')?.addEventListener('click', () => {
            const shopNameInput = document.getElementById('setting-shop-name');
            if (shopNameInput) {
                FirebaseEngineInstance.db.settings.name = shopNameInput.value;
                FirebaseEngineInstance.sync('settings');
                alert('Store Configurations Updated Successfully Across Active Nodes');
            }
        });

        // Automated Backup File Generator
        document.getElementById('btn-backup-system')?.addEventListener('click', () => {
            const fullSystemDataDumpString = JSON.stringify(FirebaseEngineInstance.db);
            const dataDataUriScheme = 'data:application/json;charset=utf-8,' + encodeURIComponent(fullSystemDataDumpString);
            const downloadAnchorElement = document.createElement('a');
            downloadAnchorElement.setAttribute('href', dataDataUriScheme);
            downloadAnchorElement.setAttribute('download', `RAKI_BAGS_BACKUP_${new Date().toISOString().slice(0, 10)}.json`);
            downloadAnchorElement.click();
        });
    },

    setupModalTriggerBind(triggerId, modalId, preInitCallback) {
        document.getElementById(triggerId)?.addEventListener('click', () => {
            if (preInitCallback) preInitCallback();
            document.getElementById(modalId)?.classList.remove('hidden');
        });
    },

    switchActiveModuleView(targetViewId) {
        AppStateProfile.currentActiveModuleView = targetViewId;
        document.querySelectorAll('.workspace-section').forEach(sec => sec.classList.add('hidden'));
        document.getElementById(targetViewId)?.classList.remove('hidden');

        if (targetViewId === 'dashboard-section') {
            this.instantiateAnalyticsReportingGraphics();
        }
    },

    routeModuleViewNavigation() {
        const hash = window.location.hash;
        if (hash) {
            const match = document.querySelector(`.menu-item[href="${hash}"]`);
            if (match) match.click();
        }
    },

    reactiveMetricsEngine() {
        const products = FirebaseEngineInstance.db.products;
        const sales = FirebaseEngineInstance.db.sales;
        const expenses = FirebaseEngineInstance.db.expenses;

        let totalAssetStockValue = 0;
        let runningLowStockAlertCount = 0;
        products.forEach(p => {
            totalAssetStockValue += (p.qty * p.buyPrice);
            if (p.qty <= 5) runningLowStockAlertCount++;
        });

        let todaySalesValue = 0;
        let weeklySalesValue = 0;
        let monthlySalesValue = 0;
        let totalGrossRevenue = 0;
        let totalNetProfitMargin = 0;

        const currentTimestampDate = new Date();

        sales.forEach(sale => {
            totalGrossRevenue += sale.grandTotal;
            totalNetProfitMargin += sale.profitCollected;

            const saleDateObject = new Date(sale.timestamp);
            const absoluteDayDifferential = Math.floor((currentTimestampDate - saleDateObject) / (1000 * 60 * 60 * 24));

            if (absoluteDayDifferential === 0) todaySalesValue += sale.grandTotal;
            if (absoluteDayDifferential <= 7) weeklySalesValue += sale.grandTotal;
            if (absoluteDayDifferential <= 30) monthlySalesValue += sale.grandTotal;
        });

        let totalAggregatedOutflowExpenses = 0;
        expenses.forEach(e => totalAggregatedOutflowExpenses += e.amount);

        const absoluteComputedNetProfit = totalNetProfitMargin - totalAggregatedOutflowExpenses;

        const setFieldText = (id, text) => {
            const el = document.getElementById(id);
            if (el) el.innerText = text;
        };

        setFieldText('dash-today-sales', todaySalesValue.toFixed(2) + " ETB");
        setFieldText('dash-weekly-sales', weeklySalesValue.toFixed(2) + " ETB");
        setFieldText('dash-monthly-sales', monthlySalesValue.toFixed(2) + " ETB");
        setFieldText('dash-total-revenue', totalGrossRevenue.toFixed(2) + " ETB");
        setFieldText('dash-net-profit', absoluteComputedNetProfit.toFixed(2) + " ETB");
        setFieldText('dash-total-expenses', totalAggregatedOutflowExpenses.toFixed(2) + " ETB");
        setFieldText('dash-inventory-value', totalAssetStockValue.toFixed(2) + " ETB");
        setFieldText('dash-low-stock-count', runningLowStockAlertCount + " Items");

        setFieldText('report-gross', totalGrossRevenue.toFixed(2) + " ETB");
        setFieldText('report-expenses', totalAggregatedOutflowExpenses.toFixed(2) + " ETB");
        setFieldText('report-net', absoluteComputedNetProfit.toFixed(2) + " ETB");
    },

    instantiateAnalyticsReportingGraphics() {
        const sales = FirebaseEngineInstance.db.sales;
        const expenses = FirebaseEngineInstance.db.expenses;

        Object.keys(AppStateProfile.instantiatedChartsReferences).forEach(key => {
            if (AppStateProfile.instantiatedChartsReferences[key]) {
                AppStateProfile.instantiatedChartsReferences[key].destroy();
            }
        });

        const salesLabels = sales.length ? sales.slice(-7).map(s => new Date(s.timestamp).toLocaleDateString()) : ["Base Line"];
        const salesDataPoints = sales.length ? sales.slice(-7).map(s => s.grandTotal) : [0];

        const chartSalesEl = document.getElementById('chart-sales-trends');
        if (chartSalesEl && typeof Chart !== 'undefined') {
            const ctxSales = chartSalesEl.getContext('2d');
            AppStateProfile.instantiatedChartsReferences['sales'] = new Chart(ctxSales, {
                type: 'line',
                data: {
                    labels: salesLabels,
                    datasets: [{
                        label: 'Gross Revenue Volume (ETB)',
                        data: salesDataPoints,
                        borderColor: '#6366f1',
                        tension: 0.3,
                        fill: true,
                        backgroundColor: 'rgba(99, 102, 241, 0.1)'
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        let totalNetProfitAccumulated = 0;
        sales.forEach(s => totalNetProfitAccumulated += s.profitCollected);
        let totalOutflowExpensesAccumulated = 0;
        expenses.forEach(e => totalOutflowExpensesAccumulated += e.amount);

        const chartProfitExpenseEl = document.getElementById('chart-profit-expense');
        if (chartProfitExpenseEl && typeof Chart !== 'undefined') {
            const ctxProfitExpense = chartProfitExpenseEl.getContext('2d');
            AppStateProfile.instantiatedChartsReferences['profitExpense'] = new Chart(ctxProfitExpense, {
                type: 'bar',
                data: {
                    labels: ['Gross Profit Track', 'Total Expense Pools'],
                    datasets: [{
                        data: [totalNetProfitAccumulated, totalOutflowExpensesAccumulated],
                        backgroundColor: ['#10b981', '#ef4444']
                    }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        const categoryPerformanceCounterMap = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                categoryPerformanceCounterMap[item.category] = (categoryPerformanceCounterMap[item.category] || 0) + item.quantity;
            });
        });

        const chartCategoryEl = document.getElementById('chart-category-performance');
        if (chartCategoryEl && typeof Chart !== 'undefined') {
            const ctxCategory = chartCategoryEl.getContext('2d');
            AppStateProfile.instantiatedChartsReferences['categories'] = new Chart(ctxCategory, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(categoryPerformanceCounterMap).length ? Object.keys(categoryPerformanceCounterMap) : ["Standard"],
                    datasets: [{
                        data: Object.values(categoryPerformanceCounterMap).length ? Object.values(categoryPerformanceCounterMap) : [100],
                        backgroundColor: ['#6366f1', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b']
                    }]
                },
                options: { responsive: true }
            });
        }

        const bestSellerCounterMap = {};
        sales.forEach(sale => {
            sale.items.forEach(item => {
                bestSellerCounterMap[item.name] = (bestSellerCounterMap[item.name] || 0) + item.quantity;
            });
        });

        const chartBestsellerEl = document.getElementById('chart-best-sellers');
        if (chartBestsellerEl && typeof Chart !== 'undefined') {
            const ctxBestseller = chartBestsellerEl.getContext('2d');
            AppStateProfile.instantiatedChartsReferences['bestseller'] = new Chart(ctxBestseller, {
                type: 'polarArea',
                data: {
                    labels: Object.keys(bestSellerCounterMap).slice(0, 5),
                    datasets: [{
                        data: Object.values(bestSellerCounterMap).slice(0, 5),
                        backgroundColor: ['rgba(99, 102, 241, 0.7)', 'rgba(16, 185, 129, 0.7)', 'rgba(245, 158, 11, 0.7)']
                    }]
                },
                options: { responsive: true }
            });
        }
    },

    inventoryTableRenderEngine() {
        const tableBodyElement = document.getElementById('inventory-table-body');
        if (!tableBodyElement) return;
        tableBodyElement.innerHTML = "";

        FirebaseEngineInstance.db.products.forEach(p => {
            const rowItemElement = document.createElement('tr');
            const unitProfitMarginValue = p.sellPrice - p.buyPrice;

            rowItemElement.innerHTML = `
                <td><img src="${p.image}" class="table-img" alt="Bag Image" style="width:40px;height:40px;object-fit:cover;"></td>
                <td><code>${p.barcode}</code></td>
                <td><strong>${p.name}</strong></td>
                <td><span class="badge" style="background:#e2e8f0; color:#1e293b;">${p.category}</span><br><small>${p.brand}</small></td>
                <td><small>Col: ${p.color || 'N/A'}<br>Size: ${p.size || 'N/A'}</small></td>
                <td><span class="badge ${p.qty <= 5 ? 'btn-danger' : 'btn-success'}">${p.qty} Units</span></td>
                <td>${p.buyPrice.toFixed(2)} ETB</td>
                <td>${p.sellPrice.toFixed(2)} ETB</td>
                <td style="color:var(--success-color); font-weight:600;">${unitProfitMarginValue.toFixed(2)} ETB</td>
                <td>
                    <button class="btn btn-primary btn-sm btn-edit-trigger" data-id="${p.id}"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn btn-danger btn-sm btn-delete-trigger" data-id="${p.id}"><i class="fa-solid fa-trash"></i></button>
                </td>
            `;

            rowItemElement.querySelector('.btn-edit-trigger').addEventListener('click', () => this.executeProductEditRecordInterception(p.id));
            rowItemElement.querySelector('.btn-delete-trigger').addEventListener('click', () => this.executeProductDeletionRecordSequence(p.id));

            tableBodyElement.appendChild(rowItemElement);
        });
    },

    executeProductEditRecordInterception(productId) {
        const p = FirebaseEngineInstance.db.products.find(prod => prod.id === productId);
        if (!p) return;

        document.getElementById('prod-id').value = p.id;
        document.getElementById('prod-barcode').value = p.barcode;
        document.getElementById('prod-name').value = p.name;
        document.getElementById('prod-category').value = p.category;
        document.getElementById('prod-brand').value = p.brand;
        document.getElementById('prod-color').value = p.color;
        document.getElementById('prod-size').value = p.size;
        document.getElementById('prod-qty').value = p.qty;
        document.getElementById('prod-buy-price').value = p.buyPrice;
        document.getElementById('prod-sell-price').value = p.sellPrice;
        document.getElementById('prod-image').value = p.image;

        document.getElementById('product-modal')?.classList.remove('hidden');
    },

    executeProductDeletionRecordSequence(productId) {
        if (confirm("Confirm destructive drop action of product mapping profile record?")) {
            FirebaseEngineInstance.db.products = FirebaseEngineInstance.db.products.filter(p => p.id !== productId);
            FirebaseEngineInstance.sync('products');
            this.inventoryTableRenderEngine();
            this.posCatalogRenderEngine();
        }
    },

    posCatalogRenderEngine() {
        const gridContainer = document.getElementById('pos-catalog-grid');
        if (!gridContainer) return;

        const filterCategorySelect = document.getElementById('pos-category-filter');
        const searchInput = document.getElementById('pos-search-input');
        const searchInputKeyword = searchInput ? searchInput.value.toLowerCase() : "";
        const selectedCategoryValue = filterCategorySelect ? filterCategorySelect.value : "";

        gridContainer.innerHTML = "";

        if (filterCategorySelect) {
            const workingCategoriesCollection = [...new Set(FirebaseEngineInstance.db.products.map(p => p.category))];
            filterCategorySelect.innerHTML = `<option value="">All Categories</option>`;
            workingCategoriesCollection.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat;
                option.innerText = cat;
                if (cat === selectedCategoryValue) option.selected = true;
                filterCategorySelect.appendChild(option);
            });
        }

        const customerSelectElement = document.getElementById('pos-customer-select');
        if (customerSelectElement) {
            customerSelectElement.innerHTML = `<option value="walk-in">Anonymous Walk-in Customer</option>`;
            FirebaseEngineInstance.db.customers.forEach(cust => {
                const opt = document.createElement('option');
                opt.value = cust.id;
                opt.innerText = `${cust.name} (${cust.phone})`;
                customerSelectElement.appendChild(opt);
            });
        }

        FirebaseEngineInstance.db.products.forEach(p => {
            const matchSearch = p.name.toLowerCase().includes(searchInputKeyword)
                || p.barcode.includes(searchInputKeyword)
                || p.brand.toLowerCase().includes(searchInputKeyword);
            const matchCategory = !selectedCategoryValue || p.category === selectedCategoryValue;

            if (matchSearch && matchCategory) {
                const catalogItemCard = document.createElement('div');
                catalogItemCard.className = "pos-prod-card";
                catalogItemCard.innerHTML = `
                    <span class="pos-stock-tag">Stock: ${p.qty}</span>
                    <img src="${p.image}" alt="Product Preview" style="width:100%;height:120px;object-fit:cover;">
                    <h5>${p.name}</h5>
                    <span>${p.sellPrice.toFixed(2)} ETB</span>
                `;
                catalogItemCard.addEventListener('click', () => this.addItemToPOSActiveCartRegistry(p));
                gridContainer.appendChild(catalogItemCard);
            }
        });
    },

    addItemToPOSActiveCartRegistry(product) {
        if (product.qty <= 0) {
            alert("Requested bag model profile reports out of stock matrix allocation limit state.");
            return;
        }

        const exactExistingCartMatchItem = AppStateProfile.activePOSCartRegistry.find(item => item.id === product.id);

        if (exactExistingCartMatchItem) {
            if (exactExistingCartMatchItem.quantity + 1 > product.qty) {
                alert("Cannot allocate more items than physical storage availability caps.");
                return;
            }
            exactExistingCartMatchItem.quantity++;
        } else {
            AppStateProfile.activePOSCartRegistry.push({
                id: product.id,
                name: product.name,
                category: product.category,
                sellPrice: product.sellPrice,
                buyPrice: product.buyPrice,
                quantity: 1
            });
        }
        this.renderPOSCartManifestInterface();
    },

    renderPOSCartManifestInterface() {
        const manifestContainer = document.getElementById('pos-cart-manifest');
        if (!manifestContainer) return;
        manifestContainer.innerHTML = "";

        AppStateProfile.activePOSCartRegistry.forEach((item, index) => {
            const cartRowElement = document.createElement('div');
            cartRowElement.className = "cart-row";
            cartRowElement.innerHTML = `
                <div><strong>${item.name}</strong><br><small>${item.sellPrice.toFixed(2)} ETB</small></div>
                <div class="cart-row-qty">
                    <button class="btn-qty-minus">-</button>
                    <span>${item.quantity}</span>
                    <button class="btn-qty-plus">+</button>
                </div>
                <div><strong>${(item.sellPrice * item.quantity).toFixed(2)} ETB</strong></div>
            `;

            cartRowElement.querySelector('.btn-qty-minus').addEventListener('click', () => {
                if (item.quantity - 1 <= 0) {
                    AppStateProfile.activePOSCartRegistry.splice(index, 1);
                } else {
                    item.quantity--;
                }
                this.renderPOSCartManifestInterface();
            });

            cartRowElement.querySelector('.btn-qty-plus').addEventListener('click', () => {
                const prodNode = FirebaseEngineInstance.db.products.find(p => p.id === item.id);
                const physicalStockLimit = prodNode ? prodNode.qty : 0;
                if (item.quantity + 1 > physicalStockLimit) {
                    alert("Physical inventory limits exceeded.");
                    return;
                }
                item.quantity++;
                this.renderPOSCartManifestInterface();
            });

            manifestContainer.appendChild(cartRowElement);
        });

        this.calculatePOSCartFinancialBreakdownTotals();
    },

    calculatePOSCartFinancialBreakdownTotals() {
        let runningCartSubtotalSumValue = 0;
        AppStateProfile.activePOSCartRegistry.forEach(i => runningCartSubtotalSumValue += (i.sellPrice * i.quantity));

        const discountInput = document.getElementById('pos-discount');
        const taxInput = document.getElementById('pos-tax');
        const baseDiscountPercentageRate = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
        const baseTaxPercentageRate = taxInput ? (parseFloat(taxInput.value) || 0) : 0;

        const discountValueDeduction = runningCartSubtotalSumValue * (baseDiscountPercentageRate / 100);
        const intermediateTaxableBasis = runningCartSubtotalSumValue - discountValueDeduction;
        const computedTaxValueAddition = intermediateTaxableBasis * (baseTaxPercentageRate / 100);

        const outputFinalGrandTotalValue = intermediateTaxableBasis + computedTaxValueAddition;

        const subtotalEl = document.getElementById('pos-subtotal');
        const grandTotalEl = document.getElementById('pos-grand-total');
        if (subtotalEl) subtotalEl.innerText = runningCartSubtotalSumValue.toFixed(2) + " ETB";
        if (grandTotalEl) grandTotalEl.innerText = outputFinalGrandTotalValue.toFixed(2) + " ETB";
    },

    executePOSCartTransactionFinalization() {
        if (AppStateProfile.activePOSCartRegistry.length === 0) {
            alert("Active sales context transaction buffer array register empty.");
            return;
        }

        let calculatedAcquisitionCostBasis = 0;
        let calculatedGrossSalesYield = 0;

        AppStateProfile.activePOSCartRegistry.forEach(cartItem => {
            const matchedInventoryProductNode = FirebaseEngineInstance.db.products.find(p => p.id === cartItem.id);
            if (matchedInventoryProductNode) {
                matchedInventoryProductNode.qty -= cartItem.quantity;
            }
            calculatedAcquisitionCostBasis += (cartItem.buyPrice * cartItem.quantity);
            calculatedGrossSalesYield += (cartItem.sellPrice * cartItem.quantity);
        });

        const discountInput = document.getElementById('pos-discount');
        const taxInput = document.getElementById('pos-tax');
        const discountRate = discountInput ? (parseFloat(discountInput.value) || 0) : 0;
        const taxRate = taxInput ? (parseFloat(taxInput.value) || 0) : 0;

        const finalCalculatedGrandTotal = (calculatedGrossSalesYield * (1 - discountRate / 100)) * (1 + taxRate / 100);
        const absoluteProfitCollectedFromSale = finalCalculatedGrandTotal - calculatedAcquisitionCostBasis;

        const customerSelect = document.getElementById('pos-customer-select');
        const targetSelectedCustomerId = customerSelect ? customerSelect.value : "walk-in";
        if (targetSelectedCustomerId !== "walk-in") {
            const matchCustomerNode = FirebaseEngineInstance.db.customers.find(c => c.id === targetSelectedCustomerId);
            if (matchCustomerNode) {
                matchCustomerNode.count += 1;
                matchCustomerNode.total += finalCalculatedGrandTotal;
                if (matchCustomerNode.total > 15000) matchCustomerNode.tier = "Platinum";
                else if (matchCustomerNode.total > 5000) matchCustomerNode.tier = "Gold";
            }
        }

        const paymentChecked = document.querySelector('input[name="payment-method"]:checked');
        const paymentMethodValue = paymentChecked ? paymentChecked.value : "Cash";

        const saleTransactionPayload = {
            id: "TXN-" + Date.now().toString().slice(-6),
            timestamp: new Date().toISOString(),
            items: [...AppStateProfile.activePOSCartRegistry],
            grandTotal: finalCalculatedGrandTotal,
            profitCollected: absoluteProfitCollectedFromSale,
            paymentMethod: paymentMethodValue,
            customer: targetSelectedCustomerId
        };

        FirebaseEngineInstance.db.sales.push(saleTransactionPayload);
        FirebaseEngineInstance.sync('products');
        FirebaseEngineInstance.sync('sales');
        FirebaseEngineInstance.sync('customers');

        this.triggerReceiptHardcopyPrintExecutionPipeline(saleTransactionPayload);

        AppStateProfile.activePOSCartRegistry = [];
        if (discountInput) discountInput.value = 0;
        this.renderPOSCartManifestInterface();
        this.posCatalogRenderEngine();
        this.inventoryTableRenderEngine();
        this.customerTableRenderEngine();
    },

    triggerReceiptHardcopyPrintExecutionPipeline(transactionPayload) {
        const printShellElement = document.getElementById('invoice-print-engine-shell');
        if (!printShellElement) return;

        let receiptItemsRowsStringBlocks = "";
        transactionPayload.items.forEach(i => {
            receiptItemsRowsStringBlocks += `
                <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
                    <span>${i.name} (x${i.quantity})</span>
                    <span>${(i.sellPrice * i.quantity).toFixed(2)}</span>
                </div>
            `;
        });

        printShellElement.innerHTML = `
            <div style="font-family:'Courier New', monospace; width:280px; padding:10px; color:black;">
                <h3 style="text-align:center; margin-bottom:2px;">${FirebaseEngineInstance.db.settings.name}</h3>
                <p style="text-align:center; font-size:10px; margin-bottom:10px;">Official Transaction Statement Invoice</p>
                <hr style="border-top:1px dashed black;">
                <p style="font-size:11px;"><strong>Invoice ID:</strong> ${transactionPayload.id}</p>
                <p style="font-size:11px; margin-bottom:10px;"><strong>Date Logged:</strong> ${new Date(transactionPayload.timestamp).toLocaleString()}</p>
                <hr style="border-top:1px dashed black;">
                ${receiptItemsRowsStringBlocks}
                <hr style="border-top:1px dashed black;">
                <div style="display:flex; justify-content:space-between; font-weight:700; font-size:14px;">
                    <span>TOTAL AMOUNT:</span>
                    <span>${transactionPayload.grandTotal.toFixed(2)} ETB</span>
                </div>
                <p style="font-size:11px; margin-top:5px;"><strong>Settlement Route:</strong> ${transactionPayload.paymentMethod}</p>
                <h5 style="text-align:center; margin-top:15px;">Thank you for shopping at RAKI!</h5>
            </div>
        `;

        window.print();
    },

    expenseTableRenderEngine() {
        const targetBody = document.getElementById('expense-table-body');
        if (!targetBody) return;
        targetBody.innerHTML = "";
        FirebaseEngineInstance.db.expenses.forEach(e => {
            const r = document.createElement('tr');
            r.innerHTML = `
                <td>${e.date}</td>
                <td><span class="badge" style="background:var(--border-color); color:var(--text-main);">${e.category}</span></td>
                <td>${e.desc}</td>
                <td style="color:var(--danger-color); font-weight:600;">-${e.amount.toFixed(2)} ETB</td>
            `;
            targetBody.appendChild(r);
        });
    },

    customerTableRenderEngine() {
        const targetBody = document.getElementById('customer-table-body');
        if (!targetBody) return;
        targetBody.innerHTML = "";
        FirebaseEngineInstance.db.customers.forEach(c => {
            const r = document.createElement('tr');
            let tierColorPaletteRule = "background:#6b7280; color:white;";
            if (c.tier === "Gold") tierColorPaletteRule = "background:#f59e0b; color:white;";
            if (c.tier === "Platinum") tierColorPaletteRule = "background:#8b5cf6; color:white;";

            r.innerHTML = `
                <td><code>${c.id}</code></td>
                <td><strong>${c.name}</strong></td>
                <td>${c.phone}</td>
                <td>${c.count} Transactions</td>
                <td>${c.total.toFixed(2)} ETB</td>
                <td><span class="badge" style="${tierColorPaletteRule}">${c.tier}</span></td>
            `;
            targetBody.appendChild(r);
        });
    },

    renderSystemNotificationManager() {
        const items = FirebaseEngineInstance.db.products;
        const listContainer = document.getElementById('notification-list');
        const badgeCountElement = document.getElementById('notification-count');

        if (!listContainer) return;
        listContainer.innerHTML = "";
        let globalAlertCounter = 0;

        items.forEach(p => {
            if (p.qty <= 5) {
                globalAlertCounter++;
                const item = document.createElement('div');
                item.className = "notification-item";
                item.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:var(--warning-color)"></i> Stock Alert: <strong>${p.name}</strong> is critically low (${p.qty} left).`;
                listContainer.appendChild(item);
            }
        });

        if (globalAlertCounter === 0) {
            listContainer.innerHTML = `<p style="font-size:0.75rem; color:var(--text-muted)">All operational systems operational. Empty stack buffer trace.</p>`;
        }

        if (badgeCountElement) badgeCountElement.innerText = globalAlertCounter;
    }
};

// --- SYSTEM LIFECYCLE INVOCATION RUNTIME TRIGGER ---
document.addEventListener('DOMContentLoaded', () => {
    SystemApplicationPipeline.initializeCoreInfrastructure();
});