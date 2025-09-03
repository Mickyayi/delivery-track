// API配置 - 使用Cloudflare Worker
const API_BASE_URL = 'https://delivery-track-api.haofreshbne.workers.dev'; // 正式Worker地址

// 地图配置
const MAP_CONFIG = {
    useGoogleMaps: true, // 启用Google Maps地图显示
    useGoogleGeocoding: true, // 启用Google地理编码（通过后端代理）
    useProxyMaps: true, // 使用代理方式访问Google服务
    fallbackToLeaflet: true, // 如果Google Maps失败，回退到Leaflet
    defaultMapProvider: 'esri-satellite', // Leaflet备用地图提供商
    
    // 可用的地图提供商
    providers: {
        'osm': {
            name: 'OpenStreetMap',
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors'
        },
        'esri-satellite': {
            name: 'Esri 卫星图像',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            attribution: '© Esri, DigitalGlobe, GeoEye, Earthstar Geographics, CNES/Airbus DS, USDA, USGS, AeroGRID, IGN, and the GIS User Community'
        },
        'esri-street': {
            name: 'Esri 街道地图',
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            attribution: '© Esri'
        },
        'cartodb': {
            name: 'CartoDB Positron',
            url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
            attribution: '© OpenStreetMap contributors, © CartoDB'
        }
    }
};

// 地图相关变量
let driverLocationMaps = new Map(); // 存储每个订单的地图实例
let locationUpdateIntervals = new Map(); // 存储位置更新定时器
let googleMapsLoaded = false; // Google Maps API加载状态
let googleMapsLoading = false; // Google Maps API加载中状态

// 智能司机图标配置
const DRIVER_ICONS = {
    normal: './normal.gif',    // 正常配送状态
    late: './late.gif',        // 延误状态
    rain: './rain.gif',        // 雨天状态
    fallback: './driver.gif'   // 备用图标（向后兼容）
};

// 司机图标缓存 - 避免重复查询
let driverIconCache = new Map(); // key: orderId, value: {iconType, timestamp}
let weatherCache = new Map(); // key: lat,lng, value: {weatherData, timestamp}

// 缓存时间配置
const CACHE_CONFIG = {
    weatherCacheTime: 30 * 60 * 1000, // 天气缓存30分钟
    driverPerformanceCacheTime: 10 * 60 * 1000 // 司机表现缓存10分钟
};

