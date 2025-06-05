// API配置 - 稍后我们会创建这个Worker
const API_BASE_URL = 'https://yourproject.workers.dev'; // 稍后替换

// 状态映射
const statusMap = {
    'pending': { text: '订单已接收', icon: 'bi-clock', color: 'secondary' },
    'scheduled': { text: '已安排配送', icon: 'bi-calendar-check', color: 'info' },
    'delivering': { text: '配送中', icon: 'bi-truck', color: 'warning' },
    'completed': { text: '已送达', icon: 'bi-check-circle', color: 'success' },
    'failed': { text: '配送失败', icon: 'bi-x-circle', color: 'danger' }
};

document.getElementById('trackForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const phone = document.getElementById('phone').value.trim();
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    
    if (!phone) {
        alert('请输入手机号码');
        return;
    }
    
    // 显示加载状态
    submitBtn.disabled = true;
    loading.style.display = 'block';
    results.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE_URL}/track-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone: phone })
        });
        
        const data = await response.json();
        
        if (data.success && data.orders && data.orders.length > 0) {
            displayOrders(data.orders);
        } else {
            displayNoResults();
        }
        
    } catch (error) {
        console.error('查询失败:', error);
        displayError('网络错误，请稍后再试');
    } finally {
        submitBtn.disabled = false;
        loading.style.display = 'none';
        results.style.display = 'block';
    }
});

function displayOrders(orders) {
    const results = document.getElementById('results');
    
    let html = `<h5 class="mb-3"><i class="bi bi-list-check"></i> 找到 ${orders.length} 个订单</h5>`;
    
    orders.forEach((order, index) => {
        const status = statusMap[order.delivery_status] || statusMap['pending'];
        
        html += `
            <div class="order-card card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h6 class="card-title mb-0">订单 #${order.order_id || `ORD-${index + 1}`}</h6>
                        <span class="badge bg-${status.color} status-badge">
                            <i class="${status.icon}"></i> ${status.text}
                        </span>
                    </div>
                    
                    <div class="row text-sm">
                        <div class="col-6">
                            <strong>收件人:</strong><br>
                            ${order.recipient_name || '未提供'}
                        </div>
                        <div class="col-6">
                            <strong>配送地址:</strong><br>
                            ${order.recipient_address || '地址信息不完整'}
                        </div>
                    </div>
                    
                    ${order.estimated_delivery ? `
                        <div class="mt-2">
                            <i class="bi bi-clock"></i> 
                            <strong>预计送达:</strong> ${formatDateTime(order.estimated_delivery)}
                        </div>
                    ` : ''}
                    
                    ${order.driver_info ? `
                        <div class="mt-2 p-2 bg-light rounded">
                            <i class="bi bi-person-badge"></i> 
                            <strong>配送司机:</strong> ${order.driver_info.name}
                            ${order.driver_info.phone ? `<br><i class="bi bi-phone"></i> ${order.driver_info.phone}` : ''}
                        </div>
                    ` : ''}
                    
                    ${order.tracking_history ? displayTrackingHistory(order.tracking_history) : ''}
                </div>
            </div>
        `;
    });
    
    results.innerHTML = html;
}

function displayTrackingHistory(history) {
    if (!Array.isArray(history) || history.length === 0) {
        return '';
    }
    
    let html = '<div class="mt-3"><h6>配送进度:</h6>';
    
    history.forEach(step => {
        const isActive = step.completed;
        html += `
            <div class="progress-step ${isActive ? 'active' : ''}">
                <i class="step-icon ${isActive ? 'bi-check-circle-fill' : 'bi-circle'}"></i>
                ${step.description}
                ${step.timestamp ? `<small class="d-block text-muted">${formatDateTime(step.timestamp)}</small>` : ''}
            </div>
        `;
    });
    
    html += '</div>';
    return html;
}

function displayNoResults() {
    const results = document.getElementById('results');
    results.innerHTML = `
        <div class="alert alert-warning text-center">
            <i class="bi bi-exclamation-triangle"></i>
            <h6>未找到订单</h6>
            <p class="mb-0">请检查手机号码是否正确，或联系客服咨询</p>
        </div>
    `;
}

function displayError(message) {
    const results = document.getElementById('results');
    results.innerHTML = `
        <div class="alert alert-danger text-center">
            <i class="bi bi-exclamation-circle"></i>
            <h6>查询失败</h6>
            <p class="mb-0">${message}</p>
        </div>
    `;
}

function formatDateTime(dateString) {
    if (!dateString) return '未知';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateString;
    }
}

// 输入验证
document.getElementById('phone').addEventListener('input', function(e) {
    // 简单的手机号格式验证
    const value = e.target.value;
    if (value && !/^[\d\-\+\s\(\)]+$/.test(value)) {
        e.target.setCustomValidity('请输入有效的手机号码');
    } else {
        e.target.setCustomValidity('');
    }
});
