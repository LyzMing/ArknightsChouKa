@echo off
rem 双击启动：本地服务器 + 自动打开浏览器
cd /d %~dp0
start "拉包模拟器服务" node server.mjs
timeout /t 1 >nul
start "" "http://127.0.0.1:8765/"