// 动态加载Google Maps API
async function loadGoogleMapsAPI() {
    if (googleMapsLoaded) return true;
    if (googleMapsLoading) {
        // 等待加载完成
        return new Promise((resolve) => {
            const checkLoaded = () => {
                if (googleMapsLoaded) resolve(true);
                else if (!googleMapsLoading) resolve(false);
                else setTimeout(checkLoaded, 100);
            };
            checkLoaded();
        });
    }
    
    googleMapsLoading = true;
    
    try {
        // 通过Worker获取Google Maps API URL
        const response = await fetch(`${API_BASE_URL}/maps/js-api-url`);
        if (!response.ok) throw new Error('Failed to get Google Maps API URL');
        
        const data = await response.json();
        if (!data.url) throw new Error('No Google Maps API URL provided');
        
        // 动态加载Google Maps API脚本
        await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = data.url;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                googleMapsLoaded = true;
                googleMapsLoading = false;
                resolve();
            };
            script.onerror = () => {
                googleMapsLoading = false;
                reject(new Error('Failed to load Google Maps API'));
            };
            document.head.appendChild(script);
        });
        
        return true;
    } catch (error) {
        console.warn('Failed to load Google Maps API:', error);
        googleMapsLoading = false;
        return false;
    }
}

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
            // 清理之前的地图和定时器
            cleanupMapsAndIntervals();
            
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
                    
                                            <!-- 司机实时位置 (当有route_id且状态为已分配配送或正在配送时显示) -->
                        ${(order.display_status === '正在配送' || order.display_status === '已分配配送') && order.route_id ? `
                        <div class="mt-3">
                            <div class="driver-location-card">
                                <h6 class="mb-2">
                                    <i class="bi bi-geo-alt-fill"></i> 司机实时位置
                                    <span class="badge bg-success ms-2">实时追踪</span>
                                    <span id="driver-status-${order.order_id}" class="ms-2">
                                        <span class="badge bg-secondary">
                                            <i class="bi bi-circle-fill me-1" style="font-size: 8px;"></i>
                                            分析中...
                                        </span>
                                    </span>
                                </h6>
                                <div class="location-update-time" id="location-time-${order.order_id}">
                                    正在获取位置信息...
                                </div>
                                <div id="status-explanation-${order.order_id}" class="mt-1">
                                    <!-- 状态说明将在这里动态更新 -->
                                </div>
                            </div>
                            
                            <!-- 地图容器 -->
                            <div id="map-container-${order.order_id}" class="map-loading">
                                <div class="text-center">
                                    <div class="spinner-border text-primary mb-2" role="status"></div>
                                    <div>正在加载司机位置...</div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    results.innerHTML = html;
    
    // 为有route_id的订单加载司机位置（已分配配送或正在配送）
    orders.forEach(order => {
        if ((order.display_status === '正在配送' || order.display_status === '已分配配送') && order.route_id) {
            loadDriverLocation(order.order_id, order.route_id, order.recipient_address);
        }
    });
}

// 显示表单的函数
function showFormAgain() {
    const formSection = document.getElementById('formSection');
    const results = document.getElementById('results');
    
    // 清理之前的地图和定时器
    cleanupMapsAndIntervals();
    
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

// 智能司机图标判断逻辑
async function determineDriverIcon(driverData, driverLat, driverLng) {
    try {
        // 优先级1: 检查天气状况
        const weatherData = await getWeatherData(driverLat, driverLng);
        if (weatherData && weatherData.isRaining) {
            return 'rain';
        }
        
        // 优先级2: 检查司机配送表现
        if (driverData.recent_delivery_performance && 
            driverData.recent_delivery_performance.last_completed_order_delay_minutes > 15) {
            return 'late';
        }
        
        // 默认: 正常状态
        return 'normal';
    } catch (error) {
        console.warn('确定司机图标类型失败:', error);
        return 'normal'; // 默认正常状态
    }
}

// 获取天气数据（带缓存）
async function getWeatherData(lat, lng) {
    const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`; // 精确到3位小数
    const cached = weatherCache.get(cacheKey);
    
    // 检查缓存是否有效
    if (cached && (Date.now() - cached.timestamp < CACHE_CONFIG.weatherCacheTime)) {
        return cached.weatherData;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/weather/${lat}/${lng}`);
        const weatherData = await response.json();
        
        // 更新缓存
        weatherCache.set(cacheKey, {
            weatherData: weatherData,
            timestamp: Date.now()
        });
        
        return weatherData;
    } catch (error) {
        console.warn('获取天气数据失败:', error);
        // 返回默认值
        return { success: false, isRaining: false };
    }
}

// 获取司机图标URL
function getDriverIconUrl(iconType) {
    return DRIVER_ICONS[iconType] || DRIVER_ICONS.fallback;
}

// 司机位置相关函数
async function loadDriverLocation(orderId, routeId, deliveryAddress) {
    try {
        const response = await fetch(`${API_BASE_URL}/driver-location/${routeId}`);
        const data = await response.json();
        
        if (data.current_latitude && data.current_longitude) {
            // 确定司机图标类型
            const iconType = await determineDriverIcon(data, 
                parseFloat(data.current_latitude), 
                parseFloat(data.current_longitude)
            );
            
            // 缓存图标类型
            driverIconCache.set(orderId, {
                iconType: iconType,
                timestamp: Date.now()
            });
            
            await displayDriverMap(orderId, data, deliveryAddress, iconType);
            updateLocationTime(orderId, data.last_location_update);
            updateDriverStatus(orderId, iconType);
            
            // 设置定时更新 (每30秒)
            const intervalId = setInterval(() => {
                updateDriverLocation(orderId, routeId, deliveryAddress);
            }, 30000);
            
            locationUpdateIntervals.set(orderId, intervalId);
        } else {
            showLocationUnavailable(orderId);
        }
    } catch (error) {
        console.error('加载司机位置失败:', error);
        showLocationUnavailable(orderId);
    }
}

async function updateDriverLocation(orderId, routeId, deliveryAddress) {
    try {
        const response = await fetch(`${API_BASE_URL}/driver-location/${routeId}`);
        const data = await response.json();
        
        if (data.current_latitude && data.current_longitude) {
            // 重新确定司机图标类型（可能状态已变化）
            const iconType = await determineDriverIcon(data, 
                parseFloat(data.current_latitude), 
                parseFloat(data.current_longitude)
            );
            
            // 更新缓存
            driverIconCache.set(orderId, {
                iconType: iconType,
                timestamp: Date.now()
            });
            
            const map = driverLocationMaps.get(orderId);
            if (map) {
                // 更新地图上的司机位置和图标
                updateDriverMarker(map, data, iconType);
                updateLocationTime(orderId, data.last_location_update);
                updateDriverStatus(orderId, iconType);
            }
        }
    } catch (error) {
        console.error('更新司机位置失败:', error);
    }
}

async function displayDriverMap(orderId, driverData, deliveryAddress, iconType = 'normal') {
    const mapContainer = document.getElementById(`map-container-${orderId}`);
    if (!mapContainer) return;
    
    // 清除加载状态
    mapContainer.className = 'driver-map-container';
    mapContainer.innerHTML = '';
    
    // 尝试使用Google Maps
    if (MAP_CONFIG.useGoogleMaps) {
        const googleMapsLoaded = await loadGoogleMapsAPI();
        if (googleMapsLoaded && window.google && window.google.maps) {
            displayGoogleMap(orderId, driverData, deliveryAddress, mapContainer, iconType);
            return;
        } else if (!MAP_CONFIG.fallbackToLeaflet) {
            // 如果不允许回退，显示错误
            mapContainer.innerHTML = `
                <div class="text-center text-muted p-3">
                    <i class="bi bi-exclamation-triangle" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                    <div>Google Maps加载失败</div>
                    <small>请稍后再试</small>
                </div>
            `;
            return;
        }
        console.warn('Google Maps加载失败，回退到Leaflet地图');
    }
    
    // 创建Leaflet地图（原有逻辑）
    const map = L.map(mapContainer, {
        zoomControl: true,
        scrollWheelZoom: false,
        doubleClickZoom: true
    });
    
    // 添加地图图层 (使用高质量卫星图像)
    const provider = MAP_CONFIG.providers[MAP_CONFIG.defaultMapProvider];
    const tileLayer = L.tileLayer(provider.url, {
        attribution: provider.attribution,
        maxZoom: 18
    }).addTo(map);
    
    // 添加图层切换控制
    const baseLayers = {};
    Object.keys(MAP_CONFIG.providers).forEach(key => {
        const p = MAP_CONFIG.providers[key];
        baseLayers[p.name] = L.tileLayer(p.url, {
            attribution: p.attribution,
            maxZoom: 18
        });
    });
    
    // 设置默认图层
    baseLayers[provider.name] = tileLayer;
    
    // 添加图层控制器
    L.control.layers(baseLayers).addTo(map);
    
    // 司机位置
    const driverLat = parseFloat(driverData.current_latitude);
    const driverLng = parseFloat(driverData.current_longitude);
    
    // 创建司机标记 (使用智能动态图标)
    const iconUrl = getDriverIconUrl(iconType);
    const driverIcon = L.divIcon({
        html: `<img src="${iconUrl}" style="width: 105px; height: 105px; border-radius: 50%; border: 3px solid white;">`,
        iconSize: [105, 105],
        className: 'driver-marker'
    });
    
    const driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon })
        .addTo(map)
        .bindPopup(`
            <div style="text-align: center;">
                <strong>${driverData.driver_name || '配送司机'}</strong><br>
                <small>状态: ${getDriverStatusText(iconType)}</small><br>
                <small>最后更新: ${formatDateTime(driverData.last_location_update)}</small>
            </div>
        `);
    
    // 尝试为配送地址添加标记
    geocodeDeliveryAddress(deliveryAddress).then(coords => {
        if (coords) {
            // 创建配送地址标记 (红色房子图标)
            const destIcon = L.divIcon({
                html: '<i class="bi bi-house-fill" style="color: #f44336; font-size: 20px;"></i>',
                iconSize: [25, 25],
                className: 'destination-marker'
            });
            
            const destMarker = L.marker([coords.lat, coords.lng], { icon: destIcon })
                .addTo(map)
                .bindPopup(`
                    <div style="text-align: center;">
                        <strong>配送地址</strong><br>
                        <small>${deliveryAddress}</small>
                    </div>
                `);
            
            // 调整地图视角以包含两个点
            const group = new L.featureGroup([driverMarker, destMarker]);
            map.fitBounds(group.getBounds().pad(0.1));
        } else {
            // 只有司机位置时，居中显示
            map.setView([driverLat, driverLng], 14);
        }
    });
    
    // 存储地图实例和司机标记
    driverLocationMaps.set(orderId, { map, driverMarker, driverData, iconType });
}

// 显示Google Maps地图
async function displayGoogleMap(orderId, driverData, deliveryAddress, mapContainer, iconType = 'normal') {
    const driverLat = parseFloat(driverData.current_latitude);
    const driverLng = parseFloat(driverData.current_longitude);
    
    // 创建Google Maps
    const map = new google.maps.Map(mapContainer, {
        center: { lat: driverLat, lng: driverLng },
        zoom: 14,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        gestureHandling: 'greedy',
        zoomControl: true,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
            position: google.maps.ControlPosition.TOP_CENTER,
            mapTypeIds: [
                google.maps.MapTypeId.ROADMAP,
                google.maps.MapTypeId.SATELLITE,
                google.maps.MapTypeId.HYBRID,
                google.maps.MapTypeId.TERRAIN
            ]
        }
    });
    
    // 创建司机标记 - 使用智能动态图标
    const iconUrl = getDriverIconUrl(iconType);
    const driverMarker = new google.maps.Marker({
        position: { lat: driverLat, lng: driverLng },
        map: map,
        title: driverData.driver_name || '配送司机',
        icon: {
            url: iconUrl,  // 使用智能选择的图标
            scaledSize: new google.maps.Size(105, 105),  // 放大1.5倍到105x105像素
            anchor: new google.maps.Point(52.5, 52.5)
        }
    });
    
    // 司机信息窗口
    const driverInfoWindow = new google.maps.InfoWindow({
        content: `
            <div style="padding: 5px; text-align: center;">
                <strong>${driverData.driver_name || '配送司机'}</strong><br>
                <small>状态: ${getDriverStatusText(iconType)}</small><br>
                <small>最后更新: ${formatDateTime(driverData.last_location_update)}</small>
            </div>
        `
    });
    
    driverMarker.addListener('click', () => {
        driverInfoWindow.open(map, driverMarker);
    });
    
    // 尝试为配送地址添加标记
    const deliveryCoords = await geocodeDeliveryAddress(deliveryAddress);
    let destMarker = null;
    
    if (deliveryCoords) {
        destMarker = new google.maps.Marker({
            position: { lat: deliveryCoords.lat, lng: deliveryCoords.lng },
            map: map,
            title: '配送地址',
            icon: {
                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="15" fill="#F44336" stroke="white" stroke-width="2"/>
                        <text x="16" y="22" text-anchor="middle" fill="white" font-family="Arial" font-size="16" font-weight="bold">🏠</text>
                    </svg>
                `),
                scaledSize: new google.maps.Size(32, 32),
                anchor: new google.maps.Point(16, 16)
            }
        });
        
        // 配送地址信息窗口
        const destInfoWindow = new google.maps.InfoWindow({
            content: `
                <div style="padding: 5px; text-align: center;">
                    <strong>配送地址</strong><br>
                    <small>${deliveryAddress}</small>
                </div>
            `
        });
        
        destMarker.addListener('click', () => {
            destInfoWindow.open(map, destMarker);
        });
        
        // 调整地图视角以包含两个点
        const bounds = new google.maps.LatLngBounds();
        bounds.extend({ lat: driverLat, lng: driverLng });
        bounds.extend({ lat: deliveryCoords.lat, lng: deliveryCoords.lng });
        map.fitBounds(bounds);
        
        // 确保最小缩放级别
        google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            if (map.getZoom() > 16) {
                map.setZoom(16);
            }
        });
    }
    
    // 存储地图实例和标记
    driverLocationMaps.set(orderId, { 
        map, 
        driverMarker, 
        destMarker,
        driverData,
        driverInfoWindow,
        iconType,
        isGoogleMap: true 
    });
}

