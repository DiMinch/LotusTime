import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../components/layout/Toast';
import { useConfirm } from '../components/layout/ConfirmModal';
import { 
  QrCode, Clock, Check, X, Coins, MapPin, 
  Plus, PencilSimple, Trash, Calendar, Info, Warning, ArrowRight, User
} from '@phosphor-icons/react';
import MapPicker from '../components/common/MapPicker';
import './AdminAttendancePage.css';

export default function AdminAttendancePage() {
  const { addToast } = useToast();
  const { confirm } = useConfirm();

  // Navigation
  const [activeTab, setActiveTab] = useState('qr'); // 'qr', 'approve', 'claims', 'payroll', 'branches'

  // Branches
  const [branches, setBranches] = useState([]);
  const [editingBranch, setEditingBranch] = useState(null);
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [branchFormData, setBranchFormData] = useState({
    name: '', latitude: 10.7769, longitude: 106.7009, allowed_radius_meters: 100,
    rate_ta_ielts: 50000, rate_ta_kids: 45000, rate_ta_independent: 60000, rate_ta_support: 40000
  });

  // QR Screen
  const [selectedBranchForQR, setSelectedBranchForQR] = useState('');
  const [qrToken, setQrToken] = useState('');
  const [qrOpen, setQrOpen] = useState(false);
  const [countdown, setCountdown] = useState(12);

  // Approval Queues
  const [pendingSessions, setPendingSessions] = useState([]);
  const [pendingClaims, setPendingClaims] = useState([]);
  const [sessionNotes, setSessionNotes] = useState({});
  const [claimNotes, setClaimNotes] = useState({});

  // History State
  const [historyType, setHistoryType] = useState('session'); // 'session' or 'claim'
  const [historyStatus, setHistoryStatus] = useState('all'); // 'all', 'approved', 'rejected', 'pending'
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalPages, setHistoryTotalPages] = useState(1);
  const [historyItems, setHistoryItems] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Payroll Calculator
  const [payrollStart, setPayrollStart] = useState('');
  const [payrollEnd, setPayrollEnd] = useState('');
  const [payrollBranch, setPayrollBranch] = useState('');
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [expandedTa, setExpandedTa] = useState(null);
  const [manualAdjustments, setManualAdjustments] = useState({}); // { username: { bonus: 0, penalty: 0, reason: '' } }

  useEffect(() => {
    // Set default date range for payroll: 1st of current month to today
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    
    setPayrollStart(firstDay.toISOString().split('T')[0]);
    setPayrollEnd(now.toISOString().split('T')[0]);

    fetchBranches();
  }, []);

  useEffect(() => {
    if (activeTab === 'approve') fetchPendingSessions();
    if (activeTab === 'claims') fetchPendingClaims();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab, historyType, historyStatus, historyPage]);

  // QR Auto-Update Loop
  useEffect(() => {
    let interval = null;
    let timer = null;

    if (qrOpen && selectedBranchForQR) {
      // Immediate fetch
      fetchQR();

      interval = setInterval(() => {
        fetchQR();
        setCountdown(12);
      }, 12000);

      timer = setInterval(() => {
        setCountdown(prev => (prev > 1 ? prev - 1 : 12));
      }, 1000);
    }

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [qrOpen, selectedBranchForQR]);

  const fetchBranches = async () => {
    try {
      const list = await api.adminGetBranches();
      setBranches(list);
      if (list.length > 0 && !selectedBranchForQR) {
        setSelectedBranchForQR(list[0].id);
      }
    } catch (err) {
      addToast('Lỗi tải danh sách chi nhánh: ' + err.message, 'error');
    }
  };

  const fetchPendingSessions = async () => {
    try {
      const list = await api.adminGetPendingSessions();
      setPendingSessions(list);
    } catch (err) {
      addToast('Lỗi tải danh sách chờ duyệt: ' + err.message, 'error');
    }
  };

  const fetchPendingClaims = async () => {
    try {
      const list = await api.adminGetClaims();
      setPendingClaims(list);
    } catch (err) {
      addToast('Lỗi tải danh sách bù công: ' + err.message, 'error');
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const data = await api.adminGetHistory(historyType, historyStatus, historyPage, 10);
      setHistoryItems(data.items || []);
      setHistoryTotalPages(data.totalPages || 1);
      setHistoryPage(data.page || 1);
    } catch (err) {
      addToast('Lỗi tải lịch sử duyệt: ' + err.message, 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const fetchQR = async () => {
    try {
      const res = await api.generateQR(selectedBranchForQR);
      setQrToken(res.token);
    } catch (err) {
      addToast('Không thể tạo mã QR: ' + err.message, 'error');
      setQrOpen(false);
    }
  };

  // Session Approval Actions
  const handleApproveSession = async (id, approve) => {
    try {
      await api.adminApproveSession(id, approve, sessionNotes[id] || '');
      addToast(approve ? 'Đã phê duyệt ca dạy thành công!' : 'Đã từ chối ca dạy.', approve ? 'success' : 'info');
      fetchPendingSessions();
    } catch (err) {
      addToast(err.message || 'Lỗi phê duyệt ca dạy.', 'error');
    }
  };

  // Claim Approval Actions
  const handleResolveClaim = async (id, status) => {
    try {
      await api.adminResolveClaim(id, status, claimNotes[id] || '');
      addToast(status === 'approved' ? 'Đã duyệt bù công thành công!' : 'Đã từ chối yêu cầu.', status === 'approved' ? 'success' : 'info');
      fetchPendingClaims();
    } catch (err) {
      addToast(err.message || 'Lỗi xử lý khiếu nại bù công.', 'error');
    }
  };

  // Payroll Calculator
  const handleCalculatePayroll = async () => {
    try {
      const data = await api.adminGetPayroll(payrollStart, payrollEnd, payrollBranch);
      setPayrollRecords(data);
      addToast(`Đã tính toán thành công ${data.length} ca dạy đã duyệt!`, 'success');
    } catch (err) {
      addToast('Lỗi tính lương: ' + err.message, 'error');
    }
  };

  // Branch CRUD Methods
  const handleOpenCreateBranch = () => {
    setEditingBranch(null);
    setBranchFormData({
      name: '', latitude: 10.7769, longitude: 106.7009, allowed_radius_meters: 100,
      rate_ta_ielts: 50000, rate_ta_kids: 45000, rate_ta_independent: 60000, rate_ta_support: 40000
    });
    setShowBranchForm(true);
  };

  const handleOpenEditBranch = (branch) => {
    setEditingBranch(branch.id);
    setBranchFormData({
      name: branch.name,
      latitude: branch.latitude,
      longitude: branch.longitude,
      allowed_radius_meters: branch.allowed_radius_meters,
      rate_ta_ielts: branch.rate_ta_ielts,
      rate_ta_kids: branch.rate_ta_kids,
      rate_ta_independent: branch.rate_ta_independent,
      rate_ta_support: branch.rate_ta_support
    });
    setShowBranchForm(true);
  };

  const handleSaveBranch = async (e) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await api.adminUpdateBranch(editingBranch, branchFormData);
        addToast('Cập nhật chi nhánh thành công.', 'success');
      } else {
        await api.adminCreateBranch(branchFormData);
        addToast('Tạo chi nhánh mới thành công.', 'success');
      }
      setShowBranchForm(false);
      fetchBranches();
    } catch (err) {
      addToast(err.message || 'Lỗi lưu chi nhánh.', 'error');
    }
  };

  const handleDeleteBranch = async (id, name) => {
    const ok = await confirm(`Bạn có chắc chắn muốn xóa chi nhánh "${name}"? Thao tác này không thể hoàn tác.`);
    if (!ok) return;

    try {
      await api.adminDeleteBranch(id);
      addToast('Đã xóa chi nhánh.', 'success');
      fetchBranches();
    } catch (err) {
      addToast(err.message || 'Lỗi xóa chi nhánh.', 'error');
    }
  };

  // Payroll Aggregation helpers
  const getPayrollSummary = () => {
    const summary = {};
    payrollRecords.forEach(rec => {
      const key = rec.username;
      if (!summary[key]) {
        summary[key] = {
          username: rec.username,
          full_name: rec.person_full_name || rec.username,
          total_hours: 0,
          base_pay: 0,
          sessions: []
        };
      }
      summary[key].total_hours += parseFloat(rec.duration_hours);
      summary[key].base_pay += rec.total_pay;
      summary[key].sessions.push(rec);
    });

    return Object.values(summary);
  };

  const updateAdjustment = (username, field, value) => {
    const current = manualAdjustments[username] || { bonus: 0, penalty: 0, reason: '' };
    setManualAdjustments({
      ...manualAdjustments,
      [username]: {
        ...current,
        [field]: field === 'reason' ? value : Number(value)
      }
    });
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  };

  return (
    <div className="admin-attendance-container">
      <div className="admin-attendance-header">
        <h1 className="admin-attendance-title">Quản Lý Chấm Công & Tính Lương</h1>
        <p className="admin-attendance-subtitle">Phê duyệt giờ giảng, tạo mã QR chấm công, giải quyết bù công và xuất dữ liệu lương.</p>
      </div>

      {/* Tabs */}
      <div className="admin-attendance-tabs">
        <button className={`admin-tab-btn ${activeTab === 'qr' ? 'active' : ''}`} onClick={() => setActiveTab('qr')}>
          <QrCode size={18} />
          <span>Mã QR Vạn Năng</span>
        </button>
        <button className={`admin-tab-btn ${activeTab === 'approve' ? 'active' : ''}`} onClick={() => setActiveTab('approve')}>
          <Clock size={18} />
          <span>Duyệt ca dạy ({pendingSessions.length})</span>
        </button>
        <button className={`admin-tab-btn ${activeTab === 'claims' ? 'active' : ''}`} onClick={() => setActiveTab('claims')}>
          <Warning size={18} />
          <span>Đơn bù công ({pendingClaims.length})</span>
        </button>
        <button className={`admin-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
          <Calendar size={18} />
          <span>Lịch sử duyệt ca</span>
        </button>
        <button className={`admin-tab-btn ${activeTab === 'payroll' ? 'active' : ''}`} onClick={() => setActiveTab('payroll')}>
          <Coins size={18} />
          <span>Tính lương TA</span>
        </button>
        <button className={`admin-tab-btn ${activeTab === 'branches' ? 'active' : ''}`} onClick={() => setActiveTab('branches')}>
          <MapPin size={18} />
          <span>Chi nhánh & Bảng giá</span>
        </button>
      </div>

      <div className="admin-attendance-content">
        
        {/* TAB 1: UNIVERSAL QR DISPLAY */}
        {activeTab === 'qr' && (
          <div className="admin-tab-pane pane-qr">
            {qrOpen ? (
              <div className="qr-display-fullscreen">
                <div className="qr-display-card">
                  <h2>MÃ QR CHẤM CÔNG VẠN NĂNG</h2>
                  <p className="branch-label">Chi nhánh: {branches.find(b => b.id === selectedBranchForQR)?.name}</p>
                  
                  <div className="qr-image-wrapper">
                    {qrToken ? (
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrToken)}`} 
                        alt="Lotus Time QR Code"
                      />
                    ) : (
                      <div className="spinner"></div>
                    )}
                  </div>

                  <div className="countdown-bar">
                    <div className="countdown-progress" style={{ width: `${(countdown / 12) * 100}%` }}></div>
                  </div>
                  <p className="countdown-text">Mã QR tự động cập nhật sau <strong>{countdown}</strong> giây...</p>
                  <p className="security-tip">Chống gian lận: Chỉ chấp nhận quét trực tiếp qua Camera trên điện thoại. Không thể lưu ảnh.</p>

                  <button className="btn btn-secondary btn-close-qr" onClick={() => setQrOpen(false)}>
                    Đóng màn hình QR
                  </button>
                </div>
              </div>
            ) : (
              <div className="qr-setup-card">
                <h2>Khởi Chạy Màn Hình Chấm Công QR</h2>
                <p>Chọn chi nhánh của trung tâm bạn để mở mã QR vạn năng. Đặt màn hình này tại bàn admin để trợ giảng tự quét khi check-in (vào) và check-out (ra).</p>
                
                <div className="form-group" style={{ maxWidth: '400px', margin: 'var(--space-lg) auto' }}>
                  <label>Chi nhánh hiện tại</label>
                  <select 
                    value={selectedBranchForQR} 
                    onChange={(e) => setSelectedBranchForQR(e.target.value)}
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <button 
                  className="btn btn-primary btn-large" 
                  disabled={branches.length === 0}
                  onClick={() => setQrOpen(true)}
                  style={{ maxWidth: '400px', margin: '0 auto' }}
                >
                  <QrCode size={22} />
                  <span>BẮT ĐẦU TRÌNH CHIẾU QR</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DUYỆT CA DẠY */}
        {activeTab === 'approve' && (
          <div className="admin-tab-pane">
            <h2 className="section-title">Danh Sách Ca Dạy Đang Chờ Duyệt ({pendingSessions.length})</h2>
            {pendingSessions.length === 0 ? (
              <p className="empty-state">Tất cả các ca dạy đã được phê duyệt.</p>
            ) : (
              <div className="approval-list">
                {pendingSessions.map(sess => (
                  <div key={sess.id} className="approval-card">
                    <div className="approval-info">
                      <div className="user-details">
                        <User size={20} weight="light" />
                        <div>
                          <h3>{sess.person_full_name || sess.username} (<code>@{sess.username}</code>)</h3>
                          <p className="sub">Chi nhánh: {sess.branch_name}</p>
                        </div>
                      </div>
                      
                      <div className="session-details">
                        <p><strong>Ngày:</strong> {formatDate(sess.check_in_time)}</p>
                        <p><strong>Nhiệm vụ:</strong> <span className="cap-tag">{sess.ta_capability.replace('TA_', '')}</span></p>
                        <p><strong>Giờ dạy khai báo:</strong> {formatTime(sess.start_time)} - {formatTime(sess.end_time)} (<strong>{sess.duration_hours} giờ</strong>)</p>
                        <p><strong>Đơn giá:</strong> {formatCurrency(sess.snapshot_hourly_rate)} / giờ</p>
                        <p className="pay-highlight"><strong>Tổng tạm tính:</strong> {formatCurrency(sess.total_pay)}</p>
                      </div>
                    </div>

                    <div className="approval-actions">
                      <div className="form-group notes-input-group">
                        <input 
                          type="text" 
                          placeholder="Ghi chú duyệt hoặc lý do từ chối..." 
                          value={sessionNotes[sess.id] || ''}
                          onChange={(e) => setSessionNotes({ ...sessionNotes, [sess.id]: e.target.value })}
                        />
                      </div>
                      <div className="action-buttons">
                        <button className="btn btn-danger btn-icon-label" onClick={() => handleApproveSession(sess.id, false)}>
                          <X size={16} /> Từ chối
                        </button>
                        <button className="btn btn-primary btn-icon-label" onClick={() => handleApproveSession(sess.id, true)}>
                          <Check size={16} /> Phê duyệt
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DUYỆT BÙ CÔNG */}
        {activeTab === 'claims' && (
          <div className="admin-tab-pane">
            <h2 className="section-title">Đơn Khiếu Nại Bù Công Chờ Duyệt ({pendingClaims.length})</h2>
            {pendingClaims.length === 0 ? (
              <p className="empty-state">Không có đơn bù công nào cần duyệt.</p>
            ) : (
              <div className="approval-list">
                {pendingClaims.map(claim => (
                  <div key={claim.id} className="approval-card claim-card">
                    <div className="approval-info">
                      <div className="user-details">
                        <User size={20} weight="light" />
                        <div>
                          <h3>{claim.person_full_name || claim.username} (<code>@{claim.username}</code>)</h3>
                          <p className="sub">Cơ sở gửi: {claim.branch_name}</p>
                        </div>
                      </div>
                      
                      <div className="session-details">
                        <p><strong>Ngày bù công:</strong> {formatDate(claim.claim_date)}</p>
                        <p><strong>Khung giờ vào/ra:</strong> {new Date(claim.claimed_check_in).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(claim.claimed_check_out).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                        <p className="reason-text"><strong>Lý do:</strong> "{claim.reason}"</p>
                      </div>
                    </div>

                    <div className="approval-actions">
                      <div className="form-group notes-input-group">
                        <input 
                          type="text" 
                          placeholder="Ghi chú duyệt hoặc lý do từ chối..." 
                          value={claimNotes[claim.id] || ''}
                          onChange={(e) => setClaimNotes({ ...claimNotes, [claim.id]: e.target.value })}
                        />
                      </div>
                      <div className="action-buttons">
                        <button className="btn btn-danger btn-icon-label" onClick={() => handleResolveClaim(claim.id, 'rejected')}>
                          <X size={16} /> Từ chối
                        </button>
                        <button className="btn btn-primary btn-icon-label" onClick={() => handleResolveClaim(claim.id, 'approved')}>
                          <Check size={16} /> Phê duyệt bù công
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: PAYROLL REPORT & CALCULATOR */}
        {activeTab === 'payroll' && (
          <div className="admin-tab-pane">
            <h2 className="section-title">Bảng Lương Trợ Giảng</h2>
            
            {/* Filter Section */}
            <div className="payroll-filter-bar">
              <div className="form-group">
                <label>Từ ngày</label>
                <input type="date" value={payrollStart} onChange={(e) => setPayrollStart(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Đến ngày</label>
                <input type="date" value={payrollEnd} onChange={(e) => setPayrollEnd(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Chi nhánh</label>
                <select value={payrollBranch} onChange={(e) => setPayrollBranch(e.target.value)}>
                  <option value="">-- Tất cả chi nhánh --</option>
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleCalculatePayroll} style={{ alignSelf: 'end', height: '40px' }}>
                Tính lương giảng
              </button>
            </div>

            {payrollRecords.length === 0 ? (
              <p className="empty-state">Chưa có kết quả tính lương. Chọn khoảng thời gian và nhấn Tính lương.</p>
            ) : (
              <div className="payroll-report-table-wrapper">
                <table className="payroll-table">
                  <thead>
                    <tr>
                      <th>Tên Trợ Giảng</th>
                      <th>Tổng số giờ dạy</th>
                      <th>Lương ca giảng</th>
                      <th>Thưởng (Bonus)</th>
                      <th>Phạt (Penalty)</th>
                      <th>Lương cuối tháng</th>
                      <th>Lý do tăng/giảm</th>
                      <th>Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getPayrollSummary().map((ta) => {
                      const adj = manualAdjustments[ta.username] || { bonus: 0, penalty: 0, reason: '' };
                      const finalPay = ta.base_pay + adj.bonus - adj.penalty;

                      return (
                        <React.Fragment key={ta.username}>
                          <tr>
                            <td className="font-semibold">{ta.full_name} (@{ta.username})</td>
                            <td className="font-mono">{ta.total_hours.toFixed(2)}h</td>
                            <td>{formatCurrency(ta.base_pay)}</td>
                            <td>
                              <input 
                                type="number" 
                                className="input-currency-adjust" 
                                placeholder="0" 
                                value={adj.bonus || ''} 
                                onChange={(e) => updateAdjustment(ta.username, 'bonus', e.target.value)}
                              />
                            </td>
                            <td>
                              <input 
                                type="number" 
                                className="input-currency-adjust penalty" 
                                placeholder="0" 
                                value={adj.penalty || ''} 
                                onChange={(e) => updateAdjustment(ta.username, 'penalty', e.target.value)}
                              />
                            </td>
                            <td className="font-bold text-primary">{formatCurrency(finalPay)}</td>
                            <td>
                              <input 
                                type="text" 
                                className="input-reason-adjust" 
                                placeholder="Nhập lý do điều chỉnh..." 
                                value={adj.reason || ''} 
                                onChange={(e) => updateAdjustment(ta.username, 'reason', e.target.value)}
                              />
                            </td>
                            <td>
                              <button className="btn btn-secondary btn-xs" onClick={() => setExpandedTa(expandedTa === ta.username ? null : ta.username)}>
                                {expandedTa === ta.username ? 'Thu gọn' : 'Xem chi tiết'}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Details Row */}
                          {expandedTa === ta.username && (
                            <tr className="expanded-payroll-row">
                              <td colSpan="8">
                                <div className="payroll-details-panel">
                                  <h4>Chi tiết các ca giảng đã duyệt:</h4>
                                  <table className="mini-details-table">
                                    <thead>
                                      <tr>
                                        <th>Ngày</th>
                                        <th>Khung Giờ</th>
                                        <th>Nhiệm vụ</th>
                                        <th>Giờ dạy</th>
                                        <th>Đơn giá</th>
                                        <th>Tạm tính</th>
                                        <th>Ghi chú duyệt</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {ta.sessions.map((s) => (
                                        <tr key={s.id}>
                                          <td>{formatDate(s.check_in_time)}</td>
                                          <td>{formatTime(s.start_time)} - {formatTime(s.end_time)}</td>
                                          <td><span className="cap-tag">{s.ta_capability.replace('TA_', '')}</span></td>
                                          <td>{s.duration_hours}h</td>
                                          <td>{formatCurrency(s.snapshot_hourly_rate)}</td>
                                          <td>{formatCurrency(s.total_pay)}</td>
                                          <td>{s.admin_notes || '--'}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB: DUYỆT CA HISTORY */}
        {activeTab === 'history' && (
          <div className="admin-tab-pane">
            <div className="pane-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-md)', marginBottom: 'var(--space-md)' }}>
              <h2 className="section-title" style={{ margin: 0 }}>Lịch Sử Duyệt Ca & Bù Công</h2>
              <div className="history-filters" style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
                <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '500', whiteSpace: 'nowrap' }}>Loại yêu cầu:</label>
                  <select 
                    value={historyType} 
                    onChange={(e) => { setHistoryType(e.target.value); setHistoryPage(1); }}
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--text-main)' }}
                  >
                    <option value="session">Ca dạy khai báo</option>
                    <option value="claim">Đơn báo bù công</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <label style={{ fontWeight: '500', whiteSpace: 'nowrap' }}>Trạng thái:</label>
                  <select 
                    value={historyStatus} 
                    onChange={(e) => { setHistoryStatus(e.target.value); setHistoryPage(1); }}
                    style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--color-hairline)', background: 'var(--color-surface)', color: 'var(--text-main)' }}
                  >
                    <option value="all">Tất cả</option>
                    <option value="approved">Đã duyệt</option>
                    <option value="rejected">Đã từ chối</option>
                    <option value="pending">Chờ duyệt</option>
                  </select>
                </div>
              </div>
            </div>

            {historyLoading ? (
              <div className="loading-state" style={{ padding: 'var(--space-lg)', textAlign: 'center', color: 'var(--text-mute)' }}>Đang tải lịch sử...</div>
            ) : historyItems.length === 0 ? (
              <p className="no-data" style={{ padding: 'var(--space-lg)', textAlign: 'center', background: 'var(--color-surface-soft)', borderRadius: '8px' }}>Không tìm thấy bản ghi lịch sử nào phù hợp.</p>
            ) : (
              <>
                <div className="data-table-wrapper">
                  <table className="admin-payroll-table">
                    <thead>
                      {historyType === 'session' ? (
                        <tr>
                          <th>Nhân sự (TA)</th>
                          <th>Chi nhánh</th>
                          <th>Ngày/Giờ dạy</th>
                          <th>Năng lực</th>
                          <th>Độ dài</th>
                          <th>Thành tiền</th>
                          <th>Trạng thái</th>
                          <th>Ghi chú Admin</th>
                        </tr>
                      ) : (
                        <tr>
                          <th>Nhân sự (TA)</th>
                          <th>Chi nhánh</th>
                          <th>Ngày bù công</th>
                          <th>Giờ Vào/Ra khai báo</th>
                          <th>Lý do khiếu nại</th>
                          <th>Trạng thái</th>
                          <th>Ghi chú Admin</th>
                        </tr>
                      )}
                    </thead>
                    <tbody>
                      {historyItems.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="user-info-cell" style={{ display: 'flex', flexDirection: 'column' }}>
                              <strong>{item.person_full_name || item.username}</strong>
                              <span style={{ fontSize: '12px', color: 'var(--text-mute)' }}>@{item.username}</span>
                            </div>
                          </td>
                          <td>{item.branch_name}</td>
                          
                          {historyType === 'session' ? (
                            <>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                  <strong>{formatDate(item.check_in_time)}</strong>
                                  <span style={{ fontSize: '12px', color: 'var(--text-mute)' }}>{formatTime(item.start_time)} - {formatTime(item.end_time)}</span>
                                </div>
                              </td>
                              <td><span className="capability-tag" style={{ background: 'var(--color-surface-soft)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>{item.ta_capability.replace('TA_', '')}</span></td>
                              <td>{item.duration_hours}h</td>
                              <td>{formatCurrency(item.total_pay)}</td>
                              <td>
                                <span className={`badge badge-${item.status || (item.is_approved ? 'approved' : 'rejected')}`} style={{ textTransform: 'capitalize' }}>
                                  {item.status === 'approved' || item.is_approved ? 'Đã duyệt' : item.status === 'rejected' ? 'Bị từ chối' : 'Chờ duyệt'}
                                </span>
                              </td>
                              <td>{item.admin_notes || '--'}</td>
                            </>
                          ) : (
                            <>
                              <td><strong>{formatDate(item.claim_date)}</strong></td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                                  <span>Vào: {new Date(item.claimed_check_in).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                  <span>Ra: {new Date(item.claimed_check_out).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                              </td>
                              <td style={{ maxWidth: '250px', whiteSpace: 'normal', fontSize: '13px' }}>{item.reason}</td>
                              <td>
                                <span className={`badge badge-${item.status}`} style={{ textTransform: 'capitalize' }}>
                                  {item.status === 'approved' ? 'Đã duyệt' : item.status === 'rejected' ? 'Bị từ chối' : 'Chờ duyệt'}
                                </span>
                              </td>
                              <td>{item.admin_notes || '--'}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {historyTotalPages > 1 && (
                  <div className="pagination-controls" style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center', marginTop: 'var(--space-md)' }}>
                    <button 
                      disabled={historyPage === 1} 
                      onClick={() => setHistoryPage(prev => Math.max(prev - 1, 1))}
                      className="btn btn-secondary btn-sm"
                    >
                      Trước
                    </button>
                    <span>Trang {historyPage} / {historyTotalPages}</span>
                    <button 
                      disabled={historyPage === historyTotalPages} 
                      onClick={() => setHistoryPage(prev => Math.min(prev + 1, historyTotalPages))}
                      className="btn btn-secondary btn-sm"
                    >
                      Sau
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* TAB 5: BRANCHES CRUD */}
        {activeTab === 'branches' && (
          <div className="admin-tab-pane">
            <div className="pane-header">
              <h2 className="section-title">Danh Sách Chi Nhánh lotusTime</h2>
              <button className="btn btn-primary" onClick={handleOpenCreateBranch}>
                <Plus size={16} /> Thêm chi nhánh
              </button>
            </div>

            {/* Branch edit/create Form inline card */}
            {showBranchForm && (
              <form onSubmit={handleSaveBranch} className="branch-crud-form-card">
                <h3>{editingBranch ? 'Chỉnh Sửa Chi Nhánh' : 'Thêm Chi Nhánh Mới'}</h3>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label>Tên chi nhánh</label>
                    <input 
                      type="text" 
                      value={branchFormData.name} 
                      onChange={(e) => setBranchFormData({ ...branchFormData, name: e.target.value })} 
                      required 
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Bán kính allowed (mét)</label>
                    <input 
                      type="number" 
                      value={branchFormData.allowed_radius_meters} 
                      onChange={(e) => setBranchFormData({ ...branchFormData, allowed_radius_meters: parseInt(e.target.value, 10) })} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Vĩ độ (Latitude)</label>
                    <input 
                      type="number" 
                      step="any" 
                      value={branchFormData.latitude} 
                      onChange={(e) => setBranchFormData({ ...branchFormData, latitude: parseFloat(e.target.value) })} 
                      required 
                    />
                  </div>

                  <div className="form-group">
                    <label>Kinh độ (Longitude)</label>
                    <input 
                      type="number" 
                      step="any" 
                      value={branchFormData.longitude} 
                      onChange={(e) => setBranchFormData({ ...branchFormData, longitude: parseFloat(e.target.value) })} 
                      required 
                    />
                  </div>
                </div>

                {/* Leaflet interactive Map Picker */}
                <MapPicker 
                  latitude={branchFormData.latitude} 
                  longitude={branchFormData.longitude} 
                  radius={branchFormData.allowed_radius_meters}
                  onChange={(lat, lng) => setBranchFormData({ ...branchFormData, latitude: lat, longitude: lng })}
                />

                <h4 style={{ margin: 'var(--space-md) 0 var(--space-xs)' }}>Biểu giá lương trợ giảng (VNĐ / Giờ):</h4>
                <div className="form-grid rates-grid">
                  <div className="form-group">
                    <label>TA IELTS</label>
                    <input 
                      type="number" 
                      value={branchFormData.rate_ta_ielts} 
                      onChange={(e) => setBranchFormData({ ...branchFormData, rate_ta_ielts: parseInt(e.target.value, 10) })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>TA Kids</label>
                    <input 
                      type="number" 
                      value={branchFormData.rate_ta_kids} 
                      onChange={(e) => setBranchFormData({ ...branchFormData, rate_ta_kids: parseInt(e.target.value, 10) })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>TA Độc Lập</label>
                    <input 
                      type="number" 
                      value={branchFormData.rate_ta_independent} 
                      onChange={(e) => setBranchFormData({ ...branchFormData, rate_ta_independent: parseInt(e.target.value, 10) })} 
                    />
                  </div>
                  <div className="form-group">
                    <label>TA Hỗ Trợ</label>
                    <input 
                      type="number" 
                      value={branchFormData.rate_ta_support} 
                      onChange={(e) => setBranchFormData({ ...branchFormData, rate_ta_support: parseInt(e.target.value, 10) })} 
                    />
                  </div>
                </div>

                <div className="branch-form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowBranchForm(false)}>Hủy</button>
                  <button type="submit" className="btn btn-primary">Lưu thông tin</button>
                </div>
              </form>
            )}

            <div className="branches-grid">
              {branches.map(branch => (
                <div key={branch.id} className="branch-card-item">
                  <div className="branch-card-header">
                    <h3>{branch.name}</h3>
                    <div className="branch-actions">
                      <button className="btn-icon" onClick={() => handleOpenEditBranch(branch)}>
                        <PencilSimple size={16} />
                      </button>
                      <button className="btn-icon text-danger" onClick={() => handleDeleteBranch(branch.id, branch.name)}>
                        <Trash size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="branch-card-body">
                    <p><MapPin size={16} /> Lat: <code>{branch.latitude}</code> | Lng: <code>{branch.longitude}</code></p>
                    <p><Info size={16} /> Bán kính tối đa: <strong>{branch.allowed_radius_meters}m</strong></p>
                    
                    <div className="rates-summary-panel">
                      <h5>Đơn giá lương giờ dạy:</h5>
                      <ul>
                        <li><span>TA IELTS:</span> <strong>{formatCurrency(branch.rate_ta_ielts)}</strong></li>
                        <li><span>TA Kids:</span> <strong>{formatCurrency(branch.rate_ta_kids)}</strong></li>
                        <li><span>TA Độc lập:</span> <strong>{formatCurrency(branch.rate_ta_independent)}</strong></li>
                        <li><span>TA Hỗ trợ:</span> <strong>{formatCurrency(branch.rate_ta_support)}</strong></li>
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
