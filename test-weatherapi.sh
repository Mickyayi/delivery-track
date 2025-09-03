#!/bin/bash

echo "🌤️  WeatherAPI.com 测试脚本"
echo "==============================="

echo ""
echo "📋 请先完成以下步骤："
echo "1. 访问 https://www.weatherapi.com/signup.aspx"
echo "2. 免费注册获取API密钥"
echo "3. 复制 backend-weatherapi.js 到Cloudflare Worker"
echo "4. 更新环境变量 WEATHER_API_KEY"
echo ""

read -p "是否已完成上述步骤？(y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    echo "请先完成配置步骤，然后重新运行测试"
    exit 1
fi

echo ""
echo "🧪 开始测试WeatherAPI.com集成..."
echo "================================"

# 测试1: 布里斯班天气
echo ""
echo "📍 测试1: 布里斯班天气"
echo "------------------------"
RESPONSE1=$(curl -s "https://delivery-track-api.haofreshbne.workers.dev/weather/-27.4698/153.0251")
echo "$RESPONSE1" | jq . 2>/dev/null || echo "响应: $RESPONSE1"

# 检查是否成功
if echo "$RESPONSE1" | jq -e '.provider == "weatherapi.com"' > /dev/null 2>&1; then
    echo "✅ WeatherAPI.com 工作正常！"
    
    # 检查下雨状态
    IS_RAINING=$(echo "$RESPONSE1" | jq -r '.isRaining')
    WEATHER=$(echo "$RESPONSE1" | jq -r '.weather')
    TEMP=$(echo "$RESPONSE1" | jq -r '.temperature')
    
    echo "🌤️  当前天气: $WEATHER"
    echo "🌡️  温度: ${TEMP}°C"
    echo "☔ 是否下雨: $IS_RAINING"
    
    if [ "$IS_RAINING" = "true" ]; then
        echo "🎯 智能司机图标: rain.gif (雨天配送)"
    else
        echo "🎯 智能司机图标: 基于配送表现 (normal.gif/late.gif)"
    fi
    
else
    echo "❌ WeatherAPI.com 集成失败"
    echo "📋 检查项："
    echo "   - API密钥是否正确配置"
    echo "   - Worker是否已重新部署"
    echo "   - 环境变量名称是否为 WEATHER_API_KEY"
fi

# 测试2: 悉尼天气
echo ""
echo "📍 测试2: 悉尼天气"
echo "-------------------"
RESPONSE2=$(curl -s "https://delivery-track-api.haofreshbne.workers.dev/weather/-33.8688/151.2093")
echo "$RESPONSE2" | jq -r '.weather // "API调用失败"'

echo ""
echo "🏁 测试完成"
echo ""
echo "💡 提示："
echo "   - WeatherAPI.com 提供100万次/月免费调用"
echo "   - 数据更新频率: 15分钟"
echo "   - 全球覆盖，数据准确"
echo "   - 智能司机图标现在可以完整使用！"
