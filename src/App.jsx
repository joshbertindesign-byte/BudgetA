import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, deleteDoc, doc, onSnapshot, query, Timestamp, setLogLevel, writeBatch, getDocs, updateDoc, where, setDoc, getDoc } from 'firebase/firestore';

// --- Date Calculation Helper ---
const generateTransactionInstances = (transactionRule) => {
    const instances = [];
    const hardEndDate = new Date('2030-12-31T23:59:59Z');
    if (!transactionRule.startDate?.seconds) return instances;

    const startDate = new Date(transactionRule.startDate.seconds * 1000);
    
    let effectiveEndDate = hardEndDate;
    if (transactionRule.endDate?.seconds) {
        const ruleEndDate = new Date(transactionRule.endDate.seconds * 1000);
        if (ruleEndDate < hardEndDate) {
            effectiveEndDate = ruleEndDate;
        }
    }

    if (transactionRule.frequency === 'one-time') {
        if (startDate <= effectiveEndDate) instances.push({ ...transactionRule, date: startDate });
        return instances;
    }

    let currentDate = new Date(startDate);
    while (currentDate <= effectiveEndDate) {
        instances.push({ ...transactionRule, date: new Date(currentDate) });
        switch (transactionRule.frequency) {
            case 'daily': currentDate.setDate(currentDate.getDate() + 1); break;
            case 'weekly': currentDate.setDate(currentDate.getDate() + 7); break;
            case 'bi-weekly': currentDate.setDate(currentDate.getDate() + 14); break;
            case 'monthly': currentDate.setMonth(currentDate.getMonth() + 1); break;
            case 'yearly': currentDate.setFullYear(currentDate.getFullYear() + 1); break;
            default: return instances;
        }
    }
    return instances;
};

// --- Helper Components ---

const Modal = ({ isOpen, children }) => {
    if (!isOpen) return null;
    return (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', padding: '1.5rem', width: '100%', maxWidth: '28rem', margin: '1rem', position: 'relative' }}>
                {children}
            </div>
        </div>
    );
};

const RecurringTransactionForm = ({ onAddTransaction, loading, onDone }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('expense');
    const [frequency, setFrequency] = useState('one-time');
    const [startDate, setStartDate] = useState(new Date().toLocaleDateString('en-CA', {timeZone: 'America/Chicago'}));
    const [hasEndDate, setHasEndDate] = useState(false);
    const [endDate, setEndDate] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!description || !amount || isNaN(parseFloat(amount)) || !startDate || (hasEndDate && !endDate)) return;
        
        const transaction = { 
            description, 
            amount: parseFloat(amount), 
            type, 
            frequency, 
            startDate: Timestamp.fromDate(new Date(startDate + 'T00:00:00-06:00')),
            ...(hasEndDate && { endDate: Timestamp.fromDate(new Date(endDate + 'T00:00:00-06:00')) })
        };
        await onAddTransaction(transaction);
        onDone();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
             <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937' }}>Add Transaction Rule</h2>
             <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                 <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Paycheck, Rent" style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }} required />
                 <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }} required />
                 <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }} required />
                 <select value={frequency} onChange={(e) => setFrequency(e.target.value)} style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem', backgroundColor: 'white' }}>
                     <option value="one-time">One-time</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="bi-weekly">Bi-weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option>
                 </select>
                 <div style={{ display: 'flex', alignItems: 'center' }}>
                     <input id="hasEndDate" type="checkbox" checked={hasEndDate} onChange={(e) => setHasEndDate(e.target.checked)} style={{ height: '1rem', width: '1rem' }}/>
                     <label htmlFor="hasEndDate" style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#111827' }}>Set an end date</label>
                 </div>
                 {hasEndDate && (
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }} required />
                 )}
                 <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                     <label style={{ display: 'flex', alignItems: 'center' }}><input type="radio" value="income" checked={type === 'income'} onChange={() => setType('income')} /><span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>Income</span></label>
                     <label style={{ display: 'flex', alignItems: 'center' }}><input type="radio" value="expense" checked={type === 'expense'} onChange={() => setType('expense')} /><span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>Expense</span></label>
                 </div>
                 <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                     <button type="button" onClick={onDone} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '500', backgroundColor: '#F3F4F6', borderRadius: '0.5rem' }}>Cancel</button>
                     <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '500', color: 'white', backgroundColor: '#2563EB', borderRadius: '0.5rem', opacity: loading ? 0.5 : 1 }}>{loading ? 'Saving...' : 'Add Rule'}</button>
                 </div>
             </form>
         </div>
    );
};

const QuickAddForm = ({ onAddTransaction, loading, onDone }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [type, setType] = useState('expense');

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!description || !amount || isNaN(parseFloat(amount))) return;
        
        const transaction = { 
            description, 
            amount: parseFloat(amount), 
            type, 
            frequency: 'one-time', 
            startDate: Timestamp.fromDate(new Date(new Date().toLocaleDateString('en-CA', {timeZone: 'America/Chicago'}) + 'T00:00:00-06:00')),
        };
        await onAddTransaction(transaction);
        onDone();
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937' }}>Quick Add Transaction</h2>
            <p style={{ fontSize: '0.875rem', color: '#6B7280' }}>This will add a one-time transaction for today.</p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g., Lunch, Coffee" style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }} required />
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" style={{ width: '100%', padding: '0.5rem 1rem', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }} required />
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center' }}><input type="radio" value="income" checked={type === 'income'} onChange={() => setType('income')} /><span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>Income</span></label>
                    <label style={{ display: 'flex', alignItems: 'center' }}><input type="radio" value="expense" checked={type === 'expense'} onChange={() => setType('expense')} /><span style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>Expense</span></label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                    <button type="button" onClick={onDone} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '500', backgroundColor: '#F3F4F6', borderRadius: '0.5rem' }}>Cancel</button>
                    <button type="submit" disabled={loading} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: '500', color: 'white', backgroundColor: '#2563EB', borderRadius: '0.5rem', opacity: loading ? 0.5 : 1 }}>{loading ? 'Saving...' : 'Add'}</button>
                </div>
            </form>
        </div>
    );
};


