// API配置 - 使用Cloudflare Worker
const API_BASE_URL = 'https://delivery-track-api.haofreshbne.workers.dev'; // 正式Worker地址

// 状态映射 - 根据API返回的display_status
const statusMap = {
    '订单已接收': { text: '订单已接收', icon: 'bi-clock', color: 'secondary' },
    '订单已处理': { text: '订单已处理', icon: 'bi-gear', color: 'success' },
    '已分配配送': { text: '已分配配送', icon: 'bi-calendar-check', color: 'warning' },
    '配送已安排': { text: '配送已安排', icon: 'bi-calendar-check', color: 'warning' },
    '正在配送': { text: '正在配送', icon: 'bi-truck', color: 'primary' },
    '配送完成': { text: '配送完成', icon: 'bi-check-circle', color: 'success' },
    '配送失败': { text: '配送失败', icon: 'bi-x-circle', color: 'danger' }
};

document.getElementById('trackForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const phone = document.getElementById('phone').value.trim();
    const submitBtn = document.getElementById('submitBtn');
    const loading = document.getElementById('loading');
    const results = document.getElementById('results');
    const formSection = document.getElementById('formSection');
    
    if (!phone) {
        alert('请输入手机号码');
        return;
    }
    
    // 显示加载状态
    submitBtn.disabled = true;
    loading.style.display = 'block';
    results.style.display = 'none';
    
    // 记录开始时间，确保最少显示2秒加载动画
    const startTime = Date.now();
    const minLoadingTime = 2000; // 2秒
    
    try {
        const response = await fetch(`${API_BASE_URL}/track-order`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ phone: phone })
        });
        
        const data = await response.json();
        
        // 计算已经过去的时间
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
        
        // 如果还没到最小时间，等待剩余时间
        if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        if (data.success && data.orders && data.orders.length > 0) {
            // 折叠表单区域
            formSection.style.display = 'none';
            displayOrders(data.orders, phone);
        } else {
            displayNoResults(data.message || '未找到相关订单');
        }
        
    } catch (error) {
        console.error('查询失败:', error);
        
        // 即使出错也要保证最小加载时间
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minLoadingTime - elapsedTime);
        
        if (remainingTime > 0) {
            await new Promise(resolve => setTimeout(resolve, remainingTime));
        }
        
        displayError('网络错误，请稍后再试');
    } finally {
        submitBtn.disabled = false;
        loading.style.display = 'none';
        results.style.display = 'block';
    }
});

