#!/bin/bash
# MySQL 下载进度监控脚本

echo "=== MySQL 下载监控 ==="
echo "按 Ctrl+C 退出"
echo ""

while true; do
    clear
    echo "=== MySQL 下载状态 ($(date '+%H:%M:%S')) ==="
    echo ""
    
    # 检查下载进程
    PROCESS=$(ps aux | grep -i "curl.*mysql" | grep -v grep)
    if [ -n "$PROCESS" ]; then
        PID=$(echo "$PROCESS" | awk '{print $2}')
        RUNTIME=$(echo "$PROCESS" | awk '{print $10}')
        echo "✓ 下载进程运行中"
        echo "  PID: $PID"
        echo "  运行时间: $RUNTIME"
    else
        echo "✗ 未找到下载进程"
    fi
    echo ""
    
    # 检查下载文件
    FILE=$(ls /Users/mxs/Library/Caches/Homebrew/downloads/*mysql*.incomplete 2>/dev/null | head -1)
    if [ -n "$FILE" ]; then
        SIZE=$(ls -lh "$FILE" | awk '{print $5}')
        MTIME=$(ls -lh "$FILE" | awk '{print $6, $7, $8}')
        echo "✓ 下载文件存在"
        echo "  大小: $SIZE"
        echo "  最后更新: $MTIME"
    else
        echo "✗ 未找到下载文件"
        echo "  （可能下载已完成）"
    fi
    echo ""
    
    # 检查安装状态
    if brew list mysql &>/dev/null; then
        echo "✓ MySQL 已安装完成！"
        echo ""
        echo "下一步："
        echo "  brew services start mysql"
        break
    else
        echo "✗ MySQL 尚未安装"
    fi
    echo ""
    echo "--- 2秒后刷新 ---"
    sleep 2
done

