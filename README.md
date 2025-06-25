# 好鲜生配送查询系统 (Delivery Track)

## 📋 项目概述

这是一个基于Web的配送订单实时查询系统，专为好鲜生的客户设计。客户可以通过输入手机号码来查询正在配送中的订单状态、预计送达时间和司机信息。

## ✨ 主要功能

### 🔍 订单查询
- **手机号查询**：客户输入收件人手机号码即可查询相关订单
- **实时状态**：显示订单的当前配送状态（已接收、处理中、配送中等）
- **多订单支持**：如果同一手机号有多个配送中的订单，会全部显示

### 📊 订单信息展示
- **基本信息**：订单号、收件人姓名、配送地址
- **时间信息**：预计送达时间（±30分钟窗口）、实际到达时间
- **司机信息**：配送司机姓名和联系电话
- **订单备注**：特殊配送要求或说明

### 🗺️ 司机实时位置追踪 ⭐ 新功能
- **实时地图**：正在配送的订单显示司机当前位置
- **双标记系统**：蓝色卡车图标显示司机位置，红色房子图标显示配送地址
- **自动更新**：每30秒自动刷新司机位置
- **位置时间戳**：显示位置最后更新时间
- **智能地图视角**：自动调整地图范围以显示司机和目的地

### 🎨 用户体验
- **响应式设计**：支持手机、平板、桌面设备
- **品牌风格**：使用好鲜生的橙色/绿色主题色彩
- **流畅动画**：包含加载动画和过渡效果
- **直观界面**：清晰的状态标识和图标系统

## 🏗️ 技术架构

### 前端技术栈
- **HTML5**：语义化结构
- **CSS3**：
  - Bootstrap 5.3.0 框架
  - CSS Grid/Flexbox 布局
  - CSS变量定义品牌色彩
  - 渐变背景和动画效果
- **JavaScript ES6+**：
  - 原生JS（无框架依赖）
  - Fetch API 进行HTTP请求
  - 异步/等待模式
  - 表单验证和错误处理
- **地图系统**：
  - **Google Maps** (推荐) - 高质量地图和地理编码
  - **Leaflet 1.9.4** (备用) - 开源地图库
  - 多种地图样式：卫星图、街道图、地形图
  - 智能地理编码：Google Geocoding API + Nominatim备用

### 后端集成
- **API端点**：Cloudflare Worker (`https://delivery-track-api.haofreshbne.workers.dev`)
- **订单查询**：POST `/track-order` (无需认证)
- **司机位置**：GET `/driver-location/{route_id}` (需要API密钥)
- **数据格式**：JSON
- **环境变量**：BACKEND_URL, API_KEY, GOOGLE_MAPS_API_KEY

### 状态系统
支持以下订单状态：
- 📋 订单已接收
- ⚙️ 订单已处理  
- 📅 已分配配送
- 📅 配送已安排
- 🚚 正在配送
- ✅ 配送完成
- ❌ 配送失败

## 📁 文件结构

```
delivery-track/
├── index.html          # 主页面文件 (包含Leaflet地图库)
├── app.js              # JavaScript逻辑 (包含地图和位置追踪功能)
├── backend workers.js  # Cloudflare Worker代码
├── logo2.jpg           # 好鲜生Logo
├── theman.GIF          # 加载动画
└── README.md           # 项目文档
```

## 🚀 使用方法

### 客户使用流程
1. **访问查询页面**：打开 `delivery-track.pages.dev`
2. **输入手机号**：输入下单时的收件人手机号
3. **查看订单状态**：系统显示正在配送中的订单
4. **实时位置追踪**：如果订单状态为"正在配送"，会自动显示：
   - 司机当前位置（蓝色卡车图标）
   - 配送目的地（红色房子图标）
   - 位置最后更新时间
   - 每30秒自动刷新位置

### 部署配置

#### 前端部署 (Cloudflare Pages)
1. 连接GitHub仓库到Cloudflare Pages
2. 设置自动部署：`delivery-track.pages.dev`
3. 每次推送代码自动更新

