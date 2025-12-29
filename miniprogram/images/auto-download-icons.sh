#!/bin/bash
# TabBar 图标自动下载脚本

cd "$(dirname "$0")"
ICON_DIR="$(pwd)"

echo "=== TabBar 图标自动下载 ==="
echo ""

# 创建临时目录
TMP_DIR="/tmp/xiaocx-icons"
mkdir -p "$TMP_DIR"

# 图标配置
declare -A ICONS=(
    ["home"]="首页"
    ["schedule"]="课程表"
    ["ranking"]="排行榜"
    ["profile"]="我的"
)

echo "注意：由于版权和资源限制，无法自动下载图标文件。"
echo "请按照以下步骤手动下载："
echo ""
echo "1. 访问 https://www.iconfont.cn/"
echo "2. 搜索并下载以下图标："
echo ""

for icon in "${!ICONS[@]}"; do
    echo "   ${ICONS[$icon]} ($icon):"
    echo "   - 搜索: ${ICONS[$icon]} 或 $icon"
    echo "   - 下载轮廓样式（未选中）和实心样式（选中）"
    echo "   - 尺寸: 81px × 81px"
    echo "   - 格式: PNG"
    echo "   - 颜色: 未选中 #999999, 选中 #1a1a1a"
    echo ""
done

echo "3. 将下载的图标重命名并放入当前目录："
echo "   home.png / home-active.png"
echo "   schedule.png / schedule-active.png"
echo "   ranking.png / ranking-active.png"
echo "   profile.png / profile-active.png"
echo ""

# 检查是否已有图标
echo "检查现有图标文件..."
for icon in "${!ICONS[@]}"; do
    if [ -f "$ICON_DIR/$icon.png" ] && [ -f "$ICON_DIR/$icon-active.png" ]; then
        echo "✓ $icon 图标已存在"
    else
        echo "✗ $icon 图标缺失"
    fi
done

echo ""
echo "提示：可以使用在线工具快速生成图标："
echo "- https://www.iconfont.cn/ (推荐)"
echo "- https://remixicon.com/"
echo "- https://heroicons.com/"

