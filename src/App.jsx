import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, DollarSign, Activity, TrendingUp, TrendingDown, Save, Users, LogOut, X, UserPlus, Shield } from 'lucide-react';
import { db } from './firebase';
import { collection, getDocs, getDoc, doc, setDoc, writeBatch, deleteDoc } from 'firebase/firestore';

// Helpers for number formatting
const parseNumberInput = (val) => {
  if (!val) return '';
  return val.toString().replace(/\D/g, '');
};

const formatNumberInput = (val) => {
  if (!val) return '';
  const numStr = val.toString().replace(/\D/g, '');
  return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Manage Users State
  const [showUserModal, setShowUserModal] = useState(false);
  const [systemUsers, setSystemUsers] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');

  const [records, setRecords] = useState([]);
  const [initialInvestment, setInitialInvestment] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Stats
  const [stats, setStats] = useState({
    totalExpense: 0,
    totalRevenue: 0,
    balance: 0
  });

  const isFirebaseConfigured = db.app.options.apiKey !== "YOUR_API_KEY";

  // Check and create default admin
  const initDefaultAdmin = async () => {
    if (!isFirebaseConfigured) return;
    try {
      const adminDoc = await getDoc(doc(db, "users", "admin"));
      if (!adminDoc.exists()) {
        await setDoc(doc(db, "users", "admin"), {
          username: "admin",
          password: "admin@",
          role: "admin",
          createdAt: Date.now()
        });
      }
    } catch (e) {
      console.error("Error creating default admin:", e);
    }
  };

  useEffect(() => {
    initDefaultAdmin();
    // Check local storage for session
    const savedUser = localStorage.getItem('officeSession');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  // Load data
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  // Calculate stats whenever records or investment changes
  useEffect(() => {
    let expense = 0;
    let revenue = 0;

    records.forEach(r => {
      expense += (Number(r.amount) || 0) + (Number(r.salary) || 0);
      revenue += (Number(r.revenue) || 0);
    });

    setStats({
      totalExpense: expense,
      totalRevenue: revenue,
      balance: Number(initialInvestment) + revenue - expense
    });
  }, [records, initialInvestment]);

  // -------------- AUTH LOGIC --------------
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setIsLoading(true);

    if (!isFirebaseConfigured) {
      // Local testing auth fallback
      if (loginUsername === 'admin' && loginPassword === 'admin@') {
        const user = { username: 'admin', role: 'admin' };
        setCurrentUser(user);
        localStorage.setItem('officeSession', JSON.stringify(user));
      } else {
        setAuthError('Sai tài khoản hoặc mật khẩu!');
      }
      setIsLoading(false);
      return;
    }

    try {
      // Check in Firestore users collection (id is username)
      const userDoc = await getDoc(doc(db, "users", loginUsername));
      
      if (userDoc.exists() && userDoc.data().password === loginPassword) {
        const user = { username: userDoc.data().username, role: userDoc.data().role };
        setCurrentUser(user);
        localStorage.setItem('officeSession', JSON.stringify(user));
      } else {
        setAuthError('Sai tài khoản hoặc mật khẩu!');
      }
    } catch (error) {
      console.error("Login error:", error);
      setAuthError('Lỗi kết nối máy chủ!');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setRecords([]);
    localStorage.removeItem('officeSession');
  };

  // -------------- ADMIN LOGIC --------------
  const loadUsers = async () => {
    if (!isFirebaseConfigured) return;
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      const usersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSystemUsers(usersData);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const openManageUsers = () => {
    setShowUserModal(true);
    loadUsers();
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;
    
    if (systemUsers.find(u => u.username === newUsername)) {
      alert("Tên tài khoản đã tồn tại!");
      return;
    }

    try {
      await setDoc(doc(db, "users", newUsername), {
        username: newUsername,
        password: newPassword,
        role: newUserRole,
        createdAt: Date.now()
      });
      setNewUsername('');
      setNewPassword('');
      setNewUserRole('user');
      loadUsers(); // Refresh list
    } catch (error) {
      console.error("Error creating user", error);
      alert("Lỗi khi tạo tài khoản!");
    }
  };

  const handleDeleteUser = async (username) => {
    if (username === 'admin') {
      alert("Không thể xoá tài khoản Admin gốc!");
      return;
    }
    if (window.confirm(`Bạn có chắc muốn xoá tài khoản ${username}?`)) {
      try {
        await deleteDoc(doc(db, "users", username));
        loadUsers();
      } catch (error) {
        console.error("Error deleting user", error);
        alert("Lỗi khi xoá tài khoản!");
      }
    }
  };


  // -------------- DATA LOGIC --------------
  const loadData = async () => {
    setIsLoading(true);
    if (isFirebaseConfigured) {
      try {
        // Load investment
        const invDoc = await getDoc(doc(db, "settings", "investment"));
        if (invDoc.exists()) {
          setInitialInvestment(invDoc.data().amount || 0);
        }

        // Load records
        const querySnapshot = await getDocs(collection(db, "transactions"));
        const data = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        // Sort by date or id to keep order stable
        data.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
        
        if (data.length === 0) {
          // Add one empty row if no data
          setRecords([createNewEmptyRecord()]);
        } else {
          setRecords(data);
        }
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      // LocalStorage fallback
      const localRecords = JSON.parse(localStorage.getItem('officeRecords') || '[]');
      const localInvestment = Number(localStorage.getItem('officeInvestment') || 0);
      setInitialInvestment(localInvestment);
      
      if (localRecords.length === 0) {
        setRecords([createNewEmptyRecord()]);
      } else {
        setRecords(localRecords);
      }
      setIsLoading(false);
    }
  };

  const createNewEmptyRecord = () => {
    return {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      content: '',
      amount: '',
      salary: '',
      revenue: '',
      notes: '',
      createdAt: Date.now()
    };
  };

  const handleInvestmentChange = (e) => {
    const val = parseNumberInput(e.target.value);
    setInitialInvestment(val);
  };

  const handleRecordChange = (id, field, value) => {
    setRecords(prevRecords => 
      prevRecords.map(record => 
        record.id === id ? { ...record, [field]: value } : record
      )
    );
  };

  const addNewRow = () => {
    setRecords(prev => [...prev, createNewEmptyRecord()]);
  };

  const deleteRow = (id) => {
    setRecords(prev => prev.filter(r => r.id !== id));
  };

  const saveData = async () => {
    setIsSaving(true);
    
    // Clean up empty records (if all fields are empty)
    const validRecords = records.filter(r => 
      r.content.trim() !== '' || 
      Number(r.amount) > 0 || 
      Number(r.salary) > 0 || 
      Number(r.revenue) > 0 ||
      r.notes.trim() !== ''
    );

    if (isFirebaseConfigured) {
      try {
        // Save investment
        await setDoc(doc(db, "settings", "investment"), { amount: Number(initialInvestment) });

        // Save records via Batch to replace all
        const batch = writeBatch(db);
        
        // Delete old records first to avoid orphans
        const querySnapshot = await getDocs(collection(db, "transactions"));
        querySnapshot.forEach((doc) => {
          batch.delete(doc.ref);
        });

        // Add new records
        validRecords.forEach(record => {
          const docRef = doc(collection(db, "transactions"), record.id);
          batch.set(docRef, { ...record });
        });

        await batch.commit();
        
        setRecords([...validRecords, createNewEmptyRecord()]);
        alert("Đã lưu dữ liệu thành công!");
      } catch (error) {
        console.error("Error saving data:", error);
        alert("Lỗi khi lưu dữ liệu!");
      }
    } else {
      localStorage.setItem('officeInvestment', initialInvestment);
      localStorage.setItem('officeRecords', JSON.stringify(validRecords));
      setRecords([...validRecords, createNewEmptyRecord()]);
    }
    
    setIsSaving(false);
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0);
  };

  // Calculate running balances for display
  let currentBalance = Number(initialInvestment) || 0;
  const recordsWithBalance = records.map(record => {
    const expense = (Number(record.amount) || 0) + (Number(record.salary) || 0);
    const revenue = Number(record.revenue) || 0;
    currentBalance = currentBalance + revenue - expense;
    return { ...record, runningBalance: currentBalance };
  });

  // -------------- RENDER LOGIN SCREEN --------------
  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-card">
          <Shield size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem auto', display: 'block' }} />
          <h2>Đăng Nhập</h2>
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>Tài khoản</label>
              <input 
                type="text" 
                className="form-control" 
                style={{ width: '100%' }}
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
                placeholder="Nhập tên tài khoản..."
                required
              />
            </div>
            <div className="form-group">
              <label>Mật khẩu</label>
              <input 
                type="password" 
                className="form-control"
                style={{ width: '100%' }}
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                required
              />
            </div>
            {authError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>{authError}</div>}
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={isLoading}>
              {isLoading ? 'Đang kiểm tra...' : 'Đăng Nhập'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // -------------- RENDER MAIN APP --------------
  return (
    <div className="container">
      <header className="flex-between" style={{ marginBottom: '2rem' }}>
        <div>
          <h1 className="text-gradient">Office Accounting</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Xin chào, <strong style={{ color: 'var(--primary)' }}>{currentUser.username}</strong>
            {currentUser.role === 'admin' && <span className="badge" style={{ marginLeft: '0.5rem', backgroundColor: '#fef3c7', color: '#92400e' }}><Shield size={12} style={{ display: 'inline', marginRight: '2px', position: 'relative', top: '1px' }}/> Admin</span>}
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {currentUser.role === 'admin' && (
            <button className="btn btn-outline" onClick={openManageUsers}>
              <Users size={16} /> Quản lý tài khoản
            </button>
          )}
          <button className="btn btn-outline" onClick={handleLogout} style={{ color: 'var(--danger)', borderColor: 'var(--danger-bg)' }}>
            <LogOut size={16} /> Đăng xuất
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        <div className="stat-card glass-panel">
          <div className="stat-title">
            <DollarSign size={18} /> Tiền Đầu Tư
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div className="stat-value primary" style={{ fontSize: '1.5rem', wordBreak: 'break-all' }}>
              {formatCurrency(initialInvestment)}
            </div>
            <input 
              type="text" 
              className="form-control" 
              style={{ width: '100%', padding: '0.5rem', fontWeight: '500' }} 
              value={formatNumberInput(initialInvestment)}
              onChange={handleInvestmentChange}
              placeholder="Nhập số tiền đầu tư..."
              disabled={currentUser.role !== 'admin'}
            />
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-title">
            <TrendingUp size={18} /> Tổng Thu (Doanh Thu)
          </div>
          <div className="stat-value success">
            {formatCurrency(stats.totalRevenue)}
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-title">
            <TrendingDown size={18} /> Tổng Chi (Chi + Lương)
          </div>
          <div className="stat-value danger">
            {formatCurrency(stats.totalExpense)}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ border: '1px solid var(--accent-primary)' }}>
          <div className="stat-title" style={{ color: 'var(--text-primary)' }}>
            <Activity size={18} /> Tồn Quỹ Hiện Tại
          </div>
          <div className={`stat-value ${stats.balance >= 0 ? 'success' : 'danger'}`}>
            {formatCurrency(stats.balance)}
          </div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Bảng Tính Phân Bổ</h2>
          <button 
            className="btn btn-primary" 
            onClick={saveData} 
            disabled={isSaving}
          >
            <Save size={18} /> {isSaving ? 'Đang Lưu...' : 'Lưu Dữ Liệu'}
          </button>
        </div>

        <div className="table-wrapper" style={{ margin: 0, borderRadius: 0 }}>
          <table className="editable-table">
            <thead>
              <tr>
                <th style={{ width: '50px', textAlign: 'center' }}>STT</th>
                <th style={{ width: '150px' }}>Ngày Tháng</th>
                <th>Nội Dung</th>
                <th style={{ width: '150px' }}>Số Tiền (Chi)</th>
                <th style={{ width: '150px' }}>Tiền Lương (Chi)</th>
                <th style={{ width: '150px' }}>Doanh Thu (Thu)</th>
                <th style={{ width: '150px', textAlign: 'right' }}>Tồn Quỹ</th>
                <th>Ghi Chú</th>
                <th style={{ width: '50px', textAlign: 'center' }}>Xoá</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                    <Activity size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
                    <div>Đang tải dữ liệu từ mây...</div>
                  </td>
                </tr>
              ) : recordsWithBalance.map((record, index) => (
                <tr key={record.id}>
                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>{index + 1}</td>
                  <td>
                    <input 
                      type="date" 
                      className="inline-input"
                      value={record.date}
                      onChange={(e) => handleRecordChange(record.id, 'date', e.target.value)}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="inline-input"
                      placeholder="Nhập nội dung..."
                      value={record.content}
                      onChange={(e) => handleRecordChange(record.id, 'content', e.target.value)}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="inline-input text-right amount-expense"
                      placeholder="0"
                      value={formatNumberInput(record.amount)}
                      onChange={(e) => handleRecordChange(record.id, 'amount', parseNumberInput(e.target.value))}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="inline-input text-right amount-salary"
                      placeholder="0"
                      value={formatNumberInput(record.salary)}
                      onChange={(e) => handleRecordChange(record.id, 'salary', parseNumberInput(e.target.value))}
                    />
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="inline-input text-right amount-revenue"
                      placeholder="0"
                      value={formatNumberInput(record.revenue)}
                      onChange={(e) => handleRecordChange(record.id, 'revenue', parseNumberInput(e.target.value))}
                    />
                  </td>
                  <td style={{ textAlign: 'right', paddingRight: '1rem', verticalAlign: 'middle', fontWeight: '600', color: record.runningBalance >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatCurrency(record.runningBalance)}
                  </td>
                  <td>
                    <input 
                      type="text" 
                      className="inline-input"
                      placeholder="Ghi chú thêm..."
                      value={record.notes}
                      onChange={(e) => handleRecordChange(record.id, 'notes', e.target.value)}
                    />
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button 
                      className="btn-outline" 
                      style={{ padding: '0.4rem', border: 'none', color: 'var(--danger)' }} 
                      onClick={() => deleteRow(record.id)}
                      title="Xoá dòng"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)' }}>
          <button className="btn btn-outline" onClick={addNewRow} style={{ width: '100%', borderStyle: 'dashed' }}>
            <Plus size={18} /> Thêm Dòng Mới
          </button>
        </div>
      </div>

      {/* -------------- ADMIN MODAL -------------- */}
      {showUserModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                <Shield size={24} style={{ color: 'var(--primary)' }} /> Quản lý Nhân Viên
              </h2>
              <button className="btn-outline" onClick={() => setShowUserModal(false)} style={{ padding: '0.25rem', border: 'none' }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', marginBottom: '1.5rem', background: 'var(--bg-color)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Tài khoản mới</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ width: '100%' }}
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="Nhập tên..."
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Mật khẩu</label>
                <input 
                  type="text" 
                  className="form-control" 
                  style={{ width: '100%' }}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu..."
                  required
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '0.25rem' }}>Phân quyền</label>
                <select 
                  className="form-control" 
                  style={{ width: '100%' }}
                  value={newUserRole}
                  onChange={e => setNewUserRole(e.target.value)}
                >
                  <option value="user">Nhân viên</option>
                  <option value="admin">Quản trị viên</option>
                </select>
              </div>
              <button type="submit" className="btn btn-primary">
                <UserPlus size={18} /> Thêm
              </button>
            </form>

            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Danh sách tài khoản ({systemUsers.length})</h3>
            <div className="user-list">
              {systemUsers.map(user => (
                <div key={user.id} className="user-item">
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{user.username}</strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      Mật khẩu: <strong>{user.password}</strong> &bull; Quyền: {user.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
                    </span>
                  </div>
                  {user.username !== 'admin' && (
                    <button 
                      className="btn-outline" 
                      onClick={() => handleDeleteUser(user.username)}
                      style={{ padding: '0.5rem', color: 'var(--danger)', borderColor: 'var(--danger-bg)' }}
                      title="Xoá tài khoản"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default App;
