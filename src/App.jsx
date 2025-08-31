import React from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, query, where, getDocs, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';

// --- Timezone Data ---
// A subset of IANA time zones for the dropdown
const timezones = [
    { name: 'UTC (UTC+0:00)', value: 'UTC' },
    { name: 'GMT (UTC+0:00)', value: 'GMT' },
    { name: 'US/Pacific (UTC-8:00)', value: 'US/Pacific' },
    { name: 'US/Mountain (UTC-7:00)', value: 'US/Mountain' },
    { name: 'US/Central (UTC-6:00)', value: 'US/Central' },
    { name: 'US/Eastern (UTC-5:00)', value: 'US/Eastern' },
    { name: 'Europe/London (UTC+0:00)', value: 'Europe/London' },
    { name: 'Europe/Berlin (UTC+1:00)', value: 'Europe/Berlin' },
    { name: 'Europe/Moscow (UTC+3:00)', value: 'Europe/Moscow' },
    { name: 'Asia/Tokyo (UTC+9:00)', value: 'Asia/Tokyo' },
    { name: 'Asia/Dubai (UTC+4:00)', value: 'Asia/Dubai' },
    { name: 'Asia/Kolkata (UTC+5:30)', value: 'Asia/Kolkata' },
    { name: 'Australia/Sydney (UTC+10:00)', value: 'Australia/Sydney' },
    { name: 'Australia/Lord_Howe (UTC+10:30)', value: 'Australia/Lord_Howe' },
    { name: 'Pacific/Auckland (UTC+12:00)', value: 'Pacific/Auckland' },
    { name: 'Pacific/Honolulu (UTC-10:00)', value: 'Pacific/Honolulu' }
];

// --- Firebase Configuration ---
// This configuration will be used as a fallback if one is not provided by the environment.
const userFirebaseConfig = {
  apiKey: "AIzaSyD3YFW6HDtV8jTz0GIRZAEPx9wTCS6T1fU",
  authDomain: "budgeter-d4854.firebaseapp.com",
  projectId: "budgeter-d4854",
  storageBucket: "budgeter-d4854.appspot.com",
  messagingSenderId: "484673918178",
  appId: "1:484673918178:web:e9945fff52440b2a07fabb"
};

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : userFirebaseConfig;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Helper Functions ---

/**
 * Generates a random 7-digit alphanumeric code.
 * @returns {string} The generated budget ID.
 */
const generateBudgetId = () => {
    return Math.random().toString(36).substring(2, 9).toUpperCase();
};

/**
 * Generates a random 7-digit number as a string.
 * @returns {string} The generated rule identifier.
 */
const generateRuleIdentifier = () => {
    return Math.floor(1000000 + Math.random() * 9000000).toString();
};


/**
 * Parses a date string according to a specific timezone.
 * @param {string} dateString - e.g., "2025-08-31"
 * @param {string} timeZone - IANA timezone string
 * @returns {Date}
 */
