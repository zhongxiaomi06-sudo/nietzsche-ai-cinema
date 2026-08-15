#!/usr/bin/env bash
# ============================================================
# 尼采数字分身 · 一键部署到 AWS EC2
# 用法（在本地 nietzsche/ 目录运行）：
#   EC2_HOST=1.2.3.4 \
#   EC2_KEY=~/.ssh/your-key.pem \
#   EC2_USER=ec2-user \          # Amazon Linux 用 ec2-user；Ubuntu 用 ubuntu
#   DEEPSEEK_KEY=sk-xxxx \
#   ./deploy.sh
# ============================================================
set -euo pipefail

EC2_HOST="${EC2_HOST:?请设置 EC2_HOST（实例公网 IP）}"
EC2_KEY="${EC2_KEY:?请设置 EC2_KEY（SSH 私钥路径）}"
EC2_USER="${EC2_USER:-ec2-user}"
DEEPSEEK_KEY="${DEEPSEEK_KEY:?请设置 DEEPSEEK_KEY（DeepSeek API Key）}"
PORT="${PORT:-8080}"

LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_DIR="/home/${EC2_USER}/nietzsche"

echo "==> [1/3] 上传 nietzsche/ 到 ${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}"
rsync -avz --delete \
  -e "ssh -i ${EC2_KEY} -o StrictHostKeyChecking=no" \
  "${LOCAL_DIR}/" "${EC2_USER}@${EC2_HOST}:${REMOTE_DIR}/"

echo "==> [2/3] 远程安装 Python3 + 注册 systemd 服务"
ssh -i "${EC2_KEY}" -o StrictHostKeyChecking=no "${EC2_USER}@${EC2_HOST}" bash -s <<EOF
set -e
# 装 python3（按发行版）
if command -v yum >/dev/null 2>&1; then
  sudo yum install -y python3 >/dev/null 2>&1 || true
elif command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update >/dev/null 2>&1 && sudo apt-get install -y python3 >/dev/null 2>&1 || true
fi

# 写 systemd unit（DEEPSEEK_KEY 以环境变量注入，不落前端）
sudo tee /etc/systemd/system/nietzsche.service >/dev/null <<UNIT
[Unit]
Description=Nietzsche AI Cinema Proxy
After=network.target

[Service]
Type=simple
WorkingDirectory=${REMOTE_DIR}
Environment=DEEPSEEK_KEY=${DEEPSEEK_KEY}
Environment=PORT=${PORT}
Environment=HOST=0.0.0.0
ExecStart=/usr/bin/python3 ${REMOTE_DIR}/server.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable --now nietzsche

# 等待启动
sleep 2
echo "本地健康检查："
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:${PORT}/cinema.html || echo "（curl 未安装，跳过自检）"
EOF

echo "==> [3/3] 完成"
echo "公网访问： http://${EC2_HOST}:${PORT}/cinema.html"
echo "提示：若安全组未开放 ${PORT}，请到 AWS 控制台 → 安全组 → 入站规则添加 TCP ${PORT}。"
