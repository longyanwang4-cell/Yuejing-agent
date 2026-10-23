# -*- coding: utf-8 -*-
"""模型调用限额。公网 Demo 没有登录，链接一泄露就会烧光额度，所以必须有全局日上限和单 IP 小时上限。
进程内计数，重启归零；多进程部署时每个进程各自计数（Demo 够用）。"""
import threading
import time
from datetime import date
from . import config


class Quota:
    def __init__(self):
        self._lock = threading.Lock()
        self._day = date.today()
        self._total = 0
        self._ip = {}          # ip -> [timestamps]

    def allow(self, ip: str) -> bool:
        """占用一次额度；超限返回 False，调用方应改走离线。"""
        now = time.time()
        with self._lock:
            if date.today() != self._day:
                self._day, self._total, self._ip = date.today(), 0, {}
            if self._total >= config.DAILY_MODEL_CALL_CAP:
                return False
            hist = [t for t in self._ip.get(ip, []) if now - t < 3600]
            if len(hist) >= config.PER_IP_PER_HOUR:
                self._ip[ip] = hist
                return False
            hist.append(now)
            self._ip[ip] = hist
            self._total += 1
            return True

    def snapshot(self):
        with self._lock:
            return {"used_today": self._total, "cap": config.DAILY_MODEL_CALL_CAP}


quota = Quota()