function updateDriverMarker(mapData, newDriverData, newIconType) {
    const { map, driverMarker, isGoogleMap, iconType: currentIconType } = mapData;
    const newLat = parseFloat(newDriverData.current_latitude);
    const newLng = parseFloat(newDriverData.current_longitude);
    
    if (isGoogleMap) {
        // Google Maps更新
        driverMarker.setPosition({ lat: newLat, lng: newLng });
        
        // 如果图标类型发生变化，更新图标
        if (newIconType && newIconType !== currentIconType) {
            const newIconUrl = getDriverIconUrl(newIconType);
            driverMarker.setIcon({
                url: newIconUrl,
                scaledSize: new google.maps.Size(105, 105),
                anchor: new google.maps.Point(52.5, 52.5)
            });
        }
        
        // 更新信息窗口内容
        const newContent = `
            <div style="padding: 5px; text-align: center;">
                <strong>${newDriverData.driver_name || '配送司机'}</strong><br>
                <small>状态: ${getDriverStatusText(newIconType || currentIconType)}</small><br>
                <small>最后更新: ${formatDateTime(newDriverData.last_location_update)}</small>
            </div>
        `;
        
        // 如果有信息窗口，更新内容
        if (mapData.driverInfoWindow) {
            mapData.driverInfoWindow.setContent(newContent);
        }
    } else {
        // Leaflet地图更新
        driverMarker.setLatLng([newLat, newLng]);
        
        // 如果图标类型发生变化，更新图标
        if (newIconType && newIconType !== currentIconType) {
            const newIconUrl = getDriverIconUrl(newIconType);
            const newIcon = L.divIcon({
                html: `<img src="${newIconUrl}" style="width: 105px; height: 105px; border-radius: 50%; border: 3px solid white;">`,
                iconSize: [105, 105],
                className: 'driver-marker'
            });
            driverMarker.setIcon(newIcon);
        }
        
        // 更新弹窗内容
        driverMarker.setPopupContent(`
            <div style="text-align: center;">
                <strong>${newDriverData.driver_name || '配送司机'}</strong><br>
                <small>状态: ${getDriverStatusText(newIconType || currentIconType)}</small><br>
                <small>最后更新: ${formatDateTime(newDriverData.last_location_update)}</small>
            </div>
        `);
    }
    
    // 更新存储的数据
    mapData.driverData = newDriverData;
    if (newIconType) {
        mapData.iconType = newIconType;
    }
}

