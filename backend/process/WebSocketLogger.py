import asyncio

class WebSocketLogger:
    def __init__(self, queue: asyncio.Queue):
        self.queue = queue

    def write(self, message: str):
        if message.strip():
            self.queue.put_nowait(message)

    def flush(self):
        pass  # cho tương thích với sys.stdout