const parseDateInTimeZone = (dateString, timeZone) => {
    const [year, month, day] = dateString.split('-').map(Number);
    // This method robustly creates a date that represents midnight in the target timezone.
    // It avoids issues with local system timezones interfering.
    const dateStrForParsing = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00.000`;
    const tempDate = new Date(dateStrForParsing);

    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric'
    });
    
    const localTimeInTZ = formatter.format(tempDate);
    return new Date(localTimeInTZ);
};


/**
 * Formats a Date object into a 'YYYY-MM-DD' string for a given timezone.
 * @param {Date} date - The date object to format.
 * @param {string} timeZone - The IANA timezone string.
 * @returns {string} The formatted date string.
 */
const formatDateInTimeZone = (date, timeZone) => {
    if (!date || !timeZone) return '';
    const formatter = new Intl.DateTimeFormat('en-CA', { // 'en-CA' gives YYYY-MM-DD
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: timeZone,
    });
    return formatter.format(date);
};

// --- Custom Hook for detecting outside clicks ---
const useOutsideClick = (ref, callback) => {
    React.useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                callback();
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [ref, callback]);
};


// --- React Components ---

/**
 * A modal component for user interaction.
 * @param {object} props - Component props.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {Function} props.onClose - Function to call on close.
 * @param {string} props.title - Modal title.
 * @param {React.ReactNode} props.children - Modal content.
 */
const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md m-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
                </div>
                <div>{children}</div>
            </div>
        </div>
    );
};


/**
 * The initial setup screen for new or returning users.
 * @param {object} props - Component props.
 * @param {Function} props.onBudgetLoaded - Callback function when budget is loaded/created.
 * @param {object} props.db - Firestore instance.
 * @param {string} props.userId - Current user ID.
 */
const SetupScreen = ({ onBudgetLoaded, db, userId }) => {
    const [years, setYears] = React.useState(1);
    const [timeZone, setTimeZone] = React.useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const [budgetIdInput, setBudgetIdInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState('');

    const handleCreateBudget = async () => {
        setIsLoading(true);
        setError('');
        const newBudgetId = generateBudgetId();
        try {
            const settings = { yearsForward: years, timeZone, owner: userId, isVirtualProjectionEnabled: true };
            const budgetRef = doc(db, `artifacts/${appId}/public/data/budgets`, newBudgetId);
            await setDoc(budgetRef, { settings });
            onBudgetLoaded(newBudgetId, settings, [], []); // Pass empty rules/transactions
            console.log("New budget created with ID:", newBudgetId);
        } catch (err) {
            console.error("Error creating budget:", err);
            setError(`Failed to create budget. Check Firestore rules & connection. Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCreateDemoBudget = async () => {
        setIsLoading(true);
        setError('');
        const newBudgetId = generateBudgetId();
        try {
            const settings = { yearsForward: years, timeZone, owner: userId, isVirtualProjectionEnabled: true };
            const budgetRef = doc(db, `artifacts/${appId}/public/data/budgets`, newBudgetId);

            // Define sample data
            const today = new Date();
            const getStartDate = (monthsAgo, dayOfMonth = 1) => {
                const date = new Date();
                date.setMonth(date.getMonth() - monthsAgo);
                date.setDate(dayOfMonth);
                return formatDateInTimeZone(date, timeZone);
            };

            const sampleRulesData = [
                // Income
                { name: 'Paycheck', amount: 2500, frequency: 'bi-weekly', startDate: getStartDate(3, 5) },
                { name: 'Side Hustle Income', amount: 300, frequency: 'monthly', startDate: getStartDate(2, 20) },
                // Housing
                { name: 'Rent Payment', amount: -1500, frequency: 'monthly', startDate: getStartDate(3, 1) },
                { name: 'Electricity Bill', amount: -85, frequency: 'monthly', startDate: getStartDate(3, 15) },
                { name: 'Water & Trash', amount: -75, frequency: 'monthly', startDate: getStartDate(2, 18) },
                { name: 'Internet Bill', amount: -65, frequency: 'monthly', startDate: getStartDate(3, 22) },
                // Transportation
                { name: 'Gasoline', amount: -50, frequency: 'weekly', startDate: getStartDate(3, 3) },
                { name: 'Car Insurance', amount: -120, frequency: 'monthly', startDate: getStartDate(3, 28) },
                { name: 'Public Transit Pass', amount: -50, frequency: 'monthly', startDate: getStartDate(2, 1) },
                // Food
                { name: 'Groceries', amount: -125, frequency: 'weekly', startDate: getStartDate(3, 6) },
                { name: 'Restaurants & Dining', amount: -70, frequency: 'weekly', startDate: getStartDate(2, 2) },
                { name: 'Coffee Shops', amount: -25, frequency: 'weekly', startDate: getStartDate(3, 1) },
                 // Personal & Health
                { name: 'Gym Membership', amount: -40, frequency: 'monthly', startDate: getStartDate(3, 5) },
                { name: 'Phone Bill', amount: -75, frequency: 'monthly', startDate: getStartDate(3, 12) },
                { name: 'Health Insurance', amount: -220, frequency: 'monthly', startDate: getStartDate(3, 1) },
                // Subscriptions
                { name: 'Streaming Service 1', amount: -15.99, frequency: 'monthly', startDate: getStartDate(3, 9) },
                { name: 'Music Streaming', amount: -10.99, frequency: 'monthly', startDate: getStartDate(2, 14) },
                { name: 'Cloud Storage', amount: -9.99, frequency: 'monthly', startDate: getStartDate(1, 19) },
                // Debt & Savings
                { name: 'Student Loan', amount: -250, frequency: 'monthly', startDate: getStartDate(3, 25) },
                { name: 'Credit Card Payment', amount: -200, frequency: 'monthly', startDate: getStartDate(3, 27) },
                { name: 'Savings Transfer', amount: -500, frequency: 'monthly', startDate: getStartDate(3, 1) },
                { name: 'Investment Account', amount: -250, frequency: 'monthly', startDate: getStartDate(2, 15) },
                 // Miscellaneous & One-Time
                { name: 'Haircut', amount: -30, frequency: 'monthly', startDate: getStartDate(2, 10) },
                { name: 'Household Supplies', amount: -40, frequency: 'monthly', startDate: getStartDate(1, 7) },
                { name: 'New Jacket Purchase', amount: -120, frequency: 'one-time', startDate: formatDateInTimeZone(new Date(new Date().setDate(today.getDate() - 20)), timeZone) },
                { name: 'Concert Tickets', amount: -180, frequency: 'one-time', startDate: formatDateInTimeZone(new Date(new Date().setDate(today.getDate() - 45)), timeZone) },
                { name: 'Birthday Gift', amount: -50, frequency: 'one-time', startDate: formatDateInTimeZone(new Date(new Date().setDate(today.getDate() - 10)), timeZone) },
                { name: 'Book Purchase', amount: -22, frequency: 'one-time', startDate: formatDateInTimeZone(new Date(new Date().setDate(today.getDate() - 5)), timeZone) },
                { name: 'Movie Night Out', amount: -40, frequency: 'one-time', startDate: formatDateInTimeZone(new Date(new Date().setDate(today.getDate() - 12)), timeZone) },
            ];

            const allGeneratedRules = [];
            const allGeneratedTransactions = [];
            const batch = writeBatch(db);

            batch.set(budgetRef, { settings });

            for (const ruleData of sampleRulesData) {
                const newRule = { ...ruleData, endDate: null, ruleIdentifier: generateRuleIdentifier() };
                const ruleRef = doc(collection(db, `artifacts/${appId}/public/data/budgets/${newBudgetId}/rules`));
                batch.set(ruleRef, newRule);
                const ruleWithId = { id: ruleRef.id, ...newRule };
                allGeneratedRules.push(ruleWithId);

                let currentDate = parseDateInTimeZone(newRule.startDate, timeZone);
                const finalDate = new Date(new Date().getFullYear() + settings.yearsForward, new Date().getMonth(), new Date().getDate());

                while (currentDate <= finalDate) {
                    const newTransaction = {
                        ruleId: ruleRef.id,
                        name: newRule.name,
                        ruleIdentifier: newRule.ruleIdentifier,
                        amount: newRule.amount,
                        date: formatDateInTimeZone(currentDate, timeZone),
                        isPosted: false,
                        isModified: false,
                    };
                    const transRef = doc(collection(db, `artifacts/${appId}/public/data/budgets/${newBudgetId}/transactions`));
                    batch.set(transRef, newTransaction);
                    allGeneratedTransactions.push({ id: transRef.id, ...newTransaction });

                    if (newRule.frequency === 'one-time') break;

                    switch (newRule.frequency) {
                        case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
                        case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                        case 'bi-weekly': currentDate.setDate(currentDate.getDate() + 14); break;
                        case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                        case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                    }
                }
            }
            await batch.commit();
            onBudgetLoaded(newBudgetId, settings, allGeneratedRules, allGeneratedTransactions);
        } catch (err) {
            console.error("Error creating demo budget:", err);
            setError(`Failed to create demo budget. Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleLoadBudget = async () => {
        if (!budgetIdInput.trim()) {
            setError('Please enter a Budget ID.');
            return;
        }
        setIsLoading(true);
        setError('');
        try {
            const budgetRef = doc(db, `artifacts/${appId}/public/data/budgets`, budgetIdInput.trim());
            const budgetSnap = await getDoc(budgetRef);

            if (budgetSnap.exists()) {
                const loadedSettings = budgetSnap.data().settings;
                // Provide a default for the new setting if it doesn't exist on older budgets
                const settings = { isVirtualProjectionEnabled: true, ...loadedSettings };

                const rulesQuery = query(collection(db, `artifacts/${appId}/public/data/budgets/${budgetIdInput.trim()}/rules`));
                const rulesSnap = await getDocs(rulesQuery);
                const rules = rulesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const transactionsQuery = query(collection(db, `artifacts/${appId}/public/data/budgets/${budgetIdInput.trim()}/transactions`));
                const transactionsSnap = await getDocs(transactionsQuery);
                const transactions = transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                onBudgetLoaded(budgetIdInput.trim(), settings, rules, transactions);
                 console.log("Budget loaded:", budgetIdInput.trim());
            } else {
                setError('Budget ID not found.');
            }
        } catch (err) {
            console.error("Error loading budget:", err);
            setError(`Failed to load budget. Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col justify-center items-center p-4">
            <div className="w-full max-w-md bg-gray-800 p-8 rounded-lg shadow-2xl">
                <h1 className="text-3xl font-bold text-center mb-6">Predictive Budgeting</h1>
                
                {error && <p className="bg-red-500/20 text-red-300 p-3 rounded-md mb-4 text-center">{error}</p>}

                <div className="space-y-6">
                    {/* Create New Budget Section */}
                    <div className="bg-gray-700/50 p-4 rounded-md">
                        <h2 className="text-xl font-semibold mb-4 border-b border-gray-600 pb-2">Create a New Budget</h2>
                        <div className="space-y-4">
                            <div>
                                <label htmlFor="years" className="block text-sm font-medium text-gray-300 mb-1">Years to Budget Forward</label>
                                <input
                                    type="number"
                                    id="years"
                                    value={years}
                                    onChange={(e) => setYears(Math.min(25, Math.max(1, parseInt(e.target.value) || 1)))}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                    min="1"
                                    max="25"
                                />
                            </div>
                            <div>
                                <label htmlFor="timezone" className="block text-sm font-medium text-gray-300 mb-1">Your Time Zone</label>
                                <select
                                    id="timezone"
                                    value={timeZone}
                                    onChange={(e) => setTimeZone(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                >
                                    {timezones.map(tz => <option key={tz.value} value={tz.value}>{tz.name}</option>)}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <button
                                    onClick={handleCreateBudget}
                                    disabled={isLoading}
                                    className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:bg-cyan-800/50 text-white font-bold py-2 px-4 rounded-md transition duration-200"
                                >
                                    {isLoading ? 'Creating...' : 'Generate New Budget'}
                                </button>
                                <button
                                    onClick={handleCreateDemoBudget}
                                    disabled={isLoading}
                                    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 text-white font-bold py-2 px-4 rounded-md transition duration-200"
                                >
                                    {isLoading ? 'Generating...' : 'Generate Demo Budget'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Or Separator */}
                    <div className="flex items-center">
                        <div className="flex-grow border-t border-gray-600"></div>
                        <span className="flex-shrink mx-4 text-gray-400">OR</span>
                        <div className="flex-grow border-t border-gray-600"></div>
                    </div>

                    {/* Load Existing Budget Section */}
                    <div className="bg-gray-700/50 p-4 rounded-md">
                        <h2 className="text-xl font-semibold mb-4 border-b border-gray-600 pb-2">Load Existing Budget</h2>
                        <div className="flex gap-2">
                             <input
                                type="text"
                                placeholder="Enter 3-7 digit Budget ID"
                                value={budgetIdInput}
                                onChange={(e) => setBudgetIdInput(e.target.value.toUpperCase())}
                                className="flex-grow bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-green-500 focus:outline-none"
                            />
                            <button
                                onClick={handleLoadBudget}
                                disabled={isLoading}
                                className="bg-green-600 hover:bg-green-700 disabled:bg-green-800/50 text-white font-bold py-2 px-4 rounded-md transition duration-200"
                            >
                                {isLoading ? 'Loading...' : 'Load'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Main application dashboard view.
 */
const AppDashboard = ({ budgetId, settings, initialRules, initialTransactions, db, onBudgetIdChange, onSettingsChange }) => {
    const [rules, setRules] = React.useState(initialRules);
    const [transactions, setTransactions] = React.useState(initialTransactions);
    const [isLoading, setIsLoading] = React.useState(false);
    const [activeTab, setActiveTab] = React.useState('ledger');
    const [virtualTransactions, setVirtualTransactions] = React.useState([]);
    const [isGeneratingVirtuals, setIsGeneratingVirtuals] = React.useState(false);
    
    // --- Filter State ---
    const [dateFilter, setDateFilter] = React.useState({ mode: 'future', start: '', end: '' });
    const [tempDateRange, setTempDateRange] = React.useState({ start: '', end: ''});
    const [isDateFilterOpen, setIsDateFilterOpen] = React.useState(false);
    
    const [selectedRuleIds, setSelectedRuleIds] = React.useState([]); // empty array means all
    const [isRuleFilterOpen, setIsRuleFilterOpen] = React.useState(false);
    
    // --- Modal State ---
    const [isEditModalOpen, setIsEditModalOpen] = React.useState(false);
    const [editingTransaction, setEditingTransaction] = React.useState(null);
    const [editForm, setEditForm] = React.useState({ amount: '', date: '' });
    const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false);
    const [ruleToDelete, setRuleToDelete] = React.useState(null);
    const [isPostFutureModalOpen, setIsPostFutureModalOpen] = React.useState(false);
    const [transactionToPost, setTransactionToPost] = React.useState(null);
    const [isRuleDetailModalOpen, setIsRuleDetailModalOpen] = React.useState(false);
    const [selectedRuleForDetails, setSelectedRuleForDetails] = React.useState(null);
    const [isEditBudgetIdModalOpen, setIsEditBudgetIdModalOpen] = React.useState(false);
    const [newBudgetIdInput, setNewBudgetIdInput] = React.useState('');
    const [modalError, setModalError] = React.useState('');
    const [isDeleteTransactionModalOpen, setIsDeleteTransactionModalOpen] = React.useState(false);
    const [updateFuture, setUpdateFuture] = React.useState(false);
    const [isConfirmSettingsModalOpen, setIsConfirmSettingsModalOpen] = React.useState(false);
    const [transactionsToProcess, setTransactionsToProcess] = React.useState({ toAdd: [], toDelete: [] });
    const [isQuickAddModalOpen, setIsQuickAddModalOpen] = React.useState(false);
    
    // --- Refs for outside click ---
    const dateFilterRef = React.useRef(null);
    const ruleFilterRef = React.useRef(null);
    
    // --- Form State ---
    const [ruleForm, setRuleForm] = React.useState({
        name: '', amount: '',
        startDate: formatDateInTimeZone(new Date(), settings.timeZone),
        endDate: '', frequency: 'monthly'
    });
    const [localSettings, setLocalSettings] = React.useState(settings);
    const [quickAddForm, setQuickAddForm] = React.useState({
        name: '',
        amount: '',
        date: formatDateInTimeZone(new Date(), settings.timeZone)
    });

    useOutsideClick(dateFilterRef, () => setIsDateFilterOpen(false));
    useOutsideClick(ruleFilterRef, () => setIsRuleFilterOpen(false));

    const todayString = React.useMemo(() => formatDateInTimeZone(new Date(), settings.timeZone), [settings.timeZone]);

    const sortedRules = React.useMemo(() => [...rules].sort((a, b) => a.name.localeCompare(b.name)), [rules]);

    const transactionsWithBalance = React.useMemo(() => {
        let runningBalance = 0;
        let postedRunningBalance = 0;
        const sorted = [...transactions].sort((a, b) => {
            const dateComparison = new Date(a.date) - new Date(b.date);
            if (dateComparison !== 0) return dateComparison;
            return b.amount - a.amount;
        });

        return sorted.map(t => {
            runningBalance += t.amount;
            if (t.isPosted) {
                postedRunningBalance += t.amount;
            }
            return { ...t, balance: runningBalance, postedBalance: postedRunningBalance };
        });
    }, [transactions]);

    const filteredTransactions = React.useMemo(() => {
        let transactionsToFilter = transactionsWithBalance;

        if (dateFilter.mode === 'future') {
            transactionsToFilter = transactionsToFilter.filter(t => t.date >= todayString);
        } else if (dateFilter.mode === 'range' && dateFilter.start && dateFilter.end) {
            transactionsToFilter = transactionsToFilter.filter(t => t.date >= dateFilter.start && t.date <= dateFilter.end);
        }

        if (selectedRuleIds.length > 0) {
            transactionsToFilter = transactionsToFilter.filter(t => selectedRuleIds.includes(t.ruleId));
        }

        return transactionsToFilter;
    }, [transactionsWithBalance, dateFilter, selectedRuleIds, todayString]);

    const virtualTransactionsWithBalance = React.useMemo(() => {
        if (virtualTransactions.length === 0) return [];

        const lastRealTransaction = transactionsWithBalance[transactionsWithBalance.length - 1];
        let lastBalance = lastRealTransaction ? lastRealTransaction.balance : 0;
        let lastPostedBalance = lastRealTransaction ? lastRealTransaction.postedBalance : 0;

        return virtualTransactions.map(t => {
            lastBalance += t.amount;
            return { ...t, balance: lastBalance, postedBalance: lastPostedBalance };
        });
    }, [virtualTransactions, transactionsWithBalance]);

     const allVisibleTransactions = React.useMemo(() => {
        const filteredVirtuals = selectedRuleIds.length > 0
            ? virtualTransactionsWithBalance.filter(t => selectedRuleIds.includes(t.ruleId))
            : virtualTransactionsWithBalance;

        return [...filteredTransactions, ...filteredVirtuals];
    }, [filteredTransactions, virtualTransactionsWithBalance, selectedRuleIds]);
    
    const pastDueCount = React.useMemo(() => {
        return transactions.filter(t => t.date < todayString && !t.isPosted).length;
    }, [transactions, todayString]);

    const handleRuleFormChange = (e) => {
        const { name, value } = e.target;
        setRuleForm(prev => ({ ...prev, [name]: value }));
    };

    const handleQuickAddFormChange = (e) => {
        const { name, value } = e.target;
        setQuickAddForm(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRuleFilterChange = (ruleId) => {
        setSelectedRuleIds(prev => prev.includes(ruleId) ? prev.filter(id => id !== ruleId) : [...prev, ruleId]);
    };
    
    const applyDateRangeFilter = () => {
        if (tempDateRange.start && tempDateRange.end) {
            setDateFilter({ mode: 'range', ...tempDateRange });
            setIsDateFilterOpen(false);
        } else {
            alert("Please select both a start and end date.");
        }
    };
    
    const handleTogglePosted = async (transaction) => {
        const isAttemptingToPost = !transaction.isPosted;
        const isFutureTransaction = transaction.date > todayString;

        if (isAttemptingToPost && isFutureTransaction) {
            setTransactionToPost(transaction);
            setIsPostFutureModalOpen(true);
            return;
        }

        const newPostedState = !transaction.isPosted;
        try {
            const transRef = doc(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`, transaction.id);
            await updateDoc(transRef, { isPosted: newPostedState });
            setTransactions(prev => prev.map(t => t.id === transaction.id ? { ...t, isPosted: newPostedState } : t));
        } catch (error) {
            console.error("Error updating posted status:", error);
        }
    };

    const handleConfirmPostFutureTransaction = async () => {
        if (!transactionToPost) return;
        try {
            const transRef = doc(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`, transactionToPost.id);
            await updateDoc(transRef, { isPosted: true, date: todayString, isModified: true });
            setTransactions(prev => prev.map(t => t.id === transactionToPost.id ? { ...t, isPosted: true, date: todayString, isModified: true } : t));
        } catch (error) {
            console.error("Error moving and posting transaction:", error);
        } finally {
            setIsPostFutureModalOpen(false);
            setTransactionToPost(null);
        }
    };

    const handleAddRule = async (e) => {
        e.preventDefault();
        const { name, amount, startDate, endDate, frequency } = ruleForm;
        if (!name || !amount || !startDate || !frequency) return;

        setIsLoading(true);
        const newRule = { 
            name, 
            amount: parseFloat(amount), 
            startDate, 
            endDate: endDate || null, 
            frequency,
            ruleIdentifier: generateRuleIdentifier() 
        };

        try {
            const ruleRef = await addDoc(collection(db, `artifacts/${appId}/public/data/budgets/${budgetId}/rules`), newRule);
            setRules(prev => [...prev, { id: ruleRef.id, ...newRule }]);
            
            const newTransactions = [];
            let currentDate = parseDateInTimeZone(startDate, settings.timeZone);
            const finalDate = endDate ? parseDateInTimeZone(endDate, settings.timeZone) : new Date(new Date().getFullYear() + settings.yearsForward, new Date().getMonth(), new Date().getDate());

            while (currentDate <= finalDate) {
                newTransactions.push({ 
                    ruleId: ruleRef.id, 
                    name: newRule.name, 
                    ruleIdentifier: newRule.ruleIdentifier,
                    amount: newRule.amount, 
                    date: formatDateInTimeZone(currentDate, settings.timeZone),
                    isPosted: false,
                    isModified: false,
                });
                if (frequency === 'one-time') break;
                switch (frequency) {
                    case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
                    case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                    case 'bi-weekly': currentDate.setDate(currentDate.getDate() + 14); break;
                    case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                    case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                }
            }

            const batch = writeBatch(db);
            const transactionsWithIds = [];
            newTransactions.forEach(trans => {
                 const transRef = doc(collection(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`));
                 batch.set(transRef, trans);
                 transactionsWithIds.push({ id: transRef.id, ...trans });
            });
            await batch.commit();

            setTransactions(prev => [...prev, ...transactionsWithIds]);
            setRuleForm({ name: '', amount: '', startDate: todayString, endDate: '', frequency: 'monthly' });
        } catch (error) {
            console.error("Error adding rule:", error);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleQuickAddTransaction = async (e) => {
        e.preventDefault();
        const { name, amount, date } = quickAddForm;
        if (!name || !amount || !date) return;

        setIsLoading(true);

        const newRule = { 
            name, 
            amount: parseFloat(amount), 
            startDate: date, 
            endDate: date, 
            frequency: 'one-time',
            ruleIdentifier: generateRuleIdentifier() 
        };
        
        try {
            const batch = writeBatch(db);
            const ruleRef = doc(collection(db, `artifacts/${appId}/public/data/budgets/${budgetId}/rules`));
            batch.set(ruleRef, newRule);
            
            const newTransaction = { 
                ruleId: ruleRef.id, 
                name: newRule.name, 
                ruleIdentifier: newRule.ruleIdentifier,
                amount: newRule.amount, 
                date: date,
                isPosted: false,
                isModified: false,
            };
            const transRef = doc(collection(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`));
            batch.set(transRef, newTransaction);
            
            await batch.commit();

            setRules(prev => [...prev, { id: ruleRef.id, ...newRule }]);
            setTransactions(prev => [...prev, { id: transRef.id, ...newTransaction }]);

            setIsQuickAddModalOpen(false);
            setQuickAddForm({ name: '', amount: '', date: todayString });
        } catch (error) {
            console.error("Error adding quick transaction:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const openDeleteModal = (rule) => {
        clearVirtualTransactions();
        setRuleToDelete(rule);
        setIsDeleteModalOpen(true);
    };

    const openRuleDetailModal = (rule) => {
        clearVirtualTransactions();
        setSelectedRuleForDetails(rule);
        setIsRuleDetailModalOpen(true);
    };
    
    const handleDeleteRule = async () => {
        if (!ruleToDelete) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`), where("ruleId", "==", ruleToDelete.id));
            const querySnapshot = await getDocs(q);
            const batch = writeBatch(db);
            querySnapshot.forEach(doc => batch.delete(doc.ref));
            const ruleRef = doc(db, `artifacts/${appId}/public/data/budgets/${budgetId}/rules`, ruleToDelete.id);
            batch.delete(ruleRef);
            await batch.commit();
            setRules(prev => prev.filter(r => r.id !== ruleToDelete.id));
            setTransactions(prev => prev.filter(t => t.ruleId !== ruleToDelete.id));
        } catch (error) {
            console.error("Error deleting rule:", error);
        } finally {
            setIsLoading(false);
            setIsDeleteModalOpen(false);
            setRuleToDelete(null);
        }
    };

    const openEditModal = (transaction) => {
        clearVirtualTransactions();
        setEditingTransaction(transaction);
        setEditForm({ amount: transaction.amount, date: transaction.date });
        setUpdateFuture(false);
        setIsEditModalOpen(true);
    };
    
    const handleDeleteTransaction = async () => {
        if (!editingTransaction) return;
        setIsLoading(true);
        try {
            const transRef = doc(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`, editingTransaction.id);
            await deleteDoc(transRef);
            setTransactions(prev => prev.filter(t => t.id !== editingTransaction.id));
        } catch (error) {
            console.error("Error deleting transaction:", error);
        } finally {
            setIsLoading(false);
            setIsDeleteTransactionModalOpen(false);
            setEditingTransaction(null);
        }
    };


    const handleUpdateTransaction = async (updateFuture) => {
        if (!editingTransaction) return;
        setIsLoading(true);
        const { id, ruleId, date: originalDateStr } = editingTransaction;
        const newAmount = parseFloat(editForm.amount);
        const newDateStr = editForm.date;

        try {
            const batch = writeBatch(db);
            const updatePayload = {
                amount: newAmount,
                date: newDateStr,
                isModified: true
            };

            if (updateFuture) {
                const originalDate = parseDateInTimeZone(originalDateStr, settings.timeZone);
                const newDate = parseDateInTimeZone(newDateStr, settings.timeZone);
                const dateDelta = newDate.getTime() - originalDate.getTime();
                const futureTransactions = transactions.filter(t => t.ruleId === ruleId && t.date >= originalDateStr);

                const updatedTransactions = futureTransactions.map(t => {
                    const updatedTransaction = { ...t, amount: newAmount, isModified: true };
                    if (dateDelta !== 0) {
                        const currentTransDate = parseDateInTimeZone(t.date, settings.timeZone);
                        const newTransDate = new Date(currentTransDate.getTime() + dateDelta);
                        updatedTransaction.date = formatDateInTimeZone(newTransDate, settings.timeZone);
                    }
                    const transRef = doc(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`, t.id);
                    batch.update(transRef, { amount: updatedTransaction.amount, date: updatedTransaction.date, isModified: true });
                    return updatedTransaction;
                });
                setTransactions(prev => [...prev.filter(t => !futureTransactions.some(ft => ft.id === t.id)), ...updatedTransactions]);
            } else {
                const transRef = doc(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`, id);
                batch.update(transRef, updatePayload);
                setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updatePayload } : t));
            }
            await batch.commit();
        } catch (error) {
            console.error("Error updating transaction(s):", error);
        } finally {
            setIsLoading(false);
            setIsEditModalOpen(false);
            setEditingTransaction(null);
        }
    };
    
    const handleUpdateBudgetId = async () => {
        const oldBudgetId = budgetId;
        const newBudgetId = newBudgetIdInput.trim().toUpperCase();
        setModalError('');

        if (newBudgetId.length < 3 || newBudgetId.length > 7 || !/^[A-Z0-9]+$/.test(newBudgetId)) {
            setModalError("ID must be 3-7 letters and numbers.");
            return;
        }
        if (newBudgetId === oldBudgetId) {
            setIsEditBudgetIdModalOpen(false);
            return;
        }

        setIsLoading(true);

        try {
            const newBudgetRef = doc(db, `artifacts/${appId}/public/data/budgets`, newBudgetId);
            const newBudgetSnap = await getDoc(newBudgetRef);
            if (newBudgetSnap.exists()) {
                setModalError("This Budget ID is already taken.");
                setIsLoading(false);
                return;
            }

            const batch = writeBatch(db);
            const oldSettingsRef = doc(db, `artifacts/${appId}/public/data/budgets`, oldBudgetId);
            const oldSettingsSnap = await getDoc(oldSettingsRef);
            if (oldSettingsSnap.exists()) {
                batch.set(newBudgetRef, oldSettingsSnap.data());
            }

            const oldRulesQuery = collection(db, `artifacts/${appId}/public/data/budgets/${oldBudgetId}/rules`);
            const oldRulesSnap = await getDocs(oldRulesQuery);
            oldRulesSnap.forEach(ruleDoc => {
                const newRuleRef = doc(db, `artifacts/${appId}/public/data/budgets/${newBudgetId}/rules`, ruleDoc.id);
                batch.set(newRuleRef, ruleDoc.data());
                batch.delete(ruleDoc.ref);
            });

            const oldTransactionsQuery = collection(db, `artifacts/${appId}/public/data/budgets/${oldBudgetId}/transactions`);
            const oldTransactionsSnap = await getDocs(oldTransactionsQuery);
            oldTransactionsSnap.forEach(transDoc => {
                const newTransRef = doc(db, `artifacts/${appId}/public/data/budgets/${newBudgetId}/transactions`, transDoc.id);
                batch.set(newTransRef, transDoc.data());
                batch.delete(transDoc.ref);
            });

            batch.delete(oldSettingsRef);
            await batch.commit();
            onBudgetIdChange(newBudgetId);

            setIsEditBudgetIdModalOpen(false);
            setNewBudgetIdInput('');

        } catch (error) {
            console.error("Error changing Budget ID:", error);
            setModalError("Failed to change ID. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrepareSettingsChange = () => {
        clearVirtualTransactions();
        const originalYears = settings.yearsForward;
        const newYears = parseInt(localSettings.yearsForward);
        
        const toAdd = [];
        const toDelete = [];

        // REBUILT LOGIC: This section has been re-architected to prevent key errors.
        if (newYears > originalYears) {
            const today = new Date();
            const currentEndDate = new Date(today.getFullYear() + originalYears, today.getMonth(), today.getDate());
            const newEndDate = new Date(today.getFullYear() + newYears, today.getMonth(), today.getDate());

            rules.forEach(rule => {
                if (rule.frequency === 'one-time') return;
                
                let currentDate = parseDateInTimeZone(rule.startDate, settings.timeZone);
                // Fast-forward to the end of the current projection to only calculate new items
                while(currentDate <= currentEndDate) {
                    if (rule.endDate && parseDateInTimeZone(rule.endDate, settings.timeZone) <= currentDate) break;
                     switch (rule.frequency) {
                        case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
                        case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                        case 'bi-weekly': currentDate.setDate(currentDate.getDate() + 14); break;
                        case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                        case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                        default: return; // Should not happen
                    }
                }

                // Now, generate only the new transactions
                while (currentDate <= newEndDate) {
                    toAdd.push({ 
                        // The stable key is now generated here for the preview.
                        key: `${rule.id}-${formatDateInTimeZone(currentDate, settings.timeZone)}`,
                        ruleId: rule.id, name: rule.name, ruleIdentifier: rule.ruleIdentifier,
                        amount: rule.amount, date: formatDateInTimeZone(currentDate, settings.timeZone),
                        isPosted: false, isModified: false
                    });

                    if (rule.endDate && parseDateInTimeZone(rule.endDate, settings.timeZone) <= currentDate) break;

                    switch (rule.frequency) {
                        case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
                        case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                        case 'bi-weekly': currentDate.setDate(currentDate.getDate() + 14); break;
                        case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                        case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                    }
                }
            });
        } else if (newYears < originalYears) {
            const today = new Date();
            const newEndDateString = formatDateInTimeZone(new Date(today.getFullYear() + newYears, today.getMonth(), today.getDate()), settings.timeZone);
            transactions.forEach(t => {
                if (t.date > newEndDateString) {
                    toDelete.push(t);
                }
            });
        }
        
        if(toAdd.length > 0 || toDelete.length > 0) {
            setTransactionsToProcess({ toAdd, toDelete });
            setIsConfirmSettingsModalOpen(true);
        } else if (
            localSettings.timeZone !== settings.timeZone || 
            (localSettings.isVirtualProjectionEnabled ?? true) !== (settings.isVirtualProjectionEnabled ?? true)
        ) { 
            // Only timezone or toggle changed, no transaction adjustments needed
            handleConfirmSettingsChange();
        }
    };
    
    const handleConfirmSettingsChange = async () => {
        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            
            transactionsToProcess.toAdd.forEach(trans => {
                const { key, ...transData } = trans; // Remove the temporary key before saving to Firestore
                const transRef = doc(collection(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`));
                batch.set(transRef, transData);
            });
            
            transactionsToProcess.toDelete.forEach(trans => {
                const transRef = doc(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`, trans.id);
                batch.delete(transRef);
            });

            const settingsRef = doc(db, `artifacts/${appId}/public/data/budgets`, budgetId);
            batch.update(settingsRef, { settings: localSettings });

            await batch.commit();

            // Refresh all data from Firestore to ensure consistency, as we don't know the new IDs
             const rulesQuery = query(collection(db, `artifacts/${appId}/public/data/budgets/${budgetId}/rules`));
             const rulesSnap = await getDocs(rulesQuery);
             setRules(rulesSnap.docs.map(d => ({ id: d.id, ...d.data() })));

             const transactionsQuery = query(collection(db, `artifacts/${appId}/public/data/budgets/${budgetId}/transactions`));
             const transactionsSnap = await getDocs(transactionsQuery);
             setTransactions(transactionsSnap.docs.map(d => ({ id: d.id, ...d.data() })));

            onSettingsChange(localSettings);

        } catch (error) {
            console.error("Error updating settings and transactions:", error);
        } finally {
            setIsLoading(false);
            setIsConfirmSettingsModalOpen(false);
            setTransactionsToProcess({ toAdd: [], toDelete: [] });
        }
    };

    const generateMoreVirtualTransactions = React.useCallback(() => {
        setIsGeneratingVirtuals(true);
    
        const allCurrentTransactions = [...transactions, ...virtualTransactions];
        const lastTransaction = allCurrentTransactions.length > 0
            ? allCurrentTransactions.reduce((latest, current) => new Date(latest.date) > new Date(current.date) ? latest : current)
            : null;
    
        const startDate = lastTransaction ? parseDateInTimeZone(lastTransaction.date, settings.timeZone) : new Date();
    
        let nextOccurrences = [];
    
        rules.forEach(rule => {
            if (rule.frequency === 'one-time') return;
    
            let currentDate = parseDateInTimeZone(rule.startDate, settings.timeZone);
    
            while (currentDate <= startDate) {
                if (rule.endDate && parseDateInTimeZone(rule.endDate, settings.timeZone) < currentDate) {
                    return; 
                }
                switch (rule.frequency) {
                    case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
                    case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
                    case 'bi-weekly': currentDate.setDate(currentDate.getDate() + 14); break;
                    case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
                    case 'annual': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
                }
            }
            
            if (!rule.endDate || parseDateInTimeZone(rule.endDate, settings.timeZone) >= currentDate) {
                nextOccurrences.push({ date: new Date(currentDate.getTime()), rule });
            }
        });
    
        const newVirtuals = [];
        for (let i = 0; i < 30; i++) {
            if (nextOccurrences.length === 0) break;
    
            nextOccurrences.sort((a, b) => a.date - b.date);
            const next = nextOccurrences.shift();
            
            newVirtuals.push({
                key: crypto.randomUUID(),
                isVirtual: true,
                ruleId: next.rule.id,
                name: next.rule.name,
                ruleIdentifier: next.rule.ruleIdentifier,
                amount: next.rule.amount,
                date: formatDateInTimeZone(next.date, settings.timeZone),
                isPosted: false,
            });
    
            let nextCurrentDate = next.date;
             switch (next.rule.frequency) {
                case 'daily': nextCurrentDate.setDate(nextCurrentDate.getDate() + 1); break;
                case 'weekly': nextCurrentDate.setDate(nextCurrentDate.getDate() + 7); break;
                case 'bi-weekly': nextCurrentDate.setDate(nextCurrentDate.getDate() + 14); break;
                case 'monthly': nextCurrentDate.setMonth(nextCurrentDate.getMonth() + 1); break;
                case 'annual': nextCurrentDate.setFullYear(nextCurrentDate.getFullYear() + 1); break;
            }
            if (!next.rule.endDate || parseDateInTimeZone(next.rule.endDate, settings.timeZone) >= nextCurrentDate) {
                nextOccurrences.push({ date: nextCurrentDate, rule: next.rule });
            }
        }
    
        setVirtualTransactions(prev => [...prev, ...newVirtuals]);
        setIsGeneratingVirtuals(false);
    }, [rules, transactions, virtualTransactions, settings.timeZone, isGeneratingVirtuals]);

    const handleScroll = (e) => {
        // Check if the feature is enabled in the current settings
        if (!(settings.isVirtualProjectionEnabled ?? true)) return;

        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const isAtBottom = scrollHeight - scrollTop <= clientHeight + 1; 

        if (isAtBottom && !isGeneratingVirtuals ) {
            generateMoreVirtualTransactions();
        }
    };


    return (
        <div className="h-screen bg-gray-900 text-gray-200 p-4 font-sans flex flex-col">
            {isLoading && <div className="fixed top-0 left-0 w-full h-full bg-black/50 flex items-center justify-center z-50"><div className="text-white text-xl">Processing...</div></div>}

            <div className="w-full max-w-4xl mx-auto bg-gray-800 rounded-lg shadow-lg flex flex-col flex-grow min-h-0">
                <div className="flex border-b border-gray-700">
                    <button 
                        onClick={() => { setActiveTab('ledger'); }}
                        className={`py-2 px-4 text-sm font-medium transition-colors duration-200 ${activeTab === 'ledger' ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}
                    >
                        Transaction Ledger
                    </button>
                    <button 
                        onClick={() => { setActiveTab('rules'); clearVirtualTransactions(); }}
                        className={`py-2 px-4 text-sm font-medium transition-colors duration-200 ${activeTab === 'rules' ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}
                    >
                        Budget Rules
                    </button>
                     <button 
                        onClick={() => { setActiveTab('settings'); clearVirtualTransactions(); }}
                        className={`py-2 px-4 text-sm font-medium transition-colors duration-200 ${activeTab === 'settings' ? 'bg-gray-800 text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:bg-gray-700/50'}`}
                    >
                        Settings
                    </button>
                    <button
                        onClick={() => { clearVirtualTransactions(); setQuickAddForm({ name: '', amount: '', date: todayString }); setIsQuickAddModalOpen(true); }}
                        className="py-2 px-4 text-lg font-bold text-green-400 hover:bg-gray-700/50"
                        title="Quick Add Transaction"
                    >
                        +
                    </button>
                </div>
                
                {/* Ledger View */}
                {activeTab === 'ledger' && (
                <div className="p-4 flex flex-col flex-grow min-h-0">
                    <div className="md:flex justify-between items-center mb-2">
                        <h2 className="text-lg font-semibold text-white">Transactions</h2>
                        <div className="hidden md:flex gap-2 text-sm relative">
                            {/* Desktop Filters */}
                            <div ref={dateFilterRef} className="relative">
                                <button onClick={() => setIsDateFilterOpen(prev => !prev)} className="bg-gray-700 px-3 py-1 rounded w-32 text-left relative">
                                    Date: {dateFilter.mode === 'future' ? 'Future' : dateFilter.mode === 'all' ? 'All Time' : 'Custom'}
                                    {pastDueCount > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-gray-800">
                                            {pastDueCount}
                                        </span>
                                    )}
                                </button>
                                {isDateFilterOpen && (
                                <div onMouseDown={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-2 w-72 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10 p-4 space-y-3">
                                    <button onClick={() => { setDateFilter({ mode: 'future' }); setTempDateRange({ start: '', end: '' }); setIsDateFilterOpen(false); }} className="w-full text-left p-2 rounded hover:bg-gray-600">From Today Onwards</button>
                                    <button onClick={() => { setDateFilter({ mode: 'all' }); setTempDateRange({ start: '', end: '' }); setIsDateFilterOpen(false); }} className="w-full text-left p-2 rounded hover:bg-gray-600">All Transactions</button>
                                    <div className="border-t border-gray-600 pt-3 space-y-2">
                                        <p className="text-xs text-gray-400">Custom Date Range:</p>
                                        <div><label className="text-xs">Start</label><input type="date" value={tempDateRange.start} onChange={e => setTempDateRange(p => ({...p, start: e.target.value}))} className="w-full bg-gray-800 p-1 rounded text-sm" /></div>
                                        <div><label className="text-xs">End</label><input type="date" value={tempDateRange.end} onChange={e => setTempDateRange(p => ({...p, end: e.target.value}))} className="w-full bg-gray-800 p-1 rounded text-sm" /></div>
                                        <button onClick={applyDateRangeFilter} className="w-full bg-cyan-600 hover:bg-cyan-700 px-3 py-1 rounded text-sm">Apply</button>
                                    </div>
                                </div>
                                )}
                            </div>
                            <div ref={ruleFilterRef} className="relative">
                                <button onClick={() => setIsRuleFilterOpen(prev => !prev)} className="bg-gray-700 px-3 py-1 rounded w-32 text-left truncate">
                                    Rules: {selectedRuleIds.length === 0 ? 'All' : `${selectedRuleIds.length} Selected`}
                                </button>
                                {isRuleFilterOpen && (
                                <div onMouseDown={(e) => e.stopPropagation()} className="absolute top-full right-0 mt-2 w-56 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10 p-2">
                                     <div className="max-h-48 overflow-y-auto text-sm">
                                         <div onClick={() => setSelectedRuleIds([])} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-600 cursor-pointer"><input type="checkbox" readOnly checked={selectedRuleIds.length === 0} /><span className="font-bold">All Rules</span></div>
                                         {sortedRules.map(rule => (
                                             <div key={rule.id} onClick={() => handleRuleFilterChange(rule.id)} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-600 cursor-pointer"><input type="checkbox" readOnly checked={selectedRuleIds.includes(rule.id)} /><span className="truncate">{rule.name}</span></div>
                                         ))}
                                     </div>
                                </div>
                                )}
                            </div>
                        </div>
                    </div>
                     <div className="flex justify-between items-center pb-2 border-b border-gray-700 mb-2">
                        <div className="text-xs text-cyan-400">
                            ID: 
                            <span 
                                onClick={() => { clearVirtualTransactions(); setNewBudgetIdInput(budgetId); setModalError(''); setIsEditBudgetIdModalOpen(true); }}
                                className="font-mono bg-gray-700 px-1 py-0.5 rounded cursor-pointer hover:bg-gray-600 transition-colors ml-1"
                                title="Click to change Budget ID"
                            >
                                {budgetId}
                            </span>
                        </div>
                        <div className="flex md:hidden gap-2 text-sm relative">
                            {/* Mobile Filters */}
                            <div ref={dateFilterRef} className="relative">
                                <button onClick={() => setIsDateFilterOpen(prev => !prev)} className="bg-gray-700 px-3 py-1 rounded w-32 text-left relative">
                                    Date: {dateFilter.mode === 'future' ? 'Future' : dateFilter.mode === 'all' ? 'All Time' : 'Custom'}
                                    {pastDueCount > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center border-2 border-gray-800">
                                            {pastDueCount}
                                        </span>
                                    )}
                                </button>
                                {isDateFilterOpen && (
                                <div className="absolute top-full left-0 mt-2 w-72 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10 p-4 space-y-3">
                                    <button onClick={() => { setDateFilter({ mode: 'future' }); setTempDateRange({ start: '', end: '' }); setIsDateFilterOpen(false); }} className="w-full text-left p-2 rounded hover:bg-gray-600">From Today Onwards</button>
                                    <button onClick={() => { setDateFilter({ mode: 'all' }); setTempDateRange({ start: '', end: '' }); setIsDateFilterOpen(false); }} className="w-full text-left p-2 rounded hover:bg-gray-600">All Transactions</button>
                                    <div className="border-t border-gray-600 pt-3 space-y-2">
                                        <p className="text-xs text-gray-400">Custom Date Range:</p>
                                        <div><label className="text-xs">Start</label><input type="date" value={tempDateRange.start} onChange={e => setTempDateRange(p => ({...p, start: e.target.value}))} className="w-full bg-gray-800 p-1 rounded text-sm" /></div>
                                        <div><label className="text-xs">End</label><input type="date" value={tempDateRange.end} onChange={e => setTempDateRange(p => ({...p, end: e.target.value}))} className="w-full bg-gray-800 p-1 rounded text-sm" /></div>
                                        <button onClick={applyDateRangeFilter} className="w-full bg-cyan-600 hover:bg-cyan-700 px-3 py-1 rounded text-sm">Apply</button>
                                    </div>
                                </div>
                                )}
                            </div>
                            <div ref={ruleFilterRef} className="relative">
                                <button onClick={() => setIsRuleFilterOpen(prev => !prev)} className="bg-gray-700 px-3 py-1 rounded w-32 text-left truncate">
                                    Rules: {selectedRuleIds.length === 0 ? 'All' : `${selectedRuleIds.length} Selected`}
                                </button>
                                {isRuleFilterOpen && (
                                <div className="absolute top-full right-0 mt-2 w-56 bg-gray-700 border border-gray-600 rounded-lg shadow-xl z-10 p-2">
                                     <div className="max-h-48 overflow-y-auto text-sm">
                                         <div onClick={() => setSelectedRuleIds([])} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-600 cursor-pointer"><input type="checkbox" readOnly checked={selectedRuleIds.length === 0} /><span className="font-bold">All Rules</span></div>
                                         {sortedRules.map(rule => (
                                             <div key={rule.id} onClick={() => handleRuleFilterChange(rule.id)} className="flex items-center gap-2 p-1.5 rounded hover:bg-gray-600 cursor-pointer"><input type="checkbox" readOnly checked={selectedRuleIds.includes(rule.id)} /><span className="truncate">{rule.name}</span></div>
                                         ))}
                                     </div>
                                </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex-grow overflow-y-auto pr-2" onScroll={handleScroll}>
                        {allVisibleTransactions.map(t => (
                            <div key={t.id || t.key} className={`text-xs bg-gray-700/50 p-1.5 rounded mb-1 grid grid-cols-12 items-center gap-2 ${t.isVirtual ? 'opacity-60' : ''}`}>
                                <div className="col-span-1 flex justify-center">
                                    {!t.isVirtual && (
                                        <input 
                                            type="checkbox" 
                                            checked={!!t.isPosted} 
                                            onChange={() => handleTogglePosted(t)}
                                            className="form-checkbox h-3.5 w-3.5 text-cyan-600 bg-gray-800 border-gray-600 rounded focus:ring-cyan-500"
                                        />
                                    )}
                                </div>
                                <div className={`col-span-11 grid grid-cols-11 items-center gap-2 ${!t.isVirtual && 'cursor-pointer'}`} onClick={t.isVirtual ? undefined : () => openEditModal(t)}>
                                    <span className="font-semibold truncate text-white col-span-4 flex items-center">
                                        {t.name}
                                        {t.isModified && <span className="text-red-500 font-bold ml-1" title="Modified">(M)</span>}
                                        {t.date < todayString && !t.isPosted && <span className="text-red-500 font-bold ml-1 animate-pulse" title="Past Due">(!)</span>}
                                    </span>
                                    <span className="font-mono text-gray-300 col-span-2">{t.date}</span>
                                    <span className={`font-mono text-right col-span-2 ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>${t.amount.toFixed(2)}</span>
                                    <div className="col-span-3 text-right pr-2 flex justify-end items-center">
                                        {t.balance.toFixed(2) === t.postedBalance.toFixed(2) && !t.isVirtual ? (
                                            <span className="text-gray-600 font-mono text-lg mr-1">[</span>
                                        ) : (
                                            <span className="text-transparent font-mono text-lg mr-1">[</span>
                                        )}
                                        <div>
                                            <span className={`font-mono block ${t.balance >= 0 ? 'text-gray-300' : 'text-orange-400'}`} title="Overall Balance">${t.balance.toFixed(2)}</span>
                                            <span className={`font-mono block text-xs ${t.postedBalance >= 0 ? 'text-cyan-400' : 'text-cyan-600'}`} title="Posted Items Balance">${t.postedBalance.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isGeneratingVirtuals && <p className="text-center text-xs text-gray-500 py-2">Generating predictions...</p>}
                        {allVisibleTransactions.length === 0 && <p className="text-center text-gray-400 mt-4">No transactions match the current filters.</p>}
                    </div>
                </div>
                )}

                {/* Rules View */}
                {activeTab === 'rules' && (
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <h2 className="text-lg font-semibold mb-2 border-b border-gray-700 pb-2 text-white">Add New Rule</h2>
                         <form onSubmit={handleAddRule} className="grid grid-cols-2 gap-3 text-sm">
                            <input name="name" value={ruleForm.name} onChange={handleRuleFormChange} placeholder="Rule Name (e.g., Rent)" className="col-span-2 bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            <input name="amount" type="number" step="0.01" value={ruleForm.amount} onChange={handleRuleFormChange} placeholder="Amount" className="bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
                            <select name="frequency" value={ruleForm.frequency} onChange={handleRuleFormChange} className="bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500">
                                <option value="one-time">One-Time</option>
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="bi-weekly">Bi-Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="annual">Annual</option>
                            </select>
                            <div className="col-span-1"><label className="text-xs text-gray-400">Start Date</label><input name="startDate" type="date" value={ruleForm.startDate} onChange={handleRuleFormChange} className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500" /></div>
                            <div className="col-span-1"><label className="text-xs text-gray-400">End Date (Optional)</label><input name="endDate" type="date" value={ruleForm.endDate} onChange={handleRuleFormChange} className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500" /></div>
                            <button type="submit" className="col-span-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-4 rounded transition duration-200">Add Rule</button>
                        </form>
                    </div>
                     <div>
                        <h2 className="text-lg font-semibold mb-2 border-b border-gray-700 pb-2 text-white">Existing Rules</h2>
                        <div className="max-h-80 overflow-y-auto pr-2">
                            {sortedRules.map(rule => (
                                <div key={rule.id} className="text-sm bg-gray-700/50 p-2 rounded mb-2 flex justify-between items-start">
                                    <div className="flex-grow cursor-pointer" onClick={() => openRuleDetailModal(rule)}>
                                        <p className="font-bold text-white flex items-baseline">
                                            <span>{rule.name}</span>
                                            {rule.ruleIdentifier && <span className="ml-2 text-xs font-mono text-gray-500">{rule.ruleIdentifier}</span>}
                                        </p>
                                        <p className="text-gray-300">${rule.amount.toFixed(2)} - {rule.frequency}</p>
                                        <p className="text-xs text-gray-400">Starts: {rule.startDate}</p>
                                    </div>
                                    <button onClick={() => openDeleteModal(rule)} className="text-red-400 hover:text-red-300 font-bold p-1 rounded-full text-xs ml-2 flex-shrink-0">DELETE</button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                )}
                {/* Settings View */}
                {activeTab === 'settings' && (
                    <div className="p-4">
                        <h2 className="text-lg font-semibold mb-4 border-b border-gray-700 pb-2 text-white">App Settings</h2>
                        <div className="space-y-4 max-w-sm">
                             <div>
                                <label htmlFor="timezone-setting" className="block text-sm font-medium text-gray-300 mb-1">Your Time Zone</label>
                                <select
                                    id="timezone-setting"
                                    value={localSettings.timeZone}
                                    onChange={(e) => setLocalSettings(prev => ({...prev, timeZone: e.target.value}))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                >
                                    {timezones.map(tz => <option key={tz.value} value={tz.value}>{tz.name}</option>)}
                                </select>
                            </div>
                             <div>
                                <label htmlFor="years-setting" className="block text-sm font-medium text-gray-300 mb-1">Years to Budget Forward</label>
                                <input
                                    type="number"
                                    id="years-setting"
                                    value={localSettings.yearsForward}
                                    onChange={(e) => setLocalSettings(prev => ({...prev, yearsForward: Math.min(25, Math.max(1, parseInt(e.target.value) || 1))}))}
                                    className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                                    min="1"
                                    max="25"
                                />
                            </div>
                            <div className="pt-4">
                                 <label htmlFor="virtual-projection-toggle" className="block text-sm font-medium text-gray-300 mb-1">Virtual Transaction Projection</label>
                                <div className="flex items-center bg-gray-700/50 p-2 rounded-md">
                                   <input
                                        type="checkbox"
                                        id="virtual-projection-toggle"
                                        checked={localSettings.isVirtualProjectionEnabled ?? true}
                                        onChange={(e) => {
                                            const isEnabled = e.target.checked;
                                            if (!isEnabled) {
                                                clearVirtualTransactions(); // Immediately clear if disabled
                                            }
                                            setLocalSettings(prev => ({...prev, isVirtualProjectionEnabled: isEnabled}))
                                        }}
                                        className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-800 border-gray-600 rounded focus:ring-cyan-500"
                                    />
                                    <span className="ml-3 text-sm text-gray-300">{localSettings.isVirtualProjectionEnabled ?? true ? 'Enabled' : 'Disabled'}</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 pl-1">When enabled, scroll to the bottom of the ledger to project future transactions.</p>
                            </div>
                            <div className="pt-2">
                                <button
                                    onClick={handlePrepareSettingsChange}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md transition duration-200"
                                >
                                    Save Settings
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Transaction">
                 <div className="text-sm text-white">
                    <div className="pb-2 border-b border-gray-700 mb-4">
                        <h4 className="font-bold text-lg text-white flex items-baseline">
                           <span>{editingTransaction?.name}</span>
                           {editingTransaction?.ruleIdentifier && <span className="ml-2 text-sm font-mono text-gray-400">{editingTransaction.ruleIdentifier}</span>}
                        </h4>
                        <p className="text-xs font-mono text-gray-500">ID: {editingTransaction?.id}</p>
                    </div>
                    <div className="space-y-4">
                        <div><label className="block text-xs text-gray-400">Amount</label><input type="number" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500" /></div>
                        <div><label className="block text-xs text-gray-400">Date</label><input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500" /></div>
                        
                        <div className="flex items-center pt-2">
                            <input
                                id="update-future-checkbox"
                                type="checkbox"
                                checked={updateFuture}
                                onChange={(e) => setUpdateFuture(e.target.checked)}
                                className="form-checkbox h-4 w-4 text-cyan-600 bg-gray-800 border-gray-600 rounded focus:ring-cyan-500"
                            />
                            <label htmlFor="update-future-checkbox" className="ml-2 text-xs text-gray-300">Modify all future transactions</label>
                        </div>

                        <div className="flex justify-between items-center pt-4">
                             <button onClick={() => {setIsEditModalOpen(false); setIsDeleteTransactionModalOpen(true);}} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">Delete</button>
                             <button onClick={() => handleUpdateTransaction(updateFuture)} className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded">Save Changes</button>
                        </div>
                    </div>
                 </div>
            </Modal>
            <Modal isOpen={isQuickAddModalOpen} onClose={() => setIsQuickAddModalOpen(false)} title="Quick Add Transaction">
                <form onSubmit={handleQuickAddTransaction} className="space-y-4 text-sm text-white">
                    <div>
                        <label className="block text-xs text-gray-400">Transaction Name</label>
                        <input
                            type="text"
                            name="name"
                            value={quickAddForm.name}
                            onChange={handleQuickAddFormChange}
                            className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-gray-400">Amount</label>
                        <input
                            type="number"
                            name="amount"
                            step="0.01"
                            value={quickAddForm.amount}
                            onChange={handleQuickAddFormChange}
                            className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            required
                        />
                    </div>
                     <div>
                        <label className="block text-xs text-gray-400">Date</label>
                        <input
                            type="date"
                            name="date"
                            value={quickAddForm.date}
                            onChange={handleQuickAddFormChange}
                            className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                            required
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={() => setIsQuickAddModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded">Cancel</button>
                        <button type="submit" className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Add Transaction</button>
                    </div>
                </form>
            </Modal>
             <Modal isOpen={isDeleteTransactionModalOpen} onClose={() => setIsDeleteTransactionModalOpen(false)} title="Confirm Deletion">
                 <div className="space-y-4 text-sm text-white">
                    <p>Are you sure you want to delete this transaction?</p>
                    <p className="text-xs text-orange-300 bg-orange-500/10 p-2 rounded-md">This action cannot be undone.</p>
                     <div className="flex justify-end gap-3 pt-2">
                         <button onClick={() => {setIsDeleteTransactionModalOpen(false); setIsEditModalOpen(true);}} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded">Cancel</button>
                         <button onClick={handleDeleteTransaction} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">Confirm Delete</button>
                     </div>
                 </div>
            </Modal>
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="Confirm Deletion">
                 <div className="space-y-4 text-sm text-white">
                    <p>Are you sure you want to delete the rule <span className="font-bold">{ruleToDelete?.name}</span>?</p>
                    <p className="text-xs text-orange-300 bg-orange-500/10 p-2 rounded-md">This will permanently delete the rule and all of its associated transactions. This action cannot be undone.</p>
                     <div className="flex justify-end gap-3 pt-2">
                         <button onClick={() => setIsDeleteModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded">Cancel</button>
                         <button onClick={handleDeleteRule} className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded">Confirm Delete</button>
                     </div>
                 </div>
            </Modal>
            <Modal isOpen={isPostFutureModalOpen} onClose={() => setIsPostFutureModalOpen(false)} title="Post Future Transaction">
                <div className="space-y-4 text-sm text-white">
                    <p>This transaction is dated in the future. Future transactions cannot be posted directly.</p>
                    <p>Would you like to move this transaction's date to today (<span className="font-mono">{todayString}</span>) and post it?</p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setIsPostFutureModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded">Cancel</button>
                        <button onClick={handleConfirmPostFutureTransaction} className="bg-cyan-600 hover:bg-cyan-700 px-4 py-2 rounded">Move and Post</button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isRuleDetailModalOpen} onClose={() => setIsRuleDetailModalOpen(false)} title={`Transactions for "${selectedRuleForDetails?.name} ${selectedRuleForDetails?.ruleIdentifier ? `(${selectedRuleForDetails.ruleIdentifier})` : ''}"`}>
                <div className="max-h-96 overflow-y-auto pr-2 text-sm text-white">
                    {transactions
                        .filter(t => t.ruleId === selectedRuleForDetails?.id)
                        .sort((a, b) => new Date(a.date) - new Date(b.date))
                        .map(t => (
                            <div key={t.id} className="grid grid-cols-12 gap-2 items-center p-1.5 border-b border-gray-700">
                                <div className="col-span-3 font-mono">{t.date}</div>
                                <div className={`col-span-2 text-right font-mono ${t.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {t.amount.toFixed(2)}
                                </div>
                                <div className="col-span-4 font-mono text-gray-400 text-xs truncate" title={t.id}>
                                    {t.id}
                                </div>
                                <div className="col-span-3 flex items-center justify-end gap-2 text-xs">
                                    {t.isPosted && <span className="text-cyan-400" title="Posted">✓</span>}
                                    {t.isModified && <span className="text-red-500 font-bold" title="Modified">(M)</span>}
                                    {t.date < todayString && !t.isPosted && <span className="text-red-500 font-bold animate-pulse" title="Past Due">(!)</span>}
                                </div>
                            </div>
                        ))
                    }
                    {transactions.filter(t => t.ruleId === selectedRuleForDetails?.id).length === 0 && (
                        <p className="text-center text-gray-400 p-4">No transactions found for this rule.</p>
                    )}
                </div>
            </Modal>
            <Modal isOpen={isEditBudgetIdModalOpen} onClose={() => setIsEditBudgetIdModalOpen(false)} title="Change Budget ID">
                <div className="space-y-4 text-sm text-white">
                    <p>Enter a new ID (3-7 characters) using letters and numbers. This will move all your data to the new ID.</p>
                    <input 
                        type="text"
                        value={newBudgetIdInput}
                        onChange={(e) => setNewBudgetIdInput(e.target.value.toUpperCase())}
                        maxLength="7"
                        className="w-full bg-gray-700 p-2 rounded border border-gray-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 font-mono"
                    />
                    {modalError && <p className="text-red-400 text-xs">{modalError}</p>}
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setIsEditBudgetIdModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded">Cancel</button>
                        <button onClick={handleUpdateBudgetId} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Save and Move Data</button>
                    </div>
                </div>
            </Modal>
            <Modal isOpen={isConfirmSettingsModalOpen} onClose={() => setIsConfirmSettingsModalOpen(false)} title="Confirm Settings Change">
                <div className="text-sm text-white">
                    {transactionsToProcess.toAdd.length > 0 && (
                        <div className="mb-4">
                            <p className="font-bold">The following {transactionsToProcess.toAdd.length} transactions will be ADDED:</p>
                            <div className="max-h-32 overflow-y-auto bg-gray-700/50 p-2 rounded mt-2">
                                {transactionsToProcess.toAdd.map((t) => <div key={t.key} className="flex justify-between text-xs"><span className="truncate">{t.name}</span><span>{t.date}</span></div>)}
                            </div>
                        </div>
                    )}
                    {transactionsToProcess.toDelete.length > 0 && (
                         <div className="mb-4">
                            <p className="font-bold text-red-400">The following {transactionsToProcess.toDelete.length} transactions will be DELETED:</p>
                            <div className="max-h-32 overflow-y-auto bg-gray-700/50 p-2 rounded mt-2">
                                {transactionsToProcess.toDelete.map((t) => <div key={t.id} className="flex justify-between text-xs"><span className="truncate">{t.name}</span><span>{t.date}</span></div>)}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
                        <button onClick={() => setIsConfirmSettingsModalOpen(false)} className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded">Cancel</button>
                        <button onClick={handleConfirmSettingsChange} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">Confirm</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};


/**
 * The root component that manages authentication and switches between views.
 */
export default function App() {
    const [authReady, setAuthReady] = React.useState(false);
    const [db, setDb] = React.useState(null);
    const [userId, setUserId] = React.useState(null);

    const [budgetState, setBudgetState] = React.useState({
        id: null,
        settings: null,
        rules: [],
        transactions: [],
    });

     React.useEffect(() => {
        // Inject dependencies into the document head
        if (!document.getElementById('tailwind-script')) {
            const tailwindScript = document.createElement('script');
            tailwindScript.id = 'tailwind-script';
            tailwindScript.src = "https://cdn.tailwindcss.com";
            document.head.appendChild(tailwindScript);
        }

        if (!document.getElementById('google-fonts-preconnect-1')) {
            const preconnect1 = document.createElement('link');
            preconnect1.id = 'google-fonts-preconnect-1';
            preconnect1.rel = 'preconnect';
            preconnect1.href = 'https://fonts.googleapis.com';
            document.head.appendChild(preconnect1);
        }

        if (!document.getElementById('google-fonts-preconnect-2')) {
            const preconnect2 = document.createElement('link');
            preconnect2.id = 'google-fonts-preconnect-2';
            preconnect2.rel = 'preconnect';
            preconnect2.href = 'https://fonts.gstatic.com';
            preconnect2.crossOrigin = 'true';
            document.head.appendChild(preconnect2);
        }
        
        if (!document.getElementById('google-fonts-link')) {
            const fontsLink = document.createElement('link');
            fontsLink.id = 'google-fonts-link';
            fontsLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap';
            fontsLink.rel = 'stylesheet';
            document.head.appendChild(fontsLink);
        }
        
        if (!document.getElementById('custom-body-style')) {
            const style = document.createElement('style');
            style.id = 'custom-body-style';
            style.textContent = `body { font-family: 'Inter', sans-serif; }`;
            document.head.appendChild(style);
        }

        document.title = "Predictive Budgeting App";
    }, []);


    React.useEffect(() => {
        try {
            console.log("Initializing Firebase...");
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const firestore = getFirestore(app);
            setDb(firestore);
            console.log("Firebase initialized successfully.");

            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    console.log("User is signed in:", user.uid);
                    setUserId(user.uid);
                    setAuthReady(true);
                } else {
                     try {
                        console.log("No user signed in, attempting anonymous sign in...");
                        const token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
                        if (token) {
                            await signInWithCustomToken(auth, token);
                            console.log("Signed in with custom token.");
                        } else {
                            await signInAnonymously(auth);
                            console.log("Signed in anonymously.");
                        }
                    } catch (error) {
                        console.error("Firebase sign-in failed:", error);
                    }
                }
            });
            return () => unsubscribe();
        } catch (error) {
            console.error("Firebase initialization failed:", error);
        }
    }, []);

    const handleBudgetLoaded = (id, settings, rules, transactions) => {
        setBudgetState({ id, settings, rules, transactions });
    };

    const handleBudgetIdChange = (newId) => {
        setBudgetState(prevState => ({
            ...prevState,
            id: newId,
        }));
    };
    
    const handleSettingsChange = (newSettings) => {
         setBudgetState(prevState => ({
            ...prevState,
            settings: newSettings,
        }));
    };


    if (!authReady || !db) {
        return <div className="min-h-screen bg-gray-900 flex justify-center items-center text-white">Authenticating & Initializing...</div>;
    }
    
    return (
        <React.Fragment>
            {!budgetState.id || !budgetState.settings ? (
                <SetupScreen onBudgetLoaded={handleBudgetLoaded} db={db} userId={userId} />
            ) : (
                <AppDashboard 
                    budgetId={budgetState.id}
                    settings={budgetState.settings}
                    initialRules={budgetState.rules}
                    initialTransactions={budgetState.transactions}
                    db={db}
                    onBudgetIdChange={handleBudgetIdChange}
                    onSettingsChange={handleSettingsChange}
                />
            )}
        </React.Fragment>
    );
}