const ManageRulesModal = ({ isOpen, onClose, rules, onDelete, revisions, onViewRevisions }) => {
    const modifiedRuleIds = useMemo(() => new Set(revisions.map(r => r.parentId)), [revisions]);

    return (
        <Modal isOpen={isOpen}>
             <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#9CA3AF' }}>&times;</button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '1rem' }}>Manage Rules</h2>
            <div style={{ maxHeight: '24rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {rules.map(t => (
                    <li key={t.id} style={{ padding: '0.75rem', backgroundColor: '#F9FAFB', borderRadius: '0.5rem', listStyle: 'none' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div>
                                <p style={{ fontWeight: '600', display: 'flex', alignItems: 'center' }}>
                                    {t.description}
                                    {modifiedRuleIds.has(t.id) && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', fontWeight: 'bold', color: '#EF4444' }}>(M)</span>}
                                </p>
                                <p style={{ fontSize: '0.875rem', color: '#6B7280', textTransform: 'capitalize' }}>{t.frequency} from {new Date(t.startDate.seconds * 1000).toLocaleDateString()} {t.endDate && `to ${new Date(t.endDate.seconds * 1000).toLocaleDateString()}`}</p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ color: t.type === 'income' ? '#16A34A' : '#DC2626' }}>${t.amount.toFixed(2)}</span>
                                <button onClick={() => onDelete(t.id)} style={{ color: '#9CA3AF' }}>&times;</button>
                            </div>
                        </div>
                        {modifiedRuleIds.has(t.id) && (
                            <button onClick={() => onViewRevisions(t.id)} style={{ fontSize: '0.75rem', color: '#2563EB', marginTop: '0.25rem' }}>View Revisions</button>
                        )}
                    </li>
                ))}
            </div>
        </Modal>
    );
};

const RevisionsModal = ({ isOpen, onClose, revisions, ruleId }) => {
    const relevantRevisions = useMemo(() => revisions.filter(r => r.parentId === ruleId), [revisions, ruleId]);
    return (
        <Modal isOpen={isOpen}>
             <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#9CA3AF' }}>&times;</button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '1rem' }}>Revision History</h2>
            <div style={{ maxHeight: '24rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {relevantRevisions.length > 0 ? relevantRevisions.map(rev => (
                    <div key={rev.id} style={{ padding: '0.75rem', backgroundColor: '#F9FAFB', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                        <p style={{ fontWeight: '600' }}>Transaction on {new Date(rev.transactionDate.seconds * 1000).toLocaleDateString()}</p>
                        <p style={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'monospace' }}>ID: {rev.transactionId}</p>
                        <p>Changed on {new Date(rev.revisionDate.seconds * 1000).toLocaleString()}</p>
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', backgroundColor: 'rgba(254, 226, 226, 1)', borderRadius: '0.25rem' }}>
                            <p><b>Before:</b> {rev.before.description} (${rev.before.amount.toFixed(2)}) on {new Date(rev.before.date.seconds * 1000).toLocaleDateString()}</p>
                        </div>
                        <div style={{ marginTop: '0.25rem', padding: '0.5rem', backgroundColor: 'rgba(220, 252, 231, 1)', borderRadius: '0.25rem' }}>
                             <p><b>After:</b> {rev.after.description} (${rev.after.amount.toFixed(2)}) on {new Date(rev.after.date.seconds * 1000).toLocaleDateString()}</p>
                        </div>
                    </div>
                )) : <p>No revisions found for this rule.</p>}
            </div>
        </Modal>
    );
};

