#!/usr/bin/env bash
# MIND 本地服务启动脚本（macOS / Linux）
# 运行后访问 http://127.0.0.1:8000 ，数据自动落盘到 data/
cd "$(dirname "$0")"
node server.js
