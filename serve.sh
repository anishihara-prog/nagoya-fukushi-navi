#!/bin/bash
# ローカルサーバー + cloudflared トンネル起動スクリプト
# 起動後にスマホ用QRコードを表示します

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=5500

# 既存のcloudflaredを停止
pkill -f cloudflared 2>/dev/null
sleep 1

# HTTPサーバーが起動していなければ起動
if ! curl -s "http://localhost:$PORT" &>/dev/null; then
  cd "$SCRIPT_DIR"
  serve -l $PORT . &>/dev/null &
  sleep 1
fi
echo "✅ HTTPサーバー確認 → http://localhost:$PORT"

# cloudflared トンネル起動 (URLをログから抽出)
TUNNEL_LOG=$(mktemp)
"$SCRIPT_DIR/cloudflared" tunnel --url "http://localhost:$PORT" --no-autoupdate 2>"$TUNNEL_LOG" &
CLOUDFLARED_PID=$!

echo "⏳ トンネル接続中..."

# URLが出るまで待機
TUNNEL_URL=""
for i in $(seq 1 20); do
  TUNNEL_URL=$(grep -o 'https://[a-zA-Z0-9._-]*\.trycloudflare\.com' "$TUNNEL_LOG" 2>/dev/null | head -1)
  [ -n "$TUNNEL_URL" ] && break
  sleep 1
done

rm -f "$TUNNEL_LOG"

if [ -z "$TUNNEL_URL" ]; then
  echo "❌ トンネルURLの取得に失敗しました"
  exit 1
fi

echo ""
echo "🌐 スマホ用URL: $TUNNEL_URL"
echo ""

# QRコード表示
QR_DIR="$SCRIPT_DIR/.qr"
if [ ! -d "$QR_DIR/node_modules/qrcode-terminal" ]; then
  echo "📦 QRコードツールをインストール中..."
  npm install qrcode-terminal --prefix "$QR_DIR" --silent 2>/dev/null
fi
node -e "
var qrcode = require('$QR_DIR/node_modules/qrcode-terminal');
qrcode.generate('$TUNNEL_URL', {small:true}, function(q){console.log(q);});
" 2>/dev/null || echo "(QRコード表示失敗 — URLを直接入力してください)"

echo ""
echo "📱 スマホのカメラでQRコードを読み取ってください"
echo "   終了: Ctrl+C"
echo ""

# cloudflared が終了したら一緒に終了
wait $CLOUDFLARED_PID
