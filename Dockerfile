FROM python:3.11-slim

WORKDIR /app

# 复制整个 nietzsche/（含 server.py 与 archive/）
COPY . /app/

EXPOSE 8080

ENV PORT=8080
ENV HOST=0.0.0.0
# DEEPSEEK_KEY 请在 run 时通过 -e 注入，不要写进镜像

CMD ["python3", "server.py"]