#### 后端部署 (Cloudflare Worker)
1. 手动复制 `backend workers.js` 到Cloudflare Worker
2. 在Dashboard中设置环境变量：
   - `BACKEND_URL` = 你的后端API地址
   - `API_KEY` = API访问密钥
   - `GOOGLE_MAPS_API_KEY` = Google Maps API密钥（推荐）

#### Google Maps API设置（推荐）
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建项目并启用以下API：
   - Maps JavaScript API
   - Geocoding API
3. 创建API密钥并设置使用限制
4. 将密钥添加到Worker环境变量
5. **注意**：没有Google Maps API时会自动使用免费的Leaflet地图

### 集成示例
支持URL参数自动填充：
```
https://delivery-track.pages.dev?phone=0412345678
```

## 🔧 开发指南

### 本地开发
1. 克隆项目到本地
2. 使用任何HTTP服务器运行（如Live Server）
3. 修改API_BASE_URL为开发环境地址

### 自定义样式
主要CSS变量位于 `:root` 选择器中：
```css
:root {
    --hao-orange: #ff9800;        /* 主橙色 */
    --hao-orange-light: #ffb74d;  /* 浅橙色 */
    --hao-orange-dark: #f57c00;   /* 深橙色 */
    --hao-green: #4caf50;         /* 主绿色 */
    --hao-green-light: #81c784;   /* 浅绿色 */
    --hao-green-dark: #388e3c;    /* 深绿色 */
}
```

### API接口要求
后端需要提供的API响应格式：
```json
{
    "success": true,
    "orders": [
        {
            "order_id": "ORD123456",
            "display_status": "正在配送",
            "recipient_name": "张三",
            "recipient_address": "123 Main St",
            "recipient_suburb": "Brisbane",
            "estimated_arrival_time": "2025-01-20T14:30:00Z",
            "actual_arrival_time": null,
            "driver_info": {
                "name": "李师傅",
                "phone": "0412345678"
            },
            "order_note": "请放在门口"
        }
    ]
}
```

## 🛠️ 待开发功能

### 短期计划
- [x] ~~订单地图显示~~ ✅ 已完成 (使用Leaflet + OpenStreetMap)
- [ ] 推送通知（浏览器通知API）
- [ ] 配送路径实时追踪（显示司机行驶路线）
- [ ] 多语言支持（英文版本）

### 中期计划
- [ ] 移动APP版本（React Native）
- [ ] 订单评价功能
- [ ] 配送历史查询
- [ ] 客服聊天集成
- [ ] 地图性能优化（点聚合）

### 长期计划
- [ ] AI智能客服
- [ ] 预测配送时间优化
- [ ] 客户偏好学习
- [ ] 配送密度热力图

## 🐛 已知问题

- 手机号格式验证仅支持数字和常见符号
- 加载动画在慢网络下可能显示时间过长
- 没有缓存机制，每次查询都会发送新请求
- 地址地理编码依赖外部服务，可能偶尔失败
- 地图在移动设备上的触摸操作可能不够流畅

## 🔄 更新日志

### v2.0.0 (当前版本) - 司机实时位置追踪
- ✅ **司机实时位置追踪** - 正在配送订单显示司机当前位置
- ✅ **交互式地图** - 使用Leaflet显示司机位置和配送地址
- ✅ **自动位置更新** - 每30秒自动刷新司机位置
- ✅ **智能地图视角** - 自动调整地图范围包含司机和目的地
- ✅ **位置时间显示** - 显示位置最后更新时间
- ✅ **后端API扩展** - 订单查询API增加route_id支持

### v1.0.0 (基础版本)
- ✅ 基础查询功能
- ✅ 响应式设计
- ✅ 状态显示系统
- ✅ 司机信息展示
- ✅ 时间格式化

## 📞 技术支持

如有技术问题，请联系开发团队或查看相关文档。

---
*好鲜生 - 新鲜到家，就选好鲜生* 🥬🍎🥕