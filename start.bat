@echo off
REM MIND 本地服务启动脚本（Windows）
REM 双击本文件即可在 http://127.0.0.1:8000 打开应用，数据自动落盘到 data/
cd /d "%~dp0"
node server.js
pause
