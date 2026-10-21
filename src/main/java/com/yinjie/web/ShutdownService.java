package com.yinjie.web;

import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 处理页面「退出」按钮：先返回响应，再由后台线程优雅关闭 Spring 上下文并结束进程。
 * <p>关闭动作单独成 bean，便于在测试中 mock，避免测试进程被真的杀掉。</p>
 */
@Service
public class ShutdownService {

    /** 给 HTTP 响应该有的写出时间。 */
    private static final long EXIT_DELAY_MS = 500L;

    private final ApplicationContext applicationContext;
    private final AtomicBoolean shuttingDown = new AtomicBoolean(false);

    public ShutdownService(ApplicationContext applicationContext) {
        this.applicationContext = applicationContext;
    }

    /**
     * 请求关闭服务。
     *
     * @return 给前端的中文提示（第一次请求与重复请求的文案不同）
     */
    public String requestShutdown() {
        if (!shuttingDown.compareAndSet(false, true)) {
            return "服务已在关闭中，请稍候。";
        }
        Thread thread = new Thread(this::exitProcess, "fretboard-shutdown");
        thread.setDaemon(false);
        thread.start();
        return "服务正在关闭，可以关闭本页面。";
    }

    /** 是否已经收到过关闭请求（测试与日志用）。 */
    public boolean isShuttingDown() {
        return shuttingDown.get();
    }

    private void exitProcess() {
        try {
            Thread.sleep(EXIT_DELAY_MS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        int code = SpringApplication.exit(applicationContext, () -> 0);
        System.exit(code);
    }
}
