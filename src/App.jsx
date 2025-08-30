
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Predictive Budgeting</title>
    <style>
        :root {
            --bg-color: #1a1a1a;
            --text-color: #e0e0e0;
            --primary-color: #333;
            --secondary-color: #252525;
            --accent-color: #4CAF50;
            --expense-color: #f44336;
            --income-color: #81C784;
            --border-color: #444;
            --button-secondary-color: #555;
            --modified-color: #ffc107;
        }

        html, body {
            height: 100%;
            overflow: hidden;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            margin: 0;
            padding: 0;
            font-size: 14px;
        }

        .app-container {
            display: flex;
            flex-direction: column;
            height: 100vh;
        }

        /* --- Tabs --- */
        .tabs {
            flex-shrink: 0;
            display: flex;
            background-color: var(--secondary-color);
            border-bottom: 1px solid var(--border-color);
        }

        .tab-link {
            flex-grow: 1;
            padding: 10px 5px;
            cursor: pointer;
            text-align: center;
            background-color: transparent;
            border: none;
            color: var(--text-color);
            font-size: 1em;
            border-bottom: 2px solid transparent;
            transition: border-color 0.3s ease;
        }

        .tab-link.active {
            border-bottom-color: var(--accent-color);
            font-weight: bold;
        }
        
        .app-content {
            flex-grow: 1;
            position: relative;
        }

        /* --- Tab Content --- */
        .tab-content {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            box-sizing: border-box;
            padding: 8px;
            display: none;
        }

        .tab-content.active {
            display: flex;
            flex-direction: column;
        }
        
        #ledger-tab-content {
             flex-grow: 1;
             overflow-y: auto;
             margin-top: 8px;
        }

        #rules-tab {
            overflow: hidden;
        }
        
        #add-rule-form {
            flex-shrink: 0;
        }
        
        .rules-list-container {
            flex-grow: 1;
            overflow-y: auto;
            margin-top: 8px;
        }
        
        /* --- Ledger Table & Filters --- */
        #ledger-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
        }

        #ledger-table th {
            text-align: left;
            padding: 8px 4px;
            font-size: 0.9em;
            color: #aaa;
            background-color: var(--bg-color);
            position: sticky;
            top: 0;
            text-transform: uppercase;
            border: 1px solid var(--border-color);
        }
        
        #ledger-table th.clickable-header {
            cursor: pointer;
        }

        #ledger-table td {
            padding: 8px 4px;
            border-bottom: 1px solid var(--primary-color);
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        #ledger-table tr:hover {
            background-color: var(--secondary-color);
            cursor: pointer;
        }
        
        .col-status { width: 3em; }
        .col-item { width: 25ch; }
        .col-date { width: 9em; }
        .col-amount, .col-balance { text-align: left; font-family: monospace, monospace;}
        
        .col-balance { font-weight: bold; font-size: 1.1em; }
        .col-amount { font-size: 0.9em; }

        .unposted-counter {
            background-color: var(--expense-color);
            color: white;
            border-radius: 50%;
            padding: 1px 5px;
            font-size: 0.8em;
            margin-left: 6px;
            display: inline-block;
            vertical-align: middle;
            line-height: 1;
            font-weight: bold;
        }

        /* Item Filter Dropdown */
        #item-filter-dropdown {
            display: none;
            position: absolute;
            background-color: var(--secondary-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            z-index: 100;
            max-height: 250px;
            overflow-y: auto;
            min-width: 200px;
        }
        
        #item-filter-dropdown div {
            padding: 8px 12px;
            cursor: pointer;
            white-space: nowrap;
        }
        
        #item-filter-dropdown div:hover {
            background-color: var(--primary-color);
        }
        #item-filter-dropdown div.highlighted {
            background-color: var(--accent-color);
            color: white;
            font-weight: bold;
        }

        /* --- Forms & Inputs --- */
        form {
            background-color: var(--secondary-color);
            padding: 10px;
            border-radius: 4px;
            margin-bottom: 10px;
        }

        .form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
        }

        .form-group {
            display: flex;
            flex-direction: column;
        }

        .full-width {
            grid-column: 1 / -1;
        }

        label {
            margin-bottom: 4px;
            font-size: 0.8em;
            color: #aaa;
        }

        input, select {
            background-color: var(--primary-color);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            padding: 8px;
            font-size: 1em;
            width: 100%;
            box-sizing: border-box;
        }

        input[type="date"]::-webkit-calendar-picker-indicator {
            filter: invert(1);
        }
        
        button.submit-btn {
            grid-column: 1 / -1;
            background-color: var(--accent-color);
            color: white;
            border: none;
            padding: 10px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 1em;
            margin-top: 8px;
        }
        
        #populate-test-data-btn {
             background-color: var(--button-secondary-color);
             margin-top: 4px;
        }

        /* --- Lists (For Modals) --- */
        .data-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .list-item {
            display: grid;
            grid-template-columns: auto 1fr auto; 
            gap: 8px;
            align-items: center;
            padding: 8px 4px;
            border-bottom: 1px solid var(--primary-color);
        }
        
        #rule-transactions-list .list-item {
            cursor: pointer;
            transition: background-color 0.2s;
        }
        #rule-transactions-list .list-item:hover {
            background-color: var(--secondary-color);
        }
        
        .list-item.rule-item {
            grid-template-columns: 1fr auto;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        
        .list-item.rule-item:hover {
            background-color: var(--secondary-color);
        }
        
        .item-status {
            font-size: 1.1em;
            width: 2.5em; /* Space for emojis */
            text-align: center;
            white-space: nowrap; /* Prevent emojis from stacking */
        }
        
        .item-name {
            font-weight: bold;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        
        .item-date {
            font-size: 0.85em;
            color: #aaa;
        }
        
        .item-financials { text-align: right; }
        .item-amount { font-weight: bold; font-family: monospace, monospace; font-size: 1.1em; flex-shrink: 0; }
        .rule-info { font-size: 0.85em; color: #aaa; }

        .amount-expense { color: var(--expense-color); }
        .amount-income { color: var(--income-color); }
        .balance-negative { color: var(--expense-color); }

        /* --- Modals --- */
        .modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background-color: rgba(0, 0, 0, 0.7);
            display: none; justify-content: center; align-items: center;
            z-index: 1000;
        }
        
        .modal-content {
            position: relative;
            background-color: var(--secondary-color);
            padding: 20px; border-radius: 5px; text-align: left;
            max-width: 90%; width: 400px;
        }
        
        .modal-content.centered-text { text-align: center; }

        .modal-buttons {
            margin-top: 20px;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }
        .modal-buttons.centered { justify-content: center; }

        .modal-btn {
            padding: 8px 16px; border-radius: 4px;
            cursor: pointer; border: none;
        }
        
        #delete-item-btn {
            margin-right: auto;
        }
        
        .btn-danger { background-color: var(--expense-color); color: white; }
        .btn-secondary { background-color: var(--border-color); color: var(--text-color); }
        .btn-primary { background-color: var(--accent-color); color: white; }
        .btn-warning { background-color: var(--modified-color); color: #1a1a1a; }
        
        #edit-modal-info, #modal-item-info, #rule-details-info { 
            font-size: 0.9em; color: #aaa; word-break: break-all; margin-bottom: 15px; 
            line-height: 1.5;
        }
        #modal-item-info { font-size: 1em; text-align: center; }
        
        .future-post-prompt {
            display: none; background-color: var(--primary-color);
            padding: 10px; border-radius: 4px; margin-top: 15px; text-align: center;
        }
        
        .history-btn {
            position: absolute; top: 10px; right: 10px;
            background: none; border: none; font-size: 1.5em;
            color: var(--text-color); cursor: pointer;
        }
        
        #history-modal .modal-content, #rule-transactions-modal .modal-content {
            height: 70vh; display: flex; flex-direction: column;
        }
        
        #history-list, #rule-transactions-list {
            flex-grow: 1; overflow-y: auto; list-style: none;
            padding: 0; margin-top: 15px;
            font-size: 0.9em;
        }
        
        #history-list li, #rule-transactions-list li {
            padding: 6px 0; border-bottom: 1px solid var(--primary-color);
        }
        
        #history-list .history-date { display: block; font-size: 0.8em; color: #aaa; }
    </style>