async function geocodeDeliveryAddress(address) {
    // 如果启用了Google地理编码代理
    if (MAP_CONFIG.useGoogleGeocoding && MAP_CONFIG.useProxyMaps) {
        try {
            const response = await fetch(
                `${API_BASE_URL}/maps/geocoding?address=${encodeURIComponent(address + ', Australia')}&components=country:AU`
            );
            const data = await response.json();
            
            if (data.status === 'OK' && data.results.length > 0) {
                const location = data.results[0].geometry.location;
                return {
                    lat: location.lat,
                    lng: location.lng
                };
            }
        } catch (error) {
            console.warn('Google地理编码失败，回退到Nominatim:', error);
        }
    }
    
    // 回退到Nominatim (OpenStreetMap的地理编码服务)
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Australia')}&limit=1`
        );
        const data = await response.json();
        
        if (data.length > 0) {
            return {
                lat: parseFloat(data[0].lat),
                lng: parseFloat(data[0].lon)
            };
        }
    } catch (error) {
        console.warn('地址地理编码失败:', error);
    }
    return null;
}

function updateLocationTime(orderId, timestamp) {
    const timeElement = document.getElementById(`location-time-${orderId}`);
    if (timeElement && timestamp) {
        const timeAgo = getTimeAgo(timestamp);
        timeElement.innerHTML = `<i class="bi bi-clock"></i> 位置更新于 ${timeAgo}`;
    }
}