const UnmodifiedListModal = ({ isOpen, onClose, unmodifiedEntries }) => (
    <Modal isOpen={isOpen}>
         <button onClick={onClose} style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#9CA3AF' }}>&times;</button>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#1F2937', marginBottom: '1rem' }}>Unmodified Transactions</h2>
        <p style={{ fontSize: '0.875rem', color: '#4B5563', marginBottom: '1rem' }}>The following were not updated because they were previously modified or posted:</p>
        <div style={{ maxHeight: '16rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {unmodifiedEntries.map(entry => (
                <div key={entry.id} style={{ padding: '0.5rem', backgroundColor: '#F3F4F6', borderRadius: '0.375rem', fontSize: '0.875rem' }}>
                    <p><b>{entry.description}</b> on {new Date(entry.date.seconds * 1000).toLocaleDateString()}</p>
                </div>
            ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
            <button onClick={onClose} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#2563EB', color: 'white', borderRadius: '0.5rem' }}>OK</button>
        </div>
    </Modal>
);

const SetBudgetWindowModal = ({ onSave, onCancel, currentSettings }) => {
    const [startDate, setStartDate] = useState(currentSettings.startDate ? new Date(currentSettings.startDate.seconds * 1000).toISOString().split('T')[0] : new Date().toLocaleDateString('en-CA', {timeZone: 'America/Chicago'}));
    const [interval, setInterval] = useState(currentSettings.interval || 'bi-weekly');

    const handleSave = () => {
        let dateToSave = new Date(startDate + 'T00:00:00-06:00');
        if (interval === 'monthly') {
            dateToSave.setDate(1);
        }
        onSave({
            startDate: Timestamp.fromDate(dateToSave),
            interval
        });
    };

    return (
        <Modal isOpen={true}>
             <button onClick={onCancel} style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#9CA3AF' }}>&times;</button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Set Budget Window</h2>
            <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>Interval</label>
                <select value={interval} onChange={e => setInterval(e.target.value)} style={{ marginTop: '0.25rem', display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem' }}>
                    <option value="weekly">Weekly</option>
                    <option value="bi-weekly">Bi-weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </select>
            </div>
            <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginTop: '1rem' }}>Start Date</label>
                 {interval === 'monthly' ? (
                    <>
                        <input type="month" value={startDate.substring(0, 7)} onChange={e => setStartDate(e.target.value + '-01')} style={{ marginTop: '0.25rem', display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem' }}/>
                        <p style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>Monthly windows must start on the 1st.</p>
                    </>
                ) : (
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={{ marginTop: '0.25rem', display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem' }}/>
                )}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button onClick={onCancel} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#F3F4F6', borderRadius: '0.5rem' }}>Cancel</button>
                <button onClick={handleSave} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'white', backgroundColor: '#2563EB', borderRadius: '0.5rem' }}>Save</button>
            </div>
        </Modal>
    );
};

const ChangeCodeModal = ({ currentCode, onSave, onCancel, loading }) => {
    const [newCode, setNewCode] = useState('');

    const handleSave = () => {
        if (newCode && newCode.trim() !== '' && newCode.toUpperCase() !== currentCode) {
            onSave(newCode.toUpperCase());
        }
    };

    return (
        <Modal isOpen={true}>
             <button onClick={onCancel} style={{ position: 'absolute', top: '1rem', right: '1rem', color: '#9CA3AF' }}>&times;</button>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>Change Budget Code</h2>
            <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.5rem' }}>Your current code is <b>{currentCode}</b>. Enter a new code below (max 7 characters).</p>
            <input 
                type="text" 
                value={newCode} 
                onChange={e => setNewCode(e.target.value)} 
                maxLength="7"
                placeholder="New Code"
                style={{ marginTop: '1rem', display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem', textTransform: 'uppercase' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button onClick={onCancel} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#F3F4F6', borderRadius: '0.5rem' }}>Cancel</button>
                <button onClick={handleSave} disabled={loading} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'white', backgroundColor: '#2563EB', borderRadius: '0.5rem', opacity: loading ? 0.5 : 1 }}>
                    {loading ? 'Saving...' : 'Save New Code'}
                </button>
            </div>
        </Modal>
    );
};


const TransactionLedger = ({ ledgerData, onRowClick, onTogglePosted }) => {
    const formatCurrency = (value) => `$${(value || 0).toFixed(2)}`;
    const todayString = new Date().toDateString();

    return (
        <div style={{ backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)' }}>
            <style>{`
                .ledger-row {
                    cursor: pointer;
                    border-bottom: 1px solid #F3F4F6;
                }
                .ledger-row:hover {
                    background-color: #F9FAFB;
                }
                
                .mobile-header, .mobile-row {
                    display: none;
                }

                @media (max-width: 768px) {
                    .desktop-header, .desktop-row {
                        display: none;
                    }
                    .mobile-header, .mobile-row {
                        display: grid;
                        grid-template-columns: 20px 1fr 1fr 1fr;
                        gap: 4px;
                        align-items: center;
                        padding: 6px 4px;
                        font-size: 0.7rem;
                    }
                    .mobile-header {
                        background-color: #F9FAFB;
                        position: sticky;
                        top: 0;
                        text-transform: uppercase;
                        color: #4B5563;
                        font-weight: 600;
                    }
                     .mobile-row > div {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                }

                @media (min-width: 769px) {
                    .desktop-header, .desktop-row {
                        display: grid;
                        grid-template-columns: 60px 90px 1fr 100px 100px 100px;
                        align-items: center;
                        padding: 0.5rem 1rem;
                        font-size: 0.75rem;
                    }
                     .desktop-header {
                        background-color: #F9FAFB;
                        position: sticky;
                        top: 0;
                        text-transform: uppercase;
                        color: #4B5563;
                        font-weight: 600;
                    }
                }
            `}</style>
            <div style={{ overflowY: 'auto', maxHeight: 'calc(100vh - 12rem)' }}>
                {/* Desktop Header */}
                <div className="desktop-header">
                    <div>Posted</div>
                    <div>Date</div>
                    <div>Description</div>
                    <div style={{ textAlign: 'right' }}>Amount</div>
                    <div style={{ textAlign: 'right' }}>Est. Balance</div>
                    <div style={{ textAlign: 'right' }}>Act. Balance</div>
                </div>
                 {/* Mobile Header */}
                 <div className="mobile-header">
                    <div></div>
                    <div>Date</div>
                    <div>Desc.</div>
                    <div style={{ textAlign: 'right' }}>Amt.</div>
                    <div style={{ textAlign: 'right' }}>Est.</div>
                    <div style={{ textAlign: 'right' }}>Act.</div>
                </div>

                <div>
                    {ledgerData.map((item) => {
                        const itemDate = new Date(item.date.seconds * 1000);
                        const isToday = itemDate.toDateString() === todayString;
                        const dateOptions = { year: '2-digit', month: 'numeric', day: 'numeric' };

                        return (
                            <div key={item.id} className="ledger-row" onClick={(e) => { if(e.target.type !== 'checkbox') onRowClick(item) }} style={{ backgroundColor: isToday ? '#DBEAFE' : 'white' }}>
                                {/* Desktop View */}
                                <div className="desktop-row">
                                    <div style={{ textAlign: 'center' }}><input type="checkbox" checked={!!item.posted} onChange={() => onTogglePosted(item)} /></div>
                                    <div>{itemDate.toLocaleDateString('en-US', dateOptions)}</div>
                                    <div style={{ fontWeight: '500', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description}</div>
                                    <div style={{ textAlign: 'right', fontWeight: '500', color: item.type === 'income' ? '#16A34A' : '#DC2626' }}>{item.type === 'income' ? '+' : '-'} {formatCurrency(item.amount)}</div>
                                    <div style={{ textAlign: 'right', fontWeight: '600' }}>
                                        <span style={{ padding: '0.25rem', borderRadius: '0.25rem', backgroundColor: item.rollingEstimatedBalance < 0 ? '#FEE2E2' : 'transparent', color: item.rollingEstimatedBalance < 0 ? '#B91C1C' : 'inherit' }}>
                                            {formatCurrency(item.rollingEstimatedBalance)}
                                        </span>
                                    </div>
                                    <div style={{ textAlign: 'right', fontWeight: '600' }}>
                                        <span style={{ padding: '0.25rem', borderRadius: '0.25rem', backgroundColor: item.rollingActualBalance < 0 ? '#FEE2E2' : 'transparent', color: item.rollingActualBalance < 0 ? '#B91C1C' : 'inherit' }}>
                                            {formatCurrency(item.rollingActualBalance)}
                                        </span>
                                    </div>
                                </div>
                                {/* Mobile View */}
                                <div className="mobile-row">
                                     <div style={{ textAlign: 'center' }}><input type="checkbox" checked={!!item.posted} onChange={() => onTogglePosted(item)} /></div>
                                     <div>{itemDate.toLocaleDateString('en-US', dateOptions)}</div>
                                     <div>{item.description}</div>
                                     <div style={{ textAlign: 'right', color: item.type === 'income' ? '#16A34A' : '#DC2626' }}>{formatCurrency(item.amount)}</div>
                                     <div style={{ textAlign: 'right', color: item.rollingEstimatedBalance < 0 ? '#B91C1C' : 'inherit'}}>{formatCurrency(item.rollingEstimatedBalance)}</div>
                                     <div style={{ textAlign: 'right', color: item.rollingActualBalance < 0 ? '#B91C1C' : 'inherit' }}>{formatCurrency(item.rollingActualBalance)}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function App() {
    const [scheduledTransactions, setScheduledTransactions] = useState([]);
    const [ledgerEntries, setLedgerEntries] = useState([]);
    const [revisions, setRevisions] = useState([]);
    const [db, setDb] = useState(null);
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [error, setError] = useState(null);
    const [modal, setModal] = useState({ type: null, data: null });
    const [showHistory, setShowHistory] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [budgetWindowSettings, setBudgetWindowSettings] = useState({ startDate: null, interval: 'bi-weekly' });
    const [isBudgetWindowActive, setIsBudgetWindowActive] = useState(false);
    const [budgetWindowOffset, setBudgetWindowOffset] = useState(0);
    const [budgetCode, setBudgetCode] = useState(null);

    useEffect(() => {
        try {
            // No setLogLevel in production
            const firebaseConfig = {
              apiKey: "AIzaSyD3YFW6HDtV8jTz0GIRZAEPx9wTCS6T1fU",
              authDomain: "budgeter-d4854.firebaseapp.com",
              projectId: "budgeter-d4854",
              storageBucket: "budgeter-d4854.appspot.com",
              messagingSenderId: "484673918178",
              appId: "1:484673918178:web:e9945fff52440b2a07fabb"
            };
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            onAuthStateChanged(firebaseAuth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    await signInAnonymously(firebaseAuth);
                }
                setIsAuthReady(true);
            });
        } catch (e) { setError("Initialization failed."); setLoading(false); }
    }, []);

    useEffect(() => {
        const savedCode = localStorage.getItem('savedBudgetCode');
        if(savedCode && db && !budgetCode) {
            handleLoadBudget(savedCode, false);
        }
    }, [db, isAuthReady]);

    useEffect(() => {
        if (!db || !budgetCode) return;
        setLoading(true);
        const budgetBasePath = `budgets/${budgetCode}`;
        
        const unsubSchedule = onSnapshot(query(collection(db, `${budgetBasePath}/recurringTransactions`)), (snap) => setScheduledTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubRevisions = onSnapshot(query(collection(db, `${budgetBasePath}/revisions`)), (snap) => setRevisions(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
        const unsubSettings = onSnapshot(doc(db, `${budgetBasePath}/settings/budgetWindow`), (doc) => {
            if (doc.exists()) {
                setBudgetWindowSettings(doc.data());
            }
        });
        const unsubLedger = onSnapshot(query(collection(db, `${budgetBasePath}/ledgerEntries`)), (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            
            data.sort((a, b) => {
                if (a.date.seconds !== b.date.seconds) return a.date.seconds - b.date.seconds;
                if (a.type === 'income' && b.type === 'expense') return -1;
                if (a.type === 'expense' && b.type === 'income') return 1;
                return 0;
            });

            let rollingEstimatedBalance = 0;
            let rollingActualBalance = 0;
            const processedData = data.map(d => {
                rollingEstimatedBalance += (d.type === 'income' ? d.amount : -d.amount);
                if (d.posted) {
                    rollingActualBalance += (d.type === 'income' ? d.amount : -d.amount);
                }
                return { ...d, rollingEstimatedBalance, rollingActualBalance };
            });
            setLedgerEntries(processedData);
            setLoading(false);
        });

        return () => { unsubSchedule(); unsubLedger(); unsubRevisions(); unsubSettings(); };
    }, [db, budgetCode]);

    const addScheduledTransaction = async (transactionRule) => {
        if (!db || !budgetCode) return;
        setActionLoading(true);
        setError(null);
        try {
            const budgetBasePath = `budgets/${budgetCode}`;
            const scheduleCollection = collection(db, `${budgetBasePath}/recurringTransactions`);
            const ledgerCollection = collection(db, `${budgetBasePath}/ledgerEntries`);
            const ruleDocRef = await addDoc(scheduleCollection, transactionRule);
            const parentId = ruleDocRef.id;
            const instances = generateTransactionInstances({ ...transactionRule, id: parentId });
            const batch = writeBatch(db);
            instances.forEach(instance => {
                const { id, ...dataToSave } = instance;
                const newDocRef = doc(ledgerCollection);
                batch.set(newDocRef, { ...dataToSave, date: Timestamp.fromDate(dataToSave.date), parentId, posted: false });
            });
            await batch.commit();
        } catch (err) { setError("Could not add rule."); } 
        finally { setActionLoading(false); }
    };

    const addRandomRule = async () => {
        const descriptions = ["Paycheck", "Rent", "Groceries", "Gas", "Electric Bill", "Internet", "Phone Bill", "Car Payment", "Insurance"];
        const frequencies = ["weekly", "bi-weekly", "monthly", "yearly", "one-time"];
        
        const randomDesc = descriptions[Math.floor(Math.random() * descriptions.length)];
        const randomFreq = frequencies[Math.floor(Math.random() * frequencies.length)];
        const randomAmount = Math.floor(Math.random() * 2000) + 10;
        const randomType = Math.random() > 0.5 ? 'income' : 'expense';
        
        const today = new Date();
        const randomDays = Math.floor(Math.random() * 365) - 180;
        const startDate = new Date(today.getTime() + randomDays * 24 * 60 * 60 * 1000);

        const rule = {
            description: randomDesc,
            amount: randomAmount,
            type: randomType,
            frequency: randomFreq,
            startDate: Timestamp.fromDate(new Date(startDate.toLocaleDateString('en-CA') + 'T00:00:00-06:00'))
        };

        if (Math.random() > 0.5) {
            const randomEndDays = Math.floor(Math.random() * 730) + 30;
            const endDate = new Date(startDate.getTime() + randomEndDays * 24 * 60 * 60 * 1000);
            rule.endDate = Timestamp.fromDate(new Date(endDate.toLocaleDateString('en-CA') + 'T00:00:00-06:00'));
        }

        await addScheduledTransaction(rule);
    };

    const deleteScheduledTransaction = async (ruleId) => {
        if (!db || !budgetCode) return;
        setActionLoading(true);
        setError(null);
        try {
            const budgetBasePath = `budgets/${budgetCode}`;
            const batch = writeBatch(db);
            batch.delete(doc(db, `${budgetBasePath}/recurringTransactions/${ruleId}`));
            const ledgerQuery = query(collection(db, `${budgetBasePath}/ledgerEntries`), where("parentId", "==", ruleId));
            const entriesToDelete = await getDocs(ledgerQuery);
            entriesToDelete.forEach(d => batch.delete(d.ref));
            const revisionQuery = query(collection(db, `${budgetBasePath}/revisions`), where("parentId", "==", ruleId));
            const revisionsToDelete = await getDocs(revisionQuery);
            revisionsToDelete.forEach(d => batch.delete(d.ref));
            await batch.commit();
        } catch (err) { setError("Could not delete rule."); }
        finally { setActionLoading(false); setModal({ type: null, data: null }); }
    };
    
    const { estimatedBalance, actualBalance, unpostedPastCount } = useMemo(() => {
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        const relevant = ledgerEntries.filter(i => new Date(i.date.seconds * 1000) <= today);
        const estimated = relevant.length > 0 ? relevant[relevant.length - 1].rollingEstimatedBalance : 0;
        
        const actual = ledgerEntries.length > 0 ? ledgerEntries[ledgerEntries.length - 1].rollingActualBalance : 0;

        let unpostedCount = 0;
        const todayStart = new Date();
        todayStart.setHours(0,0,0,0);

        ledgerEntries.forEach(entry => {
            if(!entry.posted && new Date(entry.date.seconds * 1000) < todayStart) {
                unpostedCount++;
            }
        });

        return { estimatedBalance: estimated, actualBalance: actual, unpostedPastCount: unpostedCount };
    }, [ledgerEntries]);

    const { filteredLedgerData, budgetWindowDateRange } = useMemo(() => {
        if (isBudgetWindowActive && budgetWindowSettings.startDate) {
            const baseStartDate = new Date(budgetWindowSettings.startDate.seconds * 1000);
            const today = new Date();
            
            let diff;
            switch(budgetWindowSettings.interval) {
                case 'weekly': diff = Math.floor((today - baseStartDate) / (1000 * 60 * 60 * 24 * 7)); break;
                case 'bi-weekly': diff = Math.floor((today - baseStartDate) / (1000 * 60 * 60 * 24 * 14)); break;
                case 'monthly': diff = (today.getFullYear() - baseStartDate.getFullYear()) * 12 + (today.getMonth() - baseStartDate.getMonth()); break;
                case 'yearly': diff = today.getFullYear() - baseStartDate.getFullYear(); break;
                default: diff = 0;
            }

            const currentIndex = Math.max(0, diff);
            const targetIndex = currentIndex + budgetWindowOffset;

            const windowStartDate = new Date(baseStartDate);
            switch(budgetWindowSettings.interval) {
                case 'weekly': windowStartDate.setDate(baseStartDate.getDate() + targetIndex * 7); break;
                case 'bi-weekly': windowStartDate.setDate(baseStartDate.getDate() + targetIndex * 14); break;
                case 'monthly': windowStartDate.setMonth(baseStartDate.getMonth() + targetIndex); windowStartDate.setDate(1); break;
                case 'yearly': windowStartDate.setFullYear(baseStartDate.getFullYear() + targetIndex); windowStartDate.setMonth(0); windowStartDate.setDate(1); break;
            }

            const windowEndDate = new Date(windowStartDate);
             switch(budgetWindowSettings.interval) {
                case 'weekly': windowEndDate.setDate(windowStartDate.getDate() + 6); break;
                case 'bi-weekly': windowEndDate.setDate(windowStartDate.getDate() + 13); break;
                case 'monthly': windowEndDate.setMonth(windowStartDate.getMonth() + 1); windowEndDate.setDate(0); break;
                case 'yearly': windowEndDate.setFullYear(windowStartDate.getFullYear() + 1); windowEndDate.setDate(0); break;
            }
            
            const data = ledgerEntries.filter(entry => {
                const entryDate = new Date(entry.date.seconds * 1000);
                return entryDate >= windowStartDate && entryDate <= windowEndDate;
            });
            return { filteredLedgerData: data, budgetWindowDateRange: `${windowStartDate.toLocaleDateString('en-US', { year: '2-digit', month: 'numeric', day: 'numeric' })} - ${windowEndDate.toLocaleDateString('en-US', { year: '2-digit', month: 'numeric', day: 'numeric' })}` };

        } else if (showHistory) {
            return { filteredLedgerData: ledgerEntries, budgetWindowDateRange: null };
        }
        const today = new Date();
        today.setHours(0,0,0,0);
        const data = ledgerEntries.filter(entry => new Date(entry.date.seconds * 1000) >= today);
        return { filteredLedgerData: data, budgetWindowDateRange: null };
    }, [ledgerEntries, showHistory, isBudgetWindowActive, budgetWindowSettings, budgetWindowOffset]);

    const handleEditLedgerEntry = async (entry, newDesc, newAmount, newDate, modifyFuture = false) => {
        if (!db || !budgetCode) return;
        setActionLoading(true);
        try {
            const budgetBasePath = `budgets/${budgetCode}`;
            const batch = writeBatch(db);
            const revisionsCollection = collection(db, `${budgetBasePath}/revisions`);
            
            const createRevision = (targetEntry, beforeData, afterData) => {
                const revisionData = {
                    parentId: targetEntry.parentId,
                    transactionId: targetEntry.id,
                    transactionDate: targetEntry.date,
                    revisionDate: Timestamp.now(),
                    before: beforeData,
                    after: afterData
                };
                const revisionDocRef = doc(revisionsCollection);
                batch.set(revisionDocRef, revisionData);
            };

            if (modifyFuture) {
                const originalDate = new Date(entry.date.seconds * 1000);
                const newDateForEditedEntry = new Date(newDate.seconds * 1000);
                const dateDelta = newDateForEditedEntry.getTime() - originalDate.getTime();

                const futureEntries = ledgerEntries.filter(e => e.parentId === entry.parentId && e.date.seconds >= entry.date.seconds);
                const revisedIds = new Set(revisions.map(r => r.transactionId));
                const unmodified = [];

                futureEntries.forEach(futureEntry => {
                    if ((revisedIds.has(futureEntry.id) && futureEntry.id !== entry.id) || futureEntry.posted) {
                        unmodified.push(futureEntry);
                    } else {
                        const docRef = doc(db, `${budgetBasePath}/ledgerEntries/${futureEntry.id}`);
                        const originalFutureDate = new Date(futureEntry.date.seconds * 1000);
                        const newFutureDate = new Date(originalFutureDate.getTime() + dateDelta);
                        const newFutureTimestamp = Timestamp.fromDate(newFutureDate);

                        const beforeData = { description: futureEntry.description, amount: futureEntry.amount, date: futureEntry.date };
                        const afterData = { description: newDesc, amount: newAmount, date: newFutureTimestamp };
                        createRevision(futureEntry, beforeData, afterData);
                        batch.update(docRef, { description: newDesc, amount: newAmount, date: newFutureTimestamp });
                    }
                });

                await batch.commit();
                if(unmodified.length > 0) {
                    setModal({ type: 'unmodifiedList', data: unmodified });
                } else {
                    setModal({ type: null, data: null });
                }
            } else {
                const docRef = doc(db, `${budgetBasePath}/ledgerEntries/${entry.id}`);
                const beforeData = { description: entry.description, amount: entry.amount, date: entry.date };
                const afterData = { description: newDesc, amount: newAmount, date: newDate };
                createRevision(entry, beforeData, afterData);
                batch.update(docRef, { description: newDesc, amount: newAmount, date: newDate });
                await batch.commit();
                setModal({ type: null, data: null });
            }
        } catch(err) { setError("Could not update entry/entries."); }
        finally { setActionLoading(false); }
    };
    
    const handleDeleteLedgerEntry = async (id) => {
        if (!db || !budgetCode) return;
        try {
            await deleteDoc(doc(db, `budgets/${budgetCode}/ledgerEntries/${id}`));
        } catch(err) { setError("Could not delete entry."); }
        finally { setModal({ type: null, data: null }); }
    };
    
    const handleTogglePosted = async (entry) => {
        if (!db || !budgetCode) return;
        const entryDateStr = new Date(entry.date.seconds * 1000).toLocaleDateString('en-CA');
        const todayStr = new Date().toLocaleDateString('en-CA', {timeZone: 'America/Chicago'});

        if (entryDateStr > todayStr && !entry.posted) {
            setModal({ type: 'postFuture', data: entry });
            return;
        }

        try {
            const docRef = doc(db, `budgets/${budgetCode}/ledgerEntries/${entry.id}`);
            await updateDoc(docRef, { posted: !entry.posted });
        } catch (err) {
            setError("Could not update posted status.");
        }
    };

    const handleMoveAndPost = async (entry) => {
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(todayDate);

        await handleEditLedgerEntry(entry, entry.description, entry.amount, todayTimestamp);
        
        try {
            const docRef = doc(db, `budgets/${budgetCode}/ledgerEntries/${entry.id}`);
            await updateDoc(docRef, { posted: true });
        } catch(err) {
             setError("Could not post entry after moving date.");
        }
        setModal({ type: null, data: null });
    };

    const handleSaveBudgetWindow = async (settings) => {
        if (!db || !budgetCode) return;
        try {
            const settingsRef = doc(db, `budgets/${budgetCode}/settings/budgetWindow`);
            await setDoc(settingsRef, settings);
            setBudgetWindowSettings(settings);
            setModal({ type: null, data: null });
        } catch(err) {
            setError("Could not save settings.");
        }
    };

    const handleCreateBudget = async () => {
        if (!db || !isAuthReady) return;
        const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        try {
            await setDoc(doc(db, `budgets`, newCode), { createdAt: Timestamp.now(), ownerId: userId });
            setBudgetCode(newCode);
            setModal({ type: 'newBudgetCode', data: newCode });
        } catch (err) {
            setError("Could not create new budget.");
        }
    };

    const handleLoadBudget = async (code, save) => {
        if (!db || !code || !isAuthReady) return;
        const budgetRef = doc(db, `budgets`, code);
        try {
            const budgetSnap = await getDoc(budgetRef);
            if (budgetSnap.exists()) {
                if (save) {
                    localStorage.setItem('savedBudgetCode', code);
                } else {
                    localStorage.removeItem('savedBudgetCode');
                }
                setBudgetCode(code);
            } else {
                setError("Budget code not found.");
            }
        } catch (err) {
            setError("Error loading budget.");
        }
    };

    const handleUpdateBudgetCode = async (newCode) => {
        if (!db || !budgetCode || !newCode || newCode === budgetCode) return;
        setActionLoading(true);
        setError(null);
        try {
            const newCodeRef = doc(db, `budgets`, newCode);
            const newCodeSnap = await getDoc(newCodeRef);
            if (newCodeSnap.exists()) {
                setError("This code is already in use. Please choose another.");
                setActionLoading(false);
                return;
            }

            const collectionsToMove = ['recurringTransactions', 'ledgerEntries', 'revisions'];
            const oldBasePath = `budgets/${budgetCode}`;
            const newBasePath = `budgets/${newCode}`;

            // Copy main doc
            const oldBudgetDoc = await getDoc(doc(db, `budgets`, budgetCode));
            await setDoc(newCodeRef, oldBudgetDoc.data());

            // Copy settings subcollection
            const oldSettingsDoc = await getDoc(doc(db, `${oldBasePath}/settings/budgetWindow`));
            if(oldSettingsDoc.exists()){
                await setDoc(doc(db, `${newBasePath}/settings/budgetWindow`), oldSettingsDoc.data());
            }

            // Copy other subcollections
            for (const coll of collectionsToMove) {
                const oldCollQuery = query(collection(db, `${oldBasePath}/${coll}`));
                const oldDocs = await getDocs(oldCollQuery);
                const batch = writeBatch(db);
                oldDocs.forEach(d => {
                    const newDocRef = doc(db, `${newBasePath}/${coll}/${d.id}`);
                    batch.set(newDocRef, d.data());
                });
                await batch.commit();
            }

            // Deletion of old data
            const deleteBatch = writeBatch(db);
            for (const coll of collectionsToMove) {
                const oldCollQuery = query(collection(db, `${oldBasePath}/${coll}`));
                const oldDocs = await getDocs(oldCollQuery);
                oldDocs.forEach(d => deleteBatch.delete(d.ref));
            }
             const oldSettingsDocToDelete = await getDoc(doc(db, `${oldBasePath}/settings/budgetWindow`));
            if(oldSettingsDocToDelete.exists()){
                deleteBatch.delete(oldSettingsDocToDelete.ref);
            }
            deleteBatch.delete(doc(db, 'budgets', budgetCode));
            await deleteBatch.commit();
            
            if (localStorage.getItem('savedBudgetCode') === budgetCode) {
                localStorage.setItem('savedBudgetCode', newCode);
            }
            setBudgetCode(newCode); // This will trigger re-fetch
            setModal({type: null, data: null});

        } catch (err) {
            setError("Could not update budget code. Please try again.");
        } finally {
            setActionLoading(false);
        }
    };
    
    const WelcomeScreen = () => {
        const [inputCode, setInputCode] = useState('');
        const [saveCode, setSaveCode] = useState(false);
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#F9FAFB', padding: '1rem' }}>
                <div style={{ width: '100%', maxWidth: '24rem', padding: '2rem', gap: '1.5rem', backgroundColor: 'white', borderRadius: '1rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', textAlign: 'center', display: 'flex', flexDirection: 'column' }}>
                    <h1 style={{ fontSize: '1.875rem', fontWeight: 'bold', color: '#1F2937' }}>Welcome to the Ledger</h1>
                    <p style={{ color: '#4B5563' }}>Create a new budget or load an existing one with your code.</p>
                    <button onClick={handleCreateBudget} disabled={!isAuthReady} style={{ width: '100%', padding: '0.75rem 1rem', fontWeight: 'bold', color: 'white', backgroundColor: '#2563EB', borderRadius: '0.5rem', opacity: !isAuthReady ? 0.5 : 1 }}>Create New Budget</button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <hr style={{ flexGrow: 1, borderColor: '#E5E7EB' }} />
                        <span style={{ fontSize: '0.875rem', color: '#9CA3AF' }}>OR</span>
                        <hr style={{ flexGrow: 1, borderColor: '#E5E7EB' }} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <input type="text" value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} placeholder="Enter Budget Code" style={{ width: '100%', padding: '0.5rem 1rem', textAlign: 'center', border: '1px solid #D1D5DB', borderRadius: '0.5rem' }}/>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <input id="saveCode" type="checkbox" checked={saveCode} onChange={(e) => setSaveCode(e.target.checked)} />
                            <label htmlFor="saveCode" style={{ marginLeft: '0.5rem', fontSize: '0.875rem', color: '#111827' }}>Save Code</label>
                        </div>
                        <button onClick={() => handleLoadBudget(inputCode, saveCode)} disabled={!isAuthReady} style={{ width: '100%', padding: '0.75rem 1rem', fontWeight: 'bold', color: 'white', backgroundColor: '#374151', borderRadius: '0.5rem', opacity: !isAuthReady ? 0.5 : 1 }}>Load Budget</button>
                    </div>
                    {error && <p style={{ fontSize: '0.875rem', color: '#EF4444' }}>{error}</p>}
                </div>
            </div>
        );
    };

    const EditForm = ({ entry, onSave, onCancel, onValidationError }) => {
        const [desc, setDesc] = useState(entry.description);
        const [amount, setAmount] = useState(entry.amount);
        const [date, setDate] = useState(new Date(entry.date.seconds * 1000).toISOString().split('T')[0]);
        const [modifyFuture, setModifyFuture] = useState(false);
        
        const handleSave = () => {
             const newAmount = parseFloat(amount);
             const newDate = new Date(date + 'T00:00:00');
             const today = new Date();
             today.setHours(0,0,0,0);

             if (entry.posted && newDate > today) {
                onValidationError({message: "A posted transaction cannot be moved to a future date.", entry});
                return;
             }

             if (desc && !isNaN(newAmount) && date) {
                onSave(entry, desc, newAmount, Timestamp.fromDate(newDate), modifyFuture);
             } else {
                onValidationError({message: "Invalid input. Please check all fields.", entry});
             }
        };
        return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold' }}>Edit Transaction</h3>
                <p style={{ fontSize: '0.75rem', color: '#6B7280', fontFamily: 'monospace' }}>ID: {entry.id}</p>
                <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>Description</label><input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ marginTop: '0.25rem', display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem' }}/></div>
                <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>Amount</label><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ marginTop: '0.25rem', display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem' }}/></div>
                <div><label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500' }}>Date</label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ marginTop: '0.25rem', display: 'block', width: '100%', padding: '0.5rem 0.75rem', border: '1px solid #D1D5DB', borderRadius: '0.375rem' }}/></div>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input id="modifyFuture" type="checkbox" checked={modifyFuture} onChange={(e) => setModifyFuture(e.target.checked)} />
                    <label htmlFor="modifyFuture" style={{ marginLeft: '0.5rem', display: 'block', fontSize: '0.875rem' }}>Modify all future entries for this rule</label>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}><button onClick={onCancel} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', borderRadius: '0.5rem' }}>Cancel</button><button onClick={handleSave} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'white', backgroundColor: '#2563EB', borderRadius: '0.5rem' }}>Save</button></div>
            </div>
        );
    };

    if (!budgetCode) {
        return <WelcomeScreen />;
    }

    return (
        <div style={{ backgroundColor: '#F9FAFB', minHeight: '100vh', fontFamily: 'sans-serif', color: '#111827' }}>
            <Modal isOpen={modal.type !== null} onClose={() => setModal({ type: null, data: null })}>
                {modal.type === 'newBudgetCode' && (<div style={{ textAlign: 'center' }}><h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Budget Created!</h3><p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>Save this code to access your budget later:</p><div style={{ padding: '0.75rem', backgroundColor: '#F3F4F6', borderRadius: '0.5rem', fontFamily: 'monospace', fontSize: '1.5rem', letterSpacing: '0.1em' }}>{modal.data}</div><div style={{ display: 'flex', justifyContent: 'center', marginTop: '1rem' }}><button onClick={() => setModal({ type: null })} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#2563EB', color: 'white', borderRadius: '0.5rem' }}>OK, I've saved it!</button></div></div>)}
                {modal.type === 'addRule' && <RecurringTransactionForm onAddTransaction={addScheduledTransaction} loading={actionLoading} onDone={() => setModal({ type: null, data: null })} />}
                {modal.type === 'quickAdd' && <QuickAddForm onAddTransaction={addScheduledTransaction} loading={actionLoading} onDone={() => setModal({ type: null, data: null })} />}
                {modal.type === 'manageRules' && <ManageRulesModal isOpen={true} onClose={() => setModal({ type: null, data: null })} rules={scheduledTransactions} revisions={revisions} onDelete={(id) => setModal({ type: 'deleteRule', data: id })} onViewRevisions={(id) => setModal({ type: 'viewRevisions', data: id })} />}
                {modal.type === 'editEntry' && <EditForm entry={modal.data} onSave={handleEditLedgerEntry} onCancel={() => setModal({ type: null, data: null })} onValidationError={(errorData) => setModal({ type: 'error', data: errorData })} />}
                {modal.type === 'viewRevisions' && <RevisionsModal isOpen={true} onClose={() => setModal({ type: 'manageRules', data: null })} revisions={revisions} ruleId={modal.data} />}
                {modal.type === 'unmodifiedList' && <UnmodifiedListModal isOpen={true} onClose={() => setModal({ type: null, data: null })} unmodifiedEntries={modal.data} />}
                {modal.type === 'setBudgetWindow' && <SetBudgetWindowModal onSave={handleSaveBudgetWindow} onCancel={() => setModal({ type: null, data: null })} currentSettings={budgetWindowSettings} />}
                {modal.type === 'changeCode' && <ChangeCodeModal currentCode={budgetCode} onSave={handleUpdateBudgetCode} onCancel={() => setModal({ type: null, data: null })} loading={actionLoading} />}
                {modal.type === 'deleteRule' && (<div style={{ textAlign: 'center' }}><h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Delete Rule?</h3><p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>This will delete the rule and all associated entries.</p><div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}><button onClick={() => setModal({ type: 'manageRules' })} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#F3F4F6', borderRadius: '0.5rem' }}>Cancel</button><button onClick={() => deleteScheduledTransaction(modal.data)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'white', backgroundColor: '#DC2626', borderRadius: '0.5rem' }}>Delete</button></div></div>)}
                {modal.type === 'deleteEntry' && (<div style={{ textAlign: 'center' }}><h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Delete Entry?</h3><p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>This will not affect the original rule.</p><div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}><button onClick={() => setModal({ type: null })} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#F3F4F6', borderRadius: '0.5rem' }}>Cancel</button><button onClick={() => handleDeleteLedgerEntry(modal.data)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'white', backgroundColor: '#DC2626', borderRadius: '0.5rem' }}>Delete</button></div></div>)}
                {modal.type === 'postFuture' && (<div style={{ textAlign: 'center' }}><h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Post Future Transaction?</h3><p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>This transaction is in the future. Would you like to move its date to today and post it?</p><div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}><button onClick={() => setModal({ type: null })} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#F3F4F6', borderRadius: '0.5rem' }}>Cancel</button><button onClick={() => handleMoveAndPost(modal.data)} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', color: 'white', backgroundColor: '#2563EB', borderRadius: '0.5rem' }}>Move & Post</button></div></div>)}
                {modal.type === 'error' && (<div style={{ textAlign: 'center' }}><h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem', color: '#DC2626' }}>Error</h3><p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>{modal.data.message}</p><div style={{ display: 'flex', justifyContent: 'center' }}><button onClick={() => setModal({ type: 'editEntry', data: modal.data.entry })} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#F3F4F6', borderRadius: '0.5rem' }}>OK</button></div></div>)}
                {modal.type === 'entryActions' && (<div style={{ textAlign: 'center' }}><h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Actions for {modal.data.description}</h3><p style={{ fontSize: '0.875rem', marginBottom: '1rem' }}>on {new Date(modal.data.date.seconds * 1000).toLocaleDateString()}</p><div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}><button onClick={() => setModal({type: 'editEntry', data: modal.data})} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#2563EB', color: 'white', borderRadius: '0.5rem' }}>Edit</button><button onClick={() => setModal({type: 'deleteEntry', data: modal.data.id})} style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', backgroundColor: '#DC2626', color: 'white', borderRadius: '0.5rem' }}>Delete</button></div></div>)}
            </Modal>
            <div style={{ margin: '0 auto', padding: '1rem', maxWidth: '80rem' }}>
                {error && !modal.type && <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#FEE2E2', color: '#B91C1C', borderRadius: '0.5rem', textAlign: 'center' }}>{error}</div>}
                <main style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="control-panel">
                         <div className="control-panel-left">
                            <button onClick={() => setModal({ type: 'quickAdd' })} style={{ padding: '0.5rem', borderRadius: '9999px', backgroundColor: '#2563EB', color: 'white' }}>
                                <svg style={{ height: '1.5rem', width: '1.5rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                            </button>
                            <div style={{ position: 'relative' }}>
                                <button onClick={() => setIsMenuOpen(!isMenuOpen)} style={{ padding: '0.5rem', borderRadius: '9999px' }}>
                                    <svg style={{ height: '1.5rem', width: '1.5rem', color: '#4B5563' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                                </button>
                                {isMenuOpen && (
                                    <div style={{ position: 'absolute', left: 0, marginTop: '0.5rem', width: '12rem', backgroundColor: 'white', borderRadius: '0.375rem', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', zIndex: 20 }}>
                                        <button onClick={() => { setModal({ type: 'addRule' }); setIsMenuOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Add Rule</button>
                                        <button onClick={() => { setModal({ type: 'manageRules' }); setIsMenuOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Manage Rules</button>
                                        <button onClick={() => { addRandomRule(); setIsMenuOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Add Random Rule</button>
                                        <button onClick={() => { setModal({ type: 'setBudgetWindow' }); setIsMenuOpen(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '0.5rem 1rem', fontSize: '0.875rem' }}>Set Budget Window</button>
                                    </div>
                                )}
                            </div>
                            <div className="balance-group">
                                <h3>Est. Bal.</h3>
                                <p style={{ color: '#2563EB' }}>${estimatedBalance.toFixed(2)}</p>
                            </div>
                            <div className="balance-group">
                                <h3>Act. Bal.</h3>
                                <p style={{ color: '#16A34A' }}>${actualBalance.toFixed(2)}</p>
                            </div>
                             <div className="balance-group" onClick={() => setModal({ type: 'changeCode' })} style={{ cursor: 'pointer' }}>
                                <h3>Code:</h3>
                                <p style={{ color: '#6B7280', fontFamily: 'monospace' }}>{budgetCode}</p>
                            </div>
                        </div>
                        <div className="control-panel-right">
                            {isBudgetWindowActive && budgetWindowSettings.startDate && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                    <button onClick={() => setBudgetWindowOffset(p => p - 1)} style={{ padding: '0.5rem', borderRadius: '9999px' }}><svg style={{ height: '1.25rem', width: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M15 19l-7-7 7-7" /></svg></button>
                                    <span style={{ fontSize: '0.75rem', width: '6rem', textAlign: 'center' }}>{budgetWindowDateRange}</span>
                                    <button onClick={() => setBudgetWindowOffset(p => p + 1)} style={{ padding: '0.5rem', borderRadius: '9999px' }}><svg style={{ height: '1.25rem', width: '1.25rem' }} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M9 5l7 7-7 7" /></svg></button>
                                </div>
                            )}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <label htmlFor="budget-window" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Budget Window</label>
                                <button onClick={() => {setIsBudgetWindowActive(!isBudgetWindowActive); setBudgetWindowOffset(0);}} style={{ backgroundColor: isBudgetWindowActive ? '#2563EB' : '#E5E7EB', position: 'relative', display: 'inline-flex', height: '1.5rem', width: '2.75rem', alignItems: 'center', borderRadius: '9999px' }}>
                                    <span style={{ transform: isBudgetWindowActive ? 'translateX(1.5rem)' : 'translateX(0.25rem)', display: 'inline-block', height: '1rem', width: '1rem', borderRadius: '9999px', backgroundColor: 'white' }}/>
                                </button>
                            </div>
                            {!isBudgetWindowActive && <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {unpostedPastCount > 0 && <span style={{ display: 'flex', height: '1.25rem', width: '1.25rem', alignItems: 'center', justifyContent: 'center', borderRadius: '9999px', backgroundColor: '#EF4444', fontSize: '0.75rem', fontWeight: 'bold', color: 'white' }}>{unpostedPastCount}</span>}
                                <label htmlFor="show-history" style={{ fontSize: '0.875rem', fontWeight: '500' }}>Show History</label>
                                <button onClick={() => setShowHistory(!showHistory)} style={{ backgroundColor: showHistory ? '#2563EB' : '#E5E7EB', position: 'relative', display: 'inline-flex', height: '1.5rem', width: '2.75rem', alignItems: 'center', borderRadius: '9999px' }}>
                                    <span style={{ transform: showHistory ? 'translateX(1.5rem)' : 'translateX(0.25rem)', display: 'inline-block', height: '1rem', width: '1rem', borderRadius: '9999px', backgroundColor: 'white' }}/>
                                </button>
                            </div>}
                        </div>
                    </div>
                    <TransactionLedger 
                        ledgerData={filteredLedgerData} 
                        onRowClick={(entry) => setModal({ type: 'entryActions', data: entry })}
                        onTogglePosted={handleTogglePosted}
                    />
                </main>
            </div>
        </div>
    );
}


      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