</head>
<body>

    <div class="app-container">
        <nav class="tabs">
            <button class="tab-link active" onclick="showTab('ledger')">Ledger</button>
            <button class="tab-link" onclick="showTab('rules')">Rules</button>
        </nav>

        <main class="app-content">
            <div id="ledger-tab" class="tab-content active">
                <div id="ledger-tab-content">
                    <table id="ledger-table">
                        <thead>
                            <tr>
                                <th class="col-status"></th>
                                <th id="name-header" class="col-item clickable-header"><span class="header-text">Item &#9662;</span></th>
                                <th id="date-header" class="col-date clickable-header">
                                    <span class="header-text">Date Cur. &#9662;</span><span class="unposted-counter" style="display: none;"></span>
                                </th>
                                <th class="col-amount">Amount</th>
                                <th id="balance-header" class="col-balance clickable-header"><span class="header-text">Balance Proj. &#9662;</span></th>
                            </tr>
                        </thead>
                        <tbody id="ledger-body"></tbody>
                    </table>
                </div>
                <div id="item-filter-dropdown"></div>
            </div>
            <div id="rules-tab" class="tab-content">
                <form id="add-rule-form">
                    <div class="form-grid">
                        <div class="form-group full-width"><label for="rule-name">Name</label><input type="text" id="rule-name" required placeholder="e.g., Paycheck, Rent"></div>
                        <div class="form-group"><label for="rule-amount">Amount</label><input type="number" step="0.01" id="rule-amount" required placeholder="e.g., -1200 or 2500"></div>
                        <div class="form-group"><label for="rule-frequency">Frequency</label><select id="rule-frequency" required><option value="one-time">One Time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="bi-weekly">Bi-Weekly</option><option value="monthly">Monthly</option><option value="annually">Annually</option></select></div>
                        <div class="form-group"><label for="rule-start-date">Start Date</label><input type="date" id="rule-start-date" required></div>
                        <div class="form-group"><label for="rule-end-date">End Date (Optional)</label><input type="date" id="rule-end-date"></div>
                         <button type="submit" class="submit-btn">Add Rule</button>
                         <button type="button" id="populate-test-data-btn" class="submit-btn">Load Sample Data</button>
                    </div>
                </form>
                <div class="rules-list-container"><ul id="rules-list" class="data-list"></ul></div>
            </div>
        </main>
    </div>
    
    <!-- Rule Details Modal -->
    <div id="rule-details-modal" class="modal-overlay">
        <div class="modal-content">
            <button id="rule-transactions-btn" class="history-btn">🕮</button>
            <h3>Rule Details</h3>
            <div id="rule-details-info"></div>
            <div class="modal-buttons">
                <button id="delete-rule-btn" class="modal-btn btn-danger">Delete Rule</button>
                <button id="close-rule-details-btn" class="modal-btn btn-secondary">Close</button>
            </div>
        </div>
    </div>

    <!-- Rule Transactions List Modal -->
    <div id="rule-transactions-modal" class="modal-overlay">
        <div class="modal-content">
            <h3>Associated Transactions</h3>
            <ul id="rule-transactions-list" class="data-list"></ul>
            <div class="modal-buttons">
                 <button id="close-rule-transactions-btn" class="modal-btn btn-secondary">Close</button>
            </div>
        </div>
    </div>

    <!-- Delete Rule Confirmation Modal -->
    <div id="delete-rule-modal" class="modal-overlay">
        <div class="modal-content centered-text">
            <p>Are you sure you want to delete this rule and all its ledger entries?</p>
            <div id="modal-rule-info"></div>
            <div class="modal-buttons centered">
                <button id="confirm-delete-rule-btn" class="modal-btn btn-danger">Delete</button>
                <button id="cancel-delete-rule-btn" class="modal-btn btn-secondary">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Edit Ledger Item Modal -->
    <div id="edit-ledger-item-modal" class="modal-overlay">
        <div class="modal-content">
            <button id="edit-item-history-btn" class="history-btn">🕮</button>
            <div id="edit-modal-info"></div>
            <form id="edit-item-form">
                <div class="form-grid">
                    <div class="form-group"><label for="edit-item-amount">Amount</label><input type="number" step="0.01" id="edit-item-amount" required></div>
                    <div class="form-group"><label for="edit-item-date">Date</label><input type="date" id="edit-item-date" required></div>
                </div>
            </form>
            <div class="future-post-prompt" id="future-post-prompt">
                <p>Future transactions cannot be posted.</p>
                <button id="move-and-post-btn" class="modal-btn btn-warning">Move to Today & Post</button>
            </div>
            <div class="modal-buttons">
                <button id="delete-item-btn" class="modal-btn btn-danger">Delete</button>
                <button id="post-item-btn" class="modal-btn btn-primary">Post</button>
                <button id="cancel-edit-btn" class="modal-btn btn-secondary">Cancel</button>
                <button id="save-changes-btn" class="modal-btn btn-primary">Save Changes</button>
            </div>
        </div>
    </div>
    
    <!-- Delete Item Confirmation Modal -->
    <div id="delete-item-modal" class="modal-overlay">
        <div class="modal-content centered-text">
            <p>Are you sure you want to permanently delete this transaction?</p>
            <div id="modal-item-info"></div>
            <div class="modal-buttons centered">
                <button id="confirm-delete-item-btn" class="modal-btn btn-danger">Delete</button>
                <button id="cancel-delete-item-btn" class="modal-btn btn-secondary">Cancel</button>
            </div>
        </div>
    </div>

    <!-- Apply Future Changes Modal -->
    <div id="apply-future-changes-modal" class="modal-overlay">
        <div class="modal-content centered-text">
            <p>Apply this change to future transactions in this series?</p>
            <div id="future-change-summary" style="margin: 10px 0;"></div>
            <div class="modal-buttons centered">
                <button id="apply-to-one-btn" class="modal-btn btn-secondary">Just This One</button>
                <button id="apply-to-future-btn" class="modal-btn btn-primary">All Future</button>
                <button id="cancel-future-change-btn" class="modal-btn btn-secondary">Cancel</button>
            </div>
        </div>
    </div>

    <!-- History Modal -->
    <div id="history-modal" class="modal-overlay">
        <div class="modal-content">
            <h3>Transaction History</h3>
            <ul id="history-list"></ul>
            <div class="modal-buttons">
                 <button id="close-history-btn" class="modal-btn btn-secondary">Close</button>
            </div>
        </div>
    </div>


    <script>
        document.addEventListener('DOMContentLoaded', () => {
            let rules = [];
            let ledger = [];
            let ruleToDeleteId = null;
            let ledgerItemToEditId = null;
            let pendingChanges = null;
            
            // Filter State
            let itemFilter = []; 
            let balanceFilter = 'projected'; // 'projected' or 'actual'
            let dateFilter = 'current'; // 'current' or 'previous'

            // UI Elements
            const addRuleForm = document.getElementById('add-rule-form');
            const rulesList = document.getElementById('rules-list');
            const ledgerBody = document.getElementById('ledger-body');
            const populateTestDataBtn = document.getElementById('populate-test-data-btn');

            // Filter UI
            const nameHeader = document.getElementById('name-header');
            const dateHeader = document.getElementById('date-header');
            const balanceHeader = document.getElementById('balance-header');
            const itemFilterDropdown = document.getElementById('item-filter-dropdown');
            
            // Rule Modals
            const ruleDetailsModal = document.getElementById('rule-details-modal');
            const ruleDetailsInfo = document.getElementById('rule-details-info');
            const deleteRuleBtn = document.getElementById('delete-rule-btn');
            const closeRuleDetailsBtn = document.getElementById('close-rule-details-btn');
            const ruleTransactionsBtn = document.getElementById('rule-transactions-btn');
            const ruleTransactionsModal = document.getElementById('rule-transactions-modal');
            const ruleTransactionsList = document.getElementById('rule-transactions-list');
            const closeRuleTransactionsBtn = document.getElementById('close-rule-transactions-btn');
            const deleteRuleModal = document.getElementById('delete-rule-modal');
            const confirmDeleteRuleBtn = document.getElementById('confirm-delete-rule-btn');
            const cancelDeleteRuleBtn = document.getElementById('cancel-delete-rule-btn');
            const modalRuleInfo = document.getElementById('modal-rule-info');

            // Ledger Item Modals
            const editLedgerItemModal = document.getElementById('edit-ledger-item-modal');
            const editModalInfo = document.getElementById('edit-modal-info');
            const editItemAmountInput = document.getElementById('edit-item-amount');
            const editItemDateInput = document.getElementById('edit-item-date');
            const saveChangesBtn = document.getElementById('save-changes-btn');
            const cancelEditBtn = document.getElementById('cancel-edit-btn');
            const postItemBtn = document.getElementById('post-item-btn');
            const deleteItemBtn = document.getElementById('delete-item-btn');
            const futurePostPrompt = document.getElementById('future-post-prompt');
            const moveAndPostBtn = document.getElementById('move-and-post-btn');
            const deleteItemModal = document.getElementById('delete-item-modal');
            const confirmDeleteItemBtn = document.getElementById('confirm-delete-item-btn');
            const cancelDeleteItemBtn = document.getElementById('cancel-delete-item-btn');
            const modalItemInfo = document.getElementById('modal-item-info');

            // Series Update Modal
            const applyFutureChangesModal = document.getElementById('apply-future-changes-modal');
            const futureChangeSummary = document.getElementById('future-change-summary');
            const applyToOneBtn = document.getElementById('apply-to-one-btn');
            const applyToFutureBtn = document.getElementById('apply-to-future-btn');
            const cancelFutureChangeBtn = document.getElementById('cancel-future-change-btn');

            // History Modal
            const editItemHistoryBtn = document.getElementById('edit-item-history-btn');
            const historyModal = document.getElementById('history-modal');
            const historyList = document.getElementById('history-list');
            const closeHistoryBtn = document.getElementById('close-history-btn');

            // --- Core Functions ---
            function saveData() {
                localStorage.setItem('budgetRules', JSON.stringify(rules));
                localStorage.setItem('budgetLedger', JSON.stringify(ledger));
            }

            function loadData() {
                rules = JSON.parse(localStorage.getItem('budgetRules')) || [];
                ledger = JSON.parse(localStorage.getItem('budgetLedger')) || [];
            }
            
            function renderAll() {
                renderRules();
                renderLedger();
            }

            window.showTab = (tabId) => {
                document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
                document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));
                document.getElementById(`${tabId}-tab`).classList.add('active');
                document.querySelector(`[onclick="showTab('${tabId}')"]`).classList.add('active');
            };
            
            function addRule(event) {
                event.preventDefault();
                const newRule = {
                    id: crypto.randomUUID(), name: document.getElementById('rule-name').value,
                    amount: parseFloat(document.getElementById('rule-amount').value),
                    frequency: document.getElementById('rule-frequency').value,
                    startDate: document.getElementById('rule-start-date').value,
                    endDate: document.getElementById('rule-end-date').value || null,
                };
                rules.push(newRule);
                generateLedgerItemsForRule(newRule);
                itemFilter.push(newRule.id); // Automatically select new rule
                saveData(); renderAll(); addRuleForm.reset();
                document.getElementById('rule-start-date').valueAsDate = new Date();
            }
            
            function deleteRule(ruleId) {
                rules = rules.filter(rule => rule.id !== ruleId);
                ledger = ledger.filter(item => item.parentRuleId !== ruleId);
                itemFilter = itemFilter.filter(id => id !== ruleId);
                saveData(); renderAll();
            }
            
            function generateLedgerItemsForRule(rule) {
                const newItems = [];
                let currentDate = new Date(rule.startDate + 'T00:00:00Z');
                const ruleEndDate = rule.endDate ? new Date(rule.endDate + 'T00:00:00Z') : null;
                const futureLimit = new Date(); futureLimit.setFullYear(futureLimit.getFullYear() + 1);
                const finalEndDate = ruleEndDate && ruleEndDate < futureLimit ? ruleEndDate : futureLimit;
                
                if (rule.frequency === 'one-time') {
                     if (currentDate <= finalEndDate) newItems.push(createLedgerItem(rule, currentDate));
                } else {
                    while (currentDate <= finalEndDate) {
                        newItems.push(createLedgerItem(rule, currentDate));
                        switch (rule.frequency) {
                            case 'daily': currentDate.setUTCDate(currentDate.getUTCDate() + 1); break;
                            case 'weekly': currentDate.setUTCDate(currentDate.getUTCDate() + 7); break;
                            case 'bi-weekly': currentDate.setUTCDate(currentDate.getUTCDate() + 14); break;
                            case 'monthly': currentDate.setUTCMonth(currentDate.getUTCMonth() + 1); break;
                            case 'annually': currentDate.setUTCFullYear(currentDate.getUTCFullYear() + 1); break;
                        }
                    }
                }
                ledger.push(...newItems);
            }
            
            function createLedgerItem(rule, date) {
                const newItem = {
                    id: crypto.randomUUID(), parentRuleId: rule.id, name: rule.name,
                    amount: rule.amount, date: date.toISOString().split('T')[0],
                    status: { posted: false, modified: false },
                    history: []
                };
                addHistoryEntry(newItem, 'Transaction created.');
                return newItem;
            }
            
            function addHistoryEntry(item, changeDescription) {
                 if (!item.history) item.history = [];
                 item.history.push({
                     id: crypto.randomUUID(),
                     timestamp: new Date().toISOString(),
                     change: changeDescription,
                 });
            }

            function populateWithTestData() {
                rules = []; ledger = [];
                const toISODate = (d) => d.toISOString().split('T')[0];
                const testRules = [ { name: "Paycheck", amount: 2500, frequency: "bi-weekly", startDate: toISODate(new Date('2025-09-05')) }, { name: "Rent/Mortgage", amount: -1500, frequency: "monthly", startDate: toISODate(new Date('2025-09-01')) }, { name: "Groceries", amount: -150, frequency: "weekly", startDate: toISODate(new Date('2025-08-31')) }, { name: "Internet Bill", amount: -75, frequency: "monthly", startDate: toISODate(new Date('2025-09-10')) }, { name: "Spotify", amount: -10.99, frequency: "monthly", startDate: toISODate(new Date('2025-09-12')) }, { name: "Gasoline", amount: -60, frequency: "bi-weekly", startDate: toISODate(new Date('2025-09-01')) }, { name: "Electricity Bill", amount: -120, frequency: "monthly", startDate: toISODate(new Date('2025-09-20')) }, { name: "Side Gig", amount: 450, frequency: "monthly", startDate: toISODate(new Date('2025-09-15')) }, { name: "Gym Membership", amount: -40, frequency: "monthly", startDate: toISODate(new Date('2025-09-01')) }, { name: "Car Insurance", amount: -110, frequency: "monthly", startDate: toISODate(new Date('2025-09-05')) }, { name: "Phone Bill", amount: -85, frequency: "monthly", startDate: toISODate(new Date('2025-09-22')) }, { name: "Birthday Gift", amount: -75, frequency: "one-time", startDate: toISODate(new Date('2025-10-10')) }, { name: "Health Insurance", amount: -350, frequency: "monthly", startDate: toISODate(new Date('2025-09-01')) }, { name: "Coffee Shop", amount: -5, frequency: "daily", startDate: toISODate(new Date()) }, ];
                testRules.forEach(r => {
                    const newRule = { id: crypto.randomUUID(), ...r };
                    rules.push(newRule); generateLedgerItemsForRule(newRule);
                });
                itemFilter = rules.map(r => r.id);
                saveData(); renderAll(); showTab('ledger');
            }

            // --- Rendering ---
            function renderRules() {
                rulesList.innerHTML = '';
                if(rules.length === 0) { rulesList.innerHTML = '<li class="list-item rule-item">No rules created yet.</li>'; return; }
                const sortedRules = [...rules].sort((a,b) => a.name.localeCompare(b.name));
                sortedRules.forEach(rule => {
                    const li = document.createElement('li');
                    li.className = 'list-item rule-item';
                    li.dataset.id = rule.id;
                    const amountClass = rule.amount >= 0 ? 'amount-income' : 'amount-expense';
                    const formattedAmount = (rule.amount >= 0 ? '+' : '') + rule.amount.toFixed(2);
                    const frequencyText = rule.frequency.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
                    li.innerHTML = `<div><div class="item-name">${rule.name}</div><div class="rule-info">${frequencyText} from ${rule.startDate}</div></div><div class="item-amount ${amountClass}" style="text-align: right;">${formattedAmount}</div>`;
                    li.addEventListener('click', () => openRuleDetailsModal(rule.id));
                    rulesList.appendChild(li);
                });
            }

            function updateItemFilterHeader() {
                const headerTextElement = nameHeader.querySelector('.header-text');
                if (itemFilter.length === rules.length) {
                    headerTextElement.innerHTML = `All Items &#9662;`;
                } else if (itemFilter.length === 0) {
                    headerTextElement.innerHTML = `None Selected &#9662;`;
                } else if (itemFilter.length === 1) {
                    const rule = rules.find(r => r.id === itemFilter[0]);
                    headerTextElement.innerHTML = `${rule ? rule.name : 'Item'} &#9662;`;
                } else {
                    headerTextElement.innerHTML = `Multiple Items &#9662;`;
                }
            }
            
            function populateItemFilterDropdown() {
                itemFilterDropdown.innerHTML = '';

                const allDiv = document.createElement('div');
                allDiv.dataset.id = 'all';
                allDiv.textContent = 'All Items';
                if (itemFilter.length === rules.length) {
                    allDiv.classList.add('highlighted');
                }
                itemFilterDropdown.appendChild(allDiv);

                const hr = document.createElement('hr');
                hr.style.margin = '4px 0';
                hr.style.borderColor = 'var(--border-color)';
                itemFilterDropdown.appendChild(hr);

                const sortedRules = [...rules].sort((a, b) => a.name.localeCompare(b.name));
                sortedRules.forEach(rule => {
                    const ruleDiv = document.createElement('div');
                    ruleDiv.dataset.id = rule.id;
                    ruleDiv.textContent = rule.name;
                    if (itemFilter.includes(rule.id)) {
                        ruleDiv.classList.add('highlighted');
                    }
                    itemFilterDropdown.appendChild(ruleDiv);
                });
            }
            
            function updateUnpostedCounter() {
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                const unpostedCount = ledger.filter(item => {
                    const itemDate = new Date(item.date + 'T00:00:00Z');
                    return !item.status.posted && itemDate < today;
                }).length;

                const counter = dateHeader.querySelector('.unposted-counter');
                if (counter) {
                    if (unpostedCount > 0) {
                        counter.textContent = unpostedCount;
                        counter.style.display = 'inline-block';
                    } else {
                        counter.style.display = 'none';
                    }
                }
            }

            function renderLedger() {
                updateItemFilterHeader();
                updateUnpostedCounter();
                ledgerBody.innerHTML = '';
                const sortedLedger = [...ledger].sort((a, b) => new Date(a.date) - new Date(b.date) || b.amount - a.amount);
                
                if (sortedLedger.length === 0) { 
                    const row = ledgerBody.insertRow();
                    const cell = row.insertCell();
                    cell.colSpan = 5;
                    cell.textContent = 'Ledger is empty.';
                    cell.style.textAlign = 'center';
                    return; 
                }

                const balanceMap = new Map();
                let runningBalance = 0;
                sortedLedger.forEach(item => {
                    if (balanceFilter === 'projected' || item.status?.posted) {
                        runningBalance += item.amount;
                    }
                    balanceMap.set(item.id, runningBalance);
                });
                
                let itemsToDisplay = sortedLedger;

                if (dateFilter === 'current') {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0); 
                    itemsToDisplay = itemsToDisplay.filter(item => new Date(item.date + 'T00:00:00Z') >= today);
                }
                
                itemsToDisplay = itemsToDisplay.filter(item => itemFilter.includes(item.parentRuleId));

                if (itemsToDisplay.length === 0) {
                    const row = ledgerBody.insertRow();
                    const cell = row.insertCell();
                    cell.colSpan = 5;
                    cell.textContent = 'No items match the current filters.';
                    cell.style.textAlign = 'center';
                    return;
                }
                
                itemsToDisplay.forEach(item => {
                    const row = ledgerBody.insertRow();
                    row.dataset.id = item.id;
                    row.addEventListener('click', () => openEditModal(item.id));
                    
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const itemDate = new Date(item.date + 'T00:00:00Z');

                    let statusEmoji = '';
                    if (item.status?.posted) {
                        statusEmoji += '✅';
                    } else if (itemDate < today) {
                        statusEmoji += '↩️'; // Past due and unposted
                    }
                    
                    if (item.status?.modified) statusEmoji += '📝';

                    const itemBalance = balanceMap.get(item.id);
                    const formattedAmount = (item.amount).toFixed(2);
                    const [y, m, d] = item.date.split('-');
                    const formattedDate = `${m}/${d}/${y.slice(-2)}`;

                    row.innerHTML = `
                        <td class="col-status">${statusEmoji}</td>
                        <td class="col-item" title="${item.name}">${item.name}</td>
                        <td class="col-date">${formattedDate}</td>
                        <td class="col-amount ${item.amount >= 0 ? 'amount-income' : 'amount-expense'}">${formattedAmount}</td>
                        <td class="col-balance ${itemBalance < 0 ? 'balance-negative' : ''}">${itemBalance.toFixed(2)}</td>
                    `;
                });
            }

            // --- Modal Openers and Handlers ---
            function openRuleDetailsModal(ruleId) {
                const rule = rules.find(r => r.id === ruleId);
                if (!rule) return;
                ruleToDeleteId = ruleId;
                const formattedAmount = (rule.amount >= 0 ? '+' : '') + rule.amount.toFixed(2);
                const frequencyText = rule.frequency.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
                ruleDetailsInfo.innerHTML = `
                    <strong>Name:</strong> ${rule.name}<br>
                    <strong>Amount:</strong> ${formattedAmount}<br>
                    <strong>Frequency:</strong> ${frequencyText}<br>
                    <strong>Start Date:</strong> ${rule.startDate}<br>
                    ${rule.endDate ? `<strong>End Date:</strong> ${rule.endDate}` : ''}
                `;
                ruleDetailsModal.style.display = 'flex';
            }
            
            function openEditModal(itemId) {
                const item = ledger.find(i => i.id === itemId);
                if (!item) return;
                ledgerItemToEditId = itemId;
                const parentRule = rules.find(r => r.id === item.parentRuleId);
                const frequencyText = parentRule ? parentRule.frequency.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'N/A';
                editModalInfo.innerHTML = `<strong>Parent:</strong> ${parentRule?.name || 'N/A'} (${frequencyText})<br><strong>ID:</strong> ${item.id}`;
                editItemAmountInput.value = item.amount;
                editItemDateInput.value = item.date;
                postItemBtn.textContent = item.status.posted ? 'Unpost Transaction' : 'Post Transaction';
                futurePostPrompt.style.display = 'none';
                editLedgerItemModal.style.display = 'flex';
            }

            function handleSaveChanges() {
                const item = ledger.find(i => i.id === ledgerItemToEditId);
                if (!item) return;

                const newAmount = parseFloat(editItemAmountInput.value);
                const newDate = editItemDateInput.value;
                const amountChanged = item.amount !== newAmount;
                const dateChanged = item.date !== newDate;

                if (!amountChanged && !dateChanged) {
                    editLedgerItemModal.style.display = 'none';
                    return;
                }
                
                pendingChanges = {
                    originalItem: JSON.parse(JSON.stringify(item)),
                    newAmount, newDate, amountChanged, dateChanged
                };

                const futureItemsExist = ledger.some(futureItem => 
                    futureItem.parentRuleId === item.parentRuleId && new Date(futureItem.date) > new Date(item.date)
                );

                if (futureItemsExist && (amountChanged || dateChanged)) {
                    let summaryText = [];
                    if(amountChanged) summaryText.push(`Amount: ${item.amount.toFixed(2)} → ${newAmount.toFixed(2)}`);
                    if(dateChanged) summaryText.push(`Date: ${item.date} → ${newDate}`);
                    futureChangeSummary.innerHTML = `<p style="color: var(--modified-color); font-size: 0.9em;">${summaryText.join('<br>')}</p>`;
                    applyFutureChangesModal.style.display = 'flex';
                } else {
                    saveSingleChange();
                }
            }
            
            function saveSingleChange() {
                if (!pendingChanges) return;
                const { originalItem, newAmount, newDate, amountChanged, dateChanged } = pendingChanges;
                const item = ledger.find(i => i.id === originalItem.id);
                if (!item) return;

                let changes = [];
                if(amountChanged) changes.push(`Amount changed from ${originalItem.amount.toFixed(2)} to ${newAmount.toFixed(2)}.`);
                if(dateChanged) changes.push(`Date changed from ${originalItem.date} to ${newDate}.`);

                item.amount = newAmount;
                item.date = newDate;
                item.status.modified = true;
                addHistoryEntry(item, changes.join(' '));
                
                saveData(); renderLedger();
                editLedgerItemModal.style.display = 'none';
                applyFutureChangesModal.style.display = 'none';
                pendingChanges = null;
                ledgerItemToEditId = null;
            }

            function applySeriesUpdate() {
                if (!pendingChanges) return;
                const { originalItem, newAmount, newDate, amountChanged, dateChanged } = pendingChanges;
                
                const currentItem = ledger.find(i => i.id === originalItem.id);
                if (currentItem) {
                    currentItem.amount = newAmount;
                    currentItem.date = newDate;
                    currentItem.status.modified = true;
                    addHistoryEntry(currentItem, 'Updated as part of a series change.');
                }

                const futureItems = ledger.filter(item => 
                    item.parentRuleId === originalItem.parentRuleId && new Date(item.date) > new Date(originalItem.date)
                );

                const dateDelta = dateChanged ? 
                    (new Date(newDate).getTime() - new Date(originalItem.date).getTime()) / (1000 * 3600 * 24) : 0;

                futureItems.forEach(item => {
                    let changes = [];
                    if (amountChanged) {
                        item.amount = newAmount;
                        changes.push(`Amount updated to ${newAmount.toFixed(2)}`);
                    }
                    if (dateChanged && dateDelta !== 0) {
                        const originalItemDate = new Date(item.date + 'T00:00:00Z');
                        originalItemDate.setUTCDate(originalItemDate.getUTCDate() + dateDelta);
                        item.date = originalItemDate.toISOString().split('T')[0];
                        changes.push(`Date shifted by ${dateDelta > 0 ? '+' : ''}${dateDelta} days`);
                    }
                    if (changes.length > 0) {
                        item.status.modified = true;
                        addHistoryEntry(item, `${changes.join(' & ')} as part of a series update.`);
                    }
                });
                
                saveData(); renderLedger();
                editLedgerItemModal.style.display = 'none';
                applyFutureChangesModal.style.display = 'none';
                pendingChanges = null;
                ledgerItemToEditId = null;
            }

            function handlePostToggle() {
                const item = ledger.find(i => i.id === ledgerItemToEditId);
                if (!item) return;
                if (item.status.posted) {
                    item.status.posted = false;
                    addHistoryEntry(item, 'Transaction un-posted.');
                    saveData(); renderLedger(); editLedgerItemModal.style.display = 'none';
                    return;
                }
                const today = new Date(); today.setHours(0,0,0,0);
                const itemDate = new Date(item.date + 'T00:00:00Z');
                if (itemDate > today) {
                    futurePostPrompt.style.display = 'block';
                } else {
                    item.status.posted = true;
                    addHistoryEntry(item, 'Transaction posted.');
                    saveData(); renderLedger(); editLedgerItemModal.style.display = 'none';
                }
            }
            
            function handleDeleteItem() {
                ledger = ledger.filter(item => item.id !== ledgerItemToEditId);
                saveData(); renderLedger();
                deleteItemModal.style.display = 'none';
                editLedgerItemModal.style.display = 'none';
                ledgerItemToEditId = null;
            }

            function handleMoveAndPost() {
                const item = ledger.find(i => i.id === ledgerItemToEditId);
                if (!item) return;
                const todayStr = new Date().toISOString().split('T')[0];
                addHistoryEntry(item, `Date moved from ${item.date} to ${todayStr} and posted.`);
                item.date = todayStr;
                item.status.posted = true;
                item.status.modified = true;
                saveData(); renderLedger(); editLedgerItemModal.style.display = 'none';
            }

            function showHistory(itemId) {
                const item = ledger.find(i => i.id === itemId);
                if (!item || !item.history || item.history.length === 0) {
                    historyList.innerHTML = '<li>No history found for this transaction.</li>';
                } else {
                    historyList.innerHTML = '';
                    [...item.history].reverse().forEach(entry => {
                        const li = document.createElement('li');
                        const entryDate = new Date(entry.timestamp).toLocaleString();
                        li.innerHTML = `${entry.change}<span class="history-date">${entryDate} (ID: ${entry.id})</span>`;
                        historyList.appendChild(li);
                    });
                }
                historyModal.style.display = 'flex';
            }
            
            function showRuleTransactions(ruleId) {
                const associatedItems = ledger.filter(item => item.parentRuleId === ruleId).sort((a,b) => new Date(a.date) - new Date(b.date));
                ruleTransactionsList.innerHTML = '';
                if (associatedItems.length === 0) {
                    ruleTransactionsList.innerHTML = '<li class="list-item">No transactions found for this rule.</li>';
                } else {
                    associatedItems.forEach(item => {
                         const li = document.createElement('li');
                         li.className = 'list-item';
                         const amountClass = item.amount >= 0 ? 'amount-income' : 'amount-expense';
                         const formattedAmount = (item.amount >= 0 ? '+' : '') + item.amount.toFixed(2);
                         const formattedDate = new Date(item.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
                         let statusEmoji = '';
                         if (item.status?.posted) statusEmoji += '✅';
                         if (item.status?.modified) statusEmoji += '📝';
                         li.innerHTML = `<div class="item-status">${statusEmoji}</div><div><div class="item-name">${formattedDate}</div><div class="item-date" style="word-break: break-all;">${item.id}</div></div><div class="item-financials"><div class="item-amount ${amountClass}">${formattedAmount}</div></div>`;
                         li.addEventListener('click', () => showHistory(item.id));
                         ruleTransactionsList.appendChild(li);
                    });
                }
                ruleTransactionsModal.style.display = 'flex';
            }

            // --- Event Listeners ---
            addRuleForm.addEventListener('submit', addRule);
            populateTestDataBtn.addEventListener('click', populateWithTestData);
            
            // Filter Listeners
            dateHeader.addEventListener('click', () => {
                dateFilter = dateFilter === 'current' ? 'previous' : 'current';
                const headerText = dateFilter === 'current' ? 'Date Cur.' : 'Date Prev.';
                dateHeader.querySelector('.header-text').innerHTML = `${headerText} &#9662;`;
                renderLedger();
            });
            balanceHeader.addEventListener('click', () => {
                balanceFilter = balanceFilter === 'projected' ? 'actual' : 'projected';
                const headerText = balanceFilter === 'projected' ? 'Balance Proj.' : 'Balance Act.';
                balanceHeader.querySelector('.header-text').innerHTML = `${headerText} &#9662;`;
                renderLedger();
            });

            nameHeader.addEventListener('click', (event) => {
                event.stopPropagation();
                populateItemFilterDropdown();
                const rect = nameHeader.getBoundingClientRect();
                itemFilterDropdown.style.left = `${rect.left}px`;
                itemFilterDropdown.style.top = `${rect.bottom}px`;
                itemFilterDropdown.style.display = 'block';
            });

            itemFilterDropdown.addEventListener('click', (event) => {
                event.stopPropagation();
                const target = event.target.closest('div');
                if (!target) return;

                const id = target.dataset.id;
                if (id === 'all') {
                    if (itemFilter.length === rules.length) {
                        itemFilter = [];
                    } else {
                        itemFilter = rules.map(r => r.id);
                    }
                } else if (id) {
                    if (itemFilter.includes(id)) {
                        itemFilter = itemFilter.filter(filterId => filterId !== id);
                    } else {
                        itemFilter.push(id);
                    }
                }
                
                populateItemFilterDropdown();
                renderLedger();
            });
            
            window.addEventListener('click', (event) => { 
                if (!nameHeader.contains(event.target) && !itemFilterDropdown.contains(event.target)) { 
                    itemFilterDropdown.style.display = 'none';
                } 
            });

            // Rule Modal Listeners
            deleteRuleBtn.addEventListener('click', () => { const rule = rules.find(r => r.id === ruleToDeleteId); if (!rule) return; const formattedAmount = (rule.amount >= 0 ? '+' : '') + rule.amount.toFixed(2); modalRuleInfo.innerHTML = `<strong>${rule.name}</strong> (${formattedAmount})`; deleteRuleModal.style.display = 'flex'; });
            closeRuleDetailsBtn.addEventListener('click', () => { ruleDetailsModal.style.display = 'none'; });
            ruleTransactionsBtn.addEventListener('click', () => showRuleTransactions(ruleToDeleteId));
            closeRuleTransactionsBtn.addEventListener('click', () => { ruleTransactionsModal.style.display = 'none'; });
            confirmDeleteRuleBtn.addEventListener('click', () => { if (ruleToDeleteId) deleteRule(ruleToDeleteId); deleteRuleModal.style.display = 'none'; ruleDetailsModal.style.display = 'none'; ruleToDeleteId = null; });
            cancelDeleteRuleBtn.addEventListener('click', () => { deleteRuleModal.style.display = 'none'; });
            
            // Ledger Item Modal Listeners
            saveChangesBtn.addEventListener('click', handleSaveChanges);
            postItemBtn.addEventListener('click', handlePostToggle);
            moveAndPostBtn.addEventListener('click', handleMoveAndPost);
            cancelEditBtn.addEventListener('click', () => { editLedgerItemModal.style.display = 'none'; ledgerItemToEditId = null; });
            deleteItemBtn.addEventListener('click', () => { const item = ledger.find(i => i.id === ledgerItemToEditId); if(!item) return; modalItemInfo.innerHTML = `<strong>${item.name}</strong> on ${item.date} for ${item.amount.toFixed(2)}`; deleteItemModal.style.display = 'flex'; });
            confirmDeleteItemBtn.addEventListener('click', handleDeleteItem);
            cancelDeleteItemBtn.addEventListener('click', () => { deleteItemModal.style.display = 'none'; });
            editItemHistoryBtn.addEventListener('click', () => showHistory(ledgerItemToEditId));
            closeHistoryBtn.addEventListener('click', () => { historyModal.style.display = 'none'; });

            // Series Update Listeners
            applyToOneBtn.addEventListener('click', saveSingleChange);
            applyToFutureBtn.addEventListener('click', applySeriesUpdate);
            cancelFutureChangeBtn.addEventListener('click', () => {
                applyFutureChangesModal.style.display = 'none';
                pendingChanges = null;
            });

            // --- Initialization ---
            function init() { 
                loadData(); 
                itemFilter = rules.map(r => r.id); // Default to all selected
                document.getElementById('rule-start-date').valueAsDate = new Date(); 
                renderAll(); 
            }
            init();
        });
    </script>
</body>
</html>


