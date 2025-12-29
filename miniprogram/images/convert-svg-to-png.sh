#!/bin/bash
# SVG 转 PNG 脚本
# 需要安装 ImageMagick 或 Inkscape

cd "$(dirname "$0")"

echo "开始转换 SVG 为 PNG..."

# 检查是否有转换工具
if command -v convert &> /dev/null; then
    CONVERT_CMD="convert"
elif command -v magick &> /dev/null; then
    CONVERT_CMD="magick"
elif command -v rsvg-convert &> /dev/null; then
    CONVERT_CMD="rsvg-convert"
else
    echo "错误：未找到图片转换工具"
    echo ""
    echo "请安装以下工具之一："
    echo "  - ImageMagick: brew install imagemagick"
    echo "  - Inkscape: brew install inkscape"
    echo ""
    echo "或使用在线工具转换："
    echo "  https://cloudconvert.com/svg-to-png"
    echo ""
    exit 1
fi

# 颜色配置
GRAY_COLOR="#999999"    # 未选中
DARK_COLOR="#1a1a1a"    # 选中

# 转换函数
convert_icon() {
    local svg_file=$1
    local png_file=$2
    local color=$3
    
    if [ "$CONVERT_CMD" = "convert" ] || [ "$CONVERT_CMD" = "magick" ]; then
        # 使用 ImageMagick
        $CONVERT_CMD -background none -resize 81x81 \
            -fill "$color" -colorize 100 \
            "$svg_file" "$png_file" 2>/dev/null
    elif [ "$CONVERT_CMD" = "rsvg-convert" ]; then
        # 使用 rsvg-convert
        rsvg-convert -w 81 -h 81 "$svg_file" -o "$png_file" 2>/dev/null
    fi
}

# 转换所有图标
for svg in *.svg; do
    if [ -f "$svg" ]; then
        name=$(basename "$svg" .svg)
        
        # 判断是选中还是未选中
        if [[ "$name" == *"-active" ]]; then
            color=$DARK_COLOR
            png_name="${name}.png"
        else
            color=$GRAY_COLOR
            png_name="${name}.png"
        fi
        
        echo "转换 $svg -> $png_name (颜色: $color)..."
        convert_icon "$svg" "$png_name" "$color"
        
        if [ -f "$png_name" ]; then
            echo "  ✓ $png_name 创建成功"
        else
            echo "  ✗ $png_name 创建失败"
        fi
    fi
done

echo ""
echo "转换完成！"
echo "如果转换失败，请使用在线工具：https://cloudconvert.com/svg-to-png"

