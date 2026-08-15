# 部署到 AWS —— 让公网跑上「真 AI」数字分身

## 为什么 AWS 很合适
- `server.py` 是**纯标准库 Python**（只用了 `http.server` / `urllib`，零第三方依赖），
  无需 `pip install`，体积几 KB。
- **DeepSeek 推理在云端跑**，这台服务器只是「转发 + 静态托管 + 写反馈文件」，
  不消耗 GPU、几乎不占 CPU/内存。
- 因此 AWS 上最便宜的 **`t2.micro`（免费层，1 vCPU / 1GB）都绰绰有余**，
  同时扛几十个并发访问也没问题。

## 架构（一句话）
```
用户浏览器 ──http://<EC2公网IP>:8080/cinema.html──▶ EC2 上的 server.py
                                                  │  托管 cinema.html 等静态文件
                                                  └─▶ POST /api/twin ──▶ DeepSeek 云端
```
因为前端（`cinema.html`）调的是同源相对路径 `/api/twin`，
部署到 EC2 同域后**自动免 CORS，前端一行都不用改**。

---

## 方式一：EC2 直接跑（推荐，最简单）

### 1. 起实例
- 镜像：Amazon Linux 2023 或 Ubuntu 22.04 LTS
- 机型：**`t2.micro`**（免费层）即可；预算宽松可选 `t3.small`
- 存储：8–16 GB gp3 足够（图片约 25MB，其余极小）

### 2. 配置安全组（Security Group）
入站规则添加一条：
| 类型 | 协议 | 端口 | 来源 |
|---|---|---|---|
| 自定义 TCP | TCP | 8080 | `0.0.0.0/0`（或仅你的 IP，见「安全提示」） |

> 出方向默认全开即可（server 要访问 `api.deepseek.com:443`）。

### 3. 上传文件
把整个 `nietzsche/` 目录传上去（含 `server.py` 与 `archive/`）：
```bash
rsync -avz -e "ssh -i ~/.ssh/你的key.pem" \
  /本地路径/nietzsche/ ec2-user@<公网IP>:~/nietzsche/
```

### 4. 启动服务
```bash
ssh -i ~/.ssh/你的key.pem ec2-user@<公网IP>
cd ~/nietzsche
DEEPSEEK_KEY=sk-你的key PORT=8080 HOST=0.0.0.0 python3 server.py
```
生产环境建议用 systemd 守护（见 `deploy.sh` 自动完成）。

### 5. 访问
浏览器打开：**`http://<公网IP>:8080/cinema.html`**
→ 点开右侧推演抽屉，AI 改写 / 终幕复盘 / 分身对话全是真 DeepSeek 输出。

---

## 一键部署脚本：`deploy.sh`
在**本地**运行，自动完成「上传 + 装依赖 + 注册 systemd + 启动」：
```bash
EC2_HOST=1.2.3.4 \
EC2_KEY=~/.ssh/你的key.pem \
EC2_USER=ec2-user \          # Amazon Linux 用 ec2-user；Ubuntu 用 ubuntu
DEEPSEEK_KEY=sk-你的key \
./deploy.sh
```
脚本会：用 rsync 同步目录 → 远程安装 python3 → 写入 `/etc/systemd/system/nietzsche.service`
（含 `DEEPSEEK_KEY` 环境变量）→ `systemctl enable --now nietzsche` 守护进程。

---

## 方式二：Docker / ECS 容器化（可选）
若你更习惯容器或想上 ECS / Fargate：
```bash
docker build -t nietzsche-ai .
docker run -d --restart=always -p 8080:8080 \
  -e DEEPSEEK_KEY=sk-你的key -e HOST=0.0.0.0 nietzsche-ai
```
`Dockerfile` 已随附，基于 `python:3.11-slim`，镜像极小。

---

## 进阶：HTTPS + 域名（生产建议）
8080 + HTTP 明文在生产环境不够稳妥。两条路：
1. **Caddy（最省心）**：`Caddyfile` 写 `你的域名 { reverse_proxy localhost:8080 }`，
   自动申请 Let's Encrypt 免费证书、强制 HTTPS，一条命令搞定。
2. **Nginx 反代**：`proxy_pass http://127.0.0.1:8080;`，配合 certbot 申请证书。

---

## 安全提示（重要）
- 把 8080 直接对 `0.0.0.0/0` 开放，意味着**任何人都可调你的 `/api/twin`、消耗你的 DeepSeek 额度**。
  建议：
  1. 安全组来源限定为你自己的 IP（`curl ifconfig.me` 查看）；或
  2. 套一层 Nginx/Caddy + 基础认证（Basic Auth）；或
  3. 在 `server.py` 里给 `/api/twin` 加一个简单 `?token=` 校验。
- `DEEPSEEK_KEY` 写在 systemd unit / docker `-e` 里，仅本机 root 可读，风险可控。

---

## 验证「真 AI」确实跑通
```bash
curl -s -X POST http://<公网IP>:8080/api/twin \
  -H 'Content-Type: application/json' \
  -d '{"model":"deepseek-chat","messages":[{"role":"user","content":"用一句话介绍尼采"}],"max_tokens":200}' \
  | python3 -m json.tool
```
返回里 `raw` 含 DeepSeek 真实回答即成功；若 `ok:false` 且 `error:"no-key-configured"`，
说明 `DEEPSEEK_KEY` 没注入。
