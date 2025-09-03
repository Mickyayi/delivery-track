#!/bin/bash

echo "🌤️  测试智能司机图标系统 - 天气API功能"
echo "================================================"

# 测试1: 布里斯班当前天气
echo ""
echo "📍 测试1: 布里斯班天气 (-27.4698, 153.0251)"
echo "----------------------------------------"
RESPONSE1=$(curl -s "https://delivery-track-api.haofreshbne.workers.dev/weather/-27.4698/153.0251")
echo "响应: $RESPONSE1"
echo "$RESPONSE1" | jq . 2>/dev/null || echo "❌ JSON解析失败"

# 测试2: 悉尼天气
echo ""
echo "📍 测试2: 悉尼天气 (-33.8688, 151.2093)"
echo "----------------------------------------"
RESPONSE2=$(curl -s "https://delivery-track-api.haofreshbne.workers.dev/weather/-33.8688/151.2093")
echo "响应: $RESPONSE2"
echo "$RESPONSE2" | jq . 2>/dev/null || echo "❌ JSON解析失败"

# 测试3: 墨尔本天气  
echo ""
echo "📍 测试3: 墨尔本天气 (-37.8136, 144.9631)"
echo "----------------------------------------"
RESPONSE3=$(curl -s "https://delivery-track-api.haofreshbne.workers.dev/weather/-37.8136/144.9631")
echo "响应: $RESPONSE3"
echo "$RESPONSE3" | jq . 2>/dev/null || echo "❌ JSON解析失败"

# 测试4: 无效坐标
echo ""
echo "📍 测试4: 无效坐标 (999, 999)"
echo "----------------------------------------"
RESPONSE4=$(curl -s "https://delivery-track-api.haofreshbne.workers.dev/weather/999/999")
echo "响应: $RESPONSE4"
echo "$RESPONSE4" | jq . 2>/dev/null || echo "❌ JSON解析失败"

echo ""
echo "🏁 测试完成"
