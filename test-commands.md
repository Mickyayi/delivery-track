# Cloudflare Worker 测试命令

## 1. 测试Worker基础状态
```bash
curl -X GET "https://your-worker-url.workers.dev/"
```
**期望响应**: JSON格式的状态信息

## 2. 测试订单查询API
```bash
curl -X POST "https://your-worker-url.workers.dev/track-order" \
  -H "Content-Type: application/json" \
  -d '{"phone":"0412345678"}'
```

## 3. 测试天气API
```bash
curl -X GET "https://your-worker-url.workers.dev/weather/-27.4698/153.0251"
```

## 4. 测试CORS
```bash
curl -X OPTIONS "https://your-worker-url.workers.dev/track-order" \
  -H "Origin: https://delivery-track.pages.dev" \
  -v
```

## 常见错误排查

### Error 1011 (Access Denied)
- 检查Worker的域名绑定
- 确保Worker已正确部署

### 500 Internal Server Error
- 检查Worker代码语法
- 查看Worker的实时日志

### CORS错误
- 确保OPTIONS请求正确处理
- 检查corsHeaders配置

### 环境变量问题
- 在Worker Dashboard检查环境变量设置
- 使用测试版本检查配置状态