function displayOrders(orders, phone) {
    const results = document.getElementById('results');
    
    let html = `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="mb-0"><i class="bi bi-list-check text-primary"></i> 找到 ${orders.length} 个配送中的订单</h5>
            <button class="btn btn-outline-secondary btn-sm" onclick="showFormAgain()">
                <i class="bi bi-arrow-left"></i> 重新查询
            </button>
        </div>
    `;
    
    orders.forEach((order, index) => {
        // 使用API返回的display_status
        const status = statusMap[order.display_status] || { text: order.display_status, icon: 'bi-info-circle', color: 'secondary' };
        
        html += `
            <div class="order-card card mb-3">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-3">
                        <h6 class="card-title mb-0">订单 #${order.order_id}</h6>
                        <span class="badge bg-${status.color} status-badge">
                            <i class="${status.icon}"></i> ${status.text}
                        </span>
                    </div>
                    
                    <div class="row text-sm">
                        <div class="col-12 mb-2">
                            <strong><i class="bi bi-person text-primary"></i> 收件人:</strong><br>
                            ${order.recipient_name || '未提供'}
                        </div>
                        <div class="col-12 mb-3">
                            <strong><i class="bi bi-geo-alt text-primary"></i> 配送地址:</strong><br>
                            ${order.recipient_address || '地址信息不完整'}
                            ${order.recipient_suburb ? `, ${order.recipient_suburb}` : ''}
                        </div>
                    </div>
                    
                    <!-- 时间信息 -->
                    <div class="row mt-2">
                        ${order.estimated_arrival_time ? `
                            <div class="col-12 mb-3">
                                <div class="alert alert-warning border-0" style="background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%); color: white;">
                                    <i class="bi bi-clock"></i> 
                                    <strong>预计送达时间:</strong><br>
                                    <span class="fs-5">${formatTimeRange(order.estimated_arrival_time)}</span>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${order.actual_arrival_time ? `
                            <div class="col-12 mb-2">
                                <i class="bi bi-check-circle text-success"></i> 
                                <strong>实际到达时间:</strong><br>
                                <span class="text-success">${formatDateTime(order.actual_arrival_time)}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- 司机信息 -->
                    ${order.driver_info && order.driver_info.name ? `
                        <div class="mt-3 p-3 rounded" style="background: linear-gradient(135deg, #4caf50 0%, #8bc34a 100%); color: white;">
                            <h6 class="mb-2"><i class="bi bi-person-badge"></i> 配送司机信息</h6>
                            <div class="row">
                                <div class="col-6">
                                    <strong>姓名:</strong><br>
                                    ${order.driver_info.name}
                                </div>
                                ${order.driver_info.phone ? `
                                    <div class="col-6">
                                        <strong>联系电话:</strong><br>
                                        <a href="tel:${order.driver_info.phone}" class="text-white text-decoration-none">
                                            <i class="bi bi-phone"></i> ${order.driver_info.phone}
                                        </a>
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : ''}
                    
                    <!-- 订单备注 -->
                    ${order.order_note ? `
                        <div class="mt-2">
                            <small class="text-muted">
                                <i class="bi bi-chat-left-text"></i> 
                                <strong>备注:</strong> ${order.order_note}
                            </small>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    results.innerHTML = html;
}

// 显示表单的函数
function showFormAgain() {
    const formSection = document.getElementById('formSection');
    const results = document.getElementById('results');
    
    formSection.style.display = 'block';
    results.style.display = 'none';
    
    // 清空手机号输入框
    document.getElementById('phone').value = '';
}

function displayNoResults(message) {
    const results = document.getElementById('results');
    results.innerHTML = `
        <div class="text-center mb-3">
            <button class="btn btn-outline-secondary btn-sm" onclick="showFormAgain()">
                <i class="bi bi-arrow-left"></i> 重新查询
            </button>
        </div>
        <div class="alert alert-warning text-center">
            <i class="bi bi-exclamation-triangle"></i>
            <h6>未找到配送中的订单</h6>
            <p class="mb-0">${message}</p>
            <hr>
            <small class="text-muted">
                注：只显示正在配送中的订单。如需查询历史订单，请联系客服。
            </small>
        </div>
    `;
}

function displayError(message) {
    const results = document.getElementById('results');
    results.innerHTML = `
        <div class="text-center mb-3">
            <button class="btn btn-outline-secondary btn-sm" onclick="showFormAgain()">
                <i class="bi bi-arrow-left"></i> 重新查询
            </button>
        </div>
        <div class="alert alert-danger text-center">
            <i class="bi bi-exclamation-circle"></i>
            <h6>查询失败</h6>
            <p class="mb-0">${message}</p>
            <button class="btn btn-outline-danger btn-sm mt-2" onclick="location.reload()">
                <i class="bi bi-arrow-clockwise"></i> 重新尝试
            </button>
        </div>
    `;
}

function formatTimeRange(dateString) {
    if (!dateString) return '未知';
    
    try {
        const date = new Date(dateString);
        const startTime = new Date(date.getTime() - 30 * 60000); // 减30分钟
        const endTime = new Date(date.getTime() + 30 * 60000);   // 加30分钟
        
        const formatTime = (d) => {
            return d.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        };
        
        return `${formatTime(startTime)}-${formatTime(endTime)}`;
    } catch {
        return dateString;
    }
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
            minute: '2-digit',
            hour12: false
        });
    } catch {
        return dateString;
    }
}

function formatDate(dateString) {
    if (!dateString) return '未知';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        });
    } catch {
        return dateString;
    }
}

// 输入验证
document.getElementById('phone').addEventListener('input', function(e) {
    // 澳洲手机号格式验证
    const value = e.target.value;
    if (value && !/^[\d\-\+\s\(\)]+$/.test(value)) {
        e.target.setCustomValidity('请输入有效的手机号码');
    } else {
        e.target.setCustomValidity('');
    }
});

// 页面加载完成后的提示
document.addEventListener('DOMContentLoaded', function() {
    console.log('好鲜生订单查询系统已加载');
    
    // 如果URL包含phone参数，自动填入
    const urlParams = new URLSearchParams(window.location.search);
    const phoneParam = urlParams.get('phone');
    if (phoneParam) {
        document.getElementById('phone').value = phoneParam;
    }
});