function showLocationUnavailable(orderId) {
    const mapContainer = document.getElementById(`map-container-${orderId}`);
    const timeElement = document.getElementById(`location-time-${orderId}`);
    
    if (mapContainer) {
        mapContainer.className = 'map-loading';
        mapContainer.innerHTML = `
            <div class="text-center text-muted">
                <i class="bi bi-geo-alt-slash" style="font-size: 2rem; margin-bottom: 0.5rem;"></i>
                <div>司机位置暂时不可用</div>
                <small>司机可能正在准备配送</small>
            </div>
        `;
    }
    
    if (timeElement) {
        timeElement.innerHTML = '<i class="bi bi-exclamation-circle"></i> 位置信息暂时不可用';
    }
}

function getTimeAgo(timestamp) {
    if (!timestamp) return '未知';
    
    try {
        const now = new Date();
        const updateTime = new Date(timestamp);
        const diffMs = now - updateTime;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}小时前`;
        
        return formatDateTime(timestamp);
    } catch {
        return timestamp;
    }
}

// 获取司机状态文本描述
function getDriverStatusText(iconType) {
    const statusTexts = {
        normal: '正常配送',
        late: '可能延误',
        rain: '雨天配送',
        fallback: '配送中'
    };
    return statusTexts[iconType] || statusTexts.fallback;
}

// 获取司机状态颜色
function getDriverStatusColor(iconType) {
    const statusColors = {
        normal: 'success',
        late: 'warning', 
        rain: 'info',
        fallback: 'primary'
    };
    return statusColors[iconType] || statusColors.fallback;
}

// 更新司机状态显示
function updateDriverStatus(orderId, iconType) {
    const statusElement = document.getElementById(`driver-status-${orderId}`);
    if (statusElement) {
        const statusText = getDriverStatusText(iconType);
        const statusColor = getDriverStatusColor(iconType);
        
        statusElement.innerHTML = `
            <span class="badge bg-${statusColor}">
                <i class="bi bi-circle-fill me-1" style="font-size: 8px;"></i>
                ${statusText}
            </span>
        `;
        
        // 添加状态说明
        const explanationElement = document.getElementById(`status-explanation-${orderId}`);
        if (explanationElement) {
            let explanation = '';
            switch (iconType) {
                case 'late':
                    explanation = '<small class="text-muted"><i class="bi bi-info-circle"></i> 该司机最近完成订单有延误记录</small>';
                    break;
                case 'rain':
                    explanation = '<small class="text-muted"><i class="bi bi-cloud-rain"></i> 司机所在区域正在下雨，可能影响配送速度</small>';
                    break;
                case 'normal':
                    explanation = '<small class="text-muted"><i class="bi bi-check-circle"></i> 司机配送表现良好</small>';
                    break;
                default:
                    explanation = '';
            }
            explanationElement.innerHTML = explanation;
        }
    }
}

// 清理函数 - 在重新查询时清理地图和定时器
function cleanupMapsAndIntervals() {
    // 清理地图实例
    driverLocationMaps.forEach((mapData, orderId) => {
        if (mapData.map) {
            if (mapData.isGoogleMap) {
                // Google Maps没有remove方法，直接清除内容
                mapData.map = null;
            } else {
                mapData.map.remove();
            }
        }
    });
    driverLocationMaps.clear();
    
    // 清理定时器
    locationUpdateIntervals.forEach((intervalId) => {
        clearInterval(intervalId);
    });
    locationUpdateIntervals.clear();
    
    // 清理缓存
    driverIconCache.clear();
    // 保留天气缓存，避免短时间内重复查询
}

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
